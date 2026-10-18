import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { getNet } from '../../net';
import { useStore } from '../../store';
import { useNav } from '../../nav';
import { Bar } from '../../ui/bits';
import { Skeleton, fmtDate, fmtLeft, fmtNum, useNow } from '../../ui/social';

/** Baskın: Gürültü Canavarı'nın ortak can barı (canlı), katkı sıralaması, takımlar arası sıralama, pencere saati. */
export function TeamRaid() {
  const raid = useNet((s) => s.raid); const team = useNet((s) => s.team)!; const me = useNet((s) => s.me)!;
  const now = useNow(); const nav = useNav(); const unlocked = useStore((s) => s.highestUnlocked());
  const prevHp = useRef<number | null>(null); const [hit, setHit] = useState(0);
  useEffect(() => { void getNet()?.call('raid.state', {}).then((r) => useNet.setState({ raid: r.raid })).catch(() => undefined); }, []);
  useEffect(() => {
    if (!raid) return;
    if (prevHp.current != null && raid.hp < prevHp.current) { setHit(prevHp.current - raid.hp); const h = setTimeout(() => setHit(0), 1200); prevHp.current = raid.hp; return () => clearTimeout(h); }
    prevHp.current = raid.hp;
  }, [raid?.hp]);
  if (!raid) return <Skeleton rows={3} />;
  const pct = raid.maxHp ? raid.hp / raid.maxHp : 0;
  const defeated = raid.defeatedAt != null;
  return (
    <div className="stack">
      <div className={`card raid${defeated ? ' won' : ''}${hit ? ' shake' : ''}`}>
        <div className="row between"><b>Gürültü Canavarı</b><span className="countdown">{raid.open ? `⏳ kapanışa ${fmtLeft(raid.closesAt - now)}` : `🔒 açılışa ${fmtLeft(raid.opensAt - now)}`}</span></div>
        <div className="monster" aria-hidden>{defeated ? '😵' : '👹'}{hit > 0 && <span className="dmg">−{hit}</span>}</div>
        <div className="hp-row"><Bar value={pct} tone="coral" label="Canavarın canı" /><span className="qn">{fmtNum(raid.hp)}/{fmtNum(raid.maxHp)}</span></div>
        <div className="muted small-note">
          {defeated ? `Yenildi! Süre: ${Math.max(1, Math.round((raid.defeatedAt! - raid.opensAt) / 60_000))} dk. Herkesin hediye kutusuna 💎 30 + 🪙 200 düştü.`
            : raid.open ? 'Her tamamlanan bölüm vurur: 5 + 5 × yıldız hasar, boss bölümlerinde iki kat. Can: 400 + 120 × üye.'
            : `Pencere: Cuma 20:00 – Cumartesi 20:00 (${fmtDate(raid.opensAt)}). Hazırlanın: teknolojide “Baskın Gücü” hasarı artırır.`}
        </div>
        {raid.open && !defeated && <button className="btn coral" onClick={() => nav.play(unlocked)}>⚔️ Bölüm oyna, canavara vur</button>}
      </div>

      <div className="card">
        <b>Takımında en çok vuranlar</b>
        {raid.contributors.length === 0 ? <div className="muted">Henüz vuran yok. İlk darbe senden olsun!</div> : (
          <ol className="rank-list">{raid.contributors.slice(0, 10).map((c, i) => <li key={c.id} className={c.id === me.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{c.name}</span><b>{fmtNum(c.damage)}</b></li>)}</ol>
        )}
      </div>
      <div className="card">
        <b>Takımlar arası</b>
        <div className="muted small-note">Sıra: canavarı en kısa sürede yenen önde; yenemeyenler hasara göre.</div>
        {raid.ranking.length === 0 ? <div className="muted">Bu baskında henüz sıralama yok.</div> : (
          <ol className="rank-list">{raid.ranking.slice(0, 10).map((t, i) => <li key={t.teamId} className={t.teamId === team.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{t.emblem} {t.name}</span><b>{t.timeMs != null ? `${Math.max(1, Math.round(t.timeMs / 60_000))} dk` : fmtNum(t.damage)}</b></li>)}</ol>
        )}
      </div>
    </div>
  );
}
