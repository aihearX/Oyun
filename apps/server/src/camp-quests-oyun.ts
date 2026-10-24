/**
 * Kamp oyunları: Ton Avı (Odyometri Odası) ve Timpanogram Eşleştir (Timpanometri Kulesi). Turun tohumu sunucuda üretilir,
 * cevaplar sunucuda puanlanır (aynı tur bir kez). Günde ilk 5 tur ödüllüdür; sonrası yalnız eğlence için (dürüstçe yazılır).
 * Ton Avı bir işitme testi DEĞİLDİR.
 */
import { randomInt } from 'node:crypto';
import type { KampOdul, KgOyunGun } from '@odi/shared';
import { KAMP_OYUN, KG_KURAL, KG_ODUL, timpanoDestesi, timpanoHavuzu, timpanoPuani, timpanoTuru, tonPuani, tonTuru, type BilgiDuzeyi, type KampOyun } from '@odi/content';
import { fail, rid, type App, type Handlers } from './app';
import { bolumKilit, featureOpen, grantKampOdul, kgBump, kgDirty, kgState } from './camp-quests';
import { dayKey } from './time';

const lv = (app: App, pid: string, id: string) => app.db.get<{ level: number }>('SELECT level FROM buildings WHERE player_id = ? AND id = ?', pid, id)?.level ?? 0;
const KUR = { ton: 'Odyometri Odası’nı kur', timpano: 'Timpanometri Kulesi’ni kur' } as const;
function locked(app: App, pid: string, g: KampOyun): string | null {
  if (!featureOpen(app, pid, 'oyun')) return bolumKilit('oyun');
  if (lv(app, pid, KAMP_OYUN[g].bina) < 1) return KUR[g];
  return null;
}
const dayKind = (g: KampOyun) => `ko-odul-${g}`;
export function oyunGun(app: App, pid: string): KgOyunGun[] {
  const day = dayKey(app.now());
  return (['ton', 'timpano'] as const).map((g) => {
    const l = locked(app, pid, g);
    const played = app.dailyCount(pid, day, `ko-tur-${g}`);
    return { oyun: g, played, rewarded: app.dailyCount(pid, day, dayKind(g)), cap: KG_KURAL.oyunOdulluTur, open: !l, locked: l };
  });
}

/** Timpanogram Eşleştir: oyuncunun destesinden sıradaki n soru. Deste havuzun karıştırılmış hâlidir; bitince yeni deste
 *  kurulur ve son görülenler yeni destenin sonuna konur. Böylece havuzun çoğu görülmeden aynı soru tekrar gelmez. */
export function timpanoDagit(app: App, pid: string, duzey: BilgiDuzeyi, n: number): string[] {
  const pool = new Set(timpanoHavuzu(duzey));
  const row = app.db.get<{ deck: string; pos: number }>('SELECT deck, pos FROM ko_deck WHERE player_id = ? AND duzey = ?', pid, duzey);
  let deck: string[] = []; let pos = 0;
  if (row) {
    const raw = JSON.parse(row.deck) as string[];
    deck = raw.filter((x) => pool.has(x)); // içerik değiştiyse kalkan sorular düşer
    pos = raw.slice(0, row.pos).filter((x) => pool.has(x)).length;
  }
  const out: string[] = [];
  while (out.length < n) {
    if (pos >= deck.length) {
      const recent = [...deck.slice(Math.max(0, deck.length - n * 2)), ...out];
      deck = timpanoDestesi(duzey, randomInt(1, 2 ** 31 - 1), recent); pos = 0;
    }
    const id = deck[pos++]!;
    if (!out.includes(id)) out.push(id);
  }
  app.db.run('INSERT INTO ko_deck(player_id, duzey, deck, pos) VALUES(?, ?, ?, ?) ON CONFLICT(player_id, duzey) DO UPDATE SET deck = excluded.deck, pos = excluded.pos', pid, duzey, JSON.stringify(deck), pos);
  return out;
}

