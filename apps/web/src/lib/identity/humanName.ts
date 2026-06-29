// Resolve a SAFE greeting name. Rejects auth slugs / UUIDs / digit-or-underscore ids / vowel-less or
// consonant-heavy gibberish (e.g. "xyccggrekvctxvofxp"). Returns '' when nothing human-looking is available
// → the UI then greets neutrally ("Welcome back"). Used for profile.display_name, metadata, and email local-part.
export function humanName(raw: string | null | undefined): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (/[0-9_]/.test(t) || /[0-9a-f]{8}-[0-9a-f]{4}/i.test(t)) return ''; // ids / uuids
  const first = t.split(/[.\-\s]+/)[0].toLowerCase();
  if (!/^[a-z]{2,15}$/.test(first)) return ''; // too long/short or non-alpha
  if (!/[aeiou]/.test(first)) return ''; // no vowel → gibberish
  if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(first)) return ''; // 4+ consecutive consonants → random
  return first.charAt(0).toUpperCase() + first.slice(1);
}
