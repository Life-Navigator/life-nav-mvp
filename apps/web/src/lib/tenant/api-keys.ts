/**
 * Tenant API keys — Sprint P Phase 2.
 *
 * Conventions:
 *   - Plain key format: `lnk_<env>_<base64url-32-bytes>`
 *     (lnk = "life-nav key", env one of test/live)
 *   - Stored: sha256 hex of the plain key + the 12-char prefix
 *     (which IS shown to humans for identification).
 *   - The plain key is shown to the operator ONCE, on creation.
 *
 * All pure helpers; persistence is the route's job.
 */

import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedKey {
  plain: string; // shown to the creator once
  prefix: string; // first 12 chars, also stored
  key_hash: string; // sha256 hex of plain
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateKey(env: 'test' | 'live' = 'live'): GeneratedKey {
  // 32 random bytes mapped onto a 52-char alphabet → 32-char tail.
  const raw = randomBytes(32);
  let tail = '';
  for (let i = 0; i < raw.length; i++) tail += ALPHABET[raw[i] % ALPHABET.length];
  const plain = `lnk_${env}_${tail}`;
  const prefix = plain.slice(0, 12); // 'lnk_live_xxx' style
  const key_hash = sha256Hex(plain);
  return { plain, prefix, key_hash };
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function isValidKeyShape(s: string): boolean {
  return /^lnk_(?:test|live)_[A-Za-z2-9]{32}$/.test(s);
}

export const __test = { generateKey, sha256Hex, isValidKeyShape };
