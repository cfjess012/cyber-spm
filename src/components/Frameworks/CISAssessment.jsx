import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { CIS_CONTROLS, MATURITY_LEVELS, computeCISAssessment, getMaturityLevel, buildCISMapping } from '../../data/frameworks.js'
import { assessFramework, assessFrameworkControls, assessSafeguards } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'
import { computeFrameworkAssessment } from '../../utils/safeguardScoring.js'
import SafeguardGroupCard from './SafeguardGroupCard.jsx'
import IGFilterBar from './IGFilterBar.jsx'
import ComplianceRadar from './ComplianceRadar.jsx'

import { CIS_SAFEGUARDS } from '../../data/safeguards.js'

export default function CISAssessment({ onNavigate }) {
  const { objects, mlgAssessments, frameworkOverrides, safeguardAssessments, cisIgFilter } = useStore()
  const dispatch = useDispatch()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiAssessLoading, setAiAssessLoading] = useState(false)
  const [aiAssessError, setAiAssessError] = useState(null)
  const [aiSafeguardSuggestions, setAiSafeguardSuggestions] = useState(null)
  const [aiSafeguardLoading, setAiSafeguardLoading] = useState(false)
  const [aiSafeguardError, setAiSafeguardError] = useState(null)

  const igFilter = cisIgFilter ?? 3
  const cisOverrides = (frameworkOverrides || {})['cis-v8'] || {}
  const cisAssessmentData = (safeguardAssessments || {})['cis-v8'] || {}

  // Group safeguards by control group
  const safeguardsByGroup = useMemo(() => {
    const map = {}
    for (const ctrl of CIS_CONTROLS) map[ctrl.id] = []
    for (const sg of CIS_SAFEGUARDS) {
      if (map[sg.groupId]) map[sg.groupId].push(sg)
    }
    return map
  }, [])

  // Compute safeguard-level assessment
  const safeguardAssessment = useMemo(() => {
    if (CIS_SAFEGUARDS.length === 0) return null
    const groups = CIS_CONTROLS.map((ctrl) => ({
      id: ctrl.id,
      safeguards: safeguardsByGroup[ctrl.id] || [],
    }))
    return computeFrameworkAssessment(groups, cisAssessmentData, igFilter)
  }, [cisAssessmentData, igFilter, safeguardsByGroup])

  const cisMapping = useMemo(() => buildCISMapping(objects), [objects])
  const assessment = useMemo(
    () => computeCISAssessment(objects, mlgAssessments, cisOverrides),
    [objects, mlgAssessments, cisOverrides]
  )

  const blindSpots = assessment.controls.filter((c) => c.objects.length === 0)
  const levelDist = useMemo(() => {
    const dist = MATURITY_LEVELS.map((l) => ({ ...l, count: 0 }))
    assessment.controls.forEach((c) => {
      // Use safeguard-derived maturity if available
      const sgGroup = safeguardAssessment?.groups?.find((g) => g.id === c.id)
      const mat = sgGroup && sgGroup.assessed > 0 ? sgGroup.maturity : c.maturity
      dist[mat].count++
    })
    return dist
  }, [assessment, safeguardAssessment])

  // Build radar data that reflects safeguard scores when available
  const radarControls = useMemo(() => {
    return assessment.controls.map((c) => {
      const sgGroup = safeguardAssessment?.groups?.find((g) => g.id === c.id)
      const mat = sgGroup && sgGroup.assessed > 0 ? sgGroup.maturity : c.maturity
      return { ...c, maturity: mat }
    })
  }, [assessment, safeguardAssessment])

  // ── Handlers ──
  const handleAssess = (safeguardId, data) => {
    dispatch({ type: 'SET_SAFEGUARD', payload: { framework: 'cis-v8', safeguardId, ...data } })
  }

  const handleCreateGap = (safeguard) => {
    dispatch({ type: 'CREATE_GAP_FROM_SAFEGUARD', payload: { framework: 'cis-v8', safeguardId: safeguard.id, safeguardName: safeguard.name } })
  }

  const handleOverride = (controlId, level, note) => {
    dispatch({ type: 'SET_FRAMEWORK_OVERRIDE', payload: { framework: 'cis-v8', controlId, level, note } })
  }

  const handleClearOverride = (controlId) => {
    dispatch({ type: 'CLEAR_FRAMEWORK_OVERRIDE', payload: { framework: 'cis-v8', controlId } })
  }

  // ── AI Board Report ──
  const handleAiReport = async () => {
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = {
        framework: 'CIS Controls v8',
        controls: assessment.controls.map((c) => ({
          id: c.id, name: c.name, maturity: c.maturity, maturityLabel: c.maturityInfo.label,
          objectCount: c.objects.length,
          objects: c.objects.map((o) => ({ name: o.listName, health: o.healthStatus, compliance: o.compliancePercent, controlClassification: o.controlClassification })),
        })),
        overallScore: assessment.overallScore,
        blindSpots: blindSpots.map((c) => c.name),
      }
      const res = await assessFramework(payload)
      setAiContent(res.content)
    } catch (err) { setAiError(err.message) }
    finally { setAiLoading(false) }
  }

  // ── AI Enterprise Assessment ──
  const handleAiEnterprise = async () => {
    setAiAssessLoading(true)
    setAiAssessError(null)
    try {
      const payload = {
        framework: 'CIS Controls v8',
        controls: CIS_CONTROLS.map((c) => {
          const ctrl = assessment.controls.find((ac) => ac.id === c.id)
          return {
            id: c.id, name: c.name, description: c.desc,
            currentAutoLevel: ctrl?.autoMaturity ?? 0,
            mappedObjects: (ctrl?.objects || []).map((o) => ({
              name: o.listName, type: o.type, productFamilies: o.productFamilies,
              health: o.healthStatus, compliance: o.compliancePercent,
              controlClassification: o.controlClassification, nistFamilies: o.nistFamilies, criticality: o.criticality,
            })),
          }
        }),
      }
      const res = await assessFrameworkControls(payload)
      const map = {}
      for (const item of res.controls || []) {
        const level = Math.max(0, Math.min(5, Math.round(Number(item.level) || 0)))
        map[item.id] = { level, rationale: item.rationale || '' }
      }
      setAiSuggestions(map)
    } catch (err) { setAiAssessError(err.message) }
    finally { setAiAssessLoading(false) }
  }

  const applyAllAiSuggestions = () => {
    if (!aiSuggestions) return
    for (const [controlId, suggestion] of Object.entries(aiSuggestions)) {
      dispatch({ type: 'SET_FRAMEWORK_OVERRIDE', payload: { framework: 'cis-v8', controlId, level: suggestion.level, note: `AI enterprise assessment: ${suggestion.rationale}` } })
    }
    setAiSuggestions(null)
  }

  // ── AI Safeguard Assessment ──
  const handleAiSafeguardAssess = async () => {
    if (CIS_SAFEGUARDS.length === 0) return
    setAiSafeguardLoading(true)
    setAiSafeguardError(null)
    try {
      const res = await assessSafeguards({
        framework: 'cis-v8',
        safeguards: CIS_SAFEGUARDS.filter((sg) => {
          if (igFilter && sg.ig) return Math.min(...sg.ig) <= igFilter
          return true
        }).map((sg) => ({ id: sg.id, name: sg.name, desc: sg.desc })),
        objectContext: objects.slice(0, 20).map((o) => ({
          name: o.listName, type: o.type, productFamilies: o.productFamilies,
          health: o.healthStatus, compliance: o.compliancePercent,
        })),
      })
      const map = {}
      for (const item of res.assessments || []) {
        map[item.id] = { policy: item.policy, implementation: item.implementation, rationale: item.rationale || '' }
      }
      setAiSafeguardSuggestions(map)
    } catch (err) { setAiSafeguardError(err.message) }
    finally { setAiSafeguardLoading(false) }
  }

  const applyAllSafeguardSuggestions = () => {
    if (!aiSafeguardSuggestions) return
    const bulk = {}
    for (const [id, sug] of Object.entries(aiSafeguardSuggestions)) {
      bulk[id] = { policy: sug.policy, implementation: sug.implementation, note: `AI: ${sug.rationale}`, updatedAt: new Date().toISOString() }
    }
    dispatch({ type: 'SET_SAFEGUARDS_BULK', payload: { framework: 'cis-v8', assessments: bulk } })
    setAiSafeguardSuggestions(null)
  }

  const applySingleSafeguardSuggestion = (safeguardId) => {
    const sug = aiSafeguardSuggestions?.[safeguardId]
    if (!sug) return
    dispatch({ type: 'SET_SAFEGUARD', payload: { framework: 'cis-v8', safeguardId, policy: sug.policy, implementation: sug.implementation, note: `AI: ${sug.rationale}` } })
  }

  // Compute overall safeguard completion stats
  const totalSafeguards = CIS_SAFEGUARDS.filter((sg) => !igFilter || !sg.ig || Math.min(...sg.ig) <= igFilter).length
  const assessedCount = safeguardAssessment?.overall?.assessed || 0
  const compliancePercent = safeguardAssessment?.overall?.score ? Math.round(safeguardAssessment.overall.score * 100) : 0

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">CIS Controls v8</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">
            Safeguard-level assessment across 18 control groups and {totalSafeguards} safeguards
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {CIS_SAFEGUARDS.length > 0 && (
            <AiButton onClick={handleAiSafeguardAssess} loading={aiSafeguardLoading}>AI Safeguard Assess</AiButton>
          )}
          <AiButton onClick={handleAiEnterprise} loading={aiAssessLoading}>AI Enterprise Assess</AiButton>
          <AiButton onClick={handleAiReport} loading={aiLoading} className="small">Board Report</AiButton>
        </div>
      </div>

      {/* IG Filter Bar */}
      <div className="mb-5">
        <IGFilterBar value={igFilter} onChange={(v) => dispatch({ type: 'SET_CIS_IG_FILTER', payload: { filter: v } })} />
      </div>

      <AiSlidePanel open={aiOpen} onClose={() => setAiOpen(false)} title="CIS v8 — Board Report" loading={aiLoading} content={aiContent}>
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
              <span className="text-[0.78rem] text-txt-2">{Object.keys(aiSuggestions).length} controls assessed — review suggestions below or apply all</span>
            </div>
            <div className="flex gap-[0.35rem]">
              <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={applyAllAiSuggestions}>Apply All</button>
              <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setAiSuggestions(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Safeguard Assessment Banner */}
      {aiSafeguardError && (
        <div className="bg-red-bg border border-red/15 rounded-xl p-4 mb-5">
          <AiError error={aiSafeguardError} onRetry={handleAiSafeguardAssess} />
        </div>
      )}
      {aiSafeguardSuggestions && (
        <div className="bg-ai-bg border border-purple-200/40 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-[0.45rem] flex-wrap">
              <span className="inline-flex text-purple-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                </svg>
              </span>
              <strong className="text-[0.85rem] text-purple-700">AI Safeguard Assessment Complete</strong>
              <span className="text-[0.78rem] text-txt-2">{Object.keys(aiSafeguardSuggestions).length} safeguards assessed — review per-safeguard suggestions or apply all</span>
            </div>
            <div className="flex gap-[0.35rem]">
              <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={applyAllSafeguardSuggestions}>Apply All</button>
              <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setAiSafeguardSuggestions(null)} style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>Dismiss</button>
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
              <circle cx="60" cy="60" r="50" fill="none" stroke={assessment.overallLevel.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - assessment.overallScore / 5)}`}
                transform="rotate(-90 60 60)" />
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
              {CIS_SAFEGUARDS.length > 0 && (
                <span className="font-semibold">{assessedCount}/{totalSafeguards} Assessed · {compliancePercent}% Compliant</span>
              )}
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
          <ComplianceRadar
            points={radarControls.map((c) => ({
              label: String(c.num),
              value: c.maturity,
              color: getMaturityLevel(c.maturity).color,
            }))}
            maxValue={5}
          />
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 px-5 pb-4 max-md:grid-cols-2">
          {CIS_CONTROLS.map((c) => (
            <span key={c.id} className="text-[0.7rem] text-txt-2 leading-relaxed">
              <strong className="text-txt mr-[0.15rem]">{c.num}.</strong> {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* Control Cards with Safeguard Rows */}
      <div className="mt-5">
        <h2 className="text-[0.82rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-3">Control Details</h2>
        <div className="flex flex-col gap-[0.35rem]">
          {assessment.controls.map((ctrl) => (
            <SafeguardGroupCard
              key={ctrl.id}
              group={{ ...ctrl, safeguards: safeguardsByGroup[ctrl.id] || [] }}
              mappedObjects={ctrl.objects}
              assessments={cisAssessmentData}
              overrideData={ctrl.override}
              onAssess={handleAssess}
              onCreateGap={handleCreateGap}
              onOverride={(level, note) => handleOverride(ctrl.id, level, note)}
              onClearOverride={() => handleClearOverride(ctrl.id)}
              onNavigate={onNavigate}
              igFilter={igFilter}
              showIG
              aiSuggestions={aiSafeguardSuggestions}
              onApplyAi={applySingleSafeguardSuggestion}
              autoMaturity={ctrl.autoMaturity}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
