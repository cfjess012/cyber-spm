# Cyber Product Management (CPM)

**A security product management platform that gives cyber departments a single pane of glass for tracking program health, measuring compliance coverage, identifying gaps, and maturing governance.**

CPM replaces the spreadsheet chaos that most security teams rely on with a structured, AI-augmented system that connects objects, controls, gaps, maturity, and frameworks into one unified workflow.

---

## Table of Contents

- [The Problem CPM Solves](#the-problem-cpm-solves)
- [Who It's For](#who-its-for)
- [Core Concepts](#core-concepts)
- [Platform Modules](#platform-modules)
  - [CISO Dashboard](#1-ciso-dashboard)
  - [Object Inventory](#2-object-inventory)
  - [Gap Tracker](#3-gap-tracker)
  - [MLG Diagnostic](#4-mlg-diagnostic)
  - [Standup](#5-standup)
  - [CIS v8 Assessment](#6-cis-v8-assessment)
  - [NIST CSF 2.0 Assessment](#7-nist-csf-20-assessment)
  - [Regulatory Intelligence](#8-regulatory-intelligence)
- [AI Capabilities](#ai-capabilities)
- [The Posture System](#the-posture-system)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Data Portability](#data-portability)

---

## The Problem CPM Solves

Most cyber departments manage their security program across a patchwork of spreadsheets, slide decks, ticketing systems, and tribal knowledge. This creates real problems:

| Pain Point | Impact |
|---|---|
| **No single source of truth** | Leadership asks "how are we doing?" and gets a different answer from every team |
| **Disconnected metrics** | Tool coverage, gap remediation, maturity assessments, and framework compliance live in separate silos |
| **Manual status reporting** | PMs spend hours assembling executive updates instead of driving outcomes |
| **No computed risk signal** | Health status is a gut feeling, not a derived metric |
| **Framework mapping is manual** | Mapping objects to CIS, NIST, or regulatory requirements requires expert knowledge and constant upkeep |
| **Governance maturity is invisible** | Teams know they're "not mature" but can't measure where or why |

**CPM solves this by creating a structured data model where every object, gap, maturity assessment, and framework mapping is connected — and the platform computes the signals that matter automatically.**

---

## Who It's For

| Role | How They Use CPM |
|---|---|
| **CISO / Security Leader** | Reviews the executive dashboard for program posture, trending health, and coverage gaps. Sets strategic priorities from gap analysis. |
| **Product Manager / Owner** | Owns objects in the inventory. Sets health status, runs MLG diagnostics, creates and tracks remediation gaps. |
| **Operator / Engineer** | Updates KPI coverage numbers, executes remediation actions, completes standup items, maintains review cadence. |
| **Compliance Analyst** | Reviews regulatory attestation queue, confirms AI-detected attestations, maps controls to NIST 800-53 families, monitors CIS and NIST CSF posture. |

---

## Core Concepts

### Objects
An **object** is anything your security program monitors: a tool, platform, service, process, vendor, dataset, model, or infrastructure component. Each object belongs to one or more of 7 **product families** (AI Security, Data Protection, Insider Risk, Identity & Access Management, Software Security Services, Vulnerability Management, Third Party Risk).

### Posture
A single, auto-computed signal that synthesizes **Health Status**, **Coverage %**, **Criticality**, and **Staleness** into one indicator. Instead of asking "what do 5 separate columns mean?", users see one answer: **Critical**, **At Risk**, **Healthy**, or **New**. See [The Posture System](#the-posture-system) for the full decision logic.

### Coverage
The percentage of in-scope assets protected by an object. Calculated as `KPI Numerator / KPI Denominator`. Each object also has a **KPI Definition** explaining what the numerator and denominator specifically count (e.g., "Production endpoints with EDR agent active / Total production endpoints").

### Health Status
A manual assessment (RED / AMBER / GREEN / BLUE) set by the object owner reflecting operational state. BLUE means onboarding — the object hasn't been assessed yet.

### Criticality
How important an object is to the business: **Critical**, **High**, **Medium**, or **Low**. Criticality weights the Posture calculation — a Critical object with low coverage escalates to Critical posture.

### Staleness
An object becomes **stale** when it hasn't been reviewed in 90+ days. Stale objects with high criticality automatically escalate Posture.

### Formal vs. Informal Controls
- **Formal controls** require NIST 800-53 family mapping, a control objective, control type (Preventive/Detective/Corrective/Compensating), and structured KPIs.
- **Informal controls** are tracked with lighter metadata — useful for processes, vendor relationships, and emerging capabilities that aren't yet formalized.

---

## Platform Modules

### 1. CISO Dashboard

The executive overview for security leadership. Displays:

- **KPI tiles** — Total objects, open gaps, RED health count, average coverage %, stale object count
- **Health distribution** — Donut chart showing RED/AMBER/GREEN/BLUE breakdown
- **Posture river** — Stacked area chart showing health trending over time
- **Maturity distribution** — Histogram of MLG tiers across all assessed objects
- **Coverage matrix** — Heatmap of product family vs. compliance coverage
- **Owner portfolio** — Each owner's objects with posture and coverage at a glance
- **AI Insights** — One-click executive briefing generated by AI analyzing the full program state

**Value**: A CISO opens this page Monday morning and knows exactly where the program stands, what's degrading, and who needs support — without asking anyone.

### 2. Object Inventory

The registry of everything in your security program. Three view modes:

- **Table View** — Flat sorted list with columns: Name, Posture, Coverage, Owner, Updated. Sortable and filterable by posture level and product family.
- **Cards View** — Product family dashboard panels. Each family card shows object count, posture breakdown bar, average coverage ring, worst-posture object, and owner avatars. Click to drill into the table filtered to that family.
- **Board View** — Kanban columns grouped by posture (Critical | At Risk | Healthy | New). Each object is a compact card. Visual triage at a glance.

Each object's detail page includes:

- Full metadata (type, criticality, environment, data classification, owner)
- **Compliance card** with KPI definition, numerator/denominator, coverage bar, and AI KPI Coherence Check
- **Controls card** with classification, control type, control objective, NIST 800-53 families, regulatory attestations, AI Control Coherence Check (Formal only), and AI regulatory scanning
- **Governance Maturity card** linking to the MLG diagnostic
- **Governance card** with review cadence, last/next review dates
- **Linked gaps** with status tracking
- **Full change history** audit trail

**Value**: A product manager opens one page and sees everything about their object — health, compliance, controls, maturity, gaps, and history — instead of cross-referencing 4 different systems.

### 3. Gap Tracker

Track deficiencies, risks, and remediation items against objects:

- Each gap has: title, description, linked object, status (Open/In Progress/Closed), severity, KPI, remediation notes, owner, due date
- **Aging badges** show how long gaps have been open
- **Expiry badges** flag overdue items
- **Educational helpers** guide users through gap creation with field-level hints
- **AI remediation plans** — Generate structured remediation strategies with timeline, milestones, and resource estimates
- **AI gap prioritization** — Rank all open gaps by risk-weighted urgency

**Value**: Gaps don't live in Jira tickets that get lost. They're linked to the objects they affect, tracked with aging/expiry, and the AI helps prioritize what to fix first.

### 4. MLG Diagnostic

A 4-phase governance maturity assessment for each object:

| Phase | Focus | Checkpoints |
|---|---|---|
| **P1: Foundation** | Does basic governance exist? | Owner assigned, description documented, KPI defined, review cadence set, criticality assessed |
| **P2: Action** | Is it being actively managed? | Health assessed, gaps tracked, remediation active, stakeholders engaged, review current |
| **P3: Controls** | Are formal controls in place? | Control classification, NIST mapping, control objective, control type, regulatory attestations |
| **P4: Maturity** | Is it optimizing? | Trending improving, automation in place, continuous monitoring, executive reporting, cross-team integration |

- 20 checkpoints scored Yes (1) / Weak (0.5) / No (0)
- Phase 1 **auto-derives** from the object's actual data (no manual input needed)
- AI can suggest answers for unchecked items based on the object's context
- Produces a **maturity tier** (Tier 1: Ad Hoc → Tier 4: Managed) with score breakdown

**Value**: Instead of arguing about whether something is "mature," teams have a structured, repeatable diagnostic with 20 specific checkpoints. Phase 1 auto-fills from existing data, so it starts useful immediately.

### 5. Standup

Track People, Process, and Action (PPA) items from team meetings:

- Add standup items manually or paste meeting notes and let AI parse them into structured action items
- Each item has: title, type (People/Process/Action), status (Open/In Progress/Done), owner, due date, notes
- **AI standup summary** — Generate a formatted summary of all items for async distribution
- **AI note parsing** — Paste raw meeting notes, AI extracts structured action items with owners and dates

**Value**: Meeting action items actually get tracked instead of dying in someone's notebook. AI turns messy notes into structured, assignable items.

### 6. CIS v8 Assessment

Maps your security objects to the 18 CIS Controls v8:

- **Radar chart** visualization of maturity across all 18 controls
- **Maturity auto-derived** from mapped objects' coverage and health (Level 0-5 CMMI scale)
- **Manual override** capability when auto-derived levels don't reflect reality
- **AI enterprise assessment** — One-click AI analysis that evaluates each control with rationale and suggested maturity level based on your actual program data

**Value**: Instead of manually assessing each CIS control in a spreadsheet, maturity is auto-derived from your existing objects. AI provides a second opinion with specific rationale per control.

### 7. NIST CSF 2.0 Assessment

Maps your program to the 6 NIST Cybersecurity Framework 2.0 functions and 22 categories:

- **Radar chart** showing function-level maturity
- **Bar chart** showing category-level detail
- **Maturity auto-derived** from mapped objects
- **Manual override** for each category
- **AI framework assessment** with per-category analysis

**Value**: NIST CSF compliance posture is visible at a glance, derived from actual program data, not self-assessed questionnaires.

### 8. Regulatory Intelligence

AI-powered regulatory attestation detection:

- AI scans each object's metadata (type, description, criticality, data classification, NIST families) to detect applicable regulations
- Detects: SOC 2, SOX, GDPR, HIPAA, PCI DSS, FedRAMP, ISO 27001, NIST 800-171, CCPA, and more
- **Human-in-the-loop queue** — AI suggestions go to a review queue where analysts confirm or dismiss
- Confirmed attestations appear on the object's detail page
- Pending review count shown as a sidebar badge

**Value**: Regulatory mapping is one of the most tedious tasks in GRC. AI proposes attestations with confidence scores, and humans verify — cutting mapping time from weeks to hours.

---

## AI Capabilities

CPM uses a local LLM (Ollama with qwen2.5:7b) for all AI features. No data leaves your network.

| Feature | What It Does |
|---|---|
| **Executive Insights** | Analyzes full program state and produces an executive briefing with top risks and recommendations |
| **Object Autofill** | Paste a description, AI suggests metadata (type, criticality, product family, NIST families) |
| **Risk Assessment** | Evaluates an object's risk profile based on its metadata, coverage, and context |
| **Remediation Plans** | Generates structured remediation strategies for gaps with timeline and milestones |
| **Gap Prioritization** | Ranks all open gaps by risk-weighted urgency |
| **MLG Assessment** | Suggests maturity checkpoint answers based on object context |
| **Standup Parsing** | Extracts structured action items from raw meeting notes |
| **Standup Summary** | Generates formatted summary of all standup items |
| **Framework Assessment** | Evaluates CIS v8 / NIST CSF maturity per control with rationale |
| **Regulatory Detection** | Scans objects to detect applicable regulatory frameworks |
| **KPI Coherence Check** | Evaluates whether an object's KPI numerator/denominator actually measures its control objective |
| **Control Coherence Check** | Evaluates whether a Formal control's description is audit-ready and measurable, with maturity alignment |
| **Program Assessment** | Full program analysis available from the Guide page |

All AI features are **advisory** — they surface suggestions and analysis but never automatically change scores or status. Humans make all decisions.

---

## The Posture System

Posture is computed automatically using a **priority cascade** — the first rule that matches determines the posture. No weights, no scoring — just a deterministic decision tree.

```
Rule 1: Health = BLUE?                      → New      (stop)
Rule 2: Health = RED?                       → Critical (stop)
Rule 3: Coverage < 50% AND High Criticality → Critical (stop)
Rule 4: Stale AND High Criticality          → Critical (stop)
Rule 5: Health = AMBER?                     → At Risk  (stop)
Rule 6: Coverage < 80% AND High Criticality → At Risk  (stop)
Rule 7: Stale?                              → At Risk  (stop)
Rule 8: Coverage < 50%?                     → At Risk  (stop)
Rule 9: No rules triggered                  → Healthy
```

**"High Criticality"** = criticality is Critical or High.

### Examples

| Object | Health | Coverage | Criticality | Stale | Posture | Rule |
|---|---|---|---|---|---|---|
| Cloud DLP | RED | 41.7% | High | No | **Critical** | #2: RED health always escalates |
| Insider Threat Platform | GREEN | 78.6% | Critical | No | **At Risk** | #6: Coverage < 80% for Critical object |
| MFA Rollout | AMBER | 77.5% | High | No | **At Risk** | #5: AMBER health |
| EDR Platform | GREEN | 93.3% | High | No | **Healthy** | #9: All clear |
| New Vendor Tool | BLUE | 0% | Medium | No | **New** | #1: BLUE = onboarding |

The Guide page includes **live anatomy cards** that pull real objects from your inventory and trace them through the full rule cascade, showing exactly which rules passed, which fired, and which were skipped.

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Ollama** running locally with the `qwen2.5:7b` model (for AI features)

### Installation

```bash
# Clone or navigate to the project
cd /path/to/cpm

# Install dependencies
npm install

# Pull the AI model (one-time)
ollama pull qwen2.5:7b
```

### Running

```bash
# Terminal 1 — Start the AI backend (Express on port 8000)
npm run server

# Terminal 2 — Start the frontend (Vite dev server)
npm run dev
```

The frontend will be available at `http://localhost:5174` and proxies all `/api` requests to the Express backend.

### First Steps

1. **Open the Guide** — Understand the lifecycle, concepts, and posture system
2. **Browse the CISO Dashboard** — See the executive overview with seed data
3. **Explore Object Inventory** — Switch between Table, Cards, and Board views
4. **Click any object** — See the full detail page with compliance, controls, maturity, and gaps
5. **Run an AI assessment** — Try "KPI Check" or "Check Control" on any Formal control
6. **Open the Gap Tracker** — Review open gaps and try AI remediation plans
7. **Run the MLG Diagnostic** — Assess governance maturity for any object

The platform ships with **27 seed objects**, **14 gaps**, **8 standup items**, and **4 MLG assessments** across all 7 product families so you can explore immediately.

---

## Architecture

```
cpm/
├── src/                          # React 18 SPA (Vite 6)
│   ├── components/
│   │   ├── Dashboard.jsx         # CISO Dashboard
│   │   ├── OneList/
│   │   │   ├── OneListView.jsx   # Object Inventory (Table/Cards/Board)
│   │   │   ├── ObjectDetail.jsx  # Object detail page
│   │   │   └── ObjectForm.jsx    # Add/Edit object form
│   │   ├── GapTracker.jsx        # Gap Tracker
│   │   ├── MLGDiagnostic.jsx     # Maturity diagnostic
│   │   ├── Standup.jsx           # PPA standup tracker
│   │   ├── CISAssessment.jsx     # CIS v8 assessment
│   │   ├── NISTCSFAssessment.jsx # NIST CSF 2.0 assessment
│   │   ├── Regulatory/           # Regulatory attestation queue
│   │   ├── Guide.jsx             # Platform guide + posture anatomy
│   │   └── DataPortability/      # Export/Import
│   ├── data/
│   │   ├── constants.js          # NIST families, product families, posture levels
│   │   ├── frameworks.js         # CIS v8 + NIST CSF controls & mapping
│   │   └── seedData.js           # 27 objects, 14 gaps, 8 standups, 4 MLGs
│   ├── store/
│   │   └── useStore.jsx          # React Context + useReducer, localStorage
│   ├── utils/
│   │   ├── compliance.js         # computePosture(), isStale(), formatDate()
│   │   ├── ai.js                 # AI client functions (13 endpoints)
│   │   └── export.js             # JSON/Excel export
│   └── styles/
│       └── index.css             # Full design system (~3600 lines)
├── server/
│   ├── index.js                  # Express 5, 13 AI routes, Ollama proxy
│   └── prompts.js                # GRC-specific system prompts per route
├── index.html
├── vite.config.js                # Vite config with /api proxy to :8000
└── package.json
```

### Key Design Decisions

- **localStorage persistence** — No database required. State persists in the browser via `useReducer` + `localStorage`. Export/import for backup and portability.
- **Local AI only** — All LLM inference runs through Ollama on localhost. No cloud API calls, no data exfiltration risk. The AI backend is a thin Express proxy that formats prompts and parses responses.
- **Posture is computed, not stored** — Posture is derived at render time from health, coverage, criticality, and staleness. No stale cached values.
- **Framework maturity is auto-derived** — CIS and NIST CSF maturity levels are computed from mapped objects' coverage, with manual override capability.
- **Advisory AI** — Every AI feature is suggestion-only. No automatic score changes, no silent mutations. Humans approve everything.

---

## Data Portability

CPM supports full data export and import:

- **JSON Export** — One-click backup of all objects, gaps, standup items, MLG assessments, framework overrides, attestations, and regulatory queue
- **JSON Import** — Restore from a backup file
- **Excel Export** — Export objects to `.xlsx` for spreadsheet workflows
- **Excel Import** — Import objects from Excel with fuzzy header matching (maps common column names to CPM fields automatically)

---

## Value Summary

| Before CPM | After CPM |
|---|---|
| 5 separate columns to assess one object | 1 computed Posture signal |
| Manual framework mapping in spreadsheets | Auto-derived maturity from actual coverage |
| "How are we doing?" requires 3 meetings | CISO Dashboard answers it in 10 seconds |
| Gap remediation tracked in Jira/email | Linked gaps with aging, expiry, and AI remediation plans |
| Regulatory mapping takes weeks | AI proposes attestations, humans verify |
| Maturity is a subjective conversation | 20-checkpoint diagnostic with auto-derived Phase 1 |
| Meeting action items disappear | Structured PPA tracker with AI note parsing |
| KPIs are numbers without context | KPI Definition + AI Coherence Check validates alignment |
| Control descriptions are vague | AI Control Coherence Check evaluates audit-readiness |

**CPM turns a reactive, spreadsheet-driven security program into a structured, measurable, AI-augmented governance operation.**
