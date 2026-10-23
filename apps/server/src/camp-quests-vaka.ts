/**
 * Hasta Vakaları (Odyoloji Kliniği): dürüst takvim (her İstanbul günü en çok 3 yeni hasta; bekleme salonu 6 kişi; süre baskısı
 * yok, hastalar bekler), sunucuda puanlama (aynı deneme bir kez), Vaka Defteri ve ödüller, Konsültasyon (takım akışında kart,
 * hazır seçeneklerle oy; görüş bildirene ve soran bir kez çözünce küçük ödül) ve takım kliniği haftalık hedefi.
 */
import type { KampOdul, VakaCevap, VakaKayit, VakaSonuc, VakaState } from '@odi/shared';
import { KG_KURAL, KG_ODUL, VAKALAR, konsultSecenekleri, remediesFor, vakaById, vakaKademesi, vakaPuanla, VAKA_TESTLERI, type Vaka } from '@odi/content';
import { fail, type App, type Handlers } from './app';
import { postCard, teamRoom, updateCard, cardMeta } from './chat';
import { isAdmin } from './codes';
import { bolumKilit, featureOpen, grantKampOdul, kgBump, kgDirty, setKgSummaries } from './camp-quests';
import { oyunGun } from './camp-quests-oyun';
import { dayBounds } from './events/common';
import { dayKey } from './time';

const klinikSv = (app: App, pid: string) => app.db.get<{ level: number }>("SELECT level FROM buildings WHERE player_id = ? AND id = 'revir'", pid)?.level ?? 0;
function lockedReason(app: App, pid: string): string | null {
  if (!featureOpen(app, pid, 'vaka')) return bolumKilit('vaka');
  if (klinikSv(app, pid) < 1) return 'Odyoloji Kliniği’ni kur';
  return null;
}
const queue = (app: App, pid: string) => app.db.all<{ case_id: string }>('SELECT case_id FROM kv_queue WHERE player_id = ? ORDER BY arrived_at, rowid', pid).map((r) => r.case_id);
const bookRow = (app: App, pid: string, id: string) => app.db.get<{ stars: number; plays: number; solved_at: number | null; tests: number }>('SELECT stars, plays, solved_at, tests FROM kv_book WHERE player_id = ? AND case_id = ?', pid, id);

/** bugünün hastaları gelir (gün başına bir kez; salon doluysa gelmez, ertesi gün yine denenir) */
export function vakaTopUp(app: App, pid: string): void {
  if (lockedReason(app, pid)) return;
  const day = dayKey(app.now());
  if (!app.db.run('INSERT OR IGNORE INTO kg_seen(player_id, key, at) VALUES(?, ?, ?)', pid, `vaka-gun:${day}`, app.now())) return;
  const q = new Set(queue(app, pid));
  const solved = new Set(app.db.all<{ case_id: string }>('SELECT case_id FROM kv_book WHERE player_id = ? AND stars > 0', pid).map((r) => r.case_id));
  const tier = vakaKademesi(klinikSv(app, pid));
  const room = Math.max(0, Math.min(KG_KURAL.vakaGunluk, KG_KURAL.vakaSalon - q.size));
  const next = VAKALAR.filter((v) => v.kademe <= tier && !q.has(v.id) && !solved.has(v.id)).slice(0, room);
  next.forEach((v, i) => app.db.run('INSERT OR IGNORE INTO kv_queue(player_id, case_id, arrived_at, day) VALUES(?, ?, ?, ?)', pid, v.id, app.now() + i, day));
}

