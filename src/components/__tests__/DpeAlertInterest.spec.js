import { shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResultatsDpeRecents from '../fonctionnalites/dpe/ResultatsDpeRecents.vue'
import CarteBien from '../partages/CarteBien.vue'
import EnteteResultats from '../partages/EnteteResultats.vue'

const row = {
  numero_dpe: 'TEST-ALERT-INTEREST',
  adresse_ban: '10 rue de la Recherche 75001 Paris',
  nom_commune_ban: 'Paris',
  code_postal_ban: '75001',
  surfaceHabitable: 65.5,
  date_etablissement_dpe: '2026-10-01',
  _distance: 0.5
}
const expectedSubject = 'Alertes DPE à 5,99 € — demande de contact'
const expectedBody = [
  'Bonjour,',
  'Je souhaite être recontacté(e) pour acheter les alertes DPE à 5,99 € pour 30 jours, avec jusqu’à 3 recherches suivies et sans renouvellement automatique.',
  '',
  'Ma zone et mes critères :',
  'À partir de quand j’en aurais besoin :'
].join('\r\n')
const sectionSelector = 'section[aria-labelledby="dpe-alert-interest-title"]'
let wrapper

const renderResults = (rows = [row], props = {}) => {
  wrapper = shallowMount(ResultatsDpeRecents, {
    props: {
      results: { results: rows, searchAddress: '10 rue de la Recherche', searchRadius: 1 },
      searchCriteria: { monthsBack: 1, surface: 65.5 },
      ...props
    }
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

describe('proposed priced DPE-alert interest section', () => {
  it('does not appear before results exist and disappears when results are cleared', async () => {
    renderResults([], { results: null })
    expect(wrapper.find(sectionSelector).exists()).toBe(false)
    await wrapper.setProps({ results: { results: [row] } })
    expect(wrapper.findAll(sectionSelector)).toHaveLength(1)
    await wrapper.setProps({ results: null })
    expect(wrapper.find(sectionSelector).exists()).toBe(false)
  })

  it.each([{ rows: [row] }, { rows: [] }])('keeps the same proposed offer after a completed search: %j', ({ rows }) => {
    renderResults(rows)
    const section = wrapper.get(sectionSelector)
    expect(section.get('h3').text()).toBe('Alertes DPE par e-mail, en projet')
    expect(section.text()).toContain(
      '5,99 € au total pour suivre jusqu’à 3 recherches pendant 30 jours. Un e-mail quotidien si de nouveaux DPE correspondent à vos critères. Sans renouvellement automatique.'
    )
    expect(section.text()).toContain('Service pas encore disponible. Aucun paiement ni engagement.')
    expect(section.get('a').text()).toBe('Être recontacté à ce tarif')
    expect(section.findAll('a')).toHaveLength(1)
    expect(section.find('form, input, button, dialog, [role="dialog"], [role="alert"]').exists()).toBe(false)
    expect(section.attributes('tabindex')).toBeUndefined()
    expect(section.attributes('aria-live')).toBeUndefined()
    if (rows.length === 0) expect(wrapper.text()).toContain('Aucun DPE trouvé avec ces critères.')
  })

  it('places the plain section below the results grid without changing the cards', () => {
    renderResults()
    expect(wrapper.get('.grid').element.nextElementSibling).toBe(wrapper.get(sectionSelector).element)
    expect(wrapper.findAllComponents(CarteBien)).toHaveLength(1)
    expect(wrapper.getComponent(CarteBien).props('result')).toEqual(row)
    expect(wrapper.getComponent(EnteteResultats).props('title')).toBe('1 résultat affiché')
    expect(wrapper.getComponent(EnteteResultats).props('subtitle')).toContain('Autour de 10 rue de la Recherche')
  })

  it('encodes one editable mailto draft with exact recipient, subject and CRLF line breaks', () => {
    renderResults()
    const href = wrapper.get(`${sectionSelector} a`).attributes('href')
    const email = new URL(href)
    expect(email.protocol).toBe('mailto:')
    expect(email.pathname).toBe('contact@localiserbien.fr')
    expect([...email.searchParams.keys()]).toEqual(['subject', 'body'])
    expect(email.searchParams.get('subject')).toBe(expectedSubject)
    expect(email.searchParams.get('body')).toBe(expectedBody)
    expect(href).toBe(
      `mailto:contact@localiserbien.fr?subject=${encodeURIComponent(expectedSubject)}&body=${encodeURIComponent(expectedBody)}`
    )
    expect(href).toContain('%0D%0A%0D%0A')
    expect(href).not.toMatch(/[\r\n]/)
    expect(wrapper.get(`${sectionSelector} a`).attributes('target')).toBeUndefined()
  })

  it('never includes addresses, filters or DPE data, even after repeated searches', async () => {
    renderResults()
    const href = wrapper.get(`${sectionSelector} a`).attributes('href')
    for (const address of ['40 avenue Privée 69001 Lyon', 'secret@example.test?bcc=other@example.test']) {
      await wrapper.setProps({
        results: { results: [{ ...row, numero_dpe: address }], searchAddress: address },
        searchCriteria: { address, monthsBack: 6, surface: 123.45, ges: 77 }
      })
      expect(wrapper.get(`${sectionSelector} a`).attributes('href')).toBe(href)
      expect(wrapper.findAll(sectionSelector)).toHaveLength(1)
    }
    expect(decodeURIComponent(href)).not.toContain(row.adresse_ban)
    expect(decodeURIComponent(href)).not.toContain(row.numero_dpe)
  })

  it('does not send or store data on render or repeated interest-link clicks', async () => {
    const fetchCalls = fetch.mock.calls.length
    const storageWrites = localStorage.setItem.mock.calls.length
    renderResults()
    expect(fetch.mock.calls).toHaveLength(fetchCalls)
    expect(localStorage.setItem.mock.calls).toHaveLength(storageWrites)
    const link = wrapper.get(`${sectionSelector} a`)
    // Cancel the native mail-client navigation at the test boundary, never send email.
    link.element.addEventListener('click', event => event.preventDefault())
    await link.trigger('click')
    await link.trigger('click')
    expect(fetch.mock.calls).toHaveLength(fetchCalls)
    expect(localStorage.setItem.mock.calls).toHaveLength(storageWrites)
    expect(wrapper.findAll(sectionSelector)).toHaveLength(1)
    expect(wrapper.findAllComponents(CarteBien)).toHaveLength(1)
    expect(wrapper.emitted('clear-results')).toBeUndefined()
    expect(wrapper.vm.selectedProperty).toBeNull()
  })

  it('preserves the existing new-search event without any interest requirement', async () => {
    renderResults()
    wrapper.getComponent(EnteteResultats).vm.$emit('close')
    expect(wrapper.emitted('clear-results')).toEqual([[]])
    await wrapper.setProps({ results: null })
    expect(wrapper.find(sectionSelector).exists()).toBe(false)
  })
})
