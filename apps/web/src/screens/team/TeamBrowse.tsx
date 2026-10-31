import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS, TEAM_APPLY_RULES, TEAM_EMBLEMS, rejectReasonText, type TeamApplyStatus, type TeamBrowseRow, type TeamEmblemKey, type TeamListFilter } from '@odi/shared';
import { act, errText, getNet, toast } from '../../net';
import { platform } from '../../platform';
import { Empty, Sheet, Skeleton, fmtLeft, fmtNum, useNow } from '../../ui/social';
import { Art, Glyph, TEAM_EMBLEM_ART, TeamEmblem, type ArtName } from '../../ui/art';
import { JoinButton, ModeTag } from './TeamProfile';
import { bumpBrowse, openTeamProfile, refreshMine, useTeamApply } from './apply';

const PERKS = [
  { icon: '🔬', title: 'Ortak teknoloji', text: 'Bağışlar herkesi güçlendirir: jeton, kalkan, hız.' },
  { icon: '🎁', title: 'Takım hediyeleri', text: 'Hedef ve baskın ödülleri herkese düşer.' },
  { icon: '⚔️', title: 'Bölge Savaşı', text: 'Oynadıkça kulak haritasında bölge kap.' },
  { icon: '👹', title: 'Baskın', text: 'Gürültü Canavarı’nı birlikte yenin.' },
  { icon: '🤝', title: 'Yardım', text: 'Tek dokunuşla inşaatlar hızlanır.' },
];

const FILTERS: { id: TeamListFilter; label: string; art: ArtName }[] = [
  { id: 'hepsi', label: 'Hepsi', art: 'users' }, { id: 'acik', label: 'Doğrudan katıl', art: 'door' },
  { id: 'basvuru', label: 'Başvuruyla', art: 'mail' }, { id: 'uygun', label: 'Bana uygun', art: 'check' },
];
let lastFilter: TeamListFilter = 'hepsi';

