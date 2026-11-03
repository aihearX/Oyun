// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ChatMessage, TeamDetail, TeamGoal } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('./ftue/useFeatures', () => ({ featureOpen: () => true }));
const calls: { op: string; data: unknown }[] = vi.hoisted(() => []);
vi.mock('./net', () => ({
  act: async (op: string, data: unknown) => { calls.push({ op, data }); return null; }, toast: () => undefined, errText: () => '',
  getNet: () => ({ serverNow: () => 1_000_000, call: async (op: string, data: unknown) => { calls.push({ op, data }); return {}; } }),
}));

/**
 * Oyuncu testi tur 8 (YN-146, YN-147, YN-148): katılmadan önce dolan kademe gri ve rozete sayılmaz; günlük yardım hakkı bitince
 * sonuç kartında düğme yok, sakin not; katılmadan önceki sistem satırları katlı, art arda ayrılmalar tek satır.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; });
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}

const goal = (over: Partial<TeamGoal> = {}): TeamGoal => ({
  id: 'W:yildiz', name: 'Yıldız Avı', metric: 'yildiz', progress: 100, claimedTiers: [], endsAt: 2_000_000,
  tiers: [30, 90, 180, 300].map((need) => ({ need, reward: [{ kind: 'jeton', amount: 100, ref: '' }] })), ...over,
});

describe('Hedefler: katılmadan önce dolan kademe (YN-146)', () => {
  it('rozete sayılmaz; hak edilen dolu kademe sayılır', async () => {
    const { claimableTierCount } = await import('./screens/team/teamTabs');
    expect(claimableTierCount([goal()])).toBe(2);
    expect(claimableTierCount([goal({ missedTiers: [0, 1] })])).toBe(0);
    expect(claimableTierCount([goal({ progress: 200, missedTiers: [0, 1] })])).toBe(1);
    expect(claimableTierCount([goal({ progress: 200, missedTiers: [0, 1], claimedTiers: [2] })])).toBe(0);
  });

  it('gri "Katılmadan önce doldu", Al yok; sıradaki kademe "Seninle dolacak"', async () => {
    const { useNet } = await import('@odi/net/store');
    useNet.setState({ extra: { level: 1, xp: 0, xpNext: 1, tech: [], gifts: [], contributionWeek: [], goals: [goal({ missedTiers: [0, 1] })] } as never });
    const { TeamGoals } = await import('./screens/team/TeamExtra');
    await render(createElement(TeamGoals));
    const missed = [...document.querySelectorAll('[data-testid="kademe-katilmadan"]')];
    expect(missed).toHaveLength(2);
    expect(missed.every((m) => m.textContent!.includes('Katılmadan önce doldu') && !m.querySelector('button'))).toBe(true);
    expect(document.querySelector('[data-testid="kademe-seninle"]')!.textContent).toContain('3. kademe');
    expect(document.querySelector('[data-testid="kademe-seninle"]')!.textContent).toContain('Seninle dolacak');
    expect([...document.querySelectorAll('.tier button')]).toHaveLength(0);
  });
});

describe('Sonuç ekranı yardım kartı: kalan günlük hak (YN-147)', () => {
  const team = (over: Partial<TeamDetail>): TeamDetail => ({ id: 't1', name: 'Kulak', emblem: '👂', description: '', members: 2, max: 30, power: 0, open: true, code: 'ABC', minLevel: 1, roster: [], help: [], weekPoints: 0, ...over });
  async function show(t: TeamDetail) {
    const { useNet } = await import('@odi/net/store');
    const { useStore } = await import('./store');
    useNet.setState({ team: t, status: 'bağlı', me: { id: 'me' } as never });
    useStore.setState({ failStreak: 3 });
    const { ResultComm } = await import('./comm/ResultComm');
    await render(createElement(ResultComm, { level: 33, completed: false }));
  }

  it('hak varken "Yardım iste" ve "Bugün N hak kaldı"', async () => {
    await show(team({ helpLeft: 2, helpResetAt: 2_000_000 }));
    expect(document.querySelector('[data-testid="yardim-iste-dugme"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="yardim-iste-not"]')!.textContent).toContain('Bugün 2 hak kaldı.');
  });

  it('hak 0 iken düğme yok, sakin not; gün dönünce yeniden düğme', async () => {
    await show(team({ helpLeft: 0, helpResetAt: 2_000_000 }));
    expect(document.querySelector('[data-testid="yardim-iste-dugme"]')).toBeNull();
    expect(document.querySelector('[data-testid="yardim-iste"]')!.textContent).toBe('Bugünkü yardım hakların bittiYarın yeniden isteyebilirsin. Takım sohbetindeki kartların açık.');
    const { helpLeftOf } = await import('./screens/team/teamTabs');
    expect(helpLeftOf({ helpLeft: 0, helpResetAt: 2_000_000 }, 2_000_000)).toBeUndefined();
    expect(helpLeftOf({}, 0)).toBeUndefined(); // eski sunucu: bilinmiyor, eski davranış
  });
});

describe('takım sohbeti: katılmadan önceki sistem satırları (YN-148)', () => {
  let n = 0;
  const sys = (text: string, at: number, over: Partial<ChatMessage> = {}): ChatMessage => ({ id: `m${n++}`, room: 'takim:t1', from: 'sistem', name: 'Sistem', color: 0, text, kind: 'system', at, ...over });
  const say = (text: string, at: number): ChatMessage => ({ id: `m${n++}`, room: 'takim:t1', from: 'p1', name: 'Ayşe', color: 0, text, kind: 'text', at });

  it('art arda ayrılmalar tek satır; katılmadan önceki sistem satırları katlı', async () => {
    const { foldSystemRows } = await import('./comm/sysfold');
    const msgs = [
      sys('Silinmiş Oyuncu takımdan ayrıldı.', 1), sys('Silinmiş Oyuncu takımdan ayrıldı.', 2), sys('Yeni lider: Ece.', 3),
      sys('Silinmiş Oyuncu takımdan ayrıldı.', 4), say('merhaba', 5), sys('Can takımdan ayrıldı.', 6), sys('Bora takımdan ayrıldı.', 7),
      sys('Deniz takımdan ayrıldı.', 8), sys('Sen takıma katıldın.', 10),
    ];
    const rows = foldSystemRows(msgs, 9);
    expect(rows.map((r) => r.kind)).toEqual(['before', 'msg', 'msg']);
    const first = rows[0]!;
    expect(first.kind === 'before' && first.n).toBe(7);
    expect(first.kind === 'before' && first.rows.map((r) => (r.kind === 'left' ? `${r.n} ayrıldı` : r.kind === 'msg' ? r.m.text : ''))).toEqual(['2 ayrıldı', 'Yeni lider: Ece.', '4 ayrıldı']);
    // oyuncu iletisi, yardım kartı ve Günün Sorusu katlanmaz; katlı satır ilk duyurunun yerinde
    const help = sys('Ece 3. bölüm için yardım istiyor.', 3, { kind: 'help', meta: { requestId: 'h1' } });
    expect(foldSystemRows([sys('A takımdan ayrıldı.', 1), sys('Takım hedefi tamamlandı.', 2), help, say('selam', 4), sys('Ece takıma katıldı.', 5, { kind: 'feed', meta: { type: 'uye' } }), sys('Sen geldin.', 9)], 6)
      .map((r) => (r.kind === 'before' ? `kat${r.n}` : r.kind === 'msg' ? r.m.kind : r.kind))).toEqual(['kat3', 'help', 'text', 'system']);
    // katılma anı bilinmiyorsa katlama yok, yalnız art arda ayrılmalar birleşir
    expect(foldSystemRows(msgs).map((r) => r.kind)).toEqual(['left', 'msg', 'msg', 'msg', 'left', 'msg']);
    // tek satır katlanmaz; kart (meta) birleşmez
    expect(foldSystemRows([sys('A takımdan ayrıldı.', 1), say('selam', 2)], 5).map((r) => r.kind)).toEqual(['msg', 'msg']);
    expect(foldSystemRows([sys('A takımdan ayrıldı.', 1, { meta: { event: 'x' } }), sys('B takımdan ayrıldı.', 2)]).map((r) => r.kind)).toEqual(['msg', 'msg']);
  });
});
