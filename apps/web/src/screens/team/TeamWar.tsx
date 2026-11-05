import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS, type RegionState, type WarState } from '@odi/shared';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { act, getNet } from '../../net';
import { platform } from '../../platform';
import { useStore } from '../../store';
import { useNav } from '../../nav';
import { Sheet, Skeleton, fmtLeft, fmtNum, useNow } from '../../ui/social';
import { Art, TeamEmblem } from '../../ui/art';
import { Icon } from '../../ui/icons';

// yılan düzeni: 1 2 3 / 6 5 4 / 7 8 9 / 12 11 10 (kulaktan beyne)
const SNAKE = [0, 1, 2, 5, 4, 3, 6, 7, 8, 11, 10, 9];
const CX = [50, 150, 250];
const PATH = SNAKE.map((_, i) => { const row = Math.floor(i / 3); const col = row % 2 === 0 ? i % 3 : 2 - (i % 3); return `${CX[col]},${row * 100 + 50}`; }).join(' ');

/**
 * Bölge Savaşı kutusunun üst cümlesi (OT-ilk-kez-oyun-66): ne yapılacağı ve bu hafta takıma getirdiğin puan (sunucu: myTeamPoints;
 * takıma katılmadan önce kazanılan sayılmaz). Hedef yokken puan bölgeye gitmez: cümle bunu söyler.
 */
