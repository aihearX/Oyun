// YN-103 (OT-ekonomi-denetci-20): her cüzdan artışı bir satırla söylenir. Takvimin 3. günü bereyi 12. kozmetik yapınca
// "Moda Kulağı · Altın" +100 jeton verir; pencere takvim kalemlerini, bildirimler başarımların jetonunu yazar, toplam cüzdan artışına eşit.
import { describe, expect, it } from 'vitest';
import { COSMETICS, DEFAULT_SKILLS, TIER_REWARD } from '@odi/content';
import { calendarView, claimCalendar, defaultMeta, rewardSum, settle, type PlayerCore } from '@odi/meta';
import { toastsFor } from './store';
import { withSwapRows } from './ui/bits';

const DAY = '2026-11-02'; const NOW = new Date(2026, 10, 2, 12).getTime();
const core = (meta = defaultMeta()): PlayerCore => ({ progress: {}, coins: 4572, xp: 0, streak: 3, lastDay: DAY, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta });
/** gösterilen satırlardaki jeton: pencere kalemleri + bildirim metinlerindeki "+N jeton" */
const shownJeton = (rows: { kind: string; amount: number }[], texts: string[]) =>
  rows.filter((r) => r.kind === 'jeton').reduce((a, r) => a + r.amount, 0) + texts.reduce((a, t) => a + Number(/\+(\d+) jeton/.exec(t)?.[1] ?? 0), 0);

describe('cüzdan artışı = gösterilen satırlar', () => {
  it('takvim 3. gün + Takvim Dostu bronz + Moda Kulağı altın: 20 + 15 + 100', () => {
    const m = defaultMeta();
    m.cosmetics.owned = [...m.cosmetics.owned, ...COSMETICS.map((c) => c.id).filter((id) => id !== 'sapka-bere' && !m.cosmetics.owned.includes(id)).slice(0, 11 - m.cosmetics.owned.length)];
    m.stats.calendar = 2; m.achievements = { 'takvim-dostu': 0, 'moda-kulagi': 2 };
    const c = core(m); expect(c.meta.cosmetics.owned).toHaveLength(11);
    const r = claimCalendar(c, DAY, NOW)!; const s = settle(r.core, NOW);
    const gain = s.core.coins - c.coins;
    expect(s.events).toEqual(expect.arrayContaining([{ kind: 'achievement', id: 'takvim-dostu', tier: 1 }, { kind: 'achievement', id: 'moda-kulagi', tier: 3 }]));
    const ach = s.events.flatMap((e) => (e.kind === 'achievement' ? [rewardSum(TIER_REWARD[e.tier], 'jeton')] : [])).reduce((a, n) => a + n, 0);
    expect(gain).toBe(20 + ach); expect(ach).toBeGreaterThanOrEqual(15 + 100);
    const toasts = toastsFor(s.events);
    expect(toasts.map((t) => t.text)).toEqual(expect.arrayContaining(['Başarım açıldı: +15 jeton, +10 XP', 'Başarım açıldı: +100 jeton, +60 XP']));
    expect(shownJeton(withSwapRows(r.applied, calendarView(c, DAY).days[2]!.swaps), toasts.map((t) => `${t.text ?? ''}`))).toBe(gain);
  });
  it('kopya bere: pencerede ayrı adlı satır, toplam aynı', () => {
    const m = defaultMeta(); m.cosmetics.owned = [...m.cosmetics.owned, 'sapka-bere'];
    const c = core(m); const swaps = calendarView(c, DAY).days[2]!.swaps;
    const r = claimCalendar(c, DAY, NOW)!;
    const rows = withSwapRows(r.applied, swaps);
    expect(rows).toEqual([{ kind: 'jeton', amount: 20 }, { kind: 'jeton', amount: 50, label: 'Kulaklı Bere zaten dolabında' }]);
    expect(rows.reduce((a, x) => a + x.amount, 0)).toBe(r.core.coins - c.coins);
  });
  it('çok açılımda toplanan bildirim de jetonu söyler', () => {
    const ev = (['ilk-ses', 'yildiz-avcisi', 'kusursuz-kulak', 'tuy-gibi'] as const).map((id) => ({ kind: 'achievement' as const, id, tier: 1 as const }));
    const t = toastsFor(ev);
    expect(t).toHaveLength(3);
    expect(shownJeton([], t.map((x) => x.text ?? ''))).toBe(4 * 15);
  });
});
