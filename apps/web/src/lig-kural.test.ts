// Bireysel lig grubu kuralı (YN-086, OT-rekabetci-24): ekran o grubun gerçek sınırlarını yazar; küçük grupta "İlk 7 / son 5" yazmaz.
import { describe, expect, it } from 'vitest';
import { leagueCuts } from '@odi/shared';
import { leagueRuleText } from './screens/InboxScreen';

describe('Bireysel lig kural cümlesi', () => {
  it('4 kişilik Gümüş grubu: ilk 1 çıkar, son 1 iner; 30 kişide 7/5', () => {
    const c = leagueCuts(4);
    expect(leagueRuleText('gumus', 4, c.up, c.down)).toBe('Bu grupta 4 kişi var. İlk 1 bir üst lige çıkar. Son 1 bir alta iner. Gruba yeni oyuncu katıldıkça sınırlar büyür (30 kişide ilk 7, son 5).');
    expect(leagueRuleText('altin', 30, 7, 5)).toBe('Bu grupta 30 kişi var. İlk 7 bir üst lige çıkar. Son 5 bir alta iner.');
  });
  it('Bronz düşmez, Koklea yükselmez, tek kişilik grupta düşme yok', () => {
    expect(leagueRuleText('bronz', 10, 3, 2)).toContain("İlk 3 bir üst lige çıkar. Bronz'dan düşülmez.");
    expect(leagueRuleText('koklea', 10, 3, 2)).toContain('Koklea en üst lig: buradan yükselme yok. Son 2 bir alta iner.');
    expect(leagueRuleText('gumus', 1, 1, 0)).toContain('İlk 1 bir üst lige çıkar. Bu grupta düşme yok.');
  });
});
