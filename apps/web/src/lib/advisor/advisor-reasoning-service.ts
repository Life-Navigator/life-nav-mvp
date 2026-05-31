/**
 * AdvisorReasoningService
 *
 * Cross-domain reasoning over (1) the user's personal graph
 * (goals/constraints/capabilities/motivations) and (2) the central
 * ontology (Credential → CareerRole → Income → FinancialGoal, etc.).
 *
 * Inputs   : user_id + a stated goal claim
 * Pipeline : discover root goal → load personal context → load central
 *            cross-domain edges → score impacts per domain → emit
 *            recommended actions + sequence + tradeoffs.
 * Output   : RecommendationOutput (see @/types/advisor)
 *
 * The service is intentionally NO LLM / NO embedding-call: it is graph
 * traversal + scoring. An LLM glue layer can be added at the route
 * handler to phrase the result, but the reasoning itself must be
 * deterministic + auditable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { computeGoalPathway, resolvePathway } from '@/lib/goals/goal-path-service';
import type {
  AdvisorInputs,
  CentralLink,
  DiscoveredRootGoal,
  DomainImpact,
  PersonalContext,
  RecommendationOutput,
  RecommendedAction,
} from '@/types/advisor';
import type { GoalEdge, GoalPathway } from '@/types/goal-hierarchy';

// ---------------------------------------------------------------------------
// Personal-graph retriever interface — callers (Edge Function or Node API
// route) inject a real implementation that calls Qdrant + Neo4j. The
// default no-op keeps the service usable in unit tests.
// ---------------------------------------------------------------------------

export interface PersonalGraphRetriever {
  retrieve(input: {
    user_id: string;
    query: string;
    topk?: number;
  }): Promise<Array<{ entity_id: string; entity_type: string; text: string; score: number }>>;
}

const NOOP_RETRIEVER: PersonalGraphRetriever = {
  async retrieve() {
    return [];
  },
};

// ---------------------------------------------------------------------------
// 1. Root-goal discovery
// ---------------------------------------------------------------------------

async function discoverRootGoal(
  supabase: SupabaseClient,
  inputs: AdvisorInputs
): Promise<DiscoveredRootGoal> {
  if (inputs.root_goal_id_override) {
    const { data } = await supabase
      .from('goals')
      .select('id, title, root_goal, stated_goal, root_goal_confidence_score')
      .eq('user_id', inputs.user_id)
      .eq('id', inputs.root_goal_id_override)
      .maybeSingle();
    return {
      goal_id: data?.id,
      stated_goal: data?.stated_goal ?? data?.title ?? undefined,
      inferred_true_goal: data?.root_goal ?? data?.title ?? inputs.stated_goal_claim ?? '',
      confidence: Number(data?.root_goal_confidence_score ?? 0.5),
      source: 'override',
    };
  }

  // Prefer the most recent goal_interpretation row.
  const { data: gi } = await supabase
    .from('goal_interpretations')
    .select('id, goal_id, stated_goal, inferred_true_goal, confidence_score')
    .eq('user_id', inputs.user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (gi && gi.length > 0) {
    return {
      goal_id: gi[0].goal_id ?? undefined,
      stated_goal: gi[0].stated_goal,
      inferred_true_goal: gi[0].inferred_true_goal,
      confidence: Number(gi[0].confidence_score ?? 0.5),
      source: 'goal_interpretation',
    };
  }

  // Otherwise the most recent goals row with a non-null root_goal.
  const { data: g } = await supabase
    .from('goals')
    .select('id, title, root_goal, stated_goal, root_goal_confidence_score')
    .eq('user_id', inputs.user_id)
    .not('root_goal', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (g && g.length > 0) {
    return {
      goal_id: g[0].id,
      stated_goal: g[0].stated_goal ?? g[0].title ?? undefined,
      inferred_true_goal: g[0].root_goal ?? g[0].title,
      confidence: Number(g[0].root_goal_confidence_score ?? 0.4),
      source: 'goals_table',
    };
  }

  // Last resort — echo the claim back as the inferred goal at low confidence.
  return {
    inferred_true_goal: inputs.stated_goal_claim ?? '',
    confidence: 0.2,
    source: 'fallback_from_claim',
  };
}

// ---------------------------------------------------------------------------
// 2. Personal context loader
// ---------------------------------------------------------------------------

async function loadPersonalContext(
  supabase: SupabaseClient,
  userId: string
): Promise<PersonalContext> {
  const [cons, caps, mots, prefs, risk, comm] = await Promise.all([
    supabase
      .from('user_constraints')
      .select('id, dimension, severity, description')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(50),
    supabase
      .from('user_capabilities')
      .select('id, capability_name, domain, proficiency_level')
      .eq('user_id', userId)
      .limit(100),
    supabase
      .from('user_motivations')
      .select('id, motivation_text, intensity')
      .eq('user_id', userId)
      .order('intensity', { ascending: false })
      .limit(20),
    supabase
      .from('user_decision_preferences')
      .select('id, axis, weight')
      .eq('user_id', userId)
      .limit(10),
    supabase
      .from('user_domain_risk_tolerance')
      .select('id, domain, tolerance_score')
      .eq('user_id', userId)
      .limit(10),
    supabase
      .from('user_commitment_levels')
      .select('id, domain, hours_per_week')
      .eq('user_id', userId)
      .limit(10),
  ]);

  return {
    constraints: (cons.data ?? []).map((r) => ({
      id: r.id,
      label: r.description,
      severity: r.severity ?? undefined,
      domain: r.dimension ?? undefined,
    })),
    capabilities: (caps.data ?? []).map((r) => ({
      id: r.id,
      label: r.capability_name,
      level: r.proficiency_level ?? undefined,
      domain: r.domain ?? undefined,
    })),
    motivations: (mots.data ?? []).map((r) => ({
      id: r.id,
      label: r.motivation_text,
      weight: r.intensity == null ? undefined : Number(r.intensity) / 10,
    })),
    decision_preferences: (prefs.data ?? []).map((r) => ({
      id: r.id,
      pattern: r.axis,
      strength: r.weight == null ? undefined : Number(r.weight),
    })),
    domain_risk_tolerance: (risk.data ?? []).map((r) => ({
      id: r.id,
      domain: r.domain,
      tolerance: Number(r.tolerance_score ?? 0.5),
    })),
    commitment_levels: (comm.data ?? []).map((r) => ({
      id: r.id,
      area: r.domain,
      level: Number(r.hours_per_week ?? 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// 3. Central ontology join
//
// Match the inferred goal to a central entity by exact-then-alias lookup.
// Then pull all relationships that target it (supporting / blocking /
// required) and all relationships sourced from it (cascading impacts).
// ---------------------------------------------------------------------------

interface CentralEntityRow {
  id: string;
  canonical_name: string;
  entity_type: string;
  domain: string;
  aliases: string[] | null;
}

interface CentralRelRow {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  label: string;
  strength_score: number;
  confidence_score: number;
  domain: string;
  provenance: Record<string, unknown> | null;
}

async function loadCentralLinks(
  supabase: SupabaseClient,
  inferredGoal: string,
  topk: number
): Promise<{ rootEntity?: CentralEntityRow; links: CentralLink[] }> {
  const needle = inferredGoal.trim().toLowerCase();
  if (!needle) return { links: [] };

  // Read via the public views projected in migration 077 §11 — PostgREST
  // exposes the `public` schema only; the views filter to approved rows.
  const { data: entities } = await supabase
    .from('central_ontology_entities')
    .select('id, canonical_name, entity_type, domain, aliases')
    .limit(2000);

  const matchEntity = (rows: CentralEntityRow[] | null) => {
    if (!rows) return undefined;
    let best: CentralEntityRow | undefined;
    let bestScore = 0;
    for (const e of rows) {
      const candidates = [e.canonical_name, ...(e.aliases ?? [])].map((s) => s.toLowerCase());
      for (const c of candidates) {
        if (c === needle) return e;
        if (needle.includes(c) || c.includes(needle)) {
          const s = c.length / Math.max(needle.length, c.length);
          if (s > bestScore) {
            bestScore = s;
            best = e;
          }
        }
      }
    }
    return bestScore >= 0.35 ? best : undefined;
  };

  const rootEntity = matchEntity(entities as CentralEntityRow[] | null);
  if (!rootEntity) return { links: [] };

  const { data: rels } = await supabase
    .from('central_ontology_relationships')
    .select(
      'id, source_entity_id, target_entity_id, label, strength_score, confidence_score, domain, provenance'
    )
    .or(`source_entity_id.eq.${rootEntity.id},target_entity_id.eq.${rootEntity.id}`)
    .limit(500);

  const rows = (rels ?? []) as unknown as CentralRelRow[];

  // Resolve the "other side" entity_id for display.
  const otherIds = Array.from(
    new Set(
      rows.map((r) =>
        r.source_entity_id === rootEntity.id ? r.target_entity_id : r.source_entity_id
      )
    )
  );
  const { data: others } = await supabase
    .from('central_ontology_entities')
    .select('id, canonical_name, entity_type, domain, aliases')
    .in('id', otherIds);
  const otherById = new Map<string, CentralEntityRow>(
    ((others as CentralEntityRow[] | null) ?? []).map((e) => [e.id, e])
  );

  const classify = (label: string, dirFromRoot: 'out' | 'in'): CentralLink['direction'] => {
    if (
      ['SUPPORTS', 'ACCELERATES', 'IMPROVES', 'INCREASES', 'INCREASES_PROBABILITY_OF'].includes(
        label
      )
    ) {
      return dirFromRoot === 'in' ? 'supports' : 'related';
    }
    if (
      [
        'BLOCKS',
        'DEGRADES',
        'DECREASES',
        'DECREASES_PROBABILITY_OF',
        'CONFLICTS_WITH',
        'COMPETES_FOR_RESOURCES',
        'DELAYED_BY',
      ].includes(label)
    ) {
      return dirFromRoot === 'in' ? 'blocks' : 'related';
    }
    if (['PREREQUISITE_FOR', 'DEPENDS_ON', 'REQUIRES'].includes(label)) {
      return dirFromRoot === 'in' ? 'requires' : 'related';
    }
    return 'related';
  };

  const links: CentralLink[] = rows.flatMap((r) => {
    const isIncoming = r.target_entity_id === rootEntity.id;
    const otherId = isIncoming ? r.source_entity_id : r.target_entity_id;
    const other = otherById.get(otherId);
    if (!other) return [];
    const provenance_summary =
      r.provenance && typeof r.provenance === 'object'
        ? `${(r.provenance as Record<string, unknown>).source_type ?? '?'}: ${(r.provenance as Record<string, unknown>).source_name ?? '?'}`
        : undefined;
    return [
      {
        entity_id: other.id,
        canonical_name: other.canonical_name,
        entity_type: other.entity_type,
        domain: other.domain,
        label: r.label,
        direction: classify(r.label, isIncoming ? 'in' : 'out'),
        strength: Number(r.strength_score),
        confidence: Number(r.confidence_score),
        provenance_summary,
      },
    ];
  });

  // Top-K per (direction, domain) by strength * confidence.
  const ranked = links.sort((a, b) => b.strength * b.confidence - a.strength * a.confidence);
  const out: CentralLink[] = [];
  const counts = new Map<string, number>();
  for (const l of ranked) {
    const k = `${l.direction}::${l.domain}`;
    const c = counts.get(k) ?? 0;
    if (c >= topk) continue;
    counts.set(k, c + 1);
    out.push(l);
  }

  return { rootEntity, links: out };
}

// ---------------------------------------------------------------------------
// 4. Cross-domain impact aggregation
// ---------------------------------------------------------------------------

function aggregateImpacts(links: CentralLink[]): DomainImpact[] {
  const byDomain = new Map<string, DomainImpact>();
  for (const l of links) {
    if (!byDomain.has(l.domain)) {
      byDomain.set(l.domain, { domain: l.domain, supporting: [], blocking: [], required: [] });
    }
    const d = byDomain.get(l.domain)!;
    if (l.direction === 'supports') d.supporting.push(l);
    else if (l.direction === 'blocks') d.blocking.push(l);
    else if (l.direction === 'requires') d.required.push(l);
  }
  return Array.from(byDomain.values()).sort((a, b) => a.domain.localeCompare(b.domain));
}

// ---------------------------------------------------------------------------
// 5. Action derivation
// ---------------------------------------------------------------------------

function deriveActions(
  rootGoal: DiscoveredRootGoal,
  impacts: DomainImpact[],
  personal: PersonalContext,
  pathway?: GoalPathway
): RecommendedAction[] {
  const out: RecommendedAction[] = [];
  let idx = 0;

  // (a) Required central entities first (PREREQUISITE_FOR / DEPENDS_ON).
  for (const di of impacts) {
    for (const r of di.required) {
      out.push({
        id: `act_${++idx}_req_${r.entity_id.slice(0, 8)}`,
        title: `Secure prerequisite: ${r.canonical_name}`,
        domain: di.domain,
        rationale: `Required for ${rootGoal.inferred_true_goal} (${r.label}, confidence ${r.confidence.toFixed(2)}).`,
        expected_strength: r.strength,
        related_central_entity_ids: [r.entity_id],
        related_personal_goal_ids: pathway?.required.map((n) => n.goal_id) ?? [],
      });
    }
  }

  // (b) Supporting entities — strongest first across domains.
  const allSupports = impacts.flatMap((d) => d.supporting.map((s) => ({ s, domain: d.domain })));
  allSupports.sort((a, b) => b.s.strength * b.s.confidence - a.s.strength * a.s.confidence);
  for (const { s, domain } of allSupports) {
    out.push({
      id: `act_${++idx}_sup_${s.entity_id.slice(0, 8)}`,
      title: `Strengthen ${s.canonical_name} to advance ${rootGoal.inferred_true_goal}`,
      domain,
      rationale: `Central knowledge edge ${s.label} (strength ${s.strength.toFixed(2)}, confidence ${s.confidence.toFixed(2)}).`,
      expected_strength: s.strength,
      related_central_entity_ids: [s.entity_id],
      related_personal_goal_ids: pathway?.supporting.map((n) => n.goal_id) ?? [],
    });
  }

  // (c) Defensive actions against blocking entities the user clearly has
  // (we cannot detect "has" precisely without entity-resolution; we
  // still emit one entry per blocker so the advisor surfaces them).
  for (const di of impacts) {
    for (const b of di.blocking) {
      out.push({
        id: `act_${++idx}_blk_${b.entity_id.slice(0, 8)}`,
        title: `Mitigate risk: ${b.canonical_name}`,
        domain: di.domain,
        rationale: `Central knowledge: ${b.canonical_name} ${b.label} ${rootGoal.inferred_true_goal}.`,
        expected_strength: b.strength,
        related_central_entity_ids: [b.entity_id],
        related_personal_goal_ids: pathway?.blocked.map((n) => n.goal_id) ?? [],
      });
    }
  }

  // (d) Personal-graph required goals not yet in central edges.
  if (pathway) {
    for (const n of pathway.required) {
      const alreadyMentioned = out.some((a) => a.related_personal_goal_ids.includes(n.goal_id));
      if (alreadyMentioned) continue;
      out.push({
        id: `act_${++idx}_pgr_${n.goal_id.slice(0, 8)}`,
        title: `Complete prerequisite goal`,
        domain: 'personal',
        rationale: `Personal hierarchy: prerequisite of ${rootGoal.inferred_true_goal}.`,
        expected_strength: n.cumulative_strength,
        related_central_entity_ids: [],
        related_personal_goal_ids: [n.goal_id],
      });
    }
  }

  // Acknowledge personal commitment ceiling — drop any action whose
  // domain has zero hours allocated and the user's overall commitment
  // is also zero. This is a soft signal, so we DON'T drop entirely; we
  // de-prioritize by halving the expected_strength.
  const commHours = new Map(personal.commitment_levels.map((c) => [c.area, c.level]));
  for (const a of out) {
    const h = commHours.get(a.domain) ?? commHours.get('overall') ?? -1;
    if (h === 0) a.expected_strength *= 0.5;
  }

  return out;
}

// ---------------------------------------------------------------------------
// 6. Sequencing + bucketing
// ---------------------------------------------------------------------------

function sequenceActions(actions: RecommendedAction[]): {
  recommended_sequence: string[];
  timeline: RecommendationOutput['timeline'];
} {
  const sorted = [...actions].sort((a, b) => {
    const aRank = a.id.includes('_req_')
      ? 0
      : a.id.includes('_sup_')
        ? 1
        : a.id.includes('_pgr_')
          ? 2
          : 3;
    const bRank = b.id.includes('_req_')
      ? 0
      : b.id.includes('_sup_')
        ? 1
        : b.id.includes('_pgr_')
          ? 2
          : 3;
    if (aRank !== bRank) return aRank - bRank;
    return b.expected_strength - a.expected_strength;
  });
  const sequence = sorted.map((a) => a.id);
  // Coarse timeline buckets — the engine doesn't have real durations.
  const timeline: RecommendationOutput['timeline'] = (
    [
      { horizon: 'now', action_ids: sorted.slice(0, 3).map((a) => a.id) },
      { horizon: 'this_quarter', action_ids: sorted.slice(3, 8).map((a) => a.id) },
      { horizon: 'this_year', action_ids: sorted.slice(8, 16).map((a) => a.id) },
      { horizon: 'long_term', action_ids: sorted.slice(16).map((a) => a.id) },
    ] as RecommendationOutput['timeline']
  ).filter((b) => b.action_ids.length > 0);
  return { recommended_sequence: sequence, timeline };
}

// ---------------------------------------------------------------------------
// 7. Top-level reason() entrypoint
// ---------------------------------------------------------------------------

export interface ReasonOptions {
  retriever?: PersonalGraphRetriever;
  /** Already-loaded personal goal edges (skips DB call if provided). */
  preloadedEdges?: GoalEdge[];
  /** Skip GoalPathService entirely (used in unit tests with no goal hierarchy). */
  skipPathway?: boolean;
}

