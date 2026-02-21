import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { STANDUP_PRODUCTS } from '../../data/constants.js'
import { formatDate } from '../../utils/compliance.js'
import { generateStandupActions, summarizeStandup } from '../../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from '../AiPanel.jsx'

export default function StandupView() {
  const { standupItems } = useStore()
  const dispatch = useDispatch()
  const [filterProduct, setFilterProduct] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // AI state
  const [aiPanel, setAiPanel] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiTitle, setAiTitle] = useState('')
  const [showNotesInput, setShowNotesInput] = useState(false)
  const [meetingNotes, setMeetingNotes] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(null)

  const handleSummarize = async () => {
    setAiPanel(true)
    setAiLoading(true)
    setAiError(null)
    setAiTitle('Standup Summary')
    try {
      const res = await summarizeStandup(standupItems)
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerateFromNotes = async () => {
    if (!meetingNotes.trim()) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const res = await generateStandupActions(meetingNotes, standupItems)
      setAiGenerated(res.data)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiGenerating(false)
    }
  }

  const applyGeneratedActions = () => {
    if (!aiGenerated?.actions) return
    for (const action of aiGenerated.actions) {
      const dueDate = action.suggestedDueDays
        ? new Date(Date.now() + action.suggestedDueDays * 86400000).toISOString().slice(0, 10)
        : ''
      dispatch({
        type: 'ADD_STANDUP',
        payload: {
          action: action.action,
          owner: action.owner || '',
          product: action.product || 'General',
          dueDate,
          status: 'Open',
        },
      })
    }
    setAiGenerated(null)
    setShowNotesInput(false)
    setMeetingNotes('')
  }

  // Inline form state
  const [form, setForm] = useState({
    action: '',
    owner: '',
    product: 'General',
    dueDate: '',
  })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.action.trim()) return
    dispatch({ type: 'ADD_STANDUP', payload: { ...form, status: 'Open' } })
    setForm({ action: '', owner: '', product: form.product, dueDate: '' })
  }

  const filtered = useMemo(() => {
    let list = [...standupItems].sort((a, b) => {
      // Open first, then by due date
      if (a.status === 'Closed' && b.status !== 'Closed') return 1
      if (a.status !== 'Closed' && b.status === 'Closed') return -1
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
      return 0
    })
    if (filterProduct) list = list.filter((s) => s.product === filterProduct)
    if (filterStatus) list = list.filter((s) => s.status === filterStatus)
    return list
  }, [standupItems, filterProduct, filterStatus])

  const overdue = standupItems.filter(
    (s) => s.status === 'Open' && s.dueDate && new Date(s.dueDate) < new Date()
  ).length

  const toggleStatus = (item) => {
    const next = item.status === 'Open' ? 'In Progress' : item.status === 'In Progress' ? 'Closed' : 'Open'
    dispatch({ type: 'UPDATE_STANDUP', payload: { id: item.id, status: next } })
  }

  return (
    <div className="standup-view">
      <div className="page-header">
        <div>
          <h1>PPA Standup</h1>
          <p className="page-subtitle">Rapid action capture for weekly collaborative sessions</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          {overdue > 0 && (
            <span className="overdue-badge">
              {overdue} overdue
            </span>
          )}
          <AiButton onClick={handleSummarize} loading={aiPanel && aiLoading}>Summarize</AiButton>
          <AiButton onClick={() => setShowNotesInput(true)} variant="default">From Notes</AiButton>
        </div>
      </div>

      <AiSlidePanel
        open={aiPanel}
        onClose={() => setAiPanel(false)}
        title={aiTitle}
        loading={aiLoading}
        content={aiContent}
      >
        {aiError && <AiError error={aiError} onRetry={handleSummarize} />}
      </AiSlidePanel>

      {/* AI Notes Extraction */}
      {showNotesInput && (
        <div className="ai-notes-section card">
          <div className="ai-notes-header">
            <span className="ai-sparkle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
            <strong>Extract Actions from Meeting Notes</strong>
            <button className="link-btn" onClick={() => { setShowNotesInput(false); setAiGenerated(null) }} style={{marginLeft:'auto'}}>Close</button>
          </div>
          <textarea
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            placeholder="Paste your meeting notes here... AI will extract action items with owners, products, and due dates."
            rows={5}
            className="ai-notes-textarea"
          />
          <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginTop:'0.5rem'}}>
            <AiButton onClick={handleGenerateFromNotes} loading={aiGenerating}>Extract Actions</AiButton>
          </div>
          {aiError && !aiPanel && <AiError error={aiError} onRetry={handleGenerateFromNotes} />}

          {aiGenerated && (
            <div className="ai-generated-actions">
              {aiGenerated.meetingSummary && (
                <p className="ai-meeting-summary">{aiGenerated.meetingSummary}</p>
              )}
              <div className="ai-actions-preview">
                {aiGenerated.actions?.map((a, i) => (
                  <div key={i} className="ai-action-preview-item">
                    <span className="ai-action-priority" data-priority={a.priority}>{a.priority}</span>
                    <div>
                      <div className="ai-action-text">{a.action}</div>
                      <div className="ai-action-meta">
                        {a.owner && <span>{a.owner}</span>}
                        <span className="standup-product-tag">{a.product}</span>
                        {a.suggestedDueDays && <span>{a.suggestedDueDays}d</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-primary small" onClick={applyGeneratedActions} style={{marginTop:'0.75rem'}}>
                Add {aiGenerated.actions?.length || 0} Actions to Standup
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Add Form */}
      <form className="standup-form card" onSubmit={handleAdd}>
        <div className="standup-form-row">
          <input
            className="standup-input action-input"
            value={form.action}
            onChange={(e) => set('action', e.target.value)}
            placeholder="Action item..."
            required
          />
          <input
            className="standup-input owner-input"
            value={form.owner}
            onChange={(e) => set('owner', e.target.value)}
            placeholder="Owner"
          />
          <select
            className="standup-input product-input"
            value={form.product}
            onChange={(e) => set('product', e.target.value)}
          >
            {STANDUP_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input
            className="standup-input date-input"
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
          <button type="submit" className="btn-primary standup-add-btn">
            Add
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="table-toolbar">
        <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {STANDUP_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty-state card">
          <p>No action items{filterProduct || filterStatus ? ' matching filters' : ''}. Use the form above to capture actions.</p>
        </div>
      ) : (
        <div className="standup-list">
          {filtered.map((item) => {
            const isOverdue = item.status === 'Open' && item.dueDate && new Date(item.dueDate) < new Date()
            return (
              <div key={item.id} className={`standup-item ${item.status === 'Closed' ? 'closed' : ''} ${isOverdue ? 'overdue' : ''}`}>
                <button
                  className={`standup-check ${item.status === 'Closed' ? 'checked' : item.status === 'In Progress' ? 'in-progress' : ''}`}
                  onClick={() => toggleStatus(item)}
                  title={`Status: ${item.status}. Click to advance.`}
                >
                  {item.status === 'Closed' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                  {item.status === 'In Progress' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                  )}
                </button>
                <div className="standup-item-content">
                  <div className="standup-item-action">{item.action}</div>
                  <div className="standup-item-meta">
                    {item.owner && <span className="standup-owner">{item.owner}</span>}
                    <span className="standup-product-tag">{item.product}</span>
                    {item.dueDate && (
                      <span className={`standup-due ${isOverdue ? 'overdue' : ''}`}>
                        Due {formatDate(item.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => dispatch({ type: 'DELETE_STANDUP', payload: item.id })}
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
