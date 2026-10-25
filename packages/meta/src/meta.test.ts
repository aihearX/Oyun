import { describe, expect, it } from 'vitest';
import type { RunResult } from '@odi/shared';
import { SHOP } from '@odi/shared';
import { DEFAULT_SKILLS, ACHIEVEMENTS, CARDS, COSMETICS, HUMAN_JOURNEY, MAX_STREAK_SHIELDS, QUESTS, BIOME_ORDER } from '@odi/content';
const SHOP_COSMETIC_IDS = SHOP.flatMap((p) => p.contents.filter((c) => c.kind === 'kozmetik').map((c) => c.ref!));
import {
  addDays, advanceStreak, albumProgress, applyGrant, calendarView, chestReady, claimCalendar, claimQuest, computeMetrics, dailyChestReward,
  dayKey, daysBetween, defaultMeta, ensureDaily, equipCosmetic, evaluateAchievements, highestUnlocked, levelProgress, migrateMeta,
  nextGoal, nextTreasure, openDailyChest, processRun, recordShare, resolveLook, resolveReward, rollDailyQuests, rollLucky, settle,
  unlockAnnouncements, type PlayerCore,
} from './index';

const core = (over: Partial<PlayerCore> = {}): PlayerCore => ({ progress: {}, coins: 0, xp: 0, streak: 1, lastDay: '2026-10-18', failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta(), ...over });
const run = (over: Partial<RunResult> = {}): RunResult => ({ levelId: 'x', completed: true, stars: 2, score: 700, coins: 20, timeSec: 50, deaths: 0, damageTaken: 1, objectiveMet: true, secretFound: false, ...over });
const spec = (n: number) => { const l = HUMAN_JOURNEY.levels[n - 1]!; return { number: n, name: l.name, biome: l.biome, mechanic: l.mechanic, objective: { id: l.objective, label: 'Hedef' }, parTimeSec: 60, coinsTotal: 30 }; };
const DAY = '2026-10-18';

describe('içerik tanımları', () => {
  it('en az 40 kademeli başarım, benzersiz kimlik, artan eşikler', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) { expect(a.tiers.length).toBeGreaterThan(0); expect(a.tiers.length).toBeLessThanOrEqual(3); for (let i = 1; i < a.tiers.length; i++) expect(a.tiers[i]!).toBeGreaterThan(a.tiers[i - 1]!); }
  });
  it('her biyom için tam 5 kart', () => {
    expect(CARDS.length).toBe(BIOME_ORDER.length * 5);
    for (const b of BIOME_ORDER) expect(CARDS.filter((c) => c.biome === b).length).toBe(5);
    for (const c of CARDS) expect(c.fact.length).toBeGreaterThan(30);
  });
  it('mağaza kozmetik kimlikleri tanımlı', () => { for (const id of SHOP_COSMETIC_IDS) expect(COSMETICS.some((c) => c.id === id)).toBe(true); });
  it('görev havuzunun her yuvası dolu', () => { for (const s of ['a', 'b', 'c']) expect(QUESTS.some((q) => q.slot === s)).toBe(true); });
});

