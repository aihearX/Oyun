/** Davet linki: yalnızca bölüm numarası ve gönderenin skoru taşınır. Kimlik, takip ya da sahte iddia yok. */
export interface Invite { level: number; score: number; stars: number }

export function readInvite(search = location.search): Invite | null {
  const q = new URLSearchParams(search);
  const level = Number(q.get('b')); const score = Number(q.get('s') ?? 0); const stars = Number(q.get('y') ?? 0);
  if (!Number.isInteger(level) || level < 1 || level > 40) return null;
  return { level, score: Number.isFinite(score) && score >= 0 ? Math.round(score) : 0, stars: Math.max(0, Math.min(3, Math.round(stars) || 0)) };
}

export function inviteUrl(i: Invite): string {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('b', String(i.level)); u.searchParams.set('s', String(i.score)); u.searchParams.set('y', String(i.stars));
  return u.toString();
}
