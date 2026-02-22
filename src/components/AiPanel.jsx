import React, { useEffect, useState } from 'react'
import { useStore, useDispatch } from '../store/useStore.jsx'
import { getAiHealth } from '../utils/ai.js'

/**
 * Reusable AI response panel — slides in from right or renders inline.
 * Renders markdown-ish content with basic formatting.
 */

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let inList = false
  let listItems = []

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1.5 text-[0.85rem] text-txt-2 leading-relaxed my-2">
          {listItems.map((li, i) => <li key={i}>{formatInline(li)}</li>)}
        </ul>
      )
      listItems = []
      inList = false
    }
  }

  const formatInline = (str) => {
    const parts = []
    let remaining = str
    let key = 0
    const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/
    while (remaining) {
      const match = remaining.match(pattern)
      if (!match) {
        parts.push(remaining)
        break
      }
      if (match.index > 0) {
        parts.push(remaining.slice(0, match.index))
      }
      if (match[2]) {
        parts.push(<strong key={key++} className="font-semibold text-txt">{match[2]}</strong>)
      } else if (match[3]) {
        parts.push(<em key={key++}>{match[3]}</em>)
      } else if (match[4]) {
        parts.push(<code key={key++} className="bg-ai/5 text-ai px-1.5 py-0.5 rounded-md text-[0.82rem] font-mono">{match[4]}</code>)
      }
      remaining = remaining.slice(match.index + match[0].length)
    }
    return parts
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }

    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(<h4 key={elements.length} className="text-[0.88rem] font-bold text-txt mt-4 mb-1.5 tracking-tight">{formatInline(trimmed.slice(4))}</h4>)
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(<h3 key={elements.length} className="text-[0.95rem] font-bold text-txt mt-5 mb-2 tracking-tight">{formatInline(trimmed.slice(3))}</h3>)
    } else if (/^\d+\.\s\*\*/.test(trimmed)) {
      flushList()
      elements.push(<p key={elements.length} className="text-[0.85rem] text-txt-2 leading-relaxed my-1.5">{formatInline(trimmed)}</p>)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true
      listItems.push(trimmed.slice(2))
    } else if (/^\d+\.\s/.test(trimmed)) {
      inList = true
      listItems.push(trimmed.replace(/^\d+\.\s/, ''))
    } else {
      flushList()
      elements.push(<p key={elements.length} className="text-[0.85rem] text-txt-2 leading-relaxed my-1.5">{formatInline(trimmed)}</p>)
    }
  }
  flushList()
  return elements
}

export function AiInlineResult({ content, onClose }) {
  if (!content) return null
  return (
    <div className="bg-gradient-to-br from-ai/[0.04] to-ai-light/[0.02] border border-ai/10 rounded-xl p-4 mt-3 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-ai">
          <span className="inline-flex text-ai-light">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </span>
          AI Analysis
        </div>
        {onClose && (
          <button className="bg-transparent border-none text-txt-3 cursor-pointer p-1 rounded-md transition-all duration-150 hover:text-txt hover:bg-ai/5" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      <div>
        {renderMarkdown(content)}
      </div>
    </div>
  )
}

export function AiButton({ onClick, loading, children, variant = 'default' }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.82rem] font-semibold border-none cursor-pointer font-sans transition-all duration-200 ${
        loading ? 'opacity-70 cursor-wait' : ''
      } ${
        variant === 'default'
          ? 'bg-gradient-to-r from-ai to-ai-light text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)] hover:shadow-[0_4px_16px_rgba(124,58,237,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]'
          : 'bg-ai/[0.08] text-ai border border-ai/20 hover:bg-ai/[0.12] hover:border-ai/30'
      }`}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <>
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
          </svg>
          Analyzing...
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          {children || 'AI Assist'}
        </>
      )}
    </button>
  )
}

export function AiSlidePanel({ open, onClose, title, loading, content, children }) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm animate-[overlayIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'AI Assistant'}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-[480px] max-w-[90vw] bg-white/95 backdrop-blur-xl shadow-[-8px_0_32px_rgba(0,0,0,0.1)] border-l border-ai/10 flex flex-col animate-[slideInRight_0.35s_cubic-bezier(0.22,1,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light bg-gradient-to-r from-ai/[0.04] to-transparent">
          <div className="flex items-center gap-2">
            <span className="inline-flex text-ai-light">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
            <h3 className="text-[1rem] font-bold tracking-tight text-txt">{title || 'AI Assistant'}</h3>
          </div>
          <button className="bg-transparent border-none text-txt-3 cursor-pointer p-1.5 rounded-lg transition-all duration-150 hover:text-txt hover:bg-subtle" onClick={onClose} aria-label="Close panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center" aria-live="polite">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="w-2 h-2 rounded-full bg-ai animate-[dotPulse_1.2s_infinite]" />
                <span className="w-2 h-2 rounded-full bg-ai animate-[dotPulse_1.2s_0.15s_infinite]" />
                <span className="w-2 h-2 rounded-full bg-ai animate-[dotPulse_1.2s_0.3s_infinite]" />
              </div>
              <p className="text-[0.85rem] text-txt-3">Analyzing with Claude...</p>
            </div>
          )}
          {!loading && content && renderMarkdown(content)}
          {!loading && children}
        </div>
      </div>
    </div>
  )
}

export function AiError({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 text-red text-[0.82rem] bg-red-bg border border-red/10 rounded-lg px-3 py-2 mt-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span className="flex-1">{error}</span>
      {onRetry && (
        <button className="bg-transparent border border-red/20 text-red rounded-md px-2 py-0.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-red-bg hover:border-red/30" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function AiProviderToggle() {
  const { aiProvider } = useStore()
  const dispatch = useDispatch()
  const [claudeAvailable, setClaudeAvailable] = useState(null)

  useEffect(() => {
    getAiHealth()
      .then((data) => setClaudeAvailable(data.providers?.claude?.available || false))
      .catch(() => setClaudeAvailable(false))
  }, [])

  const setProvider = (p) => dispatch({ type: 'SET_AI_PROVIDER', payload: { provider: p } })
  const active = aiProvider || 'ollama'

  if (claudeAvailable === null) return null

  if (!claudeAvailable) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span className="text-[0.7rem] text-white/35 font-medium">AI: Local (Ollama)</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 px-1 py-1.5">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-white/30">AI Provider</span>
      <div className="flex rounded-lg overflow-hidden border border-white/10">
        <button
          className={`flex-1 text-[0.7rem] font-semibold py-1.5 px-2 border-none cursor-pointer font-sans transition-all duration-150 ${
            active === 'ollama'
              ? 'bg-white/[0.12] text-white'
              : 'bg-transparent text-white/35 hover:text-white/60 hover:bg-white/[0.05]'
          }`}
          onClick={() => setProvider('ollama')}
        >
          Local
        </button>
        <button
          className={`flex-1 text-[0.7rem] font-semibold py-1.5 px-2 border-none border-l border-l-white/10 cursor-pointer font-sans transition-all duration-150 ${
            active === 'claude'
              ? 'bg-gradient-to-r from-[#7c3aed]/30 to-[#6d28d9]/30 text-purple-300'
              : 'bg-transparent text-white/35 hover:text-white/60 hover:bg-white/[0.05]'
          }`}
          onClick={() => setProvider('claude')}
        >
          Claude
        </button>
      </div>
    </div>
  )
}
