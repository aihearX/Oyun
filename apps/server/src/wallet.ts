import { SKILL_TREE } from '@odi/content';
import { LOCAL_JETON_CARRY_MAX, LOCAL_JETON_DAILY_MAX } from '@odi/shared';
import { fail, type App, type Handlers } from './app';
import { MAX_LEVEL } from './progress';
import { dayKey, dayNumber, dayNumberStart } from './time';

/**
 * Yerel meta ödülleri (görev, takvim, sandık, hazine, Şanslı Nota, başarım) istemcide hesaplanır, jetonu buradan yazılır (ledgerId ile idempotent). Günlük üst sınır sunucuda uygulanır, sahte istemcinin sınırsız jeton basmasını engeller.
 * Değer ölçüldü (tools/ekonomi/simule.mjs, docs/yonetim/ekonomi-olcum.md Ö1): dürüst oyunun en yoğun günü 1.270 jeton (6 oturum, 1. gün), altı profilin hiçbiri sınıra çarpmaz; eski 600 dürüst oyunu kesiyordu.
 * Ölçülenden uzun oynayan dürüst oyuncu yine çarpabilir (tur 16: aynı gün 21-25, 460 jeton eklenmedi). Sahip kararı 54 (YN-270): sınırı
 * aşan jeton kaybolmaz, `players.carry_jeton`da (göç 16) "bekleyen ödül" olarak durur ve sonraki günlerde yine sınır içinde hesaba geçer
 * (`bekleyenAktar`). Günde hesaba geçen yerel ödül jetonu (bekleyenden gelen dahil) yine en çok LOCAL_JETON_DAILY_MAX: sahte istemciye
 * karşı koruma aynı. Bekleyen ödülün de tavanı var (LOCAL_JETON_CARRY_MAX = 3.000, iki günlük tavan): bekleyen doluyken aşan kısım
 * eklenmez (`carryAdded` yanıtta; ekran "eklenmedi" der). Tavansız bekleyen, sahte istemcinin her gün tam sınırı hesaba geçirmesine yol açardı.
 */
export { LOCAL_JETON_CARRY_MAX, LOCAL_JETON_DAILY_MAX };
/** Hesap ilk kez açılırken cihazdaki çevrimdışı jetonun devri: hesap başına bir kez, ilk 24 saatte, en çok bu kadar (günlük sınırdan ayrı) */
export const DEVIR_MAX = 3000;
const DEVIR_WINDOW_MS = 24 * 3_600_000;

export function localCreditedToday(app: App, pid: string): number {
  return app.db.get<{ s: number | null }>('SELECT SUM(credited) AS s FROM local_grants WHERE player_id = ? AND day = ?', pid, dayKey(app.now()))!.s ?? 0;
}

/** bekleyen ödülün hesaba geçtiği günün defter kimliği: istemci kimliği bu biçimde olamaz ('#' wallet.local şemasında yasak) */
const BEKLEYEN_REASON = 'bekleyen';
const bekleyenLedger = (day: string) => `${BEKLEYEN_REASON}#${day}`;

/**
 * Bekleyen ödül jetonunu (karar 54) bugünkü sınırın kalanı kadar hesaba geçirir; geçen miktarı döndürür. Gün dönünce ilk
 * `wallet.get` / `wallet.local` çağrısında (bağlanınca ve her yerel ödülde) çalışır; yeni ödülden önce gelir (eski bekleyen önce).
 * Geçen kısım bugünün sınırından sayılır (`local_grants`, reason 'bekleyen'): bir günde hesaba geçen yine en çok LOCAL_JETON_DAILY_MAX.
 */
export function bekleyenAktar(app: App, pid: string): number {
  const carry = app.player(pid).carry_jeton;
  if (carry <= 0) return 0;
  const n = Math.min(carry, LOCAL_JETON_DAILY_MAX - localCreditedToday(app, pid));
  if (n <= 0) return 0;
  const day = dayKey(app.now());
  app.db.run('UPDATE players SET carry_jeton = carry_jeton - ? WHERE id = ?', n, pid);
  app.db.run(`INSERT INTO local_grants(player_id, ledger_id, jeton, credited, reason, day, at) VALUES(?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, ledger_id) DO UPDATE SET jeton = jeton + excluded.jeton, credited = credited + excluded.credited, at = excluded.at`,
  pid, bekleyenLedger(day), n, n, BEKLEYEN_REASON, day, app.now());
  app.addCurrency(pid, 'jeton', n);
  return n;
}

