/**
 * YN-207 / YN-125: silinen (sıfırlanan) oyuncunun izleri. Hesap silinince Takım Yarışı lobisinde, canlı yarış odasında ve saldırısı
 * başlamamış rallide koltuğu kalmaz; koltuk "Hazır"ı ile "N hazır" aynı listeden gelir. Baştan başlayan oyuncu tam koduyla bulunur.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { DELETED_PLAYER_NAME, FRIENDS_OPEN_AFTER, RALLY_MONSTERS, rallyMaxHp, type TeamRaceLobby } from '@odi/shared';
import { run, setup, type Env, type TC } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });

async function team(e: Env, name: string, members: string[]): Promise<{ id: string; ps: TC[] }> {
  const ps: TC[] = [];
  for (const m of members) ps.push(await e.connect(m));
  const t = (await ps[0]!.call('team.create', { name, emblem: '🦉' })).team;
  for (const p of ps.slice(1)) await p.call('team.join', { teamId: t.id });
  return { id: t.id, ps };
}
/** istemcinin koltuk kuralı (TeamRace.tsx isReady) */
const readySeats = (l: TeamRaceLobby) => l.members.filter((m) => m.ready && m.online).map((m) => m.name);

describe('Silinen hesap: lobiler ve bekleyen katılımlar (YN-207)', () => {
  it('yalnız liderin olduğu lobi kapanır; kalan üyeler canlı "lobi yok" alır, yeni lider açabilir', async () => {
    env = await setup();
    const { ps: [lead, ali] } = await team(env, 'Kulaklar', ['Ayşe', 'Ali']);
    await lead!.call('trace.open', { size: 3 });
    await lead!.call('trace.ready', { ready: true });
    ali!.drain();
    await lead!.call('account.delete', {});
    // takım ekranı açık üyeye lobi güncellemesi canlı iner
    expect((await ali!.waitFor('trace.updated', (x) => x.lobby === null)).lobby).toBeNull();
    const st = (await ali!.call('trace.state', {})).state;
    expect(st.lobby).toBeNull();
    expect(st.canLead).toBe(true); // tek kalan üye lider oldu (teams.ts), "Lobi boş, sen aç"
    const l = (await ali!.call('trace.open', { size: 3 })).lobby;
    expect(l.members.map((m) => m.name)).toEqual(['Ali']);
  });

  it('açanı silinen lobi kalan üyeye geçer; koltuğu ve "Hazır"ı kalmaz, sayı koltuklarla aynı', async () => {
    env = await setup();
    const { ps: [lead, ali, asya, ahmet] } = await team(env, 'Kulaklar', ['Ayşe', 'Ali', 'Asya', 'Ahmet']);
    await lead!.call('trace.open', { size: 3 });
    for (const p of [ali!, asya!]) await p.call('trace.join', {});
    for (const p of [lead!, ali!]) await p.call('trace.ready', { ready: true });
    const leadId = lead!.me!.id;
    ali!.drain();
    await lead!.call('account.delete', {});
    const up = (await ali!.waitFor('trace.updated', (x) => !!x.lobby && !x.lobby.members.some((m) => m.id === leadId))).lobby!;
    expect(up.openedBy).toBe(ali!.me!.id);
    expect(up.members.map((m) => m.name)).toEqual(['Ali', 'Asya']);
    expect(JSON.stringify(up)).not.toContain(DELETED_PLAYER_NAME);
    expect(readySeats(up)).toEqual(['Ali']);
    // sunucunun arama sayısı da aynı: 1 hazır → arama yok; Asya hazır olunca 2 → arama açılır
    expect((await ahmet!.call('trace.state', {})).state.lobby?.members).toHaveLength(2);
    await asya!.call('trace.ready', { ready: true });
    const lobby = (await ali!.call('trace.search', { on: true })).lobby;
    expect(readySeats(lobby)).toEqual(['Ali', 'Asya']);
    expect(lobby.status).toBe('ariyor');
  });

  it('arama sürerken silinen hazır üye aramayı durdurur (dürüst not); takımdan ayrılan da koltukta kalmaz', async () => {
    env = await setup();
    const { ps: [lead, ali, asya] } = await team(env, 'Kulaklar', ['Ayşe', 'Ali', 'Asya']);
    await lead!.call('trace.open', { size: 3 });
    await ali!.call('trace.join', {}); await asya!.call('trace.join', {});
    for (const p of [lead!, ali!]) await p.call('trace.ready', { ready: true });
    expect((await lead!.call('trace.search', { on: true })).lobby.status).toBe('ariyor');
    await ali!.call('account.delete', {});
    const l = (await lead!.call('trace.state', {})).state.lobby!;
    expect(l.status).toBe('toplaniyor');
    expect(l.note).toContain('en az 2 hazır');
    expect(l.members.map((m) => m.name)).toEqual(['Ayşe', 'Asya']);
    await asya!.call('team.leave', {});
    expect((await lead!.call('trace.state', {})).state.lobby!.members.map((m) => m.name)).toEqual(['Ayşe']);
  });

  it('takımın son üyesi silinince lobi de gider; canlı yarış odasında koltuğu kalmaz', async () => {
    env = await setup();
    const { ps: [solo] } = await team(env, 'Yalnızlar', ['Selin']);
    await solo!.call('trace.open', { size: 3 });
    const other = await env.connect('Bora');
    const room = (await solo!.call('race.create', {})).room;
    await other.call('race.join', { roomId: room.id });
    await solo!.call('race.ready', { ready: true });
    other.drain();
    await solo!.call('account.delete', {});
    const r = (await other.waitFor('race.updated', (x) => x.room.id === room.id && x.room.players.length === 1)).room;
    expect(r.players.map((p) => p.name)).toEqual(['Bora']);
    expect(r.hostId).toBe(other.me!.id);
  });

  it('saldırısı başlamamış ralli: bekleyen katılım geri alınır, can kalanlarla', async () => {
    env = await setup();
    const { ps: [a, b, c] } = await team(env, 'Ralli Kurtları', ['Ayşe', 'Bora', 'Cem']);
    const def = RALLY_MONSTERS[0]!;
    const { rally } = await a!.call('rally.start', { monster: def.id });
    await b!.call('rally.join', { rallyId: rally.id });
    await c!.call('rally.join', { rallyId: rally.id });
    await b!.call('account.delete', {});
    const after = (await a!.call('rally.state', {})).rally!;
    expect(after).toMatchObject({ hpPlayers: 2, hp: rallyMaxHp(def, 2), maxHp: rallyMaxHp(def, 2), attackStarted: false });
    expect(after.participants.map((p) => p.name)).toEqual(['Ayşe', 'Cem']);
  });
});

