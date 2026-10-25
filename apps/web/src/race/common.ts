/**
 * Canlı yarış ortak yardımcıları (arayüz). Ağ istemcisi uygulamanın tek istemcisidir (`../net` → getNet()).
 * Yalnızca gerçek oyuncular: sahte rakip/bot yok (bot yalnızca test harness'inde, kullanıcıya hiç gösterilmez).
 */
import type { LevelSpec, RacePlayer, RaceRoom } from '@odi/shared';
import { HUMAN_JOURNEY } from '@odi/content';
import { useNet } from '@odi/net/store';
import type { NetClient } from '@odi/net';
import { getNet } from '../net';
import { loadLevelGen } from '../engine';

/**
 * Yarış bölümü: herkes için aynı (aynı yolculuk + bölüm + varsayılan profil + odanın tuzu). Bölüm üreticisi tembel yüklenir
 * (engine.ts loadLevelGen; yarış lobisi açılınca önden yüklenir).
 */
export async function raceSpec(room: Pick<RaceRoom, 'level' | 'salt'>): Promise<LevelSpec> {
  const { generateLevel, DEFAULT_PROFILE } = await loadLevelGen();
  return generateLevel('insan', room.level, DEFAULT_PROFILE, room.salt);
}

export const levelName = (n: number) => HUMAN_JOURNEY.levels.find((l) => l.number === n)?.name ?? `${n}. bölüm`;
export const hexColor = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

/** bağlantı durumu değişince yeniden çizilir; istemci yoksa (sunucu adresi yok / henüz kurulmadı) null */
export function useRaceNet(): { net: NetClient | null; online: boolean; meId: string | null } {
  const status = useNet((s) => s.status);
  const me = useNet((s) => s.me);
  const net = getNet();
  return { net, online: !!net && status === 'bağlı', meId: me?.id ?? net?.me?.id ?? null };
}

/** Sonuç sırası (her istemcide aynı): derece → bitirip derecesizler → yarışta olanlar/bitiremeyenler → ayrılanlar; eşitlikte ilerleme, sonra kimlik */
export function standings(room: RaceRoom): RacePlayer[] {
  const group = (p: RacePlayer) => (p.place != null ? 0 : p.left ? 3 : p.finishedAt != null ? 1 : 2);
  return [...room.players].sort((a, b) => group(a) - group(b) || (a.place ?? 0) - (b.place ?? 0) || b.pct - a.pct || (a.id < b.id ? -1 : 1));
}

/** bitiş süresi (sn) — sunucunun başlama ve bitiş zamanlarından */
export function raceTimeSec(room: RaceRoom, p: RacePlayer): number | null {
  return p.finishedAt != null && room.startsAt != null ? Math.max(0, (p.finishedAt - room.startsAt) / 1000) : null;
}

const STATUS_ORDER = { 'lobi': 0, 'geri-sayim': 1, 'yarista': 2, 'bitti': 3 } as const;
/** aynı odanın iki görünümünden daha güncel olanı (olay ve yanıt sırası karışabilir): durum ilerlemesi, sonra bitiren sayısı */
export function newerRoom(a: RaceRoom | undefined | null, b: RaceRoom | undefined | null): RaceRoom | undefined {
  if (!a) return b ?? undefined; if (!b || b.id !== a.id) return a;
  const done = (r: RaceRoom) => r.players.filter((p) => p.finishedAt != null || p.left).length;
  const d = STATUS_ORDER[b.status] - STATUS_ORDER[a.status];
  return d > 0 || (d === 0 && done(b) >= done(a)) ? b : a;
}

export const fmtSec = (s: number) => `${s.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sn`;
export const fmtClock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const placeMedal = (place: number | null) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '');
/** yarış derecesinin lig bonusu (leaguePointsFor ile aynı kural) */
export const raceBonus = (place: number | null) => (place == null ? 0 : place === 1 ? 30 : place === 2 ? 15 : place === 3 ? 8 : 3);
