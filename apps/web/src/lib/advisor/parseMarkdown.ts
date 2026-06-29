// Safe, dependency-free Markdown → structured blocks for the Advisor Response Renderer.
// The advisor's LLM output is Markdown-ish text; this turns it into typed blocks the UI renders as polished
// cards/rows (never raw `**`, `#`, or `1.` artifacts). Inline markers are STRIPPED into typed segments, so the
// renderer emits React elements only — there is no HTML injection surface.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export type Block =
  | { kind: 'heading'; level: number; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'quote'; inline: Inline[] }
  // Derived: a labeled multi-domain plan ("**Career:** …") → structured rows.
  | { kind: 'plan'; items: { label: string; body: Inline[] }[] }
  // Derived: a distinct "Next question/step".
  | { kind: 'next'; label: string; content: Inline[] };

const _LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;
// Only http(s)/mailto links are kept as links (defense-in-depth: no javascript: URLs).
const _SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/** Tokenize one line of inline Markdown into typed segments — strips **bold**, *italic*, `code`, [links]. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  // Ordered by precedence; each iteration consumes the earliest match.
  const patterns: { re: RegExp; make: (m: RegExpMatchArray) => Inline }[] = [
    { re: /\*\*([^*]+)\*\*/, make: (m) => ({ t: 'bold', v: m[1] }) },
    { re: /__([^_]+)__/, make: (m) => ({ t: 'bold', v: m[1] }) },
    { re: /`([^`]+)`/, make: (m) => ({ t: 'code', v: m[1] }) },
    { re: _LINK, make: (m) => ({ t: 'link', v: m[1], href: _SAFE_HREF.test(m[2]) ? m[2] : '' }) },
    { re: /(?<![\w*])\*([^*\n]+)\*(?![\w*])/, make: (m) => ({ t: 'italic', v: m[1] }) },
  ];
  let guard = 0;
  while (rest && guard++ < 2000) {
    let best: { idx: number; len: number; seg: Inline } | null = null;
    for (const { re, make } of patterns) {
      const m = rest.match(re);
      if (m && m.index != null && (best === null || m.index < best.idx)) {
        best = { idx: m.index, len: m[0].length, seg: make(m) };
      }
    }
    if (!best) {
      out.push({ t: 'text', v: rest });
      break;
    }
    if (best.idx > 0) out.push({ t: 'text', v: rest.slice(0, best.idx) });
    // A link whose href was rejected degrades to plain text (its label).
    if (best.seg.t === 'link' && !best.seg.href) out.push({ t: 'text', v: best.seg.v });
    else out.push(best.seg);
    rest = rest.slice(best.idx + best.len);
  }
  return out.length ? out : [{ t: 'text', v: text }];
}

/** Plain-text of an inline run (for label detection / tests). */
export function inlineText(inline: Inline[]): string {
  return inline.map((s) => s.v).join('');
}

const _NUM = /^\s*\d+[.)]\s+(.*)$/;
const _BUL = /^\s*[-*•]\s+(.*)$/;
const _HEAD = /^\s*(#{1,4})\s+(.*)$/;
const _QUOTE = /^\s*>\s?(.*)$/;
// "**Label:** body", "**Label**: body", or "Label: body" (label ≤ ~28 chars). The colon may live INSIDE or
// OUTSIDE the bold — we strip a trailing colon from the captured label below.
const _LABELED = /^(?:\*\*([^*]+?)\*\*|__([^_]+?)__)\s*:?\s*(.*)$|^([A-Z][\w &/-]{1,26}):\s+(.*)$/;
const _NEXT_LABEL =
  /^(next (?:step|question|best step|best action)|your next (?:step|question)|next up)$/i;

function labelOf(raw: string): { label: string; body: string } | null {
  const m = raw.match(_LABELED);
  if (!m) return null;
  const label = (m[1] || m[2] || m[4] || '').trim().replace(/:\s*$/, '');
  const body = (m[3] ?? m[5] ?? '').trim();
  if (!label) return null;
  return { label, body };
}

/** Parse advisor Markdown text into typed blocks (with integrated-plan + next-question derivation). */
export function parseBlocks(text: string): Block[] {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    const joined = para.join(' ').trim();
    para = [];
    if (!joined) return;
    const lab = labelOf(joined);
    if (lab && _NEXT_LABEL.test(lab.label)) {
      blocks.push({ kind: 'next', label: lab.label, content: parseInline(lab.body) });
      return;
    }
    blocks.push({ kind: 'paragraph', inline: parseInline(joined) });
  };
  let list: { ordered: boolean; raw: string[] } | null = null;
  const flushList = () => {
    if (!list) return;
    const items = list.raw;
    const ordered = list.ordered;
    list = null;
    // Integrated plan: ≥2 items, ALL labeled → structured rows.
    const labeled = items.map(labelOf);
    if (items.length >= 2 && labeled.every((l) => l && l.body)) {
      blocks.push({
        kind: 'plan',
        items: labeled.map((l) => ({ label: l!.label, body: parseInline(l!.body) })),
      });
      return;
    }
    blocks.push({ kind: 'list', ordered, items: items.map((it) => parseInline(it)) });
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const head = line.match(_HEAD);
    const num = line.match(_NUM);
    const bul = line.match(_BUL);
    const quote = line.match(_QUOTE);
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    if (head) {
      flushList();
      flushPara();
      blocks.push({ kind: 'heading', level: head[1].length, inline: parseInline(head[2]) });
    } else if (num || bul) {
      flushPara();
      const ordered = !!num;
      const item = (num ? num[1] : bul![1]).trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, raw: [] };
      }
      list.raw.push(item);
    } else if (quote) {
      flushList();
      flushPara();
      blocks.push({ kind: 'quote', inline: parseInline(quote[1]) });
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushList();
  flushPara();
  return blocks;
}

/** True if the response contains a multi-domain integrated plan (drives the Integrated Plan card). */
export function hasIntegratedPlan(blocks: Block[]): boolean {
  return blocks.some((b) => b.kind === 'plan' && b.items.length >= 2);
}
