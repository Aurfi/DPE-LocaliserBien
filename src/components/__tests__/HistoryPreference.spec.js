import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useRecherches } from '../../stores/useRecherches.js'
import HistoriqueRechercheDPE from '../fonctionnalites/dpe/HistoriqueRechercheDPE.vue'
import RecherchesRecentes from '../fonctionnalites/recherche/RecherchesRecentes.vue'
import PreferenceHistorique from '../mise-en-page/PreferenceHistorique.vue'

let wrappers = []
let storage
const mountComponent = component => {
  const wrapper = mount(component)
  wrappers.push(wrapper)
  return wrapper
}
const findButton = (wrapper, text) => wrapper.findAll('button').find(button => button.text() === text)

beforeEach(() => {
  useRecherches().setHistoryEnabled(false)
  storage = new Map([
    ['dpe_recent_searches', JSON.stringify([{ commune: 'Old Paris search', surface: 65.5, timestamp: Date.now() }])],
    ['recent_dpe_searches', JSON.stringify([{ address: 'Old Lyon search', radius: 1, timestamp: Date.now() }])]
  ])
  localStorage.getItem.mockImplementation(key => storage.get(key) ?? null)
  localStorage.setItem.mockImplementation((key, value) => storage.set(key, value))
  localStorage.removeItem.mockImplementation(key => storage.delete(key))
  window.dispatchEvent(new StorageEvent('storage', { key: null }))
  localStorage.setItem.mockClear()
})

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers = []
})

