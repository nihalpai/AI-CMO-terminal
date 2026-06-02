'use client'

import React, { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AICMOChatProps {
  jobId: string
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `hi, i'm your cmo. thanks for bringing me on.

if you've paid to rent me fully, every day i'll send you:

• 2 seo / geo issues to fix
• 1 written article
• 2 reddit opportunities
• 1 tweet
• 1 linkedin post (coming soon)

else, let me at least set up the basic strategy for you and share some docs.

let's grow.`,
}

function AssistantBubble({ content }: { content: string }) {
  // Parse the initial message specially to render bullet list
  const lines = content.split('\n')
  const bulletLines: string[] = []
  const nonBulletParts: { type: 'text' | 'bullets'; lines: string[] }[] = []

  let currentGroup: { type: 'text' | 'bullets'; lines: string[] } | null = null

  for (const line of lines) {
    if (line.startsWith('•')) {
      if (currentGroup?.type === 'bullets') {
        currentGroup.lines.push(line.replace(/^•\s*/, ''))
      } else {
        currentGroup = { type: 'bullets', lines: [line.replace(/^•\s*/, '')] }
        nonBulletParts.push(currentGroup)
      }
    } else {
      if (currentGroup?.type === 'text') {
        currentGroup.lines.push(line)
      } else {
        currentGroup = { type: 'text', lines: [line] }
        nonBulletParts.push(currentGroup)
      }
    }
  }

  return (
    <div className="bg-slate-900 rounded-xl rounded-tl-sm p-3 text-slate-300 text-xs leading-relaxed border border-slate-800 max-w-[90%]">
      {nonBulletParts.map((part, i) => {
        if (part.type === 'bullets') {
          return (
            <ul key={i} className="list-disc list-inside space-y-0.5 my-1">
              {part.lines.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )
        }
        return (
          <span key={i}>
            {part.lines.map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </span>
        )
      })}
    </div>
  )
}

export function AICMOChat({ jobId }: AICMOChatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) return

    const userMessage: Message = { role: 'user', content: trimmedInput }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, message: trimmedInput }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const reply: string =
        data.reply ?? data.message ?? data.response ?? 'No response from server.'

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I could not reach the server. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 w-[340px] shrink-0 border-l border-slate-800 overflow-hidden">
      {/* Section 1 — Hire CTA header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm shrink-0">
            🤖
          </div>
          <div>
            <p className="text-slate-200 text-xs font-semibold">Hire your full-time CMO</p>
            <p className="text-slate-500 text-xs">AI-powered marketing at $99/month</p>
          </div>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-md px-3 py-1.5 transition-colors shrink-0">
          Hire Now →
        </button>
      </div>

      {/* Section 2 — Talk to AI CMO header */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-xs font-medium">Talk to AI CMO</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-600 text-xs cursor-pointer hover:text-slate-400 transition-colors">
            💬
          </span>
          <span className="text-slate-600 text-xs cursor-pointer hover:text-slate-400 transition-colors">
            📱
          </span>
          <span className="text-slate-600 text-xs cursor-pointer hover:text-slate-400 transition-colors">
            🕐
          </span>
          <span className="text-slate-600 text-xs cursor-pointer hover:text-slate-400 transition-colors">
            ⚙
          </span>
        </div>
      </div>

      {/* Section 3 — Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'assistant' && (
              <p className="text-slate-500 text-xs mb-1">AI CMO</p>
            )}
            {msg.role === 'assistant' ? (
              <AssistantBubble content={msg.content} />
            ) : (
              <div className="bg-emerald-600/20 rounded-xl rounded-tr-sm p-3 text-emerald-100 text-xs leading-relaxed border border-emerald-500/20 max-w-[90%]">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <p className="text-slate-500 text-xs mb-1">AI CMO</p>
            <div className="bg-slate-900 rounded-xl rounded-tl-sm px-4 py-3 border border-slate-800">
              <span className="text-slate-400 text-xs tracking-widest">...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Section 4 — Input bar */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2.5 border border-slate-700 focus-within:border-emerald-500/40 transition-colors">
          <span className="text-slate-600 text-sm cursor-pointer hover:text-slate-400 transition-colors">
            📎
          </span>
          <span className="text-slate-600 text-sm cursor-pointer hover:text-slate-400 transition-colors">
            @
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent text-slate-300 text-xs placeholder-slate-600 outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-slate-950 text-xs transition-colors disabled:opacity-40 shrink-0"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
