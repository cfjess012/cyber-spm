import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { ATTESTATIONS, ATTESTATION_CATEGORIES } from '../../data/constants.js'
import { detectRegulatory } from '../../utils/ai.js'
import { AiButton, AiError } from '../AiPanel.jsx'

function getAttestation(id) {
  return ATTESTATIONS.find((a) => a.id === id) || { id, name: id, category: 'Unknown', desc: '' }
}

const CONFIDENCE_COLORS = {
  high: { color: '#dc2626', bg: '#fef2f2', label: 'High' },
  medium: { color: '#d97706', bg: '#fffbeb', label: 'Medium' },
  low: { color: '#6b7280', bg: '#f3f4f6', label: 'Low' },
}

export default function RegulatoryQueue({ onNavigate }) {
  const { objects, regulatoryQueue, attestations } = useStore()
  const dispatch = useDispatch()
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [filter, setFilter] = useState('pending') // pending | confirmed | dismissed | all

  // Stats
  const stats = useMemo(() => {
    const pending = regulatoryQueue.filter((q) => q.status === 'pending').length
    const confirmed = regulatoryQueue.filter((q) => q.status === 'confirmed').length
    const dismissed = regulatoryQueue.filter((q) => q.status === 'dismissed').length
    const objectsWithAttestations = Object.keys(attestations).filter((k) => (attestations[k] || []).length > 0).length
    return { pending, confirmed, dismissed, total: regulatoryQueue.length, objectsWithAttestations }
  }, [regulatoryQueue, attestations])

  // Filtered queue
  const filteredQueue = useMemo(() => {
    const list = filter === 'all'
      ? regulatoryQueue
      : regulatoryQueue.filter((q) => q.status === filter)
    return [...list].sort((a, b) => {
      // Pending first, then by date
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return new Date(b.detectedAt) - new Date(a.detectedAt)
    })
  }, [regulatoryQueue, filter])

  // Attestation coverage summary (confirmed attestations per object)
  const coverageSummary = useMemo(() => {
    const byAttestation = {}
    for (const [objId, attIds] of Object.entries(attestations)) {
      const obj = objects.find((o) => o.id === objId)
      if (!obj) continue
      for (const attId of attIds) {
        if (!byAttestation[attId]) byAttestation[attId] = []
        byAttestation[attId].push(obj.listName)
      }
    }
    return byAttestation
  }, [attestations, objects])

  // ── Scan all objects for regulatory implications ──
  const handleScanAll = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const payload = {
        objects: objects.map((o) => ({
          id: o.id,
          listName: o.listName,
          type: o.type,
          description: o.description,
          productFamilies: o.productFamilies,
          criticality: o.criticality,
          dataClassification: o.dataClassification,
          environment: o.environment,
          controlClassification: o.controlClassification,
          nistFamilies: o.nistFamilies,
        })),
      }
      const res = await detectRegulatory(payload)
      // Flatten detections into queue items, skipping duplicates
      const newDetections = []
      for (const objResult of res.detections || []) {
        const obj = objects.find((o) => o.id === objResult.objectId)
        if (!obj) continue
        const confirmed = attestations[obj.id] || []
        for (const att of objResult.attestations || []) {
          // Skip if already confirmed on this object
          if (confirmed.includes(att.id)) continue
          // Skip if already pending or dismissed in queue for this object+attestation
          const alreadyQueued = regulatoryQueue.some(
            (q) => q.objectId === obj.id && q.attestationId === att.id && (q.status === 'pending' || q.status === 'dismissed')
          )
          if (alreadyQueued) continue
          newDetections.push({
            objectId: obj.id,
            objectName: obj.listName,
            attestationId: att.id,
            confidence: att.confidence,
            rationale: att.rationale,
          })
        }
      }
      if (newDetections.length > 0) {
        dispatch({ type: 'ADD_REGULATORY_DETECTIONS', payload: newDetections })
      }
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  const handleResolve = (itemId, resolution) => {
    dispatch({ type: 'RESOLVE_REGULATORY_ITEM', payload: { id: itemId, resolution } })
  }

  const handleClearResolved = () => {
    dispatch({ type: 'CLEAR_RESOLVED_QUEUE' })
  }

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">Regulatory Intelligence</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">AI-detected attestation scope — human verification required</p>
        </div>
        <div className="flex gap-2">
          <AiButton onClick={handleScanAll} loading={scanning}>Scan All Objects</AiButton>
          {stats.confirmed + stats.dismissed > 0 && (
            <button className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300 hover:text-txt active:scale-[0.97]" onClick={handleClearResolved}>Clear Resolved</button>
          )}
        </div>
      </div>

      {scanError && (
        <div className="mb-4">
          <AiError error={scanError} onRetry={handleScanAll} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 flex flex-col items-center gap-1 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-[1.5rem] font-[750] tracking-tight text-amber">{stats.pending}</span>
          <span className="text-[0.72rem] text-txt-2 uppercase tracking-[0.03em] font-medium">Pending Review</span>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 flex flex-col items-center gap-1 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-[1.5rem] font-[750] tracking-tight text-green">{stats.confirmed}</span>
          <span className="text-[0.72rem] text-txt-2 uppercase tracking-[0.03em] font-medium">Confirmed</span>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 flex flex-col items-center gap-1 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-[1.5rem] font-[750] tracking-tight text-gray-500">{stats.dismissed}</span>
          <span className="text-[0.72rem] text-txt-2 uppercase tracking-[0.03em] font-medium">Dismissed</span>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 flex flex-col items-center gap-1 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-[1.5rem] font-[750] tracking-tight text-brand">{stats.objectsWithAttestations}</span>
          <span className="text-[0.72rem] text-txt-2 uppercase tracking-[0.03em] font-medium">Objects with Attestations</span>
        </div>
      </div>

      {/* Attestation Coverage Summary */}
      {Object.keys(coverageSummary).length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.88rem] font-bold text-txt tracking-tight">Confirmed Attestation Coverage</h3>
            <span className="bg-brand-bg text-brand text-[0.7rem] font-semibold px-2.5 py-0.5 rounded-full">{Object.keys(coverageSummary).length} attestations</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5 pt-1.5">
            {ATTESTATION_CATEGORIES.map((cat) => {
              const catAttestations = ATTESTATIONS.filter((a) => a.category === cat)
              const active = catAttestations.filter((a) => coverageSummary[a.id])
              if (active.length === 0) return null
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-txt-2 mb-0.5">{cat}</span>
                  {active.map((att) => (
                    <div key={att.id} className="flex items-center gap-1.5">
                      <span className="bg-[#ede9fe] text-[#7c3aed] px-2 py-0.5 rounded-md text-[0.72rem] font-semibold whitespace-nowrap">{att.name}</span>
                      <span className="text-[0.72rem] text-txt-3">{coverageSummary[att.id].length} object{coverageSummary[att.id].length !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-0.5 mb-3.5 border-b border-border pb-0">
        {[
          { id: 'pending', label: 'Pending', count: stats.pending },
          { id: 'confirmed', label: 'Confirmed', count: stats.confirmed },
          { id: 'dismissed', label: 'Dismissed', count: stats.dismissed },
          { id: 'all', label: 'All', count: stats.total },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`bg-transparent border-none border-b-2 px-3.5 py-2 text-[0.78rem] font-semibold cursor-pointer flex items-center gap-1 transition-all duration-150 font-sans ${
              filter === tab.id
                ? 'text-brand border-b-brand'
                : 'text-txt-2 border-b-transparent hover:text-txt'
            }`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[0.68rem] font-bold ${
                filter === tab.id
                  ? 'bg-brand-light text-brand'
                  : 'bg-subtle text-txt-2'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Queue Items */}
      {filteredQueue.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3">
          {stats.total === 0 ? (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <p>No regulatory detections yet.</p>
              <p className="text-txt-3">Click "Scan All Objects" to run AI-powered regulatory analysis across your inventory.</p>
            </>
          ) : (
            <p className="text-txt-3">No items match the current filter.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filteredQueue.map((item) => {
            const att = getAttestation(item.attestationId)
            const conf = CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.medium
            const isPending = item.status === 'pending'
            return (
              <div
                key={item.id}
                className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                  item.status === 'pending'
                    ? 'border-l-[3px] border-l-amber-500 border-y border-r border-y-white/50 border-r-white/50'
                    : item.status === 'confirmed'
                    ? 'border-l-[3px] border-l-green-500 border-y border-r border-y-white/50 border-r-white/50 opacity-75'
                    : 'border-l-[3px] border-l-gray-300 border-y border-r border-y-white/50 border-r-white/50 opacity-55'
                }`}
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#ede9fe] text-[#7c3aed] px-2 py-0.5 rounded-md text-[0.72rem] font-semibold whitespace-nowrap">{att.name}</span>
                    <span className="text-[0.7rem] text-txt-3 font-medium">{att.category}</span>
                    <span className="px-2 py-0.5 rounded-full text-[0.68rem] font-semibold" style={{ backgroundColor: conf.bg, color: conf.color }}>
                      {conf.label} confidence
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isPending ? (
                      <>
                        <button
                          className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:from-brand-hover hover:to-[#1e3a8a] hover:shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] inline-flex items-center gap-1.5"
                          onClick={() => handleResolve(item.id, 'confirmed')}
                        >
                          Confirm
                        </button>
                        <button
                          className="bg-white text-txt-2 border border-border rounded-[10px] px-3 py-1.5 text-[0.78rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300 hover:text-txt active:scale-[0.97]"
                          onClick={() => handleResolve(item.id, 'dismissed')}
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <span className={`text-[0.72rem] font-semibold px-2 py-0.5 rounded-md ${
                        item.status === 'confirmed'
                          ? 'bg-green-bg text-green'
                          : 'bg-[#f3f4f6] text-gray-500'
                      }`}>
                        {item.status === 'confirmed' ? 'Confirmed' : 'Dismissed'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-3.5 pb-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[0.78rem]">
                    <span className="text-[0.82rem] text-txt-2">Object</span>
                    <button
                      className="bg-none border-none text-brand text-[0.82rem] font-semibold cursor-pointer font-sans hover:underline"
                      onClick={() => onNavigate('object-detail', item.objectId)}
                    >
                      {item.objectName}
                    </button>
                  </div>
                  <div className="text-[0.78rem]">
                    <span className="text-[0.82rem] text-txt-2">AI Rationale</span>
                    <p className="text-txt-2 mt-0.5 leading-relaxed">{item.rationale}</p>
                  </div>
                  <span className="text-[0.68rem] text-txt-3">
                    Detected {new Date(item.detectedAt).toLocaleDateString()}
                    {item.resolvedAt && ` · Resolved ${new Date(item.resolvedAt).toLocaleDateString()}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
