import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'

// App.vue no longer waits on route state to show its footer: main.js
// (mountWhenReady in bootstrap.js) only mounts this component once the
// first navigation has settled, so by the time App exists, CLS is already
// avoided. These tests cover what's left at the component level: the
// footer and its navigation are always present, including while a route
// is still pending or has failed to load.

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

const Home = { template: '<h1>Home ready</h1>' }
const Information = { template: '<h1>Information ready</h1>' }
let wrapper

afterEach(() => wrapper?.unmount())

function start(path = '/') {
  const home = deferred()
  const information = deferred()
  const homeLoader = vi.fn(() => home.promise)
  const errors = vi.fn()
  const history = createMemoryHistory()
  history.replace(path)
  const router = createRouter({
    history,
    routes: [
      { path: '/', component: homeLoader },
      { path: '/informations', component: () => information.promise },
      { path: '/faq', redirect: '/informations' },
      { path: '/mentions-legales', component: Information },
      { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
  })
  router.onError(errors)
  wrapper = mount(App, {
    global: { plugins: [router], stubs: { InstallationPWA: true, PreferenceHistorique: true } }
  })
  return { home, information, homeLoader, router, errors }
}

describe('App shell independent of route state', () => {
  it.each(['/', '/informations', '/faq', '/unknown'])(
    'renders the footer and its navigation before the first route resolves, at %s',
    async path => {
      const { home, information, router } = start(path)
      await flushPromises()
      expect(wrapper.get('.site-header').isVisible()).toBe(true)
      expect(wrapper.find('main h1').exists()).toBe(false)
      expect(wrapper.get('.site-footer').isVisible()).toBe(true)
      expect(wrapper.get('.site-footer nav').attributes('aria-label')).toBe('Informations du site')
      expect(wrapper.get('.site-footer a').attributes('href')).toBe('/')
      home.resolve(Home)
      information.resolve(Information)
      await router.isReady()
      await flushPromises()
      expect(wrapper.get('main h1').isVisible()).toBe(true)
      expect(wrapper.get('.site-footer').isVisible()).toBe(true)
    }
  )

  it('preserves the resolved page and footer during later navigation, cached return and Back', async () => {
    const { home, information, homeLoader, router } = start()
    home.resolve(Home)
    await router.isReady()
    await flushPromises()
    const footer = wrapper.get('.site-footer').element
    const navigation = router.push('/informations')
    await flushPromises()
    expect(wrapper.get('main h1').text()).toBe('Home ready')
    expect(wrapper.get('.site-footer').element).toBe(footer)
    information.resolve(Information)
    await navigation
    await flushPromises()
    expect(wrapper.get('main h1').text()).toBe('Information ready')
    await router.push('/')
    await flushPromises()
    expect(wrapper.get('main h1').text()).toBe('Home ready')
    expect(homeLoader).toHaveBeenCalledOnce()
    router.back()
    await flushPromises()
    expect(wrapper.get('main h1').text()).toBe('Information ready')
    expect(wrapper.get('.site-footer').element).toBe(footer)
    window.dispatchEvent(new Event('modal-open'))
    await flushPromises()
    expect(wrapper.vm.modalOpen).toBe(true)
    expect(wrapper.get('.site-footer').element.style.display).toBe('none')
    window.dispatchEvent(new Event('modal-close'))
    await flushPromises()
    expect(wrapper.get('.site-footer').isVisible()).toBe(true)
  })

  it('keeps the header and footer usable if the first route fails, and renders a later successful navigation', async () => {
    const { home, information, router, errors } = start()
    await flushPromises()
    const failure = new Error('Synthetic route failure')
    home.reject(failure)
    await flushPromises()
    expect(errors).toHaveBeenCalledWith(failure, expect.anything(), expect.anything())
    expect(wrapper.get('.site-footer').isVisible()).toBe(true)
    expect(wrapper.find('main h1').exists()).toBe(false)
    information.resolve(Information)
    await wrapper.get('.site-header .quiet-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/informations')
    expect(wrapper.get('main h1').text()).toBe('Information ready')
    expect(wrapper.get('.site-footer').isVisible()).toBe(true)
  })
})
