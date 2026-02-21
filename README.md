# Cyber Product Management (CPM)

**A security product management platform that gives cyber departments a single pane of glass for tracking program health, measuring compliance coverage, managing intake pipelines, and maturing governance.**

CPM replaces the spreadsheet chaos that most security teams rely on with a structured, AI-augmented system that connects Controls, Processes, Procedures, maturity assessments, and frameworks into one unified workflow.

---

## Table of Contents

- [The Problem CPM Solves](#the-problem-cpm-solves)
- [Who It's For](#who-its-for)
- [Core Concepts](#core-concepts)
- [Platform Modules](#platform-modules)
  - [CISO Dashboard](#1-ciso-dashboard)
  - [Object Inventory](#2-object-inventory)
  - [Intake Pipeline (OneList)](#3-intake-pipeline-onelist)
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
| **Disconnected metrics** | Tool coverage, remediation, maturity assessments, and framework compliance live in separate silos |
| **Manual status reporting** | PMs spend hours assembling executive updates instead of driving outcomes |
| **No computed risk signal** | Health status is a gut feeling, not a derived metric |
| **Framework mapping is manual** | Mapping objects to CIS, NIST, or regulatory requirements requires expert knowledge and constant upkeep |
| **Governance maturity is invisible** | Teams know they're "not mature" but can't measure where or why |

**CPM solves this by creating a structured data model where every object, pipeline item, maturity assessment, and framework mapping is connected — and the platform computes the signals that matter automatically.**

---

## Who It's For

| Role | How They Use CPM |
|---|---|
| **CISO / Security Leader** | Reviews the executive dashboard for program posture, trending health, and coverage gaps. Sets strategic priorities from pipeline and posture analysis. |
| **Product Manager / Owner** | Owns objects in the inventory. Sets health status, runs MLG diagnostics, manages remediation items, reviews pipeline intake. |
| **Operator / Engineer** | Updates KPI coverage numbers, executes remediation actions, completes standup items, maintains review cadence. |
| **Compliance Analyst** | Reviews regulatory attestation queue, confirms AI-detected attestations, maps controls to NIST 800-53 families, monitors CIS and NIST CSF posture. |

---

## Core Concepts

### Object Types

CPM tracks three types of objects, each with type-specific metadata:

| Type | Purpose | Key Fields |
|---|---|---|
| **Control** | A security mechanism (formal or informal) that enforces policy | Classification (Formal/Informal), control objective, function (Preventive/Detective/Corrective/Compensating), implementation type (Administrative/Technical/Physical), execution frequency, NIST 800-53 families (Formal only) |
| **Process** | A repeatable workflow with inputs, steps, and outcomes | Outcome, systems/tools |
| **Procedure** | Step-by-step instructions for implementers | Audience, scope, parent process linkage |

Every object also carries shared fields: name, owner, operator, product families, criticality, health status, review cadence, KPI coverage, environment, and data classification.

### Product Families

Objects belong to one or more of 7 product families:

1. AI Security
2. Data Protection
3. Insider Risk
4. Identity & Access Management
5. Software Security Services
6. Vulnerability Management
7. BISO

### Posture

A single, auto-computed score (0-100) that synthesizes **Health** (30%), **Coverage** (30%), **Freshness** (20%), and **Maturity** (20%) into one indicator. Instead of asking "what do 4 separate columns mean?", users see one answer: **Critical**, **At Risk**, **Healthy**, or **New**. See [The Posture System](#the-posture-system) for the full scoring model.

### Coverage

The percentage of in-scope assets protected by an object. Calculated as `KPI Numerator / KPI Denominator`. Each object type has a contextual KPI definition (e.g., Controls measure asset coverage, Processes measure successful completions, Procedures measure adherence rate).

### Health Status

A manual assessment (RED / AMBER / GREEN / BLUE) set by the object owner reflecting operational state. BLUE means the object hasn't been assessed yet and forces a **New** posture label regardless of score.

### Criticality

How important an object is to the business: **Critical**, **High**, **Medium**, or **Low**. Criticality shifts posture thresholds — High/Critical objects need a score of 75+ for Healthy, while Medium/Low need 65+.

### Formal vs. Informal Controls

Both are the **Control** object type, distinguished by a classification toggle:

- **Formal** — Requires NIST 800-53 family mapping, a control objective, control type, implementation type, and execution frequency. No posture penalty.
- **Informal** — Tracked with lighter metadata for ad-hoc or emerging capabilities. Receives a 5% posture score reduction reflecting lower governance rigor.

---

## Platform Modules

### 1. CISO Dashboard

The executive overview for security leadership. Displays:

- **KPI tiles** — Total objects, active objects, stale count (90+ days without review), average compliance %, pipeline items (open/in-progress/closed), standup action count
- **Posture river** — Stacked area chart showing distribution of CRITICAL, AT_RISK, HEALTHY, and NEW posture states over time
- **Gap velocity** — Dual-line chart tracking intake vs. resolved pipeline items with trend indicator (improving/worsening/stable)
- **Health distribution** — Donut chart showing RED/AMBER/GREEN/BLUE breakdown across active objects
- **Maturity distribution** — Bar chart of MLG tiers (Deficient, Developing, Adequate, Mature)
- **Review activity heatmap** — GitHub-style 52-week calendar grid showing review activity and average compliance
- **Coverage matrix** — Heatmap of product families vs. criticality levels, showing object count and average posture per cell
- **Owner portfolio** — Table with each owner's object count, average compliance, and top posture level
- **AI Insights** — One-click executive briefing generated by AI analyzing the full program state

**Value**: A CISO opens this page Monday morning and knows exactly where the program stands, what's degrading, and who needs support — without asking anyone.

### 2. Object Inventory

The registry of everything in your security program. Three view modes:

- **Table View** — Sorted list with posture score, coverage, owner, type, and last updated. Sortable by posture, name, owner, type, or date. Filterable by posture level and product family. Full-text search across name, owner, type, and description.
- **Cards View** — Grouped by product family. Each family card shows object count, posture breakdown, and coverage metrics.
- **Board View** — Kanban columns grouped by posture (Critical | At Risk | Healthy | New). Visual triage at a glance.

Each object's detail page includes a sidebar + 3-card layout:

- **Identity card** — Name, type, criticality, status, owner, operator, product families
- **Health & Coverage card** — RAG+Blue status with rationale, KPI numerator/denominator, compliance %, AI KPI Coherence Check
- **Type-specific card** — Control Classification (Formal/Informal toggle, control objective, function, implementation, frequency, NIST families), Process Overview (outcome, systems/tools), or Procedure Context (audience, scope, parent process linkage)
- **MLG card** — Links to the governance maturity diagnostic for the object
- **Remediation Items** — Inline list of open/in-progress/resolved remediation items with severity (RED/AMBER) and notes
- **Change history** — Audit trail of health, status, classification, and ownership changes with timestamps

Creating a new object starts with a **type picker** (Control / Process / Procedure) before any fields appear. AI can auto-fill metadata from a free-text description.

**Value**: A product manager opens one page and sees everything about their object — health, compliance, controls, maturity, remediation, and history — instead of cross-referencing 4 different systems.

### 3. Intake Pipeline (OneList)

A two-step workflow for items that don't exist in the inventory yet — gaps, needs, or requests:

**Step 1: Log (30-second intake)**
Anyone can log an item with just a title, description, team assignment, and their name. No expertise required.

**Step 2: Triage (enrichment)**
A reviewer enriches the item with: target type (Control/Process/Procedure), owner, criticality, health status, classification, NIST families, and KPI fields.

**Promotion:**
Once triaged, items can be **promoted to the Object Inventory** — the pipeline item becomes a fully registered object with all enriched metadata carried over, and the pipeline item is marked Closed.

Additional features:
- **Status tracking** — Open / In Progress / Closed with aging badges
- **AI remediation plans** — Generate structured remediation strategies
- **AI gap prioritization** — Rank all open items by risk-weighted urgency
- **History** — Each item tracks triage events, status changes, and promotion

**Value**: Anyone in the organization can raise a need in 30 seconds. Reviewers triage and enrich. Mature items get promoted into the formal inventory. Nothing falls through the cracks.

### 4. MLG Diagnostic

A 4-phase governance maturity assessment for each object:

| Phase | Focus | Checkpoints |
|---|---|---|
| **P1: Foundation** | Does basic governance exist? | Cadence, health criteria, ownership, scope, stakeholders |
| **P2: Action** | Is it being actively managed? | Gap process, remediation workflow, action tracking, escalation, communication |
| **P3: Controls** | Are formal controls in place? | NIST mapped, testing schedule, evidence, exceptions, automation |
| **P4: Maturity** | Is it optimizing? | Monitoring, KPIs, trends, predictive, knowledge |

- 20 checkpoints scored **Yes** (1) / **Weak** (0.5) / **No** (0) for a total of 0-20 points
- Phase 1 has **3 gatekeepers** (cadence, health criteria, ownership) — all must be Yes or Weak before Phase 1 is complete
- Phase 1 **auto-derives** from the object's data: if an object has a review cadence, owner, and description, those checkpoints auto-fill
- AI can suggest answers for all checkpoints based on the object's context
- Produces a **maturity tier**: Deficient (0-5), Developing (6-10), Adequate (11-15), Mature (16-20)

**Value**: Instead of arguing about whether something is "mature," teams have a structured, repeatable diagnostic with 20 specific checkpoints. Phase 1 auto-fills from existing data, so it starts useful immediately.

### 5. Standup

Track action items from governance meetings:

- Add items manually with action, owner, product family, due date, and status (Open/Closed)
- **AI note parsing** — Paste raw meeting notes, AI extracts structured action items with owners, products, and suggested due dates. Apply all at once or selectively.
- **AI standup summary** — Generate a formatted executive summary grouped by product, status, owner, with deadline and risk highlights
- Filter by product family and status

**Value**: Meeting action items actually get tracked instead of dying in someone's notebook. AI turns messy notes into structured, assignable items.

### 6. CIS v8 Assessment

Maps your security objects to the 18 CIS Controls v8:

- **18-point radar chart** (SVG) visualization of maturity across all controls
- **Maturity bar chart** — Horizontal bars per control with color gradient (Level 0-5 CMMI scale)
- **Maturity auto-derived** from mapped objects' aggregate posture scores
- **Manual override** capability when auto-derived levels don't reflect reality
- **AI enterprise assessment** — One-click AI analysis that evaluates each control with rationale and suggested maturity level based on your actual program data

**Value**: Instead of manually assessing each CIS control in a spreadsheet, maturity is auto-derived from your existing objects. AI provides a second opinion with specific rationale per control.

### 7. NIST CSF 2.0 Assessment

Maps your program to the 6 NIST Cybersecurity Framework 2.0 functions and 22 categories:

- **Hexagonal radar chart** showing function-level maturity (Govern, Identify, Protect, Detect, Respond, Recover)
- **Function bar chart** with maturity levels (0-5)
- **Category grid** — Expandable per-function breakdown of all 22 categories
- **Maturity auto-derived** from mapped objects
- **Manual override** for each category
- **AI framework assessment** with per-category analysis

**Value**: NIST CSF compliance posture is visible at a glance, derived from actual program data, not self-assessed questionnaires.

### 8. Regulatory Intelligence

AI-powered regulatory attestation detection across 14 frameworks:

**Supported attestations:** SOC 1, SOC 2, SOX, OCC, NYDFS 500, FFIEC, GLBA, PCI DSS, HIPAA, GDPR, CCPA/CPRA, ISO 27001, NIST CSF, FedRAMP

**Workflow:**
1. **Scan** — AI analyzes each object's metadata to detect applicable regulations, returning confidence levels (high/medium/low) with rationale
2. **Review** — Detections land in a human-in-the-loop queue where analysts confirm or dismiss
3. **Confirm** — Confirmed attestations appear on the object's detail page

**Value**: Regulatory mapping is one of the most tedious tasks in GRC. AI proposes attestations with confidence scores, and humans verify — cutting mapping time from weeks to hours.

---

## AI Capabilities

CPM uses a local LLM (Ollama with `qwen2.5:7b`) for all AI features. No data leaves your network.

| Feature | What It Does |
|---|---|
| **Executive Insights** | Analyzes full program state and produces an executive briefing with top risks and recommendations |
| **Object Autofill** | Paste a description, AI suggests type, criticality, product families, cadence, implementation type, and execution frequency |
| **Risk Assessment** | Evaluates an object's risk profile based on its metadata, coverage, and context |
| **Remediation Plans** | Generates structured remediation strategies for pipeline items with timeline and milestones |
| **Pipeline Prioritization** | Ranks all open pipeline items by risk-weighted urgency |
| **MLG Assessment** | Suggests maturity checkpoint answers based on object context |
| **Standup Parsing** | Extracts structured action items from raw meeting notes with owners, products, and due dates |
| **Standup Summary** | Generates executive summary grouped by product, status, and owner |
| **Framework Assessment** | Evaluates CIS v8 / NIST CSF maturity per control/category with rationale |
| **Regulatory Detection** | Scans objects to detect applicable regulatory frameworks with confidence scoring |
| **KPI Coherence Check** | Evaluates whether an object's KPI numerator/denominator actually measures what it should |
| **Control Coherence Check** | Evaluates whether a Formal control's description is audit-ready and measurable |

All AI features are **advisory** — they surface suggestions and analysis but never automatically change scores or status. Humans make all decisions.

---

## The Posture System

Posture is a **weighted score from 0 to 100**, computed automatically from four signals:

| Signal | Weight | Source | Scale |
|---|---|---|---|
| **Health** | 30% | Owner-set RAG+Blue status | GREEN=100, AMBER=50, RED=10, BLUE=0 |
| **Coverage** | 30% | KPI compliance % (numerator/denominator) | Direct percentage |
| **Freshness** | 20% | Days since last review | ≤30d=100, ≤60d=85, ≤90d=70, ≤120d=55, ≤180d=35, >180d=10 |
| **Maturity** | 20% | MLG diagnostic score (0-20 scaled to 0-100) | score / 20 * 100 |

```
Posture Score = (health * 0.3) + (coverage * 0.3) + (freshness * 0.2) + (maturity * 0.2)
```

### Adjustments

- **Informal Controls** receive a 5% score reduction: `score -= score * 0.05`
- **BLUE health** overrides to **New** posture regardless of computed score

### Criticality-Based Thresholds

The score maps to a posture label, but the thresholds shift based on criticality:

| Criticality | Healthy | At Risk | Critical |
|---|---|---|---|
| **High / Critical** | 75+ | 45-74 | Below 45 |
| **Medium / Low** | 65+ | 35-64 | Below 35 |

### Examples

| Object | Health | Coverage | Freshness | Maturity | Score | Criticality | Posture |
|---|---|---|---|---|---|---|---|
| EDR Platform | GREEN (100) | 93% | 30d (100) | 14/20 (70) | **88** | High | **Healthy** |
| MFA Rollout | AMBER (50) | 78% | 45d (85) | 8/20 (40) | **59** | High | **At Risk** |
| Cloud DLP | RED (10) | 42% | 120d (55) | 3/20 (15) | **29** | High | **Critical** |
| New Vendor Tool | BLUE (0) | 0% | — | — | **0** | Medium | **New** |

The Guide page includes live anatomy cards that trace real objects through the full scoring model.

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Ollama** running locally with the `qwen2.5:7b` model (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/cfjess012/cyber-spm.git
cd cyber-spm

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

1. **Open the Guide** — Understand the taxonomy (Control/Process/Procedure), lifecycle, and posture scoring model
2. **Browse the CISO Dashboard** — See the executive overview with seed data
3. **Explore Object Inventory** — Switch between Table, Cards, and Board views
4. **Click any object** — See the full detail page with health, compliance, type-specific metadata, remediation items, and history
5. **Run an AI assessment** — Try "KPI Check" or "Check Control" on any Formal control
6. **Open the Intake Pipeline** — Review pipeline items, triage one, and try promoting to inventory
7. **Run the MLG Diagnostic** — Assess governance maturity for any object

The platform ships with **26 seed objects**, **14 pipeline items**, **8 standup items**, and **4 MLG assessments** across all 7 product families so you can explore immediately.

---

## Architecture

```
cpm/
├── src/                              # React 18 SPA (Vite 6, Tailwind CSS 4)
│   ├── App.jsx                       # Routes & layout
│   ├── components/
│   │   ├── Dashboard.jsx             # CISO Dashboard (KPIs, charts, analytics)
│   │   ├── Sidebar.jsx               # Navigation with mobile FAB
│   │   ├── AiPanel.jsx               # Slide-in AI response panel
│   │   ├── ConfirmDialog.jsx         # Destructive action confirmation
│   │   ├── Guide.jsx                 # Taxonomy, lifecycle, scoring guide
│   │   ├── OneList/
│   │   │   ├── OneListView.jsx       # Object Inventory (Table/Cards/Board)
│   │   │   ├── ObjectDetail.jsx      # Object detail (sidebar + 3 cards)
│   │   │   └── ObjectForm.jsx        # Type-conditional add/edit form
│   │   ├── Remediation/
│   │   │   └── GapTracker.jsx        # Intake pipeline (Log → Triage → Promote)
│   │   ├── MLG/
│   │   │   └── MLGDiagnostic.jsx     # 4-phase maturity diagnostic
│   │   ├── Standup/
│   │   │   └── StandupView.jsx       # Action tracking + AI note parsing
│   │   ├── Frameworks/
│   │   │   ├── CISAssessment.jsx     # CIS v8 (18 controls, radar chart)
│   │   │   └── NISTCSFAssessment.jsx # NIST CSF 2.0 (6 functions, 22 categories)
│   │   ├── Regulatory/
│   │   │   └── RegulatoryQueue.jsx   # Attestation detection & verification
│   │   └── DataPortability/
│   │       └── ExportImport.jsx      # Excel/JSON export-import
│   ├── data/
│   │   ├── constants.js              # Product families, health statuses, MLG phases, NIST 800-53
│   │   ├── frameworks.js             # CIS v8 + NIST CSF 2.0 controls & mapping engine
│   │   └── seedData.js              # 26 objects, 14 pipeline items, 8 standups, 4 MLGs
│   ├── store/
│   │   └── useStore.jsx              # React Context + useReducer, localStorage, 23 actions
│   ├── utils/
│   │   ├── compliance.js             # computePosture() weighted scoring, signal functions
│   │   └── ai.js                     # AI client functions (12 endpoints)
│   └── styles/
│       ├── index.css                 # Tailwind CSS 4 theme & utilities
│       └── animations.css            # Keyframe animations
├── server/
│   ├── index.js                      # Express 5, 12 AI routes, Ollama proxy
│   └── prompts.js                    # GRC-specific system prompts per route
├── .github/
│   └── workflows/ci.yml             # CI pipeline (build checks on PRs)
├── index.html
├── vite.config.js                    # Vite config with Tailwind plugin, /api proxy to :8000
└── package.json
```

### Key Design Decisions

- **localStorage persistence** — No database required. State persists in the browser via `useReducer` + `localStorage`. Export/import for backup and portability. Auto-migration handles schema changes.
- **Local AI only** — All LLM inference runs through Ollama on localhost. No cloud API calls, no data exfiltration risk. The AI backend is a thin Express proxy that formats prompts and parses responses.
- **Posture is computed, not stored** — Posture is derived at render time from health, coverage, freshness, and maturity. No stale cached values.
- **Type-conditional forms** — Object creation adapts its fields based on type (Control/Process/Procedure), so each type captures exactly the metadata it needs.
- **Framework maturity is auto-derived** — CIS and NIST CSF maturity levels are computed from mapped objects' aggregate posture, with manual override capability.
- **Advisory AI** — Every AI feature is suggestion-only. No automatic score changes, no silent mutations. Humans approve everything.

---

## Data Portability

CPM supports full data export and import:

- **JSON Export** — One-click full backup of all objects, pipeline items, standup items, MLG assessments, framework overrides, attestations, and regulatory queue
- **JSON Import** — Full state restore from a backup file with automatic migration for schema changes
- **Excel Export** — Export objects to `.xlsx` with 26 columns covering all metadata
- **Excel Import** — Import objects from Excel with fuzzy header matching (50+ column name aliases mapped to CPM fields automatically). Supports upsert — matches by name, updates existing or creates new.

---

## Value Summary

| Before CPM | After CPM |
|---|---|
| 4 separate columns to assess one object | 1 weighted posture score (0-100) from 4 signals |
| Manual framework mapping in spreadsheets | Auto-derived maturity from actual object posture |
| "How are we doing?" requires 3 meetings | CISO Dashboard answers it in 10 seconds |
| New needs tracked in email/chat | Intake pipeline: Log in 30 sec → Triage → Promote to inventory |
| Regulatory mapping takes weeks | AI proposes attestations, humans verify |
| Maturity is a subjective conversation | 20-checkpoint diagnostic with auto-derived Phase 1 and gatekeepers |
| Meeting action items disappear | Structured action tracker with AI note parsing |
| KPIs are numbers without context | KPI definitions + AI Coherence Check validates alignment |
| Controls, processes, procedures all look the same | Type-conditional forms capture exactly the right metadata per type |

**CPM turns a reactive, spreadsheet-driven security program into a structured, measurable, AI-augmented governance operation.**
