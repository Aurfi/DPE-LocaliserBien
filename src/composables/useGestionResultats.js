/**
 * Composable for shared results handling logic
 */
import { ref } from 'vue'

export function useGestionResultats() {
  const selectedProperty = ref(null)
  const showDPEDetails = ref(false)
  const showRawDataModal = ref(false)
  const rawDataProperty = ref(null)
  const hiddenResults = ref(new Set())

  // Show property details modal
  const showDetails = result => {
    selectedProperty.value = result
    document.body.style.overflow = 'hidden'
  }

  // Close modal
  const closeModal = () => {
    selectedProperty.value = null
    document.body.style.overflow = ''
  }

  // Show raw data modal
  const showRawDataForResult = result => {
    rawDataProperty.value = result
    showRawDataModal.value = true
  }

  // Handle escape key
  const handleEscapeKey = event => {
    if (event.key === 'Escape' && selectedProperty.value) {
      closeModal()
    }
  }

  // Hide a result by index
  const hideResult = (index, results) => {
    if (index !== null && index >= 0) {
      // Find the original index in the unfiltered results
      const originalIndex = results.findIndex((_result, i) => {
        let count = 0
        for (let j = 0; j <= i; j++) {
          if (!hiddenResults.value.has(j)) {
            if (count === index) return true
            count++
          }
        }
        return false
      })

      if (originalIndex !== -1) {
        hiddenResults.value.add(originalIndex)
      }
    }
  }

  // Setup event listeners
  const setupEventListeners = () => {
    window.addEventListener('keydown', handleEscapeKey)
  }

  // Cleanup event listeners
  const cleanupEventListeners = () => {
    window.removeEventListener('keydown', handleEscapeKey)
    document.body.style.overflow = ''
  }

  return {
    selectedProperty,
    showDPEDetails,
    showRawDataModal,
    rawDataProperty,
    hiddenResults,
    showDetails,
    closeModal,
    showRawDataForResult,
    handleEscapeKey,
    hideResult,
    setupEventListeners,
    cleanupEventListeners
  }
}
