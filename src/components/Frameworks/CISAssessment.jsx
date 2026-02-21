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
    <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg">
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
    <div className="framework-assessment">
      <div className="page-header">
        <div>
          <h1>CIS Controls v8</h1>
          <p className="page-subtitle">Enterprise maturity assessment across 18 control groups — run AI Enterprise Assess for accurate scoring</p>
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
                {Object.keys(aiSuggestions).length} controls assessed — review per-control suggestions below or apply all
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
              <span>{assessment.controls.filter((c) => c.maturity >= 3).length} of 18 controls at Defined+</span>
              {blindSpots.length > 0 && (
                <span className="fw-blind-alert">{blindSpots.length} blind spot{blindSpots.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="fw-level-dist">
          {levelDist.filter((l) => l.count > 0).map((l) => (
            <div key={l.level} className="fw-level-row">
              <span className="fw-level-label" style={{ color: l.color }}>{l.label}</span>
              <div className="fw-level-bar-track">
                <div className="fw-level-bar-fill" style={{ width: `${(l.count / 18) * 100}%`, backgroundColor: l.color }} />
              </div>
              <span className="fw-level-count">{l.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="fw-radar-section dash-card">
        <div className="dash-card-header">
          <h3>Maturity Radar</h3>
          <span className="dash-card-badge">18 controls</span>
        </div>
        <div className="fw-radar-container">
          <RadarChart controls={assessment.controls} />
        </div>
        <div className="fw-radar-legend">
          {CIS_CONTROLS.map((c) => (
            <span key={c.id} className="fw-radar-legend-item">
              <strong>{c.num}.</strong> {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* Control Cards */}
      <div className="fw-controls-section">
        <h2 className="trending-section-title">Control Details</h2>
        <div className="fw-controls-list">
          {assessment.controls.map((ctrl) => {
            const expanded = expandedControl === ctrl.id
            const aiSug = aiSuggestions?.[ctrl.id]
            const hasDiff = aiSug && aiSug.level !== ctrl.maturity
            return (
              <div key={ctrl.id} className={`fw-control-card ${expanded ? 'expanded' : ''} ${hasDiff ? 'has-suggestion' : ''}`}>
                <div
                  className="fw-control-header"
                  onClick={() => setExpandedControl(expanded ? null : ctrl.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedControl(expanded ? null : ctrl.id) } }}
                >
                  <div className="fw-control-left">
                    <span className="fw-control-num">{ctrl.num}</span>
                    <div className="fw-control-title-group">
                      <span className="fw-control-name">{ctrl.name}</span>
                      <span className="fw-control-objects">
                        {ctrl.objects.length === 0
                          ? 'No coverage'
                          : `${ctrl.objects.length} object${ctrl.objects.length !== 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>
                  <div className="fw-control-right">
                    {hasDiff && (
                      <span className="ai-suggestion-hint" title={aiSug.rationale}>
                        AI: L{aiSug.level}
                      </span>
                    )}
                    {ctrl.override && (
                      <span className="fw-override-badge" title={ctrl.override.note || 'Manual override'}>Override</span>
                    )}
                    <span
                      className="fw-maturity-badge"
                      style={{ backgroundColor: ctrl.maturityInfo.bg, color: ctrl.maturityInfo.color }}
                    >
                      L{ctrl.maturity} — {ctrl.maturityInfo.label}
                    </span>
                    <span className={`expand-chevron ${expanded ? 'open' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </span>
                  </div>
                </div>

                {expanded && (
                  <div className="fw-control-body">
                    {hasDiff && (
                      <div className="fw-ai-suggestion">
                        <div className="fw-ai-suggestion-content">
                          <span className="ai-sparkle">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                            </svg>
                          </span>
                          <div>
                            <strong>AI suggests L{aiSug.level} ({getMaturityLevel(aiSug.level).label})</strong>
                            <span className="fw-ai-rationale">{aiSug.rationale}</span>
                          </div>
                        </div>
                        <button className="btn-primary small" onClick={(e) => { e.stopPropagation(); applyAiSuggestion(ctrl.id) }}>
                          Apply
                        </button>
                      </div>
                    )}
                    <p className="fw-control-desc">{ctrl.desc}</p>

                    {ctrl.objects.length === 0 ? (
                      <div className="fw-no-coverage">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>No objects in your inventory map to this control. This is a <strong>blind spot</strong> in your security posture.</span>
                      </div>
                    ) : (
                      <div className="fw-mapped-objects">
                        <h4>Mapped Objects</h4>
                        <div className="fw-obj-list">
                          {ctrl.objects.map((obj) => {
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
                      </div>
                    )}

                    {/* Auto vs Override */}
                    <div className="fw-maturity-detail">
                      <div className="fw-maturity-auto">
                        <span className="field-label">Auto-estimated (max L2)</span>
                        <span className="fw-maturity-badge small" style={{ backgroundColor: getMaturityLevel(ctrl.autoMaturity).bg, color: getMaturityLevel(ctrl.autoMaturity).color }}>
                          L{ctrl.autoMaturity} — {getMaturityLevel(ctrl.autoMaturity).label}
                        </span>
                        {!ctrl.override && <span className="fw-auto-caveat">Use AI Enterprise Assess for accurate L3+ scoring</span>}
                      </div>
                      {ctrl.override ? (
                        <div className="fw-override-info">
                          <span className="field-label">Override: L{ctrl.override.level}</span>
                          {ctrl.override.note && <span className="fw-override-note">{ctrl.override.note}</span>}
                          <button className="link-btn" onClick={() => clearOverride(ctrl.id)}>Remove override</button>
                        </div>
                      ) : overrideEditing === ctrl.id ? (
                        <div className="fw-override-form">
                          <select value={overrideLevel} onChange={(e) => setOverrideLevel(e.target.value)}>
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
                          />
                          <button className="btn-primary small" onClick={() => saveOverride(ctrl.id)}>Save</button>
                          <button className="btn-secondary" onClick={() => setOverrideEditing(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <button className="link-btn" onClick={() => { setOverrideEditing(ctrl.id); setOverrideLevel(''); setOverrideNote('') }}>
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
