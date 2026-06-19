# Document Extraction Architecture

**Date:** 2026-06-18 · Per the mandate: decide whether OCR is required — _after_ proving the real break (the bridge, now fixed), not before.

## Is OCR actually required? — Only for scanned/image PDFs.

| Doc type         | Native text (PyMuPDF) works? | OCR needed?         | Current extraction quality                |
| ---------------- | ---------------------------- | ------------------- | ----------------------------------------- |
| Will             | Yes if native PDF            | Only if scanned     | Low — prose, few labeled fields           |
| Trust            | Yes if native PDF            | Only if scanned     | Low — prose                               |
| Life Insurance   | Usually (declarations page)  | Sometimes (scanned) | Medium — declarations are semi-labeled    |
| Offer Letter     | Yes (almost always native)   | Rarely              | Medium-High — labeled (salary/title/date) |
| Benefits Guide   | Yes                          | Rarely              | Medium                                    |
| 401(k) Statement | Usually                      | Sometimes (scanned) | Medium — labeled balances                 |

**Conclusion:** native text extraction (PyMuPDF) already works for the common native-PDF case. OCR is a _fallback for scanned/image_ documents only — it is **not** the cause of "no downstream value" (that was the bridge, now fixed). The deterministic labeled-field parser is the real quality ceiling for **prose** documents (wills/trusts), independent of OCR.

## Recommended pilot architecture (the now-justified upgrade)

Now that the **bridge exists** (extracted facts → life model + Family domain → visible value), improving extraction quality is worth it because better extraction now produces visible impact. Recommended pipeline:

```
Upload → PyMuPDF (native text)
  ├─ text sufficient (len/coverage heuristic) → Gemini 2.5 Pro structured extraction → JSON
  └─ text insufficient (scanned/empty)        → Google Vision OCR → Gemini 2.5 Pro extraction → JSON
        → bridge (life.facts via IngestionService + Family domain rows)  ← ALREADY BUILT this sprint
```

- **Gemini 2.5 Pro extraction** replaces the deterministic parser for prose docs (wills/trusts) — extracts executor/guardian/trustee/beneficiaries from natural language with confidence + needs_review. LLM lives Fly-backend-only (never Vercel) per platform rule.
- **Google Vision OCR** only when PyMuPDF yields insufficient text (scanned). Avoids paying OCR on native PDFs.
- **Output → the existing bridge** (no change needed downstream — the bridge is model-agnostic).

## Cost / latency (order-of-magnitude, to confirm on live docs)

- PyMuPDF: ~free, ~ms. Gemini 2.5 Pro extraction: ~1–3s, ~$/doc (small). Vision OCR: per-page, only on the scanned minority. Net: low per-pilot-document cost.

## Justification for sequencing

This sprint **deliberately did NOT change the extraction model** — per the mandate, the proven break was the bridge (H+I), and OCR/LLM would have produced zero visible value without it. The bridge is now built + tested. **The Gemini/Vision extraction upgrade is the correct next step** (it now pays off) and is scoped here, not implemented this turn. The deterministic parser remains the floor; labeled native docs already extract + bridge today.

## Status

OCR/LLM extraction upgrade: **specced, not built** (correct sequencing). The bridge that makes any extraction valuable: **built + tested this sprint.**
