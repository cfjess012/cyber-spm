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
    <div className="regulatory-queue">
      <div className="page-header">
        <div>
          <h1>Regulatory Intelligence</h1>
          <p className="page-subtitle">AI-detected attestation scope — human verification required</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <AiButton onClick={handleScanAll} loading={scanning}>Scan All Objects</AiButton>
          {stats.confirmed + stats.dismissed > 0 && (
            <button className="btn-secondary" onClick={handleClearResolved}>Clear Resolved</button>
          )}
        </div>
      </div>

      {scanError && (
        <div style={{ marginBottom: '1rem' }}>
          <AiError error={scanError} onRetry={handleScanAll} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="reg-stats-row">
        <div className="reg-stat-card">
          <span className="reg-stat-value pending">{stats.pending}</span>
          <span className="reg-stat-label">Pending Review</span>
        </div>
        <div className="reg-stat-card">
          <span className="reg-stat-value confirmed">{stats.confirmed}</span>
          <span className="reg-stat-label">Confirmed</span>
        </div>
        <div className="reg-stat-card">
          <span className="reg-stat-value dismissed">{stats.dismissed}</span>
          <span className="reg-stat-label">Dismissed</span>
        </div>
        <div className="reg-stat-card">
          <span className="reg-stat-value coverage">{stats.objectsWithAttestations}</span>
          <span className="reg-stat-label">Objects with Attestations</span>
        </div>
      </div>

      {/* Attestation Coverage Summary */}
      {Object.keys(coverageSummary).length > 0 && (
        <div className="reg-coverage-section dash-card">
          <div className="dash-card-header">
            <h3>Confirmed Attestation Coverage</h3>
            <span className="dash-card-badge">{Object.keys(coverageSummary).length} attestations</span>
          </div>
          <div className="reg-coverage-grid">
            {ATTESTATION_CATEGORIES.map((cat) => {
              const catAttestations = ATTESTATIONS.filter((a) => a.category === cat)
              const active = catAttestations.filter((a) => coverageSummary[a.id])
              if (active.length === 0) return null
              return (
                <div key={cat} className="reg-coverage-group">
                  <span className="reg-coverage-cat">{cat}</span>
                  {active.map((att) => (
                    <div key={att.id} className="reg-coverage-item">
                      <span className="reg-att-tag">{att.name}</span>
                      <span className="reg-coverage-count">{coverageSummary[att.id].length} object{coverageSummary[att.id].length !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="reg-filter-tabs">
        {[
          { id: 'pending', label: 'Pending', count: stats.pending },
          { id: 'confirmed', label: 'Confirmed', count: stats.confirmed },
          { id: 'dismissed', label: 'Dismissed', count: stats.dismissed },
          { id: 'all', label: 'All', count: stats.total },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`reg-filter-tab ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && <span className="reg-filter-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Queue Items */}
      {filteredQueue.length === 0 ? (
        <div className="empty-state card">
          {stats.total === 0 ? (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <p>No regulatory detections yet.</p>
              <p className="text-muted">Click "Scan All Objects" to run AI-powered regulatory analysis across your inventory.</p>
            </>
          ) : (
            <p className="text-muted">No items match the current filter.</p>
          )}
        </div>
      ) : (
        <div className="reg-queue-list">
          {filteredQueue.map((item) => {
            const att = getAttestation(item.attestationId)
            const conf = CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.medium
            const isPending = item.status === 'pending'
            return (
              <div key={item.id} className={`reg-queue-item ${item.status}`}>
                <div className="reg-queue-item-header">
                  <div className="reg-queue-item-left">
                    <span className="reg-att-tag">{att.name}</span>
                    <span className="reg-att-category">{att.category}</span>
                    <span className="reg-confidence-tag" style={{ backgroundColor: conf.bg, color: conf.color }}>
                      {conf.label} confidence
                    </span>
                  </div>
                  <div className="reg-queue-item-right">
                    {isPending ? (
                      <>
                        <button
                          className="btn-primary small"
                          onClick={() => handleResolve(item.id, 'confirmed')}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => handleResolve(item.id, 'dismissed')}
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <span className={`reg-resolution-tag ${item.status}`}>
                        {item.status === 'confirmed' ? 'Confirmed' : 'Dismissed'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="reg-queue-item-body">
                  <div className="reg-queue-object">
                    <span className="field-label">Object</span>
                    <button
                      className="link-btn"
                      onClick={() => onNavigate('object-detail', item.objectId)}
                    >
                      {item.objectName}
                    </button>
                  </div>
                  <div className="reg-queue-rationale">
                    <span className="field-label">AI Rationale</span>
                    <p>{item.rationale}</p>
                  </div>
                  <span className="reg-queue-time">
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
