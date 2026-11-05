import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { DEFAULT_SKILLS, HUMAN_JOURNEY, SKILL_TREE } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, earnLines, processRun, type PlayerCore, type RunSummary } from '@odi/meta';
import { scoreRun, type RunResult } from '@odi/shared';
import { DEVIR_MAX, LOCAL_JETON_DAILY_MAX } from '../src/wallet';
import { setup, run, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const cost = (id: string) => SKILL_TREE.find((n) => n.id === id)!.cost;

describe('yerel ödül cüzdanı (wallet.local)', () => {
  it('idempotent: aynı ledgerId ikinci kez eklenmez; wallet.updated gelir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const r = await a.call('wallet.local', { ledgerId: '1700000000000:gorev:kosu', jeton: 40, reason: 'gorev:kosu' });
    expect(r.credited).toBe(40);
    expect(r.wallet.jeton).toBe(100 + 40);
    expect(r.dailyLeft).toBe(LOCAL_JETON_DAILY_MAX - 40);
    expect((await a.waitFor('wallet.updated')).wallet.jeton).toBe(140);
    const again = await a.call('wallet.local', { ledgerId: '1700000000000:gorev:kosu', jeton: 40, reason: 'gorev:kosu' });
    expect(again.credited).toBe(40);
    expect(again.wallet.jeton).toBe(140);
  });

  it('günlük üst sınır (İstanbul günü); ertesi gün yenilenir', async () => {
    // dürüst oyunun ölçülen en yoğun gününün üstünde (1.270: 6 oturum, 1. gün; ekonomi-olcum Ö1), sahte istemciyi yine durdurur
    expect(LOCAL_JETON_DAILY_MAX).toBeGreaterThanOrEqual(1270);
    expect(LOCAL_JETON_DAILY_MAX).toBeLessThanOrEqual(2000);
    env = await setup();
    const a = await env.connect('Ayşe');
    const ilk = LOCAL_JETON_DAILY_MAX - 100;
    expect((await a.call('wallet.local', { ledgerId: 'a1', jeton: ilk, reason: 'takvim:7' })).credited).toBe(ilk);
    const capped = await a.call('wallet.local', { ledgerId: 'a2', jeton: 250, reason: 'gunluk-sandik' });
    expect(capped.credited).toBe(100);
    expect(capped.dailyLeft).toBe(0);
    expect((await a.call('wallet.local', { ledgerId: 'a3', jeton: 10, reason: 'sansli-nota' })).credited).toBe(0);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(100 + LOCAL_JETON_DAILY_MAX);
    env.clock.advance(24 * 3600_000);
    expect((await a.call('wallet.local', { ledgerId: 'a4', jeton: 30, reason: 'gorev:x' })).credited).toBe(30);
  });

  it('günlük sınırın durumu okunur (YN-269): wallet.get dailyLeft kredilendikçe azalır, İstanbul gece yarısı yenilenir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const g0 = await a.call('wallet.get', {});
    expect(g0.dailyLeft).toBe(LOCAL_JETON_DAILY_MAX);
    // sıradaki İstanbul gece yarısı: gelecekte, en çok 24 saat sonra, İstanbul saatiyle 00:00 (UTC 21:00)
    const reset = g0.dailyResetAt!;
    expect(reset).toBeGreaterThan(env.clock.now()); expect(reset - env.clock.now()).toBeLessThanOrEqual(24 * 3600_000);
    expect(new Date(reset).getUTCHours()).toBe(21); expect(new Date(reset).getUTCMinutes()).toBe(0);
    const r1 = await a.call('wallet.local', { ledgerId: 'y1', jeton: 110, reason: 'hazine:25' });
    expect(r1.dailyLeft).toBe(LOCAL_JETON_DAILY_MAX - 110); expect(r1.dailyResetAt).toBe(reset);
    expect((await a.call('wallet.get', {})).dailyLeft).toBe(LOCAL_JETON_DAILY_MAX - 110);
    await a.call('wallet.local', { ledgerId: 'y2', jeton: 40, reason: 'basarim:x:2' });
    expect((await a.call('wallet.get', {})).dailyLeft).toBe(LOCAL_JETON_DAILY_MAX - 150);
    // aynı kaydın yeniden gönderimi düşürmez; devir sayılmaz
    expect((await a.call('wallet.local', { ledgerId: 'y2', jeton: 40, reason: 'basarim:x:2' })).dailyLeft).toBe(LOCAL_JETON_DAILY_MAX - 150);
    await a.call('wallet.local', { ledgerId: 'devir', jeton: 500, reason: 'devir' });
    expect((await a.call('wallet.get', {})).dailyLeft).toBe(LOCAL_JETON_DAILY_MAX - 150);
    // sınır dolunca 0, altına inmez
    await a.call('wallet.local', { ledgerId: 'y3', jeton: LOCAL_JETON_DAILY_MAX, reason: 'takvim:7' });
    expect((await a.call('wallet.get', {})).dailyLeft).toBe(0);
    // yenilenme anında yeni gün: tam sınır, sıradaki gece yarısı bir gün sonra
    env.clock.advance(reset - env.clock.now());
    const g1 = await a.call('wallet.get', {});
    expect(g1.dailyLeft).toBe(LOCAL_JETON_DAILY_MAX); expect(g1.dailyResetAt).toBe(reset + 24 * 3600_000);
  });

  it('devir: yeni hesapta bir kez, en çok 3000, günlük sınırı tüketmez; 24 saatten sonra yok', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const d = await a.call('wallet.local', { ledgerId: 'devir', jeton: 5000, reason: 'devir' });
    expect(d.credited).toBe(DEVIR_MAX);
    expect(d.dailyLeft).toBe(LOCAL_JETON_DAILY_MAX);
    expect((await a.call('wallet.local', { ledgerId: 'devir-2', jeton: 100, reason: 'devir' })).credited).toBe(0);
    expect((await a.call('wallet.local', { ledgerId: 'g1', jeton: 50, reason: 'gorev:x' })).credited).toBe(50);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(100 + DEVIR_MAX + 50);
    const b = await env.connect('Bora');
    env.clock.advance(25 * 3600_000);
    expect((await b.call('wallet.local', { ledgerId: 'devir', jeton: 500, reason: 'devir' })).credited).toBe(0);
  });

  it('geçersiz veri reddedilir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect((await err(a.call('wallet.local', { ledgerId: 'boşluk var', jeton: 5, reason: 'x' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('wallet.local', { ledgerId: 'ok', jeton: 0, reason: 'x' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('wallet.local', { ledgerId: 'ok', jeton: -5, reason: 'x' }))).code).toBe('GECERSIZ');
  });
});

