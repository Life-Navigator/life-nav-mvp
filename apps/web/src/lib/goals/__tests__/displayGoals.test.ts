import { filterDisplayGoals } from '../displayGoals';
describe('filterDisplayGoals', () => {
  it('keeps clean normalized goals', () => {
    const g = filterDisplayGoals([
      { title: 'Earn promotion to Principal Architect' },
      { title: 'Save for a first-home down payment' },
    ]);
    expect(g).toHaveLength(2);
  });
  it('rejects a raw onboarding paragraph as a goal', () => {
    const raw =
      'I have a wedding coming up next year in june, before that I want to have money set aside for a down payment for our first house so we can start building a family and we want children and I also want to get in shape';
    expect(filterDisplayGoals([{ title: raw }])).toHaveLength(0);
  });
  it('dedupes by title', () => {
    expect(filterDisplayGoals([{ title: 'Get in shape' }, { title: 'get in shape' }])).toHaveLength(
      1
    );
  });
  it('handles empty/missing', () => {
    expect(filterDisplayGoals(null)).toEqual([]);
    expect(filterDisplayGoals([{ domain: 'finance' }])).toHaveLength(0);
  });
});
