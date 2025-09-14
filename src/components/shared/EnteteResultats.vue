<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm px-5 py-4 mb-6">
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
          class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors sm:ml-4"
          title="Fermer"
        >
          <X class="w-6 h-6" />
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
import { X } from 'lucide-vue-next'
import ListeDeroulanteTri from '../results/ListeDeroulanteTri.vue'

export default {
  name: 'EnteteResultats',
  components: {
    X,
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