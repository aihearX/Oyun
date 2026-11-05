// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ChatMessage, CommNotice, RallyCall, RallyState, TeamDetail, TeamMember, WarState } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
vi.mock('./net', () => ({ act: async () => null, toast: () => undefined, getNet: () => null, errText: () => '', callSafe: async () => null, claimInboxItem: async () => true }));
/** ralli ekranı: sunucu yerine sahte istemci (rally.calls yanıtı ve 'dm.read' dinleyicisi) */
const ev = vi.hoisted(() => ({
  rally: null as RallyState | null, calls: [] as RallyCall[], asked: [] as string[],
  onRead: null as ((d: { by: string; seq: number }) => void) | null,
}));
vi.mock('./events/store', async () => {
  const { create } = await import('zustand');
  const useEvents = create(() => ({ rally: ev.rally, rallyStartsLeft: 2, notices: [], offset: 0 }));
  return {
    useEvents, srvNow: () => Date.now(), refreshEvents: async () => undefined,
    evNet: () => ({ status: 'bağlı', call: async (op: string) => { ev.asked.push(op); return op === 'rally.calls' ? { calls: ev.calls } : { rally: ev.rally, startsLeft: 2 }; },
      on: (e: string, cb: (d: { by: string; seq: number }) => void) => { if (e === 'dm.read') ev.onRead = cb; return () => { ev.onRead = null; }; } }),
  };
});

