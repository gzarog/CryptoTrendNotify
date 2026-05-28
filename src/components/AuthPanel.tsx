import { useEffect, useState } from 'react'

import { type AuthUser, login, logout, me, register } from '../lib/auth'

type Mode = 'login' | 'register'

export function AuthPanel() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void me().then((current) => {
      setUser(current)
      setLoading(false)
    })
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const action = mode === 'login' ? login : register
      const result = await action(email, password)
      setUser(result.user)
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    try {
      await logout()
      setUser(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  if (user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-300">{user.email}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-sm">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
        className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-1 text-slate-100 placeholder:text-slate-500"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8)"
        required
        minLength={8}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        className="rounded-md border border-white/10 bg-slate-900/60 px-3 py-1 text-slate-100 placeholder:text-slate-500"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1 font-medium text-white shadow-md disabled:opacity-50"
      >
        {mode === 'login' ? 'Sign in' : 'Register'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setError(null)
        }}
        className="text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
      >
        {mode === 'login' ? 'Need an account?' : 'Have an account?'}
      </button>
      {error ? <span className="basis-full text-rose-400">{error}</span> : null}
    </form>
  )
}
