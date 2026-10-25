import { describe, expect, it } from 'vitest';
import { generateLevel } from '@odi/level-gen';
import { playLevel } from './testkit';

/** Oyun hissi kabulleri (docs/11): zar biyomunda zar gerçekten oynanır, kanalda uzun tırmanışlar var, gizli koklealar ana yolda değil. */
describe('his: biyomun kalbi oynanır', () => {
  it('kulak zarı (9-12): her bölümde en az 6 zar sıçrayışı (salt 0-3)', () => {
    const bad: string[] = [];
    for (let n = 9; n <= 12; n++) for (const salt of [0, 1, 2, 3]) { const r = playLevel(n, { salt }); if (r.tramps < 6) bad.push(`${n}/${salt}: ${r.tramps}`); }
    expect(bad).toEqual([]);
  }, 300_000);
  it('kanal (7-8): en az 6 duvar zıplamalık kesintisiz tırmanış (salt 0-3)', () => {
    const bad: string[] = [];
    for (const n of [7, 8]) for (const salt of [0, 1, 2, 3]) { const r = playLevel(n, { salt }); if (r.wallChain < 6) bad.push(`${n}/${salt}: ${r.wallChain}`); }
    expect(bad).toEqual([]);
  }, 300_000);
});

describe('his: bölüm yayı ve ödüller', () => {
  it('her bölüm doruk gösterisiyle biter; her bölüm-içi bölümde isteğe bağlı risk yolu var', () => {
    for (let n = 1; n <= 40; n++) for (const salt of [0, 1]) {
      const s = generateLevel('insan', n, undefined, salt); if (s.mechanic === 'boss') continue;
      expect(s.chunks.slice(-2).some((c) => c.setPiece), `${n}/${salt} doruk`).toBe(true);
      const st = s.sectionStarts!;
      for (let k = 0; k < 3; k++) { const part = s.chunks.slice(st[k], k < 2 ? st[k + 1] : s.chunks.length); expect(part.some((c) => c.tags.includes('risk')), `${n}/${salt} bölüm ${k + 1} risk yolu`).toBe(true); }
    }
  }, 60_000); // 80 bölüm üretimi: yüklü makinede 5 sn'lik varsayılanı aşabilir
  it('gizli altın koklealar ana yolda değil: koklealardan kaçınan oyuncu hiçbirini istemeden almaz', () => {
    const bad: string[] = [];
    for (let n = 1; n <= 39; n++) { if (n === 20) continue; const r = playLevel(n, { prefs: { secrets: false } }); if (r.cochleas > 0) bad.push(`${n}: ${r.cochleas}`); }
    expect(bad).toEqual([]);
  }, 600_000);
});
