// @vitest-environment jsdom
// Kulak Bilgi Yarışması, oyuncu testi tur 11 (YN-185, YN-186, YN-187 ekran kısmı): bitişte sıralama tazelenir, başlatma metni sunucu
// kuralını söyler, sonuçta takım ödülü satırı (sayılar QUIZ_REWARDS'tan), yarışmanın düzeyi yazılı; tip adı taşıyan sorularda şıklar 1–4.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { QUIZ_QUESTIONS, quizChoiceLabels } from '@odi/content';
import type { NetClient } from '@odi/net';
import type { EventReward, QuizInfo, QuizState } from '@odi/shared';
import { bindEvents, useEvents } from './events/store';
import { QuizView, quizGoRule, quizLevelLine, quizStartRule, quizTeamRewardLine } from './events/Quiz';

const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
// sunucunun QUIZ_REWARDS'ı (jsdom'da sunucu modülü yüklenmez; aşağıda kaynakla karşılaştırılır)
const rewards: QuizInfo['rewards'] = { perCorrect: 10, bonusAvg: 700, bonus: [{ kind: 'kristal', amount: 10, ref: 'etkinlik' }] as EventReward[] };
/** sıralama satırındaki yarışma saatleri (yerel saatle 13:00 ve 20:00) */
const AT13 = new Date(2026, 10, 4, 13, 0).getTime(); const AT20 = new Date(2026, 10, 4, 20, 0).getTime();
const info = (o: Partial<QuizInfo> = {}): QuizInfo => ({ nextSlotAt: 0, slotOpen: false, canStart: false, startsLeft: 5, ranking: [], rewards, ...o });

/** sahte ağ istemcisi: olay dinleyicilerini tutar, `quiz.state` ve `events.overview` çağrılarını cevaplar */
function fakeClient(state: { info: QuizInfo }) {
  const handlers = new Map<string, ((d: unknown) => void)[]>();
  const calls: string[] = [];
  const c = {
    status: 'bağlı',
    on: (ev: string, cb: (d: unknown) => void) => { handlers.set(ev, [...(handlers.get(ev) ?? []), cb]); return () => undefined; },
    onStatus: () => () => undefined,
    call: (name: string) => { calls.push(name); return name === 'quiz.state' ? Promise.resolve({ quiz: null, info: state.info }) : new Promise(() => undefined); },
  };
  const emit = (ev: string, d: unknown) => { for (const h of handlers.get(ev) ?? []) h(d); };
  return { c: c as unknown as NetClient, calls, emit };
}

const net = { info: info() };
const f = fakeClient(net);
beforeAll(() => { useEvents.setState({ inTeam: true, quiz: null, quizInfo: info() }); bindEvents(f.c); });
const stateCalls = () => f.calls.filter((n) => n === 'quiz.state').length;

const quiz = (o: Partial<QuizState> = {}): QuizState => ({
  id: 'q1', teamId: 't1', phase: 'bitti', startedBy: 'sistem', lobbyEndsAt: 0, endsAt: 0, question: null, teamAvg: 640, questionMs: 15_000, revealMs: 6_000,
  players: [{ id: 'p1', name: 'Ayşe', color: 0x7c5cff, score: 640, correct: 5, answered: true, lastCorrect: null }], levels: { odyoloji: 0, genel: 10 }, ...o,
});

