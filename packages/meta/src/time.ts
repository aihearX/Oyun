/** Yerel takvim günü anahtarı: 'YYYY-MM-DD'. Gün dönümü oyuncunun kendi gece yarısıdır. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parse(k: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
/** b − a (gün). Geçersiz anahtarda null. */
export function daysBetween(a: string, b: string): number | null {
  const x = parse(a), y = parse(b); if (x == null || y == null) return null;
  return Math.round((y - x) / 864e5);
}
export function addDays(k: string, n: number): string {
  const x = parse(k); if (x == null) return k;
  const d = new Date(x + n * 864e5); const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
