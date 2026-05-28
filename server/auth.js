import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const TOKEN_COOKIE_NAME = 'token'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

let cachedSecret = null

function getJwtSecret() {
  if (cachedSecret) return cachedSecret
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set to a string of at least 16 characters')
  }
  cachedSecret = secret
  return cachedSecret
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS })
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret())
    if (typeof payload === 'object' && payload && typeof payload.sub === 'string') {
      return payload.sub
    }
    return null
  } catch {
    return null
  }
}

export function parseCookies(header) {
  const cookies = {}
  if (typeof header !== 'string' || header.length === 0) return cookies
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (name) cookies[name] = decodeURIComponent(value)
  }
  return cookies
}

export function buildAuthCookie(token, { secure }) {
  const parts = [
    `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildClearAuthCookie({ secure }) {
  const parts = [
    `${TOKEN_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function getUserIdFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[TOKEN_COOKIE_NAME]
  if (!token) return null
  return verifyToken(token)
}

export { TOKEN_COOKIE_NAME, TOKEN_TTL_SECONDS }
