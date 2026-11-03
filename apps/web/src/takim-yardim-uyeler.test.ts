// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HelpRequest, TeamDetail, TeamMember } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
const calls: { op: string; data: unknown }[] = vi.hoisted(() => []);
vi.mock('./net', () => ({ act: async (op: string, data: unknown) => { calls.push({ op, data }); return null; }, toast: () => undefined, getNet: () => null }));

/**
 * Oyuncu testi tur 7 (YN-133, YN-134): yardımsız geçişte teşekkür ödülü yazmaz; Yardım rozeti yalnız gönderilebilir istekleri sayar;
 * liderlik devri ve takımdan çıkarma onaylı; Üyeler'de bitiren "Bitirdi", sayılar etiketli; Takım Yarışı daveti doğru sekmeye gider.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; });
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe('yardım kartı: çözülünce yazı (OT-takim-kaptani-23)', () => {
  it('kimse yardım etmediyse teşekkür ödülü yazmaz; yardım varsa kaç kişiye gittiğini yazar', async () => {
    const { helpDoneText } = await import('./comm/Cards');
    expect(helpDoneText(true, 'Ayşe', { ipucu: 0, kalkan: 0, yaris: 0, helpers: 0, done: true })).toBe('Geçtin! Bu sefer yardım gelmeden başardın.');
    expect(helpDoneText(true, 'Ayşe', { ipucu: 1, kalkan: 2, yaris: 0, helpers: 2, done: true })).toBe('Geçtin! 2 kişiye teşekkür ödülü gitti.');
    expect(helpDoneText(false, 'Ayşe', { ipucu: 0, kalkan: 0, yaris: 0, helpers: 0 })).toBe('Ayşe bölümü geçti.');
    expect(helpDoneText(false, 'Ayşe', { ipucu: 0, kalkan: 1, yaris: 0, helpers: 1 })).toBe('Ayşe bölümü geçti. Teşekkürler!');
    // eski kart (helpers yok): sayaçlar 0 ise yine teşekkür yok; sayaç varsa sayı uydurulmaz
    expect(helpDoneText(true, 'Ayşe', { ipucu: 0, kalkan: 0, yaris: 0 })).toBe('Geçtin! Bu sefer yardım gelmeden başardın.');
    expect(helpDoneText(true, 'Ayşe', { kalkan: 1 })).toBe('Geçtin! Yardım edenlere teşekkür ödülü gitti.');
  });
});

describe('Yardım rozeti (OT-takim-kaptani-24)', () => {
  it('yalnız benim gönderebileceğim açık istekleri sayar', async () => {
    const { sendableHelpCount } = await import('./screens/team/teamTabs');
    const now = 1_000_000;
    const h = (over: Partial<HelpRequest>): HelpRequest => ({ id: Math.random().toString(36), from: 'p2', name: 'Bora', level: 3, helpers: [], max: 5, at: now - 10, expiresAt: now + 1000, ...over });
    const list = [
      h({}), // açık
      h({ passed: true }), // geçti, istek kapandı
      h({ expiresAt: now - 1 }), // süresi doldu
      h({ helpers: ['a', 'b', 'c', 'd', 'e'] }), // doldu
      h({ helpers: ['me'] }), // ben gönderdim
      h({ from: 'me' }), // benim isteğim
    ];
    expect(sendableHelpCount(list, 'me', now)).toBe(1);
  });
});

describe('Üyeler (OT-takim-kaptani-22, 26; OT-buyuk-yazi-38)', () => {
  const mem = (id: string, name: string, over: Partial<TeamMember> = {}): TeamMember => ({
    id, name, color: 0xff8855, hat: '', level: 5, highest: 7, stars: 20, teamId: 't1', teamName: 'Kulak', teamEmblem: '👂', league: 'bronz',
    online: true, lastSeen: 0, role: 'uye', weekPoints: 431, joinedAt: 1, ...over,
  });
  const team = (roster: TeamMember[]): TeamDetail => ({ id: 't1', name: 'Kulak', emblem: '👂', description: '', members: roster.length, max: 30, power: 0, open: true, code: 'ABC', minLevel: 1, roster, help: [], weekPoints: 0 } as TeamDetail);
  async function setup() {
    const { useNet } = await import('@odi/net/store');
    const roster = [mem('me', 'KaptanTubaUzunAd', { role: 'lider', highest: 40, finished: true }), mem('p2', 'AyseTeyze', { highest: 33 })];
    useNet.setState({ team: team(roster), me: { ...roster[0]!, friendCode: 'X', shields: 0, cosmetics: [], cards: [] } as never, presence: {},
      extra: { level: 1, xp: 0, xpNext: 1, tech: [], gifts: [], goals: [], contributionWeek: [{ id: 'p2', name: 'AyseTeyze', donated: 0, helps: 1, stars: 32 }] } as never });
    const { TeamMembers } = await import('./screens/team/TeamMembers');
    await render(createElement(TeamMembers));
  }
  const rows = () => [...document.querySelectorAll('[data-testid="uye-satiri"]')];

  it('son bölümü bitiren "Bitirdi", öteki "X. bölümde"; ad ve "(sen)" kesilmez; sayıların altında ne olduğu yazar', async () => {
    await setup();
    const [mine, other] = rows();
    expect(mine!.querySelector('[data-testid="uye-bolum"]')!.textContent).toBe('Bitirdi');
    expect(other!.querySelector('[data-testid="uye-bolum"]')!.textContent).toBe('33. bölümde');
    expect(mine!.querySelector('.mem-name')!.textContent).toBe('KaptanTubaUzunAd (sen)');
    expect(mine!.querySelector('.ellipsis')).toBeNull();
    expect([...other!.querySelectorAll('.mem-stat')].map((x) => x.textContent!.trim())).toEqual(['0bağış', '1yardım', '32yıldız', '431savaş']);
  });

  it('liderlik devri onay ister: önce açıklama, "Devret" ile gider; Vazgeç hiçbir şey yapmaz', async () => {
    await setup();
    await click(rows()[1]);
    await click(document.querySelector('[data-testid="lider-devret"]'));
    expect(calls).toEqual([]);
    expect(document.querySelector('[data-testid="devret-onay"]')!.textContent).toBe('Liderliği AyseTeyze adlı üyeye devretmek istiyor musun? Sen Yardımcı olursun; geri almak için onun sana devretmesi gerekir.');
    await click([...document.querySelectorAll('.sheet button')].find((b) => b.textContent === 'Vazgeç'));
    expect(document.querySelector('[data-testid="devret-onay"]')).toBeNull();
    expect(calls).toEqual([]);
    await click(rows()[1]);
    await click(document.querySelector('[data-testid="lider-devret"]'));
    await click(document.querySelector('[data-testid="devret-evet"]'));
    expect(calls).toEqual([{ op: 'team.role', data: { id: 'p2', role: 'lider' } }]);
  });

  it('takımdan çıkarma da onaylı', async () => {
    await setup();
    await click(rows()[1]);
    await click(document.querySelector('[data-testid="takimdan-cikar"]'));
    expect(calls).toEqual([]);
    await click(document.querySelector('[data-testid="cikar-evet"]'));
    expect(calls).toEqual([{ op: 'team.kick', data: { id: 'p2' } }]);
  });
});

describe('Takım Yarışı daveti (OT-takim-kaptani-21)', () => {
  it('"Davete git" Takım › Rekabet › Takım Yarışı sekmesini açar (son açık sekmeyi değil)', async () => {
    const { openInvite } = await import('./friends/common');
    const { useTeamTab, openTeamTab } = await import('./screens/team/teamTabs');
    openTeamTab('yardim');
    const tab = vi.fn();
    openInvite({ type: 'tyaris', roomId: 't1', title: 'Takım Yarışı' }, { tab, open: vi.fn() } as never);
    expect(tab).toHaveBeenCalledWith('team');
    expect(useTeamTab.getState().tab).toBe('tyaris');
  });
});
