import { humanName } from '../humanName';
describe('humanName greeting gate', () => {
  it('prefers a real display name', () => {
    expect(humanName('Tim')).toBe('Tim');
    expect(humanName('Timothy Riffe')).toBe('Timothy');
  });
  it('rejects the regressed auth slug', () => {
    expect(humanName('xyccggrekvctxvofxp')).toBe('');
    expect(humanName('llvuilubizcgkwkmzv')).toBe('');
  });
  it('rejects UUIDs / ids / digit-or-underscore strings', () => {
    expect(humanName('0e471355-3c16-40d9-ae96-4644c93d9d23')).toBe('');
    expect(humanName('user_123')).toBe('');
    expect(humanName('abc123')).toBe('');
  });
  it('humanizes a safe email local-part', () => {
    expect(humanName('timothy')).toBe('Timothy');
  });
  it('empty / vowelless gibberish → neutral', () => {
    expect(humanName('')).toBe('');
    expect(humanName('xkcdwz')).toBe('');
  });
});
