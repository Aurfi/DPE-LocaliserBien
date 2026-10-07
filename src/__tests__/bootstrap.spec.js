import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mountWhenReady } from '../bootstrap.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

let container

afterEach(() => {
  container?.remove()
  container = undefined
})

function createContainer() {
  container = document.createElement('div')
  container.id = 'bootstrap-test-root'
  document.body.append(container)
  return `#${container.id}`
}

const Shell = defineComponent({ template: '<div id="shell-marker">Ready</div>' })

describe('mountWhenReady', () => {
  it('does not mount the shell until the first navigation resolves', async () => {
    const home = deferred()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: () => home.promise }]
    })
    const selector = createContainer()
    const app = createApp(Shell)
    app.use(router)

    const done = mountWhenReady(app, router, selector)
    await Promise.resolve()
    await Promise.resolve()
    expect(container.querySelector('#shell-marker')).toBeNull()

    home.resolve({ template: '<p>Home</p>' })
    await done
    expect(container.querySelector('#shell-marker')).not.toBeNull()
  })

  it('mounts the shell even if the first navigation fails, instead of leaving the page blank', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: () => Promise.reject(new Error('chunk failed to load')) }]
    })
    router.onError(() => {})
    const selector = createContainer()
    const app = createApp(Shell)
    app.use(router)

    await mountWhenReady(app, router, selector)
    expect(container.querySelector('#shell-marker')).not.toBeNull()
  })

  it('mounts immediately when the router is already resolved', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<p>Home</p>' } }]
    })
    const selector = createContainer()
    const app = createApp(Shell)
    // app.use(router) is what triggers the router's initial navigation, so
    // it must happen before isReady() has anything to resolve.
    app.use(router)
    await router.isReady()

    await mountWhenReady(app, router, selector)
    expect(container.querySelector('#shell-marker')).not.toBeNull()
  })
})
