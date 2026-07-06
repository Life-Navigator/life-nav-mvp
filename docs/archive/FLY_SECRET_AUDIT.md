# FLY SECRET AUDIT

**Date:** 2026-06-07
**Scope:** Determine whether the Qdrant/Neo4j/Gemini credentials needed for sprint verification already exist on the deployed Fly apps, and whether they are usable for verification **without** retrieving anything from Neo4j Aura / Qdrant Cloud consoles or asking the operator.
**Method:** `flyctl secrets list` (names/digests only) + read-only queries executed **inside** the Fly container via `flyctl ssh console -C` (secret values never leave the container; only counts are returned). No values printed. No Fly secrets modified.

---

## Verdict

**The requested credentials are NOT missing. They are present on BOTH Fly apps and are usable for verification from inside the container.** They were merely _inaccessible as values from the local shell_ (Fly never reveals secret values by design). The api-gateway container ships `python3`, which lets us run the Qdrant REST + Neo4j Query API calls using the in-container env vars and emit only counts.

**No operator-provided credentials are required to complete Steps 5/6/12.**

---

## 1. Secret presence matrix

Digests shown are non-sensitive content hashes (not the secret value). Identical digest across apps = identical value.

| Secret                       | worker | api-gateway | digest (both)                         |
| ---------------------------- | :----: | :---------: | ------------------------------------- |
| `QDRANT_URL`                 |   ✅   |     ✅      | `aad15bb179e79d87`                    |
| `QDRANT_API_KEY`             |   ✅   |     ✅      | `78aee0bf54224245`                    |
| `QDRANT_PERSONAL_COLLECTION` |   ✅   |     ✅      | `c7cf05b1cbdab0f3` (`life_navigator`) |
| `NEO4J_URI`                  |   ✅   |     ✅      | `485b887cebf269fe`                    |
| `NEO4J_USERNAME`             |   ✅   |     ✅      | `8f157fbfcc085812`                    |
| `NEO4J_PASSWORD`             |   ✅   |     ✅      | `90ad7dc07fd067db`                    |
| `NEO4J_PERSONAL_DATABASE`    |   ✅   |     ✅      | `8f157fbfcc085812` (`4f61c985`)       |
| `GEMINI_API_KEY`             |   ✅   |     ✅      | `1533956b9aff8864` (restaged today)   |

