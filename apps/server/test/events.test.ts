import { afterEach, describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS } from '@odi/content';
import { RALLY_MONSTERS, rallyDamageFor, rallyMaxHp } from '@odi/shared';
import { duelPeriods, huntPeriods, quizSlot } from '../src/events/common';
import { DUEL_REWARDS } from '../src/events/duel';
import { HUNT_TIERS } from '../src/events/hunt';
import { QUESTION_MS, REVEAL_MS } from '../src/events/quiz';
import { run, setup, T0, type Env } from './helpers';
import { connectW, erun, err, team2 } from './events-util';

let env: Env;
afterEach(async () => { await env?.close(); env = undefined as unknown as Env; });
const MIN = 60_000;

describe('Ralli', () => {
  it('başlat → sohbet + bildirim, en az 2 katılımcı, hasar, kazanınca herkese ödül ve takım XP, idempotent vuruş', async () => {
    env = await setup();
    const [a, b, teamId] = await team2(env, ['Ayşe', 'Bora'], 'Ralli Kurtları');
    const other = await connectW(env, 'Cem');
    await other.c.call('team.create', { name: 'Başka Takım', emblem: '🐢' });
    const xp0 = (await a.c.call('team.extra', {})).extra.xp;
    const { rally } = await a.c.call('rally.start', { monster: 'serumen-yavrusu' });
    const def = RALLY_MONSTERS[0]!;
    expect(rally).toMatchObject({ status: 'acik', hp: rallyMaxHp(def, 2), maxHp: 200, monster: 'serumen-yavrusu' });
    expect(rally.endsAt - rally.startsAt).toBe(10 * MIN);
    const notice = await b.wait('events.notice', (n) => n.notice.kind === 'ralli');
    expect(notice.notice.title).toBe('Ayşe ralli başlattı!');
    expect(notice.notice.text).toContain('10:00');
    const chat = await b.wait('chat', (m) => m.msg.meta?.event === 'ralli');
    expect(chat.msg.text).toContain('Ayşe ralli başlattı');
    // aynı anda ikinci ralli yok; başka takım katılamaz
    expect((await err(b.c.call('rally.start', { monster: 'cinlama-cini' }))).code).toBe('MESGUL');
    expect((await err(other.c.call('rally.join', { rallyId: rally.id }))).code).toBe('YOK');
    // tek katılımcıyla saldırı yok
    expect((await err(a.c.call('rally.hit', { rallyId: rally.id, ...erun() }))).code).toBe('SART');
    expect((await err(b.c.call('rally.hit', { rallyId: rally.id, ...erun() }))).code).toBe('YETKI');
    await b.c.call('rally.join', { rallyId: rally.id });
    const r1 = erun({ stars: 2 });
    const h1 = await a.c.call('rally.hit', { rallyId: rally.id, ...r1 });
    expect(h1.damage).toBe(rallyDamageFor({ completed: true, stars: 2 }));
    expect(h1.rally.hp).toBe(200 - 120);
    expect((await a.c.call('rally.hit', { rallyId: rally.id, ...r1 })).damage).toBe(120); // aynı runId: tekrar sayılmaz
    expect((await b.wait('rally.updated', (x) => x.rally.hp === 80)).rally.hits[0]).toMatchObject({ name: 'Ayşe', damage: 120 });
    const h2 = await b.c.call('rally.hit', { rallyId: rally.id, ...erun({ stars: 3 }) });
    expect(h2.damage).toBe(80); // kalan can kadar
    expect(h2.rally).toMatchObject({ status: 'kazanildi', hp: 0 });
    expect(h2.rally.participants.map((p) => [p.name, p.damage])).toEqual([['Ayşe', 120], ['Bora', 80]]);
    await a.wait('events.notice', (n) => n.notice.title.includes('yenildi'));
    for (const c of [a, b]) {
      const items = (await c.c.call('inbox.list', {})).items.filter((i) => i.reason.startsWith('Ralli kazanıldı'));
      expect(items.map((i) => [i.kind, i.amount]).sort()).toEqual([['jeton', 150], ['kristal', 10]]);
    }
    expect((await other.c.call('inbox.list', {})).items).toHaveLength(0);
    expect((await a.c.call('team.extra', {})).extra.xp).toBe(xp0 + def.teamXp);
    expect((await err(a.c.call('rally.hit', { rallyId: rally.id, ...erun() }))).code).toBe('BITTI');
    expect((await a.c.call('rally.state', {})).startsLeft).toBe(5);
    expect(teamId).toBeTruthy();
  });

  it('süre dolunca kaçar (bildirim), deneme hakkı 3, günlük başlatma sınırı', async () => {
    env = await setup();
    const [a, b] = await team2(env, ['Ayşe', 'Bora'], 'Yankı Avcıları');
    const { rally } = await a.c.call('rally.start', { monster: 'yanki-hayaleti' });
    await b.c.call('rally.join', { rallyId: rally.id });
    for (let i = 0; i < 3; i++) await b.c.call('rally.hit', { rallyId: rally.id, ...erun({ completed: false, stars: 0 }) });
    expect((await err(b.c.call('rally.hit', { rallyId: rally.id, ...erun() }))).code).toBe('LIMIT');
    expect((await a.c.call('rally.state', {})).rally!.hp).toBe(rallyMaxHp(RALLY_MONSTERS[2]!, 2) - 45);
    env.clock.advance(10 * MIN + 1);
    env.srv.sweep();
    const n = await a.wait('events.notice', (x) => x.notice.title.includes('kaçtı'));
    expect(n.notice.kind).toBe('ralli');
    expect((await a.c.call('rally.state', {})).rally!.status).toBe('kaybedildi');
    expect((await err(a.c.call('rally.hit', { rallyId: rally.id, ...erun() }))).code).toBe('SURE');
    for (let i = 0; i < 5; i++) { const r = await a.c.call('rally.start', { monster: 'serumen-yavrusu' }); env.clock.advance(10 * MIN + 1); env.srv.sweep(); expect(r.rally.status).toBe('acik'); }
    expect((await err(a.c.call('rally.start', { monster: 'serumen-yavrusu' }))).code).toBe('LIMIT');
  });
});

