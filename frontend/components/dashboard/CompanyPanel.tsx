'use client'

import { CompanyLogo } from '@/components/CompanyLogo'

type Competitor = string | { name: string; url: string }

function getCompetitorName(c: Competitor): string {
  return typeof c === 'string' ? c : c.name
}

function getCompetitorUrl(c: Competitor): string {
  if (typeof c === 'object' && c.url) {
    const url = c.url.trim()
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
  }
  // Fallback: Google search for the company name (safe for any TLD)
  return `https://www.google.com/search?q=${encodeURIComponent(getCompetitorName(c))}+official+site`
}

type AnalysisReport = {
  summary: string
  competitors: Competitor[]
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
  onFocusChat: () => void
}

const navCards = [
  { icon: '🤖', name: 'AI CMO Chat',     tab: null,              badge: null },
  { icon: '🎯', name: 'Content Playbook', tab: 'agents' as const, badge: null },
  { icon: '📋', name: 'Full GTM Report',  tab: 'reports' as const, badge: null },
  { icon: '📊', name: 'Analytics',        tab: 'analytics' as const, badge: null },
]

export function CompanyPanel({ report, companyDomain, onNavigate, onFocusChat }: CompanyPanelProps) {
  const brandInitial = companyDomain.charAt(0).toUpperCase()

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <div className="max-w-2xl mx-auto px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
            <CompanyLogo
              domain={companyDomain}
              size={32}
              fallback={<span className="text-emerald-400 font-bold text-base">{brandInitial}</span>}
            />
          </div>
          <div>
            <h1 className="text-slate-100 font-semibold text-base">{companyDomain}</h1>
            <p className="text-slate-500 text-xs">Company Overview</p>
          </div>
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
                onClick={() => doc.tab ? onNavigate(doc.tab) : onFocusChat()}
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
          <div className="mb-3">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
              Competitors
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {[...new Map(report.competitors.map(c => [getCompetitorName(c), c])).values()].slice(0, 6).map((competitor, i) => {
              const name = getCompetitorName(competitor)
              const href = getCompetitorUrl(competitor)
              const domain = href.replace(/^https?:\/\//, '').split('/')[0]
              return (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 transition-colors group"
                >
                  <div className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    <CompanyLogo domain={domain} size={16} fallback={<span className="text-xs">🛡️</span>} />
                  </div>
                  <span className="text-slate-400 text-xs truncate group-hover:text-slate-200 transition-colors">{name}</span>
                  <span className="text-slate-600 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">↗</span>
                </a>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
