import { afterEach, describe, expect, it } from 'vitest';
import { CHALLENGE_PARTICIPATION, CHALLENGE_REWARDS, challengePrize, challengeRuleText } from '../src/events/challenge';
import { dayKey } from '../src/time';
import { setup, type Env } from './helpers';
import { connectW, erun, type EC } from './events-util';

/** Günün Meydan Okuması: sıra ödülü katılımla ölçeklenir (sahip kararı 53, YN-256) */
let env: Env;
afterEach(async () => { await env?.close(); env = undefined as unknown as Env; });

const amt = (p: ReturnType<typeof challengePrize>) => (p ? `${p.kind}:${p.items.map((i) => `${i.kind}${i.amount}`).join('+')}` : 'yok');
const SIRA1 = 'sira:jeton300+kristal50';
const SIRA23 = 'sira:jeton200+kristal30';
const SIRA410 = 'sira:jeton120+kristal15';
const ILK10 = 'sira:jeton60+kristal8';
const KATILIM = 'katilim:jeton60+kristal8';
/** n katılımda sıra sıra ödüller */
const table = (n: number) => Array.from({ length: n }, (_, i) => amt(challengePrize(i + 1, n)));

describe('Günün Meydan Okuması: katılımla ölçeklenen sıra ödülü', () => {
  it('eşikler: 1. en az 5, 2.–10. en az 8; ödül miktarları değişmedi; katılım ödülü bugünkü ilk %10 kademesi', () => {
    expect(CHALLENGE_REWARDS.map((t) => [t.label, t.min, t.items.map((i) => i.amount).join('+')])).toEqual([
      ['1.', 5, '300+50'], ['2.–3.', 8, '200+30'], ['4.–10.', 8, '120+15'], ['İlk %10', 8, '60+8'],
    ]);
    expect(CHALLENGE_PARTICIPATION.map((i) => `${i.kind}${i.amount}`)).toEqual(['jeton60', 'kristal8']);
  });

  it('tek katılımcı rakipsiz 1.: sıra ödülü yok, katılım ödülü', () => {
    expect(table(1)).toEqual([KATILIM]);
  });

  it('4 katılımcı: herkes katılım ödülü', () => {
    expect(table(4)).toEqual(Array(4).fill(KATILIM));
  });

  it('5 katılımcı: 1.ye sıra ödülü, diğerlerine katılım ödülü', () => {
    expect(table(5)).toEqual([SIRA1, ...Array(4).fill(KATILIM)]);
  });

  it('7 katılımcı: yine yalnız 1. sıra ödülü alır', () => {
    expect(table(7)).toEqual([SIRA1, ...Array(6).fill(KATILIM)]);
  });

  it('8 katılımcı: bütün sıra ödülleri (bugünkü kural), katılım ödülü yok', () => {
    expect(table(8)).toEqual([SIRA1, SIRA23, SIRA23, ...Array(5).fill(SIRA410)]);
  });

  it('daha kalabalık: 10 kişide herkes ilk 10; 11-109 kişide ilk 10 dışı ödülsüz; 110+ kişide ilk %10 kademesi (mantık aynı)', () => {
    expect(table(10)).toEqual([SIRA1, SIRA23, SIRA23, ...Array(7).fill(SIRA410)]);
    expect(table(30)).toEqual([SIRA1, SIRA23, SIRA23, ...Array(7).fill(SIRA410), ...Array(20).fill('yok')]);
    const t200 = table(200);
    expect(t200.slice(10, 20)).toEqual(Array(10).fill(ILK10));
    expect(t200[20]).toBe('yok');
    expect(t200.filter((x) => x === KATILIM)).toHaveLength(0);
  });

  it('kural metni gerçek katılan sayısını ve eşikleri yazar', () => {
    expect(challengeRuleText(3)).toBe("3 kişi katıldı; 1.'lik ödülü en az 5, 2.–10. ödülleri en az 8 katılımda verilir. Bu yüzden puanı olan herkese katılım ödülü.");
    expect(challengeRuleText(6)).toContain("Bu yüzden 1.'ye sıra ödülü, diğer herkese katılım ödülü.");
    expect(challengeRuleText(9)).toContain('Sıra ödülleri geçerli.');
  });

  it('sunucu gün sonunda dağıtır: 1, 4, 5 ve 8 katılımlı günler; bildirim ve dünkü sonuç kartı', async () => {
    env = await setup();
    const ps: EC[] = [];
    for (const n of ['Ayşe', 'Bora', 'Cem', 'Deniz', 'Ece', 'Fatih', 'Gül', 'Hakan']) ps.push(await connectW(env, n));
    const counts = [1, 4, 5, 8];
    const days: string[] = [];
    const lasts: unknown[] = [];
    for (const n of counts) {
      days.push(dayKey(env.clock.now()));
      // sıra: ilk oyuncu en yüksek skor
      for (let i = 0; i < n; i++) await ps[i]!.c.call('challenge.submit', erun({ score: 3000 - i * 100 }));
      expect((await ps[0]!.c.call('challenge.state', {})).challenge).toMatchObject({ total: n, minFirst: 5, minAll: 8 });
      env.clock.advance(24 * 3600_000);
      lasts.push((await ps[n - 1]!.c.call('challenge.state', {})).challenge.last);
    }
    const got = async (p: EC, day: string) => (await p.c.call('inbox.list', {})).items.filter((i) => i.reason.includes(`Meydan Okuması ${day}`)).map((i) => `${i.kind}${i.amount}`).sort().join('+');
    const P = 'jeton60+kristal8';
    // 1 kişi
    expect(await got(ps[0]!, days[0]!)).toBe(P);
    // 4 kişi: herkes katılım ödülü; oynamayan hiç
    for (let i = 0; i < 4; i++) expect(await got(ps[i]!, days[1]!)).toBe(P);
    expect(await got(ps[4]!, days[1]!)).toBe('');
    // 5 kişi: 1. sıra ödülü, 2.-5. katılım ödülü
    expect(await got(ps[0]!, days[2]!)).toBe('jeton300+kristal50');
    for (let i = 1; i < 5; i++) expect(await got(ps[i]!, days[2]!)).toBe(P);
    // 8 kişi: bugünkü sıra ödülleri
    expect([...(await Promise.all(ps.map((p) => got(p, days[3]!))))]).toEqual([
      'jeton300+kristal50', 'jeton200+kristal30', 'jeton200+kristal30', ...Array(5).fill('jeton120+kristal15'),
    ]);
    // katılım ödülü bildirimi kuralı ve gerçek sayıyı yazar
    const n4 = await ps[1]!.wait('events.notice', (x) => x.notice.kind === 'meydan' && x.notice.text.startsWith('4 kişi katıldı'));
    expect(n4.notice.title).toBe('Meydan okuma: 2. oldun, katılım ödülü');
    expect(n4.notice.text).toContain('Bu yüzden puanı olan herkese katılım ödülü.');
    // dünkü sonuç kartı (o günün son sıradakisi): o günün gerçek katılan sayısı ve alınan ödül türü
    expect(lasts).toMatchObject([
      { rank: 1, total: 1, prize: { kind: 'katilim' } },
      { rank: 4, total: 4, prize: { kind: 'katilim' } },
      { rank: 5, total: 5, prize: { kind: 'katilim' } },
      { rank: 8, total: 8, prize: { kind: 'sira' } },
    ]);
  });
});
