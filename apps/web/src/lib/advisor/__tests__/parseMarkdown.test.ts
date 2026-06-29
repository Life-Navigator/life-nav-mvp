import { parseInline, parseBlocks, inlineText, hasIntegratedPlan } from '../parseMarkdown';

describe('advisor markdown parser', () => {
  it('strips bold markers (no visible **)', () => {
    const segs = parseInline('**Career:** Focus on promotion.');
    expect(segs.some((s) => s.t === 'bold' && s.v === 'Career:')).toBe(true);
    expect(inlineText(segs)).not.toContain('*');
  });

  it('parses a numbered labeled plan into a plan block (not a raw list)', () => {
    const text =
      '1. **Career:** Focus on promotion evidence.\n' +
      '2. **Finances:** Preserve capital for the wedding.\n' +
      '3. **Health:** Keep body recomposition going.';
    const blocks = parseBlocks(text);
    const plan = blocks.find((b) => b.kind === 'plan');
    expect(plan).toBeTruthy();
    expect(hasIntegratedPlan(blocks)).toBe(true);
    // @ts-expect-error narrow
    expect(plan.items.map((i) => i.label)).toEqual(['Career', 'Finances', 'Health']);
    // no raw markdown leaked anywhere
    const flat = JSON.stringify(blocks);
    expect(flat).not.toContain('**');
    expect(flat).not.toMatch(/"v":"\d+\. /);
  });

  it('extracts a distinct next-question block', () => {
    const blocks = parseBlocks(
      'Hold off on grad school.\n\nNext question: Which certification appears most often?'
    );
    const nx = blocks.find((b) => b.kind === 'next');
    expect(nx).toBeTruthy();
    // @ts-expect-error narrow
    expect(inlineText(nx.content)).toContain('certification');
  });

  it('renders plain paragraphs without crashing or markdown artifacts', () => {
    const blocks = parseBlocks('Just a simple sentence with no markdown.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('paragraph');
  });

  it('does not keep a heading hash or treat a normal list as a plan', () => {
    const blocks = parseBlocks('## Education Strategy\n\n- buy milk\n- walk dog');
    expect(blocks[0].kind).toBe('heading');
    expect(inlineText((blocks[0] as any).inline)).toBe('Education Strategy');
    const list = blocks.find((b) => b.kind === 'list');
    expect(list).toBeTruthy(); // unlabeled → stays a list, not a plan
    expect(hasIntegratedPlan(blocks)).toBe(false);
  });

  it('drops unsafe link hrefs (javascript:) but keeps the visible text', () => {
    const segs = parseInline('Click [here](javascript:alert(1)) now');
    expect(segs.some((s) => s.t === 'link')).toBe(false);
    expect(inlineText(segs)).toContain('here');
    expect(inlineText(segs)).not.toContain('javascript:');
  });

  it('keeps safe https links', () => {
    const segs = parseInline('See [docs](https://example.com/x)');
    const link = segs.find((s) => s.t === 'link');
    expect(link && link.t === 'link' && link.href).toBe('https://example.com/x');
  });
});
