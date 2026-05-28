'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AnalysisProgressLoader } from '@/components/analysis/AnalysisProgressLoader'
import { ReportDashboard } from '@/components/report/ReportDashboard'

type AppStatus = 'idle' | 'loading' | 'polling' | 'complete' | 'error'

type AnalysisReport = {
  summary: string
  competitors: string[]
  white_space_opportunities: string[]
  recommended_channels: string[]
  content_recommendations: string[]
  hiring_signals: string[]
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [appStatus, setAppStatus] = useState<AppStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [analyzedUrl, setAnalyzedUrl] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function startPolling(jobId: string) {
    intervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('analysis_jobs')
          .select('status, result')
          .eq('id', jobId)
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

    try {
      const res = await fetch('http://localhost:8000/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) throw new Error(`Backend returned ${res.status}`)

      const { job_id } = await res.json()
      setAnalyzedUrl(url.trim())
      setAppStatus('polling')
      startPolling(job_id)
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
    setErrorMessage('')
  }

  if (appStatus === 'complete' && report) {
    return (
      <ReportDashboard
        report={report}
        analyzedUrl={analyzedUrl}
        onReset={handleReset}
      />
    )
  }

  const isBusy = appStatus === 'loading' || appStatus === 'polling'

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-8 rounded-xl bg-card border border-border p-8 shadow-2xl shadow-black/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            GTM Intelligence
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter a competitor URL to generate your analysis report.
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
            className="w-full rounded-lg bg-slate-800/60 border border-border px-4 py-3 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:opacity-50 transition-colors"
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
                : 'Generate Report'}
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
          </div>
        )}
      </div>
    </main>
  )
}
