import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import type { ProfileCard as Card } from '@odi/shared';
import { act, errText, toast } from '../net';
import { useNav } from '../nav';
import { Sheet } from '../ui/social';
import { Av, giftFriend, inviteToTeam, lastSeenText, raceWith, requestFriend, tierLabel, useOnline } from './common';
import { closeProfile, friendsNet, refreshFriends, useFriends } from './state';
import { Art, rich } from '../ui/art';
import { Icon } from '../ui/icons';
import { featureOpen } from '../ftue/useFeatures';
import './friends.css';

/**
 * Profil kartı: herhangi bir ekrandan `openProfile(oyuncuId)` ile açılır (App bir kez <ProfileCardHost /> bağlar).
 * Avatar (Odi rengi + şapka), rozetler, aramızdaki durum ve eylemler: Arkadaş ekle / Mesaj / Takıma davet / Hediye / Yarış / Engelle / Şikâyet.
 */
export function ProfileCardHost() {
  const id = useFriends((s) => s.profileId);
  if (!id) return null;
  return <ProfileCardSheet key={id} id={id} onClose={closeProfile} />;
}

export function ProfileCardSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const nav = useNav();
  const [card, setCard] = useState<Card | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'main' | 'report' | 'block'>('main');
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState(false);
  const myTeam = useNet((s) => s.team);
  const gifted = useFriends((s) => s.gifted.includes(id));
  const online = useOnline(card?.profile);
  const load = () => { const c = friendsNet(); if (!c) return; c.call('profile.card', { id }).then((r) => setCard(r.card), (e) => setErr(errText(e))); };
  useEffect(load, [id]);

  const run = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); } finally { setBusy(false); load(); } };
  const go = (f: () => void) => { onClose(); f(); };

  if (!card) {
    return (
      <Sheet onClose={onClose}>
        {err ? <div className="chat-err" role="alert">{err}</div> : <div className="fr-card-skel" aria-busy="true" aria-label="Profil yükleniyor"><i /><b /><b /></div>}
      </Sheet>
    );
  }
  const p = card.profile; const rel = card.relation;
  return (
    <Sheet onClose={onClose}>
      <div className="fr-card" data-testid="profil-karti">
        <div className="fr-card-hero">
          <Av p={p} size={96} />
          <div className="min0">
            <h2 className="ellipsis">{p.name}</h2>
            <div className={`fr-seen${online ? ' on' : ''}`}>{lastSeenText(p, online)}</div>
            <div className="fr-rel-tag">{rich(rel === 'arkadas' ? '🫂 Arkadaşın' : rel === 'istek-giden' ? '⏳ İstek gönderildi' : rel === 'istek-gelen' ? '👋 Sana istek gönderdi' : rel === 'engelledin' ? '🚫 Engelledin' : card.sameTeam ? '🤝 Takım arkadaşın' : rel === 'ben' ? 'Bu sensin' : '')}</div>
          </div>
        </div>
        <div className="fr-badges">
          <span className="fr-badge"><b><Art e="⭐" size="1.15em" className="art-inline" /> {p.stars}</b><small>yıldız</small></span>
          <span className="fr-badge"><b><Art e="🗺️" size="1.15em" className="art-inline" /> {p.highest}</b><small>en yüksek bölüm</small></span>
          <span className="fr-badge"><b>{rich(tierLabel(p))}</b><small>lig</small></span>
          <span className="fr-badge"><b>Sv {p.level}</b><small>seviye</small></span>
          {p.teamName && <span className="fr-badge wide"><b><span data-ugc>{p.teamEmblem}</span> {p.teamName}</b><small>takım</small></span>}
          <span className="fr-badge"><b><Art e="🫂" size="1.15em" className="art-inline" /> {card.friendCount}</b><small>{card.mutualFriends ? `${card.mutualFriends} ortak` : 'arkadaş'}</small></span>
        </div>

        {mode === 'main' && rel !== 'ben' && (
          <div className="fr-card-actions">
            {rel === 'yok' && <button className="btn" disabled={busy} onClick={() => void run(() => requestFriend(p))}><Art e="➕" size="1.15em" className="art-inline" /> Arkadaş ekle</button>}
            {rel === 'istek-giden' && <button className="btn ghost" disabled={busy} onClick={() => void run(async () => { if (card.requestId && await act('friends.cancel', { requestId: card.requestId })) { useFriends.setState((s) => ({ outgoing: s.outgoing.filter((r) => r.id !== card.requestId) })); toast('↩️', 'İstek geri çekildi'); } })}>↩️ İsteği geri çek</button>}
            {rel === 'istek-gelen' && (
              <div className="row">
                <button className="btn grow" disabled={busy} onClick={() => void run(async () => { if (card.requestId && await act('friends.respond', { requestId: card.requestId, accept: true })) { toast('🫂', `${p.name} artık arkadaşın`, undefined, 'green'); void refreshFriends(); } })}><Icon name="check" size="1.1em" className="ic-inline" /> Kabul et</button>
                <button className="btn ghost grow" disabled={busy} onClick={() => void run(async () => { if (card.requestId && await act('friends.respond', { requestId: card.requestId, accept: false })) void refreshFriends(); })}>Reddet</button>
              </div>
            )}
            {card.canMessage && <button className="btn teal" onClick={() => go(() => nav.open({ name: 'dm', id: p.id }))}><Art e="💬" size="1.15em" className="art-inline" /> Mesaj gönder</button>}
            {(rel === 'arkadas' || card.sameTeam) && featureOpen('camp') && <button className="btn ghost" data-testid="kampini-gez" onClick={() => go(() => nav.open({ name: 'kamp', id: p.id }))}><Art name="tent" size={20} className="art-inline" /> Kampını gez</button>}
            {card.canMessage && myTeam && !card.sameTeam && !p.teamName && <button className="btn ghost" data-testid="takima-davet" disabled={busy || invited} onClick={() => void run(async () => { if (await inviteToTeam(p)) setInvited(true); })}><Art name="users" size={20} className="art-inline" /> {invited ? 'Davet gönderildi' : <>Takıma davet et (<span data-ugc>{myTeam.emblem}</span> {myTeam.name})</>}</button>}
            {rel === 'arkadas' && (
              <div className="row">
                <button className="btn ghost grow" disabled={busy || gifted || card.giftedToday} onClick={() => void run(() => giftFriend(p))}>{rich(gifted || card.giftedToday ? '🎁 Bugün gönderildi' : '🎁 Hediye')}</button>
                {featureOpen('race') && <button className="btn coral grow" onClick={() => go(() => void raceWith(p, nav))}><Art e="🏁" size="1.15em" className="art-inline" /> Yarış</button>}
              </div>
            )}
            {rel === 'engelledin'
              ? <button className="btn ghost" disabled={busy} onClick={() => void run(async () => { if (await act('players.unblock', { id: p.id })) toast('✅', `${p.name} engeli kaldırıldı`); })}>Engeli kaldır</button>
              : <div className="fr-card-quiet">
                  <button className="linkish" onClick={() => setMode('block')}><Art e="🚫" size="1.15em" className="art-inline" /> Engelle</button>
                  <button className="linkish" onClick={() => setMode('report')}><Art e="🚩" size="1.15em" className="art-inline" /> Şikâyet et</button>
                  {rel === 'arkadas' && <button className="linkish" onClick={() => void run(async () => { if (await act('friends.remove', { id: p.id })) { useFriends.setState((s) => ({ friends: s.friends?.filter((f) => f.id !== p.id) ?? null })); toast('👋', `${p.name} listeden çıkarıldı`); } })}>Arkadaşlıktan çıkar</button>}
                </div>}
          </div>
        )}
        {mode === 'block' && (
          <div className="fr-card-actions">
            <div className="muted">{p.name} sana mesaj, arkadaşlık isteği, yarış daveti ve hediye gönderemeyecek; arkadaşsanız listeden çıkacak. Bunu ona söylemeyiz.</div>
            <button className="btn coral" disabled={busy} onClick={() => void run(async () => { if (await act('players.block', { id: p.id })) { useFriends.setState((s) => ({ friends: s.friends?.filter((f) => f.id !== p.id) ?? null, threads: s.threads?.filter((t) => t.other.id !== p.id) ?? null })); toast('🚫', `${p.name} engellendi`, 'İstediğin zaman Arkadaşlar → Engellenenler’den kaldırabilirsin.'); setMode('main'); } })}><Art e="🚫" size="1.15em" className="art-inline" /> Engelle</button>
            <button className="btn ghost" onClick={() => setMode('main')}>Vazgeç</button>
          </div>
        )}
        {mode === 'report' && (
          <div className="fr-card-actions">
            <div className="muted">Neden şikâyet ediyorsun? Şikâyetler gizlidir; birkaç farklı kişi şikâyet ederse oyuncu bir süre susturulur.</div>
            {([['isim', '🏷️ Uygunsuz isim'], ['taciz', '🚫 Rahatsız ediyor'], ['diger', '❓ Başka bir şey']] as const).map(([reason, label]) => (
              <button key={reason} className="btn ghost" disabled={busy} onClick={() => void run(async () => { if (await act('players.report', { id: p.id, reason })) { toast('🙏', 'Teşekkürler', 'Şikâyetin alındı. İstersen onu engelleyebilirsin.', 'green'); setMode('main'); } })}>{rich(label)}</button>
            ))}
            <button className="btn ghost" onClick={() => setMode('main')}>Vazgeç</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
