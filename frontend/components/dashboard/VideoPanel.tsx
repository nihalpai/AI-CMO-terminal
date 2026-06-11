'use client'

import React, { useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type VideoPhase = 'idle' | 'generating_script' | 'script_ready' | 'generating_video' | 'video_ready' | 'error'

type VideoShot = {
  shot_number: number
  type: 'talking_head' | 'broll' | 'screen_recording' | 'cta'
  description: string
  duration_seconds: number
}

type VideoScript = {
  company_type: string
  hook_type: string
  hook_line: string
  script: string
  shots: VideoShot[]
  avatar_style: string
  broll_prompt: string
  image_search_query: string
  target_duration_seconds: number
}

type ViralityScore = {
  hook_strength?: number
  attention?: number
  retention?: number
  viral_potential?: number
  overall?: number
}

type VideoJob = {
  id?: string
  status: string
  avatar_video_url?: string
  broll_video_url?: string
  final_video_url?: string
  virality_score?: ViralityScore
  error_text?: string
  script?: string
  created_at?: string
}

type YtStatus = 'none' | 'uploading' | 'completed' | 'error'

type YtInfo = {
  status: YtStatus
  uploadId?: string
  watchUrl?: string | null
  nextAllowedAt?: string | null
  error?: string
}

interface VideoPanelProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  triggerText: string
}

// Human label for the re-upload cooldown, e.g. "in 5 days".
function nextAllowedLabel(iso?: string | null): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return ''
  const days = Math.ceil(ms / 86_400_000)
  return days >= 1 ? `in ${days} day${days > 1 ? 's' : ''}` : 'soon'
}

function isGated(iso?: string | null): boolean {
  return !!iso && new Date(iso).getTime() > Date.now()
}

// ── Progress steps ─────────────────────────────────────────────────────────

const PROGRESS_STEPS: Array<{ status: string; label: string }> = [
  { status: 'pending',           label: 'Preparing' },
  { status: 'generating_avatar', label: 'Generating video' },
  { status: 'composing',         label: 'Composing split-screen' },
  { status: 'completed',         label: 'Done' },
]

const STEP_ORDER = PROGRESS_STEPS.map((s) => s.status)

