'use client'

import React, { useEffect, useState } from 'react'

interface DraftPanelProps {
  isOpen: boolean
  onClose: () => void
  agentName: string
  itemText: string
  jobId: string
}

const AGENT_CONTENT_TYPE: Record<string, string> = {
  'Reddit Agent': 'Reddit thread reply',
  'SEO Agent': 'SEO-optimised blog post outline',
  'X Agent': 'Twitter/X thread (5-7 tweets)',
  'Articles Agent': 'long-form article (800-1200 words)',
  'Hacker News Agent': 'Hacker News Show HN post',
  'LinkedIn Agent': 'LinkedIn thought-leadership post',
  'UGC Videos Agent': 'short-form video script (60 seconds)',
}

const AGENT_PLATFORM: Record<string, string> = {
  'Reddit Agent': 'reddit',
  'SEO Agent': 'blog',
  'X Agent': 'twitter',
  'Articles Agent': 'blog',
  'Hacker News Agent': 'hackernews',
  'LinkedIn Agent': 'linkedin',
  'UGC Videos Agent': 'blog',
}

export function DraftPanel({ isOpen, onClose, agentName, itemText, jobId }: DraftPanelProps) {
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const contentType = AGENT_CONTENT_TYPE[agentName] ?? 'marketing asset'
  const platform = AGENT_PLATFORM[agentName] ?? 'blog'

  useEffect(() => {
    if (isOpen && itemText && jobId) {
      fetchDraft()
    }
    // reset when closed
    if (!isOpen) {
      setDraft('')
      setCopied(false)
    }
  }, [isOpen, itemText])

  async function fetchDraft() {
    setIsLoading(true)
    setDraft('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'}/api/v1/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, platform, content_recommendation: itemText }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDraft(data.reply ?? data.message ?? data.response ?? 'No response from server.')
    } catch {
      setDraft('Failed to generate draft. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-[90vw] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <p className="text-slate-200 text-sm font-semibold">{agentName} — Draft</p>
            <p className="text-slate-500 text-xs mt-0.5 capitalize">{contentType}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && draft && (
              <button
                onClick={handleCopy}
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md px-3 py-1.5 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
            {!isLoading && draft && (
              <button
                onClick={fetchDraft}
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md px-3 py-1.5 transition-colors"
              >
                ↻ Regenerate
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Recommendation context */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/50">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Based on</p>
          <p className="text-slate-400 text-xs leading-relaxed italic">"{itemText}"</p>
        </div>

        {/* Draft content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-xs">Drafting {contentType}...</p>
            </div>
          ) : draft ? (
            <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {draft}
            </pre>
          ) : null}
        </div>
      </div>
    </>
  )
}
