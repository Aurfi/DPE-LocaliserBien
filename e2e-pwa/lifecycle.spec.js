import { fillSearch } from '../e2e/fixtures.js'
import { expectedCacheEntries, sha256 } from '../scripts/pwa/artifacts.mjs'
import { baselineIds } from '../scripts/pwa/provenance.mjs'
import { expect, test } from './fixtures.js'

async function controlled(page) {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated')
}

async function cacheSnapshot(page) {
  return page.evaluate(async () => {
    const snapshot = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      const entries = []
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer())
        entries.push({
          url: request.url,
          sha256: [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('')
        })
      }
      snapshot.push({ name, entries: entries.sort((a, b) => a.url.localeCompare(b.url)) })
    }
    return snapshot.sort((a, b) => a.name.localeCompare(b.name))
  })
}

async function assertPrecache(page, descriptor, origin) {
  await expect
    .poll(async () => (await cacheSnapshot(page)).filter(cache => cache.name.includes('-precache-')))
    .toEqual([
      {
        name: `workbox-precache-v2-${origin}/`,
        entries: expectedCacheEntries(descriptor, origin)
      }
    ])
}

async function assertOnlyAppPrecache(page, descriptor, origin) {
  const snapshot = await cacheSnapshot(page)
  expect(snapshot).toEqual([
    {
      name: `workbox-precache-v2-${origin}/`,
      entries: expectedCacheEntries(descriptor, origin)
    }
  ])
}

