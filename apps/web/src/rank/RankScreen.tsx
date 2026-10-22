import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { RANK_BOARDS, RANK_RULES, rankBoardById, type RankBoardId, type RankBoardView, type RankRowView, type RankScope } from '@odi/shared';
import { errText, getNet } from '../net';
import { platform } from '../platform';
import { ScreenHead } from '../ui/bits';
import { Online, Sheet, Skeleton, fmtLeft, fmtNum, useNow } from '../ui/social';
import { Art, type ArtName } from '../ui/art';
import { OdiAvatar } from '../ui/OdiAvatar';
import { hatKey } from '../screens/team/TeamMembers';
import { openProfile } from '../friends/state';
import './rank.css';

/**
 * Sıralama: oyuncu ve takım tabloları (sunucu yetkili). Podyum (ilk 3, herkesin kendi Odi rengiyle), ▲▼ gün başına göre değişim,
 * kendi satırım sabit, geçen haftanın ilk 3'ü, şeffaf formül ve ödüller bilgi sayfasında. Satıra dokun → profil kartı.
 */
const BOARD_ART: Record<RankBoardId, ArtName> = { guc: 'bolt', yildiz: 'star', nota: 'note', soru: 'bulb', yaris: 'finish', 't-guc': 'shield', 't-savas': 'swords', 't-baskin': 'monster', 't-soru': 'bulb', 't-lig': 'medal' };
const SCOPES: { id: RankScope; label: string }[] = [{ id: 'herkes', label: 'Herkes' }, { id: 'arkadas', label: 'Arkadaşlar' }, { id: 'yakin', label: 'Yakınım' }];
let last: { team: boolean; board: Record<'p' | 't', RankBoardId>; scope: RankScope } = { team: false, board: { p: 'guc', t: 't-guc' }, scope: 'herkes' };

export function RankScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen fade-in rank-screen" data-testid="siralama">
      <ScreenHead title="Sıralama" onBack={onBack} />
      <Online what="Sıralama"><RankView /></Online>
    </div>
  );
}

