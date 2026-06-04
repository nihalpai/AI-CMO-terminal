'use client'

import React from 'react'
import { Pencil } from 'lucide-react'

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
  company_one_liner?: string
  company_description?: string
  geo_signals?: {
    geo_score: number
    ai_visibility: 'Strong' | 'Moderate' | 'Weak'
    schema_gaps: string[]
    freshness_issue: boolean
    geo_recommendations: string[]
  }
}

interface CompanyPanelProps {
  report: AnalysisReport
  companyDomain: string
  onNavigate: (tab: 'company' | 'analytics' | 'agents' | 'reports') => void
}

const navCards = [
  { icon: '📈', name: 'Traffic Intelligence', tab: 'analytics' as const, badge: null },
  { icon: '🤖', name: 'Content Playbook',     tab: 'agents' as const,    badge: 'Live' },
  { icon: '📋', name: 'Full GTM Report',       tab: 'reports' as const,   badge: 'New' },
  { icon: '🎯', name: 'Competitive Analysis',  tab: 'reports' as const,   badge: null  },
]

export function CompanyPanel({ report, companyDomain, onNavigate }: CompanyPanelProps) {
  const brandInitial = companyDomain.charAt(0).toUpperCase()

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="max-w-2xl mx-auto px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base shrink-0">
            {brandInitial}
          </div>
          <div>
            <h1 className="text-slate-100 font-semibold text-base">{companyDomain}</h1>
            <p className="text-slate-500 text-xs">Company Overview</p>
          </div>
        </div>

        {/* Quick-add pills */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1 cursor-pointer hover:bg-slate-700 transition-colors">
            + Add team size &amp; category
          </span>
          <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1 cursor-pointer hover:bg-slate-700 transition-colors">
            + Improve writing quality
          </span>
        </div>

        {/* Company description */}
        <div className="border border-slate-800 rounded-lg p-5">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">About</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            {report.company_one_liner || report.company_description || report.summary}
          </p>
        </div>

        {/* Documents section */}
        <div className="border border-slate-800 rounded-lg p-5">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">
            Documents
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {navCards.map((doc) => (
              <div
                key={doc.name}
                onClick={() => onNavigate(doc.tab)}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800 cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm leading-none shrink-0" aria-hidden="true">
                    {doc.icon}
                  </span>
                  <span className="text-slate-400 text-xs truncate">{doc.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {doc.badge && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 rounded-full px-1.5 py-0.5 leading-none">
                      {doc.badge}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitors section */}
        <div className="border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
              Competitors
            </p>
            <button
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              aria-label="Edit competitors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {[...new Set(report.competitors)].slice(0, 6).map((competitor, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-sm leading-none shrink-0" aria-hidden="true">🛡️</span>
                <span className="text-slate-400 text-xs truncate">{competitor}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
