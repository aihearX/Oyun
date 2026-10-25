#!/usr/bin/env node
// Kamp ekonomisi ölçümü (MK-001; sonuç: docs/yonetim/ekonomi-olcum.md). Oyun kodunu değiştirmez; formülleri paketlerden derleyip okur.
// Kullanım:
//   node tools/ekonomi/simule.mjs                       → 14 günlük simülasyon, altı profil; tablolar stdout'a (deterministik)
//   node tools/ekonomi/simule.mjs --belge               → aynı tabloları docs/yonetim/ekonomi-olcum.md içine (işaretler arasına) yazar
//   node tools/ekonomi/simule.mjs --json                → ham gün gün sonuçlar (JSON)
//   node tools/ekonomi/simule.mjs --olc [--k 16] [--parallel 3]
//        insan modeliyle (game-core play/testkit `playHumanStars`) her bölümün süresini, notasını, yıldızını ölçer →
//        tools/ekonomi/insan-olcum.json (1-12: ilk kez oynayan kademe, 13-40: oyuncu kitlesi; docs/12 §2 ile aynı ayrım).
//        Bitirme oranları bu dosyadan değil, docs/12 §6 tablolarından (48 oyuncu) okunur.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const root = resolve(new URL('../..', import.meta.url).pathname);
const OLCUM = resolve(root, opt('olcum', 'tools/ekonomi/insan-olcum.json'));
const BELGE = resolve(root, 'docs/yonetim/ekonomi-olcum.md');

/** paketlerden küçük bir modül derleyip yükle (geçici dosya; her çalıştırmada taze) */
async function bundled(contents, name) {
  const f = resolve(tmpdir(), `odi-ekonomi-${name}-${process.pid}.mjs`);
  await build({ stdin: { contents, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: f, logLevel: 'error' });
  try { return await import(f); } finally { rmSync(f, { force: true }); }
}

// =====================================================================================================================
// 1) İnsan modeli ölçümü (--olc) ve işçi (--isci)
// =====================================================================================================================
const ISCI_KOD = `
export { playHumanStars } from './packages/game-core/src/play/testkit';
export { firstTimerOf } from './packages/game-core/src/play/human';
`;
if (flag('isci')) {
  const file = opt('isci'); const K = Number(opt('k', 16));
  const m = await import(file);
  const levels = argv.filter((a, i) => /^\d+$/.test(a) && argv[i - 1] !== '--k');
  for (const s of levels) {
    const n = Number(s); const runs = [];
    for (let k = 0; k < K; k++) {
      // 1-12 ilk kez oynayan kademe (docs/12 §2, firstTimerOf), 13-40 oyuncu kitlesi (playerOf, varsayılan)
      const r = m.playHumanStars(n, { k, ...(n <= 12 ? { params: m.firstTimerOf(k) } : {}) });
      runs.push({ fin: r.finished ? 1 : 0, t: Math.round(r.t * 10) / 10, coins: r.coins, stars: r.stars, dmg: r.damage });
    }
    const r0 = m.playHumanStars(n, { k: 0 });
    console.log(JSON.stringify({ n, coinsTotal: r0.spec.coinsTotal, parTimeSec: r0.spec.parTimeSec, objective: r0.spec.objective.id, runs }));
  }
  process.exit(0);
}
if (flag('olc')) {
  const K = Number(opt('k', 16)); const parallel = Number(opt('parallel', 3));
  const file = resolve(tmpdir(), `odi-ekonomi-isci-${process.pid}.mjs`);
  await build({ stdin: { contents: ISCI_KOD, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: file, logLevel: 'error' });
  const queue = Array.from({ length: 40 }, (_, i) => 40 - i); // uzun (geç) bölümler önce
  const out = []; let done = 0;
  const one = (n) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [new URL(import.meta.url).pathname, '--isci', file, String(n), '--k', String(K)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = ''; p.stdout.on('data', (d) => { buf += d; });
    p.on('exit', (c) => { if (c !== 0) return rej(new Error(`işçi ${c}`)); for (const l of buf.split('\n')) if (l.trim()) out.push(JSON.parse(l)); res(); });
  });
  await Promise.all(Array.from({ length: parallel }, async () => { while (queue.length) { await one(queue.shift()); done++; process.stdout.write(`\r${done}/40`); } }));
  rmSync(file, { force: true });
  out.sort((a, b) => a.n - b.n);
  writeFileSync(OLCUM, JSON.stringify({ k: K, kaynak: 'tools/ekonomi/simule.mjs --olc (game-core play/testkit playHumanStars; 1-12 firstTimerOf, 13-40 playerOf)', bolumler: out }) + '\n');
  console.log(`\n→ ${OLCUM}`);
  process.exit(0);
}

// =====================================================================================================================
// 2) Formüller: paketlerden ve sunucu kaynağından derlenir (kopya yok). Belgedeki dosya:satır başvuruları bunlardır.
// =====================================================================================================================
const FORMUL_KOD = `
export { buildCost, BUILDINGS, helpReductionSec, crystalsToFinish, CAMP_POWER_LEVEL, SOCIAL_LIMITS, xpForRun, FRIEND_LIMITS, COMM_RULES, RALLY_MONSTERS, RALLY_RULES } from '@odi/shared';
export { CAMP_XP, campXpState, campLevelRewards, decorSlots, kabinXpPct, depotCapHours, taramaFactor, buildingOpen, remedyInvCap, remedyById, remedyShelf,
  KG_KURAL, KG_ODUL, KG_HIKAYE, KG_HAFTA, KG_HAFTA_ODUL, KG_BASARI, KG_ACILIS, VAKALAR, vakaKademesi, PATHOLOGY_IDS,
  CALENDAR, DAILY_CHEST_BASE, TREASURES, LUCKY_NOTE, DUPLICATE_VALUE, MAX_STREAK_SHIELDS, ACHIEVEMENTS, TIER_REWARD, SKILL_TREE,
  HUMAN_JOURNEY, MONUMENT_DECOR, CARDS, DISTRICTS, questById } from '@odi/content';
export { rollDailyQuests } from '@odi/meta';
export { FEATURES } from './apps/web/src/ftue/features';
export { MAX_COINS, LAB_PCT_PER_LEVEL } from './apps/server/src/progress';
export { DEPOT_PER_LEVEL_HOUR, CAMP_HELP_REWARD, CAMP_HELP_REWARD_DAILY, SPEEDUP_SEC } from './apps/server/src/camp';
export { LOCAL_JETON_DAILY_MAX } from './apps/server/src/wallet';
export { START_JETON } from './apps/server/src/players';
export { HELP_GIVE_JETON } from './apps/server/src/teams';
export { TEAM_GOALS } from './apps/server/src/teamextra';
export { RAID_GIFT } from './apps/server/src/raid';
export { QUEST_REWARD } from './apps/server/src/events/quests';
export { huntTierReward } from './apps/server/src/events/hunt';
export { DUEL_REWARDS } from './apps/server/src/events/duel';
export { QUIZ_REWARDS } from './apps/server/src/events/quiz';
export { RELAY_REWARDS } from './apps/server/src/events/relay';
`;
// sunucu modülleri node:sqlite'ı yükler; deneysel özellik uyarısı çıktıyı kirletmesin
process.removeAllListeners('warning');
const F = await bundled(FORMUL_KOD, 'formul');

// =====================================================================================================================
// 3) Varsayımlar (belgede §2; hepsi burada, tek yerde)
// =====================================================================================================================
const V = {
  baslangic: '2026-11-02',          // Pazartesi (ISO haftası başı; haftalık ödüller hafta içi konumuna bağlı)
  gun: 14,
  oturumBolumSn: 8 * 60,            // oturum başına bölüm oynama süresi (oyun saati)
  denemeEkSn: 20,                   // her deneme için bölüm kartı + sonuç ekranı + harita
  oturumSn: 10 * 60,                // oturumun toplam süresi (kamp işleri dahil); bölümden sonraki kamp işleri bu anda
  vakaYildizSira: [3, 2, 1],        // vakaların ilk çözüm yıldızı sırayla 3, 2, 1 (ortalama 2★; üçte biri 3★)
  oyunTurOturum: 1,                 // her oturumda her kamp oyunundan 1 ödüllü tur (günlük sınır 5)
  malzemeKullanOturum: 1,           // her oturumda bir malzeme bölümde kullanılır (çantada varsa)
  kampGorevGunluk: 3,               // günlük kamp görevlerinin üçü de (bir değiştirme hakkıyla) yapılır
  haftaHedefi: 'h-gunluk',          // haftalık kamp hedefi (sunucu oyuncu+hafta özetiyle seçer; ölçümde bu)
  takim: {
    uye: 10, gunlukGorev: 2,        // günlük takım görevlerinden takımca biten (3'ten)
    avKademe: 6,                    // Ses Avı döneminde ulaşılan kademe (8'den; final sandığı yok)
    hedefKademe: { yildiz: 2, bolum: 2, baskin: 1 },
    duello: ['kazandi', 'kaybetti'],// haftanın iki düellosu
    baskinYenildi: true, bayrakBitti: true, bolgeSahibi: 0,
    ralli: { 1: 0, 3: 1, 6: 2 },    // gün başına katılınan ve kazanılan ralli (oturum sayısına göre)
    quiz: { 1: 0, 3: 1, 6: 2 },     // gün başına katılınan bilgi yarışması (13:00 / 20:00)
    quizDogru: 7, dqDogruOran: 0.7,
    yardimOturum: 3,                // oturum başına takım arkadaşının inşaatına yardım
    aldigiYardim: 5,                // kendi inşaatına gelen yardım (en çok helpMax = 5)
    konsultOyOturum: 1, konsultSorGun: 1,
    arkadas: 3,                     // günde karşılıklı hediyeleşilen arkadaş
    alkisVer: 1, alkisAl: 1, bolumYardimGun: 1, tekno: 0,
  },
};
const PROFILLER = [
  { id: '1T', oturum: [19 * 60], takim: false },
  { id: '3T', oturum: [8 * 60, 13 * 60, 20 * 60], takim: false },
  { id: '6T', oturum: [8 * 60, 11 * 60, 14 * 60, 17 * 60, 20 * 60, 22 * 60 + 30], takim: false },
  { id: '1S', oturum: [19 * 60], takim: true },
  { id: '3S', oturum: [8 * 60, 13 * 60, 20 * 60], takim: true },
  { id: '6S', oturum: [8 * 60, 11 * 60, 14 * 60, 17 * 60, 20 * 60, 22 * 60 + 30], takim: true },
].map((p) => ({ ...p, ad: `${p.oturum.length} oturum, ${p.takim ? 'takımlı' : 'takımsız'}` }));

// =====================================================================================================================
// 4) Bölüm verisi: bitirme oranı docs/12 §6 (48 oyuncu), süre/nota/yıldız insan modeli ölçümü (insan-olcum.json)
// =====================================================================================================================
function docs12Oranlari() {
  const md = readFileSync(resolve(root, 'docs/12-zorluk-egrisi.md'), 'utf8');
  const tablo = (a, b, col) => {
    const part = md.slice(md.indexOf(a), md.indexOf(b)); const out = {};
    for (const line of part.split('\n')) {
      const c = line.split('|').map((x) => x.trim());
      if (c.length > col && /^\d+$/.test(c[1] ?? '')) out[Number(c[1])] = Number(String(c[col]).replace('%', '')) / 100;
    }
    return out;
  };
  // ilk kez oynayan (1-12): | Bölüm | Hedef | Önce: bitirme | Önce: can | Sonra: bitirme |  ·  kitle (40): | Bölüm | Bölge | Rol | Hedef | Önce ×3 | Sonra: bitirme |
  return { ilk: tablo('<!-- ilk:basla -->', '<!-- ilk:bitir -->', 5), kitle: tablo('<!-- tablo:basla -->', '<!-- tablo:bitir -->', 8) };
}
if (!existsSync(OLCUM)) { console.error(`Ölçüm yok: önce  node tools/ekonomi/simule.mjs --olc`); process.exit(1); }
const OLC = JSON.parse(readFileSync(OLCUM, 'utf8'));
const D12 = docs12Oranlari();
const mean = (xs, d = 0) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : d);
const LV = {};
for (const b of OLC.bolumler) {
  const p = Math.max(1 / 48, b.n <= 12 ? D12.ilk[b.n] : D12.kitle[b.n]);
  const fin = b.runs.filter((r) => r.fin); const fail = b.runs.filter((r) => !r.fin);
  const tc = mean(fin.map((r) => r.t), mean(b.runs.map((r) => r.t))); const tf = mean(fail.map((r) => r.t), tc);
  const cc = mean(fin.map((r) => r.coins), mean(b.runs.map((r) => r.coins))); const cf = mean(fail.map((r) => r.coins), cc);
  const frac = (f) => (fin.length ? fin.filter(f).length / fin.length : 0);
  const att = 1 / p; const ek = V.denemeEkSn;
  LV[b.n] = {
    n: b.n, p, att, tc, tf, cc, cf, coinsTotal: b.coinsTotal, objective: b.objective, olcBitirme: fin.length / b.runs.length,
    sure: (att - 1) * (tf + ek) + (tc + ek), nota: (att - 1) * cf + cc,
    yildiz: fin.length ? mean(fin.map((r) => r.stars)) : 1, p2: frac((r) => r.stars >= 2), p3: frac((r) => r.stars === 3),
    pHasarsiz: frac((r) => r.dmg === 0), pPar: frac((r) => r.t < b.parTimeSec),
    sansli: b.coinsTotal > 0 ? F.LUCKY_NOTE.chance * Math.min(1, mean(b.runs.map((r) => r.coins)) / b.coinsTotal) : 0,
    biome: F.HUMAN_JOURNEY.levels[b.n - 1].biome,
  };
}

