import Anthropic from '@anthropic-ai/sdk'

// ── Config ──
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

// ── Lazy Anthropic client ──
let anthropicClient = null
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

// ── Ollama ──
export async function chatOllama(systemPrompt, userContent) {
  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent, null, 2) },
    ],
    options: {
      temperature: 0.4,
      num_predict: 2048,
    },
  }

  let res
  try {
    res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error('Cannot connect to Ollama. Make sure it is running: ollama serve')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.message?.content || ''
}

// ── Claude ──
export async function chatClaude(systemPrompt, userContent) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Claude API key not configured. Set ANTHROPIC_API_KEY environment variable.')
  }

  const client = getAnthropicClient()
  const userText = typeof userContent === 'string' ? userContent : JSON.stringify(userContent, null, 2)

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    })
    return message.content?.[0]?.text || ''
  } catch (err) {
    if (err.status === 401) {
      throw new Error('Invalid Anthropic API key. Check your ANTHROPIC_API_KEY.')
    }
    if (err.status === 429) {
      throw new Error('Anthropic rate limit exceeded. Please wait and try again.')
    }
    throw new Error(`Claude API error: ${err.message}`)
  }
}

// ── Dispatcher ──
export async function chat(provider, systemPrompt, userContent) {
  if (provider === 'claude') {
    return chatClaude(systemPrompt, userContent)
  }
  return chatOllama(systemPrompt, userContent)
}

// ── Health checks ──
export async function checkOllamaHealth() {
  try {
    const res = await fetch('http://localhost:11434/api/tags')
    if (!res.ok) return { available: false, error: 'Ollama not responding' }
    const data = await res.json()
    const models = (data.models || []).map((m) => m.name)
    return { available: true, model: OLLAMA_MODEL, models }
  } catch {
    return { available: false, error: 'Ollama is not running' }
  }
}

export function checkClaudeHealth() {
  return {
    available: !!ANTHROPIC_API_KEY,
    model: CLAUDE_MODEL,
  }
}
