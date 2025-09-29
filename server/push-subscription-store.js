import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class PushSubscriptionStore {
  constructor(filePath = path.join(__dirname, 'data', 'push-subscriptions.json')) {
    this.filePath = filePath
    this.subscriptions = []
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true })

    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)

      if (Array.isArray(parsed)) {
        this.subscriptions = parsed
          .map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return null
            }

            if (entry.subscription && typeof entry.subscription?.endpoint === 'string') {
              return {
                subscription: entry.subscription,
                filters: entry.filters,
              }
            }

            if (typeof entry.endpoint === 'string') {
              return {
                subscription: {
                  endpoint: entry.endpoint,
                  expirationTime: entry.expirationTime ?? null,
                  keys: entry.keys,
                },
                filters: undefined,
              }
            }

            return null
          })
          .filter((entry) => entry && entry.subscription?.endpoint)
      }
    } catch (error) {
      if ((error?.code ?? '') !== 'ENOENT') {
        console.warn('Unable to load push subscription store; starting empty.', error)
      }
    }
  }

  list() {
    return this.subscriptions.map((entry) => ({
      subscription: { ...entry.subscription, keys: { ...entry.subscription.keys } },
      filters: entry.filters
        ? {
            ...entry.filters,
            symbols: entry.filters.symbols ? [...entry.filters.symbols] : undefined,
            momentumTimeframes: entry.filters.momentumTimeframes
              ? [...entry.filters.momentumTimeframes]
              : undefined,
            movingAverageTimeframes: entry.filters.movingAverageTimeframes
              ? [...entry.filters.movingAverageTimeframes]
              : undefined,
            movingAveragePairs: entry.filters.movingAveragePairs
              ? [...entry.filters.movingAveragePairs]
              : undefined,
          }
        : undefined,
    }))
  }

  async upsert(entry) {
    const endpoint = entry.subscription?.endpoint

    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      throw new Error('Invalid subscription entry: missing endpoint')
    }

    const index = this.subscriptions.findIndex(
      (existing) => existing.subscription.endpoint === endpoint,
    )

    if (index >= 0) {
      this.subscriptions[index] = entry
    } else {
      this.subscriptions.push(entry)
    }

    await this.save()
  }

  async remove(endpoint) {
    const next = this.subscriptions.filter((entry) => entry.subscription.endpoint !== endpoint)

    if (next.length === this.subscriptions.length) {
      return false
    }

    this.subscriptions = next
    await this.save()
    return true
  }

  async save() {
    await writeFile(this.filePath, JSON.stringify(this.subscriptions, null, 2))
  }
}