All six requested secrets (`QDRANT_URL`, `QDRANT_API_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `GEMINI_API_KEY`) are **present on both apps**.

---

## 2. Is the worker actually using these secrets successfully?

**Yes.** Evidence:

- `graphrag.sync_queue`: **completed = 1028, failed = 0, pending = 0** (drained today after the Gemini key restage).
- Worker logs show, per job: `qdrant upsert ok … collection=life_navigator` and `neo4j upsert ok … database=4f61c985` — i.e. the worker authenticates to **both** Qdrant and Neo4j with these secrets and writes successfully.
- `GEMINI_API_KEY` digest is the freshly-restaged `1533956b…` (the broken `6b4d7e1d…` is gone); embeds return 200.

So all three external dependencies (Gemini, Qdrant, Neo4j) are reachable and authenticated using the existing Fly secrets.

---

## 3. Why additional credentials still _appeared_ required

The worker is healthy, but **counts/relabel cannot be run from the worker binary** — it only syncs; it has no "count" command. To verify point/node counts independently we need to issue a Qdrant REST call and a Neo4j Cypher query. Those require the secret **values**, which:

- Fly intentionally **does not expose** via `flyctl secrets list` (digests only), and
- were **not present in the local shell environment** (Vercel/Supabase integration carries `POSTGRES_URL` but not Qdrant/Neo4j).

Hence the apparent need to "retrieve" them. The resolution: **run the calls inside the container**, where the values are live env vars, and emit only the numeric results.

---

## 4. Verification capability matrix (demonstrated)

| Capability                               |        Possible w/ existing Fly config?         | Vehicle                                                                              | Result (this audit)                                                                                         |
| ---------------------------------------- | :---------------------------------------------: | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Qdrant point count                       |                     ✅ YES                      | api-gateway `python3` + `$QDRANT_URL`/`$QDRANT_API_KEY`                              | `life_navigator` = **1233** points                                                                          |
| Neo4j node/label counts                  |                     ✅ YES                      | api-gateway `python3` + Neo4j Query API v2 + `$NEO4J_*`                              | `:TransactionSummary`=634, `:FinancialAccount`=289, `:Unknown`=233, `:UserProfile`=79, `:PersonaProfile`=77 |
| `:Unknown`→`:TransactionSummary` relabel | ✅ YES (capable; **not executed** — audit only) | same Query API path, write Cypher                                                    | ready to run; would set `:Unknown`=0, `:TransactionSummary`≈867                                             |
| Run from **worker** container            |                      ❌ NO                      | worker image (`debian:bookworm-slim`) has only `bash`+`openssl`; no `curl`/`python3` | use api-gateway instead                                                                                     |

**Tooling note:** worker container = `bash`, `openssl` only. api-gateway container = `python3`, `bash`. The api-gateway is the verification vehicle.

---

## 5. Findings vs sprint thresholds

| Threshold                         | Current | Status                                     |
| --------------------------------- | ------- | ------------------------------------------ |
| Qdrant `life_navigator` ≥ 1000    | 1233    | ✅ PASS                                    |
| Neo4j `:TransactionSummary` ≥ 700 | 634     | ❌ **below** — but → **867 after relabel** |
| Neo4j `:Unknown` = 0              | 233     | ❌ needs relabel                           |

The 233 `:Unknown` nodes are the pre-fix mislabeled `finance.transactions` rows. Relabeling them (idempotent, in-container) moves them into `:TransactionSummary`, simultaneously clearing both failing rows: `:Unknown`→0 and `:TransactionSummary` 634→~867 (≥700).

---

## 6. Remaining blockers

- **Credentials:** none. All required secrets exist on Fly and are usable in-container.
- **Action items (no creds needed):**
  1. Run the `:Unknown`→`:TransactionSummary` relabel in-container (clears Step 6 + Step 12 Neo4j threshold).
  2. Re-count to confirm `:TransactionSummary` ≥ 700 and `:Unknown` = 0.
  3. Steps 5/6 (create a goal / risk → see `:Goal`/`:RiskAssessment` node) can be verified the same in-container way after the writes.

---

## 7. Exact credentials still needed

**NONE.** `QDRANT_URL`, `QDRANT_API_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and `GEMINI_API_KEY` are all present on both Fly apps and usable for verification via the api-gateway container. Do **not** retrieve anything from the Neo4j Aura or Qdrant Cloud consoles — it is unnecessary.

---

## Direct answers

1. **Can we verify Qdrant point counts using existing Fly configuration?** — **Yes.** Demonstrated: `life_navigator` = 1233 points (≥1000 ✅), via api-gateway `python3` using `$QDRANT_URL`/`$QDRANT_API_KEY`.
2. **Can we verify Neo4j node counts using existing Fly configuration?** — **Yes.** Demonstrated label counts via the Neo4j Query API v2 using `$NEO4J_*`. `:TransactionSummary`=634, `:Unknown`=233.
3. **Can we perform the `:Unknown`→`:TransactionSummary` relabel using existing Fly configuration?** — **Yes** (capability confirmed; not executed in this audit-only pass). Same in-container Query API path with a write Cypher. Ready to run on your go-ahead.
4. **Are the requested credentials actually missing, or simply inaccessible from the current environment?** — **Inaccessible, not missing.** All present on both Fly apps; unreadable as values from the local shell by Fly design; fully usable from inside the container.

---

_Audit only. No secret values printed. No Fly secrets modified._
