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
    <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg">
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
    <div className="csf-bars">
      {functions.map((f) => (
        <div key={f.id} className="csf-bar-row">
          <div className="csf-bar-label" style={{ color: f.color }}>
            <span className="csf-bar-func-id">{f.id}</span>
            <span className="csf-bar-func-name">{f.name}</span>
          </div>
          <div className="csf-bar-track">
            <div
              className="csf-bar-fill"
              style={{ width: `${(f.maturity / 5) * 100}%`, backgroundColor: f.color }}
            />
            {[1, 2, 3, 4].map((l) => (
              <div key={l} className="csf-bar-tick" style={{ left: `${(l / 5) * 100}%` }} />
            ))}
          </div>
          <span className="csf-bar-score" style={{ color: f.color }}>{f.maturity.toFixed(1)}</span>
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
    <div className="framework-assessment">
      <div className="page-header">
        <div>
          <h1>NIST CSF 2.0</h1>
          <p className="page-subtitle">Enterprise maturity across 6 functions and {totalCats} categories — run AI Enterprise Assess for accurate scoring</p>
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
        <div className="fw-ai-banner error">
          <AiError error={aiAssessError} onRetry={handleAiEnterprise} />
        </div>
      )}
      {aiSuggestions && (
        <div className="fw-ai-banner">
          <div className="fw-ai-banner-header">
            <div className="fw-ai-banner-left">
              <span className="ai-sparkle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                </svg>
              </span>
              <strong>AI Enterprise Assessment Complete</strong>
              <span className="fw-ai-banner-info">
                {Object.keys(aiSuggestions).length} categories assessed — review suggestions below or apply all
              </span>
            </div>
            <div className="fw-ai-banner-actions">
              <button className="btn-primary small" onClick={applyAllAiSuggestions}>Apply All</button>
              <button className="btn-secondary" onClick={() => setAiSuggestions(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Score Summary */}
      <div className="fw-summary-row">
        <div className="fw-score-card">
          <div className="fw-score-gauge">
            <svg viewBox="0 0 120 120">
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
            <div className="fw-score-center">
              <span className="fw-score-value">{assessment.overallScore}</span>
              <span className="fw-score-max">/5</span>
            </div>
          </div>
          <div className="fw-score-info">
            <span className="fw-tier-badge" style={{ backgroundColor: assessment.overallLevel.bg, color: assessment.overallLevel.color }}>
              {assessment.overallLevel.label}
            </span>
            <div className="fw-score-stats">
              <span>6 functions, {totalCats} categories assessed</span>
              {blindCats > 0 && (
                <span className="fw-blind-alert">{blindCats} blind spot{blindCats !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="fw-csf-bars-card">
          <FunctionBars functions={assessment.functions} />
        </div>
      </div>

      {/* Radar */}
      <div className="fw-radar-section dash-card">
        <div className="dash-card-header">
          <h3>Function Radar</h3>
          <span className="dash-card-badge">6 functions</span>
        </div>
        <div className="fw-radar-container csf-radar">
          <CSFRadar functions={assessment.functions} />
        </div>
      </div>

      {/* Function Cards */}
      <div className="fw-controls-section">
        <h2 className="trending-section-title">Function Details</h2>
        <div className="fw-controls-list">
          {assessment.functions.map((func) => {
            const funcExpanded = expandedFunc === func.id
            const blindCount = func.categories.filter((c) => c.objects.length === 0).length
            return (
              <div key={func.id} className="fw-func-card">
                <div
                  className="fw-func-header"
                  onClick={() => setExpandedFunc(funcExpanded ? null : func.id)}
                  style={{ borderLeftColor: func.color }}
                >
                  <div className="fw-func-left">
                    <span className="fw-func-id" style={{ color: func.color }}>{func.id}</span>
                    <div>
                      <span className="fw-func-name">{func.name}</span>
                      <span className="fw-func-meta">{func.categories.length} categories{blindCount > 0 ? ` · ${blindCount} blind` : ''}</span>
                    </div>
                  </div>
                  <div className="fw-control-right">
                    <span className="fw-maturity-badge" style={{ backgroundColor: func.maturityInfo.bg, color: func.maturityInfo.color }}>
                      L{func.maturity.toFixed(1)} — {func.maturityInfo.label}
                    </span>
                    <span className={`expand-chevron ${funcExpanded ? 'open' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </span>
                  </div>
                </div>

                {funcExpanded && (
                  <div className="fw-func-body">
                    <p className="fw-control-desc">{func.desc}</p>
                    <div className="fw-categories">
                      {func.categories.map((cat) => {
                        const catExpanded = expandedCat === cat.id
                        const aiSug = aiSuggestions?.[cat.id]
                        const hasDiff = aiSug && aiSug.level !== cat.maturity
                        return (
                          <div key={cat.id} className={`fw-cat-card ${hasDiff ? 'has-suggestion' : ''}`}>
                            <div
                              className="fw-cat-header"
                              onClick={() => setExpandedCat(catExpanded ? null : cat.id)}
                            >
                              <div className="fw-cat-left">
                                <span className="fw-cat-id">{cat.id}</span>
                                <span className="fw-cat-name">{cat.name}</span>
                                <span className="fw-cat-count">{cat.objects.length} obj</span>
                              </div>
                              <div className="fw-control-right">
                                {hasDiff && (
                                  <span className="ai-suggestion-hint" title={aiSug.rationale}>AI: L{aiSug.level}</span>
                                )}
                                {cat.override && <span className="fw-override-badge">Override</span>}
                                <span className="fw-maturity-badge small" style={{ backgroundColor: cat.maturityInfo.bg, color: cat.maturityInfo.color }}>
                                  L{cat.maturity}
                                </span>
                                <span className={`expand-chevron ${catExpanded ? 'open' : ''}`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </span>
                              </div>
                            </div>

                            {catExpanded && (
                              <div className="fw-cat-body">
                                {hasDiff && (
                                  <div className="fw-ai-suggestion" style={{ marginBottom: '0.5rem' }}>
                                    <div className="fw-ai-suggestion-content">
                                      <span className="ai-sparkle">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                                        </svg>
                                      </span>
                                      <div>
                                        <strong>AI suggests L{aiSug.level} ({getMaturityLevel(aiSug.level).label})</strong>
                                        <span className="fw-ai-rationale">{aiSug.rationale}</span>
                                      </div>
                                    </div>
                                    <button className="btn-primary small" onClick={(e) => { e.stopPropagation(); applyAiSuggestion(cat.id) }}>Apply</button>
                                  </div>
                                )}
                                {cat.objects.length === 0 ? (
                                  <div className="fw-no-coverage">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    <span>No objects mapped — <strong>blind spot</strong></span>
                                  </div>
                                ) : (
                                  <div className="fw-obj-list">
                                    {cat.objects.map((obj) => {
                                      const h = HEALTH_STATUSES.find((s) => s.id === obj.healthStatus) || HEALTH_STATUSES[2]
                                      return (
                                        <div key={obj.id} className="fw-obj-row" onClick={() => onNavigate('object-detail', obj.id)}>
                                          <span className="fw-obj-name">{obj.listName}</span>
                                          <span className="health-tag" style={{ backgroundColor: h.bg, color: h.color }}>{h.label}</span>
                                          <span className="fw-obj-comp">{obj.compliancePercent}%</span>
                                          <span className={`fw-obj-ctrl ${obj.controlClassification.toLowerCase()}`}>{obj.controlClassification}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                <div className="fw-maturity-detail">
                                  <div className="fw-maturity-auto">
                                    <span className="field-label">Auto-estimated (max L2)</span>
                                    <span className="fw-maturity-badge small" style={{ backgroundColor: getMaturityLevel(cat.autoMaturity).bg, color: getMaturityLevel(cat.autoMaturity).color }}>
                                      L{cat.autoMaturity} — {getMaturityLevel(cat.autoMaturity).label}
                                    </span>
                                    {!cat.override && <span className="fw-auto-caveat">Use AI Enterprise Assess for accurate L3+ scoring</span>}
                                  </div>
                                  {cat.override ? (
                                    <div className="fw-override-info">
                                      <span className="field-label">Override: L{cat.override.level}</span>
                                      {cat.override.note && <span className="fw-override-note">{cat.override.note}</span>}
                                      <button className="link-btn" onClick={() => clearOverride(cat.id)}>Remove</button>
                                    </div>
                                  ) : overrideEditing === cat.id ? (
                                    <div className="fw-override-form">
                                      <select value={overrideLevel} onChange={(e) => setOverrideLevel(e.target.value)}>
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
                                      />
                                      <button className="btn-primary small" onClick={() => saveOverride(cat.id)}>Save</button>
                                      <button className="btn-secondary" onClick={() => setOverrideEditing(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button className="link-btn" onClick={() => { setOverrideEditing(cat.id); setOverrideLevel(''); setOverrideNote('') }}>
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
