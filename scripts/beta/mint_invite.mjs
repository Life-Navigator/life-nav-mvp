#!/usr/bin/env node
// Mint a private invite key for a tester (founder only).
//
//   INVITE_SIGNING_SECRET=<the same secret set on Vercel> node scripts/beta/mint_invite.mjs tester@example.com
//
// Prints the email-bound invite key. Give the tester their email + this key; they redeem it at /auth (create
// mode) to make their own account. The key works ONLY for that exact email. Keep INVITE_SIGNING_SECRET secret.
import { createHmac } from 'node:crypto';

const email = (process.argv[2] || '').trim().toLowerCase();
const secret = process.env.INVITE_SIGNING_SECRET || '';

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: INVITE_SIGNING_SECRET=... node scripts/beta/mint_invite.mjs <email>');
  process.exit(1);
}
if (!secret || secret.length < 16) {
  console.error('INVITE_SIGNING_SECRET is missing or too short (>=16 chars). Set the same value as on Vercel.');
  process.exit(1);
}

const key = createHmac('sha256', secret).update(`invite:v1:${email}`).digest('base64url');
console.log('\nPrivate beta invite');
console.log('  email:', email);
console.log('  key:  ', key);
console.log('\nThe tester redeems this at /auth (Create account). It works only for this email.\n');
