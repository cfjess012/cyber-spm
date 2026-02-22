import React, { useState } from 'react'
import { HEALTH_STATUSES } from '../../data/constants.js'
import { computeGroupScore, scoreToMaturity, scoreColor, scoreBg } from '../../utils/safeguardScoring.js'
import { getMaturityLevel, MATURITY_LEVELS } from '../../data/frameworks.js'
import SafeguardRow from './SafeguardRow.jsx'

export default function SafeguardGroupCard({
  group,             // { id, num?, name, desc?, color?, bg?, safeguards: [...] }
  mappedObjects,     // array of objects mapped to this group
  assessments,       // { [safeguardId]: { policy, implementation, note } }
  overrideData,      // { level, note, timestamp } or null
  onAssess,          // (safeguardId, { policy, implementation, note }) => void
  onCreateGap,       // (safeguard) => void
  onOverride,        // (level, note) => void
  onClearOverride,   // () => void
  onNavigate,        // (page, objectId) => void
  igFilter,          // optional CIS IG filter
  showIG,            // show IG badges on rows
  aiSuggestions,     // { [safeguardId]: { policy, implementation, rationale } }
  onApplyAi,         // (safeguardId) => void
  autoMaturity,      // from deriveMaturity (the old L0-L2 score)
  borderColor,       // optional left-border color for grouped display
}) {
  const [expanded, setExpanded] = useState(false)
  const [overrideEditing, setOverrideEditing] = useState(false)
  const [overrideLevel, setOverrideLevel] = useState('')
  const [overrideNote, setOverrideNote] = useState('')

  const safeguards = group.safeguards || []
  const groupResult = computeGroupScore(safeguards, assessments, igFilter)
  const safeguardMaturity = groupResult.assessed > 0 ? scoreToMaturity(groupResult.score) : null
  const effectiveMaturity = overrideData?.level != null
    ? overrideData.level
    : safeguardMaturity != null
    ? safeguardMaturity
    : (autoMaturity ?? 0)

  const maturityInfo = getMaturityLevel(effectiveMaturity)
  const hasSafeguardData = safeguardMaturity != null

  const saveOverride = () => {
    const level = parseInt(overrideLevel)
    if (isNaN(level) || level < 0 || level > 5) return
    onOverride?.(level, overrideNote.trim())
    setOverrideEditing(false)
    setOverrideLevel('')
    setOverrideNote('')
  }

  return (
    <div className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md ${expanded ? 'border-brand/20' : 'border-white/50'}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors duration-150 rounded-xl hover:bg-brand/[0.015]"
        onClick={() => setExpanded(!expanded)}
        style={borderColor ? { borderLeft: `4px solid ${borderColor}` } : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-[0.65rem] flex-1 min-w-0">
          <span className="text-[0.72rem] font-[800] text-brand bg-brand-bg w-8 h-8 rounded-lg flex items-center justify-center shrink-0 tracking-tight" style={group.color ? { color: group.color, backgroundColor: group.bg || '#f1f5f9' } : undefined}>
            {group.num || group.id.split('-').pop()}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[0.85rem] font-semibold text-txt tracking-tight truncate">{group.name}</span>
            <span className="text-[0.72rem] text-txt-3">
              {mappedObjects?.length || 0} object{(mappedObjects?.length || 0) !== 1 ? 's' : ''}
              {' · '}
              {groupResult.assessed}/{groupResult.total} assessed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-[0.45rem] shrink-0">
          {/* Safeguard score ring */}
          {groupResult.assessed > 0 && (
            <span
              className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: scoreBg(groupResult.score), color: scoreColor(groupResult.score) }}
            >
              {Math.round(groupResult.score * 100)}%
            </span>
          )}
          {overrideData && (
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-amber bg-amber-bg px-2 py-0.5 rounded-full">Override</span>
          )}
          <span
            className="text-[0.72rem] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: maturityInfo.bg, color: maturityInfo.color }}
          >
            L{effectiveMaturity} — {maturityInfo.label}
          </span>
          <span className={`text-txt-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 animate-[fadeIn_0.18s_ease]">
          {group.desc && <p className="text-[0.82rem] text-txt-2 leading-[1.7] mb-3">{group.desc}</p>}

          {/* Mapped Objects */}
          {mappedObjects && mappedObjects.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-2">Mapped Objects</h4>
              <div className="flex flex-col gap-[0.15rem]">
                {mappedObjects.map((obj) => {
                  const h = HEALTH_STATUSES.find((s) => s.id === obj.healthStatus) || HEALTH_STATUSES[2]
                  return (
                    <div key={obj.id} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-subtle" onClick={() => onNavigate?.('object-detail', obj.id)}>
                      <span className="flex-1 font-medium text-[0.82rem]">{obj.listName}</span>
                      <span className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: h.bg, color: h.color }}>{h.label}</span>
                      <span className="text-[0.75rem] font-bold text-txt-2">{obj.compliancePercent}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {mappedObjects && mappedObjects.length === 0 && (
            <div className="flex items-center gap-2 bg-red-bg border border-red/10 rounded-lg px-3 py-2.5 text-[0.82rem] text-red mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>No objects in your inventory map to this group. This is a <strong>blind spot</strong>.</span>
            </div>
          )}

          {/* Safeguard Rows */}
          {safeguards.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-2">
                Safeguards ({safeguards.length})
              </h4>
              <div className="border border-border-light rounded-lg overflow-hidden bg-white/50">
                {safeguards.filter((sg) => {
                  if (!igFilter || !sg.ig) return true
                  return Math.min(...sg.ig) <= igFilter
                }).map((sg) => (
                  <SafeguardRow
                    key={sg.id}
                    safeguard={sg}
                    assessment={assessments?.[sg.id]}
                    onAssess={onAssess}
                    onCreateGap={onCreateGap}
                    showIG={showIG}
                    aiSuggestion={aiSuggestions?.[sg.id]}
                    onApplyAi={onApplyAi}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Maturity source + override */}
          <div className="border-t border-border-light pt-3 mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-[0.35rem] flex-wrap">
              {hasSafeguardData ? (
                <>
                  <span className="text-[0.82rem] text-txt-2">Safeguard-derived</span>
                  <span className="text-[0.7rem] font-bold px-[0.45rem] py-[0.12rem] rounded-full whitespace-nowrap" style={{ backgroundColor: getMaturityLevel(safeguardMaturity).bg, color: getMaturityLevel(safeguardMaturity).color }}>
                    L{safeguardMaturity} — {getMaturityLevel(safeguardMaturity).label}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[0.82rem] text-txt-2">Auto-estimated (max L2)</span>
                  <span className="text-[0.7rem] font-bold px-[0.45rem] py-[0.12rem] rounded-full whitespace-nowrap" style={{ backgroundColor: getMaturityLevel(autoMaturity ?? 0).bg, color: getMaturityLevel(autoMaturity ?? 0).color }}>
                    L{autoMaturity ?? 0} — {getMaturityLevel(autoMaturity ?? 0).label}
                  </span>
                  <span className="text-[0.7rem] text-txt-3 italic">Assess safeguards for accurate scoring</span>
                </>
              )}
            </div>
            {overrideData ? (
              <div className="flex items-center gap-[0.45rem] text-[0.78rem]">
                <span className="text-[0.82rem] text-txt-2">Override: L{overrideData.level}</span>
                {overrideData.note && <span className="text-[0.75rem] text-txt-2 italic">{overrideData.note}</span>}
                <button className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline" onClick={() => onClearOverride?.()}>Remove override</button>
              </div>
            ) : overrideEditing ? (
              <div className="flex items-center gap-[0.35rem] flex-wrap">
                <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={overrideLevel} onChange={(e) => setOverrideLevel(e.target.value)}>
                  <option value="">Select level...</option>
                  {MATURITY_LEVELS.map((l) => (
                    <option key={l.level} value={l.level}>L{l.level} — {l.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Rationale (optional)"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 min-w-[150px]"
                />
                <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={saveOverride}>Save</button>
                <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setOverrideEditing(false)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Cancel</button>
              </div>
            ) : (
              <button className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline self-start" onClick={() => { setOverrideEditing(true); setOverrideLevel(''); setOverrideNote('') }}>
                Manual override
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
