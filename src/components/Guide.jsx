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
    num: '01', title: 'Identify', color: '#2563eb', feature: 'Object Inventory',
    desc: 'Register controls, processes, and procedures into your inventory. Classify each by type, criticality, and product family.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  },
  {
    num: '02', title: 'Assess', color: '#7c3aed', feature: 'Posture & Coverage',
    desc: 'Set health status, track KPI coverage, and let the platform compute a unified Posture signal for each object.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    num: '03', title: 'Remediate', color: '#ea580c', feature: 'OneList Pipeline',
    desc: 'Track net-new items that need to become monitored objects. Work items through the intake pipeline and promote to inventory.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  {
    num: '04', title: 'Mature', color: '#16a34a', feature: 'MLG Diagnostic',
    desc: 'Run the 4-phase MLG Diagnostic to measure governance maturity and identify the next steps for each object.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  },
  {
    num: '05', title: 'Report', color: '#0ea5e9', feature: 'CISO Dashboard',
    desc: 'The CISO Dashboard synthesizes everything into KPIs, trending charts, and coverage matrices for leadership.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
]

const FEATURES = [
  { name: 'CISO Dashboard', page: 'dashboard', desc: 'Executive overview with KPIs, health distribution, trending charts, coverage matrix, and owner portfolio.', color: '#2563eb', bg: '#eff6ff' },
  { name: 'Object Inventory', page: 'objects', desc: 'The registry of every control, process, and procedure. Each has auto-computed Posture, Coverage %, and full metadata.', color: '#7c3aed', bg: '#f5f3ff' },
  { name: 'OneList Pipeline', page: 'onelist', desc: 'Governance intake pipeline for net-new items. Log, triage, assign ownership, and promote to the Object Inventory.', color: '#ea580c', bg: '#fff7ed' },
  { name: 'MLG Diagnostic', page: 'mlg', desc: '4-phase maturity assessment: Foundation, Action, Controls, Maturity. Phase 1 auto-derives from object data.', color: '#16a34a', bg: '#f0fdf4' },
  { name: 'Standup', page: 'standup', desc: 'Track PPA (People, Process, Action) items. AI can parse meeting notes into structured action items.', color: '#0ea5e9', bg: '#f0f9ff' },
  { name: 'CIS v8 Assessment', page: 'cis-v8', desc: '18 CIS Controls mapped to objects. Maturity auto-derived from coverage. AI suggests maturity levels.', color: '#6366f1', bg: '#eef2ff' },
  { name: 'NIST CSF 2.0', page: 'nist-csf', desc: '6 core functions with 22 categories. Radar chart visualization and maturity scoring.', color: '#8b5cf6', bg: '#f5f3ff' },
  { name: 'Regulatory Intelligence', page: 'regulatory', desc: 'AI detects applicable attestations (SOC 2, SOX, GDPR, PCI DSS, etc.) with human-in-the-loop verification.', color: '#d97706', bg: '#fffbeb' },
]

const SCORING_SIGNALS = [
  { label: 'Health', weight: '30%', max: 30, color: '#16a34a', what: "Owner's operational assessment", how: 'Green = 100, Amber = 50, Red = 10, Blue = 0' },
  { label: 'Coverage', weight: '30%', max: 30, color: '#2563eb', what: 'KPI numerator / denominator', how: 'Direct percentage (0-100)' },
  { label: 'Freshness', weight: '20%', max: 20, color: '#d97706', what: 'Days since last review', how: '\u226430d = 100, \u226460d = 85, \u226490d = 70, \u2264120d = 55, \u2264180d = 35, 180+ = 10' },
  { label: 'Maturity', weight: '20%', max: 20, color: '#7c3aed', what: 'MLG governance score (0-20)', how: 'Mapped to 0-100 scale. Auto-derives Phase 1 from object data' },
]

const TABS = [
  { id: 'taxonomy', label: 'Taxonomy', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
  { id: 'lifecycle', label: 'Lifecycle', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/></svg> },
  { id: 'scoring', label: 'Scoring', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'compliance', label: 'Compliance', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
  { id: 'features', label: 'Features', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
]

/* ── Collapsible Section ── */
function Disclosure({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-white/50 rounded-xl bg-white/80 backdrop-blur-xl shadow-sm overflow-hidden transition-all duration-200">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 bg-transparent border-none cursor-pointer font-sans text-left group"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-[0.92rem] font-bold tracking-tight text-txt">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-txt-3 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </div>
  )
}

/* ── Live Posture Anatomy Cards ── */
function PostureAnatomyCards({ objects, mlgAssessments, onNavigate }) {
  const examples = useMemo(() => {
    const enriched = objects.map((obj) => ({
      ...obj,
      _posture: computePosture(obj, { mlgAssessment: mlgAssessments[obj.id] || null }),
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
  }, [objects, mlgAssessments])

  const SIGNAL_COLORS = { health: '#16a34a', coverage: '#2563eb', freshness: '#d97706', maturity: '#7c3aed' }

  return (
    <div>
      <p className="text-[0.82rem] text-txt-2 mb-4">
        Real objects scored by the weighted model. Each bar shows how much that signal contributes to the total.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {examples.map(({ level, obj, posture, synthetic }) => (
          <div
            key={level.id}
            className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 border-t-[3px] transition-all duration-200 ${synthetic ? 'opacity-60' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'}`}
            style={{ borderTopColor: level.dot }}
            onClick={() => !synthetic && obj.id && onNavigate('object-detail', obj.id)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[0.82rem] font-semibold text-txt truncate">{obj.listName}</span>
                {obj.type && <span className="text-[0.62rem] font-bold uppercase text-txt-3 mt-0.5">{obj.type}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xl font-[800] tracking-tight" style={{ color: posture.color }}>{posture.score}</span>
                <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: posture.bg, color: posture.color }}>
                  <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ backgroundColor: posture.dot }} />
                  {posture.label}
                </span>
              </div>
            </div>
            {posture.breakdown && (
              <div className="flex flex-col gap-2">
                {Object.entries(posture.breakdown).filter(([k]) => k !== 'classificationAdjustment').map(([key, sig]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[0.68rem]">
                      <span className="text-txt-3 font-medium">{sig.label}</span>
                      <span className="text-txt font-semibold">{sig.weighted}/{sig.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border-light overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(sig.weighted / sig.max) * 100}%`, backgroundColor: SIGNAL_COLORS[key] }} />
                    </div>
                  </div>
                ))}
                {posture.breakdown.classificationAdjustment !== 0 && (
                  <div className="text-[0.68rem] text-amber font-medium mt-1">Informal penalty: {posture.breakdown.classificationAdjustment}</div>
                )}
              </div>
            )}
            {synthetic && <span className="text-[0.62rem] text-txt-3 italic mt-2 block">Synthetic example</span>}
            {!synthetic && <span className="text-[0.72rem] font-semibold mt-2 block" style={{ color: level.dot }}>View object &rarr;</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Main Guide Component
   ═══════════════════════════════════════════════════ */
export default function Guide({ onNavigate }) {
  const { objects, gaps, standupItems, mlgAssessments } = useStore()
  const [activeTab, setActiveTab] = useState('taxonomy')
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
    <div className="max-w-[1100px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1e3a5f] via-[#1e293b] to-[#0f172a] rounded-2xl p-8 md:p-12 flex items-center gap-8 mb-8 overflow-hidden relative">
        <div className="flex-1 min-w-0">
          <div className="inline-flex text-[0.72rem] font-bold uppercase tracking-[0.12em] text-white/70 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full mb-4">Platform Guide</div>
          <h1 className="text-[2rem] md:text-[2.5rem] font-[800] tracking-tight text-white leading-tight mb-4">How CPM Works</h1>
          <p className="text-white/70 text-[0.95rem] leading-relaxed max-w-[520px]">
            Cyber Product Management governs your security program by tracking controls, processes, and procedures —
            measuring compliance, identifying gaps, and maturing governance across your product families.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center shrink-0">
          <svg width="180" height="180" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
            <circle cx="100" cy="100" r="65" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="40" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="100" cy="10" r="6" fill="#60a5fa" opacity="0.9" />
            <circle cx="190" cy="100" r="5" fill="#a78bfa" opacity="0.8" />
            <circle cx="100" cy="190" r="6" fill="#34d399" opacity="0.9" />
            <circle cx="10" cy="100" r="5" fill="#fb923c" opacity="0.8" />
            <path d="M100 60 L100 60 C100 60 130 72 130 100 C130 128 100 140 100 140 C100 140 70 128 70 100 C70 72 100 60 100 60Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <polyline points="90,100 97,107 112,92" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-subtle/60 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] border-none cursor-pointer font-sans text-[0.85rem] font-semibold transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-txt shadow-sm'
                : 'bg-transparent text-txt-3 hover:text-txt hover:bg-white/50'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={activeTab === tab.id ? 'text-brand' : 'text-txt-3'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab Content ═══ */}

      {/* ── Taxonomy Tab ── */}
      {activeTab === 'taxonomy' && (
        <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="mb-1">
            <h2 className="text-[1.35rem] font-[800] tracking-tight text-txt mb-1">The Three Object Types</h2>
            <p className="text-txt-2 text-[0.88rem] leading-relaxed max-w-[640px]">
              Everything in your inventory is one of three types. Understanding the distinctions
              is key to building a governance program that tells a clear, auditable story.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TAXONOMY.map((t) => (
              <div key={t.type} className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 border-t-[3px] transition-all duration-200 hover:shadow-md" style={{ borderTopColor: t.color }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: t.bg, color: t.color }}>
                    {t.icon}
                  </div>
                  <div>
                    <h3 className="text-[1rem] font-bold tracking-tight text-txt">{t.type}</h3>
                    <span className="text-[0.78rem] text-txt-2 font-medium">{t.headline}</span>
                  </div>
                </div>
                <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-4">{t.description}</p>
                <div className="mb-3">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 block mb-1.5">Examples</span>
                  <div className="flex flex-wrap gap-1.5">
                    {t.examples.map((ex) => (
                      <span key={ex} className="text-[0.68rem] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: t.bg, color: t.color }}>{ex}</span>
                    ))}
                  </div>
                </div>
                <div className="text-[0.82rem] font-bold mt-3 pt-3 border-t border-border-light" style={{ color: t.color }}>
                  {typeCounts[t.type] || 0} in inventory
                </div>
              </div>
            ))}
          </div>

          <Disclosure title="How They Relate">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TAXONOMY_RELATIONSHIPS.map((rel) => {
                const fromT = TAXONOMY.find(t => t.type === rel.from)
                const toT = TAXONOMY.find(t => t.type === rel.to)
                return (
                  <div key={rel.label} className="bg-subtle/40 rounded-xl p-4 flex flex-col items-center text-center gap-2">
                    <span className="text-[0.72rem] font-bold px-3 py-1 rounded-full" style={{ backgroundColor: fromT.bg, color: fromT.color }}>{rel.from}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    <span className="text-[0.78rem] font-semibold text-txt-2">{rel.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    <span className="text-[0.72rem] font-bold px-3 py-1 rounded-full" style={{ backgroundColor: toT.bg, color: toT.color }}>{rel.to}</span>
                    <span className="text-[0.72rem] text-txt-3 mt-1">{rel.desc}</span>
                  </div>
                )
              })}
            </div>
          </Disclosure>

          <Disclosure title="Posture Scoring by Type">
            <div className="flex flex-col gap-3">
              {TAXONOMY.map((t) => (
                <div key={t.type} className="flex items-start gap-3 bg-subtle/40 rounded-lg p-3">
                  <span className="text-[0.72rem] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: t.bg, color: t.color }}>{t.type}</span>
                  <span className="text-[0.82rem] text-txt-2 leading-relaxed">{t.posture}</span>
                </div>
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {/* ── Lifecycle Tab ── */}
      {activeTab === 'lifecycle' && (
        <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="mb-1">
            <h2 className="text-[1.35rem] font-[800] tracking-tight text-txt mb-1">Five Steps to Security Governance</h2>
            <p className="text-txt-2 text-[0.88rem] leading-relaxed max-w-[640px]">
              Every object follows this lifecycle. The platform automates the signals between each step.
            </p>
          </div>

          <div className="flex flex-col gap-0">
            {LIFECYCLE_STEPS.map((step, i) => (
              <div key={step.num} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[0.72rem] font-bold bg-white z-10" style={{ color: step.color, borderColor: step.color }}>{step.num}</span>
                  {i < LIFECYCLE_STEPS.length - 1 && <div className="w-px flex-1 bg-border-light -mt-px" />}
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 mb-4 flex-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ color: step.color, backgroundColor: step.color + '12' }}>
                    {step.icon}
                  </div>
                  <h3 className="text-[0.95rem] font-bold tracking-tight text-txt mb-1">{step.title}</h3>
                  <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-2">{step.desc}</p>
                  <span className="text-[0.72rem] font-bold" style={{ color: step.color }}>{step.feature}</span>
                </div>
              </div>
            ))}
          </div>

          <Disclosure title="Pipeline Workflow: Log \u2192 Triage \u2192 Promote" defaultOpen>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 text-[0.72rem] font-bold">1</span>
                <div>
                  <strong className="text-[0.85rem] text-txt">Log</strong>
                  <p className="text-[0.82rem] text-txt-2">Anyone spots a gap and logs it in 30 seconds: title, description, their name, and which team should review it.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-amber/10 text-amber flex items-center justify-center shrink-0 text-[0.72rem] font-bold">2</span>
                <div>
                  <strong className="text-[0.85rem] text-txt">Triage</strong>
                  <p className="text-[0.82rem] text-txt-2">A team analyst enriches the item: target type, assigned owner, criticality, and health assessment. This moves it to the Active Pipeline.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-green/10 text-green flex items-center justify-center shrink-0 text-[0.72rem] font-bold">3</span>
                <div>
                  <strong className="text-[0.85rem] text-txt">Promote</strong>
                  <p className="text-[0.82rem] text-txt-2">When an item reaches GREEN health, promote it to the Object Inventory. The ObjectForm opens pre-filled so you complete the remaining enrichment before the object is created.</p>
                </div>
              </div>
            </div>
          </Disclosure>
        </div>
      )}

      {/* ── Scoring Tab ── */}
      {activeTab === 'scoring' && (
        <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="mb-1">
            <h2 className="text-[1.35rem] font-[800] tracking-tight text-txt mb-1">How Posture is Computed</h2>
            <p className="text-txt-2 text-[0.88rem] leading-relaxed max-w-[640px]">
              Each object receives a <strong>0-100 score</strong> computed from 4 weighted signals,
              then mapped to a posture label based on the object's criticality.
            </p>
          </div>

          {/* Weight breakdown table */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_0.5fr_1.5fr_1.5fr] gap-4 px-5 py-3 bg-subtle/80 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-txt-3 border-b border-border-light">
              <span>Signal</span><span>Weight</span><span>What it measures</span><span>How it's scored</span>
            </div>
            {SCORING_SIGNALS.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_0.5fr_1.5fr_1.5fr] gap-4 px-5 py-3 border-b border-border-light last:border-0 hover:bg-brand/[0.02] transition-colors">
                <span className="flex items-center gap-2 text-[0.85rem] font-semibold text-txt">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  {row.label}
                </span>
                <span className="text-[0.95rem] font-[800] text-txt">{row.weight}<span className="text-[0.72rem] font-medium text-txt-3 ml-1">({row.max})</span></span>
                <span className="text-[0.82rem] text-txt-2">{row.what}</span>
                <span className="text-[0.82rem] text-txt-2">{row.how}</span>
              </div>
            ))}
          </div>

          <Disclosure title="Criticality Thresholds" defaultOpen>
            <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-4">
              High/Critical objects need a higher score to achieve the same label. The same 70-score object
              is Healthy at Medium criticality but At Risk at High criticality.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <span className="text-[0.72rem] font-bold text-txt-2 mb-1">High / Critical</span>
                <div className="flex rounded-full overflow-hidden h-6">
                  <span className="flex items-center justify-center text-[0.65rem] font-bold" style={{ width: '45%', backgroundColor: '#fef2f2', color: '#dc2626' }}>Critical &lt;45</span>
                  <span className="flex items-center justify-center text-[0.65rem] font-bold" style={{ width: '30%', backgroundColor: '#fff7ed', color: '#ea580c' }}>At Risk 45-74</span>
                  <span className="flex items-center justify-center text-[0.65rem] font-bold" style={{ width: '25%', backgroundColor: '#f0fdf4', color: '#16a34a' }}>Healthy 75+</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.72rem] font-bold text-txt-2 mb-1">Medium / Low</span>
                <div className="flex rounded-full overflow-hidden h-6">
                  <span className="flex items-center justify-center text-[0.65rem] font-bold" style={{ width: '35%', backgroundColor: '#fef2f2', color: '#dc2626' }}>Critical &lt;35</span>
                  <span className="flex items-center justify-center text-[0.65rem] font-bold" style={{ width: '30%', backgroundColor: '#fff7ed', color: '#ea580c' }}>At Risk 35-64</span>
                  <span className="flex items-center justify-center text-[0.65rem] font-bold" style={{ width: '35%', backgroundColor: '#f0fdf4', color: '#16a34a' }}>Healthy 65+</span>
                </div>
              </div>
            </div>
          </Disclosure>

          <Disclosure title="Classification Adjustment">
            <p className="text-[0.82rem] text-txt-2 leading-relaxed">
              Controls with <strong>Informal</strong> classification receive a 5% score reduction to nudge them toward formalization (scales proportionally).
              <strong> Blue</strong> health zeroes the health signal and forces the "New" label regardless of score (onboarding state).
            </p>
          </Disclosure>

          <Disclosure title="Live Posture Anatomy" defaultOpen>
            <PostureAnatomyCards objects={objects} mlgAssessments={mlgAssessments} onNavigate={onNavigate} />
          </Disclosure>
        </div>
      )}

      {/* ── Compliance Assessments Tab ── */}
      {activeTab === 'compliance' && (
        <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="mb-1">
            <h2 className="text-[1.35rem] font-[800] tracking-tight text-txt mb-1">Compliance Assessments</h2>
            <p className="text-txt-2 text-[0.88rem] leading-relaxed max-w-[640px]">
              Safeguard-level compliance assessment evaluates your security posture against industry
              frameworks using a dual-axis model: Policy Status and Implementation Status.
            </p>
          </div>

          {/* Dual-Axis Model */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
            <h3 className="text-[0.95rem] font-bold tracking-tight text-txt mb-3">Dual-Axis Scoring Model</h3>
            <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-4">
              Each safeguard is assessed on two independent axes. The combined Safeguard Score weights
              implementation more heavily because a policy without execution provides limited risk reduction.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-subtle/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] shrink-0" />
                  <span className="text-[0.85rem] font-semibold text-txt">Policy Status</span>
                  <span className="text-[0.72rem] font-bold text-txt-3 ml-auto">40% weight</span>
                </div>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  Does a written policy, standard, or procedure exist that addresses this safeguard?
                  Scored from 0% (no policy) to 100% (fully documented and approved).
                </p>
              </div>
              <div className="bg-subtle/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
                  <span className="text-[0.85rem] font-semibold text-txt">Implementation Status</span>
                  <span className="text-[0.72rem] font-bold text-txt-3 ml-auto">60% weight</span>
                </div>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  Is the safeguard technically deployed and operating effectively?
                  Scored from 0% (not implemented) to 100% (fully deployed, monitored, and tested).
                </p>
              </div>
            </div>
            <div className="bg-brand/[0.04] rounded-xl p-4 border border-brand/10">
              <span className="text-[0.82rem] font-semibold text-txt">Safeguard Score</span>
              <span className="text-[0.82rem] text-txt-2 ml-2">= Policy x 0.4 + Implementation x 0.6</span>
            </div>
          </div>

          {/* Supported Frameworks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'CIS v8', count: 153, color: '#6366f1', bg: '#eef2ff', desc: 'Center for Internet Security Critical Security Controls with 153 safeguards across 18 control families.' },
              { name: 'NIST CSF 2.0', count: '~106', color: '#8b5cf6', bg: '#f5f3ff', desc: 'NIST Cybersecurity Framework 2.0 with approximately 106 subcategories across 6 core functions.' },
              { name: 'GLBA', count: 47, color: '#0ea5e9', bg: '#f0f9ff', desc: 'Gramm-Leach-Bliley Act Safeguards Rule with 47 requirements for financial institution data protection.' },
              { name: 'NYDFS', count: 43, color: '#d97706', bg: '#fffbeb', desc: '23 NYCRR 500 (NYDFS Cybersecurity Regulation) with 43 requirements for financial services companies.' },
            ].map((fw) => (
              <div key={fw.name} className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 border-t-[3px]" style={{ borderTopColor: fw.color }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.72rem] font-bold" style={{ backgroundColor: fw.bg, color: fw.color }}>
                    {fw.count}
                  </div>
                  <span className="text-[0.92rem] font-bold tracking-tight text-txt">{fw.name}</span>
                </div>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">{fw.desc}</p>
              </div>
            ))}
          </div>

          {/* Maturity Mapping */}
          <Disclosure title="Score to CMMI Maturity Mapping" defaultOpen>
            <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-4">
              Each safeguard's combined score maps to a CMMI maturity level. Framework-level maturity
              is the average of all its safeguard scores, then mapped through the same bands.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { level: 'L0 — Incomplete', range: '0-10%', color: '#dc2626', bg: '#fef2f2', desc: 'Safeguard is absent or not addressed.' },
                { level: 'L1 — Initial', range: '11-30%', color: '#ea580c', bg: '#fff7ed', desc: 'Ad-hoc or reactive. Some awareness but no formal process.' },
                { level: 'L2 — Developing', range: '31-55%', color: '#d97706', bg: '#fffbeb', desc: 'Documented but inconsistently applied. Partial coverage.' },
                { level: 'L3 — Defined', range: '56-75%', color: '#2563eb', bg: '#eff6ff', desc: 'Standardized across the organization. Consistently executed.' },
                { level: 'L4 — Managed', range: '76-90%', color: '#7c3aed', bg: '#f5f3ff', desc: 'Measured and monitored. Quantitative management of processes.' },
                { level: 'L5 — Optimizing', range: '91-100%', color: '#16a34a', bg: '#f0fdf4', desc: 'Continuously improved. Proactive refinement based on metrics.' },
              ].map((m) => (
                <div key={m.level} className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: m.bg }}>
                  <span className="text-[0.78rem] font-bold shrink-0 w-32" style={{ color: m.color }}>{m.level}</span>
                  <span className="text-[0.72rem] font-bold text-txt-3 shrink-0 w-16">{m.range}</span>
                  <span className="text-[0.78rem] text-txt-2">{m.desc}</span>
                </div>
              ))}
            </div>
          </Disclosure>

          {/* CIS Implementation Groups */}
          <Disclosure title="CIS Implementation Groups (IG1 / IG2 / IG3)">
            <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-4">
              CIS v8 organizes its 153 safeguards into three Implementation Groups based on organizational
              risk profile and resources. The IG filter lets you scope your assessment to what applies to you.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-subtle/40 rounded-xl p-4">
                <span className="text-[0.85rem] font-bold text-[#16a34a] block mb-1">IG1 — Essential Hygiene</span>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  The minimum set every organization should implement. Focuses on the highest-value,
                  lowest-complexity safeguards. Suitable for small organizations with limited IT resources.
                </p>
              </div>
              <div className="bg-subtle/40 rounded-xl p-4">
                <span className="text-[0.85rem] font-bold text-[#2563eb] block mb-1">IG2 — Expanded Coverage</span>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  Adds safeguards for organizations managing sensitive data at enterprise scale.
                  Includes all IG1 safeguards plus additional technical and operational controls.
                </p>
              </div>
              <div className="bg-subtle/40 rounded-xl p-4">
                <span className="text-[0.85rem] font-bold text-[#7c3aed] block mb-1">IG3 — Comprehensive</span>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  The full set for organizations facing sophisticated threats. Includes all 153 safeguards
                  with advanced capabilities like penetration testing and red team exercises.
                </p>
              </div>
            </div>
          </Disclosure>

          {/* Workflow: Gaps from Safeguards */}
          <Disclosure title="Creating Gaps from Failing Safeguards">
            <div className="flex flex-col gap-3">
              <p className="text-[0.82rem] text-txt-2 leading-relaxed">
                When a safeguard scores below your threshold, you can create a pipeline item (gap)
                directly from the assessment view. This connects the compliance finding to your
                remediation workflow.
              </p>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-red/10 text-red flex items-center justify-center shrink-0 text-[0.72rem] font-bold">1</span>
                <div>
                  <strong className="text-[0.85rem] text-txt">Identify</strong>
                  <p className="text-[0.82rem] text-txt-2">Review safeguards with low scores in the assessment table. Look for gaps in policy or implementation.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-amber/10 text-amber flex items-center justify-center shrink-0 text-[0.72rem] font-bold">2</span>
                <div>
                  <strong className="text-[0.85rem] text-txt">Create Gap</strong>
                  <p className="text-[0.82rem] text-txt-2">Click the gap action on any safeguard row. A new pipeline item is created in the OneList, pre-filled with the framework and safeguard details.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-green/10 text-green flex items-center justify-center shrink-0 text-[0.72rem] font-bold">3</span>
                <div>
                  <strong className="text-[0.85rem] text-txt">Triage and Promote</strong>
                  <p className="text-[0.82rem] text-txt-2">The pipeline item follows the standard OneList workflow: triage with owner and criticality, then promote to the Object Inventory when remediated.</p>
                </div>
              </div>
            </div>
          </Disclosure>

          {/* Compliance Dashboard */}
          <Disclosure title="Compliance Dashboard and Trending">
            <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-3">
              The compliance dashboard provides scorecards for each framework showing overall maturity,
              the number of assessed safeguards, and average scores. Compliance snapshots capture
              point-in-time scores so you can track improvement over time.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-subtle/40 rounded-xl p-4">
                <span className="text-[0.85rem] font-bold text-txt block mb-1">Framework Scorecards</span>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  Each framework displays its overall score, maturity level, assessed vs. total safeguards,
                  and a breakdown by control family or function.
                </p>
              </div>
              <div className="bg-subtle/40 rounded-xl p-4">
                <span className="text-[0.85rem] font-bold text-txt block mb-1">Compliance Snapshots</span>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed">
                  Save a snapshot at any time to record your current scores. The trending view shows
                  how each framework's maturity has changed across snapshots.
                </p>
              </div>
            </div>
          </Disclosure>
        </div>
      )}

      {/* ── Features Tab ── */}
      {activeTab === 'features' && (
        <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="mb-1">
            <h2 className="text-[1.35rem] font-[800] tracking-tight text-txt mb-1">Platform Modules</h2>
            <p className="text-txt-2 text-[0.88rem] leading-relaxed max-w-[640px]">
              Each module serves a distinct purpose in the governance lifecycle. Click any card to jump in.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 border-t-[3px] cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col"
                style={{ borderTopColor: f.color }}
                onClick={() => onNavigate(f.page)}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: f.bg, color: f.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3 className="text-[0.92rem] font-bold tracking-tight text-txt mb-1">{f.name}</h3>
                <p className="text-[0.78rem] text-txt-2 leading-relaxed mb-3 flex-1">{f.desc}</p>
                <span className="text-[0.72rem] font-bold" style={{ color: f.color }}>Open module &rarr;</span>
              </div>
            ))}
          </div>

          {/* AI Assessment */}
          <Disclosure title="AI Program Assessment">
            <p className="text-[0.82rem] text-txt-2 leading-relaxed mb-4">
              AI analyzes your full program — {objects.length} objects, {gaps.filter(g => g.status !== 'Closed').length} pipeline items,
              {' '}{standupItems.filter(s => s.status === 'Open').length} open action items — and produces an executive briefing.
            </p>
            {!aiContent && !aiLoading && (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-[800] text-brand">{objects.length}</span>
                    <span className="text-[0.68rem] font-bold uppercase text-txt-3 mt-0.5">Objects</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-[800] text-brand">{gaps.filter(g => g.status !== 'Closed').length}</span>
                    <span className="text-[0.68rem] font-bold uppercase text-txt-3 mt-0.5">Pipeline</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-[800] text-brand">{objects.filter(o => o.healthStatus === 'RED').length}</span>
                    <span className="text-[0.68rem] font-bold uppercase text-txt-3 mt-0.5">RED</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-[800] text-brand">
                      {objects.length ? Math.round(objects.reduce((s, o) => s + (o.compliancePercent || 0), 0) / objects.length) : 0}%
                    </span>
                    <span className="text-[0.68rem] font-bold uppercase text-txt-3 mt-0.5">Coverage</span>
                  </div>
                </div>
                <AiButton onClick={handleProgramAssessment} loading={aiLoading}>Run Program Assessment</AiButton>
                {aiError && <AiError error={aiError} onRetry={handleProgramAssessment} />}
              </div>
            )}
            {aiLoading && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex gap-1.5"><span className="w-2 h-2 rounded-full bg-ai animate-[dotPulse_1.2s_infinite]" /><span className="w-2 h-2 rounded-full bg-ai animate-[dotPulse_1.2s_infinite]" style={{ animationDelay: '0.2s' }} /><span className="w-2 h-2 rounded-full bg-ai animate-[dotPulse_1.2s_infinite]" style={{ animationDelay: '0.4s' }} /></div>
                <p className="text-[0.85rem] text-txt-2">Analyzing your full program state...</p>
              </div>
            )}
            {aiContent && <AiInlineResult content={aiContent} onClose={() => setAiContent(null)} />}
          </Disclosure>
        </div>
      )}

      {/* ── CTA Footer ── */}
      <div className="mt-10 mb-12">
        <div className="bg-gradient-to-br from-[#1e3a5f] via-[#1e293b] to-[#0f172a] rounded-2xl p-8 text-center">
          <h2 className="text-[1.5rem] font-[800] tracking-tight text-white mb-2">Ready to Start?</h2>
          <p className="text-white/70 text-[0.92rem] mb-6 max-w-[460px] mx-auto">Jump into the CISO Dashboard for an executive overview, or head to the Object Inventory to review your program's posture.</p>
          <div className="flex items-center justify-center gap-3">
            <button className="bg-white text-[#1e293b] border-none rounded-[10px] px-5 py-2.5 text-[0.85rem] font-semibold cursor-pointer font-sans shadow-md hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200" onClick={() => onNavigate('dashboard')}>
              Open Dashboard
            </button>
            <button className="bg-transparent text-white/80 border border-white/20 rounded-[10px] px-4 py-2 text-[0.82rem] font-semibold cursor-pointer font-sans hover:bg-white/10 transition-all duration-150" onClick={() => onNavigate('objects')}>
              View Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
