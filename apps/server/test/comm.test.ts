import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { QUIZ_QUESTIONS } from '@odi/content';
import { setup, run, type Env, type TC } from './helpers';
import { feedEvent } from '../src/comm';
import { maskProfanity } from '../src/profanity';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
/** 1..to-1 bölümlerini geç (en yüksek açık bölüm = to) */
async function climb(c: TC, to: number, over: Partial<Parameters<typeof run>[1]> = {}) { for (let l = 1; l < to; l++) await c.call('progress.submit', run(l, over)); }
const inboxSum = async (c: TC, kind = 'jeton', ref?: string) => (await c.call('inbox.list', {})).items.filter((i) => i.kind === kind && (!ref || i.ref === ref)).reduce((a, i) => a + i.amount, 0);
async function team(...cs: TC[]) {
  const t = (await cs[0]!.call('team.create', { name: `Kulak ${Math.random().toString(36).slice(2, 7)}`, emblem: '👂' })).team;
  for (const c of cs.slice(1)) await c.call('team.join', { teamId: t.id });
  return { id: t.id, room: `takim:${t.id}` };
}
async function befriend(a: TC, b: TC) { await a.call('friends.add', { code: b.me!.friendCode }); await b.call('friends.add', { code: a.me!.friendCode }); }
const feedOf = (c: TC, type: string) => c.waitFor('chat', (x) => x.msg.kind === 'feed' && x.msg.meta?.type === type);

describe('Hızlı Sohbet ve güvenli varsayılan', () => {
  it('güvenli sohbet ZORUNLU: 8 bölüm geçilene kadar yalnız hazır söz/emoji (açma seçeneği yok); 8 geçilince kendiliğinden açılır', async () => {
    env = await setup({ freeTextCleared: 8 });
    const a = await env!.connect('Ayşe');
    const b = await env!.connect('Bora');
    expect((await a.call('comm.state', {})).settings).toEqual({ canFreeText: false, feedShare: true, freeTextLevel: 8 });
    await a.call('chat.join', { room: 'genel' });
    const e = await err(a.call('chat.send', { room: 'genel', text: 'merhaba' }));
    expect(e.code).toBe('SERBEST_KAPALI');
    expect(e.message).toContain('8. bölümden sonra');
    const h = await a.call('chat.send', { room: 'genel', text: 'tebrik', kind: 'hazir' });
    expect(h.msg).toMatchObject({ kind: 'hazir', text: 'Tebrikler!', meta: { p: 'tebrik' } });
    env!.clock.advance(1300);
    expect((await err(a.call('chat.send', { room: 'genel', text: 'uydurma', kind: 'hazir' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('chat.send', { room: 'genel', text: 'yazı', kind: 'emoji' }))).code).toBe('GECERSIZ');
    await a.call('chat.send', { room: 'genel', text: '👍', kind: 'emoji' });
    // özel mesaj: aynı kural
    await befriend(a, b);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'selam' }))).code).toBe('SERBEST_KAPALI');
    const d = await a.call('dm.send', { to: b.me!.id, text: 'selam', kind: 'hazir' });
    expect(d.msg).toMatchObject({ kind: 'hazir', text: 'Selam!' });
    env!.clock.advance(700);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'yok-boyle', kind: 'hazir' }))).code).toBe('GECERSIZ');
    // eski istemcinin "aç" isteği hiçbir şey açmaz (alan şemadan atılır)
    expect((await a.call('comm.settings', { freeText: true } as never)).settings.canFreeText).toBe(false);
    env!.clock.advance(1300);
    expect((await err(a.call('chat.send', { room: 'genel', text: 'yine deniyorum' }))).code).toBe('SERBEST_KAPALI');
    // 7 bölüm geçmiş: hâlâ kapalı; 8. bölümü geçince kendiliğinden açık
    await climb(b, 8);
    expect((await b.call('comm.state', {})).settings.canFreeText).toBe(false);
    await b.call('chat.join', { room: 'genel' });
    expect((await err(b.call('chat.send', { room: 'genel', text: 'ben de' }))).code).toBe('SERBEST_KAPALI');
    await b.call('progress.submit', run(8));
    expect((await b.call('comm.state', {})).settings.canFreeText).toBe(true);
    env!.clock.advance(1300);
    expect((await b.call('chat.send', { room: 'genel', text: 'ben de' })).msg.kind).toBe('text');
    expect((await b.call('dm.send', { to: a.me!.id, text: 'artık yazabiliyorum' })).msg.kind).toBe('text');
    const olcum = await (await fetch(`${env!.srv.httpUrl}/olcum`)).json() as { days: Record<string, Record<string, number>> };
    expect(Object.values(olcum.days)[0]!['msg.hazir']).toBeGreaterThanOrEqual(1);
  });
});

