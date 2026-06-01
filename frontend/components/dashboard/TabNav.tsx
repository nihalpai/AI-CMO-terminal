'use client'

import React from 'react'

type TabId = 'company' | 'analytics' | 'agents' | 'reports'

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'company', label: 'Company', emoji: '🏢' },
  { id: 'analytics', label: 'Analytics', emoji: '📊' },
  { id: 'agents', label: 'Agents', emoji: '🤖' },
  { id: 'reports', label: 'Reports', emoji: '📋' },
]

interface TabNavProps {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

export function TabNav({ activeTab, setActiveTab }: TabNavProps) {
  return (
    <div className="flex items-center gap-0 px-2 border-b border-slate-800 bg-slate-950 shrink-0">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === tab.id
              ? 'border-emerald-400 text-slate-100'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="text-xs">{tab.emoji}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
