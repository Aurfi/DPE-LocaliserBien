import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useGestionResultats } from '../../composables/useGestionResultats'
import ResultatsDpeRecents from '../fonctionnalites/dpe/ResultatsDpeRecents.vue'
import CarteBien from '../partages/CarteBien.vue'
import EnteteResultats from '../partages/EnteteResultats.vue'

// Keep the real result cards, header, dropdown, formatters and results composable.
// Dialog stubs expose their inputs and events without duplicating their own DOM tests.
const PropertyDialog = {
  name: 'ModaleProprietee',
  props: [
    'property',
    'formattedAddress',
    'commune',
    'surface',
    'energyClass',
    'mapUrl',
    'geoportailUrl',
    'propertyType',
    'floor',
    'location',
    'yearBuilt',
    'numberOfLevels',
    'ceilingHeight',
    'diagnosisDate',
    'energyConsumption',
    'gesEmissions',
    'departmentAverages'
  ],
  emits: ['close', 'show-details'],
  template: `
    <section data-testid="property-dialog">
      <h3>{{ formattedAddress }}</h3>
      <button data-testid="open-dpe" @click="$emit('show-details')">Détails DPE</button>
      <button data-testid="close-property" @click="$emit('close')">Fermer le bien</button>
    </section>
  `
}
const DetailsDialog = {
  name: 'ModaleDetailsDPE',
  props: ['show', 'property', 'departmentAverages'],
  emits: ['close'],
  template: `
    <section v-if="show" data-testid="dpe-dialog">
      <span>{{ property.numero_dpe }}</span>
      <button data-testid="close-dpe" @click="$emit('close')">Fermer le DPE</button>
    </section>
  `
}

