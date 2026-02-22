import React, { useState } from 'react'
import { POLICY_STATUSES, IMPLEMENTATION_STATUSES, computeSafeguardScore, scoreColor, scoreBg } from '../../utils/safeguardScoring.js'

export default function SafeguardRow({ safeguard, assessment, onAssess, onCreateGap, showIG, aiSuggestion, onApplyAi }) {
  const [expanded, setExpanded] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState(assessment?.note || '')

  const policy = assessment?.policy || ''
  const implementation = assessment?.implementation || ''
  const score = computeSafeguardScore(policy, implementation)
  const isAssessed = !!policy || !!implementation
  const isLow = score !== null && score < 0.3
  const hasAiDiff = aiSuggestion && (aiSuggestion.policy !== policy || aiSuggestion.implementation !== implementation)

  const handleChange = (field, value) => {
    const updated = {
      policy: field === 'policy' ? value : policy,
      implementation: field === 'implementation' ? value : implementation,
      note: noteText,
    }
    onAssess(safeguard.id, updated)
  }

  const saveNote = () => {
    onAssess(safeguard.id, { policy, implementation, note: noteText })
    setNoteOpen(false)
  }

  return (
    <div className={`border-b border-border-light/50 last:border-b-0 ${hasAiDiff ? 'bg-purple-50/30' : ''}`}>
      <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
        {/* ID badge */}
        <button
          className="text-[0.68rem] font-[800] text-brand bg-brand-bg px-2 py-0.5 rounded-md shrink-0 cursor-pointer border-none font-sans hover:bg-brand/10 transition-colors"
          onClick={() => setExpanded(!expanded)}
          title={safeguard.desc}
        >
          {safeguard.id}
        </button>

        {/* Name */}
        <span className="text-[0.78rem] text-txt flex-1 min-w-0 truncate" title={safeguard.name}>
          {safeguard.name}
        </span>

        {/* IG badge (CIS only) */}
        {showIG && safeguard.ig && (
          <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
            Math.min(...safeguard.ig) === 1 ? 'bg-green-bg text-green' :
            Math.min(...safeguard.ig) === 2 ? 'bg-amber-bg text-amber' :
            'bg-red-bg text-red'
          }`}>
            IG{Math.min(...safeguard.ig)}
          </span>
        )}

        {/* AI suggestion indicator */}
        {hasAiDiff && (
          <button
            className="text-[0.65rem] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full shrink-0 border-none cursor-pointer font-sans hover:bg-purple-100 transition-colors"
            onClick={() => onApplyAi?.(safeguard.id)}
            title={aiSuggestion.rationale || 'Apply AI suggestion'}
          >
            AI
          </button>
        )}

        {/* Policy dropdown */}
        <select
          className="bg-white border border-border rounded-lg px-2 py-1 text-[0.72rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-1 focus:ring-brand/15 w-[120px] shrink-0"
          value={policy}
          onChange={(e) => handleChange('policy', e.target.value)}
        >
          <option value="">Policy...</option>
          {POLICY_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {/* Implementation dropdown */}
        <select
          className="bg-white border border-border rounded-lg px-2 py-1 text-[0.72rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-1 focus:ring-brand/15 w-[120px] shrink-0"
          value={implementation}
          onChange={(e) => handleChange('implementation', e.target.value)}
        >
          <option value="">Impl...</option>
          {IMPLEMENTATION_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {/* Score pill */}
        <span
          className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[38px] text-center"
          style={{ backgroundColor: scoreBg(score), color: scoreColor(score) }}
        >
          {score !== null ? `${Math.round(score * 100)}%` : '—'}
        </span>

        {/* Note icon */}
        <button
          className={`w-6 h-6 rounded-md flex items-center justify-center border-none cursor-pointer transition-colors shrink-0 ${
            noteText ? 'bg-brand-bg text-brand' : 'bg-transparent text-txt-3 hover:bg-subtle'
          }`}
          onClick={() => setNoteOpen(!noteOpen)}
          title={noteText || 'Add note'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* Log Gap button */}
        {(isLow || (!isAssessed && onCreateGap)) && onCreateGap && (
          <button
            className="text-[0.65rem] font-semibold text-red bg-red-bg border-none rounded-md px-2 py-1 cursor-pointer font-sans hover:bg-red/10 transition-colors shrink-0"
            onClick={() => onCreateGap(safeguard)}
          >
            Log Gap
          </button>
        )}
      </div>

      {/* Expanded description */}
      {expanded && (
        <div className="px-3 pb-2 animate-[fadeIn_0.15s_ease]">
          <p className="text-[0.75rem] text-txt-2 leading-relaxed pl-[calc(0.5rem+2px)]">{safeguard.desc}</p>
          {hasAiDiff && (
            <div className="flex items-center gap-2 mt-1.5 pl-[calc(0.5rem+2px)]">
              <span className="text-[0.7rem] text-purple-600">
                AI suggests: {POLICY_STATUSES.find((s) => s.id === aiSuggestion.policy)?.label || '—'} / {IMPLEMENTATION_STATUSES.find((s) => s.id === aiSuggestion.implementation)?.label || '—'}
              </span>
              {aiSuggestion.rationale && <span className="text-[0.68rem] text-txt-3 italic">{aiSuggestion.rationale}</span>}
            </div>
          )}
        </div>
      )}

      {/* Note editor */}
      {noteOpen && (
        <div className="px-3 pb-2 flex items-center gap-2 animate-[fadeIn_0.15s_ease]">
          <input
            type="text"
            className="flex-1 bg-white border border-border rounded-lg px-3 py-1.5 text-[0.78rem] font-sans text-txt outline-none focus:border-brand focus:ring-1 focus:ring-brand/15"
            placeholder="Assessment note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNote() }}
          />
          <button
            className="text-[0.75rem] font-semibold text-brand border-none bg-transparent cursor-pointer font-sans hover:underline"
            onClick={saveNote}
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}
