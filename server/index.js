import express from 'express'
import {
  SYSTEM_INSIGHTS,
  SYSTEM_AUTOFILL,
  SYSTEM_RISK_ASSESS,
  SYSTEM_REMEDIATION,
  SYSTEM_PRIORITIZE,
  SYSTEM_MLG,
  SYSTEM_STANDUP_ACTIONS,
  SYSTEM_STANDUP_SUMMARY,
  SYSTEM_FRAMEWORK_ASSESS,
  SYSTEM_FRAMEWORK_CONTROLS,
  SYSTEM_REGULATORY_DETECT,
  SYSTEM_KPI_COHERENCE,
  SYSTEM_CONTROL_COHERENCE,
  SYSTEM_SAFEGUARD_ASSESS,
  SYSTEM_TRIAGE_AUGMENT,
} from './prompts.js'
import { chat, checkOllamaHealth, checkClaudeHealth } from './providers.js'

const app = express()
const PORT = 8000
const HOST = '127.0.0.1' // localhost only — not exposed to network

// ── Middleware ──
app.use(express.json({ limit: '1mb' }))

// ── Provider extraction ──
function extractProvider(req) {
  const header = req.headers['x-ai-provider']
  return header === 'claude' ? 'claude' : 'ollama'
}

// ── Helper: trim object data to reduce token usage ──
function trimObject(obj) {
  return {
    listName: obj.listName,
    type: obj.type,
    productFamilies: obj.productFamilies,
    criticality: obj.criticality,
    status: obj.status,
    owner: obj.owner,
    operator: obj.operator,
    controlClassification: obj.controlClassification,
    nistFamilies: obj.nistFamilies,
    kpiNumerator: obj.kpiNumerator,
    kpiDenominator: obj.kpiDenominator,
    kpiDefinition: obj.kpiDefinition,
    compliancePercent: obj.compliancePercent,
    controlObjective: obj.controlObjective,
    controlType: obj.controlType,
    implementationType: obj.implementationType,
    executionFrequency: obj.executionFrequency,
    reviewCadence: obj.reviewCadence,
    healthStatus: obj.healthStatus,
    healthRationale: obj.healthRationale,
    description: obj.description,
    lastReviewDate: obj.lastReviewDate,
    environment: obj.environment,
    dataClassification: obj.dataClassification,
    businessUnit: obj.businessUnit,
  }
}

function trimGap(gap) {
  return {
    title: gap.title,
    description: gap.description,
    status: gap.status,
    healthStatus: gap.healthStatus,
    productFamily: gap.productFamily,
    targetType: gap.targetType,
    owner: gap.owner,
    identifier: gap.identifier,
    triaged: gap.triaged,
    criticality: gap.criticality,
    controlClassification: gap.controlClassification,
    nistFamilies: gap.nistFamilies,
    kpiNumerator: gap.kpiNumerator,
    kpiDenominator: gap.kpiDenominator,
    compliancePercent: gap.compliancePercent,
    remediationNote: gap.remediationNote,
    jiraL1: gap.jiraL1,
  }
}

// ── Routes ──

