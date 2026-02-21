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

  // Phase 1 gatekeeping
  const foundationGatekeepers = MLG_PHASES[0].checkpoints.filter((cp) => cp.gatekeeper)
  const foundationPassed = foundationGatekeepers.every((cp) => {
    const ans = getAnswer(cp.id)
    return ans === 'yes' || ans === 'weak'
  })

  const maturity = getMaturityTier(scores.total)

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">MLG Diagnostic</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Managed List Governance maturity assessment</p>
        </div>
      </div>

      {objects.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3 mt-4">
          <p className="mb-3">No objects in the inventory yet. Add objects first to run diagnostics.</p>
          <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97]" onClick={() => onNavigate('objects')}>Go to Object Inventory</button>
        </div>
      ) : (
        <>
          {/* Object Selector */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 mb-5">
            <label className="block text-[0.78rem] font-semibold text-txt-2 mb-2">Select a program or object to assess:</label>
            <select className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={selectedObjId} onChange={(e) => setSelectedObjId(e.target.value)}>
              <option value="">Choose an object...</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>{o.listName || 'Untitled'}</option>
              ))}
            </select>
          </div>

          {selectedObjId && (
            <div className="flex gap-2 mb-4 items-center flex-wrap">
              <AiButton onClick={handleAiAssess} loading={aiLoading}>AI Assess All Checkpoints</AiButton>
              {aiSuggestions && (
                <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97]" onClick={applyAiSuggestions}>
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
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3">
              <p>Select an object above to begin the MLG diagnostic.</p>
            </div>
          ) : (
            <>
              {/* Maturity Score Card */}
              <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-6 mb-5 flex items-center gap-6 flex-wrap">
                <div className="relative w-[120px] h-[120px] shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full">
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
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-[800] tracking-tight text-txt">{scores.total}</span>
                    <span className="text-[0.72rem] text-txt-3 font-medium">/20</span>
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <span className="inline-block text-[0.72rem] font-bold px-3 py-1 rounded-full mb-2" style={{ backgroundColor: maturity.bg, color: maturity.color }}>
                    {maturity.tier} — {maturity.label}
                  </span>
                  <p className="text-[0.85rem] text-txt-2 leading-relaxed">
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
              <div className="flex flex-col gap-4">
                {MLG_PHASES.map((phase, phaseIdx) => {
                  const phaseScore = scores.phases[phase.id]
                  const maxPhase = phase.checkpoints.length
                  const locked = phaseIdx > 0 && !foundationPassed

                  return (
                    <div key={phase.id} className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 overflow-hidden transition-all duration-200 ${locked ? 'opacity-60' : ''}`}>
                      {/* Phase Header */}
                      <div className="flex justify-between items-start p-5 pb-0">
                        <div>
                          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-brand">Phase {phase.phase}</span>
                          <h3 className="text-[1rem] font-bold tracking-tight text-txt mt-0.5">{phase.name}</h3>
                          <p className="text-[0.78rem] text-txt-3 mt-0.5">{phase.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xl font-[800] text-txt">{phaseScore}</span>
                          <span className="text-[0.78rem] text-txt-3 font-medium">/{maxPhase}</span>
                        </div>
                      </div>

                      {locked && (
                        <div className="flex items-center gap-2 mx-5 mt-3 px-3 py-2 bg-amber-bg border border-amber/10 rounded-lg text-[0.78rem] text-amber font-medium">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                          Foundation gatekeepers (Cadence, Health Criteria, Ownership) must be "Yes" or "Weak" to unlock.
                        </div>
                      )}

                      {/* Checkpoints */}
                      <div className="p-5 flex flex-col gap-3">
                        {phase.checkpoints.map((cp) => {
                          const current = getAnswer(cp.id)
                          return (
                            <div key={cp.id} className={`flex items-center justify-between gap-4 py-2 border-b border-border-light last:border-0 ${locked ? 'pointer-events-none' : ''}`}>
                              <div className="flex-1 min-w-0">
                                <span className="text-[0.85rem] text-txt font-medium">{cp.label}</span>
                                <div className="flex gap-1.5 mt-1">
                                  {cp.gatekeeper && <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-bg text-amber">Gatekeeper</span>}
                                  {autoDerived[cp.id] && !rawAssessment[cp.id] && <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-bg text-status-blue">Auto</span>}
                                  {aiSuggestions?.[cp.id] && aiSuggestions[cp.id].answer !== getAnswer(cp.id) && (
                                    <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-ai-bg text-ai cursor-help" title={aiSuggestions[cp.id].rationale}>
                                      AI: {aiSuggestions[cp.id].answer}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {ANSWER_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={locked}
                                    className={`px-3 py-1.5 rounded-lg text-[0.78rem] font-semibold border cursor-pointer font-sans transition-all duration-150 ${
                                      current === opt.id
                                        ? 'font-bold shadow-sm'
                                        : 'bg-white border-border text-txt-2 hover:border-gray-300'
                                    }`}
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
