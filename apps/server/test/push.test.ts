import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { FRIEND_LIMITS, PUSH_KURALLARI, PUSH_VARSAYILAN, SOCIAL_LIMITS } from '@odi/shared';
// sunucu önce yüklenir: codes.ts ile rank arasındaki döngüde codes ilk yüklenirse rank'in SQL sabiti eksik kalır
import { setup, sleep, type Env, type TC } from './helpers';
import { pushBekle, pushSweep, sessizSaat, type PushMesaj, type PushTransport } from '../src/push';
import { hashAdminCode } from '../src/codes';

/**
 * 1.3.0 anlık bildirimler (push.ts): varsayılan türler, oyunda olana gitmemesi, sessiz saat, takım sohbeti birleştirme, günlük
 * sınır, sessize alma ve engel, anahtarın oyuncuya bağlanması ve silinmesi. Gerçek Expo yerine sahte taşıma.
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

function sahte() {
  const sent: PushMesaj[] = [];
  const kayitsiz = new Set<string>();
  const makbuzKayitsiz = new Set<string>();
  const biletler = new Map<string, string>();
  let n = 0;
  const t: PushTransport = {
    async send(msgs) {
      sent.push(...msgs);
      return msgs.map((m) => {
        if (kayitsiz.has(m.to)) return { status: 'error' as const, message: 'kayıtsız', details: { error: 'DeviceNotRegistered' } };
        const id = `bilet${++n}`; biletler.set(id, m.to); return { status: 'ok' as const, id };
      });
    },
    async receipts(ids) {
      return Object.fromEntries(ids.map((id) => [id, makbuzKayitsiz.has(biletler.get(id) ?? '') ? { status: 'error' as const, details: { error: 'DeviceNotRegistered' } } : { status: 'ok' as const }]));
    },
  };
  return { t, sent, kayitsiz, makbuzKayitsiz };
}
const tok = (s: string) => `ExponentPushToken[${s.padEnd(12, 'x')}]`;
/** cihaz anahtarını bağla ve uygulamayı arka plana al (bağlantı açık kalır; oyunda sayılmaz) */
async function arkada(c: TC, token: string) {
  await c.call('push.register', { token, platform: 'ios' });
  await c.call('push.away', { away: true });
}
async function befriend(a: TC, b: TC) {
  const r = await a.call('friends.request', { id: b.me!.id });
  await b.call('friends.respond', { requestId: r.request!.id, accept: true });
}
const bekle = async () => { await pushBekle(env!.srv.app); };
const tokens = (pid: string) => env!.srv.app.db.all<{ token: string }>('SELECT token FROM push_tokens WHERE player_id = ?', pid).map((r) => r.token);

