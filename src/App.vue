<template>
  <div class="site-shell min-h-screen flex flex-col">
    <header class="site-header">
      <div class="site-width flex items-center justify-between gap-4">
        <a href="/" @click.prevent="handleLogoClick" class="site-wordmark">{{ siteName }}</a>
        <router-link to="/informations" class="quiet-link">Guide et informations</router-link>
      </div>
    </header>
    <main id="contenu-principal" class="flex-1" tabindex="-1"><router-view /></main>
    <!-- main.js only mounts this app once the first navigation has settled
         (see mountWhenReady in bootstrap.js), so this never paints above an
         empty router-view. -->
    <footer v-show="!modalOpen" class="site-footer">
      <div class="site-width">
        <div class="footer-grid">
          <div>
            <p class="font-semibold text-gray-900 dark:text-gray-100">{{ siteName }}</p>
            <p class="mt-2 max-w-xs text-sm text-gray-600 dark:text-gray-400">Service de localisation d'annonce immobilière</p>
            <div class="mt-3"><InstallationPWA variant="link" /></div>
          </div>
          <nav aria-label="Informations du site" class="footer-links">
            <router-link to="/">Accueil</router-link>
            <router-link to="/informations">Informations</router-link>
            <a href="/guides/">Guides</a>
            <router-link to="/mentions-legales">Mentions légales</router-link>
          </nav>
          <div>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sources publiques</p>
            <div class="footer-links">
              <a href="https://data.ademe.fr" target="_blank" rel="noopener noreferrer">data.ademe.fr</a>
              <a href="https://data.gouv.fr" target="_blank" rel="noopener noreferrer">data.gouv.fr</a>
              <a href="https://geoservices.ign.fr/" target="_blank" rel="noopener noreferrer">IGN Géoservices</a>
            </div>
          </div>
        </div>
        <PreferenceHistorique />
        <div class="footer-bottom">
          <p>Données mises à disposition par l'<a href="https://www.ademe.fr/" target="_blank" rel="noopener noreferrer" class="quiet-link">ADEME</a></p>
          <div class="flex items-center gap-3">
            <label for="theme-choice">Affichage</label>
            <select id="theme-choice" v-model="currentTheme" @change="saveTheme" class="theme-choice">
              <option value="auto">Système</option><option value="light">Clair</option><option value="dark">Sombre</option>
            </select>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import InstallationPWA from './components/mise-en-page/InstallationPWA.vue'
import PreferenceHistorique from './components/mise-en-page/PreferenceHistorique.vue'

export default {
  name: 'App',
  components: { InstallationPWA, PreferenceHistorique },
  data() {
    return { currentTheme: 'auto', systemPreference: 'light', modalOpen: false, themeQuery: null }
  },
  computed: {
    siteName() {
      return import.meta.env.VITE_SITE_NAME || 'LocaliserBien'
    }
  },
  mounted() {
    this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.systemPreference = this.themeQuery.matches ? 'dark' : 'light'
    const savedTheme = localStorage.getItem('theme')
    this.currentTheme = ['light', 'dark'].includes(savedTheme) ? savedTheme : 'auto'
    this.themeQuery.addEventListener('change', this.handleSystemTheme)
    window.addEventListener('modal-open', this.handleModalOpen)
    window.addEventListener('modal-close', this.handleModalClose)
    this.applyTheme()
  },
  beforeUnmount() {
    this.themeQuery?.removeEventListener('change', this.handleSystemTheme)
    window.removeEventListener('modal-open', this.handleModalOpen)
    window.removeEventListener('modal-close', this.handleModalClose)
  },
  methods: {
    handleLogoClick() {
      if (this.$route.path !== '/') this.$router.push('/')
      window.dispatchEvent(new CustomEvent('reset-search'))
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    handleModalOpen() {
      this.modalOpen = true
    },
    handleModalClose() {
      this.modalOpen = false
    },
    handleSystemTheme(event) {
      this.systemPreference = event.matches ? 'dark' : 'light'
      if (this.currentTheme === 'auto') this.applyTheme()
    },
    saveTheme() {
      if (this.currentTheme === 'auto') localStorage.removeItem('theme')
      else localStorage.setItem('theme', this.currentTheme)
      this.applyTheme()
    },
    applyTheme() {
      const dark = (this.currentTheme === 'auto' ? this.systemPreference : this.currentTheme) === 'dark'
      document.documentElement.classList.toggle('dark', dark)
      const themeColorMeta = document.querySelector('meta[name="theme-color"]')
      if (themeColorMeta) themeColorMeta.content = dark ? '#111827' : '#f7f8fa'
    }
  }
}
</script>
