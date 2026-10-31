import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCost, CAMP_V, type CampState } from '@odi/shared';
import type { NetError } from '@odi/net';
import { kgCount } from '../src/camp-quests';
import { setup, T0, type Env, type TC } from './helpers';

// İnşaat sırası (MK-011 / Ö3; docs/14-kamp.md "İnşaat sırası")
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const b = (camp: CampState, id: string) => camp.buildings.find((x) => x.id === id)!;
const sec = (id: Parameters<typeof buildCost>[0], to: number) => buildCost(id, to).seconds * 1000;
const cost = (id: Parameters<typeof buildCost>[0], to: number) => buildCost(id, to).jeton;
function give(e: Env, c: TC, jeton: number) { e.srv.app.db.run('UPDATE players SET jeton = ? WHERE id = ?', jeton, c.me!.id); }

describe('İnşaat sırası', () => {
  it('sıraya al: bedel peşin, tek yer, süren binayla aynı olamaz; boşta ise hemen başlar', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); give(env, a, 5000);
    // süren inşaat yoksa sıra beklemez
    const first = await a.call('camp.queue', { id: 'laboratuvar' });
    expect(first.started).toBe(true);
    expect(first.camp.queued).toBeNull();
    expect(b(first.camp, 'laboratuvar').upgradingTo).toBe(1);
    expect(first.wallet.jeton).toBe(5000 - cost('laboratuvar', 1));
    // süren inşaat varken: sıraya girer, bedel hemen düşer
    const q = await a.call('camp.queue', { id: 'depo' });
    expect(q.started).toBe(false);
    expect(q.camp.queued).toMatchObject({ id: 'depo', toLevel: 1, jeton: cost('depo', 1), at: env.clock.t });
    expect(q.wallet.jeton).toBe(5000 - cost('laboratuvar', 1) - cost('depo', 1));
    expect(b(q.camp, 'depo').upgradingTo).toBeNull();
    // tek yer
    expect((await err(a.call('camp.queue', { id: 'atolye' }))).code).toBe('DOLU');
    // camp.upgrade hâlâ tek inşaat
    expect((await err(a.call('camp.upgrade', { id: 'atolye' }))).code).toBe('MESGUL');
    // süren binanın kendisi sıraya alınamaz
    await a.call('camp.unqueue', {});
    expect((await err(a.call('camp.queue', { id: 'laboratuvar' }))).code).toBe('MESGUL');
    // jeton yetmezse sıraya girmez, cüzdana dokunulmaz
    give(env, a, 10);
    expect((await err(a.call('camp.queue', { id: 'depo' }))).code).toBe('YETERSIZ');
    expect((await a.call('camp.state', {})).camp.queued).toBeNull();
  });

  it('sıradan çıkarınca bedel tamamen geri; hızlandırıcı ve takım yardımı yalnız süren inşaata', async () => {
    env = await setup();
    const [a, h] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const t = (await a.call('team.create', { name: 'Sıracılar', emblem: '🍀' })).team;
    await h.call('team.join', { teamId: t.id });
    give(env, a, 5000);
    await a.call('camp.upgrade', { id: 'laboratuvar' });
    const before = (await a.call('wallet.get', {})).wallet.jeton;
    await a.call('camp.queue', { id: 'depo' });
    const un = await a.call('camp.unqueue', {});
    expect(un.refunded).toBe(cost('depo', 1));
    expect(un.wallet.jeton).toBe(before);
    expect(un.camp.queued).toBeNull();
    expect((await err(a.call('camp.unqueue', {}))).code).toBe('YOK');
    // sıradaki binaya hızlandırıcı ya da yardım isteği olmaz
    await a.call('camp.queue', { id: 'depo' });
    await a.call('shop.purchase', { productId: 'odi.baslangic', store: 'test' });
    expect((await err(a.call('camp.speedup', { id: 'depo', item: 'm5' }))).code).toBe('YOK');
    expect((await err(a.call('camp.help.request', { id: 'depo' }))).code).toBe('YOK');
    expect((await err(h.call('team.camp.help', { playerId: a.me!.id, building: 'depo' }))).code).toBe('YOK');
    // süren inşaatı bitiren hızlandırıcı sıradakini başlatır (sıradakinin süresi kısalmaz)
    const sp = await a.call('camp.speedup', { id: 'laboratuvar', item: 'm5', count: 1 });
    expect(b(sp.camp, 'laboratuvar').level).toBe(1);
    expect(b(sp.camp, 'depo').upgradingTo).toBe(1);
    expect(b(sp.camp, 'depo').endsAt! - b(sp.camp, 'depo').startedAt!).toBe(sec('depo', 1));
    expect(sp.camp.queued).toBeNull();
  });

  it('Merkez kuralı sıraya alırken: süren Merkez inşaatı bittikten sonraki seviyeye göre', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); give(env, a, 20_000);
    await a.call('camp.upgrade', { id: 'laboratuvar' });
    env.clock.advance(sec('laboratuvar', 1)); await a.call('camp.state', {});
    // Merkez 1 sürerken Odyometri 2 olmaz (Merkez 1'de kalıyor)
    await a.call('camp.upgrade', { id: 'atolye' });
    expect((await err(a.call('camp.queue', { id: 'laboratuvar' }))).code).toBe('SART');
    env.clock.advance(sec('atolye', 1)); await a.call('camp.state', {});
    // Merkez 2 yapılırken Odyometri 2 sıraya girer (Merkez bitince 2 olacak)
    await a.call('camp.upgrade', { id: 'merkez' });
    const q = await a.call('camp.queue', { id: 'laboratuvar' });
    expect(q.camp.queued).toMatchObject({ id: 'laboratuvar', toLevel: 2 });
    // ama Odyometri 3 değil: önce kuyruk boşalsın
    await a.call('camp.unqueue', {});
    a.drain();
    // Kamp Seviyesi şartı da sıraya alırken denetlenir
    expect((await err(a.call('camp.queue', { id: 'kutuphane' }))).code).toBe('SART');
  });

  it('süren inşaat bitince sıradaki sunucuda kendiliğinden başlar (5 sn zamanlayıcı); başlayınca görev sayacı bir kez artar', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); give(env, a, 5000); const pid = a.me!.id;
    const up = await a.call('camp.upgrade', { id: 'laboratuvar' });
    const end1 = b(up.camp, 'laboratuvar').endsAt!;
    const n0 = kgCount(env.srv.app, pid, 'insaat');
    await a.call('camp.queue', { id: 'depo' }); await a.call('camp.unqueue', {}); // sıraya alıp çıkarmak sayılmaz
    expect(kgCount(env.srv.app, pid, 'insaat')).toBe(n0);
    await a.call('camp.queue', { id: 'depo' });
    expect(kgCount(env.srv.app, pid, 'insaat')).toBe(n0);
    a.drain();
    env.clock.advance(sec('laboratuvar', 1) + 2000); // zamanlayıcı biraz geç geldi
    env.srv.sweep();
    const ev = await a.waitFor('camp.updated', (x) => b(x.camp, 'laboratuvar').level === 1);
    expect(b(ev.camp, 'depo').upgradingTo).toBe(1);
    expect(b(ev.camp, 'depo').startedAt).toBe(end1); // öncekinin bittiği anda başlar, zamanlayıcının geldiği anda değil
    expect(b(ev.camp, 'depo').endsAt).toBe(end1 + sec('depo', 1));
    expect(ev.camp.queued).toBeNull();
    expect(kgCount(env.srv.app, pid, 'insaat')).toBe(n0 + 1);
    env.clock.advance(sec('depo', 1)); env.srv.sweep();
    const ev2 = await a.waitFor('camp.updated', (x) => b(x.camp, 'depo').level === 1);
    expect(b(ev2.camp, 'depo').upgradingTo).toBeNull();
  });

  it('sunucu kapalıyken iki inşaatın süresi de dolarsa açılışta ikisi de biter; sıradaki öncekinin bittiği anda başlamış sayılır', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'odi-sira-')); const file = join(dir, 'odi.db');
    try {
      env = await setup({ dbFile: file });
      const a = await env.connect('Ayşe'); give(env, a, 5000); const token = a.token; const pid = a.me!.id;
      await a.call('camp.upgrade', { id: 'laboratuvar' });
      await a.call('camp.queue', { id: 'depo' });
      const jeton = (await a.call('wallet.get', {})).wallet.jeton;
      await env.close(); env = undefined;
      // 1 gün sonra yeniden açılış
      const later = T0 + 24 * 3600_000;
      env = await setup({ dbFile: file, now: () => later });
      const a2 = await env.connect('Ayşe', token);
      expect(a2.me!.id).toBe(pid);
      const st = await a2.call('camp.state', {});
      expect(b(st.camp, 'laboratuvar').level).toBe(1);
      expect(b(st.camp, 'depo').level).toBe(1);
      expect(b(st.camp, 'depo').upgradingTo).toBeNull();
      expect(st.camp.queued).toBeNull();
      expect(st.wallet.jeton).toBe(jeton); // bedel bir kez (sıraya alırken) düştü
      // depo, sıradaki inşaatın bittiği andan beri üretir (öncekinin bitişi + kendi süresi)
      expect(st.camp.depotStoredAt).toBe(T0 + sec('laboratuvar', 1) + sec('depo', 1));
    } finally { await env?.close(); env = undefined; rmSync(dir, { recursive: true, force: true }); }
  });

  it('eski istemci: queued alanı gitmez; sıradaki inşaat yine başlar ve süren inşaat olarak görünür', async () => {
    env = await setup();
    expect(CAMP_V).toBeGreaterThanOrEqual(3);
    const a = await env.connect('Ayşe'); give(env, a, 5000); const pid = a.me!.id;
    await a.call('camp.upgrade', { id: 'laboratuvar' });
    await a.call('camp.queue', { id: 'depo' });
    for (const v of [0, 2]) {
      env.srv.app.online.get(pid)!.campV = v;
      const old = await a.call('camp.state', {});
      expect('queued' in old.camp).toBe(false);
      expect(old.camp.buildings.length).toBe(v >= 2 ? 12 : 7);
      expect((await err(a.call('camp.upgrade', { id: 'atolye' }))).code).toBe('MESGUL');
    }
    env.clock.advance(sec('laboratuvar', 1));
    const old = await a.call('camp.state', {});
    expect(b(old.camp, 'laboratuvar').level).toBe(1);
    expect(b(old.camp, 'depo').upgradingTo).toBe(1);
    expect('queued' in old.camp).toBe(false);
  });

  it('seviye bu arada değiştiyse sıradaki başlamaz, bedel geri verilir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); give(env, a, 5000); const pid = a.me!.id;
    await a.call('camp.upgrade', { id: 'laboratuvar' });
    await a.call('camp.queue', { id: 'depo' });
    const jeton = (await a.call('wallet.get', {})).wallet.jeton;
    env.srv.app.db.run("UPDATE buildings SET level = 1 WHERE player_id = ? AND id = 'depo'", pid); // ör. yönetici ayarı
    env.clock.advance(sec('laboratuvar', 1));
    const st = await a.call('camp.state', {});
    expect(b(st.camp, 'depo').upgradingTo).toBeNull();
    expect(st.camp.queued).toBeNull();
    expect(st.wallet.jeton).toBe(jeton + cost('depo', 1));
  });
});
