# VERTEX_ANTHROPIC_ACCESS_AUDIT.md — Phase 2

Why each model is / isn't callable for the project (from the catalog vs rawPredict probe).

| Model                                                        | Status                                                  | Classification                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `claude-opus-4-8` (bare)                                     | ✅ callable (global)                                    | **Enabled**                                                                                                                        |
| `claude-opus-4-7` (bare)                                     | ✅ callable (global)                                    | **Enabled**                                                                                                                        |
| `claude-opus-4-1@20250805`                                   | ✅ callable (global)                                    | **Enabled**                                                                                                                        |
| `claude-opus-4-6`                                            | listed GA, 404 on call                                  | **Allowlist/enablement gap** — published but not activated for this project (or transient). Not a model-ID error (bare name used). |
| `claude-opus-4-5@20251101`                                   | listed GA, 404                                          | **Misconfigured ID + enablement** — the working pattern is bare name; `@version` 404s, and it isn't among the enabled set.         |
| `claude-sonnet-4-5`, `claude-sonnet-4-6`, `claude-haiku-4-5` | listed, 404                                             | **Not enabled for project** (Model-Garden access not accepted for these)                                                           |
| `claude-fable-5`                                             | 403 "requires data sharing to be enabled for publisher" | **Project-policy restricted** — needs publisher data-sharing toggled on                                                            |
| Any Claude on us-east5 / us-central1 / europe-west1          | 400/404                                                 | **Region restricted** — Claude is served to this project only via the **global** endpoint                                          |

## Root-cause summary

- **Released on Vertex:** yes for the whole 4.x line (catalog lists them).
- **Region:** Claude callable **only via `global`** for this project (regional endpoints rejected).
- **Quota:** under light concurrency, callable models returned **HTTP 429** → low default Anthropic quota; a quota increase is needed before production scale.
- **Allowlist/enablement:** opus-4-8/4-7/4-1 are enabled; opus-4-6/4-5, sonnet, haiku are published-but-not-activated for this project (accept terms in Model Garden to enable).
- **Project policy:** `claude-fable-5` needs publisher data-sharing enabled (403).
- **Misconfig (prior sprint):** using `@versionId` instead of the bare name caused false 404s — corrected.

## So: "why were newer models unavailable?" — they WEREN'T. They were mis-addressed.

Opus 4.8/4.7 were always callable; the prior sprint's probe used the wrong ID format. To unlock the rest (sonnet/haiku/opus-4-6/4-5, fable-5): accept their Model-Garden terms + (for fable) enable data sharing; request a Claude quota increase for scale.
