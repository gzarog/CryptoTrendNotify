import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const pwaOptions = {
  registerType: 'prompt',
  injectRegister: 'auto',
  includeAssets: ['vite.svg', 'icons/pwa-icon.svg'],
  srcDir: 'src',
  filename: 'sw.ts',
  strategies: 'injectManifest',
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
  },
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
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA(pwaOptions as Parameters<typeof VitePWA>[0]),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    environmentMatchGlobs: [
      ['server/**/*.test.{ts,tsx}', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