const NOW = new Date('2026-10-03T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const wrappers = []

function dpe(id, overrides = {}) {
  return {
    numero_dpe: id,
    adresse_ban: `${id} rue des Tests 75001 Paris`,
    nom_commune_ban: 'Paris',
    code_postal_ban: '75001',
    date_etablissement_dpe: '2026-10-01T12:00:00.000Z',
    surfaceHabitable: 65.4,
    type_batiment: 'Appartement',
    _distance: 1,
    ...overrides
  }
}

function search(rows, overrides = {}) {
  return {
    results: rows,
    searchAddress: '10 avenue de la Recherche',
    searchRadius: 2,
    ...overrides
  }
}

function renderResults(rows, props = {}) {
  const wrapper = mount(ResultatsDpeRecents, {
    props: { results: search(rows), ...props },
    global: {
      stubs: {
        ModaleProprietee: PropertyDialog,
        ModaleDetailsDPE: DetailsDialog,
        RetourEnHaut: true
      }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

function cards(wrapper) {
  return wrapper.findAllComponents(CarteBien)
}

function displayedIds(wrapper) {
  return cards(wrapper).map(card => card.props('result').numero_dpe)
}

async function hideCard(wrapper, index) {
  const card = cards(wrapper)[index]
  await card.trigger('contextmenu', { clientX: 30, clientY: 40 })
  const hideButton = card.findAll('button').find(button => button.text() === 'Masquer')
  expect(hideButton).toBeDefined()
  await hideButton.trigger('click')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.useRealTimers()
})

describe('recent DPE result list rendering', () => {
  it('renders no result UI before a search has results', () => {
    const wrapper = renderResults([], { results: null })
    expect(wrapper.findComponent(EnteteResultats).exists()).toBe(false)
    expect(cards(wrapper)).toHaveLength(0)
    expect(wrapper.find('[data-testid="property-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dpe-dialog"]').exists()).toBe(false)
  })

  it.each([undefined, null, []])('renders an empty state for absent or empty rows: %s', rows => {
    const wrapper = renderResults(rows)
    expect(wrapper.get('h2').text()).toBe('0 résultat affiché')
    expect(wrapper.text()).toContain('Aucun DPE trouvé avec ces critères.')
    expect(wrapper.text()).toContain('Essayez une période ou un rayon plus large.')
    expect(cards(wrapper)).toHaveLength(0)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('updates counts, pluralization and available sorting when results are replaced', async () => {
    const wrapper = renderResults([dpe('one')])
    expect(wrapper.get('h2').text()).toBe('1 résultat affiché')
    expect(wrapper.text()).toContain('Autour de 10 avenue de la Recherche')
    expect(wrapper.find('select').exists()).toBe(false)

    await wrapper.setProps({
      results: search([dpe('one'), dpe('two'), dpe('three'), dpe('four')], {
        searchAddress: '20 rue de la Nouvelle Recherche'
      })
    })
    expect(wrapper.get('h2').text()).toBe('4 résultats affichés')
    expect(wrapper.text()).toContain('Autour de 20 rue de la Nouvelle Recherche')
    expect(wrapper.get('select').element.value).toBe('distance')
    expect(displayedIds(wrapper)).toEqual(['one', 'two', 'three', 'four'])
  })

  it('forwards the new-search button to the parent exactly once', async () => {
    const wrapper = renderResults([dpe('one')])
    await wrapper.get('button[title="Nouvelle recherche"]').trigger('click')
    expect(wrapper.emitted('clear-results')).toEqual([[]])
  })
})

describe('recent search criteria context', () => {
  it('shows the actual short radius and active month beside a plain empty state', () => {
    const wrapper = renderResults([], {
      results: search([], { searchRadius: 0.1 }),
      searchCriteria: { monthsBack: 1 }
    })
    expect(wrapper.findComponent(EnteteResultats).props('subtitle')).toContain('Rayon : 100 m · Dernier mois')
    expect(wrapper.text()).toContain('Essayez une période ou un rayon plus large.')
    expect(wrapper.find('svg.lucide-octagon-x').exists()).toBe(false)
  })

  it('shows a known larger period and leaves missing or invalid criteria out', async () => {
    const wrapper = renderResults([], { searchCriteria: { monthsBack: 6 } })
    expect(wrapper.findComponent(EnteteResultats).props('subtitle')).toContain('Rayon : 2 km · 6 derniers mois')
    await wrapper.setProps({ results: search([], { searchRadius: NaN }), searchCriteria: { monthsBack: -1 } })
    expect(wrapper.findComponent(EnteteResultats).props('subtitle')).toBe('Autour de 10 avenue de la Recherche')
  })
})

describe('recent DPE sorting through the displayed dropdown', () => {
  it('prioritizes normalized exact addresses and explicit matches, then resolves distance fallbacks', () => {
    const rows = [
      dpe('missing-distance', { _distance: undefined }),
      dpe('nearby', { _distance: 0.01 }),
      dpe('flagged', { _isExactMatch: true, _distance: 3 }),
      dpe('fallback-distance', { _distance: undefined, distance: 0.2 }),
      dpe('address-exact', { adresse_ban: '  10   RUE DES FLEURS  75001 PARIS  ', _distance: 2 }),
      dpe('complete-exact', {
        adresse_ban: undefined,
        adresseComplete: '10 rue des fleurs 75001 Paris',
        _distance: 1
      }),
      dpe('primary-distance', { _distance: 0.1, distance: 8 })
    ]
    const sourceOrder = rows.map(row => row.numero_dpe)
    const wrapper = renderResults(rows, {
      results: search(rows, { fullSearchAddress: '10 rue des fleurs 75001 Paris' })
    })
    expect(displayedIds(wrapper)).toEqual([
      'complete-exact',
      'address-exact',
      'flagged',
      'nearby',
      'primary-distance',
      'fallback-distance',
      'missing-distance'
    ])
    expect(rows.map(row => row.numero_dpe)).toEqual(sourceOrder)
    expect(cards(wrapper).map(card => card.props('index'))).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('uses the short search address when no full address is present', () => {
    const rows = [
      dpe('nearby', { _distance: 0 }),
      dpe('matching', { adresse_ban: '10 AVENUE DE LA RECHERCHE', _distance: 5 })
    ]
    expect(displayedIds(renderResults(rows))).toEqual(['matching', 'nearby'])
  })

  it('orders surfaces by proximity to the requested decimal surface and reacts to criteria changes', async () => {
    const rows = [
      dpe('large', { surfaceHabitable: 90 }),
      dpe('exact', { surfaceHabitable: 75.5 }),
      dpe('small', { surfaceHabitable: 60 }),
      dpe('missing', { surfaceHabitable: null })
    ]
    const wrapper = renderResults(rows, { searchCriteria: { surface: '75.5' } })
    await wrapper.get('select').setValue('surface')
    expect(displayedIds(wrapper)).toEqual(['exact', 'large', 'small', 'missing'])
    await wrapper.setProps({ searchCriteria: { surface: '59.5' } })
    expect(displayedIds(wrapper)).toEqual(['small', 'exact', 'large', 'missing'])
    expect(rows.map(row => row.numero_dpe)).toEqual(['large', 'exact', 'small', 'missing'])
  })

  it.each([null, {}, { surface: '' }, { surface: '0' }])(
    'orders largest surfaces first when there is no usable target: %j',
    async searchCriteria => {
      const wrapper = renderResults(
        [
          dpe('small', { surfaceHabitable: 60 }),
          dpe('missing', { surfaceHabitable: null }),
          dpe('large', { surfaceHabitable: 90 }),
          dpe('medium', { surfaceHabitable: 75.5 })
        ],
        { searchCriteria }
      )
      await wrapper.get('select').setValue('surface')
      expect(displayedIds(wrapper)).toEqual(['large', 'medium', 'small', 'missing'])
    }
  )

  it.each([
    ['construction-asc', ['old', 'period', 'modern', 'unknown-code', 'missing']],
    ['construction-desc', ['modern', 'period', 'old', 'unknown-code', 'missing']]
  ])('sorts valid construction years and periods with unknowns last: %s', async (sort, expected) => {
    const wrapper = renderResults([
      dpe('unknown-code', { anneeConstruction: 1 }),
      dpe('period', { anneeConstruction: '1948-1974' }),
      dpe('modern', { anneeConstruction: 2020 }),
      dpe('missing', { anneeConstruction: null }),
      dpe('old', { anneeConstruction: 'avant 1900' })
    ])
    await wrapper.get('select').setValue(sort)
    expect(displayedIds(wrapper)).toEqual(expected)
    expect(
      cards(wrapper)
        .find(card => card.props('result').numero_dpe === 'unknown-code')
        .props('yearBuilt')
    ).toBe('Inconnue')
  })

  it.each([
    ['date-desc', ['newest', 'middle', 'oldest', 'missing']],
    ['date-asc', ['missing', 'oldest', 'middle', 'newest']]
  ])('sorts diagnosis dates consistently with absent dates: %s', async (sort, expected) => {
    const wrapper = renderResults([
      dpe('middle', { date_etablissement_dpe: '2024-05-20' }),
      dpe('missing', { date_etablissement_dpe: undefined }),
      dpe('oldest', { date_etablissement_dpe: '2022-01-10' }),
      dpe('newest', { date_etablissement_dpe: '2026-10-01' })
    ])
    await wrapper.get('select').setValue(sort)
    expect(displayedIds(wrapper)).toEqual(expected)
  })

  it.each([
    ['no floors', [null, null, null, null], false],
    ['only two known floors', ['RDC', '2e étage', null, null], false],
    ['only one distinct floor', ['2e étage', '2e étage', '2e étage', null], false],
    ['three known distinct floors', ['RDC', '2e étage', '3e étage', null], true]
  ])('offers floor sorting only when useful: %s', (_label, floors, expected) => {
    const wrapper = renderResults(
      floors.map((complementRefLogement, index) => dpe(String(index), { complementRefLogement }))
    )
    expect(wrapper.find('option[value="etage"]').exists()).toBe(expected)
  })

  it('sorts ground, ordinal and explicit floors, breaking ties by distance and placing unknowns last', async () => {
    const wrapper = renderResults([
      dpe('unknown', { _distance: 0.1 }),
      dpe('second-far', { etage: 2, _distance: 2 }),
      dpe('third', { complementRefLogement: '3ème étage', _distance: 0.1 }),
      dpe('ground', { complementRefLogement: 'rez-de-chaussée', _distance: 4 }),
      dpe('second-near', { complementRefLogement: '2ème étage', _distance: 0.5 }),
      dpe('second-no-distance', { etage: 2, _distance: undefined }),
      dpe('unparseable', { etage: 'inconnu', _distance: undefined })
    ])
    await wrapper.get('select').setValue('etage')
    expect(displayedIds(wrapper)).toEqual([
      'ground',
      'second-near',
      'second-far',
      'second-no-distance',
      'third',
      'unknown',
      'unparseable'
    ])
    expect(cards(wrapper).map(card => card.props('floor'))).toEqual([
      'RDC',
      'Étage: 2',
      'Étage: 2',
      'Étage: 2',
      'Étage: 3',
      null,
      'Étage: inconnu'
    ])
  })

  it('recomputes floor choices when new rows replace an earlier search', async () => {
    const wrapper = renderResults([dpe('one'), dpe('two')])
    expect(
      wrapper
        .findComponent(EnteteResultats)
        .props('sortOptions')
        .map(option => option.value)
    ).not.toContain('etage')
    await wrapper.setProps({
      results: search([
        dpe('ground', { complementRefLogement: 'RDC' }),
        dpe('second', { etage: 2 }),
        dpe('third', { etage: 3 }),
        dpe('fourth', { etage: 4 })
      ])
    })
    expect(wrapper.get('option[value="etage"]').text()).toBe('Étage')
  })
})

describe('recent result card formatting', () => {
  it('renders rounded surface, distance, floor and source construction period', () => {
    const wrapper = renderResults([
      dpe('42', {
        surfaceHabitable: 69.7,
        anneeConstruction: '1948-1974',
        complementRefLogement: '3ème étage',
        _distance: 0.75
      })
    ])
    const card = cards(wrapper)[0]
    expect(card.props()).toMatchObject({
      address: '42 rue des Tests',
      location: 'Paris - 75001',
      surface: 70,
      distance: 0.75,
      floor: 'Étage: 3',
      yearBuilt: '1948-1974',
      propertyType: 'appartement',
      hasIncompleteData: false,
      isLegacy: false
    })
    expect(card.text()).toContain('70 m²')
    expect(card.text()).toContain('0.8 km')
    expect(card.get('[data-construction-year]').text()).toBe('1948-1974')
    expect(card.text()).not.toContain('DPE Ancien')
  })

  it.each([
    [
      { adresseComplete: '12 rue de lâ€™Église, 75001 Paris', adresse_ban: 'adresse moins précise' },
      "12 rue de l'Église"
    ],
    [{ adresse_ban: '12 rue de la Paix, 75001 Paris' }, '12 rue de la Paix'],
    [{ adresse_ban: 'rue de la Paix 75001 Paris', adresse_brut: '12b rue de la Paix' }, '12b rue de la Paix'],
    [{ adresse_ban: undefined, adresse_brut: '8 rue du Port 75001 Paris' }, '8 rue du Port'],
    [{ adresse_ban: 'rue sans numéro', adresse_brut: 'bâtiment A' }, 'rue sans numéro'],
    [{ adresse_ban: undefined, adresse_brut: undefined }, 'Adresse non disponible'],
    [
      {
        adresse_ban: '18 rue du Centre, 12345 Saint-Paul (Centre)',
        nom_commune_ban: 'Saint-Paul (Centre)',
        code_postal_ban: '12345'
      },
      '18 rue du Centre'
    ]
  ])('shows a clean street address while preserving source fields: %j', (fields, expected) => {
    const row = dpe('address', fields)
    const original = { ...row }
    const card = cards(renderResults([row]))[0]
    expect(card.get('h3').text()).toBe(expected)
    expect(row).toEqual(original)
  })

  it('uses raw locality fields and unknown fallbacks without requiring optional property fields', () => {
    const wrapper = renderResults([
      dpe('raw', {
        nom_commune_ban: undefined,
        nom_commune_brut: 'Lyon',
        code_postal_ban: undefined,
        code_postal_brut: '69001',
        adresse_ban: undefined,
        adresse_brut: '5 rue du Port 69001 Lyon',
        type_batiment: undefined,
        surfaceHabitable: null,
        _distance: undefined
      }),
      dpe('unknown', {
        nom_commune_ban: undefined,
        code_postal_ban: undefined,
        type_batiment: 'Autre bâtiment',
        anneeConstruction: null
      })
    ])
    const byId = Object.fromEntries(cards(wrapper).map(card => [card.props('result').numero_dpe, card]))
    expect(byId.raw.props()).toMatchObject({
      address: '5 rue du Port',
      location: 'Lyon - 69001',
      surface: null,
      propertyType: null,
      floor: null,
      yearBuilt: 'Inconnue'
    })
    expect(byId.raw.text()).not.toContain('km')
    expect(byId.unknown.props()).toMatchObject({ location: 'Localisation inconnue - ', propertyType: null })
  })

  it('recognizes houses and avoids displaying apartment-only floor metrics', () => {
    const card = cards(renderResults([dpe('house', { type_batiment: 'MAISON INDIVIDUELLE', etage: 2 })]))[0]
    expect(card.props('propertyType')).toBe('maison')
    expect(card.find('.card-metrics.has-floor').exists()).toBe(false)
  })

  it.each([
    [0, "Aujourd'hui"],
    [1, 'Hier'],
    [4, 'Il y a 4 jours'],
    [14, 'Il y a 2 semaines'],
    [45, 'Il y a 1 mois'],
    [690, 'Il y a 23 mois'],
    [720, 'Il y a 2 ans'],
    [750, 'Il y a 2 ans et 1 mois']
  ])('renders a diagnosis from %i days ago with its full-date tooltip', (days, expected) => {
    const date = new Date(NOW.getTime() - days * DAY)
    const card = cards(renderResults([dpe('dated', { date_etablissement_dpe: date.toISOString() })]))[0]
    expect(card.props('dateDisplay')).toBe(expected)
    expect(card.props('dateTooltip')).toBe(
      date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    )
    expect(card.text()).toContain(expected)
  })
})

describe('recent result hiding and dialog lifecycle', () => {
  it('hides sequential visible cards, updates indexes and count, and eventually shows the empty state', async () => {
    const rows = [dpe('first', { _distance: 1 }), dpe('second', { _distance: 2 }), dpe('third', { _distance: 3 })]
    const wrapper = renderResults(rows)
    await hideCard(wrapper, 0)
    expect(displayedIds(wrapper)).toEqual(['second', 'third'])
    expect(wrapper.get('h2').text()).toBe('2 résultats affichés (1 masqué)')
    expect(cards(wrapper).map(card => card.props('index'))).toEqual([0, 1])
    expect(wrapper.find('[data-testid="property-dialog"]').exists()).toBe(false)

    await hideCard(wrapper, 1)
    expect(displayedIds(wrapper)).toEqual(['second'])
    expect(wrapper.get('h2').text()).toBe('1 résultat affiché (2 masqués)')
    await hideCard(wrapper, 0)
    expect(cards(wrapper)).toHaveLength(0)
    expect(wrapper.text()).toContain('Aucun DPE trouvé avec ces critères.')
    expect(wrapper.get('h2').text()).toBe('0 résultat affiché (3 masqués)')
    expect(rows.map(row => row.numero_dpe)).toEqual(['first', 'second', 'third'])
  })

  it.each([null, -1, 20])('ignores an invalid card hide event: %s', async index => {
    const wrapper = renderResults([dpe('first'), dpe('second')])
    cards(wrapper)[0].vm.$emit('hide', index)
    await nextTick()
    expect(displayedIds(wrapper)).toEqual(['first', 'second'])
    expect(wrapper.findComponent(EnteteResultats).props('hiddenCount')).toBe(0)
  })

  it('opens the clicked result, closes nested details independently, and clears both dialogs on base close', async () => {
    const property = dpe('selected', {
      typeBien: 'appartement',
      etage: '2',
      anneeConstruction: 1985,
      nombreNiveaux: 4,
      hauteurSousPlafond: 2.6,
      complementRefLogement: 'Bâtiment A',
      date_visite_diagnostiqueur: '2026-09-01T12:00:00',
      consommationEnergie: 142.6,
      emissionGES: 25.4,
      etiquette_dpe: 'C',
      _geopoint: '48.8566,2.3522'
    })
    const averages = { department: '75', energy: 190 }
    const wrapper = renderResults([property], { departmentAverages: averages })
    expect(wrapper.findComponent(PropertyDialog).exists()).toBe(false)
    expect(wrapper.findComponent(DetailsDialog).props('show')).toBe(false)
    await cards(wrapper)[0].get('button').trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props()).toMatchObject({
      property,
      formattedAddress: property.adresse_ban,
      commune: 'Paris',
      surface: 65,
      energyClass: 'C',
      propertyType: 'appartement',
      floor: '2',
      location: 'Bâtiment A',
      yearBuilt: '1985',
      numberOfLevels: 4,
      ceilingHeight: 2.6,
      diagnosisDate: '1 septembre 2026',
      energyConsumption: 142.6,
      gesEmissions: 25.4,
      departmentAverages: averages
    })
    const map = new URL(wrapper.findComponent(PropertyDialog).props('mapUrl'))
    expect(map.searchParams.get('q')).toBe(property.adresse_ban)
    expect(map.searchParams.get('ll')).toBe('48.8566,2.3522')
    expect(map.searchParams.get('z')).toBe('19')
    const geoportail = new URL(wrapper.findComponent(PropertyDialog).props('geoportailUrl'))
    expect(geoportail.searchParams.get('lat')).toBe('48.8566')
    expect(geoportail.searchParams.get('lng')).toBe('2.3522')

    await wrapper.get('[data-testid="open-dpe"]').trigger('click')
    expect(wrapper.get('[data-testid="dpe-dialog"]').text()).toContain('selected')
    expect(wrapper.findComponent(DetailsDialog).props()).toMatchObject({
      show: true,
      property,
      departmentAverages: averages
    })
    await wrapper.get('[data-testid="close-dpe"]').trigger('click')
    expect(wrapper.find('[data-testid="dpe-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="property-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-testid="open-dpe"]').trigger('click')
    await wrapper.get('[data-testid="close-property"]').trigger('click')
    expect(wrapper.find('[data-testid="property-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dpe-dialog"]').exists()).toBe(false)
    expect(wrapper.findComponent(DetailsDialog).props()).toMatchObject({ show: false, property: {} })

    await cards(wrapper)[0].trigger('click')
    expect(wrapper.find('[data-testid="property-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dpe-dialog"]').exists()).toBe(false)
  })

  it('resets expanded DPE details when a different card is selected', async () => {
    const wrapper = renderResults([dpe('first'), dpe('second')])
    await cards(wrapper)[0].trigger('click')
    await wrapper.get('[data-testid="open-dpe"]').trigger('click')
    await cards(wrapper)[1].trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props('property').numero_dpe).toBe('second')
    expect(wrapper.findComponent(DetailsDialog).props('property').numero_dpe).toBe('second')
    expect(wrapper.find('[data-testid="dpe-dialog"]').exists()).toBe(false)
  })

  it.each([
    [
      { surface_habitable_logement: 78.7, conso_5_usages_par_m2_ep: 198.7, emission_ges_5_usages_par_m2: 14.6 },
      79,
      198.7,
      14.6
    ],
    [{ surface_habitable: 54.2, consommation_energie: 112.2, estimation_ges: 8.4 }, 54, 112.2, 8.4],
    [{}, null, null, null]
  ])('passes safe normalized modal values for raw or missing metrics: %j', async (raw, surface, energy, ges) => {
    const property = dpe('raw', {
      surfaceHabitable: null,
      adresse_ban: undefined,
      adresse_brut: '15 rue Brute',
      nom_commune_ban: undefined,
      nom_commune_brut: 'Lyon',
      type_batiment: 'Maison',
      ...raw
    })
    const wrapper = renderResults([property])
    await cards(wrapper)[0].trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props()).toMatchObject({
      formattedAddress: '15 rue Brute',
      commune: 'Lyon',
      surface,
      energyConsumption: energy,
      gesEmissions: ges,
      propertyType: 'Maison',
      floor: null,
      yearBuilt: null,
      diagnosisDate: null,
      mapUrl: 'https://maps.google.com/maps?q=15%20rue%20Brute&output=embed&z=19&t=k'
    })
  })

  it('uses the reconstructed address in the modal when no original address exists', async () => {
    const wrapper = renderResults([
      dpe('reconstructed', {
        adresse_ban: undefined,
        adresse_brut: undefined,
        adresseComplete: '3 rue de lâ€™Église'
      })
    ])
    await cards(wrapper)[0].trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props('formattedAddress')).toBe("3 rue de l'Église")
  })

  it('updates department averages in both open dialogs without changing the selected property', async () => {
    const property = dpe('selected')
    const wrapper = renderResults([property], { departmentAverages: null })
    await cards(wrapper)[0].trigger('click')
    await wrapper.get('[data-testid="open-dpe"]').trigger('click')
    const averages = { department: '75', energy: 210 }
    await wrapper.setProps({ departmentAverages: averages })
    for (const dialog of [PropertyDialog, DetailsDialog]) {
      expect(wrapper.findComponent(dialog).props('departmentAverages')).toEqual(averages)
      expect(wrapper.findComponent(dialog).props('property')).toEqual(property)
    }
    expect(wrapper.findComponent(DetailsDialog).props('show')).toBe(true)
  })
})

describe('real shared results state', () => {
  it('closes selected, expanded and raw-data dialogs together, including repeated closes', () => {
    const state = useGestionResultats()
    const property = dpe('selected')
    const raw = dpe('raw')
    state.showDetails(property)
    state.showDPEDetails.value = true
    state.showRawDataForResult(raw)
    expect(state.selectedProperty.value).toEqual(property)
    expect(state.rawDataProperty.value).toEqual(raw)
    expect(state.showRawDataModal.value).toBe(true)
    for (let attempt = 0; attempt < 2; attempt++) {
      state.closeModal()
      expect(state.selectedProperty.value).toBeNull()
      expect(state.showDPEDetails.value).toBe(false)
      expect(state.showRawDataModal.value).toBe(false)
      expect(state.rawDataProperty.value).toBeNull()
    }
  })

  it('starts each results instance with independent hidden and modal state', () => {
    const first = useGestionResultats()
    const second = useGestionResultats()
    first.showDetails(dpe('selected'))
    first.showRawDataForResult(dpe('raw'))
    first.hiddenResults.value.add(0)
    expect(second.selectedProperty.value).toBeNull()
    expect(second.rawDataProperty.value).toBeNull()
    expect(second.showRawDataModal.value).toBe(false)
    expect(second.showDPEDetails.value).toBe(false)
    expect(second.hiddenResults.value.size).toBe(0)
  })

  it('maps consecutive visible indexes into the original list without modifying source results', () => {
    const state = useGestionResultats()
    const rows = [dpe('first'), dpe('second'), dpe('third')]
    state.hideResult(0, rows)
    state.hideResult(1, rows)
    expect([...state.hiddenResults.value]).toEqual([0, 2])
    expect(rows.filter((_, index) => !state.hiddenResults.value.has(index)).map(row => row.numero_dpe)).toEqual([
      'second'
    ])
    state.hideResult(0, rows)
    expect([...state.hiddenResults.value]).toEqual([0, 2, 1])
    expect(rows.map(row => row.numero_dpe)).toEqual(['first', 'second', 'third'])
  })

  it.each([null, -1, 99])('ignores invalid shared hide requests: %s', index => {
    const state = useGestionResultats()
    state.hideResult(index, [dpe('one')])
    expect(state.hiddenResults.value.size).toBe(0)
  })
})

describe('recent result regression fixes', () => {
  it.each([
    ['distance', ['near', 'middle', 'far', 'last']],
    ['surface', ['last', 'far', 'middle', 'near']],
    ['date-desc', ['last', 'far', 'middle', 'near']],
    ['date-asc', ['near', 'middle', 'far', 'last']],
    ['construction-desc', ['last', 'far', 'middle', 'near']],
    ['construction-asc', ['near', 'middle', 'far', 'last']],
    ['etage', ['near', 'middle', 'far', 'last']]
  ])('hides the clicked identity after sorting by %s', async (sort, expected) => {
    const byId = ['near', 'middle', 'far', 'last'].map((id, index) =>
      dpe(id, {
        _distance: index + 1,
        surfaceHabitable: 50 + index * 10,
        date_etablissement_dpe: `202${index + 2}-01-01`,
        anneeConstruction: 1980 + index * 10,
        etage: index + 1
      })
    )
    const rows = [byId[2], byId[0], byId[3], byId[1]]
    const wrapper = renderResults(rows)
    await wrapper.get('select').setValue(sort)
    expect(displayedIds(wrapper)).toEqual(expected)
    await hideCard(wrapper, 0)
    expect(displayedIds(wrapper)).toEqual(expected.slice(1))
    expect(rows.map(row => row.numero_dpe)).toEqual(['far', 'near', 'last', 'middle'])
  })

  it('continues hiding the right cards after earlier hides, re-sorting and criteria updates', async () => {
    const rows = [80, 50, 100, 60, 90, 70].map(surface =>
      dpe(String(surface), {
        surfaceHabitable: surface,
        _distance: surface
      })
    )
    const wrapper = renderResults(rows, { searchCriteria: { surface: '72' } })
    expect(displayedIds(wrapper)).toEqual(['50', '60', '70', '80', '90', '100'])
    await hideCard(wrapper, 0)
    await wrapper.get('select').setValue('surface')
    expect(displayedIds(wrapper)).toEqual(['70', '80', '60', '90', '100'])
    await hideCard(wrapper, 1)
    await wrapper.setProps({ searchCriteria: { surface: '95' } })
    expect(displayedIds(wrapper)).toEqual(['100', '90', '70', '60'])
    await hideCard(wrapper, 1)
    expect(displayedIds(wrapper)).toEqual(['100', '70', '60'])
    expect(wrapper.findComponent(EnteteResultats).props('hiddenCount')).toBe(3)
  })

  it.each([undefined, 0.5, '0', NaN, Infinity])('ignores malformed hide indexes: %s', async index => {
    const wrapper = renderResults([dpe('first'), dpe('second')])
    cards(wrapper)[0].vm.$emit('hide', index)
    await nextTick()
    expect(displayedIds(wrapper)).toEqual(['first', 'second'])
    expect(wrapper.findComponent(EnteteResultats).props('hiddenCount')).toBe(0)
  })

  it.each(['object', 'rows', 'clear'])('resets hidden and open state on %s replacement', async replacement => {
    const results = reactive(search([dpe('old-one'), dpe('old-two')]))
    const wrapper = renderResults([], { results })
    await hideCard(wrapper, 0)
    await cards(wrapper)[0].trigger('click')
    await wrapper.get('[data-testid="open-dpe"]').trigger('click')
    const newRows = [dpe('new-one'), dpe('new-two')]
    if (replacement === 'rows') {
      results.results = newRows
      await nextTick()
    } else {
      await wrapper.setProps({ results: replacement === 'clear' ? null : search(newRows) })
    }
    expect(wrapper.find('[data-testid="property-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dpe-dialog"]').exists()).toBe(false)
    if (replacement === 'clear') await wrapper.setProps({ results: search(newRows) })
    expect(displayedIds(wrapper)).toEqual(['new-one', 'new-two'])
    expect(wrapper.findComponent(EnteteResultats).props('hiddenCount')).toBe(0)
    await cards(wrapper)[0].trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props('property').numero_dpe).toBe('new-one')
    expect(wrapper.findComponent(DetailsDialog).props('show')).toBe(false)
  })

  it('keeps current hidden and modal state when only criteria or averages change', async () => {
    const wrapper = renderResults([dpe('hidden'), dpe('selected')])
    await hideCard(wrapper, 0)
    await cards(wrapper)[0].trigger('click')
    await wrapper.get('[data-testid="open-dpe"]').trigger('click')
    await wrapper.setProps({ searchCriteria: { surface: '70' }, departmentAverages: { department: '75' } })
    expect(displayedIds(wrapper)).toEqual(['selected'])
    expect(wrapper.findComponent(EnteteResultats).props('hiddenCount')).toBe(1)
    expect(wrapper.findComponent(PropertyDialog).props('property').numero_dpe).toBe('selected')
    expect(wrapper.findComponent(DetailsDialog).props('show')).toBe(true)
  })

  it.each([undefined, null, '', '  ', 'not-a-number', '65m²', NaN, Infinity, -1, false, {}, []])(
    'renders an explicit unknown surface for %j',
    async surface => {
      const wrapper = renderResults([
        dpe('sparse', {
          surfaceHabitable: surface
        })
      ])
      expect(cards(wrapper)[0].props('surface')).toBeNull()
      expect(cards(wrapper)[0].text()).toContain('Non renseignée')
      expect(cards(wrapper)[0].text()).not.toMatch(/NaN|Infinity|0 m²/)
      await cards(wrapper)[0].trigger('click')
      expect(wrapper.findComponent(PropertyDialog).props()).toMatchObject({
        surface: null,
        energyConsumption: null,
        gesEmissions: null
      })
    }
  )

  it.each([undefined, null, '', '  ', 'not-a-date', '2026-99-99', NaN, 0, false, {}, []])(
    'omits invalid diagnosis text and tooltips for %j',
    async date => {
      const wrapper = renderResults([
        dpe('sparse', {
          date_etablissement_dpe: date,
          date_visite_diagnostiqueur: date
        })
      ])
      expect(cards(wrapper)[0].props()).toMatchObject({ dateDisplay: null, dateTooltip: null })
      expect(cards(wrapper)[0].text()).not.toMatch(/Invalid Date|1970/)
      await cards(wrapper)[0].trigger('click')
      expect(wrapper.findComponent(PropertyDialog).props('diagnosisDate')).toBeNull()
    }
  )

  it.each([0, '0', ' 0 ', 0.1])('preserves known zero or rounded-zero values: %j', async value => {
    const wrapper = renderResults([
      dpe('zero', {
        surfaceHabitable: value,
        surface_habitable_logement: 99,
        _distance: value
      })
    ])
    expect(cards(wrapper)[0].props('surface')).toBe(0)
    expect(cards(wrapper)[0].text()).toContain('0 m²')
    expect(cards(wrapper)[0].props('distance')).toBe(Number(value))
    await cards(wrapper)[0].trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props()).toMatchObject({
      surface: 0
    })
  })

  it('uses the first valid numeric fallback consistently in cards and modal', async () => {
    const wrapper = renderResults([
      dpe('fallback', {
        surfaceHabitable: 'invalid',
        surface_habitable_logement: ' 78.7 '
      })
    ])
    expect(cards(wrapper)[0].props('surface')).toBe(79)
    await cards(wrapper)[0].trigger('click')
    expect(wrapper.findComponent(PropertyDialog).props()).toMatchObject({
      surface: 79
    })
  })

  it.each([undefined, null, '', '  ', 'invalid', '48.8,', ',2.3', '48.8junk,2.3', '91,2', '48,181', false, {}, []])(
    'omits the Geoportail link for absent or malformed geopoints: %j',
    async _geopoint => {
      const wrapper = renderResults([dpe('no-coordinates', { _geopoint })])
      await cards(wrapper)[0].trigger('click')
      expect(wrapper.findComponent(PropertyDialog).props('geoportailUrl')).toBeNull()
    }
  )

  it.each(['0,0', '0,2.3', '48.8,0', ' 0 , -0 '])('preserves real zero coordinate pairs: %s', async _geopoint => {
    const wrapper = renderResults([dpe('zero-coordinates', { _geopoint })])
    await cards(wrapper)[0].trigger('click')
    const url = new URL(wrapper.findComponent(PropertyDialog).props('geoportailUrl'))
    const [lat, lng] = _geopoint.split(',').map(Number)
    expect(Number(url.searchParams.get('lat'))).toBe(lat)
    expect(Number(url.searchParams.get('lng'))).toBe(lng === 0 ? 0 : lng)
  })

  it('cleans up real nested dialogs, scroll lock and inert state when a search is replaced', async () => {
    const wrapper = mount(ResultatsDpeRecents, {
      props: { results: search([dpe('old')]) },
      attachTo: document.body,
      global: { stubs: { RetourEnHaut: true } }
    })
    wrappers.push(wrapper)
    await cards(wrapper)[0].trigger('click')
    const details = wrapper.findAll('button').find(button => button.text().includes('Détails complets'))
    await details.trigger('click')
    const raw = wrapper.findAll('button').find(button => button.text().includes('Voir les données brutes'))
    await raw.trigger('click')
    expect(wrapper.find('[data-modal-layer="raw"]').exists()).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ results: search([dpe('new')]) })
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('[inert]').exists()).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    await cards(wrapper)[0].trigger('click')
    expect(wrapper.find('[data-modal-layer="property"]').exists()).toBe(true)
    expect(wrapper.find('[data-modal-layer="dpe"]').exists()).toBe(false)
    expect(wrapper.find('[data-modal-layer="raw"]').exists()).toBe(false)
  })
})
