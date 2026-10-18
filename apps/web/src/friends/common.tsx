import { useNet } from '@odi/net/store';
import { DM_STICKERS, type PublicProfile } from '@odi/shared';
import { act, toast } from '../net';
import { platform } from '../platform';
import type { Nav } from '../nav';
import { OdiAvatar } from '../ui/OdiAvatar';
import { TIER } from '../ui/social';
import { hatKey } from '../screens/team/TeamMembers';
import { friendsNet, sendDm, useFriends } from './state';

/** çevrimiçi mi (presence olayı profil bilgisinden yenidir) */
export function useOnline(p: Pick<PublicProfile, 'id' | 'online'> | null | undefined): boolean {
  const pres = useNet((s) => (p ? s.presence[p.id] : undefined));
  return pres ?? p?.online ?? false;
}

/** Odi avatarı + çevrimiçi noktası */
export function Av({ p, size = 44, dot = true, mood }: { p: Pick<PublicProfile, 'id' | 'color' | 'hat' | 'online'>; size?: number; dot?: boolean; mood?: 'happy' | 'wow' }) {
  const on = useOnline(p);
  return (
    <span className="fr-av" style={{ width: size, height: size }}>
      <OdiAvatar size={Math.round(size * 0.92)} color={p.color} hat={hatKey(p.hat)} mood={mood} />
      {dot && <i className={`fr-dot${on ? ' on' : ''}`} aria-label={on ? 'çevrimiçi' : undefined} />}
    </span>
  );
}

/** "12. bölüm · 🐚 Kulaklar" gibi kısa satır */
export function infoLine(p: PublicProfile): string {
  return [`${p.highest}. bölüm`, p.teamName ? `${p.teamEmblem ?? ''} ${p.teamName}`.trim() : null].filter(Boolean).join(' · ');
}
export const tierLabel = (p: PublicProfile) => `${TIER[p.league].icon} ${TIER[p.league].name}`;

/** "son görülme" metni */
export function lastSeenText(p: PublicProfile, online: boolean): string {
  if (online) return 'çevrimiçi';
  const d = Date.now() - p.lastSeen;
  if (d < 60_000) return 'az önce buradaydı';
  if (d < 3_600_000) return `${Math.round(d / 60_000)} dk önce buradaydı`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} sa önce buradaydı`;
  return `${Math.max(1, Math.round(d / 86_400_000))} gün önce buradaydı`;
}

/** Odi çıkartması: gönderenin Odi'si + ifade */
export function Sticker({ id, color, hat, size = 108 }: { id: string; color: number; hat: string; size?: number }) {
  const s = DM_STICKERS.find((x) => x.id === id) ?? DM_STICKERS[0]!;
  return (
    <span className="fr-sticker" role="img" aria-label={`Çıkartma: ${s.label}`} style={{ width: size, height: size }}>
      <OdiAvatar size={Math.round(size * 0.82)} color={color} hat={hatKey(hat)} mood={s.mood} />
      <i className="fr-sticker-emo" aria-hidden style={{ fontSize: Math.round(size * 0.3) }}>{s.emoji}</i>
      {size >= 80 && <b className="fr-sticker-cap">{s.label}</b>}
    </span>
  );
}

// ------------------------------------------------------------------ ortak eylemler
export async function giftFriend(p: PublicProfile): Promise<boolean> {
  const r = await act('friends.gift', { id: p.id });
  if (!r) return false;
  useFriends.setState((s) => ({ gifted: [...s.gifted, p.id] }));
  platform().haptic('success');
  toast('🎁', `${p.name} için hediye yolda!`, `Ona 10 jeton gitti, sana da +${r.thanks} jeton iyilik. Bugün ${r.left} hediye hakkın kaldı.`, 'gold');
  return true;
}

export async function requestFriend(p: PublicProfile): Promise<'istek' | 'arkadas' | null> {
  const r = await act('friends.request', { id: p.id });
  if (!r) return null;
  platform().haptic('success');
  if (r.status === 'arkadas') {
    useFriends.setState((s) => ({ friends: [...(s.friends ?? []).filter((f) => f.id !== p.id), r.friend], incoming: s.incoming.filter((q) => q.from.id !== p.id) }));
    toast('🫂', `${p.name} artık arkadaşın`, 'Mesajlaşabilir, yarışabilir, hediye gönderebilirsiniz.', 'green');
  } else {
    if (r.request) { const req = r.request; useFriends.setState((s) => ({ outgoing: [req, ...s.outgoing.filter((q) => q.id !== req.id)] })); }
    toast('📨', 'İstek gönderildi', `${p.name} kabul edince arkadaş olacaksınız.`, 'accent');
  }
  return r.status;
}

/** yarışa çağır: oda kur → sohbete davet kartı → (çevrimiçiyse) anlık davet → lobiye geç */
export async function raceWith(p: PublicProfile, nav: Nav): Promise<void> {
  const c = friendsNet(); if (!c) return;
  const r = await act('race.create', {});
  if (!r) return;
  try { await sendDm(p.id, 'Yarışalım mı? Aynı bölümde, aynı anda! 🏁', 'davet', { type: 'yaris', roomId: r.room.id, level: r.room.level }); } catch { /* sohbet kapalıysa yalnız anlık davet */ }
  try { await c.call('race.invite', { friendId: p.id }); } catch { /* çevrimdışıysa davet kartı sohbette bekler */ }
  nav.open({ name: 'race', inviteRoomId: r.room.id });
}

/** davet kartına dokununca: türüne göre uygun ekrana */
export function openInvite(meta: Record<string, string | number | boolean> | undefined, nav: Nav): void {
  if (!meta) return;
  if (meta.type === 'yaris' && typeof meta.roomId === 'string') { nav.open({ name: 'race', inviteRoomId: meta.roomId }); return; }
  if (meta.type === 'ralli') { nav.open({ name: 'events', view: 'ralli' }); return; }
  // diğer takım etkinlikleri takım ekranında
  nav.tab('team');
}

export const DAY = 86_400_000;
export function dayLabel(t: number): string {
  const d = new Date(t); const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / DAY);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  if (diff < 7) return d.toLocaleDateString('tr-TR', { weekday: 'long' });
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
export function shortTime(t: number): string {
  const lbl = dayLabel(t);
  if (lbl === 'Bugün') return new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (lbl === 'Dün') return 'Dün';
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
