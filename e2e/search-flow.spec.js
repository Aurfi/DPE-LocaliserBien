import { expect, test } from '@playwright/test'

test.describe('DPE Search Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle')
  })

  test('should load the home page', async ({ page }) => {
    await expect(page).toHaveTitle(/Localisateur de bien immobilier/)
    await expect(page.locator('h1')).toContainText(/Trouvez l'adresse exacte/)
  })

  test('should perform a property search', async ({ page }) => {
    // Fill in the search form
    await page.fill('input[placeholder*="Code postal"]', '13100')
    await page.fill('input[placeholder*="Commune"]', 'Aix-en-Provence')
    await page.fill('input[placeholder*="Surface"]', '100')

    // Submit the search
    await page.click('button:has-text("Rechercher")')

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', {
      timeout: 10000
    })

    // Check that results are displayed
    const results = page.locator('[data-testid="result-item"]')
    await expect(results).toHaveCount(expect.any(Number))
  })

  test('should open property details modal', async ({ page }) => {
    // Perform a search first
    await page.fill('input[placeholder*="Code postal"]', '75001')
    await page.fill('input[placeholder*="Surface"]', '50')
    await page.click('button:has-text("Rechercher")')

    // Wait for results and click on first result
    await page.waitForSelector('[data-testid="result-item"]')
    await page.click('[data-testid="result-item"] >> nth=0')

    // Check that modal is opened
    await expect(page.locator('[data-testid="property-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="property-modal"]')).toContainText(/Surface habitable/)
  })

  test('should validate form inputs', async ({ page }) => {
    // Try to search without required fields
    await page.click('button:has-text("Rechercher")')

    // Check for validation messages
    await expect(page.locator('.error-message')).toBeVisible()
  })

  test('should handle no results gracefully', async ({ page }) => {
    // Search with unlikely criteria
    await page.fill('input[placeholder*="Code postal"]', '99999')
    await page.fill('input[placeholder*="Surface"]', '9999')
    await page.click('button:has-text("Rechercher")')

    // Check for no results message
    await page.waitForSelector('[data-testid="no-results"]')
    await expect(page.locator('[data-testid="no-results"]')).toContainText(/Aucun résultat/)
  })

  test('should navigate to FAQ page', async ({ page }) => {
    // Click on FAQ link
    await page.click('a:has-text("Informations")')

    // Check that FAQ page is loaded
    await expect(page).toHaveURL('/informations')
    await expect(page.locator('h1')).toContainText(/Questions Fréquentes/)
  })

  test('should navigate to legal mentions', async ({ page }) => {
    // Click on legal mentions link
    await page.click('a:has-text("Mentions Légales")')

    // Check that legal page is loaded
    await expect(page).toHaveURL('/mentions-legales')
    await expect(page.locator('h1')).toContainText(/Mentions Légales/)
  })

  test('should work with recent DPE search', async ({ page }) => {
    // Navigate to recent DPE tab
    await page.click('button:has-text("DPE Récents")')

    // Fill in the form
    await page.fill('input[placeholder*="département"]', '13')
    await page.click('button:has-text("Rechercher")')

    // Wait for results
    await page.waitForSelector('[data-testid="recent-dpe-results"]', {
      timeout: 10000
    })

    // Check that results are displayed
    const results = page.locator('[data-testid="recent-dpe-item"]')
    await expect(results.first()).toBeVisible()
  })
})
