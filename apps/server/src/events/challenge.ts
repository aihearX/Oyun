import type { ChallengeState, EventReward, RankRow } from '@odi/shared';
import { fail, type App, type Handlers } from '../app';
import { dayKey } from '../time';
import { checkRun, dayBounds, giveRewards, hash32, markDone, notify, rw } from './common';

/** Günün Meydan Okuması: herkes için aynı tuzlu zorlu bölüm (günde 1), 3 deneme, en iyi skor sayılır. */
export const CHALLENGE_TRIES = 3;
const CHALLENGE_LEVELS = [3, 4, 5, 7, 8, 10, 11, 14, 15, 17, 18, 22, 23, 25, 27, 33];
/**
 * Sıra ödülleri katılımla ölçeklenir (sahip kararı 53, YN-256). `min`: kademenin verilmesi için gereken en az katılımcı (puanı olan) sayısı.
 * 1. en az 5, 2.–3. en az 8 katılımda; 4.–10. ve ilk %10 de 8'e bağlı (az katılımda 4.'nün 2.'den çok alması olmasın; ilk %10 zaten
 * ancak 110+ katılımda devreye girer, mantığı aynı). Eşiğin altında kalan sıradaki herkes (puanı olan) tek katılım ödülü alır.
 */
export const CHALLENGE_REWARDS: { label: string; from: number; to: number; min: number; items: EventReward[] }[] = [
  { label: '1.', from: 1, to: 1, min: 5, items: rw(300, 50) },
  { label: '2.–3.', from: 2, to: 3, min: 8, items: rw(200, 30) },
  { label: '4.–10.', from: 4, to: 10, min: 8, items: rw(120, 15) },
  { label: 'İlk %10', from: 11, to: Infinity, min: 8, items: rw(60, 8) },
];
/** sıra ödülünün eşiği altında kalan katılımda puanı olan herkese (bugünkü ilk %10 kademesiyle aynı miktar) */
export const CHALLENGE_PARTICIPATION: EventReward[] = rw(60, 8);
export const CHALLENGE_MIN_FIRST = CHALLENGE_REWARDS[0]!.min;
export const CHALLENGE_MIN_ALL = CHALLENGE_REWARDS[1]!.min;

/** gün sonunda `rank`. sıradaki oyuncunun ödülü (`total`: puanı olan katılımcı sayısı); sıra ödülü, katılım ödülü ya da hiç (null) */
export function challengePrize(rank: number, total: number): { kind: 'sira' | 'katilim'; label: string; items: EventReward[] } | null {
  const top10pct = Math.max(1, Math.ceil(total * 0.1));
  const tier = CHALLENGE_REWARDS.find((t) => rank >= t.from && rank <= t.to && (t.to !== Infinity || rank <= top10pct));
  if (tier && total >= tier.min) return { kind: 'sira', label: tier.label, items: tier.items };
  // eşik altında kalan sıra (yalnız toplam < 8 iken olur; o zaman herkes bir kademeye düşer): katılım ödülü
  if (tier) return { kind: 'katilim', label: 'Katılım ödülü', items: CHALLENGE_PARTICIPATION };
  return null;
}

/** kartta ve bildirimde aynı dürüst kural cümlesi: o günün gerçek katılan sayısıyla */
export function challengeRuleText(total: number): string {
  const kural = `1.'lik ödülü en az ${CHALLENGE_MIN_FIRST}, 2.–10. ödülleri en az ${CHALLENGE_MIN_ALL} katılımda verilir`;
  if (total < CHALLENGE_MIN_FIRST) return `${total} kişi katıldı; ${kural}. Bu yüzden puanı olan herkese katılım ödülü.`;
  if (total < CHALLENGE_MIN_ALL) return `${total} kişi katıldı; ${kural}. Bu yüzden 1.'ye sıra ödülü, diğer herkese katılım ödülü.`;
  return `${total} kişi katıldı; ${kural}. Sıra ödülleri geçerli.`;
}

export function challengeOf(day: string): { level: number; salt: number } {
  const h = hash32(`meydan:${day}`);
  return { level: CHALLENGE_LEVELS[h % CHALLENGE_LEVELS.length]!, salt: 1000 + ((h >>> 8) % 9000) };
}

