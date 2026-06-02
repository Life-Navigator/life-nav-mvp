/**
 * Provider-abstracted extractors — Sprint N Phases 2-4.
 *
 * Real PDF text extraction, OCR, speech-to-text, and video scene
 * analysis require heavyweight runtimes (pdf.js / Tesseract / Gemini
 * Vision / Whisper / ffmpeg). LifeNavigator does not bundle them
 * in-process; instead each capability has a provider interface that
 * the pipeline calls.
 *
 *   - If no provider is configured (env-gated), the extractor returns
 *     `needs_remote_provider: true` and the job is marked `deferred`.
 *   - When a provider IS configured, it produces an ExtractorOutput
 *     identical to the in-process extractors.
 *
 * The default providers in this file are deterministic stubs suitable
 * for the test environment. The real providers ship in follow-up
 * sprints behind the same interface.
 */

import type { ExtractorAdapter, ExtractorInput } from './types';
import type { ExtractorOutput, FileKind } from '@/types/ingestion';

// ---------------------------------------------------------------------------
// Provider interfaces
// ---------------------------------------------------------------------------

export interface PdfProvider {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractorOutput>;
}

export interface VisionProvider {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractorOutput>;
}

export interface SpeechProvider {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractorOutput>;
}

export interface VideoProvider {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractorOutput>;
}

// ---------------------------------------------------------------------------
// Default (deterministic) providers — return a deferred sentinel
// ---------------------------------------------------------------------------

function makeDeferred(
  extractor_name: string,
  file_kind: FileKind,
  reason: string
): ExtractorOutput {
  const ek: ExtractorOutput['extraction_kind'] =
    file_kind === 'pdf'
      ? 'pdf_text'
      : file_kind === 'docx' || file_kind === 'doc'
        ? 'docx_blocks'
        : file_kind === 'xlsx' || file_kind === 'xls' || file_kind === 'ods'
          ? 'spreadsheet_sheet'
          : file_kind === 'pptx' || file_kind === 'ppt' || file_kind === 'odp'
            ? 'presentation_slide'
            : file_kind === 'odt'
              ? 'plain_text'
              : file_kind === 'jpg' ||
                  file_kind === 'png' ||
                  file_kind === 'webp' ||
                  file_kind === 'tiff' ||
                  file_kind === 'heic'
                ? 'ocr_text'
                : file_kind === 'mp3' ||
                    file_kind === 'wav' ||
                    file_kind === 'm4a' ||
                    file_kind === 'aac' ||
                    file_kind === 'flac'
                  ? 'transcript'
                  : file_kind === 'mp4' ||
                      file_kind === 'mov' ||
                      file_kind === 'avi' ||
                      file_kind === 'mkv' ||
                      file_kind === 'webm'
                    ? 'scene_summary'
                    : 'plain_text';

  return {
    extractor_name,
    extractor_version: '1.0.0',
    extraction_kind: ek,
    confidence: 0,
    needs_remote_provider: true,
    deferred_reason: reason,
  };
}

export const defaultPdfProvider: PdfProvider = {
  name: 'pdf_stub',
  async extract(input) {
    return makeDeferred('pdf', input.classification.file_kind, 'pdf_provider_unconfigured');
  },
};

export const defaultVisionProvider: VisionProvider = {
  name: 'vision_stub',
  async extract(input) {
    return makeDeferred('vision', input.classification.file_kind, 'vision_provider_unconfigured');
  },
};

export const defaultSpeechProvider: SpeechProvider = {
  name: 'speech_stub',
  async extract(input) {
    return makeDeferred('speech', input.classification.file_kind, 'speech_provider_unconfigured');
  },
};

export const defaultVideoProvider: VideoProvider = {
  name: 'video_stub',
  async extract(input) {
    return makeDeferred('video', input.classification.file_kind, 'video_provider_unconfigured');
  },
};

// ---------------------------------------------------------------------------
// Adapter wrappers — these are the extractors the routing layer picks
// up. They are interchangeable with the in-process ones.
// ---------------------------------------------------------------------------

let CURRENT = {
  pdf: defaultPdfProvider,
  vision: defaultVisionProvider,
  speech: defaultSpeechProvider,
  video: defaultVideoProvider,
};

export function setProviders(p: Partial<typeof CURRENT>): void {
  CURRENT = { ...CURRENT, ...p };
}

export function getProviders(): typeof CURRENT {
  return CURRENT;
}

export const pdfExtractor: ExtractorAdapter = {
  name: 'pdf',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'pdf';
  },
  async extract(input) {
    return CURRENT.pdf.extract(input);
  },
};

export const docxExtractor: ExtractorAdapter = {
  // OOXML extraction also requires a provider for now (unzip + parse).
  name: 'docx',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'docx' || c.file_kind === 'doc';
  },
  async extract(input) {
    return makeDeferred('docx', input.classification.file_kind, 'docx_provider_unconfigured');
  },
};

export const spreadsheetExtractor: ExtractorAdapter = {
  name: 'spreadsheet',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'xlsx' || c.file_kind === 'xls' || c.file_kind === 'ods';
  },
  async extract(input) {
    return makeDeferred(
      'spreadsheet',
      input.classification.file_kind,
      'spreadsheet_provider_unconfigured'
    );
  },
};

export const presentationExtractor: ExtractorAdapter = {
  name: 'presentation',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'pptx' || c.file_kind === 'ppt' || c.file_kind === 'odp';
  },
  async extract(input) {
    return makeDeferred(
      'presentation',
      input.classification.file_kind,
      'presentation_provider_unconfigured'
    );
  },
};

export const odtExtractor: ExtractorAdapter = {
  name: 'odt',
  version: '1.0.0',
  supports(c) {
    return c.file_kind === 'odt';
  },
  async extract(input) {
    return makeDeferred('odt', input.classification.file_kind, 'odt_provider_unconfigured');
  },
};

export const visionExtractor: ExtractorAdapter = {
  name: 'vision',
  version: '1.0.0',
  supports(c) {
    return (
      c.file_kind === 'jpg' ||
      c.file_kind === 'png' ||
      c.file_kind === 'webp' ||
      c.file_kind === 'tiff' ||
      c.file_kind === 'heic'
    );
  },
  async extract(input) {
    return CURRENT.vision.extract(input);
  },
};

export const speechExtractor: ExtractorAdapter = {
  name: 'speech',
  version: '1.0.0',
  supports(c) {
    return (
      c.file_kind === 'mp3' ||
      c.file_kind === 'wav' ||
      c.file_kind === 'm4a' ||
      c.file_kind === 'aac' ||
      c.file_kind === 'flac'
    );
  },
  async extract(input) {
    return CURRENT.speech.extract(input);
  },
};

export const videoExtractor: ExtractorAdapter = {
  name: 'video',
  version: '1.0.0',
  supports(c) {
    return (
      c.file_kind === 'mp4' ||
      c.file_kind === 'mov' ||
      c.file_kind === 'avi' ||
      c.file_kind === 'mkv' ||
      c.file_kind === 'webm'
    );
  },
  async extract(input) {
    return CURRENT.video.extract(input);
  },
};

export const __test = {
  makeDeferred,
  defaultPdfProvider,
  defaultVisionProvider,
  defaultSpeechProvider,
  defaultVideoProvider,
  pdfExtractor,
  docxExtractor,
  spreadsheetExtractor,
  presentationExtractor,
  odtExtractor,
  visionExtractor,
  speechExtractor,
  videoExtractor,
};
