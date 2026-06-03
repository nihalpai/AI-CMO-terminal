'use client'

import { useEffect, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/lib/theme'
import { AnalysisProgressLoader } from '@/components/analysis/AnalysisProgressLoader'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

type AppStatus = 'idle' | 'loading' | 'polling' | 'complete' | 'error'

type AnalysisReport = {
  summary: string
  competitors: string[]
  white_space_opportunities: string[]
  recommended_channels: string[]
  content_recommendations: string[]
  hiring_signals: string[]
  traffic_signals?: {
    search: number
    direct: number
    social: number
    paid: number
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

export default function Home() {
  const { theme, toggleTheme } = useTheme()
  const [url, setUrl] = useState('')
  const [appStatus, setAppStatus] = useState<AppStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analyzedUrl, setAnalyzedUrl] = useState('')
  const [jobId, setJobId] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function startPolling(id: string) {
    intervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('analysis_jobs')
          .select('status, result')
          .eq('id', id)
          .single()

        if (error) return

        if (data?.status === 'completed') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setReport(data.result as AnalysisReport)
          setAppStatus('complete')
        } else if (data?.status === 'error') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setErrorMessage((data.result as { error?: string })?.error ?? 'Analysis failed in the background.')
          setAppStatus('error')
        }
      } catch {
        // transient error — keep polling
      }
    }, 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setAppStatus('loading')
    setErrorMessage('')
    setReport(null)
    setJobId('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'}/api/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) throw new Error(`Backend returned ${res.status}`)

      const data = await res.json()
      const id: string = data.job_id

      setJobId(id)
      setAnalyzedUrl(url.trim())

      // Cached result — backend returned completed immediately
      if (data.status === 'completed') {
        const { data: row } = await supabase
          .from('analysis_jobs')
          .select('result')
          .eq('id', id)
          .single()
        if (row?.result) {
          setReport(row.result as AnalysisReport)
          setAppStatus('complete')
          return
        }
      }

      setAppStatus('polling')
      startPolling(id)
    } catch (err) {
      setAppStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  function handleReset() {
    setAppStatus('idle')
    setReport(null)
    setUrl('')
    setAnalyzedUrl('')
    setJobId('')
    setErrorMessage('')
  }

  // ── Full dashboard once analysis is complete ──────────────────────────────
  if (appStatus === 'complete' && report) {
    return (
      <DashboardLayout
        report={report}
        jobId={jobId}
        companyDomain={extractDomain(analyzedUrl)}
        onReset={handleReset}
      />
    )
  }

  // ── Entry screen (idle / loading / polling / error) ───────────────────────
  const isBusy = appStatus === 'loading' || appStatus === 'polling'

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-background px-4">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="w-full max-w-lg space-y-8 rounded-xl bg-card border border-border p-8 shadow-2xl shadow-black/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            AI CMO Terminal
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your competitor&apos;s URL to generate your GTM dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://competitor.com"
            disabled={isBusy}
            required
            className="w-full rounded-lg bg-slate-800/60 border border-border px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {appStatus === 'loading'
              ? 'Submitting...'
              : appStatus === 'polling'
                ? 'Analyzing...'
                : 'Launch Dashboard'}
          </button>
        </form>

        {isBusy && (
          <div className="border-t border-border pt-6">
            <AnalysisProgressLoader />
          </div>
        )}

        {appStatus === 'error' && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
            <p className="text-sm font-semibold text-red-400">Something went wrong</p>
            {errorMessage && (
              <p className="mt-1 text-xs text-red-400/70">{errorMessage}</p>
            )}
            <button
              onClick={handleReset}
              className="mt-3 text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
