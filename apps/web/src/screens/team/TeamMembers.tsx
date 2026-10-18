import { useState } from 'react';
import { useNet } from '@odi/net/store';
import type { TeamMember, TeamRole } from '@odi/shared';
import { act, toast } from '../../net';
import { OdiAvatar } from '../../ui/OdiAvatar';
import { ROLE_LABEL, Sheet, fmtNum } from '../../ui/social';

const HATS: Record<string, string> = { 'sapka-bere': 'bere', 'sapka-nota': 'nota', 'sapka-koklea': 'koklea', 'sapka-kulaklik': 'kulaklik', 'sapka-parti': 'parti', 'sapka-yildiz': 'yildiz', 'sapka-dalgic': 'dalgic', 'sapka-tac': 'tac', 'sapka-kasif': 'kasif' };
export const hatKey = (h: string) => HATS[h] ?? h;

/** Üyeler: rol rozetleri, çevrimiçi noktası, haftalık katkı; lider/yardımcı için rol ver / çıkar. */
export function TeamMembers() {
  const team = useNet((s) => s.team)!; const extra = useNet((s) => s.extra); const me = useNet((s) => s.me)!; const presence = useNet((s) => s.presence);
  const [sel, setSel] = useState<TeamMember | null>(null);
  const [kick, setKick] = useState<TeamMember | null>(null);
  const myRole: TeamRole = team.roster.find((m) => m.id === me.id)?.role ?? 'uye';
  const contrib = new Map((extra?.contributionWeek ?? []).map((c) => [c.id, c]));
  const online = (m: TeamMember) => presence[m.id] ?? m.online;
  const roster = [...team.roster].sort((a, b) => Number(online(b)) - Number(online(a)));
  const onlineCount = roster.filter(online).length;
  const canManage = (m: TeamMember) => m.id !== me.id && (myRole === 'lider' || (myRole === 'yardimci' && m.role === 'uye'));

  const role = async (m: TeamMember, r: TeamRole) => { setSel(null); const x = await act('team.role', { id: m.id, role: r }); if (x) { useNet.setState({ team: x.team }); toast('👑', r === 'lider' ? `Liderlik ${m.name} adlı üyede` : `${m.name} artık ${r === 'yardimci' ? 'yardımcı' : 'üye'}`); } };
  const doKick = async (m: TeamMember) => { setKick(null); const x = await act('team.kick', { id: m.id }); if (x) { useNet.setState({ team: x.team }); toast('🚪', `${m.name} takımdan çıkarıldı`); } };

  return (
    <div className="stack">
      <div className="row between"><span className="muted">{onlineCount} çevrimiçi · {team.members}/{team.max} üye</span><span className="muted">bu hafta</span></div>
      {roster.map((m) => { const c = contrib.get(m.id); return (
        <button className="card member" key={m.id} onClick={() => canManage(m) && setSel(m)} disabled={!canManage(m)} aria-label={`${m.name}, ${ROLE_LABEL[m.role]}`}>
          <span className="mem-av"><OdiAvatar size={40} color={m.color} hat={hatKey(m.hat)} /><i className={`on-dot${online(m) ? ' on' : ''}`} /></span>
          <span className="grow min0 mem-body">
            <span className="row mem-top"><b className="ellipsis">{m.name}{m.id === me.id ? ' (sen)' : ''}</b>{m.role !== 'uye' && <span className={`role-badge ${m.role}`}>{ROLE_LABEL[m.role]}</span>}</span>
            <span className="mem-stats"><span title="Bağış">🪙 {fmtNum(c?.donated ?? 0)}</span><span title="Yardım">🤝 {c?.helps ?? 0}</span><span title="Yıldız">⭐ {c?.stars ?? 0}</span><span title="Savaş puanı">⚔️ {fmtNum(m.weekPoints)}</span></span>
          </span>
          <span className="mem-lvl muted">{m.highest}. bölüm</span>
        </button>); })}
      {myRole !== 'uye' && <div className="muted small-note">Bir üyeye dokun: rol ver ya da takımdan çıkar.</div>}
      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <div className="muted">{ROLE_LABEL[sel.role]} · {sel.highest}. bölüm · ⭐ {sel.stars}</div>
          {myRole === 'lider' && sel.role !== 'yardimci' && <button className="btn ghost" onClick={() => void role(sel, 'yardimci')}>⭐ Yardımcı yap</button>}
          {myRole === 'lider' && sel.role === 'yardimci' && <button className="btn ghost" onClick={() => void role(sel, 'uye')}>Üye yap</button>}
          {myRole === 'lider' && <button className="btn ghost" onClick={() => void role(sel, 'lider')}>👑 Liderliği devret</button>}
          <button className="btn ghost coral-text" onClick={() => { setKick(sel); setSel(null); }}>Takımdan çıkar</button>
        </Sheet>
      )}
      {kick && (
        <Sheet title={`${kick.name} çıkarılsın mı?`} onClose={() => setKick(null)}>
          <div className="muted">İstediği zaman başka bir takıma katılabilir.</div>
          <button className="btn coral" onClick={() => void doKick(kick)}>Evet, çıkar</button>
          <button className="btn ghost" onClick={() => setKick(null)}>Vazgeç</button>
        </Sheet>
      )}
    </div>
  );
}
