import React, { useState, useCallback } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { HEALTH_STATUSES, NIST_FAMILIES, MLG_PHASES, computeMLGScore, ATTESTATIONS } from '../../data/constants.js'
import { isStale, formatDate, daysSince } from '../../utils/compliance.js'
import { assessRisk, detectRegulatory, assessKpiCoherence, assessControlCoherence } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'
import ObjectForm from './ObjectForm.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'

export default function ObjectDetail({ objectId, onNavigate }) {
  const { objects, gaps, mlgAssessments, attestations, regulatoryQueue } = useStore()
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
      <div className="empty-state card" style={{ marginTop: '2rem' }}>
        <p>Object not found.</p>
        <button className="btn-primary small" onClick={() => onNavigate('objects')}>Back to Object Inventory</button>
      </div>
    )
  }

  const hs = HEALTH_STATUSES.find((h) => h.id === obj.healthStatus) || HEALTH_STATUSES[2]
  const stale = isStale(obj.lastReviewDate)
  const objectGaps = gaps.filter((g) => {
    const ids = g.objectIds || (g.objectId ? [g.objectId] : [])
    return ids.includes(obj.id)
  })
  const openGaps = objectGaps.filter((g) => g.status !== 'Closed').length

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

  return (
    <div className="object-detail">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => onNavigate('objects')}>Object Inventory</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{obj.listName || 'Untitled'}</span>
      </div>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-header-left">
          <h1>{obj.listName || 'Untitled'}</h1>
          <div className="detail-tags">
            <span className="health-tag" style={{ backgroundColor: hs.bg, color: hs.color }}>{hs.label}</span>
            {(() => {
              const mlg = mlgAssessments[obj.id]
              if (!mlg) return null
              const { tier } = computeMLGScore(mlg, obj)
              return <span className="maturity-tag" style={{ backgroundColor: tier.bg, color: tier.color }}>{tier.label}</span>
            })()}
            <span className="type-tag">{obj.type}</span>
            <span className={`crit-tag crit-${(obj.criticality || 'medium').toLowerCase()}`}>{obj.criticality}</span>
            {stale && <span className="stale-badge">Stale</span>}
            {obj.status !== 'Active' && <span className="status-tag inactive">{obj.status}</span>}
          </div>
        </div>
        <div className="detail-header-right">
          <AiButton onClick={handleRiskAssess} loading={aiLoading}>Risk Assessment</AiButton>
          <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-danger-outline" onClick={handleDelete}>Delete</button>
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
        <p className="detail-description">{obj.description}</p>
      )}

      {/* Layout: Reference sidebar + Main cards */}
      <div className="detail-layout">
        {/* Left: Compact reference panel */}
        <div className="detail-reference">
          <div className="ref-group">
            <span className="ref-label">Owner</span>
            <span className="ref-value">{obj.owner || '—'}</span>
          </div>
          <div className="ref-group">
            <span className="ref-label">Operator</span>
            <span className="ref-value">{obj.operator || '—'}</span>
          </div>
          <div className="ref-group">
            <span className="ref-label">Identifying Person</span>
            <span className="ref-value">{obj.identifyingPerson || '—'}</span>
          </div>
          <div className="ref-group">
            <span className="ref-label">Business Unit</span>
            <span className="ref-value">{obj.businessUnit || '—'}</span>
          </div>

          <div className="ref-divider" />

          <div className="ref-group">
            <span className="ref-label">Review Cadence</span>
            <span className="ref-value">{obj.reviewCadence}</span>
          </div>
          <div className="ref-group">
            <span className="ref-label">Last Review</span>
            <span className="ref-value">{formatDate(obj.lastReviewDate)}{stale ? ` (${daysSince(obj.lastReviewDate)}d)` : ''}</span>
          </div>
          <div className="ref-group">
            <span className="ref-label">Next Review</span>
            <span className="ref-value">{formatDate(obj.nextReviewDate)}</span>
          </div>

          <div className="ref-divider" />

          <div className="ref-group">
            <span className="ref-label">Environment</span>
            <span className="ref-value">{obj.environment}</span>
          </div>
          <div className="ref-group">
            <span className="ref-label">Data Classification</span>
            <span className="ref-value">{obj.dataClassification}</span>
          </div>

          <div className="ref-divider" />

          <div className="ref-group">
            <span className="ref-label">Product Families</span>
            <div className="family-chips" style={{ marginTop: '0.2rem' }}>
              {(obj.productFamilies || []).length > 0
                ? obj.productFamilies.map((f) => <span key={f} className="family-chip">{f}</span>)
                : <span className="text-muted">None</span>
              }
            </div>
          </div>

          {(obj.jiraL1 || obj.jiraL2) && (
            <>
              <div className="ref-divider" />
              {obj.jiraL1 && (
                <div className="ref-group">
                  <span className="ref-label">Jira L1</span>
                  <span className="ref-value mono">{obj.jiraL1}</span>
                </div>
              )}
              {obj.jiraL2 && (
                <div className="ref-group">
                  <span className="ref-label">Jira L2</span>
                  <span className="ref-value mono">{obj.jiraL2}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Main cards stacked */}
        <div className="detail-main">
          {/* Compliance Card */}
          <div className="detail-card">
            <div className="detail-card-header-row">
              <h3>Compliance</h3>
              <button
                className={`btn-ai-mini ${kpiLoading ? 'loading' : ''}`}
                onClick={handleKpiCoherence}
                disabled={kpiLoading}
                title="AI KPI Coherence Check"
              >
                {kpiLoading ? (
                  <span className="spinner-sm" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                )}
                KPI Check
              </button>
            </div>
            <div className="compliance-gauge">
              <div className="compliance-gauge-circle">
                <svg viewBox="0 0 100 100">
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
                <span className="compliance-gauge-value">{obj.compliancePercent}%</span>
              </div>
              <div className="compliance-formula">
                <span>{obj.kpiNumerator} / {obj.kpiDenominator}</span>
                <span className="formula-label">Numerator / Denominator</span>
              </div>
            </div>
            {obj.kpiDefinition && (
              <div className="kpi-definition">
                <span className="kpi-definition-label">KPI Definition</span>
                <span className="kpi-definition-text">{obj.kpiDefinition}</span>
              </div>
            )}
            {kpiError && (
              <div className="ai-error" style={{ marginTop: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{kpiError}</span>
              </div>
            )}
            {kpiAssessment && (
              <div className="kpi-coherence-result">
                <div className="kpi-coherence-header">
                  <div className={`kpi-confidence-badge confidence-${kpiAssessment.confidenceLabel?.toLowerCase() || 'medium'}`}>
                    <span className="kpi-confidence-score">{kpiAssessment.confidence}</span>
                    <span className="kpi-confidence-label">{kpiAssessment.confidenceLabel || 'N/A'}</span>
                  </div>
                  <span className={`kpi-alignment-tag alignment-${kpiAssessment.alignment || 'unknown'}`}>
                    {kpiAssessment.alignment === 'aligned' ? 'Aligned' : kpiAssessment.alignment === 'partially_aligned' ? 'Partially Aligned' : 'Misaligned'}
                  </span>
                </div>
                {kpiAssessment.alignmentRationale && (
                  <p className="kpi-rationale">{kpiAssessment.alignmentRationale}</p>
                )}
                {kpiAssessment.inferredKpiDefinition && (
                  <div className="kpi-inferred">
                    <span className="kpi-inferred-label">AI-Inferred KPI</span>
                    <span>{kpiAssessment.inferredKpiDefinition}</span>
                  </div>
                )}
                {kpiAssessment.scaleAssessment && (
                  <div className="kpi-inferred">
                    <span className="kpi-inferred-label">Scale Assessment</span>
                    <span>{kpiAssessment.scaleAssessment}</span>
                  </div>
                )}
                {kpiAssessment.anomalies?.length > 0 && (
                  <div className="kpi-anomalies">
                    <span className="kpi-anomalies-label">Anomalies</span>
                    {kpiAssessment.anomalies.map((a, i) => (
                      <div key={i} className="kpi-anomaly-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        </svg>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}
                {kpiAssessment.suggestions?.length > 0 && (
                  <div className="kpi-suggestions">
                    <span className="kpi-suggestions-label">Suggestions</span>
                    {kpiAssessment.suggestions.map((s, i) => (
                      <div key={i} className="kpi-suggestion-item">
                        <span className={`kpi-suggestion-type type-${s.type}`}>
                          {s.type === 'primary_kpi' ? 'Primary KPI' : s.type === 'secondary_kpi' ? 'Secondary KPI' : 'Denominator'}
                        </span>
                        <strong>{s.suggestion}</strong>
                        <span className="kpi-suggestion-rationale">{s.rationale}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="link-btn" onClick={() => setKpiAssessment(null)} style={{ marginTop: '0.5rem', fontSize: '0.72rem' }}>
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Controls Card */}
          <div className="detail-card">
            <div className="detail-card-header-row">
              <h3>Controls</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {obj.controlClassification === 'Formal' && (
                  <button
                    className={`btn-ai-mini ${controlCoherenceLoading ? 'loading' : ''}`}
                    onClick={handleControlCoherence}
                    disabled={controlCoherenceLoading}
                    title="Check control description quality"
                  >
                    {controlCoherenceLoading ? (
                      <span className="spinner-sm" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                    )}
                    Check Control
                  </button>
                )}
                <button
                  className={`btn-ai-mini ${regScanning ? 'loading' : ''}`}
                  onClick={handleRegScan}
                  disabled={regScanning}
                  title="Scan for regulatory attestations"
                >
                  {regScanning ? (
                    <span className="spinner-sm" />
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
              <div className="ai-error" style={{ marginBottom: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{regScanError}</span>
              </div>
            )}
            {controlCoherenceError && (
              <div className="ai-error" style={{ marginBottom: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{controlCoherenceError}</span>
              </div>
            )}
            {controlCoherence && (
              <div className="control-coherence-result">
                <div className="coherence-header">
                  <span className="coherence-title">Control Statement Quality</span>
                  <span className={`coherence-score-badge ${controlCoherence.qualityScore >= 85 ? 'strong' : controlCoherence.qualityScore >= 65 ? 'adequate' : controlCoherence.qualityScore >= 40 ? 'weak' : 'poor'}`}>
                    {controlCoherence.qualityScore}/100 — {controlCoherence.qualityLabel}
                  </span>
                </div>
                {controlCoherence.maturityAlignment && (
                  <div className="coherence-maturity">
                    <span className="coherence-maturity-tier">{controlCoherence.maturityAlignment.suggestedTier}</span>
                    <span className="coherence-maturity-rationale">{controlCoherence.maturityAlignment.rationale}</span>
                  </div>
                )}
                {controlCoherence.strengths?.length > 0 && (
                  <div className="coherence-list strengths">
                    <span className="coherence-list-label">Strengths</span>
                    {controlCoherence.strengths.map((s, i) => (
                      <div key={i} className="coherence-list-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {controlCoherence.missingElements?.length > 0 && (
                  <div className="coherence-list missing">
                    <span className="coherence-list-label">Missing Elements</span>
                    {controlCoherence.missingElements.map((m, i) => (
                      <div key={i} className="coherence-list-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                )}
                {controlCoherence.impactAssessment && (
                  <div className="coherence-impact">
                    <span className="coherence-impact-label">Maturity Impact</span>
                    <span>{controlCoherence.impactAssessment}</span>
                  </div>
                )}
                {controlCoherence.rewriteSuggestion && (
                  <div className="coherence-rewrite">
                    <span className="coherence-rewrite-label">Suggested Rewrite</span>
                    <p>{controlCoherence.rewriteSuggestion}</p>
                  </div>
                )}
                <button className="link-btn" onClick={() => setControlCoherence(null)} style={{ marginTop: '0.5rem', fontSize: '0.72rem' }}>
                  Dismiss
                </button>
              </div>
            )}
            <div className="detail-fields">
              <div className="detail-field">
                <span className="field-label">Classification</span>
                <span className={`field-value control-tag ${obj.controlClassification.toLowerCase()}`}>
                  {obj.controlClassification}
                </span>
              </div>
              {obj.controlType && (
                <div className="detail-field">
                  <span className="field-label">Control Function</span>
                  <span className={`field-value control-type-tag type-${obj.controlType.toLowerCase()}`}>{obj.controlType}</span>
                </div>
              )}
              {obj.implementationType && (
                <div className="detail-field">
                  <span className="field-label">Implementation</span>
                  <span className={`field-value control-type-tag type-${obj.implementationType.toLowerCase()}`}>{obj.implementationType}</span>
                </div>
              )}
              {obj.executionFrequency && (
                <div className="detail-field">
                  <span className="field-label">Execution Frequency</span>
                  <span className="field-value">{obj.executionFrequency}</span>
                </div>
              )}
              {obj.controlObjective && (
                <div className="detail-field">
                  <span className="field-label">Control Objective</span>
                  <span className="field-value" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>{obj.controlObjective}</span>
                </div>
              )}
              {obj.controlClassification === 'Formal' && obj.nistFamilies?.length > 0 && (
                <div className="detail-field">
                  <span className="field-label">NIST 800-53 Families</span>
                  <div className="nist-chips">
                    {obj.nistFamilies.map((fId) => {
                      const fam = NIST_FAMILIES.find((n) => n.id === fId)
                      return (
                        <span key={fId} className="nist-chip" title={fam?.name}>
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
                  <div className="detail-field">
                    <span className="field-label">
                      Regulatory Attestations
                      {pendingCount > 0 && (
                        <button className="reg-pending-link" onClick={() => onNavigate('regulatory')}>
                          {pendingCount} pending review
                        </button>
                      )}
                    </span>
                    {objAtts.length > 0 ? (
                      <div className="attestation-chips">
                        {objAtts.map((attId) => {
                          const att = ATTESTATIONS.find((a) => a.id === attId) || { id: attId, name: attId, category: 'Unknown' }
                          return (
                            <span key={attId} className="attestation-chip" title={att.desc}>
                              {att.name}
                              <button className="attestation-remove" onClick={() => removeAttestation(attId)} title="Remove">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.82rem' }}>None confirmed — run Scan Regs to detect</span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Governance Maturity Card */}
          <div className="detail-card">
            <h3>Governance Maturity</h3>
            {(() => {
              const mlg = mlgAssessments[obj.id]
              if (!mlg) {
                return (
                  <div className="detail-fields">
                    <p className="text-muted" style={{fontSize:'0.85rem',lineHeight:'1.6'}}>No MLG assessment yet.</p>
                    <button className="btn-primary small" style={{alignSelf:'flex-start',marginTop:'0.25rem'}} onClick={() => onNavigate('mlg', obj.id)}>
                      Run Diagnostic
                    </button>
                  </div>
                )
              }
              const { score, tier } = computeMLGScore(mlg, obj)
              return (
                <div className="detail-fields">
                  <div className="detail-field">
                    <span className="field-label">Tier</span>
                    <span className="maturity-tag" style={{ backgroundColor: tier.bg, color: tier.color }}>{tier.tier} — {tier.label}</span>
                  </div>
                  <div className="detail-field">
                    <span className="field-label">Score</span>
                    <span className="field-value">{score} / 20</span>
                  </div>
                  {MLG_PHASES.map((phase) => {
                    const phaseScore = phase.checkpoints.reduce((sum, cp) => {
                      const ans = mlg[cp.id]
                      return sum + (ans === 'yes' ? 1 : ans === 'weak' ? 0.5 : 0)
                    }, 0)
                    return (
                      <div key={phase.id} className="detail-field">
                        <span className="field-label">P{phase.phase}: {phase.name}</span>
                        <span className="field-value">{phaseScore}/{phase.checkpoints.length}</span>
                      </div>
                    )
                  })}
                  <button className="link-btn" style={{alignSelf:'flex-start',marginTop:'0.25rem'}} onClick={() => onNavigate('mlg', obj.id)}>
                    Open Diagnostic
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Health Rationale */}
      {(obj.healthStatus === 'RED' || obj.healthStatus === 'AMBER') && obj.healthRationale && (
        <div className="rationale-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={obj.healthStatus === 'RED' ? '#dc2626' : '#ea580c'} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <strong>{obj.healthStatus} Health Rationale</strong>
            <p>{obj.healthRationale}</p>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      {obj.history?.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-header">
            <h3>Change Log</h3>
            <span className="dash-card-badge">{obj.history.length} entries</span>
          </div>
          <div className="audit-trail">
            <div className="timeline">
              {[...obj.history].reverse().map((entry, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <span className="timeline-status">{entry.action}</span>
                    <span className="timeline-note">{entry.note}</span>
                    <span className="timeline-time">{formatDate(entry.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Related Gaps */}
      <div className="detail-section">
        <div className="detail-section-header">
          <h3>Related Gaps ({objectGaps.length})</h3>
          <button className="link-btn" onClick={() => onNavigate('onelist')}>Manage gaps</button>
        </div>
        {objectGaps.length === 0 ? (
          <p className="text-muted">No gaps tracked for this object.</p>
        ) : (
          <div className="gap-mini-list">
            {objectGaps.map((g) => (
              <div key={g.id} className="gap-mini-item">
                <span className={`gap-status-dot status-${g.status.toLowerCase().replace(' ', '-')}`} />
                <span className="gap-mini-title">{g.title}</span>
                <span className="gap-mini-status">{g.status}</span>
              </div>
            ))}
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