describe('Takım Akışı', () => {
  it('gerçek olaylardan kart; 30 dk içinde birleşir; aynı runId bir kez; paylaşım kapanabilir; boss ve koklea', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    const t = await team(a, b);
    b.drain();
    const r1 = run(1, { stars: 2 });
    await a.call('progress.submit', r1);
    const card = (await feedOf(b, 'bolum')).msg;
    expect(card).toMatchObject({ from: 'sistem', kind: 'feed', text: 'Ayşe 1. bölümü 2 yıldızla geçti.' });
    expect(card.meta).toMatchObject({ pid: a.me!.id, pname: 'Ayşe' });
    // aynı koşu tekrar: hiçbir şey
    await a.call('progress.submit', r1);
    // 2. bölüm: aynı karta birleşir (yeni kart yok)
    await a.call('progress.submit', run(2, { stars: 3 }));
    const merged = await b.waitFor('chat.updated', (x) => x.msg.id === card.id);
    expect(merged.msg.text).toBe('Ayşe 2 bölümde ilerledi (1–2) · toplam 5 yıldız.');
    // eski bölümde 3 yıldıza çıkmak da birleşir; aynı bölüm iki kez sayılmaz
    await a.call('progress.submit', run(1, { stars: 3 }));
    expect((await b.waitFor('chat.updated', (x) => x.msg.id === card.id)).msg.text).toBe('Ayşe 2 bölümde ilerledi (1–2) · toplam 6 yıldız.');
    // zaten geçilmiş bölümü 3 yıldızla yeniden geçmek kart açmaz
    await a.call('progress.submit', run(2, { stars: 3 }));
    const hist = (await b.call('chat.join', { room: t.room })).history.filter((m) => m.kind === 'feed' && m.meta?.type === 'bolum');
    expect(hist).toHaveLength(1);
    // 31 dk sonra yeni kart
    env!.clock.advance(31 * 60_000);
    await a.call('progress.submit', run(3, { stars: 1, mechanic: 'boss' }));
    const c2 = (await feedOf(b, 'bolum')).msg;
    expect(c2.id).not.toBe(card.id);
    expect((await feedOf(b, 'boss')).msg.text).toContain('3. bölümün canavarını yendi');
    // altın koklea: yalnızca bölümdeki en iyi sayı artınca
    await a.call('progress.submit', run(4, { cochleas: 2 }));
    expect((await feedOf(b, 'koklea')).msg.text).toBe('Ayşe 4. bölümde 2 altın koklea buldu.');
    b.drain();
    await a.call('progress.submit', run(4, { cochleas: 2 }));
    await a.call('progress.submit', run(4, { cochleas: 3 }));
    expect((await b.waitFor('chat.updated', (x) => x.msg.meta?.type === 'koklea')).msg.meta?.n).toBe(3);
    // paylaşım kapalı: kart yok
    await a.call('comm.settings', { feedShare: false });
    b.drain();
    env!.clock.advance(31 * 60_000);
    await a.call('progress.submit', run(5));
    const after = (await b.call('chat.join', { room: t.room })).history.filter((m) => m.meta?.type === 'bolum' && m.text.includes('5. bölüm'));
    expect(after).toHaveLength(0);
  });

  it('takım başına saatte en çok 20 yeni kart; üye kartı her zaman', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    const t = await team(a, b);
    const app = env!.srv.app;
    let posted = 0;
    for (let i = 0; i < 25; i++) if (app.run(() => feedEvent(app, a.me!.id, 'seri', { days: 3 }))) posted++;
    // üye kartı (team.join) sınırın içinde sayılmaz ama sayılan kartlarda vardır
    expect(posted).toBeLessThanOrEqual(20);
    expect(posted).toBeGreaterThanOrEqual(18);
    const c = await env!.connect('Cem');
    await c.call('team.join', { teamId: t.id });
    expect((await a.waitFor('chat', (x) => x.msg.meta?.type === 'uye' && x.msg.text.startsWith('Cem'))).msg.text).toBe('Cem takıma katıldı.');
  });

  it('art arda oyun günü serisi dönüm noktasında kart', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    await team(a, b);
    for (let d = 0; d < 3; d++) { await a.call('progress.submit', run(1, { completed: false, stars: 0 })); env!.clock.advance(24 * 3_600_000); }
    expect((await feedOf(b, 'seri')).msg.text).toBe('Ayşe 3 gündür her gün oynuyor!');
  });

  it('tepkiler: tek tepki, geri alma, hız sınırı, yetki; konu yanıtı (Tebrik et) ve chat.thread', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora'); const c = await env!.connect('Cem'); const x = await env!.connect('Yabancı');
    const t = await team(a, b, c);
    await a.call('progress.submit', run(1));
    const card = (await feedOf(b, 'bolum')).msg;
    a.drain();
    const r = await b.call('chat.react', { msgId: card.id, reaction: 'alkis' });
    expect(r.msg.reactions).toEqual({ alkis: [b.me!.id] });
    expect((await a.waitFor('chat.updated', (u) => u.msg.id === card.id)).msg.reactions).toEqual({ alkis: [b.me!.id] });
    expect((await err(b.call('chat.react', { msgId: card.id, reaction: 'kalp' }))).code).toBe('HIZ');
    env!.clock.advance(300);
    expect((await b.call('chat.react', { msgId: card.id, reaction: 'kalp' })).msg.reactions).toEqual({ kalp: [b.me!.id] });
    env!.clock.advance(300);
    expect((await b.call('chat.react', { msgId: card.id, reaction: 'kalp' })).msg.reactions).toBeUndefined();
    expect((await err(b.call('chat.react', { msgId: card.id, reaction: 'yok' as never }))).code).toBe('GECERSIZ');
    expect((await err(x.call('chat.react', { msgId: card.id, reaction: 'alkis' }))).code).toBe('YETKI');
    // Tebrik et: hazır söz, kartın konusuna
    const rep = (await c.call('chat.send', { room: t.room, text: 'tebrik', kind: 'hazir', replyTo: card.id })).msg;
    expect(rep).toMatchObject({ replyTo: card.id, text: 'Tebrikler!' });
    expect((await a.waitFor('chat.updated', (u) => u.msg.id === card.id && u.msg.replies === 1)).msg.thread?.[0]?.text).toBe('Tebrikler!');
    // yanıta yanıt üst karta bağlanır
    env!.clock.advance(1300);
    const rep2 = (await a.call('chat.send', { room: t.room, text: 'tesekkur', kind: 'hazir', replyTo: rep.id })).msg;
    expect(rep2.replyTo).toBe(card.id);
    // geçmiş: yanıtlar akışa ayrıca düşmez; kartın altında önizleme
    const h = (await b.call('chat.join', { room: t.room })).history;
    expect(h.some((m) => m.id === rep.id)).toBe(false);
    const hc = h.find((m) => m.id === card.id)!;
    expect(hc.replies).toBe(2);
    expect(hc.thread!.map((m) => m.text)).toEqual(['Tebrikler!', 'Teşekkürler!']);
    const th = await b.call('chat.thread', { msgId: card.id });
    expect(th.replies.map((m) => m.id)).toEqual([rep.id, rep2.id]);
    // başka odadaki mesaja yanıt verilemez
    expect((await err(b.call('chat.send', { room: 'genel', text: 'tebrik', kind: 'hazir', replyTo: card.id }))).code).toBe('YOK');
    expect((await err(x.call('chat.thread', { msgId: card.id }))).code).toBe('YETKI');
    // sessize alınanın tepkisi görünmez
    env!.clock.advance(300);
    await c.call('chat.react', { msgId: card.id, reaction: 'ates' });
    await a.call('chat.mute', { id: c.me!.id, on: true });
    const ha = (await a.call('chat.join', { room: t.room })).history.find((m) => m.id === card.id)!;
    expect(ha.reactions?.ates).toBeUndefined();
    expect(ha.replies).toBe(1);
  });

  it('@bahsetme: takım üyesine bildirim; sessize alan almaz; en çok 3', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora'); const c = await env!.connect('Cem Can');
    const t = await team(a, b, c);
    const m = (await b.call('chat.send', { room: t.room, text: '@ayşe ve @Cem Can bakın!' })).msg;
    expect(m.meta?.at).toBeTruthy();
    expect((await a.waitFor('comm.notice', (n) => n.notice.kind === 'mention')).notice).toMatchObject({ title: 'Bora senden bahsetti', room: t.room, msgId: m.id });
    await c.waitFor('comm.notice', (n) => n.notice.kind === 'mention');
    // '@Ayşek' Ayşe değildir
    env!.clock.advance(1300);
    expect((await b.call('chat.send', { room: t.room, text: 'selam @Ayşek' })).msg.meta?.at).toBeUndefined();
    await a.call('chat.mute', { id: b.me!.id, on: true });
    a.drain();
    env!.clock.advance(1300);
    await b.call('chat.send', { room: t.room, text: '@Ayşe yine ben' });
    await expect(a.waitFor('comm.notice', (n) => n.notice.kind === 'mention', 400)).rejects.toThrow();
  });
});