/**
 * YN-200 (OT-rekabetci-44): rekabetçi oyuncu aynı gün Bölüm 20-40'ı oynadı; 39'un 2 başarımı (+115) ve 40'ın hazinesi + 5 başarımı
 * (+435) cüzdana girmedi, 34-36'da kartlar +462, cüzdan +317. Kök neden: yerel ödüller (hazine, başarım, Şanslı Nota, görev, sandık)
 * istemcide hesaplanıp `wallet.local` ile gider; sunucunun günlük yerel ödül sınırı (1.500) maraton gününde Bölüm 35-36 civarında
 * dolar, sonrası `credited: 0`. Sonuç kartı istenen tutarı yazıyordu; artık hesaba geçeni (earnLines `eksik`).
 */
describe('maraton günü: hazine ve başarım jetonu günlük sınırda (YN-200)', () => {
  const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
  const jetonOf = (g: { items: { kind: string; amount: number }[] }) => g.items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0);
  /** rekabetçi koşu (0,95 beceri): 2-3 yıldız, par altında; bölüm jetonu ayrı (progress.submit), yerel ödüller defterden */
  function oyna(c: PlayerCore, n: number, day: string, now: number): { core: PlayerCore; summary: RunSummary } {
    const spec = generateLevel(HUMAN_JOURNEY.id, n, prof); const stars = (n % 3 === 0 ? 3 : 2) as 2 | 3;
    const base = { levelId: spec.id, completed: true, coins: Math.round(spec.coinsTotal * 0.7), timeSec: spec.parTimeSec - 3, deaths: 0, damageTaken: stars === 3 ? 0 : 1, objectiveMet: true, secretFound: false, extra: { maxCombo: 20 } };
    return processRun(c, spec, { ...base, ...scoreRun(spec, base), stars } as RunResult, day, now);
  }

  it('sınır dolunca hazine ve başarım kredisi kesilir; sonuç dökümünün toplamı = sunucunun hesaba geçirdiği', async () => {
    env = await setup();
    const a = await env.connect('Rekabetci');
    let c: PlayerCore = { progress: {}, coins: 0, xp: 0, streak: 1, lastDay: '2026-10-13', failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta() };
    let t = env.clock.now() - 86_400_000;
    for (let n = 1; n <= 19; n++) c = oyna(c, n, '2026-10-13', t += 60_000).core; // önceki gün (bu testte sunucuya gitmez)
    const start = (await a.call('wallet.get', {})).wallet.jeton;
    let istenen = 0; let gecen = 0; let ilkKesik = 0;
    const kesik: Record<number, number> = {};
    for (let n = 20; n <= 40; n++) {
      const r = oyna(c, n, '2026-10-14', t += 60_000); c = r.core;
      // istemcinin gönderdiği gibi (net.ts scanLedger): bölüm jetonu hariç her defter kaydı, ledgerId = at:reason
      const grants: (RunSummary['grants'][number] & { eksik?: number })[] = [];
      for (const g of r.summary.grants) {
        const j = jetonOf(g);
        if (g.reason.startsWith('bolum:') || j <= 0) { grants.push(g); continue; }
        const res = await a.call('wallet.local', { ledgerId: `${g.at}:${g.reason}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80), jeton: j, reason: g.reason.slice(0, 60) });
        istenen += j; gecen += res.credited;
        if (res.credited < j) { kesik[n] = (kesik[n] ?? 0) + j - res.credited; ilkKesik ||= n; }
        grants.push(res.credited < j ? { ...g, eksik: j - res.credited } : g);
      }
      // sonuç kartının dökümü (ResultScreen: earnLines + odul-durum hesabaGecen): yerel satırların toplamı = bu bölümde hesaba geçen
      const lines = earnLines({ grants });
      const yerel = lines.filter((l) => l.label !== 'Toplanan notalar').reduce((x, l) => x + l.jeton, 0);
      const credited = grants.filter((g) => !g.reason.startsWith('bolum:')).reduce((x, g) => x + jetonOf(g) - (g.eksik ?? 0), 0);
      expect(yerel).toBe(credited);
      expect(lines.reduce((x, l) => x + (l.eksik ?? 0), 0)).toBe(kesik[n] ?? 0);
    }
    // maraton gününde istenen yerel jeton sınırı aşar (MK-009'un bilinen riski); sunucu sınırdan fazlasını yazmaz
    expect(istenen).toBeGreaterThan(LOCAL_JETON_DAILY_MAX);
    expect(gecen).toBe(LOCAL_JETON_DAILY_MAX);
    expect((await a.call('wallet.get', {})).wallet.jeton - start).toBe(gecen);
    // yalnız bölüm ödülleriyle sınır Bölüm 36-39'da dolar (oyuncu aynı gün görev, takvim ve sandık da aldı: daha erken, 34-36);
    // 39 ve 40'ın başarım ve hazine jetonu hesaba geçmez (oyuncunun gördüğü)
    expect(ilkKesik).toBeGreaterThanOrEqual(33); expect(ilkKesik).toBeLessThanOrEqual(39);
    expect(kesik[39]).toBeGreaterThan(0); expect(kesik[40]).toBeGreaterThanOrEqual(200);
  });
});

describe('yetenek harcaması (wallet.spend) ve skills.list', () => {
  it('maliyet doğrulanır, ön koşul aranır, aynı yetenek iki kez alınmaz', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await a.call('wallet.local', { ledgerId: 'x1', jeton: 600, reason: 'test' });
    expect((await a.call('skills.list', {})).skills).toEqual([]);
    expect((await err(a.call('wallet.spend', { jeton: 1, reason: 'yetenek:doubleJump' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('wallet.spend', { jeton: 10, reason: 'kostum' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('wallet.spend', { jeton: 10, reason: 'yetenek:yok' }))).code).toBe('YOK');
    expect((await err(a.call('wallet.spend', { jeton: cost('longSlide'), reason: 'yetenek:longSlide' }))).code).toBe('SART');
    const r = await a.call('wallet.spend', { jeton: cost('doubleJump'), reason: 'yetenek:doubleJump' });
    expect(r.skills).toEqual(['doubleJump']);
    expect(r.wallet.jeton).toBe(700 - cost('doubleJump'));
    expect((await err(a.call('wallet.spend', { jeton: cost('doubleJump'), reason: 'yetenek:doubleJump' }))).code).toBe('TEKRAR');
    await a.call('wallet.spend', { jeton: cost('longSlide'), reason: 'yetenek:longSlide' });
    expect((await a.call('skills.list', {})).skills).toEqual(['doubleJump', 'longSlide']);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(700 - cost('doubleJump') - cost('longSlide'));
  });

  it('yetersiz jetonla alınamaz, hiçbir şey kaydedilmez', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect((await err(a.call('wallet.spend', { jeton: cost('echoSight'), reason: 'yetenek:echoSight' }))).code).toBe('YETERSIZ');
    expect((await a.call('skills.list', {})).skills).toEqual([]);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(100);
  });
});

describe('çevrimdışı ilerleme taşıma (progress.sync)', () => {
  it('açık bölüm ve yıldızlar taşınır; ödül verilmez; sonra ileri bölüm gönderilebilir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect((await err(a.call('progress.submit', run(6)))).code).toBe('GECERSIZ');
    const r = await a.call('progress.sync', { best: [{ level: 1, stars: 3, score: 900 }, { level: 2, stars: 2, score: 800 }, { level: 3, stars: 0, score: 0 }, { level: 5, stars: 1, score: 400 }] });
    expect(r.highest).toBe(6);
    expect(r.stars).toBe(6);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(100);
    // ikinci kez: değişmez (en iyi değerler tutulur)
    expect(await a.call('progress.sync', { best: [{ level: 1, stars: 1, score: 10 }] })).toEqual({ highest: 6, stars: 6 });
    const ack = await a.call('progress.submit', run(6, { stars: 2 }));
    expect(ack.highest).toBe(7);
    expect(ack.stars).toBe(8);
  });
});