describe('optional history preference', () => {
  it('keeps the unchecked, labelled inline option without verbose explanation', () => {
    const wrapper = mountComponent(PreferenceHistorique)
    expect(wrapper.get('input[type="checkbox"]').element.checked).toBe(false)
    expect(wrapper.get('label').text()).toBe('Conserver mes recherches sur cet appareil')
    expect(wrapper.find('#history-explanation').exists()).toBe(false)
    expect(wrapper.get('input').attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('reveals both old histories only after choosing the option, then hides them again without deleting', async () => {
    const preference = mountComponent(PreferenceHistorique)
    const listing = mountComponent(RecherchesRecentes)
    const nearby = mountComponent(HistoriqueRechercheDPE)
    expect(listing.text().toLowerCase()).not.toContain('old paris')
    expect(nearby.text().toLowerCase()).not.toContain('old lyon')
    await preference.get('input').setValue(true)
    expect(listing.text().toLowerCase()).toContain('old paris')
    expect(nearby.text().toLowerCase()).toContain('old lyon')
    expect(listing.text()).toContain("Effacer l'historique")
    expect(nearby.text()).toContain("Effacer l'historique")
    await preference.get('input').setValue(false)
    expect(listing.text().toLowerCase()).not.toContain('old paris')
    expect(nearby.text().toLowerCase()).not.toContain('old lyon')
    expect(storage.has('dpe_recent_searches')).toBe(true)
    expect(storage.has('recent_dpe_searches')).toBe(true)
    expect(localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('lets the user cancel inline clearing, or clear hidden history without enabling it', async () => {
    const wrapper = mountComponent(PreferenceHistorique)
    await findButton(wrapper, 'Effacer les recherches enregistrées').trigger('click')
    expect(storage.has('dpe_recent_searches')).toBe(true)
    await findButton(wrapper, 'Annuler').trigger('click')
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    await findButton(wrapper, 'Effacer les recherches enregistrées').trigger('click')
    await findButton(wrapper, 'Tout effacer').trigger('click')
    expect(storage.has('dpe_recent_searches')).toBe(false)
    expect(storage.has('recent_dpe_searches')).toBe(false)
    expect(wrapper.get('input').element.checked).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('ont été effacées')
    expect(findButton(wrapper, 'Effacer les recherches enregistrées')).toBeUndefined()
    expect(findButton(wrapper, 'Tout effacer')).toBeUndefined()
  })

  it.each([undefined, '[]', '{}', 'null', '{invalid'])(
    'hides clear controls for empty or invalid storage (%s)',
    value => {
      storage.clear()
      if (value !== undefined) {
        storage.set('dpe_recent_searches', value)
        storage.set('recent_dpe_searches', value)
      }
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
      const wrapper = mountComponent(PreferenceHistorique)
      expect(wrapper.get('input').element.checked).toBe(false)
      expect(wrapper.findAll('button')).toHaveLength(0)
    }
  )

  it.each(['recent', 'dpe'])('reacts to the first persisted %s search and removal of its last entry', async type => {
    const store = useRecherches()
    store.clearSearchHistory()
    const wrapper = mountComponent(PreferenceHistorique)
    await wrapper.get('input').setValue(true)
    expect(wrapper.findAll('button')).toHaveLength(0)
    if (type === 'recent') store.saveSearch({ commune: 'Paris', surfaceHabitable: 65.5 })
    else store.saveRecentDPESearch({ address: 'Lyon', radius: 1 }, { results: [] })
    await nextTick()
    expect(findButton(wrapper, 'Effacer les recherches enregistrées')).toBeDefined()
    store.removeSearch(0, type)
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('input').element.checked).toBe(true)
  })

  it('keeps clear available while either saved collection remains', async () => {
    const wrapper = mountComponent(PreferenceHistorique)
    useRecherches().clearSearchHistory('recent')
    await nextTick()
    expect(findButton(wrapper, 'Effacer les recherches enregistrées')).toBeDefined()
    useRecherches().clearSearchHistory('dpe')
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('drops a pending confirmation after cross-tab deletion, then offers a fresh clear action for new history', async () => {
    const wrapper = mountComponent(PreferenceHistorique)
    await findButton(wrapper, 'Effacer les recherches enregistrées').trigger('click')
    storage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(0)
    storage.set('recent_dpe_searches', JSON.stringify([{ address: 'Nantes' }]))
    window.dispatchEvent(new StorageEvent('storage', { key: 'recent_dpe_searches' }))
    await nextTick()
    expect(findButton(wrapper, 'Effacer les recherches enregistrées')).toBeDefined()
    expect(findButton(wrapper, 'Tout effacer')).toBeUndefined()
    expect(wrapper.get('input').element.checked).toBe(false)
    expect(wrapper.text()).not.toContain('Nantes')
  })

  it('does not reuse a pending confirmation after clearing and saving again in the same turn', async () => {
    const wrapper = mountComponent(PreferenceHistorique)
    const store = useRecherches()
    await wrapper.get('input').setValue(true)
    await findButton(wrapper, 'Effacer les recherches enregistrées').trigger('click')
    store.clearSearchHistory()
    store.saveSearch({ commune: 'Paris' })
    await nextTick()
    expect(findButton(wrapper, 'Effacer les recherches enregistrées')).toBeDefined()
    expect(findButton(wrapper, 'Tout effacer')).toBeUndefined()
  })

  it('does not reveal clear controls for a save that never reached storage', async () => {
    const store = useRecherches()
    store.clearSearchHistory()
    const wrapper = mountComponent(PreferenceHistorique)
    await wrapper.get('input').setValue(true)
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full')
    })
    expect(store.saveSearch({ commune: 'Paris' })).toBe(false)
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('keeps the checkbox off and explains a failed opt-in without blocking search', async () => {
    const wrapper = mountComponent(PreferenceHistorique)
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    await wrapper.get('input').setValue(true)
    expect(wrapper.get('input').element.checked).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('La recherche reste disponible')
  })

  it('does not claim history was cleared when storage deletion fails', async () => {
    const wrapper = mountComponent(PreferenceHistorique)
    localStorage.removeItem.mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    await findButton(wrapper, 'Effacer les recherches enregistrées').trigger('click')
    await findButton(wrapper, 'Tout effacer').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain("L'effacement a échoué")
    expect(storage.has('dpe_recent_searches')).toBe(true)
    expect(findButton(wrapper, 'Effacer les recherches enregistrées')).toBeDefined()
  })
})

describe('system font delivery', () => {
  it('does not declare remote font requests or hints in the document', () => {
    const html = readFileSync(resolve('index.html'), 'utf8')
    const stylesheet = readFileSync(resolve('src/style.css'), 'utf8')
    expect(stylesheet).toContain("@import './styles/app-base.css'")
    const css = readFileSync(resolve('src/styles/app-base.css'), 'utf8')
    expect(html).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
    expect(html).toContain('font-family: system-ui,')
    expect(css).toContain('font-family: system-ui,')
  })
})
