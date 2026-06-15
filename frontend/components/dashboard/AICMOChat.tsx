'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { renderInline } from '@/lib/text-utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AICMOChatProps {
  jobId: string
  focusTrigger?: number
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `hi, i'm your ai cmo.

i can help you with:

• competitive strategy and positioning
• content planning across channels
• seo / geo optimisation
• channel recommendations and growth tactics

how would you like to proceed?`,
}

const CHAT_STRONG = 'text-slate-100 font-semibold'

function AssistantBubble({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/)

  return (
    <div className="bg-slate-900 rounded-xl rounded-tl-sm p-3 text-slate-300 text-xs leading-relaxed border border-slate-800 max-w-[90%] space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        const isList = lines.every((l) => /^[-•]\s/.test(l.trim()) || l.trim() === '')
        if (isList) {
          return (
            <ul key={i} className="list-disc list-inside space-y-0.5 pl-1">
              {lines.filter((l) => l.trim()).map((line, j) => (
                <li key={j}>{renderInline(line.replace(/^[-•]\s*/, ''), CHAT_STRONG)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line, CHAT_STRONG)}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export function AICMOChat({ jobId, focusTrigger }: AICMOChatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusTrigger) inputRef.current?.focus()
  }, [focusTrigger])

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
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span className="text-slate-300 text-xs font-medium">Talk to AI CMO</span>
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
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
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent text-slate-300 text-xs placeholder-slate-400 outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed shrink-0"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
