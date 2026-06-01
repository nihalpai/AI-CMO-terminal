'use client'

import React, { useState } from 'react'
import { TerminalHeader } from './TerminalHeader'
import { TabNav } from './TabNav'
import { CompanyPanel } from './CompanyPanel'
import { AnalyticsCenter } from './AnalyticsCenter'
import { AgentsFeed } from './AgentsFeed'
import { ReportsTab } from './ReportsTab'
import { AICMOChat } from './AICMOChat'

type TabId = 'company' | 'analytics' | 'agents' | 'reports'

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

interface DashboardLayoutProps {
  report: AnalysisReport
  jobId: string
  companyDomain: string
  onReset: () => void
}

export function DashboardLayout({ report, jobId, companyDomain, onReset }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabId>('agents')

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <TerminalHeader companyDomain={companyDomain} creditsCount={5} />

      <div className="flex flex-1 overflow-hidden">
        {/* Main area: tab nav + tab content */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-slate-800">
          <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="flex-1 overflow-hidden">
            {activeTab === 'company' && <CompanyPanel report={report} companyDomain={companyDomain} onNavigate={setActiveTab} />}
            {activeTab === 'analytics' && <AnalyticsCenter report={report} />}
            {activeTab === 'agents' && <AgentsFeed report={report} jobId={jobId} />}
            {activeTab === 'reports' && <ReportsTab report={report} companyDomain={companyDomain} onReset={onReset} />}
          </div>
        </div>

        {/* Fixed right chat */}
        <AICMOChat jobId={jobId} />
      </div>
    </div>
  )
}
