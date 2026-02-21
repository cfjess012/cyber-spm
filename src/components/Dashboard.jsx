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
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
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
      <div className="flex items-center gap-4 mt-2 px-1">
        {layers.slice().reverse().map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-[0.72rem] text-txt-3 font-medium">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[l] }} />
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
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
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
      <div className="flex items-center gap-4 mt-2 px-1">
        <span className="flex items-center gap-1.5 text-[0.72rem] text-txt-3 font-medium"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#dc2626' }} />Intake</span>
        <span className="flex items-center gap-1.5 text-[0.72rem] text-txt-3 font-medium"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#16a34a' }} />Resolved</span>
        <span className="flex items-center gap-1.5 text-[0.72rem] text-txt-3 font-medium" style={{ marginLeft: 'auto', fontWeight: 700, color: trending === 'improving' ? '#16a34a' : '#dc2626' }}>
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
    <div data-heatmap style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
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
                  const parent = e.currentTarget.closest('[data-heatmap]').getBoundingClientRect()
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
        <div className="absolute bg-[#1e293b] text-white text-[0.72rem] rounded-lg px-3 py-2 -translate-x-1/2 -translate-y-full flex flex-col gap-0.5 pointer-events-none shadow-lg z-50" style={{ position: 'absolute', left: `${tooltip._x || 0}px`, top: `${tooltip._y || 0}px` }}>
          <strong className="font-bold">{tooltip.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
          <span>{tooltip.count} object{tooltip.count !== 1 ? 's' : ''} updated</span>
          {tooltip.avgCompliance !== null && <span>Avg compliance: {tooltip.avgCompliance}%</span>}
          {tooltip.gapsOpened > 0 && <span>{tooltip.gapsOpened} pipeline item{tooltip.gapsOpened !== 1 ? 's' : ''} created</span>}
        </div>
      )}
      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 justify-center">
        <span className="text-[0.68rem] text-txt-3">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <span key={v} className="w-3 h-3 rounded-sm" style={{ backgroundColor: v === 0 ? '#f1f5f9' : `rgba(22,163,74,${0.3 + v * 0.7})` }} />
        ))}
        <span className="text-[0.68rem] text-txt-3">More</span>
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
  const untriagedCount = gaps.filter((g) => !g.triaged).length

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
      const remItems = familyObjs.reduce((sum, o) =>
        sum + (o.remediationItems || []).filter(i => i.status !== 'Resolved').length, 0)
      // Avg maturity for assessed objects in this family
      const assessed = familyObjs.filter((o) => mlgAssessments[o.id])
      const avgMaturity = assessed.length
        ? Math.round(assessed.reduce((s, o) => s + computeMLGScore(mlgAssessments[o.id], o).score, 0) / assessed.length * 10) / 10
        : null
      const assessedCount = assessed.length
      return { family, count, avgComp, formalPct, redCount, amberCount, greenCount, blueCount, remItems, avgMaturity, assessedCount }
    })
  }, [objects, mlgAssessments])

  // ── Owner Portfolio Roll-up ──
  const ownerData = useMemo(() => {
    const ownerMap = {}
    objects.forEach((o) => {
      const owner = o.owner || 'Unassigned'
      if (!ownerMap[owner]) ownerMap[owner] = { owner, objects: [] }
      ownerMap[owner].objects.push(o)
    })
    return Object.values(ownerMap)
      .map((d) => {
        const assessed = d.objects.filter((o) => mlgAssessments[o.id])
        const avgMaturity = assessed.length
          ? Math.round(assessed.reduce((s, o) => s + computeMLGScore(mlgAssessments[o.id], o).score, 0) / assessed.length * 10) / 10
          : null
        const remCount = d.objects.reduce((sum, o) =>
          sum + (o.remediationItems || []).filter(i => i.status !== 'Resolved').length, 0)
        return {
          owner: d.owner,
          count: d.objects.length,
          avgComp: Math.round(d.objects.reduce((s, o) => s + (o.compliancePercent || 0), 0) / d.objects.length),
          redCount: d.objects.filter((o) => o.healthStatus === 'RED').length,
          amberCount: d.objects.filter((o) => o.healthStatus === 'AMBER').length,
          greenCount: d.objects.filter((o) => o.healthStatus === 'GREEN').length,
          blueCount: d.objects.filter((o) => o.healthStatus === 'BLUE').length,
          remCount,
          avgMaturity,
        }
      })
      .sort((a, b) => b.redCount - a.redCount || b.amberCount - a.amberCount || b.remCount - a.remCount)
  }, [objects, mlgAssessments])

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.75rem] font-[800] tracking-tight text-txt leading-tight">CISO Dashboard</h1>
          <p className="text-txt-3 text-[0.88rem] mt-1 tracking-tight">Security product management overview</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer" onClick={() => onNavigate('objects')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('objects') } }} aria-label={`Total Objects: ${totalObjects}, ${activeObjects} active`}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-blue-bg text-brand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-[800] tracking-tight text-txt">{totalObjects}</span>
            <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wider mt-0.5">Total Objects</span>
          </div>
          <span className="text-[0.72rem] text-txt-3 font-medium mt-auto">{activeObjects} active</span>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ cursor: 'default' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-green-bg text-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-[800] tracking-tight text-txt">{avgCompliance}%</span>
            <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wider mt-0.5">Avg Compliance</span>
          </div>
          <span className="text-[0.72rem] text-txt-3 font-medium mt-auto">across all objects</span>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer" onClick={() => onNavigate('onelist')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('onelist') } }} aria-label={`Pipeline Items: ${openGaps}, ${inProgressGaps} in progress`}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-bg text-amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-[800] tracking-tight text-txt">{openGaps}</span>
            <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wider mt-0.5">Pipeline Items</span>
          </div>
          <span className="text-[0.72rem] text-txt-3 font-medium mt-auto">{inProgressGaps} in progress{untriagedCount > 0 ? ` · ${untriagedCount} to triage` : ''}</span>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ cursor: 'default' }}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${staleCount > 0 ? 'bg-red-bg text-red' : 'bg-green-bg text-green'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-[800] tracking-tight text-txt">{staleCount}</span>
            <span className="text-[0.72rem] font-semibold text-txt-3 uppercase tracking-wider mt-0.5">Stale Objects</span>
          </div>
          <span className="text-[0.72rem] text-txt-3 font-medium mt-auto">&gt;90 days since review</span>
        </div>
      </div>

      {/* Triage Alert */}
      {untriagedCount > 0 && (
        <div className="bg-amber-bg/50 backdrop-blur-xl rounded-xl border border-amber/10 p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="flex-1 text-[0.85rem] text-txt">
              <strong>{untriagedCount} pipeline item{untriagedCount !== 1 ? 's' : ''}</strong> awaiting triage
            </span>
            <button
              className="bg-transparent border-none text-amber cursor-pointer font-sans text-[0.82rem] font-semibold hover:text-amber/80 transition-colors p-0"
              onClick={() => onNavigate('onelist')}
            >
              View queue &rarr;
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Health Distribution */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Health Distribution</h3>
            <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{totalObjects} objects</span>
          </div>
          <div className="flex flex-col gap-3">
            {healthDist.map((h) => (
              <div key={h.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-[80px] shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} aria-hidden="true" />
                  <span className="text-[0.82rem] text-txt-2 font-medium">{h.label}</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-border-light overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: totalObjects ? `${(h.count / totalObjects) * 100}%` : '0%',
                      backgroundColor: h.color,
                    }}
                  />
                </div>
                <span className="text-[0.82rem] font-semibold text-txt w-6 text-right">{h.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gap Closure & CISO Trending */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Pipeline Summary</h3>
            <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{totalGaps} total</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="shrink-0">
              <div className="w-[120px] h-[120px] relative">
                <svg viewBox="0 0 100 100" className="w-full h-full">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-[800] text-txt">{recentlyClosed}</span>
                  <span className="text-[0.62rem] text-txt-3 font-medium">closed (30d)</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#dc2626' }} />
                <span className="text-[0.82rem] text-txt-2">Open</span>
                <strong className="font-[700] text-txt ml-auto">{openGaps}</strong>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#d97706' }} />
                <span className="text-[0.82rem] text-txt-2">In Progress</span>
                <strong className="font-[700] text-txt ml-auto">{inProgressGaps}</strong>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#16a34a' }} />
                <span className="text-[0.82rem] text-txt-2">Closed</span>
                <strong className="font-[700] text-txt ml-auto">{closedGaps}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Governance Maturity Distribution */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Governance Maturity</h3>
            <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">{totalObjects - maturityDist.notAssessed.count} assessed</span>
          </div>
          <div className="flex flex-col gap-3">
            {maturityDist.tiers.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-[80px] shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-[0.82rem] text-txt-2 font-medium">{t.label}</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-border-light overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: totalObjects ? `${(t.count / totalObjects) * 100}%` : '0%',
                      backgroundColor: t.color,
                    }}
                  />
                </div>
                <span className="text-[0.82rem] font-semibold text-txt w-6 text-right">{t.count}</span>
              </div>
            ))}
            {maturityDist.notAssessed.count > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-[80px] shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#94a3b8' }} />
                  <span className="text-[0.82rem] text-txt-2 font-medium">N/A</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-border-light overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(maturityDist.notAssessed.count / totalObjects) * 100}%`,
                      backgroundColor: '#94a3b8',
                    }}
                  />
                </div>
                <span className="text-[0.82rem] font-semibold text-txt w-6 text-right">{maturityDist.notAssessed.count}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Recently Updated Objects</h3>
            <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.82rem] font-semibold hover:text-brand-deep transition-colors p-0" onClick={() => onNavigate('objects')}>
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-txt-3 text-[0.85rem]">
              <p>No objects in the registry yet.</p>
              <button className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200" onClick={() => onNavigate('objects')}>
                Add your first object
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 border-b border-border-light">
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
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b border-border-light last:border-0 cursor-pointer transition-colors hover:bg-brand/[0.03]"
                    onClick={() => onNavigate('object-detail', obj.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('object-detail', obj.id) } }}
                  >
                    <span className="text-[0.85rem] font-semibold text-txt truncate">{obj.listName || 'Untitled'}</span>
                    <span>
                      <span className="inline-flex text-[0.68rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: hs.bg, color: hs.color }}>
                        {hs.label}
                      </span>
                    </span>
                    <span className="text-[0.82rem] text-txt font-medium">{obj.compliancePercent}%</span>
                    <span className="text-[0.82rem] text-txt-3">{obj.owner || '—'}</span>
                    <span className="text-[0.82rem] text-txt-3">{formatDate(obj.updatedAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Overdue Actions */}
        {overdueActions > 0 && (
          <div className="md:col-span-2 bg-red-bg/50 backdrop-blur-xl rounded-xl border border-red/10 p-4">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="flex-1 text-[0.85rem] text-txt">
                <strong>{overdueActions} overdue</strong> standup action{overdueActions !== 1 ? 's' : ''} require attention
              </span>
              <button className="bg-transparent border-none text-brand cursor-pointer font-sans text-[0.82rem] font-semibold hover:text-brand-deep transition-colors p-0" onClick={() => onNavigate('standup')}>
                View actions
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Trending Section ═══ */}
      {totalObjects > 0 && (
        <div className="mb-8">
          <h2 className="text-[1.25rem] font-[800] tracking-tight text-txt mb-4">Trending</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Posture River ── */}
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Security Posture</h3>
                <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">12 weeks</span>
              </div>
              <PostureRiver data={postureData} />
            </div>

            {/* ── Gap Velocity ── */}
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Pipeline Velocity</h3>
                <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">intake vs resolved</span>
              </div>
              <GapVelocityChart data={gapVelocity} />
            </div>

            {/* ── Review Heatmap ── */}
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[0.95rem] font-bold tracking-tight text-txt">Review Activity</h3>
                <span className="text-[0.72rem] font-medium text-txt-3 bg-subtle px-2 py-0.5 rounded-full">last 90 days</span>
              </div>
              <ReviewHeatmap data={heatmapData} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ Coverage Matrix ═══ */}
      {totalObjects > 0 && (
        <div className="mb-8">
          <h2 className="text-[1.25rem] font-[800] tracking-tight text-txt mb-4">Coverage Matrix</h2>
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 md:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[0.82rem]">
                <thead className="bg-subtle/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Product Family</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Objects</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Avg Compliance</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Formal %</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Health</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Maturity</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Rem. Items</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageData.map((row) => (
                    <tr key={row.family} className={`border-b border-border-light last:border-0 hover:bg-brand/[0.02] transition-colors ${row.count === 0 ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 text-[0.85rem] font-semibold text-txt">{row.family}</td>
                      <td className="px-4 py-3">
                        {row.count === 0 ? (
                          <span className="text-[0.72rem] text-red font-medium italic">No coverage</span>
                        ) : (
                          <span className="text-[0.85rem] font-semibold text-txt">{row.count}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.count > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-[60px] h-[5px] rounded-full bg-border-light overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${row.avgComp}%`,
                                  backgroundColor: row.avgComp >= 80 ? '#16a34a' : row.avgComp >= 50 ? '#d97706' : '#dc2626',
                                }}
                              />
                            </div>
                            <span className="text-[0.82rem] font-semibold">{row.avgComp}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.count > 0 && (
                          <span className={`text-[0.82rem] font-semibold ${row.formalPct >= 75 ? 'text-green' : row.formalPct >= 40 ? 'text-amber' : 'text-red'}`}>
                            {row.formalPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.count > 0 && (
                          <div className="flex items-center gap-1.5">
                            {row.redCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-red-bg text-red">{row.redCount}</span>}
                            {row.amberCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-amber-bg text-amber">{row.amberCount}</span>}
                            {row.greenCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-green-bg text-green">{row.greenCount}</span>}
                            {row.blueCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-blue-bg text-brand">{row.blueCount}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.avgMaturity != null ? (
                          <span className="text-[0.82rem] font-semibold" style={{ color: row.avgMaturity >= 16 ? '#2563eb' : row.avgMaturity >= 11 ? '#16a34a' : row.avgMaturity >= 6 ? '#ea580c' : '#dc2626' }}>
                            {row.avgMaturity}/20
                          </span>
                        ) : row.count > 0 ? (
                          <span className="text-txt-3">—</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {row.remItems > 0 ? (
                          <span className="text-red font-bold">{row.remItems}</span>
                        ) : row.count > 0 ? (
                          <span className="text-txt-3">0</span>
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
        <div className="mb-8">
          <h2 className="text-[1.25rem] font-[800] tracking-tight text-txt mb-4">Owner Portfolio</h2>
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 md:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[0.82rem]">
                <thead className="bg-subtle/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Owner</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Objects</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Avg Compliance</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Health</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Maturity</th>
                    <th className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-txt-3 px-4 py-3 border-b border-border-light">Rem. Items</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerData.map((row) => (
                    <tr key={row.owner} className="border-b border-border-light last:border-0 hover:bg-brand/[0.02] transition-colors">
                      <td className="px-4 py-3 text-[0.85rem] font-semibold text-txt">{row.owner}</td>
                      <td className="px-4 py-3"><span className="text-[0.85rem] font-semibold text-txt">{row.count}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-[60px] h-[5px] rounded-full bg-border-light overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${row.avgComp}%`,
                                backgroundColor: row.avgComp >= 80 ? '#16a34a' : row.avgComp >= 50 ? '#d97706' : '#dc2626',
                              }}
                            />
                          </div>
                          <span className="text-[0.82rem] font-semibold">{row.avgComp}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.redCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-red-bg text-red">{row.redCount}</span>}
                          {row.amberCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-amber-bg text-amber">{row.amberCount}</span>}
                          {row.greenCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-green-bg text-green">{row.greenCount}</span>}
                          {row.blueCount > 0 && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-blue-bg text-brand">{row.blueCount}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.avgMaturity != null ? (
                          <span className="text-[0.82rem] font-semibold" style={{ color: row.avgMaturity >= 16 ? '#2563eb' : row.avgMaturity >= 11 ? '#16a34a' : row.avgMaturity >= 6 ? '#ea580c' : '#dc2626' }}>
                            {row.avgMaturity}/20
                          </span>
                        ) : (
                          <span className="text-txt-3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.remCount > 0 ? (
                          <span className="text-red font-bold">{row.remCount}</span>
                        ) : (
                          <span className="text-txt-3">0</span>
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