describe('anlık bildirimler', () => {
  it('varsayılanlar; özel mesaj: oyunda değilse gider, oyundaysa gitmez; başlık gönderen, gövde metin; hazır söz ve çıkartma metin olur', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    expect((await b.call('push.settings', {})).settings).toEqual(PUSH_VARSAYILAN);
    expect(PUSH_VARSAYILAN).toEqual({ dm: true, takim: false, arkadas: true, basvuru: true });
    await befriend(a, b);
    // oyunda (bağlı, önde): bildirim yok
    await b.call('push.register', { token: tok('bora'), platform: 'ios' });
    await a.call('dm.send', { to: b.me!.id, text: 'oyundasın' });
    await bekle();
    expect(f.sent).toHaveLength(0);
    // arka plan: gider
    await b.call('push.away', { away: true });
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    await a.call('dm.send', { to: b.me!.id, text: 'merhaba   Bora' });
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    await a.call('dm.send', { to: b.me!.id, text: 'kalp', kind: 'sticker' });
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    await a.call('dm.send', { to: b.me!.id, text: 'selam', kind: 'hazir' });
    await bekle();
    expect(f.sent[0]).toMatchObject({ to: tok('bora'), title: 'Ayşe', body: 'merhaba Bora', data: { kind: 'dm', id: a.me!.id }, threadId: `dm:${a.me!.id}`, sound: 'default', channelId: 'varsayilan' });
    expect(f.sent[0]).not.toHaveProperty('badge');
    expect(f.sent[1]!.body).toBe('❤️ Seni seviyorum');
    expect(f.sent[2]!.body).toBe('Selam!');
    // öne gelince yine gitmez
    await b.call('push.away', { away: false });
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    const once = f.sent.length;
    await a.call('dm.send', { to: b.me!.id, text: 'yine oyundasın' });
    await bekle();
    expect(f.sent).toHaveLength(once);
    // kendine gitmez (A'nın anahtarı da olsa)
    await arkada(a, tok('ayse'));
    expect(f.sent.filter((m) => m.to === tok('ayse'))).toHaveLength(0);
  });

  it('bağlantı kapalıyken gider; uzun metin kısalır', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    await befriend(a, b);
    await b.call('push.register', { token: tok('bora'), platform: 'android' });
    b.close();
    for (let i = 0; i < 50 && env.srv.app.online.has(b.me!.id); i++) await sleep(10);
    expect(env.srv.app.online.has(b.me!.id)).toBe(false);
    await a.call('dm.send', { to: b.me!.id, text: 'a'.repeat(400) });
    await bekle();
    expect(f.sent).toHaveLength(1);
    expect([...f.sent[0]!.body].length).toBe(PUSH_KURALLARI.metinMax);
    expect(f.sent[0]!.body.endsWith('…')).toBe(true);
  });

  it('sessize alınan ve engellenen kişiden hiç gitmez; özel mesaj türü kapatılınca gitmez', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    await befriend(a, b); await befriend(c, b);
    await arkada(b, tok('bora'));
    await b.call('chat.mute', { id: a.me!.id, on: true });
    await a.call('dm.send', { to: b.me!.id, text: 'sessizdeyim' });
    await bekle();
    expect(f.sent).toHaveLength(0);
    // engel: mesaj zaten gitmez, arkadaşlık isteği de
    await b.call('players.block', { id: c.me!.id });
    expect((await err(c.call('dm.send', { to: b.me!.id, text: 'engelliyim' }))).code).toBe('ENGEL');
    expect((await err(c.call('friends.request', { id: b.me!.id }))).code).toBe('ENGEL');
    await bekle();
    expect(f.sent).toHaveLength(0);
    // tür kapalı
    await b.call('chat.mute', { id: a.me!.id, on: false });
    await b.call('push.settings', { dm: false });
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    await a.call('dm.send', { to: b.me!.id, text: 'kapalı' });
    await bekle();
    expect(f.sent).toHaveLength(0);
  });

  it('sessiz saat (23.00-08.00 İstanbul): özel mesaj gider, diğerleri gitmez ve sonra da gönderilmez', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    expect(sessizSaat(Date.UTC(2026, 9, 14, 19, 59))).toBe(false); // 22.59
    expect(sessizSaat(Date.UTC(2026, 9, 14, 20, 0))).toBe(true); // 23.00
    expect(sessizSaat(Date.UTC(2026, 9, 15, 4, 59))).toBe(true); // 07.59
    expect(sessizSaat(Date.UTC(2026, 9, 15, 5, 0))).toBe(false); // 08.00
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    await befriend(a, b);
    await arkada(b, tok('bora'));
    env.clock.t = Date.UTC(2026, 9, 14, 21, 30); // 00.30
    await c.call('friends.request', { id: b.me!.id });
    await a.call('dm.send', { to: b.me!.id, text: 'gece mesajı' });
    await bekle();
    expect(f.sent.map((m) => m.title)).toEqual(['Ayşe']);
    env.clock.t = Date.UTC(2026, 9, 15, 6, 0); // 09.00: geceki istek ertelenmiş gelmez
    env.srv.sweep();
    await bekle();
    expect(f.sent).toHaveLength(1);
  });

  it('takım sohbeti: varsayılan kapalı; açılınca oyuncu mesajı gider, yazana ve sistem satırına gitmez; 60 sn içindekiler tek özet', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await b.call('team.join', { teamId: t.id });
    await arkada(b, tok('bora'));
    await arkada(a, tok('ayse'));
    const room = `takim:${t.id}`;
    await a.call('chat.send', { room, text: 'kapalıyken' });
    await bekle();
    expect(f.sent).toHaveLength(0);
    await b.call('push.settings', { takim: true });
    await a.call('push.settings', { takim: true });
    // takıma katılma (sistem satırı) bildirim üretmez
    await c.call('team.join', { teamId: t.id });
    await bekle();
    expect(f.sent).toHaveLength(0);
    env.clock.advance(SOCIAL_LIMITS.chatCooldownMs);
    await a.call('chat.send', { room, text: 'ilk mesaj' });
    await bekle();
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0]).toMatchObject({ to: tok('bora'), title: 'Kulaklar', body: 'Ayşe: ilk mesaj', data: { kind: 'takim', id: t.id }, threadId: room });
    for (const text of ['iki', 'üç', 'dört']) {
      env.clock.advance(SOCIAL_LIMITS.chatCooldownMs);
      await a.call('chat.send', { room, text });
    }
    env.clock.advance(SOCIAL_LIMITS.chatCooldownMs);
    await c.call('chat.send', { room, text: 'Cem de yazdı' }); // A'ya ilk bildirim
    await bekle();
    expect(f.sent.map((m) => `${m.to}:${m.body}`)).toEqual([`${tok('bora')}:Ayşe: ilk mesaj`, `${tok('ayse')}:Cem: Cem de yazdı`]);
    // pencere bitmeden özet yok
    env.srv.sweep(); await bekle();
    expect(f.sent).toHaveLength(2);
    env.clock.advance(PUSH_KURALLARI.takimPencereMs);
    env.srv.sweep(); await bekle();
    expect(f.sent.slice(2).map((m) => `${m.to}:${m.body}`)).toEqual([`${tok('bora')}:Takım sohbetinde 4 yeni mesaj`]);
    // özetten sonra bekleyen yok
    env.clock.advance(PUSH_KURALLARI.takimPencereMs);
    env.srv.sweep(); await bekle();
    expect(f.sent).toHaveLength(3);
    // sessize alınan takım arkadaşından gitmez
    await b.call('chat.mute', { id: c.me!.id, on: true });
    env.clock.advance(SOCIAL_LIMITS.chatCooldownMs);
    await c.call('chat.send', { room, text: 'duyulmaz' });
    await bekle();
    expect(f.sent.filter((m) => m.to === tok('bora'))).toHaveLength(2);
  });

  it('özel mesaj dışındakiler günde en çok 5; arkadaş hediyesi günde tek bildirim; istek ve kabul', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    const b = await env.connect('Bora');
    await arkada(b, tok('bora'));
    const diger: TC[] = [];
    for (let i = 0; i < 7; i++) diger.push(await env.connect(`Oyuncu${i}x`));
    // ilk ikisi arkadaş olur (istek B'ye gelir: 2 bildirim), sonra iki hediye: tek bildirim
    await diger[0]!.call('friends.request', { id: b.me!.id });
    await diger[1]!.call('friends.request', { id: b.me!.id });
    await bekle();
    expect(f.sent.map((m) => m.body)).toEqual([`${diger[0]!.me!.name} sana arkadaşlık isteği gönderdi.`, `${diger[1]!.me!.name} sana arkadaşlık isteği gönderdi.`]);
    expect(f.sent[0]!.data).toEqual({ kind: 'arkadas', id: diger[0]!.me!.id });
    const reqs = (await b.call('friends.requests', {})).incoming;
    for (const r of reqs) await b.call('friends.respond', { requestId: r.id, accept: true });
    await diger[0]!.call('friends.gift', { id: b.me!.id });
    await diger[1]!.call('friends.gift', { id: b.me!.id });
    await bekle();
    expect(f.sent.slice(2).map((m) => m.title)).toEqual(['Arkadaş hediyesi']);
    expect(f.sent[2]!.data).toEqual({ kind: 'odul', id: '' });
    // kalan sınır: 5 - 3 = 2 istek daha
    for (const c of diger.slice(2)) await c.call('friends.request', { id: b.me!.id });
    await bekle();
    expect(f.sent).toHaveLength(5);
    // kabul bildirimi isteği gönderene (o da sınırına sayılır; ayrı oyuncu)
    await arkada(diger[2]!, tok('o2'));
    const r2 = (await b.call('friends.requests', {})).incoming.find((r) => r.from.id === diger[2]!.me!.id)!;
    await b.call('friends.respond', { requestId: r2.id, accept: true });
    await bekle();
    expect(f.sent.at(-1)).toMatchObject({ to: tok('o2'), title: 'Yeni arkadaş', body: 'Bora arkadaşlık isteğini kabul etti.' });
    // ertesi gün sınır sıfırlanır
    env.clock.advance(24 * 3_600_000);
    await diger[6]!.call('friends.cancel', { requestId: (await diger[6]!.call('friends.requests', {})).outgoing[0]!.id });
    await diger[6]!.call('friends.request', { id: b.me!.id });
    await bekle();
    expect(f.sent.at(-1)).toMatchObject({ to: tok('bora'), title: 'Arkadaşlık isteği' });
  });

  it('takım başvurusu lider ve yardımcıya gider (üyeye gitmez); hediye ve kilit hediyesi ödül kutusuna yönlendirir', async () => {
    const f = sahte();
    const kod = 'deneme yönetici';
    env = await setup({ push: f.t, adminCodeHash: hashAdminCode(kod) });
    const [lider, uye, aday, adm] = [await env.connect('Lider'), await env.connect('Uye'), await env.connect('Aday'), await env.connect('Yonetici')];
    const t = (await lider.call('team.create', { name: 'Gizli Kulüp', emblem: '🎧', open: false })).team;
    await uye.call('team.join', { code: t.code });
    await arkada(lider, tok('lider'));
    await arkada(uye, tok('uye'));
    await aday.call('team.apply', { teamId: t.id });
    await bekle();
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0]).toMatchObject({ to: tok('lider'), title: 'Takım başvurusu', body: 'Aday Gizli Kulüp takımına katılmak istiyor.', data: { kind: 'basvuru', id: t.id } });
    // hediye
    await arkada(aday, tok('aday'));
    expect((await adm.call('code.redeem', { code: kod })).result.kind).toBe('yonetici');
    await adm.call('admin.gift', { code: aday.me!.friendCode, jeton: 50 });
    await adm.call('admin.unlock.gift', { code: aday.me!.friendCode, levels: 10 });
    await bekle();
    expect(f.sent.slice(1).map((m) => [m.to, m.title, m.data.kind])).toEqual([[tok('aday'), "ODİ'den hediye", 'odul'], [tok('aday'), 'Kilit hediyesi', 'odul']]);
    expect(JSON.stringify(f.sent)).not.toMatch(/[Aa]dmin|yönetici/);
  }, 20_000);

  it('anahtar tek oyuncuya aittir (hesap değişince geçer); bütün türler kapanınca, izin kapanınca, hesap silinince ve Expo kayıtsız deyince silinir', async () => {
    const f = sahte();
    env = await setup({ push: f.t });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    expect((await err(b.call('push.register', { token: 'gecersiz', platform: 'ios' }))).code).toBe('GECERSIZ');
    await b.call('push.register', { token: tok('ortak'), platform: 'ios' });
    await b.call('push.register', { token: tok('bora2'), platform: 'ios' });
    expect(tokens(b.me!.id).sort()).toEqual([tok('bora2'), tok('ortak')].sort());
    // aynı cihaz başka hesaba geçti
    await c.call('push.register', { token: tok('ortak'), platform: 'ios' });
    expect(tokens(b.me!.id)).toEqual([tok('bora2')]);
    expect(tokens(c.me!.id)).toEqual([tok('ortak')]);
    // izin kapandı: cihaz kendi anahtarını siler (başkasınınkini silemez)
    await b.call('push.unregister', { token: tok('ortak') });
    expect(tokens(c.me!.id)).toEqual([tok('ortak')]);
    await b.call('push.unregister', { token: tok('bora2') });
    expect(tokens(b.me!.id)).toEqual([]);
    // bütün türler kapalı: anahtar silinir, yeniden kayıt saklanmaz
    await c.call('push.settings', { dm: false, takim: false, arkadas: false, basvuru: false });
    expect(tokens(c.me!.id)).toEqual([]);
    await c.call('push.register', { token: tok('ortak'), platform: 'ios' });
    expect(tokens(c.me!.id)).toEqual([]);
    await c.call('push.settings', { dm: true });
    await c.call('push.register', { token: tok('ortak'), platform: 'ios' });
    expect(tokens(c.me!.id)).toEqual([tok('ortak')]);
    // Expo bileti "kayıtsız": silinir
    await befriend(a, c);
    await c.call('push.away', { away: true });
    f.kayitsiz.add(tok('ortak'));
    await a.call('dm.send', { to: c.me!.id, text: 'x' });
    await bekle();
    expect(tokens(c.me!.id)).toEqual([]);
    // makbuz "kayıtsız" (15 dk sonra sorulur)
    await c.call('push.register', { token: tok('cem2'), platform: 'ios' });
    f.makbuzKayitsiz.add(tok('cem2'));
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    await a.call('dm.send', { to: c.me!.id, text: 'y' });
    await bekle();
    pushSweep(env.srv.app); await sleep(20);
    expect(tokens(c.me!.id)).toEqual([tok('cem2')]);
    env.clock.advance(15 * 60_000);
    pushSweep(env.srv.app); await sleep(20);
    expect(tokens(c.me!.id)).toEqual([]);
    // hesap silme: anahtar ve ayar satırı silinir
    await b.call('push.settings', { takim: true });
    await b.call('push.register', { token: tok('bora3'), platform: 'ios' });
    await b.call('account.delete', {});
    expect(tokens(b.me!.id)).toEqual([]);
    expect(env.srv.app.db.get('SELECT 1 AS x FROM push_settings WHERE player_id = ?', b.me!.id)).toBeUndefined();
  });

  it('taşıma yoksa (ODI_PUSH=0 / test) hiçbir şey gönderilmez, işlemler yine çalışır', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    await befriend(a, b);
    await arkada(b, tok('bora'));
    await a.call('dm.send', { to: b.me!.id, text: 'sessiz sunucu' });
    expect(tokens(b.me!.id)).toEqual([tok('bora')]);
  });
});