describe('Takım Düellosu', () => {
  it('takvim: Pzt–Çar ve Per–Cmt (48 saat), aradaysa kapalı', async () => {
    env = await setup();
    const app = env.srv.app;
    const d = duelPeriods(app, T0); // Çarşamba 12:00
    expect(d.cur).toBeNull();
    expect(new Date(d.next.startsAt).toISOString()).toBe('2026-10-14T21:00:00.000Z'); // Perşembe 00:00 +03
    expect(d.next.endsAt - d.next.startsAt).toBe(48 * 3600_000);
    expect(duelPeriods(app, d.next.startsAt + 1).cur?.key).toBe('2026-W42-B');
    expect(huntPeriods(app, T0).cur?.key).toBe('2026-W42-A');
    const q = quizSlot(app, T0);
    expect(q.open).toBe(false);
    expect(new Date(q.nextAt).toISOString()).toBe('2026-10-14T10:00:00.000Z'); // 13:00 +03
    const a = await connectW(env, 'Ayşe');
    await a.c.call('team.create', { name: 'Kapalı Dönem', emblem: '🌙' });
    expect((await a.c.call('duel.state', {})).duel).toMatchObject({ status: 'kapali', me: null, period: null });
  });

  it('hızlı mod: rakip aranıyor → güce yakın eşleşme, canlı skor, son 2 saat bildirimi, sabit ödüller', async () => {
    env = await setup({ eventsFast: true });
    const [a, a2] = await team2(env, ['Ayşe', 'Ali'], 'Düello Kartalları');
    const b = await connectW(env, 'Bora');
    await b.c.call('team.create', { name: 'Bas Baykuşları', emblem: '🦉' });
    expect((await a.c.call('duel.state', {})).duel).toMatchObject({ status: 'araniyor', rival: null });
    const st = (await b.c.call('duel.state', {})).duel;
    expect(st.status).toBe('eslesti');
    expect(st.rival?.name).toBe('Düello Kartalları');
    expect((await a.wait('events.notice', (n) => n.notice.kind === 'duello')).notice.text).toContain('Bas Baykuşları');
    await a.c.call('progress.submit', run(1, { stars: 3 }));
    await a2.c.call('progress.submit', run(1, { stars: 2 }));
    await b.c.call('progress.submit', run(1, { stars: 1 }));
    const live = await b.wait('duel.updated', (x) => x.duel.rival?.points === 50 && x.duel.me?.points === 10);
    expect(live.duel.me?.points).toBe(10);
    // ralli kazanmak da sayılır
    const { rally } = await a.c.call('rally.start', { monster: 'serumen-yavrusu' });
    await a2.c.call('rally.join', { rallyId: rally.id });
    await a.c.call('rally.hit', { rallyId: rally.id, ...erun({ stars: 3 }) });
    await a2.c.call('rally.hit', { rallyId: rally.id, ...erun({ stars: 3 }) });
    const mine = (await a.c.call('duel.state', {})).duel;
    expect(mine.me?.points).toBe(50 + 2 * 60);
    expect(mine.me?.top[0]).toMatchObject({ name: 'Ayşe', points: 90 });
    expect(mine.finalPush).toBe(false);
    // son 2 dakika (hızlı mod: saat → dakika)
    env.clock.advance(46 * MIN + 1);
    env.srv.sweep();
    expect((await b.wait('events.notice', (n) => n.notice.title.includes('son 2 saat'))).notice.text).toContain('160 puan gerideyiz');
    expect((await a.c.call('duel.state', {})).duel.finalPush).toBe(true);
    env.clock.advance(2 * MIN);
    env.srv.sweep();
    const won = (await a.c.call('inbox.list', {})).items.filter((i) => i.reason.includes('Düellosu'));
    expect(won.map((i) => [i.kind, i.amount]).sort()).toEqual(DUEL_REWARDS.win.map((r) => [r.kind, r.amount]).sort());
    const lost = (await b.c.call('inbox.list', {})).items.filter((i) => i.reason.includes('Düellosu'));
    expect(lost.map((i) => i.amount).sort((x, y) => x - y)).toEqual([15, 100]);
    const after = (await a.c.call('duel.state', {})).duel;
    expect(after.last).toMatchObject({ result: 'kazandi', mine: 170, theirs: 10, rivalName: 'Bas Baykuşları' });
    expect(after.status).toBe('araniyor'); // yeni dönem, yeni eşleşme bekleniyor
  });
});

