import { describe, expect, it } from 'vitest';
import { epostaGecerli, normalizeEposta } from '@odi/shared';
import { yerelKayit } from './hesap/gecis';
import { ledgerKey } from './odul-durum';

/** 1.2.0 hesap kurtarma: cihaz başka hesaba geçince yerel kayıt sunucudaki ilerlemeden kurulur (gecis.ts) */
describe('hesap geçişi: yerel kayıt', () => {
  it('sunucu ilerlemesinden bölüm yıldızları ve XP; hikâye ve geçilen yerlerin tanıtımı görülmüş; jeton yerelden gelmez', () => {
    const k = yerelKayit({ best: [{ level: 1, stars: 3, score: 1200 }, { level: 2, stars: 2, score: 900 }, { level: 3, stars: 0, score: 0 }], xp: 340 });
    expect(Object.keys(k.progress).map(Number)).toEqual([1, 2]);
    expect(k.progress[1]).toMatchObject({ stars: 3, best: 1200 });
    expect(k.xp).toBeGreaterThanOrEqual(340);
    expect(k.ftue.story).toBe(true);
    expect(k.ftue.tours).toContain('map');
  });
  it('ilerlemeden açılan başarımların ödülü sunucuya ikinci kez gitmez (gönderilmiş işaretli)', () => {
    const best = Array.from({ length: 12 }, (_, i) => ({ level: i + 1, stars: 3, score: 1000 }));
    const k = yerelKayit({ best, xp: 2000 });
    const jetonlu = k.meta.ledger.filter((g) => g.items.some((x) => x.kind === 'jeton' && x.amount > 0));
    expect(jetonlu.length).toBeGreaterThan(0);
    for (const g of jetonlu) expect(k.gonderilmis).toContain(ledgerKey(g.at, g.reason));
  });
  it('ilerleme yoksa boş kayıt: hikâye baştan', () => {
    const k = yerelKayit(null);
    expect(k.progress).toEqual({});
    expect(k.ftue.story).toBe(false);
  });
  it('kurtarma e-postası biçimi (isteğe bağlı alan)', () => {
    expect(epostaGecerli(normalizeEposta(' Ali@Ornek.Com '))).toBe(true);
    expect(epostaGecerli('ali@ornek')).toBe(false);
  });
});
