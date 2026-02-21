import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { MLG_PHASES, getMaturityTier } from '../../data/constants.js'
import { assessMLG } from '../../utils/ai.js'
import { AiButton, AiInlineResult, AiError } from '../AiPanel.jsx'

const ANSWER_OPTIONS = [
  { id: 'yes', label: 'Yes', score: 1, color: '#16a34a' },
  { id: 'weak', label: 'Weak', score: 0.5, color: '#d97706' },
  { id: 'no', label: 'No', score: 0, color: '#dc2626' },
]

export default function MLGDiagnostic({ onNavigate, initialObjectId }) {
  const { objects, mlgAssessments } = useStore()
  const dispatch = useDispatch()
  const [selectedObjId, setSelectedObjId] = useState(initialObjectId || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiError, setAiError] = useState(null)

  const selectedObj = objects.find((o) => o.id === selectedObjId)
  const rawAssessment = mlgAssessments[selectedObjId] || {}

  // Auto-derive Phase 1 checkpoints from object data
  const autoDerived = useMemo(() => {
    if (!selectedObj) return {}
    const derived = {}
    if (selectedObj.reviewCadence) derived.cadence = 'yes'
    if (selectedObj.owner?.trim()) derived.ownership = 'yes'
    if (selectedObj.description?.trim()) derived.scope = 'yes'
    return derived
  }, [selectedObj])

  // Merge: explicit answers override auto-derived
  const assessment = useMemo(() => {
    const merged = {}
    for (const [key, value] of Object.entries(autoDerived)) {
      if (!rawAssessment[key]) merged[key] = value
    }
    return { ...merged, ...rawAssessment }
  }, [rawAssessment, autoDerived])

  const handleAiAssess = async () => {
    const obj = objects.find((o) => o.id === selectedObjId)
    if (!obj) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await assessMLG(obj, assessment)
      setAiSuggestions(res.data?.suggestions || {})
      setAiSummary(res.data?.summary || null)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiSuggestions = () => {
    if (!aiSuggestions) return
    const updates = { ...assessment }
    for (const [cpId, suggestion] of Object.entries(aiSuggestions)) {
      updates[cpId] = suggestion.answer
    }
    dispatch({ type: 'SET_MLG', payload: { objectId: selectedObjId, ...updates } })
    setAiSuggestions(null)
    setAiSummary(null)
  }

  const getAnswer = (checkpointId) => assessment[checkpointId] || 'no'

  const setAnswer = (checkpointId, value) => {
    dispatch({
      type: 'SET_MLG',
      payload: {
        objectId: selectedObjId,
        ...assessment,
        [checkpointId]: value,
      },
    })
  }

  // Calculate scores
  const scores = useMemo(() => {
    const result = { phases: {}, total: 0 }
    for (const phase of MLG_PHASES) {
      let phaseScore = 0
      for (const cp of phase.checkpoints) {
        const ans = getAnswer(cp.id)
        const opt = ANSWER_OPTIONS.find((o) => o.id === ans)
        phaseScore += opt?.score || 0
      }
      result.phases[phase.id] = phaseScore
      result.total += phaseScore
    }
    return result
  }, [assessment, selectedObjId])

  // Phase 1 gatekeeping: foundation gatekeepers must be Yes or Weak
  const foundationGatekeepers = MLG_PHASES[0].checkpoints.filter((cp) => cp.gatekeeper)
  const foundationPassed = foundationGatekeepers.every((cp) => {
    const ans = getAnswer(cp.id)
    return ans === 'yes' || ans === 'weak'
  })

  const maturity = getMaturityTier(scores.total)

  return (
    <div className="mlg-diagnostic">
      <div className="page-header">
        <div>
          <h1>MLG Diagnostic</h1>
          <p className="page-subtitle">Managed List Governance maturity assessment</p>
        </div>
      </div>

      {objects.length === 0 ? (
        <div className="empty-state card" style={{ marginTop: '1rem' }}>
          <p>No objects in the inventory yet. Add objects first to run diagnostics.</p>
          <button className="btn-primary small" onClick={() => onNavigate('objects')}>Go to Object Inventory</button>
        </div>
      ) : (
        <>
          {/* Object Selector */}
          <div className="mlg-selector card">
            <label>Select a program or object to assess:</label>
            <select value={selectedObjId} onChange={(e) => setSelectedObjId(e.target.value)}>
              <option value="">Choose an object...</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>{o.listName || 'Untitled'}</option>
              ))}
            </select>
          </div>

          {selectedObjId && (
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem',alignItems:'center',flexWrap:'wrap'}}>
              <AiButton onClick={handleAiAssess} loading={aiLoading}>AI Assess All Checkpoints</AiButton>
              {aiSuggestions && (
                <button className="btn-primary small" onClick={applyAiSuggestions}>
                  Apply All AI Suggestions
                </button>
              )}
              {aiError && <AiError error={aiError} onRetry={handleAiAssess} />}
            </div>
          )}

          {aiSummary && (
            <AiInlineResult content={aiSummary} onClose={() => setAiSummary(null)} />
          )}

          {!selectedObjId ? (
            <div className="empty-state card">
              <p>Select an object above to begin the MLG diagnostic.</p>
            </div>
          ) : (
            <>
              {/* Maturity Score Card */}
              <div className="maturity-card">
                <div className="maturity-gauge">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke={maturity.color}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - scores.total / 20)}`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div className="maturity-gauge-center">
                    <span className="maturity-score">{scores.total}</span>
                    <span className="maturity-max">/20</span>
                  </div>
                </div>
                <div className="maturity-info">
                  <span className="maturity-tier-badge" style={{ backgroundColor: maturity.bg, color: maturity.color }}>
                    {maturity.tier} — {maturity.label}
                  </span>
                  <p className="maturity-desc">
                    {scores.total >= 16
                      ? 'This program demonstrates mature governance with continuous monitoring and improvement.'
                      : scores.total >= 11
                        ? 'Governance is adequate but has room for improvement in controls and maturity.'
                        : scores.total >= 6
                          ? 'Governance is developing. Focus on strengthening foundation and action phases.'
                          : 'Governance is deficient. Establish foundation checkpoints before proceeding.'}
                  </p>
                </div>
              </div>

              {/* Phase Cards */}
              <div className="mlg-phases">
                {MLG_PHASES.map((phase, phaseIdx) => {
                  const phaseScore = scores.phases[phase.id]
                  const maxPhase = phase.checkpoints.length
                  const locked = phaseIdx > 0 && !foundationPassed

                  return (
                    <div key={phase.id} className={`mlg-phase-card ${locked ? 'locked' : ''}`}>
                      <div className="phase-header">
                        <div className="phase-header-left">
                          <span className="phase-number">Phase {phase.phase}</span>
                          <h3>{phase.name}</h3>
                          <p className="phase-desc">{phase.description}</p>
                        </div>
                        <div className="phase-score">
                          <span className="phase-score-value">{phaseScore}</span>
                          <span className="phase-score-max">/{maxPhase}</span>
                        </div>
                      </div>

                      {locked && (
                        <div className="phase-lock-banner">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                          Foundation gatekeepers (Cadence, Health Criteria, Ownership) must be "Yes" or "Weak" to unlock.
                        </div>
                      )}

                      <div className="checkpoints">
                        {phase.checkpoints.map((cp) => {
                          const current = getAnswer(cp.id)
                          return (
                            <div key={cp.id} className={`checkpoint ${locked ? 'disabled' : ''}`}>
                              <div className="checkpoint-label">
                                {cp.label}
                                {cp.gatekeeper && <span className="gatekeeper-badge">Gatekeeper</span>}
                                {autoDerived[cp.id] && !rawAssessment[cp.id] && <span className="auto-derived-badge">Auto</span>}
                                {aiSuggestions?.[cp.id] && aiSuggestions[cp.id].answer !== getAnswer(cp.id) && (
                                  <span className="ai-suggestion-hint" title={aiSuggestions[cp.id].rationale}>
                                    AI suggests: {aiSuggestions[cp.id].answer}
                                  </span>
                                )}
                              </div>
                              <div className="answer-buttons">
                                {ANSWER_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={locked}
                                    className={`answer-btn ${current === opt.id ? 'selected' : ''}`}
                                    style={current === opt.id ? { backgroundColor: opt.color + '18', color: opt.color, borderColor: opt.color } : {}}
                                    onClick={() => setAnswer(cp.id, opt.id)}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