// 1. Executive insights
app.post('/api/ai/insights', async (req, res) => {
  try {
    const { objects = [], gaps = [], standupItems = [] } = req.body
    const summary = {
      totalObjects: objects.length,
      healthDistribution: {
        RED: objects.filter(o => o.healthStatus === 'RED').length,
        AMBER: objects.filter(o => o.healthStatus === 'AMBER').length,
        GREEN: objects.filter(o => o.healthStatus === 'GREEN').length,
        BLUE: objects.filter(o => o.healthStatus === 'BLUE').length,
      },
      avgCompliance: objects.length
        ? Math.round(objects.reduce((s, o) => s + (o.compliancePercent || 0), 0) / objects.length * 10) / 10
        : 0,
      staleObjects: objects.filter(o => {
        if (!o.lastReviewDate) return true
        return (Date.now() - new Date(o.lastReviewDate).getTime()) / 86400000 > 90
      }).map(o => o.listName),
      gapsByStatus: {
        Open: gaps.filter(g => g.status === 'Open').length,
        'In Progress': gaps.filter(g => g.status === 'In Progress').length,
        Closed: gaps.filter(g => g.status === 'Closed').length,
      },
      redObjects: objects.filter(o => o.healthStatus === 'RED').map(trimObject),
      redGaps: gaps.filter(g => (g.healthStatus || 'RED') === 'RED' && g.status !== 'Closed').map(trimGap),
      overdueActions: standupItems.filter(s => s.status === 'Open' && s.dueDate && new Date(s.dueDate) < new Date()).length,
      objects: objects.map(trimObject),
      gaps: gaps.map(trimGap),
    }
    const content = await chat(extractProvider(req), SYSTEM_INSIGHTS, summary)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 2. Auto-fill object from description
app.post('/api/ai/autofill', async (req, res) => {
  try {
    const { description } = req.body
    if (!description) return res.status(400).json({ detail: 'Description is required' })
    const raw = await chat(extractProvider(req), SYSTEM_AUTOFILL, description)
    // Extract JSON from response (model might wrap in code fences)
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    // Try to find JSON object in the response
    const objMatch = json.match(/\{[\s\S]*\}/)
    if (!objMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON' })
    }
    const data = JSON.parse(objMatch[0])
    res.json({ data })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 2b. Triage augment — suggest classification fields for a pipeline item
app.post('/api/ai/triage-augment', async (req, res) => {
  try {
    const { title, description } = req.body
    if (!title) return res.status(400).json({ detail: 'Title is required' })
    const input = `Title: ${title}${description ? `\nDescription: ${description}` : ''}`
    const raw = await chat(extractProvider(req), SYSTEM_TRIAGE_AUGMENT, input)
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    const objMatch = json.match(/\{[\s\S]*\}/)
    if (!objMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON' })
    }
    const data = JSON.parse(objMatch[0])
    res.json({ data })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 3. Risk assessment for a single object
app.post('/api/ai/risk-assess', async (req, res) => {
  try {
    const content = await chat(extractProvider(req), SYSTEM_RISK_ASSESS, trimObject(req.body))
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 4. Remediation plan for a gap
app.post('/api/ai/remediation', async (req, res) => {
  try {
    const { gap, object, objects } = req.body
    // Support both single object (legacy) and objects array
    const objArray = objects || (object ? [object] : [])
    const payload = {
      gap: gap ? trimGap(gap) : null,
      linkedObjects: objArray.map(trimObject),
    }
    const content = await chat(extractProvider(req), SYSTEM_REMEDIATION, payload)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 5. Prioritize pipeline items
app.post('/api/ai/prioritize-gaps', async (req, res) => {
  try {
    const { gaps = [] } = req.body
    const trimmed = gaps
      .filter(g => g.status !== 'Closed')
      .map(trimGap)
    const content = await chat(extractProvider(req), SYSTEM_PRIORITIZE, trimmed)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 6. MLG maturity assessment
app.post('/api/ai/mlg-assess', async (req, res) => {
  try {
    const { object, currentAnswers } = req.body
    const payload = {
      object: object ? trimObject(object) : null,
      mlgCheckpoints: currentAnswers,
    }
    const content = await chat(extractProvider(req), SYSTEM_MLG, payload)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 7. Generate standup actions from notes
app.post('/api/ai/standup-actions', async (req, res) => {
  try {
    const { notes, existingItems } = req.body
    if (!notes) return res.status(400).json({ detail: 'Notes are required' })
    const raw = await chat(extractProvider(req), SYSTEM_STANDUP_ACTIONS, `Meeting Notes:\n${notes}\n\nExisting Action Items:\n${JSON.stringify(existingItems || [], null, 2)}`)
    // Extract JSON array
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    const arrMatch = json.match(/\[[\s\S]*\]/)
    if (!arrMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON array' })
    }
    const items = JSON.parse(arrMatch[0])
    res.json({ items })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 8. Summarize standup items
app.post('/api/ai/standup-summary', async (req, res) => {
  try {
    const { items } = req.body
    const content = await chat(extractProvider(req), SYSTEM_STANDUP_SUMMARY, items || [])
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 9. Framework enterprise-level control assessment (returns JSON per control)
app.post('/api/ai/framework-controls', async (req, res) => {
  try {
    const raw = await chat(extractProvider(req), SYSTEM_FRAMEWORK_CONTROLS, req.body)
    // Extract JSON array from response
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    const arrMatch = json.match(/\[[\s\S]*\]/)
    if (!arrMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON array' })
    }
    const controls = JSON.parse(arrMatch[0])
    res.json({ controls })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 10. Framework maturity report (returns markdown)
app.post('/api/ai/framework-assess', async (req, res) => {
  try {
    const content = await chat(extractProvider(req), SYSTEM_FRAMEWORK_ASSESS, req.body)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 11. Regulatory attestation detection
app.post('/api/ai/regulatory-detect', async (req, res) => {
  try {
    const raw = await chat(extractProvider(req), SYSTEM_REGULATORY_DETECT, req.body)
    // Extract JSON array from response
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    const arrMatch = json.match(/\[[\s\S]*\]/)
    if (!arrMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON array' })
    }
    const detections = JSON.parse(arrMatch[0])
    res.json({ detections })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 12. KPI coherence assessment
app.post('/api/ai/kpi-coherence', async (req, res) => {
  try {
    const raw = await chat(extractProvider(req), SYSTEM_KPI_COHERENCE, trimObject(req.body))
    // Extract JSON object from response
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    const objMatch = json.match(/\{[\s\S]*\}/)
    if (!objMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON' })
    }
    const assessment = JSON.parse(objMatch[0])
    res.json({ assessment })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 13. Control description coherence assessment
app.post('/api/ai/control-coherence', async (req, res) => {
  try {
    const raw = await chat(extractProvider(req), SYSTEM_CONTROL_COHERENCE, trimObject(req.body))
    let json = raw
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) json = fenceMatch[1]
    const objMatch = json.match(/\{[\s\S]*\}/)
    if (!objMatch) {
      return res.status(500).json({ detail: 'Failed to parse AI response as JSON' })
    }
    const assessment = JSON.parse(objMatch[0])
    res.json({ assessment })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// 14. Safeguard-level assessment
app.post('/api/ai/safeguard-assess', async (req, res) => {
  try {
    const { framework, safeguards = [], objectContext = [] } = req.body
    // Batch safeguards in groups of 10 to stay within context window
    const batchSize = 10
    const allAssessments = []
    for (let i = 0; i < safeguards.length; i += batchSize) {
      const batch = safeguards.slice(i, i + batchSize)
      const payload = {
        framework,
        safeguards: batch,
        objectContext,
      }
      const raw = await chat(extractProvider(req), SYSTEM_SAFEGUARD_ASSESS, payload)
      let json = raw
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) json = fenceMatch[1]
      const arrMatch = json.match(/\[[\s\S]*\]/)
      if (arrMatch) {
        try {
          const parsed = JSON.parse(arrMatch[0])
          allAssessments.push(...parsed)
        } catch { /* skip malformed batch */ }
      }
    }
    res.json({ assessments: allAssessments })
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

// ── Health check ──
app.get('/api/health', async (_req, res) => {
  const ollama = await checkOllamaHealth()
  const claude = checkClaudeHealth()
  const status = ollama.available || claude.available ? 'ok' : 'error'
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    providers: { ollama, claude },
  })
})

// ── Start server ──
app.listen(PORT, HOST, () => {
  const claude = checkClaudeHealth()
  console.log(`CPM AI server listening on http://${HOST}:${PORT}`)
  console.log(`Providers:`)
  console.log(`  Ollama  — local LLM (ensure running: ollama serve)`)
  console.log(`  Claude  — ${claude.available ? `enabled (${claude.model})` : 'disabled (set ANTHROPIC_API_KEY to enable)'}`)
  console.log('')
  console.log('Available routes:')
  console.log('  POST /api/ai/insights        — Executive dashboard insights')
  console.log('  POST /api/ai/autofill         — Auto-fill object from description')
  console.log('  POST /api/ai/triage-augment   — Suggest classification for pipeline item')
  console.log('  POST /api/ai/risk-assess      — Risk assessment for an object')
  console.log('  POST /api/ai/remediation      — Remediation plan for a gap')
  console.log('  POST /api/ai/prioritize-gaps  — Gap prioritization ranking')
  console.log('  POST /api/ai/mlg-assess       — MLG maturity assessment')
  console.log('  POST /api/ai/standup-actions   — Parse action items from notes')
  console.log('  POST /api/ai/standup-summary   — Summarize standup items')
  console.log('  POST /api/ai/framework-assess  — Framework maturity assessment (CIS/CSF)')
  console.log('  POST /api/ai/framework-controls — Enterprise control assessment')
  console.log('  POST /api/ai/regulatory-detect — Regulatory attestation detection')
  console.log('  POST /api/ai/kpi-coherence    — KPI coherence assessment')
  console.log('  POST /api/ai/control-coherence — Control description coherence')
  console.log('  POST /api/ai/safeguard-assess — Safeguard-level compliance assessment')
  console.log('  GET  /api/health              — Health check (provider status)')
})
