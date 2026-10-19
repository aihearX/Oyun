import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { act, getNet, toast } from '../../net';
import { platform } from '../../platform';
import { useNav } from '../../nav';
import { Empty, FloatBurst, buildingDef, fmtLeft, useNow } from '../../ui/social';
import { Art, Glyph } from '../../ui/art';

/** Yardım: kamp inşaatları + bölüm yardım istekleri; tek dokunuşla "Herkese yardım et". */
export function TeamHelp() {
  const team = useNet((s) => s.team)!; const me = useNet((s) => s.me)!; const campHelp = useNet((s) => s.campHelp); const camp = useNet((s) => s.camp);
  const now = useNow(); const nav = useNav();
  const [burst, setBurst] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const net = getNet(); const off = net ? net.serverNow() - Date.now() : 0;

  const helpAll = async () => {
    setBusy('all');
    const r = await act('team.camp.helpAll', {});
    setBusy('');
    if (r) { platform().haptic('success'); setBurst(r.given > 0 ? `+${r.given} yardım` : 'Hepsi tamam'); if (r.given > 0) toast('🤝', `${r.given} inşaatı hızlandırdın`, 'Her yardım takımına güç katar.', 'green'); }
  };
  const helpOne = async (playerId: string, building: string) => {
    setBusy(playerId + building);
    const r = await act('team.camp.help', { playerId, building: building as never });
    setBusy('');
    if (r) { platform().haptic('light'); setBurst('+1 yardım'); }
  };
  const giveShield = async (id: string) => { setBusy(id); const r = await act('team.help.give', { requestId: id }); setBusy(''); if (r) { platform().haptic('success'); setBurst('+1 🛡️ gönderildi'); } };
  const askLevel = async () => { const r = await act('team.help.request', { level: me.highest }); if (r) toast('🙋', `${r.request.level}. bölüm için yardım istedin`, 'Takım arkadaşların sana kalkan gönderebilir.'); };

  const levelReqs = team.help.filter((h) => h.expiresAt > now);
  const others = levelReqs.filter((h) => h.from !== me.id);
  const mine = levelReqs.filter((h) => h.from === me.id);
  const myBuild = camp?.buildings.find((b) => b.upgradingTo && b.endsAt);

  return (
    <div className="stack">
      <div className="card help-all">
        <div className="grow min0"><b>Takım inşaatları</b><div className="muted">{campHelp.length ? `${campHelp.length} inşaat yardımını bekliyor` : 'Şu an bekleyen inşaat yok'}</div></div>
        <button className="btn big-help" disabled={!campHelp.length || busy === 'all'} onClick={() => void helpAll()}><Art e="🤝" size="1.15em" className="art-inline" /> Herkese yardım et{campHelp.length ? ` (${campHelp.length})` : ''}</button>
        {burst && <FloatBurst text={burst} onDone={() => setBurst(null)} />}
      </div>

      {campHelp.length > 0 && campHelp.map((r) => { const b = buildingDef(r.building); return (
        <div className="card help-row" key={r.playerId + r.building}>
          <span className="hr-i" aria-hidden><Glyph e={b?.emoji ?? '🏗️'} size={30} /></span>
          <div className="grow min0"><b className="ellipsis">{r.name}</b><div className="muted">{b?.name} · <Art name="hourglass" size="1.1em" className="art-inline" /> {fmtLeft(r.endsAt - (now + off))} · {r.helpsReceived}/{r.helpsMax} yardım</div></div>
          <button className="btn small" disabled={busy === r.playerId + r.building} onClick={() => void helpOne(r.playerId, r.building)}>Yardım et</button>
        </div>); })}

      <div className="row between section-head"><h2>Bölüm yardımı</h2><button className="btn ghost small" onClick={() => void askLevel()}><Art e="🙋" size="1.15em" className="art-inline" /> Yardım iste</button></div>
      <div className="muted small-note">Takılırsan iste: her yardım sana bir kalkan, yardım edene 5 jeton. Günde 3 istek.</div>
      {others.length === 0 ? <Empty icon="🫶" title="Şu an yardım isteyen yok" text="Biri takılırsa burada görünür; tek dokunuşla kalkan gönderebilirsin." /> : others.map((h) => { const done = h.helpers.includes(me.id); const full = h.helpers.length >= h.max; return (
        <div className="card help-row" key={h.id}>
          <span className="hr-i" aria-hidden><Art e="🙋" size="1.15em" className="art-inline" /></span>
          <div className="grow min0"><b className="ellipsis">{h.name}</b><div className="muted">{h.level}. bölüm · {h.helpers.length}/{h.max} yardım · <Art name="hourglass" size="1.1em" className="art-inline" /> {fmtLeft(h.expiresAt - now)}</div></div>
          <button className="btn small" disabled={done || full || busy === h.id} onClick={() => void giveShield(h.id)}>{done ? 'Gönderildi' : full ? 'Tamam' : <><Art name="shield" size="1.15em" className="art-inline" /> Gönder</>}</button>
        </div>); })}

      <h2 className="section-head">Senin isteklerin</h2>
      {!myBuild && mine.length === 0 ? <div className="muted">Şu an açık isteğin yok. Kampta bir inşaat başlatıp “Takımdan yardım iste” diyebilirsin. <button className="linkish" onClick={() => nav.tab('camp')}>Kampa git →</button></div> : null}
      {myBuild && (() => { const b = buildingDef(myBuild.id); return (
        <div className="card help-row mine">
          <span className="hr-i" aria-hidden><Glyph e={b?.emoji ?? '🏗️'} size={30} /></span>
          <div className="grow min0"><b>{b?.name} → Sv {myBuild.upgradingTo}</b><div className="muted"><Art e="⏳" size="1.15em" className="art-inline" /> {fmtLeft(myBuild.endsAt! - (now + off))} · {myBuild.helpsReceived} yardım aldın</div></div>
          <button className="btn ghost small" onClick={() => nav.tab('camp')}>Kamp</button>
        </div>); })()}
      {mine.map((h) => (
        <div className="card help-row mine" key={h.id}><span className="hr-i" aria-hidden><Art e="🛡️" size="1.15em" className="art-inline" /></span><div className="grow min0"><b>{h.level}. bölüm</b><div className="muted">{h.helpers.length}/{h.max} kalkan geldi · ödül kutuna düşer</div></div></div>
      ))}
    </div>
  );
}