export function vakaState(app: App, pid: string): VakaState {
  vakaTopUp(app, pid);
  const locked = lockedReason(app, pid); const sv = klinikSv(app, pid); const day = dayKey(app.now());
  const book: VakaKayit[] = app.db.all<{ case_id: string; stars: number; plays: number; solved_at: number | null; tests: number }>('SELECT case_id, stars, plays, solved_at, tests FROM kv_book WHERE player_id = ?', pid)
    .map((r) => ({ id: r.case_id, stars: r.stars, plays: r.plays, solvedAt: r.solved_at, tests: r.tests }));
  const waiting = queue(app, pid);
  const arrivedToday = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM kv_queue WHERE player_id = ? AND day = ?', pid, day)!.n;
  const solved = new Set(book.filter((b) => b.stars > 0).map((b) => b.id));
  const more = VAKALAR.some((v) => v.kademe <= vakaKademesi(sv) && !solved.has(v.id) && !waiting.includes(v.id));
  const konsult = app.db.all<{ msg_id: string; case_id: string; done: number }>('SELECT msg_id, case_id, done FROM kv_konsult WHERE player_id = ? AND done = 0 ORDER BY at DESC LIMIT 10', pid).map((k) => {
    const votes = [0, 0, 0]; for (const o of app.db.all<{ choice: number }>('SELECT choice FROM kv_oy WHERE msg_id = ?', k.msg_id)) if (o.choice >= 0 && o.choice < 3) votes[o.choice]!++;
    return { msgId: k.msg_id, caseId: k.case_id, votes, n: votes.reduce((a, b) => a + b, 0), done: !!k.done };
  });
  return {
    open: !locked, locked, tier: vakaKademesi(sv), klinikSv: sv, waiting, arrivedToday,
    nextArrivalAt: more && waiting.length < KG_KURAL.vakaSalon ? dayBounds(app.now()).endsAt : null,
    book, total: VAKALAR.length, konsult, konsultLeft: Math.max(0, KG_KURAL.konsultGunluk - app.dailyCount(pid, day, 'vaka-konsult')),
  };
}

/** vakanın patolojisine uygun en basit Tedavi Odası malzemesi (ilk çözümde 2+ yıldızla bir adet) */
const malzemeOf = (v: Vaka) => remediesFor(v.kat).sort((a, b) => a.level - b.level)[0]?.id;

function answer(app: App, pid: string, a: VakaCevap): VakaSonuc {
  const lock = lockedReason(app, pid); if (lock) fail('KILIT', lock);
  const prevAttempt = app.db.get<{ result: string }>('SELECT result FROM kv_attempt WHERE player_id = ? AND attempt = ?', pid, a.attempt);
  if (prevAttempt) return JSON.parse(prevAttempt.result) as VakaSonuc; // aynı deneme ikinci kez sayılmaz (ağ tekrarı)
  const v = vakaById(a.caseId); if (!v) return fail('YOK', 'Bu vaka bulunamadı.');
  const prev = bookRow(app, pid, v.id);
  const inQueue = queue(app, pid).includes(v.id);
  if (!inQueue && !(prev && prev.stars > 0)) fail('YOK', 'Bu hasta bekleme salonunda değil.');
  if (!v.tani.yanlis.includes(a.dx) && a.dx !== v.tani.dogru) fail('GECERSIZ', 'Bu vakada böyle bir tanı seçeneği yok.');
  if (!v.yonetim.some((y) => y.id === a.mg)) fail('GECERSIZ', 'Bu vakada böyle bir yönetim seçeneği yok.');
  const tests = [...new Set(a.tests)].filter((t) => VAKA_TESTLERI.some((x) => x.id === t));
  if (!tests.length) fail('GECERSIZ', 'Önce en az bir test iste.');
  const p = vakaPuanla(v, { tests, dx: a.dx, mg: a.mg });
  const prevStars = prev?.stars ?? 0; const best = Math.max(prevStars, p.stars); const newStars = best - prevStars;
  const first = prevStars === 0 && p.stars > 0;
  const now = app.now();
  app.db.run(`INSERT INTO kv_book(player_id, case_id, stars, plays, solved_at, tests) VALUES(?, ?, ?, 1, ?, ?)
    ON CONFLICT(player_id, case_id) DO UPDATE SET stars = MAX(stars, excluded.stars), plays = plays + 1, solved_at = COALESCE(solved_at, excluded.solved_at), tests = CASE WHEN excluded.stars >= stars THEN excluded.tests ELSE tests END`,
  pid, v.id, p.stars, p.stars > 0 ? now : null, tests.length);
  let reward: KampOdul = {};
  if (p.stars > 0) {
    const r: KampOdul = first
      ? { jeton: KG_ODUL.vakaTaban.jeton + KG_ODUL.vakaYildiz.jeton * p.stars, kampXp: KG_ODUL.vakaTaban.kampXp + KG_ODUL.vakaYildiz.kampXp * p.stars }
      : { jeton: KG_ODUL.vakaYildiz.jeton * newStars, kampXp: KG_ODUL.vakaYildiz.kampXp * newStars };
    const m = first && p.stars >= 2 ? malzemeOf(v) : undefined;
    if (m) { r.malzeme = m; r.malzemeN = 1; }
    if (r.jeton || r.kampXp || r.malzeme) reward = grantKampOdul(app, pid, r, `vaka:${v.id}:${best}`);
    if (first) app.db.run('DELETE FROM kv_queue WHERE player_id = ? AND case_id = ?', pid, v.id);
    kgBump(app, pid, 'vaka', 1, `vaka:${a.attempt}`);
    if (!first) kgBump(app, pid, 'vaka-tekrar', 1, `vaka-tekrar:${a.attempt}`);
    if (best === 3 && prevStars < 3) kgBump(app, pid, 'vaka-3yildiz', 1, `vaka3:${v.id}`);
    if (first) { teamWeek(app, pid); konsultDone(app, pid, v); }
  }
  const result: VakaSonuc = { caseId: v.id, stars: p.stars, best, dxOk: p.dxOk, mgOk: p.mgOk, efficient: p.efficient, first, newStars, reward, correctDx: v.tani.dogru, correctMg: v.yonetim[0].id };
  app.db.run('INSERT INTO kv_attempt(player_id, attempt, case_id, result, at) VALUES(?, ?, ?, ?, ?)', pid, a.attempt, v.id, JSON.stringify(result), now);
  kgDirty(app, pid);
  return result;
}

