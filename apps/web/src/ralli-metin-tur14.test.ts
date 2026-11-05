// Ralli metinleri (YN-245): (1) vuruş bildirimi sunucunun son canını yazar, vuruştan sonra başkası vurduysa söyler (OT-takim-kaptani-40);
// (2) kimse katılmadığı için sayılmayan ralli "canavar kaçtı" değil "ralli sayılmadı" (OT-takim-kaptani-42).
import { describe, expect, it } from 'vitest';
import type { ChatMessage, RallyHit, RallyState } from '@odi/shared';
import { rallyHitText, type RallyHitFlash } from './events/ralli-bolum';
import { rallyEnds } from './comm/Cards';

const hit = (id: string, name: string, damage: number, at: number): RallyHit => ({ id, name, damage, stars: 2, completed: true, at });
const rally = (o: Partial<RallyState>): RallyState => ({ id: 'r1', teamId: 't1', monster: 'yanki-hayaleti', salt: 1, starterId: 'a', starterName: 'Ayşe', status: 'acik', hp: 200, maxHp: 320, startsAt: 0, endsAt: 600_000, wonAt: null, hpPlayers: 2, attackStarted: true, participants: [], hits: [], ...o });
const f: RallyHitFlash = { id: 'r1', me: 'a', at: 1000, hp: 200, lead: '2 yıldızla vurdun.' };

describe('ralli vuruş bildirimi: güncel can', () => {
  it('başka vuruş yoksa yanıttaki can', () => {
    expect(rallyHitText(f, rally({ hits: [hit('a', 'Ayşe', 120, 1000)] }))).toBe('2 yıldızla vurdun. Kalan can: 200');
  });
  it('vuruşumdan sonra arkadaş vurduysa son can ve kim vurdu', () => {
    const live = rally({ hp: 80, hits: [hit('h', 'Hesapli', 120, 1500), hit('a', 'Ayşe', 120, 1000), hit('h', 'Hesapli', 90, 500)] });
    expect(rallyHitText(f, live)).toBe('2 yıldızla vurdun. Kalan can: 80 · senden sonra Hesapli 120 vurdu');
  });
  it('arkadaşın son darbesi: canavar yenildi; başka ralli durumu karışmaz', () => {
    const won = rally({ hp: 0, status: 'kazanildi', hits: [hit('h', 'Hesapli', 200, 2000), hit('a', 'Ayşe', 120, 1000)] });
    expect(rallyHitText(f, won)).toBe('2 yıldızla vurdun. Kalan can: 0 · senden sonra Hesapli 200 vurdu; canavar yenildi!');
    expect(rallyHitText(f, rally({ id: 'r2', hp: 10 }))).toBe('2 yıldızla vurdun. Kalan can: 200');
    expect(rallyHitText(f, null)).toBe('2 yıldızla vurdun. Kalan can: 200');
  });
});

describe('sayılmayan ralli kartı', () => {
  const msg = (text: string, meta: Record<string, unknown>): ChatMessage => ({ id: String(Math.random()), room: 'takim:t1', from: 'sistem', name: '', kind: 'system', text, at: 1, meta: { event: 'ralli', ...meta } } as unknown as ChatMessage);
  it('evre "sayilmadi" (yeni) ve eski iletideki "sayılmadı" metni ayrı durum; "kaçtı" yalnız sayılan ralli', () => {
    const ends = rallyEnds([
      msg('Yankı Hayaleti kaçtı: süre doldu, saldırı için en az 2 katılımcı gerekiyordu. Bu ralli sayılmadı, takımın günlük ralli hakkı geri verildi (bugün kalan 6).', { rallyId: 'r1', phase: 'sayilmadi' }),
      msg('Yankı Hayaleti kaçtı: süre doldu, saldırı için en az 2 katılımcı gerekiyordu. Bu ralli sayılmadı, takımın günlük ralli hakkı geri verildi (bugün kalan 6).', { rallyId: 'r2', phase: 'kacti' }),
      msg('Yankı Hayaleti kaçtı! Süre doldu (kalan can 80/320). Bir dahaki rallide!', { rallyId: 'r3', phase: 'kacti' }),
    ]);
    expect(Object.fromEntries(ends)).toEqual({ r1: 'sayilmadi', r2: 'sayilmadi', r3: 'kacti' });
  });
});
