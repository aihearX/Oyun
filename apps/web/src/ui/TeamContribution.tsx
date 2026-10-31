import { useEffect, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { regionForBiome, useSocial } from '../net';
import { useNav } from '../nav';
import { Bar } from './bits';
import { Art } from './art';
import { useFeatures } from '../ftue/useFeatures';

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

/**
 * Sonuç ekranında takım katkısı: "Takımına katkın: +24 savaş puanı → Koklea Tabanı", baskın, lig (sunucu onayından).
 * Jeton sonuç ekranının "Bu bölümden" dökümünde. Takımı olmayana gönderim satırı, Takım/Lig açılmadan savaş/lig satırı yok (YN-042).
 */
export function TeamContribution({ runId, reduced }: { runId: string; reduced: boolean }) {
  const run = useSocial((s) => (s.lastRun?.runId === runId ? s.lastRun : null));
  const team = useNet((s) => s.team); const war = useNet((s) => s.war); const raid = useNet((s) => s.raid); const st = useNet((s) => s.status); const hasMe = useNet((s) => !!s.me);
  const ack = run?.ack;
  const war$ = useCount(ack?.warPoints ?? 0, reduced, 0);
  const raid$ = useCount(ack?.raidDamage ?? 0, reduced, 140);
  const lig$ = useCount(ack?.leaguePoints ?? 0, reduced, 280);
  const nav = useNav(); const feat = useFeatures(); const ligOpen = feat.open('league');
  if (!run || run.state === 'yok') return null;
  // bekleyen sonuç nereye yazılacak: yalnız oyuncunun gerçekten sahip olduğu/açtığı yerler
  const dest = team && ligOpen ? 'takımına ve ligine' : team ? 'takımına' : ligOpen ? 'ligine' : 'hesabına';
  // gönderilirken bağlantı koptu (sunucu yeniden başlıyor): sonuç kaybolmaz, bağlanınca aynı kimlikle bir kez yazılır (MK-019)
  if ((run.state === 'gonderiliyor' || run.state === 'kuyrukta') && st !== 'bağlı' && hasMe) return <div className="team-contrib"><div className="net-banner" role="status" data-testid="sonuc-kopuk"><Art name="signal" size={18} /> Bağlantı koptu — yeniden bağlanıyor… Sonucun kayıtlı; bağlanınca {dest} yazılır.</div></div>;
  if (run.state === 'kuyrukta') return <div className="team-contrib"><div className="tc-line muted"><Art name="signal" size={20} /> Çevrimdışısın: sonucun kuyrukta. Bağlanınca {dest} yazılır.</div></div>;
  if (run.state === 'gonderiliyor') return !team ? null : <div className="team-contrib"><div className="tc-line muted"><Art name="users" size={20} /> Takımına yazılıyor…</div></div>;
  if (run.state === 'hata' || !ack) return <div className="team-contrib"><div className="tc-line muted">Sunucu bu sonucu saymadı: {run.error}</div></div>;
  const region = team && war ? regionForBiome(war.targets, run.biome) : null;
  const lines: ReactNode[] = [];
  if (team && ack.warPoints > 0) lines.push(<><span className="tc-i"><Art name="swords" /></span><span>Takımına katkın: <b>+{war$} savaş puanı</b>{region ? <> → <b>{region.name}</b></> : <span className="muted"> (hedef bölge seçilmemiş)</span>}</span></>);
  if (team && ack.raidDamage > 0) lines.push(<><span className="tc-i"><Art name="monster" /></span><span className="grow"><span>Gürültü Canavarı’na <b>−{raid$} hasar</b></span>{raid && raid.maxHp > 0 && <Bar value={raid.hp / raid.maxHp} tone="coral" label="Canavarın canı" />}</span></>);
  if (ligOpen && ack.leaguePoints > 0) lines.push(<><span className="tc-i"><Art name="trophy" /></span><span><b>+{lig$} lig puanı</b> bu haftaki grubunda</span></>);
  if (!team && feat.open('team') && ack.warPoints > 0) lines.push(<><span className="tc-i"><Art name="users" /></span><span className="grow">Bir takımda olsaydın bu koşu <b>+{ack.warPoints} savaş puanı</b> yazardı. <button className="linkish" onClick={(e) => { e.stopPropagation(); nav.tab('team'); }}>Takım bul →</button></span></>);
  if (!lines.length) return null;
  return (
    <div className="team-contrib" aria-live="polite">
      {lines.map((l, i) => <div className="tc-line" key={i} style={{ animationDelay: `${reduced ? 0 : i * 140}ms` }}>{l}</div>)}
    </div>
  );
}