describe('Bayrak Yarışı', () => {
  it('bayrak al → ayak koş → devret (bildirim) → 4 ayak → toplam süre, iyileştirme, hafta sonu ödül', async () => {
    env = await setup({ eventsFast: true });
    const [a, b] = await team2(env, ['Ayşe', 'Bora'], 'Bayrakçılar');
    let relay = (await a.c.call('relay.state', {})).relay;
    expect(relay.legs).toHaveLength(4);
    expect(relay.current).toBe(0);
    expect((await err(a.c.call('relay.submit', { leg: 0, ...erun() }))).code).toBe('YETKI');
    relay = (await a.c.call('relay.take', {})).relay;
    expect(relay.carrier?.name).toBe('Ayşe');
    expect((await err(b.c.call('relay.take', {}))).code).toBe('MESGUL');
    expect((await err(a.c.call('relay.submit', { leg: 1, ...erun() }))).code).toBe('SART');
    await a.c.call('relay.submit', { leg: 0, ...erun({ completed: false, stars: 0, timeSec: 12 }) });
    expect((await a.c.call('relay.state', {})).relay.carrier?.name).toBe('Ayşe'); // başarısız koşu: bayrak sende kalır
    const r0 = erun({ timeSec: 31.4 });
    relay = (await a.c.call('relay.submit', { leg: 0, ...r0 })).relay;
    expect(relay).toMatchObject({ current: 1, carrier: null, lastRunner: { name: 'Ayşe' } });
    expect(relay.legs[0]!.best).toMatchObject({ name: 'Ayşe', timeSec: 31.4 });
    expect((await a.c.call('relay.submit', { leg: 0, ...r0 })).relay.current).toBe(1); // idempotent
    expect((await err(a.c.call('relay.take', {}))).code).toBe('SART'); // art arda iki ayak yok
    await a.c.call('relay.pass', { to: (await b.c.call('relay.state', {})).relay.lastRunner!.id === a.c.me!.id ? b.c.me!.id : '' });
    expect((await b.wait('events.notice', (n) => n.notice.title === 'Bayrak sende!')).notice.text).toContain('2. ayağı');
    await b.c.call('relay.submit', { leg: 1, ...erun({ timeSec: 40 }) });
    await a.c.call('relay.take', {});
    await a.c.call('relay.submit', { leg: 2, ...erun({ timeSec: 35 }) });
    await b.c.call('relay.take', {});
    relay = (await b.c.call('relay.submit', { leg: 3, ...erun({ timeSec: 28.6 }) })).relay;
    expect(relay.current).toBe(4);
    expect(relay.totalSec).toBe(135);
    expect(relay.ranking[0]).toMatchObject({ name: 'Bayrakçılar', totalSec: 135, legs: 4 });
    // tamamlandıktan sonra: her ayakta en iyi süre geçerli
    const imp = await a.c.call('relay.submit', { leg: 3, ...erun({ timeSec: 25 }) });
    expect(imp.improved).toBe(true);
    expect(imp.relay.totalSec).toBe(131.4);
    expect((await a.c.call('relay.submit', { leg: 1, ...erun({ timeSec: 50 }) })).improved).toBe(false);
    env.clock.advance(61 * MIN);
    env.srv.sweep();
    for (const c of [a, b]) {
      const items = (await c.c.call('inbox.list', {})).items.filter((i) => i.reason.startsWith('Bayrak Yarışı'));
      expect(items.map((i) => `${i.kind}:${i.amount}`).sort()).toEqual(['jeton:120', 'kristal:10', 'kristal:50']);
    }
    expect((await a.c.call('relay.state', {})).relay.current).toBe(0); // yeni hafta, yeni parkur
  });
});

