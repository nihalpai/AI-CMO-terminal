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
  cardAction?: { label: string; itemText: string }
  inlineAction?: { label: string; itemText: string }
  description?: string
}

const iconDomainMap: Record<string, string> = {
  reddit: 'reddit.com',
  seo: 'google.com',
  x: 'x.com',
  articles: 'nytimes.com',
  hn: 'news.ycombinator.com',
  linkedin: 'linkedin.com',
  video: 'youtube.com',
  geo: 'perplexity.ai',
}

const iconLabelMap: Record<string, string> = {
  reddit: 'R',
  seo: 'S',
  x: 'X',
  articles: 'A',
  hn: 'Y',
  linkedin: 'in',
  video: '▶',
  geo: 'G',
}

export function AgentCard({ name, icon, statusText, items, defaultOpen = false, jobId, cardAction, inlineAction, description }: AgentCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [draftItem, setDraftItem] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  const domain = iconDomainMap[icon]
  const label = iconLabelMap[icon] ?? icon.slice(0, 1).toUpperCase()

  return (
    <div className="border-b border-slate-800 last:border-b-0">
      {/* Header Row */}
      <div
        onClick={() => !inlineAction && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between px-4 py-3 transition-colors ${inlineAction ? '' : 'cursor-pointer hover:bg-slate-800/50'}`}
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
        {inlineAction ? (
          jobId && (
            <button
              onClick={(e) => { e.stopPropagation(); setDraftItem(inlineAction.itemText) }}
              className="text-xs text-emerald-600 hover:text-emerald-400 transition-colors shrink-0"
            >
              {inlineAction.label}
            </button>
          )
        ) : (
          <span className="text-slate-600 text-xs">{isOpen ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Expanded Content */}
      {isOpen && !inlineAction && (
        <div className="px-4 pb-3 pt-1">
          {description && cardAction ? (
            /* Description + action button on the same row */
            <div className="flex items-start gap-2 py-1">
              <p className="text-slate-500 text-xs leading-relaxed flex-1">{description}</p>
              {jobId && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDraftItem(cardAction.itemText) }}
                  className="text-xs text-emerald-600 hover:text-emerald-400 transition-colors shrink-0 ml-1"
                >
                  {cardAction.label}
                </button>
              )}
            </div>
          ) : (
            <>
              {items.length > 0 ? (
                items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 py-1 group">
                    <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                    <p className="text-slate-400 text-xs leading-relaxed flex-1">{renderInline(cleanUrls(item))}</p>
                    {jobId && !cardAction && (
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
              {jobId && cardAction && (
                <div className="pt-2 mt-1 border-t border-slate-800/60">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDraftItem(cardAction.itemText) }}
                    className="text-xs text-emerald-600 hover:text-emerald-400 transition-colors"
                  >
                    {cardAction.label}
                  </button>
                </div>
              )}
            </>
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
