import { expect, test } from '@playwright/test'

test.describe('Links and Navigation Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should have working Google Maps links', async ({ page, context }) => {
    // Perform a search to get results
    await page.fill('input[placeholder*="Code postal"]', '13100')
    await page.fill('input[placeholder*="Surface"]', '100')
    await page.click('button:has-text("Rechercher")')

    // Wait for results
    await page.waitForSelector('[data-testid="result-item"]')

    // Open property modal
    await page.click('[data-testid="result-item"] >> nth=0')
    await page.waitForSelector('[data-testid="property-modal"]')

    // Get the Maps link
    const mapsLink = page.locator('a:has-text("Voir sur Maps")')
    const href = await mapsLink.getAttribute('href')

    // Validate the URL format
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
    expect(href).not.toContain('/recherche/') // Should use /search/ not /recherche/

    // Test that link opens in new tab
    const target = await mapsLink.getAttribute('target')
    expect(target).toBe('_blank')

    // Test clicking the link (it should open a new page)
    const [newPage] = await Promise.all([context.waitForEvent('page'), mapsLink.click()])

    // Check that new page URL is Google Maps
    expect(newPage.url()).toContain('google.com/maps')
    await newPage.close()
  })

  test('should have working Geoportail links', async ({ page }) => {
    // Perform a search
    await page.fill('input[placeholder*="Code postal"]', '75001')
    await page.fill('input[placeholder*="Surface"]', '50')
    await page.click('button:has-text("Rechercher")')

    // Open property modal
    await page.waitForSelector('[data-testid="result-item"]')
    await page.click('[data-testid="result-item"] >> nth=0')

    // Find DVF Data.Gouv link
    const dvfLink = page.locator('a:has-text("DVF Data.Gouv")')

    if (await dvfLink.isVisible()) {
      const href = await dvfLink.getAttribute('href')
      expect(href).toContain('app.dvf.etalab.gouv.fr')

      const target = await dvfLink.getAttribute('target')
      expect(target).toBe('_blank')
    }
  })

  test('should have all footer links working', async ({ page }) => {
    const footerLinks = [
      { text: 'Informations', expectedUrl: '/informations' },
      { text: 'Mentions Légales', expectedUrl: '/mentions-legales' }
    ]

    for (const link of footerLinks) {
      // Click the link
      await page.click(`a:has-text("${link.text}")`)

      // Check URL
      await expect(page).toHaveURL(link.expectedUrl)

      // Go back to home
      await page.goto('/')
    }
  })

  test('should handle external links correctly', async ({ page }) => {
    // Go to mentions legales
    await page.goto('/mentions-legales')

    // Check for external links
    const externalLinks = page.locator('a[target="_blank"]')
    const count = await externalLinks.count()

    for (let i = 0; i < count; i++) {
      const link = externalLinks.nth(i)
      const href = await link.getAttribute('href')
      const rel = await link.getAttribute('rel')

      // Security check: external links should have proper rel attributes
      expect(rel).toContain('noopener')
      expect(href).toBeTruthy()
    }
  })

  test('should validate all internal navigation', async ({ page }) => {
    // Test tab navigation
    const tabs = ['Localiser un DPE', 'DPE Récents']

    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`)
      await page.waitForTimeout(500) // Small wait for animation

      // Check that the correct content is visible
      const tabContent = page.locator(`[data-tab="${tab.toLowerCase().replace(/ /g, '-')}"]`)
      await expect(tabContent).toBeVisible()
    }
  })

  test('should have working search history', async ({ page }) => {
    // Perform a search
    await page.fill('input[placeholder*="Code postal"]', '13100')
    await page.fill('input[placeholder*="Surface"]', '100')
    await page.click('button:has-text("Rechercher")')

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]')

    // Check if search is saved in history
    await page.reload()

    // Look for recent searches section
    const recentSearches = page.locator('[data-testid="recent-searches"]')
    if (await recentSearches.isVisible()) {
      await expect(recentSearches).toContainText('13100')
    }
  })

  test('should validate mobile menu links', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Check if mobile menu exists and works
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]')
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click()

      // Check that menu opens
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      await expect(mobileMenu).toBeVisible()

      // Test navigation links in mobile menu
      const mobileLinks = mobileMenu.locator('a')
      const linkCount = await mobileLinks.count()

      expect(linkCount).toBeGreaterThan(0)
    }
  })
})
