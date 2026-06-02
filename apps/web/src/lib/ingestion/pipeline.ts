/**
 * Pipeline orchestrator — Sprint N Phase 6.
 *
 * One async function: `runPipeline(file, bytes)`.
 *
 *   1. Classify the file (mime + magic).
 *   2. Route to extractors.
 *   3. Run each extractor (async).
 *   4. For each TEXT extractor output, run domain templates
 *      (primitives + financial/medical/insurance/payroll/receipt).
 *   5. Validate every emitted fact carries a non-empty locator.
 *   6. Aggregate.
 *
 * NO DB I/O here. Persistence is delegated to the API route which
 * inserts rows into ingestion.* and lets the trigger fan out to
 * GraphRAG.
 *
 * Deterministic given the same inputs (the providers are mocked in
 * tests; real providers introduce their own determinism contract).
 */

import { classifyFile } from './mime-classifier';
import { routeExtractors } from './routing';
import { runDomainTemplates } from './entity-extraction/domain-templates';
import { validateFacts } from './validators';
import type {
  ExtractedEntity,
  ExtractedFact,
  ExtractorOutput,
  PipelineResult,
  SourceLocator,
} from '@/types/ingestion';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface PipelineInputs {
  filename: string;
  declared_mime?: string;
  size_bytes: number;
  bytes?: Uint8Array;
  /** Pre-decoded text (saves a decode step for non-binary kinds). */
  text?: string;
  /** Default locator merged into every fact emitted by domain templates. */
  default_locator?: SourceLocator;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export async function runPipeline(inputs: PipelineInputs): Promise<PipelineResult> {
  const classification = classifyFile({
    filename: inputs.filename,
    declared_mime: inputs.declared_mime,
    head: inputs.bytes?.slice(0, 32),
  });

  const extractors = routeExtractors(classification);
  if (extractors.length === 0) {
    return {
      classification,
      extractors_run: [],
      outputs: [],
      ok: false,
      deferred: false,
      errors: [{ extractor: 'router', message: 'no_extractor_for_kind' }],
    };
  }

  const outputs: ExtractorOutput[] = [];
  const errors: PipelineResult['errors'] = [];

  for (const a of extractors) {
    try {
      const out = await a.extract({
        text: inputs.text,
        bytes: inputs.bytes,
        filename: inputs.filename,
        classification,
      });
      outputs.push(out);
    } catch (e) {
      errors.push({ extractor: a.name, message: e instanceof Error ? e.message : 'unknown' });
    }
  }

  // Run domain templates over any text we actually have.
  const default_locator: SourceLocator = inputs.default_locator ?? {
    char_start: 0,
    char_end: (inputs.text ?? '').length,
  };

  for (const out of outputs) {
    if (!out.text || out.text.length === 0) continue;
    const r = runDomainTemplates(out.text, {
      default_locator,
      base_char: 0,
    });
    out.entities = (out.entities ?? []).concat(r.entities);
    out.facts = (out.facts ?? []).concat(r.facts);
  }

  // Validate facts — every fact must have a non-empty locator.
  const allFacts: ExtractedFact[] = outputs.flatMap((o) => o.facts ?? []);
  const v = validateFacts(allFacts);
  if (!v.ok) {
    errors.push({ extractor: 'pipeline.fact_validation', message: JSON.stringify(v.errors) });
  }

  const deferred = outputs.some((o) => o.needs_remote_provider === true);
  const ok = v.ok && outputs.length > 0 && !deferred;

  return {
    classification,
    extractors_run: outputs.map((o) => o.extractor_name),
    outputs,
    ok,
    deferred,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Helpers exposed for the API layer
// ---------------------------------------------------------------------------

export function collectEntities(result: PipelineResult): ExtractedEntity[] {
  return result.outputs.flatMap((o) => o.entities ?? []);
}

export function collectFacts(result: PipelineResult): ExtractedFact[] {
  return result.outputs.flatMap((o) => o.facts ?? []);
}

export const __test = { runPipeline, collectEntities, collectFacts };
