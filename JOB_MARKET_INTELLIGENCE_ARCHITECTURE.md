# JOB MARKET INTELLIGENCE ARCHITECTURE

The benchmark/reference layer feeding the Compensation Engine, Career, and Education ROI.
Unlike personal data, this is **non-tenant (central) knowledge** — it lives in the central
graph/collection (`ln_central`), never linked to a personal node by user id. Design only.

## What it ingests

- **Labor market** — roles, growth projections, role saturation.
- **Compensation** — distributions/bands by role × industry × geography × seniority.
- **Employer intelligence** — employer type, size, hiring posture.
- **Role intelligence** — required skills/credentials per role.
- **Skills intelligence** — skill demand + adjacency (which skills unlock which roles).
- **Credential demand** — which certs/degrees the market actually rewards.

## Sources (cited, not guessed)

Government/licensed feeds (e.g. BLS OES/O\*NET, public IPEDS for education outcomes, licensed
comp datasets). Every ingested fact carries `source`, `as_of`, `confidence`. Stale data is
flagged, not silently used.

## Must support

live job markets · historical trends · role saturation · growth projections · compensation
distributions (percentile bands, not single numbers).

## Central ontology (non-tenant)

```
(:Employer) (:Role) (:Skill) (:Credential) (:CompensationBand) (:MarketDemand) (:HiringTrend)
(:Role)-[:REQUIRES_SKILL]->(:Skill)
(:Role)-[:REQUIRES_CREDENTIAL]->(:Credential)
(:Role)-[:HAS_COMP_BAND]->(:CompensationBand)   {role,industry,geo,seniority,p25,p50,p75,source,as_of}
(:Role)-[:HAS_DEMAND]->(:MarketDemand)          {growth,saturation,as_of}
(:Credential)-[:REWARDED_BY]->(:Role)           {lift_estimate,source}
```

## Tenant boundary (critical)

This is **central** knowledge. The personal graph references it by _value_ (a comp band, a
demand figure) copied into the user's `:Evidence` node with its `source` — never by drawing a
cross-tenant edge into the central graph. Same rule as the LIFENAVIGATOR_ONTOLOGY_STANDARD:
central knowledge is read and cited, not linked into personal nodes.

## Refresh + provenance

Each source has an ingestion cadence; rows carry `as_of`. The Compensation Engine's confidence
factors in band width + staleness. A missing/stale band → lower confidence + a "data thin"
note in the recommendation, never a fabricated figure.

## Why it's foundational

Career comp estimates, Education ROI income-lift, and the cross-domain "would changing jobs
improve my plan?" question all resolve against this layer. Building it once (central, cited)
keeps every downstream number honest and reproducible.