/** takım kliniği: ilk kez çözülen vaka takımın haftalık hedefine sayılır (yönetici hesapları sayılmaz) */
function teamWeek(app: App, pid: string): void {
  const p = app.player(pid); if (!p.team_id || isAdmin(app, pid)) return;
  app.db.run('INSERT INTO kv_team_week(team_id, week, player_id, n) VALUES(?, ?, ?, 1) ON CONFLICT(team_id, week, player_id) DO UPDATE SET n = n + 1', p.team_id, app.week().key, pid);
  for (const m of app.teamMemberIds(p.team_id)) if (m !== pid) kgDirty(app, m);
}

// ------------------------------------------------------------------ Konsültasyon
function konsult(app: App, pid: string, caseId: string): void {
  const lock = lockedReason(app, pid); if (lock) fail('KILIT', lock);
  const p = app.player(pid); if (!p.team_id) fail('TAKIM_YOK', 'Konsültasyon için bir takımda olmalısın.');
  const v = vakaById(caseId); if (!v) return fail('YOK', 'Bu vaka bulunamadı.');
  if (!queue(app, pid).includes(v.id)) fail('YOK', 'Yalnız bekleme salonundaki bir hasta için danışabilirsin.');
  if (app.teamMemberIds(p.team_id!).length < 2) fail('YALNIZ', 'Takımında henüz başka üye yok; danışacak bir arkadaş katılınca konsültasyon açılır.');
  if (app.db.get('SELECT 1 AS x FROM kv_konsult WHERE player_id = ? AND case_id = ? AND done = 0', pid, v.id)) fail('TEKRAR', 'Bu hasta için takımına zaten danıştın.');
  const day = dayKey(app.now());
  if (app.dailyCount(pid, day, 'vaka-konsult') >= KG_KURAL.konsultGunluk) fail('LIMIT', `Günde en çok ${KG_KURAL.konsultGunluk} konsültasyon isteyebilirsin.`);
  app.dailyInc(pid, day, 'vaka-konsult');
  const opts = konsultSecenekleri(v);
  const meta: Record<string, string | number | boolean> = { type: 'konsultasyon', pid, pname: p.name, pc: p.color, ph: p.hat, vaka: v.id, baslik: v.baslik, hasta: `${v.hasta.ad} · ${v.hasta.yas}`, oyku: v.oyku, n: 0, done: false };
  opts.forEach((o, i) => { meta[`c${i}`] = o.id; meta[`l${i}`] = o.sade; meta[`v${i}`] = 0; });
  const msg = postCard(app, teamRoom(p.team_id), { kind: 'feed', text: `${p.name}, “${v.baslik}” vakası için takımına danışıyor. Sence tanı ne olabilir?`, meta });
  app.db.run('INSERT INTO kv_konsult(msg_id, team_id, player_id, case_id, day, at) VALUES(?, ?, ?, ?, ?, ?)', msg.id, p.team_id, pid, v.id, day, app.now());
  kgBump(app, pid, 'konsult', 1, `ks:${msg.id}`);
}
function oy(app: App, pid: string, msgId: string, choice: number): KampOdul {
  const k = app.db.get<{ team_id: string; player_id: string; case_id: string; done: number }>('SELECT team_id, player_id, case_id, done FROM kv_konsult WHERE msg_id = ?', msgId);
  if (!k) return fail('YOK', 'Konsültasyon bulunamadı.');
  const p = app.player(pid);
  if (p.team_id !== k.team_id) fail('YOK', 'Bu konsültasyon takımında değil.');
  if (k.player_id === pid) fail('GECERSIZ', 'Kendi vakana oy veremezsin; takım arkadaşların görüş bildirir.');
  if (k.done) fail('BITTI', 'Bu vaka çözüldü; konsültasyon kapandı.');
  if (choice < 0 || choice > 2) fail('GECERSIZ', 'Geçersiz seçenek.');
  if (!app.db.run('INSERT OR IGNORE INTO kv_oy(msg_id, player_id, choice, at) VALUES(?, ?, ?, ?)', msgId, pid, choice, app.now())) fail('TEKRAR', 'Bu konsültasyona zaten görüş bildirdin.');
  const votes = [0, 0, 0]; for (const o of app.db.all<{ choice: number }>('SELECT choice FROM kv_oy WHERE msg_id = ?', msgId)) votes[o.choice]!++;
  updateCard(app, msgId, null, { v0: votes[0]!, v1: votes[1]!, v2: votes[2]!, n: votes[0]! + votes[1]! + votes[2]! });
  kgBump(app, pid, 'konsult', 1, `oy:${msgId}`);
  const day = dayKey(app.now()); let reward: KampOdul = {};
  if (app.dailyCount(pid, day, 'vaka-oy') < KG_KURAL.konsultOyOdullu) { app.dailyInc(pid, day, 'vaka-oy'); reward = grantKampOdul(app, pid, { ...KG_ODUL.konsultOy }, `oy:${msgId}`); }
  app.emit(k.player_id, 'vaka.updated', { vaka: vakaState(app, k.player_id) });
  return reward;
}
/** soran vakayı çözdü: konsültasyon kapanır, kartta doğru cevap görünür; en az bir görüş geldiyse sorana bir kez ödül */
function konsultDone(app: App, pid: string, v: Vaka): void {
  for (const k of app.db.all<{ msg_id: string; rewarded: number }>('SELECT msg_id, rewarded FROM kv_konsult WHERE player_id = ? AND case_id = ? AND done = 0', pid, v.id)) {
    app.db.run('UPDATE kv_konsult SET done = 1 WHERE msg_id = ?', k.msg_id);
    const meta = cardMeta(app, k.msg_id);
    const ans = [0, 1, 2].find((i) => meta?.[`c${i}`] === v.tani.dogru) ?? -1;
    updateCard(app, k.msg_id, null, { done: true, ans });
    const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM kv_oy WHERE msg_id = ?', k.msg_id)!.n;
    if (n > 0 && app.db.run('UPDATE kv_konsult SET rewarded = 1 WHERE msg_id = ? AND rewarded = 0', k.msg_id)) grantKampOdul(app, pid, { ...KG_ODUL.konsultSoran }, `ks:${k.msg_id}`);
  }
}

export const vakaHandlers: Handlers = {
  'vaka.state': (app, s) => ({ vaka: vakaState(app, s.pid) }),
  'vaka.answer': (app, s, d) => { const result = answer(app, s.pid, d); return { vaka: vakaState(app, s.pid), result, wallet: app.wallet(s.pid) }; },
  'vaka.konsult': (app, s, { caseId }) => { konsult(app, s.pid, caseId); return { vaka: vakaState(app, s.pid) }; },
  'vaka.oy': (app, s, { msgId, choice }) => { const reward = oy(app, s.pid, msgId, choice); return { reward, wallet: app.wallet(s.pid) }; },
};

// kg.state özetleri (döngüsel içe aktarma olmadan)
setKgSummaries(
  (app, pid) => { vakaTopUp(app, pid); const locked = lockedReason(app, pid); return { open: !locked, waiting: locked ? 0 : queue(app, pid).length, locked }; },
  (app, pid) => oyunGun(app, pid),
);
