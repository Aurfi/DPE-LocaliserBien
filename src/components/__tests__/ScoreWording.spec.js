import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import DPEScoringService from '../../services/dpe-scoring.service.js'
import ResultatsLocaliserDpe from '../fonctionnalites/localisation/ResultatsLocaliserDpe.vue'
import ModaleProprietee from '../fonctionnalites/recherche/ModaleProprietee.vue'
import CarteBien from '../partages/CarteBien.vue'

const explanation =
  'Le score de similarité compare les critères saisis. Même à 100/100, il ne confirme pas l’identité du bien.'
const criteria = Object.freeze({
  commune: '13080',
  surfaceHabitable: 65.5,
  consommationEnergie: 167,
  emissionGES: 6
})
const result = Object.freeze({
  adresseComplete: '1 rue Test',
  commune: 'Aix-en-Provence',
  codePostal: '13080',
  surfaceHabitable: 65.6,
  consommationEnergie: 167,
  emissionGES: 6,
  typeBien: 'appartement',
  matchScore: 100,
  distance: 2.3
})
let wrapper

afterEach(() => {
  wrapper?.unmount()
})

describe('similarity score wording', () => {
  it('keeps the 65.6 m² / 65.5 m² score and states its limits without claiming identity', async () => {
    const score = await new DPEScoringService().calculateMatchScore(
      {
        code_postal_ban: '13080',
        surface_habitable_logement: 65.6,
        conso_5_usages_par_m2_ep: 167,
        emission_ges_5_usages_par_m2: 6
      },
      criteria
    )
    expect(score).toBe(100)
    wrapper = mount(ResultatsLocaliserDpe, {
      props: { searchResult: { searchStrategy: 'SUCCESS', results: [result] }, searchCriteria: criteria }
    })
    expect(wrapper.text()).toContain('Une correspondance forte avec vos critères')
    expect(wrapper.get('.score-badge').text()).toBe('Score 100/100')
    expect(wrapper.get('[data-score-explanation]').text()).toBe(explanation)
    expect(wrapper.get('[data-score-explanation]').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('65.6 m²')
    expect(wrapper.text()).not.toMatch(/correspondance (parfaite|exacte)|100%/i)
    expect(wrapper.findComponent(CarteBien).props('score')).toBe(score)
    expect(wrapper.props('searchCriteria')).toEqual(criteria)
    expect(wrapper.vm.filteredResults[0].surfaceHabitable).toBe(65.6)
  })

  it.each([
    [[100], 'Une correspondance forte avec vos critères'],
    [[100, 100, 80], '2 correspondances fortes avec vos critères'],
    [[95, 80], 'Aucune correspondance forte avec vos critères']
  ])('preserves the existing status count for scores %j', (scores, status) => {
    wrapper = mount(ResultatsLocaliserDpe, {
      props: {
        searchResult: { searchStrategy: 'SUCCESS', results: scores.map(matchScore => ({ ...result, matchScore })) },
        searchCriteria: criteria
      }
    })
    expect(wrapper.vm.getMatchStatusText()).toBe(status)
    expect(wrapper.vm.filteredResults.map(row => row.matchScore)).toEqual([...scores].sort((a, b) => b - a))
  })

  it.each([0, 80, 100])('labels the card score %s out of 100, with an accessible similarity name', score => {
    wrapper = mount(CarteBien, {
      props: { result, index: 0, score, surface: 65.6, dateDisplay: 'il y a 100 jours', distance: 2.3 }
    })
    const badge = wrapper.get('.score-badge')
    expect(badge.text()).toBe(`Score ${score}/100`)
    expect(badge.attributes('aria-label')).toBe(`Score de similarité : ${score} sur 100`)
    expect(badge.classes()).toContain('whitespace-nowrap')
    expect(wrapper.get('.card-metadata').classes()).toContain('flex-wrap')
    expect(wrapper.text()).not.toContain(`${score}%`)
  })

  it('does not introduce a score on cards where none was supplied', () => {
    wrapper = mount(CarteBien, { props: { result, index: 0, surface: 65.6 } })
    expect(wrapper.find('.score-badge').exists()).toBe(false)
  })

  it('also explains similarity within the property dialog', () => {
    wrapper = mount(ModaleProprietee, {
      props: {
        property: result,
        formattedAddress: '1 rue Test',
        commune: 'Aix-en-Provence',
        surface: 65.6,
        matchScore: 100
      }
    })
    expect(wrapper.get('.score-badge').text()).toBe('Score 100/100')
    expect(wrapper.get('.score-badge').attributes('aria-label')).toBe('Score de similarité : 100 sur 100')
    expect(wrapper.get('[data-score-explanation]').text()).toBe(explanation)
    expect(wrapper.get('[data-score-explanation]').isVisible()).toBe(true)
    expect(wrapper.text()).not.toContain('100%')
  })

  it.each(['SUCCESS', 'ERROR'])('does not show an orphan score explanation with no %s results', searchStrategy => {
    wrapper = mount(ResultatsLocaliserDpe, {
      props: { searchResult: { searchStrategy, results: [] }, searchCriteria: criteria }
    })
    expect(wrapper.find('[data-score-explanation]').exists()).toBe(false)
  })
})
