/**
 * Graph promoter — Sprint N Phase 5.
 *
 * Takes ExtractedEntity[] + ExtractedRelationship[] from the pipeline
 * output and promotes them to the Personal GraphRAG via the existing
 * `graphrag.enqueue_sync(...)` helper (the ingestion sync trigger
 * from migration 091 also fires on INSERT, so a direct DB insert is
 * usually enough).
 *
 * This module is the in-process projector that the API route calls
 * BEFORE inserting rows — it dedupes by canonical_text + kind, sets
 * a confidence floor, and stamps `graph_promoted = true` on the
 * winners.
 *
 * Pure logic; no DB I/O. The caller passes the deduped result to
 * Supabase.
 */

import type { ExtractedEntity, ExtractedRelationship } from '@/types/ingestion';

export interface PromoterInputs {
  entities: ExtractedEntity[];
  relationships?: Array<
    Omit<ExtractedRelationship, 'subject_entity_id' | 'object_entity_id'> & {
      subject_index: number;
      object_index: number;
    }
  >;
  /** Minimum confidence to promote. Default 0.6. */
  min_confidence?: number;
}

export interface PromoterOutput {
  promoted_entities: ExtractedEntity[];
  rejected_entities: ExtractedEntity[];
  /** Re-indexed: each carries subject_canonical / object_canonical so the
   *  caller can resolve to actual DB ids after insert. */
  promoted_relationships: Array<{
    relationship_kind: ExtractedRelationship['relationship_kind'];
    confidence: number;
    subject_canonical: string;
    subject_kind: string;
    object_canonical: string;
    object_kind: string;
    attributes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }>;
}

function dedupeKey(e: ExtractedEntity): string {
  return `${e.entity_kind}::${e.canonical_text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

export function promoteEntities(inputs: PromoterInputs): PromoterOutput {
  const floor = inputs.min_confidence ?? 0.6;

  // Dedupe by key, keep the highest-confidence row per key.
  const byKey = new Map<string, ExtractedEntity>();
  const rejected: ExtractedEntity[] = [];

  for (const e of inputs.entities) {
    if (e.confidence < floor) {
      rejected.push(e);
      continue;
    }
    const k = dedupeKey(e);
    const prev = byKey.get(k);
    if (!prev || e.confidence > prev.confidence) {
      byKey.set(k, { ...e, graph_promoted: true });
    }
  }

  const promoted_entities = Array.from(byKey.values());

  const promoted_relationships: PromoterOutput['promoted_relationships'] = [];
  for (const r of inputs.relationships ?? []) {
    const subj = inputs.entities[r.subject_index];
    const obj = inputs.entities[r.object_index];
    if (!subj || !obj) continue;
    if (r.confidence < floor) continue;
    promoted_relationships.push({
      relationship_kind: r.relationship_kind,
      confidence: r.confidence,
      subject_canonical: subj.canonical_text,
      subject_kind: subj.entity_kind,
      object_canonical: obj.canonical_text,
      object_kind: obj.entity_kind,
      attributes: r.attributes,
      metadata: r.metadata,
    });
  }

  return { promoted_entities, rejected_entities: rejected, promoted_relationships };
}

export const __test = { promoteEntities, dedupeKey };
