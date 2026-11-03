import { useState } from 'react';
import { useNet } from '@odi/net/store';
import type { TeamMember, TeamRole } from '@odi/shared';
import { act, toast } from '../../net';
import { OdiAvatar } from '../../ui/OdiAvatar';
import { ROLE_LABEL, Sheet, fmtNum } from '../../ui/social';
import { openProfile } from '../../friends/state';
import { Art, rich } from '../../ui/art';
import { RozetMini } from '../../kurucu/rozet';

const HATS: Record<string, string> = { 'sapka-bere': 'bere', 'sapka-nota': 'nota', 'sapka-koklea': 'koklea', 'sapka-kulaklik': 'kulaklik', 'sapka-parti': 'parti', 'sapka-yildiz': 'yildiz', 'sapka-dalgic': 'dalgic', 'sapka-tac': 'tac', 'sapka-kasif': 'kasif' };
export const hatKey = (h: string) => HATS[h] ?? h;
/** liderlik devri onayı: geri alınamaz, devreden yardımcı olur (sunucu team.role) */
export const leadConfirmText = (name: string) => `Liderliği ${name} adlı üyeye devretmek istiyor musun? Sen Yardımcı olursun; geri almak için onun sana devretmesi gerekir.`;

/** üye satırındaki bölüm (OT-takim-kaptani-26): herkes için aynı anlam, oynadığı sıradaki bölüm; son bölümü bitiren "Bitirdi" */
export const memberLevel = (m: Pick<TeamMember, 'highest' | 'finished'>) => (m.finished ? 'Bitirdi' : `${m.highest}. bölümde`);

