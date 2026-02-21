import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.jsx'
import { POSTURE_LEVELS } from '../data/constants.js'
import { computePosture } from '../utils/compliance.js'
import { getInsights } from '../utils/ai.js'
import { AiButton, AiInlineResult, AiError } from './AiPanel.jsx'

/* ── Object Taxonomy ── */
const TAXONOMY = [
  {
    type: 'Control',
    color: '#2563eb',
    bg: '#eff6ff',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    headline: 'Security mechanism — Formal or Informal',
    description: 'A control is a safeguard that mitigates risk. Controls can be Formal (documented, framework-mapped, tested) or Informal (ad-hoc, undocumented). Informal controls receive a 5% posture penalty to nudge formalization. Flipping the Informal/Formal toggle is a one-click graduation.',
    examples: ['DLP Endpoint Agent', 'SSO Enforcement Policy', 'Ad-hoc Code Review', 'Manual Log Reviews'],
    posture: 'Full cascade — all signals apply. Informal classification adds a 5% score reduction. Formalization unlocks NIST mapping and removes the penalty.',
  },
  {
    type: 'Process',
    color: '#16a34a',
    bg: '#f0fdf4',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
        <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
        <line x1="4" y1="4" x2="9" y2="9"/>
      </svg>
    ),
    headline: 'Repeatable workflow with measurable outcomes',
    description: 'A process is a repeatable set of activities that achieves a security outcome. Processes describe what gets done, who does it, and what tools are involved — but may not prescribe exact steps. They support controls by defining the operational flow.',
    examples: ['Incident Response Triage', 'AI Red Team Testing', 'Bug Bounty Program'],
    posture: 'Standard cascade — scored on health, coverage, criticality, and staleness like any object.',
  },
  {
    type: 'Procedure',
    color: '#ea580c',
    bg: '#fff7ed',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
      </svg>
    ),
    headline: 'Step-by-step instructions for a defined audience',
    description: 'A procedure is a detailed, step-by-step instruction set that documents exactly how to execute a process or control. Procedures define scope, audience, and produce auditable evidence. They can be linked to a parent process.',
    examples: ['Password Reset Runbook', 'Data Breach Notification Steps', 'Vendor Due Diligence Checklist'],
    posture: 'Standard cascade — scored on health, coverage, criticality, and staleness like any object.',
  },
]

const TAXONOMY_RELATIONSHIPS = [
  { from: 'Control', to: 'Process', label: 'Enforced by', desc: 'Controls are enforced through processes that people follow.' },
  { from: 'Process', to: 'Procedure', label: 'Documented as', desc: 'Processes are documented as step-by-step procedures.' },
  { from: 'Procedure', to: 'Control', label: 'Evidences', desc: 'Procedures provide the auditable evidence that a control is operating.' },
]

/* ── Lifecycle ── */
const LIFECYCLE_STEPS = [
  {
    num: '01',
    title: 'Identify',
    desc: 'Register controls, processes, and procedures into your inventory. Classify each by type, criticality, and product family.',
    color: '#2563eb',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    feature: 'Object Inventory',
  },
  {
    num: '02',
    title: 'Assess',
    desc: 'Set health status, track KPI coverage, and let the platform compute a unified Posture signal for each object.',
    color: '#7c3aed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    feature: 'Posture & Coverage',
  },
  {
    num: '03',
    title: 'Remediate',
    desc: 'Log gaps and deficiencies against objects. Track remediation with status, timeline, and ownership.',
    color: '#ea580c',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    feature: 'Gap Tracker',
  },
  {
    num: '04',
    title: 'Mature',
    desc: 'Run the 4-phase MLG Diagnostic to measure governance maturity and identify the next steps for each object.',
    color: '#16a34a',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
    feature: 'MLG Diagnostic',
  },
  {
    num: '05',
    title: 'Report',
    desc: 'The CISO Dashboard synthesizes everything into KPIs, trending charts, and coverage matrices for leadership.',
    color: '#0ea5e9',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    feature: 'CISO Dashboard',
  },
]

