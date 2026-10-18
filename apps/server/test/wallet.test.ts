import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { SKILL_TREE } from '@odi/content';
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

  it('günlük üst sınır 600 jeton (İstanbul günü); ertesi gün yenilenir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect((await a.call('wallet.local', { ledgerId: 'a1', jeton: 500, reason: 'takvim:7' })).credited).toBe(500);
    const capped = await a.call('wallet.local', { ledgerId: 'a2', jeton: 250, reason: 'gunluk-sandik' });
    expect(capped.credited).toBe(100);
    expect(capped.dailyLeft).toBe(0);
    expect((await a.call('wallet.local', { ledgerId: 'a3', jeton: 10, reason: 'sansli-nota' })).credited).toBe(0);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(100 + 600);
    env.clock.advance(24 * 3600_000);
    expect((await a.call('wallet.local', { ledgerId: 'a4', jeton: 30, reason: 'gorev:x' })).credited).toBe(30);
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