/** tablo görünümü (Profil › Sıralama ekranı ve Takım › Sıralama sekmesi) */
export function RankView({ team: teamStart }: { team?: boolean }) {
  const [team, setTeam] = useState(teamStart ?? last.team);
  const [board, setBoard] = useState<Record<'p' | 't', RankBoardId>>(last.board);
  const [scope, setScope] = useState<RankScope>(last.scope);
  const [view, setView] = useState<RankBoardView | null>(null);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState(false);
  const status = useNet((s) => s.status);
  const cur = board[team ? 't' : 'p'];
  const def = rankBoardById(cur)!;
  useEffect(() => { last = { team, board, scope }; }, [team, board, scope]);
  useEffect(() => {
    const c = getNet(); if (!c || status !== 'bağlı') return;
    let alive = true;
    const load = () => c.call('rank.board', { board: cur, scope }).then((r) => { if (alive) { setView(r.view); setErr(''); } }, (e) => { if (alive) setErr(errText(e)); });
    setView((v) => (v && v.board === cur && v.scope === scope ? v : null));
    void load();
    const h = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(h); };
  }, [cur, scope, status]);
  const pick = (b: RankBoardId) => { platform().haptic('light'); setBoard((x) => ({ ...x, [team ? 't' : 'p']: b })); };

  // yalnızca seçili tablo ve kapsamın yanıtı çizilir: kapsam değişirken eski liste bir an bile görünmez
  const shown = view && view.board === cur && view.scope === scope ? view : null;
  const rows = shown?.rows ?? [];
  const podium = scope === 'herkes' && rows.length >= 1 ? rows.slice(0, 3) : [];
  const rest = podium.length ? rows.slice(podium.length) : rows;
  // kendi satırım listede zaten görünüyorsa altta tekrar sabitlenmez (podyumdaysa sabit satır sırayı ve değişimi gösterir)
  const meInList = rest.some((r) => r.me);
  return (
    <div className="rank" data-board={cur} data-scope={scope}>
      <div className="seg rank-kind" role="tablist" aria-label="Tablo türü">
        <button role="tab" aria-selected={!team} className={!team ? 'on' : ''} onClick={() => setTeam(false)}>Oyuncular</button>
        <button role="tab" aria-selected={team} className={team ? 'on' : ''} onClick={() => setTeam(true)}>Takımlar</button>
      </div>
      <div className="rank-boards" role="tablist" aria-label="Tablolar">
        {RANK_BOARDS.filter((b) => b.team === team).map((b) => (
          <button key={b.id} role="tab" aria-selected={cur === b.id} className={`rank-chip${cur === b.id ? ' on' : ''}`} data-board={b.id} onClick={() => pick(b.id)}><Art name={BOARD_ART[b.id]} size={18} /> {b.name}</button>
        ))}
      </div>
      <div className="rank-head">
        <span className="rh-ic"><Art name={BOARD_ART[cur]} size={28} /></span>
        <span className="grow min0"><b>{def.name}</b><small>{def.desc}{view?.endsAt ? <> · <Reset at={view.endsAt} /></> : null}</small></span>
        <button type="button" className="ibtn sm rank-info" aria-label="Nasıl hesaplanır?" onClick={() => setInfo(true)}><Art name="question" size={18} /></button>
      </div>
      <div className="seg rank-scope" role="tablist" aria-label="Kapsam">
        {SCOPES.map((s) => <button key={s.id} role="tab" aria-selected={scope === s.id} className={scope === s.id ? 'on' : ''} data-scope={s.id} onClick={() => setScope(s.id)}>{s.label}</button>)}
      </div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      {!shown ? <Skeleton rows={4} /> : rows.length === 0 ? (
        <div className="card rank-empty"><Art name="trophy" size={44} /><b>{scope === 'arkadas' ? 'Arkadaşların henüz bu tabloda değil' : 'Bu tablo henüz boş'}</b><small className="muted">{def.weekly ? 'Haftanın ilk puanları gelince burası dolar.' : 'Bölüm geçtikçe güç kazanırsın.'}</small></div>
      ) : (
        <>
          {podium.length > 0 && <Podium rows={podium} team={team} />}
          <ol className="rank-list" data-board={shown.board} data-scope={shown.scope} aria-label={`${def.name} sıralaması`}>{rest.map((r) => <Row key={r.id} r={r} team={team} unit={def.unit} />)}</ol>
          <div className="muted small-note rank-total" data-testid="sira-toplam">{shown.scope === 'arkadas' ? `${shown.total} ${team ? 'takım' : 'kişi'} bu tabloda (sen ve arkadaşların${team ? 'ın takımları' : ''})` : `${shown.total} ${team ? 'takım' : 'oyuncu'} sıralamada`} · güncellendi</div>
        </>
      )}
      {shown?.last && shown.last.rows.length > 0 && (
        <div className="card rank-last" data-testid="gecen-hafta">
          <small>Geçen haftanın ilk 3'ü</small>
          <div className="rl-row">{shown.last.rows.map((r) => <span key={r.id} className="rl-p"><Art name={(['medal1', 'medal2', 'medal3'] as const)[r.rank - 1] ?? 'medal'} size={20} /><b className="ellipsis">{r.name}</b><small>{fmtNum(r.value)}</small></span>)}</div>
        </div>
      )}
      {shown && !meInList && (
        <div className="rank-me" data-testid="benim-siram">
          {shown.me ? <Row r={shown.me} team={team} unit={def.unit} pinned /> : <div className="rank-row pinned none"><span className="rr-rank">–</span><span className="grow">{team ? 'Takımın henüz bu tabloda değil' : 'Henüz bu tabloda değilsin'}</span><small className="muted">{def.weekly ? 'bu hafta oyna, katıl' : 'bir bölüm geç'}</small></div>}
        </div>
      )}
      {info && <InfoSheet onClose={() => setInfo(false)} team={team} />}
    </div>
  );
}

function Reset({ at }: { at: number }) {
  const now = useNow(30_000);
  return <>Pazartesi 00:00'da sıfırlanır ({fmtLeft(at - now)} kaldı)</>;
}

function Face({ r, team, size }: { r: RankRowView; team: boolean; size: number }) {
  if (team) return <span className="rr-emb" data-ugc style={{ fontSize: Math.round(size * 0.62), width: size, height: size }}>{r.emblem}</span>;
  return <OdiAvatar size={size} color={r.color} hat={hatKey(r.hat ?? '')} />;
}

function Delta({ d }: { d: number | null }) {
  if (d == null || d === 0) return <span className="rr-delta flat" aria-label="değişmedi">–</span>;
  return <span className={`rr-delta ${d > 0 ? 'up' : 'down'}`} aria-label={d > 0 ? `${d} sıra yükseldi` : `${-d} sıra düştü`}><Art name={d > 0 ? 'up' : 'down'} size={14} />{Math.abs(d)}</span>;
}

const tap = (r: RankRowView, team: boolean) => { if (!team && !r.me) openProfile(r.id); };

