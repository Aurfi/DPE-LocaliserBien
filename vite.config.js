import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Custom plugin to process template files
  const processTemplates = () => ({
    name: 'process-templates',
    buildStart() {
      // Process sitemap.xml.template
      const sitemapTemplate = fs.readFileSync(path.resolve('public/sitemap.xml.template'), 'utf-8')
      const sitemapContent = sitemapTemplate.replace(/{{SITE_URL}}/g, env.VITE_SITE_URL || 'https://example.com')
      fs.writeFileSync(path.resolve('public/sitemap.xml'), sitemapContent)

      // Process robots.txt.template
      const robotsTemplate = fs.readFileSync(path.resolve('public/robots.txt.template'), 'utf-8')
      const robotsContent = robotsTemplate
        .replace(/{{SITE_URL}}/g, env.VITE_SITE_URL || 'https://example.com')
        .replace(/{{SITE_NAME}}/g, env.VITE_SITE_NAME || 'DPE Property Locator')
      fs.writeFileSync(path.resolve('public/robots.txt'), robotsContent)
    }
  })

  return {
    plugins: [
      vue(),
      processTemplates(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            ...env
          }
        }
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 3000,
      host: true,
      headers: {
        // Security headers for development
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        // Basic CSP for development
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://geo.api.gouv.fr https://api-adresse.data.gouv.fr https://data.ademe.fr https://www.data.gouv.fr https://nominatim.openstreetmap.org https://photon.komoot.io; frame-src 'self' https://maps.google.com https://www.google.com;"
      }
    },
    build: {
      target: 'es2015',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router'],
            'ui-vendor': ['@headlessui/vue', 'lucide-vue-next']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', '@headlessui/vue', 'lucide-vue-next']
    }
  }
})
