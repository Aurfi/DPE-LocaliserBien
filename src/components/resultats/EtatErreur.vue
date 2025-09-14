<template>
  <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-6">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <AlertTriangle class="h-6 w-6 text-red-400 dark:text-red-500" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
          {{ title }}
        </h3>
        <div class="mt-2 text-sm text-red-700 dark:text-red-300">
          <p>{{ message }}</p>
        </div>
        <div v-if="action" class="mt-4">
          <button
            @click="action.handler"
            class="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
          >
            {{ action.label }} →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { AlertTriangle } from 'lucide-vue-next'

export default {
  name: 'EtatErreur',
  components: {
    AlertTriangle
  },
  props: {
    title: {
      type: String,
      default: 'Erreur lors de la recherche'
    },
    message: {
      type: String,
      default: 'Une erreur est survenue lors de la recherche. Veuillez réessayer.'
    },
    action: {
      type: Object,
      default: null,
      validator: value => {
        return !value || (value.label && value.handler)
      }
    }
  }
}
</script>