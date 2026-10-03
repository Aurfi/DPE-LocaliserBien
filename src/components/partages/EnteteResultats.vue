<template>
  <div class="border-b border-gray-200 dark:border-gray-700 pb-5 mb-6">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
            <span v-if="hiddenCount > 0" class="text-sm text-gray-500 dark:text-gray-400">({{ hiddenCount }} masqué{{ hiddenCount > 1 ? 's' : '' }})</span>
          </h2>
          <p v-if="statusText" class="text-sm mt-1" :class="statusClass">
            {{ statusText }}
          </p>
          <p v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ subtitle }}
          </p>
        </div>
        <button
          v-if="showCloseButton"
          @click="$emit('close')"
          class="btn-secondary text-sm sm:ml-4"
          title="Nouvelle recherche"
        >
          Nouvelle recherche
        </button>
      </div>

      <!-- Sorting dropdown -->
      <div v-if="showSort && sortOptions.length > 0" class="flex items-center gap-2">
        <span class="text-sm text-gray-600 dark:text-gray-400">Trier :</span>
        <ListeDeroulanteTri
          :modelValue="sortBy"
          :options="sortOptions"
          @update:modelValue="$emit('update:sortBy', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import ListeDeroulanteTri from '../resultats/ListeDeroulanteTri.vue'

export default {
  name: 'EnteteResultats',
  components: {
    ListeDeroulanteTri
  },
  props: {
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      default: null
    },
    statusText: {
      type: String,
      default: null
    },
    statusClass: {
      type: String,
      default: 'text-gray-500 dark:text-gray-400'
    },
    hiddenCount: {
      type: Number,
      default: 0
    },
    showCloseButton: {
      type: Boolean,
      default: false
    },
    showSort: {
      type: Boolean,
      default: true
    },
    sortBy: {
      type: String,
      default: 'score'
    },
    sortOptions: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'update:sortBy']
}
</script>