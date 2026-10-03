import { expect, test } from '@playwright/test'
import { fillSearch, mockPublicApis, search } from './fixtures.js'

test('loads the free form and validates malformed decimals without API requests', async ({ page }) => {
  const queries = await mockPublicApis(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Retrouver un bien grâce à son DPE')
  await expect(page.getByText('Recopiez les critères de l’annonce. Gratuit, sans compte.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Localiser un exemple', exact: true })).toBeEnabled()
  await page.locator('#search-commune').focus()
  await page.locator('#search-surface').focus()
  await expect(page.locator('#search-commune')).toHaveAttribute('aria-invalid', 'true')
  await fillSearch(page, { surface: '65,5.5' })
  await expect(page.getByRole('button', { name: 'Localiser', exact: true })).toBeDisabled()
  await expect(page.locator('#search-surface')).toHaveAttribute('aria-invalid', 'true')
  expect(queries).toEqual([])
})

test('searches fractional criteria and closes nested dialogs with keyboard focus restored', async ({ page }) => {
  const queries = await mockPublicApis(page)
  await page.goto('/')
  await search(page)
  expect(queries.some(query => query.includes('surface_habitable_logement:[64.5 TO 66.5]'))).toBe(true)
  expect(queries.some(query => query.includes('conso_5_usages_par_m2_ep:173.5'))).toBe(true)
  await expect(page.locator('[data-construction-year]')).toHaveText('Inconnue')
  const details = page.getByRole('button', { name: 'Voir détails', exact: true })
  await details.click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog').locator('[data-construction-year]')).toHaveText('Inconnue')
  await expect(page.locator('iframe')).toHaveCount(1)
  await expect(page.locator('iframe')).toHaveAttribute('referrerpolicy', 'no-referrer')
  await page.getByRole('button', { name: 'Détails complets', exact: true }).click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(2)
  await expect(page.getByRole('dialog')).toHaveCount(1) // Only the top layer is exposed.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Détails complets', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(details).toBeFocused()
  await page.getByRole('button', { name: 'Nouvelle recherche', exact: true }).click()
  await expect(page.locator('#search-commune')).toBeVisible()
})

test('keeps history off until opt-in and preserves disabled preference across reload', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/')
  const preference = page.getByRole('checkbox', { name: 'Conserver mes recherches sur cet appareil' })
  await expect(preference).not.toBeChecked()
  await search(page)
  expect(await page.evaluate(() => localStorage.getItem('dpe_recent_searches'))).toBeNull()
  await preference.check()
  await page.getByRole('button', { name: 'Nouvelle recherche', exact: true }).click()
  await search(page)
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dpe_recent_searches') || '[]').length))
    .toBe(1)
  await page.getByRole('button', { name: 'Nouvelle recherche', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recherches récentes', exact: true })).toBeVisible()
  await preference.uncheck()
  await expect(page.getByRole('heading', { name: 'Recherches récentes', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(preference).not.toBeChecked()
  await preference.check()
  await expect(page.getByRole('heading', { name: 'Recherches récentes', exact: true })).toBeVisible()
})

test('shows a useful empty state and lets the user return to the form', async ({ page }) => {
  await mockPublicApis(page, { results: [] })
  await page.goto('/')
  await fillSearch(page)
  await page.getByRole('button', { name: 'Localiser', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aucun résultat trouvé', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Nouvelle recherche', exact: true }).click()
  await expect(page.locator('#search-surface')).toBeVisible()
})

test('cancels a pending search and ignores its late response', async ({ page }) => {
  await mockPublicApis(page)
  let release
  let markEntered
  const entered = new Promise(resolve => {
    markEntered = resolve
  })
  const pending = new Promise(resolve => {
    release = resolve
  })
  await page.route('https://data.ademe.fr/data-fair/api/v1/datasets/**', async route => {
    markEntered()
    await pending
    await route.fulfill({ json: { results: [], total: 0 } })
  })
  await page.goto('/')
  await fillSearch(page)
  await page.getByRole('button', { name: 'Localiser', exact: true }).click()
  await entered
  await expect(page.getByRole('heading', { name: 'Recherche en cours', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Revenir aux critères', exact: true }).click()
  const response = page.waitForResponse('https://data.ademe.fr/data-fair/api/v1/datasets/**')
  release()
  await (await response).finished()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#search-surface')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aucun résultat trouvé', exact: true })).toHaveCount(0)
})
