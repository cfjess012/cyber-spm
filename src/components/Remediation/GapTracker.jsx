import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { GAP_STATUSES, GAP_HEALTH_STATUSES, HEALTH_STATUSES, NIST_FAMILIES } from '../../data/constants.js'
import { formatDate, calcCompliance } from '../../utils/compliance.js'
import { getRemediation, prioritizeGaps } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiInlineResult, AiError } from '../AiPanel.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'

function GapForm({ objects, gap, onSave, onClose }) {
  const [form, setForm] = useState({
    objectIds: [],
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
    // Migrate legacy single objectId
    ...(gap ? {
      ...gap,
      objectIds: gap.objectIds || (gap.objectId ? [gap.objectId] : []),
    } : {}),
  })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleObjectId = (id) => {
    setForm((f) => {
      const ids = f.objectIds || []
      return {
        ...f,
        objectIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      }
    })
  }

  const toggleNist = (fId) => {
    setForm((f) => {
      const arr = f.nistFamilies || []
      return {
        ...f,
        nistFamilies: arr.includes(fId) ? arr.filter((x) => x !== fId) : [...arr, fId],
      }
    })
  }

  const computedCompliance = form.kpiDenominator
    ? Math.round((form.kpiNumerator / form.kpiDenominator) * 1000) / 10
    : 0

  const [formError, setFormError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (submitting) return
    if (form.objectIds.length === 0) {
      setFormError('Select at least one linked object')
      return
    }
    if (!form.title.trim()) {
      setFormError('Title is required')
      return
    }
    setFormError('')
    setSubmitting(true)
    onSave(form)
  }

  const [useAutoDenom, setUseAutoDenom] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    if (titleRef.current) titleRef.current.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const autoDenom = form.objectIds.length

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={gap ? 'Edit Gap' : 'Log New Gap'}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{gap ? 'Edit Gap' : 'Log New Gap'}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <p className="form-helper">A gap is a deficiency, risk exception, or control shortfall linked to one or more objects in your inventory.</p>
          {/* Linked Objects (multi-select) */}
          <div className="fg">
            <label>Linked Objects * <span className="label-hint">(select one or more)</span></label>
            <div className="chip-select compact">
              {objects.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`chip ${(form.objectIds || []).includes(o.id) ? 'selected' : ''}`}
                  onClick={() => toggleObjectId(o.id)}
                >
                  {o.listName || 'Untitled'}
                </button>
              ))}
            </div>
            {objects.length === 0 && (
              <span className="field-error">No objects in inventory. Add objects first.</span>
            )}
            {formError && form.objectIds.length === 0 && objects.length > 0 && (
              <span className="field-error">{formError}</span>
            )}
          </div>

          <div className="form-grid-2">
            <div className="fg">
              <label>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {GAP_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Health Status</label>
              <div className="health-select">
                {GAP_HEALTH_STATUSES.map((h) => (
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
          </div>

          <div className="fg">
            <label>Title *</label>
            <input ref={titleRef} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g., Missing MFA on service accounts, Incomplete DLP coverage" required />
          </div>
          <div className="fg">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What is the deficiency? What is the risk if unresolved? What triggers this gap?" />
          </div>

          {/* Control Classification */}
          <div className="form-section-label">Control Classification</div>
          <div className="fg">
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
          {form.controlClassification === 'Formal' && (
            <div className="fg">
              <label>NIST 800-53 Families</label>
              <div className="chip-select compact">
                {NIST_FAMILIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chip ${(form.nistFamilies || []).includes(f.id) ? 'selected' : ''}`}
                    onClick={() => toggleNist(f.id)}
                    title={f.name}
                  >
                    {f.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* KPI */}
          <div className="form-section-label">KPI Tracking</div>
          <p className="form-helper">Track remediation progress. Numerator = resolved instances; Denominator = total affected.</p>
          <div className="form-grid-3">
            <div className="fg">
              <label>Numerator</label>
              <input type="number" min="0" value={form.kpiNumerator} onChange={(e) => set('kpiNumerator', Math.max(0, Number(e.target.value)))} />
              {form.kpiDenominator > 0 && form.kpiNumerator > form.kpiDenominator && (
                <span className="field-error">Numerator cannot exceed denominator</span>
              )}
            </div>
            <div className="fg">
              <label>
                Denominator
                <label className="auto-denom-toggle">
                  <input
                    type="checkbox"
                    checked={useAutoDenom}
                    onChange={(e) => {
                      setUseAutoDenom(e.target.checked)
                      if (e.target.checked) set('kpiDenominator', autoDenom)
                    }}
                  />
                  <span className="label-hint">Auto from object count ({autoDenom})</span>
                </label>
              </label>
              <input
                type="number"
                min="0"
                value={useAutoDenom ? autoDenom : form.kpiDenominator}
                onChange={(e) => set('kpiDenominator', Math.max(0, Number(e.target.value)))}
                disabled={useAutoDenom}
              />
            </div>
            <div className="fg">
              <label>Compliance %</label>
              <div className="computed-value">{useAutoDenom ? (autoDenom ? Math.round((form.kpiNumerator / autoDenom) * 1000) / 10 : 0) : computedCompliance}%</div>
            </div>
          </div>

          <div className="fg">
            <label>Remediation Note</label>
            <textarea value={form.remediationNote} onChange={(e) => set('remediationNote', e.target.value)} rows={2} placeholder="Steps taken or planned..." />
          </div>

          {/* Exception / Expiry */}
          <div className="form-section-label">Exception Management</div>
          <p className="form-helper">For risk exceptions or accepted gaps: set an expiry date for re-evaluation. Expired exceptions surface as alerts.</p>
          <div className="form-grid-2">
            <div className="fg">
              <label>Exception Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
              <span className="field-hint">When must this gap be re-evaluated?</span>
            </div>
          </div>

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
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : (gap ? 'Update Gap' : 'Log Gap')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GapTracker({ onNavigate }) {
  const { gaps, objects } = useStore()
  const dispatch = useDispatch()
  const [showForm, setShowForm] = useState(false)
  const [editGap, setEditGap] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterHealth, setFilterHealth] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [aiPanel, setAiPanel] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiTitle, setAiTitle] = useState('')
  const [remediationResults, setRemediationResults] = useState({})
  const [remLoading, setRemLoading] = useState({})

  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'default', promptMode: false, promptPlaceholder: '', confirmLabel: 'Confirm' })

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog((d) => ({ ...d, open: false }))
  }, [])

  const handlePrioritize = async () => {
    setAiPanel(true)
    setAiLoading(true)
    setAiError(null)
    setAiTitle('Gap Prioritization')
    try {
      const res = await prioritizeGaps(gaps, objects)
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleRemediation = async (gap) => {
    setRemLoading((prev) => ({ ...prev, [gap.id]: true }))
    try {
      const ids = gap.objectIds || (gap.objectId ? [gap.objectId] : [])
      const linkedObjs = ids.map((id) => objects.find((o) => o.id === id)).filter(Boolean)
      const res = await getRemediation(gap, linkedObjs)
      setRemediationResults((prev) => ({ ...prev, [gap.id]: res.content }))
    } catch (err) {
      setRemediationResults((prev) => ({ ...prev, [gap.id]: `Error: ${err.message}` }))
    } finally {
      setRemLoading((prev) => ({ ...prev, [gap.id]: false }))
    }
  }

  const filtered = useMemo(() => {
    let list = [...gaps].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    if (filterStatus) list = list.filter((g) => g.status === filterStatus)
    if (filterHealth) list = list.filter((g) => (g.healthStatus || 'RED') === filterHealth)
    return list
  }, [gaps, filterStatus, filterHealth])

  const handleSave = (data) => {
    if (editGap) {
      dispatch({ type: 'UPDATE_GAP', payload: { id: editGap.id, ...data } })
    } else {
      dispatch({ type: 'ADD_GAP', payload: data })
    }
    setShowForm(false)
    setEditGap(null)
  }

  const handleStatusChange = (gap, newStatus) => {
    setConfirmDialog({
      open: true,
      title: newStatus === 'Closed' ? 'Close Gap' : 'Update Status',
      message: newStatus === 'Closed' ? `Close "${gap.title}"? Enter a closing note.` : `Update "${gap.title}" to ${newStatus}. Enter a note.`,
      promptMode: true,
      promptPlaceholder: newStatus === 'Closed' ? 'Enter closing note...' : 'Enter status update note...',
      confirmLabel: newStatus === 'Closed' ? 'Close Gap' : 'Update',
      variant: 'default',
      onConfirm: (note) => {
        dispatch({
          type: 'UPDATE_GAP',
          payload: { id: gap.id, status: newStatus, remediationNote: note || gap.remediationNote },
        })
        setConfirmDialog((d) => ({ ...d, open: false }))
      },
    })
  }

  const handleHealthChange = (gap, newHealth) => {
    dispatch({
      type: 'UPDATE_GAP',
      payload: { id: gap.id, healthStatus: newHealth },
    })
  }

  const handlePromote = (gap) => {
    setConfirmDialog({
      open: true,
      title: 'Promote to Object',
      message: `Promote "${gap.title}" to Object Inventory? This will close the gap and create a new object.`,
      promptMode: false,
      confirmLabel: 'Promote',
      variant: 'default',
      onConfirm: () => {
        dispatch({ type: 'PROMOTE_GAP', payload: gap.id })
        setConfirmDialog((d) => ({ ...d, open: false }))
      },
    })
  }

  const getObjNames = (gap) => {
    const ids = gap.objectIds || (gap.objectId ? [gap.objectId] : [])
    if (ids.length === 0) return 'No linked objects'
    return ids.map((id) => objects.find((o) => o.id === id)?.listName || 'Unknown').join(', ')
  }

  const getDaysOpen = (gap) => {
    if (gap.status === 'Closed') return null
    const created = new Date(gap.createdAt)
    const now = new Date()
    return Math.floor((now - created) / (1000 * 60 * 60 * 24))
  }

  const getExpiryInfo = (gap) => {
    if (!gap.expiryDate) return null
    const expiry = new Date(gap.expiryDate)
    const now = new Date()
    const daysUntil = Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return { status: 'expired', days: Math.abs(daysUntil), label: `Expired ${Math.abs(daysUntil)}d ago` }
    if (daysUntil <= 14) return { status: 'expiring', days: daysUntil, label: `Expires in ${daysUntil}d` }
    return { status: 'ok', days: daysUntil, label: `Expires ${gap.expiryDate}` }
  }

  // Path to green stats — exclude Closed gaps
  const activeGaps = gaps.filter((g) => g.status !== 'Closed')
  const total = activeGaps.length
  const greenCount = activeGaps.filter((g) => (g.healthStatus || 'RED') === 'GREEN').length
  const pctGreen = total ? Math.round((greenCount / total) * 100) : 0

  return (
    <div className="gap-tracker">
      <div className="page-header">
        <div>
          <h1>OneList</h1>
          <p className="page-subtitle">Gap tracker — deficiencies tied to your object inventory</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <AiButton onClick={handlePrioritize} loading={aiPanel && aiLoading}>Prioritize Gaps</AiButton>
          <button className="btn-primary" onClick={() => { setEditGap(null); setShowForm(true) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Log Gap
          </button>
        </div>
      </div>

      <AiSlidePanel
        open={aiPanel}
        onClose={() => setAiPanel(false)}
        title={aiTitle}
        loading={aiLoading}
        content={aiContent}
      >
        {aiError && <AiError error={aiError} onRetry={handlePrioritize} />}
      </AiSlidePanel>

      {/* Path to Green Banner */}
      {total > 0 && (
        <div className="path-to-green">
          <div className="ptg-header">
            <h3>Path to Green</h3>
            <span className="ptg-pct">{pctGreen}% at green health</span>
          </div>
          <div className="ptg-bar-track">
            <div className="ptg-bar-fill" style={{ width: `${pctGreen}%` }} />
          </div>
          <div className="ptg-stats">
            {GAP_HEALTH_STATUSES.map((h) => {
              const count = activeGaps.filter((g) => (g.healthStatus || 'RED') === h.id).length
              return (
                <span key={h.id} className="ptg-stat">
                  <span className="ptg-dot" style={{ backgroundColor: h.color }} />
                  {h.label}: <strong>{count}</strong>
                </span>
              )
            })}
            <span className="ptg-stat" style={{marginLeft:'0.5rem',borderLeft:'1px solid #e2e8f0',paddingLeft:'0.5rem'}}>
              {GAP_STATUSES.map((s) => {
                const count = gaps.filter((g) => g.status === s.id).length
                return <span key={s.id} style={{marginRight:'0.75rem'}}><span className="ptg-dot" style={{ backgroundColor: s.color }} />{s.id}: <strong>{count}</strong></span>
              })}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="table-toolbar">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {GAP_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
        </select>
        <select value={filterHealth} onChange={(e) => setFilterHealth(e.target.value)}>
          <option value="">All Health</option>
          {GAP_HEALTH_STATUSES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
        </select>
      </div>

      {/* Gap List */}
      {filtered.length === 0 ? (
        <div className="empty-state card">
          <p>No gaps recorded{filterStatus || filterHealth ? ' matching filters' : ''}. Click "Log Gap" to track your first deficiency.</p>
        </div>
      ) : (
        <div className="gap-list">
          {filtered.map((gap) => {
            const gs = GAP_STATUSES.find((s) => s.id === gap.status) || GAP_STATUSES[0]
            const hs = GAP_HEALTH_STATUSES.find((h) => h.id === (gap.healthStatus || 'RED')) || GAP_HEALTH_STATUSES[0]
            const expanded = expandedId === gap.id
            const isGreen = (gap.healthStatus || 'RED') === 'GREEN'
            const isPromotable = isGreen && gap.status !== 'Closed'
            const daysOpen = getDaysOpen(gap)
            const expiryInfo = getExpiryInfo(gap)
            return (
              <div key={gap.id} className={`gap-card ${expanded ? 'expanded' : ''} ${isPromotable ? 'promotable' : ''}`}>
                <div className="gap-card-header" onClick={() => setExpandedId(expanded ? null : gap.id)} role="button" tabIndex={0} aria-expanded={expanded} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : gap.id) } }}>
                  <div className="gap-card-left">
                    <span className="gap-status-tag" style={{ backgroundColor: gs.bg, color: gs.color }}>
                      {gs.id}
                    </span>
                    <span className="health-tag" style={{ backgroundColor: hs.bg, color: hs.color, marginRight: '0.5rem' }}>
                      {hs.label}
                    </span>
                    <div>
                      <div className="gap-card-title">{gap.title}</div>
                      <div className="gap-card-meta">
                        {getObjNames(gap)} &middot; {formatDate(gap.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="gap-card-right">
                    {daysOpen !== null && daysOpen > 0 && (
                      <span className={`gap-age-badge ${daysOpen > 90 ? 'critical' : daysOpen > 30 ? 'warn' : ''}`}>
                        {daysOpen}d open
                      </span>
                    )}
                    {expiryInfo && expiryInfo.status !== 'ok' && (
                      <span className={`gap-expiry-badge ${expiryInfo.status}`}>
                        {expiryInfo.label}
                      </span>
                    )}
                    {(gap.compliancePercent > 0 || gap.kpiDenominator > 0) && (
                      <span className="gap-compliance-badge">{gap.compliancePercent}%</span>
                    )}
                    {gap.jiraL1 && <span className="jira-tag">{gap.jiraL1}</span>}
                    <span className={`expand-chevron ${expanded ? 'open' : ''}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>

                {/* Promotion Alert */}
                {isPromotable && (
                  <div className="promote-alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>This gap is at <strong>GREEN</strong> health — it can be promoted to the Object Inventory.</span>
                    <button className="btn-sm btn-green" onClick={(e) => { e.stopPropagation(); handlePromote(gap) }}>
                      Promote to Object
                    </button>
                  </div>
                )}

                {expanded && (
                  <div className="gap-card-body">
                    {gap.description && <p className="gap-description">{gap.description}</p>}

                    {/* Gap Details */}
                    <div className="gap-detail-grid">
                      {gap.controlClassification && (
                        <div className="gap-detail-item">
                          <span className="field-label">Control Type</span>
                          <span className={`field-value control-tag ${(gap.controlClassification || 'informal').toLowerCase()}`}>
                            {gap.controlClassification}
                          </span>
                        </div>
                      )}
                      {gap.controlClassification === 'Formal' && gap.nistFamilies?.length > 0 && (
                        <div className="gap-detail-item">
                          <span className="field-label">NIST Families</span>
                          <div className="nist-chips">
                            {gap.nistFamilies.map((fId) => (
                              <span key={fId} className="nist-chip">{fId}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(gap.kpiNumerator > 0 || gap.kpiDenominator > 0) && (
                        <div className="gap-detail-item">
                          <span className="field-label">KPI</span>
                          <span className="field-value">{gap.kpiNumerator} / {gap.kpiDenominator} = {gap.compliancePercent || 0}%</span>
                        </div>
                      )}
                      {gap.expiryDate && (
                        <div className="gap-detail-item">
                          <span className="field-label">Exception Expiry</span>
                          <span className={`field-value ${expiryInfo?.status === 'expired' ? 'text-red' : expiryInfo?.status === 'expiring' ? 'text-amber' : ''}`}>
                            {gap.expiryDate}{expiryInfo && expiryInfo.status !== 'ok' ? ` (${expiryInfo.label})` : ''}
                          </span>
                        </div>
                      )}
                      {gap.jiraL2 && (
                        <div className="gap-detail-item">
                          <span className="field-label">Jira L2</span>
                          <span className="jira-tag">{gap.jiraL2}</span>
                        </div>
                      )}
                    </div>

                    {gap.remediationNote && (
                      <div className="remediation-note">
                        <strong>Remediation:</strong> {gap.remediationNote}
                      </div>
                    )}

                    {/* Health Toggle */}
                    <div className="gap-health-toggle">
                      <span className="field-label">Health:</span>
                      {GAP_HEALTH_STATUSES.map((h) => (
                        <button
                          key={h.id}
                          className={`health-btn small ${(gap.healthStatus || 'RED') === h.id ? 'active' : ''}`}
                          style={(gap.healthStatus || 'RED') === h.id ? { backgroundColor: h.bg, color: h.color, borderColor: h.color } : {}}
                          onClick={() => handleHealthChange(gap, h.id)}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>

                    {/* Audit Trail */}
                    {gap.history?.length > 0 && (
                      <div className="audit-trail">
                        <h4>Audit Trail</h4>
                        <div className="timeline">
                          {gap.history.map((entry, i) => (
                            <div key={i} className="timeline-item">
                              <div className="timeline-dot" />
                              <div className="timeline-content">
                                <span className="timeline-status">{entry.status}</span>
                                <span className="timeline-note">{entry.note}</span>
                                <span className="timeline-time">{formatDate(entry.timestamp)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="gap-card-actions">
                      <AiButton
                        onClick={() => handleRemediation(gap)}
                        loading={remLoading[gap.id]}
                        variant="small"
                      >
                        Remediation Plan
                      </AiButton>
                      {gap.status !== 'Closed' && (
                        <>
                          {gap.status === 'Open' && (
                            <button className="btn-sm" onClick={() => handleStatusChange(gap, 'In Progress')}>
                              Mark In Progress
                            </button>
                          )}
                          <button className="btn-sm btn-green" onClick={() => handleStatusChange(gap, 'Closed')}>
                            Close Gap
                          </button>
                        </>
                      )}
                      <button
                        className="btn-sm"
                        onClick={() => { setEditGap(gap); setShowForm(true) }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-sm btn-danger"
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: 'Delete Gap',
                          message: `Delete "${gap.title}"? This cannot be undone.`,
                          promptMode: false,
                          confirmLabel: 'Delete',
                          variant: 'danger',
                          onConfirm: () => {
                            dispatch({ type: 'DELETE_GAP', payload: gap.id })
                            setConfirmDialog((d) => ({ ...d, open: false }))
                          },
                        })}
                      >
                        Delete
                      </button>
                    </div>
                    {remediationResults[gap.id] && (
                      <AiInlineResult
                        content={remediationResults[gap.id]}
                        onClose={() => setRemediationResults((prev) => { const n = {...prev}; delete n[gap.id]; return n })}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <GapForm
          objects={objects}
          gap={editGap}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditGap(null) }}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        promptMode={confirmDialog.promptMode}
        promptPlaceholder={confirmDialog.promptPlaceholder}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={closeConfirmDialog}
      />
    </div>
  )
}
