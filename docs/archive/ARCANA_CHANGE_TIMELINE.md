# ARCANA_CHANGE_TIMELINE.md — Phase 6 (honest scope)

## Status: NOT built this turn

"Why did my readiness change?" → Document Uploaded → Fact Extracted → Life Model Updated → Readiness Changed → Recommendation Created — is a **provenance timeline** feature, not a chat-surfacing of an existing payload. It requires a backend endpoint that joins: `documents.documents.uploaded_at` → `life.facts` (extraction) → `life.readiness_snapshots` deltas → `recommendations` created_at, for a given change.

The data exists (all four stores have timestamps + provenance — see FAST_READ_CONTRACT.md), but assembling the ordered timeline is a new read, and rendering it is a new component. Out of scope for this frontend-only surfacing sprint; flagged as the next trust feature.

## What partially covers it today

The "Recently learned about you" dashboard strip already shows document → fact provenance ("Base salary: $185,000 from your offer letter · pending your confirmation"). The full upload→readiness→recommendation chain is the remaining build.
