const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export type AuthUser = {
  id: string
  email: string
  createdAt: string
}

type AuthResponse = { user: AuthUser }
type ErrorResponse = { error: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  const data = (await response.json().catch(() => null)) as T | ErrorResponse | null

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`
    throw new Error(message)
  }

  return data as T
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' })
}

export async function me(): Promise<AuthUser | null> {
  try {
    const data = await request<AuthResponse>('/api/auth/me')
    return data.user
  } catch {
    return null
  }
}
