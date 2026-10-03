import { expect } from '@playwright/test'

// Synthetic records only. These tests exercise the built UI and real query code,
// not availability or correctness of the public APIs.
export const modernRow = {
  numero_dpe: 'TEST-RELEASE-ONLY',
  code_postal_ban: '75001',
  nom_commune_ban: 'Paris',
  adresse_ban: '1 rue du Test',
  surface_habitable_logement: 65.5,
  conso_5_usages_par_m2_ep: 173.5,
  emission_ges_5_usages_par_m2: 6.5,
  etiquette_dpe: 'D',
  etiquette_ges: 'B',
  type_batiment: 'appartement',
  annee_construction: 1,
  date_etablissement_dpe: '2026-09-01',
  _geopoint: '48.8626,2.3363'
}

export async function mockPublicApis(page, { results = [modernRow], status = 200 } = {}) {
  const queries = []
  // Never send synthetic criteria or make other unplanned external requests.
  await page.route('https://**/*', route => route.abort())
  await page.route('https://data.geopf.fr/geocodage/**', route =>
    route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [2.3363, 48.8626] },
            properties: { postcode: '75001', city: 'Paris', citycode: '75101', label: '1 rue du Test 75001 Paris' }
          }
        ]
      }
    })
  )
  await page.route('https://data.ademe.fr/data-fair/api/v1/datasets/**', route => {
    const url = new URL(route.request().url())
    queries.push(url.searchParams.get('qs') || '')
    const rows = url.pathname.includes('/dpe03existant/') ? results : []
    return route.fulfill({ status, json: { results: rows, total: rows.length } })
  })
  return queries
}

export async function fillSearch(page, { surface = '65,5', consumption = '173,5', ges = '6,5' } = {}) {
  await page.locator('#search-commune').fill('75001')
  await page.locator('#search-surface').fill(surface)
  await page.locator('#search-consommation').fill(consumption)
  await page.locator('#search-ges').fill(ges)
}

export async function search(page) {
  await fillSearch(page)
  await page.getByRole('button', { name: 'Localiser', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Voir détails', exact: true })).toHaveCount(1)
}
