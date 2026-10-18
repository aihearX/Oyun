import { useEffect, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import type { RunResult } from '@odi/shared';
import { regionForBiome, useSocial } from '../net';
import { useNav } from '../nav';
import { Bar } from './bits';
import { fmtNum } from './social';

/** Sayaç: 0'dan hedefe (azaltılmış harekette anında) */
function useCount(to: number, reduced: boolean, delay = 0): number {
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) { setV(to); return; }
    let raf = 0; let t0 = 0;
    const tick = (t: number) => { if (!t0) t0 = t + delay; const k = Math.max(0, Math.min(1, (t - t0) / 700)); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [to, reduced, delay]);
  return v;
}

/** Sonuç ekranında takım katkısı: "Takımına katkın: +24 savaş puanı → Koklea Tabanı", baskın, lig, jeton (sunucu onayından). */
export function TeamContribution({ runId, result, reduced }: { runId: string; result: RunResult; reduced: boolean }) {
  const run = useSocial((s) => (s.lastRun?.runId === runId ? s.lastRun : null));
  const team = useNet((s) => s.team); const war = useNet((s) => s.war); const raid = useNet((s) => s.raid);
  const ack = run?.ack;
  const war$ = useCount(ack?.warPoints ?? 0, reduced, 0);
  const raid$ = useCount(ack?.raidDamage ?? 0, reduced, 140);
  const lig$ = useCount(ack?.leaguePoints ?? 0, reduced, 280);
  const jet$ = useCount(ack?.jeton ?? 0, reduced, 420);
  const nav = useNav();
  if (!run || run.state === 'yok') return null;
  if (run.state === 'kuyrukta') return <div className="team-contrib"><div className="tc-line muted">📡 Çevrimdışısın: sonucun kuyrukta. Bağlanınca takımına ve ligine yazılır.</div></div>;
  if (run.state === 'gonderiliyor') return <div className="team-contrib"><div className="tc-line muted">👥 Takımına yazılıyor…</div></div>;
  if (run.state === 'hata' || !ack) return <div className="team-contrib"><div className="tc-line muted">Sunucu bu sonucu saymadı: {run.error}</div></div>;
  const region = team && war ? regionForBiome(war.targets, run.biome) : null;
  const bonus = ack.jeton - result.coins;
  const lines: ReactNode[] = [];
  if (team && ack.warPoints > 0) lines.push(<><span className="tc-i">⚔️</span><span>Takımına katkın: <b>+{war$} savaş puanı</b>{region ? <> → <b>{region.name}</b></> : <span className="muted"> (hedef bölge seçilmemiş)</span>}</span></>);
  if (team && ack.raidDamage > 0) lines.push(<><span className="tc-i">👹</span><span className="grow"><span>Gürültü Canavarı’na <b>−{raid$} hasar</b></span>{raid && raid.maxHp > 0 && <Bar value={raid.hp / raid.maxHp} tone="coral" label="Canavarın canı" />}</span></>);
  if (ack.leaguePoints > 0) lines.push(<><span className="tc-i">🏆</span><span><b>+{lig$} lig puanı</b> bu haftaki grubunda</span></>);
  if (ack.jeton > 0) lines.push(<><span className="tc-i">🪙</span><span><b>+{fmtNum(jet$)} jeton</b> hesabına{bonus > 0 ? <span className="muted"> (kamp/takım bonusu +{bonus})</span> : null}</span></>);
  if (!team && ack.warPoints > 0) lines.push(<><span className="tc-i">👥</span><span className="grow">Bir takımda olsaydın bu koşu <b>+{ack.warPoints} savaş puanı</b> yazardı. <button className="linkish" onClick={(e) => { e.stopPropagation(); nav.tab('team'); }}>Takım bul →</button></span></>);
  if (!lines.length) return null;
  return (
    <div className="team-contrib" aria-live="polite">
      {lines.map((l, i) => <div className="tc-line" key={i} style={{ animationDelay: `${reduced ? 0 : i * 140}ms` }}>{l}</div>)}
    </div>
  );
}