describe('Yardım İste', () => {
  it('kart → ipucu / kalkan / birlikte yarış → isteyen geçince bir kez ödül ve teşekkür', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora'); const c = await env!.connect('Cem');
    const t = await team(a, b, c);
    await climb(a, 3); await climb(b, 5);
    b.drain(); c.drain();
    const req = (await a.call('team.help.request', { level: 3 })).request;
    const card = (await b.waitFor('chat', (x) => x.msg.kind === 'help')).msg;
    expect(card.meta).toMatchObject({ requestId: req.id, level: 3, pid: a.me!.id });
    // ipucu: hazır söz, kartın konusuna
    const tip = (await b.call('help.tip', { requestId: req.id, phrase: 'ipucu-bas' })).msg;
    expect(tip).toMatchObject({ replyTo: card.id, text: 'İpucu: uzun zıplamak için basılı tut.' });
    expect((await a.waitFor('comm.notice', (n) => n.notice.kind === 'thanks')).notice.title).toBe('Bora sana ipucu verdi');
    expect((await err(b.call('help.tip', { requestId: req.id, phrase: 'ipucu-erken' }))).code).toBe('TEKRAR');
    expect((await err(c.call('help.tip', { requestId: req.id, phrase: 'tebrik' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('help.tip', { requestId: req.id, phrase: 'ipucu-bas' }))).code).toBe('GECERSIZ');
    // kalkan (mevcut işlem) kartın sayacını artırır
    await c.call('team.help.give', { requestId: req.id });
    expect((await b.waitFor('chat.updated', (u) => u.msg.id === card.id && u.msg.meta?.kalkan === 1)).msg.meta).toMatchObject({ ipucu: 1, kalkan: 1 });
    // birlikte yarış: bölümü açmamış olan kuramaz; açmış olan kurar, isteyene davet gider
    expect((await err(c.call('help.race', { requestId: req.id }))).code).toBe('SART');
    const room = (await b.call('help.race', { requestId: req.id })).room;
    expect(room.level).toBe(3);
    expect((await a.waitFor('race.invited')).room.id).toBe(room.id);
    await b.call('race.leave', {});
    // isteyen bölümü geçer → çözülür
    a.drain(); b.drain(); c.drain();
    await a.call('progress.submit', run(3));
    expect((await b.waitFor('comm.notice', (n) => n.notice.kind === 'thanks')).notice).toMatchObject({ title: 'Ayşe 3. bölümü geçti!', msgId: card.id });
    await c.waitFor('comm.notice', (n) => n.notice.kind === 'thanks');
    expect((await feedOf(b, 'yardim')).msg.text).toBe('Ayşe 3. bölümü takımının yardımıyla geçti! Teşekkürler: Bora, Cem.');
    expect(await inboxSum(a, 'jeton', 'yardim')).toBe(15);
    expect(await inboxSum(b, 'jeton', 'yardim')).toBe(20);
    expect(await inboxSum(c, 'jeton', 'yardim')).toBe(20);
    // ikinci kez geçmek ödül vermez; kapanan isteğe ipucu yok
    await a.call('progress.submit', run(3));
    expect(await inboxSum(b, 'jeton', 'yardim')).toBe(20);
    expect((await err(c.call('help.tip', { requestId: req.id, phrase: 'ipucu-erken' }))).code).toBe('BITTI');
    // "Rica ederim": kartın konusuna hazır söz
    env!.clock.advance(1300);
    expect((await b.call('chat.send', { room: t.room, text: 'rica', kind: 'hazir', replyTo: card.id })).msg.replyTo).toBe(card.id);
    // süresi dolan istek
    const r2 = (await a.call('team.help.request', { level: 4 })).request;
    env!.clock.advance(25 * 3_600_000);
    expect((await err(b.call('help.tip', { requestId: r2.id, phrase: 'ipucu-bas' }))).code).toBe('SURE');
  });

  it('kimse yardım etmediyse geçmek ödül vermez; serbest yazı ipucu kurala uyar', async () => {
    env = await setup({ freeTextCleared: 8 });
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    await team(a, b);
    await climb(a, 2);
    const req = (await a.call('team.help.request', { level: 2 })).request;
    expect((await err(b.call('help.tip', { requestId: req.id, text: 'şurada zıpla' }))).code).toBe('SERBEST_KAPALI');
    await a.call('progress.submit', run(2));
    expect(await inboxSum(a, 'jeton', 'yardim')).toBe(0);
  });
});

describe('Takıma meydan oku', () => {
  it('sunucudaki en iyi skor; geçen takım arkadaşı kartın konusuna bir kez yazılır; günde 3', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    await team(a, b);
    expect((await err(a.call('feed.challenge', { level: 1 }))).code).toBe('SART');
    await a.call('progress.submit', run(1, { score: 1000 }));
    const card = (await a.call('feed.challenge', { level: 1 })).msg;
    expect(card.meta).toMatchObject({ type: 'meydan', level: 1, score: 1000 });
    expect(card.text).toContain('1.000 puanla meydan okuyor');
    await b.call('progress.submit', run(1, { score: 900 }));
    a.drain();
    await b.call('progress.submit', run(1, { score: 1500 }));
    expect((await a.waitFor('comm.notice', (n) => n.notice.kind === 'challenge')).notice.title).toBe('Meydan okuman geçildi!');
    const reply = await a.waitFor('chat', (x) => x.msg.replyTo === card.id);
    expect(reply.msg.text).toBe('Bora 1.500 puanla geçti!');
    await b.call('progress.submit', run(1, { score: 1800 }));
    expect((await a.call('chat.thread', { msgId: card.id })).replies).toHaveLength(1);
    await a.call('feed.challenge', { level: 1 }); await a.call('feed.challenge', { level: 1 });
    expect((await err(a.call('feed.challenge', { level: 1 }))).code).toBe('LIMIT');
    expect((await err(b.call('feed.challenge', { level: 99 }))).code).toBe('GECERSIZ');
  });
});

