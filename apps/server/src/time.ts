/** Zaman yardımcıları. Tüm takvim hesapları Europe/Istanbul yerel saatine göredir; sunucu saati tek kaynaktır. */
export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const WEEK_MS = 7 * DAY_MS;

let fmt: Intl.DateTimeFormat | null = null;
try {
  fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
} catch { fmt = null; }

/** İstanbul'un UTC farkı (ms). ICU yoksa Türkiye'nin sabit +03:00 değeri kullanılır. */
export function istanbulOffsetMs(t: number): number {
  if (!fmt) return 3 * HOUR_MS;
  try {
    const p: Record<string, number> = {};
    for (const part of fmt.formatToParts(new Date(t))) if (part.type !== 'literal') p[part.type] = Number(part.value);
    const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour! % 24, p.minute!, p.second!);
    return asUtc - Math.floor(t / 1000) * 1000;
  } catch { return 3 * HOUR_MS; }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** yerel (İstanbul) takvim alanları */
function local(t: number) {
  const off = istanbulOffsetMs(t);
  const d = new Date(t + off);
  return { off, y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: (d.getUTCDay() + 6) % 7 /* Pzt=0 */ };
}

export function dayKey(t: number): string { const l = local(t); return `${l.y}-${pad(l.m + 1)}-${pad(l.d)}`; }
export function monthKey(t: number): string { const l = local(t); return `${l.y}-${pad(l.m + 1)}`; }
export function monthStart(t: number): number { const l = local(t); return Date.UTC(l.y, l.m, 1) - l.off; }

export interface WeekInfo { key: string; startsAt: number; endsAt: number }
/** ISO hafta: Pazartesi 00:00 (İstanbul) başlar, bir sonraki Pazartesi 00:00'da biter (endsAt hariç). */
export function weekInfo(t: number): WeekInfo {
  const l = local(t);
  const startsAt = Date.UTC(l.y, l.m, l.d) - l.dow * DAY_MS - l.off;
  // ISO hafta numarası: haftanın Perşembesi yılı belirler
  const thu = new Date(Date.UTC(l.y, l.m, l.d) + (3 - l.dow) * DAY_MS);
  const isoYear = thu.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const week = Math.floor((thu.getTime() - jan1) / DAY_MS / 7) + 1;
  return { key: `${isoYear}-W${pad(week)}`, startsAt, endsAt: startsAt + WEEK_MS };
}

export interface RaidWindow { id: string; open: boolean; opensAt: number; closesAt: number }
/** Baskın penceresi: Cuma 20:00 – Cumartesi 20:00 (İstanbul). always=true ise tüm hafta açık (test). */
export function raidWindow(t: number, always: boolean): RaidWindow {
  const w = weekInfo(t);
  if (always) return { id: w.key, open: true, opensAt: w.startsAt, closesAt: w.endsAt };
  let opensAt = w.startsAt + 4 * DAY_MS + 20 * HOUR_MS;
  let closesAt = opensAt + DAY_MS;
  if (t >= closesAt) { opensAt += WEEK_MS; closesAt += WEEK_MS; }
  return { id: weekInfo(opensAt).key, open: t >= opensAt && t < closesAt, opensAt, closesAt };
}
