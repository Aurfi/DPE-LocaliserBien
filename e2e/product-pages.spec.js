import { expect, test } from '@playwright/test'
import { mockPublicApis, search } from './fixtures.js'
import { registerGuideChecks } from './guides-checks.js'

// Keep the actual built app and its local geography/static files. Page fixtures
// fulfill synthetic public API responses; everything else off-origin, including
// requests from a newly opened help tab, is denied before it reaches the network.
test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL).origin
  await context.route('**/*', route =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
  )
})

async function openNearby(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Biens à proximité', exact: true }).click()
  await expect(page.getByLabel('Adresse de recherche', { exact: true })).toBeVisible()
  return page.locator('form').filter({ has: page.locator('#nearby-address') })
}

const addressError = 'Adresse introuvable. Vérifiez la rue, la ville ou le code postal, puis réessayez.'
const emptyGeocoder = route => route.fulfill({ json: { features: [] } })

test('presents calm, complete guidance for both search modes and DPE classes', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/informations')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Guide et informations')
  await expect(main.getByRole('heading', { level: 2 })).toHaveText([
    'Retrouver un bien à partir d’une annonce',
    'Explorer les biens à proximité',
    'Lire les résultats',
    'Pour aller plus loin',
    'Questions utiles'
  ])
  await expect(main).not.toContainText(/\p{Extended_Pictographic}|projet de notice|en cours de validation|brouillon/iu)
  await expect(main).toContainText('Si seule une lettre est indiquée, choisissez sa classe de A à G.')
  await expect(main).toContainText('les GES en kgCO₂/m²/an ou la classe climat')
  const nearby = page.getByRole('region', { name: 'Explorer les biens à proximité', exact: true })
  await expect(nearby).toContainText('saisissez une adresse, choisissez un rayon et une période')
  await expect(nearby).toContainText('Vérifiez l’adresse retenue en tête des résultats.')
  await expect(nearby).toContainText('Un DPE récent ne signifie pas que le logement est en vente ou en location.')
  await expect(main.locator('iframe, img, video')).toHaveCount(0)
})

test('opens and closes every native FAQ disclosure with the keyboard', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/informations')
  const questions = page.getByRole('region', { name: 'Questions utiles', exact: true }).locator('details')
  await expect(questions).toHaveCount(4)
  for (let index = 0; index < 4; index++) {
    const question = questions.nth(index)
    const summary = question.locator('summary')
    await expect(question).toHaveJSProperty('open', false)
    await expect(question.locator('p').first()).toBeHidden()
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(question).toHaveJSProperty('open', true)
    await expect(question.locator('p').first()).toBeVisible()
    await expect(summary).toBeFocused()
    await page.keyboard.press('Space')
    await expect(question).toHaveJSProperty('open', false)
    await expect(question.locator('p').first()).toBeHidden()
    await expect(summary).toBeFocused()
  }
})

