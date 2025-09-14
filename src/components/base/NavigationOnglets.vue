<template>
  <div class="flex justify-center mb-8">
    <div class="inline-flex bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl p-2 shadow-xl border border-white/50 dark:border-gray-700/50">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('tab-change', tab.id)"
        :class="[
          'px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center',
          activeTab === tab.id
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        ]"
      >
        <component :is="tab.icon" class="w-5 h-5 mr-2" />
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>

<script>
import { FileText, MapPin } from 'lucide-vue-next'

export default {
  name: 'TabNavigation',
  props: {
    activeTab: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      tabs: [
        { id: 'locate', label: 'Trouver un bien', icon: MapPin },
        { id: 'recent', label: 'Biens à proximité', icon: FileText }
      ]
    }
  }
}
</script>