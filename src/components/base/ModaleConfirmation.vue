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
            <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <component :is="icon" class="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          
          <!-- Content -->
          <div class="px-6 pb-4 text-center">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ title }}
            </h3>
            <p v-if="message" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {{ message }}
            </p>
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
              @click="$emit('confirm')"
              class="flex-1 px-4 py-2.5 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
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
import { Trash2 } from 'lucide-vue-next'

export default {
  name: 'ConfirmationModal',
  components: {
    Trash2
  },
  // Ne pas envoyer d'événements de modal pour la modal de confirmation
  // car elle n'a pas besoin de masquer le pied de page
  props: {
    show: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Confirmation'
    },
    message: {
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
      default: () => 'Trash2'
    }
  },
  emits: ['confirm', 'cancel']
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