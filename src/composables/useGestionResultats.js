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
  // Each dialog owns its focus/scroll lifecycle through useModalLayer.
  const showDetails = result => {
    showDPEDetails.value = false
    selectedProperty.value = result
  }

  const closeModal = () => {
    showDPEDetails.value = false
    showRawDataModal.value = false
    rawDataProperty.value = null
    selectedProperty.value = null
  }

  const showRawDataForResult = result => {
    rawDataProperty.value = result
    showRawDataModal.value = true
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

  return {
    selectedProperty,
    showDPEDetails,
    showRawDataModal,
    rawDataProperty,
    hiddenResults,
    showDetails,
    closeModal,
    showRawDataForResult,
    hideResult
  }
}
