import type { EventNotice, EventPeriod, EventReward, EventRun } from '@odi/shared';
import { fail, rid, type App } from '../app';
import { DAY_MS, HOUR_MS, istanbulOffsetMs, weekInfo } from '../time';

/**
 * Etkinlik takvimi (Europe/Istanbul). ODI_EVENTS_FAST=1 (cfg.eventsFast) test modunda saatler dakikaya iner ve dönemler
 * sunucunun açılış anından itibaren art arda sıralanır (uçtan uca testler dönem başında başlasın diye).
 */
export const unitMs = (app: App) => (app.cfg.eventsFast ? 60_000 : HOUR_MS);

function fastPeriod(app: App, t: number, len: number, prefix: string): EventPeriod {
  const idx = Math.floor((t - app.cfg.eventsEpoch) / len);
  const startsAt = app.cfg.eventsEpoch + idx * len;
  return { key: `${prefix}${idx}`, startsAt, endsAt: startsAt + len };
}
const after = (app: App, p: EventPeriod, len: number, prefix: string) => fastPeriod(app, p.endsAt, len, prefix);

/** Takım Düellosu: haftada 2 dönem × 48 saat — Pazartesi 00:00 → Çarşamba 00:00 ve Perşembe 00:00 → Cumartesi 00:00 */
export function duelPeriods(app: App, t = app.now()): { cur: EventPeriod | null; next: EventPeriod } {
  if (app.cfg.eventsFast) { const len = 48 * 60_000; const cur = fastPeriod(app, t, len, 'D'); return { cur, next: after(app, cur, len, 'D') }; }
  const w = weekInfo(t);
  const A = { key: `${w.key}-A`, startsAt: w.startsAt, endsAt: w.startsAt + 2 * DAY_MS };
  const B = { key: `${w.key}-B`, startsAt: w.startsAt + 3 * DAY_MS, endsAt: w.startsAt + 5 * DAY_MS };
  const nw = weekInfo(w.endsAt + HOUR_MS);
  const nextA = { key: `${nw.key}-A`, startsAt: nw.startsAt, endsAt: nw.startsAt + 2 * DAY_MS };
  if (t < A.endsAt) return { cur: A, next: B };
  if (t < B.startsAt) return { cur: null, next: B };
  if (t < B.endsAt) return { cur: B, next: nextA };
  return { cur: null, next: nextA };
}
/** son hamle: düellonun son 2 saati (gerçek) */
export const duelFinalMs = (app: App) => 2 * unitMs(app);

/** Bayrak Yarışı: ISO hafta (Pzt 00:00 – Pzt 00:00); hızlı modda 60 dk */
export function relayPeriod(app: App, t = app.now()): EventPeriod {
  if (app.cfg.eventsFast) return fastPeriod(app, t, 60 * 60_000, 'B');
  const w = weekInfo(t);
  return { key: w.key, startsAt: w.startsAt, endsAt: w.endsAt };
}

/** Ses Avı: 3 günlük — Pazartesi 00:00 → Perşembe 00:00 ve Cuma 00:00 → Pazartesi 00:00 (Perşembe dinlenme) */
export function huntPeriods(app: App, t = app.now()): { cur: EventPeriod | null; next: EventPeriod } {
  if (app.cfg.eventsFast) { const len = 72 * 60_000; const cur = fastPeriod(app, t, len, 'A'); return { cur, next: after(app, cur, len, 'A') }; }
  const w = weekInfo(t);
  const A = { key: `${w.key}-A`, startsAt: w.startsAt, endsAt: w.startsAt + 3 * DAY_MS };
  const B = { key: `${w.key}-B`, startsAt: w.startsAt + 4 * DAY_MS, endsAt: w.endsAt };
  const nw = weekInfo(w.endsAt + HOUR_MS);
  const nextA = { key: `${nw.key}-A`, startsAt: nw.startsAt, endsAt: nw.startsAt + 3 * DAY_MS };
  if (t < A.endsAt) return { cur: A, next: B };
  if (t < B.startsAt) return { cur: null, next: B };
  return { cur: B, next: nextA };
}

/** İstanbul gününün başlangıcı ve bitişi */
export function dayBounds(t: number): { startsAt: number; endsAt: number } {
  const off = istanbulOffsetMs(t);
  const startsAt = Math.floor((t + off) / DAY_MS) * DAY_MS - off;
  return { startsAt, endsAt: startsAt + DAY_MS };
}

/** Bilgi yarışması sabit saatleri (İstanbul): 13:00 ve 20:00; her biri 30 dk boyunca açılabilir. Hızlı modda her an açık. */
export const QUIZ_SLOT_HOURS = [13, 20] as const;
export const QUIZ_SLOT_OPEN_MS = 30 * 60_000;
export function quizSlot(app: App, t = app.now()): { open: boolean; key: string | null; nextAt: number } {
  if (app.cfg.eventsFast) return { open: true, key: `hizli`, nextAt: t };
  const d = dayBounds(t);
  for (let day = 0; day < 2; day++) {
    for (const h of QUIZ_SLOT_HOURS) {
      const at = d.startsAt + day * DAY_MS + h * HOUR_MS;
      if (t >= at && t < at + QUIZ_SLOT_OPEN_MS) return { open: true, key: `${at}`, nextAt: at };
      if (t < at) return { open: false, key: null, nextAt: at };
    }
  }
  return { open: false, key: null, nextAt: d.endsAt + QUIZ_SLOT_HOURS[0] * HOUR_MS };
}

/** dönem kapanışı tek sefer: ilk çağıran true alır */
export function markDone(app: App, kind: string, period: string): boolean {
  return app.db.run('INSERT OR IGNORE INTO ev_done(kind, period, at) VALUES(?, ?, ?)', kind, period, app.now()) === 1;
}

/** gerçek zamanlı bildirim (yalnızca çevrimiçi alıcılar; kalıcı değil — kalıcı iz takım sohbetindedir) */
export function notify(app: App, pids: Iterable<string>, n: Omit<EventNotice, 'id' | 'at'>): void {
  const notice: EventNotice = { id: rid('n'), at: app.now(), ...n };
  for (const pid of pids) app.emit(pid, 'events.notice', { notice });
}

/** ödül kutusuna sabit ödül listesi */
export function giveRewards(app: App, pid: string, items: EventReward[], reason: string): void {
  for (const it of items) app.addInbox(pid, { kind: it.kind, amount: it.amount, ref: it.ref }, reason);
}
export const rw = (jeton: number, kristal = 0, extra: EventReward[] = []): EventReward[] => [
  ...(jeton ? [{ kind: 'jeton' as const, amount: jeton, ref: 'etkinlik' }] : []),
  ...(kristal ? [{ kind: 'kristal' as const, amount: kristal, ref: 'etkinlik' }] : []),
  ...extra,
];

/** etkinlik koşusu makullük denetimi (progress.submit ile aynı sınırlar) */
export function checkRun(d: EventRun): void {
  if (!d.completed && d.stars > 0) fail('GECERSIZ', 'Tamamlanmayan bölüm yıldız veremez.');
}

/** 32 bit FNV-1a: gün/hafta anahtarından sabit seçim (herkes için aynı, gizli olasılık yok) */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export const memberCount = (app: App, teamId: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM players WHERE team_id = ?', teamId)!.n;