describe('Ses Avı ve günlük takım görevleri', () => {
  it('bölüm jetonları ortak melodiye yazılır; 8 kademe hediye, %100 şarkı; aynı runId bir kez', async () => {
    env = await setup({ eventsFast: true });
    const [a, b] = await team2(env, ['Ayşe', 'Bora'], 'Nota Avcıları');
    let hunt = (await a.c.call('hunt.state', {})).hunt;
    expect(hunt).toMatchObject({ target: 600, progress: 0, song: null });
    expect(hunt.tiers.map((t) => t.need)).toEqual([75, 150, 225, 300, 375, 450, 525, 600]);
    const r = run(1, { coins: 160 });
    await a.c.call('progress.submit', r);
    await a.c.call('progress.submit', r);
    expect((await b.wait('hunt.updated')).hunt.progress).toBe(160);
    expect((await a.c.call('hunt.state', {})).hunt.tiers.filter((t) => t.reached)).toHaveLength(2);
    await b.c.call('progress.submit', run(1, { coins: 400 }));
    await a.c.call('progress.submit', run(1, { coins: 100 }));
    hunt = (await a.c.call('hunt.state', {})).hunt;
    expect(hunt.progress).toBe(600);
    expect(hunt.song).toHaveLength(12);
    expect(hunt.contributors.map((c) => c.name)).toEqual(['Bora', 'Ayşe']);
    const gifts = (await b.c.call('team.extra', {})).extra.gifts.filter((g) => g.fromName === 'Ses Avı');
    expect(gifts).toHaveLength(HUNT_TIERS);
    await b.wait('events.notice', (n) => n.notice.title === 'Takım şarkısı açıldı!');
  });

  it('3 günlük görev (biri hep bölüm), hedef takım boyutuna göre, tamamlanınca hediye + canlı ilerleme', async () => {
    env = await setup();
    const [a, b] = await team2(env, ['Ayşe', 'Bora'], 'Görevciler');
    const q = (await a.c.call('tquests.state', {})).quests;
    expect(q.quests).toHaveLength(3);
    expect(q.quests[0]).toMatchObject({ kind: 'bolum', need: 6, progress: 0 });
    expect(new Set(q.quests.map((x) => x.kind)).size).toBe(3);
    for (let i = 0; i < 5; i++) await (i % 2 ? b : a).c.call('progress.submit', run(1, { stars: 1 }));
    expect((await b.wait('tquests.updated', (x) => x.quests.quests[0]!.progress === 5)).quests.quests[0]!.done).toBe(false);
    await a.c.call('progress.submit', run(1, { stars: 1 }));
    const done = (await a.c.call('tquests.state', {})).quests.quests[0]!;
    expect(done).toMatchObject({ done: true, progress: 6 });
    const gift = (await b.c.call('team.extra', {})).extra.gifts.find((g) => g.reason.includes('Takım olarak 6 bölüm'));
    expect(gift?.contents.map((c) => c.amount)).toEqual([60, 5]);
    // ertesi gün yeni görevler
    env.clock.advance(24 * 3600_000);
    expect((await a.c.call('tquests.state', {})).quests.quests[0]).toMatchObject({ kind: 'bolum', progress: 0 });
  });
});

