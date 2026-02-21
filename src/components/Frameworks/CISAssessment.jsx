import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { CIS_CONTROLS, MATURITY_LEVELS, computeCISAssessment, getMaturityLevel } from '../../data/frameworks.js'
import { HEALTH_STATUSES } from '../../data/constants.js'
import { assessFramework, assessFrameworkControls } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'

// ── Radar Chart (SVG) ──
function RadarChart({ controls, size = 360 }) {
  const cx = size / 2, cy = size / 2
  const maxR = size / 2 - 50
  const n = controls.length
  const angleStep = (2 * Math.PI) / n

  const polar = (i, r) => {
    const a = -Math.PI / 2 + i * angleStep
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  // Grid rings (levels 1-5)
  const rings = [1, 2, 3, 4, 5]
  const ringPaths = rings.map((level) => {
    const r = (level / 5) * maxR
    return controls.map((_, i) => polar(i, r)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
  })

  // Spoke lines
  const spokes = controls.map((_, i) => {
    const outer = polar(i, maxR)
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y }
  })

  // Data polygon
  const dataPoints = controls.map((c, i) => polar(i, (c.maturity / 5) * maxR))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  // Labels
  const labelOffset = maxR + 28
  const labels = controls.map((c, i) => {
    const p = polar(i, labelOffset)
    const angle = -Math.PI / 2 + i * angleStep
    let anchor = 'middle'
    if (Math.cos(angle) > 0.3) anchor = 'start'
    else if (Math.cos(angle) < -0.3) anchor = 'end'
    return { ...p, anchor, text: c.num, name: c.name, maturity: c.maturity }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[420px] h-auto">
      {/* Grid rings */}
      {ringPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth={i === 4 ? "1.5" : "0.8"} opacity={i === 4 ? 1 : 0.6} />
      ))}
      {/* Spokes */}
      {spokes.map((s, i) => (
        <line key={i} {...s} stroke="#e5e7eb" strokeWidth="0.6" />
      ))}
      {/* Data fill */}
      <path d={dataPath} fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Data dots */}
      {dataPoints.map((p, i) => {
        const info = getMaturityLevel(controls[i].maturity)
        return (
          <circle key={i} cx={p.x} cy={p.y} r="5" fill={info.color} stroke="white" strokeWidth="2" />
        )
      })}
      {/* Labels */}
      {labels.map((l, i) => (
        <g key={i}>
          <text
            x={l.x} y={l.y - 4}
            textAnchor={l.anchor}
            fontSize="9"
            fontWeight="700"
            fill="#374151"
            fontFamily="Inter,sans-serif"
          >
            {l.text}
          </text>
        </g>
      ))}
      {/* Level labels on axis */}
      {rings.map((level) => {
        const p = polar(0, (level / 5) * maxR)
        return (
          <text key={level} x={p.x + 4} y={p.y - 3} fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">{level}</text>
        )
      })}
    </svg>
  )
}

