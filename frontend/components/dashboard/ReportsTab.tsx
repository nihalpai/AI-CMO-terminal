'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cleanUrls, renderInline } from '@/lib/text-utils'

type AnalysisReport = {
  summary: string
  competitors: string[]
  white_space_opportunities: string[]
  recommended_channels: string[]
  content_recommendations: string[]
  hiring_signals: string[]
  traffic_signals?: { search: number; direct: number; social: number; paid: number }
  company_description?: string
  geo_signals?: {
    geo_score: number
    ai_visibility: 'Strong' | 'Moderate' | 'Weak'
    schema_gaps: string[]
    freshness_issue: boolean
    geo_recommendations: string[]
  }
}

interface ReportsTabProps {
  report: AnalysisReport
  companyDomain: string
  onReset: () => void
}

export function ReportsTab({ report, companyDomain, onReset }: ReportsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-100 text-xl font-semibold">GTM Analysis Report</h1>
            <p className="text-slate-500 text-sm mt-1">{companyDomain}</p>
          </div>
          <button
            onClick={onReset}
            className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            ← New Analysis
          </button>
        </div>

        <Separator className="bg-slate-800" />

        {/* Executive Summary */}
        <Card className="p-5">
          <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Executive Summary</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{report.summary}</p>
        </Card>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Competitors */}
          <Card className="p-5">
            <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Competitors</h2>
            <div className="space-y-1.5">
              {(() => {
                const uniqueCompetitors = [...new Set(report.competitors)]
                return uniqueCompetitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs font-mono w-4">{i + 1}.</span>
                    <span className="text-slate-400 text-sm">{c}</span>
                  </div>
                ))
              })()}
            </div>
          </Card>

          {/* Recommended Channels */}
          <Card className="p-5">
            <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Recommended Channels</h2>
            <div className="space-y-2">
              {report.recommended_channels.map((ch, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                  <p className="text-slate-400 text-sm leading-relaxed">{renderInline(ch)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* White Space Opportunities */}
          <Card className="p-5">
            <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">White Space Opportunities</h2>
            <div className="space-y-2">
              {report.white_space_opportunities.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                  <p className="text-slate-400 text-sm leading-relaxed">{renderInline(item)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Hiring Signals */}
          <Card className="p-5 overflow-hidden">
            <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Hiring Signals</h2>
            <div className="space-y-2">
              {report.hiring_signals.map((item, i) => {
                const [company, ...rest] = item.split(':')
                const clean = cleanUrls(rest.join(':').trim())
                return (
                  <div key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{company?.trim()}</Badge>
                    <p className="text-slate-400 text-xs leading-relaxed break-words min-w-0">{clean}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Content Recommendations — full width */}
        <Card className="p-5">
          <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Content Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.content_recommendations.map((item, i) => (
              <div key={i} className="flex items-start gap-2 bg-slate-800/50 rounded-lg p-3">
                <span className="text-emerald-400 text-xs font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-slate-400 text-xs leading-relaxed">{renderInline(item)}</p>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </ScrollArea>
  )
}
