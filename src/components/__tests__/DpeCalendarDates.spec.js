import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ModaleDetailsDPE from '../fonctionnalites/dpe/ModaleDetailsDPE.vue'
import ResultatsDpeRecents from '../fonctionnalites/dpe/ResultatsDpeRecents.vue'
import ResultatsLocaliserDpe from '../fonctionnalites/localisation/ResultatsLocaliserDpe.vue'
import CarteBien from '../partages/CarteBien.vue'

const wrappers = []
const propertyDialog = { props: ['diagnosisDate'], template: '<div>{{ diagnosisDate }}</div>' }
const stubs = { ModaleProprietee: propertyDialog, ModaleDetailsDPE: true, RetourEnHaut: true }

function render(component, props, options = {}) {
  const wrapper = mount(component, { props, ...options })
  wrappers.push(wrapper)
  return wrapper
}

function row(id, date, visit = date) {
  return {
    id,
    numero_dpe: id,
    numeroDPE: id,
    adresse_ban: '350 Avenue de la Touloubre',
    date_etablissement_dpe: date,
    dateVisite: date,
    date_visite_diagnostiqueur: visit,
    typeBien: 'appartement'
  }
}

function recent(rows) {
  return render(ResultatsDpeRecents, { results: { results: rows } }, { global: { stubs } })
}

function localiser(rows) {
  return render(ResultatsLocaliserDpe, { searchResult: { results: rows } }, { global: { stubs } })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 23, 30))
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.useRealTimers()
})

describe('real DPE calendar-date regression', () => {
  it('keeps the establishment date on recent cards and the visit date in the property dialog', async () => {
    const wrapper = recent([row('2613E2476282I', '2026-09-28', '2026-06-04')])
    const card = wrapper.findComponent(CarteBien)
    expect(card.props('dateTooltip')).toBe('28 septembre 2026')
    expect(card.props('dateDisplay')).toBe('Il y a 5 jours')
    await card.trigger('click')
    expect(wrapper.findComponent(propertyDialog).props('diagnosisDate')).toBe('4 juin 2026')
  })

  it('uses the shared calendar formatter for localiser cards and their property dialog', async () => {
    const wrapper = localiser([row('2613E2476282I', '2026-09-28')])
    const card = wrapper.findComponent(CarteBien)
    expect(card.props('dateTooltip')).toBe('28 septembre 2026')
    expect(card.props('dateDisplay')).toBe('il y a 5 jours')
    await card.trigger('click')
    expect(wrapper.findComponent(propertyDialog).props('diagnosisDate')).toBe('28 septembre 2026')
  })

  it.each([
    ['2026-10-03', "Aujourd'hui", "aujourd'hui"],
    ['2026-10-02', 'Hier', 'hier']
  ])('renders a calendar day without an extra day or prefix: %s', (date, recentLabel, localiserLabel) => {
    expect(
      recent([row('day', date)])
        .findComponent(CarteBien)
        .props('dateDisplay')
    ).toBe(recentLabel)
    expect(
      localiser([row('day', date)])
        .findComponent(CarteBien)
        .props('dateDisplay')
    ).toBe(localiserLabel)
  })

  it.each([
    [{ dateVisite: '2026-09-28' }, '28 septembre 2026'],
    [{ date_visite_diagnostiqueur: '2026-06-04' }, '4 juin 2026'],
    [{ dateVisite: '2024-02-29' }, '29 février 2024']
  ])('keeps the exact date in the real full report: %j', (property, expected) => {
    const wrapper = render(ModaleDetailsDPE, { show: true, property })
    expect(wrapper.text()).toContain('Date du diagnostic')
    expect(wrapper.text()).toContain(expected)
  })

  it.each([recent, localiser])(
    'sorts valid calendar dates and keeps malformed dates with missing dates',
    async create => {
      const wrapper = create([
        row('middle', '2026-06-04'),
        row('invalid', '2026-02-30'),
        row('newest', '2026-09-28'),
        row('oldest', '2024-02-29'),
        row('missing', null)
      ])
      await wrapper.setData({ sortBy: 'date-desc' })
      expect(wrapper.findAllComponents(CarteBien).map(card => card.props('result').id)).toEqual([
        'newest',
        'middle',
        'oldest',
        'invalid',
        'missing'
      ])
      await wrapper.setData({ sortBy: 'date-asc' })
      expect(wrapper.findAllComponents(CarteBien).map(card => card.props('result').id)).toEqual([
        'invalid',
        'missing',
        'oldest',
        'middle',
        'newest'
      ])
    }
  )

  it.each(['2026-02-30', '2026-02-29', '1900-02-29', '2026-04-31', '0', null])(
    'keeps impossible or absent dates out of cards, dialogs and reports: %j',
    async value => {
      for (const create of [recent, localiser]) {
        const wrapper = create([row('unknown', value)])
        const card = wrapper.findComponent(CarteBien)
        expect(card.props('dateTooltip')).toBeNull()
        expect(card.props('dateDisplay')).toBeNull()
        await card.trigger('click')
        expect(wrapper.findComponent(propertyDialog).props('diagnosisDate')).toBeNull()
        expect(wrapper.text()).not.toMatch(/Invalid Date|NaN|1 mars/)
      }
      const report = render(ModaleDetailsDPE, { show: true, property: { dateVisite: value } })
      expect(report.text()).not.toContain('Date du diagnostic')
      expect(report.text()).not.toMatch(/Invalid Date|NaN|1 mars/)
    }
  )
})
