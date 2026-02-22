import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { calcCompliance, uuid } from '../utils/compliance.js'
import { SEED_STATE } from '../data/seedData.js'

const StoreContext = createContext(null)
const DispatchContext = createContext(null)

const STORAGE_KEY = 'cpm_state'

const INITIAL_STATE = {
  objects: [],
  gaps: [],
  standupItems: [],
  mlgAssessments: {},
  frameworkOverrides: {},
  attestations: {},       // { [objectId]: ['SOC2', 'SOX', ...] }
  regulatoryQueue: [],    // [{ id, objectId, objectName, attestationId, confidence, rationale, detectedAt, status }]
  safeguardAssessments: { 'cis-v8': {}, 'nist-csf': {}, 'glba': {}, 'nydfs': {} },
  complianceSnapshots: [],
  cisIgFilter: 3,         // 1=IG1, 2=IG1+IG2, 3=All
  aiProvider: 'ollama',   // 'ollama' | 'claude'
}

// Migrate legacy state: objectIds-based gaps → pipeline gaps, add remediationItems to objects
function migrateState(state) {
  let changed = false
  const gaps = state.gaps.map((g) => {
    if (g.productFamily) return g // already migrated
    changed = true
    // Infer productFamily from first linked object
    const ids = g.objectIds || (g.objectId ? [g.objectId] : [])
    const firstObj = ids.length > 0 ? state.objects.find((o) => o.id === ids[0]) : null
    const productFamily = firstObj?.productFamilies?.[0] || ''
    const owner = firstObj?.owner || ''
    const targetType = firstObj?.type || 'Control'
    const criticality = g.healthStatus === 'RED' ? 'High' : g.healthStatus === 'AMBER' ? 'Medium' : 'Low'
    const migrated = { ...g, productFamily, targetType, owner, criticality }
    delete migrated.objectIds
    delete migrated.objectId
    return migrated
  })
  // Migrate gaps without triage fields (added in triage queue feature)
  const gaps2 = gaps.map((g) => {
    if (g.triaged !== undefined) return g
    changed = true
    return { ...g, identifier: g.owner || 'System', triaged: true }
  })
  const objects = state.objects.map((o) => {
    if (o.remediationItems) return o
    changed = true
    return { ...o, remediationItems: [] }
  })
  // Ensure safeguardAssessments, complianceSnapshots, cisIgFilter exist
  if (!state.safeguardAssessments) {
    changed = true
    state = { ...state, safeguardAssessments: { 'cis-v8': {}, 'nist-csf': {}, 'glba': {}, 'nydfs': {} } }
  } else {
    // Ensure all four framework keys exist
    const sa = state.safeguardAssessments
    if (!sa['cis-v8'] || !sa['nist-csf'] || !sa['glba'] || !sa['nydfs']) {
      changed = true
      state = { ...state, safeguardAssessments: { 'cis-v8': {}, 'nist-csf': {}, 'glba': {}, 'nydfs': {}, ...sa } }
    }
  }
  if (!state.complianceSnapshots) {
    changed = true
    state = { ...state, complianceSnapshots: [] }
  }
  if (state.cisIgFilter === undefined) {
    changed = true
    state = { ...state, cisIgFilter: 3 }
  }
  if (!state.aiProvider) {
    changed = true
    state = { ...state, aiProvider: 'ollama' }
  }
  // sourceGapId (on objects) and promotedToObjectId (on gaps) are optional —
  // they default to undefined for legacy data and are checked with truthiness guards
  return changed ? { ...state, gaps: gaps2, objects } : state
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = { ...INITIAL_STATE, ...JSON.parse(raw) }
      return migrateState(parsed)
    }
  } catch { /* ignore */ }
  // First load — start blank (set SEED=true below to restore seed data)
  // return migrateState({ ...INITIAL_STATE, ...SEED_STATE })
  return migrateState({ ...INITIAL_STATE })
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

