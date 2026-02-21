import React, { useState, useEffect, useRef } from 'react'
import {
  PRODUCT_FAMILIES,
  OBJECT_TYPES,
  CRITICALITY_LEVELS,
  HEALTH_STATUSES,
  REVIEW_CADENCES,
  OBJECT_STATUSES,
  DATA_CLASSIFICATIONS,
  ENVIRONMENTS,
  NIST_FAMILIES,
  CONTROL_TYPES,
  IMPLEMENTATION_TYPES,
  EXECUTION_FREQUENCIES,
} from '../../data/constants.js'
import { autofillObject } from '../../utils/ai.js'
import { AiButton, AiError } from '../AiPanel.jsx'

// ── Type-specific configuration ──
const TYPE_CONFIG = {
  'Control': {
    section: 'Control Classification',
    helper: <><strong>Informal</strong> = ad-hoc, undocumented, or partially documented. <strong>Formal</strong> = documented, tested, and mapped to NIST 800-53. Flip the toggle to graduate an informal control.</>,
    showControlFields: true,
    descPlaceholder: 'What does this control do, who uses it, and what data does it touch?',
    ownerPlaceholder: 'Accountable PM or lead',
    operatorPlaceholder: 'Team or person running it',
    kpiHelper: <><strong>Numerator</strong> = how many assets/endpoints/users are covered. <strong>Denominator</strong> = total in scope. Compliance % is calculated automatically.</>,
    kpiDefPlaceholder: 'e.g., Managed endpoints with DLP agent installed / Total managed endpoints',
    namePlaceholder: 'e.g., Endpoint DLP Agent, Okta SSO, Ad-hoc Code Review',
    aiPlaceholder: 'e.g., CrowdStrike Falcon endpoint detection platform used for our SOC operations, deployed on AWS, handles confidential threat intelligence data...',
    typeHint: 'A security measure — technical or administrative — that mitigates risk. Can be Formal or Informal.',
  },
  'Process': {
    section: 'Process Overview',
    helper: <>A <strong>Process</strong> is a repeatable workflow with defined inputs, steps, and measurable outcomes. Define the purpose and expected results.</>,
    showControlFields: false,
    descPlaceholder: 'Why does this process exist? What does it aim to achieve?',
    ownerPlaceholder: 'Process owner — accountable for outcomes',
    operatorPlaceholder: 'Who executes this process day-to-day?',
    kpiHelper: <><strong>Numerator</strong> = successful completions or on-time executions. <strong>Denominator</strong> = total expected. Compliance % is calculated automatically.</>,
    kpiDefPlaceholder: 'e.g., Access reviews completed on time / Total scheduled access reviews',
    namePlaceholder: 'e.g., Quarterly Access Review, Incident Response Triage',
    aiPlaceholder: 'e.g., Quarterly access review process triggered by IAM team, covers all production systems, involves manager attestation...',
    typeHint: 'A repeatable workflow with defined steps, roles, and measurable outcomes',
  },
  'Procedure': {
    section: 'Procedure Context',
    helper: <>A <strong>Procedure</strong> is a step-by-step set of instructions that supports a process. Define who uses it and what it covers.</>,
    showControlFields: false,
    descPlaceholder: 'What is the purpose of this procedure? What key objectives does it achieve?',
    ownerPlaceholder: 'Document owner — accountable for accuracy and reviews',
    operatorPlaceholder: 'Primary implementers who follow this procedure',
    kpiHelper: <><strong>Numerator</strong> = procedures followed correctly. <strong>Denominator</strong> = total executions. Compliance % is calculated automatically.</>,
    kpiDefPlaceholder: 'e.g., Onboarding checklists completed fully / Total new hires onboarded',
    namePlaceholder: 'e.g., Onboarding Checklist, Incident Escalation Runbook',
    aiPlaceholder: 'e.g., Step-by-step runbook for escalating P1 security incidents, used by SOC analysts, covers triage through resolution...',
    typeHint: 'Step-by-step instructions that implementers follow to execute a process',
  },
}

