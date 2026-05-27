'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type AppStatus = 'idle' | 'loading' | 'polling' | 'complete' | 'error'

export default function Home() {
  const [url, setUrl] = useState('')
  const [appStatus, setAppStatus] = useState<AppStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
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
          .select('status')
          .eq('id', jobId)
          .single()

        if (error) return

        if (data?.status === 'completed') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setAppStatus('complete')
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

    try {
      const res = await fetch('http://localhost:8000/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) throw new Error(`Backend returned ${res.status}`)

      const { job_id } = await res.json()
      setAppStatus('polling')
      startPolling(job_id)
    } catch (err) {
      setAppStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const isBusy = appStatus === 'loading' || appStatus === 'polling'

  const buttonLabel =
    appStatus === 'loading'
      ? 'Submitting...'
      : appStatus === 'polling'
        ? 'Analyzing...'
        : 'Generate Report'

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-lg px-6 py-10 bg-gray-900 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">GTM Intelligence</h1>
        <p className="text-sm text-gray-400 mb-8">
          Enter a competitor URL to generate your analysis report.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://competitor.com"
            disabled={isBusy}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buttonLabel}
          </button>
        </form>

        {isBusy && (
          <div className="mt-6 flex items-center gap-3 text-gray-400">
            <svg
              className="animate-spin h-5 w-5 text-indigo-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm">
              {appStatus === 'loading'
                ? 'Sending request to backend...'
                : 'Waiting for analysis to complete...'}
            </span>
          </div>
        )}

        {appStatus === 'complete' && (
          <div className="mt-6 p-4 rounded-lg bg-green-900/40 border border-green-700">
            <p className="text-green-400 font-bold">Analysis Complete!</p>
            <p className="mt-1 text-sm text-green-300/70">
              Your report has been processed and saved.
            </p>
          </div>
        )}

        {appStatus === 'error' && (
          <div className="mt-6 p-4 rounded-lg bg-red-900/40 border border-red-700">
            <p className="text-red-400 font-semibold">Something went wrong</p>
            {errorMessage && (
              <p className="mt-1 text-sm text-red-300/70">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
