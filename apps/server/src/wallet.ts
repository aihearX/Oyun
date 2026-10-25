import { SKILL_TREE } from '@odi/content';
import { LOCAL_JETON_DAILY_MAX } from '@odi/shared';
import { fail, type App, type Handlers } from './app';
import { MAX_LEVEL } from './progress';
import { dayKey } from './time';

/**
 * Yerel meta ödülleri (günlük görev, takvim, sandık, hazine, Şanslı Nota, başarım) istemcide hesaplanır;
 * jeton kısmı buradan hesaba yazılır. ledgerId ile idempotent. Günlük üst sınır (LOCAL_JETON_DAILY_MAX, @odi/shared) sunucuda
 * uygulanır ve sahte istemcinin sınırsız jeton basmasını engeller. Değer ölçüldü (tools/ekonomi/simule.mjs, ekonomi-olcum.md Ö1):
 * altı oturum profilinin hiçbirinde dürüst oyun sınıra çarpmaz (en yoğun gün 1.270: 6 oturum, 1. gün); sınır, sık oynayan dürüst
 * oyuncunun bir günlük gelirinin üçte birinden azını sahte istemciye bırakır. Eski 600 sınırı dürüst oyunu kesiyordu.
 */
export { LOCAL_JETON_DAILY_MAX };
/** Hesap ilk kez açılırken cihazdaki çevrimdışı jetonun devri: hesap başına bir kez, ilk 24 saatte, en çok bu kadar (günlük sınırdan ayrı) */
export const DEVIR_MAX = 3000;
const DEVIR_WINDOW_MS = 24 * 3_600_000;

export function localCreditedToday(app: App, pid: string): number {
  return app.db.get<{ s: number | null }>('SELECT SUM(credited) AS s FROM local_grants WHERE player_id = ? AND day = ?', pid, dayKey(app.now()))!.s ?? 0;
}

export function skillsOf(app: App, pid: string): string[] {
  return app.db.all<{ skill_id: string }>('SELECT skill_id FROM player_skills WHERE player_id = ? ORDER BY at, skill_id', pid).map((r) => r.skill_id);
}

export const walletHandlers: Handlers = {
  'wallet.local': (app, s, { ledgerId, jeton, reason }) => {
    const prev = app.db.get<{ credited: number }>('SELECT credited FROM local_grants WHERE player_id = ? AND ledger_id = ?', s.pid, ledgerId);
    if (prev) return { wallet: app.wallet(s.pid), credited: prev.credited, dailyLeft: Math.max(0, LOCAL_JETON_DAILY_MAX - localCreditedToday(app, s.pid)) };
    if (reason === 'devir') {
      // cihazdaki çevrimdışı birikim: yalnızca yeni hesapta, bir kez
      const p = app.player(s.pid);
      const done = app.db.get('SELECT 1 AS x FROM local_grants WHERE player_id = ? AND reason = ?', s.pid, 'devir');
      const credited = done || app.now() - p.created_at > DEVIR_WINDOW_MS ? 0 : Math.min(jeton, DEVIR_MAX);
      app.db.run('INSERT INTO local_grants(player_id, ledger_id, jeton, credited, reason, day, at) VALUES(?, ?, ?, ?, ?, ?, ?)', s.pid, ledgerId, jeton, credited, reason, 'devir', app.now());
      app.addCurrency(s.pid, 'jeton', credited);
      return { wallet: app.walletChanged(s.pid), credited, dailyLeft: Math.max(0, LOCAL_JETON_DAILY_MAX - localCreditedToday(app, s.pid)) };
    }
    const left = Math.max(0, LOCAL_JETON_DAILY_MAX - localCreditedToday(app, s.pid));
    const credited = Math.min(jeton, left);
    app.db.run('INSERT INTO local_grants(player_id, ledger_id, jeton, credited, reason, day, at) VALUES(?, ?, ?, ?, ?, ?, ?)',
      s.pid, ledgerId, jeton, credited, reason, dayKey(app.now()), app.now());
    app.addCurrency(s.pid, 'jeton', credited);
    return { wallet: app.walletChanged(s.pid), credited, dailyLeft: left - credited };
  },
  'wallet.spend': (app, s, { jeton, reason }) => {
    const m = /^yetenek:(.+)$/.exec(reason);
    if (!m) return fail('GECERSIZ', 'Bu harcama türü desteklenmiyor.');
    const node = SKILL_TREE.find((n) => n.id === m[1]);
    if (!node) return fail('YOK', 'Böyle bir yetenek yok.');
    if (jeton !== node.cost) fail('GECERSIZ', `Bu yeteneğin fiyatı ${node.cost} jeton.`);
    const owned = new Set(skillsOf(app, s.pid));
    if (owned.has(node.id)) fail('TEKRAR', 'Bu yeteneği zaten aldın.');
    if (node.requires && !owned.has(node.requires)) fail('SART', `Önce "${SKILL_TREE.find((n) => n.id === node.requires)?.name ?? node.requires}" yeteneğini almalısın.`);
    app.spend(s.pid, 'jeton', node.cost);
    app.db.run('INSERT INTO player_skills(player_id, skill_id, at) VALUES(?, ?, ?)', s.pid, node.id, app.now());
    return { wallet: app.walletChanged(s.pid), skills: skillsOf(app, s.pid) };
  },
  'skills.list': (app, s) => ({ skills: skillsOf(app, s.pid) }),
  'progress.sync': (app, s, { best }) => {
    // yalnızca açılan bölüm ve en iyi yıldız/skor; ödül vermez (jeton, savaş, baskın, lig yok)
    for (const b of best) {
      if (b.level < 1 || b.level > MAX_LEVEL) continue;
      app.db.run(`INSERT INTO level_best(player_id, level, stars, score) VALUES(?, ?, ?, ?)
        ON CONFLICT(player_id, level) DO UPDATE SET stars = MAX(stars, excluded.stars), score = MAX(score, excluded.score)`, s.pid, b.level, b.stars, Math.round(b.score));
    }
    const agg = app.db.get<{ stars: number | null; top: number | null }>('SELECT SUM(stars) AS stars, MAX(CASE WHEN stars > 0 THEN level END) AS top FROM level_best WHERE player_id = ?', s.pid)!;
    const p = app.player(s.pid);
    const highest = Math.max(p.highest, Math.min(MAX_LEVEL, (agg.top ?? 0) + 1));
    const stars = Math.max(p.stars, agg.stars ?? 0);
    app.db.run('UPDATE players SET highest = ?, stars = ? WHERE id = ?', highest, stars, s.pid);
    return { highest, stars };
  },
};
