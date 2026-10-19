import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS, type TeamSummary } from '@odi/shared';
import { act, errText, getNet, toast } from '../../net';
import { platform } from '../../platform';
import { Empty, Sheet, Skeleton, fmtNum } from '../../ui/social';
import { Art, Glyph } from '../../ui/art';

const EMBLEMS = ['👂', '🦻', '🎧', '🎵', '🎶', '🐚', '🔊', '🌀', '⭐', '🔥', '🌙', '🦉', '🐬', '🦋', '🍀', '🌈', '⚡', '🛡️', '🏰', '🎺'];
const PERKS = [
  { icon: '🔬', title: 'Ortak teknoloji', text: 'Bağışlar herkesi güçlendirir: jeton, kalkan, hız.' },
  { icon: '🎁', title: 'Takım hediyeleri', text: 'Hedef ve baskın ödülleri herkese düşer.' },
  { icon: '⚔️', title: 'Bölge Savaşı', text: 'Oynadıkça kulak haritasında bölge kap.' },
  { icon: '👹', title: 'Baskın', text: 'Gürültü Canavarı’nı birlikte yenin.' },
  { icon: '🤝', title: 'Yardım', text: 'Tek dokunuşla inşaatlar hızlanır.' },
];

/** Takımsızken: faydalar, önerilen açık takımlar, arama, kodla katıl, takım kur. */
export function TeamBrowse() {
  const me = useNet((s) => s.me)!;
  const [q, setQ] = useState('');
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const c = getNet(); if (!c) return;
    let alive = true;
    const h = setTimeout(() => { c.call('team.list', q.trim() ? { query: q.trim() } : {}).then((r) => { if (alive) { setTeams(r.teams); setErr(''); } }, (e) => alive && setErr(errText(e))); }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(h); };
  }, [q]);

  const joined = (name: string) => { platform().haptic('success'); toast('🎉', `${name} takımına hoş geldin!`, 'Sohbette bir merhaba de.', 'green'); };
  const join = async (t: TeamSummary) => { setBusy(t.id); const r = await act('team.join', { teamId: t.id }); setBusy(''); if (r) { useNet.setState({ team: r.team }); joined(r.team.name); } };
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
        <form className="row" onSubmit={(e) => { e.preventDefault(); void joinCode(); }}>
          <input className="input grow" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ör. K7M2QX" maxLength={8} aria-label="Takım davet kodu" autoCapitalize="characters" />
          <button className="btn small" disabled={!code.trim() || busy === 'kod'}>Katıl</button>
        </form>
      </div>

      <div className="row between"><h2>Önerilen takımlar</h2><span className="muted">güce göre</span></div>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Takım ara" aria-label="Takım ara" />
      {err && <div className="chat-err">{err}</div>}
      {!teams ? <Skeleton rows={3} /> : teams.length === 0 ? (
        <Empty icon="🌱" title={q ? 'Bu isimde açık takım yok' : 'Henüz açık takım yok'} text="İlk takımı sen kur; arkadaşlarını kodla davet et." >
          <button className="btn small" onClick={() => setCreating(true)}>＋ Takım kur</button>
        </Empty>
      ) : (
        <div className="team-list">
          {teams.map((t) => { const locked = me.highest < t.minLevel; const full = t.members >= t.max; return (
            <div className="card team-row" key={t.id}>
              <span className="tr-emblem" aria-hidden>{t.emblem}</span>
              <div className="grow min0">
                <b className="ellipsis">{t.name}</b>
                <div className="tr-meta"><span><Art e="👥" size="1.15em" className="art-inline" /> {t.members}/{t.max}</span><span><Art e="⚡" size="1.15em" className="art-inline" /> {fmtNum(t.power)}</span>{t.minLevel > 1 && <span><Art e="🔓" size="1.15em" className="art-inline" /> {t.minLevel}. bölüm</span>}</div>
                {t.description && <div className="muted tr-desc">{t.description}</div>}
              </div>
              <button className="btn small" disabled={locked || full || busy === t.id} onClick={() => void join(t)}>{full ? 'Dolu' : locked ? `${t.minLevel}. bölüm` : 'Katıl'}</button>
            </div>); })}
        </div>
      )}
      {creating && <CreateTeam onClose={() => setCreating(false)} onDone={(name) => { setCreating(false); joined(name); }} />}
    </>
  );
}

function CreateTeam({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const me = useNet((s) => s.me)!;
  const [name, setName] = useState(''); const [emblem, setEmblem] = useState('👂'); const [desc, setDesc] = useState('');
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
      <div className="create-preview"><span className="cp-emblem">{emblem}</span><b className="ellipsis">{name.trim() || 'Takımının adı'}</b></div>
      <label className="field"><span>İsim</span><input className="input" value={name} maxLength={SOCIAL_LIMITS.teamNameMax} onChange={(e) => setName(e.target.value)} placeholder="ör. Koklea Kaşifleri" autoFocus /></label>
      <div className="field"><span>Amblem</span><div className="emoji-grid" role="radiogroup" aria-label="Amblem">{EMBLEMS.map((e) => <button key={e} type="button" role="radio" aria-checked={emblem === e} className={`emoji-opt${emblem === e ? ' on' : ''}`} onClick={() => setEmblem(e)}>{e}</button>)}</div></div>
      <label className="field"><span>Açıklama <i className="muted">(isteğe bağlı)</i></span><input className="input" value={desc} maxLength={140} onChange={(e) => setDesc(e.target.value)} placeholder="ör. Her gün biraz, hep birlikte." /></label>
      <div className="field row between"><span>Katılım</span>
        <div className="seg" role="radiogroup"><button type="button" className={open ? 'on' : ''} aria-checked={open} role="radio" onClick={() => setOpen(true)}>Herkese açık</button><button type="button" className={!open ? 'on' : ''} aria-checked={!open} role="radio" onClick={() => setOpen(false)}>Kodla</button></div>
      </div>
      <div className="field row between"><span>En az bölüm</span>
        <div className="stepper"><button type="button" className="btn ghost small icon-btn" onClick={() => setMinLevel(Math.max(1, minLevel - 1))} aria-label="Azalt">−</button><b>{minLevel}</b><button type="button" className="btn ghost small icon-btn" onClick={() => setMinLevel(Math.min(me.highest, minLevel + 1))} aria-label="Artır">+</button></div>
      </div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      <button className="btn" disabled={busy || name.trim().length < 3} onClick={() => void submit()}>{busy ? 'Kuruluyor…' : <><span data-ugc>{emblem}</span> Takımı kur</>}</button>
      <div className="muted small-note">Takım kurmak ücretsiz. İsim benzersiz olmalı (3–20 karakter).</div>
    </Sheet>
  );
}
