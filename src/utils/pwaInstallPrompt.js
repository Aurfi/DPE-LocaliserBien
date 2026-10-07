// Captured as soon as this module is imported, independent of when any
// Vue component mounts, so a beforeinstallprompt firing before the lazy
// route resolves is never lost.
let deferredPrompt = null
const listeners = new Set()

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  deferredPrompt = e
  for (const listener of listeners) listener()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  for (const listener of listeners) listener()
})

export function getDeferredInstallPrompt() {
  return deferredPrompt
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null
}

export function onInstallPromptChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
