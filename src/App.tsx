import { useEffect, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const features = [
  {
    title: 'Installable experience',
    description:
      'Add CryptoTrendNotify to your desktop or mobile home screen with a single tap and keep market momentum at your fingertips.',
  },
  {
    title: 'Offline ready',
    description:
      'Workbox-powered precaching keeps the shell of the app ready to load instantly, even when your connection drops.',
  },
  {
    title: 'Smart runtime caching',
    description:
      'Fresh market data is cached as you browse, giving you resilient performance without sacrificing the latest insights.',
  },
]

const roadmap = [
  'Real-time alerts for your watchlists',
  'Personalised momentum-based dashboards',
  'Cross-device sync for your notification settings',
]

function App() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [showOfflineReadyBanner, setShowOfflineReadyBanner] = useState(false)

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setShowUpdateBanner(true)
    },
    onOfflineReady() {
      setShowOfflineReadyBanner(true)
    },
  })

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const canInstall = useMemo(() => !!installPromptEvent, [installPromptEvent])

  const handleInstall = async () => {
    if (!installPromptEvent) return

    setIsInstalling(true)
    try {
      await installPromptEvent.prompt()
      await installPromptEvent.userChoice
    } finally {
      setIsInstalling(false)
      setInstallPromptEvent(null)
    }
  }

  const handleUpdate = async () => {
    if (updateServiceWorker) {
      await updateServiceWorker(true)
    }
    setShowUpdateBanner(false)
  }

  const checkForUpdates = async () => {
    if (updateServiceWorker) {
      await updateServiceWorker()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-white">CryptoTrendNotify</span>
          <div className="flex items-center gap-3">
            {canInstall && (
              <button
                type="button"
                onClick={handleInstall}
                disabled={isInstalling}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-75"
              >
                <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-white/70" aria-hidden="true" />
                {isInstalling ? 'Installing…' : 'Install app'}
              </button>
            )}
            <a
              href="#learn-more"
              className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-indigo-400 hover:text-white sm:inline-flex"
            >
              Learn more
            </a>
          </div>
        </div>
        {showUpdateBanner && (
          <div className="border-t border-indigo-500/40 bg-indigo-500/10">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-3 text-sm text-indigo-100">
              <span className="font-medium">A new version is ready to install.</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpdateBanner(false)}
                  className="rounded-full border border-indigo-400/60 px-3 py-1 font-medium text-indigo-100 transition hover:border-indigo-300 hover:text-white"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="rounded-full bg-indigo-500 px-3 py-1 font-semibold text-white shadow transition hover:bg-indigo-400"
                >
                  Update now
                </button>
              </div>
            </div>
          </div>
        )}
        {showOfflineReadyBanner && (
          <div className="border-t border-emerald-500/40 bg-emerald-500/10">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3 text-sm text-emerald-100">
              <span className="font-medium">CryptoTrendNotify is ready to work offline.</span>
              <button
                type="button"
                onClick={() => setShowOfflineReadyBanner(false)}
                className="rounded-full border border-emerald-400/60 px-3 py-1 font-medium text-emerald-100 transition hover:border-emerald-300 hover:text-white"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-12">
        <section className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-6">
            <div>
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-200">
                Progressive Web App starter
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Launch CryptoTrendNotify with installability baked in.
            </h1>
            <p className="max-w-xl text-base text-slate-300">
              This starter provides a modern Vite + React + TypeScript foundation enhanced with Tailwind styling and a fully
              configured Workbox service worker. Ship a lightning-fast crypto trends dashboard that keeps working even when
              your signal fades.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={checkForUpdates}
                disabled={!updateServiceWorker}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-white shadow transition hover:border-indigo-400 hover:text-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Check for updates
              </button>
              {canInstall && (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isInstalling ? 'Installing…' : 'Install to device'}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 rounded-3xl border border-white/5 bg-white/5 p-6 shadow-xl shadow-indigo-500/10">
            <h2 className="mb-4 text-lg font-semibold text-white">PWA highlights</h2>
            <ul className="space-y-4 text-sm text-slate-200">
              {features.map((feature) => (
                <li key={feature.title} className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
                  <p className="text-base font-semibold text-white">{feature.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="learn-more" className="grid gap-8 rounded-3xl border border-white/5 bg-slate-900/50 p-8 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Offline-first foundations</h2>
            <p className="text-sm text-slate-300">
              The service worker is configured to precache the core shell and leverage runtime caching strategies tailored for
              API data, static assets, and imagery. Vite&apos;s plugin ecosystem and Workbox deliver a production-ready setup with
              minimal ceremony.
            </p>
            <p className="text-sm text-slate-300">
              Use this project as your baseline to iterate on CryptoTrendNotify&apos;s unique insights while keeping the platform fast,
              resilient, and installable across devices.
            </p>
          </div>
          <div className="space-y-4 rounded-2xl border border-white/5 bg-slate-950/70 p-6">
            <h3 className="text-lg font-semibold text-white">Next up on the roadmap</h3>
            <ul className="space-y-3 text-sm text-slate-200">
              {roadmap.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-indigo-400" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-4 px-6 py-6 text-xs text-slate-400 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} CryptoTrendNotify. Built with Vite, React, Tailwind, and Workbox.</p>
          <p>Ready for install, offline use, and future crypto trend insights.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
