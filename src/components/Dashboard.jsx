import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.jsx'
import { isStale, formatDate } from '../utils/compliance.js'
import { HEALTH_STATUSES, PRODUCT_FAMILIES, computeMLGScore } from '../data/constants.js'
import { getInsights } from '../utils/ai.js'
import { AiButton, AiSlidePanel, AiError } from './AiPanel.jsx'

// ── Posture River (Stacked Area) ──
function PostureRiver({ data }) {
  const W = 440, H = 140, PAD = 24
  const chartW = W - PAD * 2, chartH = H - PAD - 8
  const n = data.length
  if (n < 2) return null

  const layers = ['blue', 'green', 'amber', 'red']
  const colors = { blue: '#2563eb', green: '#16a34a', amber: '#ea580c', red: '#dc2626' }
  const fills = { blue: 'rgba(37,99,235,0.6)', green: 'rgba(22,163,74,0.55)', amber: 'rgba(234,88,12,0.5)', red: 'rgba(220,38,38,0.5)' }

  // Build cumulative stacks
  const stacks = data.map((d) => {
    let cum = 0
    const s = {}
    for (const l of layers) {
      s[l + '0'] = cum
      cum += d[l]
      s[l + '1'] = cum
    }
    return s
  })

  const xStep = chartW / (n - 1)
  const x = (i) => PAD + i * xStep
  const y = (v) => 8 + chartH * (1 - v)

  const areaPath = (layer) => {
    let top = ''
    let bottom = ''
    for (let i = 0; i < n; i++) {
      const px = x(i)
      const py1 = y(stacks[i][layer + '1'])
      const py0 = y(stacks[i][layer + '0'])
      top += (i === 0 ? 'M' : 'L') + `${px},${py1} `
      bottom = `L${px},${py0} ` + bottom
    }
    bottom = bottom.replace(/^L/, '')
    return top + 'L' + bottom + 'Z'
  }

  return (
    <div className="trending-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <line key={v} x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {/* Stacked areas */}
        {layers.map((l) => (
          <path key={l} d={areaPath(l)} fill={fills[l]} />
        ))}
        {/* Top line per layer for definition */}
        {layers.map((l) => {
          const pts = data.map((_, i) => `${x(i)},${y(stacks[i][l + '1'])}`).join(' ')
          return <polyline key={l + 'line'} points={pts} fill="none" stroke={colors[l]} strokeWidth="1.5" opacity="0.7" />
        })}
        {/* X labels */}
        {data.map((d, i) => (
          i % 2 === 0 && (
            <text key={i} x={x(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="Inter,sans-serif">{d.label}</text>
          )
        ))}
        {/* Y labels */}
        <text x={PAD - 4} y={y(1) + 3} textAnchor="end" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">100%</text>
        <text x={PAD - 4} y={y(0.5) + 3} textAnchor="end" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">50%</text>
        <text x={PAD - 4} y={y(0) + 3} textAnchor="end" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">0%</text>
      </svg>
      <div className="trending-legend">
        {layers.slice().reverse().map((l) => (
          <span key={l} className="trending-legend-item">
            <span className="trending-legend-dot" style={{ backgroundColor: colors[l] }} />
            {l.charAt(0).toUpperCase() + l.slice(1)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Gap Velocity (Burndown Dual Line) ──
function GapVelocityChart({ data }) {
  const W = 440, H = 140, PAD = 28
  const chartW = W - PAD * 2, chartH = H - PAD - 8
  const n = data.length
  if (n < 2) return null

  const maxVal = Math.max(...data.map((d) => Math.max(d.opened, d.closed)), 1)
  const xStep = chartW / (n - 1)
  const x = (i) => PAD + i * xStep
  const y = (v) => 8 + chartH * (1 - v / maxVal)

  const openedPts = data.map((d, i) => `${x(i)},${y(d.opened)}`).join(' ')
  const closedPts = data.map((d, i) => `${x(i)},${y(d.closed)}`).join(' ')

  // Fill between the two lines
  const fillPath = data.map((d, i) => `${x(i)},${y(d.opened)}`).join(' L')
    + ' L' + data.map((d, i) => `${x(n - 1 - i)},${y(data[n - 1 - i].closed)}`).join(' L')

  const lastOpened = data[n - 1].opened
  const lastClosed = data[n - 1].closed
  const currentGap = lastOpened - lastClosed
  const prevGap = data.length > 1 ? data[n - 2].opened - data[n - 2].closed : currentGap
  const trending = currentGap < prevGap ? 'improving' : currentGap > prevGap ? 'worsening' : 'stable'

  return (
    <div className="trending-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <line key={v} x1={PAD} y1={y(v * maxVal)} x2={W - PAD} y2={y(v * maxVal)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {/* Fill between lines */}
        <polygon
          points={fillPath}
          fill={trending === 'improving' ? 'rgba(22,163,74,0.1)' : trending === 'worsening' ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.06)'}
        />
        {/* Opened line */}
        <polyline points={openedPts} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Closed line */}
        <polyline points={closedPts} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots at endpoints */}
        <circle cx={x(n - 1)} cy={y(lastOpened)} r="3.5" fill="#dc2626" />
        <circle cx={x(n - 1)} cy={y(lastClosed)} r="3.5" fill="#16a34a" />
        {/* Gap label */}
        <rect x={W - PAD - 52} y={y((lastOpened + lastClosed) / 2) - 12} width="48" height="24" rx="6" fill={trending === 'improving' ? '#f0fdf4' : '#fef2f2'} stroke={trending === 'improving' ? '#bbf7d0' : '#fecaca'} strokeWidth="1" />
        <text x={W - PAD - 28} y={y((lastOpened + lastClosed) / 2) + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={trending === 'improving' ? '#16a34a' : '#dc2626'} fontFamily="Inter,sans-serif">
          {trending === 'improving' ? '\u2193' : '\u2191'} {currentGap}
        </text>
        {/* X labels */}
        {data.map((d, i) => (
          i % 2 === 0 && (
            <text key={i} x={x(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="Inter,sans-serif">{d.label}</text>
          )
        ))}
        {/* Y labels */}
        <text x={PAD - 4} y={y(maxVal) + 3} textAnchor="end" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">{maxVal}</text>
        <text x={PAD - 4} y={y(0) + 3} textAnchor="end" fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">0</text>
      </svg>
      <div className="trending-legend">
        <span className="trending-legend-item"><span className="trending-legend-dot" style={{ backgroundColor: '#dc2626' }} />Opened</span>
        <span className="trending-legend-item"><span className="trending-legend-dot" style={{ backgroundColor: '#16a34a' }} />Closed</span>
        <span className="trending-legend-item" style={{ marginLeft: 'auto', fontWeight: 700, color: trending === 'improving' ? '#16a34a' : '#dc2626' }}>
          {trending === 'improving' ? 'Backlog shrinking' : trending === 'worsening' ? 'Backlog growing' : 'Stable'}
        </span>
      </div>
    </div>
  )
}

// ── Review Activity Heatmap (GitHub-style) ──
function ReviewHeatmap({ data }) {
  const cellSize = 11
  const cellGap = 2
  const step = cellSize + cellGap
  const rows = 7 // days of week
  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', '']

  // Organize into weeks (columns)
  const weeks = []
  let currentWeek = []
  data.forEach((d, i) => {
    const dow = d.date.getDay() // 0=Sun
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push({ ...d, dow })
  })
  if (currentWeek.length > 0) weeks.push(currentWeek)

  const cols = weeks.length
  const svgW = 28 + cols * step + 8
  const svgH = rows * step + 28

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  const cellColor = (d) => {
    if (d.count === 0) return '#f1f5f9'
    const intensity = Math.min(d.count / maxCount, 1)
    if (d.avgCompliance === null) return '#e2e8f0'
    // Blend from amber (low compliance) to green (high compliance)
    const comp = d.avgCompliance / 100
    const r = Math.round(234 - comp * 212) // 234 → 22
    const g = Math.round(88 + comp * 75)   // 88 → 163
    const b = Math.round(12 + comp * 50)   // 12 → 62
    const alpha = 0.3 + intensity * 0.7
    return `rgba(${r},${g},${b},${alpha})`
  }

  const [tooltip, setTooltip] = useState(null)

  return (
    <div className="heatmap-container" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet" className="heatmap-svg">
        {/* Day labels */}
        {dayLabels.map((label, i) => (
          label && <text key={i} x="24" y={i * step + cellSize + 1} textAnchor="end" fontSize="7" fill="#9ca3af" fontFamily="Inter,sans-serif">{label}</text>
        ))}
        {/* Cells */}
        {weeks.map((week, col) =>
          week.map((d) => {
            const row = d.dow === 0 ? 6 : d.dow - 1 // Mon=0, Sun=6
            return (
              <rect
                key={d.date.toISOString()}
                x={28 + col * step}
                y={row * step}
                width={cellSize}
                height={cellSize}
                rx="2"
                fill={cellColor(d)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const parent = e.currentTarget.closest('.heatmap-container').getBoundingClientRect()
                  setTooltip({ ...d, _x: rect.left - parent.left + rect.width / 2, _y: rect.top - parent.top - 8 })
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              />
            )
          })
        )}
        {/* Month labels along bottom */}
        {(() => {
          const labels = []
          let lastMonth = ''
          weeks.forEach((week, col) => {
            const firstDay = week[0]
            const month = firstDay.date.toLocaleDateString('en-US', { month: 'short' })
            if (month !== lastMonth) {
              labels.push(
                <text key={col} x={28 + col * step} y={svgH - 4} fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">{month}</text>
              )
              lastMonth = month
            }
          })
          return labels
        })()}
      </svg>
      {tooltip && (
        <div className="heatmap-tooltip" style={{ position: 'absolute', left: `${tooltip._x || 0}px`, top: `${tooltip._y || 0}px` }}>
          <strong>{tooltip.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
          <span>{tooltip.count} object{tooltip.count !== 1 ? 's' : ''} updated</span>
          {tooltip.avgCompliance !== null && <span>Avg compliance: {tooltip.avgCompliance}%</span>}
          {tooltip.gapsOpened > 0 && <span>{tooltip.gapsOpened} gap{tooltip.gapsOpened !== 1 ? 's' : ''} opened</span>}
        </div>
      )}
      {/* Legend */}
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <span key={v} className="heatmap-legend-cell" style={{ backgroundColor: v === 0 ? '#f1f5f9' : `rgba(22,163,74,${0.3 + v * 0.7})` }} />
        ))}
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const state = useStore()
  const { objects, gaps, standupItems, mlgAssessments } = state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContent, setAiContent] = useState(null)
  const [aiError, setAiError] = useState(null)

  const handleGetInsights = async () => {
    setAiOpen(true)
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await getInsights(state)
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const totalObjects = objects.length
  const activeObjects = objects.filter((o) => o.status === 'Active').length
  const staleCount = objects.filter((o) => isStale(o.lastReviewDate)).length
  const avgCompliance = totalObjects
    ? Math.round(objects.reduce((s, o) => s + (o.compliancePercent || 0), 0) / totalObjects * 10) / 10
    : 0

  const openGaps = gaps.filter((g) => g.status === 'Open').length
  const inProgressGaps = gaps.filter((g) => g.status === 'In Progress').length
  const closedGaps = gaps.filter((g) => g.status === 'Closed').length
  const totalGaps = gaps.length

  const overdueActions = standupItems.filter(
    (s) => s.status === 'Open' && s.dueDate && new Date(s.dueDate) < new Date()
  ).length

  // Health distribution
  const healthDist = HEALTH_STATUSES.map((h) => ({
    ...h,
    count: objects.filter((o) => o.healthStatus === h.id).length,
  }))

  // Recently updated objects
  const recent = [...objects]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)

  // Gap closure rate (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const recentlyClosed = gaps.filter(
    (g) => g.status === 'Closed' && g.updatedAt >= thirtyDaysAgo
  ).length

  // ── Trending Data ──

  // Posture River: weekly health snapshots over last 12 weeks
  const postureData = useMemo(() => {
    const weeks = 12
    const now = Date.now()
    const points = []
    for (let w = weeks - 1; w >= 0; w--) {
      const cutoff = new Date(now - w * 7 * 86400000)
      const label = cutoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      // Count objects that existed by this date
      const existing = objects.filter((o) => new Date(o.createdAt) <= cutoff)
      const total = existing.length || 1
      const red = existing.filter((o) => o.healthStatus === 'RED').length
      const amber = existing.filter((o) => o.healthStatus === 'AMBER').length
      const green = existing.filter((o) => o.healthStatus === 'GREEN').length
      const blue = existing.filter((o) => o.healthStatus === 'BLUE').length
      points.push({
        label,
        red: red / total,
        amber: amber / total,
        green: green / total,
        blue: blue / total,
      })
    }
    return points
  }, [objects])

  // Gap Velocity: cumulative opened vs closed over time
  const gapVelocity = useMemo(() => {
    const weeks = 12
    const now = Date.now()
    const points = []
    for (let w = weeks - 1; w >= 0; w--) {
      const cutoff = new Date(now - w * 7 * 86400000)
      const label = cutoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const opened = gaps.filter((g) => new Date(g.createdAt) <= cutoff).length
      const closed = gaps.filter(
        (g) => g.status === 'Closed' && new Date(g.updatedAt) <= cutoff
      ).length
      points.push({ label, opened, closed })
    }
    return points
  }, [gaps])

  // Heatmap: daily activity over last 90 days
  const heatmapData = useMemo(() => {
    const days = 91
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const map = {}
    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 86400000)
      const key = date.toISOString().slice(0, 10)
      map[key] = { date, count: 0, avgCompliance: 0, gapsOpened: 0, complianceSum: 0 }
    }
    objects.forEach((o) => {
      const key = o.updatedAt?.slice(0, 10)
      if (map[key]) {
        map[key].count++
        map[key].complianceSum += o.compliancePercent || 0
      }
    })
    gaps.forEach((g) => {
      const key = g.createdAt?.slice(0, 10)
      if (map[key]) map[key].gapsOpened++
    })
    Object.values(map).forEach((d) => {
      d.avgCompliance = d.count ? Math.round(d.complianceSum / d.count) : null
    })
    return Object.values(map).sort((a, b) => a.date - b.date)
  }, [objects, gaps])

  // ── Governance Maturity Distribution ──
  const maturityDist = useMemo(() => {
    const tiers = [
      { id: 'BLUE', label: 'Mature', color: '#2563eb', bg: '#eff6ff', count: 0 },
      { id: 'GREEN', label: 'Adequate', color: '#16a34a', bg: '#f0fdf4', count: 0 },
      { id: 'AMBER', label: 'Developing', color: '#ea580c', bg: '#fff7ed', count: 0 },
      { id: 'RED', label: 'Deficient', color: '#dc2626', bg: '#fef2f2', count: 0 },
    ]
    const notAssessed = { label: 'Not Assessed', count: 0 }
    objects.forEach((o) => {
      const mlg = mlgAssessments[o.id]
      if (!mlg) { notAssessed.count++; return }
      const { tier } = computeMLGScore(mlg, o)
      const t = tiers.find((t) => t.id === tier.tier)
      if (t) t.count++
    })
    return { tiers, notAssessed }
  }, [objects, mlgAssessments])

  // ── Coverage Matrix: product family health ──
  const coverageData = useMemo(() => {
    return PRODUCT_FAMILIES.map((family) => {
      const familyObjs = objects.filter((o) => (o.productFamilies || []).includes(family))
      const count = familyObjs.length
      const avgComp = count ? Math.round(familyObjs.reduce((s, o) => s + (o.compliancePercent || 0), 0) / count) : 0
      const formalPct = count ? Math.round(familyObjs.filter((o) => o.controlClassification === 'Formal').length / count * 100) : 0
      const redCount = familyObjs.filter((o) => o.healthStatus === 'RED').length
      const amberCount = familyObjs.filter((o) => o.healthStatus === 'AMBER').length
      const greenCount = familyObjs.filter((o) => o.healthStatus === 'GREEN').length
      const blueCount = familyObjs.filter((o) => o.healthStatus === 'BLUE').length
      const familyGaps = gaps.filter((g) => {
        const ids = g.objectIds || []
        return ids.some((id) => familyObjs.find((o) => o.id === id)) && g.status !== 'Closed'
      }).length
      // Avg maturity for assessed objects in this family
      const assessed = familyObjs.filter((o) => mlgAssessments[o.id])
      const avgMaturity = assessed.length
        ? Math.round(assessed.reduce((s, o) => s + computeMLGScore(mlgAssessments[o.id], o).score, 0) / assessed.length * 10) / 10
        : null
      const assessedCount = assessed.length
      return { family, count, avgComp, formalPct, redCount, amberCount, greenCount, blueCount, openGaps: familyGaps, avgMaturity, assessedCount }
    })
  }, [objects, gaps, mlgAssessments])

  // ── Owner Portfolio Roll-up ──
  const ownerData = useMemo(() => {
    const ownerMap = {}
    objects.forEach((o) => {
      const owner = o.owner || 'Unassigned'
      if (!ownerMap[owner]) ownerMap[owner] = { owner, objects: [], gapCount: 0 }
      ownerMap[owner].objects.push(o)
    })
    // Count open gaps per owner
    gaps.forEach((g) => {
      if (g.status === 'Closed') return
      const ids = g.objectIds || []
      const owners = new Set()
      ids.forEach((id) => {
        const obj = objects.find((o) => o.id === id)
        if (obj) owners.add(obj.owner || 'Unassigned')
      })
      owners.forEach((owner) => {
        if (ownerMap[owner]) ownerMap[owner].gapCount++
      })
    })
    return Object.values(ownerMap)
      .map((d) => {
        const assessed = d.objects.filter((o) => mlgAssessments[o.id])
        const avgMaturity = assessed.length
          ? Math.round(assessed.reduce((s, o) => s + computeMLGScore(mlgAssessments[o.id], o).score, 0) / assessed.length * 10) / 10
          : null
        return {
          owner: d.owner,
          count: d.objects.length,
          avgComp: Math.round(d.objects.reduce((s, o) => s + (o.compliancePercent || 0), 0) / d.objects.length),
          redCount: d.objects.filter((o) => o.healthStatus === 'RED').length,
          amberCount: d.objects.filter((o) => o.healthStatus === 'AMBER').length,
          greenCount: d.objects.filter((o) => o.healthStatus === 'GREEN').length,
          blueCount: d.objects.filter((o) => o.healthStatus === 'BLUE').length,
          gapCount: d.gapCount,
          avgMaturity,
        }
      })
      .sort((a, b) => b.redCount - a.redCount || b.amberCount - a.amberCount || b.gapCount - a.gapCount)
  }, [objects, gaps, mlgAssessments])

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>CISO Dashboard</h1>
          <p className="page-subtitle">Security product management overview</p>
        </div>
        <AiButton onClick={handleGetInsights} loading={aiLoading}>
          AI Insights
        </AiButton>
      </div>

      <AiSlidePanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Executive Insights"
        loading={aiLoading}
        content={aiContent}
      >
        {aiError && <AiError error={aiError} onRetry={handleGetInsights} />}
      </AiSlidePanel>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => onNavigate('objects')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('objects') } }} aria-label={`Total Objects: ${totalObjects}, ${activeObjects} active`}>
          <div className="kpi-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="kpi-data">
            <span className="kpi-value">{totalObjects}</span>
            <span className="kpi-label">Total Objects</span>
          </div>
          <span className="kpi-detail">{activeObjects} active</span>
        </div>

        <div className="kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="kpi-data">
            <span className="kpi-value">{avgCompliance}%</span>
            <span className="kpi-label">Avg Compliance</span>
          </div>
          <span className="kpi-detail">across all objects</span>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('onelist')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('onelist') } }} aria-label={`Open Gaps: ${openGaps}, ${inProgressGaps} in progress`}>
          <div className="kpi-icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div className="kpi-data">
            <span className="kpi-value">{openGaps}</span>
            <span className="kpi-label">Open Gaps</span>
          </div>
          <span className="kpi-detail">{inProgressGaps} in progress</span>
        </div>

        <div className="kpi-card" style={{ cursor: 'default' }}>
          <div className={`kpi-icon ${staleCount > 0 ? 'red' : 'green'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="kpi-data">
            <span className="kpi-value">{staleCount}</span>
            <span className="kpi-label">Stale Objects</span>
          </div>
          <span className="kpi-detail">&gt;90 days since review</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Health Distribution */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Health Distribution</h3>
            <span className="dash-card-badge">{totalObjects} objects</span>
          </div>
          <div className="health-bars">
            {healthDist.map((h) => (
              <div key={h.id} className="health-bar-row">
                <div className="health-bar-label">
                  <span className="health-dot" style={{ backgroundColor: h.color }} aria-hidden="true" />
                  <span>{h.label}</span>
                </div>
                <div className="health-bar-track">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: totalObjects ? `${(h.count / totalObjects) * 100}%` : '0%',
                      backgroundColor: h.color,
                    }}
                  />
                </div>
                <span className="health-bar-count">{h.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gap Closure & CISO Trending */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Gap Summary</h3>
            <span className="dash-card-badge">{totalGaps} total</span>
          </div>
          <div className="gap-summary-visual">
            <div className="gap-donut-section">
              <div className="gap-donut">
                <svg viewBox="0 0 100 100">
                  {totalGaps > 0 ? (
                    <>
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                      {(() => {
                        const c = 2 * Math.PI * 40
                        const segments = [
                          { count: closedGaps, color: '#16a34a' },
                          { count: inProgressGaps, color: '#d97706' },
                          { count: openGaps, color: '#dc2626' },
                        ]
                        let offset = 0
                        return segments.map((seg, i) => {
                          const pct = seg.count / totalGaps
                          const dash = pct * c
                          const el = (
                            <circle
                              key={i}
                              cx="50" cy="50" r="40"
                              fill="none"
                              stroke={seg.color}
                              strokeWidth="12"
                              strokeDasharray={`${dash} ${c - dash}`}
                              strokeDashoffset={-offset}
                              transform="rotate(-90 50 50)"
                            />
                          )
                          offset += dash
                          return el
                        })
                      })()}
                    </>
                  ) : (
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  )}
                </svg>
                <div className="gap-donut-center">
                  <span className="gap-donut-value">{recentlyClosed}</span>
                  <span className="gap-donut-label">closed (30d)</span>
                </div>
              </div>
            </div>
            <div className="gap-legend">
              <div className="gap-legend-item">
                <span className="gap-legend-dot" style={{ backgroundColor: '#dc2626' }} />
                <span>Open</span>
                <strong>{openGaps}</strong>
              </div>
              <div className="gap-legend-item">
                <span className="gap-legend-dot" style={{ backgroundColor: '#d97706' }} />
                <span>In Progress</span>
                <strong>{inProgressGaps}</strong>
              </div>
              <div className="gap-legend-item">
                <span className="gap-legend-dot" style={{ backgroundColor: '#16a34a' }} />
                <span>Closed</span>
                <strong>{closedGaps}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Governance Maturity Distribution */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Governance Maturity</h3>
            <span className="dash-card-badge">{totalObjects - maturityDist.notAssessed.count} assessed</span>
          </div>
          <div className="health-bars">
            {maturityDist.tiers.map((t) => (
              <div key={t.id} className="health-bar-row">
                <div className="health-bar-label">
                  <span className="health-dot" style={{ backgroundColor: t.color }} />
                  <span>{t.label}</span>
                </div>
                <div className="health-bar-track">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: totalObjects ? `${(t.count / totalObjects) * 100}%` : '0%',
                      backgroundColor: t.color,
                    }}
                  />
                </div>
                <span className="health-bar-count">{t.count}</span>
              </div>
            ))}
            {maturityDist.notAssessed.count > 0 && (
              <div className="health-bar-row">
                <div className="health-bar-label">
                  <span className="health-dot" style={{ backgroundColor: '#94a3b8' }} />
                  <span>N/A</span>
                </div>
                <div className="health-bar-track">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: `${(maturityDist.notAssessed.count / totalObjects) * 100}%`,
                      backgroundColor: '#94a3b8',
                    }}
                  />
                </div>
                <span className="health-bar-count">{maturityDist.notAssessed.count}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dash-card full-width">
          <div className="dash-card-header">
            <h3>Recently Updated Objects</h3>
            <button className="link-btn" onClick={() => onNavigate('objects')}>
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <p>No objects in the registry yet.</p>
              <button className="btn-primary small" onClick={() => onNavigate('objects')}>
                Add your first object
              </button>
            </div>
          ) : (
            <div className="recent-table">
              <div className="recent-row recent-header">
                <span>Name</span>
                <span>Health</span>
                <span>Compliance</span>
                <span>Owner</span>
                <span>Updated</span>
              </div>
              {recent.map((obj) => {
                const hs = HEALTH_STATUSES.find((h) => h.id === obj.healthStatus) || HEALTH_STATUSES[2]
                return (
                  <div
                    key={obj.id}
                    className="recent-row"
                    onClick={() => onNavigate('object-detail', obj.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('object-detail', obj.id) } }}
                  >
                    <span className="recent-name">{obj.listName || 'Untitled'}</span>
                    <span>
                      <span className="health-tag" style={{ backgroundColor: hs.bg, color: hs.color }}>
                        {hs.label}
                      </span>
                    </span>
                    <span>{obj.compliancePercent}%</span>
                    <span className="text-muted">{obj.owner || '—'}</span>
                    <span className="text-muted">{formatDate(obj.updatedAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Overdue Actions */}
        {overdueActions > 0 && (
          <div className="dash-card full-width alert-card">
            <div className="alert-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>
                <strong>{overdueActions} overdue</strong> standup action{overdueActions !== 1 ? 's' : ''} require attention
              </span>
              <button className="link-btn" onClick={() => onNavigate('standup')}>
                View actions
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Trending Section ═══ */}
      {totalObjects > 0 && (
        <div className="trending-section">
          <h2 className="trending-section-title">Trending</h2>

          <div className="trending-grid">
            {/* ── Posture River ── */}
            <div className="dash-card">
              <div className="dash-card-header">
                <h3>Security Posture</h3>
                <span className="dash-card-badge">12 weeks</span>
              </div>
              <PostureRiver data={postureData} />
            </div>

            {/* ── Gap Velocity ── */}
            <div className="dash-card">
              <div className="dash-card-header">
                <h3>Gap Velocity</h3>
                <span className="dash-card-badge">opened vs closed</span>
              </div>
              <GapVelocityChart data={gapVelocity} />
            </div>

            {/* ── Review Heatmap ── */}
            <div className="dash-card full-width">
              <div className="dash-card-header">
                <h3>Review Activity</h3>
                <span className="dash-card-badge">last 90 days</span>
              </div>
              <ReviewHeatmap data={heatmapData} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ Coverage Matrix ═══ */}
      {totalObjects > 0 && (
        <div className="trending-section">
          <h2 className="trending-section-title">Coverage Matrix</h2>
          <div className="dash-card full-width">
            <div className="coverage-table-wrapper scroll-hint-wrapper">
              <table className="coverage-table">
                <thead>
                  <tr>
                    <th>Product Family</th>
                    <th>Objects</th>
                    <th>Avg Compliance</th>
                    <th>Formal %</th>
                    <th>Health</th>
                    <th>Maturity</th>
                    <th>Open Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageData.map((row) => (
                    <tr key={row.family} className={row.count === 0 ? 'coverage-empty' : ''}>
                      <td className="coverage-family">{row.family}</td>
                      <td>
                        {row.count === 0 ? (
                          <span className="coverage-blind-spot">No coverage</span>
                        ) : (
                          <span className="coverage-count">{row.count}</span>
                        )}
                      </td>
                      <td>
                        {row.count > 0 && (
                          <div className="coverage-bar-cell">
                            <div className="coverage-bar-track">
                              <div
                                className="coverage-bar-fill"
                                style={{
                                  width: `${row.avgComp}%`,
                                  backgroundColor: row.avgComp >= 80 ? '#16a34a' : row.avgComp >= 50 ? '#d97706' : '#dc2626',
                                }}
                              />
                            </div>
                            <span className="coverage-bar-label">{row.avgComp}%</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {row.count > 0 && (
                          <span className={`coverage-formal ${row.formalPct >= 75 ? 'high' : row.formalPct >= 40 ? 'mid' : 'low'}`}>
                            {row.formalPct}%
                          </span>
                        )}
                      </td>
                      <td>
                        {row.count > 0 && (
                          <div className="coverage-health-dots">
                            {row.redCount > 0 && <span className="coverage-dot red">{row.redCount}</span>}
                            {row.amberCount > 0 && <span className="coverage-dot amber">{row.amberCount}</span>}
                            {row.greenCount > 0 && <span className="coverage-dot green">{row.greenCount}</span>}
                            {row.blueCount > 0 && <span className="coverage-dot blue">{row.blueCount}</span>}
                          </div>
                        )}
                      </td>
                      <td>
                        {row.avgMaturity != null ? (
                          <span className="coverage-bar-label" style={{ color: row.avgMaturity >= 16 ? '#2563eb' : row.avgMaturity >= 11 ? '#16a34a' : row.avgMaturity >= 6 ? '#ea580c' : '#dc2626' }}>
                            {row.avgMaturity}/20
                          </span>
                        ) : row.count > 0 ? (
                          <span className="text-muted">—</span>
                        ) : null}
                      </td>
                      <td>
                        {row.openGaps > 0 ? (
                          <span className="coverage-gaps">{row.openGaps}</span>
                        ) : row.count > 0 ? (
                          <span className="text-muted">0</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Owner Portfolio ═══ */}
      {ownerData.length > 0 && (
        <div className="trending-section">
          <h2 className="trending-section-title">Owner Portfolio</h2>
          <div className="dash-card full-width">
            <div className="coverage-table-wrapper">
              <table className="coverage-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Objects</th>
                    <th>Avg Compliance</th>
                    <th>Health</th>
                    <th>Maturity</th>
                    <th>Open Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerData.map((row) => (
                    <tr key={row.owner}>
                      <td className="coverage-family">{row.owner}</td>
                      <td><span className="coverage-count">{row.count}</span></td>
                      <td>
                        <div className="coverage-bar-cell">
                          <div className="coverage-bar-track">
                            <div
                              className="coverage-bar-fill"
                              style={{
                                width: `${row.avgComp}%`,
                                backgroundColor: row.avgComp >= 80 ? '#16a34a' : row.avgComp >= 50 ? '#d97706' : '#dc2626',
                              }}
                            />
                          </div>
                          <span className="coverage-bar-label">{row.avgComp}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="coverage-health-dots">
                          {row.redCount > 0 && <span className="coverage-dot red">{row.redCount}</span>}
                          {row.amberCount > 0 && <span className="coverage-dot amber">{row.amberCount}</span>}
                          {row.greenCount > 0 && <span className="coverage-dot green">{row.greenCount}</span>}
                          {row.blueCount > 0 && <span className="coverage-dot blue">{row.blueCount}</span>}
                        </div>
                      </td>
                      <td>
                        {row.avgMaturity != null ? (
                          <span className="coverage-bar-label" style={{ color: row.avgMaturity >= 16 ? '#2563eb' : row.avgMaturity >= 11 ? '#16a34a' : row.avgMaturity >= 6 ? '#ea580c' : '#dc2626' }}>
                            {row.avgMaturity}/20
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {row.gapCount > 0 ? (
                          <span className="coverage-gaps">{row.gapCount}</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
