// ── NIST 800-53 Control Families ──
export const NIST_FAMILIES = [
  { id: 'AC', name: 'Access Control' },
  { id: 'AT', name: 'Awareness and Training' },
  { id: 'AU', name: 'Audit and Accountability' },
  { id: 'CA', name: 'Assessment, Authorization, and Monitoring' },
  { id: 'CM', name: 'Configuration Management' },
  { id: 'CP', name: 'Contingency Planning' },
  { id: 'IA', name: 'Identification and Authentication' },
  { id: 'IR', name: 'Incident Response' },
  { id: 'MA', name: 'Maintenance' },
  { id: 'MP', name: 'Media Protection' },
  { id: 'PE', name: 'Physical and Environmental Protection' },
  { id: 'PL', name: 'Planning' },
  { id: 'PM', name: 'Program Management' },
  { id: 'PS', name: 'Personnel Security' },
  { id: 'PT', name: 'Personally Identifiable Information Processing' },
  { id: 'RA', name: 'Risk Assessment' },
  { id: 'SA', name: 'System and Services Acquisition' },
  { id: 'SC', name: 'System and Communications Protection' },
  { id: 'SI', name: 'System and Information Integrity' },
  { id: 'SR', name: 'Supply Chain Risk Management' },
]

// ── 7 Core Product Families ──
export const PRODUCT_FAMILIES = [
  'AI Security',
  'Data Protection',
  'Insider Risk',
  'Identity & Access Management',
  'Software Security Services',
  'Vulnerability Management',
  'BISO',
]

// ── Object Types ──
export const OBJECT_TYPES = [
  'Control',
  'Process',
  'Procedure',
]

// ── Criticality Levels ──
export const CRITICALITY_LEVELS = ['Low', 'Medium', 'High', 'Critical']

// ── Health Statuses (RAG + Blue) ──
export const HEALTH_STATUSES = [
  { id: 'RED', label: 'Red', color: '#dc2626', bg: '#fef2f2' },
  { id: 'AMBER', label: 'Amber', color: '#ea580c', bg: '#fff7ed' },
  { id: 'GREEN', label: 'Green', color: '#16a34a', bg: '#f0fdf4' },
  { id: 'BLUE', label: 'Blue', color: '#2563eb', bg: '#eff6ff' },
]

