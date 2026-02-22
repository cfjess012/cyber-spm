// ═══════════════════════════════════════════
// Safeguard-Level Scoring Engine
// Dual-axis: Policy Status + Implementation Status
// Used by CIS v8, NIST CSF 2.0, GLBA, NYDFS
// ═══════════════════════════════════════════

export const POLICY_STATUSES = [
  { id: 'no_policy',            label: 'No Policy',          value: 0 },
  { id: 'undocumented',         label: 'Undocumented',       value: 0.17 },
  { id: 'partial',              label: 'Partial',            value: 0.33 },
  { id: 'fully_documented',     label: 'Fully Documented',   value: 0.67 },
  { id: 'approved_documented',  label: 'Approved',           value: 1.0 },
  { id: 'na',                   label: 'N/A',                value: null },
]

export const IMPLEMENTATION_STATUSES = [
  { id: 'not_implemented',  label: 'Not Implemented',  value: 0 },
  { id: 'parts',            label: 'Parts',            value: 0.17 },
  { id: 'some_systems',     label: 'Some Systems',     value: 0.33 },
  { id: 'most_systems',     label: 'Most Systems',     value: 0.67 },
  { id: 'all_systems',      label: 'All Systems',      value: 1.0 },
  { id: 'na',               label: 'N/A',              value: null },
]

/**
 * Compute score for a single safeguard from policy + implementation status IDs
 * Returns null if both are N/A or neither is set
 * Returns 0-1 score otherwise (Policy * 0.4 + Implementation * 0.6)
 */
export function computeSafeguardScore(policyId, implementationId) {
  if (!policyId && !implementationId) return null
  if (policyId === 'na' && implementationId === 'na') return null
  if (policyId === 'na' && !implementationId) return null
  if (!policyId && implementationId === 'na') return null

  const policyDef = POLICY_STATUSES.find((s) => s.id === policyId)
  const implDef = IMPLEMENTATION_STATUSES.find((s) => s.id === implementationId)

  const policyVal = policyDef?.value ?? 0
  const implVal = implDef?.value ?? 0

  // If one axis is N/A, use only the other axis
  if (policyId === 'na') return implVal
  if (implementationId === 'na') return policyVal

  return policyVal * 0.4 + implVal * 0.6
}

/**
 * Compute aggregate score for a group/domain from its safeguard assessments
 * safeguards: array of safeguard definitions
 * assessments: { [safeguardId]: { policy, implementation } }
 * igFilter: optional IG filter for CIS (1, 2, or 3). If provided, only safeguards matching the filter are included.
 * Returns { score: 0-1, assessed: number, total: number, excluded: number }
 */
export function computeGroupScore(safeguards, assessments = {}, igFilter) {
  let scored = []
  let assessed = 0
  let excluded = 0

  for (const sg of safeguards) {
    // IG filtering for CIS
    if (igFilter && sg.ig) {
      const minIg = Math.min(...sg.ig)
      if (minIg > igFilter) {
        excluded++
        continue
      }
    }

    const a = assessments[sg.id]
    if (!a) continue

    const score = computeSafeguardScore(a.policy, a.implementation)
    if (score !== null) {
      scored.push(score)
      assessed++
    } else if (a.policy === 'na' || a.implementation === 'na') {
      excluded++
    }
  }

  const filteredTotal = safeguards.length - excluded
  const avgScore = scored.length > 0 ? scored.reduce((s, v) => s + v, 0) / scored.length : 0

  return {
    score: avgScore,
    assessed,
    total: filteredTotal,
    excluded,
  }
}

/**
 * Map a 0-1 compliance score to CMMI maturity level (0-5)
 */
export function scoreToMaturity(score) {
  if (score <= 0.10) return 0
  if (score <= 0.30) return 1
  if (score <= 0.55) return 2
  if (score <= 0.75) return 3
  if (score <= 0.90) return 4
  return 5
}

/**
 * Compute a full framework assessment from safeguard data
 * groups: array of { id, safeguards: [...] } (or domains)
 * assessments: { [safeguardId]: { policy, implementation, note?, updatedAt? } }
 * igFilter: optional CIS IG filter
 * Returns { groups: [{ id, score, maturity, assessed, total }], overall: { score, maturity, assessed, total } }
 */
export function computeFrameworkAssessment(groups, assessments = {}, igFilter) {
  const groupResults = groups.map((group) => {
    const result = computeGroupScore(group.safeguards, assessments, igFilter)
    return {
      id: group.id,
      ...result,
      maturity: scoreToMaturity(result.score),
    }
  })

  // Overall: average of scored groups (groups with at least 1 assessed safeguard)
  const scoredGroups = groupResults.filter((g) => g.assessed > 0)
  const overallScore = scoredGroups.length > 0
    ? scoredGroups.reduce((s, g) => s + g.score, 0) / scoredGroups.length
    : 0
  const totalAssessed = groupResults.reduce((s, g) => s + g.assessed, 0)
  const totalSafeguards = groupResults.reduce((s, g) => s + g.total, 0)

  return {
    groups: groupResults,
    overall: {
      score: overallScore,
      maturity: scoreToMaturity(overallScore),
      assessed: totalAssessed,
      total: totalSafeguards,
    },
  }
}

/**
 * Get color for a safeguard score (0-1)
 * Returns hex color string
 */
export function scoreColor(score) {
  if (score === null || score === undefined) return '#94a3b8' // gray
  if (score < 0.3) return '#dc2626'  // red
  if (score <= 0.6) return '#ea580c' // amber
  return '#16a34a'                   // green
}

/**
 * Get background color for a safeguard score (0-1)
 */
export function scoreBg(score) {
  if (score === null || score === undefined) return '#f1f5f9' // gray
  if (score < 0.3) return '#fef2f2'  // red
  if (score <= 0.6) return '#fff7ed' // amber
  return '#f0fdf4'                   // green
}
