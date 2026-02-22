import React, { useState, useCallback } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { HEALTH_STATUSES, NIST_FAMILIES, MLG_PHASES, computeMLGScore, ATTESTATIONS, REMEDIATION_STATUSES, REMEDIATION_SEVERITIES } from '../../data/constants.js'
import { isStale, formatDate, daysSince } from '../../utils/compliance.js'
import { assessRisk, detectRegulatory, assessKpiCoherence, assessControlCoherence } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'
import { mapObjectToCIS, mapObjectToCSF, mapObjectToGLBA, mapObjectToNYDFS } from '../../data/frameworks.js'
import { computeSafeguardScore } from '../../utils/safeguardScoring.js'
import { CIS_SAFEGUARDS, NIST_CSF_SAFEGUARDS, GLBA_SAFEGUARDS, NYDFS_SAFEGUARDS } from '../../data/safeguards.js'
import ObjectForm from './ObjectForm.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'

export default function ObjectDetail({ objectId, onNavigate }) {
  const { objects, mlgAssessments, attestations, regulatoryQueue, safeguardAssessments } = useStore()
  const dispatch = useDispatch()
  const [editing, setEditing] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [regScanning, setRegScanning] = useState(false)
  const [regScanError, setRegScanError] = useState(null)
  const [kpiAssessment, setKpiAssessment] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(false)
  const [kpiError, setKpiError] = useState(null)
  const [controlCoherence, setControlCoherence] = useState(null)
  const [controlCoherenceLoading, setControlCoherenceLoading] = useState(false)
  const [controlCoherenceError, setControlCoherenceError] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false })
  const closeConfirmDialog = useCallback(() => setConfirmDialog({ open: false }), [])
  const [showRemForm, setShowRemForm] = useState(false)
  const [remediationForm, setRemediationForm] = useState({ title: '', severity: 'AMBER' })

  const safeguardData = { CIS_SAFEGUARDS, NIST_CSF_SAFEGUARDS, GLBA_SAFEGUARDS, NYDFS_SAFEGUARDS }

  const handleRiskAssess = async () => {
    const obj = objects.find((o) => o.id === objectId)
    if (!obj) return
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await assessRisk(obj)
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleRegScan = async () => {
    const obj = objects.find((o) => o.id === objectId)
    if (!obj) return
    setRegScanning(true)
    setRegScanError(null)
    try {
      const payload = {
        objects: [{
          id: obj.id,
          listName: obj.listName,
          type: obj.type,
          description: obj.description,
          productFamilies: obj.productFamilies,
          criticality: obj.criticality,
          dataClassification: obj.dataClassification,
          environment: obj.environment,
          controlClassification: obj.controlClassification,
          nistFamilies: obj.nistFamilies,
        }],
      }
      const res = await detectRegulatory(payload)
      const newDetections = []
      const confirmed = (attestations || {})[obj.id] || []
      for (const objResult of res.detections || []) {
        for (const att of objResult.attestations || []) {
          if (confirmed.includes(att.id)) continue
          const alreadyQueued = (regulatoryQueue || []).some(
            (q) => q.objectId === obj.id && q.attestationId === att.id && (q.status === 'pending' || q.status === 'dismissed')
          )
          if (alreadyQueued) continue
          newDetections.push({
            objectId: obj.id,
            objectName: obj.listName,
            attestationId: att.id,
            confidence: att.confidence,
            rationale: att.rationale,
          })
        }
      }
      if (newDetections.length > 0) {
        dispatch({ type: 'ADD_REGULATORY_DETECTIONS', payload: newDetections })
      }
    } catch (err) {
      setRegScanError(err.message || 'Scan failed. Is Ollama running?')
    }
    setRegScanning(false)
  }

  const handleKpiCoherence = async () => {
    const obj = objects.find((o) => o.id === objectId)
    if (!obj) return
    setKpiLoading(true)
    setKpiError(null)
    setKpiAssessment(null)
    try {
      const res = await assessKpiCoherence(obj)
      setKpiAssessment(res.assessment)
    } catch (err) {
      setKpiError(err.message)
    } finally {
      setKpiLoading(false)
    }
  }

  const handleControlCoherence = async () => {
    const obj = objects.find((o) => o.id === objectId)
    if (!obj || obj.controlClassification !== 'Formal') return
    setControlCoherenceLoading(true)
    setControlCoherenceError(null)
    setControlCoherence(null)
    try {
      const res = await assessControlCoherence(obj)
      setControlCoherence(res.assessment)
    } catch (err) {
      setControlCoherenceError(err.message)
    } finally {
      setControlCoherenceLoading(false)
    }
  }

  const removeAttestation = (attId) => {
    dispatch({ type: 'REMOVE_ATTESTATION', payload: { objectId: objectId, attestationId: attId } })
  }

  const obj = objects.find((o) => o.id === objectId)
  if (!obj) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-8 text-center" style={{ marginTop: '2rem' }}>
        <p>Object not found.</p>
        <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-3 py-1.5 text-[0.8rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97]" onClick={() => onNavigate('objects')}>Back to Object Inventory</button>
      </div>
    )
  }

  const hs = HEALTH_STATUSES.find((h) => h.id === obj.healthStatus) || HEALTH_STATUSES[2]
  const stale = isStale(obj.lastReviewDate)
  const remItems = obj.remediationItems || []
  const openRemCount = remItems.filter((i) => i.status !== 'Resolved').length

  const handleDelete = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Object',
      message: `Delete "${obj.listName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => {
        dispatch({ type: 'DELETE_OBJECT', payload: obj.id })
        onNavigate('objects')
        setConfirmDialog({ open: false })
      },
    })
  }

  const handleSave = (data) => {
    dispatch({ type: 'UPDATE_OBJECT', payload: { id: obj.id, ...data } })
    setEditing(false)
  }

  const critColors = {
    critical: 'bg-red-bg text-red',
    high: 'bg-orange-bg text-orange',
    medium: 'bg-amber-bg text-amber',
    low: 'bg-green-bg text-green',
  }

  const confidenceColors = {
    high: 'bg-green-bg text-green',
    medium: 'bg-amber-bg text-amber',
    low: 'bg-red-bg text-red',
  }

  const alignmentColors = {
    aligned: 'bg-green-bg text-green',
    partially_aligned: 'bg-amber-bg text-amber',
    misaligned: 'bg-red-bg text-red',
  }

  const suggestionTypeColors = {
    primary_kpi: 'bg-brand/10 text-brand',
    secondary_kpi: 'bg-ai/10 text-ai',
    denominator_fix: 'bg-amber-bg text-amber',
  }

  const coherenceScoreColor = (score) => {
    if (score >= 85) return 'bg-green-bg text-green'
    if (score >= 65) return 'bg-brand/10 text-brand'
    if (score >= 40) return 'bg-amber-bg text-amber'
    return 'bg-red-bg text-red'
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[0.78rem] mb-4">
        <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.78rem] font-medium hover:text-brand-deep transition-colors p-0" onClick={() => onNavigate('objects')}>Object Inventory</button>
        <span className="text-txt-3">/</span>
        <span className="text-txt-2 font-medium truncate">{obj.listName || 'Untitled'}</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-4 flex-wrap">
        <div className="flex flex-col">
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">{obj.listName || 'Untitled'}</h1>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="inline-flex items-center text-[0.72rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: hs.bg, color: hs.color }}>{hs.label}</span>
            {(() => {
              const mlg = mlgAssessments[obj.id]
              if (!mlg) return null
              const { tier } = computeMLGScore(mlg, obj)
              return <span className="inline-flex items-center text-[0.72rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: tier.bg, color: tier.color }}>{tier.label}</span>
            })()}
            <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded bg-subtle text-txt-3 tracking-wider">{obj.type}</span>
            <span className={`text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider ${critColors[(obj.criticality || 'medium').toLowerCase()] || ''}`}>{obj.criticality}</span>
            {stale && <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-bg text-amber">Stale</span>}
            {obj.status !== 'Active' && <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded bg-red-bg text-red">{obj.status}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AiButton onClick={handleRiskAssess} loading={aiLoading}>Risk Assessment</AiButton>
          <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setEditing(true)}>Edit</button>
          <button className="bg-transparent text-red border border-red/20 rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-red-bg hover:border-red/30" onClick={handleDelete}>Delete</button>
        </div>

        <AiSlidePanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          title={`Risk Assessment — ${obj.listName}`}
          loading={aiLoading}
          content={aiContent}
        >
          {aiError && <AiError error={aiError} onRetry={handleRiskAssess} />}
        </AiSlidePanel>
      </div>

      {obj.description && (
        <p className="text-[0.88rem] text-txt-2 leading-relaxed mb-6">{obj.description}</p>
      )}

      {/* Layout: Reference sidebar + Main cards */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Left: Compact reference panel */}
        <div className="w-full md:w-[260px] shrink-0 bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 h-fit">
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Owner</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.owner || '—'}</span>
          </div>
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Operator</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.operator || '—'}</span>
          </div>
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Identifying Person</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.identifyingPerson || '—'}</span>
          </div>
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Business Unit</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.businessUnit || '—'}</span>
          </div>

          <div className="border-t border-border-light my-3" />

          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Review Cadence</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.reviewCadence}</span>
          </div>
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Last Review</span>
            <span className="text-[0.85rem] text-txt font-medium block">{formatDate(obj.lastReviewDate)}{stale ? ` (${daysSince(obj.lastReviewDate)}d)` : ''}</span>
          </div>
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Next Review</span>
            <span className="text-[0.85rem] text-txt font-medium block">{formatDate(obj.nextReviewDate)}</span>
          </div>

          <div className="border-t border-border-light my-3" />

          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Environment</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.environment}</span>
          </div>
          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Data Classification</span>
            <span className="text-[0.85rem] text-txt font-medium block">{obj.dataClassification}</span>
          </div>

          <div className="border-t border-border-light my-3" />

          <div className="mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Product Families</span>
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: '0.2rem' }}>
              {(obj.productFamilies || []).length > 0
                ? obj.productFamilies.map((f) => <span key={f} className="text-[0.68rem] font-semibold px-2 py-0.5 rounded-full bg-brand/[0.08] text-brand">{f}</span>)
                : <span className="text-txt-3">None</span>
              }
            </div>
          </div>

          {(obj.jiraL1 || obj.jiraL2) && (
            <>
              <div className="border-t border-border-light my-3" />
              {obj.jiraL1 && (
                <div className="mb-3">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Jira L1</span>
                  <span className="text-[0.85rem] text-txt font-medium block font-mono text-[0.82rem]">{obj.jiraL1}</span>
                </div>
              )}
              {obj.jiraL2 && (
                <div className="mb-3">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Jira L2</span>
                  <span className="text-[0.85rem] text-txt font-medium block font-mono text-[0.82rem]">{obj.jiraL2}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Main cards stacked */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {/* Compliance Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Compliance</h3>
              <button
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.72rem] font-semibold bg-ai/[0.08] text-ai border border-ai/15 cursor-pointer font-sans transition-all duration-150 hover:bg-ai/[0.12] hover:border-ai/25 ${kpiLoading ? 'opacity-60 cursor-wait' : ''}`}
                onClick={handleKpiCoherence}
                disabled={kpiLoading}
                title="AI KPI Coherence Check"
              >
                {kpiLoading ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-ai/30 border-t-ai rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                )}
                KPI Check
              </button>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="relative w-[100px] h-[100px] shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke={obj.compliancePercent >= 80 ? '#16a34a' : obj.compliancePercent >= 50 ? '#d97706' : '#dc2626'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(obj.compliancePercent, 100) / 100)}`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-[800] tracking-tight text-txt">{obj.compliancePercent}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[1.1rem] font-[700] text-txt tracking-tight">{obj.kpiNumerator} / {obj.kpiDenominator}</span>
                <span className="text-[0.72rem] text-txt-3 font-medium">Numerator / Denominator</span>
              </div>
            </div>
            {obj.kpiDefinition && (
              <div className="mt-3 pt-3 border-t border-border-light">
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">KPI Definition</span>
                <span className="text-[0.82rem] text-txt-2 leading-relaxed">{obj.kpiDefinition}</span>
              </div>
            )}
            {kpiError && (
              <div className="flex items-center gap-2 text-red text-[0.82rem] bg-red-bg border border-red/10 rounded-lg px-3 py-2" style={{ marginTop: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{kpiError}</span>
              </div>
            )}
            {kpiAssessment && (
              <div className="mt-4 p-4 bg-ai/[0.04] border border-ai/10 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-lg text-center ${confidenceColors[kpiAssessment.confidenceLabel?.toLowerCase()] || confidenceColors.medium}`}>
                    <span className="text-lg font-[800]">{kpiAssessment.confidence}</span>
                    <span className="text-[0.65rem] font-bold uppercase">{kpiAssessment.confidenceLabel || 'N/A'}</span>
                  </div>
                  <span className={`text-[0.72rem] font-bold px-2.5 py-1 rounded-full ${alignmentColors[kpiAssessment.alignment] || ''}`}>
                    {kpiAssessment.alignment === 'aligned' ? 'Aligned' : kpiAssessment.alignment === 'partially_aligned' ? 'Partially Aligned' : 'Misaligned'}
                  </span>
                </div>
                {kpiAssessment.alignmentRationale && (
                  <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-3">{kpiAssessment.alignmentRationale}</p>
                )}
                {kpiAssessment.inferredKpiDefinition && (
                  <div className="mt-2 p-3 bg-subtle rounded-lg">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">AI-Inferred KPI</span>
                    <span className="text-[0.82rem] text-txt-2">{kpiAssessment.inferredKpiDefinition}</span>
                  </div>
                )}
                {kpiAssessment.scaleAssessment && (
                  <div className="mt-2 p-3 bg-subtle rounded-lg">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Scale Assessment</span>
                    <span className="text-[0.82rem] text-txt-2">{kpiAssessment.scaleAssessment}</span>
                  </div>
                )}
                {kpiAssessment.anomalies?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-1.5">Anomalies</span>
                    {kpiAssessment.anomalies.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[0.82rem] text-txt-2 mb-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        </svg>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}
                {kpiAssessment.suggestions?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-1.5">Suggestions</span>
                    {kpiAssessment.suggestions.map((s, i) => (
                      <div key={i} className="flex flex-col gap-0.5 p-3 bg-white/80 rounded-lg border border-border-light mb-2">
                        <span className={`text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded self-start ${suggestionTypeColors[s.type] || 'bg-amber-bg text-amber'}`}>
                          {s.type === 'primary_kpi' ? 'Primary KPI' : s.type === 'secondary_kpi' ? 'Secondary KPI' : 'Denominator'}
                        </span>
                        <strong className="font-semibold text-txt text-[0.82rem]">{s.suggestion}</strong>
                        <span className="text-[0.78rem] text-txt-3">{s.rationale}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.72rem] font-semibold hover:text-brand-deep transition-colors p-0" onClick={() => setKpiAssessment(null)} style={{ marginTop: '0.5rem' }}>
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Controls Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Controls</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {obj.controlClassification === 'Formal' && (
                  <button
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.72rem] font-semibold bg-ai/[0.08] text-ai border border-ai/15 cursor-pointer font-sans transition-all duration-150 hover:bg-ai/[0.12] hover:border-ai/25 ${controlCoherenceLoading ? 'opacity-60 cursor-wait' : ''}`}
                    onClick={handleControlCoherence}
                    disabled={controlCoherenceLoading}
                    title="Check control description quality"
                  >
                    {controlCoherenceLoading ? (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-ai/30 border-t-ai rounded-full animate-spin" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                    )}
                    Check Control
                  </button>
                )}
                <button
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.72rem] font-semibold bg-ai/[0.08] text-ai border border-ai/15 cursor-pointer font-sans transition-all duration-150 hover:bg-ai/[0.12] hover:border-ai/25 ${regScanning ? 'opacity-60 cursor-wait' : ''}`}
                  onClick={handleRegScan}
                  disabled={regScanning}
                  title="Scan for regulatory attestations"
                >
                  {regScanning ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-ai/30 border-t-ai rounded-full animate-spin" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  )}
                  Scan Regs
                </button>
              </div>
            </div>
            {regScanError && (
              <div className="flex items-center gap-2 text-red text-[0.82rem] bg-red-bg border border-red/10 rounded-lg px-3 py-2" style={{ marginBottom: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{regScanError}</span>
              </div>
            )}
            {controlCoherenceError && (
              <div className="flex items-center gap-2 text-red text-[0.82rem] bg-red-bg border border-red/10 rounded-lg px-3 py-2" style={{ marginBottom: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{controlCoherenceError}</span>
              </div>
            )}
            {controlCoherence && (
              <div className="mt-4 p-4 bg-ai/[0.04] border border-ai/10 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[0.82rem] font-bold text-txt">Control Statement Quality</span>
                  <span className={`text-[0.72rem] font-bold px-2.5 py-1 rounded-full ${coherenceScoreColor(controlCoherence.qualityScore)}`}>
                    {controlCoherence.qualityScore}/100 — {controlCoherence.qualityLabel}
                  </span>
                </div>
                {controlCoherence.maturityAlignment && (
                  <div className="mt-3 p-3 bg-subtle rounded-lg">
                    <span className="text-[0.78rem] font-bold text-brand block mb-0.5">{controlCoherence.maturityAlignment.suggestedTier}</span>
                    <span className="text-[0.78rem] text-txt-2">{controlCoherence.maturityAlignment.rationale}</span>
                  </div>
                )}
                {controlCoherence.strengths?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-1.5">Strengths</span>
                    {controlCoherence.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[0.82rem] text-txt-2 mb-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5"/></svg>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {controlCoherence.missingElements?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-1.5">Missing Elements</span>
                    {controlCoherence.missingElements.map((m, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[0.82rem] text-txt-2 mb-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                )}
                {controlCoherence.impactAssessment && (
                  <div className="mt-3 p-3 bg-subtle rounded-lg text-[0.82rem] text-txt-2">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-0.5">Maturity Impact</span>
                    <span>{controlCoherence.impactAssessment}</span>
                  </div>
                )}
                {controlCoherence.rewriteSuggestion && (
                  <div className="mt-3 p-3 bg-brand/[0.04] border border-brand/10 rounded-lg">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-brand block mb-1">Suggested Rewrite</span>
                    <p className="text-[0.82rem] text-txt leading-relaxed m-0 italic">{controlCoherence.rewriteSuggestion}</p>
                  </div>
                )}
                <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.72rem] font-semibold hover:text-brand-deep transition-colors p-0" onClick={() => setControlCoherence(null)} style={{ marginTop: '0.5rem' }}>
                  Dismiss
                </button>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Classification</span>
                <span className={`inline-flex text-[0.72rem] font-bold px-2.5 py-1 rounded-full self-start ${obj.controlClassification.toLowerCase() === 'formal' ? 'bg-green-bg text-green' : 'bg-amber-bg text-amber'}`}>
                  {obj.controlClassification}
                </span>
              </div>
              {obj.controlType && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Control Function</span>
                  <span className="inline-flex text-[0.72rem] font-bold px-2 py-0.5 rounded-full bg-subtle text-txt-2 self-start">{obj.controlType}</span>
                </div>
              )}
              {obj.implementationType && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Implementation</span>
                  <span className="inline-flex text-[0.72rem] font-bold px-2 py-0.5 rounded-full bg-subtle text-txt-2 self-start">{obj.implementationType}</span>
                </div>
              )}
              {obj.executionFrequency && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Execution Frequency</span>
                  <span className="text-[0.85rem] text-txt">{obj.executionFrequency}</span>
                </div>
              )}
              {obj.controlObjective && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Control Objective</span>
                  <span className="text-[0.85rem] text-txt" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>{obj.controlObjective}</span>
                </div>
              )}
              {obj.controlClassification === 'Formal' && obj.nistFamilies?.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">NIST 800-53 Families</span>
                  <div className="flex flex-wrap gap-1.5">
                    {obj.nistFamilies.map((fId) => {
                      const fam = NIST_FAMILIES.find((n) => n.id === fId)
                      return (
                        <span key={fId} className="text-[0.68rem] font-semibold px-2 py-0.5 rounded-full bg-brand/[0.08] text-brand" title={fam?.name}>
                          {fId}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Confirmed Attestations */}
              {(() => {
                const objAtts = (attestations || {})[obj.id] || []
                const pendingCount = (regulatoryQueue || []).filter(
                  (q) => q.objectId === obj.id && q.status === 'pending'
                ).length
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">
                      Regulatory Attestations
                      {pendingCount > 0 && (
                        <button className="ml-2 bg-transparent border-none text-amber cursor-pointer font-sans text-[0.72rem] font-semibold underline hover:text-amber/80 transition-colors p-0" onClick={() => onNavigate('regulatory')}>
                          {pendingCount} pending review
                        </button>
                      )}
                    </span>
                    {objAtts.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {objAtts.map((attId) => {
                          const att = ATTESTATIONS.find((a) => a.id === attId) || { id: attId, name: attId, category: 'Unknown' }
                          return (
                            <span key={attId} className="inline-flex items-center gap-1 text-[0.72rem] font-semibold px-2.5 py-1 rounded-full bg-amber-bg text-amber" title={att.desc}>
                              {att.name}
                              <button className="bg-transparent border-none text-amber cursor-pointer p-0.5 rounded transition-opacity hover:opacity-70" onClick={() => removeAttestation(attId)} title="Remove">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-txt-3" style={{ fontSize: '0.82rem' }}>None confirmed — run Scan Regs to detect</span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Governance Maturity Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt mb-4">Governance Maturity</h3>
            {(() => {
              const mlg = mlgAssessments[obj.id]
              if (!mlg) {
                return (
                  <div className="flex flex-col gap-3">
                    <p className="text-txt-3" style={{fontSize:'0.85rem',lineHeight:'1.6'}}>No MLG assessment yet.</p>
                    <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-3 py-1.5 text-[0.8rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97] self-start" style={{marginTop:'0.25rem'}} onClick={() => onNavigate('mlg', obj.id)}>
                      Run Diagnostic
                    </button>
                  </div>
                )
              }
              const { score, tier } = computeMLGScore(mlg, obj)
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Tier</span>
                    <span className="inline-flex items-center text-[0.72rem] font-bold px-2.5 py-1 rounded-full self-start" style={{ backgroundColor: tier.bg, color: tier.color }}>{tier.tier} — {tier.label}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">Score</span>
                    <span className="text-[0.85rem] text-txt">{score} / 20</span>
                  </div>
                  {MLG_PHASES.map((phase) => {
                    const phaseScore = phase.checkpoints.reduce((sum, cp) => {
                      const ans = mlg[cp.id]
                      return sum + (ans === 'yes' ? 1 : ans === 'weak' ? 0.5 : 0)
                    }, 0)
                    return (
                      <div key={phase.id} className="flex flex-col gap-0.5">
                        <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3">P{phase.phase}: {phase.name}</span>
                        <span className="text-[0.85rem] text-txt">{phaseScore}/{phase.checkpoints.length}</span>
                      </div>
                    )
                  })}
                  <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.82rem] font-semibold hover:text-brand-deep transition-colors p-0 self-start" style={{marginTop:'0.25rem'}} onClick={() => onNavigate('mlg', obj.id)}>
                    Open Diagnostic
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Framework Coverage */}
          {(() => {
            if (!obj || !safeguardData) return null
            const cisGroups = mapObjectToCIS(obj)
            const csfCategories = mapObjectToCSF(obj)
            const glbaDomains = mapObjectToGLBA(obj)
            const nydfsDomains = mapObjectToNYDFS(obj)
            const sa = safeguardAssessments || {}
            const frameworks = [
              { key: 'cis-v8', label: 'CIS v8', color: '#2563eb', groups: cisGroups, safeguards: safeguardData.CIS_SAFEGUARDS || [], groupKey: 'groupId' },
              { key: 'nist-csf', label: 'NIST CSF', color: '#7c3aed', groups: csfCategories, safeguards: safeguardData.NIST_CSF_SAFEGUARDS || [], groupKey: 'categoryId' },
              { key: 'glba', label: 'GLBA', color: '#0891b2', groups: glbaDomains, safeguards: safeguardData.GLBA_SAFEGUARDS || [], groupKey: 'domainId' },
              { key: 'nydfs', label: 'NYDFS', color: '#c026d3', groups: nydfsDomains, safeguards: safeguardData.NYDFS_SAFEGUARDS || [], groupKey: 'domainId' },
            ]
            const hasAny = frameworks.some(f => f.groups.length > 0)
            if (!hasAny) return null
            return (
              <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
                <h3 className="text-[0.95rem] font-bold tracking-tight text-txt mb-4">Framework Coverage</h3>
                <div className="flex flex-col gap-3">
                  {frameworks.map(fw => {
                    if (fw.groups.length === 0) return null
                    const fwAssessments = sa[fw.key] || {}
                    const mapped = fw.safeguards.filter(sg => fw.groups.includes(sg[fw.groupKey]))
                    const assessed = mapped.filter(sg => fwAssessments[sg.id])
                    const passing = assessed.filter(sg => {
                      const a = fwAssessments[sg.id]
                      if (!a) return false
                      const score = computeSafeguardScore(a.policy, a.implementation)
                      return score !== null && score >= 0.6
                    })
                    return (
                      <div key={fw.key} className="flex items-center gap-3">
                        <span className="text-[0.72rem] font-bold px-2 py-0.5 rounded-full w-[72px] text-center shrink-0" style={{ backgroundColor: fw.color + '15', color: fw.color }}>{fw.label}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-[5px] bg-subtle rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: mapped.length > 0 ? `${(passing.length / mapped.length) * 100}%` : '0%', backgroundColor: fw.color }} />
                            </div>
                            <span className="text-[0.72rem] font-semibold text-txt-2 whitespace-nowrap">{passing.length}/{mapped.length} passing</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {mapped.slice(0, 8).map(sg => {
                              const a = fwAssessments[sg.id]
                              const score = a ? computeSafeguardScore(a.policy, a.implementation) : null
                              const dotColor = score === null ? '#cbd5e1' : score >= 0.6 ? '#16a34a' : score >= 0.3 ? '#d97706' : '#dc2626'
                              return <span key={sg.id} className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: dotColor }} title={`${sg.id}: ${sg.name}${score !== null ? ` (${Math.round(score * 100)}%)` : ' (not assessed)'}`} />
                            })}
                            {mapped.length > 8 && <span className="text-[0.6rem] text-txt-3 font-medium">+{mapped.length - 8}</span>}
                          </div>
                        </div>
                        <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.72rem] font-semibold hover:text-brand-deep transition-colors p-0 shrink-0" onClick={() => onNavigate(fw.key)}>View</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Health Rationale */}
      {(obj.healthStatus === 'RED' || obj.healthStatus === 'AMBER') && obj.healthRationale && (
        <div className={`flex items-start gap-3 p-4 rounded-xl mb-6 ${obj.healthStatus === 'RED' ? 'bg-red-bg border border-red/10' : 'bg-amber-bg border border-amber/10'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={obj.healthStatus === 'RED' ? '#dc2626' : '#ea580c'} strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <strong className="text-[0.85rem] font-bold text-txt block mb-0.5">{obj.healthStatus} Health Rationale</strong>
            <p className="text-[0.82rem] text-txt-2 leading-relaxed m-0">{obj.healthRationale}</p>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      {obj.history?.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Change Log</h3>
            <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{obj.history.length} entries</span>
          </div>
          <div className="flex flex-col">
            {[...obj.history].reverse().map((entry, i) => (
              <div key={i} className="flex gap-3 pb-4 last:pb-0 relative">
                <div className="w-2.5 h-2.5 rounded-full bg-brand/30 mt-1.5 shrink-0 relative z-10" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[0.78rem] font-semibold text-txt">{entry.action}</span>
                  <span className="text-[0.78rem] text-txt-2 mt-0.5">{entry.note}</span>
                  <span className="text-[0.68rem] text-txt-3 mt-0.5">{formatDate(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remediation Items */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Remediation Items ({openRemCount} open)</h3>
          <button
            className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-3 py-1.5 text-[0.8rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5"
            onClick={() => setShowRemForm((v) => !v)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Item
          </button>
        </div>

        {/* Quick-add inline form */}
        {showRemForm && (
          <div className="flex items-end gap-2 mb-4 p-3 bg-subtle/60 rounded-xl animate-[fadeIn_0.18s_ease]">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[0.72rem] font-semibold text-txt-3">Title</label>
              <input
                className="bg-white border border-border rounded-lg px-3 py-1.5 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3"
                value={remediationForm.title}
                onChange={(e) => setRemediationForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="What needs fixing?"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.72rem] font-semibold text-txt-3">Severity</label>
              <div className="flex gap-1">
                {REMEDIATION_SEVERITIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`px-2.5 py-1.5 border border-border rounded-lg text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${
                      remediationForm.severity === s.id ? 'font-bold' : 'bg-white text-txt-2'
                    }`}
                    style={remediationForm.severity === s.id ? { backgroundColor: s.bg, color: s.color, borderColor: s.color } : {}}
                    onClick={() => setRemediationForm((f) => ({ ...f, severity: s.id }))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-lg px-4 py-1.5 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45"
              disabled={!remediationForm.title.trim()}
              onClick={() => {
                dispatch({ type: 'ADD_REMEDIATION_ITEM', payload: { objectId: obj.id, title: remediationForm.title.trim(), severity: remediationForm.severity, note: '' } })
                setRemediationForm({ title: '', severity: 'AMBER' })
                setShowRemForm(false)
              }}
            >
              Add
            </button>
          </div>
        )}

        {remItems.length === 0 ? (
          <p className="text-txt-3 text-[0.85rem]">No remediation items tracked for this object.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {remItems.map((item) => {
              const sev = REMEDIATION_SEVERITIES.find((s) => s.id === item.severity) || REMEDIATION_SEVERITIES[1]
              const statusDotColor = item.status === 'Open' ? 'bg-red' : item.status === 'In Progress' ? 'bg-amber' : 'bg-green'
              return (
                <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-b border-border-light last:border-0">
                  <span className="text-[0.68rem] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: sev.bg, color: sev.color }}>{sev.label}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor}`} />
                  <span className="text-[0.82rem] text-txt flex-1">{item.title}</span>
                  <span className="text-[0.68rem] font-bold uppercase text-txt-3">{item.status}</span>
                  <div className="flex gap-1">
                    {item.status === 'Open' && (
                      <button
                        className="bg-white border border-border text-txt-2 rounded px-2 py-0.5 text-[0.72rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300"
                        onClick={() => dispatch({ type: 'UPDATE_REMEDIATION_ITEM', payload: { objectId: obj.id, itemId: item.id, status: 'In Progress' } })}
                      >
                        Start
                      </button>
                    )}
                    {item.status !== 'Resolved' && (
                      <button
                        className="bg-white border border-green/25 text-green rounded px-2 py-0.5 text-[0.72rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-green-bg hover:border-green/40"
                        onClick={() => dispatch({ type: 'UPDATE_REMEDIATION_ITEM', payload: { objectId: obj.id, itemId: item.id, status: 'Resolved' } })}
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      className="bg-white border border-red/25 text-red rounded px-2 py-0.5 text-[0.72rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-red-bg hover:border-red/40"
                      onClick={() => dispatch({ type: 'REMOVE_REMEDIATION_ITEM', payload: { objectId: obj.id, itemId: item.id } })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <ObjectForm
          object={obj}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={closeConfirmDialog}
      />
    </div>
  )
}
