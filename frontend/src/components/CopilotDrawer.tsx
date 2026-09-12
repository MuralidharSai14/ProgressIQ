import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import apiService from '../services/api'

interface CopilotMessage {
  id: string
  sender: 'user' | 'copilot'
  text: string
  source?: string
  citations?: string[]
  timestamp: Date
}

interface CopilotDrawerProps {
  projectId: number
  isOpen: boolean
  onClose: () => void
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ projectId, isOpen, onClose }) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load initial greeting and suggested prompts when project changes or opened
  useEffect(() => {
    if (isOpen && projectId) {
      apiService.getCopilotPrompts(projectId)
        .then((res) => {
          if (res?.suggested_prompts) {
            setSuggestedPrompts(res.suggested_prompts)
          }
        })
        .catch(() => {
          setSuggestedPrompts([
            'Summarize project status and delay drivers.',
            'Which activities are critical and lagging behind?',
            'What material shortages threaten upcoming milestones?',
            'Draft a weekly status report for the project director.',
          ])
        })

      if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            sender: 'copilot',
            text: `👋 Hello! I am **PROGRESSIQ Copilot**, your real-time AI project controls specialist.\n\nI have direct access to your live baseline schedule, verified field progress, EVM S-Curve indices, material logistics, and safety registers.\n\nHow can I assist you today?`,
            source: 'gemini-3.6-flash',
            timestamp: new Date(),
          },
        ])
      }
    }
  }, [isOpen, projectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input
    if (!textToSend.trim() || loading || !projectId) return

    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!queryText) setInput('')
    setLoading(true)

    try {
      const res = await apiService.askCopilot(projectId, textToSend)
      const copilotMsg: CopilotMessage = {
        id: `c-${Date.now()}`,
        sender: 'copilot',
        text: res.answer || 'No answer generated.',
        source: res.source,
        citations: res.citations,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, copilotMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          sender: 'copilot',
          text: `⚠️ **Error querying Copilot:** ${err?.message || 'Unable to connect to project telemetry.'}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Backdrop for mobile */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs md:hidden" onClick={onClose} />

      <div
        className={`relative flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 ${
          expanded ? 'w-full md:w-[720px]' : 'w-full sm:w-[460px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">PROGRESSIQ Copilot</h3>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                  Gemini 3.6 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Live Project Memory & Strategic Controls</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={expanded ? 'Collapse drawer' : 'Expand drawer'}
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear conversation"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'copilot' && (
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`relative max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 rounded-tl-xs'
                }`}
              >
                <div className="prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap">
                  {m.text}
                </div>

                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Sources:</span>
                    {m.citations.map((c, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {m.sender === 'copilot' && (
                  <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(m.id, m.text)}
                      className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      title="Copy message"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>

              {m.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[11px] font-medium text-slate-400">Analyzing live project telemetry...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        {suggestedPrompts.length > 0 && messages.length <= 3 && (
          <div className="px-4 py-2 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60">
            <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              Suggested Inquiries:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.slice(0, 3).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  className="text-[11px] text-left px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-2xs truncate max-w-full"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot about delays, S-Curves, materials, safety..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
              title="Send question"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
