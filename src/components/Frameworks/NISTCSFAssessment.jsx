import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { NIST_CSF_FUNCTIONS, MATURITY_LEVELS, computeCSFAssessment, getMaturityLevel } from '../../data/frameworks.js'
import { HEALTH_STATUSES } from '../../data/constants.js'
import { assessFramework, assessFrameworkControls } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'

// ── Function Radar (hexagonal, 6 points) ──
function CSFRadar({ functions, size = 320 }) {
  const cx = size / 2, cy = size / 2
  const maxR = size / 2 - 55
  const n = functions.length
  const angleStep = (2 * Math.PI) / n

  const polar = (i, r) => {
    const a = -Math.PI / 2 + i * angleStep
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  const rings = [1, 2, 3, 4, 5]
  const ringPaths = rings.map((level) => {
    const r = (level / 5) * maxR
    return functions.map((_, i) => polar(i, r)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
  })

  const dataPoints = functions.map((f, i) => polar(i, (f.maturity / 5) * maxR))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  const labelOffset = maxR + 36

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[420px] h-auto">
      {/* Grid rings */}
      {ringPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth={i === 4 ? "1.5" : "0.8"} opacity={i === 4 ? 1 : 0.6} />
      ))}
      {/* Spokes */}
      {functions.map((_, i) => {
        const outer = polar(i, maxR)
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#e5e7eb" strokeWidth="0.6" />
      })}
      {/* Data fill with gradient effect */}
      <path d={dataPath} fill="rgba(139,92,246,0.12)" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Data dots + function labels */}
      {functions.map((f, i) => {
        const p = dataPoints[i]
        const lp = polar(i, labelOffset)
        const angle = -Math.PI / 2 + i * angleStep
        let anchor = 'middle'
        if (Math.cos(angle) > 0.3) anchor = 'start'
        else if (Math.cos(angle) < -0.3) anchor = 'end'
        return (
          <g key={f.id}>
            <circle cx={p.x} cy={p.y} r="6" fill={f.color} stroke="white" strokeWidth="2" />
            <text x={lp.x} y={lp.y - 6} textAnchor={anchor} fontSize="10" fontWeight="700" fill={f.color} fontFamily="Inter,sans-serif">
              {f.name}
            </text>
            <text x={lp.x} y={lp.y + 6} textAnchor={anchor} fontSize="8" fill="#9ca3af" fontFamily="Inter,sans-serif">
              L{f.maturity.toFixed(1)}
            </text>
          </g>
        )
      })}
      {/* Center level labels */}
      {rings.map((level) => {
        const p = polar(0, (level / 5) * maxR)
        return (
          <text key={level} x={p.x + 3} y={p.y - 3} fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif">{level}</text>
        )
      })}
    </svg>
  )
}