/**
 * Günlük yerel ödül sınırının bugünkü durumu (YN-269, Bugün göstergesi): kalan jeton ve sınırın yenileneceği an (sıradaki İstanbul
 * gece yarısı). `wallet.local` ve `wallet.get` yanıtına eklenir; istemci "X / 1.500" yazar, an geçince son bilinen değeri göstermez.
 * Karar 54: `carry` sonraki günlere bekleyen ödül jetonu, `carriedToday` bugün bekleyenden hesaba geçen (ikisi de yalnız ekleme;
 * eski sunucu göndermez, istemci o zaman eski kuralı yazar).
 */
export function gunlukSinir(app: App, pid: string): { dailyLeft: number; dailyResetAt: number; carry: number; carriedToday: number } {
  const carriedToday = app.db.get<{ s: number | null }>('SELECT credited AS s FROM local_grants WHERE player_id = ? AND ledger_id = ?', pid, bekleyenLedger(dayKey(app.now())))?.s ?? 0;
  return {
    dailyLeft: Math.max(0, LOCAL_JETON_DAILY_MAX - localCreditedToday(app, pid)), dailyResetAt: dayNumberStart(dayNumber(app.now()) + 1),
    carry: app.player(pid).carry_jeton, carriedToday,
  };
}

export function skillsOf(app: App, pid: string): string[] {
  return app.db.all<{ skill_id: string }>('SELECT skill_id FROM player_skills WHERE player_id = ? ORDER BY at, skill_id', pid).map((r) => r.skill_id);
}

export const walletHandlers: Handlers = {
  'wallet.local': (app, s, { ledgerId, jeton, reason }) => {
    const prev = app.db.get<{ credited: number; carried: number | null }>('SELECT credited, carried FROM local_grants WHERE player_id = ? AND ledger_id = ?', s.pid, ledgerId);
    // yinelenen gönderim: kayıtlı yanıt; bekleyene yazılan kısım göç 17'den önceki kayıtta bilinmez (null: alan gönderilmez)
    if (prev) return { wallet: app.wallet(s.pid), credited: prev.credited, ...(prev.carried != null ? { carryAdded: prev.carried } : {}), ...gunlukSinir(app, s.pid) };
    if (reason === 'devir') {
      // cihazdaki çevrimdışı birikim: yalnızca yeni hesapta, bir kez
      const p = app.player(s.pid);
      const done = app.db.get('SELECT 1 AS x FROM local_grants WHERE player_id = ? AND reason = ?', s.pid, 'devir');
      const credited = done || app.now() - p.created_at > DEVIR_WINDOW_MS ? 0 : Math.min(jeton, DEVIR_MAX);
      app.db.run('INSERT INTO local_grants(player_id, ledger_id, jeton, credited, reason, day, at) VALUES(?, ?, ?, ?, ?, ?, ?)', s.pid, ledgerId, jeton, credited, reason, 'devir', app.now());
      app.addCurrency(s.pid, 'jeton', credited);
      return { wallet: app.walletChanged(s.pid), credited, ...gunlukSinir(app, s.pid) };
    }
    // önce dünden bekleyen (gün döndüyse), sonra bu ödül; sınırı aşan kısım kaybolmaz, bekleyen ödüle eklenir (karar 54),
    // bekleyen tavana (LOCAL_JETON_CARRY_MAX) kadar; tavanı aşan kısım eklenmez
    bekleyenAktar(app, s.pid);
    const left = Math.max(0, LOCAL_JETON_DAILY_MAX - localCreditedToday(app, s.pid));
    const credited = Math.min(jeton, left);
    const carryAdded = Math.max(0, Math.min(jeton - credited, LOCAL_JETON_CARRY_MAX - app.player(s.pid).carry_jeton));
    app.db.run('INSERT INTO local_grants(player_id, ledger_id, jeton, credited, reason, day, at, carried) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
      s.pid, ledgerId, jeton, credited, reason, dayKey(app.now()), app.now(), carryAdded);
    app.addCurrency(s.pid, 'jeton', credited);
    if (carryAdded > 0) app.db.run('UPDATE players SET carry_jeton = carry_jeton + ? WHERE id = ?', carryAdded, s.pid);
    return { wallet: app.walletChanged(s.pid), credited, carryAdded, ...gunlukSinir(app, s.pid) };
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
