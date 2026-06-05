'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { DraftPanel } from './DraftPanel'
import { cleanUrls, renderInline } from '@/lib/text-utils'

interface AgentCardProps {
  name: string
  icon: string
  statusText: string
  items: string[]
  defaultOpen?: boolean
  jobId?: string
}

const iconDomainMap: Record<string, string> = {
  reddit: 'reddit.com',
  seo: 'google.com',
  x: 'x.com',
  articles: 'nytimes.com',
  hn: 'news.ycombinator.com',
  linkedin: 'linkedin.com',
  video: 'youtube.com',
}

const iconLabelMap: Record<string, string> = {
  reddit: 'R',
  seo: 'S',
  x: 'X',
  articles: 'A',
  hn: 'Y',
  linkedin: 'in',
  video: '▶',
}

export function AgentCard({ name, icon, statusText, items, defaultOpen = false, jobId }: AgentCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [draftItem, setDraftItem] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  const domain = iconDomainMap[icon]
  const label = iconLabelMap[icon] ?? icon.slice(0, 1).toUpperCase()

  return (
    <div className="border-b border-slate-800 last:border-b-0">
      {/* Header Row */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-200/10">
            {domain && !logoFailed ? (
              <Image
                src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                alt={name}
                width={20}
                height={20}
                className="object-contain"
                onError={() => setLogoFailed(true)}
                unoptimized
              />
            ) : (
              <span className="text-xs font-medium text-slate-600">{label}</span>
            )}
          </div>
          <div>
            <p className="text-slate-200 text-sm font-medium">{name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{statusText}</p>
          </div>
        </div>
        <span className="text-slate-600 text-xs">{isOpen ? '▲' : '▼'}</span>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="px-4 pb-3 pt-1">
          {items.length > 0 ? (
            items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-1 group">
                <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                <p className="text-slate-400 text-xs leading-relaxed flex-1">{renderInline(cleanUrls(item))}</p>
                {jobId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDraftItem(item) }}
                    className="text-xs text-emerald-600 hover:text-emerald-400 transition-colors shrink-0 ml-1"
                  >
                    Draft →
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-start gap-2 py-1">
              <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
              <p className="text-slate-400 text-xs leading-relaxed">No items available.</p>
            </div>
          )}
        </div>
      )}

      <DraftPanel
        isOpen={draftItem !== null}
        onClose={() => setDraftItem(null)}
        agentName={name}
        itemText={draftItem ?? ''}
        jobId={jobId ?? ''}
      />
    </div>
  )
}
