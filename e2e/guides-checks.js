import { expect, test } from '@playwright/test'
import { capabilityPath, publicPages } from '../scripts/guides/generate.mjs'

export function registerGuideChecks() {
  test.describe('Static guides', () => {
    test('raw guide responses contain complete articles and canonicals before JavaScript runs', async ({ request }) => {
      for (const entry of publicPages) {
        const response = await request.get(entry.path)
        expect(response.status()).toBe(200)
        expect(response.headers()['content-type']).toContain('text/html')
        const html = await response.text()
        expect(html).toContain(`<h1>${entry.title}</h1>`)
        expect(html).toContain(`rel="canonical" href="https://localiserbien.fr${entry.path}"`)
        expect(html).not.toContain('<script type="module"')
      }
    })

    test('guide pages are readable on a narrow screen without JavaScript or API calls', async ({
      browser,
      request,
      baseURL
    }, testInfo) => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } })
      await context.route('**/*', route =>
        new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort()
      )
      const page = await context.newPage()
      const requests = []
      page.on('request', request => requests.push(request.url()))
      try {
        for (const entry of publicPages) {
          const response = await request.get(entry.path)
          await page.goto(response.url())
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.title)
          await expect(page.getByRole('link', { name: 'Revenir à la recherche' })).toBeVisible()
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
          await testInfo.attach(`nojs-375-${entry.path.replaceAll('/', '-')}.png`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png'
          })
        }
        expect(requests.filter(url => /\.js(?:\?|$)|data\.ademe|data\.geopf|maps\.google/.test(url))).toEqual([])
      } finally {
        await context.close()
      }
    })

    test('capability JSON is returned as data rather than the application shell', async ({ request }) => {
      const response = await request.get(capabilityPath)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('application/json')
      const data = await response.json()
      expect(data.interface).toEqual({
        type: 'browser',
        javascript_required_for_search: true,
        search_api: null,
        mcp_server: null
      })
      expect(data.guides).toHaveLength(3)
    })

    for (const width of [375, 1280]) {
      test(`quiet footer guides preserve navigation and both searches at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/')
        await expect(page.getByLabel('Commune', { exact: true })).toBeVisible()
        await expect(page.locator('.site-header').getByRole('link', { name: 'Guides', exact: true })).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Guides', exact: true })).toHaveCount(1)
        await page.getByRole('link', { name: 'Guides', exact: true }).click()
        await expect(page).toHaveURL(/\/guides\/$/)
        await page.getByRole('link', { name: publicPages[1].title, exact: true }).click()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(publicPages[1].title)
        await testInfo.attach(`guide-${width}px.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png'
        })
        await page.goBack()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(publicPages[0].title)
        await page.goForward()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(publicPages[1].title)
        await page.getByRole('link', { name: 'Revenir à la recherche' }).click()
        await page.getByLabel('Commune', { exact: true }).fill('13008')
        await page.getByLabel('Surface', { exact: true }).fill('65')
        await page.getByLabel('Consommation énergétique', { exact: true }).fill('173')
        await expect(page.getByRole('button', { name: 'Localiser', exact: true })).toBeEnabled()
        await page.getByLabel('Surface', { exact: true }).fill('42')
        await page.getByRole('button', { name: 'Classe énergétique E', exact: true }).click()
        await expect(page.getByLabel('Consommation énergétique', { exact: true })).toBeDisabled()
        await page.getByRole('button', { name: 'Classe GES B', exact: true }).click()
        await page.getByRole('button', { name: 'Rechercher un appartement', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Localiser', exact: true })).toBeEnabled()
        await testInfo.attach(`search-after-guide-${width}px.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png'
        })
        await page.getByRole('button', { name: 'Biens à proximité', exact: true }).click()
        await expect(page.locator('#nearby-address')).toBeVisible()
      })
    }

    test('contextual links lead to the relevant guide and documentation', async ({ page }) => {
      await page.goto('/informations')
      await page.getByRole('link', { name: 'Quelles valeurs du DPE saisir ?' }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(publicPages[2].title)
      await page.getByRole('link', { name: 'Documentation pour les agents', exact: true }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(publicPages[4].title)
      await page.getByRole('link', { name: 'Informations', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Guide et informations', exact: true })).toBeVisible()
    })
  })
}