test('opens the actual results help link at its results heading in a new tab', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/')
  await search(page)
  const help = page.getByRole('link', { name: 'Comprendre le score (nouvel onglet)', exact: true })
  await expect(help).toHaveAttribute('href', '/informations#resultats')
  const opened = page.waitForEvent('popup')
  await help.click()
  const guide = await opened
  await expect(guide).toHaveURL(/\/informations#resultats$/)
  const resultsHeading = guide.getByRole('heading', { name: 'Lire les résultats', exact: true })
  await expect(resultsHeading).toBeVisible()
  // Native hash scrolling rounds fractional CSS pixels. Keep the heading at
  // the anchor near the top, allowing at most one pixel of rounding.
  await expect
    .poll(() => resultsHeading.evaluate(element => element.getBoundingClientRect().top))
    .toBeLessThanOrEqual(32)
  const headingBounds = await resultsHeading.boundingBox()
  expect(headingBounds.y).toBeGreaterThanOrEqual(-1)
  expect(headingBounds.y + headingBounds.height).toBeLessThanOrEqual(guide.viewportSize().height)
  await expect.poll(() => guide.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(guide.locator('#resultats')).toContainText('pas une probabilité d’identification')
  await guide.close()
  await expect(page.getByRole('button', { name: 'Voir détails', exact: true })).toHaveCount(1)
})

test('navigates the privacy link to real legal content without draft or publisher-anonymity copy', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/informations')
  const privacyQuestion = page.locator('summary').filter({ hasText: 'Mes recherches sont-elles enregistrées ?' })
  await privacyQuestion.focus()
  await page.keyboard.press('Enter')
  const privacyLink = page.getByRole('link', { name: 'Consulter les informations sur la vie privée', exact: true })
  await expect(privacyLink).toHaveAttribute('href', '/mentions-legales#vie-privee')
  await privacyLink.click()
  await expect(page).toHaveURL(/\/mentions-legales#vie-privee$/)
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Mentions légales et vie privée')
  const privacyHeading = page.locator('#vie-privee').getByRole('heading', { name: 'Recherches et services externes' })
  await expect(privacyHeading).toBeInViewport({ ratio: 1 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(main).not.toContainText(
    /projet de notice|en cours de validation|restent à préciser|doivent être confirmés|notice finalisée|seront précisées|non professionnel|anonymat|LCEN|confiance dans l’économie numérique|Google Fonts|polices/i
  )
  await expect(main).toContainText('OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.')
  await expect(main).toContainText(
    'Votre adresse e-mail et votre message sont utilisés uniquement pour répondre à votre demande.'
  )
  await expect(main).not.toContainText(/messagerie passe par|redirigés vers|Gmail/i)
  await expect(main.locator('a[href^="mailto:"]')).toHaveCount(2)
  await expect(page.locator('#vie-privee')).toContainText('Google reçoit l’adresse et/ou les coordonnées du bien')
  await page.reload()
  await expect(page).toHaveURL(/\/mentions-legales#vie-privee$/)
  await expect(privacyHeading).toBeInViewport({ ratio: 1 })
})

test('keeps the home history hint to the exact two French sentences', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/')
  const copy = "Option désactivée par défaut. L'historique est enregistré uniquement dans ce navigateur."
  const preference = page.getByRole('checkbox', { name: 'Conserver mes recherches sur cet appareil', exact: true })
  await expect(preference).not.toBeChecked()
  await expect(page.locator('#history-explanation')).toHaveText(copy)
  await expect(preference).toHaveAccessibleDescription(copy)
  await preference.check()
  await expect(preference).toBeChecked()
  await expect(page.locator('#history-explanation')).toHaveText(copy)
})

test('keeps nearby submit in the first mobile viewport and preserves edited optional filters', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockPublicApis(page)
  const form = await openNearby(page)
  const filters = form.locator('details')
  const summary = filters.locator('summary')
  const submit = form.getByRole('button', { name: 'Rechercher', exact: true })
  await expect(filters).toHaveJSProperty('open', false)
  await expect(form.getByLabel('Surface (optionnel)', { exact: true })).toBeHidden()
  // Check before fill/click actions can scroll the submit into view for us.
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(submit).toBeInViewport({ ratio: 1 })
  await expect(summary).toContainText('Surface, type de bien, énergie, GES')
  await expect(summary).not.toContainText(/actif/)
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(filters).toHaveJSProperty('open', true)
  await form.getByLabel('Surface (optionnel)', { exact: true }).fill('65,5')
  await form.getByRole('button', { name: 'Maison', exact: true }).click()
  await form.getByRole('button', { name: 'Classe énergétique C', exact: true }).click()
  await form.getByRole('button', { name: 'Classe énergétique D', exact: true }).click()
  await form.getByLabel('GES (optionnel)', { exact: true }).fill('0')
  await expect(summary).toContainText('4 actifs')
  for (const criterion of ['Surface : 65,5 m²', 'Maison', 'Énergie : C, D', 'GES : 0 kgCO₂/m²/an']) {
    await expect(summary).toContainText(criterion)
  }
  await summary.focus()
  await page.keyboard.press('Space')
  await expect(filters).toHaveJSProperty('open', false)
  await form.getByLabel('Adresse de recherche', { exact: true }).fill('1 rue du Test 75001 Paris')
  await expect(filters).toHaveJSProperty('open', false)
  await expect(summary).toContainText('4 actifs')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(form.getByLabel('Surface (optionnel)', { exact: true })).toHaveValue('65,5')
  await expect(form.getByLabel('GES (optionnel)', { exact: true })).toHaveValue('0')
  await expect(form.getByRole('button', { name: 'Maison', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(form.getByLabel('Consommation (optionnel)', { exact: true })).toBeDisabled()
  await expect(submit).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('reveals restored optional filters and clears their count for an unfiltered saved search', async ({ page }) => {
  await mockPublicApis(page)
  // A deterministic geocoding failure keeps restored criteria available to inspect.
  await page.route('https://data.geopf.fr/geocodage/**', emptyGeocoder)
  await page.addInitScript(() => {
    localStorage.setItem('dpe_history_preference', 'enabled')
    const base = {
      address: '1 rue du Test 75001 Paris',
      monthsBack: 3,
      radius: 1,
      surface: null,
      consommation: null,
      ges: null,
      typeBien: null,
      energyClasses: [],
      gesClasses: [],
      resultCount: 1,
      timestamp: 1791000000000
    }
    localStorage.setItem(
      'recent_dpe_searches',
      JSON.stringify([
        {
          ...base,
          displayName: 'Critères restaurés de test',
          surface: 65.5,
          typeBien: 'appartement',
          energyClasses: ['C', 'D'],
          ges: 0
        },
        { ...base, displayName: 'Recherche sans filtre de test' }
      ])
    )
  })
  const form = await openNearby(page)
  const filters = form.locator('details')
  const summary = filters.locator('summary')
  const saved = page.getByRole('button', { name: /Critères restaurés de test/ })
  await saved.click()
  await expect(page.getByRole('alert')).toHaveText(addressError)
  await expect(filters).toHaveJSProperty('open', true)
  await expect(summary).toContainText('4 actifs')
  await expect(summary).toContainText('GES : 0 kgCO₂/m²/an')
  await expect(form.getByLabel('Surface (optionnel)', { exact: true })).toHaveValue('65.5')
  await expect(form.getByRole('button', { name: 'Appartement', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(form.getByRole('button', { name: 'Classe énergétique C', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(form.getByRole('button', { name: 'Classe énergétique D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await summary.click()
  await expect(filters).toHaveJSProperty('open', false)
  await saved.click()
  await expect(filters).toHaveJSProperty('open', true)
  await expect(form.getByRole('button', { name: 'Rechercher', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: /Recherche sans filtre de test/ }).click()
  await expect(filters).toHaveJSProperty('open', false)
  await expect(summary).not.toContainText(/actif/)
  await expect(form.getByLabel('Surface (optionnel)', { exact: true })).toHaveValue('')
  await expect(form.getByLabel('GES (optionnel)', { exact: true })).toHaveValue('')
})

test('explains an unknown nearby address in French and recovers after correction', async ({ page }) => {
  const queries = await mockPublicApis(page)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('https://data.geopf.fr/geocodage/**', emptyGeocoder)
  const form = await openNearby(page)
  const address = form.getByLabel('Adresse de recherche', { exact: true })
  const submit = form.getByRole('button', { name: 'Rechercher', exact: true })
  await address.fill('zzzzzzzzzzzz')
  await submit.click()
  await expect(page.getByRole('alert')).toHaveText(addressError)
  await expect(page.getByRole('main')).not.toContainText(/TypeError|Cannot read properties|undefined|null/)
  await expect(address).toHaveValue('zzzzzzzzzzzz')
  await expect(submit).toBeEnabled()
  expect(queries).toEqual([])
  expect(pageErrors).toEqual([])
  // Removing only this override restores the original synthetic success fixture.
  await page.unroute('https://data.geopf.fr/geocodage/**', emptyGeocoder)
  await address.fill('1 rue du Test 75001 Paris')
  await submit.click()
  await expect(page.getByRole('button', { name: 'Voir détails', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(queries.length).toBeGreaterThan(0)
  expect(pageErrors).toEqual([])
})

test('visible application copy omits free and no-account marketing on every main page', async ({ page }, testInfo) => {
  await mockPublicApis(page)
  for (const [url, title, screenshot] of [
    ['/', 'Retrouver un bien grâce à son DPE', 'home'],
    ['/informations', 'Guide et informations', 'information'],
    ['/mentions-legales', 'Mentions légales et vie privée', 'legal']
  ]) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    // Check the visible body alongside the separately tested SEO/JSON-LD copy.
    expect(await page.locator('body').innerText()).not.toMatch(
      /\bgratuit\w*|\bsans[\s,;:-]+(?:compte|inscription|abonnement)\b/i
    )
    await testInfo.attach(`visible-copy-${screenshot}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    })
  }
})

registerGuideChecks()
