import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { guideSitemapEntries, staticGuides } from './scripts/guides/generate.mjs'
import { htmlEnvironmentDefines } from './scripts/html/environment.mjs'
import { assertNoBuildToolRuntimeModules, runtimeModuleGraph } from './scripts/security/runtime-module-policy.mjs'

const dependencyPolicy = JSON.parse(fs.readFileSync(new URL('./security-policy.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Plugin personnalisé pour traiter les fichiers de modèles
  const processTemplates = () => ({
    name: 'process-templates',
    buildStart() {
      // Traiter sitemap.xml.template
      const sitemapTemplate = fs.readFileSync(path.resolve('public/sitemap.xml.template'), 'utf-8')
      const sitemapContent = sitemapTemplate
        .replace(/{{SITE_URL}}/g, env.VITE_SITE_URL || 'https://example.com')
        .replace('{{GUIDE_URLS}}', guideSitemapEntries(env.VITE_SITE_URL))
      fs.writeFileSync(path.resolve('public/sitemap.xml'), sitemapContent)

      // Traiter robots.txt.template
      const robotsTemplate = fs.readFileSync(path.resolve('public/robots.txt.template'), 'utf-8')
      const robotsContent = robotsTemplate
        .replace(/{{SITE_URL}}/g, env.VITE_SITE_URL || 'https://example.com')
        .replace(/{{SITE_NAME}}/g, env.VITE_SITE_NAME || 'DPE Property Locator')
      fs.writeFileSync(path.resolve('public/robots.txt'), robotsContent)
    }
  })

  return {
    // Geography indexes are default imports. Avoid tens of thousands of unused
    // named exports and parse their compact payload only when the module loads.
    json: { namedExports: false, stringify: true },
    // Native %VITE_HTML_*% placeholders use separately escaped HTML/JSON values.
    define: htmlEnvironmentDefines(env),
    plugins: [
      vue(),
      staticGuides(env),
      {
        name: 'dependency-runtime-boundary',
        apply: 'build',
        generateBundle(_options, bundle) {
          assertNoBuildToolRuntimeModules(bundle, dependencyPolicy)
          fs.mkdirSync('reports/security', { recursive: true })
          fs.writeFileSync(
            'reports/security/runtime-module-graph.json',
            `${JSON.stringify(runtimeModuleGraph(bundle, process.cwd()), null, 2)}\n`
          )
        }
      },
      processTemplates(),
      // Opt-in developer report, kept outside the public build and PWA cache.
      ...(process.env.ANALYZE === 'true'
        ? [visualizer({ filename: 'reports/bundle-stats.html', open: false, gzipSize: true, brotliSize: true })]
        : []),
      // PWA: installable app without offline caching (runtime caching disabled)
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
          name: env.VITE_SITE_NAME || 'LocaliserBien',
          short_name: env.VITE_SITE_NAME || 'LocaliserBien',
          description:
            'Recherchez gratuitement des correspondances possibles dans les données DPE publiques en France.',
          lang: 'fr-FR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#f7f8fa',
          background_color: '#f7f8fa',
          icons: [
            { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          runtimeCaching: [],
          globIgnores: [
            '**/stats.html',
            '**/bundle-stats.html',
            '**/commune-name-departments.json-*.js',
            'guides/**',
            'documentation/**',
            'assets/guides-*.css'
          ],
          navigateFallbackAllowlist: [/^\/(?:(?:informations|mentions-legales|faq)\/?)?(?:\?.*)?$/]
        },
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'apple-touch-icon.png',
          'android-chrome-192x192.png',
          'android-chrome-512x512.png'
        ]
        // The plugin generates this manifest.webmanifest; no separate manifest.json.
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: Number(env.VITE_DEV_PORT || 3000),
      // Expose beyond loopback only with an explicit CLI --host argument.
      host: '127.0.0.1',
      headers: {
        // En-têtes de sécurité pour le développement (relaxés pour Vite)
        // Note: ne pas forcer nosniff en dev pour éviter les erreurs de type MIME avec les modules
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        // CSP basique pour le développement
        'Content-Security-Policy':
          "default-src 'self'; worker-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://data.geopf.fr https://data.ademe.fr https://www.data.gouv.fr ws:; frame-src 'self' https://maps.google.com https://www.google.com;"
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
          manualChunks: id => {
            // Vue core libraries
            if (id.includes('vue') && !id.includes('lucide-vue')) {
              return 'vue-vendor'
            }
            // UI libraries
            if (id.includes('@headlessui/vue') || id.includes('lucide-vue-next')) {
              return 'ui-vendor'
            }
            // Animation components (split separately)
            if (id.includes('AnimationTriangulation')) {
              return 'animation'
            }
            // Modal components (split separately)
            if (id.includes('ModaleProprietee') || id.includes('ModaleEntree')) {
              return 'modals'
            }
            // Search and results components
            if (id.includes('ResultatsLocaliserDpe') || id.includes('ResultatsDpeRecents')) {
              return 'search-results'
            }
          },
          chunkFileNames: chunkInfo => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk'
            return `assets/${facadeModuleId}-[hash].js`
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
