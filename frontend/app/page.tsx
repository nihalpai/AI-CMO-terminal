'use client'

import { useEffect, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { AnalysisProgressLoader } from '@/components/analysis/AnalysisProgressLoader'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

type AppStatus = 'idle' | 'loading' | 'polling' | 'complete' | 'error'
type TabId = 'company' | 'analytics' | 'agents' | 'reports'

const VALID_TABS: TabId[] = ['company', 'analytics', 'agents', 'reports']

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
  const [initialTab, setInitialTab] = useState<TabId>('company')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

  // ── Cleanup polling on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Deep-link loader: restore dashboard from URL params on mount ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const jobParam = params.get('job')
    const tabParam = params.get('tab') as TabId | null
    const siteParam = params.get('site') ?? ''

    if (!jobParam) return // Normal entry — nothing to restore

    const tab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'company'

    async function loadJob() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/analyze/${jobParam}`)
        if (!res.ok) return // Job not found — silently stay idle

        const data = await res.json()

        if (data?.status === 'completed' && data.result) {
          setReport(data.result as AnalysisReport)
          setJobId(jobParam!)
          setAnalyzedUrl(siteParam ? `https://${siteParam}` : '')
          setInitialTab(tab)
          setAppStatus('complete')
        } else if (data?.status === 'processing') {
          // Job still running — show progress and continue polling
          setJobId(jobParam!)
          setAnalyzedUrl(siteParam ? `https://${siteParam}` : '')
          setAppStatus('polling')
          startPolling(jobParam!, siteParam)
        }
        // If status is 'error' or unknown — stay idle (silent fallback)
      } catch {
        // Network error — stay idle
      }
    }

    loadJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally empty — runs once on mount only

  // domain is passed directly to avoid stale closure over analyzedUrl state
  function startPolling(id: string, domain: string = '') {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/analyze/${id}`)
        if (!res.ok) return

        const data = await res.json()

        if (data?.status === 'completed') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setReport(data.result as AnalysisReport)
          setAppStatus('complete')
          // Write the deep-link URL now that the job is complete
          if (domain) {
            window.history.pushState(null, '', `/?job=${id}&tab=company&site=${domain}`)
          }
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
    setInitialTab('company')

    try {
      const res = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) throw new Error(`Backend returned ${res.status}`)

      const data = await res.json()
      const id: string = data.job_id
      const trimmedUrl = url.trim()
      const domain = extractDomain(trimmedUrl)

      setJobId(id)
      setAnalyzedUrl(trimmedUrl)

      // Cached result — backend returned completed immediately
      if (data.status === 'completed') {
        const row = await fetch(`${API_BASE}/api/v1/analyze/${id}`).then(r => r.ok ? r.json() : null)
        if (row?.result) {
          setReport(row.result as AnalysisReport)
          setAppStatus('complete')
          // Write deep-link URL
          window.history.pushState(null, '', `/?job=${id}&tab=company&site=${domain}`)
          return
        }
      }

      setAppStatus('polling')
      startPolling(id, domain)
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
    setInitialTab('company')
    // Clear URL back to bare /
    window.history.replaceState(null, '', '/')
  }

  // ── Full dashboard once analysis is complete ──────────────────────────────
  if (appStatus === 'complete' && report) {
    return (
      <DashboardLayout
        report={report}
        jobId={jobId}
        companyDomain={extractDomain(analyzedUrl)}
        onReset={handleReset}
        initialTab={initialTab}
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
            Enter your company&apos;s URL to generate your GTM dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourcompany.com"
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