export const oyunHandlers: Handlers = {
  'koyun.start': (app, s, { oyun, duzey }) => {
    const l = locked(app, s.pid, oyun); if (l) fail('KILIT', l);
    const id = rid('ko'); const seed = randomInt(1, 2 ** 31 - 1); const now = app.now();
    // eski bitmemiş turlar (oyuncu başına en çok 20) temizlenir
    app.db.run('DELETE FROM ko_items WHERE round_id IN (SELECT id FROM ko_round WHERE player_id = ? AND done = 0 AND started_at < ?)', s.pid, now - 3_600_000);
    app.db.run('DELETE FROM ko_round WHERE player_id = ? AND done = 0 AND started_at < ?', s.pid, now - 3_600_000);
    app.db.run('INSERT INTO ko_round(id, player_id, game, seed, duzey, started_at) VALUES(?, ?, ?, ?, ?, ?)', id, s.pid, oyun, seed, duzey, now);
    const left = Math.max(0, KG_KURAL.oyunOdulluTur - app.dailyCount(s.pid, dayKey(now), dayKind(oyun)));
    if (oyun === 'timpano') {
      const items = timpanoDagit(app, s.pid, duzey, KG_KURAL.timpanoBulmaca);
      app.db.run('INSERT INTO ko_items(round_id, items) VALUES(?, ?)', id, JSON.stringify(items));
      return { round: { id, oyun, seed, duzey, rewarded: left > 0, left, items } };
    }
    return { round: { id, oyun, seed, duzey, rewarded: left > 0, left } };
  },
  'koyun.finish': (app, s, { id, answers }) => {
    const r = app.db.get<{ player_id: string; game: KampOyun; seed: number; duzey: 'genel' | 'odyoloji'; started_at: number; done: number }>('SELECT player_id, game, seed, duzey, started_at, done FROM ko_round WHERE id = ?', id);
    if (!r || r.player_id !== s.pid) return fail('YOK', 'Oyun turu bulunamadı.');
    if (r.done) fail('TEKRAR', 'Bu tur zaten bitti.');
    const now = app.now(); const el = now - r.started_at;
    if (el < KG_KURAL.oyunEnAzMs[r.game]) fail('HIZLI', 'Tur çok hızlı bitti; her denemeyi dinleyip öyle cevapla.');
    if (el > 30 * 60_000) fail('SURE', 'Bu turun süresi geçti; yeni bir tur başlat.');
    const total = r.game === 'ton' ? KG_KURAL.tonDeneme : KG_KURAL.timpanoBulmaca;
    if (answers.length !== total) fail('GECERSIZ', 'Cevap sayısı tutmuyor.');
    const items = r.game === 'timpano' ? JSON.parse(app.db.get<{ items: string }>('SELECT items FROM ko_items WHERE round_id = ?', id)?.items ?? '[]') as string[] : [];
    const score = r.game === 'ton' ? tonPuani(tonTuru(r.seed, r.duzey), answers) : timpanoPuani(timpanoTuru(r.seed, r.duzey, items), answers);
    if (!app.db.run('UPDATE ko_round SET done = 1, score = ? WHERE id = ? AND done = 0', score, id)) fail('TEKRAR', 'Bu tur zaten bitti.');
    const day = dayKey(now); app.dailyInc(s.pid, day, `ko-tur-${r.game}`);
    let reward: KampOdul = {};
    if (app.dailyCount(s.pid, day, dayKind(r.game)) < KG_KURAL.oyunOdulluTur) { app.dailyInc(s.pid, day, dayKind(r.game)); reward = grantKampOdul(app, s.pid, { ...KG_ODUL.oyunTur }, `ko:${id}`); }
    kgBump(app, s.pid, r.game, 1, `ko:${id}`);
    if (r.game === 'ton' && score >= 7) kgBump(app, s.pid, 'ton-iyi', 1, `ko-iyi:${id}`);
    kgDirty(app, s.pid);
    return { score, total, reward, state: kgState(app, s.pid), wallet: app.wallet(s.pid) };
  },
};
