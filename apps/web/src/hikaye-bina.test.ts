import { describe, expect, it } from 'vitest';
import { KG_HIKAYE } from '@odi/content';
import { hikayeBinasi } from './camp/hikaye-bina';

const step = (id: string, done: boolean) => ({ ref: '', id, text: '', art: '', need: 1, progress: 0, done, claimed: false, reward: null });
const kg = (no: number, steps: ReturnType<typeof step>[], done = false) => ({ story: { chapter: { no, title: '', intro: '', outro: '', steps, reward: {}, done, claimed: false, ref: '' }, next: null, claimed: 0, total: 10 } }) as never;

describe('Kampın Hikâyesi: istenen bina (MK-016)', () => {
  it('açık bölümün tamamlanmamış ilk bina adımı; bina dışı adım ve bitmiş bölüm atlanır', () => {
    const b1 = KG_HIKAYE[0]!; // Kampa Hoş Geldin: depo-1, depo-topla, merkez-2
    const ids = b1.steps.map((s) => s.id);
    expect(hikayeBinasi(kg(1, ids.map((id) => step(id, false))))).toEqual({ id: 'depo', need: 1, bolum: b1.title });
    // depo bitti, "depo-topla" bina adımı değil → sıradaki bina adımı Merkez Sv 2
    expect(hikayeBinasi(kg(1, ids.map((id, i) => step(id, i === 0))))).toEqual({ id: 'merkez', need: 2, bolum: b1.title });
    expect(hikayeBinasi(kg(1, ids.map((id) => step(id, true)), true))).toBeNull();
    expect(hikayeBinasi(null)).toBeNull();
  });
});
