<template>
  <Transition name="fade-slide">
    <button
      v-if="showButton"
      @click="scrollToTop"
      class="fixed bottom-8 right-8 z-40 bg-white/95 dark:bg-gray-800/90 backdrop-blur-md rounded-full p-3 shadow-lg shadow-gray-900/20 dark:shadow-white/5 hover:shadow-xl transition-all duration-300 hover:scale-110 border border-gray-300 dark:border-white/20 group"
      aria-label="Retour en haut"
    >
      <ChevronUp class="w-5 h-5 text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
    </button>
  </Transition>
</template>

<script>
import { ChevronUp } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'

export default {
  name: 'ScrollToTop',
  components: {
    ChevronUp
  },
  props: {
    showAfter: {
      type: Number,
      default: 300 // Afficher le bouton après avoir défilé de 300px
    }
  },
  setup(props) {
    const showButton = ref(false)

    const handleScroll = () => {
      showButton.value = window.scrollY > props.showAfter
    }

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }

    onMounted(() => {
      window.addEventListener('scroll', handleScroll)
      handleScroll() // Vérifier la position de défilement initiale
    })

    onUnmounted(() => {
      window.removeEventListener('scroll', handleScroll)
    })

    return {
      showButton,
      scrollToTop
    }
  }
}
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}
</style>