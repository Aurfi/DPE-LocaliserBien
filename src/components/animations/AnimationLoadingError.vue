<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
    <div class="relative flex flex-col items-center justify-center p-8">

      <!-- Container principal -->
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-gray-700 shadow-lg p-12">

        <!-- État de chargement -->
        <div v-if="state === 'loading'" class="flex flex-col items-center">
          <div class="relative w-24 h-24 mb-6">
            <!-- Chevron animé -->
            <svg class="w-full h-full animate-spin" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                class="text-gray-200 dark:text-gray-600"
              />
              <path
                d="M 50,5 A 45,45 0 0,1 95,50"
                stroke="currentColor"
                stroke-width="3"
                fill="none"
                stroke-linecap="round"
                class="text-blue-500"
              />
            </svg>
          </div>
          <p class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recherche en cours...
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Cela peut prendre quelques secondes
          </p>
        </div>

        <!-- État d'erreur -->
        <div v-else-if="state === 'error'" class="flex flex-col items-center">
          <div class="w-24 h-24 mb-6 flex items-center justify-center">
            <!-- Icône d'erreur -->
            <svg class="w-full h-full text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ errorMessage || 'Recherche interrompue' }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
            La recherche a pris trop de temps ou a rencontré une erreur
          </p>

          <!-- Bouton retour -->
          <button
            @click="$emit('return-home')"
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour à l'accueil
          </button>
        </div>

        <!-- État de résultats vides -->
        <div v-else-if="state === 'empty'" class="flex flex-col items-center">
          <div class="w-24 h-24 mb-6 flex items-center justify-center">
            <!-- Icône de recherche vide -->
            <svg class="w-full h-full text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Aucun résultat trouvé
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Essayez de modifier vos critères de recherche
          </p>

          <!-- Bouton retour -->
          <button
            @click="$emit('return-home')"
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Nouvelle recherche
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnimationLoadingError',
  props: {
    state: {
      type: String,
      default: 'loading',
      validator: value => ['loading', 'error', 'empty'].includes(value)
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  emits: ['return-home']
}
</script>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1.5s linear infinite;
}
</style>