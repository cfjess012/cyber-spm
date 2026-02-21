import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { GAP_STATUSES, GAP_HEALTH_STATUSES, NIST_FAMILIES, PRODUCT_FAMILIES, OBJECT_TYPES, CRITICALITY_LEVELS } from '../../data/constants.js'
import { formatDate, calcCompliance } from '../../utils/compliance.js'
import { getRemediation, prioritizeGaps } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiInlineResult, AiError } from '../AiPanel.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'

// ── LogForm: Lightweight intake (anyone can log in 30 seconds) ──
function LogForm({ onSave, onClose, knownOwners }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    identifier: '',
    productFamily: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    if (titleRef.current) titleRef.current.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
    if (!form.title.trim()) { setFormError('Title is required'); return }
    if (!form.identifier.trim()) { setFormError('Your name is required'); return }
    if (!form.productFamily) { setFormError('Please select a team'); return }
    setFormError('')
    setSubmitting(true)
    onSave({ ...form, triaged: false })
  }

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

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Which team should review? *</label>
            <select className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.productFamily} onChange={(e) => set('productFamily', e.target.value)}>
              <option value="">Select team...</option>
              {PRODUCT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
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
    targetType: gap.targetType || 'Control',
    owner: gap.owner || '',
    criticality: gap.criticality || 'Medium',
    healthStatus: gap.healthStatus || 'RED',
    controlClassification: gap.controlClassification || 'Informal',
    nistFamilies: gap.nistFamilies || [],
  })
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleNist = (fId) => {
    setForm((f) => {
      const arr = f.nistFamilies || []
      return { ...f, nistFamilies: arr.includes(fId) ? arr.filter((x) => x !== fId) : [...arr, fId] }
    })
  }

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const daysAgo = Math.floor((Date.now() - new Date(gap.createdAt).getTime()) / 86400000)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
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
          </div>

          {/* Classification */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pb-1.5 border-b border-border-light">Classification</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Target Type</label>
              <div className="flex gap-1.5">
                {OBJECT_TYPES.map((t) => (
                  <button key={t} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${form.targetType === t ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => set('targetType', t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Assign to</label>
            <input className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Who should own remediation?" />
          </div>

          {/* Health Assessment */}
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-2 pb-1.5 border-b border-border-light">Health Assessment</div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Health Status</label>
            <div className="flex gap-1.5">
              {GAP_HEALTH_STATUSES.map((h) => (
                <button key={h.id} type="button" className={`flex-1 py-2 border border-border rounded-[10px] bg-white text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 text-txt-2 hover:border-gray-300 ${form.healthStatus === h.id ? 'font-bold' : ''}`} style={form.healthStatus === h.id ? { backgroundColor: h.bg, color: h.color, borderColor: h.color } : {}} onClick={() => set('healthStatus', h.id)}>
                  {h.label}
                </button>
              ))}
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

          <div className="flex justify-end gap-2 pt-3 border-t border-border-light">
            <button type="button" className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300" onClick={onClose}>Cancel</button>
            <button type="submit" className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-45 inline-flex items-center gap-1.5" disabled={submitting}>{submitting ? 'Saving...' : 'Complete Triage'}</button>
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
    targetType: 'Control',
    owner: '',
    criticality: 'Medium',
    title: '',
    description: '',
    status: 'Open',
    healthStatus: 'RED',
    controlClassification: 'Informal',
    nistFamilies: [],
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
              <input className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Person responsible" list="edit-owners" />
              <datalist id="edit-owners">{knownOwners.map((o) => <option key={o} value={o} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Criticality</label>
              <div className="flex gap-1.5">
                {CRITICALITY_LEVELS.map((c) => (
                  <button key={c} type="button" className={`flex-1 py-2 border rounded-[10px] text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${form.criticality === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border hover:border-gray-300'}`} onClick={() => set('criticality', c)}>{c}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Status & Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Status</label>
              <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {GAP_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Health Status</label>
              <div className="flex gap-1.5">
                {GAP_HEALTH_STATUSES.map((h) => (
                  <button key={h.id} type="button" className={`flex-1 py-2 border border-border rounded-[10px] bg-white text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-150 text-txt-2 hover:border-gray-300 ${form.healthStatus === h.id ? 'font-bold' : ''}`} style={form.healthStatus === h.id ? { backgroundColor: h.bg, color: h.color, borderColor: h.color } : {}} onClick={() => set('healthStatus', h.id)}>{h.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Title *</label>
            <input ref={titleRef} className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.78rem] font-semibold text-txt-2 tracking-tight">Description</label>
            <textarea className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3 resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Description" />
          </div>

          {/* Control Classification — only for Controls */}
          {form.targetType === 'Control' && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 pt-3 pb-1.5 border-b border-border-light mt-1">Control Classification</div>
              <div className="flex">
                {['Informal', 'Formal'].map((c, i) => (
                  <button key={c} type="button" className={`flex-1 px-4 py-2 border text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 ${i === 0 ? 'rounded-l-[10px]' : 'rounded-r-[10px] border-l-0'} ${form.controlClassification === c ? 'bg-brand text-white border-brand' : 'bg-white text-txt-2 border-border'}`} onClick={() => set('controlClassification', c)}>{c}</button>
                ))}
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
  const [filterHealth, setFilterHealth] = useState('')
  const [filterFamily, setFilterFamily] = useState('')
  const [expandedId, setExpandedId] = useState(null)
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
    const owners = new Set()
    objects.forEach((o) => { if (o.owner?.trim()) owners.add(o.owner.trim()) })
    gaps.forEach((g) => {
      if (g.identifier?.trim()) owners.add(g.identifier.trim())
      if (g.owner?.trim()) owners.add(g.owner.trim())
    })
    return [...owners].sort()
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
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    if (filterStatus) list = list.filter((g) => g.status === filterStatus)
    if (filterHealth) list = list.filter((g) => (g.healthStatus || 'RED') === filterHealth)
    return list
  }, [gaps, filterStatus, filterHealth])

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
    setShowLogForm(false)
    setActiveTab('triage')
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

  const handleHealthChange = (gap, newHealth) => { dispatch({ type: 'UPDATE_GAP', payload: { id: gap.id, healthStatus: newHealth } }) }

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
        identifyingPerson: gap.identifier || '',
        criticality: gap.criticality || 'Medium',
        healthStatus: 'GREEN',
        controlClassification: gap.controlClassification || 'Informal',
        nistFamilies: gap.nistFamilies || [],
        kpiNumerator: gap.kpiNumerator || 0,
        kpiDenominator: gap.kpiDenominator || 0,
        jiraL1: gap.jiraL1 || '',
        jiraL2: gap.jiraL2 || '',
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

  // Path to green stats — only triaged active items
  const triagedActive = gaps.filter((g) => g.triaged && g.status !== 'Closed')
  const total = triagedActive.length
  const greenCount = triagedActive.filter((g) => (g.healthStatus || 'RED') === 'GREEN').length
  const pctGreen = total ? Math.round((greenCount / total) * 100) : 0

  const tabs = [
    { id: 'triage', label: 'Triage Queue', count: untriagedGaps.length },
    { id: 'active', label: 'Active Pipeline', count: activeItems.length },
    { id: 'closed', label: 'Closed', count: closedItems.length },
  ]

  // ── Render a gap card (used in Active Pipeline and Closed tabs) ──
  const renderGapCard = (gap) => {
    const gs = GAP_STATUSES.find((s) => s.id === gap.status) || GAP_STATUSES[0]
    const hs = GAP_HEALTH_STATUSES.find((h) => h.id === (gap.healthStatus || 'RED')) || GAP_HEALTH_STATUSES[0]
    const expanded = expandedId === gap.id
    const isGreen = (gap.healthStatus || 'RED') === 'GREEN'
    const isPromotable = isGreen && gap.status !== 'Closed'
    const daysOpen = getDaysOpen(gap)
    const expiryInfo = getExpiryInfo(gap)
    return (
      <div key={gap.id} className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px ${isPromotable ? 'border-l-[3px] border-l-green' : ''}`}>
        <div className="flex justify-between items-center px-4 py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : gap.id)} role="button" tabIndex={0} aria-expanded={expanded} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : gap.id) } }}>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap shrink-0" style={{ backgroundColor: gs.bg, color: gs.color }}>{gs.id}</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[0.72rem] font-bold tracking-tight mr-2" style={{ backgroundColor: hs.bg, color: hs.color }}>{hs.label}</span>
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

        {isPromotable && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 mx-3.5 bg-green-bg border border-green/15 rounded-[10px] text-[0.78rem] text-[#15803d]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>This item is at <strong>GREEN</strong> health — ready to promote to Object Inventory.</span>
            <button className="ml-auto whitespace-nowrap bg-white border border-green/25 text-green rounded-md px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-green-bg hover:border-green/40" onClick={(e) => { e.stopPropagation(); handlePromote(gap) }}>Promote to Object</button>
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

            {/* Health Toggle */}
            {gap.status !== 'Closed' && (
              <div className="flex items-center gap-1.5 my-2.5 py-2 border-t border-border-light">
                <span className="text-[0.75rem] font-semibold text-txt-3 mr-1">Health:</span>
                {GAP_HEALTH_STATUSES.map((h) => (
                  <button key={h.id} className={`px-2 py-0.5 text-[0.7rem] border border-border rounded bg-white font-semibold cursor-pointer font-sans transition-all duration-150 text-txt-2 hover:border-gray-300 ${(gap.healthStatus || 'RED') === h.id ? 'font-bold' : ''}`} style={(gap.healthStatus || 'RED') === h.id ? { backgroundColor: h.bg, color: h.color, borderColor: h.color } : {}} onClick={() => handleHealthChange(gap, h.id)}>{h.label}</button>
                ))}
              </div>
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

      {/* Path to Green Banner — only triaged items */}
      {total > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 mb-6">
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[0.88rem] font-bold tracking-tight text-txt">Path to Green</h3>
            <span className="text-[0.85rem] font-[750] text-green">{pctGreen}% at green health</span>
          </div>
          <div className="h-3 bg-subtle rounded-md overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-[#16a34a] via-[#22c55e] to-[#4ade80] rounded-md shadow-[0_2px_8px_rgba(22,163,74,0.2)] transition-all duration-600" style={{ width: `${pctGreen}%` }} />
          </div>
          <div className="flex gap-5 flex-wrap">
            {GAP_HEALTH_STATUSES.map((h) => {
              const count = triagedActive.filter((g) => (g.healthStatus || 'RED') === h.id).length
              return (
                <span key={h.id} className="flex items-center gap-1.5 text-[0.78rem] text-txt-2">
                  <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                  {h.label}: <strong>{count}</strong>
                </span>
              )
            })}
            <span className="flex items-center gap-1.5 text-[0.78rem] text-txt-2 ml-2 border-l border-border-light pl-2">
              {GAP_STATUSES.map((s) => {
                const count = gaps.filter((g) => g.triaged && g.status === s.id).length
                return <span key={s.id} className="mr-3 inline-flex items-center gap-1.5"><span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.id}: <strong>{count}</strong></span>
              })}
            </span>
          </div>
        </div>
      )}

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
      {activeTab === 'active' && (
        <>
          <div className="flex gap-2 mb-4">
            <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {GAP_STATUSES.filter((s) => s.id !== 'Closed').map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
            <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterHealth} onChange={(e) => setFilterHealth(e.target.value)}>
              <option value="">All Health</option>
              {GAP_HEALTH_STATUSES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
          </div>

          {activeItems.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3">
              <p>No active pipeline items{filterStatus || filterHealth ? ' matching filters' : ''}.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">{activeItems.map(renderGapCard)}</div>
          )}
        </>
      )}

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
      {showLogForm && <LogForm onSave={handleLogSave} onClose={() => setShowLogForm(false)} knownOwners={knownOwners} />}
      {triageGap && <TriageForm gap={triageGap} onSave={handleTriageSave} onClose={() => setTriageGap(null)} knownOwners={knownOwners} />}
      {editGap && <EditForm gap={editGap} onSave={handleEditSave} onClose={() => setEditGap(null)} knownOwners={knownOwners} />}

      <ConfirmDialog open={confirmDialog.open} title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} variant={confirmDialog.variant} promptMode={confirmDialog.promptMode} promptPlaceholder={confirmDialog.promptPlaceholder} onConfirm={confirmDialog.onConfirm || (() => {})} onCancel={closeConfirmDialog} />
    </div>
  )
}
