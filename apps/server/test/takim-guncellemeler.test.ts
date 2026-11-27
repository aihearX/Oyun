import { afterEach, describe, expect, it } from 'vitest';
import { SOCIAL_LIMITS } from '@odi/shared';
import { setup, type Env, type TC } from './helpers';
import { feedEvent } from '../src/comm';
import { systemMessage } from '../src/chat';

/**
 * Takım › Sohbet: Mesajlar | Güncellemeler (1.3.0). Protokol aynı kalır (eski istemciler tek akış görür); sunucu yalnız ekler:
 *  - chat.unread / chat.read yanıtında msgs: yalnız mesajlar (güncellemeler sayılmaz); unread eskisi gibi hepsi.
 *  - chat.join geçmişi: son historySize oyuncu iletisi, akış kartları pencereyi doldursa da gelir.
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
async function team(...cs: TC[]) {
  const t = (await cs[0]!.call('team.create', { name: `Kulak ${Math.random().toString(36).slice(2, 7)}`, emblem: '👂' })).team;
  for (const c of cs.slice(1)) await c.call('team.join', { teamId: t.id });
  return { id: t.id, room: `takim:${t.id}` };
}

describe('Takım güncellemeleri (sunucu eklemeleri)', () => {
  it('okunmamış: msgs yalnız mesajları (ve Günün Sorusu dışı sistem iletisi olmayanları) sayar, unread hepsini', async () => {
    env = await setup({ freeTextCleared: 0 });
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    const t = await team(a, b);
    const app = env!.srv.app;
    expect(await a.call('chat.unread', { room: t.room })).toEqual({ unread: 0, msgs: 0 });
    env!.clock.advance(1000);
    app.run(() => feedEvent(app, b.me!.id, 'seri', { days: 3 })); // takım arkadaşının gelişmesi: güncelleme
    app.run(() => systemMessage(app, t.room, 'Takım teknolojisi yükseldi: Kepçe 2. seviye!')); // duyuru: güncelleme
    await b.call('chat.send', { room: t.room, text: 'Selam takım', kind: 'text' });
    env!.clock.advance(1300);
    await b.call('chat.send', { room: t.room, text: 'selam', kind: 'hazir' });
    expect(await a.call('chat.unread', { room: t.room })).toEqual({ unread: 4, msgs: 2 });
    expect(await a.call('chat.read', { room: t.room, at: app.now() })).toEqual({ unread: 0, msgs: 0 });
  });

  it('geçmiş: akış kartları son pencereyi doldursa da son oyuncu iletileri gelir (zamana göre sıralı, tekrar yok)', async () => {
    env = await setup({ freeTextCleared: 0 });
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    const t = await team(a, b);
    const app = env!.srv.app;
    await b.call('chat.send', { room: t.room, text: 'En eski mesaj', kind: 'text' });
    for (let i = 0; i < SOCIAL_LIMITS.historySize + 5; i++) { env!.clock.advance(10); app.run(() => systemMessage(app, t.room, `Duyuru ${i}`)); }
    env!.clock.advance(1300);
    await b.call('chat.send', { room: t.room, text: 'Son mesaj', kind: 'text' });
    const { history } = await a.call('chat.join', { room: t.room });
    const texts = history.filter((m) => m.kind !== 'soru').map((m) => m.text); // Günün Sorusu katılınca açılabilir
    expect(texts).toContain('En eski mesaj');
    expect(texts.at(-1)).toBe('Son mesaj');
    expect(new Set(history.map((m) => m.id)).size).toBe(history.length);
    expect(history.every((m, i) => i === 0 || history[i - 1]!.at <= m.at)).toBe(true);
    // pencere: son historySize ileti + pencere dışında kalan oyuncu iletileri (en çok historySize)
    expect(history.filter((m) => m.from === 'sistem').length).toBeLessThanOrEqual(SOCIAL_LIMITS.historySize);
    // genel odada değişiklik yok
    await a.call('chat.join', { room: 'genel' });
  });
});
