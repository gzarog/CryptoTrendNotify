declare module 'vite-plugin-pwa' {
  import type { Plugin } from 'vite'

  export interface VitePWAOptions {
    registerType?: 'prompt' | 'autoUpdate'
    injectRegister?: 'auto' | 'script' | 'inline' | null
    includeAssets?: string[]
    manifest?: Record<string, unknown>
    workbox?: Record<string, unknown>
  }

  export function VitePWA(options?: VitePWAOptions): Plugin
}