describe('Günün Sorusu', () => {
  it('Tüy Dede kartı; bir kez cevap; açıklamada doğru bilene bir kez ödül; haftalık tablo; Çalışma Grubu', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora'); const c = await env!.connect('Cem');
    const t = await team(a, b, c);
    const h = (await a.call('chat.join', { room: t.room })).history;
    const card = h.find((m) => m.kind === 'soru')!;
    expect(card).toMatchObject({ from: 'sistem', name: 'Tüy Dede' });
    // ikinci giriş yeni kart açmaz
    expect((await b.call('chat.join', { room: t.room })).history.filter((m) => m.kind === 'soru')).toHaveLength(1);
    const st = await a.call('dq.state', {});
    const q = st.question!;
    expect(q).toMatchObject({ msgId: card.id, revealed: false, answer: null, explain: null, answered: 0, myChoice: null, level: 'merakli' });
    const def = QUIZ_QUESTIONS.find((x) => x.text === q.text)!;
    const wrong = (def.answer + 1) % 4;
    expect((await a.call('dq.answer', { choice: def.answer })).question!.myChoice).toBe(def.answer);
    expect((await b.waitFor('chat.updated', (u) => u.msg.id === card.id)).msg.meta?.n).toBe(1);
    expect((await err(a.call('dq.answer', { choice: wrong }))).code).toBe('TEKRAR');
    await b.call('dq.answer', { choice: wrong });
    // açıklanmadan doğru şık görünmez
    expect((await c.call('dq.state', {})).question!.answer).toBeNull();
    // 20:00 (test saati 12:00) → açıklama
    env!.clock.advance(8 * 3_600_000 + 1000);
    env!.srv.sweep();
    const rev = await c.waitFor('chat.updated', (u) => u.msg.id === card.id && u.msg.meta?.rev === 1);
    expect(rev.msg.meta).toMatchObject({ ans: def.answer, exp: def.explain, ok: 'Ayşe', okn: 1 });
    expect(await inboxSum(a, 'jeton', 'gunun-sorusu')).toBe(10);
    expect(await inboxSum(b, 'jeton', 'gunun-sorusu')).toBe(0);
    env!.srv.sweep();
    expect(await inboxSum(a, 'jeton', 'gunun-sorusu')).toBe(10);
    expect((await err(c.call('dq.answer', { choice: 0 }))).code).toBe('SURE');
    const s2 = await c.call('dq.state', {});
    expect(s2.question).toMatchObject({ revealed: true, answer: def.answer, correct: [{ id: a.me!.id, name: 'Ayşe' }] });
    expect(s2.week.map((r) => [r.name, r.correct])).toEqual([['Ayşe', 1], ['Bora', 0]]);
    // Çalışma Grubu: yalnız lider/yardımcı; ertesi gün öğrenci düzeyi
    expect((await err(b.call('team.study', { on: true }))).code).toBe('YETKI');
    expect((await a.call('team.study', { on: true })).study).toBe(true);
    env!.clock.advance(12 * 3_600_000);
    const next = (await c.call('dq.state', {})).question!;
    expect(next.level).toBe('odyoloji');
    expect(next.msgId).not.toBe(card.id);
    expect(QUIZ_QUESTIONS.find((x) => x.text === next.text)!.level).toBe('odyoloji');
  });
});

