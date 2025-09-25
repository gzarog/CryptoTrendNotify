import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

type RuntimeRouteContext = { request: { destination?: string | null } }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['vite.svg', 'icons/pwa-icon.svg'],
      manifest: {
        name: 'CryptoTrendNotify',
        short_name: 'TrendNotify',
        description: 'Installable crypto trend insights with offline-ready performance.',
        theme_color: '#020617',
        background_color: '#020617',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        icons: [
          {
            src: 'icons/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }: RuntimeRouteContext) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: ({ request }: RuntimeRouteContext) =>
              ['style', 'script', 'worker'].includes(request.destination ?? ''),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'asset-cache',
            },
          },
          {
            urlPattern: ({ request }: RuntimeRouteContext) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.coingecko\.com\//,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'market-data-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 10,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
