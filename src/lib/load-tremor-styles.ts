const STYLESHEET_CANDIDATES = [
  '@tremor/react/dist/styles.css',
  '@tremor/react/dist/tremor.css',
  '@tremor/react/dist/esm/tremor.css',
  '@tremor/react/dist/esm/styles.css',
] as const

async function loadTremorStyles(): Promise<void> {
  for (const candidate of STYLESHEET_CANDIDATES) {
    try {
      await import(candidate)
      if (import.meta.env.DEV) {
        console.debug(`[tremor] loaded styles from "${candidate}"`)
      }
      return
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[tremor] failed to load styles from "${candidate}"`, error)
      }
    }
  }

  console.error(
    '[tremor] unable to load any stylesheets. Please verify the installed @tremor/react version exposes a CSS bundle.',
  )
}

void loadTremorStyles()

