import { describe, expect, it } from 'vitest';
import { DELETED_PLAYER_NAME, LEFT_PLAYER_LABEL, RALLY_MAX_HIT, RALLY_MAX_PER_PLAYER, RALLY_MONSTERS, RALLY_RULES, rallyMaxHp, rallyMorePlayersNeeded, rallyPlayersNeeded, rallyReachable, rallyShownName } from './social';

const mon = (id: string) => RALLY_MONSTERS.find((m) => m.id === id)!;

describe('ralli dürüst bilgi (YN-116)', () => {
  it('koşu başına en çok 150, kişi başına 3 hakla 450', () => {
    expect(RALLY_MAX_HIT).toBe(150);
    expect(RALLY_MAX_PER_PLAYER).toBe(RALLY_RULES.triesPerPlayer * 150);
  });
  it('en az kişi = ceil(can / 450); 10 üyeli takımda Yankı Hayaleti 1.400 can → 4 kişi', () => {
    expect(rallyMaxHp(mon('yanki-hayaleti'), 10)).toBe(1400);
    expect(rallyPlayersNeeded(1400)).toBe(4);
    expect(rallyPlayersNeeded(900)).toBe(2);
    expect(rallyPlayersNeeded(901)).toBe(3);
    expect(rallyPlayersNeeded(200)).toBe(1);
    expect(rallyPlayersNeeded(0)).toBe(0);
  });
  it('erişilebilir hasar katılımcıların kalan haklarından; yetmezse kaç kişi daha gerektiği', () => {
    expect(rallyReachable([{ tries: 0 }, { tries: 0 }])).toBe(900);
    expect(rallyReachable([{ tries: 2 }, { tries: 3 }, { tries: 5 }])).toBe(150);
    expect(rallyMorePlayersNeeded(1400, [{ tries: 0 }, { tries: 0 }])).toBe(2);
    expect(rallyMorePlayersNeeded(900, [{ tries: 0 }, { tries: 0 }])).toBe(0);
    expect(rallyMorePlayersNeeded(500, [{ tries: 2 }, { tries: 3 }])).toBe(1);
  });
  it('silinmiş hesabın adı gösterimde "Ayrılan bir oyuncu"', () => {
    expect(rallyShownName(DELETED_PLAYER_NAME)).toBe(LEFT_PLAYER_LABEL);
    expect(rallyShownName('Ayşe')).toBe('Ayşe');
  });
});