describe('Kulak Bilgi Yarışması', () => {
  it('quiz havuzu: en az 60 soru, 4 seçenek, açıklamalı', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(60);
    for (const q of QUIZ_QUESTIONS) { expect(q.choices).toHaveLength(4); expect(new Set(q.choices).size).toBe(4); expect(q.explain.length).toBeGreaterThan(10); }
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.answer)).size).toBe(4);
  });

  it('canlı: lider başlatır, iki üye aynı anda cevaplar, cevap süre bitince açılır, takım ortalaması ve ödüller', async () => {
    env = await setup({ eventsFast: true });
    const [a, b, teamId] = await team2(env, ['Ayşe', 'Bora'], 'Bilgi Kurtları');
    const { quiz } = await a.c.call('quiz.start', {});
    expect(quiz.phase).toBe('lobi');
    expect((await b.wait('events.notice', (n) => n.notice.kind === 'quiz')).notice.title).toBe('Bilgi yarışması başlıyor!');
    await b.c.call('quiz.join', { quizId: quiz.id });
    expect((await err(b.c.call('quiz.answer', { quizId: quiz.id, index: 0, choice: 0 }))).code).toBe('SURE');
    let q = (await a.c.call('quiz.go', { quizId: quiz.id })).quiz;
    expect(q.phase).toBe('soru');
    let correctAnswers = 0;
    for (let i = 0; i < 10; i++) {
      const view = (await a.c.call('quiz.state', {})).quiz!;
      expect(view.question?.index).toBe(i);
      expect(view.question?.answer).toBeNull();
      const def = QUIZ_QUESTIONS.find((x) => x.text === view.question!.text)!;
      env.clock.advance(2000);
      const [ra] = await Promise.all([
        a.c.call('quiz.answer', { quizId: quiz.id, index: i, choice: def.answer }),
        b.c.call('quiz.answer', { quizId: quiz.id, index: i, choice: (def.answer + 1) % 4 }),
      ]);
      correctAnswers++;
      expect(ra.quiz.players.find((p) => p.name === 'Ayşe')!.score).toBe((correctAnswers - 1) * 143); // soru açıkken puan gizli
      expect((await err(a.c.call('quiz.answer', { quizId: quiz.id, index: i, choice: 0 }))).code).toBe('TEKRAR');
      env.clock.advance(QUESTION_MS - 2000);
      env.srv.sweep();
      const rev = await b.wait('quiz.updated', (x) => x.quiz.phase === 'cevap' && x.quiz.question?.index === i);
      expect(rev.quiz.question).toMatchObject({ answer: def.answer, myChoice: (def.answer + 1) % 4, explain: def.explain });
      expect(rev.quiz.players.find((p) => p.name === 'Bora')!.lastCorrect).toBe(false);
      env.clock.advance(REVEAL_MS);
      env.srv.sweep();
    }
    q = (await a.c.call('quiz.state', {})).quiz!;
    expect(q.phase).toBe('bitti');
    expect(q.players[0]).toMatchObject({ name: 'Ayşe', correct: 10, score: 1430 });
    expect(q.teamAvg).toBe(715);
    const info = (await a.c.call('quiz.state', {})).info;
    expect(info.ranking[0]).toMatchObject({ teamId, avg: 715 });
    const items = (await a.c.call('inbox.list', {})).items.filter((i) => i.reason.startsWith('Kulak Bilgi'));
    expect(items.map((i) => `${i.kind}:${i.amount}`).sort()).toEqual(['jeton:100', 'kristal:10']);
    expect((await b.c.call('inbox.list', {})).items.filter((i) => i.reason.startsWith('Kulak Bilgi'))).toHaveLength(0);
  });

  it('normal mod: üye sabit saat dışında başlatamaz; 13:00 penceresinde kendiliğinden açılır', async () => {
    env = await setup();
    const [a, b] = await team2(env, ['Ayşe', 'Bora'], 'Saatçiler');
    expect((await err(b.c.call('quiz.start', {}))).code).toBe('YETKI');
    expect((await b.c.call('quiz.state', {})).quiz).toBeNull();
    env.clock.advance(65 * MIN); // 13:05
    const st = await b.c.call('quiz.state', {});
    expect(st.quiz).toMatchObject({ phase: 'lobi', startedBy: 'sistem' });
    expect(st.info.slotOpen).toBe(true);
    await a.wait('events.notice', (n) => n.notice.kind === 'quiz');
    await b.c.call('quiz.join', { quizId: st.quiz!.id });
    expect((await b.c.call('quiz.go', { quizId: st.quiz!.id })).quiz.phase).toBe('soru');
  });
});

