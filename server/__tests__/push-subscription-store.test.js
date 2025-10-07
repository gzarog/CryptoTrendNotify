import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { PushSubscriptionStore } from '../push-subscription-store.js'

const baseEntry = {
  subscription: {
    endpoint: 'https://example.com/endpoint',
    expirationTime: null,
    keys: { p256dh: 'p256dh', auth: 'auth' },
  },
  filters: {
    symbols: ['BTC'],
    momentumTimeframes: ['15'],
  },
}

function cloneEntry() {
  return {
    subscription: {
      endpoint: baseEntry.subscription.endpoint,
      expirationTime: baseEntry.subscription.expirationTime,
      keys: { ...baseEntry.subscription.keys },
    },
    filters: {
      symbols: [...baseEntry.filters.symbols],
      momentumTimeframes: [...baseEntry.filters.momentumTimeframes],
    },
  }
}

describe('PushSubscriptionStore', () => {
  let tempDir
  let filePath

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'push-store-'))
    filePath = path.join(tempDir, 'subscriptions.json')
  })

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('initializes empty store when file does not exist', async () => {
    const store = new PushSubscriptionStore(filePath)
    await store.init()

    expect(store.list()).toEqual([])
  })

  it('upserts, persists and lists copies of subscriptions', async () => {
    const store = new PushSubscriptionStore(filePath)
    await store.init()

    const entry = cloneEntry()
    await store.upsert(entry)

    const listed = store.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]).toEqual(entry)

    // Mutating the listed values should not change the internal state.
    listed[0].subscription.endpoint = 'https://mutated'
    listed[0].filters.symbols.push('ETH')

    const freshList = store.list()
    expect(freshList[0]).toEqual(entry)

    // Data was persisted to disk and can be reloaded.
    const nextStore = new PushSubscriptionStore(filePath)
    await nextStore.init()

    expect(nextStore.list()).toEqual([entry])
  })

  it('removes subscriptions by endpoint and reports status', async () => {
    const store = new PushSubscriptionStore(filePath)
    await store.init()

    const entry = cloneEntry()
    await store.upsert(entry)

    const removed = await store.remove(entry.subscription.endpoint)
    expect(removed).toBe(true)
    expect(store.list()).toEqual([])

    const removedMissing = await store.remove('https://example.com/missing')
    expect(removedMissing).toBe(false)
  })
})
