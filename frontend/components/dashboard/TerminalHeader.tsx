'use client'

import React from 'react'
import { ChevronDown, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

interface TerminalHeaderProps {
  companyDomain: string
  creditsCount?: number
}

export function TerminalHeader({ companyDomain, creditsCount = 5 }: TerminalHeaderProps) {
  const { theme, toggleTheme } = useTheme()

  const initials = companyDomain
    .split('.')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'NP'

  return (
    <div className="h-12 w-full flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800 shrink-0">
      {/* Left: Company selector pill */}
      <div className="bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer border border-slate-700 transition-colors">
        <span className="text-sm leading-none" aria-hidden="true">🛡️</span>
        <span className="text-slate-200 text-xs font-medium truncate max-w-[140px]">{companyDomain}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </div>

      {/* Center: Title + status */}
      <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        <span className="text-slate-300 font-medium text-sm">AI CMO Terminal</span>
        <span className="text-slate-600 text-sm select-none">•</span>
        <span className="text-slate-500 text-sm">Running Daily</span>
        <span
          className="animate-pulse w-2 h-2 rounded-full bg-emerald-400 inline-block"
          aria-label="Active"
        />
      </div>

      {/* Right: Avatar + credits */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
          {creditsCount} Credits
        </span>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none">
          NP
        </div>
      </div>
    </div>
  )
}