function newObject(data) {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    listName: '',
    productFamilies: [],
    type: '',
    criticality: 'Medium',
    status: 'Active',
    identifyingPerson: '',
    owner: '',
    operator: '',
    controlClassification: 'Informal',
    nistFamilies: [],
    kpiNumerator: 0,
    kpiDenominator: 0,
    compliancePercent: 0,
    reviewCadence: 'Monthly',
    healthStatus: 'BLUE',
    healthRationale: '',
    description: '',
    lastReviewDate: now.slice(0, 10),
    nextReviewDate: '',
    jiraL1: '',
    jiraL2: '',
    environment: 'Production',
    dataClassification: 'Internal',
    businessUnit: '',
    remediationItems: [],
    history: [{ action: 'Created', note: 'Object added to inventory', timestamp: now }],
    createdAt: now,
    updatedAt: now,
    ...data,
  }
}

function reducer(state, action) {
  switch (action.type) {
    // ── Objects ──
    case 'ADD_OBJECT': {
      const obj = newObject(action.payload)
      // Clear control-only fields for non-Control types
      if (obj.type !== 'Control') {
        obj.controlClassification = ''
        obj.controlObjective = ''
        obj.controlType = ''
        obj.implementationType = ''
        obj.executionFrequency = ''
        obj.nistFamilies = []
      }
      obj.compliancePercent = calcCompliance(obj.kpiNumerator, obj.kpiDenominator)
      return { ...state, objects: [...state.objects, obj] }
    }
    case 'UPDATE_OBJECT': {
      const objects = state.objects.map((o) => {
        if (o.id !== action.payload.id) return o
        const now = new Date().toISOString()
        const updated = { ...o, ...action.payload, updatedAt: now }
        updated.compliancePercent = calcCompliance(updated.kpiNumerator, updated.kpiDenominator)
        // Track changes in history
        const history = [...(o.history || [])]
        if (action.payload.healthStatus && action.payload.healthStatus !== o.healthStatus) {
          history.push({ action: `Health → ${action.payload.healthStatus}`, note: `Changed from ${o.healthStatus} to ${action.payload.healthStatus}`, timestamp: now })
        }
        if (action.payload.status && action.payload.status !== o.status) {
          history.push({ action: `Status → ${action.payload.status}`, note: `Changed from ${o.status} to ${action.payload.status}`, timestamp: now })
        }
        if (action.payload.controlClassification && action.payload.controlClassification !== o.controlClassification) {
          history.push({ action: `Controls → ${action.payload.controlClassification}`, note: `Changed from ${o.controlClassification} to ${action.payload.controlClassification}`, timestamp: now })
        }
        if (action.payload.owner && action.payload.owner !== o.owner) {
          history.push({ action: 'Owner changed', note: `${o.owner || 'Unassigned'} → ${action.payload.owner}`, timestamp: now })
        }
        if (action.payload.operator && action.payload.operator !== o.operator) {
          history.push({ action: 'Operator changed', note: `${o.operator || 'Unassigned'} → ${action.payload.operator}`, timestamp: now })
        }
        // If no specific tracked field changed but something was edited
        if (history.length === (o.history || []).length) {
          history.push({ action: 'Updated', note: 'Object details modified', timestamp: now })
        }
        updated.history = history
        return updated
      })
      return { ...state, objects }
    }
    case 'DELETE_OBJECT': {
      return {
        ...state,
        objects: state.objects.filter((o) => o.id !== action.payload),
      }
    }
    case 'IMPORT_OBJECTS': {
      const imported = action.payload.map((data) => {
        const existing = state.objects.find(
          (o) => o.listName && o.listName === data.listName
        )
        if (existing) {
          const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
          merged.compliancePercent = calcCompliance(merged.kpiNumerator, merged.kpiDenominator)
          return merged
        }
        const obj = newObject(data)
        obj.compliancePercent = calcCompliance(obj.kpiNumerator, obj.kpiDenominator)
        return obj
      })
      const existingNames = new Set(imported.filter((o) => o.listName).map((o) => o.listName))
      const kept = state.objects.filter((o) => !existingNames.has(o.listName))
      return { ...state, objects: [...kept, ...imported] }
    }

    // ── Gaps (OneList) ──
    case 'ADD_GAP': {
      const gap = {
        id: uuid(),
        identifier: '',
        triaged: false,
        productFamily: '',
        targetType: '',
        owner: '',
        operator: '',
        criticality: 'Medium',
        title: '',
        description: '',
        status: 'Open',
        healthStatus: 'RED',
        controlClassification: 'Informal',
        nistFamilies: [],
        controlObjective: '',
        controlType: '',
        implementationType: '',
        executionFrequency: '',
        outcome: '',
        systemsTools: '',
        audience: '',
        scope: '',
        kpiNumerator: 0,
        kpiDenominator: 0,
        compliancePercent: 0,
        remediationNote: '',
        expiryDate: '',
        jiraL1: '',
        jiraL2: '',
        history: [{ status: 'Open', note: 'Pipeline item created', timestamp: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...action.payload,
      }
      gap.compliancePercent = calcCompliance(gap.kpiNumerator, gap.kpiDenominator)
      return { ...state, gaps: [...state.gaps, gap] }
    }
    case 'UPDATE_GAP': {
      const gaps = state.gaps.map((g) => {
        if (g.id !== action.payload.id) return g
        const updated = { ...g, ...action.payload, updatedAt: new Date().toISOString() }
        if (updated.kpiNumerator !== undefined || updated.kpiDenominator !== undefined) {
          updated.compliancePercent = calcCompliance(updated.kpiNumerator, updated.kpiDenominator)
        }
        if (action.payload.status && action.payload.status !== g.status) {
          updated.history = [
            ...g.history,
            {
              status: action.payload.status,
              note: action.payload.remediationNote || `Status changed to ${action.payload.status}`,
              timestamp: new Date().toISOString(),
            },
          ]
        }
        if (action.payload.healthStatus && action.payload.healthStatus !== g.healthStatus) {
          updated.history = [
            ...(updated.history || g.history),
            {
              status: `Health → ${action.payload.healthStatus}`,
              note: `Health status changed to ${action.payload.healthStatus}`,
              timestamp: new Date().toISOString(),
            },
          ]
        }
        return updated
      })
      return { ...state, gaps }
    }
    case 'ENRICH_GAP': {
      const gaps = state.gaps.map((g) => {
        if (g.id !== action.payload.id) return g
        const now = new Date().toISOString()
        const updated = { ...g, ...action.payload, updatedAt: now }
        if (updated.kpiNumerator !== undefined || updated.kpiDenominator !== undefined) {
          updated.compliancePercent = calcCompliance(updated.kpiNumerator, updated.kpiDenominator)
        }
        updated.history = [
          ...(g.history || []),
          {
            status: 'Enriched',
            note: `Classification detail added by ${action.payload.identifier || 'unknown'}`,
            timestamp: now,
          },
        ]
        return updated
      })
      return { ...state, gaps }
    }
    case 'TRIAGE_GAP': {
      const gaps = state.gaps.map((g) => {
        if (g.id !== action.payload.id) return g
        const now = new Date().toISOString()
        const updated = { ...g, ...action.payload, triaged: true, updatedAt: now }
        if (updated.kpiNumerator !== undefined || updated.kpiDenominator !== undefined) {
          updated.compliancePercent = calcCompliance(updated.kpiNumerator, updated.kpiDenominator)
        }
        updated.history = [
          ...g.history,
          {
            status: 'Triaged',
            note: `Triaged — ${action.payload.targetType || g.targetType}, assigned to ${action.payload.owner || 'unassigned'}`,
            timestamp: now,
          },
        ]
        return updated
      })
      return { ...state, gaps }
    }
    case 'DELETE_GAP':
      return { ...state, gaps: state.gaps.filter((g) => g.id !== action.payload) }

    // ── Standup Items ──
    case 'ADD_STANDUP': {
      const item = {
        id: uuid(),
        action: '',
        owner: '',
        product: 'General',
        dueDate: '',
        status: 'Open',
        createdAt: new Date().toISOString(),
        ...action.payload,
      }
      return { ...state, standupItems: [...state.standupItems, item] }
    }
    case 'UPDATE_STANDUP': {
      const standupItems = state.standupItems.map((s) =>
        s.id === action.payload.id ? { ...s, ...action.payload } : s
      )
      return { ...state, standupItems }
    }
    case 'DELETE_STANDUP':
      return { ...state, standupItems: state.standupItems.filter((s) => s.id !== action.payload) }

    // ── MLG Assessments ──
    case 'SET_MLG': {
      const { objectId, ...data } = action.payload
      return {
        ...state,
        mlgAssessments: { ...state.mlgAssessments, [objectId]: data },
      }
    }

    // ── Remediation Items (on Objects) ──
    case 'ADD_REMEDIATION_ITEM': {
      const { objectId, title, severity, note } = action.payload
      const now = new Date().toISOString()
      const item = { id: uuid(), title, status: 'Open', severity: severity || 'AMBER', note: note || '', createdAt: now, resolvedAt: null }
      const objects = state.objects.map((o) => {
        if (o.id !== objectId) return o
        const remediationItems = [...(o.remediationItems || []), item]
        const history = [...(o.history || []), { action: 'Remediation added', note: `"${title}" (${severity || 'AMBER'})`, timestamp: now }]
        return { ...o, remediationItems, history, updatedAt: now }
      })
      return { ...state, objects }
    }
    case 'UPDATE_REMEDIATION_ITEM': {
      const { objectId, itemId, ...updates } = action.payload
      const now = new Date().toISOString()
      const objects = state.objects.map((o) => {
        if (o.id !== objectId) return o
        const remediationItems = (o.remediationItems || []).map((item) => {
          if (item.id !== itemId) return item
          const updated = { ...item, ...updates }
          if (updates.status === 'Resolved' && !item.resolvedAt) updated.resolvedAt = now
          return updated
        })
        const history = [...(o.history || [])]
        if (updates.status) {
          history.push({ action: `Remediation ${updates.status.toLowerCase()}`, note: `Item status → ${updates.status}`, timestamp: now })
        }
        return { ...o, remediationItems, history, updatedAt: now }
      })
      return { ...state, objects }
    }
    case 'REMOVE_REMEDIATION_ITEM': {
      const { objectId, itemId } = action.payload
      const now = new Date().toISOString()
      const objects = state.objects.map((o) => {
        if (o.id !== objectId) return o
        const removed = (o.remediationItems || []).find((i) => i.id === itemId)
        const remediationItems = (o.remediationItems || []).filter((i) => i.id !== itemId)
        const history = [...(o.history || []), { action: 'Remediation removed', note: removed ? `"${removed.title}" removed` : 'Item removed', timestamp: now }]
        return { ...o, remediationItems, history, updatedAt: now }
      })
      return { ...state, objects }
    }

    // ── Framework Overrides ──
    case 'SET_FRAMEWORK_OVERRIDE': {
      const { framework, controlId, level, note } = action.payload
      const existing = state.frameworkOverrides || {}
      const fwOverrides = { ...(existing[framework] || {}) }
      fwOverrides[controlId] = { level, note, timestamp: new Date().toISOString() }
      return { ...state, frameworkOverrides: { ...existing, [framework]: fwOverrides } }
    }
    case 'CLEAR_FRAMEWORK_OVERRIDE': {
      const { framework, controlId } = action.payload
      const existing = state.frameworkOverrides || {}
      const fwOverrides = { ...(existing[framework] || {}) }
      delete fwOverrides[controlId]
      return { ...state, frameworkOverrides: { ...existing, [framework]: fwOverrides } }
    }

    // ── Attestations ──
    case 'SET_ATTESTATIONS': {
      const { objectId, attestationIds } = action.payload
      return {
        ...state,
        attestations: { ...state.attestations, [objectId]: attestationIds },
      }
    }
    case 'ADD_ATTESTATION': {
      const { objectId, attestationId } = action.payload
      const current = state.attestations[objectId] || []
      if (current.includes(attestationId)) return state
      return {
        ...state,
        attestations: { ...state.attestations, [objectId]: [...current, attestationId] },
      }
    }
    case 'REMOVE_ATTESTATION': {
      const { objectId, attestationId } = action.payload
      const current = state.attestations[objectId] || []
      return {
        ...state,
        attestations: { ...state.attestations, [objectId]: current.filter((a) => a !== attestationId) },
      }
    }

    // ── Regulatory Queue ──
    case 'ADD_REGULATORY_DETECTIONS': {
      // payload: [{ objectId, objectName, attestationId, confidence, rationale }]
      const newItems = action.payload.map((item) => ({
        id: uuid(),
        ...item,
        detectedAt: new Date().toISOString(),
        status: 'pending',
      }))
      return {
        ...state,
        regulatoryQueue: [...state.regulatoryQueue, ...newItems],
      }
    }
    case 'RESOLVE_REGULATORY_ITEM': {
      // payload: { id, resolution: 'confirmed' | 'dismissed' }
      const { id, resolution } = action.payload
      const queue = state.regulatoryQueue.map((item) =>
        item.id === id ? { ...item, status: resolution, resolvedAt: new Date().toISOString() } : item
      )
      // If confirmed, also add the attestation to the object
      if (resolution === 'confirmed') {
        const item = state.regulatoryQueue.find((q) => q.id === id)
        if (item) {
          const current = state.attestations[item.objectId] || []
          if (!current.includes(item.attestationId)) {
            return {
              ...state,
              regulatoryQueue: queue,
              attestations: { ...state.attestations, [item.objectId]: [...current, item.attestationId] },
            }
          }
        }
      }
      return { ...state, regulatoryQueue: queue }
    }
    case 'CLEAR_RESOLVED_QUEUE':
      return {
        ...state,
        regulatoryQueue: state.regulatoryQueue.filter((item) => item.status === 'pending'),
      }

    // ── Safeguard Assessments ──
    case 'SET_SAFEGUARD': {
      const { framework, safeguardId, policy, implementation, note } = action.payload
      const sa = state.safeguardAssessments || {}
      const fwAssessments = { ...(sa[framework] || {}) }
      fwAssessments[safeguardId] = { policy, implementation, note: note || '', updatedAt: new Date().toISOString() }
      return { ...state, safeguardAssessments: { ...sa, [framework]: fwAssessments } }
    }
    case 'SET_SAFEGUARDS_BULK': {
      const { framework, assessments } = action.payload
      const sa = state.safeguardAssessments || {}
      const fwAssessments = { ...(sa[framework] || {}), ...assessments }
      return { ...state, safeguardAssessments: { ...sa, [framework]: fwAssessments } }
    }
    case 'CLEAR_SAFEGUARD': {
      const { framework, safeguardId } = action.payload
      const sa = state.safeguardAssessments || {}
      const fwAssessments = { ...(sa[framework] || {}) }
      delete fwAssessments[safeguardId]
      return { ...state, safeguardAssessments: { ...sa, [framework]: fwAssessments } }
    }
    case 'SET_CIS_IG_FILTER':
      return { ...state, cisIgFilter: action.payload.filter }
    case 'SAVE_COMPLIANCE_SNAPSHOT': {
      const snapshot = { id: uuid(), timestamp: new Date().toISOString(), scores: action.payload.scores }
      return { ...state, complianceSnapshots: [...(state.complianceSnapshots || []), snapshot] }
    }
    case 'CREATE_GAP_FROM_SAFEGUARD': {
      const { framework, safeguardId, safeguardName } = action.payload
      const gap = {
        id: uuid(),
        identifier: 'System',
        triaged: false,
        productFamily: '',
        targetType: 'Control',
        owner: '',
        criticality: 'Medium',
        title: `[${framework.toUpperCase()}] ${safeguardName}`,
        description: `Gap identified from safeguard assessment: ${safeguardId} — ${safeguardName}`,
        status: 'Open',
        healthStatus: 'RED',
        controlClassification: 'Informal',
        nistFamilies: [],
        kpiNumerator: 0,
        kpiDenominator: 0,
        compliancePercent: 0,
        remediationNote: '',
        expiryDate: '',
        jiraL1: '',
        jiraL2: '',
        sourceSafeguard: { framework, safeguardId, name: safeguardName },
        history: [{ status: 'Open', note: `Gap created from ${framework} safeguard: ${safeguardId}`, timestamp: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return { ...state, gaps: [...state.gaps, gap] }
    }

    // ── AI Provider ──
    case 'SET_AI_PROVIDER':
      return { ...state, aiProvider: action.payload.provider }

    // ── Bulk ──
    case 'RESTORE_STATE':
      return migrateState({ ...INITIAL_STATE, ...action.payload })

    case 'RESET_STATE':
      return { ...INITIAL_STATE }

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  return (
    <StoreContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}

export function useDispatch() {
  return useContext(DispatchContext)
}
