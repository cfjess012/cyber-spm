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
  const [promotionData, setPromotionData] = useState(null)

  const navigate = useCallback((p, objectId, extra) => {
    setPage(p)
    setSelectedObjectId(objectId || null)
    if (extra?.promotionData) setPromotionData(extra.promotionData)
    else setPromotionData(null)
    setMobileMenuOpen(false)
  }, [])

  let content
  switch (page) {
    case 'dashboard':
      content = <Dashboard onNavigate={navigate} />
      break
    case 'objects':
      content = <OneListView onNavigate={navigate} promotionData={promotionData} onClearPromotion={() => setPromotionData(null)} />
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
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[900] block md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        activePage={page}
        onNavigate={navigate}
        mobileOpen={mobileMenuOpen}
      />
      <main className="flex-1 overflow-y-auto bg-page" role="main">
        <div className="max-w-[1180px] mx-auto px-6 py-8 md:px-10 lg:px-12">{content}</div>
      </main>
      {/* Mobile hamburger FAB */}
      <button
        className="fixed bottom-5 right-5 z-[950] w-12 h-12 rounded-full bg-gradient-to-br from-brand to-ai text-white shadow-lg flex items-center justify-center border-none cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 md:hidden"
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
