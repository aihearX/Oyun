import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { act, getNet, toast } from '../../net';
import { platform } from '../../platform';
import { ChatRoom } from '../../ui/Chat';
import { Sheet, SubTabs, fmtNum } from '../../ui/social';
import { RankView } from '../../rank/RankScreen';
import { TeamLeagueView, TeamRaceView, useTeamRace } from '../../teamrace';
import { Bar } from '../../ui/bits';
import { ActionButton, IconButton } from '../../ui/Button';
import { featureOpen } from '../../ftue/useFeatures';
import { TeamMembers } from './TeamMembers';
import { TeamHelp } from './TeamHelp';
import { TeamTech, TeamGifts, TeamGoals } from './TeamExtra';
import { TeamWar } from './TeamWar';
import { TeamRaid } from './TeamRaid';
import { TeamEvents } from './TeamEvents';
import { pendingCount, useEvents } from '../../events';
import { Art } from '../../ui/art';
import { mentionCount, useComm } from '../../comm/state';

export type TeamTab = 'sohbet' | 'uyeler' | 'yardim' | 'tekno' | 'hediye' | 'hedef' | 'savas' | 'baskin' | 'etkinlik' | 'siralama' | 'tyaris' | 'lig';
let lastTab: TeamTab = 'sohbet';

