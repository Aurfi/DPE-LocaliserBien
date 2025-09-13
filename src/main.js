import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'

// Lazy loading des vues pour réduire le bundle initial
const Home = () => import('./views/Home.vue')
const FAQ = () => import('./views/FAQ.vue')
const MentionsLegales = () => import('./views/MentionsLegales.vue')

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: "Localisateur de bien immobilier - Trouvez l'adresse d'un bien" }
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

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    // Toujours scroller en haut lors de la navigation
    if (savedPosition) {
      return savedPosition
    } else {
      // Force le scroll même pour la navigation interne
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ top: 0, behavior: 'smooth' })
        }, 0)
      })
    }
  }
})

// Mise à jour dynamique du titre de la page
router.beforeEach((to, _from, next) => {
  document.title = to.meta.title || 'Localisateur de bien immobilier'
  next()
})

const app = createApp(App)
app.use(router)
app.mount('#app')

// Register PWA service worker (vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}