function Podium({ rows, team }: { rows: RankRowView[]; team: boolean }) {
  const order = [rows[1], rows[0], rows[2]];
  return (
    <div className="podium" data-testid="podyum">
      {order.map((r, i) => r ? (
        <button key={r.id} type="button" className={`pd p${r.rank <= 3 ? r.rank : 3}${r.me ? ' me' : ''}`} style={{ order: i }} onClick={() => tap(r, team)} aria-label={`${r.rank}. ${r.name}, ${fmtNum(r.value)}`} data-rank={r.rank}>
          <span className="pd-face"><Face r={r} team={team} size={r.rank === 1 ? 64 : 52} />{r.badge && <span className="pd-badge" title="Geçen hafta ilk 3"><Art name="crown" size={16} /></span>}</span>
          <b className="pd-name">{r.name}</b>
          <span className="pd-val">{fmtNum(r.value)}</span>
          <span className="pd-step"><Art name={(['medal1', 'medal2', 'medal3'] as const)[Math.min(3, r.rank) - 1]!} size={26} /><i>{r.rank}</i></span>
        </button>
      ) : <span key={i} className="pd empty" style={{ order: i }} />)}
    </div>
  );
}

function Row({ r, team, unit, pinned }: { r: RankRowView; team: boolean; unit: string; pinned?: boolean }) {
  return (
    <li className={`rank-row${r.me ? ' me' : ''}${pinned ? ' pinned' : ''}`} data-testid={pinned ? 'benim-satirim' : 'sira-satiri'} data-rank={r.rank} data-id={r.id}>
      <button type="button" onClick={() => tap(r, team)} aria-label={`${r.rank}. ${r.name}: ${fmtNum(r.value)} ${unit}`}>
        <span className="rr-rank">{r.rank}</span>
        <Delta d={r.delta} />
        <span className="rr-face"><Face r={r} team={team} size={34} /></span>
        <span className="grow min0 rr-who"><b className="ellipsis">{r.name}{r.me ? ' (sen)' : ''}{r.badge ? <span className="rr-badge" title={`Geçen hafta ${r.badge}.`}><Art name="crown" size={14} /></span> : null}</b>{!team && r.teamName || r.global != null ? <small className="ellipsis">{r.global != null ? <span className="rr-global" data-testid="genel-sira">Genel: {r.global}.</span> : null}{r.global != null && !team && r.teamName ? ' · ' : ''}{!team ? r.teamName : null}</small> : null}</span>
        <span className="rr-val"><b>{fmtNum(r.value)}</b><small>{unit}</small></span>
      </button>
    </li>
  );
}

function InfoSheet({ onClose, team }: { onClose: () => void; team: boolean }) {
  const P = RANK_RULES.power;
  const rw = (list: readonly { upTo: number; reward: readonly { amount: number }[] }[]) => list.map((t, i) => `${i === 0 ? '1.' : `${(list[i - 1]!.upTo + 1)}${t.upTo > list[i - 1]!.upTo + 1 ? `–${t.upTo}` : ''}.`} ${t.reward.map((g) => `${g.amount} kristal`).join(' + ')}`).join(' · ');
  return (
    <Sheet title="Sıralama nasıl hesaplanır?" onClose={onClose}>
      <ul className="rules">
        <li><Art name="bolt" size={18} /> <span><b>Güç</b> = yıldız × {P.star} + geçilen bölüm × {P.level} + kamp binası seviyeleri × {P.camp} + Günün Sorusu doğruları × {P.dq}.</span></li>
        <li><Art name="shield" size={18} /> <span><b>Takım gücü</b> = üyelerin gücü toplamı + takım teknolojisi seviyeleri × {RANK_RULES.teamTech}.</span></li>
        <li><Art name="check" size={18} /> <span>Yalnızca sunucunun doğruladığı bölümler sayılır; tekrar oynamak yeni yıldız saymaz, nota günde en çok {fmtNum(RANK_RULES.notesPerDay)}, yarış galibiyeti günde en çok {RANK_RULES.raceWinsPerDay} (en az iki kişinin bitirdiği yarış).</span></li>
        <li><Art name="calendar" size={18} /> <span>Haftalık tablolar Pazartesi 00:00'da (İstanbul) kapanır; son sıralama saklanır, ilk sıralar takım sohbetinde duyurulur.</span></li>
        <li><Art name="crystal" size={18} /> <span>{team ? `Takım ödülü (her üyeye): ${rw(RANK_RULES.teamRewards)}` : `Haftalık ödül: ${rw(RANK_RULES.playerRewards)}`}. Ödüller ödül kutusuna bir kez düşer.</span></li>
        <li><Art name="up" size={18} /> <span>▲▼ işaretleri gün başındaki sıraya göre değişimdir.</span></li>
      </ul>
      <button className="btn" onClick={onClose}>Anladım</button>
    </Sheet>
  );
}
