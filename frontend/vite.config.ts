import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Load env so we can use VITE_API_URL in the config itself
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_URL || 'http://localhost:8000/api/v1'
  // Build an escaped regex string that matches the API base URL
  const apiUrlPattern = new RegExp(`^${apiBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

  return {
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*'],
        manifest: {
          name: 'AI Student Companion',
          short_name: 'StudentAI',
          description: 'Your intelligent study assistant, planner & learning companion',
          start_url: '/',
          scope: '/',
          id: '/',
          theme_color: '#faf7f2',
          background_color: '#faf7f2',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait-primary',
          categories: ['education', 'productivity'],
          icons: [
            {
              src: '/icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png'
            },
            {
              src: '/icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png'
            },
            {
              src: '/icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png'
            },
            {
              src: '/icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png'
            },
            {
              src: '/icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png'
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Dashboard',
              short_name: 'Dashboard',
              description: 'View your study dashboard',
              url: '/dashboard',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'AI Chat Assistant',
              short_name: 'AI Chat',
              description: 'Ask AI study questions',
              url: '/chat',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'Study Planner',
              short_name: 'Planner',
              description: 'Manage your study schedule',
              url: '/planner',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'Quiz Generator',
              short_name: 'Quizzes',
              description: 'Practice smart quizzes',
              url: '/quizzes',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
            }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
          runtimeCaching: [
            {
              // Cache API GET requests for offline use — URL driven from env
              urlPattern: apiUrlPattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                },
                networkTimeoutSeconds: 5
              }
            }
          ]
        }
      })
    ]
  }
})
