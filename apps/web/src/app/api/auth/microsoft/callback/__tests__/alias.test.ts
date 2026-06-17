/** @jest-environment node */
import * as alias from '../route';
import { GET as integrationsGET } from '@/app/api/integrations/oauth/callback/microsoft/route';

describe('Microsoft callback alias (/api/auth/microsoft/callback)', () => {
  it('re-exports the tested integrations callback GET handler', () => {
    expect(typeof alias.GET).toBe('function');
    expect(alias.GET).toBe(integrationsGET);
  });
  it('is force-dynamic', () => {
    expect(alias.dynamic).toBe('force-dynamic');
  });
});
