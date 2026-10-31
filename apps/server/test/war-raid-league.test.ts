import { afterEach, describe, expect, it } from 'vitest';
import { raidDamageFor, warPointsFor } from '@odi/shared';
import type { NetError } from '@odi/net';
import { RAID_GIFT, raidMaxHp } from '../src/raid';
import { WAR_REWARD } from '../src/war';
import { weekInfo, raidWindow } from '../src/time';
import { setup, run, T0, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

describe('zaman', () => {
  it('ISO hafta ve baskın penceresi İstanbul saatine göre', () => {
    const w = weekInfo(T0);
    expect(w.key).toBe('2026-W42');
    expect(new Date(w.startsAt).toISOString()).toBe('2026-10-11T21:00:00.000Z'); // Pzt 00:00 +03
    expect(w.endsAt - w.startsAt).toBe(7 * 86400_000);
    expect(weekInfo(Date.UTC(2027, 0, 1, 12)).key).toBe('2026-W53');
    const r = raidWindow(T0, false);
    expect(r.open).toBe(false);
    expect(new Date(r.opensAt).toISOString()).toBe('2026-10-16T17:00:00.000Z'); // Cuma 20:00 +03
    expect(raidWindow(r.opensAt + 3600_000, false).open).toBe(true);
    const after = raidWindow(r.closesAt + 1, false);
    expect(after.open).toBe(false);
    expect(after.id).toBe('2026-W43');
  });
});

describe('Bölge Savaşı', () => {
  it('hedefler, puan, bölge sahibi değişimi, hafta devri ödülü', async () => {
    env = await setup();
    const [a1, a2, b1, c1] = [await env.connect('Ayşe'), await env.connect('Ali'), await env.connect('Bora'), await env.connect('Cem')];
    const A = (await a1.call('team.create', { name: 'Kepçe Kartalları', emblem: '🦉' })).team;
    await a2.call('team.join', { teamId: A.id });
    const B = (await b1.call('team.create', { name: 'Bas Baykuşları', emblem: '🦉' })).team;
    await c1.call('team.create', { name: 'Hedefsizler', emblem: '🌱' });
    expect((await err(a2.call('war.targets', { regions: ['kepce'] }))).code).toBe('YETKI');
    expect((await err(a1.call('war.targets', { regions: ['kepce', 'kanal', 'zar', 'tepe'] }))).code).toBe('GECERSIZ');
    expect((await err(a1.call('war.targets', { regions: ['yok'] }))).code).toBe('GECERSIZ');
    const tg = await a1.call('war.targets', { regions: ['kepce', 'merkez'] });
    expect(tg.war.targets).toEqual(['kepce', 'merkez']);
    expect((await a2.waitFor('war.updated')).war.targets).toEqual(['kepce', 'merkez']);
    // biyom eşleşen hedef → kepce
    const p1 = await a1.call('progress.submit', run(1, { biome: 'dis-kulak' }));
    expect(p1.warPoints).toBe(warPointsFor({ completed: true, stars: 3, level: 1 }));
    const own = await a2.waitFor('chat', (x) => x.msg.kind === 'war' && x.msg.meta?.region === 'kepce');
    expect(own.msg.text).toContain('Kulak Kepçesi');
    // eşleşmeyen biyom → merkez hedefse merkeze
    await a1.call('progress.submit', run(2, { biome: 'kanal' }));
    let war = (await a1.call('war.state', {})).war;
    expect(war.regions.find((r) => r.id === 'kepce')!.owner).toMatchObject({ teamId: A.id, points: 31 });
    expect(war.regions.find((r) => r.id === 'merkez')!.owner).toMatchObject({ teamId: A.id, points: 31 });
    expect(war.regions.find((r) => r.id === 'kanal')!.owner).toBeNull();
    expect(war).toMatchObject({ week: '2026-W42', teamPoints: 62, myPoints: 62 });
    // hedefi olmayan takım: yalnızca kişisel/takım haftalık puanı
    await c1.call('progress.submit', run(1));
    const cw = (await c1.call('war.state', {})).war;
    expect(cw.myPoints).toBe(31);
    expect(cw.teamPoints).toBe(31);
    expect(cw.regions.every((r) => !r.top.some((s) => s.name === 'Hedefsizler'))).toBe(true);
    // B aynı bölgeyi hedefler: eşitlikte sahip değişmez, geçince değişir
    await b1.call('war.targets', { regions: ['kepce'] });
    await b1.call('progress.submit', run(1));
    war = (await b1.call('war.state', {})).war;
    expect(war.regions.find((r) => r.id === 'kepce')!.owner!.teamId).toBe(A.id);
    a1.drain();
    await b1.call('progress.submit', run(2));
    const wu = await a1.waitFor('war.updated', (x) => x.war.regions.find((r) => r.id === 'kepce')!.owner?.teamId === B.id);
    expect(wu.war.regions.find((r) => r.id === 'kepce')!.top.map((s) => s.name)).toEqual(['Bas Baykuşları', 'Kepçe Kartalları']);
    expect((await a1.waitFor('chat', (x) => x.msg.kind === 'war' && x.msg.text.includes('Bas Baykuşları'))).msg.room).toBe(`takim:${A.id}`);
    // takım ayrıntısında haftalık puanlar
    const det = (await a1.call('team.detail', {})).team!;
    expect(det.weekPoints).toBe(62);
    expect(det.roster.find((m) => m.id === a1.me!.id)!.weekPoints).toBe(62);
    // hafta devri (tembel): Pazartesi 00:00 sonrası ilk erişim
    env.clock.t = weekInfo(T0).endsAt + 3600_000;
    const next = (await b1.call('war.state', {})).war;
    expect(next.week).toBe('2026-W43');
    expect(next.regions.every((r) => r.owner === null)).toBe(true);
    expect(next.myPoints).toBe(0);
    expect(next.targets).toEqual(['kepce']);
    const inbB = (await b1.call('inbox.list', {})).items.filter((i) => i.ref !== 'siralama'); // haftalık sıralama ödülleri ayrı (rank.test.ts)
    expect(inbB.map((i) => [i.kind, i.amount]).sort()).toEqual([['jeton', WAR_REWARD.jeton], ['kristal', WAR_REWARD.kristal]]);
    expect(inbB[0]!.reason).toContain('Kulak Kepçesi');
    // A merkezi tuttu → iki üyeye de ödül
    expect((await a2.call('inbox.list', {})).items.filter((i) => i.reason.includes('Ninni Merkezi'))).toHaveLength(2);
    expect((await c1.call('inbox.list', {})).items.filter((i) => i.ref !== 'siralama')).toHaveLength(0);
  });
});

describe('Baskın', () => {
  it('pencere dışında hasar yok', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await a.call('team.create', { name: 'Avcılar', emblem: '⚡' });
    const p = await a.call('progress.submit', run(1, { mechanic: 'boss' }));
    expect(p.raidDamage).toBe(0);
    const rs = (await a.call('raid.state', {})).raid;
    expect(rs.open).toBe(false);
    expect(rs.maxHp).toBe(raidMaxHp(1));
    env.clock.t = rs.opensAt + 60_000;
    expect((await a.call('progress.submit', run(1, { mechanic: 'boss' }))).raidDamage).toBe(raidDamageFor({ completed: true, stars: 3, mechanic: 'boss' }));
  });

  it('ODI_RAID_ALWAYS: ortak HP düşer, yenilince süre, hediye, sıralama; takım hedefi kademesi', async () => {
    env = await setup({ raidAlways: true });
    const [a, b, x] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Xavi')];
    const t = (await a.call('team.create', { name: 'Canavar Avcıları', emblem: '⚡' })).team;
    await b.call('team.join', { teamId: t.id });
    await x.call('team.create', { name: 'Diğer Takım', emblem: '🛡️' });
    const s0 = (await a.call('raid.state', {})).raid;
    expect(s0).toMatchObject({ open: true, hp: raidMaxHp(2), maxHp: 640, defeatedAt: null });
    // pencere başında sabitlenen HP, sonradan katılımla değişmez
    await x.call('progress.submit', run(1, { mechanic: 'boss', stars: 1 }));
    const per = raidDamageFor({ completed: true, stars: 3, mechanic: 'boss' });
    expect(per).toBe(40);
    const r1 = await a.call('progress.submit', run(1, { mechanic: 'boss' }));
    expect(r1.raidDamage).toBe(40);
    expect((await b.waitFor('raid.updated')).raid.hp).toBe(600);
    let total = 40;
    let who = 0;
    while (total < 640) {
      const c = who++ % 2 ? a : b;
      const r = await c.call('progress.submit', run(1, { mechanic: 'boss' }));
      total += r.raidDamage;
    }
    expect(total).toBe(640);
    const done = (await a.call('raid.state', {})).raid;
    expect(done.hp).toBe(0);
    expect(done.defeatedAt).toBe(env.clock.t);
    expect(done.contributors.reduce((s, c) => s + c.damage, 0)).toBe(640);
    expect(done.ranking[0]).toMatchObject({ teamId: t.id, timeMs: env.clock.t - weekInfo(T0).startsAt, damage: 640 });
    expect(done.ranking[1]).toMatchObject({ name: 'Diğer Takım', timeMs: null });
    // yenildikten sonra hasar yok
    expect((await a.call('progress.submit', run(1, { mechanic: 'boss' }))).raidDamage).toBe(0);
    const gift = await b.waitFor('team.gift', (g) => g.gift.reason.includes('Gürültü Canavarı'));
    expect(gift.gift.contents).toEqual(RAID_GIFT);
    const before = (await b.call('wallet.get', {})).wallet;
    const after = (await b.call('team.gift.claim', { giftId: gift.gift.id })).wallet;
    expect(after.kristal - before.kristal).toBe(30);
    // takım hedefleri: 17 koşu × 3 yıldız = 51 yıldız → "Yıldız Avı" 1. kademe (30)
    const extra = (await a.call('team.extra', {})).extra;
    const yildiz = extra.goals.find((g) => g.metric === 'yildiz')!;
    expect(yildiz.progress).toBe(51);
    expect(yildiz.tiers).toHaveLength(4);
    expect(extra.goals.find((g) => g.metric === 'baskin')!.progress).toBe(640);
    expect(extra.goals.map((g) => g.metric)).toEqual(['yildiz', 'bolum', 'baskin']);
    const j0 = (await b.call('wallet.get', {})).wallet.jeton;
    const cl = await b.call('team.goal.claim', { goalId: yildiz.id, tier: 0 });
    expect(cl.wallet.jeton - j0).toBe(yildiz.tiers[0]!.reward[0]!.amount);
    expect(cl.extra.goals.find((g) => g.metric === 'yildiz')!.claimedTiers).toEqual([0]);
    expect((await err(b.call('team.goal.claim', { goalId: yildiz.id, tier: 0 }))).code).toBe('TEKRAR');
    expect((await err(b.call('team.goal.claim', { goalId: yildiz.id, tier: 2 }))).code).toBe('SART');
    // ödülü gelmeden katılan üye kademe ödülü alamaz
    b.drain();
    const late = await env.connect('Geç');
    await late.call('team.join', { teamId: t.id });
    expect((await err(late.call('team.goal.claim', { goalId: yildiz.id, tier: 0 }))).code).toBe('YOK');
  });
});

