/**
 * Secret Rotation Framework — Sprint R Phase 6.
 *
 * Tracks rotation schedules per secret. Pure helpers; the DB carries
 * authoritative state.
 *
 *   * `daysUntilDue` — when does this secret next need to roll?
 *   * `partitionByDueness` — split into ok / due_soon / overdue
 *   * `oldestSecretAge` — diagnostic for the operational dashboard
 */

import type { SecretRotationItem } from './types';

export interface DuenessReport {
  ok: SecretRotationItem[];
  due_soon: SecretRotationItem[]; // within DUE_SOON_WINDOW_DAYS
  overdue: SecretRotationItem[];
  oldest_age_days: number;
}

export const DUE_SOON_WINDOW_DAYS = 14;

export function daysUntilDue(item: SecretRotationItem, now_ms = Date.now()): number | null {
  if (!item.next_due_at) return null;
  const due = Date.parse(item.next_due_at);
  if (Number.isNaN(due)) return null;
  return Math.round((due - now_ms) / (24 * 60 * 60 * 1000));
}

export function ageDays(item: SecretRotationItem, now_ms = Date.now()): number | null {
  if (!item.last_rotated_at) return null;
  const rotated = Date.parse(item.last_rotated_at);
  if (Number.isNaN(rotated)) return null;
  return Math.max(0, Math.round((now_ms - rotated) / (24 * 60 * 60 * 1000)));
}

export function partitionByDueness(
  items: SecretRotationItem[],
  now_ms = Date.now()
): DuenessReport {
  const ok: SecretRotationItem[] = [];
  const due_soon: SecretRotationItem[] = [];
  const overdue: SecretRotationItem[] = [];
  let oldest = 0;

  for (const item of items) {
    const days = daysUntilDue(item, now_ms);
    if (days === null) {
      overdue.push(item); // unscheduled → treat as overdue for ops visibility
    } else if (days < 0) {
      overdue.push(item);
    } else if (days <= DUE_SOON_WINDOW_DAYS) {
      due_soon.push(item);
    } else {
      ok.push(item);
    }
    const a = ageDays(item, now_ms);
    if (a !== null && a > oldest) oldest = a;
  }
  return { ok, due_soon, overdue, oldest_age_days: oldest };
}