const FEATURES = [
  {
    name: 'CISO Dashboard',
    desc: 'Executive overview with KPIs, health distribution, trending charts, coverage matrix, and owner portfolio.',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  {
    name: 'Object Inventory',
    desc: 'The registry of every control, process, and procedure. Each has auto-computed Posture, Coverage %, and full metadata.',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  {
    name: 'Gap Tracker',
    desc: 'Track deficiencies against objects with status, remediation notes, aging badges, and a full audit timeline.',
    color: '#ea580c',
    bg: '#fff7ed',
  },
  {
    name: 'MLG Diagnostic',
    desc: '4-phase maturity assessment: Foundation, Action, Controls, Maturity. Phase 1 auto-derives from object data.',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  {
    name: 'Standup',
    desc: 'Track PPA (People, Process, Action) items. AI can parse meeting notes into structured action items.',
    color: '#0ea5e9',
    bg: '#f0f9ff',
  },
  {
    name: 'CIS v8 Assessment',
    desc: '18 CIS Controls mapped to objects. Maturity auto-derived from coverage. AI suggests maturity levels.',
    color: '#6366f1',
    bg: '#eef2ff',
  },
  {
    name: 'NIST CSF 2.0',
    desc: '6 core functions with 22 categories. Radar chart visualization and maturity scoring.',
    color: '#8b5cf6',
    bg: '#f5f3ff',
  },
  {
    name: 'Regulatory Intelligence',
    desc: 'AI detects applicable attestations (SOC 2, SOX, GDPR, PCI DSS, etc.) with human-in-the-loop verification.',
    color: '#d97706',
    bg: '#fffbeb',
  },
]

function PostureAnatomyCards({ objects, gaps, mlgAssessments, onNavigate }) {
  const examples = useMemo(() => {
    const enriched = objects.map((obj) => ({
      ...obj,
      _posture: computePosture(obj, {
        gaps: gaps.filter(g => (g.objectIds || []).includes(obj.id)),
        mlgAssessment: mlgAssessments[obj.id] || null,
      }),
    }))
    const result = []

    for (const level of POSTURE_LEVELS) {
      const match = enriched.find((o) => o._posture.id === level.id)
      if (match) {
        result.push({ level, obj: match, posture: match._posture })
      } else {
        const synthetic = {
          CRITICAL: { listName: 'Example Critical Object', healthStatus: 'RED', compliancePercent: 35, criticality: 'High', lastReviewDate: '2025-06-01', type: 'Control' },
          AT_RISK: { listName: 'Example At-Risk Object', healthStatus: 'AMBER', compliancePercent: 65, criticality: 'Medium', lastReviewDate: new Date().toISOString(), type: 'Process' },
          HEALTHY: { listName: 'Example Healthy Object', healthStatus: 'GREEN', compliancePercent: 92, criticality: 'Medium', lastReviewDate: new Date().toISOString(), type: 'Control' },
          NEW: { listName: 'Example New Object', healthStatus: 'BLUE', compliancePercent: 0, criticality: 'Medium', lastReviewDate: new Date().toISOString(), type: 'Procedure' },
        }
        const synObj = synthetic[level.id]
        result.push({ level, obj: synObj, synthetic: true, posture: computePosture(synObj) })
      }
    }
    return result
  }, [objects, gaps, mlgAssessments])

  const SIGNAL_COLORS = {
    health: '#16a34a',
    coverage: '#2563eb',
    freshness: '#d97706',
    gaps: '#dc2626',
    maturity: '#7c3aed',
  }

  return (
    <div className="posture-anatomy">
      <h3 className="posture-anatomy-title">Live from Your Inventory</h3>
      <p className="posture-anatomy-subtitle">
        Real objects scored by the weighted model. Each bar shows how much that signal contributes to the total.
      </p>
      <div className="posture-anatomy-grid">
        {examples.map(({ level, obj, posture, synthetic }) => (
          <div
            key={level.id}
            className={`anatomy-card ${synthetic ? 'synthetic' : ''}`}
            style={{ borderTopColor: level.dot }}
            onClick={() => !synthetic && obj.id && onNavigate('object-detail', obj.id)}
          >
            {/* Header with score */}
            <div className="anatomy-card-header">
              <div className="anatomy-card-identity">
                <span className="anatomy-card-name">{obj.listName}</span>
                {obj.type && <span className="anatomy-card-type">{obj.type}</span>}
              </div>
              <div className="anatomy-card-score-group">
                <span className="anatomy-score-num" style={{ color: posture.color }}>{posture.score}</span>
                <span className="posture-tag" style={{ backgroundColor: posture.bg, color: posture.color }}>
                  <span className="posture-dot" style={{ backgroundColor: posture.dot }} />
                  {posture.label}
                </span>
              </div>
            </div>

            {/* Score breakdown bars */}
            {posture.breakdown && (
              <div className="anatomy-breakdown">
                {Object.entries(posture.breakdown).filter(([k]) => k !== 'classificationAdjustment').map(([key, sig]) => (
                  <div key={key} className="anatomy-signal">
                    <div className="anatomy-signal-header">
                      <span className="anatomy-signal-label">{sig.label}</span>
                      <span className="anatomy-signal-value">{sig.weighted}/{sig.max}</span>
                    </div>
                    <div className="anatomy-signal-track">
                      <div
                        className="anatomy-signal-fill"
                        style={{
                          width: `${(sig.weighted / sig.max) * 100}%`,
                          backgroundColor: SIGNAL_COLORS[key],
                        }}
                      />
                    </div>
                  </div>
                ))}
                {posture.breakdown.classificationAdjustment !== 0 && (
                  <div className="anatomy-type-adj">
                    Informal penalty: {posture.breakdown.classificationAdjustment}
                  </div>
                )}
              </div>
            )}

            {synthetic && (
              <span className="anatomy-synthetic-badge">Synthetic example — no live object at this level</span>
            )}
            {!synthetic && (
              <span className="anatomy-view-link" style={{ color: level.dot }}>View object &rarr;</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Guide({ onNavigate }) {
  const { objects, gaps, standupItems, mlgAssessments } = useStore()
  const [aiContent, setAiContent] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  const typeCounts = useMemo(() => {
    const counts = {}
    for (const t of TAXONOMY) counts[t.type] = objects.filter(o => o.type === t.type).length
    return counts
  }, [objects])

  const handleProgramAssessment = async () => {
    setAiLoading(true)
    setAiError(null)
    setAiContent(null)
    try {
      const res = await getInsights({ objects, gaps, standupItems })
      setAiContent(res.content)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="guide-page">
      {/* Hero */}
      <div className="guide-hero">
        <div className="guide-hero-content">
          <div className="guide-hero-badge">Platform Guide</div>
          <h1>How CPM Works@@@fff</h1>
          <p>
            Cyber Product Management (CPM) governs your security program by tracking controls, processes, and procedures —
            measuring compliance coverage, identifying gaps, and maturing governance across your product families.
          </p>
        </div>
        <div className="guide-hero-visual">
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
            <circle cx="100" cy="100" r="65" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="40" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="100" cy="10" r="6" fill="#60a5fa" opacity="0.9" />
            <circle cx="190" cy="100" r="5" fill="#a78bfa" opacity="0.8" />
            <circle cx="100" cy="190" r="6" fill="#34d399" opacity="0.9" />
            <circle cx="10" cy="100" r="5" fill="#fb923c" opacity="0.8" />
            <circle cx="158" cy="42" r="4" fill="#38bdf8" opacity="0.7" />
            <circle cx="42" cy="158" r="4" fill="#f87171" opacity="0.7" />
            <path d="M100 60 L100 60 C100 60 130 72 130 100 C130 128 100 140 100 140 C100 140 70 128 70 100 C70 72 100 60 100 60Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <polyline points="90,100 97,107 112,92" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </div>

      {/* ── Object Taxonomy ── */}
      <div className="guide-section">
        <div className="guide-section-label">Object Taxonomy</div>
        <h2>The Three Object Types</h2>
        <p className="guide-section-desc">
          Everything in your inventory is one of three types. Understanding the distinctions
          is key to building a governance program that tells a clear, auditable story.
        </p>
        <div className="guide-taxonomy-grid">
          {TAXONOMY.map((t) => (
            <div key={t.type} className="guide-taxonomy-card" style={{ borderTopColor: t.color }}>
              <div className="guide-taxonomy-header">
                <div className="guide-taxonomy-icon" style={{ backgroundColor: t.bg, color: t.color }}>
                  {t.icon}
                </div>
                <div>
                  <h3>{t.type}</h3>
                  <span className="guide-taxonomy-headline">{t.headline}</span>
                </div>
              </div>
              <p className="guide-taxonomy-desc">{t.description}</p>
              <div className="guide-taxonomy-examples">
                <span className="guide-taxonomy-examples-label">Examples</span>
                <div className="guide-taxonomy-example-tags">
                  {t.examples.map((ex) => (
                    <span key={ex} className="guide-taxonomy-example-tag" style={{ backgroundColor: t.bg, color: t.color }}>{ex}</span>
                  ))}
                </div>
              </div>
              <div className="guide-taxonomy-posture-note">
                <span className="guide-taxonomy-posture-label">Posture scoring</span>
                <span className="guide-taxonomy-posture-text">{t.posture}</span>
              </div>
              <div className="guide-taxonomy-count" style={{ color: t.color }}>
                {typeCounts[t.type] || 0} in inventory
              </div>
            </div>
          ))}
        </div>

        {/* Relationship arrows */}
        <div className="guide-taxonomy-relationships">
          <h3>How They Relate</h3>
          <div className="guide-taxonomy-rel-grid">
            {TAXONOMY_RELATIONSHIPS.map((rel) => {
              const fromT = TAXONOMY.find(t => t.type === rel.from)
              const toT = TAXONOMY.find(t => t.type === rel.to)
              return (
                <div key={rel.label} className="guide-taxonomy-rel">
                  <span className="guide-rel-from" style={{ backgroundColor: fromT.bg, color: fromT.color }}>{rel.from}</span>
                  <span className="guide-rel-arrow">{rel.label}</span>
                  <span className="guide-rel-to" style={{ backgroundColor: toT.bg, color: toT.color }}>{rel.to}</span>
                  <span className="guide-rel-desc">{rel.desc}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Lifecycle ── */}
      <div className="guide-section">
        <div className="guide-section-label">The Lifecycle</div>
        <h2>Five Steps to Security Governance</h2>
        <p className="guide-section-desc">
          Every object follows this lifecycle. The platform automates the signals between each step.
        </p>
        <div className="guide-lifecycle">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div key={step.num} className="guide-step">
              <div className="guide-step-connector" style={{ backgroundColor: step.color }}>
                <span className="guide-step-num" style={{ color: step.color, borderColor: step.color }}>{step.num}</span>
                {i < LIFECYCLE_STEPS.length - 1 && <div className="guide-step-line" />}
              </div>
              <div className="guide-step-card">
                <div className="guide-step-icon" style={{ color: step.color, backgroundColor: step.color + '12' }}>
                  {step.icon}
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <span className="guide-step-feature" style={{ color: step.color }}>{step.feature}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How Posture is Scored ── */}
      <div className="guide-section">
        <div className="guide-section-label">Scoring</div>
        <h2>How Posture is Computed</h2>
        <p className="guide-section-desc">
          Each object receives a <strong>0-100 score</strong> computed from 5 weighted signals.
          The score is then mapped to a posture label based on the object's criticality.
        </p>

        {/* Weight breakdown */}
        <div className="guide-weight-table">
          <div className="guide-weight-header">
            <span>Signal</span>
            <span>Weight</span>
            <span>What it measures</span>
            <span>How it's scored</span>
          </div>
          {[
            { label: 'Health', weight: '25%', max: 25, color: '#16a34a', what: 'Owner\'s operational assessment', how: 'Green = 100, Amber = 50, Red = 10, Blue = 0' },
            { label: 'Coverage', weight: '25%', max: 25, color: '#2563eb', what: 'KPI numerator / denominator', how: 'Direct percentage (0-100)' },
            { label: 'Gaps', weight: '20%', max: 20, color: '#dc2626', what: 'Open deficiencies against this object', how: 'Starts at 100, diminishing penalties per gap (RED 30, AMBER 20, other 10)' },
            { label: 'Freshness', weight: '15%', max: 15, color: '#d97706', what: 'Days since last review', how: '≤30d = 100, ≤60d = 85, ≤90d = 70, ≤120d = 55, ≤180d = 35, 180+ = 10' },
            { label: 'Maturity', weight: '15%', max: 15, color: '#7c3aed', what: 'MLG governance score (0-20)', how: 'Mapped to 0-100 scale. Auto-derives Phase 1 from object data' },
          ].map((row) => (
            <div key={row.label} className="guide-weight-row">
              <span className="guide-weight-signal">
                <span className="guide-weight-dot" style={{ backgroundColor: row.color }} />
                {row.label}
              </span>
              <span className="guide-weight-pct">{row.weight}<span className="guide-weight-max">({row.max} pts)</span></span>
              <span className="guide-weight-what">{row.what}</span>
              <span className="guide-weight-how">{row.how}</span>
            </div>
          ))}
        </div>

        {/* Adjustments */}
        <div className="guide-scoring-adjustments">
          <div className="guide-adjustment-card">
            <strong>Criticality shifts thresholds</strong>
            <p>High/Critical objects need a higher score to achieve the same label. This means the same 70-score object
              is Healthy at Medium criticality but At Risk at High criticality.</p>
            <div className="guide-threshold-row">
              <div className="guide-threshold">
                <span className="guide-threshold-label">High / Critical</span>
                <div className="guide-threshold-bar">
                  <span className="guide-threshold-zone" style={{ width: '45%', backgroundColor: '#fef2f2', color: '#dc2626' }}>Critical &lt;45</span>
                  <span className="guide-threshold-zone" style={{ width: '30%', backgroundColor: '#fff7ed', color: '#ea580c' }}>At Risk 45-74</span>
                  <span className="guide-threshold-zone" style={{ width: '25%', backgroundColor: '#f0fdf4', color: '#16a34a' }}>Healthy 75+</span>
                </div>
              </div>
              <div className="guide-threshold">
                <span className="guide-threshold-label">Medium / Low</span>
                <div className="guide-threshold-bar">
                  <span className="guide-threshold-zone" style={{ width: '35%', backgroundColor: '#fef2f2', color: '#dc2626' }}>Critical &lt;35</span>
                  <span className="guide-threshold-zone" style={{ width: '30%', backgroundColor: '#fff7ed', color: '#ea580c' }}>At Risk 35-64</span>
                  <span className="guide-threshold-zone" style={{ width: '35%', backgroundColor: '#f0fdf4', color: '#16a34a' }}>Healthy 65+</span>
                </div>
              </div>
            </div>
          </div>
          <div className="guide-adjustment-card">
            <strong>Classification adjustment</strong>
            <p>Controls with Informal classification receive a 5% score reduction to nudge them toward formalization (scales proportionally).
              Blue health zeroes the health signal and forces the "New" label regardless of score (onboarding state).</p>
          </div>
        </div>

        {/* Live Posture Anatomy Cards */}
        <PostureAnatomyCards objects={objects} gaps={gaps} mlgAssessments={mlgAssessments} onNavigate={onNavigate} />
      </div>

      {/* ── Features ── */}
      <div className="guide-section">
        <div className="guide-section-label">Platform Features</div>
        <h2>What Each Module Does</h2>
        <div className="guide-features-grid">
          {FEATURES.map((f) => {
            const pageMap = {
              'CISO Dashboard': 'dashboard',
              'Object Inventory': 'objects',
              'Gap Tracker': 'onelist',
              'MLG Diagnostic': 'mlg',
              'Standup': 'standup',
              'CIS v8 Assessment': 'cis-v8',
              'NIST CSF 2.0': 'nist-csf',
              'Regulatory Intelligence': 'regulatory',
            }
            return (
              <div
                key={f.name}
                className="guide-feature-card"
                style={{ borderTopColor: f.color }}
                onClick={() => onNavigate(pageMap[f.name])}
              >
                <div className="guide-feature-icon" style={{ backgroundColor: f.bg, color: f.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3>{f.name}</h3>
                <p>{f.desc}</p>
                <span className="guide-feature-link" style={{ color: f.color }}>Open module &rarr;</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── AI Assessment ── */}
      <div className="guide-section">
        <div className="guide-section-label">AI-Powered</div>
        <h2>Program Assessment</h2>
        <p className="guide-section-desc">
          AI analyzes your full program — {objects.length} objects, {gaps.filter(g => g.status !== 'Closed').length} open gaps,
          {' '}{standupItems.filter(s => s.status === 'Open').length} open action items — and produces an executive briefing.
        </p>
        <div className="guide-ai-assessment">
          {!aiContent && !aiLoading && (
            <div className="guide-ai-trigger">
              <div className="guide-ai-stats">
                <div className="guide-ai-stat">
                  <span className="guide-ai-stat-num">{objects.length}</span>
                  <span className="guide-ai-stat-label">Objects</span>
                </div>
                <div className="guide-ai-stat">
                  <span className="guide-ai-stat-num">{gaps.filter(g => g.status !== 'Closed').length}</span>
                  <span className="guide-ai-stat-label">Open Gaps</span>
                </div>
                <div className="guide-ai-stat">
                  <span className="guide-ai-stat-num">{objects.filter(o => o.healthStatus === 'RED').length}</span>
                  <span className="guide-ai-stat-label">RED Health</span>
                </div>
                <div className="guide-ai-stat">
                  <span className="guide-ai-stat-num">
                    {objects.length ? Math.round(objects.reduce((s, o) => s + (o.compliancePercent || 0), 0) / objects.length) : 0}%
                  </span>
                  <span className="guide-ai-stat-label">Avg Coverage</span>
                </div>
              </div>
              <AiButton onClick={handleProgramAssessment} loading={aiLoading}>
                Run Program Assessment
              </AiButton>
              {aiError && <AiError error={aiError} onRetry={handleProgramAssessment} />}
            </div>
          )}
          {aiLoading && (
            <div className="guide-ai-loading">
              <div className="ai-loading-dots"><span /><span /><span /></div>
              <p>Analyzing your full program state...</p>
            </div>
          )}
          {aiContent && (
            <AiInlineResult content={aiContent} onClose={() => setAiContent(null)} />
          )}
        </div>
      </div>

      {/* Quick Start */}
      <div className="guide-section">
        <div className="guide-quickstart">
          <h2>Ready to Start?</h2>
          <p>Jump into the CISO Dashboard for an executive overview, or head to the Object Inventory to review your program's posture.</p>
          <div className="guide-quickstart-actions">
            <button className="btn-primary" onClick={() => onNavigate('dashboard')}>
              Open Dashboard
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('objects')}>
              View Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