describe('Lig', () => {
  it('30 kişilik gruplar, katılım sırası; hafta sonunda ilk 7 yükselir', async () => {
    env = await setup();
    const players = [];
    for (let i = 0; i < 31; i++) players.push(await env.connect(`Oyuncu ${i}`));
    for (const p of players) await p.call('league.state', {});
    const s0 = (await players[0]!.call('league.state', {})).league;
    expect(s0.group).toHaveLength(30);
    expect(s0).toMatchObject({ tier: 'bronz', week: '2026-W42', promoteTop: 7, demoteBottom: 5 });
    const last = (await players[30]!.call('league.state', {})).league;
    expect(last.group).toHaveLength(1);
    // puanlar: ilk 9 oyuncu oynar; i. oyuncu i+1 bölüm
    for (let i = 0; i < 9; i++) for (let k = 0; k <= i; k++) await players[i]!.call('progress.submit', run(1, { stars: 2 }));
    const st = (await players[8]!.call('league.state', {})).league;
    expect(st.rank).toBe(1);
    expect(st.points).toBe(9 * 15);
    expect(st.group[0]!.id).toBe(players[8]!.me!.id);
    // yarış derecesi olmayan tamamlanmamış koşu da 1 puan
    expect((await players[29]!.call('progress.submit', run(1, { completed: false, stars: 0 }))).leaguePoints).toBe(1);
    env.clock.t = weekInfo(T0).endsAt + 1;
    const promoted = await Promise.all(players.slice(0, 10).map(async (p) => (await p.call('league.state', {})).league.tier));
    expect(promoted).toEqual(['bronz', 'bronz', 'gumus', 'gumus', 'gumus', 'gumus', 'gumus', 'gumus', 'gumus', 'bronz']);
    const g = (await players[8]!.call('league.state', {})).league;
    expect(g).toMatchObject({ tier: 'gumus', week: '2026-W43', points: 0 });
    // tek kişilik grubun tek oyuncusu da ilk 7'de
    expect((await players[30]!.call('league.state', {})).league.tier).toBe('gumus');
  });
});
