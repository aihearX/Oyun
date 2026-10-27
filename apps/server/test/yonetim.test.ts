import { afterEach, describe, expect, it } from 'vitest';
import { prunePurchases, pruneReports } from '../src/account';
import { pruneNewAccountIps } from '../src/players';
import { susturmaMetni } from '../src/chat';
import { HESAP_SIL_BEKLEME_GUN, hesapBul, hesapSilIstegi, sikayetler, sustur } from '../src/yonetim';
import { setup, type Env } from './helpers';

const DAY = 86_400_000;
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });

describe('uygulama dışı hesap silme isteği (/hesap-sil, npm run kod -- hesap-sil)', () => {
  it('yalnız 14 gündür bağlanmamış hesap silinir; arkadaş koduyla bulunur; silinen hesap yeniden silinmez', async () => {
    env = await setup();
    const app = env.srv.app;
    const a = await env.connect('Ayşe');
    const kod = a.me!.friendCode;
    expect(hesapBul(app, kod.toLowerCase())?.ad).toBe('Ayşe');
    // bağlıyken ve yeni bağlanmışken silinmez
    expect(hesapSilIstegi(app, kod)).toMatchObject({ ok: false, neden: 'etkin' });
    a.close();
    await new Promise((r) => setTimeout(r, 200));
    env.clock.advance((HESAP_SIL_BEKLEME_GUN - 1) * DAY);
    expect(hesapSilIstegi(app, kod)).toMatchObject({ ok: false, neden: 'etkin', gun: HESAP_SIL_BEKLEME_GUN - 1 });
    env.clock.advance(2 * DAY);
    expect(hesapSilIstegi(app, kod)).toEqual({ ok: true, ad: 'Ayşe' });
    // arkadaş kodu anonim satırda yenilendi: aynı kodla hesap yok
    expect(hesapBul(app, kod)).toBeNull();
    expect(hesapSilIstegi(app, kod)).toEqual({ ok: false, neden: 'yok' });
    expect(app.db.get<{ name: string }>('SELECT name FROM players WHERE id = ?', a.me!.id)!.name).toBe('Silinmiş Oyuncu');
  });

  it('zorla: bekleme şartı aranmaz (yasal zorunluluk)', async () => {
    env = await setup();
    const a = await env.connect('Bora');
    a.close();
    await new Promise((r) => setTimeout(r, 200));
    expect(hesapSilIstegi(env.srv.app, a.me!.friendCode, { zorla: true })).toEqual({ ok: true, ad: 'Bora' });
  });
});

describe('şikâyet listesi ve uzun susturma (App Store 1.2)', () => {
  it('şikâyetler oyuncu başına toplanır; sustur N gün mesajı kapatır, 0 kaldırır', async () => {
    env = await setup({ freeTextCleared: 0 });
    const app = env.srv.app;
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    app.db.run("INSERT INTO player_reports(target, reporter, msg_id, reason, at) VALUES(?, ?, '', 'kufur', ?), (?, ?, '', 'zorbalik', ?)", a.me!.id, b.me!.id, app.now(), a.me!.id, c.me!.id, app.now());
    const list = sikayetler(app, 7);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ arkadasKodu: a.me!.friendCode, ad: 'Ayşe', kisi: 2 });
    expect(list[0]!.nedenler.sort()).toEqual(['kufur', 'zorbalik']);
    sustur(app, a.me!.friendCode, 30);
    await expect(a.call('chat.send', { room: 'genel', text: 'merhaba' })).rejects.toMatchObject({ code: 'SUSTURULDU', message: 'Şikâyetler nedeniyle 30 gün mesaj gönderemezsin.' });
    sustur(app, a.me!.friendCode, 0);
    expect(hesapBul(app, a.me!.friendCode)!.susturmaBitis).toBe(0);
    expect(susturmaMetni(9 * 60_000)).toBe('Şikâyetler nedeniyle 9 dakika mesaj gönderemezsin.');
  });
});

describe('saklama süreleri (gizlilik metni §3)', () => {
  it('şikâyet kayıtları 90 gün sonra silinir (hesap silinmese de)', async () => {
    env = await setup();
    const app = env.srv.app;
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    app.db.run("INSERT INTO player_reports(target, reporter, msg_id, reason, at) VALUES(?, ?, '', 'kufur', ?)", a.me!.id, b.me!.id, app.now());
    app.db.run('INSERT INTO chat_reports(msg_id, reporter, at) VALUES(?, ?, ?)', 'm1', b.me!.id, app.now());
    env.clock.advance(89 * DAY); pruneReports(app);
    expect(app.db.all('SELECT 1 AS x FROM player_reports')).toHaveLength(1);
    env.clock.advance(2 * DAY); pruneReports(app);
    expect(app.db.all('SELECT 1 AS x FROM player_reports')).toHaveLength(0);
    expect(app.db.all('SELECT 1 AS x FROM chat_reports')).toHaveLength(0);
  });

  it('satın alma kaydı işlem yılının sonundan 10 yıl sonra silinir', async () => {
    env = await setup();
    const app = env.srv.app;
    const yil = (y: number, ay = 6) => Date.UTC(y, ay, 1);
    const ins = (id: string, at: number) => app.db.run("INSERT INTO purchases(id, player_id, product_id, at, store, amount_try, receipt) VALUES(?, 'silinmis', 'odi.kristal.1', ?, 'play', 29.99, ?)", id, at, id);
    ins('s2026', yil(2026)); ins('s2027', yil(2027, 11));
    env.clock.t = Date.UTC(2036, 11, 30); prunePurchases(app);
    expect(app.db.all('SELECT id FROM purchases ORDER BY id')).toHaveLength(2); // 2026 yılı 2036 sonunda doluyor
    env.clock.t = Date.UTC(2037, 0, 2); prunePurchases(app);
    expect(app.db.all<{ id: string }>('SELECT id FROM purchases').map((r) => r.id)).toEqual(['s2027']);
  });

  it('hesap açma sınırının IP kayıtları saat dolunca bellekten atılır', async () => {
    env = await setup({ newAccountsPerIpHour: 5 });
    const app = env.srv.app;
    await env.connect('Ayşe');
    const { allowNewAccount } = await import('../src/players');
    allowNewAccount(app, '203.0.113.7');
    env.clock.advance(3_600_001);
    pruneNewAccountIps(app);
    // yeni pencere: aynı IP yine 5 hesap açabilir (eski kayıt atıldı)
    for (let i = 0; i < 5; i++) expect(allowNewAccount(app, '203.0.113.7')).toBe(true);
    expect(allowNewAccount(app, '203.0.113.7')).toBe(false);
  });
});
