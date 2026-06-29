import { isBetaAccessAllowed, privateBetaEnabled, blockedReason } from '../betaAccess';

const ENV = process.env;
beforeEach(() => {
  process.env = { ...ENV };
  delete process.env.PRIVATE_BETA_ENABLED;
  delete process.env.PRIVATE_BETA_ADMIN_EMAILS;
  delete process.env.PRIVATE_BETA_ALLOWED_EMAILS;
});
afterAll(() => {
  process.env = ENV;
});

describe('beta access gate', () => {
  it('gate OFF → everyone allowed (normal behavior)', () => {
    expect(privateBetaEnabled()).toBe(false);
    expect(isBetaAccessAllowed('anyone@example.com')).toBe(true);
    expect(isBetaAccessAllowed('')).toBe(true);
  });

  it('gate ON → non-allowlisted blocked', () => {
    process.env.PRIVATE_BETA_ENABLED = 'true';
    expect(isBetaAccessAllowed('random@gmail.com')).toBe(false);
    expect(isBetaAccessAllowed(null)).toBe(false); // missing email
  });

  it('gate ON → admin + allowlisted + synthetic domain allowed', () => {
    process.env.PRIVATE_BETA_ENABLED = '1';
    process.env.PRIVATE_BETA_ADMIN_EMAILS = 'founder@lifenavigator.tech';
    process.env.PRIVATE_BETA_ALLOWED_EMAILS = 'reviewer@firm.com';
    expect(isBetaAccessAllowed('founder@lifenavigator.tech')).toBe(true);
    expect(isBetaAccessAllowed('FOUNDER@lifenavigator.tech')).toBe(true); // case-insensitive
    expect(isBetaAccessAllowed('reviewer@firm.com')).toBe(true);
    expect(isBetaAccessAllowed('beta1@lifenav-beta.example.com')).toBe(true); // synthetic domain
    expect(isBetaAccessAllowed('intruder@evil.com')).toBe(false);
  });

  it('blockedReason masks email, never leaks it', () => {
    expect(blockedReason('intruder@evil.com')).toEqual({
      masked: 'in***@evil.com',
      reason: 'not_allowlisted',
    });
    expect(blockedReason('').reason).toBe('missing_email');
  });
});