describe('Bireysel: Günün Meydan Okuması ve Haftalık Turnuva', () => {
  it('meydan okuma: aynı bölüm, 3 deneme, en iyi skor, genel + arkadaş sıralaması, gün sonu ödülü', async () => {
    env = await setup();
    const [a, b, c] = [await connectW(env, 'Ayşe'), await connectW(env, 'Bora'), await connectW(env, 'Cem')];
    await a.c.call('friends.add', { code: b.c.me!.friendCode });
    await b.c.call('friends.add', { code: a.c.me!.friendCode });
    const sa = (await a.c.call('challenge.state', {})).challenge;
    const sb = (await b.c.call('challenge.state', {})).challenge;
    expect([sa.level, sa.salt]).toEqual([sb.level, sb.salt]);
    expect(sa).toMatchObject({ tries: 0, maxTries: 3, best: null, rank: null });
    await a.c.call('challenge.submit', erun({ score: 1200 }));
    await a.c.call('challenge.submit', erun({ score: 900 }));
    const r3 = erun({ score: 1500 });
    await a.c.call('challenge.submit', r3);
    expect((await a.c.call('challenge.submit', r3)).challenge.tries).toBe(3);
    expect((await err(a.c.call('challenge.submit', erun()))).code).toBe('LIMIT');
    await b.c.call('challenge.submit', erun({ score: 1300 }));
    await c.c.call('challenge.submit', erun({ score: 2000 }));
    const st = (await a.c.call('challenge.state', {})).challenge;
    expect(st).toMatchObject({ best: 1500, rank: 2, total: 3 });
    expect(st.top.map((r) => r.name)).toEqual(['Cem', 'Ayşe', 'Bora']);
    expect(st.friends.map((r) => [r.name, r.rank])).toEqual([['Ayşe', 2], ['Bora', 3]]);
    env.clock.advance(24 * 3600_000);
    const next = (await a.c.call('challenge.state', {})).challenge;
    expect(next).toMatchObject({ tries: 0, last: { rank: 2, score: 1500, total: 3 } });
    const items = (await c.c.call('inbox.list', {})).items;
    expect(items.map((i) => `${i.kind}:${i.amount}`).sort()).toEqual(['jeton:300', 'kristal:50']);
    expect((await a.c.call('inbox.list', {})).items.map((i) => i.amount).sort((x, y) => x - y)).toEqual([30, 200]);
  });

  it('turnuva: 5 bölüm, bölüm başına en iyi skor toplamı, 50 kişilik grup, hafta sonu ödülü', async () => {
    env = await setup();
    const [a, b] = [await connectW(env, 'Ayşe'), await connectW(env, 'Bora')];
    const t = (await a.c.call('tourney.state', {})).tourney;
    expect(t.levels).toHaveLength(5);
    expect(t.groupSize).toBe(50);
    await a.c.call('tourney.submit', { slot: 0, ...erun({ score: 1000 }) });
    await a.c.call('tourney.submit', { slot: 0, ...erun({ score: 800 }) });
    const ta = (await a.c.call('tourney.submit', { slot: 3, ...erun({ score: 700 }) })).tourney;
    expect(ta.total).toBe(1700);
    expect(ta.levels[0]!.best).toBe(1000);
    await b.c.call('tourney.submit', { slot: 1, ...erun({ score: 2500 }) });
    const tb = (await a.c.call('tourney.state', {})).tourney;
    expect(tb.group.map((g) => [g.name, g.score, g.rank])).toEqual([['Bora', 2500, 1], ['Ayşe', 1700, 2]]);
    expect(tb.rank).toBe(2);
    env.clock.advance(7 * 24 * 3600_000);
    await a.c.call('tourney.state', {});
    expect((await b.c.call('inbox.list', {})).items.map((i) => i.amount).sort((x, y) => x - y)).toEqual([80, 500]);
  });
});

describe('Etkinlik merkezi', () => {
  it('genel bakış: takımsız yalnız bireysel; takımda tüm kartlar', async () => {
    env = await setup({ eventsFast: true });
    const a = await connectW(env, 'Ayşe');
    let o = (await a.c.call('events.overview', {})).overview;
    expect(o).toMatchObject({ inTeam: false, rally: null, duel: null, fast: true });
    expect(o.challenge.level).toBeGreaterThan(0);
    await a.c.call('team.create', { name: 'Merkez', emblem: '🎪' });
    o = (await a.c.call('events.overview', {})).overview;
    expect(o.inTeam).toBe(true);
    expect(o.duel?.status).toBe('araniyor');
    expect(o.relay?.legs).toHaveLength(4);
    expect(o.hunt?.period).not.toBeNull();
    expect(o.quests?.quests).toHaveLength(3);
    expect(o.quizInfo?.canStart).toBe(true);
    expect(o.rallyStartsLeft).toBe(6);
  });
});
