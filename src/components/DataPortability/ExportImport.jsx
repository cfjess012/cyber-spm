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
          setMessage({ type: 'success', text: `Restored full state from JSON: ${data.objects.length} objects, ${data.gaps?.length || 0} gaps, ${data.standupItems?.length || 0} standup items.` })
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

  return (
    <div className="export-import">
      <div className="page-header">
        <div>
          <h1>Data Portability</h1>
          <p className="page-subtitle">Export, backup, and import your CPM data</p>
        </div>
      </div>

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {message.text}
        </div>
      )}

      <div className="data-cards">
        {/* Export */}
        <div className="data-card">
          <div className="data-card-icon export">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <h3>Export to Excel</h3>
          <p>Download the entire Object Inventory as an .xlsx file for offline review, sharing, or audit purposes.</p>
          <div className="data-card-meta">
            <span>{state.objects.length} objects</span>
          </div>
          <button className="btn-primary" onClick={handleExcelExport} disabled={state.objects.length === 0}>
            Export .xlsx
          </button>
        </div>

        <div className="data-card">
          <div className="data-card-icon backup">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </div>
          <h3>Full JSON Backup</h3>
          <p>Export the complete platform state — objects, gaps, standup items, and MLG assessments — as a portable JSON file.</p>
          <div className="data-card-meta">
            <span>{state.objects.length} objects</span>
            <span>{state.gaps.length} gaps</span>
            <span>{state.standupItems.length} actions</span>
          </div>
          <button className="btn-primary" onClick={handleJSONExport}>
            Export .json
          </button>
        </div>

        {/* Import */}
        <div className="data-card">
          <div className="data-card-icon import">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <h3>Import Data</h3>
          <p>
            Upload an .xlsx to import/update OneList objects (matched by List Name via fuzzy-header matching),
            or a .json backup to restore the full platform state.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.json"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />
          <button
            className="btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Choose File'}
          </button>
        </div>
      </div>

      {/* Current State Summary */}
      <div className="state-summary card">
        <h3>Current State Summary</h3>
        <div className="state-stats">
          <div className="state-stat">
            <span className="state-stat-value">{state.objects.length}</span>
            <span className="state-stat-label">Objects</span>
          </div>
          <div className="state-stat">
            <span className="state-stat-value">{state.gaps.length}</span>
            <span className="state-stat-label">Gaps</span>
          </div>
          <div className="state-stat">
            <span className="state-stat-value">{state.standupItems.length}</span>
            <span className="state-stat-label">Standup Items</span>
          </div>
          <div className="state-stat">
            <span className="state-stat-value">{Object.keys(state.mlgAssessments).length}</span>
            <span className="state-stat-label">MLG Assessments</span>
          </div>
        </div>
        <p className="state-note">
          Data is persisted in your browser's local storage. Use JSON export for cross-device portability.
        </p>
      </div>
    </div>
  )
}
