import { describe, expect, it } from 'vitest';
import { olcumOnbellek } from './olcum-onbellek';
import { playHuman } from './testkit';

describe('ölçüm önbelleği', () => {
  it('önbellekten gelen insan koşusu, önbelleksiz hesapla aynıdır; girdide işlev varsa önbellek atlanır', () => {
    const a = playHuman(3, { k: 5 });
    const b = playHuman(3, { k: 5 }); // ikinci çağrı önbellekten
    let n = 0;
    const fresh = olcumOnbellek('deneme-islev', [{ f: () => 1 }], () => ++n);
    const again = olcumOnbellek('deneme-islev', [{ f: () => 1 }], () => ++n);
    expect(b).toEqual(a);
    expect([fresh, again]).toEqual([1, 2]); // işlevli girdi her seferinde hesaplanır
    // koşu JSON'a kayıpsız dönüşür (önbellek dosyası aynı değeri verir)
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});
