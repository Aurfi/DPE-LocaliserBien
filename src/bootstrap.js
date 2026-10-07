import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { navigationScroll } from './utils/navigationScroll.js'

// Lazy loading des vues pour réduire le bundle initial
const Home = () => import('./views/Home.vue')
const FAQ = () => import('./views/FAQ.vue')
const MentionsLegales = () => import('./views/MentionsLegales.vue')

export function createRoutes() {
  return [
    {
      path: '/',
      name: 'Home',
      component: Home,
      meta: { title: import.meta.env.VITE_APP_TITLE }
    },
    {
      path: '/informations',
      name: 'Informations',
      component: FAQ,
      meta: { title: 'Informations - Localisateur de bien immobilier' }
    },
    // Redirection de l'ancienne URL vers la nouvelle
    {
      path: '/faq',
      redirect: '/informations'
    },
    {
      path: '/mentions-legales',
      name: 'MentionsLegales',
      component: MentionsLegales,
      meta: { title: 'Mentions Légales - Localisateur de bien immobilier' }
    },
    // Page 404 - Redirection vers la page d'accueil
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
}

export function createAppRouter(history = createWebHistory()) {
  const router = createRouter({
    history,
    routes: createRoutes(),
    scrollBehavior: navigationScroll
  })

  // Mise à jour dynamique du titre de la page
  router.beforeEach((to, _from, next) => {
    document.title = to.meta.title || 'Localisateur de bien immobilier'
    next()
  })

  return router
}

export function createShellApp(router) {
  const app = createApp(App)
  app.use(router)
  return app
}

// Mount only once the first navigation has settled, so the header, footer
// and routed content always appear together in the same frame instead of
// the shell painting above an empty router-view and shifting once the
// lazy route's chunk arrives.
export async function mountWhenReady(app, router, selector = '#app') {
  try {
    await router.isReady()
  } catch {
    // The first navigation failed (e.g. a lazy chunk didn't load). Mount
    // anyway so the header/footer navigation stays usable as a way out,
    // instead of leaving the page blank forever.
  }
  app.mount(selector)
}
