import { afterEach, describe, expect, it } from 'vitest';
import { buildCost, crystalsToFinish, techCost } from '@odi/shared';
import type { NetError } from '@odi/net';
import { setup, run, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const b = (camp: { buildings: { id: string; level: number; upgradingTo: number | null; endsAt: number | null; helpsReceived: number }[] }, id: string) => camp.buildings.find((x) => x.id === id)!;

describe('Kulak Kampı', () => {
  it('inşaat: jeton düşer, süre başlar, tek inşaat, merkez sınırı, zamanla tamamlanır', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const s0 = await a.call('camp.state', {});
    expect(b(s0.camp, 'merkez').level).toBe(1);
    expect(s0.wallet.jeton).toBe(100);
    const up = await a.call('camp.upgrade', { id: 'laboratuvar' });
    expect(up.wallet.jeton).toBe(100 - buildCost('laboratuvar', 1).jeton);
    expect(b(up.camp, 'laboratuvar').endsAt).toBe(env.clock.t + buildCost('laboratuvar', 1).seconds * 1000);
    expect((await err(a.call('camp.upgrade', { id: 'depo' }))).code).toBe('MESGUL');
    env.clock.advance(buildCost('laboratuvar', 1).seconds * 1000);
    // zamanlayıcı ile tamamlanma → camp.updated
    env.srv.sweep();
    const ev = await a.waitFor('camp.updated');
    expect(b(ev.camp, 'laboratuvar').level).toBe(1);
    // merkez seviyesi diğer binaları sınırlar
    for (let i = 0; i < 3; i++) await a.call('progress.submit', run(1, { coins: 400 }));
    expect((await err(a.call('camp.upgrade', { id: 'laboratuvar' }))).code).toBe('SART');
    expect((await a.call('camp.upgrade', { id: 'merkez' })).camp.buildings.find((x) => x.id === 'merkez')!.upgradingTo).toBe(2);
  });

  it('takım yardımı süreyi kısaltır, hızlandırıcı ve kristal bitirir; yardım edene günlük 2 jeton', async () => {
    env = await setup();
    const [a, h1, h2] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const t = (await a.call('team.create', { name: 'Kampçılar', emblem: '🍀' })).team;
    await h1.call('team.join', { teamId: t.id });
    await h2.call('team.join', { teamId: t.id });
    for (let i = 0; i < 2; i++) await a.call('progress.submit', run(1, { coins: 400 }));
    const up = await a.call('camp.upgrade', { id: 'merkez' });
    const cost = buildCost('merkez', 2);
    const end0 = b(up.camp, 'merkez').endsAt!;
    expect(end0 - env.clock.t).toBe(cost.seconds * 1000);
    // yardım istenmeden yardım edilemez
    expect((await err(h1.call('team.camp.help', { playerId: a.me!.id, building: 'merkez' }))).code).toBe('GECERSIZ');
    await a.call('camp.help.request', { id: 'merkez' });
    const need = await h1.waitFor('team.campHelpNeeded', (x) => x.requests.length === 1);
    expect(need.requests[0]).toMatchObject({ playerId: a.me!.id, building: 'merkez', helpsReceived: 0, helpsMax: 5 });
    const j0 = (await h1.call('wallet.get', {})).wallet.jeton;
    expect((await h1.call('team.camp.help', { playerId: a.me!.id, building: 'merkez' })).given).toBe(1);
    expect((await h1.call('wallet.get', {})).wallet.jeton).toBe(j0 + 2);
    expect((await err(h1.call('team.camp.help', { playerId: a.me!.id, building: 'merkez' }))).code).toBe('TEKRAR');
    expect((await a.waitFor('camp.helped')).seconds).toBe(60); // max(60, %1)
    expect((await h2.call('team.camp.helpAll', {})).given).toBe(1);
    const st = await a.call('camp.state', {});
    expect(b(st.camp, 'merkez').endsAt).toBe(end0 - 120_000);
    expect(b(st.camp, 'merkez').helpsReceived).toBe(2);
    // test mağazası: 10 × m5 + 300 kristal
    await a.call('shop.limit', { limitTry: 100 });
    await a.call('shop.purchase', { productId: 'odi.baslangic', store: 'test' });
    const sp = await a.call('camp.speedup', { id: 'merkez', item: 'm5', count: 1 });
    expect(sp.wallet.hizlandirici.m5).toBe(9);
    // 386 − 2×60 = 266 sn kalmıştı: bir 5 dk hızlandırıcı bitirir
    expect(cost.seconds - 120).toBeLessThan(300);
    expect(b(sp.camp, 'merkez').level).toBe(2);
    expect(b(sp.camp, 'merkez').upgradingTo).toBeNull();
    // kristalle bitirme: kalan dakika başına 1 kristal
    const lab = await a.call('camp.upgrade', { id: 'laboratuvar' });
    env.clock.advance(15_000);
    const remaining = Math.ceil((b(lab.camp, 'laboratuvar').endsAt! - env.clock.t) / 1000);
    const kr = await a.call('camp.speedup', { id: 'laboratuvar', item: 'kristal' });
    expect(kr.wallet.kristal).toBe(300 - crystalsToFinish(remaining));
    expect(b(kr.camp, 'laboratuvar').level).toBe(1);
  });

  it('depo: seviye × 20/saat, en çok 8 saat birikir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await a.call('camp.upgrade', { id: 'depo' });
    env.clock.advance(buildCost('depo', 1).seconds * 1000);
    expect((await a.call('camp.collect', {})).collected).toBe(0);
    env.clock.advance(3 * 3600_000);
    const c1 = await a.call('camp.collect', {});
    expect(c1.collected).toBe(60);
    env.clock.advance(30 * 60_000);
    expect((await a.call('camp.collect', {})).collected).toBe(10);
    env.clock.advance(20 * 3600_000);
    const c3 = await a.call('camp.collect', {});
    expect(c3.collected).toBe(160);
    expect(c3.wallet.jeton).toBe(100 - buildCost('depo', 1).jeton + 60 + 10 + 160);
  });
});

