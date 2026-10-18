import { leaguePointsFor, raidDamageFor, warPointsFor, xpForRun, type RunResult } from '@odi/shared';
import { fail, parseJson, type App, type Handlers } from './app';
import { completeDue } from './camp';
import { addLeaguePoints } from './league';
import { racePlaceFor } from './race';
import { raidHit } from './raid';
import { addContrib, addGoalProgress, addTeamXp, broadcastExtra, techBonus } from './teamextra';
import { addWarPoints } from './war';

export const MAX_LEVEL = 40;
export const MAX_COINS = 400;
export const MAX_SCORE = 50_000;
export const MIN_TIME_SEC = 5;
/** bina etkileri (BUILDINGS açıklamalarıyla aynı) */
export const LAB_PCT_PER_LEVEL = 3;
export const ATOLYE_PCT_PER_LEVEL = 4;
export const REVIR_PCT_PER_LEVEL = 3;
export const KULE_PCT_PER_LEVEL = 2;

export interface Bonuses { coinPct: number; shieldChancePct: number; firstHitIgnorePct: number; warPct: number; raidPct: number }
/** kamp binaları + takım teknolojisi toplam etkileri (yüzde) — sunucu hesapları ve istemci (kalkan/revir şansı) aynı değeri kullanır */
export function bonusesFor(app: App, pid: string): Bonuses {
  const teamId = app.player(pid).team_id;
  const bld = new Map(app.db.all<{ id: string; level: number }>('SELECT id, level FROM buildings WHERE player_id = ?', pid).map((b) => [b.id, b.level]));
  const lv = (id: string) => bld.get(id) ?? 0;
  return {
    coinPct: lv('laboratuvar') * LAB_PCT_PER_LEVEL + techBonus(app, teamId, 'jeton'),
    shieldChancePct: lv('atolye') * ATOLYE_PCT_PER_LEVEL + techBonus(app, teamId, 'kalkan'),
    firstHitIgnorePct: lv('revir') * REVIR_PCT_PER_LEVEL,
    warPct: lv('kule') * KULE_PCT_PER_LEVEL + techBonus(app, teamId, 'savas'),
    raidPct: techBonus(app, teamId, 'baskin'),
  };
}

/** aynı runId için kayıtlı yanıt (idempotent gönderim) */
const RUN_RETAIN_MS = 30 * 86_400_000;
export function pruneRuns(app: App): void { app.db.run('DELETE FROM progress_runs WHERE at < ?', app.now() - RUN_RETAIN_MS); }

export const progressHandlers: Handlers = {
  'me.bonuses': (app, s) => bonusesFor(app, s.pid),
  'progress.submit': (app, s, d) => {
    const prev = app.db.get<{ ack: string }>('SELECT ack FROM progress_runs WHERE player_id = ? AND run_id = ?', s.pid, d.runId);
    if (prev) return parseJson(prev.ack, null) ?? fail('SUNUCU', 'Kayıtlı yanıt okunamadı.');
    const p = app.player(s.pid);
    if (d.level > p.highest + 1) fail('GECERSIZ', 'Bu bölüm henüz açılmamış.');
    if (!d.completed && d.stars > 0) fail('GECERSIZ', 'Tamamlanmayan bölüm yıldız veremez.');
    completeDue(app, s.pid);
    const teamId = p.team_id;
    const bonus = bonusesFor(app, s.pid);

    // jeton: sunucu yetkili cüzdan
    const coinMul = 1 + bonus.coinPct / 100;
    const jeton = Math.round(Math.min(d.coins, MAX_COINS) * coinMul);
    app.addCurrency(s.pid, 'jeton', jeton);

    // en iyi skor / yıldız
    const best = app.db.get<{ stars: number; score: number }>('SELECT stars, score FROM level_best WHERE player_id = ? AND level = ?', s.pid, d.level);
    const score = Math.round(d.score);
    let starGain = 0;
    if (d.completed) {
      starGain = Math.max(0, d.stars - (best?.stars ?? 0));
      app.db.run(`INSERT INTO level_best(player_id, level, stars, score) VALUES(?, ?, ?, ?)
        ON CONFLICT(player_id, level) DO UPDATE SET stars = MAX(stars, excluded.stars), score = MAX(score, excluded.score)`, s.pid, d.level, d.stars, score);
    }
    const highest = d.completed ? Math.max(p.highest, Math.min(MAX_LEVEL, d.level + 1)) : p.highest;
    const run = { completed: d.completed, stars: d.stars, secretFound: false } as RunResult;
    const xp = p.xp + xpForRun(run);
    app.db.run('UPDATE players SET highest = ?, stars = stars + ?, xp = ? WHERE id = ?', highest, starGain, xp, s.pid);

    // savaş puanı (parayla alınamaz: yalnızca oynayarak)
    const warMul = 1 + bonus.warPct / 100;
    const warPoints = Math.round(warPointsFor(d) * warMul);
    addWarPoints(app, s.pid, teamId, d.biome, warPoints);

    // baskın
    const raidRaw = Math.round(raidDamageFor(d) * (1 + bonus.raidPct / 100));
    const raidDamage = raidHit(app, s.pid, teamId, raidRaw);

    // lig
    const place = d.raceId ? racePlaceFor(app, s.pid, d.raceId) : null;
    const leaguePoints = leaguePointsFor(d, place);
    addLeaguePoints(app, s.pid, leaguePoints);

    // takım katkısı ve hedefler
    if (teamId) {
      const stars = d.completed ? d.stars : 0;
      addContrib(app, teamId, s.pid, { stars });
      addTeamXp(app, teamId, stars * 2);
      addGoalProgress(app, teamId, 'yildiz', stars);
      addGoalProgress(app, teamId, 'bolum', d.completed ? 1 : 0);
      addGoalProgress(app, teamId, 'baskin', raidDamage);
      broadcastExtra(app, teamId);
    }

    const after = app.player(s.pid);
    const ack = {
      highest: after.highest, stars: after.stars, warPoints, raidDamage, leaguePoints,
      newInbox: app.unclaimedInbox(s.pid), jeton, wallet: app.walletChanged(s.pid),
    };
    app.db.run('INSERT INTO progress_runs(player_id, run_id, ack, at) VALUES(?, ?, ?, ?)', s.pid, d.runId, JSON.stringify(ack), app.now());
    return ack;
  },
};
