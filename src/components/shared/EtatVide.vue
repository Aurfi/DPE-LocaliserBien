<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center">
    <div class="mb-4">
      <div class="bg-gray-100 dark:bg-gray-700 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
        <component
          :is="icon"
          class="w-10 h-10 text-gray-500 dark:text-gray-400"
        />
      </div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {{ title }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400" v-if="description">
        {{ description }}
      </p>
    </div>
    <div v-if="action" class="mt-4">
      <button
        @click="action.handler"
        class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
      >
        {{ action.label }} →
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EtatVide',
  props: {
    icon: {
      type: [Object, Function],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: null
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