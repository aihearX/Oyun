import { useMemo, useState } from 'react';
import { ACHIEVEMENTS, CARDS, COSMETICS } from '@odi/content';
import { albumProgress, levelProgress } from '@odi/meta';
import { odiLook } from '../look';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS } from '@odi/shared';
import { useStore } from '../store';
import { errText, getNet, toast, usePending } from '../net';
import { useNav } from '../nav';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Bar } from '../ui/bits';
import { Icon } from '../ui/icons';
import { IconButton } from '../ui/Button';
import { Sheet, TopBar, fmtNum } from '../ui/social';
import { LeagueCard } from './InboxScreen';
import { useFriends } from '../friends';
import { Art, type ArtName } from '../ui/art';
import { useFeatures } from '../ftue/useFeatures';
import { clearedCount, type FeatureId } from '../ftue/features';
import { GLOSSARY } from '@odi/content/odyoloji';
import { CodeSheet } from '../codes/Codes';
import { reachedRegions } from './GlossaryScreen';
import { Cerceve, RozetCipleri } from '../kurucu/rozet';

export type ProfileLink = 'achievements' | 'album' | 'glossary' | 'wardrobe' | 'skills' | 'settings' | 'info' | 'friends' | 'shop' | 'inbox' | 'league';
/** Profil: Odi, seviye, istatistikler, lig, sosyal (arkadaşlar, mağaza, ödül kutusu, sohbet) ve yatırım hatları. */
export function ProfileScreen({ onOpen }: { onOpen: (l: ProfileLink) => void }) {
  const s = useStore(); const lp = levelProgress(s.xp); const look = odiLook(s);
  const me = useNet((x) => x.me); const st = useNet((x) => x.status); const inbox = useNet((x) => x.inboxCount); const wallet = useNet((x) => x.wallet);
  const pending = usePending(); const nav = useNav();
  const dms = useFriends((x) => x.dmUnread); const reqs = useFriends((x) => x.incoming.length);
  const [rename, setRename] = useState(false); const [codeSheet, setCodeSheet] = useState(false);
  const stars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
  const tiers = Object.values(s.meta.achievements).reduce((a, t) => a + t, 0); const maxTiers = ACHIEVEMENTS.reduce((a, x) => a + x.tiers.length, 0);
  const album = albumProgress(s.meta.cards);
  const glossOpen = useMemo(() => { const r = reachedRegions(clearedCount(s.progress)); return GLOSSARY.filter((g) => r.has(g.region)).length; }, [s.progress]);
  const stat = (art: ArtName, v: string | number, k: string) => <div className="pstat"><Art name={art} size={26} className="ps-art" /><b>{v}</b><span>{k}</span></div>;
  const online = st === 'bağlı' && !!me;
  // ilk deneyim: henüz açılmamış yerler kilitli karo ("Bölüm N'de açılır"), dokununca kısa not
  const feat = useFeatures(); const [note, setNote] = useState<string | null>(null);
  const tileCls = (f: FeatureId) => `menu-tile${feat.open(f) ? '' : ' locked'}`;
  const guard = (f: FeatureId, fn: () => void) => () => { if (feat.open(f)) fn(); else { setNote(feat.lock(f)); setTimeout(() => setNote(null), 1800); } };
  const lockNote = (f: FeatureId) => (feat.open(f) ? null : <span className="lock-note"><Art name="lock" size={14} /> {feat.lock(f)}</span>);
  return (
    <div className="screen fade-in with-tabs">
      <TopBar title="Profil" />
      <div className="card profile-hero">
        <button className="avatar-btn" onClick={guard('shop', () => onOpen('wardrobe'))} aria-label="Dolabı aç"><Cerceve p={me} size={88}><OdiAvatar size={88} color={look.color} hat={look.hat} /></Cerceve><span className="sr-only" data-testid="profil-odi-renk" data-color={look.color.toString(16).padStart(6, '0')} /></button>
        <div className="grow min0">
          <h2 className="row name-row"><span className="ellipsis">{me ? me.name : 'Odi'} · Sv {lp.level}</span>{online && <IconButton icon="pencil" label="Takma adı değiştir" tone="gold" small onClick={() => setRename(true)} />}</h2>
          <RozetCipleri p={me} />
          <Bar value={lp.pct} label="Seviye ilerlemesi" />
          <div className="muted small-note">{s.xp - lp.from}/{lp.to - lp.from} XP · sonraki seviyeye {lp.to - s.xp} XP</div>
          {me && <div className="muted small-note">Arkadaş kodun: <b className="mono">{me.friendCode}</b>{me.teamName ? <> · <span data-ugc>{me.teamEmblem}</span> {me.teamName}</> : ''}</div>}
        </div>
      </div>
      <div className="pstats">
        {stat('star', stars, 'yıldız')}{stat('flag', s.meta.stats.clears, 'bölüm')}{stat('coin', fmtNum(s.coins), pending > 0 && st !== 'bağlı' ? `jeton · ${pending} bekleyen` : 'jeton')}{stat('flame', Math.max(s.streak, 0), 'gün serisi')}{wallet ? stat('crystal', fmtNum(wallet.kristal), 'kristal') : stat('bolt', `×${s.meta.stats.maxCombo}`, 'jeton serisi rekoru')}{stat('shield', `${s.meta.shields}${s.teamShields ? ` +${s.teamShields}` : ''}`, s.teamShields ? 'koruyucu + kalkan' : 'koruyucu')}
      </div>
      {online && feat.open('league') && <LeagueCard onOpen={() => onOpen('league')} />}
      <div className="menu-grid">
        <button className={tileCls('friends')} data-tile="friends" onClick={guard('friends', () => onOpen('friends'))}><span className="mi teal rel"><Icon name="friends" />{reqs > 0 && <span className="sbadge abs">{reqs}</span>}</span><b>Arkadaşlar</b>{lockNote('friends') ?? <span className="muted">{reqs ? `${reqs} arkadaşlık isteği` : 'Ara, ekle, hediye gönder'}</span>}</button>
        <button className={tileCls('friends')} data-tile="messages" onClick={guard('friends', () => nav.open({ name: 'messages' }))}><span className="mi teal rel"><Icon name="chat" />{dms > 0 && <span className="sbadge abs">{dms}</span>}</span><b>Mesajlar</b>{lockNote('friends') ?? <span className="muted">{dms ? `${dms} okunmamış mesaj` : 'Özel sohbetlerin'}</span>}</button>
        <button className={tileCls('shop')} data-tile="inbox" onClick={guard('shop', () => onOpen('inbox'))}><span className="mi gold rel"><Icon name="inbox" />{inbox > 0 && <span className="sbadge abs">{inbox}</span>}</span><b>Ödül kutusu</b>{lockNote('shop') ?? <span className="muted">{inbox ? `${inbox} ödül seni bekliyor` : 'Savaş ve takım ödülleri'}</span>}</button>
        <button className={tileCls('shop')} data-tile="shop" onClick={guard('shop', () => onOpen('shop'))}><span className="mi gold"><Icon name="gem" /></span><b>Mağaza</b>{lockNote('shop') ?? <span className="muted">İçerikler açık, sınır sende</span>}</button>
        <button className={tileCls('friends')} data-tile="together" onClick={guard('friends', () => nav.open({ name: 'birlikte' }))}><span className="mi gold"><Art name="users" size={26} /></span><b>Birlikte</b>{lockNote('friends') ?? <span className="muted">İkili Görev, Usta–Çırak</span>}</button>
        <button className={tileCls('siralama')} data-tile="ranking" onClick={guard('siralama', () => nav.open({ name: 'siralama' }))}><span className="mi gold"><Art name="trophy" size={26} /></span><b>Sıralama</b>{lockNote('siralama') ?? <span className="muted">En güçlü oyuncular ve takımlar</span>}</button>
        <button className="menu-tile" data-tile="kurucular" onClick={() => nav.open({ name: 'kurucular' })}><span className="mi gold"><Art name="founder" size={26} /></span><b>Kurucular</b><span className="muted">ODİ'yi birlikte kuranlar</span></button>
        <button className={tileCls('friends')} data-tile="chat" onClick={guard('friends', () => nav.open({ name: 'chat', room: 'genel', title: 'Genel sohbet' }))}><span className="mi teal"><Icon name="globe" /></span><b>Genel sohbet</b>{lockNote('friends') ?? <span className="muted">Herkesle konuş</span>}</button>
        <button className={tileCls('album')} data-tile="achievements" onClick={guard('album', () => onOpen('achievements'))}><span className="mi gold"><Icon name="trophy" /></span><b>Başarımlar</b>{lockNote('album') ?? <span className="muted">{tiers}/{maxTiers} kademe</span>}<Bar value={tiers / maxTiers} tone="amber" label="Başarımlar" /></button>
        <button className={tileCls('album')} data-tile="album" onClick={guard('album', () => onOpen('album'))}><span className="mi teal"><Icon name="cards" /></span><b>Kulak Kartları</b>{lockNote('album') ?? <span className="muted">{album.owned}/{CARDS.length} · %{album.pct}</span>}<Bar value={album.pct / 100} tone="green" label="Albüm" /></button>
        <button className={tileCls('glossary')} data-tile="glossary" onClick={guard('glossary', () => onOpen('glossary'))}><span className="mi teal"><Art name="bulb" size={26} /></span><b>Kulak Sözlüğü</b>{lockNote('glossary') ?? <span className="muted">{glossOpen}/{GLOSSARY.length} terim</span>}<Bar value={glossOpen / GLOSSARY.length} tone="accent" label="Sözlük" /></button>
        <button className={tileCls('shop')} data-tile="wardrobe" onClick={guard('shop', () => onOpen('wardrobe'))}><span className="mi coral"><Icon name="hat" /></span><b>Dolap</b>{lockNote('shop') ?? <span className="muted">{s.meta.cosmetics.owned.length}/{COSMETICS.length} parça</span>}<Bar value={s.meta.cosmetics.owned.length / COSMETICS.length} tone="coral" label="Dolap" /></button>
        <button className={tileCls('skills')} data-tile="skills" onClick={guard('skills', () => onOpen('skills'))}><span className="mi gold"><Icon name="bolt" /></span><b>Yetenekler</b>{lockNote('skills') ?? <span className="muted">Jetonla kalıcı güç</span>}</button>
        <button className="menu-tile" data-tile="settings" onClick={() => onOpen('settings')}><span className="mi plain"><Icon name="sliders" /></span><b>Ayarlar</b><span className="muted">Ses, kayıt</span></button>
        <button className="menu-tile" data-tile="info" onClick={() => onOpen('info')}><span className="mi plain"><Icon name="info" /></span><b>Nasıl çalışır?</b><span className="muted">Ödüller, ihtimaller</span></button>
        <button className="menu-tile" data-tile="kod" onClick={() => setCodeSheet(true)}><span className="mi gold"><Art name="key" size={26} /></span><b>Kod gir</b><span className="muted">Sürpriz ödül kodları</span></button>
      </div>
      {note && <div className="lock-toast" role="status"><Art name="lock" size={18} /> {note}</div>}
      {rename && me && <Rename current={me.name} onClose={() => setRename(false)} />}
      {codeSheet && <CodeSheet onClose={() => setCodeSheet(false)} />}
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
