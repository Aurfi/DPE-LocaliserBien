import './style.css'
import { registerSW } from 'virtual:pwa-register'
import { createAppRouter, createShellApp, mountWhenReady } from './bootstrap.js'
// Imported for its side effect: attaches the beforeinstallprompt listener
// immediately, before the router resolves the first lazy route.
import './utils/pwaInstallPrompt.js'

const router = createAppRouter()
const app = createShellApp(router)
mountWhenReady(app, router)

// Register PWA service worker (vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}