// =====================================================================================================================
// 5) Simülasyon: bir profil, 14 gün. Zaman birimi dakika (gün 0 = başlangıç Pazartesi 00:00, İstanbul).
// =====================================================================================================================
const GUN = 1440;
const B_IDS = F.BUILDINGS.map((b) => b.id);
const bDef = (id) => F.BUILDINGS.find((b) => b.id === id);
const opened = (f) => F.FEATURES.find((x) => x.id === f).at;            // apps/web/src/ftue/features.ts: bölüm geçilince açılır
const dayStr = (d) => { const t = new Date(`${V.baslangic}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/** H: öneri denemesi kancaları (yalnız simülasyonda; oyun kodu değişmez) — §6 */
function simule(P, H = {}) {
  const T = V.takim; const nOt = P.oturum.length;
  const s = {
    lv: 1, spent: 0, replay: 0, cleared: 0,
    jeton: F.START_JETON, kristal: 0, boost: { m5: 0, m60: 0, s8: 0 },
    L: Object.fromEntries(B_IDS.map((id) => [id, id === 'merkez' ? 1 : 0])), q: null,
    depotAt: 0, xp: 0, kampSv: 1, decorInv: new Set(), decorPlaced: new Set(), placedN: 0,
    remedy: { since: 0, item: null, inv: 0 },
    team: false, teamAt: null, skills: new Set(),
    // meta (istemci) sayaçları
    m: { clears: 0, stars: 0, coins: 0, plays: 0, quests: 0, chests: 0, calendar: 0, maxStreak: 0, days: 0, highest: 1, xp: 0, threeStars: 0, noDamage: 0, underPar: 0, bosses: 0, skills: 0, shieldsEarned: 0 },
    biomeStars: {}, ach: {}, shields: 0, cosmetics: new Set(), cards: new Set(), streak: 0,
    // kamp görevleri sayaçları
    k: { 'depo-topla': 0, malzeme: 0, 'malzeme-kullan': 0, insaat: 0, yardim: 0, vaka: 0, ton: 0, timpano: 0, konsult: 0, 'dekor-yerlestir': 0, ziyaret: 0, gunluk: 0, 'vaka-3yildiz': 0 },
    hikaye: 0, kgAch: {}, vakaQ: [], vakaBook: new Map(), vakaGun: null, hafta: {}, takimKlinikHafta: {},
  };
  const gunler = []; let G; // o günün satırı
  const yeniGun = (d) => {
    G = { gun: d + 1, gelir: { bolum: 0, yerel: 0, depo: 0, kamp: 0, takim: 0 }, kristal: 0, harcama: { bina: 0, yetenek: 0 }, insaat: [], denemeler: 0,
      yeniBolum: 0, vaka: 0, hikaye: [], acilan: [], saat: { dolu: 0, jetonYok: 0, cevrimdisi: 0 }, yerelKirpilan: 0, oturumDuvar: 0, oturumKamp: 0 };
    gunler.push(G);
  };
  const kampAcik = () => s.cleared >= opened('camp');
  const ac = (f) => s.cleared >= (f in F.KG_ACILIS ? F.KG_ACILIS[f] : opened(f));

  // ---------------------------------------------------------------- yerel ödüller (istemci → wallet.local, günlük sınır LOCAL_JETON_DAILY_MAX)
  let yerelBugun = 0;
  const YEREL = H.yerelSinir ?? F.LOCAL_JETON_DAILY_MAX;
  /** inşaat sırası (Ö3, MK-011; camp.ts `camp.queue`): bugünkü kural; `H.sira: false` eski kuralı (tek inşaat, sıra yok) kurar */
  const SIRA = H.sira ?? true;
  const yerel = (j) => { const c = Math.min(j, YEREL - yerelBugun); yerelBugun += c; s.jeton += c; G.gelir.yerel += c; G.yerelKirpilan += j - c; };
  /** meta ödülü (applyGrant + resolveReward kuralı): kopya kozmetik/kart ve taşan koruyucu jetona döner */
  const metaOdul = (items) => {
    let j = 0;
    for (const it of items) {
      if (it.kind === 'jeton') j += it.amount;
      else if (it.kind === 'xp') s.m.xp += it.amount;
      else if (it.kind === 'kozmetik') { if (s.cosmetics.has(it.ref)) j += F.DUPLICATE_VALUE.kozmetik; else s.cosmetics.add(it.ref); }
      else if (it.kind === 'kart') { if (s.cards.has(it.ref)) j += F.DUPLICATE_VALUE.kart; else s.cards.add(it.ref); }
      else if (it.kind === 'koruyucu') { const take = Math.min(it.amount, F.MAX_STREAK_SHIELDS - s.shields); s.shields += take; s.m.shieldsEarned += take; j += (it.amount - take) * F.DUPLICATE_VALUE.koruyucu; }
    }
    if (j) yerel(j);
  };
  const metaBasarim = () => {
    const met = { ...s.m }; for (const [b, v] of Object.entries(s.biomeStars)) met[`biomeStars:${b}`] = v;
    for (const a of F.ACHIEVEMENTS) {
      const v = met[a.metric]; if (v == null) continue; // ölçülmeyen ölçüt (ör. gizli koklea, kombo): alt sınır
      let t = 0; a.tiers.forEach((need, i) => { if (v >= need) t = i + 1; });
      for (let k = (s.ach[a.id] ?? 0) + 1; k <= t; k++) metaOdul(F.TIER_REWARD[k]);
      s.ach[a.id] = Math.max(s.ach[a.id] ?? 0, t);
    }
  };

  // ---------------------------------------------------------------- Kamp XP ve seviye (camp-xp.ts grantCampXp)
  const kampXp = (base) => {
    const gain = Math.round(Math.floor(base) * (1 + F.kabinXpPct(s.L.kabin) / 100)); s.xp += gain;
    const lv = F.campXpState(s.xp).level;
    for (let l = s.kampSv + 1; l <= lv; l++) {
      for (const r of F.campLevelRewards(l)) {
        if (r.kind === 'sus') s.decorInv.add(r.id);
        if (r.kind === 'arazi') G.acilan.push(`Kamp Sv ${l}: ${F.DISTRICTS.find((x) => x.id === r.district).name}`);
      }
      if (!F.campLevelRewards(l).some((r) => r.kind === 'arazi')) G.acilan.push(`Kamp Sv ${l}`);
    }
    s.kampSv = lv;
  };
  // kamp görevi ödülü (camp-quests.ts grantKampOdul)
  const kgOdul = (o) => {
    if (o.jeton) { s.jeton += o.jeton; G.gelir.kamp += o.jeton; }
    if (o.kristal) { s.kristal += o.kristal; G.kristal += o.kristal; }
    if (o.kampXp) kampXp(o.kampXp);
    if (o.m5) s.boost.m5 += o.m5; if (o.m60) s.boost.m60 += o.m60;
    if (o.dekor) s.decorInv.add(o.dekor);
    if (o.malzeme) s.remedy.inv += o.malzemeN ?? 1;
  };
  const takimOdul = (items, n = 1) => { for (const it of items) { if (it.kind === 'jeton') { s.jeton += it.amount * n; G.gelir.takim += it.amount * n; } if (it.kind === 'kristal') { s.kristal += it.amount * n; G.kristal += it.amount * n; } } };

  // ---------------------------------------------------------------- inşaat
  const adaylar = () => F.BUILDINGS.filter((b) => {
    if (b.id === s.q?.id || b.id === s.qNext?.id) return false; // süren ve sıradaki bina (camp.ts: aynı anda tek inşaat + tek sıra yeri)
    const to = s.L[b.id] + 1; if (to > b.maxLevel) return false;
    if (b.campLevel && !F.buildingOpen(b.id, s.kampSv)) return false;
    // Merkez sınırı: sıraya alırken süren Merkez inşaatı bittikten sonraki seviyeye göre (camp.ts queueTarget)
    const merkez = SIRA && s.q?.id === 'merkez' ? s.q.to : s.L.merkez;
    return b.id === 'merkez' || to <= merkez;
  }).map((b) => ({ id: b.id, to: s.L[b.id] + 1, ...F.buildCost(b.id, s.L[b.id] + 1) }));
  /**
   * inşaat sırası: önce hikâyenin şu anki bölümünün bina adımı (gerekirse Merkez), sonra ucuzdan pahalıya. Oyuncu bu sıradaki
   * İLK KARŞILANABİLİR inşaatı başlatır (hikâye adımı için biriktirmez). siradaki() = en ucuz aday (duvar ve taşkın ölçüsü).
   */
  const sira = () => {
    const c = adaylar().sort((a, b) => a.jeton - b.jeton || B_IDS.indexOf(a.id) - B_IDS.indexOf(b.id));
    const ch = F.KG_HIKAYE[s.hikaye]; const once = [];
    if (ch && ac('gorev')) for (const st of ch.steps) {
      if (!st.olcut.startsWith('bina:') || s.L[st.olcut.slice(5)] >= st.need) continue;
      const id = st.olcut.slice(5); const hit = c.find((x) => x.id === id) ?? c.find((x) => x.id === 'merkez');
      if (hit && !once.includes(hit)) once.push(hit);
    }
    return [...once, ...c.filter((x) => !once.includes(x))];
  };
  const siradaki = () => adaylar().sort((a, b) => a.jeton - b.jeton || B_IDS.indexOf(a.id) - B_IDS.indexOf(b.id))[0] ?? null;
  const bitir = (t) => {
    while (s.q && s.q.ends <= t) {
      const { id, to, ends } = s.q; s.L[id] = to; s.q = null;
      if (id === 'depo' && to === 1) s.depotAt = ends;
      if (id === 'tedavi' && to === 1) s.remedy.since = ends;
      kampXp(F.CAMP_XP.build(id, to));
      // sıradaki inşaat öncekinin bittiği anda kendiliğinden başlar (camp.ts startQueued); "inşaat başlat" görevi başlayınca sayılır
      if (s.qNext) { s.q = { id: s.qNext.id, to: s.qNext.to, ends: ends + s.qNext.sec / 60 }; s.qNext = null; s.k.insaat++; }
    }
  };
  const hizlandir = (t) => {
    if (!s.q) return;
    for (const k of ['s8', 'm60', 'm5']) while (s.boost[k] > 0 && s.q && (s.q.ends - t) * 60 >= F.SPEEDUP_SEC[k]) { s.boost[k]--; s.q.ends -= F.SPEEDUP_SEC[k] / 60; bitir(t); }
  };
  /** süre: takım teknolojisi; takım yardımı yalnız süren inşaata (sıradaki, oyuncu yokken başladığı için yardım istenmemiş sayılır) */
  const sureOf = (c, yardim = true) => {
    let sec = Math.max(1, Math.round(c.seconds * (1 - (s.team ? T.tekno * 2 : 0) / 100)));
    if (s.team && yardim) for (let i = 0; i < Math.min(T.aldigiYardim, F.SOCIAL_LIMITS.helpMax); i++) sec -= Math.min(sec, F.helpReductionSec(sec));
    return sec;
  };
  const insaEt = (t) => {
    bitir(t);
    if (s.q) {
      hizlandir(t);
      if (SIRA && s.q && !s.qNext) { // bir inşaat sıraya alınır (parası şimdi ödenir; hızlandırıcı ve yardım yalnız süren inşaata)
        const c = sira().find((x) => x.id !== s.q.id && x.jeton <= s.jeton);
        if (c) { s.jeton -= c.jeton; G.harcama.bina += c.jeton; s.qNext = { id: c.id, to: c.to, sec: sureOf(c, false) }; G.insaat.push(`${bDef(c.id).short ?? c.id} ${c.to}`); }
      }
      return;
    }
    const liste = sira(); if (!liste.length) return;
    const c = liste.find((x) => x.jeton <= s.jeton);
    if (!c) { G.duvarAn = true; return; }
    s.jeton -= c.jeton; G.harcama.bina += c.jeton; s.k.insaat++;
    s.q = { id: c.id, to: c.to, ends: t + sureOf(c) / 60 };
    G.insaat.push(`${bDef(c.id).short ?? c.id} ${c.to}`);
    bitir(t); hizlandir(t);
    if (SIRA) insaEt(t);
  };
  const yetenekAl = () => {
    if (!ac('skills')) return;
    for (;;) {
      const nx = siradaki(); const yedek = nx?.jeton ?? 0;
      const sk = F.SKILL_TREE.filter((n) => !s.skills.has(n.id) && (!n.requires || s.skills.has(n.requires))).sort((a, b) => a.cost - b.cost)[0];
      if (!sk || s.jeton - sk.cost < yedek) return;
      s.jeton -= sk.cost; G.harcama.yetenek += sk.cost; s.skills.add(sk.id); s.m.skills++;
    }
  };

  // ---------------------------------------------------------------- bölüm oynama (beklenen değer yürüyüşü)
  let gunSayac = null;
  const bolumOyna = (butce) => {
    const mul = 1 + (Math.min(F.CAMP_POWER_LEVEL, s.L.laboratuvar) * F.LAB_PCT_PER_LEVEL + (s.team ? T.tekno * 3 : 0)) / 100; // progress.ts
    while (butce > 1e-9) {
      const tekrar = s.lv > 40; const n = tekrar ? (s.replay % 40) + 1 : s.lv; const d = LV[n];
      const kalan = d.sure - s.spent; const dt = Math.min(butce, kalan); const oran = dt / d.sure;
      const nota = d.nota * oran; const den = d.att * oran;
      s.jeton += Math.min(nota, F.MAX_COINS * den) * mul; G.gelir.bolum += Math.min(nota, F.MAX_COINS * den) * mul;
      s.m.coins += nota; s.m.plays += den; G.denemeler += den; gunSayac.plays += den; gunSayac.coins += nota;
      s.m.xp += ((d.att - 1) * 5) * oran;                                   // xpForRun: bitiremeyen 5
      const sansli = d.sansli * den; if (sansli) metaOdul(F.LUCKY_NOTE.reward.map((r) => ({ ...r, amount: r.amount * sansli })));
      butce -= dt; s.spent += dt;
      if (s.spent >= d.sure - 1e-9) {
        s.spent = 0; s.m.clears++; gunSayac.clears++;
        s.m.xp += F.xpForRun({ completed: true, stars: Math.round(d.yildiz), secretFound: false });
        gunSayac.clears2 += d.p2; gunSayac.threeStar += d.p3; gunSayac.noDamage += d.pHasarsiz; gunSayac.underPar += d.pPar;
        if (tekrar) { s.replay++; gunSayac.replay++; continue; }
        s.m.stars += d.yildiz; s.m.threeStars += d.p3; s.m.noDamage += d.pHasarsiz; s.m.underPar += d.pPar;
        s.biomeStars[d.biome] = (s.biomeStars[d.biome] ?? 0) + d.yildiz;
        if (d.objective === 'boss') s.m.bosses++;
        const tr = F.TREASURES.find((x) => x.level === n); if (tr) metaOdul(tr.reward);
        s.lv++; s.cleared = s.lv - 1; s.m.highest = Math.min(40, s.lv); G.yeniBolum++;
        for (const f of F.FEATURES) if (f.at === s.cleared && ['camp', 'team', 'gorev', 'kampoyun', 'vaka', 'skills', 'today'].includes(f.id)) G.acilan.push(`${f.name} (bölüm ${f.at})`);
      }
    }
  };

  // ---------------------------------------------------------------- günlük görevler, sandık, takvim (istemci; @odi/meta)
  let gorevler = []; let sandik = false;
  const gorevKontrol = () => {
    if (!ac('today')) return;
    for (const g of gorevler) {
      if (g.claimed) continue;
      const v = { plays: gunSayac.plays, clears: gunSayac.clears, clears2: gunSayac.clears2, threeStar: gunSayac.threeStar, coins: gunSayac.coins, noDamage: gunSayac.noDamage, underPar: gunSayac.underPar, replay: gunSayac.replay, combo10: 0, share: 0 }[g.def.metric];
      if (v >= g.def.target) { g.claimed = true; s.m.quests++; metaOdul(g.def.reward); }
    }
    if (!sandik && gorevler.every((g) => g.claimed)) {
      sandik = true; s.m.chests++;
      // sandık kartı: ulaşılan biyomlardan sıradaki eksik "sandık" kartı (meta/unlocks.ts nextChestCard), yoksa 30 jeton
      const ulasilan = new Set(F.HUMAN_JOURNEY.levels.filter((l) => l.number <= s.m.highest).map((l) => l.biome));
      const kart = F.CARDS.find((c) => c.slot === 'sandik' && ulasilan.has(c.biome) && !s.cards.has(c.id));
      metaOdul([...F.DAILY_CHEST_BASE, kart ? { kind: 'kart', amount: 1, ref: kart.id } : { kind: 'jeton', amount: 30 }]);
    }
  };
  let takvimAlindi = false;
  const takvim = () => {
    if (!ac('today') || takvimAlindi) return;
    takvimAlindi = true; s.m.calendar++;
    metaOdul(F.CALENDAR[(Math.max(1, s.streak) - 1) % 7].reward);
  };

  // ---------------------------------------------------------------- kamp işleri (oturum başı)
  const bolgeler = () => new Set(F.HUMAN_JOURNEY.levels.slice(0, Math.min(40, s.cleared + 1)).map((l) => l.biome));
  const anitlar = new Set();
  let oyunBugun = { ton: 0, timpano: 0 }; let konsultOyBugun = 0; let yardimBugun = 0;
  const kampIsleri = (t, d) => {
    bitir(t);
    for (const r of bolgeler()) if (!anitlar.has(r)) { anitlar.add(r); kampXp(F.CAMP_XP.monument); const md = F.MONUMENT_DECOR[r]; if (md) s.decorInv.add(md.id); }
    // depo (camp.ts camp.collect)
    if (s.L.depo > 0) {
      const rate = s.L.depo * F.DEPOT_PER_LEVEL_HOUR; const capMin = (H.depoSaat ? H.depoSaat(s.L.denge) : F.depotCapHours(s.L.denge)) * 60; const el = Math.max(0, t - s.depotAt);
      const c = Math.floor((Math.min(el, capMin) / 60) * rate);
      s.depotAt = el >= capMin ? t : s.depotAt + Math.round((c / rate) * 60);
      if (c > 0) { s.jeton += c; G.gelir.depo += c; s.k['depo-topla']++; kampXp(Math.min(F.CAMP_XP.depotMax, Math.floor(c / F.CAMP_XP.depotPer))); }
    }
    // Tedavi Odası (camp.ts collectRemedies): kulak tıkacı hazırlanır, raf toplanır, bir adet bölümde kullanılır
    if (s.L.tedavi > 0) {
      const def = F.remedyById('kulak-tikaci');
      if (!s.remedy.item) { s.remedy.item = def.id; s.remedy.since = t * 60_000; }
      else {
        const sh = F.remedyShelf(def, s.L.tedavi, s.remedy.since, t * 60_000, F.taramaFactor(s.L.tarama));
        const take = Math.max(0, Math.min(sh.ready, F.remedyInvCap(s.kampSv) - s.remedy.inv)); const left = sh.ready - take;
        if (sh.ready > 0) { s.remedy.inv += take; s.remedy.since = sh.nextSince - left * sh.periodMs; }
        if (take > 0) { s.k.malzeme += take; kampXp(take * F.CAMP_XP.remedy); }
      }
      const kullan = Math.min(V.malzemeKullanOturum, s.remedy.inv); s.remedy.inv -= kullan; s.k['malzeme-kullan'] += kullan;
    }
    // Hasta Vakaları (camp-quests-vaka.ts vakaTopUp + answer)
    if (ac('vaka') && s.L.revir >= 1) {
      if (s.vakaGun !== d) {
        s.vakaGun = d; const tier = H.vakaKademe ? H.vakaKademe(s.L.revir) : F.vakaKademesi(s.L.revir);
        const room = Math.max(0, Math.min(F.KG_KURAL.vakaGunluk, F.KG_KURAL.vakaSalon - s.vakaQ.length));
        s.vakaQ.push(...F.VAKALAR.filter((v) => v.kademe <= tier && !s.vakaQ.includes(v.id) && !s.vakaBook.has(v.id)).slice(0, room).map((v) => v.id));
      }
      if (s.team && s.vakaQ.length && (s.konsultSorGun ?? -1) !== d) { s.konsultSorGun = d; s.k.konsult++; kgOdul(F.KG_ODUL.konsultSoran); }
      for (const id of s.vakaQ.splice(0)) {
        const y = V.vakaYildizSira[s.vakaBook.size % V.vakaYildizSira.length]; s.vakaBook.set(id, y); s.k.vaka++; G.vaka++; if (y === 3) s.k['vaka-3yildiz']++;
        kgOdul({ jeton: F.KG_ODUL.vakaTaban.jeton + F.KG_ODUL.vakaYildiz.jeton * y, kampXp: F.KG_ODUL.vakaTaban.kampXp + F.KG_ODUL.vakaYildiz.kampXp * y, ...(y >= 2 ? { malzeme: 'x', malzemeN: 1 } : {}) });
        s.takimKlinikHafta[Math.floor(d / 7)] = true;
      }
    }
    // kamp oyunları (camp-quests-oyun.ts; günde 5 ödüllü tur)
    if (ac('oyun')) for (const [g, b] of [['ton', 'laboratuvar'], ['timpano', 'kule']]) {
      if (s.L[b] < 1) continue;
      for (let i = 0; i < V.oyunTurOturum; i++) { s.k[g]++; if (oyunBugun[g] < F.KG_KURAL.oyunOdulluTur) { oyunBugun[g]++; kgOdul(F.KG_ODUL.oyunTur); } }
    }
    // takım: yardım, konsültasyon oyu, alkış/ziyaret
    if (s.team) {
      for (let i = 0; i < T.yardimOturum; i++) { s.k.yardim++; yardimBugun++; if (yardimBugun <= F.CAMP_HELP_REWARD_DAILY) { s.jeton += F.CAMP_HELP_REWARD; G.gelir.takim += F.CAMP_HELP_REWARD; } }
      if (ac('vaka')) for (let i = 0; i < T.konsultOyOturum; i++) { s.k.konsult++; if (konsultOyBugun < F.KG_KURAL.konsultOyOdullu) { konsultOyBugun++; kgOdul(F.KG_ODUL.konsultOy); } }
    }
    // süsleme (camp.decor.place): her yeni süs türü yer varsa yerleştirilir, ilk yerleştirme 5 Kamp XP
    const cap = F.decorSlots(s.kampSv, s.L.park);
    for (const id of s.decorInv) if (!s.decorPlaced.has(id) && s.placedN < cap) { s.decorPlaced.add(id); s.placedN++; s.k['dekor-yerlestir']++; kampXp(F.CAMP_XP.decorFirst); }
  };
  // hikâye, başarı basamakları, haftalık hedef (camp-quests.ts)
  const olcut = (o) => {
    if (o.startsWith('bina:')) return s.L[o.slice(5)];
    switch (o) {
      case 'bina-toplam': return sum(s.L);
      case 'defter': return s.vakaBook.size;
      case 'defter-yildiz': return [...s.vakaBook.values()].reduce((a, b) => a + b, 0);
      case 'patoloji': return new Set(F.VAKALAR.filter((v) => s.vakaBook.has(v.id) && F.PATHOLOGY_IDS.includes(v.kat)).map((v) => v.kat)).size;
      case 'bolge': return bolgeler().size;
      case 'takim': return s.team ? 1 : 0;
      case 'hikaye': return s.hikaye;
      case 'kamp-sv': return s.kampSv;
      case 'dekor': return s.placedN;
      default: return s.k[o] ?? 0;
    }
  };
  const sartTamam = (sart) => !sart || ((!sart.ozellik || ac(sart.ozellik)) && (!sart.bina || s.L[sart.bina[0]] >= sart.bina[1]) && (!sart.takim || s.team));
  const gorevSistemi = () => {
    if (!ac('gorev')) return;
    for (;;) { // hikâye sırayla (camp-quests.ts story: ilk alınmamış bölüm)
      const ch = F.KG_HIKAYE[s.hikaye];
      const tamam = (st) => olcut(st.olcut) >= st.need || (H.soloHikaye && !s.team && ['takim', 'yardim', 'konsult', 'ziyaret'].includes(st.olcut));
      if (!ch || !ch.steps.every(tamam)) break;
      s.hikaye++; G.hikaye.push(ch.no); kgOdul(ch.reward);
    }
    for (const a of F.KG_BASARI) {
      if (!sartTamam(a.sart)) continue;
      const v = olcut(a.olcut); let t = s.kgAch[a.id] ?? 0;
      while (t < a.tiers.length && v >= a.tiers[t].need) { kgOdul(a.tiers[t].reward); t++; }
      s.kgAch[a.id] = t;
    }
  };
  const haftalik = (d) => {
    const w = Math.floor(d / 7); const h = F.KG_HAFTA.find((x) => x.id === V.haftaHedefi);
    const prog = s.hafta[`p${w}`] ?? 0; let t = s.hafta[`t${w}`] ?? 0;
    while (t < 3 && prog >= h.tiers[t]) { kgOdul(F.KG_HAFTA_ODUL[t]); t++; }
    s.hafta[`t${w}`] = t;
  };

  // ---------------------------------------------------------------- takım ödülleri (gün içinde ve hafta takvimine göre)
  const takimGunluk = (d, son) => {
    if (!s.team) return;
    const wd = d % 7; // 0 Pzt … 6 Paz
    const katildiOnce = (gunOnce) => s.teamAt != null && s.teamAt <= d - gunOnce;
    if (son) {
      takimOdul(F.QUEST_REWARD, T.gunlukGorev);                                                     // günlük takım görevleri (tüm üyelere)
      if (ac('events')) { takimOdul(F.RALLY_MONSTERS[0].reward, Math.min(T.ralli[nOt] ?? 0, F.RALLY_RULES.rewardsPerPlayerDay)); // ralli
        const q = T.quiz[nOt] ?? 0; if (q) { s.jeton += q * F.QUIZ_REWARDS.perCorrect * T.quizDogru; G.gelir.takim += q * F.QUIZ_REWARDS.perCorrect * T.quizDogru; } }
      if (ac('soru')) { const j = F.COMM_RULES.dqCorrectJeton * T.dqDogruOran; s.jeton += j; G.gelir.takim += j; }      // Günün Sorusu
      if (ac('friends')) { const j = T.arkadas * (F.FRIEND_LIMITS.giftJeton + F.FRIEND_LIMITS.giftThanksJeton); s.jeton += j; G.gelir.takim += j; } // arkadaş hediyesi
      { const j = T.bolumYardimGun * F.HELP_GIVE_JETON; s.jeton += j; G.gelir.takim += j; }       // bölüm yardımı (kalkan ver)
      if (kampAcik()) { s.k.ziyaret += 1; kampXp(T.alkisVer * F.CAMP_XP.cheerGive + T.alkisAl * F.CAMP_XP.cheerGot); }
      // haftalık: Ses Avı dönem sonları (Per 00:00, Pzt 00:00) → o gün; düello (Çar 00:00, Cmt 00:00); baskın Cmt; hedefler Paz; bayrak Pzt
      return;
    }
    if ((wd === 3 || wd === 0) && katildiOnce(1)) { for (let k = 0; k < T.avKademe; k++) takimOdul(F.huntTierReward(k)); }
    if ((wd === 2 || wd === 5) && katildiOnce(1)) takimOdul(F.DUEL_REWARDS[T.duello[wd === 2 ? 0 : 1] === 'kazandi' ? 'win' : 'lose']);
    if (wd === 5 && T.baskinYenildi && katildiOnce(1)) takimOdul(F.RAID_GIFT);
    if (wd === 6 && katildiOnce(1)) for (const g of F.TEAM_GOALS) for (let k = 0; k < T.hedefKademe[g.metric]; k++) takimOdul(g.tiers[k].reward);
    if (wd === 0 && T.bayrakBitti && katildiOnce(1) && ac('events')) takimOdul(F.RELAY_REWARDS.finish);
    if (wd === 6 && s.takimKlinikHafta[Math.floor(d / 7)] && ac('vaka')) kgOdul(F.KG_ODUL.takim);   // takım kliniği (haftalık 12 vaka)
  };

  // ---------------------------------------------------------------- ana döngü
  let prevEnd = null; // { t, busyUntil, jeton, enUcuz }
  const zamanYaz = (t0, t1, st) => { // [t0,t1) aralığını günlere böl
    let a = t0;
    while (a < t1 - 1e-9) {
      const d = Math.floor(a / GUN); const b = Math.min(t1, (d + 1) * GUN); const row = gunler[d]; if (!row) break;
      const busy = st.busyUntil != null ? Math.max(0, Math.min(b, st.busyUntil) - a) : 0; const rest = (b - a) - busy;
      row.saat.dolu += busy / 60; if (st.yeter) row.saat.cevrimdisi += rest / 60; else row.saat.jetonYok += rest / 60;
      a = b;
    }
  };
  for (let d = 0; d < V.gun; d++) {
    yeniGun(d); yerelBugun = 0; oyunBugun = { ton: 0, timpano: 0 }; konsultOyBugun = 0; yardimBugun = 0; takvimAlindi = false; sandik = false;
    gunSayac = { plays: 0, clears: 0, clears2: 0, threeStar: 0, coins: 0, noDamage: 0, underPar: 0, replay: 0 };
    gorevler = F.rollDailyQuests(dayStr(d)).map((def) => ({ def, claimed: false }));
    s.streak++; s.m.days++; s.m.maxStreak = Math.max(s.m.maxStreak, s.streak);
    takimGunluk(d, false);
    let gunGorev = 0;
    P.oturum.forEach((m, oi) => {
      const t = d * GUN + m; const son = oi === nOt - 1;
      if (prevEnd && kampAcik()) zamanYaz(prevEnd.t, t, prevEnd);
      G.duvarAn = false;
      takvim();
      if (kampAcik()) { kampIsleri(t, d); gorevSistemi(); insaEt(t); }
      bolumOyna(V.oturumBolumSn);
      if (P.takim && !s.team && ac('team')) { s.team = true; s.teamAt = d; G.acilan.push('takıma katıldı'); }
      const t2 = t + V.oturumSn / 60;
      gorevKontrol(); takvim(); metaBasarim();
      if (kampAcik()) {
        if (son && ac('gorev')) { const n = V.kampGorevGunluk - gunGorev; for (let i = 0; i < n; i++) { kgOdul(F.KG_ODUL.gunluk); s.k.gunluk++; s.hafta[`p${Math.floor(d / 7)}`] = (s.hafta[`p${Math.floor(d / 7)}`] ?? 0) + 1; } gunGorev += n; }
        if (son) takimGunluk(d, true);
        gorevSistemi(); haftalik(d); insaEt(t2); yetenekAl();
        G.oturumKamp++; if (!s.q && G.duvarAn) G.oturumDuvar++;
        const nx = siradaki();
        // sıradaki inşaat da kuyruğu doldurur
        prevEnd = { t: t2, busyUntil: s.q ? s.q.ends + (s.qNext ? s.qNext.sec / 60 : 0) : null, yeter: nx ? s.jeton >= nx.jeton : true };
      } else if (son) takimGunluk(d, true);
    });
    G.vakaDefter = s.vakaBook.size;
    G.cleared = s.cleared; G.cuzdan = Math.floor(s.jeton); G.kristalStok = s.kristal; G.kampSv = s.kampSv; G.kampXp = s.xp; G.binalar = { ...s.L };
    const nx = siradaki(); G.sonrakiMaliyet = nx ? nx.jeton : null; G.sonraki = nx ? `${bDef(nx.id).short ?? nx.id} ${nx.to}` : 'yok (Merkez inşaatta)';
    { const son3 = gunler.slice(-3); const gelir = son3.reduce((a, g) => a + sum(g.gelir), 0) / son3.length; G.sonrakiGun = nx && gelir ? nx.jeton / gelir : null; }
    G.kuyruk = s.q ? `${bDef(s.q.id).short ?? s.q.id} ${s.q.to}` : null; G.hikayeToplam = s.hikaye; G.boost = { ...s.boost }; G.skills = s.skills.size;
  }
  if (prevEnd) zamanYaz(prevEnd.t, V.gun * GUN, prevEnd);
  return { P, gunler, son: s };
}

// =====================================================================================================================
// 6) Rapor (Markdown; Türkçe sayı biçimi)
// =====================================================================================================================
const tr = (x, d = 0) => (x == null ? '–' : Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const sonuclar = PROFILLER.map(simule);
const out = [];
const w = (l = '') => out.push(l);

// --- bölüm verisi
w('### Bölüm verisi (girdi)');
w();
w(`_Bitirme: docs/12 §6 (1-12 ilk kez oynayan, 13-40 oyuncu kitlesi; 48 oyuncu). Süre, nota, yıldız: \`insan-olcum.json\` (${OLC.k} oyuncu, aynı kademeler). Beklenen deneme = 1 / bitirme; beklenen süre = (deneme − 1) × (bitiremeyen süresi + ${V.denemeEkSn} sn) + (bitiren süresi + ${V.denemeEkSn} sn)._`);
w();
w('| Bölüm | Bitirme | Deneme | Bitiren süre (sn) | Nota / bitiriş | Toplam nota (bölüm) | Beklenen süre (sn) | Beklenen nota | Yıldız (bitiren) |');
w('|---|---|---|---|---|---|---|---|---|');
let topSure = 0, topNota = 0;
for (let n = 1; n <= 40; n++) { const d = LV[n]; topSure += d.sure; topNota += d.nota;
  w(`| ${n} | %${tr(d.p * 100)} | ${tr(d.att, 2)} | ${tr(d.tc, 1)} | ${tr(d.cc, 1)} | ${d.coinsTotal} | ${tr(d.sure)} | ${tr(d.nota, 1)} | ${tr(d.yildiz, 2)} |`); }
w(`| **1-40** | | | | | | **${tr(topSure / 60, 1)} dk** | **${tr(topNota)}** | |`);
w();

// --- özet
/** vaka günleri: yeni hasta gelen, vaka açık (Klinik kurulu ve bölüm eşiği), boş (açık, hasta gelmedi, 32 vaka henüz bitmemişti) */
const vakaGunleri = (r) => {
  const acik = r.gunler.filter((g) => g.cleared >= F.KG_ACILIS.vaka && g.binalar.revir >= 1);
  const bos = acik.filter((g) => !g.vaka && (r.gunler[g.gun - 2]?.vakaDefter ?? 0) < F.VAKALAR.length);
  return { gelen: r.gunler.filter((g) => g.vaka > 0).length, acik: acik.length, bos: bos.length };
};
const ilkGun = (r, f) => { const g = r.gunler.find(f); return g ? g.gun : null; };
const binaGunu = (r, id, lv = 1) => ilkGun(r, (g) => g.binalar[id] >= lv);
w('### Profil özeti (14 gün)');
w();
w('| Profil | Bölüm 40 bitti (gün) | İlk duvar günü | İnşaatsız gün | Taşkın günü | Yeni hasta gelen gün / vaka açık gün (boş gün, vaka bitmeden) | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (%) | Sıradaki bina = kaç günlük gelir (14. gün) | 14. gün cüzdan | 14. gün kristal | Kamp Sv | Hikâye bölümü | Anlamlı gün |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of sonuclar) {
  const g14 = r.gunler.at(-1); const saat = r.gunler.reduce((a, g) => ({ dolu: a.dolu + g.saat.dolu, yok: a.yok + g.saat.jetonYok, cd: a.cd + g.saat.cevrimdisi }), { dolu: 0, yok: 0, cd: 0 });
  const tum = saat.dolu + saat.yok + saat.cd;
  // duvar günü: kamp açıkken hiçbir inşaat başlatılamayan ve en az bir oturumda sıradaki inşaata jeton yetmeyen gün
  const duvar = ilkGun(r, (g) => g.oturumKamp > 0 && !g.insaat.length && g.oturumDuvar > 0);
  const anlamli = r.gunler.filter((g) => g.yeniBolum > 0 || g.insaat.length > 0 || g.vaka > 0 || g.hikaye.length > 0).length;
  const kampli = r.gunler.filter((g) => g.oturumKamp > 0);
  const insaatsiz = kampli.filter((g) => !g.insaat.length).length;
  const taskin = kampli.filter((g) => g.sonrakiMaliyet && g.cuzdan >= 2 * g.sonrakiMaliyet).length;
  const pct = (x) => tr(tum ? (x / tum) * 100 : 0);
  const vk = vakaGunleri(r);
  w(`| ${r.P.ad} | ${tr(ilkGun(r, (g) => g.cleared >= 40))} | ${duvar ?? 'yok'} | ${insaatsiz} | ${taskin} | ${vk.gelen}/${vk.acik} (${vk.bos}) | %${pct(saat.dolu)} / %${pct(saat.yok)} / %${pct(saat.cd)} | ${tr(g14.sonrakiGun, 2)} | ${tr(g14.cuzdan)} | ${tr(g14.kristalStok)} | ${g14.kampSv} | ${g14.hikayeToplam}/10 | ${anlamli}/14 |`);
}
w();
w('### Açılış günleri (gün; – = 14 günde yok)');
w();
w('| Profil | Kamp Görevleri | Vakalar (Klinik kurulu) | Tedavi Odası | Kamp Sv 3 (Sessiz Koru) | Akustik Kabin | Kamp Sv 6 (Koklea Koyu) | Tarama Birimi | Kamp Sv 9 (Park) | Kamp Sv 12 (Denge Tepesi) | Merkez Sv 5 | Merkez Sv 8 |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of sonuclar) {
  const kv = (L) => tr(ilkGun(r, (g) => g.kampSv >= L));
  w(`| ${r.P.ad} | ${tr(ilkGun(r, (g) => g.cleared >= F.KG_ACILIS.gorev))} | ${tr(ilkGun(r, (g) => g.cleared >= F.KG_ACILIS.vaka && g.binalar.revir >= 1))} | ${tr(binaGunu(r, 'tedavi'))} | ${kv(3)} | ${tr(binaGunu(r, 'kabin'))} | ${kv(6)} | ${tr(binaGunu(r, 'tarama'))} | ${kv(9)} | ${kv(12)} | ${tr(binaGunu(r, 'merkez', 5))} | ${tr(binaGunu(r, 'merkez', 8))} |`);
}
w();
w('### Gelir kaynakları (14 gün toplamı, jeton)');
w();
w('| Profil | Bölüm | Yerel (görev, takvim, sandık, hazine, başarım) | Depo | Kamp Görevleri ve vakalar | Takım ve arkadaş | Toplam | Harcanan: bina | Harcanan: yetenek | Kristal geliri | Yerel sınırda kırpılan |');
w('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of sonuclar) {
  const t = r.gunler.reduce((a, g) => { for (const k of Object.keys(g.gelir)) a[k] = (a[k] ?? 0) + g.gelir[k]; a.bina = (a.bina ?? 0) + g.harcama.bina; a.yet = (a.yet ?? 0) + g.harcama.yetenek; a.kr = (a.kr ?? 0) + g.kristal; a.kirp = (a.kirp ?? 0) + g.yerelKirpilan; return a; }, {});
  w(`| ${r.P.ad} | ${tr(t.bolum)} | ${tr(t.yerel)} | ${tr(t.depo)} | ${tr(t.kamp)} | ${tr(t.takim)} | **${tr(t.bolum + t.yerel + t.depo + t.kamp + t.takim)}** | ${tr(t.bina)} | ${tr(t.yet)} | ${tr(t.kr)} | ${tr(t.kirp)} |`);
}
w();

// --- gün gün
for (const r of sonuclar) {
  w(`### Gün gün: ${r.P.ad}`);
  w();
  w('| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |');
  w('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const g of r.gunler) {
    const ge = g.gelir; const top = ge.bolum + ge.yerel + ge.depo + ge.kamp + ge.takim;
    const olay = [...g.acilan, ...g.hikaye.map((h) => `hikâye ${h}`), ...(g.vaka ? [`${g.vaka} vaka`] : [])].join('; ');
    w(`| ${g.gun} | ${g.cleared} | ${tr(top)} (${tr(ge.bolum)} / ${tr(ge.yerel)} / ${tr(ge.depo)} / ${tr(ge.kamp)} / ${tr(ge.takim)}) | ${tr(g.kristal)} | ${tr(g.harcama.bina + g.harcama.yetenek)} | ${tr(g.cuzdan)} | ${g.insaat.join(', ') || '–'} | ${tr(g.saat.dolu, 1)} / ${tr(g.saat.jetonYok, 1)} / ${tr(g.saat.cevrimdisi, 1)} | ${g.sonraki} (${tr(g.sonrakiMaliyet)}; ${tr(g.sonrakiGun, 2)}) | ${g.kampSv} | ${olay || '–'} |`);
  }
  w();
}
// --- uygulanan değişiklikler: eski kural (simülasyon kancasıyla) → bugünkü kod (aynı ölçüm, aynı model)
const ESKI_KADEME = (sv) => (sv >= 7 ? 3 : sv >= 4 ? 2 : sv >= 1 ? 1 : 0); // Klinik Sv 1/4/7 (Ö4 öncesi)
const UYGULANAN = [
  { id: 'Ö1', ad: `Yerel ödül sınırı 600 → ${tr(F.LOCAL_JETON_DAILY_MAX)} jeton/gün`, H: { yerelSinir: 600 } },
  { id: 'Ö4', ad: `Vaka kademeleri Klinik Sv 1/4/7 → ${F.KG_KURAL.kademeSv.join('/')}`, H: { vakaKademe: ESKI_KADEME } },
  { id: 'Ö1 + Ö4', ad: 'ikisi birlikte', H: { yerelSinir: 600, vakaKademe: ESKI_KADEME } },
  { id: 'Ö3', ad: 'Bir inşaat sıraya alınabilir (parası peşin; MK-011)', H: { sira: false } },
];
// --- öneri denemeleri (yalnız simülasyonda; oyun kodu değişmedi)
const ONERILER = [
  { id: 'Ö2', ad: 'Takımsız oyuncuya hikâye 6–7 için tek kişilik adım', H: { soloHikaye: true } },
  { id: 'Ö5', ad: '(denendi, önerilmez) Depo dolma süresi 8 → 12 sa', H: { depoSaat: (dl) => 12 + 0.5 * dl } },
  { id: 'Ö4b', ad: '(denendi) Vaka kademeleri Klinik Sv 1/1/2', H: { vakaKademe: (sv) => (sv >= 2 ? 3 : sv >= 1 ? 2 : 0) } },
];
const ozet = (r) => {
  const g14 = r.gunler.at(-1); const sm = (f) => r.gunler.reduce((a, g) => a + f(g), 0); const vk = vakaGunleri(r);
  return { insaat: sm((g) => g.insaat.length), cuzdan: g14.cuzdan, kampSv: g14.kampSv, hikaye: g14.hikayeToplam, kristal: sm((g) => g.kristal),
    kirp: sm((g) => g.yerelKirpilan), kirp3: r.gunler.slice(0, 3).reduce((a, g) => a + g.yerelKirpilan, 0), yerelEnCok: Math.max(...r.gunler.map((g) => g.gelir.yerel + g.yerelKirpilan)),
    vakaGun: vk.gelen, vakaAcik: vk.acik, vakaBos: vk.bos, gelir: sm((g) => sum(g.gelir)),
    taskin: r.gunler.filter((g) => g.oturumKamp > 0 && g.sonrakiMaliyet && g.cuzdan >= 2 * g.sonrakiMaliyet).length };
};
w('### Uygulanan değişiklikler (14 gün; eski kural → bugünkü kod)');
w();
w('_Aynı ölçüm ve model; "eski" sütunu eski kuralı simülasyon kancasıyla yeniden kurar. Yerel talep: sınır olmasa o gün istenecek en yüksek yerel ödül jetonu._');
w();
w('| Değişiklik | Profil | Gelir (jeton) | Başlatılan inşaat | 14. gün cüzdan | Taşkın günü | Kamp Sv | Kristal geliri | Kırpılan yerel jeton (ilk 3 gün) | Kırpılan yerel jeton (14 gün) | En yoğun gün yerel talep | Yeni hasta gelen gün | Boş klinik günü (vaka bitmeden) |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const o of UYGULANAN) for (const [i, P] of PROFILLER.entries()) {
  const a = ozet(simule(P, o.H)); const b = ozet(sonuclar[i]);
  const c = (k, d = 0) => (a[k] === b[k] ? tr(a[k], d) : `${tr(a[k], d)} → **${tr(b[k], d)}**`);
  w(`| ${o.id} ${o.ad} | ${P.ad} | ${c('gelir')} | ${c('insaat')} | ${c('cuzdan')} | ${c('taskin')} | ${c('kampSv')} | ${c('kristal')} | ${c('kirp3')} | ${c('kirp')} | ${tr(b.yerelEnCok)} | ${a.vakaGun}/${a.vakaAcik} → ${b.vakaGun === a.vakaGun && b.vakaAcik === a.vakaAcik ? '' : '**'}${b.vakaGun}/${b.vakaAcik}${b.vakaGun === a.vakaGun && b.vakaAcik === a.vakaAcik ? '' : '**'} | ${c('vakaBos')} |`);
}
w();
w('### Öneri denemeleri (14 gün; temel → öneriyle)');
w();
w('| Öneri | Profil | Gelir (jeton) | Başlatılan inşaat | 14. gün cüzdan | Taşkın günü | Kamp Sv | Hikâye | Kristal geliri | Kırpılan yerel jeton | Yeni hasta gelen gün | Boş klinik günü (vaka bitmeden) |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const o of ONERILER) for (const [i, P] of PROFILLER.entries()) {
  const a = ozet(sonuclar[i]); const b = ozet(simule(P, o.H));
  if (JSON.stringify(a) === JSON.stringify(b)) continue;
  const c = (k, d = 0) => (a[k] === b[k] ? tr(a[k], d) : `${tr(a[k], d)} → **${tr(b[k], d)}**`);
  w(`| ${o.id} ${o.ad} | ${P.ad} | ${c('gelir')} | ${c('insaat')} | ${c('cuzdan')} | ${c('taskin')} | ${c('kampSv')} | ${c('hikaye')} | ${c('kristal')} | ${c('kirp')} | ${c('vakaGun')} | ${c('vakaBos')} |`);
}
w();
const md = out.join('\n');

if (flag('json')) console.log(JSON.stringify(sonuclar.map((r) => ({ profil: r.P, gunler: r.gunler })), null, 1));
else if (flag('belge')) {
  const doc = readFileSync(BELGE, 'utf8'); const a = '<!-- simule:basla -->', b = '<!-- simule:bitir -->';
  if (!doc.includes(a) || !doc.includes(b)) { console.error('Belgede işaretler yok'); process.exit(1); }
  writeFileSync(BELGE, doc.slice(0, doc.indexOf(a) + a.length) + '\n' + md + '\n' + doc.slice(doc.indexOf(b)));
  console.log(`→ ${BELGE}`);
} else console.log(md);