describe('zaman', () => {
  it('gün farkı ve ekleme', () => { expect(daysBetween('2026-10-18', '2026-10-20')).toBe(2); expect(addDays('2026-12-31', 1)).toBe('2027-01-01'); expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05'); });
});

describe('ödül kapısı', () => {
  it('jeton/xp/kart/kozmetik verir ve deftere yazar', () => {
    const { core: c, applied } = applyGrant(core(), [{ kind: 'jeton', amount: 10 }, { kind: 'xp', amount: 5 }, { kind: 'kart', amount: 1, ref: 'zar:ilk' }, { kind: 'kozmetik', amount: 1, ref: 'sapka-bere' }], 'test');
    expect(c.coins).toBe(10); expect(c.xp).toBe(5); expect(c.meta.cards).toContain('zar:ilk'); expect(c.meta.cosmetics.owned).toContain('sapka-bere');
    expect(c.meta.ledger.at(-1)?.reason).toBe('test'); expect(applied.length).toBe(4);
  });
  it('tekrar gelen kozmetik/kart ve sınır üstü koruyucu önceden yazılı jetona döner', () => {
    const m = { ...defaultMeta(), shields: MAX_STREAK_SHIELDS, cards: ['zar:ilk'] };
    const out = resolveReward(m, [{ kind: 'kart', amount: 1, ref: 'zar:ilk' }, { kind: 'koruyucu', amount: 1 }, { kind: 'kozmetik', amount: 1, ref: 'renk-mor' }]);
    expect(out).toEqual([{ kind: 'jeton', amount: 15 + 30 + 50 }]);
  });
});

describe('günlük görevler', () => {
  it('deterministik: aynı gün aynı 3 görev, her yuvadan bir', () => {
    const a = rollDailyQuests(DAY).map((q) => q.id); const b = rollDailyQuests(DAY).map((q) => q.id);
    expect(a).toEqual(b); expect(rollDailyQuests(DAY).map((q) => q.slot)).toEqual(['a', 'b', 'c']);
    const many = new Set(Array.from({ length: 30 }, (_, i) => rollDailyQuests(addDays(DAY, i)).map((q) => q.id).join()));
    expect(many.size).toBeGreaterThan(5);
  });
  it('bölüm sonucu görev ilerletir; görev ödülü bir kez alınır; sandık hepsi bitince açılır', () => {
    let c = core();
    c = { ...c, meta: { ...c.meta, daily: { day: DAY, chestOpened: false, quests: [{ id: 'oyna-3', progress: 0, claimed: false }, { id: 'uc-yildiz-1', progress: 0, claimed: false }, { id: 'meydan-1', progress: 0, claimed: false }] } } };
    for (let i = 0; i < 3; i++) c = processRun(c, spec(1), run({ stars: 3 }), DAY).core;
    const q = c.meta.daily!.quests; expect(q[0]!.progress).toBe(3); expect(q[1]!.progress).toBe(1); expect(q[2]!.progress).toBe(0);
    expect(chestReady(c.meta.daily!)).toBe(false);
    const claimed = claimQuest(c, 'oyna-3', DAY)!; expect(claimed.core.coins).toBeGreaterThan(c.coins); expect(claimQuest(claimed.core, 'oyna-3', DAY)).toBeNull();
    c = recordShare(claimed.core, DAY).core; expect(chestReady(c.meta.daily!)).toBe(true);
    const preview = dailyChestReward(c); expect(preview.some((i) => i.kind === 'koruyucu')).toBe(true);
    const opened = openDailyChest(c, DAY)!; expect(opened.core.meta.daily!.chestOpened).toBe(true); expect(opened.core.meta.shields).toBe(1);
    expect(opened.core.meta.daily!.quests.every((x) => x.claimed)).toBe(true); expect(openDailyChest(opened.core, DAY)).toBeNull();
    expect(opened.core.meta.stats.chests).toBe(1); expect(opened.core.meta.stats.quests).toBe(3);
  });
  it('yeni gün yeni görevler', () => { const d = ensureDaily(null, DAY); expect(ensureDaily(d, DAY)).toBe(d); expect(ensureDaily(d, addDays(DAY, 1)).day).toBe(addDays(DAY, 1)); });
});

describe('seri ve takvim', () => {
  it('ardışık gün artar, kaçırılan gün koruyucuyla korunur, yoksa 1\'den başlar', () => {
    const c = core({ streak: 4, lastDay: DAY });
    expect(advanceStreak(c, DAY).event.kind).toBe('same');
    expect(advanceStreak(c, addDays(DAY, 1)).core.streak).toBe(5);
    const withShield = { ...c, meta: { ...c.meta, shields: 1 } };
    const saved = advanceStreak(withShield, addDays(DAY, 2)); expect(saved.event.kind).toBe('saved'); expect(saved.core.streak).toBe(5); expect(saved.core.meta.shields).toBe(0);
    const reset = advanceStreak(c, addDays(DAY, 2)); expect(reset.event).toEqual({ kind: 'reset', previous: 4 }); expect(reset.core.streak).toBe(1);
    expect(advanceStreak(withShield, addDays(DAY, 3)).event.kind).toBe('reset'); // 2 gün kaçtı, 1 koruyucu yetmez
  });
  it('takvim günü seriden gelir; günde bir kez alınır; 7. günden sonra döngü', () => {
    let c = core({ streak: 3, lastDay: DAY });
    const v = calendarView(c, DAY); expect(v.dayIndex).toBe(2); expect(v.days[2]!.state).toBe('bugun'); expect(v.days[0]!.state).toBe('alindi');
    const r = claimCalendar(c, DAY)!; expect(r.day).toBe(3); expect(r.core.meta.cosmetics.owned).toContain('sapka-bere');
    expect(claimCalendar(r.core, DAY)).toBeNull(); c = r.core;
    expect(calendarView({ ...c, streak: 8 }, DAY).dayIndex).toBe(0); expect(calendarView({ ...c, streak: 8 }, DAY).cycle).toBe(2);
    expect(claimCalendar(core({ lastDay: '2026-10-17' }), DAY)).toBeNull();
  });
});

describe('bölüm işleme, başarımlar, albüm, kozmetik', () => {
  it('ödüller tek kapıdan; rekor ve ilk geçiş; görev özeti', () => {
    const c0 = core();
    const a = processRun(c0, spec(1), run({ score: 500 }), DAY);
    expect(a.core.coins).toBeGreaterThanOrEqual(20); expect(a.summary.firstClear).toBe(true); expect(a.summary.newRecord).toBe(false);
    expect(a.core.meta.ledger.some((g) => g.reason === 'bolum:1')).toBe(true);
    const b = processRun(a.core, spec(1), run({ score: 900 }), DAY); expect(b.summary.newRecord).toBe(true); expect(b.summary.prevBest).toBe(500);
    expect(a.summary.events.some((e) => e.kind === 'achievement' && e.id === 'ilk-ses')).toBe(true);
    expect(a.summary.events.some((e) => e.kind === 'card' && e.id === 'dis-kulak:ilk')).toBe(true);
  });
  it('Şanslı Nota bonusu ve hazine', () => {
    let c = core(); for (let n = 1; n <= 4; n++) c = processRun(c, spec(n), run(), DAY).core;
    const r = processRun(c, spec(5), run({ extra: { luckyNote: true } }), DAY);
    expect(r.summary.lucky).not.toBeNull(); expect(r.summary.treasure).not.toBeNull(); expect(r.core.meta.treasures).toContain(5);
    const again = processRun(r.core, spec(5), run(), DAY); expect(again.summary.treasure).toBeNull();
  });
  it('başarım kademeleri bir kez açılır', () => {
    let c = core(); c = processRun(c, spec(1), run(), DAY).core;
    expect(evaluateAchievements(c)).toEqual([]);
    expect(c.meta.achievements['ilk-ses']).toBe(1);
    const s = settle(c); expect(s.events).toEqual([]);
  });
  it('metrikler ilerlemeden hesaplanır', () => {
    const c = core({ progress: { 1: { stars: 3, best: 1, plays: 1 }, 2: { stars: 1, best: 1, plays: 2 } } });
    const m = computeMetrics(c); expect(m.stars).toBe(4); expect(m.threeStars).toBe(1); expect(m['biomeStars:dis-kulak']).toBe(4); expect(m.highest).toBe(3);
    expect(highestUnlocked(c.progress)).toBe(3);
  });
  it('albüm yüzdesi ve kozmetik açılımı (albüm %25 → Koklea Tokası)', () => {
    const quarter = CARDS.slice(0, Math.ceil(CARDS.length / 4)).map((c) => c.id);
    expect(albumProgress(quarter).pct).toBeGreaterThanOrEqual(25);
    const c = core({ meta: { ...defaultMeta(), cards: quarter } }); const s = settle(c);
    expect(s.core.meta.cosmetics.owned).toContain('sapka-koklea');
    expect(s.events.some((e) => e.kind === 'albumBadge')).toBe(true);
  });
  it('kozmetik giyme ve görünüm', () => {
    let m = defaultMeta(); expect(equipCosmetic(m, 'sapka-bere')).toBe(m); // sahip değil
    m = { ...m, cosmetics: { ...m.cosmetics, owned: [...m.cosmetics.owned, 'sapka-bere', 'kostum-altin'] } };
    m = equipCosmetic(m, 'sapka-bere'); expect(resolveLook(m).hat).toBe('bere');
    m = equipCosmetic(equipCosmetic(m, 'sapka-yok'), 'kostum-altin'); const look = resolveLook(m); expect(look.hat).toBe('altin'); expect(look.color).toBe(0xd9a400);
  });
});

describe('ilerleme geri bildirimi', () => {
  it('XP çubuğu levelFromXp ile tutarlı', () => { const p = levelProgress(0); expect(p.level).toBe(1); expect(p.pct).toBe(0); const q = levelProgress(p.to); expect(q.level).toBe(2); expect(q.pct).toBe(0); });
  it('dürüst yakın-kaçış metinleri', () => {
    expect(nextGoal(spec(2), run({ completed: false, stars: 0, extra: { pct: 0.92 } })).text).toBe('Kapıya %8 kaldı!');
    expect(nextGoal(spec(2), run({ stars: 2, coins: 20 })).text).toBe('3. yıldız için 7 nota daha ya da: Hedef');
    expect(nextGoal(spec(1), run({ stars: 2, coins: 20 })).text).toBe('3. yıldız için 7 nota daha');
    expect(nextGoal(spec(2), run({ stars: 1, objectiveMet: false })).text).toContain('2. yıldız için');
    expect(nextGoal(spec(3), run({ stars: 3, coins: 30 })).text).toContain('hazine');
    const timed = { ...spec(23), objective: { id: 'timed' as const, target: 80, target2: 95, label: '80 saniyede bitir' } };
    expect(nextGoal(timed, run({ stars: 1, coins: 10, objectiveMet: false })).text).toBe('2. yıldız için 8 nota daha ya da 95 saniyede bitir');
    expect(nextGoal(timed, run({ stars: 2, coins: 10, objectiveMet: false })).text).toBe('3. yıldız için 17 nota daha ya da: 80 saniyede bitir');
  });
  it('sıradaki hazine ve yenilik duyuruları', () => {
    expect(nextTreasure(3, {})).toMatchObject({ level: 5, remaining: 3 });
    expect(unlockAnnouncements(8).map((a) => a.kind).sort()).toEqual(['biyom', 'mekanik']); // 9: zar + trambolin
    expect(unlockAnnouncements(1)).toEqual([]);
  });
  it('Şanslı Nota ihtimali %10', () => { expect(rollLucky(() => 0.05)).toBe(true); expect(rollLucky(() => 0.1)).toBe(false); });
});

describe('sürüm göçü', () => {
  it('eski kayıttan (meta yok) dürüst doldurma', () => {
    const m = migrateMeta(undefined, { 1: { stars: 3, best: 10, plays: 2, lastResult: run({ damageTaken: 0 }) } });
    expect(m.stats.clears).toBe(1); expect(m.stats.plays).toBe(2); expect(m.seenBiomes).toContain('dis-kulak'); expect(m.cosmetics.owned).toContain('renk-mor');
  });
  it('bozuk alanlar varsayılana döner', () => {
    const m = migrateMeta({ stats: { plays: 'x', clears: 3 }, cosmetics: { owned: ['sapka-bere'], hat: 'sapka-tac' }, achievements: { a: 9 }, daily: { day: 5 } });
    expect(m.stats.plays).toBe(0); expect(m.stats.clears).toBe(3); expect(m.cosmetics.hat).toBe('sapka-yok'); expect(m.achievements.a).toBe(3); expect(m.daily).toBeNull();
  });
});
