// ═══════════════════════════════════════════
// Framework Maturity Data & Mapping Engine
// CIS Controls v8 + NIST CSF 2.0
// ═══════════════════════════════════════════

// ── Maturity Levels (CMMI-inspired) ──
export const MATURITY_LEVELS = [
  { level: 0, label: 'Not Addressed', color: '#94a3b8', bg: '#f1f5f9' },
  { level: 1, label: 'Initial', color: '#dc2626', bg: '#fef2f2' },
  { level: 2, label: 'Repeatable', color: '#ea580c', bg: '#fff7ed' },
  { level: 3, label: 'Defined', color: '#d97706', bg: '#fffbeb' },
  { level: 4, label: 'Managed', color: '#16a34a', bg: '#f0fdf4' },
  { level: 5, label: 'Optimizing', color: '#2563eb', bg: '#eff6ff' },
]

export function getMaturityLevel(level) {
  return MATURITY_LEVELS[Math.max(0, Math.min(5, Math.round(level)))]
}

// ══════════════════════════════════
// CIS Controls v8 (18 Control Groups)
// ══════════════════════════════════

export const CIS_CONTROLS = [
  { id: 'CIS-1', num: 1, name: 'Inventory and Control of Enterprise Assets', desc: 'Actively manage all enterprise assets connected to the infrastructure.' },
  { id: 'CIS-2', num: 2, name: 'Inventory and Control of Software Assets', desc: 'Actively manage all software on the network to ensure only authorized software is installed.' },
  { id: 'CIS-3', num: 3, name: 'Data Protection', desc: 'Develop processes and technical controls to identify, classify, securely handle, retain, and dispose of data.' },
  { id: 'CIS-4', num: 4, name: 'Secure Configuration of Enterprise Assets and Software', desc: 'Establish and maintain secure configurations for enterprise assets and software.' },
  { id: 'CIS-5', num: 5, name: 'Account Management', desc: 'Use processes and tools to assign and manage authorization to credentials for user accounts.' },
  { id: 'CIS-6', num: 6, name: 'Access Control Management', desc: 'Use processes and tools to create, assign, manage, and revoke access credentials and privileges.' },
  { id: 'CIS-7', num: 7, name: 'Continuous Vulnerability Management', desc: 'Develop a plan to continuously assess and track vulnerabilities on all enterprise assets.' },
  { id: 'CIS-8', num: 8, name: 'Audit Log Management', desc: 'Collect, alert, review, and retain audit logs of events to help detect and recover from attacks.' },
  { id: 'CIS-9', num: 9, name: 'Email and Web Browser Protections', desc: 'Improve protections and detections of threats from email and web vectors.' },
  { id: 'CIS-10', num: 10, name: 'Malware Defenses', desc: 'Prevent or control the installation, spread, and execution of malicious applications.' },
  { id: 'CIS-11', num: 11, name: 'Data Recovery', desc: 'Establish and maintain data recovery practices sufficient to restore in-scope enterprise assets.' },
  { id: 'CIS-12', num: 12, name: 'Network Infrastructure Management', desc: 'Establish and maintain the management and security of network infrastructure devices.' },
  { id: 'CIS-13', num: 13, name: 'Network Monitoring and Defense', desc: 'Operate processes and tooling to establish and maintain comprehensive network monitoring and defense.' },
  { id: 'CIS-14', num: 14, name: 'Security Awareness and Skills Training', desc: 'Establish and maintain a security awareness program to influence behavior.' },
  { id: 'CIS-15', num: 15, name: 'Service Provider Management', desc: 'Develop a process to evaluate service providers who hold sensitive data or are responsible for critical IT platforms.' },
  { id: 'CIS-16', num: 16, name: 'Application Software Security', desc: 'Manage the security lifecycle of in-house developed, hosted, or acquired software.' },
  { id: 'CIS-17', num: 17, name: 'Incident Response Management', desc: 'Establish a program to develop and maintain an incident response capability.' },
  { id: 'CIS-18', num: 18, name: 'Penetration Testing', desc: 'Test the effectiveness and resiliency of enterprise assets through identifying and exploiting weaknesses in controls.' },
]

// ══════════════════════════════════
// NIST CSF 2.0 (6 Functions, 22 Categories)
// ══════════════════════════════════