describe('bitişte takım sıralaması tazelenir (YN-185, OT-sinav-adayi-38)', () => {
  it('quiz.updated "bitti" gelince quiz.state ile quizInfo yeniden alınır; ara fazlarda alınmaz', async () => {
    const n0 = stateCalls();
    f.emit('quiz.updated', { quiz: quiz({ phase: 'soru' }) });
    expect(stateCalls()).toBe(n0);
    net.info = info({ ranking: [{ teamId: 't1', name: 'Öğlenciler', emblem: '🦉', avg: 640, at: AT13 }] });
    f.emit('quiz.updated', { quiz: quiz() });
    expect(stateCalls()).toBe(n0 + 1);
    await vi.waitFor(() => expect(useEvents.getState().quizInfo?.ranking).toHaveLength(1));
    expect(useEvents.getState().quiz?.phase).toBe('bitti');
  });

  it('sonuç ekranı sonradan açılınca da tazelenir', async () => {
    net.info = info({ ranking: [{ teamId: 't1', name: 'Öğlenciler', emblem: '🦉', avg: 640, at: AT13 }] });
    const n0 = stateCalls();
    const html = renderWith({ quiz: quiz(), quizInfo: info() }); // eski bilgi: sıralama boş
    expect(html).toContain('Bugün henüz yarışma bitiren takım yok');
    expect(stateCalls()).toBe(n0 + 1);
    await vi.waitFor(() => expect(useEvents.getState().quizInfo?.ranking[0]?.teamId).toBe('t1'));
  });
});

describe('başlatma metni sunucu kuralını söyler (YN-185, OT-ogrenci-birinci-39)', () => {
  it('sabit saat açık: herkes; kapalı: lider/yardımcı; hak bitince söyler', () => {
    expect(quizStartRule(info({ slotOpen: true, canStart: true, startsLeft: 3 }))).toBe('Sabit saat açık: herkes başlatabilir · takımın bugün kalan hakkı: 3');
    expect(quizStartRule(info({ canStart: true, startsLeft: 5 }))).toBe('Lider ve yardımcılar her an başlatabilir · takımın bugün kalan hakkı: 5');
    expect(quizStartRule(info({ canStart: false, startsLeft: 5 }))).toBe('Lider ya da yardımcı başlatabilir · takımın bugün kalan hakkı: 5');
    expect(quizStartRule(info({ slotOpen: true, startsLeft: 0 }))).toMatch(/başlatma hakkı bitti/);
  });

  it('başlatamayan üye düğme görmez; kural metni görünür', () => {
    const html = renderWith({ quiz: null, quizInfo: info({ canStart: false, startsLeft: 4 }) });
    expect(html).not.toContain('data-testid="quiz-baslat"');
    expect(html).toContain('Lider ya da yardımcı başlatabilir · takımın bugün kalan hakkı: 4');
    expect(html).not.toContain('Lider ve yardımcılar her an başlatabilir');
  });

  it('bekleme odasında "Hemen başlat" kuralı tek cümle: sabit saat yarışmasında katılan herkes, elle başlatılanda başlatan/lider/yardımcı', () => {
    expect(quizGoRule(quiz({ startedBy: 'sistem' }))).toBe('Hemen başlat: sabit saat yarışmasında katılan herkes basabilir; takımın günlük hakkından düşmez.');
    expect(quizGoRule(quiz({ startedBy: 'p9' }))).toBe('Hemen başlat: yarışmayı başlatan, lider ya da yardımcı basabilir; takımın günlük hakkından düşmez.');
    const html = renderWith({ quiz: quiz({ phase: 'lobi', lobbyEndsAt: Date.now() + 60_000 }), quizInfo: info() });
    expect(html).toContain('data-testid="quiz-hemen"');
    expect(html).toContain('sabit saat yarışmasında katılan herkes basabilir');
    expect(html).toContain('Sorular: genel düzey');
  });
});

