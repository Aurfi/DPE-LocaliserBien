<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
          @click="$emit('cancel')"
        ></div>
        
        <!-- Modal -->
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
          <!-- Icon -->
          <div class="pt-6 pb-2 flex justify-center">
            <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <component :is="icon" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <!-- Content -->
          <div class="px-6 pb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
              {{ title }}
            </h3>
            <p v-if="message" class="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
              {{ message }}
            </p>
            
            <!-- Input field -->
            <div class="mt-4">
              <input
                ref="inputField"
                v-model="inputValue"
                :placeholder="placeholder"
                @keyup.enter="handleConfirm"
                @keyup.esc="$emit('cancel')"
                class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>
          
          <!-- Actions -->
          <div class="px-6 pb-6 flex gap-3">
            <button
              @click="$emit('cancel')"
              class="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
            >
              {{ cancelText }}
            </button>
            <button
              @click="handleConfirm"
              class="flex-1 px-4 py-2.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { Edit2 } from 'lucide-vue-next'

export default {
  name: 'InputModal',
  components: {
    Edit2
  },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Renommer'
    },
    message: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Entrez un nouveau nom'
    },
    initialValue: {
      type: String,
      default: ''
    },
    confirmText: {
      type: String,
      default: 'Confirmer'
    },
    cancelText: {
      type: String,
      default: 'Annuler'
    },
    icon: {
      type: [Object, String, Function],
      default: () => 'Edit2'
    }
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      inputValue: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.inputValue = this.initialValue
        this.$nextTick(() => {
          this.$refs.inputField?.focus()
          this.$refs.inputField?.select()
        })
      }
    }
  },
  methods: {
    handleConfirm() {
      this.$emit('confirm', this.inputValue)
    }
  }
}
</script>

<style scoped>
/* Modal animations */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95) translateY(10px);
}
</style>