// ── Function Bar Chart ──
function FunctionBars({ functions }) {
  return (
    <div className="w-full flex flex-col gap-2">
      {functions.map((f) => (
        <div key={f.id} className="flex items-center gap-[0.55rem]">
          <div className="flex items-center gap-[0.35rem] w-[105px] shrink-0" style={{ color: f.color }}>
            <span className="text-[0.7rem] font-[800]">{f.id}</span>
            <span className="text-[0.75rem] font-semibold">{f.name}</span>
          </div>
          <div className="flex-1 h-[10px] bg-subtle rounded-[5px] relative overflow-hidden">
            <div
              className="h-full rounded-[5px] transition-all duration-[400ms]"
              style={{ width: `${(f.maturity / 5) * 100}%`, backgroundColor: f.color }}
            />
            {[1, 2, 3, 4].map((l) => (
              <div key={l} className="absolute top-0 bottom-0 w-px bg-white/35" style={{ left: `${(l / 5) * 100}%` }} />
            ))}
          </div>
          <span className="text-[0.78rem] font-[800] w-7 text-right" style={{ color: f.color }}>{f.maturity.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export default function NISTCSFAssessment({ onNavigate }) {
  const { objects, mlgAssessments, frameworkOverrides } = useStore()
  const dispatch = useDispatch()
  const [expandedFunc, setExpandedFunc] = useState(null)
  const [expandedCat, setExpandedCat] = useState(null)
  const [overrideEditing, setOverrideEditing] = useState(null)
  const [overrideLevel, setOverrideLevel] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiAssessLoading, setAiAssessLoading] = useState(false)
  const [aiAssessError, setAiAssessError] = useState(null)

  const csfOverrides = (frameworkOverrides || {})['nist-csf'] || {}

  const assessment = useMemo(
    () => computeCSFAssessment(objects, mlgAssessments, csfOverrides),
    [objects, mlgAssessments, csfOverrides]
  )

  const totalCats = assessment.functions.reduce((s, f) => s + f.categories.length, 0)
  const blindCats = assessment.functions.reduce(
    (s, f) => s + f.categories.filter((c) => c.objects.length === 0).length, 0
  )

  const handleAiReport = async () => {
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = {
        framework: 'NIST CSF 2.0',
        functions: assessment.functions.map((f) => ({
          id: f.id,
          name: f.name,
          maturity: f.maturity,
          categories: f.categories.map((c) => ({
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
        })),
        overallScore: assessment.overallScore,
        blindSpots: assessment.functions.flatMap((f) =>
          f.categories.filter((c) => c.objects.length === 0).map((c) => `${c.id}: ${c.name}`)
        ),
      }
      const res = await assessFramework(payload)
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiEnterprise = async () => {
    setAiAssessLoading(true)
    setAiAssessError(null)
    try {
      const allCats = assessment.functions.flatMap((f) =>
        f.categories.map((c) => ({
          id: c.id,
          name: c.name,
          function: f.name,
          description: f.desc,
          currentAutoLevel: c.autoMaturity,
          mappedObjects: c.objects.map((o) => ({
            name: o.listName,
            type: o.type,
            productFamilies: o.productFamilies,
            health: o.healthStatus,
            compliance: o.compliancePercent,
            controlClassification: o.controlClassification,
            nistFamilies: o.nistFamilies,
            criticality: o.criticality,
          })),
        }))
      )
      const res = await assessFrameworkControls({
        framework: 'NIST CSF 2.0',
        controls: allCats,
      })
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
    for (const [catId, suggestion] of Object.entries(aiSuggestions)) {
      dispatch({
        type: 'SET_FRAMEWORK_OVERRIDE',
        payload: {
          framework: 'nist-csf',
          controlId: catId,
          level: suggestion.level,
          note: `AI enterprise assessment: ${suggestion.rationale}`,
        },
      })
    }
    setAiSuggestions(null)
  }

  const applyAiSuggestion = (catId) => {
    const s = aiSuggestions?.[catId]
    if (!s) return
    dispatch({
      type: 'SET_FRAMEWORK_OVERRIDE',
      payload: {
        framework: 'nist-csf',
        controlId: catId,
        level: s.level,
        note: `AI enterprise assessment: ${s.rationale}`,
      },
    })
  }

  const saveOverride = (catId) => {
    const level = parseInt(overrideLevel)
    if (isNaN(level) || level < 0 || level > 5) return
    dispatch({
      type: 'SET_FRAMEWORK_OVERRIDE',
      payload: {
        framework: 'nist-csf',
        controlId: catId,
        level,
        note: overrideNote.trim(),
      },
    })
    setOverrideEditing(null)
    setOverrideLevel('')
    setOverrideNote('')
  }

  const clearOverride = (catId) => {
    dispatch({
      type: 'CLEAR_FRAMEWORK_OVERRIDE',
      payload: { framework: 'nist-csf', controlId: catId },
    })
  }

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">NIST CSF 2.0</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Enterprise maturity across 6 functions and {totalCats} categories — run AI Enterprise Assess for accurate scoring</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <AiButton onClick={handleAiEnterprise} loading={aiAssessLoading}>AI Enterprise Assess</AiButton>
          <AiButton onClick={handleAiReport} loading={aiLoading} className="small">Board Report</AiButton>
        </div>
      </div>

      <AiSlidePanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="NIST CSF 2.0 — Board Report"
        loading={aiLoading}
        content={aiContent}
      >
        {aiError && <AiError error={aiError} onRetry={handleAiReport} />}
      </AiSlidePanel>

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
                {Object.keys(aiSuggestions).length} categories assessed — review suggestions below or apply all
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
              <span>6 functions, {totalCats} categories assessed</span>
              {blindCats > 0 && (
                <span className="text-red font-bold">{blindCats} blind spot{blindCats !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex flex-col justify-center">
          <FunctionBars functions={assessment.functions} />
        </div>
      </div>

      {/* Radar */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 mb-5">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Function Radar</h3>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 bg-subtle px-2.5 py-1 rounded-full">6 functions</span>
        </div>
        <div className="flex justify-center py-3 max-w-[360px] mx-auto">
          <CSFRadar functions={assessment.functions} />
        </div>
      </div>

      {/* Function Cards */}
      <div className="mt-5">
        <h2 className="text-[0.82rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-3">Function Details</h2>
        <div className="flex flex-col gap-[0.35rem]">
          {assessment.functions.map((func) => {
            const funcExpanded = expandedFunc === func.id
            const blindCount = func.categories.filter((c) => c.objects.length === 0).length
            return (
              <div key={func.id} className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 transition-all duration-200 hover:shadow-md">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors duration-150 rounded-xl hover:bg-brand/[0.015] border-l-4"
                  onClick={() => setExpandedFunc(funcExpanded ? null : func.id)}
                  style={{ borderLeftColor: func.color }}
                >
                  <div className="flex items-center gap-[0.65rem] flex-1">
                    <span className="text-[0.95rem] font-[800] shrink-0 tracking-tight" style={{ color: func.color }}>{func.id}</span>
                    <div>
                      <span className="font-semibold text-[0.88rem] block tracking-tight">{func.name}</span>
                      <span className="text-[0.72rem] text-txt-3 block">{func.categories.length} categories{blindCount > 0 ? ` \u00b7 ${blindCount} blind` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[0.45rem] shrink-0">
                    <span className="text-[0.72rem] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: func.maturityInfo.bg, color: func.maturityInfo.color }}>
                      L{func.maturity.toFixed(1)} — {func.maturityInfo.label}
                    </span>
                    <span className={`text-txt-3 transition-transform duration-200 ${funcExpanded ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </span>
                  </div>
                </div>

                {funcExpanded && (
                  <div className="px-4 pb-4 animate-[fadeIn_0.18s_ease]">
                    <p className="text-[0.82rem] text-txt-2 leading-[1.7] mb-3">{func.desc}</p>
                    <div className="flex flex-col gap-[0.25rem]">
                      {func.categories.map((cat) => {
                        const catExpanded = expandedCat === cat.id
                        const aiSug = aiSuggestions?.[cat.id]
                        const hasDiff = aiSug && aiSug.level !== cat.maturity
                        return (
                          <div key={cat.id} className={`bg-white/60 rounded-lg border transition-all duration-200 ${hasDiff ? 'border-purple-400/25' : 'border-border-light'}`}>
                            <div
                              className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors duration-150 rounded-lg hover:bg-subtle/50"
                              onClick={() => setExpandedCat(catExpanded ? null : cat.id)}
                            >
                              <div className="flex items-center gap-[0.45rem] flex-1">
                                <span className="text-[0.7rem] font-[800] text-txt-2">{cat.id}</span>
                                <span className="text-[0.82rem] font-medium">{cat.name}</span>
                                <span className="text-[0.7rem] text-txt-3 ml-[0.2rem]">{cat.objects.length} obj</span>
                              </div>
                              <div className="flex items-center gap-[0.45rem] shrink-0">
                                {hasDiff && (
                                  <span className="text-[0.7rem] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full" title={aiSug.rationale}>AI: L{aiSug.level}</span>
                                )}
                                {cat.override && <span className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-amber bg-amber-bg px-2 py-0.5 rounded-full">Override</span>}
                                <span className="text-[0.7rem] font-bold px-[0.45rem] py-[0.12rem] rounded-full whitespace-nowrap" style={{ backgroundColor: cat.maturityInfo.bg, color: cat.maturityInfo.color }}>
                                  L{cat.maturity}
                                </span>
                                <span className={`text-txt-3 transition-transform duration-200 ${catExpanded ? 'rotate-180' : ''}`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </span>
                              </div>
                            </div>

                            {catExpanded && (
                              <div className="px-3 pb-3 pt-1">
                                {hasDiff && (
                                  <div className="flex items-start justify-between gap-3 bg-purple-50/60 border border-purple-200/30 rounded-lg p-3 mb-2">
                                    <div className="flex items-start gap-[0.35rem] flex-1">
                                      <span className="inline-flex text-purple-500 mt-0.5">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                                        </svg>
                                      </span>
                                      <div>
                                        <strong className="text-[0.82rem] text-purple-700 block">AI suggests L{aiSug.level} ({getMaturityLevel(aiSug.level).label})</strong>
                                        <span className="text-[0.78rem] text-txt-2 block mt-0.5 leading-relaxed">{aiSug.rationale}</span>
                                      </div>
                                    </div>
                                    <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); applyAiSuggestion(cat.id) }}>Apply</button>
                                  </div>
                                )}
                                {cat.objects.length === 0 ? (
                                  <div className="flex items-center gap-2 bg-red-bg border border-red/10 rounded-lg px-3 py-2.5 text-[0.82rem] text-red">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    <span>No objects mapped — <strong>blind spot</strong></span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-[0.15rem]">
                                    {cat.objects.map((obj) => {
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
                                )}
                                <div className="border-t border-border-light pt-3 mt-3 flex flex-col gap-2">
                                  <div className="flex items-center gap-[0.35rem] flex-wrap">
                                    <span className="text-[0.82rem] text-txt-2">Auto-estimated (max L2)</span>
                                    <span className="text-[0.7rem] font-bold px-[0.45rem] py-[0.12rem] rounded-full whitespace-nowrap" style={{ backgroundColor: getMaturityLevel(cat.autoMaturity).bg, color: getMaturityLevel(cat.autoMaturity).color }}>
                                      L{cat.autoMaturity} — {getMaturityLevel(cat.autoMaturity).label}
                                    </span>
                                    {!cat.override && <span className="text-[0.7rem] text-txt-3 italic">Use AI Enterprise Assess for accurate L3+ scoring</span>}
                                  </div>
                                  {cat.override ? (
                                    <div className="flex items-center gap-[0.45rem] text-[0.78rem]">
                                      <span className="text-[0.82rem] text-txt-2">Override: L{cat.override.level}</span>
                                      {cat.override.note && <span className="text-[0.75rem] text-txt-2 italic">{cat.override.note}</span>}
                                      <button className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline" onClick={() => clearOverride(cat.id)}>Remove</button>
                                    </div>
                                  ) : overrideEditing === cat.id ? (
                                    <div className="flex items-center gap-[0.35rem] flex-wrap">
                                      <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={overrideLevel} onChange={(e) => setOverrideLevel(e.target.value)}>
                                        <option value="">Select level...</option>
                                        {MATURITY_LEVELS.map((l) => (
                                          <option key={l.level} value={l.level}>L{l.level} — {l.label}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="text"
                                        placeholder="Rationale"
                                        value={overrideNote}
                                        onChange={(e) => setOverrideNote(e.target.value)}
                                        className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 min-w-[150px]"
                                      />
                                      <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={() => saveOverride(cat.id)}>Save</button>
                                      <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setOverrideEditing(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline self-start" onClick={() => { setOverrideEditing(cat.id); setOverrideLevel(''); setOverrideNote('') }}>
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
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