export const NIST_CSF_FUNCTIONS = [
  {
    id: 'GV', name: 'Govern', color: '#8b5cf6', bg: '#f5f3ff',
    desc: 'Establish and monitor the organization\'s cybersecurity risk management strategy, expectations, and policy.',
    categories: [
      { id: 'GV.OC', name: 'Organizational Context' },
      { id: 'GV.RM', name: 'Risk Management Strategy' },
      { id: 'GV.RR', name: 'Roles, Responsibilities, and Authorities' },
      { id: 'GV.PO', name: 'Policy' },
      { id: 'GV.OV', name: 'Oversight' },
      { id: 'GV.SC', name: 'Cybersecurity Supply Chain Risk Management' },
    ],
  },
  {
    id: 'ID', name: 'Identify', color: '#2563eb', bg: '#eff6ff',
    desc: 'Understand the organization\'s current cybersecurity risks.',
    categories: [
      { id: 'ID.AM', name: 'Asset Management' },
      { id: 'ID.RA', name: 'Risk Assessment' },
      { id: 'ID.IM', name: 'Improvement' },
    ],
  },
  {
    id: 'PR', name: 'Protect', color: '#16a34a', bg: '#f0fdf4',
    desc: 'Use safeguards to manage the organization\'s cybersecurity risks.',
    categories: [
      { id: 'PR.AA', name: 'Identity Management, Authentication, and Access Control' },
      { id: 'PR.AT', name: 'Awareness and Training' },
      { id: 'PR.DS', name: 'Data Security' },
      { id: 'PR.PS', name: 'Platform Security' },
      { id: 'PR.IR', name: 'Technology Infrastructure Resilience' },
    ],
  },
  {
    id: 'DE', name: 'Detect', color: '#ea580c', bg: '#fff7ed',
    desc: 'Find and analyze possible cybersecurity attacks and compromises.',
    categories: [
      { id: 'DE.CM', name: 'Continuous Monitoring' },
      { id: 'DE.AE', name: 'Adverse Event Analysis' },
    ],
  },
  {
    id: 'RS', name: 'Respond', color: '#dc2626', bg: '#fef2f2',
    desc: 'Take action regarding a detected cybersecurity incident.',
    categories: [
      { id: 'RS.MA', name: 'Incident Management' },
      { id: 'RS.AN', name: 'Incident Analysis' },
      { id: 'RS.CO', name: 'Incident Response Reporting and Communication' },
      { id: 'RS.MI', name: 'Incident Mitigation' },
    ],
  },
  {
    id: 'RC', name: 'Recover', color: '#0891b2', bg: '#ecfeff',
    desc: 'Restore assets and operations that were impacted by a cybersecurity incident.',
    categories: [
      { id: 'RC.RP', name: 'Incident Recovery Plan Execution' },
      { id: 'RC.CO', name: 'Incident Recovery Communication' },
    ],
  },
]

// ══════════════════════════════════
// Mapping Rules: Product Family → Framework Controls
// ══════════════════════════════════

// Product Family → CIS Controls
const FAMILY_TO_CIS = {
  'AI Security':                   ['CIS-1', 'CIS-2', 'CIS-4', 'CIS-16', 'CIS-18'],
  'Data Protection':               ['CIS-3', 'CIS-8', 'CIS-9', 'CIS-11'],
  'Insider Risk':                  ['CIS-5', 'CIS-6', 'CIS-8', 'CIS-9', 'CIS-13'],
  'Identity & Access Management':  ['CIS-5', 'CIS-6'],
  'Software Security Services':    ['CIS-2', 'CIS-4', 'CIS-16', 'CIS-18'],
  'Vulnerability Management':      ['CIS-7', 'CIS-10', 'CIS-18'],
  'BISO':              ['CIS-15'],
}

// Product Family → NIST CSF Categories
const FAMILY_TO_CSF = {
  'AI Security':                   ['GV.RM', 'ID.RA', 'PR.DS', 'PR.PS'],
  'Data Protection':               ['PR.DS', 'PR.IR', 'RC.RP', 'RC.CO'],
  'Insider Risk':                  ['PR.AA', 'DE.CM', 'DE.AE', 'RS.MA'],
  'Identity & Access Management':  ['PR.AA', 'PR.AT', 'GV.RR'],
  'Software Security Services':    ['PR.PS', 'DE.CM', 'RS.MI', 'ID.IM'],
  'Vulnerability Management':      ['ID.RA', 'ID.AM', 'DE.CM', 'DE.AE', 'RS.MI'],
  'BISO':              ['GV.SC', 'ID.RA', 'GV.OV'],
}

