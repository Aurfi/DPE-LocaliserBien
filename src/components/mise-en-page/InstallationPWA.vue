<template>
  <button
    v-if="showButton"
    @click="install"
    :class="buttonClass"
  >
    <Download v-if="variant !== 'link'" class="w-4 h-4 mr-1.5" />
    <span>{{ label }}</span>
  </button>
</template>

<script>
import { Download } from 'lucide-vue-next'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  onInstallPromptChange
} from '../../utils/pwaInstallPrompt.js'

export default {
  name: 'InstallPWA',
  components: { Download },
  props: {
    variant: { type: String, default: 'button' } // 'button' | 'link'
  },
  data() {
    return {
      showButton: false,
      stopListening: null
    }
  },
  mounted() {
    // Show only on Android devices and when not already installed
    const ua = navigator.userAgent.toLowerCase()
    const isAndroid = ua.includes('android')
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    this.isAndroid = isAndroid
    this.isStandalone = isStandalone

    const sync = () => {
      this.showButton = Boolean(getDeferredInstallPrompt()) && isAndroid && !isStandalone
    }
    // Catches a prompt captured before this component mounted (e.g. while
    // the first lazy route was still resolving).
    sync()
    this.stopListening = onInstallPromptChange(sync)
  },
  beforeUnmount() {
    this.stopListening?.()
  },
  methods: {
    async install() {
      const deferredPrompt = getDeferredInstallPrompt()
      if (!deferredPrompt) return
      deferredPrompt.prompt()
      try {
        await deferredPrompt.userChoice
      } finally {
        clearDeferredInstallPrompt()
        this.showButton = false
      }
    }
  },
  computed: {
    buttonClass() {
      if (this.variant === 'link') {
        return 'text-xs text-blue-600 dark:text-blue-400 hover:underline bg-transparent p-0'
      }
      return 'inline-flex items-center px-3 py-2 rounded-xl bg-white/90 dark:bg-gray-800/90 border border-white/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm hover:shadow transition-colors'
    },
    label() {
      return "Installer l'app"
    }
  }
}
</script>