// ── Posture Levels (unified signal for list view) ──
export const POSTURE_LEVELS = [
  { id: 'CRITICAL', label: 'Critical', color: '#dc2626', bg: '#fef2f2', dot: '#dc2626', order: 0 },
  { id: 'AT_RISK',  label: 'At Risk',  color: '#ea580c', bg: '#fff7ed', dot: '#ea580c', order: 1 },
  { id: 'HEALTHY',  label: 'Healthy',  color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a', order: 2 },
  { id: 'NEW',      label: 'New',      color: '#2563eb', bg: '#eff6ff', dot: '#2563eb', order: 3 },
]

// ── Control Functions (what the control does) ──
export const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Compensating']

// ── Implementation Types (how the control is delivered) ──
export const IMPLEMENTATION_TYPES = ['Administrative', 'Technical', 'Physical']

// ── Execution Frequencies (how often the control fires) ──
export const EXECUTION_FREQUENCIES = ['Continuous', 'Event-Triggered', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually']

// ── Review Cadence Options ──
export const REVIEW_CADENCES = ['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Annually']

// ── Object Statuses ──
export const OBJECT_STATUSES = ['Active', 'Inactive', 'Deprecated']

// ── Data Classifications ──
export const DATA_CLASSIFICATIONS = ['Public', 'Internal', 'Confidential', 'Restricted']

// ── Environments ──
export const ENVIRONMENTS = ['Production', 'Staging', 'Development', 'Multi-Environment']

// ── Gap Statuses ──
export const GAP_STATUSES = [
  { id: 'Open', color: '#dc2626', bg: '#fef2f2' },
  { id: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  { id: 'Closed', color: '#16a34a', bg: '#f0fdf4' },
]

// ── Gap Health Statuses (RAG only — no Blue for gaps) ──
export const GAP_HEALTH_STATUSES = [
  { id: 'RED', label: 'Red', color: '#dc2626', bg: '#fef2f2' },
  { id: 'AMBER', label: 'Amber', color: '#ea580c', bg: '#fff7ed' },
  { id: 'GREEN', label: 'Green', color: '#16a34a', bg: '#f0fdf4' },
]

// ── MLG Diagnostic: 4-Phase Checklist ──
export const MLG_PHASES = [
  {
    id: 'foundation',
    name: 'Foundation',
    phase: 1,
    description: 'Baseline governance structure is established',
    checkpoints: [
      { id: 'cadence', label: 'Review Cadence Established', gatekeeper: true },
      { id: 'health_criteria', label: 'Health Criteria Defined', gatekeeper: true },
      { id: 'ownership', label: 'Ownership Documented', gatekeeper: true },
      { id: 'scope', label: 'Scope Documented', gatekeeper: false },
      { id: 'stakeholders', label: 'Stakeholders Identified', gatekeeper: false },
    ],
  },
  {
    id: 'action',
    name: 'Action',
    phase: 2,
    description: 'Active gap management and remediation workflows',
    checkpoints: [
      { id: 'gap_process', label: 'Gap Identification Process' },
      { id: 'remediation_workflow', label: 'Remediation Workflow Active' },
      { id: 'action_tracking', label: 'Action Items Tracked' },
      { id: 'escalation', label: 'Escalation Path Defined' },
      { id: 'communication', label: 'Communication Plan' },
    ],
  },
  {
    id: 'controls',
    name: 'Controls',
    phase: 3,
    description: 'Formal controls are mapped, tested, and evidenced',
    checkpoints: [
      { id: 'nist_mapped', label: 'Controls Mapped to NIST' },
      { id: 'testing_schedule', label: 'Control Testing Schedule' },
      { id: 'evidence', label: 'Evidence Collection' },
      { id: 'exceptions', label: 'Exception Management' },
      { id: 'automation', label: 'Automation Integration' },
    ],
  },
  {
    id: 'maturity',
    name: 'Maturity',
    phase: 4,
    description: 'Continuous improvement and predictive governance',
    checkpoints: [
      { id: 'monitoring', label: 'Continuous Monitoring' },
      { id: 'kpis', label: 'Metrics & KPIs Active' },
      { id: 'trends', label: 'Trend Analysis' },
      { id: 'predictive', label: 'Predictive Risk Scoring' },
      { id: 'knowledge', label: 'Knowledge Management' },
    ],
  },
]

// ── MLG Maturity Tiers ──
export function getMaturityTier(score) {
  if (score >= 16) return { label: 'Mature', color: '#2563eb', bg: '#eff6ff', tier: 'BLUE' }
  if (score >= 11) return { label: 'Adequate', color: '#16a34a', bg: '#f0fdf4', tier: 'GREEN' }
  if (score >= 6) return { label: 'Developing', color: '#ea580c', bg: '#fff7ed', tier: 'AMBER' }
  return { label: 'Deficient', color: '#dc2626', bg: '#fef2f2', tier: 'RED' }
}

// ── Compute MLG score from assessment data ──
// Returns { score, tier } — can be used by any component
// Pass optional object to auto-derive Phase 1 checkpoints (cadence, ownership, scope)
// matching MLGDiagnostic's auto-derivation logic
export function computeMLGScore(assessment, object) {
  if (!assessment || typeof assessment !== 'object') {
    // Even with no assessment, object metadata can auto-derive Phase 1 items
    if (!object) return { score: 0, tier: getMaturityTier(0) }
  }
  const raw = assessment || {}
  // Auto-derive Phase 1 from object metadata (same logic as MLGDiagnostic)
  const autoDerived = {}
  if (object) {
    if (object.reviewCadence) autoDerived.cadence = 'yes'
    if (object.owner?.trim()) autoDerived.ownership = 'yes'
    if (object.description?.trim()) autoDerived.scope = 'yes'
  }
  // Merge: explicit answers override auto-derived
  const merged = { ...autoDerived, ...raw }
  let total = 0
  for (const phase of MLG_PHASES) {
    for (const cp of phase.checkpoints) {
      const ans = merged[cp.id]
      if (ans === 'yes') total += 1
      else if (ans === 'weak') total += 0.5
    }
  }
  return { score: total, tier: getMaturityTier(total) }
}

// ── Regulatory Attestations ──
export const ATTESTATIONS = [
  { id: 'SOC1', name: 'SOC 1 Type II', category: 'Audit', desc: 'Service Organization Control — financial reporting controls' },
  { id: 'SOC2', name: 'SOC 2 Type II', category: 'Audit', desc: 'Service Organization Control — security, availability, integrity, confidentiality, privacy' },
  { id: 'SOX', name: 'SOX', category: 'Financial', desc: 'Sarbanes-Oxley Act — internal controls over financial reporting' },
  { id: 'OCC', name: 'OCC', category: 'Financial', desc: 'Office of the Comptroller of the Currency — banking supervision and regulation' },
  { id: 'NYDFS', name: 'NYDFS 500', category: 'Financial', desc: 'New York DFS Cybersecurity Regulation (23 NYCRR 500)' },
  { id: 'FFIEC', name: 'FFIEC', category: 'Financial', desc: 'Federal Financial Institutions Examination Council guidance' },
  { id: 'GLBA', name: 'GLBA', category: 'Financial', desc: 'Gramm-Leach-Bliley Act — financial privacy and safeguards' },
  { id: 'PCI-DSS', name: 'PCI DSS', category: 'Payment', desc: 'Payment Card Industry Data Security Standard' },
  { id: 'HIPAA', name: 'HIPAA', category: 'Healthcare', desc: 'Health Insurance Portability and Accountability Act — protected health information' },
  { id: 'GDPR', name: 'GDPR', category: 'Privacy', desc: 'EU General Data Protection Regulation — personal data protection' },
  { id: 'CCPA', name: 'CCPA/CPRA', category: 'Privacy', desc: 'California Consumer Privacy Act / California Privacy Rights Act' },
  { id: 'ISO27001', name: 'ISO 27001', category: 'Security', desc: 'Information Security Management System certification' },
  { id: 'FEDRAMP', name: 'FedRAMP', category: 'Government', desc: 'Federal Risk and Authorization Management Program — cloud security for US government' },
  { id: 'NIST-CSF', name: 'NIST CSF', category: 'Security', desc: 'NIST Cybersecurity Framework alignment' },
]

export const ATTESTATION_CATEGORIES = ['Audit', 'Financial', 'Payment', 'Healthcare', 'Privacy', 'Security', 'Government']

// ── Standup Product Areas ──
export const STANDUP_PRODUCTS = [
  'IAM',
  'Software Security Services',
  'Data Protection',
  'AI Security',
  'Insider Risk',
  'Vulnerability Management',
  'BISO',
  'General',
]

// ── Remediation Item Statuses ──
export const REMEDIATION_STATUSES = ['Open', 'In Progress', 'Resolved']

// ── Remediation Item Severities ──
export const REMEDIATION_SEVERITIES = [
  { id: 'RED', label: 'Red', color: '#dc2626', bg: '#fef2f2' },
  { id: 'AMBER', label: 'Amber', color: '#ea580c', bg: '#fff7ed' },
]

// ── Staleness threshold (days) ──
export const STALENESS_DAYS = 90
