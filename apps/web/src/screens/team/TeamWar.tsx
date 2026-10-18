import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS, type RegionState } from '@odi/shared';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { act, getNet } from '../../net';
import { platform } from '../../platform';
import { useStore } from '../../store';
import { useNav } from '../../nav';
import { Sheet, Skeleton, fmtLeft, fmtNum, useNow } from '../../ui/social';

// yılan düzeni: 1 2 3 / 6 5 4 / 7 8 9 / 12 11 10 (kulaktan beyne)
const SNAKE = [0, 1, 2, 5, 4, 3, 6, 7, 8, 11, 10, 9];
const CX = [50, 150, 250];
const PATH = SNAKE.map((_, i) => { const row = Math.floor(i / 3); const col = row % 2 === 0 ? i % 3 : 2 - (i % 3); return `${CX[col]},${row * 100 + 50}`; }).join(' ');

/** Bölge Savaşı: 12 bölge, sahip amblemleri, hedefler, ilk 5, geri sayım; lider/yardımcı hedef seçer. */
export function TeamWar() {
  const war = useNet((s) => s.war); const team = useNet((s) => s.team)!; const me = useNet((s) => s.me)!;
  const now = useNow(); const nav = useNav(); const unlocked = useStore((s) => s.highestUnlocked());
  const [sel, setSel] = useState<RegionState | null>(null);
  const [edit, setEdit] = useState<string[] | null>(null);
  useEffect(() => { void getNet()?.call('war.state', {}).then((r) => useNet.setState({ war: r.war })).catch(() => undefined); }, []);
  if (!war) return <Skeleton rows={4} />;
  const myRole = team.roster.find((m) => m.id === me.id)?.role ?? 'uye';
  const canLead = myRole !== 'uye';
  const targets = edit ?? war.targets;
  const toggle = (id: string) => {
    if (!edit) return;
    platform().haptic('light');
    setEdit(edit.includes(id) ? edit.filter((x) => x !== id) : edit.length >= SOCIAL_LIMITS.targetsMax ? edit : [...edit, id]);
  };
  const save = async () => { if (!edit) return; const r = await act('war.targets', { regions: edit }); if (r) { useNet.setState({ war: r.war }); setEdit(null); platform().haptic('success'); } };

  // haftanın ilk 5 takımı (bölge puanlarının toplamı)
  const totals = new Map<string, { name: string; emblem: string; points: number }>();
  for (const r of war.regions) for (const t of r.top) { const x = totals.get(t.teamId) ?? { name: t.name, emblem: t.emblem, points: 0 }; x.points += t.points; totals.set(t.teamId, x); }
  const top5 = [...totals.entries()].sort((a, b) => b[1].points - a[1].points).slice(0, 5);

  // haritada bir sonraki uygun bölüm
  const biomes = new Set(war.targets.includes('merkez') ? Object.keys(BIOMES) : war.regions.filter((r) => war.targets.includes(r.id)).flatMap((r) => r.biomes));
  const fit = HUMAN_JOURNEY.levels.filter((l) => l.number <= unlocked && biomes.has(l.biome)).pop();
  const ordered = SNAKE.map((i) => war.regions[i]!).filter(Boolean);

  return (
    <div className="stack">
      <div className="card war-head">
        <div className="row between"><b>⚔️ Bölge Savaşı</b><span className="countdown">⏳ {fmtLeft(war.endsAt - now)}</span></div>
        <div className="war-stats"><span>Takım: <b>{fmtNum(war.teamPoints)}</b></span><span>Sen: <b>{fmtNum(war.myPoints)}</b></span><span>Hedef: <b>{war.targets.length}/{SOCIAL_LIMITS.targetsMax}</b></span></div>
        <div className="muted small-note">Bölüm oyna → puanın hedef bölgeye yazılır. Biyomu eşleşen ilk hedefe gider; “Ninni Merkezi” hedefse her biyom sayılır. Puan parayla alınamaz. Hafta bitince bölge sahibi takımın her üyesine bölge başına 💎 50 + 🪙 300.</div>
        {war.targets.length === 0 ? <div className="war-cta muted">{canLead ? 'Henüz hedef yok: aşağıdan en çok 3 bölge seç.' : 'Liderin hedef seçmesini bekle; sohbette öner!'}</div>
          : fit ? <button className="btn" onClick={() => nav.play(fit.number)}>▶ {fit.number}. bölümü oyna · {BIOMES[fit.biome].name}</button>
          : <div className="war-cta muted">Hedef bölgelerin henüz açmadığın biyomlarda. Haritada ilerledikçe açılır.</div>}
      </div>

      {canLead && (edit
        ? <div className="row"><span className="muted grow">Seç: {edit.length}/{SOCIAL_LIMITS.targetsMax}</span><button className="btn ghost small" onClick={() => setEdit(null)}>Vazgeç</button><button className="btn small" onClick={() => void save()}>Kaydet</button></div>
        : <button className="btn ghost small" onClick={() => setEdit([...war.targets])}>🎯 Hedefleri düzenle</button>)}

      <div className={`war-map${edit ? ' editing' : ''}`}>
        <svg className="war-path" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden><polyline points={PATH} /></svg>
        {ordered.map((r, i) => { const idx = SNAKE[i]!; const target = targets.includes(r.id); const ours = r.owner?.teamId === team.id; return (
          <button key={r.id} className={`region${target ? ' target' : ''}${ours ? ' ours' : ''}`} style={{ gridColumn: (Math.floor(i / 3) % 2 === 0 ? i % 3 : 2 - (i % 3)) + 1, gridRow: Math.floor(i / 3) + 1 }}
            onClick={() => (edit ? toggle(r.id) : setSel(r))} aria-pressed={edit ? target : undefined} aria-label={`${r.name}${r.owner ? `, sahibi ${r.owner.name}` : ', sahipsiz'}${target ? ', hedef' : ''}`}>
            <span className="rg-n">{idx + 1}</span>{target && <span className="rg-t" aria-hidden>🎯</span>}
            <span className="rg-e" aria-hidden>{r.owner?.emblem ?? '🏳️'}</span>
            <span className="rg-name">{r.name}</span>
            <span className="rg-p">{r.owner ? fmtNum(r.owner.points) : '—'}</span>
          </button>); })}
      </div>

      <div className="card">
        <b>Haftanın ilk 5 takımı</b>
        {top5.length === 0 ? <div className="muted">Henüz puan yazılmadı. İlk bayrağı siz dikin!</div> : (
          <ol className="rank-list">{top5.map(([id, t], i) => <li key={id} className={id === team.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{t.emblem} {t.name}</span><b>{fmtNum(t.points)}</b></li>)}</ol>
        )}
      </div>

      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <div className="muted">Puan yazan biyomlar: {sel.biomes.map((b) => BIOMES[b as keyof typeof BIOMES]?.name ?? b).join(', ')}</div>
          <div className="muted">{sel.owner ? `Şu an ${sel.owner.emblem} ${sel.owner.name} önde (${fmtNum(sel.owner.points)}).` : 'Henüz sahibi yok.'} Eşitlikte mevcut sahip kalır.</div>
          {sel.top.length > 0 && <ol className="rank-list">{sel.top.map((t, i) => <li key={t.teamId} className={t.teamId === team.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{t.emblem} {t.name}</span><b>{fmtNum(t.points)}</b></li>)}</ol>}
          {canLead && <button className="btn" disabled={!war.targets.includes(sel.id) && war.targets.length >= SOCIAL_LIMITS.targetsMax}
            onClick={async () => { const next = war.targets.includes(sel.id) ? war.targets.filter((x) => x !== sel.id) : [...war.targets, sel.id]; const r = await act('war.targets', { regions: next }); if (r) { useNet.setState({ war: r.war }); setSel(null); } }}>
            {war.targets.includes(sel.id) ? 'Hedeften çıkar' : war.targets.length >= SOCIAL_LIMITS.targetsMax ? 'En çok 3 hedef' : '🎯 Hedef yap'}</button>}
          <button className="btn ghost" onClick={() => setSel(null)}>Kapat</button>
        </Sheet>
      )}
    </div>
  );
}
