import { ACHIEVEMENTS, CARDS, COSMETICS } from '@odi/content';
import { albumProgress, levelProgress, resolveLook } from '@odi/meta';
import { useStore } from '../store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Bar } from '../ui/bits';

export type ProfileLink = 'achievements' | 'album' | 'wardrobe' | 'skills' | 'settings' | 'info';
/** Profil: Odi, seviye, istatistikler ve yatırım hatları (başarımlar, albüm, dolap, yetenekler). */
export function ProfileScreen({ onOpen }: { onOpen: (l: ProfileLink) => void }) {
  const s = useStore(); const lp = levelProgress(s.xp); const look = resolveLook(s.meta);
  const stars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
  const tiers = Object.values(s.meta.achievements).reduce((a, t) => a + t, 0); const maxTiers = ACHIEVEMENTS.reduce((a, x) => a + x.tiers.length, 0);
  const album = albumProgress(s.meta.cards);
  const stat = (v: string | number, k: string) => <div className="pstat"><b>{v}</b><span>{k}</span></div>;
  return (
    <div className="screen fade-in with-tabs">
      <div className="screen-head"><span /><h1>Profil</h1><button className="btn ghost small" onClick={() => onOpen('settings')} aria-label="Ayarlar">⚙️</button></div>
      <div className="card profile-hero">
        <button className="avatar-btn" onClick={() => onOpen('wardrobe')} aria-label="Dolabı aç"><OdiAvatar size={88} color={look.color} hat={look.hat} /></button>
        <div className="grow min0">
          <h2>Odi · Seviye {lp.level}</h2>
          <Bar value={lp.pct} label="Seviye ilerlemesi" />
          <div className="muted small-note">{s.xp - lp.from}/{lp.to - lp.from} XP · sonraki seviyeye {lp.to - s.xp} XP</div>
        </div>
      </div>
      <div className="pstats">
        {stat(stars, 'yıldız')}{stat(s.meta.stats.clears, 'bölüm')}{stat(s.coins, 'jeton')}{stat(`${Math.max(s.streak, 0)} 🔥`, 'gün serisi')}{stat(`×${s.meta.stats.maxCombo}`, 'jeton serisi rekoru')}{stat(`🛡️ ${s.meta.shields}`, 'koruyucu')}
      </div>
      <div className="menu-grid">
        <button className="menu-tile" onClick={() => onOpen('achievements')}><span className="mi">🏆</span><b>Başarımlar</b><span className="muted">{tiers}/{maxTiers} kademe</span><Bar value={tiers / maxTiers} tone="amber" label="Başarımlar" /></button>
        <button className="menu-tile" onClick={() => onOpen('album')}><span className="mi">🃏</span><b>Kulak Kartları</b><span className="muted">{album.owned}/{CARDS.length} · %{album.pct}</span><Bar value={album.pct / 100} tone="green" label="Albüm" /></button>
        <button className="menu-tile" onClick={() => onOpen('wardrobe')}><span className="mi">🎩</span><b>Dolap</b><span className="muted">{s.meta.cosmetics.owned.length}/{COSMETICS.length} parça</span><Bar value={s.meta.cosmetics.owned.length / COSMETICS.length} tone="coral" label="Dolap" /></button>
        <button className="menu-tile" onClick={() => onOpen('skills')}><span className="mi">🧠</span><b>Yetenekler</b><span className="muted">Jetonla kalıcı güç</span></button>
      </div>
      <button className="linkish" onClick={() => onOpen('info')}>Ödüller nasıl çalışır? →</button>
    </div>
  );
}