describe('İkili Görev', () => {
  it('arkadaşla davet/kabul; ortak notalar; kademe ödülü ikisine bir kez', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora'); const c = await env!.connect('Cem');
    expect((await err(a.call('duo.invite', { friendId: c.me!.id }))).code).toBe('YETKI');
    await befriend(a, b); await befriend(a, c);
    expect((await a.call('duo.state', {})).duo.candidates.map((p) => p.name).sort()).toEqual(['Bora', 'Cem']);
    const inv = (await a.call('duo.invite', { friendId: b.me!.id })).duo.outgoing[0]!;
    expect((await err(a.call('duo.invite', { friendId: b.me!.id }))).code).toBe('TEKRAR');
    expect((await b.waitFor('comm.notice', (n) => n.notice.kind === 'duo')).notice.title).toBe('Ayşe seni İkili Göreve çağırıyor');
    const acc = (await b.call('duo.respond', { inviteId: inv.id, accept: true })).duo;
    expect(acc.active!.members.map((m) => m.name)).toEqual(['Ayşe', 'Bora']);
    expect((await err(a.call('duo.invite', { friendId: c.me!.id }))).code).toBe('TEKRAR');
    const r1 = run(1, { coins: 100 });
    await a.call('progress.submit', r1);
    await a.call('progress.submit', r1); // aynı koşu: bir kez
    await b.call('progress.submit', run(1, { coins: 150 }));
    expect((await a.call('duo.state', {})).duo.active!.progress).toBe(250);
    await b.call('progress.submit', run(2, { coins: 60 }));
    const st = (await a.call('duo.state', {})).duo.active!;
    expect(st.progress).toBe(310);
    expect(st.tiers.map((x) => x.reached)).toEqual([true, false]);
    expect(await inboxSum(a, 'jeton', 'ikili')).toBe(120);
    expect(await inboxSum(b, 'kristal', 'ikili')).toBe(10);
    await a.call('progress.submit', run(2, { coins: 50 }));
    expect(await inboxSum(a, 'jeton', 'ikili')).toBe(120);
    // ret ve günlük sınır
    const d = await env!.connect('Deniz');
    await befriend(c, d);
    for (let i = 0; i < 5; i++) { const x = (await c.call('duo.invite', { friendId: d.me!.id })).duo.outgoing[0]!; await d.call('duo.respond', { inviteId: x.id, accept: false }); }
    expect((await err(c.call('duo.invite', { friendId: d.me!.id }))).code).toBe('LIMIT');
  });
});

