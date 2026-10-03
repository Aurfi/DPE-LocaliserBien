import { readFile } from 'node:fs/promises'
import { test as base, expect } from '@playwright/test'
import { modernRow } from '../e2e/fixtures.js'
import { startReleaseFixture } from '../scripts/pwa/fixture.mjs'
import { verifyBaseline } from '../scripts/pwa/provenance.mjs'

export const test = base.extend({
  baselineId: ['earlier-candidate-7fe6a35', { option: true }],
  release: async ({ baselineId }, use, testInfo) => {
    const provenance = JSON.parse(await readFile('reports/pwa/builds.json', 'utf8'))
    const baseline = await verifyBaseline(baselineId)
    const release = await startReleaseFixture(baseline.directory, 'dist')
    try {
      expect(release.baseline).toEqual(provenance.baselines[baselineId].build)
      expect(release.candidate).toEqual(provenance.candidate.build)
      await use(release)
    } finally {
      try {
        await testInfo.attach('pwa-build-provenance-and-server-requests', {
          body: JSON.stringify({ baselineId, provenance, requests: release.requests, denied: release.denied }, null, 2),
          contentType: 'application/json'
        })
      } finally {
        await release.close()
      }
    }
  },
  proxy: async ({ release }, use) => {
    await use({ server: release.proxy, bypass: `<-loopback>,${new URL(release.origin).host}` })
  },
  network: [
    async ({ context, release }, use) => {
      const network = { offline: false, apiRequests: [] }
      await context.route('**/*', async route => {
        const url = new URL(route.request().url())
        if (url.origin === release.origin) return route.continue()
        if (network.offline) return route.abort('internetdisconnected')
        if (url.origin === 'https://data.ademe.fr' && url.pathname.startsWith('/data-fair/api/v1/datasets/')) {
          network.apiRequests.push(url.href)
          const results = url.pathname.includes('/dpe03existant/') ? [modernRow] : []
          return route.fulfill({ json: { results, total: results.length } })
        }
        if (url.origin === 'https://data.geopf.fr' && url.pathname.startsWith('/geocodage/')) {
          return route.fulfill({ json: { features: [] } })
        }
        return route.abort('blockedbyclient')
      })
      await use(network)
    },
    { auto: true }
  ]
})
export { expect }
