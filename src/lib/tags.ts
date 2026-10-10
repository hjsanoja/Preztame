// Loan tags ("tipo"). Each tag keeps the same color everywhere in the app:
// known tags take fixed slots, any other tag gets a stable slot from its name.
export const SUGGESTED_TAGS = ['favor', 'negocio', 'familia', 'amigos', 'trabajo', 'emergencia', 'salud', 'estudios'];

export const normalizeTag = (tag: string): string =>
  (tag || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const tagLabel = (tag: string): string => {
  const t = normalizeTag(tag);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Sin etiqueta';
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// 1..8 → CSS var --series-N (validated categorical palette, light + dark).
export function tagSlot(tag: string): number {
  const t = normalizeTag(tag);
  const known = SUGGESTED_TAGS.indexOf(t);
  return (known >= 0 ? known : hash(t)) % 8 + 1;
}

export const tagColorVar = (tag: string) => `var(--series-${tagSlot(tag)})`;

// Tags in use first (most used), then the suggested ones not used yet.
export function tagOptions(used: string[]): string[] {
  const counts = new Map<string, number>();
  used.map(normalizeTag).filter(Boolean).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const inUse = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  return [...inUse, ...SUGGESTED_TAGS.filter(t => !counts.has(t))];
}
