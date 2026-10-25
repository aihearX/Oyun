// Zorluk ölçümü işçisi (tools/harness/zorluk.mjs derler ve paralel çalıştırır). Phaser'sız: oynanış çekirdeği + üretici.
//  oda <id...> --k N          → her oda için {id, dmg (acemi), h0/h1 (oyuncu kitlesi, sıkılık 0/1), hit, nm, n, level}
//  kalibre <n...> --k N --v V  → her bölüm için V varyanttan tahmini hedefe en yakın 3'ü ölçülür: {n, cands:[{v, pred, dmg}]}
//  sure <n...> --k N                      → süreli bölüm: {n, par, runs:[{fin, t}]} (oyuncu kitlesi; yıldız süreleri için)
//  yildiz <n...> --k N [--ilk|--notaci]  → bölüm: {n, total, runs:[{fin, r (nota oranı), s (yıldız), t}]} (oyundaki gibi scoreRun)
//  odanota <id...> --k N                 → oda: {id, total, kitle:{col, fin, dmg}, notaci:{col, fin, dmg}} (toplanan nota oranı; MK-015)
//  bolum <n...> --k N [--salt S] [--fail F] [--stars R] [--ilk: ilk kez oynayan kademe]  → her bölüm için {n, runs:[{fin, dmg, deaths, nm, t}]}
import { ALL_CHUNKS, DEFAULT_SKILLS } from '@odi/content';
import { playHuman, playHumanStars, playRoomHuman } from '../../packages/game-core/src/play/testkit';
import { NOVICE, firstTimerOf, notaciOf, playerOf } from '../../packages/game-core/src/play/human';
import { generateLevel, levelKnobs, predictDmg, tuneRoom } from '@odi/level-gen';

const argv = process.argv.slice(2);
const opt = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const mode = argv[0];
const items = argv.slice(1).filter((a, i, arr) => !a.startsWith('--') && !(arr[i - 1] ?? '').startsWith('--'));
const K = opt('k', 8);

if (mode === 'oda') {
  // acemi model: düğmesiz oda (puan/sıralama) · oyuncu kitlesi: en bağışlayıcı (sıkılık 0) ve en sıkı (1) düğmelerle (üretici arasını doğrusal kestirir)
  for (const id of items) {
    const c = ALL_CHUNKS.find((x) => x.id === id); if (!c) continue;
    const c0 = tuneRoom(c, 0), c1 = tuneRoom(c, 1);
    let dmg = 0, h0 = 0, h1 = 0, hit = 0, nm = 0, level = 0;
    for (let k = 0; k < K; k++) {
      const a = playRoomHuman(c, k, { params: NOVICE }); dmg += a.damage; hit += a.damage > 0 ? 1 : 0; nm += a.nearMisses; level = a.level;
      h0 += playRoomHuman(c0, k + 1000).damage;
      const b = playRoomHuman(c1, k + 2000); h1 += b.damage; nm += b.nearMisses;
    }
    console.log(JSON.stringify({ id, dmg: dmg / K, h0: h0 / K, h1: h1 / K, hit: hit / K, nm: nm / (2 * K), n: K, level }));
  }
} else if (mode === 'bolum') {
  const profile = { recentStars: opt('stars', 2), failStreak: opt('fail', 0), skills: DEFAULT_SKILLS };
  for (const s of items) {
    const n = Number(s); const runs = [];
    for (let k = 0; k < K; k++) { const r = playHuman(n, { k, salt: opt('salt', 0), profile, params: argv.includes('--ilk') ? firstTimerOf(k) : argv.includes('--acemi') ? NOVICE : undefined }); runs.push({ fin: r.finished ? 1 : 0, dmg: r.damage, deaths: r.deaths, nm: r.nearMisses, t: Math.round(r.t * 10) / 10, why: r.failed }); }
    console.log(JSON.stringify({ n, runs }));
  }
}

if (mode === 'sure') {
  for (const s of items) {
    const n = Number(s); const par = generateLevel('insan', n).parTimeSec; const runs = [];
    for (let k = 0; k < K; k++) { const r = playHuman(n, { k }); runs.push({ fin: r.finished ? 1 : 0, t: Math.round(r.t * 10) / 10 }); }
    console.log(JSON.stringify({ n, par, runs }));
  }
}

if (mode === 'yildiz') {
  for (const s of items) {
    const n = Number(s); const runs = []; let total = 0;
    for (let k = 0; k < K; k++) {
      const r = playHumanStars(n, { k, params: argv.includes('--ilk') ? firstTimerOf(k) : argv.includes('--notaci') ? notaciOf(k) : undefined }); total = r.spec.coinsTotal;
      runs.push({ fin: r.finished ? 1 : 0, r: total > 0 ? Math.round((r.coins / total) * 1000) / 1000 : 0, s: r.stars, t: Math.round(r.t * 10) / 10 });
    }
    console.log(JSON.stringify({ n, total, runs }));
  }
}

if (mode === 'kalibre') {
  const V = opt('v', 10);
  for (const s of items) {
    const n = Number(s); const kn = levelKnobs(n); const target = kn.lambda;
    const preds = Array.from({ length: V }, (_, v) => ({ v, pred: generateLevel('insan', n, undefined, 0, { variant: v }).chunks.reduce((a, c) => a + predictDmg(c, kn.tight), 0) }));
    const cands = preds.sort((a, b) => Math.abs(a.pred - target) - Math.abs(b.pred - target)).slice(0, 3).map((c) => {
      let dmg = 0; for (let k = 0; k < K; k++) dmg += playHuman(n, { k: 100 + k, variant: c.v }).damage; // ölçümden bağımsız tohumlar
      return { ...c, dmg: dmg / K };
    });
    console.log(JSON.stringify({ n, target, cands }));
  }
}

if (mode === 'odanota') {
  // odanın notalarının ne kadarı toplanıyor: ana yol kitlesi ve notaya dalan kademe aynı tohumlarla (nota 1, büyük nota 5 sayılır)
  for (const id of items) {
    const c = ALL_CHUNKS.find((x) => x.id === id); if (!c) continue;
    const total = c.entities.reduce((a, e) => a + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0);
    const row: Record<string, unknown> = { id, total };
    for (const [name, of] of [['kitle', playerOf], ['notaci', notaciOf]] as const) {
      let col = 0, fin = 0, dmg = 0;
      for (let k = 0; k < K; k++) { const r = playRoomHuman(c, k, { params: of(k) }); col += total ? r.coins / total : 0; fin += r.finished ? 1 : 0; dmg += r.damage; }
      row[name] = { col: col / K, fin: fin / K, dmg: dmg / K };
    }
    console.log(JSON.stringify(row));
  }
}
