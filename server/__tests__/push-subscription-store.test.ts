import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import { PushSubscriptionStore } from '../push-subscription-store.js'

type TestContext = {
  directory: string
  filePath: string
}

describe('PushSubscriptionStore', () => {
  const context: TestContext = {
    directory: '',
    filePath: '',
  }

  beforeEach(async () => {
    context.directory = await mkdtemp(path.join(tmpdir(), 'push-store-'))
    context.filePath = path.join(context.directory, 'subscriptions.json')
  })

  afterEach(async () => {
    if (context.directory) {
      await rm(context.directory, { recursive: true, force: true })
    }
  })

  it('loads existing subscriptions on init', async () => {
    const existing = [
      { endpoint: 'https://example.com/1', keys: { p256dh: 'a', auth: 'b' } },
      { endpoint: 'https://example.com/2', keys: { p256dh: 'c', auth: 'd' } },
    ]

    await writeFile(context.filePath, JSON.stringify(existing, null, 2))

    const store = new PushSubscriptionStore(context.filePath)
    await store.init()

    expect(store.list()).toEqual(existing)
  })

  it('upserts and de-duplicates subscriptions', async () => {
    const store = new PushSubscriptionStore(context.filePath)
    await store.init()

    const first = { endpoint: 'https://example.com/1', keys: { p256dh: 'a', auth: 'b' } }
    const updated = { endpoint: 'https://example.com/1', keys: { p256dh: 'x', auth: 'y' } }

    await store.upsert(first as any)
    await store.upsert(updated as any)

    expect(store.list()).toEqual([updated])
  })

  it('removes subscriptions by endpoint', async () => {
    const store = new PushSubscriptionStore(context.filePath)
    await store.init()

    await store.upsert({ endpoint: 'https://example.com/1', keys: { p256dh: 'a', auth: 'b' } } as any)
    await store.upsert({ endpoint: 'https://example.com/2', keys: { p256dh: 'c', auth: 'd' } } as any)

    const removed = await store.remove('https://example.com/1')

    expect(removed).toBe(true)
    expect(store.list()).toEqual([
      { endpoint: 'https://example.com/2', keys: { p256dh: 'c', auth: 'd' } },
    ])
    expect(await store.remove('https://example.com/missing')).toBe(false)
  })
})
