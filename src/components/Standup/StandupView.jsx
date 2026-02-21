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

  const priorityColors = { high: 'bg-red-bg text-red', medium: 'bg-amber-bg text-amber', low: 'bg-green-bg text-green' }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">PPA Standup</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Rapid action capture for weekly collaborative sessions</p>
        </div>
        <div className="flex gap-2 items-center">
          {overdue > 0 && (
            <span className="bg-red-bg text-red px-3 py-1.5 rounded-full text-[0.82rem] font-bold">
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
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-ai/10 p-5 mb-5 animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex text-ai-light">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
            <strong className="text-[0.88rem] text-txt">Extract Actions from Meeting Notes</strong>
            <button className="ml-auto bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline" onClick={() => { setShowNotesInput(false); setAiGenerated(null) }}>Close</button>
          </div>
          <textarea
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            placeholder="Paste your meeting notes here... AI will extract action items with owners, products, and due dates."
            rows={5}
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-[0.85rem] font-sans text-txt resize-y outline-none transition-all duration-150 focus:border-ai focus:ring-2 focus:ring-ai/15 placeholder:text-txt-3"
          />
          <div className="flex gap-2 items-center mt-3">
            <AiButton onClick={handleGenerateFromNotes} loading={aiGenerating}>Extract Actions</AiButton>
          </div>
          {aiError && !aiPanel && <AiError error={aiError} onRetry={handleGenerateFromNotes} />}

          {aiGenerated && (
            <div className="mt-4 border-t border-border-light pt-4">
              {aiGenerated.meetingSummary && (
                <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-3 italic">{aiGenerated.meetingSummary}</p>
              )}
              <div className="flex flex-col gap-2">
                {aiGenerated.actions?.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 bg-subtle/50 rounded-lg px-3 py-2.5">
                    <span className={`text-[0.65rem] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${priorityColors[a.priority] || 'bg-subtle text-txt-3'}`}>{a.priority}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.85rem] font-medium text-txt">{a.action}</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {a.owner && <span className="text-[0.72rem] text-txt-3">{a.owner}</span>}
                        <span className="text-[0.68rem] font-medium bg-brand-bg text-brand px-1.5 py-0.5 rounded">{a.product}</span>
                        {a.suggestedDueDays && <span className="text-[0.72rem] text-txt-3">{a.suggestedDueDays}d</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="mt-4 bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97] inline-flex items-center gap-1.5"
                onClick={applyGeneratedActions}
              >
                Add {aiGenerated.actions?.length || 0} Actions to Standup
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Add Form */}
      <form className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 mb-4" onSubmit={handleAdd}>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            className="flex-[3] min-w-[200px] bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3"
            value={form.action}
            onChange={(e) => set('action', e.target.value)}
            placeholder="Action item..."
            required
          />
          <input
            className="flex-1 min-w-[120px] bg-white border border-border rounded-[10px] px-3 py-2 text-[0.85rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3"
            value={form.owner}
            onChange={(e) => set('owner', e.target.value)}
            placeholder="Owner"
          />
          <select
            className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15"
            value={form.product}
            onChange={(e) => set('product', e.target.value)}
          >
            {STANDUP_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input
            className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15"
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
          <button type="submit" className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97]">
            Add
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {STANDUP_PRODUCTS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="bg-white border border-border rounded-[10px] px-3 py-2 text-[0.82rem] font-sans text-txt-2 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3 text-[0.88rem]">
          <p>No action items{filterProduct || filterStatus ? ' matching filters' : ''}. Use the form above to capture actions.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((item) => {
            const isOverdue = item.status === 'Open' && item.dueDate && new Date(item.dueDate) < new Date()
            const isClosed = item.status === 'Closed'
            return (
              <div key={item.id} className={`flex items-center gap-3 bg-white/80 backdrop-blur-xl rounded-xl border px-4 py-3 transition-all duration-200 hover:shadow-sm group ${
                isClosed ? 'border-white/50 opacity-60' : isOverdue ? 'border-red/20 bg-red-bg/30' : 'border-white/50'
              }`}>
                <button
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 ${
                    isClosed
                      ? 'bg-green border-green text-white'
                      : item.status === 'In Progress'
                        ? 'bg-amber/10 border-amber text-amber'
                        : 'bg-white border-border hover:border-brand'
                  }`}
                  onClick={() => toggleStatus(item)}
                  title={`Status: ${item.status}. Click to advance.`}
                >
                  {isClosed && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                  {item.status === 'In Progress' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[0.88rem] font-medium ${isClosed ? 'line-through text-txt-3' : 'text-txt'}`}>{item.action}</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {item.owner && <span className="text-[0.72rem] text-txt-3 font-medium">{item.owner}</span>}
                    <span className="text-[0.68rem] font-medium bg-brand-bg text-brand px-1.5 py-0.5 rounded">{item.product}</span>
                    {item.dueDate && (
                      <span className={`text-[0.72rem] font-medium ${isOverdue ? 'text-red font-bold' : 'text-txt-3'}`}>
                        Due {formatDate(item.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="bg-transparent border-none text-txt-3 cursor-pointer p-1 rounded-md transition-all duration-150 opacity-0 group-hover:opacity-100 hover:text-red hover:bg-red-bg"
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