export function warLede(war: Pick<WarState, 'targets' | 'myTeamPoints'>): string {
  const brought = `Bu hafta ${fmtNum(war.myTeamPoints)} puan getirdin.`;
  return war.targets.length ? `Bölüm oyna, puanın takımın hedef bölgesine gider. ${brought}` : `Bölüm oyna, puanın takıma sayılır; hedef bölge seçilince bölgeye de yazılır. ${brought}`;
}

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
  const preJoin = Math.max(0, war.myPoints - war.myTeamPoints);

  return (
    <div className="stack">
      {/* üstte tek cümle ve tek eylem; sayılar ve kurallar "Nasıl çalışır?" altında kapalı (OT-ilk-kez-oyun-66). Sayılar sunucudan (war.ts warState) */}
      <div className="card war-head">
        <div className="row between"><b><Art e="⚔️" size="1.15em" className="art-inline" /> Bölge Savaşı</b><span className="countdown"><Art e="⏳" size="1.15em" className="art-inline" /> {fmtLeft(war.endsAt - now)}</span></div>
        <p className="war-lede" data-testid="savas-ozet">{warLede(war)}</p>
        {war.targets.length === 0
          ? canLead ? <button className="btn" data-testid="savas-eylem" onClick={() => setEdit([])}><Art name="target" size="1.15em" className="art-inline" /> Hedef bölge seç</button>
            : <div className="war-cta muted">Lider henüz hedef bölge seçmedi; bu sürede kazanılan savaş puanı bölgeye yazılmaz. Sohbette öner!</div>
          : fit ? <button className="btn" data-testid="savas-eylem" onClick={() => nav.play(fit.number)}><Icon name="play" size="0.9em" className="ic-inline" /> {fit.number}. bölümü oyna · {BIOMES[fit.biome].name}</button>
          : <div className="war-cta muted">Hedef bölgelerin henüz açmadığın biyomlarda. Haritada ilerledikçe açılır.</div>}
        <details className="ilke-detay war-detay" data-testid="savas-nasil">
          <summary>Nasıl çalışır?</summary>
          <div className="war-stats"><span>Takım: <b>{fmtNum(war.teamPoints)}</b></span><span>Sen (bölgelerde): <b data-testid="savas-sen">{fmtNum(war.myRegionPoints)}</b></span><span>Hedef: <b>{war.targets.length}/{SOCIAL_LIMITS.targetsMax}</b></span></div>
          {/* döküm sunucudan (war.ts warState): bölgelere yazılan + hedefe yazılmayan = takım toplamı (OT-rekabetci-21) */}
          <div className="muted small-note war-dokum" data-testid="savas-dokum" data-bolge={war.regionPoints} data-disari={war.teamPoints - war.regionPoints} data-toplam={war.teamPoints}>
            Bölgelere yazılan <b>{fmtNum(war.regionPoints)}</b> · hedef bölgeye yazılmayan <b>{fmtNum(war.teamPoints - war.regionPoints)}</b> (bölge kazandırmaz; Takım Ligi’ne ve haftalık Sıralama’ya sayıldı).
            {war.myTeamPoints > 0 && <> Takıma getirdiğin {fmtNum(war.myTeamPoints)} puanın {fmtNum(war.myRegionPoints)} kadarı bölgelere yazıldı.</>}
          </div>
          {/* takıma katılmadan önce (takımsızken ya da önceki takımda) kazanılan pay bu takıma sayılmaz (YN-141) */}
          {preJoin > 0 && <div className="muted small-note" data-testid="savas-katilmadan-once">{fmtNum(preJoin)} puanın takıma katılmadan önce kazanıldı; takım puanına sayılmaz.</div>}
          <div className="muted small-note">Puan, biyomu eşleşen ilk hedef bölgeye yazılır; “Ninni Merkezi” hedefse her biyom sayılır. Hedef yokken ya da biyom hiçbir hedefe uymazken kazanılan puan bölgeye yazılmaz; yalnız Takım Ligi’ne ve haftalık Sıralama’ya sayılır. Puan parayla alınamaz. Hafta bitince bölge sahibi takımın her üyesine bölge başına <Art name="crystal" size="1.15em" className="art-inline" /> 50 + <Art name="coin" size="1.15em" className="art-inline" /> 300.</div>
        </details>
      </div>

      {/* hedef yokken düzenleme kutudaki "Hedef bölge seç" ile açılır (tek eylem) */}
      {canLead && (edit
        ? <div className="row"><span className="muted grow">Seç: {edit.length}/{SOCIAL_LIMITS.targetsMax}</span><button className="btn ghost small" onClick={() => setEdit(null)}>Vazgeç</button><button className="btn small" onClick={() => void save()}>Kaydet</button></div>
        : war.targets.length > 0 && <button className="btn ghost small" onClick={() => setEdit([...war.targets])}><Art e="🎯" size="1.15em" className="art-inline" /> Hedefleri düzenle</button>)}

      <div className={`war-map${edit ? ' editing' : ''}`}>
        <svg className="war-path" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden><polyline points={PATH} /></svg>
        {ordered.map((r, i) => { const idx = SNAKE[i]!; const target = targets.includes(r.id); const ours = r.owner?.teamId === team.id; return (
          <button key={r.id} className={`region${target ? ' target' : ''}${ours ? ' ours' : ''}`} style={{ gridColumn: (Math.floor(i / 3) % 2 === 0 ? i % 3 : 2 - (i % 3)) + 1, gridRow: Math.floor(i / 3) + 1 }}
            onClick={() => (edit ? toggle(r.id) : setSel(r))} aria-pressed={edit ? target : undefined} aria-label={`${r.name}${r.owner ? `, sahibi ${r.owner.name}` : ', sahipsiz'}${target ? ', hedef' : ''}`}>
            <span className="rg-n">{idx + 1}</span>{target && <span className="rg-t" aria-hidden><Art e="🎯" size="1.15em" className="art-inline" /></span>}
            <span className="rg-e" aria-hidden>{r.owner ? <TeamEmblem e={r.owner.emblem} size={26} /> : <Art name="flag" size={26} />}</span>
            <span className="rg-name">{r.name}</span>
            <span className="rg-p">{r.owner ? fmtNum(r.owner.points) : '—'}</span>
          </button>); })}
      </div>

      <div className="card">
        <b>Haftanın ilk 5 takımı</b>
        {top5.length === 0 ? <div className="muted">Henüz puan yazılmadı. İlk bayrağı siz dikin!</div> : (
          <ol className="rank-list">{top5.map(([id, t], i) => <li key={id} className={id === team.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis"><TeamEmblem e={t.emblem} size="1.15em" className="art-inline" /> {t.name}</span><b>{fmtNum(t.points)}</b></li>)}</ol>
        )}
      </div>

      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <div className="muted">Puan yazan biyomlar: {sel.biomes.map((b) => BIOMES[b as keyof typeof BIOMES]?.name ?? b).join(', ')}</div>
          <div className="muted">{sel.owner ? <>Şu an <TeamEmblem e={sel.owner.emblem} size="1.15em" className="art-inline" /> {sel.owner.name} önde ({fmtNum(sel.owner.points)}).</> : 'Henüz sahibi yok.'} Eşitlikte mevcut sahip kalır.</div>
          {sel.top.length > 0 && <ol className="rank-list">{sel.top.map((t, i) => <li key={t.teamId} className={t.teamId === team.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis"><TeamEmblem e={t.emblem} size="1.15em" className="art-inline" /> {t.name}</span><b>{fmtNum(t.points)}</b></li>)}</ol>}
          {canLead && <button className="btn" disabled={!war.targets.includes(sel.id) && war.targets.length >= SOCIAL_LIMITS.targetsMax}
            onClick={async () => { const next = war.targets.includes(sel.id) ? war.targets.filter((x) => x !== sel.id) : [...war.targets, sel.id]; const r = await act('war.targets', { regions: next }); if (r) { useNet.setState({ war: r.war }); setSel(null); } }}>
            {war.targets.includes(sel.id) ? 'Hedeften çıkar' : war.targets.length >= SOCIAL_LIMITS.targetsMax ? 'En çok 3 hedef' : <><Art name="target" size="1.15em" className="art-inline" /> Hedef yap</>}</button>}
          <button className="btn ghost" onClick={() => setSel(null)}>Kapat</button>
        </Sheet>
      )}
    </div>
  );
}
