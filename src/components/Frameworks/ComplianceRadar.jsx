import React from 'react'

/**
 * Reusable N-point radar chart component
 * points: [{ label, value (0-1 or 0-maxValue), color }]
 * maxValue: max data value (default 1.0 for compliance %, or 5 for maturity levels)
 * fillColor: polygon fill (default rgba blue)
 * strokeColor: polygon stroke
 */
export default function ComplianceRadar({
  points,
  maxValue = 1,
  size = 360,
  fillColor = 'rgba(37,99,235,0.12)',
  strokeColor = '#2563eb',
  showLabels = true,
  ringCount = 5,
}) {
  if (!points || points.length < 3) return null

  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - (showLabels ? 50 : 20)
  const n = points.length
  const angleStep = (2 * Math.PI) / n

  const polar = (i, r) => {
    const a = -Math.PI / 2 + i * angleStep
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  // Grid rings
  const rings = Array.from({ length: ringCount }, (_, i) => i + 1)
  const ringPaths = rings.map((level) => {
    const r = (level / ringCount) * maxR
    return points.map((_, i) => polar(i, r)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
  })

  // Spokes
  const spokes = points.map((_, i) => {
    const outer = polar(i, maxR)
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y }
  })

  // Data polygon
  const dataPoints = points.map((p, i) => polar(i, (Math.min(p.value, maxValue) / maxValue) * maxR))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  // Labels
  const labelOffset = maxR + 28

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[420px] h-auto">
      {/* Grid rings */}
      {ringPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth={i === ringCount - 1 ? '1.5' : '0.8'} opacity={i === ringCount - 1 ? 1 : 0.6} />
      ))}
      {/* Spokes */}
      {spokes.map((s, i) => (
        <line key={i} {...s} stroke="#e5e7eb" strokeWidth="0.6" />
      ))}
      {/* Data fill */}
      <path d={dataPath} fill={fillColor} stroke={strokeColor} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="5" fill={points[i].color || strokeColor} stroke="white" strokeWidth="2" />
      ))}
      {/* Labels */}
      {showLabels && points.map((pt, i) => {
        const lp = polar(i, labelOffset)
        const angle = -Math.PI / 2 + i * angleStep
        let anchor = 'middle'
        if (Math.cos(angle) > 0.3) anchor = 'start'
        else if (Math.cos(angle) < -0.3) anchor = 'end'
        return (
          <g key={i}>
            <text x={lp.x} y={lp.y - 4} textAnchor={anchor} fontSize="9" fontWeight="700" fill={pt.color || '#374151'} fontFamily="Inter,sans-serif">
              {pt.label}
            </text>
            <text x={lp.x} y={lp.y + 8} textAnchor={anchor} fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">
              {maxValue <= 1 ? `${Math.round(pt.value * 100)}%` : pt.value.toFixed(1)}
            </text>
          </g>
        )
      })}
      {/* Ring level labels on first spoke */}
      {rings.map((level) => {
        const p = polar(0, (level / ringCount) * maxR)
        return (
          <text key={level} x={p.x + 4} y={p.y - 3} fontSize="7.5" fill="#9ca3af" fontFamily="Inter,sans-serif">
            {maxValue <= 1 ? `${Math.round((level / ringCount) * 100)}%` : level}
          </text>
        )
      })}
    </svg>
  )
}
