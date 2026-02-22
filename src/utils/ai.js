const AI_BASE = '/api/ai'

function getProvider() {
  try {
    const raw = localStorage.getItem('cpm_state')
    if (raw) {
      const state = JSON.parse(raw)
      return state.aiProvider || 'ollama'
    }
  } catch { /* ignore */ }
  return 'ollama'
}

async function post(path, body) {
  const res = await fetch(`${AI_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Provider': getProvider(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `AI request failed: ${res.status}`)
  }
  return res.json()
}

export async function getAiHealth() {
  const res = await fetch('/api/health')
  return res.json()
}

export async function getInsights(state) {
  return post('/insights', state)
}

export async function autofillObject(description) {
  return post('/autofill', { description })
}

export async function triageAugment(title, description) {
  return post('/triage-augment', { title, description })
}

export async function assessRisk(obj) {
  return post('/risk-assess', obj)
}

export async function getRemediation(gap, objects) {
  // Accepts single object or array for backward compatibility
  const objArray = Array.isArray(objects) ? objects : objects ? [objects] : []
  return post('/remediation', { gap, objects: objArray })
}

export async function prioritizeGaps(gaps) {
  return post('/prioritize-gaps', { gaps })
}

export async function assessMLG(object, currentAnswers) {
  return post('/mlg-assess', { object, currentAnswers })
}

export async function generateStandupActions(notes, existingItems) {
  return post('/standup-actions', { notes, existingItems })
}

export async function summarizeStandup(items) {
  return post('/standup-summary', { items })
}

export async function assessFramework(payload) {
  return post('/framework-assess', payload)
}

export async function assessFrameworkControls(payload) {
  return post('/framework-controls', payload)
}

export async function detectRegulatory(payload) {
  return post('/regulatory-detect', payload)
}

export async function assessKpiCoherence(obj) {
  return post('/kpi-coherence', obj)
}

export async function assessControlCoherence(obj) {
  return post('/control-coherence', obj)
}

export async function assessSafeguards(payload) {
  return post('/safeguard-assess', payload)
}
