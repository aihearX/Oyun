import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { setup, run, type Env, type TC } from './helpers';
import { rankOnRun } from '../src/rank';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const board = (c: TC, b: string, scope = 'herkes') => c.call('rank.board', { board: b as never, scope: scope as never }).then((r) => r.view);
const inbox = async (c: TC, ref = 'siralama') => (await c.call('inbox.list', {})).items.filter((i) => i.ref === ref);

describe('Sıralama', () => {
  it('güç şeffaf formülle ve yalnızca doğrulanmış koşulardan; çevrimdışı eşitleme sayılmaz', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    await a.call('progress.submit', run(1, { stars: 3 }));
    await a.call('progress.submit', run(2, { stars: 2 }));
    // Bora cihazdan "40 bölüm 3 yıldız" eşitler: güce SAYILMAZ (istemci bildirimi)
    await b.call('progress.sync', { best: Array.from({ length: 10 }, (_, i) => ({ level: i + 1, stars: 3, score: 900 })) });
    const v = await board(a, 'guc');
    // 5 yıldız × 10 + 2 bölüm × 20 + kamp (merkez 1) × 15
    expect(v.rows).toEqual([expect.objectContaining({ rank: 1, name: 'Ayşe', value: 105, me: true })]);
    expect(v.total).toBe(1);
    expect((await board(b, 'guc')).me).toBeNull();
    expect((await err(a.call('rank.board', { board: 'yok' as never, scope: 'herkes' }))).code).toBe('GECERSIZ');
  });

  it('haftalık yıldız yalnızca yeni yıldız; nota günlük sınırlı; yarış galibiyeti günlük sınırlı; aynı koşu bir kez', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const r1 = run(1, { stars: 3, coins: 400 });
    await a.call('progress.submit', r1); await a.call('progress.submit', r1);
    await a.call('progress.submit', run(1, { stars: 3, coins: 400 })); // tekrar: yıldız 0
    await a.call('progress.submit', run(2, { stars: 2, coins: 400 }));
    await a.call('progress.submit', run(2, { stars: 3, coins: 400 })); // 2 → 3: +1
    for (let i = 0; i < 3; i++) await a.call('progress.submit', run(3, { completed: false, stars: 0, coins: 400 }));
    expect((await board(a, 'yildiz')).me).toMatchObject({ value: 6 });
    expect((await board(a, 'nota')).me).toMatchObject({ value: 2000 });
    const app = env.srv.app;
    for (let i = 0; i < 12; i++) app.run(() => rankOnRun(app, a.me!.id, { level: 1, completed: true, stars: 0, coins: 0 }, true));
    expect((await board(a, 'yaris')).me).toMatchObject({ value: 10 });
    // ertesi gün nota sınırı yenilenir
    env.clock.advance(24 * 3_600_000);
    await a.call('progress.submit', run(2, { coins: 300 }));
    expect((await board(a, 'nota')).me).toMatchObject({ value: 2300 });
  });

  it('kapsamlar: herkes, arkadaşlar, yakınım (±5); kendi satırım sabit; ▲▼ gün başına göre', async () => {
    env = await setup();
    const ps: TC[] = [];
    for (let i = 0; i < 14; i++) ps.push(await env.connect(`Oyuncu${String(i).padStart(2, '0')}`));
    // i. oyuncu i+1 bölüm geçer (güç artan)
    for (let i = 0; i < 14; i++) for (let l = 1; l <= i + 1; l++) await ps[i]!.call('progress.submit', run(l, { stars: 1 }));
    const me = ps[6]!; // 7 bölüm → sırası 8
    const all = await board(me, 'guc');
    expect(all.rows.map((r) => r.rank)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(all.me).toMatchObject({ rank: 8, name: 'Oyuncu06', delta: 0 });
    const near = await board(me, 'guc', 'yakin');
    expect(near.rows.map((r) => r.rank)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    await me.call('friends.add', { code: ps[0]!.me!.friendCode }); await ps[0]!.call('friends.add', { code: me.me!.friendCode });
    expect((await board(me, 'guc', 'arkadas')).rows.map((r) => r.name)).toEqual(['Oyuncu06', 'Oyuncu00']);
    // gün içinde Oyuncu00 iki sıra atlar: ▲ +? (gün başı kaydına göre)
    for (let l = 2; l <= 9; l++) await ps[0]!.call('progress.submit', run(l, { stars: 3 }));
    const after = (await board(ps[0]!, 'guc')).me!;
    expect(after.rank).toBeLessThan(14);
    // önbellek 15 sn: değişim ancak tazelenince görünür; delta = gün başı sırası − şimdiki sıra
    expect(after.delta).toBe(14 - after.rank);
  });

  it('hafta kapanınca son sıralama saklanır, ödüller bir kez verilir, takıma duyurulur; geçen haftanın rozeti', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await b.call('team.join', { teamId: t.id });
    await a.call('progress.submit', run(1, { stars: 3 }));
    await b.call('progress.submit', run(1, { stars: 2 }));
    await c.call('progress.submit', run(1, { stars: 1 }));
    const pre = await board(a, 'yildiz');
    expect(pre.rows.map((r) => [r.rank, r.name, r.value])).toEqual([[1, 'Ayşe', 3], [2, 'Bora', 2], [3, 'Cem', 1]]);
    expect((await board(a, 't-savas')).rows[0]).toMatchObject({ name: 'Kulaklar', emblem: '👂', me: true });
    // yeni hafta (Pazartesi 00:00 İstanbul): ilk erişimde kapanış
    env.clock.advance(7 * 24 * 3_600_000);
    a.drain();
    const fresh = await board(a, 'yildiz');
    expect(fresh.rows).toHaveLength(0);
    expect(fresh.last!.rows.map((r) => [r.rank, r.name])).toEqual([[1, 'Ayşe'], [2, 'Bora'], [3, 'Cem']]);
    const ai = await inbox(a); const bi = await inbox(b); const ci = await inbox(c);
    // Ayşe: yıldız 1. (50) + nota 1.? (her tabloda kendi sırası) + takım tabloları (Kulaklar 1.: 20)
    expect(ai.some((i) => i.amount === 50 && i.reason.includes('Haftalık yıldız'))).toBe(true);
    expect(bi.some((i) => i.amount === 30 && i.reason.includes('Haftalık yıldız'))).toBe(true);
    expect(ci.some((i) => i.amount === 20 && i.reason.includes('Haftalık yıldız'))).toBe(true);
    expect(bi.some((i) => i.amount === 20 && i.reason.includes('Bölge Savaşı'))).toBe(true);
    // ikinci erişim / ikinci kapanış denemesi ödül vermez
    const n = (await inbox(a)).length;
    await board(a, 'nota'); env.srv.sweep();
    expect((await inbox(a)).length).toBe(n);
    // duyuru: takım sohbetinde takım kapanış mesajı + oyuncu akış kartı
    const h = (await a.call('chat.join', { room: `takim:${t.id}` })).history;
    expect(h.some((m) => m.meta?.event === 'sira' && m.text.includes('Bölge Savaşı'))).toBe(true);
    expect(h.some((m) => m.kind === 'feed' && m.meta?.type === 'sira' && m.text.startsWith('Ayşe'))).toBe(true);
    // geçen haftanın rozeti bu haftanın tablosunda görünür
    await a.call('progress.submit', run(2, { stars: 1 }));
    expect((await board(a, 'yildiz')).me).toMatchObject({ badge: 1 });
  });
});