for (const baselineId of baselineIds) {
  test.describe(baselineId, () => {
    test.use({ baselineId })
    test('installs the pinned worker, upgrades an open tab, cleans caches, and keeps results out of offline storage', async ({
      page,
      context,
      release,
      network
    }, testInfo) => {
      // Observe registration readiness without replacing registration, workers, or
      // event behavior. A controlled document alone does not prove that its async
      // Workbox client has attached update listeners after a returning-user reload.
      await page.addInitScript(() => {
        const container = navigator.serviceWorker
        if (!container) return
        const addEventListener = container.addEventListener
        container.addEventListener = function (...args) {
          const result = Reflect.apply(addEventListener, this, args)
          if (this === container && args[0] === 'controllerchange') window.__pwaAppListening = true
          return result
        }
      })
      // Open the observer BEFORE the old worker exists: its broader navigation
      // fallback would otherwise replace this small observer with the old app.
      const probe = await context.newPage()
      await probe.goto(`${release.origin}/__pwa_probe__.html`)
      expect(await probe.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
      const oldHtml = await page.goto(release.origin)
      expect(sha256(await oldHtml.body())).toBe(release.baseline.indexSha256)
      await controlled(page)
      await controlled(probe)
      await assertPrecache(probe, release.baseline, release.origin)
      expect(
        release.requests.some(request => request.pathname === '/sw.js' && request.sha256 === release.baseline.swSha256)
      ).toBe(true)

      // Emulate a returning user while the OLD release is still on the server.
      // This is deliberately before promotion, not an artificial upgrade-by-reload.
      await page.reload()
      await controlled(page)
      await expect(page.locator('script[type="module"][src]')).toHaveAttribute('src', release.baseline.moduleUrl)
      await expect.poll(() => page.evaluate(() => window.__pwaAppListening)).toBe(true)
      // The old public app renders a nested #app; its Vue mount is the direct body child.
      const mountSelector = baselineId === 'public-production-2026-10-03' ? 'body > #app' : '#app'
      await expect(page.locator(mountSelector)).toHaveAttribute('data-v-app', '')
      if (baselineId === 'earlier-candidate-7fe6a35') {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Retrouver un bien grâce à son DPE')
      } else {
        // The captured production home predates the candidate's h1. Assert its
        // actual rendered form and literal explanatory text, not a guessed title.
        await expect(
          page.getByText('Localiser une annonce immobilière grâce aux données de son DPE', { exact: true })
        ).toBeVisible()
        await expect(page.getByPlaceholder('ex : 13080 ou Lyon', { exact: true })).toBeVisible()
        await expect(page.getByPlaceholder('ex : 100', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Localiser', exact: true })).toBeVisible()
      }
      await page.evaluate(() => {
        window.__oldDocument = true
      })
      await probe.evaluate(async () => {
        window.__oldController = navigator.serviceWorker.controller
        window.__controllerChanges = 0
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.__controllerChanges += 1
        })
        const registration = await navigator.serviceWorker.getRegistration()
        window.__oldRegistration = registration
        window.__obsoleteCache = `workbox-precache-v1-${registration.scope}`
        const obsolete = await caches.open(window.__obsoleteCache)
        await obsolete.put('/__obsolete-test-asset__.js', new Response('old Workbox-format sentinel'))
      })

      // Both tabs stay open. Only the actual server release changes. No worker
      // rewriting, unregister/register replacement, forced skipWaiting, clock
      // manipulation, manual navigation, or manual reload is used from here.
      const autoNavigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame())
      release.promote()
      await probe.evaluate(async () => {
        await window.__oldRegistration.update()
      })
      await expect
        .poll(() =>
          probe.evaluate(() => ({
            changed: navigator.serviceWorker.controller !== window.__oldController,
            oldState: window.__oldController.state,
            newState: navigator.serviceWorker.controller?.state,
            changes: window.__controllerChanges
          }))
        )
        .toEqual({ changed: true, oldState: 'redundant', newState: 'activated', changes: 1 })
      await autoNavigation
      await page.waitForLoadState('domcontentloaded')
      await controlled(page)
      expect(await page.evaluate(() => window.__oldDocument)).toBeUndefined()
      await expect(page.locator('script[type="module"][src]')).toHaveAttribute('src', release.candidate.moduleUrl)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Retrouver un bien grâce à son DPE')
      expect(
        release.requests.some(
          request =>
            request.phase === 'candidate' &&
            request.pathname === '/sw.js' &&
            request.sha256 === release.candidate.swSha256
        )
      ).toBe(true)
      expect(release.baseline.swSha256).not.toBe(release.candidate.swSha256)
      await assertPrecache(probe, release.candidate, release.origin)
      expect(await probe.evaluate(() => caches.has(window.__obsoleteCache))).toBe(false)
      const registrationState = await probe.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return {
          scope: registration.scope,
          waiting: registration.waiting?.state ?? null,
          activeIsController: registration.active === navigator.serviceWorker.controller,
          scriptURL: registration.active.scriptURL
        }
      })
      expect(registrationState).toEqual({
        scope: `${release.origin}/`,
        waiting: null,
        activeIsController: true,
        scriptURL: `${release.origin}/sw.js`
      })

      // After the historical worker upgrades, guides must remain independent
      // network documents rather than being replaced by a cached application.
      const guidePage = await context.newPage()
      try {
        const response = await guidePage.goto(`${release.origin}/guides/retrouver-adresse-annonce/`)
        expect(response.status()).toBe(200)
        expect(response.fromServiceWorker()).toBe(false)
        await expect(guidePage.getByRole('heading', { level: 1 })).toHaveText(
          'Retrouver l’adresse d’une annonce immobilière'
        )
        await expect(guidePage.locator('script[type="module"]')).toHaveCount(0)
        expect((await guidePage.goto(`${release.origin}/guides/missing/`)).status()).toBe(404)
      } finally {
        await guidePage.close()
      }
      await assertOnlyAppPrecache(probe, release.candidate, release.origin)

      // The same GET must reach the real local fixture on every call.
      // It carries synthetic result data, never a real person's search or record.
      for (const sequence of [1, 2]) {
        const responsePromise = probe.waitForResponse(`${release.origin}/api/dpe-results?criteria=pwa-only`)
        const body = await probe.evaluate(async () => (await fetch('/api/dpe-results?criteria=pwa-only')).json())
        const response = await responsePromise
        expect(response.fromServiceWorker()).toBe(false)
        expect(body.sequence).toBe(sequence)
        expect(body.marker).toBe('SYNTHETIC-PWA-RESULT')
      }
      await fillSearch(page)
      await page.getByRole('button', { name: 'Localiser', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Voir détails', exact: true })).toHaveCount(1)
      expect(network.apiRequests.length).toBeGreaterThan(0)
      expect(network.apiRequests.some(url => url.includes('/dpe03existant/'))).toBe(true)
      await assertOnlyAppPrecache(probe, release.candidate, release.origin)

      // Disable both page networking AND the fixture server. The latter matters
      // because older Playwright versions don't apply offline mode to SW-owned
      // requests. The deny-only proxy remains the external-network safety net.
      network.offline = true
      release.setOffline(true)
      await context.setOffline(true)
      const offlineRoutes = [
        ['/', 'Retrouver un bien grâce à son DPE'],
        ['/informations', 'Guide et informations'],
        ['/mentions-legales', 'Mentions légales et vie privée'],
        ['/faq', 'Guide et informations'],
        ['/informations?source=pwa-test', 'Guide et informations']
      ]
      for (const [route, heading] of offlineRoutes) {
        const offlinePage = await context.newPage()
        try {
          const response = await offlinePage.goto(`${release.origin}${route}`, { waitUntil: 'domcontentloaded' })
          expect(response.status()).toBe(200)
          expect(response.fromServiceWorker()).toBe(true)
          expect(sha256(await response.body())).toBe(release.candidate.indexSha256)
          await expect(offlinePage.locator('#app')).toHaveAttribute('data-v-app', '')
          await expect(offlinePage.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
        } finally {
          await offlinePage.close()
        }
      }
      for (const route of [
        '/guides/retrouver-adresse-annonce/',
        '/documentation/agents/',
        '/private/results',
        '/api/dpe-results',
        '/assets/missing.js',
        '/data/private-results.json'
      ]) {
        const offlinePage = await context.newPage()
        try {
          await expect(
            offlinePage.goto(`${release.origin}${route}`, { waitUntil: 'domcontentloaded' })
          ).rejects.toThrow()
        } finally {
          await offlinePage.close()
        }
      }
      for (const url of ['/api/dpe-results?criteria=pwa-only', network.apiRequests[0]]) {
        expect(
          await probe.evaluate(async target => {
            try {
              await fetch(target)
              return 'unexpected-offline-response'
            } catch {
              return 'network-failed'
            }
          }, url)
        ).toBe('network-failed')
      }
      await assertOnlyAppPrecache(probe, release.candidate, release.origin)
      await testInfo.attach('pwa-lifecycle-evidence', {
        body: JSON.stringify(
          {
            baselineId,
            baseline: release.baseline,
            candidate: release.candidate,
            registrationState,
            cacheSnapshot: await cacheSnapshot(probe),
            apiRequests: network.apiRequests,
            autoReloadObserved: true
          },
          null,
          2
        ),
        contentType: 'application/json'
      })
    })
  })
}
