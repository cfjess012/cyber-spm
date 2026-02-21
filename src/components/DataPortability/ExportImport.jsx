import React, { useState, useRef } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { exportToExcel, exportToJSON, importFromExcel, importFromJSON } from '../../utils/export.js'

export default function ExportImport() {
  const state = useStore()
  const dispatch = useDispatch()
  const fileRef = useRef()
  const [message, setMessage] = useState(null)
  const [importing, setImporting] = useState(false)

  const handleExcelExport = () => {
    exportToExcel(state.objects)
    setMessage({ type: 'success', text: `Exported ${state.objects.length} objects to Excel.` })
  }

  const handleJSONExport = () => {
    exportToJSON(state)
    setMessage({ type: 'success', text: 'Full state backup exported as JSON.' })
  }

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)

    try {
      if (file.name.endsWith('.json')) {
        const data = await importFromJSON(file)
        if (data.objects) {
          dispatch({ type: 'RESTORE_STATE', payload: data })
          setMessage({ type: 'success', text: `Restored full state from JSON: ${data.objects.length} objects, ${data.gaps?.length || 0} pipeline items, ${data.standupItems?.length || 0} standup items.` })
        } else {
          setMessage({ type: 'error', text: 'Invalid JSON structure. Expected { objects, gaps, standupItems, mlgAssessments }.' })
        }
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const objects = await importFromExcel(file)
        dispatch({ type: 'IMPORT_OBJECTS', payload: objects })
        setMessage({ type: 'success', text: `Imported/updated ${objects.length} objects from Excel. Existing objects matched by List Name were updated.` })
      } else {
        setMessage({ type: 'error', text: 'Unsupported file type. Use .xlsx, .xls, or .json.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Import failed: ${err.message}` })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const CARDS = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      ),
      color: 'brand',
      title: 'Export to Excel',
      desc: 'Download the entire Object Inventory as an .xlsx file for offline review, sharing, or audit purposes.',
      meta: [`${state.objects.length} objects`],
      btnText: 'Export .xlsx',
      onClick: handleExcelExport,
      disabled: state.objects.length === 0,
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      ),
      color: 'ai',
      title: 'Full JSON Backup',
      desc: 'Export the complete platform state — objects, gaps, standup items, and MLG assessments — as a portable JSON file.',
      meta: [`${state.objects.length} objects`, `${state.gaps.length} pipeline items`, `${state.standupItems.length} actions`],
      btnText: 'Export .json',
      onClick: handleJSONExport,
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
      color: 'green',
      title: 'Import Data',
      desc: 'Upload an .xlsx to import/update inventory objects (matched by List Name via fuzzy-header matching), or a .json backup to restore the full platform state.',
      isImport: true,
    },
  ]

  const iconBg = { brand: 'bg-brand-bg text-brand', ai: 'bg-ai-bg text-ai', green: 'bg-green-bg text-green' }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">Data Portability</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Export, backup, and import your CPM data</p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[0.85rem] font-medium mb-5 animate-[slideUp_0.3s_ease-out] ${
          message.type === 'success'
            ? 'bg-green-bg text-green border border-green/10'
            : 'bg-red-bg text-red border border-red/10'
        }`}>
          {message.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {message.text}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {CARDS.map((card, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-6 flex flex-col gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg[card.color]}`}>
              {card.icon}
            </div>
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">{card.title}</h3>
            <p className="text-[0.82rem] text-txt-2 leading-relaxed flex-1">{card.desc}</p>
            {card.meta && (
              <div className="flex flex-wrap gap-2">
                {card.meta.map((m, j) => (
                  <span key={j} className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            )}
            {card.isImport ? (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.json" onChange={handleFileImport} className="hidden" />
                <button
                  className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:from-brand-hover hover:to-[#1e3a8a] hover:shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center gap-1.5"
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? 'Importing...' : 'Choose File'}
                </button>
              </>
            ) : (
              <button
                className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:from-brand-hover hover:to-[#1e3a8a] hover:shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center gap-1.5"
                onClick={card.onClick}
                disabled={card.disabled}
              >
                {card.btnText}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Current State Summary */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-6 mt-4">
        <h3 className="text-[0.95rem] font-bold tracking-tight text-txt mb-4">Current State Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { value: state.objects.length, label: 'Objects' },
            { value: state.gaps.length, label: 'Pipeline Items' },
            { value: state.standupItems.length, label: 'Standup Items' },
            { value: Object.keys(state.mlgAssessments).length, label: 'MLG Assessments' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <span className="block text-2xl font-[800] text-brand tracking-tight">{s.value}</span>
              <span className="block text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wider mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[0.78rem] text-txt-3 leading-relaxed">
          Data is persisted in your browser's local storage. Use JSON export for cross-device portability.
        </p>
      </div>
    </div>
  )
}