/**
 * Oyuncu testi tur 13 (YN-224, YN-226):
 *  - Takım başlığındaki XP sayısı çubukla aynı şeyi söyler (seviye içi).
 *  - Bölge Savaşı kutusu: üstte tek cümle ve tek eylem; ayrıntılar "Nasıl çalışır?" altında kapalı; katılmadan önceki puan ayrı.
 *  - Üyeler: dört sayı sabit, eşit sütunlu ızgarada.
 *  - Ralli: kimin çağrıldığı ve davetin görülüp görülmediği (sunucunun okundu bilgisi; tahmin yok).
 *  - Sohbetteki yardım kartı: verilen kalkan kısa ve tikli durum; düğmeli bildirim kartı kendiliğinden kapanmaz.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; ev.asked.length = 0; });
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); h.id = 'root'; document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
const $ = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const mem = (id: string, name: string, over: Partial<TeamMember> = {}): TeamMember => ({
  id, name, color: 0xff8855, hat: '', level: 5, highest: 7, stars: 20, teamId: 't1', teamName: 'Kulak', teamEmblem: '👂', league: 'bronz',
  online: true, lastSeen: 0, role: 'uye', weekPoints: 431, joinedAt: 1, ...over,
});
const team = (roster: TeamMember[]): TeamDetail => ({ id: 't1', name: 'Kulak', emblem: '👂', description: '', members: roster.length, max: 30, power: 0, open: true, code: 'ABC', minLevel: 1, roster, help: [], weekPoints: 0 } as TeamDetail);
async function netState(over: Record<string, unknown> = {}) {
  const { useNet } = await import('@odi/net/store');
  const roster = [mem('me', 'Ayşe', { role: 'uye' }), mem('p2', 'Hesapli')];
  useNet.setState({ team: team(roster), me: { ...roster[0]!, friendCode: 'X', shields: 0, cosmetics: [], cards: [] } as never, presence: {}, ...over });
}

describe('takım XP: sayı çubukla aynı şeyi söyler (OT-ilk-kez-oyun-65)', () => {
  it('seviye içi ilerleme: "145/1.183", çubuk 145/1183 dolu; birikmiş toplam yazılmaz', async () => {
    const { teamXpFor, teamXpProgress } = await import('./screens/team/teamTabs');
    // sunucudaki eşik formülü (teamextra.ts teamXpFor): Sv 5 → 2.757, Sv 6 → 3.940
    expect([teamXpFor(1), teamXpFor(2), teamXpFor(5), teamXpFor(6)]).toEqual([0, 300, 2757, 3940]);
    const x = teamXpProgress(5, 2902, 3940);
    expect(x).toEqual({ have: 145, need: 1183, left: 1038, ratio: 145 / 1183 });
    expect(teamXpProgress(1, 0, 300)).toEqual({ have: 0, need: 300, left: 300, ratio: 0 });
  });
  it('başlıkta yazan sayı ve çubuğun doluluğu aynı oran', () => {
    const src = readFileSync(resolve(__dirname, 'screens/team/TeamHome.tsx'), 'utf8');
    expect(src).toContain('<Bar value={xp.ratio}');
    expect(src).toContain('{fmtNum(xp.have)}/{fmtNum(xp.need)}');
    expect(src).not.toContain('{fmtNum(extra.xp)}/{fmtNum(extra.xpNext)}');
  });
});

describe('Bölge Savaşı kutusu (OT-ilk-kez-oyun-66, YN-141)', () => {
  const war = (over: Partial<WarState> = {}): WarState => ({
    week: '2026-W42', startsAt: 0, endsAt: Date.now() + 86_400_000, regions: [], targets: ['kepce'], teamPoints: 400, myPoints: 257,
    regionPoints: 300, myRegionPoints: 90, myTeamPoints: 120, ...over,
  });
  it('üst cümle: ne yapılacağı ve takıma getirilen puan (katılmadan önceki sayılmaz)', async () => {
    const { warLede } = await import('./screens/team/TeamWar');
    expect(warLede(war())).toBe('Bölüm oyna, puanın takımın hedef bölgesine gider. Bu hafta 120 puan getirdin.');
    expect(warLede(war({ targets: [], myTeamPoints: 1234 }))).toBe('Bölüm oyna, puanın takıma sayılır; hedef bölge seçilince bölgeye de yazılır. Bu hafta 1.234 puan getirdin.');
  });
  it('tek eylem; sayılar ve kurallar "Nasıl çalışır?" altında kapalı; katılmadan önceki puan satırı', async () => {
    await netState({ war: war() });
    const { TeamWar } = await import('./screens/team/TeamWar');
    await render(createElement(TeamWar));
    const head = document.querySelector('.war-head')!;
    expect($('savas-ozet')!.textContent).toBe('Bölüm oyna, puanın takımın hedef bölgesine gider. Bu hafta 120 puan getirdin.');
    const details = $('savas-nasil') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')!.textContent).toBe('Nasıl çalışır?');
    // ayrıntı sayılarının hepsi kapalı bölümde; üstte yalnız cümle ve en çok bir düğme
    expect(details.contains($('savas-dokum'))).toBe(true);
    expect(details.contains($('savas-sen'))).toBe(true);
    expect($('savas-katilmadan-once')!.textContent).toBe('137 puanın takıma katılmadan önce kazanıldı; takım puanına sayılmaz.');
    expect(details.contains($('savas-katilmadan-once'))).toBe(true);
    expect([...head.querySelectorAll('button')].filter((b) => !details.contains(b)).length).toBeLessThanOrEqual(1);
  });
  it('katılmadan önce puan yoksa satır yok; hedef yokken lider için tek düğme "Hedef bölge seç"', async () => {
    await netState({ war: war({ targets: [], myPoints: 120, myTeamPoints: 120 }) });
    const { useNet } = await import('@odi/net/store');
    useNet.setState((s) => ({ team: { ...s.team!, roster: s.team!.roster.map((m) => (m.id === 'me' ? { ...m, role: 'lider' as const } : m)) } }));
    const { TeamWar } = await import('./screens/team/TeamWar');
    await render(createElement(TeamWar));
    expect($('savas-katilmadan-once')).toBeNull();
    expect($('savas-eylem')!.textContent).toContain('Hedef bölge seç');
  });
});

describe('Üyeler: sayılar sabit ızgarada (OT-takim-kaptani-38)', () => {
  it('dört eşit sütun, kartın tam genişliğinde; sayılar ad satırının altında (sayı büyüyünce "savaş" kaymaz)', async () => {
    const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');
    expect(css).toMatch(/\.mem-stats \{ grid-column:1 \/ -1; display:grid; grid-template-columns:repeat\(4, minmax\(0,1fr\)\);/);
    await netState({ extra: { level: 1, xp: 0, xpNext: 300, tech: [], gifts: [], goals: [], contributionWeek: [{ id: 'p2', name: 'Hesapli', donated: 100, helps: 1, stars: 32 }] } });
    const { TeamMembers } = await import('./screens/team/TeamMembers');
    await render(createElement(TeamMembers));
    const row = [...document.querySelectorAll('[data-testid="uye-satiri"]')][1]!;
    const stats = row.querySelector(':scope > .mem-stats')!;
    expect(stats).toBeTruthy();
    expect([...stats.querySelectorAll('.mem-stat')].map((x) => x.textContent!.trim())).toEqual(['100bağış', '1yardım', '32yıldız', '431savaş']);
  });
});

describe('Ralli çağrı kaydı (OT-takim-kaptani-39)', () => {
  const rally = (): RallyState => ({
    id: 'r1', teamId: 't1', monster: 'serumen-yavrusu', salt: 1, starterId: 'me', starterName: 'Ayşe', status: 'acik', hp: 600, maxHp: 600,
    startsAt: Date.now() - 1000, endsAt: Date.now() + 600_000, wonAt: null, hpPlayers: 1, attackStarted: false,
    participants: [{ id: 'me', name: 'Ayşe', color: 1, hat: '', damage: 0, tries: 0, joinedAt: 0 }], hits: [],
  });
  it('durum metni: katıldı / gördü / henüz görmedi', async () => {
    const { rallyCallState } = await import('./events/Rally');
    expect(rallyCallState({ seen: false }, false)).toBe('henüz görmedi');
    expect(rallyCallState({ seen: true }, false)).toBe('gördü');
    expect(rallyCallState({ seen: false }, true)).toBe('katıldı');
  });
  it('ralli ekranında "Çağrıldı: Hesapli · henüz görmedi"; davet okununca (dm.read) sunucudan yeniden okunur', async () => {
    await netState();
    ev.rally = rally(); ev.calls = [{ id: 'p2', name: 'Hesapli', at: Date.now(), seen: false }];
    const { useEvents } = await import('./events/store');
    useEvents.setState({ rally: ev.rally });
    const { RallyView } = await import('./events/Rally');
    await render(createElement(RallyView, { onPlay: () => undefined }));
    await flush();
    const line = () => $('ralli-cagrilan');
    expect(line()!.textContent).toBe('Çağrıldı: Hesapli· henüz görmedi');
    expect(line()!.getAttribute('data-durum')).toBe('henüz görmedi');
    // başka birinin okuması listeyi yenilemez; çağrılanın okuması yeniler (gördü bilgisi sunucudan gelir, istemci uydurmaz)
    const before = ev.asked.filter((o) => o === 'rally.calls').length;
    await act(async () => { ev.onRead?.({ by: 'p9', seq: 5 }); });
    expect(ev.asked.filter((o) => o === 'rally.calls').length).toBe(before);
    expect(line()!.getAttribute('data-durum')).toBe('henüz görmedi');
    ev.calls = [{ id: 'p2', name: 'Hesapli', at: Date.now(), seen: true }];
    await act(async () => { ev.onRead?.({ by: 'p2', seq: 5 }); });
    await flush();
    expect(line()!.getAttribute('data-durum')).toBe('gördü');
  });
});

describe('sohbet yardım kartı: verilen kalkan (OT-buyuk-yazi-62)', () => {
  it('kısa ve tikli durum ("Verdin"), kesilecek uzun yazı yok; erişilebilir ad tam', async () => {
    await netState();
    const { useNet } = await import('@odi/net/store');
    useNet.setState((s) => ({ team: { ...s.team!, help: [{ id: 'h1', from: 'p2', name: 'Hesapli', level: 13, helpers: ['me'], max: 5, at: Date.now(), expiresAt: Date.now() + 3_600_000 }] } }));
    const { HelpCard } = await import('./comm/Cards');
    const m = { id: 'c1', room: 'takim:t1', from: 'sistem', name: '', text: '', kind: 'help', at: Date.now(), meta: { requestId: 'h1', level: 13, pid: 'p2', pname: 'Hesapli', kalkan: 1 } } as unknown as ChatMessage;
    await render(createElement(HelpCard, { m, live: [] }));
    const b = $('kalkan-gonder') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.textContent!.trim()).toBe('Verdin');
    expect(b.getAttribute('aria-label')).toBe('Kalkan gönderildi');
    const css = readFileSync(resolve(__dirname, 'comm/comm.css'), 'utf8');
    expect(css).toContain('.fc-actions .btn:disabled { filter:none; opacity:1; color:var(--text);');
    expect(css).toContain('html.buyuk-yazi .fc-actions .btn { white-space:normal;');
  });
});

describe('düğmeli bildirim kartı kendiliğinden kapanmaz (OT-buyuk-yazi-63, WCAG 2.2.1)', () => {
  it('"Rica ederim" kartı 60 sn sonra da yerinde; düğmesiz kart 7 sn sonra kapanır', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { CommBanner, NOTICE_MS, noticeActs } = await import('./comm/CommBanner'); const { useComm } = await import('./comm/state');
      await render(createElement(CommBanner));
      const thanks = { id: 'n1', kind: 'thanks', title: 'AyseTeyze 13. bölümü geçti!', text: 'Yardımın için teşekkür ediyor.', msgId: 'm1', room: 'takim:t1' } as unknown as CommNotice;
      expect(noticeActs(thanks).map((a) => a.label)).toEqual(['Rica ederim']);
      await act(async () => { useComm.setState({ notices: [thanks] }); });
      await act(async () => { vi.advanceTimersByTime(60_000); });
      expect(useComm.getState().notices).toHaveLength(1);
      expect($('iletisim-bildirimi')!.textContent).toContain('Rica ederim');
      // X ile kapanır
      await act(async () => { (document.querySelector('.fr-banner-x') as HTMLElement).click(); });
      expect(useComm.getState().notices).toHaveLength(0);
      const plain = { id: 'n2', kind: 'challenge', title: 'Meydan okuma bitti', text: 'Sonuçlar hazır.' } as unknown as CommNotice;
      expect(noticeActs(plain)).toEqual([]);
      await act(async () => { useComm.setState({ notices: [plain] }); });
      await act(async () => { vi.advanceTimersByTime(NOTICE_MS + 100); });
      expect(useComm.getState().notices).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
  it('kaçırılan teşekkür sohbette yanıtlanır: yardım kartının konusunda "Rica ederim" hazır sözü var', async () => {
    const { phrasesFor } = await import('./comm/Cards');
    const src = readFileSync(resolve(__dirname, 'comm/Cards.tsx'), 'utf8');
    expect(src).toContain("ctx={['ipucu', 'tebrik', 'tesekkur']}");
    expect(phrasesFor('ipucu', 'tebrik', 'tesekkur').map((p) => p.id)).toContain('rica');
  });
});