/** Takımsızken: faydalar, takım kur, kodla katıl, başvurularım ve TÜM takımlar (güç sırası, filtre, arama, sayfalama). */
export function TeamBrowse() {
  const [q, setQ] = useState('');
  const [filter, setFilterState] = useState<TeamListFilter>(lastFilter);
  const [teams, setTeams] = useState<TeamBrowseRow[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState('');
  const stamp = useTeamApply((s) => s.stamp);
  const setFilter = (f: TeamListFilter) => { lastFilter = f; platform().haptic('light'); setFilterState(f); };
  const req = (offset: number) => ({ ...(q.trim() ? { query: q.trim() } : {}), ...(filter !== 'hepsi' ? { filter } : {}), ...(offset ? { offset } : {}), limit: TEAM_APPLY_RULES.pageSize });

  useEffect(() => {
    const c = getNet(); if (!c) return;
    let alive = true;
    const h = setTimeout(() => {
      c.call('team.list', req(0)).then((r) => { if (alive) { setTeams(r.teams); setNext(r.next ?? null); setTotal(r.total ?? r.teams.length); setErr(''); } }, (e) => alive && setErr(errText(e)));
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(h); };
  }, [q, filter, stamp]);
  useEffect(() => { void refreshMine(true); }, []);
  const loadMore = async () => {
    const c = getNet(); if (!c || next == null) return;
    setMore(true);
    try { const r = await c.call('team.list', req(next)); setTeams((l) => [...(l ?? []), ...r.teams.filter((t) => !l?.some((x) => x.id === t.id))]); setNext(r.next ?? null); }
    catch (e) { setErr(errText(e)); }
    setMore(false);
  };

  const joined = (name: string) => { platform().haptic('success'); toast('🎉', `${name} takımına hoş geldin!`, 'Sohbette bir merhaba de.', 'green'); };
  const joinCode = async () => { if (!code.trim()) return; setBusy('kod'); const r = await act('team.join', { code: code.trim() }); setBusy(''); if (r) { useNet.setState({ team: r.team }); joined(r.team.name); } };

  return (
    <>
      <div className="card team-hero">
        <div className="th-emblems" aria-hidden><Art e="👂" size="1.15em" className="art-inline" /><Art e="🎵" size="1.15em" className="art-inline" /><Art e="🦻" size="1.15em" className="art-inline" /></div>
        <h2>Birlikte daha uzağa</h2>
        <div className="muted">Bir takıma katıl ya da kendi takımını kur. Her bölümün takımına puan yazar.</div>
        <div className="perks">{PERKS.map((p) => <div className="perk" key={p.title}><span className="pk-i" aria-hidden><Glyph e={p.icon} size={26} /></span><b>{p.title}</b><span className="muted">{p.text}</span></div>)}</div>
        <button className="btn" onClick={() => setCreating(true)}>＋ Takım kur</button>
      </div>

      <div className="card code-join">
        <b>Davet kodun mu var?</b>
        <span className="muted small-note">Kod, başvuruyla üye alan takımlara da doğrudan katılır.</span>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void joinCode(); }}>
          <input className="input grow" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ör. K7M2QX" maxLength={8} aria-label="Takım davet kodu" autoCapitalize="characters" />
          <button className="btn small" disabled={!code.trim() || busy === 'kod'}>Katıl</button>
        </form>
      </div>

      <MyApplications />

      <div className="row between"><h2>Takımlar</h2><span className="muted" data-testid="takim-sayisi">{teams ? `${fmtNum(total)} takım · güce göre` : 'güce göre'}</span></div>
      <div className="ta-filters" role="tablist" aria-label="Takım filtresi">
        {FILTERS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`rank-chip${filter === f.id ? ' on' : ''}`} data-filter={f.id} onClick={() => setFilter(f.id)}><Art name={f.art} size={16} /> {f.label}</button>)}
      </div>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Takım ara" aria-label="Takım ara" />
      {err && <div className="chat-err">{err}</div>}
      {!teams ? <Skeleton rows={3} /> : teams.length === 0 ? (
        <Empty icon="🌱" title={q ? 'Bu isimde takım yok' : filter === 'hepsi' ? 'Henüz takım yok' : 'Bu filtrede takım yok'} text={filter === 'hepsi' ? 'İlk takımı sen kur; arkadaşlarını kodla davet et.' : 'Başka bir filtre dene ya da kendi takımını kur.'} >
          <button className="btn small" onClick={() => setCreating(true)}>＋ Takım kur</button>
        </Empty>
      ) : (
        <div className="team-list" data-testid="takim-listesi">
          {teams.map((t) => (
            <div className="card team-row" key={t.id} data-testid="takim-satiri" data-team={t.id} data-name={t.name}>
              <button type="button" className="tr-main" onClick={() => openTeamProfile(t.id)} aria-label={`${t.name} takım profili`}>
                <span className="tr-emblem" aria-hidden><TeamEmblem e={t.emblem} />{t.rank ? <i className="tr-rank">{t.rank}</i> : null}</span>
                <span className="grow min0 tr-body">
                  <b className="ellipsis">{t.name}</b>
                  <span className="tr-meta"><span><Art name="users" size="1.15em" className="art-inline" /> {t.members}/{t.max}</span><span title="Takım gücü"><Art name="bolt" size="1.15em" className="art-inline" /> {fmtNum(t.rankPower ?? 0)}</span><ModeTag open={t.open} />{t.minLevel > 1 && <span><Art name="unlock" size="1.15em" className="art-inline" /> {t.minLevel}. bölüm</span>}</span>
                  {t.description && <span className="muted tr-desc" data-ugc>{t.description}</span>}
                </span>
              </button>
              <JoinButton t={t} onChanged={bumpBrowse} />
            </div>))}
          {next != null && <button type="button" className="btn ghost" disabled={more} onClick={() => void loadMore()} data-testid="daha-fazla">{more ? 'Yükleniyor…' : `Daha fazla göster (${fmtNum(total - teams.length)})`}</button>}
        </div>
      )}
      {creating && <CreateTeam onClose={() => setCreating(false)} onDone={(name) => { setCreating(false); joined(name); }} />}
    </>
  );
}