/** Üyeler: rol rozetleri, çevrimiçi noktası, haftalık katkı (etiketli); lider/yardımcı için rol ver / çıkar (devir ve çıkarma onaylı). */
export function TeamMembers() {
  const team = useNet((s) => s.team)!; const extra = useNet((s) => s.extra); const me = useNet((s) => s.me)!; const presence = useNet((s) => s.presence);
  const [sel, setSel] = useState<TeamMember | null>(null);
  const [kick, setKick] = useState<TeamMember | null>(null);
  const [lead, setLead] = useState<TeamMember | null>(null);
  const myRole: TeamRole = team.roster.find((m) => m.id === me.id)?.role ?? 'uye';
  const contrib = new Map((extra?.contributionWeek ?? []).map((c) => [c.id, c]));
  const online = (m: TeamMember) => presence[m.id] ?? m.online;
  const roster = [...team.roster].sort((a, b) => Number(online(b)) - Number(online(a)));
  const onlineCount = roster.filter(online).length;
  const canManage = (m: TeamMember) => m.id !== me.id && (myRole === 'lider' || (myRole === 'yardimci' && m.role === 'uye'));

  const role = async (m: TeamMember, r: TeamRole) => { setSel(null); setLead(null); const x = await act('team.role', { id: m.id, role: r }); if (x) { useNet.setState({ team: x.team }); toast('👑', r === 'lider' ? `Liderlik ${m.name} adlı üyede` : `${m.name} artık ${r === 'yardimci' ? 'yardımcı' : 'üye'}`); } };
  const doKick = async (m: TeamMember) => { setKick(null); const x = await act('team.kick', { id: m.id }); if (x) { useNet.setState({ team: x.team }); toast('🚪', `${m.name} takımdan çıkarıldı`); } };

  return (
    <div className="stack">
      <div className="row between"><span className="muted">{onlineCount} çevrimiçi · {team.members}/{team.max} üye</span><span className="muted">sayılar bu hafta</span></div>
      {roster.map((m) => { const c = contrib.get(m.id); return (
        <button className="card member" key={m.id} onClick={() => (canManage(m) ? setSel(m) : openProfile(m.id))} aria-label={`${m.name}, ${ROLE_LABEL[m.role]}`} data-testid="uye-satiri">
          <span className="mem-av"><OdiAvatar size={40} color={m.color} hat={hatKey(m.hat)} /><i className={`on-dot${online(m) ? ' on' : ''}`} /></span>
          <span className="grow min0 mem-body">
            {/* ad kesilmez, "(sen)" ve rol etiketi sığmazsa alt satıra iner (OT-takim-kaptani-26) */}
            <span className="row mem-top"><b className="mem-name">{m.name}{m.id === me.id && <span className="mem-you"> (sen)</span>}</b><RozetMini p={m} />{m.role !== 'uye' && <span className={`role-badge ${m.role}`}>{rich(ROLE_LABEL[m.role])}</span>}</span>
            {/* bu haftaki katkı: her sayının altında ne olduğu yazar (OT-buyuk-yazi-38) */}
            <span className="mem-stats" aria-label="Bu hafta">
              <span className="mem-stat"><span><Art e="🪙" size="1.25em" className="art-inline" /> {fmtNum(c?.donated ?? 0)}</span><small>bağış</small></span>
              <span className="mem-stat"><span><Art e="🤝" size="1.25em" className="art-inline" /> {c?.helps ?? 0}</span><small>yardım</small></span>
              <span className="mem-stat"><span><Art e="⭐" size="1.25em" className="art-inline" /> {c?.stars ?? 0}</span><small>yıldız</small></span>
              <span className="mem-stat"><span><Art e="⚔️" size="1.25em" className="art-inline" /> {fmtNum(m.weekPoints)}</span><small>savaş</small></span>
            </span>
          </span>
          <span className={`mem-lvl${m.finished ? ' done' : ' muted'}`} data-testid="uye-bolum">{memberLevel(m)}</span>
        </button>); })}
      <div className="muted small-note">{myRole !== 'uye' ? 'Bir üyeye dokun: profil, rol ver ya da takımdan çıkar.' : 'Bir üyeye dokun: profil kartı.'}</div>
      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <div className="muted">{rich(ROLE_LABEL[sel.role])} · {memberLevel(sel)} · <Art name="star" size="1.15em" className="art-inline" /> {sel.stars}</div>
          <button className="btn ghost" onClick={() => { const id = sel.id; setSel(null); openProfile(id); }}><Art e="👤" size="1.15em" className="art-inline" /> Profili gör</button>
          {myRole === 'lider' && sel.role !== 'yardimci' && <button className="btn ghost" onClick={() => void role(sel, 'yardimci')}><Art e="⭐" size="1.15em" className="art-inline" /> Yardımcı yap</button>}
          {myRole === 'lider' && sel.role === 'yardimci' && <button className="btn ghost" onClick={() => void role(sel, 'uye')}>Üye yap</button>}
          {/* geri alınamaz işlemler ayrı ve onaylı (OT-takim-kaptani-22) */}
          {myRole === 'lider' && <button className="btn ghost" data-testid="lider-devret" onClick={() => { setLead(sel); setSel(null); }}><Art e="👑" size="1.15em" className="art-inline" /> Liderliği devret…</button>}
          <button className="btn ghost coral-text" data-testid="takimdan-cikar" onClick={() => { setKick(sel); setSel(null); }}>Takımdan çıkar…</button>
        </Sheet>
      )}
      {lead && (
        <Sheet title="Liderlik devredilsin mi?" onClose={() => setLead(null)}>
          <div className="muted wrap" data-testid="devret-onay">{leadConfirmText(lead.name)}</div>
          <button className="btn coral" data-testid="devret-evet" onClick={() => void role(lead, 'lider')}>Devret</button>
          <button className="btn ghost" onClick={() => setLead(null)}>Vazgeç</button>
        </Sheet>
      )}
      {kick && (
        <Sheet title={`${kick.name} çıkarılsın mı?`} onClose={() => setKick(null)}>
          <div className="muted">İstediği zaman başka bir takıma katılabilir.</div>
          <button className="btn coral" data-testid="cikar-evet" onClick={() => void doKick(kick)}>Evet, çıkar</button>
          <button className="btn ghost" onClick={() => setKick(null)}>Vazgeç</button>
        </Sheet>
      )}
    </div>
  );
}