describe('Sıralamadan takıma davet', () => {
  it('yalnızca kendi takımına; metni ve kodu sunucu yazar; serbest yazı kapalıyken davet metni de hazır', async () => {
    env = await setup({ freeTextCleared: 8 });
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await a.call('friends.add', { code: b.me!.friendCode }); await b.call('friends.add', { code: a.me!.friendCode });
    const send = (c: TC, to: string, meta: Record<string, string>, text = 'serbest metin buraya') => c.call('dm.send', { to, text, kind: 'davet', meta });
    // başka takımın kimliğiyle davet olmaz
    expect((await err(send(b, a.me!.id, { type: 'takim', roomId: t.id }))).code).toBe('YETKI');
    const m = (await send(a, b.me!.id, { type: 'takim', roomId: t.id }, 'kötü söz yazmaya çalışıyorum')).msg;
    expect(m.text).toBe(`👂 Kulaklar takımına katılmak ister misin? Kod: ${t.code}`);
    expect(m.meta).toMatchObject({ type: 'takim', roomId: t.id, code: t.code, title: 'Takım daveti' });
    // serbest yazı kapalı: başka davetlerin metnini de sunucu yazar
    env.clock.advance(10_000);
    const r = (await send(a, b.me!.id, { type: 'ralli', roomId: 'r1' }, 'istediğim her şey')).msg;
    expect(r.text).toBe('Takım rallisine katıl!');
    // davetle katılım; ikinci davet: zaten takımda
    await b.call('team.join', { code: String(m.meta!.code) });
    env.clock.advance(10_000);
    expect((await err(send(a, b.me!.id, { type: 'takim', roomId: t.id }))).code).toBe('GECERSIZ');
  });
});
