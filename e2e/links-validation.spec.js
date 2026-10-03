import { expect, test } from '@playwright/test'
import { mockPublicApis, search } from './fixtures.js'

test.beforeEach(async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/')
})

test('navigates guide, legal page, old FAQ route, Back and Forward', async ({ page }) => {
  await page.getByRole('link', { name: 'Guide et informations', exact: true }).click()
  await expect(page).toHaveURL(/\/informations$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Informations')
  await page.getByRole('link', { name: 'Mentions légales', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mentions légales et vie privée')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mentions légales et vie privée')
  await page.goBack()
  await expect(page).toHaveURL(/\/informations$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/mentions-legales$/)
  await page.goto('/faq')
  await expect(page).toHaveURL(/\/informations$/)
})

test('keeps map navigation explicit with safe external links', async ({ page }) => {
  await search(page)
  await page.getByRole('button', { name: 'Voir détails', exact: true }).click()
  const maps = page.getByRole('link', { name: 'Voir sur Maps', exact: true })
  await expect(maps).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
  await expect(maps).toHaveAttribute('target', '_blank')
  await expect(maps).toHaveAttribute('rel', /noopener/)
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByRole('link', { name: 'Mentions légales', exact: true }).click()
  for (const link of await page.locator('a[target="_blank"]').all()) {
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('href', /^https:\/\//)
  }
})

test('switches both search modes and dark/system themes without horizontal clipping', async ({ page }) => {
  await page.getByRole('button', { name: 'Biens à proximité', exact: true }).click()
  await expect(page.getByLabel('Adresse de recherche', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Trouver un bien', exact: true }).click()
  await expect(page.locator('#search-commune')).toBeVisible()
  await page.getByLabel('Affichage', { exact: true }).selectOption('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.getByLabel('Affichage', { exact: true })).toHaveValue('dark')
  await page.getByLabel('Affichage', { exact: true }).selectOption('auto')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
