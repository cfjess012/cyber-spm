# PM Agent Memory - ISR Ops Platform

## Project Overview
- React SPA (Vite dev server on port 5174), no backend auth, localStorage persistence
- State: useStore.jsx with useReducer + Context (objects, gaps, standupItems, mlgAssessments)
- AI features proxy to localhost:8000/api (non-critical, graceful error handling)

## Architecture
- App.jsx: page-based routing via useState (dashboard, objects, object-detail, onelist, mlg, standup, data)
- Sidebar: "Object Inventory / Program Health" (route: objects), "OneList / Gap Tracker" (route: onelist)
- Objects = program health register; Gaps = deficiency/remediation tracker
- Gaps link to objects via `objectIds` array (multi-select); legacy `objectId` migrated

## Key Files
- `/src/store/useStore.jsx` - all state management (ADD_OBJECT + UPDATE_GAP for promotion)
- `/src/components/Remediation/GapTracker.jsx` - gap form + list (24KB, largest component)
- `/src/components/OneList/OneListView.jsx` - object table view
- `/src/components/OneList/ObjectDetail.jsx` - object detail + related gaps
- `/src/components/OneList/ObjectForm.jsx` - object add/edit modal (24+ fields)
- `/src/data/constants.js` - NIST families, product families, statuses, health colors

## Known Issues Found (2026-02-19)
- See `bugs-found.md` for detailed bug report from code audit
- GapForm auto-denominator state not synced on edit
- Delete gap has no confirmation dialog
- ExportImport Excel export description says "OneList" (legacy label)
