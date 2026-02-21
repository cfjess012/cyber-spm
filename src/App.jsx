import React, { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import OneListView from './components/OneList/OneListView.jsx'
import ObjectDetail from './components/OneList/ObjectDetail.jsx'
import GapTracker from './components/Remediation/GapTracker.jsx'
import MLGDiagnostic from './components/MLG/MLGDiagnostic.jsx'
import StandupView from './components/Standup/StandupView.jsx'
import ExportImport from './components/DataPortability/ExportImport.jsx'
import CISAssessment from './components/Frameworks/CISAssessment.jsx'
import NISTCSFAssessment from './components/Frameworks/NISTCSFAssessment.jsx'
import RegulatoryQueue from './components/Regulatory/RegulatoryQueue.jsx'
import Guide from './components/Guide.jsx'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigate = useCallback((p, objectId) => {
    setPage(p)
    setSelectedObjectId(objectId || null)
    setMobileMenuOpen(false)
  }, [])

  let content
  switch (page) {
    case 'dashboard':
      content = <Dashboard onNavigate={navigate} />
      break
    case 'objects':
      content = <OneListView onNavigate={navigate} />
      break
    case 'object-detail':
      content = (
        <ObjectDetail
          objectId={selectedObjectId}
          onNavigate={navigate}
        />
      )
      break
    case 'onelist':
      content = <GapTracker onNavigate={navigate} />
      break
    case 'mlg':
      content = <MLGDiagnostic onNavigate={navigate} initialObjectId={selectedObjectId} />
      break
    case 'standup':
      content = <StandupView />
      break
    case 'cis-v8':
      content = <CISAssessment onNavigate={navigate} />
      break
    case 'nist-csf':
      content = <NISTCSFAssessment onNavigate={navigate} />
      break
    case 'regulatory':
      content = <RegulatoryQueue onNavigate={navigate} />
      break
    case 'data':
      content = <ExportImport />
      break
    case 'guide':
      content = <Guide onNavigate={navigate} />
      break
    default:
      content = <Dashboard onNavigate={navigate} />
  }

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          style={{ display: 'block' }}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        activePage={page}
        onNavigate={navigate}
        mobileOpen={mobileMenuOpen}
      />
      <main className="app-main" role="main">
        <div className="app-content">{content}</div>
      </main>
      {/* Mobile hamburger FAB */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setMobileMenuOpen((o) => !o)}
        aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        )}
      </button>
    </div>
  )
}
