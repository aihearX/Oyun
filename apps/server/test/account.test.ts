import { afterEach, describe, expect, it } from 'vitest';
import { DELETED_PLAYER_NAME } from '@odi/shared';
import { run, setup, type Env, type TC } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
async function befriend(a: TC, b: TC) {
  const r = await a.call('friends.request', { id: b.me!.id });
  await b.call('friends.respond', { requestId: r.request!.id, accept: true });
}

describe('hesabı silme (account.delete)', () => {
  it('takımdan çıkar (liderlik devreder), arkadaşlık/özel mesaj/sohbet silinir, ad anonim, anahtar geçersiz, sıralama ve aramada yok', async () => {
    env = await setup({ freeTextCleared: 0 });
    const app = env.srv.app;
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    const aid = a.me!.id;
    await a.call('progress.submit', run(1, { stars: 3 }));
    await c.call('progress.submit', run(1, { stars: 1 }));
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await b.call('team.join', { teamId: t.id });
    await befriend(a, c);
    env.clock.advance(1000);
    await a.call('dm.send', { to: c.me!.id, text: 'selam Cem' });
    await a.call('chat.send', { room: `takim:${t.id}`, text: 'takıma selam' });
    expect((await c.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => r.name)).toContain('Ayşe');
    c.drain();

    expect(await a.call('account.delete', {})).toEqual({ deleted: true });
    // aynı bağlantıyla silinen hesap adına işlem yapılamaz
    await expect(a.call('wallet.get', {})).rejects.toMatchObject({ code: 'OTURUM' });

    // takım: Bora kaldı ve lider oldu
    const team = (await b.call('team.detail', {})).team!;
    expect(team.roster.map((m) => m.id)).toEqual([b.me!.id]);
    expect(team.roster[0]!.role).toBe('lider');
    // arkadaş: Cem'e bildirildi, listeden düştü; özel mesaj konuşması yok
    expect((await c.waitFor('friend.removed')).id).toBe(aid);
    expect((await c.call('friends.list', {})).friends).toEqual([]);
    expect((await c.call('dm.threads', {})).threads).toEqual([]);
    // sohbet mesajı silindi
    expect(app.db.all('SELECT 1 AS x FROM chat WHERE from_id = ?', aid)).toEqual([]);
    // ad anonim, aramada ve sıralamada yok
    expect(app.player(aid).name).toBe(DELETED_PLAYER_NAME);
    expect((await c.call('players.search', { query: 'Silinmiş' })).players).toEqual([]);
    expect((await c.call('players.search', { query: 'Ayşe' })).players).toEqual([]);
    expect((await c.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => r.name)).toEqual(['Cem']);
    // eski anahtar artık tanınmaz: istemci yeni hesapla başlar
    const again = await env.connect(undefined, a.token);
    expect(again.me!.id).not.toBe(aid);
    expect(app.db.get('SELECT player_id FROM deleted_players WHERE player_id = ?', aid)).toEqual({ player_id: aid });
  });

  it('takımın son üyesi silinince takım da silinir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const t = (await a.call('team.create', { name: 'Tekler', emblem: '👂' })).team;
    await a.call('account.delete', {});
    expect(env.srv.app.db.get('SELECT 1 AS x FROM teams WHERE id = ?', t.id)).toBeUndefined();
  });

  it('/saglik players silinen hesabı saymaz (uzak denetim D5: sayı başlangıçtaki değere döner)', async () => {
    env = await setup();
    const saglik = async () => (await (await fetch(env!.srv.httpUrl + '/saglik')).json()) as { players: number };
    const a = await env.connect('Ayşe');
    const b = await env.connect('Bora');
    expect((await saglik()).players).toBe(2);
    await b.call('account.delete', {});
    expect((await saglik()).players).toBe(1);
    await a.call('account.delete', {});
    expect((await saglik()).players).toBe(0);
  });
});

describe('IP başına yeni hesap sınırı (ODI_NEW_PER_IP_HOUR)', () => {
  it('kapalıyken sınırsız; açıkken saatte N yeni hesap, sonra HIZ; anahtarlı giriş etkilenmez; saat geçince açılır', async () => {
    const { allowNewAccount } = await import('../src/players');
    env = await setup({ newAccountsPerIpHour: 2 });
    const a = await env.connect('Ayşe'); await env.connect('Bora');
    // üçüncü anahtarsız hello (aynı IP: 127.0.0.1) reddedilir
    const ws = new WebSocket(env.srv.url);
    await new Promise((r) => ws.addEventListener('open', r));
    const res = await new Promise<{ ok: boolean; code?: string }>((r) => { ws.addEventListener('message', (m) => r(JSON.parse(String(m.data)))); ws.send(JSON.stringify({ t: 'req', id: 1, op: 'hello', data: { version: 1, name: 'Cem' } })); });
    ws.close();
    expect(res).toMatchObject({ ok: false, code: 'HIZ' });
    // var olan hesap anahtarıyla girer
    const again = await env.connect(undefined, a.token);
    expect(again.me!.name).toBe('Ayşe');
    env.clock.advance(3_600_000);
    expect(allowNewAccount(env.srv.app, '127.0.0.1')).toBe(true);
    // farklı IP ayrı sayılır; sınır kapalıyken hep açık
    expect(allowNewAccount(env.srv.app, '10.0.0.9')).toBe(true);
    expect(allowNewAccount({ cfg: {}, now: () => 0 } as never, '1.1.1.1')).toBe(true);
  });
});
