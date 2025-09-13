<template>
  <div id="app" :class="['min-h-screen flex flex-col relative overflow-hidden', fancyUI ? 'bg-gradient-to-br from-blue-300 via-blue-200 to-purple-300 dark:from-blue-800 dark:via-blue-800 dark:to-purple-800' : 'bg-gray-50 dark:bg-gray-900']">
    <!-- Fancy background blobs for production -->
    <div v-if="fancyUI" class="absolute inset-0">
      <div :class="['absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-blue-400 to-purple-400 dark:from-blue-400 dark:to-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 dark:opacity-30', (!reducedMotion && !lowPerformance) ? 'animate-blob' : '']"></div>
      <div :class="['absolute top-40 right-32 w-96 h-96 bg-gradient-to-r from-indigo-400 to-blue-400 dark:from-indigo-400 dark:to-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 dark:opacity-30', (!reducedMotion && !lowPerformance) ? 'animate-blob animation-delay-2000' : '']"></div>
      <div :class="['absolute bottom-20 left-1/3 w-96 h-96 bg-gradient-to-r from-purple-400 to-pink-400 dark:from-purple-400 dark:to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 dark:opacity-30', (!reducedMotion && !lowPerformance) ? 'animate-blob animation-delay-4000' : '']"></div>
    </div>
    
    <!-- Overlay glassmorphism for fancy UI -->
    <div v-if="fancyUI" class="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent dark:from-black/20 dark:via-black/10 dark:to-transparent backdrop-blur-sm"></div>
    
    <!-- Simple background for GitHub version -->
    <div v-else class="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-900 dark:to-gray-800"></div>


    <!-- Contenu principal -->
    <main class="flex-1 relative z-10">
      <router-view />
    </main>

    <!-- Footer -->
    <footer v-show="!modalOpen" class="relative z-10">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 dark:border-gray-700/50 p-4 relative">
          <!-- Theme toggle - absolute positioned top right -->
          <div class="absolute top-4 right-4 bg-gray-100 dark:bg-gray-700 rounded-full p-0 flex items-center">
            <button
              @click="toggleTheme('light')"
              :class="[
                'p-1 rounded-full transition-all duration-200',
                currentTheme === 'light' ? 'bg-white shadow-sm' : currentTheme === 'auto' ? '' : 'opacity-50',
                currentTheme === 'auto' ? 'hover:bg-gray-200/50' : ''
              ]"
              aria-label="Mode clair"
            >
              <Sun class="w-4 h-4 text-yellow-500" />
            </button>
            <button
              @click="toggleTheme('dark')"
              :class="[
                'p-1 rounded-full transition-all duration-200',
                currentTheme === 'dark' ? 'bg-gray-600 shadow-sm' : currentTheme === 'auto' ? '' : 'opacity-50',
                currentTheme === 'auto' ? 'hover:bg-gray-600/50' : ''
              ]"
              aria-label="Mode sombre"
            >
              <Moon class="w-4 h-4 text-blue-400" />
            </button>
          </div>
          
          <div class="grid md:grid-cols-3 gap-6">
            
            <!-- À propos -->
            <div>
              <a @click="handleLogoClick" class="flex items-center mb-2 group cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2 transition-transform group-hover:scale-110">
            <defs>
              <linearGradient id="mapPinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#2563EB" />
                <stop offset="15%" style="stop-color:#2563EB" />
                <stop offset="85%" style="stop-color:#7C3AED" />
                <stop offset="100%" style="stop-color:#7C3AED" />
              </linearGradient>
            </defs>
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" :stroke="fancyUI ? 'url(#mapPinGradient)' : 'currentColor'" :class="!fancyUI ? 'text-blue-600 dark:text-blue-400' : ''"/>
            <path d="m9 10 2 2 4-4" :stroke="fancyUI ? 'url(#mapPinGradient)' : 'currentColor'" :class="!fancyUI ? 'text-blue-600 dark:text-blue-400' : ''"/>
          </svg>
                <h3 v-if="fancyUI" class="text-lg font-semibold">
                  <span class="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">{{ siteNameFirst }}</span><span class="ml-1 bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent">{{ siteNameSecond }}</span>
                </h3>
                <h3 v-else class="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {{ siteName }}
                </h3>
              </a>
              <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Service gratuit de localisation d'annonce immobilière
              </p>
              <div class="mt-2">
                <InstallPWA variant="link" />
              </div>
            </div>

            <!-- Navigation -->
            <div class="md:ml-auto md:mr-auto">
              <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Navigation</h3>
              <ul class="space-y-2 text-sm">
                <li>
                  <router-link to="/" class="footer-link group">
                    <span class="p-1 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors mr-2">
                      <Search class="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </span>
                    <span class="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Accueil</span>
                  </router-link>
                </li>
                <li>
                  <router-link to="/informations" class="footer-link group">
                    <span class="p-1 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors mr-2">
                      <HelpCircle class="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </span>
                    <span class="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Informations</span>
                  </router-link>
                </li>
                <li>
                  <router-link to="/mentions-legales" class="footer-link group">
                    <span class="p-1 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors mr-2">
                      <FileText class="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </span>
                    <span class="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Mentions légales</span>
                  </router-link>
                </li>
              </ul>
            </div>

            <!-- Sources -->
            <div class="md:ml-auto">
              <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Sources</h3>
              <ul class="space-y-2 text-sm">
                <li>
                  <a 
                    href="https://data.ademe.fr" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="footer-link group"
                  >
                    <span class="p-1 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors mr-2">
                      <ExternalLink class="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400" />
                    </span>
                    <span class="text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">ADEME - Données DPE</span>
                  </a>
                </li>
                <li>
                  <a 
                    href="https://geo.api.gouv.fr" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="footer-link group"
                  >
                    <span class="p-1 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors mr-2">
                      <ExternalLink class="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400" />
                    </span>
                    <span class="text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">API Géographiques</span>
                  </a>
                </li>
                <li>
                  <a 
                    href="https://data.gouv.fr" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="footer-link group"
                  >
                    <span class="p-1 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors mr-2">
                      <ExternalLink class="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400" />
                    </span>
                    <span class="text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">Open Data France</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <!-- Ligne de bas -->
          <div class="border-t border-gray-200 dark:border-gray-700 mt-4 pt-3">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between text-sm">
              <!-- GitHub Link (left-aligned) -->
              <div class="mb-4 md:mb-0 flex items-center gap-3">
                <a 
                  href="https://github.com/Aurfi/DPE-LocaliserBien" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-base text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <svg class="w-6 h-6 mr-1.5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                  <span class="font-semibold">GitHub</span>
                </a>
                <InstallPWA />
              </div>
              
              <div class="flex items-center">
                <span class="text-gray-600 dark:text-gray-400">Données mises à disposition par l'<a 
                  href="https://www.ademe.fr/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent hover:from-red-400 hover:to-red-500 transition-all animate-gradient"
                >ADEME</a></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import { ExternalLink, FileText, HelpCircle, Moon, Search, Shield, Sun } from 'lucide-vue-next'
