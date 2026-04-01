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
  let previouslyFocusedElement = null

  // Show property details modal
  const showDetails = result => {
    previouslyFocusedElement = document.activeElement
    selectedProperty.value = result
    document.body.style.overflow = 'hidden'
    // Move focus to the modal on next tick
    requestAnimationFrame(() => {
      const modal = document.querySelector('[role="dialog"]')
      if (modal) {
        const firstFocusable = modal.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (firstFocusable) firstFocusable.focus()
        else modal.focus()
      }
    })
  }

  // Close modal
  const closeModal = () => {
    selectedProperty.value = null
    document.body.style.overflow = ''
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus()
      previouslyFocusedElement = null
    }
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

  // Focus trap for modal
  const handleFocusTrap = event => {
    if (event.key !== 'Tab' || !selectedProperty.value) return
    const modal = document.querySelector('[role="dialog"]')
    if (!modal) return
    const focusableEls = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusableEls.length === 0) return
    const firstEl = focusableEls[0]
    const lastEl = focusableEls[focusableEls.length - 1]
    if (event.shiftKey) {
      if (document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      }
    } else {
      if (document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
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
    window.addEventListener('keydown', handleFocusTrap)
  }

  // Cleanup event listeners
  const cleanupEventListeners = () => {
    window.removeEventListener('keydown', handleEscapeKey)
    window.removeEventListener('keydown', handleFocusTrap)
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
