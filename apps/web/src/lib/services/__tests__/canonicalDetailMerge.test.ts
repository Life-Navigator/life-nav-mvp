import { mergeCanonicalExperience, mergeCanonicalDegrees } from '../canonicalDetailMerge';

function fakeSb(career: unknown, eduCreds: unknown[]) {
  const chain = (result: unknown) => {
    const o: Record<string, unknown> = {};
    o.select = () => o;
    o.eq = () => o;
    o.maybeSingle = async () => ({ data: result });
    return o;
  };
  return {
    from: (t: string) => chain(t === 'career_profiles' ? career : null),
    schema: () => ({ from: () => chain({ existing_credentials: eduCreds }) }),
  };
}

describe('canonical detail merge', () => {
  it('surfaces the captured current role as an employment record', async () => {
    const sb = fakeSb(
      {
        current_title: 'Senior Architect',
        current_company: 'LifeNavigator Inc',
        skills: ['C++', 'Rust'],
        summary: 'Focus: Embedded AI',
      },
      []
    );
    const out = await mergeCanonicalExperience(sb as never, 'u', []);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Senior Architect');
    expect(out[0].employer).toBe('LifeNavigator Inc');
    expect(out[0]._source).toMatch(/onboarding/i);
    expect(out[0].responsibilities).toMatch(/Embedded AI/);
  });

  it('does not duplicate when a manual experience record already exists (manual wins)', async () => {
    const sb = fakeSb(
      { current_title: 'Senior Architect', current_company: 'LifeNavigator Inc' },
      []
    );
    const out = await mergeCanonicalExperience(sb as never, 'u', [
      { title: 'Senior Architect', employer: 'LifeNavigator Inc', _source: 'Added manually' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]._source).toBe('Added manually');
  });

  it('no career profile → list unchanged', async () => {
    expect(await mergeCanonicalExperience(fakeSb(null, []) as never, 'u', [])).toEqual([]);
  });

  it('surfaces captured degrees from existing_credentials', async () => {
    const sb = fakeSb(null, [
      {
        highest_level: 'BS in Business Administration and Management',
        school: 'University of Phoenix',
        field: 'Business',
      },
    ]);
    const out = await mergeCanonicalDegrees(sb as never, 'u', []);
    expect(out).toHaveLength(1);
    expect(out[0].institution_name).toBe('University of Phoenix');
    expect(out[0].status).toBe('completed');
  });

  it('degree dedupes against a manual education record', async () => {
    const sb = fakeSb(null, [{ highest_level: 'BS', school: 'University of Phoenix' }]);
    const out = await mergeCanonicalDegrees(sb as never, 'u', [
      { degree_type: 'BS', institution_name: 'University of Phoenix', _source: 'Added manually' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]._source).toBe('Added manually');
  });
});