export default function ObjectForm({ object, objects = [], onSave, onClose }) {
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [showAutofill, setShowAutofill] = useState(!object)

  const handleAutofill = async () => {
    if (!aiDesc.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await autofillObject(aiDesc)
      const data = res.data || {}
      setForm((f) => ({
        ...f,
        listName: data.listName || f.listName,
        type: data.type || f.type,
        description: data.description || f.description,
        productFamilies: data.productFamilies || f.productFamilies,
        criticality: data.criticality || f.criticality,
        controlClassification: data.controlClassification || f.controlClassification,
        nistFamilies: data.nistFamilies || f.nistFamilies,
        environment: data.environment || f.environment,
        dataClassification: data.dataClassification || f.dataClassification,
        reviewCadence: data.reviewCadence || f.reviewCadence,
        implementationType: data.implementationType || f.implementationType,
        executionFrequency: data.executionFrequency || f.executionFrequency,
      }))
      setShowAutofill(false)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const [form, setForm] = useState({
    listName: '',
    productFamilies: [],
    type: 'Control',
    criticality: 'Medium',
    status: 'Active',
    identifyingPerson: '',
    owner: '',
    operator: '',
    controlClassification: 'Informal',
    nistFamilies: [],
    kpiNumerator: 0,
    kpiDenominator: 0,
    kpiDefinition: '',
    controlObjective: '',
    controlType: '',
    implementationType: '',
    executionFrequency: '',
    reviewCadence: 'Monthly',
    healthStatus: 'BLUE',
    healthRationale: '',
    description: '',
    lastReviewDate: new Date().toISOString().slice(0, 10),
    nextReviewDate: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) })(),
    jiraL1: '',
    jiraL2: '',
    environment: 'Production',
    dataClassification: 'Internal',
    businessUnit: '',
    // Process fields
    outcome: '',
    systemsTools: '',
    // Procedure fields
    audience: '',
    scope: '',
    parentProcessId: '',
    ...object,
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const firstInputRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    if (firstInputRef.current) firstInputRef.current.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const cfg = TYPE_CONFIG[form.type] || TYPE_CONFIG['Control']

  const CADENCE_DAYS = { Weekly: 7, 'Bi-Weekly': 14, Monthly: 30, Quarterly: 90, 'Semi-Annually': 180, Annually: 365 }

  const calcNextReview = (cadence, lastDate) => {
    const days = CADENCE_DAYS[cadence]
    if (!days || !lastDate) return ''
    const d = new Date(lastDate)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const set = (field, value) => setForm((f) => {
    const next = { ...f, [field]: value }
    // Auto-compute next review date when cadence or last review changes
    if (field === 'reviewCadence' || field === 'lastReviewDate') {
      const cadence = field === 'reviewCadence' ? value : f.reviewCadence
      const lastDate = field === 'lastReviewDate' ? value : f.lastReviewDate
      next.nextReviewDate = calcNextReview(cadence, lastDate)
    }
    return next
  })

  const toggleMulti = (field, value) => {
    setForm((f) => {
      const arr = f[field] || []
      return {
        ...f,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
  }

  const validate = () => {
    const errs = {}
    if (!form.listName.trim()) errs.listName = 'Name is required'
    if (!form.owner.trim()) errs.owner = 'Owner is required'
    if (form.healthStatus === 'RED' && !form.healthRationale.trim()) {
      errs.healthRationale = 'Rationale is required when health is RED'
    }
    if (form.kpiDenominator > 0 && form.kpiNumerator > form.kpiDenominator) {
      errs.kpiNumerator = 'Numerator cannot exceed denominator'
    }
    // Type-specific validation
    if (form.type === 'Control') {
      if (form.controlClassification === 'Formal' && form.nistFamilies.length === 0) {
        errs.nistFamilies = 'At least one NIST family is required for Formal controls'
      }
      if (form.controlClassification === 'Formal' && !form.controlType) {
        errs.controlType = 'Control function is required for Formal controls'
      }
    }
    if (form.type === 'Process' && !form.outcome?.trim()) {
      errs.outcome = 'Outcome is required — what does successful completion produce?'
    }
    if (form.type === 'Procedure' && !form.audience?.trim()) {
      errs.audience = 'Audience is required — who implements this procedure?'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting || !validate()) return
    setSubmitting(true)
    onSave(form)
  }

  const processObjects = objects.filter((o) => o.type === 'Process')

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={object ? 'Edit Object' : 'Add Object'}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{object ? 'Edit Object' : 'Add Object'}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* ── Type picker (first — drives all conditional logic below) ── */}
          {!object && (
            <div className="fg">
              <label>What are you adding?</label>
              <div className="type-picker">
                {OBJECT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`type-picker-btn ${form.type === t ? 'active' : ''}`}
                    onClick={() => set('type', t)}
                  >
                    <span className="type-picker-label">{t}</span>
                    <span className="type-picker-hint">{TYPE_CONFIG[t]?.typeHint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Autofill */}
          {showAutofill && !object && (
            <div className="ai-autofill-section">
              <div className="ai-autofill-header">
                <span className="ai-sparkle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </span>
                <strong>AI Auto-Fill</strong>
                <span className="ai-autofill-hint">Describe the {form.type.toLowerCase()} and let AI populate the fields</span>
              </div>
              <textarea
                className="ai-autofill-input"
                value={aiDesc}
                onChange={(e) => setAiDesc(e.target.value)}
                placeholder={cfg.aiPlaceholder}
                rows={3}
              />
              <div className="ai-autofill-actions">
                <AiButton onClick={handleAutofill} loading={aiLoading}>Auto-Fill Fields</AiButton>
                <button type="button" className="link-btn" onClick={() => setShowAutofill(false)}>Skip, fill manually</button>
              </div>
              {aiError && <AiError error={aiError} onRetry={handleAutofill} />}
            </div>
          )}
          {!showAutofill && !object && (
            <button type="button" className="link-btn" onClick={() => setShowAutofill(true)} style={{alignSelf:'flex-start'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:'0.3rem'}}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Use AI Auto-Fill
            </button>
          )}

          {/* ── Identity ── */}
          <div className="form-section-label">Identity</div>
          <p className="form-helper">An object is anything your security program monitors: a tool, platform, vendor, service, dataset, or process.</p>
          <div className={`form-grid-2 ${object ? '' : ''}`}>
            <div className={`fg ${errors.listName ? 'has-error' : ''}`}>
              <label htmlFor="field-listName">List Name *</label>
              <input ref={firstInputRef} id="field-listName" value={form.listName} onChange={(e) => set('listName', e.target.value)} placeholder={cfg.namePlaceholder} />
              {errors.listName && <span className="field-error">{errors.listName}</span>}
            </div>
            {object ? (
              <div className="fg">
                <label>Type</label>
                <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {OBJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <span className="field-hint">{cfg.typeHint}</span>
              </div>
            ) : (
              <div className="fg">
                <label>Type</label>
                <div className="computed-value">{form.type}</div>
                <span className="field-hint">Selected above</span>
              </div>
            )}
          </div>
          <div className="fg">
            <label htmlFor="field-description">Description</label>
            <textarea id="field-description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder={cfg.descPlaceholder} />
          </div>
          <div className="fg">
            <label>Product Families</label>
            <div className="chip-select">
              {PRODUCT_FAMILIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${form.productFamilies.includes(f) ? 'selected' : ''}`}
                  onClick={() => toggleMulti('productFamilies', f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* ── Ownership ── */}
          <div className="form-section-label">Ownership & Accountability</div>
          <p className="form-helper">Owner is accountable for the object's health and compliance. Operator is responsible for day-to-day execution.</p>
          <div className="form-grid-3">
            <div className="fg">
              <label>Identifying Person</label>
              <input value={form.identifyingPerson} onChange={(e) => set('identifyingPerson', e.target.value)} placeholder="Who identified this?" />
            </div>
            <div className={`fg ${errors.owner ? 'has-error' : ''}`}>
              <label htmlFor="field-owner">Owner *</label>
              <input id="field-owner" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder={cfg.ownerPlaceholder} />
              {errors.owner && <span className="field-error">{errors.owner}</span>}
            </div>
            <div className="fg">
              <label>Operator</label>
              <input value={form.operator} onChange={(e) => set('operator', e.target.value)} placeholder={cfg.operatorPlaceholder} />
            </div>
          </div>

          {/* ── Type-specific section ── */}
          <div className="form-section-label">{cfg.section}</div>
          <p className="form-helper">{cfg.helper}</p>

          {/* Control fields (Informal or Formal) */}
          {cfg.showControlFields && (
            <>
              <div className="form-grid-2">
                <div className="fg">
                  <label>Classification</label>
                  <div className="toggle-group">
                    {['Informal', 'Formal'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`toggle-btn ${form.controlClassification === c ? 'active' : ''}`}
                        onClick={() => set('controlClassification', c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fg">
                  <label>Criticality</label>
                  <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)}>
                    {CRITICALITY_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="field-hint">Critical = business-stopping if unavailable; Low = limited blast radius</span>
                </div>
              </div>
              {/* Advisory: Critical + Informal */}
              {(form.criticality === 'Critical' || form.criticality === 'High') && form.controlClassification === 'Informal' && (
                <div className="form-advisory amber">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>{form.criticality} objects should have <strong>Formal</strong> controls with NIST mapping. Consider formalizing this control or documenting a risk exception.</span>
                </div>
              )}

              {/* Control Objective — all controls, not just Formal */}
              <div className="fg">
                <label>Control Objective</label>
                <textarea value={form.controlObjective} onChange={(e) => set('controlObjective', e.target.value)} rows={2} placeholder="What specific risk or compliance gap does this control exist to address?" />
                <span className="field-hint">The risk or outcome this control mitigates — distinct from what it does (description)</span>
              </div>

              {/* Control taxonomy — all controls */}
              <div className="form-grid-3">
                <div className={`fg ${errors.controlType ? 'has-error' : ''}`}>
                  <label>Control Function {form.controlClassification === 'Formal' ? '*' : ''}</label>
                  <select value={form.controlType} onChange={(e) => set('controlType', e.target.value)}>
                    <option value="">-- Select --</option>
                    {CONTROL_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  {errors.controlType ? <span className="field-error">{errors.controlType}</span> : <span className="field-hint">Preventive, Detective, Corrective, or Compensating</span>}
                </div>
                <div className="fg">
                  <label>Implementation</label>
                  <select value={form.implementationType} onChange={(e) => set('implementationType', e.target.value)}>
                    <option value="">-- Select --</option>
                    {IMPLEMENTATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span className="field-hint">Administrative = policy; Technical = system; Physical = access</span>
                </div>
                <div className="fg">
                  <label>Execution Frequency</label>
                  <select value={form.executionFrequency} onChange={(e) => set('executionFrequency', e.target.value)}>
                    <option value="">-- Select --</option>
                    {EXECUTION_FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <span className="field-hint">How often the control actually fires or runs</span>
                </div>
              </div>

              {/* NIST families — Formal only */}
              {form.controlClassification === 'Formal' && (
                <div className={`fg ${errors.nistFamilies ? 'has-error' : ''}`}>
                  <label>NIST 800-53 Families *</label>
                  <div className="chip-select compact">
                    {NIST_FAMILIES.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`chip ${form.nistFamilies.includes(f.id) ? 'selected' : ''}`}
                        onClick={() => toggleMulti('nistFamilies', f.id)}
                        title={f.name}
                      >
                        {f.id}
                      </button>
                    ))}
                  </div>
                  {errors.nistFamilies && <span className="field-error">{errors.nistFamilies}</span>}
                </div>
              )}
            </>
          )}

          {/* Process fields */}
          {form.type === 'Process' && (
            <>
              <div className="form-grid-2">
                <div className={`fg ${errors.outcome ? 'has-error' : ''}`}>
                  <label>Outcome *</label>
                  <textarea value={form.outcome} onChange={(e) => set('outcome', e.target.value)} rows={2} placeholder="What specific, measurable result does successful completion produce?" />
                  {errors.outcome ? <span className="field-error">{errors.outcome}</span> : <span className="field-hint">The tangible deliverable or state change when this process completes</span>}
                </div>
                <div className="fg">
                  <label>Criticality</label>
                  <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)}>
                    {CRITICALITY_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="field-hint">Critical = business-stopping if unavailable; Low = limited blast radius</span>
                </div>
              </div>
              <div className="fg">
                <label>Systems & Tools</label>
                <input value={form.systemsTools} onChange={(e) => set('systemsTools', e.target.value)} placeholder="e.g., Okta, ServiceNow, Jira, AWS Console" />
                <span className="field-hint">Tools, platforms, or data sources this process depends on</span>
              </div>
            </>
          )}

          {/* Procedure fields */}
          {form.type === 'Procedure' && (
            <>
              <div className="form-grid-2">
                <div className={`fg ${errors.audience ? 'has-error' : ''}`}>
                  <label>Audience *</label>
                  <input value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g., SOC Analysts, IAM Engineers, IT Help Desk" />
                  {errors.audience ? <span className="field-error">{errors.audience}</span> : <span className="field-hint">Primary users who implement this procedure</span>}
                </div>
                <div className="fg">
                  <label>Criticality</label>
                  <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)}>
                    {CRITICALITY_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="field-hint">Critical = business-stopping if unavailable; Low = limited blast radius</span>
                </div>
              </div>
              <div className="fg">
                <label>Scope</label>
                <textarea value={form.scope} onChange={(e) => set('scope', e.target.value)} rows={2} placeholder="What situations and processes does this procedure cover? e.g., Applies to all P1/P2 incidents in production environments." />
                <span className="field-hint">Define the boundaries — which situations, systems, or entities are in scope</span>
              </div>
              {processObjects.length > 0 && (
                <div className="fg">
                  <label>Parent Process</label>
                  <select value={form.parentProcessId} onChange={(e) => set('parentProcessId', e.target.value)}>
                    <option value="">-- None --</option>
                    {processObjects.map((p) => <option key={p.id} value={p.id}>{p.listName}</option>)}
                  </select>
                  <span className="field-hint">Link this procedure to the process it supports</span>
                </div>
              )}
            </>
          )}

          {/* ── KPI Tracking ── */}
          <div className="form-section-label">KPI Tracking</div>
          <p className="form-helper">{cfg.kpiHelper}</p>
          <div className="fg">
            <label htmlFor="field-kpiDef">KPI Definition</label>
            <input id="field-kpiDef" value={form.kpiDefinition} onChange={(e) => set('kpiDefinition', e.target.value)} placeholder={cfg.kpiDefPlaceholder} />
            <span className="field-hint">Describe what the numerator and denominator specifically count</span>
          </div>
          <div className="form-grid-3">
            <div className={`fg ${errors.kpiNumerator ? 'has-error' : ''}`}>
              <label>Numerator</label>
              <input type="number" min="0" value={form.kpiNumerator} onChange={(e) => set('kpiNumerator', Math.max(0, Number(e.target.value)))} />
              {errors.kpiNumerator && <span className="field-error">{errors.kpiNumerator}</span>}
            </div>
            <div className="fg">
              <label>Denominator</label>
              <input type="number" min="0" value={form.kpiDenominator} onChange={(e) => set('kpiDenominator', Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="fg">
              <label>Compliance %</label>
              <div className="computed-value">
                {form.kpiDenominator ? Math.round((form.kpiNumerator / form.kpiDenominator) * 1000) / 10 : 0}%
              </div>
            </div>
          </div>

          {/* ── Health & Governance ── */}
          <div className="form-section-label">Health & Governance</div>
          <p className="form-helper">
            <strong>BLUE</strong> = not yet assessed or onboarding.
            <strong> GREEN</strong> = operating as intended, meets compliance.
            <strong> AMBER</strong> = issues identified, remediation in progress.
            <strong> RED</strong> = critical gaps, requires immediate attention.
          </p>
          <div className="form-grid-2">
            <div className="fg">
              <label>Health Status</label>
              <div className="health-select">
                {HEALTH_STATUSES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`health-btn ${form.healthStatus === h.id ? 'active' : ''}`}
                    style={form.healthStatus === h.id ? { backgroundColor: h.bg, color: h.color, borderColor: h.color } : {}}
                    onClick={() => set('healthStatus', h.id)}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="fg">
              <label>Review Cadence</label>
              <select value={form.reviewCadence} onChange={(e) => set('reviewCadence', e.target.value)}>
                {REVIEW_CADENCES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {(form.healthStatus === 'RED' || form.healthStatus === 'AMBER') && (
            <div className={`fg ${errors.healthRationale ? 'has-error' : ''}`}>
              <label>Health Rationale {form.healthStatus === 'RED' ? '*' : ''} <span className="label-hint">({form.healthStatus === 'RED' ? 'required for RED status' : 'recommended for AMBER status'})</span></label>
              <textarea value={form.healthRationale} onChange={(e) => set('healthRationale', e.target.value)} rows={2} placeholder={`Explain why this object is ${form.healthStatus}...`} />
              {errors.healthRationale && <span className="field-error">{errors.healthRationale}</span>}
            </div>
          )}

          {/* ── Metadata ── */}
          <div className="form-section-label">Metadata</div>
          <p className="form-helper">
            Lifecycle and classification metadata. Review dates drive staleness monitoring — overdue reviews trigger alerts on the CISO Dashboard.
          </p>
          <div className="form-grid-2">
            <div className="fg">
              <label>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {OBJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Environment</label>
              <select value={form.environment} onChange={(e) => set('environment', e.target.value)}>
                {ENVIRONMENTS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Data Classification</label>
              <select value={form.dataClassification} onChange={(e) => set('dataClassification', e.target.value)}>
                {DATA_CLASSIFICATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Business Unit</label>
              <input value={form.businessUnit} onChange={(e) => set('businessUnit', e.target.value)} placeholder="Department or team" />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="fg">
              <label>Last Review Date</label>
              <input type="date" value={form.lastReviewDate} onChange={(e) => set('lastReviewDate', e.target.value)} />
            </div>
            <div className="fg">
              <label>Next Review Date</label>
              <input type="date" value={form.nextReviewDate} onChange={(e) => set('nextReviewDate', e.target.value)} />
              <span className="field-hint">Auto-calculated from cadence — override if needed</span>
            </div>
          </div>

          {/* ── Initiative Mapping ── */}
          <div className="form-section-label">Initiative Mapping</div>
          <div className="form-grid-2">
            <div className="fg">
              <label>Jira L1 (Epic)</label>
              <input value={form.jiraL1} onChange={(e) => set('jiraL1', e.target.value)} placeholder="PROJ-123" />
            </div>
            <div className="fg">
              <label>Jira L2 (Initiative)</label>
              <input value={form.jiraL2} onChange={(e) => set('jiraL2', e.target.value)} placeholder="PROJ-456" />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : (object ? 'Save Changes' : 'Create Object')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
