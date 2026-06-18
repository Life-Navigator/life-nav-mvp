# Life Brief Collapse Report (Monday Pilot UX Cleanup)

**Component:** `apps/web/src/components/dashboard/LifeBrief.tsx`
**Goal:** Turn the full-bleed dark gradient hero ("wall of text") into a COMPACT card that is
expandable on demand. Layout/polish only — data source unchanged (`/api/life/my-life`
`life_brief` + `narrative_explanation`), all fields still rendered defensively (only when present),
and the honest "still forming" empty state is preserved.

## What changed visually

- **Container:** Was a full-bleed dark hero
  (`bg-gradient-to-br from-[#0f172a] via-[#13294b] to-[#0d3a4a] ... text-white`). Now a lighter card
  (`bg-gradient-to-br from-indigo-50 to-white`, dark text, `p-5`, `shadow-sm`) consistent with the
  other dashboard cards.
- **State:** Added `const [expanded, setExpanded] = useState(false)`.
- **Toggle:** A "View full brief" / "Hide full brief" button (`ChevronDown` / `ChevronUp`,
  `aria-expanded`) reveals the detail section.

## Collapsed view (default)

Always shown when the brief is ready:

| Element                   | Source field                                         | Notes                                      |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| "Your Life Brief" eyebrow | —                                                    | static label + Sparkles icon               |
| Headline                  | `headline`                                           | narrative title                            |
| Short summary             | `situation` + `tension` joined; falls back to `body` | 2–3 sentence summary                       |
| "Next move" line          | `next_move`                                          | indigo callout, rendered only when present |
| "Biggest risk" line       | `stakes`                                             | rose callout, rendered only when present   |
| View full brief toggle    | —                                                    | only the toggle, not the detail            |

The summary uses `[situation, tension]` (trimmed, non-empty, joined with a space); if both are
empty it falls back to `body`. Next move / biggest risk each render only when their field is a
non-empty string.

## Expanded view (after "View full brief")

Adds, below a divider, only the fields that are present:

| Element                               | Source field                                  |
| ------------------------------------- | --------------------------------------------- |
| "What you're holding right now" chips | `goals_held` (filtered non-empty)             |
| "What Arcana is watching" list        | `watching` (filtered non-empty)               |
| "What could change the plan" list     | `could_change` (filtered non-empty)           |
| Readiness line                        | `readiness_line`                              |
| Provenance (confidence % + source)    | `confidence_pct`, `source`                    |
| **Why Arcana believes this** panel    | `narrative_explanation` (`WhyArcanaBelieves`) |

The expanded chips/lists/provenance were re-styled from white-on-dark to dark-on-light to match the
new lighter card. The `WhyArcanaBelieves` panel (its own white card) is unchanged and now lives
inside the expanded region.

## Honest empty state (unchanged)

When `brief.ready` is false, the existing "Your Life Brief is still forming." card renders
(headline fallback + optional body + "Talk to your advisor" CTA + optional source). No narrative is
fabricated. When the API returns nothing (`!brief`), the component renders `null`. Loading shows the
"Composing your Life Brief…" spinner.

## Defensiveness

Every field is gated: chips/lists are filtered for non-empty strings; next-move, biggest-risk,
readiness line, and provenance each render only when their field exists. No fabricated content;
"No mock data — ever" preserved.

## Verification

- `pnpm -C apps/web type-check` — PASS.
- `eslint src/components/dashboard/LifeBrief.tsx` — PASS.
- No dedicated LifeBrief jest test exists; the dashboard test suite (MissionControl + ExecutiveSummary)
  passes 8/8.