const STATUS: Record<TeamApplyStatus, string> = { bekliyor: 'Bekliyor', kabul: 'Kabul edildi', red: 'Kabul edilmedi', iptal: 'Geri çekildi', sure: 'Süresi doldu', otomatik: 'Düştü' };
/** Başvurularım: bekleyenler (geri çek) ve son 7 günün kararları (gerekçesiyle) */
function MyApplications() {
  const mine = useTeamApply((s) => s.mine);
  const now = useNow(60_000);
  const [busy, setBusy] = useState('');
  const shown = mine.filter((a) => a.status === 'bekliyor' || a.status === 'red' || a.status === 'sure');
  if (!shown.length) return null;
  const cancel = async (id: string) => { setBusy(id); const r = await act('team.apply.cancel', { applicationId: id }); setBusy(''); if (r) { toast('↩️', 'Başvurun geri çekildi'); bumpBrowse(); void refreshMine(); } };
  return (
    <div className="card ta-mine" data-testid="basvurularim">
      <div className="row between"><b><Art name="mail" size="1.15em" className="art-inline" /> Başvurularım</b><span className="muted">{shown.filter((a) => a.status === 'bekliyor').length}/{TEAM_APPLY_RULES.maxPending} bekliyor</span></div>
      {shown.map((a) => (
        <div className={`ta-mine-row st-${a.status}`} key={a.id} data-status={a.status}>
          <button type="button" className="tr-main" onClick={() => openTeamProfile(a.teamId)} aria-label={`${a.teamName} takım profili`}>
            <span className="tr-emblem sm" aria-hidden><TeamEmblem e={a.teamEmblem} /></span>
            <span className="grow min0 tr-body"><b className="ellipsis">{a.teamName}</b>
              <small className="ta-st">{STATUS[a.status]}{a.status === 'bekliyor' ? ` · ${fmtLeft(a.expiresAt - now)} içinde düşer` : a.status === 'red' && a.reason ? `: ${rejectReasonText(a.reason)}` : ''}</small></span>
          </button>
          {a.status === 'bekliyor' && <button type="button" className="btn ghost small" disabled={busy === a.id} onClick={() => void cancel(a.id)}>Geri çek</button>}
        </div>
      ))}
    </div>
  );
}

function CreateTeam({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const me = useNet((s) => s.me)!;
  const [name, setName] = useState(''); const [emblem, setEmblem] = useState<TeamEmblemKey>('👂'); const [desc, setDesc] = useState('');
  const [open, setOpen] = useState(true); const [minLevel, setMinLevel] = useState(1);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const c = getNet(); if (!c) return;
    setBusy(true); setErr('');
    try { const r = await c.call('team.create', { name: name.trim(), emblem, description: desc.trim(), open, minLevel }); useNet.setState({ team: r.team }); onDone(r.team.name); }
    catch (e) { setErr(errText(e)); platform().haptic('error'); }
    setBusy(false);
  };
  return (
    <Sheet title="Takım kur" onClose={onClose}>
      <div className="create-preview"><span className="cp-emblem" aria-hidden><TeamEmblem e={emblem} /></span><b className="ellipsis">{name.trim() || 'Takımının adı'}</b></div>
      <label className="field"><span>İsim</span><input className="input" value={name} maxLength={SOCIAL_LIMITS.teamNameMax} onChange={(e) => setName(e.target.value)} placeholder="ör. Koklea Kaşifleri" autoFocus /></label>
      <div className="field"><span>Amblem</span><div className="emoji-grid" role="radiogroup" aria-label="Amblem">{TEAM_EMBLEMS.map((e) => <button key={e} type="button" role="radio" aria-checked={emblem === e} aria-label={TEAM_EMBLEM_ART[e].name} data-emblem={e} className={`emoji-opt${emblem === e ? ' on' : ''}`} onClick={() => setEmblem(e)}><TeamEmblem e={e} /></button>)}</div></div>
      <label className="field"><span>Açıklama <i className="muted">(isteğe bağlı)</i></span><input className="input" value={desc} maxLength={140} onChange={(e) => setDesc(e.target.value)} placeholder="ör. Her gün biraz, hep birlikte." /></label>
      <div className="field"><div className="row between"><span>Katılım</span>
        <div className="seg" role="radiogroup" aria-label="Katılım"><button type="button" className={open ? 'on' : ''} aria-checked={open} role="radio" onClick={() => setOpen(true)}>Açık</button><button type="button" className={!open ? 'on' : ''} aria-checked={!open} role="radio" onClick={() => setOpen(false)}>Başvuruyla</button></div></div>
        <small className="muted small-note">{open ? 'Oyuncular listeden doğrudan katılır.' : 'Oyuncular başvurur, sen onaylarsın. Davet kodun yine doğrudan katılır.'}</small>
      </div>
      <div className="field row between"><span>En az bölüm</span>
        <div className="stepper"><button type="button" className="btn ghost small icon-btn" onClick={() => setMinLevel(Math.max(1, minLevel - 1))} aria-label="Azalt">−</button><b>{minLevel}</b><button type="button" className="btn ghost small icon-btn" onClick={() => setMinLevel(Math.min(me.highest, minLevel + 1))} aria-label="Artır">+</button></div>
      </div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      <button className="btn" disabled={busy || name.trim().length < 3} onClick={() => void submit()}>{busy ? 'Kuruluyor…' : <><TeamEmblem e={emblem} size="1.15em" className="art-inline" /> Takımı kur</>}</button>
      <div className="muted small-note">Takım kurmak ücretsiz. İsim benzersiz olmalı (3–20 karakter).</div>
    </Sheet>
  );
}
