# Bugs Found - ISR Ops Platform Code Audit (2026-02-19)

## BUG-001: GapForm auto-denominator state not synced when editing existing gap
- File: GapTracker.jsx line 61
- The `useAutoDeom` state (note: also has a typo - should be `useAutoDenom`) defaults to `false`
- When editing a gap that previously used auto-denominator, there's no way to know if it was auto
- The auto-denom checkbox won't be checked even if the denom equals objectIds.length
- Minor UX issue, not a data corruption bug

## BUG-002: Delete gap has no confirmation dialog
- File: GapTracker.jsx line 557
- Object delete has `confirm()` (ObjectDetail.jsx line 53), but gap delete dispatches immediately
- Risk: accidental data loss from misclick

## BUG-003: ExportImport still references "OneList" for Excel export
- File: ExportImport.jsx line 83
- Says "Download the entire OneList as an .xlsx file" - should say "Object Inventory"
- Label inconsistency after the rename

## BUG-004: Variable name typo `useAutoDeom`
- File: GapTracker.jsx line 61
- `const [useAutoDeom, setUseAutoDenom] = useState(false)`
- Should be `useAutoDenom` - currently getter has typo, setter is correct
- Functional (works correctly), but code quality issue

## BUG-005: GapForm validation allows empty objectIds submission via edge case
- File: GapTracker.jsx line 57
- Check is `form.objectIds.length === 0` but form.objectIds could be undefined if somehow corrupted
- Low risk since objectIds defaults to [] in useState

## BUG-006: Health rationale banner only shows for RED status on ObjectDetail
- File: ObjectDetail.jsx line 241
- `obj.healthStatus === 'RED' && obj.healthRationale` - only RED shows rationale
- AMBER objects with rationale won't display it. This may be intentional (RED-only requirement)
- But if user writes rationale for AMBER and then changes to GREEN, it's silently hidden

## BUG-007: MLG scores useMemo has stale dependency
- File: MLGDiagnostic.jsx line 78
- Dependencies: `[assessment, selectedObjId]`
- `assessment` is derived from `mlgAssessments[selectedObjId]` on line 22
- `getAnswer` on line 51 uses `assessment` variable from closure, not from memo deps
- Actually OK because `assessment` changes when either changes. Not a bug.

## BUG-008: Export sheet name still "OneList"
- File: export.js line 33
- `XLSX.utils.book_append_sheet(wb, ws, 'OneList')` - sheet tab named "OneList"
- Should be "Object Inventory" or "Objects" for consistency with rename
