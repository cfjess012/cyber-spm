import React, { useState, useMemo, useEffect } from 'react'
import { useStore, useDispatch } from '../../store/useStore.jsx'
import { POSTURE_LEVELS, PRODUCT_FAMILIES } from '../../data/constants.js'
import { computePosture, formatDate } from '../../utils/compliance.js'
import ObjectForm from './ObjectForm.jsx'

const VIEWS = [
  { id: 'table', label: 'Table', icon: 'M3 10h18M3 14h18M3 18h18M3 6h18' },
  { id: 'cards', label: 'Cards', icon: 'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4z' },
  { id: 'board', label: 'Board', icon: 'M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm10 0h-4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z' },
]

const CRIT_STYLES = {
  critical: { backgroundColor: 'var(--color-red-bg)', color: 'var(--color-red)' },
  high: { backgroundColor: 'var(--color-orange-bg)', color: 'var(--color-orange)' },
  medium: { backgroundColor: 'var(--color-amber-bg)', color: 'var(--color-amber)' },
  low: { backgroundColor: 'var(--color-green-bg)', color: 'var(--color-green)' },
}

export default function OneListView({ onNavigate, promotionData, onClearPromotion }) {
  const { objects, gaps, mlgAssessments } = useStore()
  const dispatch = useDispatch()
  const [search, setSearch] = useState('')
  const [filterPosture, setFilterPosture] = useState('')
  const [filterFamily, setFilterFamily] = useState('')
  const [sortBy, setSortBy] = useState('posture')
  const [sortDir, setSortDir] = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [editObj, setEditObj] = useState(null)
  const [promotionPrefill, setPromotionPrefill] = useState(null)
  const [viewMode, setViewMode] = useState('table')

  // Auto-open ObjectForm pre-filled when promoting from pipeline
  useEffect(() => {
    if (promotionData) {
      const { gapId, gapTitle, ...prefill } = promotionData
      setPromotionPrefill(prefill)
      setEditObj(null)
      setShowForm(true)
    }
  }, [promotionData])

  const filtered = useMemo(() => {
    let list = objects.map((obj) => ({
      ...obj,
      _posture: computePosture(obj, {
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
  }, [objects, mlgAssessments, search, filterPosture, filterFamily, sortBy, sortDir])

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
    if (promotionData?.gapId && promotionPrefill) {
      // Promotion: create complete object + close the pipeline item
      dispatch({ type: 'ADD_OBJECT', payload: {
        ...data,
        history: [{ action: 'Promoted', note: `Promoted from pipeline: "${promotionData.gapTitle}"`, timestamp: new Date().toISOString() }],
      }})
      dispatch({ type: 'UPDATE_GAP', payload: {
        id: promotionData.gapId,
        status: 'Closed',
        remediationNote: `Promoted to Object Inventory as "${data.listName}"`,
      }})
      onClearPromotion?.()
      setPromotionPrefill(null)
    } else if (editObj) {
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
    <span className={`ml-1 text-[0.72rem] ${sortBy === field ? 'text-brand' : 'text-txt-3 opacity-50'}`}>
      {sortBy === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
    </span>
  )

  const initials = (name) => {
    if (!name) return '?'
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">Object Inventory</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Unified posture view — {objects.length} tracked items</p>
        </div>
        <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:from-brand-hover hover:to-[#1e3a8a] hover:shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center gap-1.5" onClick={() => { setEditObj(null); setShowForm(true) }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Object
        </button>
      </div>

      {/* Toolbar: Search + Filters + View Toggle */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex items-center flex-1 min-w-[200px]">
          <svg className="absolute left-3 text-txt-3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search objects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-txt-3 cursor-pointer p-1 rounded-md hover:text-txt hover:bg-subtle" onClick={() => setSearch('')} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <select className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterPosture} onChange={(e) => setFilterPosture(e.target.value)}>
          <option value="">All Posture</option>
          {POSTURE_LEVELS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <select className="bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15" value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
          <option value="">All Families</option>
          {PRODUCT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <div className="flex bg-subtle rounded-lg p-0.5 gap-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`p-2 rounded-md border-none cursor-pointer transition-all duration-150 ${viewMode === v.id ? 'bg-white text-brand shadow-sm' : 'bg-transparent text-txt-3 hover:text-txt'}`}
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
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-10 text-center text-txt-3 flex flex-col items-center gap-3.5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <p>No objects found. {search || filterPosture || filterFamily ? 'Try adjusting your filters.' : 'Add your first object to get started.'}</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ═══ TABLE VIEW ═══ */
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="bg-subtle/80 backdrop-blur-sm text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 cursor-pointer select-none hover:text-txt transition-colors border-b border-border-light" onClick={() => toggleSort('listName')} title="Click to sort">Name <SortIcon field="listName" /></th>
                  <th className="bg-subtle/80 backdrop-blur-sm text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 cursor-pointer select-none hover:text-txt transition-colors border-b border-border-light" onClick={() => toggleSort('posture')} title="Click to sort">Posture <SortIcon field="posture" /></th>
                  <th className="bg-subtle/80 backdrop-blur-sm text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 cursor-pointer select-none hover:text-txt transition-colors border-b border-border-light" onClick={() => toggleSort('compliancePercent')} title="Click to sort">Coverage <SortIcon field="compliancePercent" /></th>
                  <th className="bg-subtle/80 backdrop-blur-sm text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 cursor-pointer select-none hover:text-txt transition-colors border-b border-border-light" onClick={() => toggleSort('owner')} title="Click to sort">Owner <SortIcon field="owner" /></th>
                  <th className="bg-subtle/80 backdrop-blur-sm text-[0.72rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 cursor-pointer select-none hover:text-txt transition-colors border-b border-border-light" onClick={() => toggleSort('updatedAt')} title="Click to sort">Updated <SortIcon field="updatedAt" /></th>
                  <th className="bg-subtle/80 backdrop-blur-sm px-4 py-3 border-b border-border-light"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((obj) => {
                  const posture = obj._posture
                  return (
                    <tr key={obj.id} className="border-b border-border-light transition-all duration-150 hover:bg-brand/[0.03] cursor-pointer" onClick={() => onNavigate('object-detail', obj.id)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('object-detail', obj.id) } }}>
                      <td className="px-4 py-3 flex flex-col gap-1">
                        <span className="text-[0.88rem] font-semibold text-txt tracking-tight">{obj.listName || 'Untitled'}</span>
                        <span className="flex gap-1.5 mt-0.5">
                          {obj.type && <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded bg-subtle text-txt-3 tracking-wider">{obj.type}</span>}
                          {obj.controlClassification === 'Informal' && <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-bg text-amber tracking-wider">Informal</span>}
                          <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider" style={CRIT_STYLES[(obj.criticality || 'medium').toLowerCase()]}>{obj.criticality}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: posture.bg, color: posture.color }}>
                            <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: posture.dot }} />
                            {posture.label}
                          </span>
                          {posture.score != null && <span className="text-[0.78rem] font-[800] tracking-tight" style={{ color: posture.color }}>{posture.score}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-[60px] h-[5px] rounded-full bg-border-light overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(obj.compliancePercent, 100)}%`,
                                backgroundColor: obj.compliancePercent >= 80 ? '#16a34a' : obj.compliancePercent >= 50 ? '#d97706' : '#dc2626',
                              }}
                            />
                          </div>
                          <span>{obj.compliancePercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-txt-3 text-[0.82rem]">{obj.owner || '—'}</td>
                      <td className="px-4 py-3 text-txt-3 text-[0.82rem]">{formatDate(obj.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          className="bg-transparent border-none text-txt-3 cursor-pointer p-1.5 rounded-lg transition-all duration-150 hover:text-brand hover:bg-brand/5"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col gap-4"
                onClick={() => drillIntoFamily(group.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drillIntoFamily(group.name) } }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">{group.name}</h3>
                  <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{group.objects.length} object{group.objects.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Posture breakdown bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 rounded-full bg-border-light overflow-hidden flex">
                    {POSTURE_LEVELS.map((p) => {
                      const count = group.posture[p.id] || 0
                      if (count === 0) return null
                      const pct = (count / totalPosture) * 100
                      return (
                        <div
                          key={p.id}
                          className="transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: p.dot }}
                          title={`${p.label}: ${count}`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[0.72rem] text-txt-3 font-medium">
                    {POSTURE_LEVELS.map((p) => {
                      const count = group.posture[p.id] || 0
                      if (count === 0) return null
                      return (
                        <span key={p.id} className="inline-flex items-center gap-1">
                          <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: p.dot }} />
                          {count} {p.label}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Coverage ring + stats */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="w-[52px] h-[52px] relative shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
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
                    <span className="absolute inset-0 flex items-center justify-center text-[0.72rem] font-[800] text-txt">{avgCoverage}%</span>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[0.72rem] font-medium text-txt-3">Avg Coverage</span>
                    {worstObj && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[0.62rem] uppercase font-bold text-amber tracking-wider">Needs attention</span>
                        <span className="text-[0.78rem] text-txt truncate">{worstObj.listName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Owners */}
                <div className="flex -space-x-1.5 mt-3">
                  {ownerList.map((owner, i) => (
                    <span key={owner} className="w-6 h-6 rounded-full text-white text-[0.58rem] font-bold flex items-center justify-center border-2 border-white" style={{ backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#c026d3'][i] || '#2563eb' }} title={owner}>
                      {initials(owner)}
                    </span>
                  ))}
                  {group.owners.size > 4 && (
                    <span className="w-6 h-6 rounded-full bg-subtle text-txt-3 text-[0.58rem] font-bold flex items-center justify-center border-2 border-white">+{group.owners.size - 4}</span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light text-[0.72rem] text-txt-3 font-medium">
                  <span>Click to drill in</span>
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
        <div className="flex gap-4 overflow-x-auto pb-2">
          {postureColumns.map((col) => (
            <div key={col.id} className="flex-1 min-w-[220px] max-w-[280px]">
              <div className="p-3 rounded-t-xl bg-white/80 border border-white/50 border-b-0 flex items-center justify-between border-t-[3px]" style={{ borderTopColor: col.dot }}>
                <span className="flex items-center gap-1.5 text-[0.82rem] font-bold text-txt">
                  <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: col.dot }} />
                  {col.label}
                </span>
                <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{col.objects.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2 bg-subtle/50 rounded-b-xl border border-white/50 border-t-0 min-h-[100px]">
                {col.objects.map((obj) => (
                  <div
                    key={obj.id}
                    className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-white/60 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
                    onClick={() => onNavigate('object-detail', obj.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('object-detail', obj.id) } }}
                  >
                    <div className="text-[0.82rem] font-semibold text-txt mb-1.5">{obj.listName}</div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {obj.productFamilies?.[0] && (
                        <span className="text-[0.62rem] font-medium text-txt-3 bg-subtle px-1.5 py-0.5 rounded">{obj.productFamilies[0]}</span>
                      )}
                      <span className="text-[0.62rem] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider" style={CRIT_STYLES[(obj.criticality || 'medium').toLowerCase()]}>{obj.criticality}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-[5px] rounded-full bg-border-light overflow-hidden" style={{ width: 40 }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(obj.compliancePercent, 100)}%`,
                              backgroundColor: obj.compliancePercent >= 80 ? '#16a34a' : obj.compliancePercent >= 50 ? '#d97706' : '#dc2626',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.72rem' }}>{obj.compliancePercent}%</span>
                      </div>
                      {obj.owner && (
                        <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-[0.55rem] font-bold flex items-center justify-center" title={obj.owner}>
                          {initials(obj.owner)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {col.objects.length === 0 && (
                  <div className="text-center text-txt-3 text-[0.78rem] py-6">No items</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <ObjectForm
          object={editObj || promotionPrefill}
          objects={objects}
          promotionMode={!!promotionPrefill}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditObj(null); setPromotionPrefill(null); if (promotionData) onClearPromotion?.() }}
        />
      )}
    </div>
  )
}
