import userEvent from '@testing-library/user-event'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { useGestionResultats } from '../../composables/useGestionResultats.js'
import DonneesBrutesModal from '../fonctionnalites/dpe/DonneesBrutesModal.vue'
import ModaleDetailsDPE from '../fonctionnalites/dpe/ModaleDetailsDPE.vue'
import ModaleProprietee from '../fonctionnalites/recherche/ModaleProprietee.vue'

const property = {
  id: 'test-dpe',
  numeroDPE: 'test-dpe',
  adresseComplete: '1 rue Test',
  commune: 'Lyon',
  surfaceHabitable: 65,
  consommationEnergie: 173,
  emissionGES: 6,
  classeDPE: 'C'
}
const Harness = defineComponent({
  components: { ModaleProprietee, ModaleDetailsDPE, DonneesBrutesModal },
  setup() {
    return { ...useGestionResultats(), property }
  },
  template: `
    <section>
      <button data-testid="open-property" @click="showDetails(property)">Voir le bien</button>
      <button data-testid="open-raw" @click="showRawDataForResult(property)">Données seules</button>
      <ModaleProprietee v-if="selectedProperty" :property="selectedProperty" formatted-address="1 rue Test"
        commune="Lyon" :surface="65" map-url="https://maps.google.com/maps?q=Lyon&output=embed"
        @close="closeModal" @show-details="showDPEDetails = true" />
      <div data-testid="persistent-dpe-wrapper">
        <ModaleDetailsDPE :show="showDPEDetails" :property="selectedProperty" @close="showDPEDetails = false" />
      </div>
      <DonneesBrutesModal :show="showRawDataModal" :dpe-data="rawDataProperty" @close="showRawDataModal = false" />
    </section>`
})

let wrapper
let host
let background
let outsideButton
const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
const layer = name => wrapper.get(`[data-modal-layer="${name}"]`)
const dialog = name => layer(name).get('[role="dialog"]')
const buttonWithText = (name, text) =>
  dialog(name)
    .findAll('button')
    .find(button => button.text().includes(text))
const click = async button => {
  button.element.focus()
  await button.trigger('click')
  await settle()
}
const openProperty = async () => {
  await click(wrapper.get('[data-testid="open-property"]'))
}
const openDetails = async () => {
  await click(buttonWithText('property', 'Détails complets'))
}
const openRaw = async () => {
  await click(buttonWithText('dpe', 'Voir les données brutes'))
}
const key = async (value, options = {}) => {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })
  document.activeElement.dispatchEvent(event)
  await settle()
  return event
}

beforeEach(async () => {
  document.body.style.overflow = 'auto'
  host = document.createElement('div')
  background = document.createElement('aside')
  outsideButton = document.createElement('button')
  outsideButton.textContent = 'Outside'
  background.append(outsideButton)
  document.body.append(background, host)
  wrapper = mount(Harness, { attachTo: host })
  await settle()
})

afterEach(async () => {
  wrapper?.unmount()
  await settle()
  host.remove()
  background.remove()
  document.body.style.removeProperty('overflow')
  vi.restoreAllMocks()
})

function expectActive(name) {
  expect(dialog(name).attributes('aria-modal')).toBe('true')
  expect(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).toHaveLength(1)
  expect(dialog(name).element.contains(document.activeElement)).toBe(true)
  const titleId = dialog(name).attributes('aria-labelledby')
  expect(document.getElementById(titleId)?.textContent.trim()).toBeTruthy()
  expect(document.body.style.overflow).toBe('hidden')
}