import InstallPWA from './components/InstallPWA.vue'

export default {
  name: 'App',
  components: {
    Search,
    HelpCircle,
    FileText,
    ExternalLink,
    Shield,
    Sun,
    Moon,
    InstallPWA
  },
  data() {
    return {
      currentTheme: 'auto',
      systemPreference: 'light',
      modalOpen: false,
      reducedMotion: false,
      lowPerformance: false
    }
  },
  computed: {
    fancyUI() {
      return import.meta.env.VITE_FANCY_UI === 'true'
    },
    siteName() {
      return import.meta.env.VITE_SITE_NAME || 'DPE Locator'
    },
    siteNameFirst() {
      // Pour LocaliserBien, séparer en "Localiser" et "Bien"
      const name = this.siteName
      if (name.includes('Localiser')) {
        return 'Localiser'
      }
      // Pour les autres noms, séparer par espace ou retourner la première moitié
      const parts = name.split(' ')
      return parts[0] || name.substring(0, Math.ceil(name.length / 2))
    },
    siteNameSecond() {
      const name = this.siteName
      if (name.includes('Bien')) {
        return 'Bien'
      }
      const parts = name.split(' ')
      return parts.slice(1).join(' ') || name.substring(Math.ceil(name.length / 2))
    }
  },
  mounted() {
    // Vérifier la préférence de mouvement réduit
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Détecter GPU/appareil bas de gamme
    this.detectGPUPerformance()

    // Vérifier la préférence système
    this.systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

    // Récupérer le thème sauvegardé ou utiliser auto par défaut
    const savedTheme = localStorage.getItem('theme')
    this.currentTheme = savedTheme || 'auto'

    // Écouter les changements de thème système
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      this.systemPreference = e.matches ? 'dark' : 'light'
      if (this.currentTheme === 'auto') {
        this.applyTheme()
      }
    })

    // Écouter les événements de modal
    window.addEventListener('modal-open', () => {
      this.modalOpen = true
    })
    window.addEventListener('modal-close', () => {
      this.modalOpen = false
    })

    this.applyTheme()
  },
  methods: {
    handleLogoClick() {
      // Toujours naviguer vers l'accueil
      if (this.$route.path !== '/') {
        this.$router.push('/')
      }
      // Émettre un événement global pour réinitialiser la recherche et fermer les résultats
      window.dispatchEvent(new CustomEvent('reset-search'))
      // Faire défiler vers le haut
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    toggleTheme(theme) {
      // Si clic sur le thème actif, retourner à auto
      if (this.currentTheme === theme) {
        this.currentTheme = 'auto'
      } else {
        this.currentTheme = theme
      }

      if (this.currentTheme === 'auto') {
        localStorage.removeItem('theme')
      } else {
        localStorage.setItem('theme', this.currentTheme)
      }

      this.applyTheme()
    },
    applyTheme() {
      const effectiveTheme = this.currentTheme === 'auto' ? this.systemPreference : this.currentTheme

      if (effectiveTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },

    detectGPUPerformance() {
      // Vérifier d'abord la préférence sauvegardée
      const savedPerf = localStorage.getItem('lowPerformance')
      if (savedPerf !== null) {
        this.lowPerformance = savedPerf === 'true'
        return
      }

      // Détecter automatiquement les appareils très bas de gamme
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

      if (gl) {
        // Essayer l'approche moderne d'abord, puis utiliser l'ancienne méthode si nécessaire
        let renderer = ''
        try {
          // Essayer la nouvelle constante RENDERER si disponible
          if (gl.RENDERER) {
            renderer = gl.getParameter(gl.RENDERER).toLowerCase()
          } else {
            // Solution de repli pour les navigateurs plus anciens
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
            if (debugInfo?.UNMASKED_RENDERER_WEBGL) {
              renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase()
            }
          }
        } catch (_e) {
          // Échec silencieux si les infos WebGL ne sont pas disponibles
        }
        if (renderer) {
          // Désactiver uniquement pour les GPU très anciens ou faibles
          const veryLowEndIndicators = ['gma', 'mali-400', 'mali-450', 'adreno 2', 'adreno 3', 'powervr sgx']
          this.lowPerformance = veryLowEndIndicators.some(indicator => renderer.includes(indicator))
        }
      }

      // Vérifier seulement pour très peu de mémoire (moins de 2GB)
      if (navigator.deviceMemory && navigator.deviceMemory < 2) {
        this.lowPerformance = true
      }

      // Ne pas désactiver par défaut sur mobile - les téléphones modernes sont puissants
      // Vérifier seulement pour les très vieux navigateurs
      if (!window.requestAnimationFrame || !window.CSS || !window.CSS.supports) {
        this.lowPerformance = true
      }
    }
  }
}
</script>

<style scoped>
.container {
  max-width: 1200px;
}

/* Styles footer */
.footer-link {
  @apply flex items-center transition-all duration-200;
}

/* Animations pour les blobs */
@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

/* Animation gradient pour ADEME */
@keyframes gradient {
  0%, 100% {
    background-size: 200% 200%;
    background-position: left center;
  }
  50% {
    background-size: 200% 200%;
    background-position: right center;
  }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 3s ease infinite;
}
</style>
