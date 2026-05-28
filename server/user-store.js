import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class UserStore {
  constructor(filePath = path.join(__dirname, 'data', 'users.json')) {
    this.filePath = filePath
    this.users = []
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true })

    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)

      if (Array.isArray(parsed)) {
        this.users = parsed.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.id === 'string' &&
            typeof entry.email === 'string' &&
            typeof entry.passwordHash === 'string',
        )
      }
    } catch (error) {
      if ((error?.code ?? '') !== 'ENOENT') {
        console.warn('Unable to load user store; starting empty.', error)
      }
    }
  }

  findByEmail(email) {
    const normalized = normalizeEmail(email)
    if (!normalized) return null
    return this.users.find((user) => user.email === normalized) ?? null
  }

  findById(id) {
    if (typeof id !== 'string') return null
    return this.users.find((user) => user.id === id) ?? null
  }

  async create({ email, passwordHash }) {
    const normalized = normalizeEmail(email)
    if (!normalized) {
      throw new Error('Invalid email')
    }
    if (this.findByEmail(normalized)) {
      throw new Error('Email already registered')
    }
    const user = {
      id: randomUUID(),
      email: normalized,
      passwordHash,
      createdAt: new Date().toISOString(),
    }
    this.users.push(user)
    await this.save()
    return user
  }

  async save() {
    await writeFile(this.filePath, JSON.stringify(this.users, null, 2))
  }
}

export function normalizeEmail(email) {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}
