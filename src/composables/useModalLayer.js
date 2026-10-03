import { nextTick, onUnmounted, ref, useId, watch } from 'vue'

const managers = new WeakMap()
const FOCUSABLE = 'a[href], button, input, select, textarea, iframe, [tabindex], [contenteditable="true"]'

function canFocus(element) {
  if (!element?.isConnected || typeof element.focus !== 'function' || element.disabled) return false
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hidden || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false
    const style = node.ownerDocument.defaultView.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

function focusInitial(layer) {
  const heading = layer.dialog.querySelector('[data-modal-initial-focus]')
  const target = canFocus(heading) ? heading : tabbableElements(layer)[0] || layer.dialog
  target.focus({ preventScroll: true })
}

function tabbableElements(layer) {
  return [...layer.dialog.querySelectorAll(FOCUSABLE)].filter(element => element.tabIndex >= 0 && canFocus(element))
}

function createManager(doc) {
  const layers = []
  const background = new Map()
  let previousOverflow = ''
  let previousOverflowPriority = ''
  let rootTrigger = null
  let revision = 0
  const top = () => layers[layers.length - 1]

  const restoreBackground = () => {
    for (const [element, saved] of background) {
      for (const [name, value] of Object.entries(saved)) {
        if (value === null) element.removeAttribute(name)
        else element.setAttribute(name, value)
      }
    }
    background.clear()
  }

  const updateLayers = () => {
    restoreBackground()
    layers.forEach((layer, index) => {
      layer.isTop.value = layer === top()
      layer.depth.value = index
    })
    const active = top()
    if (!active) return
    // Inert every sibling branch, never an ancestor of the active layer. This
    // also handles raw-data nested inside the DPE overlay without trapping it.
    for (let branch = active.root; branch && branch !== doc.body; branch = branch.parentElement) {
      for (const sibling of branch.parentElement?.children || []) {
        if (sibling === branch || ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue
        background.set(sibling, {
          inert: sibling.getAttribute('inert'),
          'aria-hidden': sibling.getAttribute('aria-hidden')
        })
        sibling.setAttribute('inert', '')
        sibling.setAttribute('aria-hidden', 'true')
      }
    }
  }

  const onKeydown = event => {
    const active = top()
    if (!active || event.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!event.repeat) active.close()
      return
    }
    if (event.key !== 'Tab') return
    const elements = tabbableElements(active)
    const focused = doc.activeElement
    if (!elements.length) {
      event.preventDefault()
      focusInitial(active)
    } else if (!elements.includes(focused)) {
      event.preventDefault()
      ;(event.shiftKey ? elements[elements.length - 1] : elements[0]).focus()
    } else if (event.shiftKey && focused === elements[0]) {
      event.preventDefault()
      elements[elements.length - 1].focus()
    } else if (!event.shiftKey && focused === elements[elements.length - 1]) {
      event.preventDefault()
      elements[0].focus()
    }
  }

  const onFocusin = event => {
    const active = top()
    if (active && !active.dialog.contains(event.target)) focusInitial(active)
  }

  const register = layer => {
    const firstLayer = layers.length === 0
    if (firstLayer) {
      rootTrigger = doc.activeElement
      previousOverflow = doc.body.style.getPropertyValue('overflow')
      previousOverflowPriority = doc.body.style.getPropertyPriority('overflow')
      doc.body.style.setProperty('overflow', 'hidden')
      doc.addEventListener('keydown', onKeydown, true)
      doc.addEventListener('focusin', onFocusin, true)
    }
    layer.trigger = doc.activeElement
    layers.push(layer)
    revision++
    // Move focus before aria-hiding the previous layer that held it.
    restoreBackground()
    focusInitial(layer)
    updateLayers()
    if (firstLayer) doc.defaultView.dispatchEvent(new CustomEvent('modal-open'))

    return () => {
      const index = layers.indexOf(layer)
      if (index === -1) return
      const wasTop = layer === top()
      const fallbackTrigger = rootTrigger
      // If an ancestor closes with a child still mounted, pass its return target
      // down before Vue removes that ancestor's trigger from the document.
      for (const child of layers.slice(index + 1)) {
        if (layer.root.contains(child.trigger)) child.trigger = layer.trigger
      }
      layers.splice(index, 1)
      layer.isTop.value = false
      const currentRevision = ++revision
      updateLayers()
      if (!layers.length) {
        if (previousOverflow) doc.body.style.setProperty('overflow', previousOverflow, previousOverflowPriority)
        else doc.body.style.removeProperty('overflow')
        doc.removeEventListener('keydown', onKeydown, true)
        doc.removeEventListener('focusin', onFocusin, true)
        rootTrigger = null
        doc.defaultView.dispatchEvent(new CustomEvent('modal-close'))
      }
      if (!wasTop) return
      // Wait for Vue to remove closing ancestors and nested dialogs. Never
      // restore focus to a disappearing trigger or steal it from a newer open.
      nextTick(() => {
        if (revision !== currentRevision) return
        const active = top()
        if (canFocus(layer.trigger) && (!active || active.dialog.contains(layer.trigger))) {
          layer.trigger.focus({ preventScroll: true })
        } else if (active) {
          focusInitial(active)
        } else if (canFocus(fallbackTrigger)) {
          fallbackTrigger.focus({ preventScroll: true })
        }
      })
    }
  }

  return { register }
}

export function useModalLayer(close) {
  const modalDialog = ref(null)
  const modalLayer = ref(null)
  const modalIsTop = ref(false)
  const modalDepth = ref(0)
  const modalTitleId = `modal-title-${useId()}`
  let release = null

  watch(
    [modalDialog, modalLayer],
    ([dialog, root]) => {
      release?.()
      release = null
      if (!dialog?.isConnected || !root) return
      const doc = dialog.ownerDocument
      if (!managers.has(doc)) managers.set(doc, createManager(doc))
      release = managers.get(doc).register({ dialog, root, close, isTop: modalIsTop, depth: modalDepth })
    },
    { flush: 'post' }
  )

  onUnmounted(() => {
    release?.()
    release = null
  })

  return { modalDialog, modalLayer, modalIsTop, modalDepth, modalTitleId }
}
