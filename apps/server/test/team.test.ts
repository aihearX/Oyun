import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { setup, run, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

describe('takım', () => {
  it('oluştur, listele/ara, kodla katıl, rol, at, ayrıl ve liderlik devri, son kişiyle silinme', async () => {
    env = await setup();
    const [a, b, c, d] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem'), await env.connect('Deniz')];
    expect((await err(a.call('team.create', { name: 'xy', emblem: '👂' }))).code).toBe('ISIM');
    expect((await err(a.call('team.create', { name: 'Kulaklar', emblem: 'AB' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('team.create', { name: 'Kulaklar', emblem: '👂', minLevel: 5 }))).code).toBe('SART');
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂', description: 'Birlikte!' })).team;
    expect(t.roster).toHaveLength(1);
    expect(t.roster[0]!.role).toBe('lider');
    expect((await err(b.call('team.create', { name: 'KULAKLAR', emblem: '🦻' }))).code).toBe('ISIM');
    const closed = (await b.call('team.create', { name: 'Gizli Kulüp', emblem: '🎧', open: false })).team;
    // liste: tüm takımlar (açık + başvuruyla), takım gücü sırası; davet kodu üye olmayana gösterilmez
    await a.call('progress.submit', run(1));
    const list = (await d.call('team.list', {})).teams;
    expect(list.map((x) => x.name)).toEqual(['Kulaklar', 'Gizli Kulüp']);
    expect(list[0]!.power).toBe(3);
    expect(list.map((x) => x.joinMode)).toEqual(['acik', 'basvuru']);
    expect(list.every((x) => x.code === '')).toBe(true);
    expect((await d.call('team.list', { query: 'kula' })).teams).toHaveLength(1);
    expect((await d.call('team.list', { query: 'yok' })).teams).toHaveLength(0);
    // başvuruyla üye alan takıma id ile doğrudan girilemez, kodla girilir
    expect((await err(d.call('team.join', { teamId: closed.id }))).code).toBe('BASVURU');
    const viaCode = await d.call('team.join', { code: closed.code.toLowerCase() });
    expect(viaCode.team.members).toBe(2);
    await d.call('team.leave', {});
    // katılım + team.updated olayı
    await c.call('team.join', { teamId: t.id });
    await d.call('team.join', { teamId: t.id });
    const upd = await a.waitFor('team.updated', (x) => x.team?.members === 3);
    expect(upd.team!.roster.map((m) => m.name).sort()).toEqual(['Ayşe', 'Cem', 'Deniz']);
    // roller ve atma yetkisi
    expect((await err(c.call('team.kick', { id: d.me!.id }))).code).toBe('YETKI');
    expect((await err(c.call('team.role', { id: d.me!.id, role: 'yardimci' }))).code).toBe('YETKI');
    await a.call('team.role', { id: c.me!.id, role: 'yardimci' });
    await a.call('team.role', { id: d.me!.id, role: 'yardimci' });
    expect((await err(c.call('team.kick', { id: d.me!.id }))).code).toBe('YETKI'); // yardımcı yardımcıyı atamaz
    await a.call('team.role', { id: d.me!.id, role: 'uye' });
    const afterKick = await c.call('team.kick', { id: d.me!.id });
    expect(afterKick.team.members).toBe(2);
    expect((await d.waitFor('team.updated', (x) => x.team === null)).team).toBeNull();
    // lider ayrılınca en kıdemli yardımcıya devreder
    await d.call('team.join', { teamId: t.id });
    await a.call('team.leave', {});
    const det = (await c.call('team.detail', {})).team!;
    expect(det.roster.find((m) => m.id === c.me!.id)!.role).toBe('lider');
    const hist = await c.call('chat.join', { room: `takim:${t.id}` });
    expect(hist.history.map((m) => m.text)).toContain('Yeni lider: Cem.');
    // c ayrılınca d (en kıdemli üye) lider olur; d de ayrılınca takım silinir
    await c.call('team.leave', {});
    expect((await d.call('team.detail', {})).team!.roster[0]!.role).toBe('lider');
    await d.call('team.leave', {});
    expect((await a.call('team.detail', { teamId: t.id })).team).toBeNull();
    expect((await a.call('team.list', { query: 'Kulaklar' })).teams).toHaveLength(0);
  });

  it('en fazla 30 üye', async () => {
    env = await setup();
    const lead = await env.connect('Lider');
    const t = (await lead.call('team.create', { name: 'Kalabalık', emblem: '🎺' })).team;
    for (let i = 0; i < 29; i++) { const c = await env.connect(`Üye ${i}`); await c.call('team.join', { teamId: t.id }); }
    const late = await env.connect('Geç Kalan');
    expect((await err(late.call('team.join', { teamId: t.id }))).code).toBe('DOLU');
  });

  it('bölüm yardımı: kalkan ödül kutusuna, yardım edene 5 jeton, günde 3 istek', async () => {
    env = await setup();
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const t = (await a.call('team.create', { name: 'Yardımlaşma', emblem: '🤝' })).team;
    await b.call('team.join', { teamId: t.id });
    await c.call('team.join', { teamId: t.id });
    expect((await err(a.call('team.help.request', { level: 5 }))).code).toBe('GECERSIZ');
    const req = (await a.call('team.help.request', { level: 1 })).request;
    expect(req).toMatchObject({ from: a.me!.id, name: 'Ayşe', level: 1, helpers: [], max: 5 });
    expect((await b.waitFor('team.help')).request.id).toBe(req.id);
    expect((await b.waitFor('chat', (x) => x.msg.kind === 'help')).msg.meta).toMatchObject({ requestId: req.id });
    expect((await err(a.call('team.help.give', { requestId: req.id }))).code).toBe('GECERSIZ');
    const jetonBefore = (await b.call('wallet.get', {})).wallet.jeton;
    const given = await b.call('team.help.give', { requestId: req.id });
    expect(given.request.helpers).toEqual([b.me!.id]);
    expect((await b.call('wallet.get', {})).wallet.jeton).toBe(jetonBefore + 5);
    expect((await err(b.call('team.help.give', { requestId: req.id }))).code).toBe('TEKRAR');
    await c.call('team.help.give', { requestId: req.id });
    const inbox = (await a.call('inbox.list', {})).items;
    expect(inbox.map((i) => i.kind)).toEqual(['kalkan', 'kalkan']);
    expect(inbox[0]!.reason).toContain('kalkan');
    await a.call('inbox.claim', { id: inbox[0]!.id });
    expect((await err(a.call('inbox.claim', { id: inbox[0]!.id }))).code).toBe('YOK');
    expect(env.srv.app.player(a.me!.id).shields).toBe(1);
    await a.call('team.help.request', { level: 1 });
    await a.call('team.help.request', { level: 1 });
    expect((await err(a.call('team.help.request', { level: 1 }))).code).toBe('LIMIT');
    env.clock.advance(24 * 3600_000);
    await a.call('team.help.request', { level: 1 });
    // katkı tablosu yardımları sayar
    const extra = (await a.call('team.extra', {})).extra;
    expect(extra.contributionWeek.find((x) => x.id === b.me!.id)!.helps).toBe(1);
  });
});
