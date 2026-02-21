import { STALENESS_DAYS, POSTURE_LEVELS, computeMLGScore } from '../data/constants.js'

export function calcCompliance(numerator, denominator) {
  if (!denominator || denominator === 0) return 0
  return Math.round((numerator / denominator) * 100 * 10) / 10
}

export function isStale(lastReviewDate) {
  if (!lastReviewDate) return true
  const diff = Date.now() - new Date(lastReviewDate).getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > STALENESS_DAYS
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function uuid() {
  return crypto.randomUUID()
}

// ── Posture Scoring Weights (4 signals) ──
export const POSTURE_WEIGHTS = {
  health:    { weight: 0.30, label: 'Health',    max: 30 },
  coverage:  { weight: 0.30, label: 'Coverage',  max: 30 },
  freshness: { weight: 0.20, label: 'Freshness', max: 20 },
  maturity:  { weight: 0.20, label: 'Maturity',  max: 20 },
}

// ── Signal Functions ──

function healthSignal(status) {
  if (status === 'GREEN') return 100
  if (status === 'AMBER') return 50
  if (status === 'RED') return 10
  if (status === 'BLUE') return 0 // NEW — score should reflect onboarding state
  return 50 // unknown — neutral
}

function freshnessSignal(lastReviewDate) {
  if (!lastReviewDate) return 50
  const days = daysSince(lastReviewDate)
  if (days <= 30)  return 100  // Weekly / Bi-Weekly cadence
  if (days <= 60)  return 85   // Monthly cadence
  if (days <= 90)  return 70   // Quarterly cadence
  if (days <= 120) return 55   // Quarterly + buffer
  if (days <= 180) return 35   // Semi-annual
  return 10                    // Overdue
}

function maturitySignal(mlgAssessment, obj) {
  if (!mlgAssessment && !obj) return 50
  const { score } = computeMLGScore(mlgAssessment, obj)
  return (score / 20) * 100
}

/**
 * Computes a weighted Posture score (0-100) for an object.
 *
 * Inputs (4 signals):
 *   health (30%), coverage (30%), freshness (20%), maturity (20%)
 *
 * Adjustments:
 *   - Informal classification: 5% score reduction (scales proportionally)
 *   - Criticality: shifts label thresholds (High/Critical = stricter)
 *   - BLUE health: forces NEW label regardless of score
 *
 * Returns: { ...POSTURE_LEVEL, score, breakdown }
 */
export function computePosture(obj, { mlgAssessment = null } = {}) {
  const health = obj.healthStatus || 'GREEN'
  const type = obj.type || 'Control'
  const crit = obj.criticality || 'Medium'
  const highCrit = crit === 'Critical' || crit === 'High'

  const signals = {
    health:    healthSignal(health),
    coverage:  obj.compliancePercent ?? 0,
    freshness: freshnessSignal(obj.lastReviewDate),
    maturity:  maturitySignal(mlgAssessment, obj),
  }

  let score = 0
  const breakdown = {}
  for (const [key, cfg] of Object.entries(POSTURE_WEIGHTS)) {
    const value = Math.round(signals[key])
    const weighted = Math.round(value * cfg.weight * 10) / 10
    breakdown[key] = { value, weighted, max: cfg.max, label: cfg.label }
    score += weighted
  }

  // Informal classification penalty — only applies to Controls
  if (type === 'Control' && obj.controlClassification === 'Informal') {
    const penalty = Math.round(score * 0.05)
    score -= penalty
    breakdown.classificationAdjustment = -penalty
  } else {
    breakdown.classificationAdjustment = 0
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  const find = (id) => POSTURE_LEVELS.find((p) => p.id === id)

  // BLUE health → NEW regardless of score (onboarding)
  if (health === 'BLUE') {
    return { ...find('NEW'), score, breakdown }
  }

  // Criticality shifts thresholds — high-crit objects need higher scores
  const thresholds = highCrit
    ? { healthy: 75, atRisk: 45 }
    : { healthy: 65, atRisk: 35 }

  let posture
  if (score >= thresholds.healthy) posture = find('HEALTHY')
  else if (score >= thresholds.atRisk) posture = find('AT_RISK')
  else posture = find('CRITICAL')

  return { ...posture, score, breakdown, thresholds }
}
