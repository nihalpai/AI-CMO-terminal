'use client'

import React from 'react'
import { AgentCard } from './AgentCard'

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

interface AgentsFeedProps {
  report: AnalysisReport
  jobId?: string
}

export function AgentsFeed({ report, jobId }: AgentsFeedProps) {
  const wso = report.white_space_opportunities
  const contentRecs = report.content_recommendations
  const hiring = report.hiring_signals
  const channels = report.recommended_channels

  // ── Per-card item arrays with guaranteed non-empty fallbacks ──────────────

  // Reddit Agent: white space opportunities
  const redditItems = wso.length > 0 ? wso.slice(0, 3) : [
    'Monitor competitor brand mentions and respond helpfully in relevant communities',
    'Share product insights in niche subreddits where your target audience hangs out',
    'Create an AMA thread to build authority and surface real user pain points',
  ]

  // SEO Agent: channels with SEO keywords, fallback to first 2 channels, then hardcoded
  const seoItems = (() => {
    const seoChannels = channels.filter((c) => /seo|search|organic|keyword|content/i.test(c))
    if (seoChannels.length > 0) return seoChannels.slice(0, 3)
    if (channels.length > 0) return channels.slice(0, 2)
    return [
      'Publish long-form comparison content targeting high-intent keywords',
      'Fix technical SEO gaps: page speed, schema markup, and internal linking',
    ]
  })()

  // X Agent: first 2 content recs, fallback
  const xItems = contentRecs.length >= 2 ? contentRecs.slice(0, 2) : contentRecs.length === 1
    ? [contentRecs[0], 'Tweet: Share a surprising insight from your competitive research']
    : [
        'Thread: Break down a key competitor weakness and how you solve it differently',
        'Tweet: Share a surprising market stat from your competitive research',
      ]

  // Articles Agent: 3rd content rec, fallback
  const articleItems = contentRecs.length >= 3
    ? contentRecs.slice(2, 3)
    : contentRecs.length >= 1
      ? [contentRecs[contentRecs.length - 1]]
      : ['Write a detailed competitor comparison guide targeting high-intent search queries']

  // HN Agent: last content rec (avoiding overlap with Articles), fallback
  const hnItems = contentRecs.length >= 4
    ? [contentRecs[contentRecs.length - 1]]
    : ['Share a contrarian take on industry trends in a relevant Show HN or Ask HN thread']

  // LinkedIn Agent: hiring signals, fallback
  const linkedinItems = hiring.length > 0 ? hiring.slice(0, 3) : [
    'Competitors are scaling headcount: publish a thought-leadership post on where the industry is heading',
    'Share your company culture and unique approach to attract top talent away from larger incumbents',
  ]

  // UGC Videos Agent: always has content
  const ugcItems = wso.length > 0
    ? [`Short-form video: visually explain this opportunity — ${wso[0].slice(0, 80)}...`]
    : ['Short-form explainer (60 sec): address the #1 pain point your competitors are ignoring']

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
        <div className="flex items-center gap-2">
          <span className="text-slate-200 text-sm font-semibold">Agents Feed</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* Agent List */}
      <div className="max-w-4xl mx-auto">
        {/* 1. Reddit Agent */}
        <AgentCard
          name="Reddit Agent"
          icon="reddit"
          statusText={`${redditItems.length} opportunities ready`}
          items={redditItems}
          jobId={jobId}
        />

        {/* 2. SEO Agent */}
        <AgentCard
          name="SEO Agent"
          icon="seo"
          statusText={`${seoItems.length} recommendations ready`}
          items={seoItems}
          jobId={jobId}
        />

        {/* 3. X Agent */}
        <AgentCard
          name="X Agent"
          icon="x"
          statusText={`${xItems.length} ideas ready`}
          items={xItems}
          jobId={jobId}
        />

        {/* 4. Articles Agent */}
        <AgentCard
          name="Articles Agent"
          icon="articles"
          statusText="1 topic ready"
          items={articleItems}
          jobId={jobId}
        />

        {/* 5. Hacker News Agent */}
        <AgentCard
          name="Hacker News Agent"
          icon="hn"
          statusText="1 post ready"
          items={hnItems}
          jobId={jobId}
        />

        {/* 6. LinkedIn Agent — defaultOpen */}
        <AgentCard
          name="LinkedIn Agent"
          icon="linkedin"
          statusText={`${linkedinItems.length} post${linkedinItems.length !== 1 ? 's' : ''} ready`}
          items={linkedinItems}
          defaultOpen={true}
          jobId={jobId}
        />

        {/* 7. UGC Videos Agent */}
        <AgentCard
          name="UGC Videos Agent"
          icon="video"
          statusText="1 video ready"
          items={ugcItems}
          jobId={jobId}
        />
      </div>
    </div>
  )
}
