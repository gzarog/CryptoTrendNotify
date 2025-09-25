declare module 'virtual:pwa-register/react' {
  export interface UseRegisterSWOptions {
    immediate?: boolean
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
  }

  export function useRegisterSW(options?: UseRegisterSWOptions): {
    needRefresh: boolean
    offlineReady: boolean
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
}
