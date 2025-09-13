<template>
  <div
    v-if="show"
    class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
    :style="{ top: y + 'px', left: x + 'px' }"
    @click.stop
  >
    <button
      v-for="(action, index) in actions"
      :key="index"
      @click="handleAction(action)"
      class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
    >
      <component :is="action.icon" v-if="action.icon" class="w-4 h-4" />
      {{ action.label }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'ContextMenu',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    x: {
      type: Number,
      required: true
    },
    y: {
      type: Number,
      required: true
    },
    actions: {
      type: Array,
      required: true,
      validator: actions => {
        return actions.every(action => action.label && action.handler)
      }
    }
  },
  methods: {
    handleAction(action) {
      action.handler()
      this.$emit('close')
    }
  },
  emits: ['close']
}
</script>