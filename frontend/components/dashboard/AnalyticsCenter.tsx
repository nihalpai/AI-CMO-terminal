'use client'

import React, { useState } from 'react'
import { renderInline } from '@/lib/text-utils'

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
  company_description?: string
  geo_signals?: {
    geo_score: number
    ai_visibility: 'Strong' | 'Moderate' | 'Weak'
    schema_gaps: string[]
    freshness_issue: boolean
    geo_recommendations: string[]
  }
}

interface AnalyticsCenterProps {
  report: AnalysisReport
}

type TabKey = 'Traffic' | 'Insights' | 'Channels' | 'GEO'

const TABS: TabKey[] = ['Traffic', 'Insights', 'Channels', 'GEO']

const TRAFFIC_LABELS: Record<string, string> = {
  search: 'Search',
  direct: 'Direct',
  social: 'Social',
  paid: 'Paid',
}

export function AnalyticsCenter({ report }: AnalyticsCenterProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('Traffic')

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800 flex-1 overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center gap-0 px-2 border-b border-slate-800 bg-slate-900 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab
                ? 'border-emerald-400 text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ── TRAFFIC TAB ── */}
        {activeTab === 'Traffic' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                AI-Estimated Traffic Mix
              </p>
            </div>

            {/* Traffic signals or empty state */}
            {report.traffic_signals ? (
              <div className="space-y-3">
                {(
                  [
                    ['search', report.traffic_signals.search],
                    ['direct', report.traffic_signals.direct],
                    ['social', report.traffic_signals.social],
                    ['paid', report.traffic_signals.paid],
                  ] as [string, number][]
                ).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs w-12 shrink-0">
                      {TRAFFIC_LABELS[key]}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-slate-400 text-xs font-mono w-8 text-right shrink-0">
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-xs font-mono text-center py-8">
                NO DATA AVAILABLE
              </p>
            )}
          </div>
        )}

        {/* ── INSIGHTS TAB ── */}
        {activeTab === 'Insights' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                White Space Opportunities
              </p>
              <p className="text-slate-600 text-xs">
                Market gaps your competitors haven't addressed — ranked by impact
              </p>
            </div>
            {report.white_space_opportunities.length > 0 ? (
              report.white_space_opportunities.map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-2 flex items-start gap-2"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-1" />
                  <p className="text-slate-400 text-xs leading-relaxed">{renderInline(item)}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-600 text-xs font-mono text-center py-8">
                NO DATA AVAILABLE
              </p>
            )}
          </div>
        )}

        {/* ── CHANNELS TAB ── */}
        {activeTab === 'Channels' && (
          <div>
            <div className="space-y-2">
              {report.recommended_channels.length > 0 ? (
                report.recommended_channels.map((channel, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-3"
                  >
                    <p className="text-slate-300 text-xs font-medium leading-relaxed">{renderInline(channel)}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-xs font-mono text-center py-8">
                  NO DATA AVAILABLE
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── GEO TAB ── */}
        {activeTab === 'GEO' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Generative Engine Optimization
              </p>
              <p className="text-slate-600 text-xs">
                Estimated visibility in AI-generated answers (ChatGPT, Perplexity, Gemini)
              </p>
            </div>

            {report.geo_signals ? (
              <div className="space-y-4">
                {/* Score */}
                <div className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className={`text-4xl font-bold ${
                    report.geo_signals.geo_score >= 70 ? 'text-emerald-400' :
                    report.geo_signals.geo_score >= 40 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {report.geo_signals.geo_score}
                  </div>
                  <div>
                    <p className="text-slate-200 text-sm font-medium">GEO Score</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      AI Visibility: <span className={
                        report.geo_signals.ai_visibility === 'Strong' ? 'text-emerald-400' :
                        report.geo_signals.ai_visibility === 'Moderate' ? 'text-amber-400' : 'text-red-400'
                      }>{report.geo_signals.ai_visibility}</span>
                    </p>
                    {report.geo_signals.freshness_issue && (
                      <p className="text-amber-500 text-xs mt-0.5">⚠ Content may be stale</p>
                    )}
                  </div>
                </div>

                {/* Schema Gaps */}
                {report.geo_signals.schema_gaps.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                      Schema Gaps
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.geo_signals.schema_gaps.map((gap, i) => (
                        <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2.5 py-1">
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {report.geo_signals.geo_recommendations.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                      Recommendations
                    </p>
                    {report.geo_signals.geo_recommendations.map((rec, i) => (
                      <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-2 flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-1" />
                        <p className="text-slate-400 text-xs leading-relaxed">{renderInline(rec)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-600 text-xs font-mono text-center py-8">
                NO GEO DATA AVAILABLE
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
