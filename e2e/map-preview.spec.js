import { expect, test } from '@playwright/test'
import { fillSearch, mockPublicApis, modernRow, search } from './fixtures.js'

// Deterministic iframe documents verify our UI and lifecycle only. Actual Google
// rendering, consent and browser privacy restrictions require a separate check.
test('loads one map only on opening a result and preserves nested dialog and scroll behavior', async ({ page }) => {
  await mockPublicApis(page)
  const requests = []
  await page.route('https://maps.google.com/maps?**', route => {
    requests.push(route.request())
    return route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="fr"><body><p>Aperçu contrôlé</p><button>Contrôle de carte</button></body></html>'
    })
  })
  await page.goto('/')
  await expect(page.locator('iframe')).toHaveCount(0)
  await search(page)
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(requests).toHaveLength(0)
  const trigger = page.getByRole('button', { name: 'Voir détails', exact: true })
  await trigger.scrollIntoViewIfNeeded()
  const initialScroll = await page.evaluate(() => window.scrollY)
  await trigger.click()
  const frame = page.locator('[data-map-preview] iframe')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('title', /Vue satellite de .+Test/)
  await expect(page.frameLocator('[data-map-preview] iframe').getByText('Aperçu contrôlé')).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0].headers().referer).toBeUndefined()
  const url = new URL(requests[0].url())
  expect(url.searchParams.get('ll')).toBe('48.8626,2.3363')
  expect(url.searchParams.get('output')).toBe('embed')
  const bounds = await frame.boundingBox()
  expect(bounds.height).toBeGreaterThanOrEqual(240)
  expect(bounds.height).toBeLessThanOrEqual(350)
  expect(bounds.width).toBeLessThanOrEqual(page.viewportSize().width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.frameLocator('[data-map-preview] iframe').getByRole('button').focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'DVF Data.Gouv', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Détails complets', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect(await page.locator('[data-modal-layer="property"]').evaluate(element => !!element.closest('[inert]'))).toBe(
    true
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Détails complets', exact: true })).toBeFocused()
  expect(requests).toHaveLength(1)
  await page.keyboard.press('Escape')
  await expect(frame).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll)
  await trigger.click()
  await expect(page.frameLocator('[data-map-preview] iframe').getByText('Aperçu contrôlé')).toBeVisible()
  expect(requests).toHaveLength(2)
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await expect(frame).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('keeps the external fallback and dismissal usable when the map provider is blocked', async ({ page }) => {
  // The catch-all denies every external URL except the synthetic public APIs.
  await mockPublicApis(page)
  await page.goto('/')
  await search(page)
  const trigger = page.getByRole('button', { name: 'Voir détails', exact: true })
  await trigger.click()
  await expect(page.locator('[data-map-preview] iframe')).toHaveCount(1)
  const fallback = page.getByRole('link', { name: 'Ouvrir dans Maps', exact: true })
  await expect(fallback).toBeVisible()
  await expect(fallback).toHaveAttribute('href', /https:\/\/www\.google\.com\/maps\/search\//)
  await expect(fallback).toHaveAttribute('rel', 'noopener noreferrer')
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('uses the selected result on reopening and never invents missing coordinates', async ({ page }) => {
  await mockPublicApis(page, {
    results: [modernRow, { ...modernRow, numero_dpe: 'TEST-SECOND', adresse_ban: '2 rue du Test', _geopoint: null }]
  })
  await page.goto('/')
  await fillSearch(page)
  await page.getByRole('button', { name: 'Localiser', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Voir détails', exact: true })).toHaveCount(2)
  // Results are ranked, so fixture order is not a contract. Identify each card
  // by its unique visible street number, then verify the full modal address.
  const resultButton = streetNumber =>
    page
      .locator('.property-card-content')
      .filter({ has: page.getByRole('heading', { level: 3, name: new RegExp(`^${streetNumber} rue du`) }) })
      .getByRole('button', { name: 'Voir détails', exact: true })
  const withCoordinates = resultButton(1)
  const withoutCoordinates = resultButton(2)
  await expect(withCoordinates).toHaveCount(1)
  await expect(withoutCoordinates).toHaveCount(1)
  await withCoordinates.click()
  await expect(page.getByRole('dialog', { name: '1 rue du Test', exact: true })).toBeVisible()
  const frame = page.locator('[data-map-preview] iframe')
  const original = new URL(await frame.getAttribute('src'))
  expect(original.searchParams.get('q')).toContain('1 rue du Test')
  expect(original.searchParams.get('ll')).toBe('48.8626,2.3363')
  await page.keyboard.press('Escape')
  await expect(frame).toHaveCount(0)
  await expect(withCoordinates).toBeFocused()
  await withoutCoordinates.click()
  await expect(page.getByRole('dialog', { name: '2 rue du Test', exact: true })).toBeVisible()
  const next = new URL(await frame.getAttribute('src'))
  expect(next.href).not.toBe(original.href)
  expect(next.searchParams.get('q')).toContain('2 rue du Test')
  expect(next.searchParams.has('ll')).toBe(false)
  expect(next.searchParams.get('q')).not.toBe('0,0')
  await page.keyboard.press('Escape')
  await expect(frame).toHaveCount(0)
  await expect(withoutCoordinates).toBeFocused()
})
