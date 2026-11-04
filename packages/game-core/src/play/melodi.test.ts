import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '@odi/shared';
import { MELODY_BEHIND_PX, melodyBehind, melodyCanReturn, NO_INPUT, step, type SimEvent } from './sim';
import { run, setup, testSpec } from './testkit';

/** melodi notası (yolun üstünde, koşan kahraman alır) */
const note = (x: number, y = GROUND_Y - 30) => ({ type: 'note' as const, x, y, props: { t: 0.5 } });
const flat = { type: 'platform' as const, x: 0, y: GROUND_Y, w: 3000, h: 200 };

/** Melodi sırası bozulunca gösterge kalıcı değişir (YN-183, OT-buyuk-yazi-56). Faz şeridi testi: boss.test.ts (arena sınırı ve faz şeridi). */
describe('melodi sırası bozulma olayı', () => {
  it('sıradaki olmayan nota alınınca sıra bozulur (kalıcı), olay bir kez gelir; skor kuralı aynı (notes artmaz)', () => {
    // ilk nota yukarıda (koşan kahraman altından geçer), ikincisi yolda
    const { w, s } = setup(testSpec([flat, note(400, GROUND_Y - 320), note(800)], { number: 40 }));
    const evs: SimEvent[] = []; s.events = evs;
    run(w, s, 60 * 4);
    expect(s.notes).toBe(0); expect(s.nextNote).toBe(0);
    expect(s.melodyBroken).toBe('yanlis');
    const br = evs.filter((e) => e.k === 'melodyBroken');
    expect(br).toHaveLength(1); expect(br[0]!.s).toBe('yanlis'); expect(br[0]!.n).toBe(1);
    expect(evs.some((e) => e.k === 'noteWrong')).toBe(true);
  });

  it('geri dönülebilen bölümde geride kalan nota sırayı bozmaz: gösterge yönü ve sırasını söyler', () => {
    const { w, s } = setup(testSpec([flat, note(400, GROUND_Y - 320)], { number: 40 }));
    expect(melodyCanReturn(w)).toBe(true);
    s.events = [];
    const x0 = w.ents[w.melodyIds[0]!]!.x;
    for (let i = 0; i < 600 && s.hero.x < x0 + MELODY_BEHIND_PX - 2; i++) { expect(melodyBehind(w, s)).toBe(0); step(w, s, NO_INPUT); }
    run(w, s, 30);
    expect(melodyBehind(w, s)).toBe(1);
    expect(s.melodyBroken).toBeNull();
  });

  it('geri dönülemeyen bölümde nota ekrandan çıkınca sıra bozulur; düşüp gerisinde dirilir ve sırayla alırsa düzelir', () => {
    const { w, s } = setup(testSpec([flat, note(400), note(900)], { number: 40, abilities: [] }));
    expect(melodyCanReturn(w)).toBe(false);
    const evs: SimEvent[] = []; s.events = evs;
    const x0 = w.ents[w.melodyIds[0]!]!.x;
    // kahraman notayı almadan ilerisine geçti (ör. üstünden atladı)
    s.hero.x = x0 + MELODY_BEHIND_PX + 40; step(w, s, NO_INPUT);
    expect(s.melodyBroken).toBe('geride');
    expect(evs.filter((e) => e.k === 'melodyBroken').map((e) => [e.s, e.n])).toEqual([['geride', 1]]);
    // bir adım daha: olay yinelenmez
    step(w, s, NO_INPUT); expect(evs.filter((e) => e.k === 'melodyBroken')).toHaveLength(1);
    // notanın gerisinde (kontrol noktası gibi) yeniden: sırayla alınca sıra sürer
    s.hero.x = x0 - 150; s.hero.y = GROUND_Y;
    for (let i = 0; i < 600 && s.hero.x < x0 + 60; i++) step(w, s, NO_INPUT);
    expect(s.notes).toBe(1); expect(s.melodyBroken).toBeNull();
  });
});
