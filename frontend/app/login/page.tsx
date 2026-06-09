'use client'

import { useState, useEffect, useRef } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [redirect, setRedirect] = useState('/')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Read the ?redirect= param — only allow relative paths (open-redirect protection)
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('redirect') ?? '/'
    const safe = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
    setRedirect(safe)
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || isLoading) return

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        // Hard navigation so the browser sends the new cookie on the next request
        window.location.href = redirect
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Incorrect password')
        setPassword('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Could not reach server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 rounded-xl bg-card border border-border p-8 shadow-2xl shadow-black/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            AI CMO Terminal
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter the access password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            disabled={isLoading}
            required
            className="w-full rounded-lg bg-slate-800/60 border border-border px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:opacity-50 transition-colors"
          />

          {error && (
            <p className="text-xs text-red-400 px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    </main>
  )
}