describe('Usta–Çırak', () => {
  it('teklif/kabul; yalnızca bağdan sonraki dönüm noktaları; ikisine bir kez ödül; şartlar', async () => {
    env = await setup();
    const m = await env!.connect('Usta'); const c = await env!.connect('Çırak'); const x = await env!.connect('Yabancı'); const y = await env!.connect('Orta');
    await climb(m, 11); await climb(c, 3); await climb(y, 6);
    await befriend(m, c); await befriend(m, y);
    expect((await err(m.call('mentor.offer', { id: x.me!.id, as: 'usta' }))).code).toBe('YETKI');
    expect((await err(c.call('mentor.offer', { id: m.me!.id, as: 'usta' }))).code).toBe('SART');
    const st = (await m.call('mentor.state', {})).mentor;
    expect(st.canMentor).toBe(true);
    expect(st.candidates.map((p) => p.name).sort()).toEqual(['Orta', 'Çırak']);
    await m.call('mentor.offer', { id: c.me!.id, as: 'usta' });
    expect((await err(m.call('mentor.offer', { id: c.me!.id, as: 'usta' }))).code).toBe('TEKRAR');
    expect((await c.waitFor('comm.notice', (n) => n.notice.kind === 'mentor')).notice.title).toBe('Usta sana usta olmak istiyor');
    const inc = (await c.call('mentor.state', {})).mentor.incoming[0]!;
    const linked = (await c.call('mentor.respond', { offerId: inc.id, accept: true })).mentor;
    expect(linked.mentor).toMatchObject({ startHighest: 3, next: 5, reached: [] });
    // çırak 5. bölüme ulaşır → ikisine ödül, ustaya dürtme
    m.drain();
    await c.call('progress.submit', run(3)); await c.call('progress.submit', run(4));
    expect((await m.waitFor('comm.notice', (n) => n.notice.kind === 'mentor')).notice.title).toBe('Çırağın Çırak 5. bölüme ulaştı!');
    expect(await inboxSum(c, 'jeton', 'usta-cirak')).toBe(40);
    expect(await inboxSum(m, 'jeton', 'usta-cirak')).toBe(30);
    expect(await inboxSum(m, 'kristal', 'usta-cirak')).toBe(5);
    await c.call('progress.submit', run(4));
    expect(await inboxSum(c, 'jeton', 'usta-cirak')).toBe(40);
    expect((await m.call('mentor.state', {})).mentor.apprentices[0]).toMatchObject({ reached: [5], next: 10 });
    // çırağın başka ustası olamaz; bağ bitince yeniden kurulsa da aynı dönüm noktası tekrar ödül vermez
    const link = (await m.call('mentor.state', {})).mentor.apprentices[0]!;
    await c.call('mentor.end', { linkId: link.id });
    expect((await m.call('mentor.state', {})).mentor.apprentices).toHaveLength(0);
    // çırak tarafından teklif (as: cirak) ve karşılıklı teklif = kabul
    await c.call('mentor.offer', { id: m.me!.id, as: 'cirak' });
    const re = (await m.call('mentor.offer', { id: c.me!.id, as: 'usta' })).mentor;
    expect(re.apprentices).toHaveLength(1);
    expect(re.apprentices[0]!.startHighest).toBe(5);
  });
});

