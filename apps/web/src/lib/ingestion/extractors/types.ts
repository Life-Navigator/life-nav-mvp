/**
 * Extractor adapter contracts — Sprint N Phase 1.
 *
 * Every extractor is a pure function over a buffer + classification.
 * They emit:
 *
 *   - text + structured content
 *   - candidate entities + facts
 *   - relationships (by index into entities[])
 *
 * Heavy-weight providers (vision, speech, video) implement the same
 * interface but delegate to remote services; in their absence they
 * return `needs_remote_provider: true` and the pipeline marks the
 * job `deferred`.
 */

import type { ClassifiedFile, ExtractorOutput } from '@/types/ingestion';

export interface ExtractorInput {
  /** The decoded text or raw bytes. Most extractors prefer text. */
  text?: string;
  bytes?: Uint8Array;
  filename: string;
  classification: ClassifiedFile;
}

export interface ExtractorAdapter {
  name: string;
  version: string;
  supports(classification: ClassifiedFile): boolean;
  extract(input: ExtractorInput): Promise<ExtractorOutput> | ExtractorOutput;
}
