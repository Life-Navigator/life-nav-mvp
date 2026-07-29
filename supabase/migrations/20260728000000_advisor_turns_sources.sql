-- Advisor turn audit: which reference links the advisor sent the user to.
--
-- The advisor may now quote MARKET prices ("an inspection runs about $400-600") — figures we cannot verify,
-- because no source of truth for them exists in the system. What makes that honest is handing the user
-- somewhere to check, so the links are part of the trust story and belong in the same audit trail as the
-- validator verdict and the fallback cause.
--
-- Keys only, not URLs: the key set is closed and owned by app/services/advisor_sources.py, and the URL for a
-- key is whatever that module says it is at render time. Storing the URL would freeze a copy that silently
-- diverges the first time an entry is corrected.
--
-- SAFE TO APPLY ANY TIME, and safe to be UNAPPLIED: the orchestrator whitelists advisor_turns inserts to the
-- columns it knows exist (_ADVISOR_TURNS_COLUMNS), and "sources" is deliberately NOT in that whitelist yet.
-- Inserting a column the table lacks 400s the request and silently drops EVERY turn from the durable table —
-- that regression has happened here before, which is why the whitelist exists.
--
-- AFTER APPLYING: add "sources" to _ADVISOR_TURNS_COLUMNS in advisor_orchestrator.py. Until then the data is
-- still auditable in the structured `advisor_turn` log line, which carries the same keys.

alter table if exists analytics.advisor_turns
  add column if not exists sources jsonb not null default '[]'::jsonb;

comment on column analytics.advisor_turns.sources is
  'Reference-source KEYS (advisor_sources.MARKET_SOURCES) surfaced to the user this turn, e.g. ["consumer_finance"]. Keys not URLs — the catalog owns the URL.';
