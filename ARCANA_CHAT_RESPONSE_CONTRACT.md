# ARCANA_CHAT_RESPONSE_CONTRACT.md — Phase 2

## The conversational contract (now live)

The advisor response now separates the natural message from the structured support:

```json
{
  "assistant_message": "natural conversational answer (frame + read + one question, as prose)",
  "reasoning": {                      // structured — for an expandable 'Why / evidence' drawer, NOT dumped in chat
    "tradeoffs":      [{"option","benefit","cost"}],
    "what_we_know":   ["..."],
    "what_we_still_need": ["..."]
  },
  "citations": [{"kind","domain","label","value","sourceTable","recordId","confidence","updatedAt"}],
  "relationships_referenced": [...],   // real cited graph edges
  "pending_key": "...", "candidate_goals": [...], "progress": {...}, "complete": bool
}
```

## Mapping to the requested shape

| Requested                        | Delivered                                                   |
| -------------------------------- | ----------------------------------------------------------- |
| `message`                        | `assistant_message` (conversational prose)                  |
| `cards` / structured support     | `reasoning.tradeoffs` (+ recommendations roadmap elsewhere) |
| `chips` (goals/risks/domains)    | `candidate_goals`, context_panel risks, `agent_domains`     |
| `sources` (expandable citations) | `citations[]` (25 live, full provenance)                    |
| `followup`                       | the single question inside `assistant_message`              |

## Invariants preserved

- Validator gates (invented-numbers, relationship, advice) — unchanged.
- Citations + provenance — unchanged (25 live).
- Safety fallback + discovery separation — unchanged.
