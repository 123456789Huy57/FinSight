'use client'

import { MessageCircle, X, Send, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { chatWithAI } from '@/lib/api'
import { useAiEnabled } from '@/lib/useAiEnabled'

interface Message {
  role: 'user' | 'ai'
  text: string
}

interface ChatWidgetProps {
  contextData?: Record<string, unknown>
}

export function ChatWidget({ contextData }: ChatWidgetProps) {
  const aiEnabled = useAiEnabled()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hỏi về một mã, ngành hoặc bản tin.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const send = async (override?: string) => {
    const q = (override ?? input).trim()
    if (!q || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

    try {
      const res = await chatWithAI(q, contextData)
      setMessages((prev) => [...prev, { role: 'ai', text: res.response }])
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Xin lỗi, có lỗi kết nối. Hãy thử lại.' }])
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  if (!aiEnabled) return null

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 150) }}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary
            flex items-center justify-center text-white hover:bg-primary-hover
            transition-all duration-200 border border-primary/40 hover:scale-105"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] h-[500px] flex flex-col rounded-2xl border border-[var(--fs-line)] bg-[var(--fs-paper)] overflow-hidden slide-in-right">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fs-signal)]/[0.12] bg-[var(--fs-paper)] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[13px] font-bold text-foreground">FinSight</span>
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-[var(--fs-up)] ml-0.5" />
            </div>
            <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button
                type="button"
                onClick={() => setMessages([{ role: 'ai', text: 'Hỏi về một mã, ngành hoặc bản tin.' }])}
                title="Xóa cuộc hội thoại"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--fs-muted)] hover:bg-[var(--fs-surface)] hover:text-[var(--fs-down)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--fs-muted)] hover:bg-[var(--fs-surface)] hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => {
              const isUser = m.role === 'user'
              const isExpanded = expandedIdx === i
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    onClick={() => { if (!isUser) setExpandedIdx(isExpanded ? null : i) }}
                    className={[
                      'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed select-text',
                      isUser
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-[var(--fs-surface)] text-foreground rounded-bl-sm border border-[var(--fs-line)] cursor-pointer',
                    ].join(' ')}
                    style={
                      !isUser && !isExpanded
                        ? { display: '-webkit-box', WebkitLineClamp: 3 as unknown as number, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
                        : undefined
                    }
                    title={!isUser ? 'Click để xem đầy đủ' : undefined}
                  >
                    {m.text}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--fs-paper)] border border-[var(--fs-line)] rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                'Thị trường hôm nay thế nào?',
                'VCB đang ở đâu?',
                'Ngành nào đang dẫn dắt?',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="text-[11px] bg-[var(--fs-paper)] hover:bg-[var(--fs-surface)] border border-[var(--fs-line)] rounded-full px-2.5 py-1 text-[var(--fs-muted)] hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-[var(--fs-line)] flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              placeholder="Hỏi về thị trường..."
              className="flex-1 bg-[var(--fs-paper)] border border-[var(--fs-line)] rounded-lg px-3 py-2 text-xs text-foreground
                placeholder:text-[var(--fs-muted)] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-white
                hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