function stepState(stepStatus: string, currentStatus: string): 'done' | 'active' | 'pending' {
  const stepIdx = STEP_ORDER.indexOf(stepStatus)
  const currentIdx = STEP_ORDER.indexOf(currentStatus)
  if (currentStatus === 'completed' || stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

// ── Hook type labels ────────────────────────────────────────────────────────

const HOOK_LABELS: Record<string, string> = {
  transformation: 'Transformation Hook',
  contrarian: 'Contrarian Hook',
  pov: 'POV Hook',
  behind_the_scenes: 'Behind-the-Scenes Hook',
}

const SHOT_TYPE_LABELS: Record<string, string> = {
  talking_head: 'Talking Head',
  broll: 'B-Roll',
  screen_recording: 'Screen Recording',
  cta: 'CTA',
}

const SHOT_TYPE_COLORS: Record<string, string> = {
  talking_head:     'bg-sky-600/30 text-slate-100 border-sky-500/40',
  broll:            'bg-violet-600/30 text-slate-100 border-violet-500/40',
  screen_recording: 'bg-amber-600/30 text-slate-100 border-amber-500/40',
  cta:              'bg-emerald-600/30 text-slate-100 border-emerald-500/40',
}

// ── Virality score bar ──────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-300 text-xs font-mono w-8 text-right shrink-0">{pct}</span>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function VideoPanel({ isOpen, onClose, jobId, triggerText }: VideoPanelProps) {
  const [phase, setPhase] = useState<VideoPhase>('idle')
  const [videoScript, setVideoScript] = useState<VideoScript | null>(null)
  const [editedScript, setEditedScript] = useState<string>('')
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null)
  const [videoJobId, setVideoJobId] = useState<string>('')
  const [videoHistory, setVideoHistory] = useState<VideoJob[]>([])
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [ytState, setYtState] = useState<Record<string, YtInfo>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ytPollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

  // On open: check for an existing video job first; only run Phase A if none found
  useEffect(() => {
    if (isOpen && jobId && phase === 'idle') {
      checkExistingJob()
    }
    if (!isOpen) {
      resetPanel()
    }
  }, [isOpen])

  async function checkExistingJob() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/by-analysis/${jobId}`)
      if (!res.ok) {
        // 404 = no prior job, proceed to Phase A
        generateScript()
        return
      }
      const data = await res.json()
      if (data.status === 'completed') {
        setVideoJob(data)
        setVideoJobId(data.id)
        setExpandedVideoId(data.id)
        setPhase('video_ready')
        fetchHistory()
      } else if (data.status === 'error') {
        setErrorMessage('Previous video generation failed. Click "Try again" to start fresh.')
        setPhase('error')
      } else {
        // pending / generating_* — resume polling
        setVideoJob(data)
        setVideoJobId(data.id)
        setPhase('generating_video')
        startPolling(data.id)
      }
    } catch {
      generateScript()
    }
  }

  // Sync editedScript when a new script is generated
  useEffect(() => {
    if (videoScript) setEditedScript(videoScript.script)
  }, [videoScript])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      Object.values(ytPollRefs.current).forEach(clearInterval)
    }
  }, [])

  // When a video is expanded, hydrate its YouTube upload state once.
  useEffect(() => {
    if (expandedVideoId && ytState[expandedVideoId] === undefined) {
      loadYouTube(expandedVideoId)
    }
  }, [expandedVideoId])

  function resetPanel() {
    setPhase('idle')
    setVideoScript(null)
    setEditedScript('')
    setVideoJob(null)
    setVideoJobId('')
    setVideoHistory([])
    setExpandedVideoId(null)
    setErrorMessage('')
    setCopied(false)
    setYtState({})
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    Object.values(ytPollRefs.current).forEach(clearInterval)
    ytPollRefs.current = {}
  }

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/history/${jobId}`)
      if (res.ok) setVideoHistory(await res.json())
    } catch {}
  }

  // ── YouTube Shorts upload ──────────────────────────────────────────────────

  function setYt(videoId: string, info: YtInfo) {
    setYtState((s) => ({ ...s, [videoId]: info }))
  }

  async function loadYouTube(videoId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/youtube/by-video/${videoId}`)
      if (!res.ok) { setYt(videoId, { status: 'none' }); return }
      const d = await res.json()
      const status: YtStatus =
        d.status === 'completed' ? 'completed'
        : d.status === 'uploading' ? 'uploading'
        : d.status === 'error' ? 'error' : 'none'
      setYt(videoId, {
        status,
        uploadId: d.id,
        watchUrl: d.watch_url,
        nextAllowedAt: d.next_allowed_at,
        error: d.error_text,
      })
      if (status === 'uploading' && d.id) pollYouTube(videoId, d.id)
    } catch {
      setYt(videoId, { status: 'none' })
    }
  }

  async function uploadYouTube(videoId: string) {
    const prev = ytState[videoId]
    setYt(videoId, { ...prev, status: 'uploading', error: undefined })
    try {
      const res = await fetch(`${API_BASE}/api/v1/youtube/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_job_id: videoId }),
      })
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}))
        setYt(videoId, {
          status: prev?.watchUrl ? 'completed' : 'none',
          watchUrl: prev?.watchUrl,
          nextAllowedAt: d.next_allowed_at ?? prev?.nextAllowedAt,
        })
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setYt(videoId, { status: 'uploading', uploadId: d.upload_id })
      pollYouTube(videoId, d.upload_id)
    } catch (err) {
      setYt(videoId, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed.' })
    }
  }

  function pollYouTube(videoId: string, uploadId: string) {
    if (ytPollRefs.current[videoId]) clearInterval(ytPollRefs.current[videoId])
    ytPollRefs.current[videoId] = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/youtube/status/${uploadId}`)
        if (!res.ok) return
        const d = await res.json()
        if (d.status === 'completed') {
          clearInterval(ytPollRefs.current[videoId]); delete ytPollRefs.current[videoId]
          setYt(videoId, { status: 'completed', uploadId, watchUrl: d.watch_url, nextAllowedAt: d.next_allowed_at })
        } else if (d.status === 'error') {
          clearInterval(ytPollRefs.current[videoId]); delete ytPollRefs.current[videoId]
          setYt(videoId, { status: 'error', uploadId, error: d.error_text ?? 'Upload failed.' })
        }
      } catch {
        // transient — keep polling
      }
    }, 5000) // YouTube upload of a 15s clip is quick; poll every 5s
  }

  // ── Phase A: script generation ───────────────────────────────────────────

  async function generateScript() {
    setPhase('generating_script')
    setErrorMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/v1/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          platform: 'ugcvideo_script',
          content_recommendation: triggerText,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const raw: string = data.reply ?? ''
      // Strip markdown fences if present
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const parsed: VideoScript = JSON.parse(cleaned)
      setVideoScript(parsed)
      setPhase('script_ready')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate script.')
      setPhase('error')
    }
  }

  // ── Phase B: video generation ────────────────────────────────────────────

  async function handleGenerateVideo() {
    if (!videoScript) return
    setPhase('generating_video')
    setVideoJob({ status: 'pending' })
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          script: editedScript || videoScript.script,
          company_type: videoScript.company_type,
          hook_type: videoScript.hook_type,
          avatar_style: videoScript.avatar_style,
          broll_prompt: videoScript.broll_prompt,
          image_search_query: videoScript.image_search_query,
          target_duration_seconds: videoScript.target_duration_seconds,
          shots: videoScript.shots,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setVideoJobId(data.video_job_id)
      startPolling(data.video_job_id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start video generation.')
      setPhase('error')
    }
  }

  function startPolling(vjid: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/video/${vjid}`)
        if (!res.ok) return
        const data: VideoJob = await res.json()
        setVideoJob(data)
        if (data.status === 'completed') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setExpandedVideoId(vjid)
          setPhase('video_ready')
          fetchHistory()
        } else if (data.status === 'error') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setErrorMessage(data.error_text ?? 'Video generation failed.')
          setPhase('error')
        }
      } catch {
        // transient — keep polling
      }
    }, 10000) // poll every 10s (video generation takes minutes)
  }

  async function handleCopyScript() {
    if (!videoScript) return
    await navigator.clipboard.writeText(editedScript || videoScript.script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop — blocked during active generation to prevent accidental close */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={phase === 'generating_video' ? undefined : onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[520px] max-w-[95vw] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-slate-100 text-sm font-semibold tracking-tight">UGC Videos Agent — Script & Film</p>
            {phase === 'video_ready' ? (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-slate-400 text-xs">Video ready</span>
                <button
                  onClick={() => {
                    setVideoJob(null)
                    setVideoScript(null)
                    setEditedScript('')
                    generateScript()
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  ↻ New script
                </button>
              </div>
            ) : (
              <p className="text-slate-400 text-xs mt-1">
                {phase === 'idle' || phase === 'generating_script'
                  ? 'Generating 15-sec short-form ad script...'
                  : phase === 'script_ready'
                    ? 'Script ready · edit and generate video'
                    : phase === 'generating_video'
                      ? 'Video generating · this takes 2-5 minutes'
                      : 'Something went wrong'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors ml-4 mt-0.5 shrink-0"
          >✕</button>
        </div>

        {/* Context */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/50 shrink-0">
          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-1.5">Based on</p>
          <p className="text-slate-300 text-xs leading-relaxed italic line-clamp-2">"{triggerText}"</p>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Generating script loader ── */}
          {phase === 'generating_script' && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-xs">Writing script + shot plan...</p>
            </div>
          )}

          {/* ── Script ready ── */}
          {phase === 'script_ready' && videoScript && (
            <div className="space-y-6">
              {/* Hook line */}
              <div>
                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-2">
                  Hook Line&nbsp;&nbsp;·&nbsp;&nbsp;{HOOK_LABELS[videoScript.hook_type] ?? videoScript.hook_type}
                </p>
                <div className="bg-emerald-900/25 border border-emerald-500/40 rounded-xl px-4 py-3.5">
                  <p className="text-emerald-200 text-sm font-semibold leading-snug">"{videoScript.hook_line}"</p>
                </div>
              </div>

              {/* Full script */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
                    Script&nbsp;&nbsp;·&nbsp;&nbsp;~{videoScript.target_duration_seconds}s
                  </p>
                  <button
                    onClick={handleCopyScript}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-md px-3 py-1 transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy script'}
                  </button>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <textarea
                    value={editedScript}
                    onChange={e => setEditedScript(e.target.value)}
                    rows={5}
                    className="w-full bg-transparent text-slate-200 text-xs leading-6 resize-none outline-none"
                  />
                </div>
              </div>

              {/* Shot list */}
              <div>
                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Shot Plan</p>
                <div className="space-y-2.5">
                  {videoScript.shots.map((shot) => (
                    <div key={shot.shot_number} className="flex items-start gap-3 bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-3">
                      <span className="text-slate-400 text-xs font-mono font-semibold w-5 shrink-0 mt-0.5">{shot.shot_number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SHOT_TYPE_COLORS[shot.type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                            {SHOT_TYPE_LABELS[shot.type] ?? shot.type}
                          </span>
                          <span className="text-slate-500 text-xs">{shot.duration_seconds}s</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{shot.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">Avatar</span>
                <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-full px-3 py-1">
                  {videoScript.avatar_style}
                </span>
                <span className="text-slate-600 text-xs">·</span>
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">Type</span>
                <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-full px-3 py-1">
                  {videoScript.company_type}
                </span>
              </div>

              {/* Generate video CTA */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleGenerateVideo}
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors"
                >
                  Generate Video →
                </button>
                <p className="text-slate-600 text-xs text-center mt-2">
                  Video generation takes 2-5 minutes and uses Higgsfield credits.
                </p>
              </div>
            </div>
          )}

          {/* ── Video generating: progress steps ── */}
          {phase === 'generating_video' && videoJob && (
            <div className="space-y-6">
              <p className="text-slate-400 text-xs">Your video is being generated. This typically takes 2-5 minutes.</p>
              <div className="space-y-3">
                {PROGRESS_STEPS.map((step) => {
                  const state = stepState(step.status, videoJob.status)
                  return (
                    <div key={step.status} className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {state === 'done' && (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <span className="text-slate-950 text-xs font-bold">✓</span>
                          </div>
                        )}
                        {state === 'active' && (
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        )}
                        {state === 'pending' && (
                          <div className="w-3 h-3 rounded-full border border-slate-700" />
                        )}
                      </div>
                      <span className={`text-xs ${
                        state === 'done' ? 'text-emerald-400' :
                        state === 'active' ? 'text-slate-200 font-medium' : 'text-slate-600'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Video ready ── */}
          {phase === 'video_ready' && (
            <div>
              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-3">
                All generations
              </p>
              <div className="space-y-2">
                {videoHistory.map((v, i) => {
                  const label = `Video ${videoHistory.length - i}`
                  const isExpanded = expandedVideoId === v.id
                  const videoUrl = v.final_video_url ?? v.avatar_video_url
                  return (
                    <div key={v.id} className="border border-slate-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedVideoId(isExpanded ? null : (v.id ?? null))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-100 text-sm font-semibold">{label}</span>
                          {v.created_at && (
                            <span className="text-slate-500 text-xs">
                              {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                      </button>
                      {isExpanded && videoUrl && (
                        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-700/60">
                          <video
                            src={videoUrl}
                            controls
                            playsInline
                            className="w-full rounded-lg border border-slate-700 bg-slate-950"
                            style={{ maxHeight: '38vh' }}
                          />
                          <a
                            href={videoUrl}
                            download={`${label.toLowerCase().replace(' ', '_')}.mp4`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors"
                          >
                            ↓ Download {label}
                          </a>

                          {/* YouTube Shorts upload */}
                          {(() => {
                            const yt = ytState[v.id ?? ''] ?? { status: 'none' as YtStatus }
                            const gated = isGated(yt.nextAllowedAt)
                            return (
                              <div className="space-y-2 pt-1">
                                {yt.status === 'completed' && yt.watchUrl && (
                                  <a
                                    href={yt.watchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full text-center rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 transition-colors"
                                  >
                                    ▶ Watch on YouTube
                                  </a>
                                )}
                                <button
                                  onClick={() => v.id && uploadYouTube(v.id)}
                                  disabled={yt.status === 'uploading' || gated}
                                  className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed border border-red-500/40 disabled:border-slate-700 px-3 py-2 text-xs font-semibold text-white transition-colors"
                                >
                                  {yt.status === 'uploading'
                                    ? 'Uploading to YouTube…'
                                    : gated
                                      ? `Re-upload available ${nextAllowedLabel(yt.nextAllowedAt)}`
                                      : yt.status === 'completed'
                                        ? '↑ Upload again as Short'
                                        : '↑ Upload to YouTube Short'}
                                </button>
                                {yt.status === 'error' && yt.error && (
                                  <p className="text-[10px] text-red-400/70">{yt.error}</p>
                                )}
                                {(gated || yt.status === 'completed') && (
                                  <p className="text-[10px] text-slate-500 text-center">
                                    One upload per video every 7 days.
                                  </p>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="rounded-lg bg-destructive/10 border border-red-500/30 p-4 w-full">
                <p className="text-sm font-semibold text-red-400">Something went wrong</p>
                {errorMessage && <p className="mt-1 text-xs text-red-400/70">{errorMessage}</p>}
              </div>
              <button
                onClick={() => { setPhase('idle'); generateScript() }}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