describe('sonuç: takım ödülü ve düzey satırı (YN-185, YN-187)', () => {
  it('eşik ve ödül QUIZ_REWARDS\'tan; geçmediyse ne kadar eksik kaldığı', () => {
    expect(src('../../server/src/events/quiz.ts')).toContain('export const QUIZ_REWARDS = { perCorrect: 10, bonusAvg: 700, bonus: rw(0, 10) };');
    expect(quizTeamRewardLine(715, rewards)).toBe('Takım ortalaması 715, eşik 700: doğru cevabı olan herkese +10 kristal (ödül kutunda)');
    expect(quizTeamRewardLine(640, rewards)).toBe('Takım ortalaması 640: takım ödülü eşiği 700, 60 puan eksik kaldı');
    // sabit sayı yok: başka bir eşikle metin de değişir
    expect(quizTeamRewardLine(640, { ...rewards, bonusAvg: 600 })).toContain('eşik 600');
  });

  it('düzey satırı soru dizisinden', () => {
    expect(quizLevelLine({ odyoloji: 0, genel: 10 })).toBe('Sorular: genel düzey');
    expect(quizLevelLine({ odyoloji: 6, genel: 4 })).toBe('Sorular: karışık (6 öğrenci + 4 genel)');
    expect(quizLevelLine({ odyoloji: 10, genel: 0 })).toBe('Sorular: öğrenci düzeyi');
  });

  it('sonuç ekranı: kişisel satır, takım ödülü, düzey ve sıralamada kendi takımı vurgulu', () => {
    const html = renderWith({ quiz: quiz(), quizInfo: info({ ranking: [{ teamId: 't0', name: 'Başkası', emblem: '🌱', avg: 800, at: AT20 }, { teamId: 't1', name: 'Öğlenciler', emblem: '🦉', avg: 640, at: AT13 }] }) });
    expect(html).toContain('Takım ortalaması 640: takım ödülü eşiği 700, 60 puan eksik kaldı');
    expect(html).toContain('Sorular: genel düzey');
    expect(html).not.toContain('Bugün henüz yarışma bitiren takım yok');
    expect(html).toMatch(/<li class="me">.*?Öğlenciler/);
    // sıralama kuralı ve puanın geldiği yarışmanın saati (YN-209): üstteki ortalama bu yarışmanın, satır günün en iyisi
    expect(html).toContain('Bu yarışmada takım ortalaması');
    expect(html).toContain('Her takımın bugünkü en iyi yarışması (puan · yarışma saati)');
    expect(html).toMatch(/Öğlenciler.*?640<small class="muted"> · 13:00/);
    expect(html).toMatch(/Başkası.*?800<small class="muted"> · 20:00/);
  });
});

describe('tip adı taşıyan sorularda şıklar 1–4 (YN-186, OT-sinav-adayi-39)', () => {
  it('timpanogram tipleri rakamla; diğer sorular harfle; içerik ve doğru cevap aynı', () => {
    const tip = QUIZ_QUESTIONS.find((q) => q.text.startsWith('Negatif orta kulak basıncını'))!;
    expect(quizChoiceLabels(tip.choices)).toEqual(['1', '2', '3', '4']);
    expect(tip.choices[tip.answer]).toBe('C tipi');
    for (const q of QUIZ_QUESTIONS.filter((x) => x.choices.some((c) => / tipi$/.test(c) && c.length <= 7))) expect(quizChoiceLabels(q.choices)).toEqual(['1', '2', '3', '4']);
    const kemik = QUIZ_QUESTIONS.find((q) => q.text.startsWith('Vücudumuzun en küçük kemiği'))!;
    expect(quizChoiceLabels(kemik.choices)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('Pratik ve canlı yarışma aynı etiketi kullanır (sabit A–D dizisi kalmadı)', () => {
    for (const f of ['events/Pratik.tsx', 'events/Quiz.tsx']) expect(src(f), f).not.toMatch(/\['A', 'B', 'C', 'D'\]/);
    expect(src('events/Pratik.tsx')).toContain('Doğru cevap: {pratikEtiketler(q)[q.answer]}) {q.choices[q.answer]}');
    expect(src('events/Quiz.tsx')).toContain('Doğru cevap: ${labels[qv.answer!]}) ${qv.choices[qv.answer!]}');
  });
});

vi.mock('@odi/net/store', () => ({ useNet: (sel: (s: unknown) => unknown) => sel({ me: { id: 'p1' }, team: { id: 't1', roster: [{ id: 'p1', role: 'uye' }] }, status: 'bağlı' }) }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function renderWith(s: { quiz: QuizState | null; quizInfo: QuizInfo }): string {
  useEvents.setState(s);
  const div = document.createElement('div');
  const root = createRoot(div);
  act(() => root.render(createElement(QuizView)));
  const html = div.innerHTML;
  act(() => root.unmount());
  return html;
}