describe('küfür filtresi (yeni yüzeyler)', () => {
  it('Türkçe argo kısaltmalar ve yeni kökler maskelenir, masum kelimeler kalır', () => {
    for (const bad of ['skm', 'sktr', 'siktr', 'sikko', 'gerizekalı', 'dangalak', 'a.q', 'yarrrak']) expect(maskProfanity(`sen ${bad} oldun`).masked, bad).toBe(true);
    for (const ok of ['şikayet ettim', 'kasık ağrısı', 'ambulans geldi', 'malzeme listesi', 'tasarım güzel', 'Sıkı çalış', 'göz kapağı']) expect(maskProfanity(ok).masked, ok).toBe(false);
  });
  it('ipucu ve yanıt metninde küfür yıldızlanır', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe'); const b = await env!.connect('Bora');
    const t = await team(a, b);
    await climb(a, 2);
    const req = (await a.call('team.help.request', { level: 2 })).request;
    const tip = (await b.call('help.tip', { requestId: req.id, text: 'zıpla dangalak' })).msg;
    expect(tip.text).toBe('zıpla ********');
    env!.clock.advance(1300);
    const rep = (await a.call('chat.send', { room: t.room, text: 'sağol skm', replyTo: tip.replyTo })).msg;
    expect(rep.text).toBe('sağol ***');
  });
});

describe('protokol', () => {
  it('her yeni işlem şemayla doğrulanır', async () => {
    env = await setup();
    const a = await env!.connect('Ayşe');
    for (const [op, data] of [
      ['chat.react', { msgId: '' }], ['chat.thread', {}], ['comm.settings', { feedShare: 'evet' }], ['feed.challenge', { level: 0 }],
      ['help.tip', { requestId: 'x', phrase: 'Büyük Harf' }], ['help.race', {}], ['dq.answer', { choice: 7 }], ['team.study', {}],
      ['duo.invite', {}], ['duo.respond', { inviteId: 'x' }], ['mentor.offer', { id: 'x', as: 'kral' }], ['mentor.respond', { offerId: 'x' }], ['mentor.end', {}],
    ] as const) expect((await err(a.call(op as never, data as never))).code, op).toBe('GECERSIZ');
    expect((await err(a.call('dq.state', {}))).code).toBe('TAKIM_YOK');
    expect((await err(a.call('chat.send', { room: 'genel', text: 'x', replyTo: 'm-yok!' }))).code).toBe('GECERSIZ');
  });
});
