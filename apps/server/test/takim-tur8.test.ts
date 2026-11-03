import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { addGoalProgress } from '../src/teamextra';
import { setup, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
/** istemcinin Hedefler rozeti (apps/web teamTabs.claimableTierCount ile aynı kural) */
const claimable = (g: { progress: number; tiers: { need: number }[]; claimedTiers: number[]; missedTiers?: number[] }) =>
  g.tiers.flatMap((t, i) => (g.progress >= t.need && !g.claimedTiers.includes(i) && !g.missedTiers?.includes(i) ? [i] : []));

describe('oyuncu testi tur 8: takım', () => {
  it('katılmadan önce dolan kademe hak edilmedi olarak gelir ve rozete sayılmaz; sonra dolan kademe yeni üyenin (YN-146)', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const t = (await a.call('team.create', { name: 'Yıldızlar', emblem: '👑' })).team;
    addGoalProgress(env.srv.app, t.id, 'yildiz', 100); // 1. (30) ve 2. (90) kademe dolar: ödül yalnız Ayşe'ye
    await b.call('team.join', { teamId: t.id });
    const yB = (await b.call('team.extra', {})).extra.goals.find((g) => g.metric === 'yildiz')!;
    expect(yB.missedTiers).toEqual([0, 1]);
    expect(claimable(yB)).toEqual([]);
    // eski oyuncu: hak ettiği kademelerde missedTiers yok, ikisi de alınabilir
    const yA = (await a.call('team.extra', {})).extra.goals.find((g) => g.metric === 'yildiz')!;
    expect(yA.missedTiers).toBeUndefined();
    expect(claimable(yA)).toEqual([0, 1]);
    // dolmamış hedeflerde alan hiç yok (geriye uyumlu)
    expect((await b.call('team.extra', {})).extra.goals.find((g) => g.metric === 'bolum')!.missedTiers).toBeUndefined();
    // sunucu kuralı aynı: hak edilmeyen kademe alınamaz
    expect((await err(b.call('team.goal.claim', { goalId: yB.id, tier: 0 }))).code).toBe('YOK');
    // 3. kademe (180) Bora takımdayken dolar: ona da düşer, rozete sayılır ve alınır
    addGoalProgress(env.srv.app, t.id, 'yildiz', 100);
    const yB2 = (await b.call('team.extra', {})).extra.goals.find((g) => g.metric === 'yildiz')!;
    expect(yB2.missedTiers).toEqual([0, 1]);
    expect(claimable(yB2)).toEqual([2]);
    const cl = await b.call('team.goal.claim', { goalId: yB2.id, tier: 2 });
    expect(cl.extra.goals.find((g) => g.metric === 'yildiz')!.claimedTiers).toEqual([2]);
  });

  it('kalan günlük yardım hakkı takım ayrıntısında ve istek yanıtında; 3 istekten sonra 0, ertesi gün yeniden 3 (YN-147)', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const t = (await a.call('team.create', { name: 'Yardımlaşma', emblem: '👑' })).team;
    expect(t.helpLeft).toBe(3);
    expect(t.helpResetAt).toBeGreaterThan(env.clock.t);
    await b.call('team.join', { teamId: t.id });
    expect((await a.call('team.help.request', { level: 1 })).helpLeft).toBe(2);
    expect((await a.call('team.help.request', { level: 1 })).helpLeft).toBe(1);
    expect((await a.call('team.help.request', { level: 1 })).helpLeft).toBe(0);
    expect((await a.call('team.detail', {})).team!.helpLeft).toBe(0);
    expect((await err(a.call('team.help.request', { level: 1 }))).code).toBe('LIMIT');
    // hak kişiye özel: Bora'nın hakkı yerinde; yayınlanan takım ayrıntısı da her üyeye kendi hakkını taşır
    expect((await b.call('team.detail', {})).team!.helpLeft).toBe(3);
    a.drain(); b.drain();
    await a.call('team.role', { id: b.me!.id, role: 'yardimci' });
    expect((await a.waitFor('team.updated', (x) => !!x.team)).team!.helpLeft).toBe(0);
    expect((await b.waitFor('team.updated', (x) => !!x.team)).team!.helpLeft).toBe(3);
    // başka takımın ayrıntısında kişisel alan yok
    const c = await env.connect('Cem');
    expect((await c.call('team.detail', { teamId: t.id })).team!.helpLeft).toBeUndefined();
    const reset = (await a.call('team.detail', {})).team!.helpResetAt!;
    env.clock.t = reset;
    expect((await a.call('team.detail', {})).team!.helpLeft).toBe(3);
  });

  it('lider ayrılınca yeni lidere kişisel kart bir kez; yeniden girişte de gelir, görülünce bir daha gelmez (YN-148)', async () => {
    env = await setup();
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const t = (await a.call('team.create', { name: 'Devir Takımı', emblem: '👑' })).team;
    expect(t.leaderNotice).toBeUndefined();
    await b.call('team.join', { teamId: t.id });
    await c.call('team.join', { teamId: t.id });
    b.drain(); c.drain();
    await a.call('team.leave', {});
    // en kıdemli üye Bora lider olur: yalnız ona kart
    expect((await b.waitFor('team.updated', (x) => !!x.team?.leaderNotice)).team!.leaderNotice).toBe(true);
    expect((await c.call('team.detail', {})).team!.leaderNotice).toBeUndefined();
    // bir sonraki girişte de gelir (kalıcı bayrak)
    const token = b.token; b.close();
    const b2 = await env.connect('Bora', token);
    expect((await b2.call('team.detail', {})).team!.leaderNotice).toBe(true);
    // görüldü: bir daha gelmez
    await b2.call('team.leader.seen', {});
    expect((await b2.call('team.detail', {})).team!.leaderNotice).toBeUndefined();
    // liderliği kendisi devreden ya da devralan için kart yok (bunu kendisi yaptı / sohbette adıyla yazar)
    await b2.call('team.role', { id: c.me!.id, role: 'lider' });
    expect((await c.call('team.detail', {})).team!.leaderNotice).toBeUndefined();
    // kartı görmeden ayrılan ya da liderliği bırakan oyuncuda bayrak kalmaz
    await c.call('team.leave', {}); // Bora yeniden lider (kendiliğinden): kart yeniden gelir
    expect((await b2.call('team.detail', {})).team!.leaderNotice).toBe(true);
    await b2.call('team.leave', {}); // son üye: takım silinir
    expect(env.srv.app.player(b2.me!.id).lead_notice).toBe(0);
  });

  it('hesabını silen liderin adı karta ya da bayrağa yazılmaz; devralan kartı görür (YN-148)', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const t = (await a.call('team.create', { name: 'Silinen Lider', emblem: '👑' })).team;
    await b.call('team.join', { teamId: t.id });
    await a.call('account.delete', {});
    const d = (await b.call('team.detail', {})).team!;
    expect(d.leaderNotice).toBe(true);
    expect(JSON.stringify(d)).not.toContain('Ayşe');
  });
});
