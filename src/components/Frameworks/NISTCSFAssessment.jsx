import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { NIST_CSF_FUNCTIONS, MATURITY_LEVELS, computeCSFAssessment, getMaturityLevel, buildCSFMapping } from '../../data/frameworks.js'
import { assessFramework, assessFrameworkControls, assessSafeguards } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'
import { computeFrameworkAssessment } from '../../utils/safeguardScoring.js'
import SafeguardGroupCard from './SafeguardGroupCard.jsx'
import ComplianceRadar from './ComplianceRadar.jsx'

import { NIST_CSF_SAFEGUARDS } from '../../data/safeguards.js'

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
            <div className="h-full rounded-[5px] transition-all duration-[400ms]" style={{ width: `${(f.maturity / 5) * 100}%`, backgroundColor: f.color }} />
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
  const { objects, mlgAssessments, frameworkOverrides, safeguardAssessments } = useStore()
  const dispatch = useDispatch()
  const [expandedFunc, setExpandedFunc] = useState(null)
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

  const csfOverrides = (frameworkOverrides || {})['nist-csf'] || {}
  const csfAssessmentData = (safeguardAssessments || {})['nist-csf'] || {}

  // Group safeguards by category
  const safeguardsByCat = useMemo(() => {
    const map = {}
    for (const func of NIST_CSF_FUNCTIONS) {
      for (const cat of func.categories) map[cat.id] = []
    }
    for (const sg of NIST_CSF_SAFEGUARDS) {
      if (map[sg.categoryId]) map[sg.categoryId].push(sg)
    }
    return map
  }, [])

  // Compute safeguard-level assessment
  const safeguardAssessmentResult = useMemo(() => {
    if (NIST_CSF_SAFEGUARDS.length === 0) return null
    const groups = []
    for (const func of NIST_CSF_FUNCTIONS) {
      for (const cat of func.categories) {
        groups.push({ id: cat.id, safeguards: safeguardsByCat[cat.id] || [] })
      }
    }
    return computeFrameworkAssessment(groups, csfAssessmentData)
  }, [csfAssessmentData, safeguardsByCat])

  const assessment = useMemo(
    () => computeCSFAssessment(objects, mlgAssessments, csfOverrides),
    [objects, mlgAssessments, csfOverrides]
  )

  const totalCats = assessment.functions.reduce((s, f) => s + f.categories.length, 0)
  const blindCats = assessment.functions.reduce(
    (s, f) => s + f.categories.filter((c) => c.objects.length === 0).length, 0
  )

  const totalSafeguards = NIST_CSF_SAFEGUARDS.length
  const assessedCount = safeguardAssessmentResult?.overall?.assessed || 0
  const compliancePercent = safeguardAssessmentResult?.overall?.score ? Math.round(safeguardAssessmentResult.overall.score * 100) : 0

  // ── Handlers ──
  const handleAssess = (safeguardId, data) => {
    dispatch({ type: 'SET_SAFEGUARD', payload: { framework: 'nist-csf', safeguardId, ...data } })
  }

  const handleCreateGap = (safeguard) => {
    dispatch({ type: 'CREATE_GAP_FROM_SAFEGUARD', payload: { framework: 'nist-csf', safeguardId: safeguard.id, safeguardName: safeguard.name } })
  }

  const handleOverride = (catId, level, note) => {
    dispatch({ type: 'SET_FRAMEWORK_OVERRIDE', payload: { framework: 'nist-csf', controlId: catId, level, note } })
  }

  const handleClearOverride = (catId) => {
    dispatch({ type: 'CLEAR_FRAMEWORK_OVERRIDE', payload: { framework: 'nist-csf', controlId: catId } })
  }

  const handleAiReport = async () => {
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = {
        framework: 'NIST CSF 2.0',
        functions: assessment.functions.map((f) => ({
          id: f.id, name: f.name, maturity: f.maturity,
          categories: f.categories.map((c) => ({
            id: c.id, name: c.name, maturity: c.maturity, maturityLabel: c.maturityInfo.label,
            objectCount: c.objects.length,
            objects: c.objects.map((o) => ({ name: o.listName, health: o.healthStatus, compliance: o.compliancePercent, controlClassification: o.controlClassification })),
          })),
        })),
        overallScore: assessment.overallScore,
        blindSpots: assessment.functions.flatMap((f) => f.categories.filter((c) => c.objects.length === 0).map((c) => `${c.id}: ${c.name}`)),
      }
      const res = await assessFramework(payload)
      setAiContent(res.content)
    } catch (err) { setAiError(err.message) }
    finally { setAiLoading(false) }
  }

  const handleAiEnterprise = async () => {
    setAiAssessLoading(true)
    setAiAssessError(null)
    try {
      const allCats = assessment.functions.flatMap((f) =>
        f.categories.map((c) => ({
          id: c.id, name: c.name, function: f.name, description: f.desc,
          currentAutoLevel: c.autoMaturity,
          mappedObjects: c.objects.map((o) => ({
            name: o.listName, type: o.type, productFamilies: o.productFamilies,
            health: o.healthStatus, compliance: o.compliancePercent,
            controlClassification: o.controlClassification, nistFamilies: o.nistFamilies, criticality: o.criticality,
          })),
        }))
      )
      const res = await assessFrameworkControls({ framework: 'NIST CSF 2.0', controls: allCats })
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
    for (const [catId, suggestion] of Object.entries(aiSuggestions)) {
      dispatch({ type: 'SET_FRAMEWORK_OVERRIDE', payload: { framework: 'nist-csf', controlId: catId, level: suggestion.level, note: `AI enterprise assessment: ${suggestion.rationale}` } })
    }
    setAiSuggestions(null)
  }

  const handleAiSafeguardAssess = async () => {
    if (NIST_CSF_SAFEGUARDS.length === 0) return
    setAiSafeguardLoading(true)
    setAiSafeguardError(null)
    try {
      const res = await assessSafeguards({
        framework: 'nist-csf',
        safeguards: NIST_CSF_SAFEGUARDS.map((sg) => ({ id: sg.id, name: sg.name, desc: sg.desc })),
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
    dispatch({ type: 'SET_SAFEGUARDS_BULK', payload: { framework: 'nist-csf', assessments: bulk } })
    setAiSafeguardSuggestions(null)
  }

  const applySingleSafeguardSuggestion = (safeguardId) => {
    const sug = aiSafeguardSuggestions?.[safeguardId]
    if (!sug) return
    dispatch({ type: 'SET_SAFEGUARD', payload: { framework: 'nist-csf', safeguardId, policy: sug.policy, implementation: sug.implementation, note: `AI: ${sug.rationale}` } })
  }

  // Radar data reflecting safeguard scores
  const radarFunctions = useMemo(() => {
    return assessment.functions.map((f) => {
      const catMaturities = f.categories.map((c) => {
        const sgGroup = safeguardAssessmentResult?.groups?.find((g) => g.id === c.id)
        return sgGroup && sgGroup.assessed > 0 ? sgGroup.maturity : c.maturity
      })
      const mat = catMaturities.length > 0
        ? Math.round(catMaturities.reduce((s, m) => s + m, 0) / catMaturities.length * 10) / 10
        : f.maturity
      return { ...f, maturity: mat }
    })
  }, [assessment, safeguardAssessmentResult])

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">NIST CSF 2.0</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">
            Enterprise maturity across 6 functions, {totalCats} categories{totalSafeguards > 0 ? `, and ${totalSafeguards} safeguards` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {NIST_CSF_SAFEGUARDS.length > 0 && (
            <AiButton onClick={handleAiSafeguardAssess} loading={aiSafeguardLoading}>AI Safeguard Assess</AiButton>
          )}
          <AiButton onClick={handleAiEnterprise} loading={aiAssessLoading}>AI Enterprise Assess</AiButton>
          <AiButton onClick={handleAiReport} loading={aiLoading} className="small">Board Report</AiButton>
        </div>
      </div>

      <AiSlidePanel open={aiOpen} onClose={() => setAiOpen(false)} title="NIST CSF 2.0 — Board Report" loading={aiLoading} content={aiContent}>
        {aiError && <AiError error={aiError} onRetry={handleAiReport} />}
      </AiSlidePanel>

      {/* AI Banners */}
      {aiAssessError && <div className="bg-red-bg border border-red/15 rounded-xl p-4 mb-5"><AiError error={aiAssessError} onRetry={handleAiEnterprise} /></div>}
      {aiSuggestions && (
        <div className="bg-ai-bg border border-purple-200/40 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-[0.45rem] flex-wrap">
              <span className="inline-flex text-purple-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg></span>
              <strong className="text-[0.85rem] text-purple-700">AI Enterprise Assessment Complete</strong>
              <span className="text-[0.78rem] text-txt-2">{Object.keys(aiSuggestions).length} categories assessed</span>
            </div>
            <div className="flex gap-[0.35rem]">
              <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97]" onClick={applyAllAiSuggestions}>Apply All</button>
              <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setAiSuggestions(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
      {aiSafeguardError && <div className="bg-red-bg border border-red/15 rounded-xl p-4 mb-5"><AiError error={aiSafeguardError} onRetry={handleAiSafeguardAssess} /></div>}
      {aiSafeguardSuggestions && (
        <div className="bg-ai-bg border border-purple-200/40 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-[0.45rem] flex-wrap">
              <span className="inline-flex text-purple-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg></span>
              <strong className="text-[0.85rem] text-purple-700">AI Safeguard Assessment Complete</strong>
              <span className="text-[0.78rem] text-txt-2">{Object.keys(aiSafeguardSuggestions).length} safeguards assessed</span>
            </div>
            <div className="flex gap-[0.35rem]">
              <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97]" onClick={applyAllSafeguardSuggestions}>Apply All</button>
              <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setAiSafeguardSuggestions(null)}>Dismiss</button>
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
              <span>6 functions, {totalCats} categories</span>
              {totalSafeguards > 0 && (
                <span className="font-semibold">{assessedCount}/{totalSafeguards} Assessed · {compliancePercent}% Compliant</span>
              )}
              {blindCats > 0 && <span className="text-red font-bold">{blindCats} blind spot{blindCats !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex flex-col justify-center">
          <FunctionBars functions={radarFunctions} />
        </div>
      </div>

      {/* Radar */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 mb-5">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Function Radar</h3>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 bg-subtle px-2.5 py-1 rounded-full">6 functions</span>
        </div>
        <div className="flex justify-center py-3 max-w-[360px] mx-auto">
          <ComplianceRadar
            points={radarFunctions.map((f) => ({
              label: f.name,
              value: f.maturity,
              color: f.color,
            }))}
            maxValue={5}
            fillColor="rgba(139,92,246,0.12)"
            strokeColor="#8b5cf6"
          />
        </div>
      </div>

      {/* Function Cards with Category SafeguardGroupCards */}
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
                      <span className="text-[0.72rem] text-txt-3 block">{func.categories.length} categories{blindCount > 0 ? ` · ${blindCount} blind` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[0.45rem] shrink-0">
                    <span className="text-[0.72rem] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: func.maturityInfo.bg, color: func.maturityInfo.color }}>
                      L{func.maturity.toFixed(1)} — {func.maturityInfo.label}
                    </span>
                    <span className={`text-txt-3 transition-transform duration-200 ${funcExpanded ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>

                {funcExpanded && (
                  <div className="px-4 pb-4 animate-[fadeIn_0.18s_ease]">
                    <p className="text-[0.82rem] text-txt-2 leading-[1.7] mb-3">{func.desc}</p>
                    <div className="flex flex-col gap-[0.25rem]">
                      {func.categories.map((cat) => (
                        <SafeguardGroupCard
                          key={cat.id}
                          group={{ ...cat, safeguards: safeguardsByCat[cat.id] || [] }}
                          mappedObjects={cat.objects}
                          assessments={csfAssessmentData}
                          overrideData={cat.override}
                          onAssess={handleAssess}
                          onCreateGap={handleCreateGap}
                          onOverride={(level, note) => handleOverride(cat.id, level, note)}
                          onClearOverride={() => handleClearOverride(cat.id)}
                          onNavigate={onNavigate}
                          aiSuggestions={aiSafeguardSuggestions}
                          onApplyAi={applySingleSafeguardSuggestion}
                          autoMaturity={cat.autoMaturity}
                          borderColor={func.color}
                        />
                      ))}
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