describe('actual property, DPE and raw-data modal layers', () => {
  it('focuses the title, gives the dialog a unique name and makes background branches inert', async () => {
    await openProperty()
    expectActive('property')
    expect(dialog('property').get('iframe').attributes('title')).toBe('Vue satellite de 1 rue Test')
    expect(document.activeElement.hasAttribute('data-modal-initial-focus')).toBe(true)
    expect(background.hasAttribute('inert')).toBe(true)
    expect(background.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.get('[data-testid="open-property"]').attributes('inert')).toBe('')
  })

  it('opens a dialog inside a previously inert persistent wrapper and focuses its title', async () => {
    await openProperty()
    const persistentWrapper = wrapper.get('[data-testid="persistent-dpe-wrapper"]')
    expect(persistentWrapper.attributes('inert')).toBe('')
    expect(persistentWrapper.attributes('aria-hidden')).toBe('true')
    await openDetails()
    expect(persistentWrapper.attributes('inert')).toBeUndefined()
    expect(persistentWrapper.attributes('aria-hidden')).toBeUndefined()
    expectActive('dpe')
    expect(document.activeElement).toBe(dialog('dpe').get('[data-modal-initial-focus]').element)
  })

  it('closes only the top layer with Escape and restores each exact opener', async () => {
    const resultTrigger = wrapper.get('[data-testid="open-property"]').element
    await openProperty()
    const detailsTrigger = buttonWithText('property', 'Détails complets').element
    await openDetails()
    expectActive('dpe')
    expect(dialog('property').attributes('aria-modal')).toBeUndefined()
    expect(layer('property').element.closest('[inert]')).not.toBe(null)
    const rawTrigger = buttonWithText('dpe', 'Voir les données brutes').element
    await openRaw()
    expectActive('raw')
    expect(dialog('dpe').attributes('inert')).toBe('')
    expect(dialog('raw').element.closest('[inert]')).toBe(null)
    const titleIds = [...document.querySelectorAll('[role="dialog"]')].map(el => el.getAttribute('aria-labelledby'))
    expect(new Set(titleIds).size).toBe(3)

    await key('Escape')
    expect(wrapper.find('[data-modal-layer="raw"]').exists()).toBe(false)
    expectActive('dpe')
    expect(document.activeElement).toBe(rawTrigger)
    await key('Escape')
    expect(wrapper.find('[data-modal-layer="dpe"]').exists()).toBe(false)
    expectActive('property')
    expect(document.activeElement).toBe(detailsTrigger)
    await key('Escape')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(resultTrigger)
    expect(document.body.style.overflow).toBe('auto')
    expect(background.hasAttribute('inert')).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
  })

  it.each(['property', 'dpe', 'raw'])('contains Tab and Shift+Tab in the active %s layer', async name => {
    await openProperty()
    if (name !== 'property') await openDetails()
    if (name === 'raw') await openRaw()
    const user = userEvent.setup()
    const active = dialog(name).element
    const buttons = [...active.querySelectorAll('a[href], button, input')]
    for (let i = 0; i < buttons.length + 3; i++) {
      await user.tab()
      expect(active.contains(document.activeElement)).toBe(true)
    }
    for (let i = 0; i < buttons.length + 3; i++) {
      await user.tab({ shift: true })
      expect(active.contains(document.activeElement)).toBe(true)
    }
    // Initial static heading also has a safe backwards-Tab path.
    active.querySelector('[data-modal-initial-focus]').focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
  })

  it('repairs focus attempts into the background or an underlying dialog', async () => {
    await openProperty()
    const underlayButton = buttonWithText('property', 'Détails complets').element
    await openDetails()
    outsideButton.focus()
    expectActive('dpe')
    underlayButton.focus()
    expectActive('dpe')
  })

  it('supports the raw-data dialog opened directly without a property dialog', async () => {
    const opener = wrapper.get('[data-testid="open-raw"]').element
    await click(wrapper.get('[data-testid="open-raw"]'))
    expectActive('raw')
    expect(dialog('raw').get('input').attributes('aria-label')).toContain('Filtrer')
    await click(dialog('raw').get('button[aria-label="Fermer"]'))
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('restores focus correctly when closing raw data by its backdrop', async () => {
    await openProperty()
    await openDetails()
    const opener = buttonWithText('dpe', 'Voir les données brutes').element
    await openRaw()
    await layer('raw').trigger('click')
    await settle()
    expectActive('dpe')
    expect(document.activeElement).toBe(opener)
  })

  it('does not collapse another layer on a held Escape key', async () => {
    await openProperty()
    await openDetails()
    await openRaw()
    await key('Escape')
    expectActive('dpe')
    await key('Escape', { repeat: true })
    expectActive('dpe')
    await key('Escape')
    expectActive('property')
  })

  it('clears nested raw state when DPE details are externally hidden, restoring the outer trigger', async () => {
    await openProperty()
    const opener = buttonWithText('property', 'Détails complets').element
    await openDetails()
    await openRaw()
    wrapper.vm.showDPEDetails = false
    await settle()
    expect(wrapper.find('[data-modal-layer="raw"]').exists()).toBe(false)
    expectActive('property')
    expect(document.activeElement).toBe(opener)
    await openDetails()
    expectActive('dpe')
    expect(wrapper.find('[data-modal-layer="raw"]').exists()).toBe(false)
  })

  it('supports repeated three-layer open/close cycles without stale state or duplicate events', async () => {
    const opened = vi.fn()
    const closed = vi.fn()
    window.addEventListener('modal-open', opened)
    window.addEventListener('modal-close', closed)
    try {
      for (let i = 0; i < 3; i++) {
        await openProperty()
        await openDetails()
        await openRaw()
        await key('Escape')
        await key('Escape')
        await key('Escape')
        expect(document.body.style.overflow).toBe('auto')
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      }
      expect(opened).toHaveBeenCalledTimes(3)
      expect(closed).toHaveBeenCalledTimes(3)
    } finally {
      window.removeEventListener('modal-open', opened)
      window.removeEventListener('modal-close', closed)
    }
  })

  it('restores pre-existing background attributes and overflow priority on complete close', async () => {
    background.setAttribute('inert', 'existing')
    background.setAttribute('aria-hidden', 'false')
    document.body.style.setProperty('overflow', 'scroll', 'important')
    await openProperty()
    await openDetails()
    await openRaw()
    await key('Escape')
    await key('Escape')
    await key('Escape')
    expect(background.getAttribute('inert')).toBe('existing')
    expect(background.getAttribute('aria-hidden')).toBe('false')
    expect(document.body.style.getPropertyValue('overflow')).toBe('scroll')
    expect(document.body.style.getPropertyPriority('overflow')).toBe('important')
  })

  it('unmounts the entire nested stack without leaked scroll locks, inert attributes or handlers', async () => {
    await openProperty()
    await openDetails()
    await openRaw()
    wrapper.unmount()
    wrapper = null
    await settle()
    expect(document.body.style.overflow).toBe('auto')
    expect(background.hasAttribute('inert')).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)
    const event = await key('Escape')
    expect(event.defaultPrevented).toBe(false)
  })

  it('keeps a newly opened layer focused rather than restoring a stale closing trigger', async () => {
    await openProperty()
    await openDetails()
    wrapper.vm.showDPEDetails = false
    await nextTick()
    wrapper.vm.showRawDataForResult(property)
    await settle()
    expectActive('raw')
    expect(document.activeElement.hasAttribute('data-modal-initial-focus')).toBe(true)
  })
})
