// Capture rendered UI for a given APP_URL (prod or preview), logged in as a persona.
// Saves screenshots to OUT_DIR and dumps key rendered text. env: APP_URL, OUT_DIR, PERSONA.
import { readFileSync, mkdirSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { chromium } from '@playwright/test';
for (const line of readFileSync(new URL('./.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const U = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (process.env.TARGET_URL || process.env.APP_URL || '').replace(/\/$/, '');
const OUT = process.env.OUT_DIR || '/tmp/val';
const PERSONA = process.env.PERSONA || 'married_family';
const host = new URL(APP).hostname;
mkdirSync(OUT, { recursive: true });
const h = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const ts = Date.now(), email = `val-${ts}@lifenav.test`, pw = `Val-${ts}!a`;
const uid = (await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: h, body: JSON.stringify({ email, password: pw, email_confirm: true }) })).json()).id;
const sess = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) })).json();
const jar = {}; const sc = createServerClient(U, ANON, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (jar[name] = value)) } });
await sc.auth.setSession({ access_token: sess.access_token, refresh_token: sess.refresh_token });
const cookieHeader = Object.entries(jar).map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
await fetch(`${APP}/api/integrations/plaid/activate-persona`, { method: 'POST', headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: PERSONA }) });
await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ setup_completed: true, onboarding_completed: true }) });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 2400 } });
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, domain: host, path: '/', secure: true, sameSite: 'Lax' })));
const page = await ctx.newPage();
const PAGES = [['dashboard', '/dashboard'], ['finance', '/dashboard/finance'], ['accounts', '/dashboard/finance/accounts'], ['investments', '/dashboard/finance/investments'], ['retirement', '/dashboard/finance/retirement'], ['overview', '/dashboard/finance/overview']];
for (const [name, path] of PAGES) {
  try {
    const r = await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
    const t = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\n{2,}/g, '\n');
    const crash = t.includes('Something went wrong');
    const cap = name === 'dashboard' ? 4000 : 1200;
    console.log(`\n[${name}] ${path} → ${r?.status()} ${crash ? 'CRASH' : 'ok'}`);
    console.log('   ' + t.slice(0, cap).replace(/\n/g, ' | '));
  } catch (e) { console.log(`\n[${name}] ${path} → ERROR ${e?.message?.slice(0, 100)}`); }
}
await browser.close();
await fetch(`${U}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: h });
for (const tb of ['financial_accounts', 'transactions', 'assets', 'retirement_plans', 'asset_loans']) await fetch(`${U}/rest/v1/${tb}?user_id=eq.${uid}`, { method: 'DELETE', headers: { ...h, 'Accept-Profile': 'finance', 'Content-Profile': 'finance' } }).catch(() => {});
console.log(`\nscreenshots → ${OUT}`);
