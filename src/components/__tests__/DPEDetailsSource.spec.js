import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import DonneesBrutesModal from '../fonctionnalites/dpe/DonneesBrutesModal.vue'
import ModaleDetailsDPE from '../fonctionnalites/dpe/ModaleDetailsDPE.vue'

const wrappers = []
const source = (overrides = {}) => ({
  numero_dpe: 'synthetic-source',
  surface_habitable_logement: 50,
  conso_5_usages_par_m2_ep: 173.5,
  emission_ges_5_usages_par_m2: 6.25,
  etiquette_dpe: 'C',
  conso_5_usages_ep: 8675,
  conso_chauffage_ep: 6000.5,
  conso_ecs_ep: 2000.5,
  conso_refroidissement_ep: 0,
  conso_eclairage_ep: 274,
  conso_auxiliaires_ep: 400,
  ...overrides
})
const render = (component, props) => {
  const wrapper = mount(component, { props: { show: true, ...props } })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

it.each([
  { rawData: source(), consommationEnergie: 174, emissionGES: 6 },
  source(),
  { consommation_energie: 173.5, estimation_ges: 6.25, isLegacyData: true }
])('keeps exact decimal source consumption and GES in the raw-data summary: %j', dpeData => {
  const wrapper = render(DonneesBrutesModal, { dpeData })
  expect(wrapper.vm.importantFields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'consommation', value: '173.5 kWh/m²/an' }),
      expect.objectContaining({ key: 'emissions', value: '6.25 kg CO₂/m²/an' })
    ])
  )
})

it('preserves explicit zero values and all original source fields', () => {
  const wrapper = render(DonneesBrutesModal, {
    dpeData: {
      conso_5_usages_par_m2_ep: 999,
      rawData: source({ conso_5_usages_par_m2_ep: 0, emission_ges_5_usages_par_m2: 0 })
    }
  })
  expect(wrapper.vm.importantFields.map(field => field.value)).toContain('0 kWh/m²/an')
  expect(wrapper.vm.importantFields.map(field => field.value)).toContain('0 kg CO₂/m²/an')
  expect(wrapper.vm.getAllData().conso_5_usages_par_m2_ep).toBe(0)
})

describe('complete report source consistency and sparse sections', () => {
  it('shows compatible exact annual usage values with their unit, without invented no-air-conditioning claims', () => {
    const wrapper = render(ModaleDetailsDPE, { property: { rawData: source() } })
    expect(wrapper.findAll('[data-consumption-usage]')).toHaveLength(5)
    expect(wrapper.text()).toContain('6000.5 kWh/an')
    expect(wrapper.text()).toContain('0 kWh/an')
    expect(wrapper.text()).toContain('173.5 kWh/m²/an')
    expect(wrapper.text()).not.toContain('Pas de climatisation')
    expect(wrapper.find('[data-consumption-unavailable]').exists()).toBe(false)
  })

  it.each([{ conso_5_usages_ep: 7100, conso_5_usages_par_m2_ep: 142 }, { conso_ecs_ep: undefined }])(
    'hides incompatible or partial usage values while keeping the reported total and raw source accessible: %j',
    async overrides => {
      const rawData = source(overrides)
      const wrapper = render(ModaleDetailsDPE, {
        property: { rawData },
        departmentAverages: { department: '99', surfaceRanges: [{ range: '40-60m²', consumption: { total: 220 } }] }
      })
      expect(wrapper.find('[data-consumption-unavailable]').text()).toContain(
        'incomplet ou ne correspond pas au total transmis'
      )
      expect(wrapper.findAll('[data-consumption-usage]')).toHaveLength(0)
      expect(wrapper.text()).toContain(`${rawData.conso_5_usages_par_m2_ep} kWh/m²/an`)
      expect(wrapper.text()).not.toMatch(/% mieux|% au-dessus/)
      await wrapper
        .findAll('button')
        .find(button => button.text().includes('Voir les données brutes'))
        .trigger('click')
      const raw = wrapper.getComponent(DonneesBrutesModal)
      expect(raw.props('show')).toBe(true)
      expect(raw.vm.getAllData().conso_chauffage_ep).toBe(6000.5)
      await raw.get('input').setValue('conso_chauffage_ep')
      expect(raw.text()).toContain('6000.5')
    }
  )

  it.each(['isLegacyData', 'fromLegacy'])(
    'keeps the %s legacy cue and source class while omitting three empty sections',
    flag => {
      const wrapper = render(ModaleDetailsDPE, {
        property: { [flag]: true, classeDPE: 'A', consommationEnergie: 10, surfaceHabitable: 10 }
      })
      expect(wrapper.get('h3').text()).toContain('DPE ancien · avant juillet 2021')
      expect(wrapper.text()).toContain('Classe A')
      expect(wrapper.text()).not.toContain('Consommations par usage')
      expect(wrapper.text()).not.toContain('Systèmes et équipements')
      expect(wrapper.text()).not.toContain('Qualité de l’isolation')
      expect(wrapper.text()).not.toContain("Qualité de l'isolation")
    }
  )

  it('retains legacy thermal surface and exact metrics from original fields', () => {
    const wrapper = render(ModaleDetailsDPE, {
      property: {
        isLegacyData: true,
        rawData: { surface_thermique_lot: 18.25, consommation_energie: 99.75, estimation_ges: 3.125 }
      }
    })
    expect(wrapper.text()).toContain('18.25 m²')
    expect(wrapper.text()).toContain('99.75 kWh/m²/an')
    expect(wrapper.text()).toContain('3.125 kg CO₂/m²/an')
  })

  it('retains equipment and insulation sections that actually contain data', () => {
    const wrapper = render(ModaleDetailsDPE, { property: { systemeChauffage: 'Radiateur', isolationMurs: 'bonne' } })
    expect(wrapper.text()).toContain('Systèmes et équipements')
    expect(wrapper.text()).toContain('Radiateur')
    expect(wrapper.text()).toContain("Qualité de l'isolation")
    expect(wrapper.text()).toContain('Bonne')
    expect(wrapper.text()).toContain('Non renseignée')
  })
})
