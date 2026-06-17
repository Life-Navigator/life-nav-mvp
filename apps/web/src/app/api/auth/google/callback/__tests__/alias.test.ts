/** @jest-environment node */
import * as alias from '../route';
import { GET as integrationsGET } from '@/app/api/integrations/oauth/callback/google/route';

describe('Google callback alias (/api/auth/google/callback)', () => {
  it('re-exports the tested integrations callback GET handler', () => {
    expect(typeof alias.GET).toBe('function');
    expect(alias.GET).toBe(integrationsGET); // same handler, no duplicated logic
  });
  it('is force-dynamic', () => {
    expect(alias.dynamic).toBe('force-dynamic');
  });
});
