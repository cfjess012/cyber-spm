# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (port 5174, proxies /api to :8000)
npm run dev

# Express AI backend (port 8000, requires Ollama running)
npm run server

# Production build
npm run build

# Preview production build
npm run preview
```

Both `npm run server` and `npm run dev` must run simultaneously for AI features. There is no test runner, linter, or formatter configured.

CI (.github/workflows/ci.yml) runs on PRs to main: `npm install`, `npm run build`, then `cd server && npm install`.

## Architecture

**React 18 + Vite 6 SPA** with an Express 5 AI backend. No database — all state lives in localStorage via React Context + useReducer (`src/store/useStore.jsx`). The backend is a thin proxy to a local Ollama instance (`qwen2.5:7b`) with 13 GRC-specialized AI endpoints.

### Routing

No React Router. `App.jsx` uses `useState` for page navigation (`page`, `selectedObjectId`, `promotionData`). A `navigate()` callback threads through components.

### State (`src/store/useStore.jsx`)

- `useReducer` with 23+ action types, persisted to localStorage key `cpm_state`
- `migrateState()` handles schema evolution on load
- State shape: `{ objects, gaps, standupItems, mlgAssessments, frameworkOverrides, attestations, regulatoryQueue }`
- Store clears control-only fields (`classification`, `controlObjective`, `controlType`, `implementationType`, `executionFrequency`, `nistFamilies`) when type is not Control

### Posture Scoring (`src/utils/compliance.js`)

Posture is **computed at render time, never stored**. Weighted 0-100 score:
- Health 30% (GREEN=100, AMBER=50, RED=10, BLUE=0)
- Coverage 30% (KPI numerator/denominator)
- Freshness 20% (days since last review, banded)
- Maturity 20% (MLG score 0-20 scaled to 0-100)

Adjustments: Informal Controls get -5% reduction. BLUE health forces "New" label. Criticality shifts label thresholds (High/Critical needs 75+ for Healthy vs 65+ for Medium/Low).

### Object Types

3 types: **Control**, **Process**, **Procedure**. Each has type-specific form fields driven by `TYPE_CONFIG` in `ObjectForm.jsx`. Controls have a Formal/Informal classification toggle (not separate types).

### AI Backend (`server/`)

- `server/index.js` — Express 5 with 13 POST routes under `/api/ai/*` plus `/api/health`
- `server/prompts.js` — System prompts with GRC domain context, structured output requirements
- All AI features are advisory — suggestions only, humans approve everything
- JSON extraction handles LLM output wrapped in code fences or markdown

### Data Flow: Gap → Object

Pipeline items (gaps) in `GapTracker.jsx` follow: **Log → Triage → Promote**. Promotion (`PROMOTE_GAP`) creates a new object in the inventory and closes the pipeline item. Once objects exist, issues are tracked via `remediationItems[]` on the object itself.

### Framework Maturity

CIS v8 (18 controls) and NIST CSF 2.0 (6 functions, 22 categories) maturity is **auto-derived** from mapped objects' aggregate posture scores, with manual override capability via `frameworkOverrides` in state.

## Key Conventions

- **Tailwind CSS 4** with custom `@theme` tokens in `src/styles/index.css` (design tokens for colors, shadows, radii, fonts)
- Health uses RAG+Blue model: RED / AMBER / GREEN / BLUE (BLUE = not yet assessed)
- 7 product families: AI Security, Data Protection, Insider Risk, IAM, Software Security Services, Vulnerability Management, BISO
- Object history tracked as `{ action, note, timestamp }` arrays
- MLG assessments use flat format: `{ cadence: 'yes', ... }` not nested
- `computeMLGScore(assessment)` in `src/data/constants.js` is the shared MLG scoring utility
- Required fields vary by type: name/owner always required, outcome for Process, audience for Procedure, controlType/NIST for Formal Controls, RED health requires rationale
- Default health is BLUE, default classification is Informal (Controls only)
- Next review date auto-calculated from cadence + last review date via `CADENCE_DAYS` map
