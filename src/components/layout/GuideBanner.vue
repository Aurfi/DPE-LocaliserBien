<template>
  <Transition
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="showBanner"
      class="fixed bottom-0 left-0 right-0 z-[1000] p-3 sm:p-4"
    >
      <div class="max-w-6xl mx-auto">
        <div class="bg-blue-500/95 dark:bg-blue-600/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 sm:p-5 border border-blue-400/50 dark:border-blue-500/50">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 flex-1">
              <!-- Icône d'aide -->
              <div class="hidden sm:flex items-center justify-center w-10 h-10 bg-white/20 rounded-xl">
                <Lightbulb class="w-6 h-6 text-white" />
              </div>
              
              <div class="flex-1">
                <p class="text-white font-medium text-sm sm:text-base">
                  Première visite ? 
                  <span class="hidden sm:inline">Découvrez comment Localiser un Bien en quelques clics.</span>
                </p>
                <p class="text-white/90 text-xs sm:text-sm mt-0.5 sm:hidden">
                  Découvrez notre guide rapide
                </p>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <!-- Bouton Guide -->
              <router-link
                to="/informations"
                @click="handleGuideClick"
                class="bg-white text-blue-600 hover:bg-blue-50 font-medium px-4 py-2 rounded-xl transition-all hover:scale-105 hover:shadow-lg text-sm sm:text-base whitespace-nowrap"
              >
                <span class="hidden sm:inline">Voir le guide</span>
                <span class="sm:hidden">Guide</span>
              </router-link>
              
              <!-- Bouton Fermer -->
              <button
                @click="dismissBanner"
                class="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                aria-label="Fermer"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { Lightbulb, X } from 'lucide-vue-next'

export default {
  name: 'GuideBanner',
  components: {
    Lightbulb,
    X
  },
  data() {
    return {
      showBanner: false
    }
  },
  mounted() {
    this.checkBannerStatus()
  },
  methods: {
    checkBannerStatus() {
      // Vérifier si la bannière a été fermée
      const bannerDismissed = localStorage.getItem('guideBannerDismissed')

      if (!bannerDismissed) {
        // Afficher la bannière après un court délai pour une meilleure UX
        setTimeout(() => {
          this.showBanner = true
        }, 2000)
      } else {
        // Vérifier si la date d'expiration est dépassée (6 mois)
        const dismissedDate = new Date(bannerDismissed)
        const now = new Date()
        const sixMonthsInMs = 180 * 24 * 60 * 60 * 1000

        if (now - dismissedDate > sixMonthsInMs) {
          // Réafficher la bannière si plus de 6 mois
          localStorage.removeItem('guideBannerDismissed')
          setTimeout(() => {
            this.showBanner = true
          }, 2000)
        }
      }
    },

    dismissBanner() {
      this.showBanner = false
      // Sauvegarder la date de fermeture
      localStorage.setItem('guideBannerDismissed', new Date().toISOString())
    },

    handleGuideClick() {
      // Fermer la bannière quand on clique sur le guide
      this.dismissBanner()
    }
  }
}
</script>