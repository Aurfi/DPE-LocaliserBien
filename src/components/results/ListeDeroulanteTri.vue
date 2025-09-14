<template>
  <div class="relative flex-1 sm:flex-initial">
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      :disabled="disabled"
      class="w-full sm:w-auto appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg px-3 py-2 pr-8 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option
        v-for="option in filteredOptions"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
      <ChevronDown class="w-4 h-4" />
    </div>
  </div>
</template>

<script>
import { ChevronDown } from 'lucide-vue-next'

export default {
  name: 'SortDropdown',
  components: {
    ChevronDown
  },
  props: {
    modelValue: {
      type: String,
      required: true
    },
    options: {
      type: Array,
      required: true,
      validator: options => {
        return options.every(opt => opt.value && opt.label)
      }
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    filteredOptions() {
      return this.options.filter(option => {
        // Si l'option a une condition, on l'évalue
        if (typeof option.condition === 'boolean') {
          return option.condition
        }
        // Si pas de condition, l'option est toujours visible
        return option.condition === undefined || option.condition === true
      })
    }
  },
  emits: ['update:modelValue']
}
</script>