/** Takım ana ekranı: başlık (amblem, seviye, üye, güç) + 8 alt sekme. */
export function TeamHome() {
  const team = useNet((s) => s.team)!; const extra = useNet((s) => s.extra); const me = useNet((s) => s.me)!;
  const unread = useNet((s) => s.unread[`takim:${s.team?.id}`] ?? 0); const gifts = useNet((s) => s.giftCount); const campHelp = useNet((s) => s.campHelp);
  const [tab, setTabState] = useState<TeamTab>(lastTab);
  const evBadge = useEvents((s) => pendingCount(s, me.id));
  const mentions = useComm((s) => mentionCount(s, `takim:${team.id}`)); const study = useComm((s) => s.dq?.study ?? false);
  const setTab = (t: TeamTab) => { lastTab = t; setTabState(t); platform().haptic('light'); };
  const [menu, setMenu] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const myRole = team.roster.find((m) => m.id === me.id)?.role ?? 'uye';
  const levelHelp = team.help.filter((h) => h.from !== me.id && !h.helpers.includes(me.id) && h.helpers.length < h.max && h.expiresAt > Date.now()).length;
  // Takım Yarışı rozeti: açık lobi (ben içinde değilsem) ya da gelen dostluk daveti
  const raceBadge = useTeamRace((x) => { const l = x.state?.lobby; const me = useNet.getState().me?.id; return (l && l.status !== 'eslesti' && !l.members.some((m) => m.id === me) ? 1 : 0) + (l?.incoming.length ?? 0); });
  const claimableGoals = extra ? extra.goals.reduce((a, g) => a + g.tiers.filter((t, i) => g.progress >= t.need && !g.claimedTiers.includes(i)).length, 0) : 0;

  useEffect(() => {
    const c = getNet(); if (!c) return;
    void c.call('team.extra', {}).then((r) => useNet.setState({ extra: r.extra, giftCount: r.extra.gifts.filter((g) => !g.claimed && g.expiresAt > Date.now()).length })).catch(() => undefined);
    void c.call('camp.state', {}).then((r) => useNet.setState({ camp: r.camp })).catch(() => undefined);
  }, [team.id]);

  const share = async () => {
    const r = await platform().share(`ODİ'de ${team.emblem} ${team.name} takımına gel! Takım sekmesinde “Kodla katıl”: ${team.code}`);
    if (r === 'copied') toast('📋', 'Davet kodu kopyalandı', team.code);
    setMenu(false);
  };
  const leave = async () => {
    setConfirmLeave(false);
    const r = await act('team.leave', {});
    if (r) { useNet.setState({ team: null, extra: null, giftCount: 0, campHelp: [], war: null, raid: null }); toast('👋', 'Takımdan ayrıldın', 'Yeni bir takım seni bekliyor.'); }
  };

  const xpFrom = extra ? prevThreshold(extra.level) : 0;
  return (
    <>
      <div className="card team-head">
        <span className="th-emblem" aria-hidden>{team.emblem}</span>
        <div className="grow min0">
          <div className="row between"><h2 className="ellipsis">{team.name}</h2><IconButton icon="dots" label="Takım menüsü" onClick={() => setMenu(true)} /></div>
          <div className="th-meta"><span>Sv {extra?.level ?? '…'}</span><span><Art e="👥" size="1.15em" className="art-inline" /> {team.members}/{team.max}</span><span title="Üyelerin toplam yıldızı"><Art e="⭐" size="1.15em" className="art-inline" /> {fmtNum(team.power)}</span></div>
          {extra && <div className="row th-xp"><Bar value={(extra.xp - xpFrom) / Math.max(1, extra.xpNext - xpFrom)} tone="green" label="Takım XP" /><span className="qn">{fmtNum(extra.xp)}/{fmtNum(extra.xpNext)}</span></div>}
        </div>
      </div>
      <SubTabs<TeamTab> active={tab} onChange={setTab} tabs={[
        { id: 'sohbet', icon: '💬', label: 'Sohbet', badge: tab === 'sohbet' ? 0 : unread + mentions },
        ...(featureOpen('events') ? [{ id: 'etkinlik' as const, icon: '🎪', label: 'Etkinlikler', badge: evBadge }] : []),
        { id: 'uyeler', icon: '👥', label: 'Üyeler' },
        { id: 'yardim', icon: '🤝', label: 'Yardım', badge: campHelp.length + levelHelp },
        { id: 'tekno', icon: '🔬', label: 'Teknoloji' },
        { id: 'hediye', icon: '🎁', label: 'Hediyeler', badge: gifts },
        { id: 'hedef', icon: '🎯', label: 'Hedefler', badge: claimableGoals },
        { id: 'savas', icon: '⚔️', label: 'Savaş' },
        { id: 'baskin', icon: '👹', label: 'Baskın' },
        ...(featureOpen('tyaris') ? [{ id: 'tyaris' as const, icon: '🏁', label: 'Takım Yarışı', badge: raceBadge }] : []),
        ...(featureOpen('tlig') ? [{ id: 'lig' as const, icon: '🛡️', label: 'Lig' }] : []),
        ...(featureOpen('siralama') ? [{ id: 'siralama' as const, icon: '🏆', label: 'Sıralama' }] : []),
      ]} />
      <div className="team-body" key={tab}>
        {tab === 'sohbet' && <ChatRoom room={`takim:${team.id}`} offset={420} placeholder={`${team.name} takımına yaz…`} emptyText="Takımına bir merhaba de; hedefleri birlikte konuşun." members={team.roster} />}
        {tab === 'uyeler' && <TeamMembers />}
        {tab === 'yardim' && <TeamHelp />}
        {tab === 'tekno' && <TeamTech />}
        {tab === 'hediye' && <TeamGifts />}
        {tab === 'hedef' && <TeamGoals />}
        {tab === 'savas' && <TeamWar />}
        {tab === 'baskin' && <TeamRaid />}
        {tab === 'etkinlik' && <TeamEvents />}
        {tab === 'siralama' && <RankView team />}
        {tab === 'tyaris' && <TeamRaceView />}
        {tab === 'lig' && <TeamLeagueView />}
      </div>
      {menu && (
        <Sheet title={team.name} onClose={() => setMenu(false)}>
          {team.description && <div className="muted wrap">{team.description}</div>}
          <div className="card code-card"><span className="muted">Davet kodu</span><b className="big-code">{team.code}</b><span className="muted small-note">{team.open ? 'Herkese açık takım' : 'Yalnızca kodla katılım'}{team.minLevel > 1 ? ` · en az ${team.minLevel}. bölüm` : ''}</span></div>
          <ActionButton block icon="megaphone" onClick={() => void share()}>Davet kodunu paylaş</ActionButton>
          {myRole !== 'uye' && featureOpen('soru') && <div className="tg-toggle"><span className="grow"><b>Çalışma Grubu</b><small>Günün Sorusu odyoloji öğrencisi düzeyinden gelir (bir sonraki sorudan itibaren).</small></span><button type="button" className="switch" role="switch" data-testid="calisma-grubu" aria-checked={study} aria-label="Çalışma Grubu" onClick={async () => { const r = await act('team.study', { on: !study }); if (r) useComm.setState((s) => (s.dq ? { dq: { ...s.dq, study: r.study } } : {})); }} /></div>}
          <ActionButton block tone="coral" onClick={() => { setMenu(false); setConfirmLeave(true); }}>Takımdan ayrıl</ActionButton>
        </Sheet>
      )}
      {confirmLeave && (
        <Sheet title="Takımdan ayrılıyor musun?" onClose={() => setConfirmLeave(false)}>
          <div className="muted">{myRole === 'lider' ? 'Liderlik en kıdemli yardımcıya (yoksa en kıdemli üyeye) geçer.' : 'İstediğin zaman yeniden katılabilirsin.'} Bu haftaki katkıların takımda kalır.</div>
          <ActionButton block tone="coral" onClick={() => void leave()}>Evet, ayrıl</ActionButton>
          <ActionButton block tone="plain" onClick={() => setConfirmLeave(false)}>Vazgeç</ActionButton>
        </Sheet>
      )}
    </>
  );
}

/** takım seviye eşiği (sunucudaki formülün aynısı: 300 × (l−1)^1,6) */
function prevThreshold(level: number): number { return Math.round(300 * Math.pow(Math.max(0, level - 1), 1.6)); }
