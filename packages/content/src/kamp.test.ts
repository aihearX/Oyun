import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '@odi/shared';

const BIOME_ORDER_FOR_TEST = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
import { BUILDING_INFO, CAMP_COSMETICS, CAMP_TERMS, MONUMENTS, campUnlocksAt, earnedCampCosmetics, levelLineId, nextCampUnlock, openCampTerms } from './kamp';
import { PATHOLOGY_IDS, PATHOLOGY_NAMES, REGION_PATHOLOGIES, REMEDIES, REMEDY_INV_CAP, carrySlots, remediesFor, remedyPeriodMs, remedyShelf, remedyShelfCap } from './remedies';
import { COSMETICS, cosmeticUnlockText } from './cosmetics';
import { GLOSSARY } from './odyoloji';

/** bozuk kodlama, yer tutucu ve boşluk hataları (odyoloji.test.ts ile aynı ölçüt) */
const BAD = /Ã|Ä|Å|Ð|Þ|�|\s{2,}|\s[,.;:!?]|TODO|XXX|lorem/i;
function sane(s: string, where: string) {
  expect(s.trim(), where).toBe(s);
  expect(s.length, where).toBeGreaterThan(5);
  expect(BAD.test(s), `${where}: “${s}”`).toBe(false);
  expect(/[a-zçğıöşü]/i.test(s), where).toBe(true);
  expect((s.match(/\(/g) ?? []).length, `${where} parantez`).toBe((s.match(/\)/g) ?? []).length);
  expect((s.match(/“/g) ?? []).length, `${where} tırnak`).toBe((s.match(/”/g) ?? []).length);
}
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe('Tedavi Odası malzemeleri', () => {
  it('eşsiz kimlik ve ad, sade + teknik satır, kaynak, geçerli patoloji kimlikleri', () => {
    expect(REMEDIES.length).toBeGreaterThanOrEqual(10);
    expect(dupes(REMEDIES.map((r) => r.id))).toEqual([]);
    expect(dupes(REMEDIES.map((r) => r.name.toLocaleLowerCase('tr')))).toEqual([]);
    for (const r of REMEDIES) {
      expect(r.id).toMatch(/^[a-z0-9-]+$/);
      sane(r.name, r.id); sane(r.term, `${r.id}.term`); sane(r.plain, `${r.id}.plain`); sane(r.tech, `${r.id}.tech`);
      expect(r.plain.endsWith('.'), r.id).toBe(true); expect(r.tech.endsWith('.'), r.id).toBe(true);
      expect(r.plain.length, `${r.id}: sade satır kısa`).toBeLessThanOrEqual(120);
      expect(r.tech.length, `${r.id}: teknik satır ayrıntılı`).toBeGreaterThan(r.plain.length);
      expect(r.src.length).toBeGreaterThan(10);
      expect(r.counters.length).toBeGreaterThan(0);
      for (const p of r.counters) expect(PATHOLOGY_IDS as readonly string[], `${r.id} → ${p}`).toContain(p);
      expect(r.level).toBeGreaterThanOrEqual(1); expect(r.level).toBeLessThanOrEqual(15);
      expect(r.minutes).toBeGreaterThan(0);
      expect(r.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    // Sv 1'de en az iki tarif açık (ilk deneyim boş kalmasın)
    expect(REMEDIES.filter((r) => r.level === 1).length).toBeGreaterThanOrEqual(2);
  });
  it('her patolojinin Türkçe adı var; malzemesi olmayanlar bilinçli (tedavisi hekim sürecidir)', () => {
    for (const p of PATHOLOGY_IDS) { expect(PATHOLOGY_NAMES[p], p).toBeTruthy(); sane(PATHOLOGY_NAMES[p], p); }
    expect(PATHOLOGY_IDS.filter((p) => remediesFor(p).length === 0)).toEqual(['meniere', 'noroma']);
    for (const ps of Object.values(REGION_PATHOLOGIES)) for (const p of ps) expect(PATHOLOGY_IDS as readonly string[]).toContain(p);
  });
  it('üretim kuralları: seviye süreyi kısaltır (en çok %45), raf 2 + Sv/3, çanta 2–4 yer', () => {
    const d = { minutes: 60 };
    expect(remedyPeriodMs(d, 1)).toBe(60 * 60_000);
    expect(remedyPeriodMs(d, 2)).toBeLessThan(remedyPeriodMs(d, 1));
    expect(remedyPeriodMs(d, 15)).toBeGreaterThanOrEqual(0.55 * 60 * 60_000 - 60_000);
    expect([0, 1, 3, 6, 15].map(remedyShelfCap)).toEqual([0, 2, 3, 4, 7]);
    expect(carrySlots({ tedavi: 0, merkez: 1 })).toBe(2);
    expect(carrySlots({ tedavi: 6, merkez: 11 })).toBe(3);
    expect(carrySlots({ tedavi: 15, merkez: 15 })).toBe(4);
    expect(REMEDY_INV_CAP).toBe(9);
    const t0 = 1_000_000; const per = remedyPeriodMs(d, 1);
    expect(remedyShelf(d, 1, t0, t0 + per * 0.5)).toMatchObject({ ready: 0, nextSince: t0 });
    expect(remedyShelf(d, 1, t0, t0 + per * 1.5)).toMatchObject({ ready: 1, nextSince: t0 + per });
    expect(remedyShelf(d, 1, t0, t0 + per * 9)).toMatchObject({ ready: 2, nextSince: t0 + per * 9, progress: 1 });
    expect(remedyShelf(d, 0, t0, t0 + per * 9).ready).toBe(0);
  });
});

describe('Kulak Kampı içeriği', () => {
  it('her binanın odyolojik açıklaması var (sade + teknik + kaynak)', () => {
    for (const b of BUILDINGS) {
      const i = BUILDING_INFO[b.id]; expect(i, b.id).toBeTruthy();
      sane(i.plain, `${b.id}.plain`); sane(i.tech, `${b.id}.tech`); sane(b.name, `${b.id}.name`); sane(b.desc, `${b.id}.desc`);
      expect(i.src.length).toBeGreaterThan(10);
    }
    expect(dupes(BUILDINGS.map((b) => b.name))).toEqual([]);
    expect(dupes(BUILDINGS.map((b) => b.short ?? b.name))).toEqual([]);
  });
  it('kamp sözlük terimleri: eşsiz (bölge terimleriyle de çakışmaz), Türkçe, bina seviyesi geçerli', () => {
    expect(CAMP_TERMS.length).toBeGreaterThanOrEqual(10);
    expect(dupes([...GLOSSARY.map((g) => g.id), ...CAMP_TERMS.map((t) => t.id)])).toEqual([]);
    expect(dupes([...GLOSSARY.map((g) => g.term.toLocaleLowerCase('tr')), ...CAMP_TERMS.map((t) => t.term.toLocaleLowerCase('tr'))])).toEqual([]);
    for (const t of CAMP_TERMS) {
      sane(t.term, t.id); sane(t.plain, `${t.id}.plain`); sane(t.tech, `${t.id}.tech`);
      expect(t.plain.endsWith('.') && t.tech.endsWith('.'), t.id).toBe(true);
      expect(BUILDINGS.some((b) => b.id === t.building), t.id).toBe(true);
      expect(t.level).toBeGreaterThanOrEqual(2); expect(t.level).toBeLessThanOrEqual(15);
    }
    expect(openCampTerms(() => 0)).toEqual([]);
    expect(openCampTerms(() => 15)).toHaveLength(CAMP_TERMS.length);
  });
  it('kamp kozmetikleri cosmetics.ts ile birebir; kilit metni bina adını söyler', () => {
    expect(dupes(CAMP_COSMETICS.map((c) => c.id))).toEqual([]);
    const fromCos = COSMETICS.filter((c) => c.unlock.by === 'camp');
    expect(fromCos.map((c) => c.id).sort()).toEqual(CAMP_COSMETICS.map((c) => c.id).sort());
    for (const c of CAMP_COSMETICS) {
      const def = COSMETICS.find((x) => x.id === c.id)!;
      expect(def.unlock).toEqual({ by: 'camp', building: c.building, level: c.level });
      expect(cosmeticUnlockText(def.unlock)).toBe(`Kamp: ${BUILDINGS.find((b) => b.id === c.building)!.name} Sv ${c.level}`);
      sane(def.desc, c.id);
    }
    expect(earnedCampCosmetics((b) => (b === 'laboratuvar' ? 3 : 0))).toEqual(['renk-sol-kulak']);
  });
  it('açılım tablosu: her açılım bir binada tek seviyede; sıradaki açılım bulunur', () => {
    const all = BUILDINGS.flatMap((b) => Array.from({ length: 15 }, (_, i) => campUnlocksAt(b.id, i + 1).map((u) => `${b.id}:${i + 1}:${u.kind}:${'id' in u ? u.id : ''}`))).flat();
    expect(dupes(all)).toEqual([]);
    expect(all.filter((x) => x.includes(':canta:'))).toHaveLength(2);
    expect(nextCampUnlock('laboratuvar', 0)).toMatchObject({ level: 2 });
    expect(nextCampUnlock('tedavi', 13)).toBeNull();
    expect(campUnlocksAt('tedavi', 1).map((u) => u.kind)).toEqual(['tarif', 'tarif']);
  });
  it('anıtlar: her bölge için bir tane, kulaktan beyne sırayla; Tüy Dede satır kimlikleri biçimli', () => {
    expect(MONUMENTS.map((m) => m.region)).toEqual(BIOME_ORDER_FOR_TEST);
    expect(dupes(MONUMENTS.map((m) => m.name))).toEqual([]);
    for (const m of MONUMENTS) { sane(m.name, m.region); sane(m.plain, `${m.region}.plain`); expect(m.line).toBe(`anit-${m.region}`); }
    expect(levelLineId('kule', 1)).toBe('kamp-sv-kule-1');
    expect(levelLineId('kule', 5)).toBe('kamp-sv-kule-2');
    expect(levelLineId('kule', 15)).toBe('kamp-sv-kule-3');
  });
});
