import { describe, expect, it } from 'vitest';
import { INBOX_TEXT, inboxGotText, inboxGroups, inboxReasonText, sameInboxGroup, weekRangeText, type InboxItem, type InboxKind } from './social';

// YN-103: Ödül kutusu satırları kimin ödülü olduğunu ve hangi hafta olduğunu okunur yazar; eski kayıtlar görünümde aynı biçime gelir
describe('ödül kutusu metinleri', () => {
  it('ISO hafta anahtarı tarih aralığına döner', () => {
    expect(weekRangeText('2026-W44')).toBe('26 Ekim–1 Kasım haftası');
    expect(weekRangeText('2026-W45')).toBe('2–8 Kasım haftası');
    expect(weekRangeText('2026-W01')).toBe('29 Aralık–4 Ocak haftası');
    expect(weekRangeText('hafta')).toBeNull();
  });
  it('eski sunucu metinleri yeni biçime gelir', () => {
    expect(inboxReasonText({ kind: 'jeton', reason: 'Takım hediyesi (alma süresi doldu): Takım hedefi: Yıldız Avı 4. kademe' }))
      .toBe("Takım hediyesi (Takım'da alınmadı, buraya geçti): Takım hedefi: Yıldız Avı 4. kademe");
    expect(inboxReasonText({ kind: 'kristal', reason: 'Sıralama: Baskın · geçen hafta 1.' })).toBe('Takımın Baskın sıralamasında geçen hafta 1. oldu');
    expect(inboxReasonText({ kind: 'kristal', reason: 'Sıralama: Günün Sorusu · geçen hafta 2.' })).toBe('Günün Sorusu sıralamasında geçen hafta 2. oldun');
    const k = inboxReasonText({ kind: 'kristal', reason: 'Bölge Savaşı 2026-W44: Ninni Merkezi bölgesi sizin' });
    const j = inboxReasonText({ kind: 'jeton', reason: 'Bölge Savaşı 2026-W44: Ninni Merkezi bölgesi sizin' });
    expect(k).toBe('Bölge Savaşı, 26 Ekim–1 Kasım haftası: takımın Ninni Merkezi bölgesini kazandı (bölge ödülü: kristal)');
    expect(j).not.toBe(k);
    expect(inboxReasonText({ kind: 'jeton', reason: INBOX_TEXT.giftMoved('x') })).toBe(INBOX_TEXT.giftMoved('x'));
    expect(inboxReasonText({ kind: 'jeton', reason: 'Arkadaş hediyesi' })).toBe('Arkadaş hediyesi');
  });
  it('yardım teşekkürü neye teşekkür edildiğini söyler; silinmiş hesapta ad yerine "bir oyuncu" (OT-ilk-kez-oyun-56)', () => {
    expect(INBOX_TEXT.helped('Ayşe', 40)).toBe('Yardım ettiğin Ayşe 40. bölümü geçti');
    expect(INBOX_TEXT.helped('Silinmiş Oyuncu', 40)).toBe('Yardım ettiğin bir oyuncu 40. bölümü geçti');
    expect(inboxReasonText({ kind: 'jeton', reason: 'Teşekkür: Ayşe Nur 40. bölümü geçti' })).toBe('Yardım ettiğin Ayşe Nur 40. bölümü geçti');
    expect(inboxReasonText({ kind: 'jeton', reason: 'Teşekkür: Silinmiş Oyuncu 40. bölümü geçti' })).toBe('Yardım ettiğin bir oyuncu 40. bölümü geçti');
    expect(inboxReasonText({ kind: 'jeton', reason: 'Yardım ettiğin Silinmiş Oyuncu 12. bölümü geçti' })).toBe('Yardım ettiğin bir oyuncu 12. bölümü geçti');
  });
  it('Hepsini al bildirimi yalnız alınan türleri sayar', () => {
    const got: { kind: InboxKind; amount: number }[] = [...[...Array(5)].map(() => ({ kind: 'kristal' as const, amount: 40 })), { kind: 'jeton', amount: 300 }, { kind: 'jeton', amount: 300 }];
    expect(inboxGotText(got)).toBe('+600 jeton, +200 kristal');
    expect(inboxGotText([{ kind: 'kalkan', amount: 1 }, { kind: 'jeton', amount: 1500 }])).toBe('+1.500 jeton, +1 kalkan (bir sonraki bölümde)');
  });
  it('Takım\'dan geçen hediye tek satır: aynı neden ve an; başka ödüller ayrı kalır (YN-246, OT-ogrenci-birinci-51)', () => {
    const it = (id: string, kind: InboxKind, amount: number, reason: string, at: number): InboxItem => ({ id, kind, amount, ref: '', reason, at });
    const hed = INBOX_TEXT.giftMoved('Takım hedefi: Yıldız Avı 4. kademe');
    const items = [
      it('a', 'jeton', 60, hed, 5000), it('b', 'kristal', 5, hed, 5000),
      // eski kayıt (parçalar birkaç ms arayla, eski metin) da tek satır
      it('c', 'jeton', 40, 'Takım hediyesi (alma süresi doldu): Takım görevi', 3000), it('d', 'kristal', 2, INBOX_TEXT.giftMoved('Takım görevi'), 3004),
      // aynı hediye metni ama başka gün: ayrı satır
      it('e', 'jeton', 60, hed, 90_000_000),
      // hediye olmayan iki parçalı ödül (Bölge Savaşı) bilerek ayrı satır
      it('f', 'kristal', 10, 'Bölge Savaşı 2026-W44: Ninni Merkezi bölgesi sizin', 1000), it('g', 'jeton', 100, 'Bölge Savaşı 2026-W44: Ninni Merkezi bölgesi sizin', 1000),
    ];
    expect(inboxGroups(items).map((g) => g.map((x) => x.id).join(''))).toEqual(['ab', 'cd', 'e', 'f', 'g']);
    expect(inboxGotText(inboxGroups(items)[0]!)).toBe('+60 jeton, +5 kristal');
    expect(sameInboxGroup(items[0]!, items[1]!)).toBe(true);
    expect(sameInboxGroup(items[0]!, items[4]!)).toBe(false);
  });
});