export default function CISAssessment({ onNavigate }) {
  const { objects, mlgAssessments, frameworkOverrides } = useStore()
  const dispatch = useDispatch()
  const [expandedControl, setExpandedControl] = useState(null)
  const [overrideEditing, setOverrideEditing] = useState(null)
  const [overrideLevel, setOverrideLevel] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  // Enterprise-level AI assessment suggestions per control
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiAssessLoading, setAiAssessLoading] = useState(false)
  const [aiAssessError, setAiAssessError] = useState(null)

  const cisOverrides = (frameworkOverrides || {})['cis-v8'] || {}

  const assessment = useMemo(
    () => computeCISAssessment(objects, mlgAssessments, cisOverrides),
    [objects, mlgAssessments, cisOverrides]
  )

  const blindSpots = assessment.controls.filter((c) => c.objects.length === 0)
  const levelDist = useMemo(() => {
    const dist = MATURITY_LEVELS.map((l) => ({ ...l, count: 0 }))
    assessment.controls.forEach((c) => dist[c.maturity].count++)
    return dist
  }, [assessment])

  // ── AI Board Report (markdown slide panel) ──
  const handleAiReport = async () => {
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = {
        framework: 'CIS Controls v8',
        controls: assessment.controls.map((c) => ({
          id: c.id,
          name: c.name,
          maturity: c.maturity,
          maturityLabel: c.maturityInfo.label,
          objectCount: c.objects.length,
          objects: c.objects.map((o) => ({
            name: o.listName,
            health: o.healthStatus,
            compliance: o.compliancePercent,
            controlClassification: o.controlClassification,
          })),
        })),
        overallScore: assessment.overallScore,
        blindSpots: blindSpots.map((c) => c.name),
      }
      const res = await assessFramework(payload)
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI Enterprise-Level Control Assessment (structured JSON) ──
  const handleAiEnterprise = async () => {
    setAiAssessLoading(true)
    setAiAssessError(null)
    try {
      const payload = {
        framework: 'CIS Controls v8',
        controls: CIS_CONTROLS.map((c) => {
          const ctrl = assessment.controls.find((ac) => ac.id === c.id)
          return {
            id: c.id,
            name: c.name,
            description: c.desc,
            currentAutoLevel: ctrl?.autoMaturity ?? 0,
            mappedObjects: (ctrl?.objects || []).map((o) => ({
              name: o.listName,
              type: o.type,
              productFamilies: o.productFamilies,
              health: o.healthStatus,
              compliance: o.compliancePercent,
              controlClassification: o.controlClassification,
              nistFamilies: o.nistFamilies,
              criticality: o.criticality,
            })),
          }
        }),
      }
      const res = await assessFrameworkControls(payload)
      // Build suggestion map: { controlId: { level, rationale } }
      const map = {}
      for (const item of res.controls || []) {
        const level = Math.max(0, Math.min(5, Math.round(Number(item.level) || 0)))
        map[item.id] = { level, rationale: item.rationale || '' }
      }
      setAiSuggestions(map)
    } catch (err) {
      setAiAssessError(err.message)
    } finally {
      setAiAssessLoading(false)
    }
  }

  const applyAllAiSuggestions = () => {
    if (!aiSuggestions) return
    for (const [controlId, suggestion] of Object.entries(aiSuggestions)) {
      dispatch({
        type: 'SET_FRAMEWORK_OVERRIDE',
        payload: {
          framework: 'cis-v8',
          controlId,
          level: suggestion.level,
          note: `AI enterprise assessment: ${suggestion.rationale}`,
        },
      })
    }
    setAiSuggestions(null)
  }

  const applyAiSuggestion = (controlId) => {
    const s = aiSuggestions?.[controlId]
    if (!s) return
    dispatch({
      type: 'SET_FRAMEWORK_OVERRIDE',
      payload: {
        framework: 'cis-v8',
        controlId,
        level: s.level,
        note: `AI enterprise assessment: ${s.rationale}`,
      },
    })
  }

  const saveOverride = (controlId) => {
    const level = parseInt(overrideLevel)
    if (isNaN(level) || level < 0 || level > 5) return
    dispatch({
      type: 'SET_FRAMEWORK_OVERRIDE',
      payload: {
        framework: 'cis-v8',
        controlId,
        level,
        note: overrideNote.trim(),
      },
    })
    setOverrideEditing(null)
    setOverrideLevel('')
    setOverrideNote('')
  }

  const clearOverride = (controlId) => {
    dispatch({
      type: 'CLEAR_FRAMEWORK_OVERRIDE',
      payload: { framework: 'cis-v8', controlId },
    })
  }

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">CIS Controls v8</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Enterprise maturity assessment across 18 control groups — run AI Enterprise Assess for accurate scoring</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <AiButton onClick={handleAiEnterprise} loading={aiAssessLoading}>AI Enterprise Assess</AiButton>
          <AiButton onClick={handleAiReport} loading={aiLoading} className="small">Board Report</AiButton>
        </div>
      </div>

      <AiSlidePanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="CIS v8 — Board Report"
        loading={aiLoading}
        content={aiContent}
      >
        {aiError && <AiError error={aiError} onRetry={handleAiReport} />}
      </AiSlidePanel>

      {/* AI Enterprise Assessment Banner */}
      {aiAssessError && (
        <div className="bg-red-bg border border-red/15 rounded-xl p-4 mb-5">
          <AiError error={aiAssessError} onRetry={handleAiEnterprise} />
        </div>
      )}
      {aiSuggestions && (
        <div className="bg-ai-bg border border-purple-200/40 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-[0.45rem] flex-wrap">
              <span className="inline-flex text-purple-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                </svg>
              </span>
              <strong className="text-[0.85rem] text-purple-700">AI Enterprise Assessment Complete</strong>
              <span className="text-[0.78rem] text-txt-2">
                {Object.keys(aiSuggestions).length} controls assessed — review per-control suggestions below or apply all
              </span>
            </div>
            <div className="flex gap-[0.35rem]">
              <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={applyAllAiSuggestions}>Apply All</button>
              <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setAiSuggestions(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Score Summary */}
      <div className="grid grid-cols-[1fr_1fr] gap-5 mb-5 max-md:grid-cols-1">
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex items-center gap-5">
          <div className="relative w-[95px] h-[95px] shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50"
                fill="none"
                stroke={assessment.overallLevel.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - assessment.overallScore / 5)}`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[1.65rem] font-[800] leading-none tracking-tight">{assessment.overallScore}</span>
              <span className="text-[0.75rem] text-txt-3 font-semibold">/5</span>
            </div>
          </div>
          <div className="flex-1">
            <span className="inline-block text-[0.72rem] font-bold px-3 py-1 rounded-full mb-2" style={{ backgroundColor: assessment.overallLevel.bg, color: assessment.overallLevel.color }}>
              {assessment.overallLevel.label}
            </span>
            <div className="text-[0.78rem] text-txt-2 flex flex-col gap-[0.2rem]">
              <span>{assessment.controls.filter((c) => c.maturity >= 3).length} of 18 controls at Defined+</span>
              {blindSpots.length > 0 && (
                <span className="text-red font-bold">{blindSpots.length} blind spot{blindSpots.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex flex-col justify-center gap-[0.45rem]">
          {levelDist.filter((l) => l.count > 0).map((l) => (
            <div key={l.level} className="flex items-center gap-[0.55rem]">
              <span className="text-[0.75rem] font-semibold w-[85px]" style={{ color: l.color }}>{l.label}</span>
              <div className="flex-1 h-[7px] bg-subtle rounded overflow-hidden">
                <div className="h-full rounded transition-all duration-500" style={{ width: `${(l.count / 18) * 100}%`, backgroundColor: l.color, minWidth: '2px' }} />
              </div>
              <span className="text-[0.78rem] font-bold w-5 text-right">{l.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 mb-5">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Maturity Radar</h3>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 bg-subtle px-2.5 py-1 rounded-full">18 controls</span>
        </div>
        <div className="flex justify-center py-3">
          <RadarChart controls={assessment.controls} />
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 px-5 pb-4 max-md:grid-cols-2">
          {CIS_CONTROLS.map((c) => (
            <span key={c.id} className="text-[0.7rem] text-txt-2 leading-relaxed">
              <strong className="text-txt mr-[0.15rem]">{c.num}.</strong> {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* Control Cards */}
      <div className="mt-5">
        <h2 className="text-[0.82rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-3">Control Details</h2>
        <div className="flex flex-col gap-[0.35rem]">
          {assessment.controls.map((ctrl) => {
            const expanded = expandedControl === ctrl.id
            const aiSug = aiSuggestions?.[ctrl.id]
            const hasDiff = aiSug && aiSug.level !== ctrl.maturity
            return (
              <div key={ctrl.id} className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md ${expanded ? 'border-brand/20' : 'border-white/50'} ${hasDiff ? 'border-purple-400/25' : ''}`}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors duration-150 rounded-xl hover:bg-brand/[0.015]"
                  onClick={() => setExpandedControl(expanded ? null : ctrl.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedControl(expanded ? null : ctrl.id) } }}
                >
                  <div className="flex items-center gap-[0.65rem] flex-1 min-w-0">
                    <span className="text-[0.72rem] font-[800] text-brand bg-brand-bg w-8 h-8 rounded-lg flex items-center justify-center shrink-0 tracking-tight">{ctrl.num}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[0.85rem] font-semibold text-txt tracking-tight truncate">{ctrl.name}</span>
                      <span className="text-[0.72rem] text-txt-3">
                        {ctrl.objects.length === 0
                          ? 'No coverage'
                          : `${ctrl.objects.length} object${ctrl.objects.length !== 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[0.45rem] shrink-0">
                    {hasDiff && (
                      <span className="text-[0.7rem] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full" title={aiSug.rationale}>
                        AI: L{aiSug.level}
                      </span>
                    )}
                    {ctrl.override && (
                      <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-amber bg-amber-bg px-2 py-0.5 rounded-full" title={ctrl.override.note || 'Manual override'}>Override</span>
                    )}
                    <span
                      className="text-[0.72rem] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: ctrl.maturityInfo.bg, color: ctrl.maturityInfo.color }}
                    >
                      L{ctrl.maturity} — {ctrl.maturityInfo.label}
                    </span>
                    <span className={`text-txt-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </span>
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 animate-[fadeIn_0.18s_ease]">
                    {hasDiff && (
                      <div className="flex items-start justify-between gap-3 bg-purple-50/60 border border-purple-200/30 rounded-lg p-3 mb-3">
                        <div className="flex items-start gap-[0.35rem] flex-1">
                          <span className="inline-flex text-purple-500 mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                            </svg>
                          </span>
                          <div>
                            <strong className="text-[0.82rem] text-purple-700 block">AI suggests L{aiSug.level} ({getMaturityLevel(aiSug.level).label})</strong>
                            <span className="text-[0.78rem] text-txt-2 block mt-0.5 leading-relaxed">{aiSug.rationale}</span>
                          </div>
                        </div>
                        <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); applyAiSuggestion(ctrl.id) }}>
                          Apply
                        </button>
                      </div>
                    )}
                    <p className="text-[0.82rem] text-txt-2 leading-[1.7] mb-3">{ctrl.desc}</p>

                    {ctrl.objects.length === 0 ? (
                      <div className="flex items-center gap-2 bg-red-bg border border-red/10 rounded-lg px-3 py-2.5 text-[0.82rem] text-red">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>No objects in your inventory map to this control. This is a <strong>blind spot</strong> in your security posture.</span>
                      </div>
                    ) : (
                      <div className="mb-[0.65rem]">
                        <h4 className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-2">Mapped Objects</h4>
                        <div className="flex flex-col gap-[0.15rem]">
                          {ctrl.objects.map((obj) => {
                            const h = HEALTH_STATUSES.find((s) => s.id === obj.healthStatus) || HEALTH_STATUSES[2]
                            return (
                              <div key={obj.id} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-subtle" onClick={() => onNavigate('object-detail', obj.id)}>
                                <span className="flex-1 font-medium text-[0.82rem]">{obj.listName}</span>
                                <span className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: h.bg, color: h.color }}>{h.label}</span>
                                <span className="text-[0.75rem] font-bold text-txt-2">{obj.compliancePercent}%</span>
                                <span className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full ${obj.controlClassification.toLowerCase() === 'formal' ? 'bg-brand-bg text-brand' : 'bg-subtle text-txt-3'}`}>{obj.controlClassification}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Auto vs Override */}
                    <div className="border-t border-border-light pt-3 mt-3 flex flex-col gap-2">
                      <div className="flex items-center gap-[0.35rem] flex-wrap">
                        <span className="text-[0.82rem] text-txt-2">Auto-estimated (max L2)</span>
                        <span className="text-[0.7rem] font-bold px-[0.45rem] py-[0.12rem] rounded-full whitespace-nowrap" style={{ backgroundColor: getMaturityLevel(ctrl.autoMaturity).bg, color: getMaturityLevel(ctrl.autoMaturity).color }}>
                          L{ctrl.autoMaturity} — {getMaturityLevel(ctrl.autoMaturity).label}
                        </span>
                        {!ctrl.override && <span className="text-[0.7rem] text-txt-3 italic">Use AI Enterprise Assess for accurate L3+ scoring</span>}
                      </div>
                      {ctrl.override ? (
                        <div className="flex items-center gap-[0.45rem] text-[0.78rem]">
                          <span className="text-[0.82rem] text-txt-2">Override: L{ctrl.override.level}</span>
                          {ctrl.override.note && <span className="text-[0.75rem] text-txt-2 italic">{ctrl.override.note}</span>}
                          <button className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline" onClick={() => clearOverride(ctrl.id)}>Remove override</button>
                        </div>
                      ) : overrideEditing === ctrl.id ? (
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
                          <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={() => saveOverride(ctrl.id)}>Save</button>
                          <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setOverrideEditing(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <button className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline self-start" onClick={() => { setOverrideEditing(ctrl.id); setOverrideLevel(''); setOverrideNote('') }}>
                          Manual override
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
