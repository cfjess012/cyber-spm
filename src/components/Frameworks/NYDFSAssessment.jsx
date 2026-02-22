import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { MATURITY_LEVELS, getMaturityLevel, computeNYDFSAssessment, buildNYDFSMapping } from '../../data/frameworks.js'
import { assessFramework, assessSafeguards } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'
import { computeFrameworkAssessment, scoreColor } from '../../utils/safeguardScoring.js'
import SafeguardGroupCard from './SafeguardGroupCard.jsx'

import { NYDFS_DOMAINS, NYDFS_SAFEGUARDS } from '../../data/safeguards.js'

export default function NYDFSAssessment({ onNavigate }) {
  const { objects, mlgAssessments, frameworkOverrides, safeguardAssessments } = useStore()
  const dispatch = useDispatch()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiSafeguardSuggestions, setAiSafeguardSuggestions] = useState(null)
  const [aiSafeguardLoading, setAiSafeguardLoading] = useState(false)
  const [aiSafeguardError, setAiSafeguardError] = useState(null)

  const nydfsOverrides = (frameworkOverrides || {})['nydfs'] || {}
  const nydfsAssessmentData = (safeguardAssessments || {})['nydfs'] || {}

  const safeguardsByDomain = useMemo(() => {
    const map = {}
    for (const d of NYDFS_DOMAINS) map[d.id] = []
    for (const sg of NYDFS_SAFEGUARDS) {
      if (map[sg.domainId]) map[sg.domainId].push(sg)
    }
    return map
  }, [])

  const safeguardAssessmentResult = useMemo(() => {
    if (NYDFS_SAFEGUARDS.length === 0) return null
    const groups = NYDFS_DOMAINS.map((d) => ({ id: d.id, safeguards: safeguardsByDomain[d.id] || [] }))
    return computeFrameworkAssessment(groups, nydfsAssessmentData)
  }, [nydfsAssessmentData, safeguardsByDomain])

  const assessment = useMemo(
    () => computeNYDFSAssessment(objects, mlgAssessments, nydfsOverrides, NYDFS_DOMAINS),
    [objects, mlgAssessments, nydfsOverrides]
  )

  const totalSafeguards = NYDFS_SAFEGUARDS.length
  const assessedCount = safeguardAssessmentResult?.overall?.assessed || 0
  const compliancePercent = safeguardAssessmentResult?.overall?.score ? Math.round(safeguardAssessmentResult.overall.score * 100) : 0

  const handleAssess = (safeguardId, data) => {
    dispatch({ type: 'SET_SAFEGUARD', payload: { framework: 'nydfs', safeguardId, ...data } })
  }

  const handleCreateGap = (safeguard) => {
    dispatch({ type: 'CREATE_GAP_FROM_SAFEGUARD', payload: { framework: 'nydfs', safeguardId: safeguard.id, safeguardName: safeguard.name } })
  }

  const handleOverride = (domainId, level, note) => {
    dispatch({ type: 'SET_FRAMEWORK_OVERRIDE', payload: { framework: 'nydfs', controlId: domainId, level, note } })
  }

  const handleClearOverride = (domainId) => {
    dispatch({ type: 'CLEAR_FRAMEWORK_OVERRIDE', payload: { framework: 'nydfs', controlId: domainId } })
  }

  const handleAiReport = async () => {
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = {
        framework: 'NYDFS 23 NYCRR 500',
        controls: assessment.domains.map((d) => ({
          id: d.id, name: d.name, maturity: d.maturity, maturityLabel: d.maturityInfo.label,
          objectCount: d.objects.length,
          objects: d.objects.map((o) => ({ name: o.listName, health: o.healthStatus, compliance: o.compliancePercent })),
        })),
        overallScore: assessment.overallScore,
        blindSpots: assessment.domains.filter((d) => d.objects.length === 0).map((d) => d.name),
      }
      const res = await assessFramework(payload)
      setAiContent(res.content)
    } catch (err) { setAiError(err.message) }
    finally { setAiLoading(false) }
  }

  const handleAiSafeguardAssess = async () => {
    if (NYDFS_SAFEGUARDS.length === 0) return
    setAiSafeguardLoading(true)
    setAiSafeguardError(null)
    try {
      const res = await assessSafeguards({
        framework: 'nydfs',
        safeguards: NYDFS_SAFEGUARDS.map((sg) => ({ id: sg.id, name: sg.name, desc: sg.desc })),
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
    dispatch({ type: 'SET_SAFEGUARDS_BULK', payload: { framework: 'nydfs', assessments: bulk } })
    setAiSafeguardSuggestions(null)
  }

  const applySingleSafeguardSuggestion = (safeguardId) => {
    const sug = aiSafeguardSuggestions?.[safeguardId]
    if (!sug) return
    dispatch({ type: 'SET_SAFEGUARD', payload: { framework: 'nydfs', safeguardId, policy: sug.policy, implementation: sug.implementation, note: `AI: ${sug.rationale}` } })
  }

  if (NYDFS_DOMAINS.length === 0) {
    return (
      <div>
        <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight mb-2">NYDFS 23 NYCRR 500</h1>
        <p className="text-txt-3 text-[0.88rem]">NYDFS safeguard data is loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">NYDFS 23 NYCRR 500</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">
            {NYDFS_DOMAINS.length} domains, {totalSafeguards} safeguards — New York Department of Financial Services Cybersecurity Regulation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <AiButton onClick={handleAiSafeguardAssess} loading={aiSafeguardLoading}>AI Safeguard Assess</AiButton>
          <AiButton onClick={handleAiReport} loading={aiLoading} className="small">Board Report</AiButton>
        </div>
      </div>

      <AiSlidePanel open={aiOpen} onClose={() => setAiOpen(false)} title="NYDFS 500 — Board Report" loading={aiLoading} content={aiContent}>
        {aiError && <AiError error={aiError} onRetry={handleAiReport} />}
      </AiSlidePanel>

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
              <circle cx="60" cy="60" r="50" fill="none" stroke={compliancePercent > 60 ? '#16a34a' : compliancePercent > 30 ? '#ea580c' : '#dc2626'} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - compliancePercent / 100)}`}
                transform="rotate(-90 60 60)" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[1.65rem] font-[800] leading-none tracking-tight">{compliancePercent}</span>
              <span className="text-[0.75rem] text-txt-3 font-semibold">%</span>
            </div>
          </div>
          <div className="flex-1">
            <span className="inline-block text-[0.72rem] font-bold px-3 py-1 rounded-full mb-2" style={{ backgroundColor: assessment.overallLevel.bg, color: assessment.overallLevel.color }}>
              {assessment.overallLevel.label}
            </span>
            <div className="text-[0.78rem] text-txt-2 flex flex-col gap-[0.2rem]">
              <span>{NYDFS_DOMAINS.length} domains assessed</span>
              <span className="font-semibold">{assessedCount}/{totalSafeguards} Assessed · {compliancePercent}% Compliant</span>
            </div>
          </div>
        </div>
        {/* Horizontal bar chart (16 domains too dense for radar) */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex flex-col justify-center gap-[0.35rem] max-h-[300px] overflow-y-auto">
          {NYDFS_DOMAINS.map((d) => {
            const sgGroup = safeguardAssessmentResult?.groups?.find((g) => g.id === d.id)
            const score = sgGroup?.score || 0
            return (
              <div key={d.id} className="flex items-center gap-[0.45rem]">
                <span className="text-[0.68rem] font-semibold w-[72px] truncate" style={{ color: d.color }}>{d.name}</span>
                <div className="flex-1 h-[6px] bg-subtle rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-500" style={{ width: `${score * 100}%`, backgroundColor: d.color, minWidth: score > 0 ? '2px' : '0' }} />
                </div>
                <span className="text-[0.68rem] font-bold w-8 text-right" style={{ color: d.color }}>{Math.round(score * 100)}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Domain Cards */}
      <div className="mt-5">
        <h2 className="text-[0.82rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-3">Domain Details</h2>
        <div className="flex flex-col gap-[0.35rem]">
          {assessment.domains.map((domain) => (
            <SafeguardGroupCard
              key={domain.id}
              group={{ ...domain, safeguards: safeguardsByDomain[domain.id] || [] }}
              mappedObjects={domain.objects}
              assessments={nydfsAssessmentData}
              overrideData={domain.override}
              onAssess={handleAssess}
              onCreateGap={handleCreateGap}
              onOverride={(level, note) => handleOverride(domain.id, level, note)}
              onClearOverride={() => handleClearOverride(domain.id)}
              onNavigate={onNavigate}
              aiSuggestions={aiSafeguardSuggestions}
              onApplyAi={applySingleSafeguardSuggestion}
              autoMaturity={domain.autoMaturity}
              borderColor={domain.color}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