// NIST 800-53 Family → CIS Controls (crosswalk)
const NIST80053_TO_CIS = {
  'AC': ['CIS-5', 'CIS-6'],
  'AT': ['CIS-14'],
  'AU': ['CIS-8'],
  'CA': ['CIS-4', 'CIS-18'],
  'CM': ['CIS-2', 'CIS-4'],
  'CP': ['CIS-11'],
  'IA': ['CIS-5', 'CIS-6'],
  'IR': ['CIS-17'],
  'MA': ['CIS-4'],
  'MP': ['CIS-3'],
  'PE': [],
  'PL': [],
  'PM': [],
  'PS': ['CIS-14'],
  'PT': ['CIS-3'],
  'RA': ['CIS-7', 'CIS-18'],
  'SA': ['CIS-15', 'CIS-16'],
  'SC': ['CIS-12', 'CIS-13'],
  'SI': ['CIS-7', 'CIS-10', 'CIS-13'],
  'SR': ['CIS-15'],
}

// NIST 800-53 Family → NIST CSF Categories (crosswalk)
const NIST80053_TO_CSF = {
  'AC': ['PR.AA'],
  'AT': ['PR.AT'],
  'AU': ['DE.CM'],
  'CA': ['GV.OV', 'ID.RA'],
  'CM': ['PR.PS', 'ID.AM'],
  'CP': ['RC.RP', 'RC.CO'],
  'IA': ['PR.AA'],
  'IR': ['RS.MA', 'RS.AN', 'RS.CO'],
  'MA': ['PR.PS'],
  'MP': ['PR.DS'],
  'PE': [],
  'PL': ['GV.PO'],
  'PM': ['GV.OC', 'GV.RM'],
  'PS': ['GV.RR'],
  'PT': ['PR.DS'],
  'RA': ['ID.RA'],
  'SA': ['GV.SC', 'PR.PS'],
  'SC': ['PR.DS', 'PR.IR'],
  'SI': ['DE.CM', 'DE.AE', 'RS.MI'],
  'SR': ['GV.SC'],
}

// ══════════════════════════════════
// Auto-Mapping Engine
// ══════════════════════════════════

/**
 * Maps a single object to CIS control IDs based on product families + NIST 800-53 families
 */
export function mapObjectToCIS(obj) {
  const controlSet = new Set()
  // Product family mappings
  for (const family of obj.productFamilies || []) {
    for (const cid of FAMILY_TO_CIS[family] || []) controlSet.add(cid)
  }
  // NIST 800-53 crosswalk
  for (const nistId of obj.nistFamilies || []) {
    for (const cid of NIST80053_TO_CIS[nistId] || []) controlSet.add(cid)
  }
  return [...controlSet].sort()
}

/**
 * Maps a single object to NIST CSF category IDs based on product families + NIST 800-53 families
 */
export function mapObjectToCSF(obj) {
  const catSet = new Set()
  // Product family mappings
  for (const family of obj.productFamilies || []) {
    for (const catId of FAMILY_TO_CSF[family] || []) catSet.add(catId)
  }
  // NIST 800-53 crosswalk
  for (const nistId of obj.nistFamilies || []) {
    for (const catId of NIST80053_TO_CSF[nistId] || []) catSet.add(catId)
  }
  return [...catSet].sort()
}

/**
 * Builds a full CIS control mapping: { [controlId]: [objectArray] }
 */
export function buildCISMapping(objects) {
  const mapping = {}
  for (const ctrl of CIS_CONTROLS) mapping[ctrl.id] = []
  for (const obj of objects) {
    const cids = mapObjectToCIS(obj)
    for (const cid of cids) {
      if (mapping[cid]) mapping[cid].push(obj)
    }
  }
  return mapping
}

/**
 * Builds a full NIST CSF category mapping: { [categoryId]: [objectArray] }
 */
