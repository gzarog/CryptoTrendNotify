import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { UserStore, normalizeEmail } from '../user-store.js'

describe('UserStore', () => {
  let tempDir
  let filePath

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'user-store-'))
    filePath = path.join(tempDir, 'users.json')
  })

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('normalizes emails (trim + lowercase)', () => {
    expect(normalizeEmail('  Foo@Bar.COM  ')).toBe('foo@bar.com')
    expect(normalizeEmail(null)).toBe('')
  })

  it('creates and looks up a user', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const created = await store.create({ email: 'A@B.com', passwordHash: 'hash' })
    expect(created.email).toBe('a@b.com')
    expect(created.id).toBeTypeOf('string')

    expect(store.findByEmail('a@b.com')).toEqual(created)
    expect(store.findById(created.id)).toEqual(created)
  })

  it('rejects duplicate emails', async () => {
    const store = new UserStore(filePath)
    await store.init()
    await store.create({ email: 'x@y.com', passwordHash: 'h' })
    await expect(store.create({ email: 'x@y.com', passwordHash: 'h2' })).rejects.toThrow()
  })

  it('persists across reloads', async () => {
    const store = new UserStore(filePath)
    await store.init()
    await store.create({ email: 'p@q.com', passwordHash: 'h' })

    const next = new UserStore(filePath)
    await next.init()
    expect(next.findByEmail('p@q.com')?.email).toBe('p@q.com')
  })
})
