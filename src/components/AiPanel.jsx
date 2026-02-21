import React, { useEffect } from 'react'

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
        <ul key={`ul-${elements.length}`} className="ai-list">
          {listItems.map((li, i) => <li key={i}>{formatInline(li)}</li>)}
        </ul>
      )
      listItems = []
      inList = false
    }
  }

  const formatInline = (str) => {
    // Split into segments by **bold**, *italic*, `code`
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
        parts.push(<strong key={key++}>{match[2]}</strong>)
      } else if (match[3]) {
        parts.push(<em key={key++}>{match[3]}</em>)
      } else if (match[4]) {
        parts.push(<code key={key++}>{match[4]}</code>)
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
      elements.push(<h4 key={elements.length} className="ai-h4">{formatInline(trimmed.slice(4))}</h4>)
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(<h3 key={elements.length} className="ai-h3">{formatInline(trimmed.slice(3))}</h3>)
    } else if (/^\d+\.\s\*\*/.test(trimmed)) {
      flushList()
      elements.push(<p key={elements.length} className="ai-p">{formatInline(trimmed)}</p>)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true
      listItems.push(trimmed.slice(2))
    } else if (/^\d+\.\s/.test(trimmed)) {
      inList = true
      listItems.push(trimmed.replace(/^\d+\.\s/, ''))
    } else {
      flushList()
      elements.push(<p key={elements.length} className="ai-p">{formatInline(trimmed)}</p>)
    }
  }
  flushList()
  return elements
}

export function AiInlineResult({ content, onClose }) {
  if (!content) return null
  return (
    <div className="ai-result-inline">
      <div className="ai-result-header">
        <div className="ai-result-label">
          <span className="ai-sparkle" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </span>
          AI Analysis
        </div>
        {onClose && (
          <button className="ai-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      <div className="ai-result-body">
        {renderMarkdown(content)}
      </div>
    </div>
  )
}

export function AiButton({ onClick, loading, children, variant = 'default' }) {
  return (
    <button
      type="button"
      className={`ai-btn ${variant} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <>
          <svg className="ai-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
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
    <div className="ai-panel-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title || 'AI Assistant'}>
      <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-sparkle" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
            <h3>{title || 'AI Assistant'}</h3>
          </div>
          <button className="ai-close" onClick={onClose} aria-label="Close panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="ai-panel-body">
          {loading && (
            <div className="ai-loading" aria-live="polite">
              <div className="ai-loading-dots" aria-hidden="true">
                <span /><span /><span />
              </div>
              <p>Analyzing with Claude...</p>
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
    <div className="ai-error">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{error}</span>
      {onRetry && <button className="ai-retry" onClick={onRetry}>Retry</button>}
    </div>
  )
}
