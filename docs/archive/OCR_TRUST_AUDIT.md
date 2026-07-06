# OCR / Extraction Trust Audit

**Grounded finding.** There is, today, **no OCR**: `DocumentParser._pdf` uses `pypdf` to read the _text layer_ of digital PDFs, `_docx` reads `<w:t>` runs from the zip, and text/* passes through. Scanned PDFs and images return empty text and dead-end to `needs_review` with an honest message — the `extraction_method='vision:<model>'` value in migration 165 is **a schema placeholder with no producing code path**. What *is\* trustworthy is the deterministic regex extraction over text: it never invents (a field absent from the text is simply not returned), it records real provenance (page/section/char-span via migration 165), it assigns honest per-field-type confidence, it gates low-confidence fields into a review lifecycle, and it never silently promotes an inferred fact to confirmed. The trust gaps are (1) the scanned-document path is a true dead-end with no extraction option, (2) confidence is a fixed-by-field-type heuristic (0.9 money / 0.85 date / 0.8 number / 0.7 text) rather than match-quality-derived, and (3) the user-facing confidence bands are surfaced only in the Evidence drawer, not at the point of first sight.

---

## What exists

### Parsing (`documents.py:DocumentParser`)

| Input       | Method                                                 | Output                          | Trust                |
| ----------- | ------------------------------------------------------ | ------------------------------- | -------------------- |
| Digital PDF | `pypdf.PdfReader` text layer + per-page char spans     | text + `page_spans`             | ✅ real provenance   |
| DOCX        | dependency-free zip → `word/document.xml` `<w:t>` runs | text (no tables/styles)         | ⚠ tables/styles lost |
| text/md/csv | passthrough decode                                     | text (no pages)                 | ✅                   |
| image/\*    | **returns empty text**                                 | `kind='image'` → `needs_review` | ❌ no OCR            |
| scanned PDF | empty text layer                                       | `needs_review`                  | ❌ no OCR            |

### Extraction (`documents.py:DocumentExtractor`)

- Labeled-field, synonym-guided regex over `doc_type`'s expected fields. **Never invents.**
- Provenance per field: `char_start`, `char_end`, `page_number` (`_page_for_offset` maps offset→page), `section` (the matched label), `extraction_method='regex'`.
- Confidence is **fixed per field type**: money `0.9`, percent `0.9`, date `0.85`, number `0.8`, text `0.7`. _Not_ derived from match strength.

### Confidence tiers (`DocumentEvidence.tsx:band`)

| %   | Band               | Source      |
| --- | ------------------ | ----------- |
| ≥95 | Verified           | conf ≥ 0.95 |
| ≥80 | High confidence    | conf ≥ 0.80 |
| ≥60 | Review recommended | conf ≥ 0.60 |
| <60 | Needs review       | conf < 0.60 |

Note the **gap**: the regex extractor maxes at 0.9, so the "Verified" (≥95%) tier is **only reachable by user confirmation** (review → `user_confirmed`), never by extraction alone. That is actually honest — but the bands and the review-status badge live in two places, which can confuse (a 90% field shows "High confidence" + "Extracted").

### Review lifecycle (`documents.py:set_field_review`, migration 165 `review_status`)

- States: `extracted` (default ≥0.6), `needs_review` (default <0.6), `user_confirmed`, `user_edited`, `rejected`.
- Precedence (`conflicts.py:_PRECEDENCE`): `user_confirmed(1) > user_edited(2) > user_entered(3) > verified(4) > extracted-high(5) > extracted-med(6) > inferred(7) > needs_review(8) > rejected(99)`.
- `rejected` fields are excluded from conflict gathering (`conflicts.py:_gather`) — a rejected value can never win or contaminate advice. ✅ trustworthy.

### Confirmation gate (`documents.py:_confirmation`)

- A bridged `life.facts` row is `confirmed` **only** when `confidence ≥ 0.85` AND source is native text (`text`/`pdf`). Everything else → `inferred`, flagged in `needs_review[]`. ✅ no silent promotion.

### PII guard (`documents.py:scan_pii`)

- High-precision SSN (labeled + bare), Luhn-validated cards, labeled routing/account. Returns **categories + counts only, never values.** Runs before storage. ✅ trustworthy.

### Conflict handling (`conflicts.py` + migration 166)

- 3 registered concepts: `current_role`, `current_employer`, `life_insurance_coverage`. Deterministic normalizers (money/title/org/date/text), precedence-ranked recommendation, both sources cited, severity (potential/low → medium → critical), respects user-resolved/ignored, auto-resolves when values reconverge. ✅ trustworthy but **narrow coverage**.

---

## What is trustworthy (ship as-is)

1. **No fabrication** — absent field → not returned; empty text → `needs_review`, never a guessed value.
2. **Provenance is real** — page/section/char-span come from actual `pypdf` spans + match offsets (migration 165 header confirms these were previously _discarded_; now persisted).
3. **Review loop closes** — confirm/edit/reject persists and changes precedence + conflict outcomes.
4. **No silent promotion** — `_confirmation` gate + candidate/inferred discipline from `ingestion.py`.
5. **PII safety** — counts-only, pre-storage, acknowledged-or-blocked.
6. **Honest scanned-doc messaging** — `SCANNED_MESSAGE` + `next_steps`, never a silent failure.

## What needs a surfacing / confidence fix (no new infra)

| Gap                                            | Fix                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanned/image → hard dead-end                  | Keep the honest message AND add a **"Type the values yourself"** mini-form on `needs_review` (writes via the same `register`/review path as `manual` extraction_method — already a valid enum value in 165). Turns a dead-end into a completion path with no OCR/model. |
| Confidence is fixed-by-type, not match-quality | Modulate confidence by match context already available in `_find`: penalize when the value is far from the label, when multiple candidates matched, or when the field is free `text`. Cheap, deterministic, more honest.                                                |
| Bands only in Evidence drawer                  | Surface the confidence band inline on the extracted-field chips in `UploadResult` (the chips already render `field_value`; add the band class) so trust is visible at first sight, not one click away.                                                                  |
| "Verified" tier unreachable by extraction      | Document this in copy ("Verified = you confirmed it") so users understand 90% extracted is the ceiling for machine reads.                                                                                                                                               |
| DOCX tables/styles dropped                     | Acknowledge in `needs_review` copy when a DOCX yields no fields ("tables aren't read yet — paste the text").                                                                                                                                                            |
| extraction_method placeholders                 | Until a `vision:*` path exists, do **not** show method values that can't be produced; only `regex` and `manual` are real today.                                                                                                                                         |

## Empty / In-Progress / Complete (extraction states)

- **Empty:** No text (scanned/image/unreadable DOCX) → `needs_review`, `reason='scanned_or_image'`/`no_fields_matched`, SCANNED_MESSAGE + next_steps. Evidence drawer: "No structured fields were extracted." ✅
- **In-Progress:** Extracted <0.6 → `review_status='needs_review'`, amber band, "Needs your review" panel, surfaced in `needs_review[]`. ✅
- **Complete:** Extracted ≥0.6 → green/sky band + "Extracted" badge; after confirm → "Verified" + "Confirmed by you". ✅

## Verdict

The extraction _trust layer_ is honest and shippable for **digital** documents. The single most user-visible weakness is the **scanned-document dead-end** — close it with a manual-entry fallback (reusing `extraction_method='manual'`) rather than waiting on an OCR/vision model, and surface confidence bands at first sight rather than one click away.
