import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { GAP_STATUSES, NIST_FAMILIES, PRODUCT_FAMILIES, OBJECT_TYPES, CRITICALITY_LEVELS, CONTROL_TYPES, IMPLEMENTATION_TYPES, EXECUTION_FREQUENCIES } from '../../data/constants.js'
import { formatDate, calcCompliance } from '../../utils/compliance.js'
import { getRemediation, prioritizeGaps, triageAugment } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiInlineResult, AiError } from '../AiPanel.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'

// ── LogForm: Lightweight intake with optional enrichment ──
function LogForm({ onSave, onEnrich, onClose, knownOwners }) {
  const [phase, setPhase] = useState('input') // 'input' | 'confirmed' | 'enrich'
  const [gapId] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState({
    title: '',
    description: '',
    identifier: '',
    productFamily: '',
    targetType: '',
  })
  const [enrich, setEnrich] = useState({
    targetType: '',
    owner: '',
    operator: '',
    criticality: 'Medium',
    controlClassification: 'Informal',
    nistFamilies: [],
    controlObjective: '',
    controlType: '',
    implementationType: '',
    executionFrequency: '',
    outcome: '',
    systemsTools: '',
    audience: '',
    scope: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReasoning, setAiReasoning] = useState('')
  const titleRef = useRef(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setE = (k, v) => setEnrich((f) => ({ ...f, [k]: v }))

  const toggleNist = (fId) => {
    setEnrich((f) => {
      const arr = f.nistFamilies || []
      return { ...f, nistFamilies: arr.includes(fId) ? arr.filter((x) => x !== fId) : [...arr, fId] }
    })
  }

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    if (titleRef.current && phase === 'input') titleRef.current.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, phase])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
    if (!form.title.trim()) { setFormError('Title is required'); return }
    if (!form.identifier.trim()) { setFormError('Your name is required'); return }
    if (!form.productFamily) { setFormError('Please select a team'); return }
    setFormError('')
    setSubmitting(true)
    onSave({ ...form, id: gapId, triaged: false })
    // Seed enrichment with any type they already picked
    if (form.targetType) setEnrich((f) => ({ ...f, targetType: form.targetType }))
    setSubmitting(false)
    setPhase('confirmed')
  }

  const handleEnrichSave = () => {
    // Only send fields that were actually filled
    const updates = {}
    if (enrich.targetType) updates.targetType = enrich.targetType
    if (enrich.owner.trim()) updates.owner = enrich.owner.trim()
    if (enrich.operator.trim()) updates.operator = enrich.operator.trim()
    if (enrich.criticality !== 'Medium') updates.criticality = enrich.criticality
    // Type-specific fields
    if (enrich.targetType === 'Control') {
      updates.controlClassification = enrich.controlClassification
      if (enrich.controlObjective.trim()) updates.controlObjective = enrich.controlObjective.trim()
      if (enrich.controlType) updates.controlType = enrich.controlType
      if (enrich.implementationType) updates.implementationType = enrich.implementationType
      if (enrich.executionFrequency) updates.executionFrequency = enrich.executionFrequency
      if (enrich.controlClassification === 'Formal' && enrich.nistFamilies.length) updates.nistFamilies = enrich.nistFamilies
    }
    if (enrich.targetType === 'Process') {
      if (enrich.outcome.trim()) updates.outcome = enrich.outcome.trim()
      if (enrich.systemsTools.trim()) updates.systemsTools = enrich.systemsTools.trim()
    }
    if (enrich.targetType === 'Procedure') {
      if (enrich.audience.trim()) updates.audience = enrich.audience.trim()
      if (enrich.scope.trim()) updates.scope = enrich.scope.trim()
    }
    if (Object.keys(updates).length > 0) {
      onEnrich({ id: gapId, ...updates })
    }
    onClose()
  }

  // ─── Confirmed phase: success + optional enrichment prompt ───
  if (phase === 'confirmed') {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center pt-16 px-4 overflow-y-auto animate-[overlayIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label="Item Logged">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-[540px] animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)] border border-white/60">
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[1.15rem] font-[700] text-txt tracking-tight">Item Logged</h2>
              <p className="text-[0.85rem] text-txt-3 mt-1 leading-relaxed max-w-[360px]">
                <strong className="text-txt-2">{form.title}</strong> has been added to the pipeline.
              </p>
            </div>
            <div className="bg-subtle/60 rounded-xl px-4 py-3 w-full text-left mt-1">
              <p className="text-[0.82rem] text-txt-2 leading-relaxed">
                Know more about this item? Adding detail now saves the team triage time.
              </p>
              <p className="text-[0.73rem] text-txt-3 mt-1">Everything below is optional — fill in what you can.</p>
            </div>
            <div className="flex gap-2 w-full pt-2">
              <button type="button" className="flex-1 bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={onClose}>Close</button>
              <button type="button" className="flex-1 bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center justify-center gap-1.5" onClick={() => setPhase('enrich')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Detail
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Enrich phase: type-conditional enrichment fields ───
  if (phase === 'enrich') {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center pt-12 px-4 overflow-y-auto animate-[overlayIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label="Enrich Pipeline Item">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-[680px] animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)] border border-white/60">
          <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
            <div>
              <h2 className="text-[1.1rem] font-[700] text-txt tracking-tight">Add Detail</h2>
              <p className="text-[0.75rem] text-txt-3 mt-0.5">{form.title}</p>
            </div>
            <button className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-transparent text-txt-3 cursor-pointer transition-all duration-150 hover:bg-subtle hover:text-txt" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto flex flex-col gap-4">
            <div className="flex items-center justify-between -mt-1">
              <p className="text-[0.78rem] text-txt-3 leading-relaxed bg-subtle/60 rounded-lg px-3 py-2 flex-1">Fill in whatever you know. Everything here is optional.</p>
              <AiButton onClick={async () => { setAiLoading(true); setAiReasoning(''); try { const res = await triageAugment(form.title, form.description); if (res?.data) { const d = res.data; setEnrich((f) => ({ ...f, ...(d.targetType && { targetType: d.targetType }), ...(d.criticality && { criticality: d.criticality }), ...(d.controlClassification && { controlClassification: d.controlClassification }), ...(d.controlObjective && { controlObjective: d.controlObjective }), ...(d.controlType && { controlType: d.controlType }), ...(d.implementationType && { implementationType: d.implementationType }), ...(d.executionFrequency && { executionFrequency: d.executionFrequency }), ...(d.nistFamilies?.length && { nistFamilies: d.nistFamilies }), ...(d.outcome && { outcome: d.outcome }), ...(d.audience && { audience: d.audience }) })); if (d.reasoning) setAiReasoning(d.reasoning) } } catch {} finally { setAiLoading(false) } }} loading={aiLoading} variant="small" className="ml-2 shrink-0">Auto-fill</AiButton>
            </div>
            {aiReasoning && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-ai-bg border border-ai/10 rounded-xl text-[0.78rem] text-ai leading-relaxed animate-[fadeIn_0.2s_ease]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22"/><path d="M8 6a4 4 0 0 1 8 0"/></svg>
                <span>{aiReasoning}</span>
              </div>
            )}

            {/* Type & Criticality */}
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pb-1.5 border-b border-border-light">Classification</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Type</label>
                <div className="flex gap-1.5">
                  {OBJECT_TYPES.map((t) => (
                    <button key={t} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${enrich.targetType === t ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => setE('targetType', t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
                <div className="flex gap-1.5">
                  {CRITICALITY_LEVELS.map((c) => (
                    <button key={c} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${enrich.criticality === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => setE('criticality', c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Owner & Operator */}
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Assignment</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Suggested Owner</label>
                <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={enrich.owner} onChange={(e) => setE('owner', e.target.value)} placeholder="Accountable for oversight" list="enrich-owners" />
                <datalist id="enrich-owners">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Suggested Operator</label>
                <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={enrich.operator} onChange={(e) => setE('operator', e.target.value)} placeholder="Manages and mitigates the risk" list="enrich-operators" />
                <datalist id="enrich-operators">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
            </div>

            {/* Control Details */}
            {enrich.targetType === 'Control' && (
              <>
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Control Details</div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Classification</label>
                  <div className="flex">
                    {['Informal', 'Formal'].map((c, i) => (
                      <button key={c} type="button" className={`flex-1 px-4 py-2 border text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${i === 0 ? 'rounded-l-[10px]' : 'rounded-r-[10px] border-l-0'} ${enrich.controlClassification === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border'}`} onClick={() => setE('controlClassification', c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Control Objective</label>
                  <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={enrich.controlObjective} onChange={(e) => setE('controlObjective', e.target.value)} rows={2} placeholder="What risk does this control mitigate?" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Function</label>
                    <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={enrich.controlType} onChange={(e) => setE('controlType', e.target.value)}>
                      <option value="">-- Select --</option>
                      {CONTROL_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Implementation</label>
                    <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={enrich.implementationType} onChange={(e) => setE('implementationType', e.target.value)}>
                      <option value="">-- Select --</option>
                      {IMPLEMENTATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Frequency</label>
                    <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={enrich.executionFrequency} onChange={(e) => setE('executionFrequency', e.target.value)}>
                      <option value="">-- Select --</option>
                      {EXECUTION_FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                {enrich.controlClassification === 'Formal' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">NIST 800-53 Families</label>
                    <div className="flex flex-wrap gap-1.5">
                      {NIST_FAMILIES.map((f) => (
                        <button key={f.id} type="button" className={`border rounded-full px-2.5 py-1 text-[0.78rem] font-medium cursor-pointer font-sans transition-all duration-150 ${(enrich.nistFamilies || []).includes(f.id) ? 'bg-brand-light border-brand text-brand font-semibold' : 'bg-white border-border text-txt-2 hover:border-brand hover:text-brand'}`} onClick={() => toggleNist(f.id)} title={f.name}>
                          {f.id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Process Details */}
            {enrich.targetType === 'Process' && (
              <>
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Process Details</div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Outcome</label>
                  <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={enrich.outcome} onChange={(e) => setE('outcome', e.target.value)} rows={2} placeholder="What does successful completion produce?" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Systems & Tools</label>
                  <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={enrich.systemsTools} onChange={(e) => setE('systemsTools', e.target.value)} placeholder="e.g., Okta, ServiceNow, Jira" />
                </div>
              </>
            )}

            {/* Procedure Details */}
            {enrich.targetType === 'Procedure' && (
              <>
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Procedure Details</div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Audience</label>
                  <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={enrich.audience} onChange={(e) => setE('audience', e.target.value)} placeholder="e.g., SOC Analysts, IAM Engineers" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Scope</label>
                  <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={enrich.scope} onChange={(e) => setE('scope', e.target.value)} rows={2} placeholder="What situations does this procedure cover?" />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border-light">
              <button type="button" className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={onClose}>Skip</button>
              <button type="button" className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5" onClick={handleEnrichSave}>Save & Close</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Input phase: lightweight intake form ───
  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center pt-16 px-4 overflow-y-auto animate-[overlayIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label="Log Pipeline Item">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-[540px] animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)] border border-white/60">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
          <h2 className="text-[1.1rem] font-[700] text-txt tracking-tight">Log a Pipeline Item</h2>
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-transparent text-txt-3 cursor-pointer transition-all duration-150 hover:bg-subtle hover:text-txt" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[0.82rem] text-txt-3 leading-relaxed -mt-1">Something missing or needed? Log it here. The responsible team will review and triage.</p>

          {formError && <div className="text-[0.78rem] text-red font-medium bg-red-bg rounded-lg px-3 py-2">{formError}</div>}

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">What's missing or needed? *</label>
            <input ref={titleRef} className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g., Missing MFA for service accounts" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Tell us more</label>
            <textarea className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What's the need, gap, or risk? Why does this matter?" />
          </div>

          <p className="text-[0.75rem] text-txt-3 leading-relaxed bg-subtle/60 rounded-lg px-3 py-2 -mb-1">If you already know the team or type, selecting them helps speed up triage.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Which team should review? *</label>
              <select className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.productFamily} onChange={(e) => set('productFamily', e.target.value)}>
                <option value="">Select team...</option>
                <option value="Unknown">Unknown / Not sure</option>
                {PRODUCT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">What type is needed?</label>
              <select className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.targetType} onChange={(e) => set('targetType', e.target.value)}>
                <option value="">Not sure</option>
                {OBJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Your name *</label>
            <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.identifier} onChange={(e) => set('identifier', e.target.value)} placeholder="Who is logging this?" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-light">
            <button type="button" className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={onClose}>Cancel</button>
            <button type="submit" className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45 inline-flex items-center gap-1.5" disabled={submitting}>{submitting ? 'Logging...' : 'Log Item'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TriageForm: Enrichment modal for untriaged items ──
function TriageForm({ gap, onSave, onClose, knownOwners }) {
  const [form, setForm] = useState({
    targetType: gap.targetType || '',
    owner: gap.owner || '',
    operator: gap.operator || '',
    criticality: gap.criticality || 'Medium',
    controlClassification: gap.controlClassification || 'Informal',
    nistFamilies: gap.nistFamilies || [],
    controlObjective: gap.controlObjective || '',
    controlType: gap.controlType || '',
    implementationType: gap.implementationType || '',
    executionFrequency: gap.executionFrequency || '',
    outcome: gap.outcome || '',
    systemsTools: gap.systemsTools || '',
    audience: gap.audience || '',
    scope: gap.scope || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReasoning, setAiReasoning] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleNist = (fId) => {
    setForm((f) => {
      const arr = f.nistFamilies || []
      return { ...f, nistFamilies: arr.includes(fId) ? arr.filter((x) => x !== fId) : [...arr, fId] }
    })
  }

  const handleAiFill = async () => {
    setAiLoading(true)
    setAiReasoning('')
    try {
      const res = await triageAugment(gap.title, gap.description)
      if (res?.data) {
        const d = res.data
        setForm((f) => ({
          ...f,
          ...(d.targetType && { targetType: d.targetType }),
          ...(d.criticality && { criticality: d.criticality }),
          ...(d.controlClassification && { controlClassification: d.controlClassification }),
          ...(d.controlObjective && { controlObjective: d.controlObjective }),
          ...(d.controlType && { controlType: d.controlType }),
          ...(d.implementationType && { implementationType: d.implementationType }),
          ...(d.executionFrequency && { executionFrequency: d.executionFrequency }),
          ...(d.nistFamilies?.length && { nistFamilies: d.nistFamilies }),
          ...(d.outcome && { outcome: d.outcome }),
          ...(d.audience && { audience: d.audience }),
        }))
        if (d.reasoning) setAiReasoning(d.reasoning)
      }
    } catch { /* error handled by AiButton */ }
    finally { setAiLoading(false) }
  }

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const daysAgo = Math.floor((Date.now() - new Date(gap.createdAt).getTime()) / 86400000)

  const canSubmit = form.targetType && form.owner.trim() && form.criticality

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting || !canSubmit) return
    setSubmitting(true)
    onSave({ id: gap.id, ...form })
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center pt-12 px-4 overflow-y-auto animate-[overlayIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label="Triage Pipeline Item">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-[680px] animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)] border border-white/60">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
          <h2 className="text-[1.1rem] font-[700] text-txt tracking-tight">Triage Pipeline Item</h2>
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-transparent text-txt-3 cursor-pointer transition-all duration-150 hover:bg-subtle hover:text-txt" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 max-h-[70vh] overflow-y-auto flex flex-col gap-4">
          {/* Context card */}
          <div className="bg-subtle/60 rounded-xl p-4 border border-border-light">
            <h3 className="text-[0.95rem] font-bold text-txt tracking-tight mb-1">{gap.title}</h3>
            {gap.description && <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-2.5">{gap.description}</p>}
            <div className="flex items-center gap-2 flex-wrap text-[0.75rem] text-txt-3">
              <span>Logged by <strong className="text-txt-2">{gap.identifier}</strong></span>
              <span>&middot;</span>
              <span>{daysAgo}d ago</span>
              <span>&middot;</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[0.72rem] font-semibold">{gap.productFamily}</span>
            </div>
            {gap.sourceSafeguard && (
              <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-[0.75rem]">
                <span className="font-bold font-mono text-teal-700">{gap.sourceSafeguard.safeguardId}</span>
                <span className="text-teal-600">{gap.sourceSafeguard.name}</span>
                <span className="text-teal-500 text-[0.68rem]">({gap.sourceSafeguard.framework})</span>
              </div>
            )}
          </div>

          {/* AI Auto-fill */}
          <div className="flex items-center gap-2">
            <AiButton onClick={handleAiFill} loading={aiLoading} variant="small">Auto-fill with AI</AiButton>
            <span className="text-[0.72rem] text-txt-3">Suggest classification based on title & description</span>
          </div>
          {aiReasoning && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-ai-bg border border-ai/10 rounded-xl text-[0.78rem] text-ai leading-relaxed animate-[fadeIn_0.2s_ease]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22"/><path d="M8 6a4 4 0 0 1 8 0"/></svg>
              <span>{aiReasoning}</span>
            </div>
          )}

          {/* Classification */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pb-1.5 border-b border-border-light">Classification</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Target Type *</label>
              <div className="flex gap-1.5">
                {OBJECT_TYPES.map((t) => (
                  <button key={t} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${form.targetType === t ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => set('targetType', t)}>
                    {t}
                  </button>
                ))}
              </div>
              {!form.targetType && <span className="text-[0.72rem] text-txt-3">Select a type to see additional fields</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality *</label>
              <div className="flex gap-1.5">
                {CRITICALITY_LEVELS.map((c) => (
                  <button key={c} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${form.criticality === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => set('criticality', c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Assignment</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Owner *</label>
              <input className={`bg-white border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 ${!form.owner.trim() ? 'border-red/30' : 'border-border'}`} value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Accountable for oversight" list="triage-owners" />
              <datalist id="triage-owners">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Operator</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.operator} onChange={(e) => set('operator', e.target.value)} placeholder="Manages and mitigates the risk" list="triage-operators" />
              <datalist id="triage-operators">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
            </div>
          </div>

          {/* Control Details — only for Controls */}
          {form.targetType === 'Control' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Control Details</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Classification</label>
                <div className="flex">
                  {['Informal', 'Formal'].map((c, i) => (
                    <button key={c} type="button" className={`flex-1 px-4 py-2 border text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${i === 0 ? 'rounded-l-[10px]' : 'rounded-r-[10px] border-l-0'} ${form.controlClassification === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border'}`} onClick={() => set('controlClassification', c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Control Objective</label>
                <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.controlObjective} onChange={(e) => set('controlObjective', e.target.value)} rows={2} placeholder="What risk does this control mitigate?" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Function</label>
                  <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.controlType} onChange={(e) => set('controlType', e.target.value)}>
                    <option value="">-- Select --</option>
                    {CONTROL_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Implementation</label>
                  <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.implementationType} onChange={(e) => set('implementationType', e.target.value)}>
                    <option value="">-- Select --</option>
                    {IMPLEMENTATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Frequency</label>
                  <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.executionFrequency} onChange={(e) => set('executionFrequency', e.target.value)}>
                    <option value="">-- Select --</option>
                    {EXECUTION_FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              {form.controlClassification === 'Formal' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">NIST 800-53 Families</label>
                  <div className="flex flex-wrap gap-1.5">
                    {NIST_FAMILIES.map((f) => (
                      <button key={f.id} type="button" className={`border rounded-full px-2.5 py-1 text-[0.78rem] font-medium cursor-pointer font-sans transition-all duration-150 ${(form.nistFamilies || []).includes(f.id) ? 'bg-brand-light border-brand text-brand font-semibold' : 'bg-white border-border text-txt-2 hover:border-brand hover:text-brand'}`} onClick={() => toggleNist(f.id)} title={f.name}>
                        {f.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Process Details — only for Processes */}
          {form.targetType === 'Process' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Process Details</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Outcome</label>
                <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.outcome} onChange={(e) => set('outcome', e.target.value)} rows={2} placeholder="What does successful completion produce?" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Systems & Tools</label>
                <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.systemsTools} onChange={(e) => set('systemsTools', e.target.value)} placeholder="e.g., Okta, ServiceNow, Jira" />
              </div>
            </>
          )}

          {/* Procedure Details — only for Procedures */}
          {form.targetType === 'Procedure' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Procedure Details</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Audience</label>
                <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g., SOC Analysts, IAM Engineers" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Scope</label>
                <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.scope} onChange={(e) => set('scope', e.target.value)} rows={2} placeholder="What situations does this procedure cover?" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border-light">
            <button type="button" className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={onClose}>Cancel</button>
            <button type="submit" className={`bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45 inline-flex items-center gap-1.5`} disabled={submitting || !canSubmit}>{submitting ? 'Saving...' : 'Complete Triage'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EditForm: Full edit for triaged items ──
function EditForm({ gap, onSave, onClose, knownOwners }) {
  const [form, setForm] = useState({
    productFamily: '',
    targetType: '',
    owner: '',
    operator: '',
    criticality: 'Medium',
    title: '',
    description: '',
    status: 'Open',
    controlClassification: 'Informal',
    nistFamilies: [],
    controlObjective: '',
    controlType: '',
    implementationType: '',
    executionFrequency: '',
    outcome: '',
    systemsTools: '',
    audience: '',
    scope: '',
    kpiNumerator: 0,
    kpiDenominator: 0,
    remediationNote: '',
    expiryDate: '',
    jiraL1: '',
    jiraL2: '',
    ...(gap || {}),
  })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleNist = (fId) => {
    setForm((f) => {
      const arr = f.nistFamilies || []
      return { ...f, nistFamilies: arr.includes(fId) ? arr.filter((x) => x !== fId) : [...arr, fId] }
    })
  }

  const computedCompliance = form.kpiDenominator ? Math.round((form.kpiNumerator / form.kpiDenominator) * 1000) / 10 : 0
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    if (titleRef.current) titleRef.current.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
    if (!form.productFamily) { setFormError('Product family is required'); return }
    if (!form.title.trim()) { setFormError('Title is required'); return }
    setFormError('')
    setSubmitting(true)
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-start justify-center pt-12 px-4 overflow-y-auto animate-[overlayIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label="Edit Pipeline Item">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-[760px] animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)] border border-white/60">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
          <h2 className="text-[1.1rem] font-[700] text-txt tracking-tight">Edit Pipeline Item</h2>
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-transparent text-txt-3 cursor-pointer transition-all duration-150 hover:bg-subtle hover:text-txt" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 max-h-[70vh] overflow-y-auto flex flex-col gap-3.5">
          {/* Identifier (read-only) */}
          {gap?.identifier && (
            <div className="text-[0.78rem] text-txt-3 bg-subtle/60 rounded-lg px-3 py-2">Logged by <strong className="text-txt-2">{gap.identifier}</strong></div>
          )}

          {formError && <div className="text-[0.78rem] text-red font-medium bg-red-bg rounded-lg px-3 py-2">{formError}</div>}

          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pb-1.5 border-b border-border-light">Pipeline Identity</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Product Family *</label>
              <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.productFamily} onChange={(e) => set('productFamily', e.target.value)}>
                <option value="">Select family...</option>
                {PRODUCT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Target Type</label>
              <div className="flex gap-1.5">
                {OBJECT_TYPES.map((t) => (
                  <button key={t} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${form.targetType === t ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => set('targetType', t)}>{t}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Owner</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Accountable for oversight" list="edit-owners" />
              <datalist id="edit-owners">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Operator</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.operator} onChange={(e) => set('operator', e.target.value)} placeholder="Manages and mitigates the risk" list="edit-operators" />
              <datalist id="edit-operators">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
            <div className="flex gap-1.5">
              {CRITICALITY_LEVELS.map((c) => (
                <button key={c} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${form.criticality === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => set('criticality', c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Status & Details</div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Status</label>
            <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {GAP_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Title *</label>
            <input ref={titleRef} className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Description</label>
            <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Description" />
          </div>

          {/* Control Details — only for Controls */}
          {form.targetType === 'Control' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Control Details</div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Classification</label>
                <div className="flex">
                  {['Informal', 'Formal'].map((c, i) => (
                    <button key={c} type="button" className={`flex-1 px-4 py-2 border text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${i === 0 ? 'rounded-l-[10px]' : 'rounded-r-[10px] border-l-0'} ${form.controlClassification === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border'}`} onClick={() => set('controlClassification', c)}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Control Objective</label>
                <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.controlObjective} onChange={(e) => set('controlObjective', e.target.value)} rows={2} placeholder="What risk does this control mitigate?" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Function</label>
                  <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.controlType} onChange={(e) => set('controlType', e.target.value)}>
                    <option value="">-- Select --</option>
                    {CONTROL_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Implementation</label>
                  <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.implementationType} onChange={(e) => set('implementationType', e.target.value)}>
                    <option value="">-- Select --</option>
                    {IMPLEMENTATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Frequency</label>
                  <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.executionFrequency} onChange={(e) => set('executionFrequency', e.target.value)}>
                    <option value="">-- Select --</option>
                    {EXECUTION_FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              {form.controlClassification === 'Formal' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">NIST 800-53 Families</label>
                  <div className="flex flex-wrap gap-1.5">
                    {NIST_FAMILIES.map((f) => (
                      <button key={f.id} type="button" className={`border rounded-full px-2.5 py-1 text-[0.78rem] font-medium cursor-pointer font-sans transition-all duration-150 ${(form.nistFamilies || []).includes(f.id) ? 'bg-brand-light border-brand text-brand font-semibold' : 'bg-white border-border text-txt-2 hover:border-brand hover:text-brand'}`} onClick={() => toggleNist(f.id)} title={f.name}>{f.id}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Process Details — only for Processes */}
          {form.targetType === 'Process' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Process Details</div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Outcome</label>
                <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.outcome} onChange={(e) => set('outcome', e.target.value)} rows={2} placeholder="What does successful completion produce?" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Systems & Tools</label>
                <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.systemsTools} onChange={(e) => set('systemsTools', e.target.value)} placeholder="e.g., Okta, ServiceNow, Jira" />
              </div>
            </>
          )}

          {/* Procedure Details — only for Procedures */}
          {form.targetType === 'Procedure' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Procedure Details</div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Audience</label>
                <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g., SOC Analysts, IAM Engineers" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Scope</label>
                <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.scope} onChange={(e) => set('scope', e.target.value)} rows={2} placeholder="What situations does this procedure cover?" />
              </div>
            </>
          )}

          {/* KPI */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">KPI Tracking</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Numerator</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" type="number" min="0" value={form.kpiNumerator} onChange={(e) => set('kpiNumerator', Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Denominator</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" type="number" min="0" value={form.kpiDenominator} onChange={(e) => set('kpiDenominator', Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Compliance %</label>
              <div className="flex items-center h-[38px] text-xl font-[750] text-brand tracking-tight">{computedCompliance}%</div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Remediation Note</label>
            <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.remediationNote} onChange={(e) => set('remediationNote', e.target.value)} rows={2} placeholder="Steps taken or planned..." />
          </div>

          {/* Exception / Expiry */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Exception Management</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Exception Expiry Date</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Jira L1 (Epic)</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.jiraL1} onChange={(e) => set('jiraL1', e.target.value)} placeholder="PROJ-123" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Jira L2 (Initiative)</label>
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.jiraL2} onChange={(e) => set('jiraL2', e.target.value)} placeholder="PROJ-456" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border-light mt-1">
            <button type="button" className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={onClose}>Cancel</button>
            <button type="submit" className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45 inline-flex items-center gap-1.5" disabled={submitting}>{submitting ? 'Saving...' : 'Update Item'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Main GapTracker Component
// ═══════════════════════════════════════════════

export default function GapTracker({ onNavigate }) {
  const { gaps, objects } = useStore()
  const dispatch = useDispatch()
  const [showLogForm, setShowLogForm] = useState(false)
  const [triageGap, setTriageGap] = useState(null)
  const [editGap, setEditGap] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFamily, setFilterFamily] = useState('')
  const [filterActiveFamily, setFilterActiveFamily] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [viewMode, setViewMode] = useState('card') // 'card' | 'table'
  const [sortCol, setSortCol] = useState('updatedAt')
  const [sortDir, setSortDir] = useState('desc')
  const [aiPanel, setAiPanel] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiTitle, setAiTitle] = useState('')
  const [remediationResults, setRemediationResults] = useState({})
  const [remLoading, setRemLoading] = useState({})

  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'default', promptMode: false, promptPlaceholder: '', confirmLabel: 'Confirm' })
  const closeConfirmDialog = useCallback(() => { setConfirmDialog((d) => ({ ...d, open: false })) }, [])

  // Tab state: default to triage if items need it
  const untriagedGaps = useMemo(() => gaps.filter((g) => !g.triaged), [gaps])
  const [activeTab, setActiveTab] = useState(untriagedGaps.length > 0 ? 'triage' : 'active')

  // Known owners for autocomplete
  const knownOwners = useMemo(() => {
    const people = new Set()
    objects.forEach((o) => {
      if (o.owner?.trim()) people.add(o.owner.trim())
      if (o.operator?.trim()) people.add(o.operator.trim())
    })
    gaps.forEach((g) => {
      if (g.identifier?.trim()) people.add(g.identifier.trim())
      if (g.owner?.trim()) people.add(g.owner.trim())
      if (g.operator?.trim()) people.add(g.operator.trim())
    })
    return [...people].sort()
  }, [objects, gaps])

  // Filtered lists per tab
  const triageItems = useMemo(() => {
    let list = [...untriagedGaps].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
    if (filterFamily) list = list.filter((g) => g.productFamily === filterFamily)
    return list
  }, [untriagedGaps, filterFamily])

  const activeItems = useMemo(() => {
    let list = gaps.filter((g) => g.triaged && g.status !== 'Closed')
    if (filterStatus) list = list.filter((g) => g.status === filterStatus)
    if (filterActiveFamily) list = list.filter((g) => g.productFamily === filterActiveFamily)
    // Sort
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (sortCol) {
        case 'title': return dir * (a.title || '').localeCompare(b.title || '')
        case 'team': return dir * (a.productFamily || '').localeCompare(b.productFamily || '')
        case 'type': return dir * (a.targetType || '').localeCompare(b.targetType || '')
        case 'owner': return dir * (a.owner || '').localeCompare(b.owner || '')
        case 'operator': return dir * (a.operator || '').localeCompare(b.operator || '')
        case 'status': return dir * (a.status || '').localeCompare(b.status || '')
        case 'daysOpen': { const da = (Date.now() - new Date(a.createdAt).getTime()); const db = (Date.now() - new Date(b.createdAt).getTime()); return dir * (da - db) }
        case 'compliance': return dir * ((a.compliancePercent || 0) - (b.compliancePercent || 0))
        default: return dir * (new Date(a.updatedAt) - new Date(b.updatedAt))
      }
    })
    return list
  }, [gaps, filterStatus, filterActiveFamily, sortCol, sortDir])

  const closedItems = useMemo(() => {
    return gaps.filter((g) => g.status === 'Closed').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  }, [gaps])

  const handlePrioritize = async () => {
    setAiPanel(true); setAiLoading(true); setAiError(null); setAiTitle('Pipeline Prioritization')
    try { const res = await prioritizeGaps(gaps); setAiContent(res.content) }
    catch (err) { setAiError(err.message) }
    finally { setAiLoading(false) }
  }

  const handleRemediation = async (gap) => {
    setRemLoading((prev) => ({ ...prev, [gap.id]: true }))
    try { const res = await getRemediation(gap, []); setRemediationResults((prev) => ({ ...prev, [gap.id]: res.content })) }
    catch (err) { setRemediationResults((prev) => ({ ...prev, [gap.id]: `Error: ${err.message}` })) }
    finally { setRemLoading((prev) => ({ ...prev, [gap.id]: false })) }
  }

  const handleLogSave = (data) => {
    dispatch({ type: 'ADD_GAP', payload: data })
    setActiveTab('triage')
  }

  const handleLogEnrich = (data) => {
    dispatch({ type: 'UPDATE_GAP', payload: data })
  }

  const handleTriageSave = (data) => {
    dispatch({ type: 'TRIAGE_GAP', payload: data })
    setTriageGap(null)
    if (untriagedGaps.length <= 1) setActiveTab('active')
  }

  const handleEditSave = (data) => {
    dispatch({ type: 'UPDATE_GAP', payload: { id: editGap.id, ...data } })
    setEditGap(null)
  }

  const handleStatusChange = (gap, newStatus) => {
    setConfirmDialog({
      open: true,
      title: newStatus === 'Closed' ? 'Close Item' : 'Update Status',
      message: newStatus === 'Closed' ? `Close "${gap.title}"? Enter a closing note.` : `Update "${gap.title}" to ${newStatus}. Enter a note.`,
      promptMode: true, promptPlaceholder: newStatus === 'Closed' ? 'Enter closing note...' : 'Enter status update note...', confirmLabel: newStatus === 'Closed' ? 'Close Item' : 'Update', variant: 'default',
      onConfirm: (note) => { dispatch({ type: 'UPDATE_GAP', payload: { id: gap.id, status: newStatus, remediationNote: note || gap.remediationNote } }); setConfirmDialog((d) => ({ ...d, open: false })) },
    })
  }


  const handlePromote = (gap) => {
    // Navigate to Object Inventory with ObjectForm pre-filled from gap data
    // so the user can complete enrichment before the object is created
    onNavigate('objects', null, {
      promotionData: {
        gapId: gap.id,
        gapTitle: gap.title,
        listName: gap.title,
        description: gap.description || '',
        productFamilies: gap.productFamily ? [gap.productFamily] : [],
        type: gap.targetType || 'Control',
        owner: gap.owner || '',
        operator: gap.operator || '',
        identifyingPerson: gap.identifier || '',
        criticality: gap.criticality || 'Medium',
        healthStatus: 'BLUE',
        controlClassification: gap.controlClassification || 'Informal',
        nistFamilies: gap.nistFamilies || [],
        controlObjective: gap.controlObjective || '',
        controlType: gap.controlType || '',
        implementationType: gap.implementationType || '',
        executionFrequency: gap.executionFrequency || '',
        outcome: gap.outcome || '',
        systemsTools: gap.systemsTools || '',
        audience: gap.audience || '',
        scope: gap.scope || '',
        kpiNumerator: gap.kpiNumerator || 0,
        kpiDenominator: gap.kpiDenominator || 0,
        jiraL1: gap.jiraL1 || '',
        jiraL2: gap.jiraL2 || '',
        ...(gap.sourceSafeguard ? { sourceSafeguard: gap.sourceSafeguard } : {}),
      },
    })
  }

  const getPipelineInfo = (gap) => {
    const parts = [gap.productFamily, gap.targetType, gap.owner].filter(Boolean)
    return parts.length > 0 ? parts.join(' / ') : 'No pipeline info'
  }

  const getDaysOpen = (gap) => {
    if (gap.status === 'Closed') return null
    return Math.floor((Date.now() - new Date(gap.createdAt).getTime()) / 86400000)
  }

  const getExpiryInfo = (gap) => {
    if (!gap.expiryDate) return null
    const daysUntil = Math.floor((new Date(gap.expiryDate) - Date.now()) / 86400000)
    if (daysUntil < 0) return { status: 'expired', label: `Expired ${Math.abs(daysUntil)}d ago` }
    if (daysUntil <= 14) return { status: 'expiring', label: `Expires in ${daysUntil}d` }
    return { status: 'ok', label: `Expires ${gap.expiryDate}` }
  }

  // Triage progress stats
  const totalItems = gaps.length
  const triagedCount = gaps.filter((g) => g.triaged).length
  const promotedCount = closedItems.length
  const pctTriaged = totalItems ? Math.round((triagedCount / totalItems) * 100) : 0

  const tabs = [
    { id: 'triage', label: 'Triage Queue', count: untriagedGaps.length },
    { id: 'active', label: 'Active Pipeline', count: activeItems.length },
    { id: 'closed', label: 'Closed', count: closedItems.length },
  ]

  // ── Render a gap card (used in Active Pipeline and Closed tabs) ──
  const renderGapCard = (gap) => {
    const gs = GAP_STATUSES.find((s) => s.id === gap.status) || GAP_STATUSES[0]
    const expanded = expandedId === gap.id
    const daysOpen = getDaysOpen(gap)
    const expiryInfo = getExpiryInfo(gap)
    return (
      <div key={gap.id} className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px">
        <div className="flex justify-between items-center px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : gap.id)} role="button" tabIndex={0} aria-expanded={expanded} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : gap.id) } }}>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap shrink-0" style={{ backgroundColor: gs.bg, color: gs.color }}>{gs.id}</span>
            {gap.sourceSafeguard && (
              <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold font-mono bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap shrink-0" title={`From ${gap.sourceSafeguard.framework} assessment`}>{gap.sourceSafeguard.safeguardId}</span>
            )}
            <div>
              <div className="font-semibold text-[0.88rem] tracking-tight text-txt">{gap.title}</div>
              <div className="text-[0.75rem] text-txt-3 mt-px">{getPipelineInfo(gap)} &middot; {formatDate(gap.createdAt)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {daysOpen !== null && daysOpen > 0 && (
              <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${daysOpen > 90 ? 'bg-red-bg text-red' : daysOpen > 30 ? 'bg-amber-bg text-amber' : 'bg-subtle text-txt-3'}`}>{daysOpen}d open</span>
            )}
            {expiryInfo && expiryInfo.status !== 'ok' && (
              <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${expiryInfo.status === 'expired' ? 'bg-red-bg text-red' : 'bg-amber-bg text-amber'}`}>{expiryInfo.label}</span>
            )}
            {(gap.compliancePercent > 0 || gap.kpiDenominator > 0) && (
              <span className="text-[0.7rem] font-semibold font-mono px-1.5 py-0.5 rounded bg-subtle text-[#475569]">{gap.compliancePercent}%</span>
            )}
            {gap.jiraL1 && <span className="bg-blue-bg text-status-blue px-1.5 py-0.5 rounded text-[0.68rem] font-semibold font-mono">{gap.jiraL1}</span>}
            <span className={`text-txt-3 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </div>

        {gap.status !== 'Closed' && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 mx-3.5 bg-brand-light border border-brand/10 rounded-[10px] text-[0.78rem] text-brand-deep">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>Ready to promote to Object Inventory</span>
            <button className="ml-auto whitespace-nowrap bg-white border border-brand/20 text-brand rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-brand-light hover:border-brand/30" onClick={(e) => { e.stopPropagation(); handlePromote(gap) }}>Promote to Object</button>
          </div>
        )}

        {expanded && (
          <div className="px-4 pb-4 animate-[fadeIn_0.18s_ease]">
            {gap.description && <p className="text-[0.85rem] text-txt-2 mb-2.5 leading-relaxed">{gap.description}</p>}
            <div className="flex flex-wrap gap-3.5 my-2.5 p-2.5 bg-subtle/60 rounded-[10px]">
              {gap.targetType === 'Control' && gap.controlClassification && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">Control Type</span>
                  <span className={`text-[0.82rem] font-semibold px-2 py-0.5 rounded-md ${(gap.controlClassification || 'informal').toLowerCase() === 'formal' ? 'bg-brand-light text-brand' : 'bg-subtle text-txt-2'}`}>{gap.controlClassification}</span>
                </div>
              )}
              {gap.targetType === 'Control' && gap.controlClassification === 'Formal' && gap.nistFamilies?.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">NIST Families</span>
                  <div className="flex flex-wrap gap-1">{gap.nistFamilies.map((fId) => (<span key={fId} className="px-1.5 py-0.5 rounded bg-subtle text-[0.7rem] font-bold text-txt-2">{fId}</span>))}</div>
                </div>
              )}
              {gap.identifier && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">Logged By</span>
                  <span className="text-[0.82rem] font-semibold text-txt">{gap.identifier}</span>
                </div>
              )}
              {gap.operator && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">Operator</span>
                  <span className="text-[0.82rem] font-semibold text-txt">{gap.operator}</span>
                </div>
              )}
              {(gap.kpiNumerator > 0 || gap.kpiDenominator > 0) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">KPI</span>
                  <span className="text-[0.85rem] font-semibold text-txt">{gap.kpiNumerator} / {gap.kpiDenominator} = {gap.compliancePercent || 0}%</span>
                </div>
              )}
              {gap.expiryDate && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">Exception Expiry</span>
                  <span className={`text-[0.85rem] font-semibold ${expiryInfo?.status === 'expired' ? 'text-red' : expiryInfo?.status === 'expiring' ? 'text-amber' : 'text-txt'}`}>{gap.expiryDate}{expiryInfo && expiryInfo.status !== 'ok' ? ` (${expiryInfo.label})` : ''}</span>
                </div>
              )}
              {gap.jiraL2 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wide">Jira L2</span>
                  <span className="bg-blue-bg text-status-blue px-1.5 py-0.5 rounded text-[0.68rem] font-semibold font-mono">{gap.jiraL2}</span>
                </div>
              )}
            </div>

            {gap.remediationNote && (
              <div className="text-[0.82rem] text-txt-2 px-3 py-2.5 bg-subtle/60 rounded-[10px] mb-2.5 leading-relaxed"><strong>Remediation:</strong> {gap.remediationNote}</div>
            )}


            {/* Audit Trail */}
            {gap.history?.length > 0 && (
              <div className="mb-2.5">
                <h4 className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-txt-3 mb-2">Audit Trail</h4>
                <div className="flex flex-col pl-2">
                  {gap.history.map((entry, i) => (
                    <div key={i} className="flex gap-3 relative pb-2 [&:not(:last-child)]:before:content-[''] [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:left-[3px] [&:not(:last-child)]:before:top-3 [&:not(:last-child)]:before:bottom-[-4px] [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-border-light">
                      <div className="w-[7px] h-[7px] rounded-full bg-brand mt-[5px] shrink-0" />
                      <div className="text-[0.78rem]">
                        <span className="font-bold mr-1.5">{entry.status}</span>
                        <span className="text-txt-2">{entry.note}</span>
                        <span className="block text-[0.68rem] text-txt-3 mt-px">{formatDate(entry.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-1.5 mt-2">
              <AiButton onClick={() => handleRemediation(gap)} loading={remLoading[gap.id]} variant="small">Remediation Plan</AiButton>
              {gap.status !== 'Closed' && (
                <>
                  {gap.status === 'Open' && <button className="bg-white border border-border text-txt-2 rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => handleStatusChange(gap, 'In Progress')}>Mark In Progress</button>}
                  <button className="bg-white border border-green/25 text-green rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-green-bg hover:border-green/40" onClick={() => handleStatusChange(gap, 'Closed')}>Close Item</button>
                </>
              )}
              <button className="bg-white border border-border text-txt-2 rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={() => setEditGap(gap)}>Edit</button>
              <button className="bg-white border border-red/25 text-red rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-red-bg hover:border-red/40" onClick={() => setConfirmDialog({ open: true, title: 'Delete Item', message: `Delete "${gap.title}"? This cannot be undone.`, promptMode: false, confirmLabel: 'Delete', variant: 'danger', onConfirm: () => { dispatch({ type: 'DELETE_GAP', payload: gap.id }); setConfirmDialog((d) => ({ ...d, open: false })) } })}>Delete</button>
            </div>
            {remediationResults[gap.id] && <AiInlineResult content={remediationResults[gap.id]} onClose={() => setRemediationResults((prev) => { const n = {...prev}; delete n[gap.id]; return n })} />}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">OneList</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Governance intake pipeline — log, triage, and promote items to the Object Inventory</p>
        </div>
        <div className="flex gap-2">
          <AiButton onClick={handlePrioritize} loading={aiPanel && aiLoading}>Prioritize Pipeline</AiButton>
          <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45 inline-flex items-center gap-1.5" onClick={() => setShowLogForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Log Item
          </button>
        </div>
      </div>

      <AiSlidePanel open={aiPanel} onClose={() => setAiPanel(false)} title={aiTitle} loading={aiLoading} content={aiContent}>
        {aiError && <AiError error={aiError} onRetry={handlePrioritize} />}
      </AiSlidePanel>

      {/* Triage Progress Banner */}
      {totalItems > 0 && (() => {
        const needsTriage = totalItems - triagedCount
        const triagedActive = triagedCount - promotedCount
        const r = 40, circ = 2 * Math.PI * r
        const triagedArc = circ * (triagedCount / totalItems)
        const needsArc = circ - triagedArc
        return (
          <div className="bg-gradient-to-br from-[#f8faff] to-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(37,99,235,0.06)] border border-[#e8edf5] p-6 mb-6">
            <div className="flex items-center gap-6">
              {/* Donut chart */}
              <div className="relative w-[100px] h-[100px] shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r={r} fill="none" stroke="#fee2e2" strokeWidth="10" />
                  {triagedCount > 0 && (
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#2563eb" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${triagedArc} ${needsArc}`} />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[1.35rem] font-[800] leading-none tracking-tight text-txt">{pctTriaged}%</span>
                  <span className="text-[0.6rem] font-semibold text-txt-3 uppercase tracking-wider mt-0.5">triaged</span>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[0.92rem] font-bold tracking-tight text-txt leading-none">Triage Progress</h3>
                    <p className="text-[0.72rem] text-txt-3 mt-0.5">{totalItems} items in pipeline</p>
                  </div>
                </div>
                <div className="h-2.5 bg-[#eef2f9] rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-brand via-[#4f8af7] to-[#60a5fa] rounded-full transition-all duration-700 ease-out" style={{ width: `${pctTriaged}%` }} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2.5 bg-red-bg/50 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-red shrink-0" />
                    <span className="text-[0.75rem] text-txt-2">Awaiting</span>
                    <span className="text-[0.88rem] font-[800] text-red ml-auto">{needsTriage}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2.5 bg-amber-bg/50 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
                    <span className="text-[0.75rem] text-txt-2">Triaged</span>
                    <span className="text-[0.88rem] font-[800] text-amber ml-auto">{triagedActive}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2.5 bg-green-bg/50 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-green shrink-0" />
                    <span className="text-[0.75rem] text-txt-2">Closed</span>
                    <span className="text-[0.88rem] font-[800] text-green ml-auto">{promotedCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border-light">
        {tabs.map((tab) => (
          <button key={tab.id} className={`relative px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 border-none bg-transparent ${activeTab === tab.id ? 'text-brand' : 'text-txt-3 hover:text-txt-2'}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 text-[0.72rem] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-brand-light text-brand' : 'bg-subtle text-txt-3'}`}>{tab.count}</span>
            )}
            {activeTab === tab.id && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand rounded-t" />}
          </button>
        ))}
      </div>

      {/* ── Triage Queue Tab ── */}
      {activeTab === 'triage' && (
        <>
          {/* Family filter */}
          <div className="flex gap-2 mb-4">
            <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
              <option value="">All Teams</option>
              {PRODUCT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {triageItems.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3">
              <svg className="mx-auto mb-3 text-green" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <p className="text-[0.88rem] font-semibold text-txt mb-1">All caught up</p>
              <p className="text-[0.82rem]">No items waiting for triage{filterFamily ? ' in this team' : ''}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {triageItems.map((gap) => {
                const daysAgo = Math.floor((Date.now() - new Date(gap.createdAt).getTime()) / 86400000)
                return (
                  <div key={gap.id} className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[0.72rem] font-semibold px-2.5 py-0.5 rounded-full bg-brand-light text-brand">{gap.productFamily}</span>
                      {gap.targetType && <span className="text-[0.72rem] font-semibold px-2.5 py-0.5 rounded-full bg-subtle text-txt-2">{gap.targetType}</span>}
                    </div>
                    <h4 className="text-[0.92rem] font-semibold text-txt tracking-tight mb-1.5 leading-snug">{gap.title}</h4>
                    {gap.description && (
                      <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-3 line-clamp-2">{gap.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[0.75rem] text-txt-3">
                        Logged by <strong className="text-txt-2">{gap.identifier || 'Unknown'}</strong> &middot; {daysAgo}d ago
                      </span>
                      <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:-translate-y-0.5 active:scale-[0.97]" onClick={() => setTriageGap(gap)}>
                        Triage
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Active Pipeline Tab ── */}
      {activeTab === 'active' && (() => {
        const toggleSort = (col) => {
          if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
          else { setSortCol(col); setSortDir('asc') }
        }
        const SortHeader = ({ col, children, className = '' }) => (
          <th className={`text-left text-[0.7rem] font-bold uppercase tracking-[0.06em] text-txt-3 px-3 py-2.5 cursor-pointer select-none hover:text-txt-2 transition-colors duration-150 whitespace-nowrap ${className}`} onClick={() => toggleSort(col)}>
            <span className="inline-flex items-center gap-1">
              {children}
              {sortCol === col && <span className="text-brand">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
            </span>
          </th>
        )
        return (
          <>
            <div className="flex items-center gap-2 mb-4">
              <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {GAP_STATUSES.filter((s) => s.id !== 'Closed').map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
              <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterActiveFamily} onChange={(e) => setFilterActiveFamily(e.target.value)}>
                <option value="">All Teams</option>
                {PRODUCT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="ml-auto flex border border-border rounded-[10px] overflow-hidden">
                <button className={`px-2.5 py-2 border-none cursor-pointer transition-all duration-150 ${viewMode === 'card' ? 'bg-brand/10 text-brand' : 'bg-white text-txt-3 hover:bg-subtle'}`} onClick={() => setViewMode('card')} title="Card view" aria-label="Card view">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
                <button className={`px-2.5 py-2 border-none border-l border-l-border cursor-pointer transition-all duration-150 ${viewMode === 'table' ? 'bg-brand/10 text-brand' : 'bg-white text-txt-3 hover:bg-subtle'}`} onClick={() => setViewMode('table')} title="Table view" aria-label="Table view">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
              </div>
            </div>

            {activeItems.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3">
                <p>No active pipeline items{filterStatus || filterActiveFamily ? ' matching filters' : ''}.</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="flex flex-col gap-1.5">{activeItems.map(renderGapCard)}</div>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border-light bg-subtle/40">
                        <SortHeader col="title">Title</SortHeader>
                        <SortHeader col="team">Team</SortHeader>
                        <SortHeader col="type">Type</SortHeader>
                        <SortHeader col="owner">Owner</SortHeader>
                        <SortHeader col="operator">Operator</SortHeader>
                        <SortHeader col="status">Status</SortHeader>
                        <SortHeader col="daysOpen" className="text-right">Age</SortHeader>
                        <SortHeader col="compliance" className="text-right">KPI</SortHeader>
                        <th className="text-left text-[0.7rem] font-bold uppercase tracking-[0.06em] text-txt-3 px-3 py-2.5 whitespace-nowrap">Jira</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map((gap) => {
                        const gs = GAP_STATUSES.find((s) => s.id === gap.status) || GAP_STATUSES[0]
                        const daysOpen = getDaysOpen(gap)
                        const expanded = expandedId === gap.id
                        return (
                          <React.Fragment key={gap.id}>
                            <tr className={`border-b border-border-light/60 cursor-pointer transition-colors duration-100 hover:bg-subtle/30 ${expanded ? 'bg-subtle/20' : ''}`} onClick={() => setExpandedId(expanded ? null : gap.id)}>
                              <td className="px-3 py-2.5 max-w-[260px]">
                                <span className="text-[0.84rem] font-semibold text-txt tracking-tight block truncate">{gap.title}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-[0.78rem] font-semibold px-2 py-0.5 rounded-full bg-brand-light text-brand whitespace-nowrap">{gap.productFamily || '—'}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-[0.78rem] text-txt-2">{gap.targetType || '—'}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-[0.78rem] text-txt-2">{gap.owner || '—'}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-[0.78rem] text-txt-3">{gap.operator || '—'}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-0.5 rounded-full text-[0.72rem] font-bold whitespace-nowrap" style={{ backgroundColor: gs.bg, color: gs.color }}>{gs.id}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {daysOpen !== null && daysOpen > 0 && (
                                  <span className={`text-[0.72rem] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${daysOpen > 90 ? 'bg-red-bg text-red' : daysOpen > 30 ? 'bg-amber-bg text-amber' : 'text-txt-3'}`}>{daysOpen}d</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {(gap.compliancePercent > 0 || gap.kpiDenominator > 0) && (
                                  <span className="text-[0.75rem] font-semibold font-mono text-txt-2">{gap.compliancePercent}%</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {gap.jiraL1 && <span className="bg-blue-bg text-status-blue px-1.5 py-0.5 rounded text-[0.68rem] font-semibold font-mono">{gap.jiraL1}</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`text-txt-3 transition-transform duration-150 inline-block ${expanded ? 'rotate-180' : ''}`}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </span>
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={10} className="px-0 py-0 bg-subtle/10">
                                  <div className="px-4 py-4 animate-[fadeIn_0.18s_ease]">
                                    {gap.description && <p className="text-[0.85rem] text-txt-2 mb-2.5 leading-relaxed">{gap.description}</p>}
                                    {gap.sourceSafeguard && (
                                      <div className="flex items-center gap-2 mb-2.5 px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-[0.75rem] w-fit">
                                        <span className="font-bold font-mono text-teal-700">{gap.sourceSafeguard.safeguardId}</span>
                                        <span className="text-teal-600">{gap.sourceSafeguard.name}</span>
                                      </div>
                                    )}
                                    {gap.remediationNote && (
                                      <div className="text-[0.82rem] text-txt-2 px-3 py-2.5 bg-subtle/60 rounded-[10px] mb-2.5 leading-relaxed"><strong>Remediation:</strong> {gap.remediationNote}</div>
                                    )}
                                    <div className="flex gap-1.5 mt-2">
                                      <AiButton onClick={() => handleRemediation(gap)} loading={remLoading[gap.id]} variant="small">Remediation Plan</AiButton>
                                      {gap.status === 'Open' && <button className="bg-white border border-border text-txt-2 rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={(e) => { e.stopPropagation(); handleStatusChange(gap, 'In Progress') }}>Mark In Progress</button>}
                                      {gap.status !== 'Closed' && <button className="bg-white border border-brand/20 text-brand rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-brand-light hover:border-brand/30" onClick={(e) => { e.stopPropagation(); handlePromote(gap) }}>Promote</button>}
                                      <button className="bg-white border border-border text-txt-2 rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={(e) => { e.stopPropagation(); setEditGap(gap) }}>Edit</button>
                                      <button className="bg-white border border-green/25 text-green rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-green-bg hover:border-green/40" onClick={(e) => { e.stopPropagation(); handleStatusChange(gap, 'Closed') }}>Close</button>
                                    </div>
                                    {remediationResults[gap.id] && <AiInlineResult content={remediationResults[gap.id]} onClose={() => setRemediationResults((prev) => { const n = {...prev}; delete n[gap.id]; return n })} />}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border-light bg-subtle/20 text-[0.72rem] text-txt-3 font-medium">
                  {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} · Click column headers to sort
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ── Closed Tab ── */}
      {activeTab === 'closed' && (
        <>
          {closedItems.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3">
              <p>No closed items yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">{closedItems.map(renderGapCard)}</div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {showLogForm && <LogForm onSave={handleLogSave} onEnrich={handleLogEnrich} onClose={() => setShowLogForm(false)} knownOwners={knownOwners} />}
      {triageGap && <TriageForm gap={triageGap} onSave={handleTriageSave} onClose={() => setTriageGap(null)} knownOwners={knownOwners} />}
      {editGap && <EditForm gap={editGap} onSave={handleEditSave} onClose={() => setEditGap(null)} knownOwners={knownOwners} />}

      <ConfirmDialog open={confirmDialog.open} title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} variant={confirmDialog.variant} promptMode={confirmDialog.promptMode} promptPlaceholder={confirmDialog.promptPlaceholder} onConfirm={confirmDialog.onConfirm || (() => {})} onCancel={closeConfirmDialog} />
    </div>
  )
}
