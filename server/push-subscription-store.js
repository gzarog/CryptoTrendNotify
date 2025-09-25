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
        this.subscriptions = parsed.filter((entry) => typeof entry?.endpoint === 'string')
      }
    } catch (error) {
      if ((error?.code ?? '') !== 'ENOENT') {
        console.warn('Unable to load push subscription store; starting empty.', error)
      }
    }
  }

  list() {
    return [...this.subscriptions]
  }

  async upsert(subscription) {
    const index = this.subscriptions.findIndex((entry) => entry.endpoint === subscription.endpoint)

    if (index >= 0) {
      this.subscriptions[index] = subscription
    } else {
      this.subscriptions.push(subscription)
    }

    await this.save()
  }

  async remove(endpoint) {
    const next = this.subscriptions.filter((entry) => entry.endpoint !== endpoint)

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
