import React, { useState, useMemo } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { POSTURE_LEVELS, PRODUCT_FAMILIES } from '../../data/constants.js'
import { computePosture, formatDate } from '../../utils/compliance.js'
import ObjectForm from './ObjectForm.jsx'

const VIEWS = [
  { id: 'table', label: 'Table', icon: 'M3 10h18M3 14h18M3 18h18M3 6h18' },
  { id: 'cards', label: 'Cards', icon: 'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4z' },
  { id: 'board', label: 'Board', icon: 'M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm10 0h-4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z' },
]

export default function OneListView({ onNavigate }) {
  const { objects, gaps, mlgAssessments } = useStore()
  const dispatch = useDispatch()
  const [search, setSearch] = useState('')
  const [filterPosture, setFilterPosture] = useState('')
  const [filterFamily, setFilterFamily] = useState('')
  const [sortBy, setSortBy] = useState('posture')
  const [sortDir, setSortDir] = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [editObj, setEditObj] = useState(null)
  const [viewMode, setViewMode] = useState('table')

  const filtered = useMemo(() => {
    let list = objects.map((obj) => ({
      ...obj,
      _posture: computePosture(obj, {
        gaps: gaps.filter(g => (g.objectIds || []).includes(obj.id)),
        mlgAssessment: mlgAssessments[obj.id] || null,
      }),
    }))

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.listName?.toLowerCase().includes(q) ||
          o.owner?.toLowerCase().includes(q) ||
          o.type?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q)
      )
    }
    if (filterPosture) list = list.filter((o) => o._posture.id === filterPosture)
    if (filterFamily) list = list.filter((o) => o.productFamilies?.includes(filterFamily))

    const POSTURE_ORDER = { CRITICAL: 0, AT_RISK: 1, HEALTHY: 2, NEW: 3 }

    list.sort((a, b) => {
      let va, vb
      if (sortBy === 'posture') {
        va = POSTURE_ORDER[a._posture.id] ?? 4
        vb = POSTURE_ORDER[b._posture.id] ?? 4
      } else {
        va = a[sortBy] ?? ''
        vb = b[sortBy] ?? ''
        if (typeof va === 'string') va = va.toLowerCase()
        if (typeof vb === 'string') vb = vb.toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      if (sortBy === 'posture') {
        return new Date(b.updatedAt) - new Date(a.updatedAt)
      }
      return 0
    })
    return list
  }, [objects, gaps, mlgAssessments, search, filterPosture, filterFamily, sortBy, sortDir])

  // Grouped by product family for Cards view
  const familyGroups = useMemo(() => {
    const groups = {}
    for (const fam of PRODUCT_FAMILIES) {
      groups[fam] = { name: fam, objects: [], posture: {}, totalCoverage: 0, owners: new Set() }
    }
    for (const obj of filtered) {
      const families = obj.productFamilies?.length ? obj.productFamilies : ['Uncategorized']
      for (const fam of families) {
        if (!groups[fam]) {
          groups[fam] = { name: fam, objects: [], posture: {}, totalCoverage: 0, owners: new Set() }
        }
        groups[fam].objects.push(obj)
        const pid = obj._posture.id
        groups[fam].posture[pid] = (groups[fam].posture[pid] || 0) + 1
        groups[fam].totalCoverage += (obj.compliancePercent || 0)
        if (obj.owner) groups[fam].owners.add(obj.owner)
      }
    }
    return Object.values(groups).filter((g) => g.objects.length > 0)
      .sort((a, b) => {
        const aWorst = (a.posture.CRITICAL || 0) * 100 + (a.posture.AT_RISK || 0) * 10
        const bWorst = (b.posture.CRITICAL || 0) * 100 + (b.posture.AT_RISK || 0) * 10
        return bWorst - aWorst
      })
  }, [filtered])

  // Grouped by posture for Board view
  const postureColumns = useMemo(() => {
    return POSTURE_LEVELS.map((p) => ({
      ...p,
      objects: filtered.filter((o) => o._posture.id === p.id),
    }))
  }, [filtered])

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const handleSave = (data) => {
    if (editObj) {
      dispatch({ type: 'UPDATE_OBJECT', payload: { id: editObj.id, ...data } })
    } else {
      dispatch({ type: 'ADD_OBJECT', payload: data })
    }
    setShowForm(false)
    setEditObj(null)
  }

  const drillIntoFamily = (familyName) => {
    setFilterFamily(familyName)
    setViewMode('table')
  }

  const SortIcon = ({ field }) => (
    <span className={`sort-icon ${sortBy === field ? 'active' : ''}`}>
      {sortBy === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
    </span>
  )

  const initials = (name) => {
    if (!name) return '?'
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="onelist-view">
      <div className="page-header">
        <div>
          <h1>Object Inventory</h1>
          <p className="page-subtitle">Unified posture view — {objects.length} tracked items</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditObj(null); setShowForm(true) }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Object
        </button>
      </div>

      {/* Toolbar: Search + Filters + View Toggle */}
      <div className="table-toolbar">
        <div className="search-box" style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search objects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="icon-btn" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <select value={filterPosture} onChange={(e) => setFilterPosture(e.target.value)}>
          <option value="">All Posture</option>
          {POSTURE_LEVELS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
          <option value="">All Families</option>
          {PRODUCT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <div className="view-toggle">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`view-toggle-btn ${viewMode === v.id ? 'active' : ''}`}
              onClick={() => setViewMode(v.id)}
              title={v.label}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={v.icon} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="empty-state card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <p>No objects found. {search || filterPosture || filterFamily ? 'Try adjusting your filters.' : 'Add your first object to get started.'}</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ═══ TABLE VIEW ═══ */
        <div className="table-card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('listName')} title="Click to sort">Name <SortIcon field="listName" /></th>
                  <th onClick={() => toggleSort('posture')} title="Click to sort">Posture <SortIcon field="posture" /></th>
                  <th onClick={() => toggleSort('compliancePercent')} title="Click to sort">Coverage <SortIcon field="compliancePercent" /></th>
                  <th onClick={() => toggleSort('owner')} title="Click to sort">Owner <SortIcon field="owner" /></th>
                  <th onClick={() => toggleSort('updatedAt')} title="Click to sort">Updated <SortIcon field="updatedAt" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((obj) => {
                  const posture = obj._posture
                  return (
                    <tr key={obj.id} onClick={() => onNavigate('object-detail', obj.id)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('object-detail', obj.id) } }}>
                      <td className="cell-name-composite">
                        <span className="cell-name">{obj.listName || 'Untitled'}</span>
                        <span className="cell-meta">
                          {obj.type && <span className="type-tag">{obj.type}</span>}
                          {obj.controlClassification === 'Informal' && <span className="type-tag informal-tag">Informal</span>}
                          <span className={`crit-tag crit-${(obj.criticality || 'medium').toLowerCase()}`}>{obj.criticality}</span>
                        </span>
                      </td>
                      <td>
                        <div className="posture-cell">
                          <span className="posture-tag" style={{ backgroundColor: posture.bg, color: posture.color }}>
                            <span className="posture-dot" style={{ backgroundColor: posture.dot }} />
                            {posture.label}
                          </span>
                          {posture.score != null && <span className="posture-score" style={{ color: posture.color }}>{posture.score}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="compliance-cell">
                          <div className="compliance-bar-track">
                            <div
                              className="compliance-bar-fill"
                              style={{
                                width: `${Math.min(obj.compliancePercent, 100)}%`,
                                backgroundColor: obj.compliancePercent >= 80 ? '#16a34a' : obj.compliancePercent >= 50 ? '#d97706' : '#dc2626',
                              }}
                            />
                          </div>
                          <span>{obj.compliancePercent}%</span>
                        </div>
                      </td>
                      <td className="text-muted">{obj.owner || '—'}</td>
                      <td className="text-muted">{formatDate(obj.updatedAt)}</td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={(e) => { e.stopPropagation(); setEditObj(obj); setShowForm(true) }}
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* ═══ CARDS VIEW — Product Family Dashboards ═══ */
        <div className="family-cards-grid">
          {familyGroups.map((group) => {
            const avgCoverage = group.objects.length > 0
              ? Math.round(group.totalCoverage / group.objects.length)
              : 0
            const worstObj = group.objects[0] // already sorted by posture severity
            const ownerList = Array.from(group.owners).slice(0, 4)
            const totalPosture = group.objects.length

            return (
              <div
                key={group.name}
                className="family-card"
                onClick={() => drillIntoFamily(group.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drillIntoFamily(group.name) } }}
              >
                <div className="family-card-header">
                  <h3 className="family-card-name">{group.name}</h3>
                  <span className="family-card-count">{group.objects.length} object{group.objects.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Posture breakdown bar */}
                <div className="family-posture-section">
                  <div className="family-posture-bar">
                    {POSTURE_LEVELS.map((p) => {
                      const count = group.posture[p.id] || 0
                      if (count === 0) return null
                      const pct = (count / totalPosture) * 100
                      return (
                        <div
                          key={p.id}
                          className="family-posture-segment"
                          style={{ width: `${pct}%`, backgroundColor: p.dot }}
                          title={`${p.label}: ${count}`}
                        />
                      )
                    })}
                  </div>
                  <div className="family-posture-legend">
                    {POSTURE_LEVELS.map((p) => {
                      const count = group.posture[p.id] || 0
                      if (count === 0) return null
                      return (
                        <span key={p.id} className="family-posture-item">
                          <span className="posture-dot" style={{ backgroundColor: p.dot, width: 6, height: 6 }} />
                          {count} {p.label}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Coverage ring + stats */}
                <div className="family-stats-row">
                  <div className="family-coverage-ring">
                    <svg viewBox="0 0 36 36" className="family-ring-svg">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={avgCoverage >= 80 ? '#16a34a' : avgCoverage >= 50 ? '#d97706' : '#dc2626'}
                        strokeWidth="3"
                        strokeDasharray={`${avgCoverage}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="family-ring-value">{avgCoverage}%</span>
                  </div>
                  <div className="family-stats-detail">
                    <span className="family-stat-label">Avg Coverage</span>
                    {worstObj && (
                      <div className="family-worst-obj">
                        <span className="family-worst-label">Needs attention</span>
                        <span className="family-worst-name">{worstObj.listName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Owners */}
                <div className="family-owners">
                  {ownerList.map((owner) => (
                    <span key={owner} className="family-owner-avatar" title={owner}>
                      {initials(owner)}
                    </span>
                  ))}
                  {group.owners.size > 4 && (
                    <span className="family-owner-avatar more">+{group.owners.size - 4}</span>
                  )}
                </div>

                <div className="family-card-footer">
                  <span className="family-drill-hint">Click to drill in</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ═══ BOARD VIEW — Kanban by Posture ═══ */
        <div className="posture-board">
          {postureColumns.map((col) => (
            <div key={col.id} className="board-column">
              <div className="board-column-header" style={{ borderTopColor: col.dot }}>
                <span className="board-column-title">
                  <span className="posture-dot" style={{ backgroundColor: col.dot }} />
                  {col.label}
                </span>
                <span className="board-column-count">{col.objects.length}</span>
              </div>
              <div className="board-column-body">
                {col.objects.map((obj) => (
                  <div
                    key={obj.id}
                    className="board-card"
                    onClick={() => onNavigate('object-detail', obj.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('object-detail', obj.id) } }}
                  >
                    <div className="board-card-name">{obj.listName}</div>
                    <div className="board-card-meta">
                      {obj.productFamilies?.[0] && (
                        <span className="board-card-family">{obj.productFamilies[0]}</span>
                      )}
                      <span className={`crit-tag crit-${(obj.criticality || 'medium').toLowerCase()}`}>{obj.criticality}</span>
                    </div>
                    <div className="board-card-bottom">
                      <div className="compliance-cell">
                        <div className="compliance-bar-track" style={{ width: 40 }}>
                          <div
                            className="compliance-bar-fill"
                            style={{
                              width: `${Math.min(obj.compliancePercent, 100)}%`,
                              backgroundColor: obj.compliancePercent >= 80 ? '#16a34a' : obj.compliancePercent >= 50 ? '#d97706' : '#dc2626',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.72rem' }}>{obj.compliancePercent}%</span>
                      </div>
                      {obj.owner && (
                        <span className="board-card-owner" title={obj.owner}>
                          {initials(obj.owner)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {col.objects.length === 0 && (
                  <div className="board-empty">No items</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <ObjectForm
          object={editObj}
          objects={objects}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditObj(null) }}
        />
      )}
    </div>
  )
}