interface CRow { day: string; player_id: string; tries: number; best: number; best_at: number }
const rankOf = (app: App, day: string, r: CRow) => 1 + app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_challenge WHERE day = ? AND best > 0 AND (best > ? OR (best = ? AND best_at < ?))', day, r.best, r.best, r.best_at)!.n;
const scored = (app: App, day: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_challenge WHERE day = ? AND best > 0', day)!.n;

/** biten günlerin ödülleri (tembel): katılıma göre sıra ödülü (ilk 10 ve ilk %10) ya da katılım ödülü (`challengePrize`) */
export function challengeTick(app: App): void {
  const today = dayKey(app.now());
  for (const { day } of app.db.all<{ day: string }>('SELECT DISTINCT day FROM ev_challenge WHERE day != ?', today)) {
    if (!markDone(app, 'meydan', day)) continue;
    const rows = app.db.all<CRow>('SELECT * FROM ev_challenge WHERE day = ? AND best > 0 ORDER BY best DESC, best_at ASC', day);
    rows.forEach((r, i) => {
      const rank = i + 1;
      const prize = challengePrize(rank, rows.length);
      if (!prize) return;
      if (prize.kind === 'sira') {
        giveRewards(app, r.player_id, prize.items, `Günün Meydan Okuması ${day}: ${rank}. sıra`);
        notify(app, [r.player_id], { kind: 'meydan', icon: '🏅', title: `Meydan okuma: ${rank}. oldun!`, text: 'Ödülün ödül kutusunda.', target: 'meydan' });
      } else {
        giveRewards(app, r.player_id, prize.items, `Günün Meydan Okuması ${day}: katılım ödülü (${rows.length} kişi katıldı, sen ${rank}.)`);
        notify(app, [r.player_id], { kind: 'meydan', icon: '🏅', title: `Meydan okuma: ${rank}. oldun, katılım ödülü`, text: `${challengeRuleText(rows.length)} Ödülün ödül kutusunda.`, target: 'meydan' });
      }
    });
  }
}

function lastOf(app: App, prev: CRow): NonNullable<ChallengeState['last']> {
  const rank = rankOf(app, prev.day, prev); const total = scored(app, prev.day);
  const prize = challengePrize(rank, total);
  return { day: prev.day, rank, score: prev.best, total, prize: prize ? { kind: prize.kind, items: prize.items } : null };
}

export function challengeState(app: App, pid: string): ChallengeState {
  challengeTick(app);
  const now = app.now();
  const day = dayKey(now);
  const { level, salt } = challengeOf(day);
  const me = app.db.get<CRow>('SELECT * FROM ev_challenge WHERE day = ? AND player_id = ?', day, pid);
  const toRow = (r: CRow & { name: string; color: number }, rank: number): RankRow => ({ id: r.player_id, name: r.name, color: r.color, score: r.best, rank });
  const top = app.db.all<CRow & { name: string; color: number }>('SELECT c.*, p.name, p.color FROM ev_challenge c JOIN players p ON p.id = c.player_id WHERE c.day = ? AND c.best > 0 ORDER BY c.best DESC, c.best_at ASC LIMIT 50', day).map((r, i) => toRow(r, i + 1));
  const friends = app.db.all<CRow & { name: string; color: number }>(
    `SELECT c.*, p.name, p.color FROM ev_challenge c JOIN players p ON p.id = c.player_id WHERE c.day = ? AND c.best > 0 AND (c.player_id = ? OR c.player_id IN (SELECT b FROM friends WHERE a = ?)) ORDER BY c.best DESC, c.best_at ASC LIMIT 50`, day, pid, pid)
    .map((r) => toRow(r, rankOf(app, day, r)));
  const prev = app.db.get<CRow>('SELECT * FROM ev_challenge WHERE player_id = ? AND day < ? AND best > 0 ORDER BY day DESC LIMIT 1', pid, day);
  return {
    day, endsAt: dayBounds(now).endsAt, level, salt, tries: me?.tries ?? 0, maxTries: CHALLENGE_TRIES, best: me && me.best > 0 ? me.best : null,
    rank: me && me.best > 0 ? rankOf(app, day, me) : null, total: scored(app, day), top, friends,
    rewards: CHALLENGE_REWARDS.map((t) => ({ label: t.label, items: t.items, min: t.min })),
    participation: CHALLENGE_PARTICIPATION, minFirst: CHALLENGE_MIN_FIRST, minAll: CHALLENGE_MIN_ALL,
    last: prev ? lastOf(app, prev) : null,
  };
}

export const challengeHandlers: Handlers = {
  'challenge.state': (app, s) => ({ challenge: challengeState(app, s.pid) }),
  'challenge.submit': (app, s, d) => {
    checkRun(d);
    if (app.db.get('SELECT 1 AS x FROM ev_challenge_run WHERE player_id = ? AND run_id = ?', s.pid, d.runId)) return { challenge: challengeState(app, s.pid) };
    const now = app.now();
    const day = dayKey(now);
    const me = app.db.get<CRow>('SELECT * FROM ev_challenge WHERE day = ? AND player_id = ?', day, s.pid);
    if ((me?.tries ?? 0) >= CHALLENGE_TRIES) fail('LIMIT', `Bugünkü ${CHALLENGE_TRIES} deneme hakkını kullandın. Yarın yeni meydan okuma!`);
    const score = Math.round(d.score);
    app.db.run('INSERT INTO ev_challenge_run(player_id, run_id, day, score, at) VALUES(?, ?, ?, ?, ?)', s.pid, d.runId, day, score, now);
    if (!me) app.db.run('INSERT INTO ev_challenge(day, player_id, tries, best, best_at) VALUES(?, ?, 1, ?, ?)', day, s.pid, score, now);
    else if (score > me.best) app.db.run('UPDATE ev_challenge SET tries = tries + 1, best = ?, best_at = ? WHERE day = ? AND player_id = ?', score, now, day, s.pid);
    else app.db.run('UPDATE ev_challenge SET tries = tries + 1 WHERE day = ? AND player_id = ?', day, s.pid);
    return { challenge: challengeState(app, s.pid) };
  },
};
