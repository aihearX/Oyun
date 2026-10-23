import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { TEAM_REJECT_REASONS, type TeamApplication } from '@odi/shared';
import { act, toast } from '../../net';
import { platform } from '../../platform';
import { Empty, Sheet, Skeleton, fmtLeft, useNow } from '../../ui/social';
import { Art } from '../../ui/art';
import { Av } from '../../friends/common';
import { openProfile } from '../../friends/state';
import { noteText } from './TeamProfile';
import { refreshPending, useTeamApply } from './apply';

/** Takım › Başvurular (lider ve yardımcılar, TEAM_APPLY_RULES.approvers): bekleyen başvurular, kabul / hazır gerekçeyle ret. Dolu takımda kabul kapalı. */
export function TeamApplications() {
  const pending = useTeamApply((s) => s.pending);
  const team = useNet((s) => s.team)!;
  const now = useNow(60_000);
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState<TeamApplication | null>(null);
  useEffect(() => { void refreshPending(); }, []);
  const full = team.members >= team.max;
  const decide = async (a: TeamApplication, accept: boolean, reason?: string) => {
    setBusy(a.id); setRejecting(null);
    const r = await act('team.apply.decide', { applicationId: a.id, accept, ...(reason ? { reason } : {}) });
    setBusy('');
    if (!r) { void refreshPending(); return; }
    useTeamApply.setState({ pending: r.applications });
    useNet.setState({ team: r.team });
    platform().haptic(accept ? 'success' : 'light');
    if (accept) toast('🎉', `${a.player.name} takıma katıldı`, 'Takım Akışı’nda karşıla!', 'green');
    else toast('✉️', `${a.player.name} başvurusu kabul edilmedi`, 'Oyuncuya bildirildi.');
  };
  if (!pending) return <Skeleton rows={2} />;
  return (
    <div className="stack" data-testid="basvurular">
      <div className="row between"><span className="muted">{pending.length} bekleyen başvuru</span><span className="muted">{team.members}/{team.max} üye</span></div>
      {full && <div className="card ta-warn"><Art name="users" size={22} /> <span>Takım dolu. Kabul etmek için önce yer açılmalı.</span></div>}
      {pending.length === 0 ? <Empty icon="📭" title="Bekleyen başvuru yok" text={team.open ? 'Takımın herkese açık; oyuncular doğrudan katılabiliyor. Başvuruyla almak için takım menüsünden katılımı değiştir.' : 'Yeni başvurular burada ve Takım sekmesinde rozetle görünür.'} /> : pending.map((a) => {
        const note = noteText(a);
        return (
          <div className="card ta-app" key={a.id} data-testid="basvuru" data-player={a.player.name}>
            <button type="button" className="tr-main" onClick={() => openProfile(a.player.id)} aria-label={`${a.player.name} profili`}>
              <Av p={a.player} size={44} />
              <span className="grow min0 tr-body"><b className="ellipsis">{a.player.name}</b>
                <span className="tr-meta"><span><Art name="flag" size="1.15em" className="art-inline" /> {a.player.highest}. bölüm</span><span><Art name="star" size="1.15em" className="art-inline" /> {a.player.stars}</span><span><Art name="hourglass" size="1.15em" className="art-inline" /> {fmtLeft(a.expiresAt - now)}</span></span>
              </span>
            </button>
            {note && <div className={`ta-app-note${a.noteKind === 'serbest' ? ' free' : ''}`} {...(a.noteKind === 'serbest' ? { 'data-ugc': true } : {})}>“{note}”</div>}
            <div className="ta-app-acts">
              <button type="button" className="btn small teal" disabled={!!busy || full} onClick={() => void decide(a, true)} data-testid="basvuru-kabul"><Art name="check" size={16} /> Kabul et</button>
              <button type="button" className="btn small ghost" disabled={!!busy} onClick={() => setRejecting(a)} data-testid="basvuru-ret"><Art name="cross" size={16} /> Reddet</button>
            </div>
          </div>
        );
      })}
      <div className="muted small-note">Başvuruları lider ve yardımcılar onaylar; aynı anda iki karar gelirse ilki geçerli olur. Yanıtlanmayan başvuru 7 günde düşer; reddedilen oyuncu aynı takıma 24 saat sonra yeniden başvurabilir.</div>
      {rejecting && (
        <Sheet title={`${rejecting.player.name} başvurusu`} onClose={() => setRejecting(null)}>
          <div className="muted">Oyuncuya kısa bir gerekçe gider (isteğe bağlı).</div>
          <div className="ta-reasons" data-testid="ret-gerekceleri">
            {TEAM_REJECT_REASONS.map((r) => <button key={r.id} type="button" className="chip-btn ta-note" data-reason={r.id} onClick={() => void decide(rejecting, false, r.id)}>{r.text}</button>)}
          </div>
          <button type="button" className="btn ghost" onClick={() => void decide(rejecting, false)} data-reason="">Gerekçe belirtmeden reddet</button>
        </Sheet>
      )}
    </div>
  );
}
