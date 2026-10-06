import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'

let wrapper
let themeColor

afterEach(() => {
  wrapper?.unmount()
  themeColor?.remove()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
})

async function mountResolvedShell(path = '/') {
  const page = { template: '<h1>Ready</h1>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/informations', '/mentions-legales'].map(path => ({ path, component: page }))
  })
  await router.push(path)
  await router.isReady()
  themeColor = document.createElement('meta')
  themeColor.name = 'theme-color'
  document.head.append(themeColor)
  wrapper = mount(App, {
    global: { plugins: [router], stubs: { InstallationPWA: true, PreferenceHistorique: true } }
  })
  return router
}

describe('resolved application shell', () => {
  it('applies a saved theme, updates it through the select, and follows the system only in automatic mode', async () => {
    localStorage.getItem.mockImplementation(key => (key === 'theme' ? 'dark' : null))
    await mountResolvedShell()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(themeColor.content).toBe('#111827')
    const select = wrapper.get('#theme-choice')
    expect(select.element.value).toBe('dark')
    await select.setValue('light')
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    wrapper.vm.handleSystemTheme({ matches: true })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    await select.setValue('auto')
    expect(localStorage.removeItem).toHaveBeenCalledWith('theme')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    wrapper.vm.handleSystemTheme({ matches: false })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(themeColor.content).toBe('#f7f8fa')
  })

  it('returns home through the wordmark and resets the search even when already home', async () => {
    const router = await mountResolvedShell('/informations')
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const reset = vi.fn()
    window.addEventListener('reset-search', reset)
    try {
      await wrapper.get('.site-wordmark').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/')
      expect(reset).toHaveBeenCalledOnce()
      await wrapper.get('.site-wordmark').trigger('click')
      expect(reset).toHaveBeenCalledTimes(2)
      expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    } finally {
      window.removeEventListener('reset-search', reset)
    }
  })

  it('keeps accessible navigation and restores the same footer after modal dismissal', async () => {
    const router = await mountResolvedShell()
    const footer = wrapper.get('.site-footer').element
    expect(wrapper.get('main').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('.site-footer nav').attributes('aria-label')).toBe('Informations du site')
    window.dispatchEvent(new Event('modal-open'))
    await flushPromises()
    expect(footer.style.display).toBe('none')
    window.dispatchEvent(new Event('modal-close'))
    await flushPromises()
    expect(footer.style.display).not.toBe('none')
    await wrapper.get('.site-header .quiet-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/informations')
    expect(wrapper.get('.site-footer').element).toBe(footer)
  })
})
