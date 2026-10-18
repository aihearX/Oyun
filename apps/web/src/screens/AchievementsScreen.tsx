import { ACHIEVEMENTS, TIER_NAMES, achievementDesc, type Tier } from '@odi/content';
import { achievementNext, computeMetrics } from '@odi/meta';
import { useStore } from '../store';
import { Bar, ScreenHead } from '../ui/bits';

/** Başarımlar: bronz/gümüş/altın kademeler, sıradaki kademeye gerçek ilerleme. */
export function AchievementsScreen({ onBack }: { onBack: () => void }) {
  const s = useStore(); const m = computeMetrics(s);
  const tiers = Object.values(s.meta.achievements).reduce((a, t) => a + t, 0); const max = ACHIEVEMENTS.reduce((a, x) => a + x.tiers.length, 0);
  const sorted = [...ACHIEVEMENTS].sort((a, b) => { const pa = achievementNext(a, m[a.metric] ?? 0, s.meta.achievements[a.id] ?? 0)?.pct ?? -1; const pb = achievementNext(b, m[b.metric] ?? 0, s.meta.achievements[b.id] ?? 0)?.pct ?? -1; return pb - pa; });
  return (
    <div className="screen fade-in">
      <ScreenHead title="Başarımlar" onBack={onBack} right={<span className="pill">{tiers}/{max}</span>} />
      <div className="muted">{ACHIEVEMENTS.length} başarım, her biri bronz → gümüş → altın. Hepsi oynayarak gelir.</div>
      <div className="ach-list">
        {sorted.map((a) => { const have = s.meta.achievements[a.id] ?? 0; const v = m[a.metric] ?? 0; const next = achievementNext(a, v, have); return (
          <div className={`ach${have ? ' got' : ''}`} key={a.id}>
            <span className="ae">{a.emoji}</span>
            <div className="grow min0">
              <div className="row between"><b className="ellipsis">{a.name}</b><span className="medals" aria-label={have ? TIER_NAMES[have as Tier] : 'henüz yok'}>{a.tiers.map((_, i) => <i key={i} className={`m${i + 1}${have > i ? ' on' : ''}`} />)}</span></div>
              <div className="muted wrap">{next ? achievementDesc(a, (have + 1) as Tier) : `Tamamlandı · ${achievementDesc(a, have as Tier)}`}</div>
              {next && <div className="row qbar"><Bar value={next.pct} tone="amber" label={a.name} /><span className="qn">{Math.min(v, next.target).toLocaleString('tr-TR')}/{next.target.toLocaleString('tr-TR')}</span></div>}
            </div>
          </div>); })}
      </div>
    </div>
  );
}
