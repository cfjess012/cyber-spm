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

export default function ObjectForm({ object, objects = [], promotionMode, onSave, onClose }) {
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

  const hasDirtyFields = () => {
    if (!object && !promotionMode) {
      return !!(form.listName.trim() || form.description.trim() || form.owner.trim())
    }
    return true // edit/promotion mode always warns
  }

  const safeClose = () => {
    if (hasDirtyFields() && !window.confirm('You have unsaved changes. Discard them?')) return
    onClose()
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') safeClose()
    }
    document.addEventListener('keydown', handleKey)
    if (firstInputRef.current) firstInputRef.current.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, form])

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
    // Universal — every object needs these
    if (!form.listName.trim()) errs.listName = 'Name is required'
    if (!form.description.trim()) errs.description = 'Description is required — what is this object and why does it exist?'
    if (!form.productFamilies?.length) errs.productFamilies = 'At least one product family is required'
    if (!form.owner.trim()) errs.owner = 'Owner is required — who is accountable for oversight?'
    if (!form.operator?.trim()) errs.operator = 'Operator is required — who manages this day-to-day?'
    if (form.healthStatus === 'RED' && !form.healthRationale.trim()) {
      errs.healthRationale = 'Rationale is required when health is RED'
    }
    if (form.kpiDenominator > 0 && form.kpiNumerator > form.kpiDenominator) {
      errs.kpiNumerator = 'Numerator cannot exceed denominator'
    }
    // Control-specific
    if (form.type === 'Control') {
      if (!form.controlObjective?.trim()) errs.controlObjective = 'Control objective is required — what risk does this mitigate?'
      if (form.controlClassification === 'Formal') {
        if (form.nistFamilies.length === 0) errs.nistFamilies = 'At least one NIST family is required for Formal controls'
        if (!form.controlType) errs.controlType = 'Control function is required for Formal controls'
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
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center pt-12 px-4 overflow-y-auto animate-[overlayIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label={promotionMode ? 'Promote to Object' : object ? 'Edit Object' : 'Add Object'}>
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-[760px] animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)] border border-white/60">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
          <h2 className="text-[1.05rem] font-bold tracking-tight">{promotionMode ? 'Promote to Object Inventory' : object ? 'Edit Object' : 'Add Object'}</h2>
          <button className="bg-transparent border-none text-txt-3 cursor-pointer p-1.5 rounded-lg transition-all duration-150 hover:text-txt hover:bg-subtle" onClick={safeClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 max-h-[70vh] overflow-y-auto flex flex-col gap-3.5">
          {/* ── Promotion context banner ── */}
          {promotionMode && (
            <div className="bg-green-bg/50 border border-green/15 rounded-xl p-3.5 flex items-start gap-2.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/></svg>
              <span className="text-[0.82rem] text-txt-2 leading-relaxed">
                Pipeline data has been pre-filled. Complete the remaining fields — <strong>owner</strong>, <strong>operator</strong>, <strong>KPIs</strong>, and type-specific details — then save to create the object.
              </span>
            </div>
          )}

          {/* ── Type picker (first — drives all conditional logic below) ── */}
          {!object && (
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">What are you adding?</label>
              <div className="grid grid-cols-3 gap-2">
                {OBJECT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`flex flex-col items-start gap-1 p-3 bg-white border-[1.5px] rounded-[10px] cursor-pointer text-left transition-all duration-150 hover:border-brand hover:bg-[#f8faff] ${form.type === t ? 'border-brand bg-blue-bg shadow-[0_0_0_2px_rgba(59,130,246,0.15)]' : 'border-border'}`}
                    onClick={() => set('type', t)}
                  >
                    <span className="font-semibold text-[0.82rem] text-txt">{t}</span>
                    <span className="text-[0.7rem] text-txt-3 leading-snug">{TYPE_CONFIG[t]?.typeHint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Autofill */}
          {showAutofill && !object && (
            <div className="bg-ai-bg/50 border border-ai/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex text-ai-light">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </span>
                <strong>AI Auto-Fill</strong>
                <span className="text-[0.72rem] text-txt-3 mb-2">Describe the {form.type.toLowerCase()} and let AI populate the fields</span>
              </div>
              <textarea
                className="w-full bg-white border border-ai/15 rounded-[10px] px-3 py-2.5 text-[0.85rem] font-sans text-txt outline-none resize-y transition-all duration-150 focus:border-ai focus:ring-2 focus:ring-ai/15 placeholder:text-txt-3"
                value={aiDesc}
                onChange={(e) => setAiDesc(e.target.value)}
                placeholder={cfg.aiPlaceholder}
                rows={3}
              />
              <div className="flex gap-2 mt-2">
                <AiButton onClick={handleAutofill} loading={aiLoading}>Auto-Fill Fields</AiButton>
                <button type="button" className="bg-transparent border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline" onClick={() => setShowAutofill(false)}>Skip, fill manually</button>
              </div>
              {aiError && <AiError error={aiError} onRetry={handleAutofill} />}
            </div>
          )}
          {!showAutofill && !object && (
            <button type="button" className="bg-transparent border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline" onClick={() => setShowAutofill(true)} style={{alignSelf:'flex-start'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:'0.3rem'}}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Use AI Auto-Fill
            </button>
          )}

          {/* ── Identity ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Identity</div>
          <p className="text-[0.78rem] text-txt-3 leading-relaxed -mt-1 mb-1">An object is anything your security program monitors: a tool, platform, vendor, service, dataset, or process.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className={`flex flex-col gap-1 ${errors.listName ? '' : ''}`}>
              <label htmlFor="field-listName" className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">List Name *</label>
              <input ref={firstInputRef} id="field-listName" value={form.listName} onChange={(e) => set('listName', e.target.value)} placeholder={cfg.namePlaceholder} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${errors.listName ? 'border-red' : 'border-border'}`} />
              {errors.listName && <span className="text-[0.75rem] text-red font-medium">{errors.listName}</span>}
            </div>
            {object ? (
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Type</label>
                <select value={form.type} onChange={(e) => set('type', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                  {OBJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <span className="text-[0.72rem] text-txt-3 mt-0.5">{cfg.typeHint}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Type</label>
                <div className="flex items-center h-[38px] text-xl font-[750] text-brand tracking-tight">{form.type}</div>
                <span className="text-[0.72rem] text-txt-3 mt-0.5">Selected above</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="field-description" className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Description *</label>
            <textarea id="field-description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder={cfg.descPlaceholder} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y ${errors.description ? 'border-red' : 'border-border'}`} />
            {errors.description && <span className="text-[0.75rem] text-red font-medium">{errors.description}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Product Families *</label>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_FAMILIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`bg-white border rounded-full px-2.5 py-1 text-[0.78rem] font-medium cursor-pointer font-sans transition-all duration-150 hover:border-brand hover:text-brand ${form.productFamilies.includes(f) ? 'bg-brand-light border-brand text-brand font-semibold' : errors.productFamilies ? 'border-red/40 text-txt-2' : 'border-border text-txt-2'}`}
                  onClick={() => toggleMulti('productFamilies', f)}
                >
                  {f}
                </button>
              ))}
            </div>
            {errors.productFamilies && <span className="text-[0.75rem] text-red font-medium">{errors.productFamilies}</span>}
          </div>

          {/* ── Ownership ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Ownership & Accountability</div>
          <p className="text-[0.78rem] text-txt-3 leading-relaxed -mt-1 mb-1">Owner is accountable for the object's health and compliance. Operator is responsible for day-to-day execution.</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Identifying Person</label>
              <input value={form.identifyingPerson} onChange={(e) => set('identifyingPerson', e.target.value)} placeholder="Who identified this?" className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="field-owner" className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Owner *</label>
              <input id="field-owner" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder={cfg.ownerPlaceholder} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${errors.owner ? 'border-red' : 'border-border'}`} />
              {errors.owner && <span className="text-[0.75rem] text-red font-medium">{errors.owner}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Operator *</label>
              <input value={form.operator} onChange={(e) => set('operator', e.target.value)} placeholder={cfg.operatorPlaceholder} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${errors.operator ? 'border-red' : 'border-border'}`} />
              {errors.operator && <span className="text-[0.75rem] text-red font-medium">{errors.operator}</span>}
            </div>
          </div>

          {/* ── Type-specific section ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">{cfg.section}</div>
          <p className="text-[0.78rem] text-txt-3 leading-relaxed -mt-1 mb-1">{cfg.helper}</p>

          {/* Control fields (Informal or Formal) */}
          {cfg.showControlFields && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Classification</label>
                  <div className="flex">
                    {['Informal', 'Formal'].map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        className={`flex-1 px-4 py-2 border border-border bg-white text-txt-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${i === 0 ? 'rounded-l-[10px]' : 'rounded-r-[10px] border-l-0'} ${form.controlClassification === c ? 'bg-brand text-white border-brand' : ''}`}
                        onClick={() => set('controlClassification', c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
                  <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                    {CRITICALITY_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="text-[0.72rem] text-txt-3 mt-0.5">Critical = business-stopping if unavailable; Low = limited blast radius</span>
                </div>
              </div>
              {/* Advisory: Critical + Informal */}
              {(form.criticality === 'Critical' || form.criticality === 'High') && form.controlClassification === 'Informal' && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] text-[0.82rem] leading-relaxed bg-amber-bg text-amber border border-amber/15">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>{form.criticality} objects should have <strong>Formal</strong> controls with NIST mapping. Consider formalizing this control or documenting a risk exception.</span>
                </div>
              )}

              {/* Control Objective — all controls, not just Formal */}
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Control Objective *</label>
                <textarea value={form.controlObjective} onChange={(e) => set('controlObjective', e.target.value)} rows={2} placeholder="What specific risk or compliance gap does this control exist to address?" className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y ${errors.controlObjective ? 'border-red' : 'border-border'}`} />
                {errors.controlObjective ? <span className="text-[0.75rem] text-red font-medium">{errors.controlObjective}</span> : <span className="text-[0.72rem] text-txt-3 mt-0.5">The risk or outcome this control mitigates — distinct from what it does (description)</span>}
              </div>

              {/* Control taxonomy — all controls */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Control Function {form.controlClassification === 'Formal' ? '*' : ''}</label>
                  <select value={form.controlType} onChange={(e) => set('controlType', e.target.value)} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${errors.controlType ? 'border-red' : 'border-border'}`}>
                    <option value="">-- Select --</option>
                    {CONTROL_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  {errors.controlType ? <span className="text-[0.75rem] text-red font-medium">{errors.controlType}</span> : <span className="text-[0.72rem] text-txt-3 mt-0.5">Preventive, Detective, Corrective, or Compensating</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Implementation</label>
                  <select value={form.implementationType} onChange={(e) => set('implementationType', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                    <option value="">-- Select --</option>
                    {IMPLEMENTATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span className="text-[0.72rem] text-txt-3 mt-0.5">Administrative = policy; Technical = system; Physical = access</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Execution Frequency</label>
                  <select value={form.executionFrequency} onChange={(e) => set('executionFrequency', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                    <option value="">-- Select --</option>
                    {EXECUTION_FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <span className="text-[0.72rem] text-txt-3 mt-0.5">How often the control actually fires or runs</span>
                </div>
              </div>

              {/* NIST families — Formal only */}
              {form.controlClassification === 'Formal' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">NIST 800-53 Families *</label>
                  <div className="flex flex-wrap gap-1">
                    {NIST_FAMILIES.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`bg-white border rounded-full px-2.5 py-1 text-[0.78rem] font-medium cursor-pointer font-sans transition-all duration-150 hover:border-brand hover:text-brand ${form.nistFamilies.includes(f.id) ? 'bg-brand-light border-brand text-brand font-semibold' : 'border-border text-txt-2'}`}
                        onClick={() => toggleMulti('nistFamilies', f.id)}
                        title={f.name}
                      >
                        {f.id}
                      </button>
                    ))}
                  </div>
                  {errors.nistFamilies && <span className="text-[0.75rem] text-red font-medium">{errors.nistFamilies}</span>}
                </div>
              )}
            </>
          )}

          {/* Process fields */}
          {form.type === 'Process' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Outcome *</label>
                  <textarea value={form.outcome} onChange={(e) => set('outcome', e.target.value)} rows={2} placeholder="What specific, measurable result does successful completion produce?" className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y ${errors.outcome ? 'border-red' : 'border-border'}`} />
                  {errors.outcome ? <span className="text-[0.75rem] text-red font-medium">{errors.outcome}</span> : <span className="text-[0.72rem] text-txt-3 mt-0.5">The tangible deliverable or state change when this process completes</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
                  <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                    {CRITICALITY_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="text-[0.72rem] text-txt-3 mt-0.5">Critical = business-stopping if unavailable; Low = limited blast radius</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Systems & Tools</label>
                <input value={form.systemsTools} onChange={(e) => set('systemsTools', e.target.value)} placeholder="e.g., Okta, ServiceNow, Jira, AWS Console" className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
                <span className="text-[0.72rem] text-txt-3 mt-0.5">Tools, platforms, or data sources this process depends on</span>
              </div>
            </>
          )}

          {/* Procedure fields */}
          {form.type === 'Procedure' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Audience *</label>
                  <input value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g., SOC Analysts, IAM Engineers, IT Help Desk" className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${errors.audience ? 'border-red' : 'border-border'}`} />
                  {errors.audience ? <span className="text-[0.75rem] text-red font-medium">{errors.audience}</span> : <span className="text-[0.72rem] text-txt-3 mt-0.5">Primary users who implement this procedure</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
                  <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                    {CRITICALITY_LEVELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="text-[0.72rem] text-txt-3 mt-0.5">Critical = business-stopping if unavailable; Low = limited blast radius</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Scope</label>
                <textarea value={form.scope} onChange={(e) => set('scope', e.target.value)} rows={2} placeholder="What situations and processes does this procedure cover? e.g., Applies to all P1/P2 incidents in production environments." className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" />
                <span className="text-[0.72rem] text-txt-3 mt-0.5">Define the boundaries — which situations, systems, or entities are in scope</span>
              </div>
              {processObjects.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Parent Process</label>
                  <select value={form.parentProcessId} onChange={(e) => set('parentProcessId', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                    <option value="">-- None --</option>
                    {processObjects.map((p) => <option key={p.id} value={p.id}>{p.listName}</option>)}
                  </select>
                  <span className="text-[0.72rem] text-txt-3 mt-0.5">Link this procedure to the process it supports</span>
                </div>
              )}
            </>
          )}

          {/* ── KPI Tracking ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">KPI Tracking</div>
          <p className="text-[0.78rem] text-txt-3 leading-relaxed -mt-1 mb-1">{cfg.kpiHelper}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="field-kpiDef" className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">KPI Definition</label>
            <input id="field-kpiDef" value={form.kpiDefinition} onChange={(e) => set('kpiDefinition', e.target.value)} placeholder={cfg.kpiDefPlaceholder} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            <span className="text-[0.72rem] text-txt-3 mt-0.5">Describe what the numerator and denominator specifically count</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Numerator</label>
              <input type="number" min="0" value={form.kpiNumerator} onChange={(e) => set('kpiNumerator', Math.max(0, Number(e.target.value)))} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${errors.kpiNumerator ? 'border-red' : 'border-border'}`} />
              {errors.kpiNumerator && <span className="text-[0.75rem] text-red font-medium">{errors.kpiNumerator}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Denominator</label>
              <input type="number" min="0" value={form.kpiDenominator} onChange={(e) => set('kpiDenominator', Math.max(0, Number(e.target.value)))} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Compliance %</label>
              <div className="flex items-center h-[38px] text-xl font-[750] text-brand tracking-tight">
                {form.kpiDenominator ? Math.round((form.kpiNumerator / form.kpiDenominator) * 1000) / 10 : 0}%
              </div>
            </div>
          </div>

          {/* ── Health & Governance ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Health & Governance</div>
          <p className="text-[0.78rem] text-txt-3 leading-relaxed -mt-1 mb-1">
            <strong>BLUE</strong> = not yet assessed or onboarding.
            <strong> GREEN</strong> = operating as intended, meets compliance.
            <strong> AMBER</strong> = issues identified, remediation in progress.
            <strong> RED</strong> = critical gaps, requires immediate attention.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Health Status</label>
              <div className="flex gap-1.5">
                {HEALTH_STATUSES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`flex-1 py-2 border border-border rounded-[10px] bg-white text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 text-txt-2 hover:border-gray-300 ${form.healthStatus === h.id ? 'font-bold' : ''}`}
                    style={form.healthStatus === h.id ? { backgroundColor: h.bg, color: h.color, borderColor: h.color } : {}}
                    onClick={() => set('healthStatus', h.id)}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Review Cadence</label>
              <select value={form.reviewCadence} onChange={(e) => set('reviewCadence', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                {REVIEW_CADENCES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {(form.healthStatus === 'RED' || form.healthStatus === 'AMBER') && (
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Health Rationale {form.healthStatus === 'RED' ? '*' : ''} <span className="font-normal text-txt-3">({form.healthStatus === 'RED' ? 'required for RED status' : 'recommended for AMBER status'})</span></label>
              <textarea value={form.healthRationale} onChange={(e) => set('healthRationale', e.target.value)} rows={2} placeholder={`Explain why this object is ${form.healthStatus}...`} className={`w-full bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y ${errors.healthRationale ? 'border-red' : 'border-border'}`} />
              {errors.healthRationale && <span className="text-[0.75rem] text-red font-medium">{errors.healthRationale}</span>}
            </div>
          )}

          {/* ── Metadata ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Metadata</div>
          <p className="text-[0.78rem] text-txt-3 leading-relaxed -mt-1 mb-1">
            Lifecycle and classification metadata. Review dates drive staleness monitoring — overdue reviews trigger alerts on the CISO Dashboard.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                {OBJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Environment</label>
              <select value={form.environment} onChange={(e) => set('environment', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                {ENVIRONMENTS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Data Classification</label>
              <select value={form.dataClassification} onChange={(e) => set('dataClassification', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3">
                {DATA_CLASSIFICATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Business Unit</label>
              <input value={form.businessUnit} onChange={(e) => set('businessUnit', e.target.value)} placeholder="Department or team" className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Last Review Date</label>
              <input type="date" value={form.lastReviewDate} onChange={(e) => set('lastReviewDate', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Next Review Date</label>
              <input type="date" value={form.nextReviewDate} onChange={(e) => set('nextReviewDate', e.target.value)} className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
              <span className="text-[0.72rem] text-txt-3 mt-0.5">Auto-calculated from cadence — override if needed</span>
            </div>
          </div>

          {/* ── Initiative Mapping ── */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Initiative Mapping</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Jira L1 (Epic)</label>
              <input value={form.jiraL1} onChange={(e) => set('jiraL1', e.target.value)} placeholder="PROJ-123" className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Jira L2 (Initiative)</label>
              <input value={form.jiraL2} onChange={(e) => set('jiraL2', e.target.value)} placeholder="PROJ-456" className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-light mt-1">
            <button type="button" className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={safeClose}>Cancel</button>
            <button type="submit" className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center gap-1.5" disabled={submitting}>{submitting ? 'Saving...' : (promotionMode ? 'Create Object' : object ? 'Save Changes' : 'Create Object')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