export async function reason(
  supabase: SupabaseClient,
  inputs: AdvisorInputs,
  options: ReasonOptions = {}
): Promise<RecommendationOutput> {
  const topk = inputs.domain_topk ?? 5;

  const root = await discoverRootGoal(supabase, inputs);

  // Personal context + (optionally) pathway run in parallel.
  const [personal, pathway] = await Promise.all([
    loadPersonalContext(supabase, inputs.user_id),
    (async () => {
      if (options.skipPathway || !root.goal_id) return undefined as GoalPathway | undefined;
      if (options.preloadedEdges) {
        return resolvePathway(root.goal_id, inputs.user_id, options.preloadedEdges);
      }
      try {
        return await computeGoalPathway(supabase, inputs.user_id, root.goal_id);
      } catch {
        return undefined;
      }
    })(),
  ]);

  const { links } = await loadCentralLinks(supabase, root.inferred_true_goal, topk);
  const impacts = aggregateImpacts(links);

  // Personal retrieval (Qdrant + Neo4j) is delegated to the injected
  // retriever. We don't surface raw chunks in the recommendation; we
  // count them as confidence signal.
  let retrievalSignal = 0;
  try {
    const r = await (options.retriever ?? NOOP_RETRIEVER).retrieve({
      user_id: inputs.user_id,
      query: root.inferred_true_goal,
      topk,
    });
    retrievalSignal = r.length > 0 ? 0.1 : 0;
  } catch {
    /* swallow — retrieval is best-effort */
  }

  const actions = deriveActions(root, impacts, personal, pathway);
  const { recommended_sequence, timeline } = sequenceActions(actions);

  const tradeoffs: RecommendationOutput['tradeoffs'] = [];
  if (impacts.some((d) => d.blocking.length > 0) && impacts.some((d) => d.supporting.length > 0)) {
    tradeoffs.push({
      summary: 'Mitigating a blocker may divert capacity from a supporting goal.',
      gives_up: impacts
        .flatMap((d) => d.supporting.slice(0, 1))
        .map((s) => s.canonical_name)
        .join(', '),
      gains: impacts
        .flatMap((d) => d.blocking.slice(0, 1))
        .map((b) => `risk reduction on ${b.canonical_name}`)
        .join(', '),
    });
  }
  if (personal.constraints.some((c) => c.severity === 'hard')) {
    tradeoffs.push({
      summary: 'Hard constraints reduce the action space materially.',
      gives_up: 'Speed of progress on lower-priority subgoals',
      gains: 'Constraint compliance',
    });
  }

  const risks = [
    ...impacts.flatMap((d) =>
      d.blocking.map(
        (b) =>
          `${b.canonical_name} ${b.label} ${root.inferred_true_goal} (strength ${b.strength.toFixed(2)})`
      )
    ),
    ...(pathway?.cycles.length
      ? [
          `Goal graph contains ${pathway.cycles.length} cycle(s) — re-check goal_dependencies entries.`,
        ]
      : []),
  ];

  const assumptions = [
    `Root-goal source: ${root.source}.`,
    `Central ontology version: bootstrap seed (077). Replace with curated data before relying on absolute strengths.`,
    personal.constraints.length === 0
      ? 'No active user constraints loaded — recommendations are unbounded.'
      : '',
    personal.capabilities.length === 0
      ? 'No user capabilities loaded — feasibility is not weighted.'
      : '',
  ].filter(Boolean);

  // Confidence: weighted average of root confidence, central evidence,
  // and a small retrieval bonus.
  const linkConfidence =
    links.length === 0 ? 0 : links.reduce((a, l) => a + l.confidence, 0) / links.length;
  const confidence_score = Math.min(
    1,
    Math.max(0, 0.5 * root.confidence + 0.4 * linkConfidence + retrievalSignal)
  );

  return {
    root_goal: root,
    supporting_goals: pathway?.supporting ?? [],
    blocked_goals: pathway?.blocked ?? [],
    required_actions: actions,
    recommended_sequence,
    confidence_score,
    tradeoffs,
    timeline,
    risks,
    assumptions,
    cross_domain_impacts: impacts,
    pathway,
    simulation_summary: undefined, // filled in by hierarchy-aware simulation pass (phase 5)
  };
}

// ---------------------------------------------------------------------------
// Re-exports of internal helpers for unit tests.
// ---------------------------------------------------------------------------
export const __test = {
  aggregateImpacts,
  deriveActions,
  sequenceActions,
};
