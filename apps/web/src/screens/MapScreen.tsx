import { useEffect, useRef } from 'react';
import { BIOMES, HUMAN_JOURNEY, questById, treasureAt, type LevelPlan } from '@odi/content';
import type { BiomeId } from '@odi/shared';
import { biomeStats, calendarView, chestReady, dayKey, ensureDaily, levelProgress, nextTreasure, questDone } from '@odi/meta';
import { useStore } from '../store';
import { Bar, RewardChips } from '../ui/bits';
import { TopBar } from '../ui/social';

/** Yolculuk haritası: biyom biyom gruplanmış 40 düğüm. Kilit: önceki bölüm en az 1 yıldız. Üstte kompakt "Bugün" kartı ve sıradaki hazine. */
export function MapScreen({ onPlay, onToday }: { onPlay: (n: number) => void; onToday: () => void }) {
  const s = useStore(); const unlocked = s.highestUnlocked(); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('.node.current')?.scrollIntoView({ block: 'center' }); }, []);
  const groups: { biome: BiomeId; levels: LevelPlan[] }[] = [];
  for (const l of HUMAN_JOURNEY.levels) { const g = groups[groups.length - 1]; if (g && g.biome === l.biome) g.levels.push(l); else groups.push({ biome: l.biome, levels: [l] }); }
  const today = dayKey(); const daily = ensureDaily(s.meta.daily, today);
  const cal = calendarView(s, today); const calReady = s.lastDay === today && !cal.claimedToday;
  const treasure = nextTreasure(unlocked, s.progress, s.meta.treasures);
  const journey = biomeStats(HUMAN_JOURNEY.levels, s.progress); const lp = levelProgress(s.xp);
  const doneCount = daily.quests.filter(questDone).length;
  return (
    <div className="screen fade-in with-tabs" ref={ref}>
      <TopBar brand />

      <div className="card journey-card">
        <div className="row">
          <div className="grow min0"><h2>{HUMAN_JOURNEY.name}</h2><div className="muted">Sv {lp.level} · {journey.stars}/{journey.maxStars} ⭐{s.streak > 1 ? ` · 🔥 ${s.streak}` : ''}</div></div>
          <button className="btn" onClick={() => onPlay(unlocked)}>Bölüm {unlocked} ▶</button>
        </div>
        <Bar value={journey.pct} label="Yolculuk ilerlemesi" />
        {treasure && (
          <div className="treasure-line">
            <span className="ti">🎁</span>
            <span className="grow min0"><b>{treasure.remaining <= 1 ? 'Bu bölümün sonunda hazine!' : `${treasure.remaining} bölüm sonra hazine`}</b><RewardChips items={treasure.reward} small /></span>
          </div>
        )}
      </div>

      <button className="card today-mini" onClick={onToday} aria-label="Bugün: görevler ve takvim">
        <div className="row between"><b>☀️ Bugün</b><span className="muted">{chestReady(daily) ? '🎁 Sandık hazır!' : calReady ? `📅 ${cal.dayIndex + 1}. gün ödülü hazır` : `${doneCount}/3 görev`}</span></div>
        <div className="tm-quests">
          {daily.quests.map((q) => { const d = questById(q.id); if (!d) return null; return (
            <div className="tm-q" key={q.id}><span className="tm-e">{questDone(q) ? '✅' : d.emoji}</span><Bar value={q.progress / d.target} tone="green" label={d.text} /></div>); })}
        </div>
        <div className="tm-cal" aria-hidden>{cal.days.map((d) => <i key={d.day} className={d.state} />)}</div>
      </button>

      <div className="map">
        {groups.map((g) => { const b = BIOMES[g.biome]; const st = biomeStats(g.levels, s.progress); return (
          <div className="biome" key={g.biome + g.levels[0]!.number}>
            <div className="biome-head">
              <h2>{b.name}</h2><span className="muted">{st.stars}/{st.maxStars} ⭐</span>
            </div>
            <Bar value={st.pct} tone={st.cleared === st.total ? 'green' : 'accent'} label={`${b.name} ilerlemesi`} />
            <div className="fact">{b.fact}</div>
            <div className="nodes">
              {g.levels.map((l) => { const p = s.progress[l.number]; const locked = l.number > unlocked; const cur = l.number === unlocked; const tr = treasureAt(l.number); const trOpen = s.meta.treasures.includes(l.number); return (
                <div key={l.number} className={`node${locked ? ' locked' : ''}${cur ? ' current' : ''}`} onClick={() => { if (!locked) onPlay(l.number); }} role="button" aria-label={`Bölüm ${l.number}: ${l.name}${locked ? ', kilitli' : ''}`}>
                  {l.boss && <span className="boss">👹</span>}
                  {tr && <span className={`treasure${trOpen ? ' open' : ''}`} title={trOpen ? 'Hazine açıldı' : 'Hazine'}>{trOpen ? '✓' : '🎁'}</span>}
                  <div className="n">{l.number}</div><div className="name">{l.name}</div>
                  <div className="stars">{p ? '⭐'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : locked ? '🔒' : '☆☆☆'}</div>
                </div>); })}
            </div>
          </div>); })}
      </div>
    </div>
  );
}
