import { describe, expect, it } from 'vitest';
import { DELETED_PLAYER_NAME, LEFT_PLAYER_LABEL, RALLY_MAX_HIT, RALLY_MAX_PER_PLAYER, RALLY_MONSTERS, RALLY_RULES, SOCIAL_LIMITS, rallyMaxHp, rallyPerPlayerNeed, rallyReachable, rallyShownName } from './social';

const mon = (id: string) => RALLY_MONSTERS.find((m) => m.id === id)!;

describe('ralli dürüst bilgi (YN-116)', () => {
  it('koşu başına en çok 150, kişi başına 3 hakla 450', () => {
    expect(RALLY_MAX_HIT).toBe(150);
    expect(RALLY_MAX_PER_PLAYER).toBe(RALLY_RULES.triesPerPlayer * 150);
  });
  it('can katılımcıya göre: hpBase + hpPerMember × katılımcı (karar 43, YN-117)', () => {
    expect(rallyMaxHp(mon('serumen-yavrusu'), 2)).toBe(200);
    expect(rallyMaxHp(mon('cinlama-cini'), 2)).toBe(320);
    expect(rallyMaxHp(mon('yanki-hayaleti'), 2)).toBe(440);
    expect(rallyMaxHp(mon('yanki-hayaleti'), 10)).toBe(1400);
    expect(rallyPerPlayerNeed(mon('yanki-hayaleti'), 2)).toBe(220);
  });
  it('denge: her canavar 2 kişiden takım üst sınırına dek her katılımcı sayısında tam güçle yenilebilir, ama tek koşu turu yetmez (önemsiz değil)', () => {
    for (const m of RALLY_MONSTERS) {
      for (let n = RALLY_RULES.minPlayers; n <= SOCIAL_LIMITS.teamMax; n++) {
        const hp = rallyMaxHp(m, n);
        expect(hp, `${m.id} × ${n}`).toBeLessThanOrEqual(n * RALLY_MAX_PER_PLAYER);
        // herkes yalnız bitiremediği koşular yaparsa (15 hasar) yenilemez: bölümü bitirmek gerekir
        expect(hp, `${m.id} × ${n}`).toBeGreaterThan(n * RALLY_RULES.triesPerPlayer * 15);
      }
      // 2 kişide kişi başına gereken hasar tek bir 3 yıldızlı koşudan (150) azsa bile en az bir bitiriş ister
      expect(rallyPerPlayerNeed(m, 2)).toBeGreaterThan(60);
    }
  });
  it('erişilebilir hasar katılımcıların kalan haklarından', () => {
    expect(rallyReachable([{ tries: 0 }, { tries: 0 }])).toBe(900);
    expect(rallyReachable([{ tries: 2 }, { tries: 3 }, { tries: 5 }])).toBe(150);
  });
  it('silinmiş hesabın adı gösterimde "Ayrılan bir oyuncu"', () => {
    expect(rallyShownName(DELETED_PLAYER_NAME)).toBe(LEFT_PLAYER_LABEL);
    expect(rallyShownName('Ayşe')).toBe('Ayşe');
  });
});