describe('takım teknolojisi', () => {
  it('bağış teknolojiyi yükseltir; jeton/inşaat/yardım etkileri sunucu hesabına yansır', async () => {
    env = await setup();
    const [a, m] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const t = (await a.call('team.create', { name: 'Bilim Takımı', emblem: '🧭' })).team;
    await m.call('team.join', { teamId: t.id });
    expect((await a.call('progress.submit', run(1, { coins: 100 }))).jeton).toBe(100);
    await a.call('progress.submit', run(2, { coins: 400 }));
    await a.call('progress.submit', run(3, { coins: 400 }));
    expect((await err(a.call('team.donate', { tech: 'jeton', jeton: 5000 }))).code).toBe('YETERSIZ');
    const d = await a.call('team.donate', { tech: 'jeton', jeton: techCost(0) + 10 });
    const tech = d.extra.tech.find((x) => x.id === 'jeton')!;
    expect(tech).toMatchObject({ level: 1, progress: 10, cost: techCost(1) });
    expect(d.wallet.jeton).toBe(100 + 100 + 400 + 400 - techCost(0) - 10);
    expect((await m.waitFor('chat', (x) => x.msg.text.includes('Ortak Kazanç 1. seviye'))).msg.kind).toBe('system');
    const ext = await m.waitFor('team.extra.updated', (x) => x.extra.tech.some((y) => y.id === 'jeton' && y.level === 1));
    expect(ext.extra.contributionWeek[0]).toMatchObject({ id: a.me!.id, donated: techCost(0) + 10 });
    expect(ext.extra.xp).toBeGreaterThan(0);
    // +%3 jeton (takım) — diğer üyede de geçerli
    expect((await m.call('progress.submit', run(1, { coins: 100 }))).jeton).toBe(103);
    // laboratuvar 1 → +%3 daha
    await a.call('camp.upgrade', { id: 'laboratuvar' });
    env.clock.advance(60_000);
    expect((await a.call('progress.submit', run(4, { coins: 100 }))).jeton).toBe(106);
    // jeton tavanı: 400 üstü reddedilir (şema); 400 → 400 × 1.06
    expect((await a.call('progress.submit', run(4, { coins: 400 }))).jeton).toBe(424);
    // inşaat teknolojisi: süre −%2/seviye
    const j = (await a.call('wallet.get', {})).wallet.jeton;
    await a.call('team.donate', { tech: 'insaat', jeton: Math.min(j, techCost(0)) });
    const lvl = (await a.call('team.extra', {})).extra.tech.find((x) => x.id === 'insaat')!.level;
    expect(lvl).toBe(1);
    await m.call('progress.submit', run(2, { coins: 400 }));
    const up = await m.call('camp.upgrade', { id: 'depo' });
    const depo = up.camp.buildings.find((x) => x.id === 'depo')!;
    expect(depo.endsAt! - env.clock.t).toBe(Math.round(buildCost('depo', 1).seconds * 0.98) * 1000);
  });
});
