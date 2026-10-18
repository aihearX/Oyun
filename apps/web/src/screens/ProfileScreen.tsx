import { useState } from 'react';
import { ACHIEVEMENTS, CARDS, COSMETICS } from '@odi/content';
import { albumProgress, levelProgress, resolveLook } from '@odi/meta';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS } from '@odi/shared';
import { useStore } from '../store';
import { errText, getNet, toast, usePending } from '../net';
import { useNav } from '../nav';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Bar } from '../ui/bits';
import { Sheet, TopBar, fmtNum } from '../ui/social';
import { LeagueCard } from './InboxScreen';

export type ProfileLink = 'achievements' | 'album' | 'wardrobe' | 'skills' | 'settings' | 'info' | 'friends' | 'shop' | 'inbox' | 'league';
/** Profil: Odi, seviye, istatistikler, lig, sosyal (arkadaşlar, mağaza, ödül kutusu, sohbet) ve yatırım hatları. */
export function ProfileScreen({ onOpen }: { onOpen: (l: ProfileLink) => void }) {
  const s = useStore(); const lp = levelProgress(s.xp); const look = resolveLook(s.meta);
  const me = useNet((x) => x.me); const st = useNet((x) => x.status); const inbox = useNet((x) => x.inboxCount); const wallet = useNet((x) => x.wallet);
  const pending = usePending(); const nav = useNav();
  const [rename, setRename] = useState(false);
  const stars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
  const tiers = Object.values(s.meta.achievements).reduce((a, t) => a + t, 0); const maxTiers = ACHIEVEMENTS.reduce((a, x) => a + x.tiers.length, 0);
  const album = albumProgress(s.meta.cards);
  const stat = (v: string | number, k: string) => <div className="pstat"><b>{v}</b><span>{k}</span></div>;
  const online = st === 'bağlı' && !!me;
  return (
    <div className="screen fade-in with-tabs">
      <TopBar title="Profil" />
      <div className="card profile-hero">
        <button className="avatar-btn" onClick={() => onOpen('wardrobe')} aria-label="Dolabı aç"><OdiAvatar size={88} color={look.color} hat={look.hat} /></button>
        <div className="grow min0">
          <h2 className="row name-row"><span className="ellipsis">{me ? me.name : 'Odi'} · Sv {lp.level}</span>{online && <button className="btn ghost small icon-btn" onClick={() => setRename(true)} aria-label="Takma adı değiştir">✏️</button>}</h2>
          <Bar value={lp.pct} label="Seviye ilerlemesi" />
          <div className="muted small-note">{s.xp - lp.from}/{lp.to - lp.from} XP · sonraki seviyeye {lp.to - s.xp} XP</div>
          {me && <div className="muted small-note">Arkadaş kodun: <b className="mono">{me.friendCode}</b>{me.teamName ? ` · ${me.teamEmblem} ${me.teamName}` : ''}</div>}
        </div>
      </div>
      <div className="pstats">
        {stat(stars, 'yıldız')}{stat(s.meta.stats.clears, 'bölüm')}{stat(fmtNum(s.coins), pending > 0 && st !== 'bağlı' ? `jeton · ${pending} bekleyen` : 'jeton')}{stat(`${Math.max(s.streak, 0)} 🔥`, 'gün serisi')}{stat(wallet ? `💎 ${fmtNum(wallet.kristal)}` : `×${s.meta.stats.maxCombo}`, wallet ? 'kristal' : 'jeton serisi rekoru')}{stat(`🛡️ ${s.meta.shields}${s.teamShields ? ` +${s.teamShields}` : ''}`, s.teamShields ? 'koruyucu + kalkan' : 'koruyucu')}
      </div>
      {online && <LeagueCard onOpen={() => onOpen('league')} />}
      <div className="menu-grid">
        <button className="menu-tile" onClick={() => onOpen('friends')}><span className="mi">🫂</span><b>Arkadaşlar</b><span className="muted">Kod, sohbet, yarış</span></button>
        <button className="menu-tile" onClick={() => onOpen('inbox')}><span className="mi rel">✉️{inbox > 0 && <span className="sbadge abs">{inbox}</span>}</span><b>Ödül kutusu</b><span className="muted">{inbox ? `${inbox} ödül seni bekliyor` : 'Savaş ve takım ödülleri'}</span></button>
        <button className="menu-tile" onClick={() => onOpen('shop')}><span className="mi">💎</span><b>Mağaza</b><span className="muted">İçerikler açık, sınır sende</span></button>
        <button className="menu-tile" onClick={() => nav.open({ name: 'chat', room: 'genel', title: 'Genel sohbet' })}><span className="mi">🌍</span><b>Genel sohbet</b><span className="muted">Herkesle konuş</span></button>
        <button className="menu-tile" onClick={() => onOpen('achievements')}><span className="mi">🏆</span><b>Başarımlar</b><span className="muted">{tiers}/{maxTiers} kademe</span><Bar value={tiers / maxTiers} tone="amber" label="Başarımlar" /></button>
        <button className="menu-tile" onClick={() => onOpen('album')}><span className="mi">🃏</span><b>Kulak Kartları</b><span className="muted">{album.owned}/{CARDS.length} · %{album.pct}</span><Bar value={album.pct / 100} tone="green" label="Albüm" /></button>
        <button className="menu-tile" onClick={() => onOpen('wardrobe')}><span className="mi">🎩</span><b>Dolap</b><span className="muted">{s.meta.cosmetics.owned.length}/{COSMETICS.length} parça</span><Bar value={s.meta.cosmetics.owned.length / COSMETICS.length} tone="coral" label="Dolap" /></button>
        <button className="menu-tile" onClick={() => onOpen('skills')}><span className="mi">🧠</span><b>Yetenekler</b><span className="muted">Jetonla kalıcı güç</span></button>
        <button className="menu-tile" onClick={() => onOpen('settings')}><span className="mi">⚙️</span><b>Ayarlar</b><span className="muted">Ses, kayıt</span></button>
        <button className="menu-tile" onClick={() => onOpen('info')}><span className="mi">ⓘ</span><b>Nasıl çalışır?</b><span className="muted">Ödüller, ihtimaller</span></button>
      </div>
      {rename && me && <Rename current={me.name} onClose={() => setRename(false)} />}
    </div>
  );
}

function Rename({ current, onClose }: { current: string; onClose: () => void }) {
  const [name, setName] = useState(current); const [err, setErr] = useState('');
  const save = async () => { const c = getNet(); if (!c) return; try { await c.call('profile.update', { name: name.trim() }); toast('✏️', 'Takma adın güncellendi', name.trim()); onClose(); } catch (e) { setErr(errText(e)); } };
  return (
    <Sheet title="Takma ad" onClose={onClose}>
      <input className="input" value={name} maxLength={SOCIAL_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} aria-label="Takma ad" autoFocus />
      {err && <div className="chat-err" role="alert">{err}</div>}
      <button className="btn" disabled={name.trim().length < SOCIAL_LIMITS.nameMin || name.trim() === current} onClick={() => void save()}>Kaydet</button>
    </Sheet>
  );
}