describe('Arama: baştan başlayan arkadaş tam koduyla bulunur (YN-125)', () => {
  it('varsayılan adlı, hiç oynamamış yeni hesap tam kodla çıkar ve "Arkadaşlar henüz açılmadı" notu taşır; ad aramasında gürültü elenir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const fresh = await env.connect(); // Odi1234 biçiminde ad, yıldız ve XP 0
    expect(fresh.me!.name).toMatch(/^Odi\d{4}$/);
    for (const q of [fresh.me!.friendCode, fresh.me!.friendCode.toLowerCase()]) {
      const hits = (await a.call('players.search', { query: q })).players;
      expect(hits.map((h) => h.profile.id)).toEqual([fresh.me!.id]);
      expect(hits[0]!.relation).toBe('yok');
      expect(hits[0]!.note).toContain(`${FRIENDS_OPEN_AFTER} bölüm`);
    }
    // ad aramasında hâlâ elenir
    expect((await a.call('players.search', { query: 'Odi' })).players).toEqual([]);
    expect((await a.call('players.search', { query: fresh.me!.name })).players).toEqual([]);
    // istek gider; açılınca görür
    await a.call('friends.request', { id: fresh.me!.id });
    expect((await a.call('players.search', { query: fresh.me!.friendCode })).players[0]!.relation).toBe('istek-giden');
    // Arkadaşlar açılmış oyuncuda not yok
    for (let lv = 1; lv <= FRIENDS_OPEN_AFTER; lv++) await fresh.call('progress.submit', run(lv));
    expect((await a.call('players.search', { query: fresh.me!.friendCode })).players[0]!.note).toBeUndefined();
  });

  it('sunucunun "Arkadaşlar açılır" eşiği istemcinin kilidiyle aynı (ftue/features.ts)', () => {
    const src = readFileSync(new URL('../../web/src/ftue/features.ts', import.meta.url), 'utf8');
    expect(Number(/\{ id: 'friends', at: (\d+)/.exec(src)?.[1])).toBe(FRIENDS_OPEN_AFTER);
  });

  it('silinen hesap eski koduyla bulunmaz', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const b = await env.connect('Bora');
    const code = b.me!.friendCode;
    await b.call('account.delete', {});
    expect((await a.call('players.search', { query: code })).players).toEqual([]);
  });
});