export function buildCSFMapping(objects) {
  const mapping = {}
  for (const func of NIST_CSF_FUNCTIONS) {
    for (const cat of func.categories) mapping[cat.id] = []
  }
  for (const obj of objects) {
    const catIds = mapObjectToCSF(obj)
    for (const catId of catIds) {
      if (mapping[catId]) mapping[catId].push(obj)
    }
  }
  return mapping
}

// ══════════════════════════════════
// Maturity Derivation
// ══════════════════════════════════

/**
 * Derives a CONSERVATIVE maturity estimate (0-2) from mapped objects.
 *
 * Auto-derivation is intentionally capped at Level 2 because object metadata
 * alone cannot determine enterprise-level compliance. Having healthy tools
 * does NOT mean the entire control is mature across the organization.
 *
 * Level 0: Not Addressed — no objects mapped to this control
 * Level 1: Initial — objects exist but controls are informal/ad-hoc
 * Level 2: Repeatable — formal controls with compliance tracking exist
 *
 * Level 3-5 require AI Enterprise Assessment or manual override to score
 * accurately, since they demand evidence of enterprise-wide standardization,
 * quantitative measurement, and continuous improvement that can't be inferred
 * from inventory metadata alone.
 */
export function deriveMaturity(objects, mlgAssessments = {}) {
  if (!objects || objects.length === 0) return 0

  const formalCount = objects.filter((o) => o.controlClassification === 'Formal').length
  const hasComplianceTracking = objects.some((o) => o.compliancePercent != null && o.compliancePercent > 0)

  // Level 2: At least one formal control AND compliance is being tracked
  if (formalCount > 0 && hasComplianceTracking) return 2

  // Level 1: Objects exist (some coverage, but informal or unmeasured)
  return 1
}

/**
 * Computes full CIS v8 assessment: maturity per control + overall
 */
export function computeCISAssessment(objects, mlgAssessments = {}, overrides = {}) {
  const mapping = buildCISMapping(objects)
  const controls = CIS_CONTROLS.map((ctrl) => {
    const mapped = mapping[ctrl.id]
    const autoMaturity = deriveMaturity(mapped, mlgAssessments)
    const override = overrides[ctrl.id]
    const effectiveMaturity = override?.level != null ? override.level : autoMaturity
    return {
      ...ctrl,
      objects: mapped,
      autoMaturity,
      override: override || null,
      maturity: effectiveMaturity,
      maturityInfo: getMaturityLevel(effectiveMaturity),
    }
  })

  const assessed = controls.filter((c) => c.maturity > 0)
  const overallScore = controls.length > 0
    ? Math.round(controls.reduce((s, c) => s + c.maturity, 0) / controls.length * 10) / 10
    : 0

  return { controls, overallScore, overallLevel: getMaturityLevel(Math.round(overallScore)) }
}

/**
 * Computes full NIST CSF assessment: maturity per category + per function + overall
 */
export function computeCSFAssessment(objects, mlgAssessments = {}, overrides = {}) {
  const mapping = buildCSFMapping(objects)

  const functions = NIST_CSF_FUNCTIONS.map((func) => {
    const categories = func.categories.map((cat) => {
      const mapped = mapping[cat.id]
      const autoMaturity = deriveMaturity(mapped, mlgAssessments)
      const override = overrides[cat.id]
      const effectiveMaturity = override?.level != null ? override.level : autoMaturity
      return {
        ...cat,
        objects: mapped,
        autoMaturity,
        override: override || null,
        maturity: effectiveMaturity,
        maturityInfo: getMaturityLevel(effectiveMaturity),
      }
    })

    const funcMaturity = categories.length > 0
      ? Math.round(categories.reduce((s, c) => s + c.maturity, 0) / categories.length * 10) / 10
      : 0

    return {
      ...func,
      categories,
      maturity: funcMaturity,
      maturityInfo: getMaturityLevel(Math.round(funcMaturity)),
    }
  })

  const allCats = functions.flatMap((f) => f.categories)
  const overallScore = allCats.length > 0
    ? Math.round(allCats.reduce((s, c) => s + c.maturity, 0) / allCats.length * 10) / 10
    : 0

  return { functions, overallScore, overallLevel: getMaturityLevel(Math.round(overallScore)) }
}
