/** Harita kartları: bölüm kartı, hazine önizlemesi, bölge (biyom) kartı. Alt tabaka, dokununca kapanır. */
import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BIOMES, BOSSES, HUMAN_JOURNEY, MECHANICS, treasureAt } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { albumProgress, biomeStats } from '@odi/meta';
import { nextVitalityNeed, VITALITY_NAMES, ZONE_PLACE, zoneVitality, type StarMap, type ZoneId } from '@odi/game-core';
import type { BiomeId } from '@odi/shared';
import { useStore } from '../store';
import { RewardChips } from '../ui/bits';
import { treasureItems } from './goals';
import { Art, Glyph } from '../ui/art';
import { Icon } from '../ui/icons';
import { NoteCard, useNote } from '../ftue/Notes';
import { GLOSSARY } from '@odi/content/odyoloji';

export type MapCard = { kind: 'node'; n: number } | { kind: 'treasure'; n: number } | { kind: 'zone'; z: ZoneId };

function Sheet({ onClose, children, tone }: { onClose: () => void; children: ReactNode; tone?: string }) {
  // gövdeye taşınır: haritanın sabit katmanı sekme çubuğunun altında kalmasın
  return createPortal(
    <div className="map-sheet-wrap" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`map-sheet${tone ? ` ${tone}` : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const Stars = ({ n, big }: { n: number; big?: boolean }) => <span className={`mc-stars${big ? ' big' : ''}`} aria-label={`${n} yıldız`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}><Art e="★" size="1.15em" className="art-inline" /></i>)}</span>;

export function MapCards({ card, stars, unlocked, onClose, onPlay }: { card: MapCard | null; stars: StarMap; unlocked: number; onClose: () => void; onPlay: (n: number) => void }) {
  if (!card) return null;
  if (card.kind === 'node') return <NodeCard n={card.n} unlocked={unlocked} onClose={onClose} onPlay={onPlay} />;
  if (card.kind === 'treasure') return <TreasureCard n={card.n} unlocked={unlocked} onClose={onClose} />;
  return <ZoneCard z={card.z} stars={stars} onClose={onClose} />;
}

function NodeCard({ n, unlocked, onClose, onPlay }: { n: number; unlocked: number; onClose: () => void; onPlay: (n: number) => void }) {
  const l = HUMAN_JOURNEY.levels[n - 1]!; const b = BIOMES[l.biome]; const m = MECHANICS[l.mechanic];
  const p = useStore((s) => s.progress[n]); const locked = n > unlocked;
  // hedef: oynanacak bölümün gerçek hedef metni (üretici aynı girdilerle aynı bölümü kurar)
  const goal = useMemo(() => { const s = useStore.getState(); try { return generateLevel(s.journey, n, { recentStars: 2, failStreak: s.failStreak, skills: s.skills }).objective.label; } catch { return ''; } }, [n]);
  const tr = treasureAt(n); const boss = l.boss ? BOSSES[l.boss] : null;
  return (
    <Sheet onClose={onClose}>
      <div className="mc-head" style={{ ['--acc' as string]: hex(b.palette.accent) }}>
        <div className="mc-medal">{boss ? <Art name="monster" size={30} /> : n}</div>
        <div className="min0">
          <div className="mc-kicker">{b.name} · Bölüm {n}</div>
          <h2>{l.name}</h2>
        </div>
      </div>
      <Stars n={p?.stars ?? 0} big />
      <div className="mc-rows">
        <div className="mc-row"><span><Glyph e={m.icon} size={22} /></span><b>{m.name}</b><span className="mc-dim">{m.hint}</span></div>
        {goal && <div className="mc-row"><span><Art e="🎯" size="1.15em" className="art-inline" /></span><b>Hedef</b><span className="mc-dim">{goal}</span></div>}
        {boss && <div className="mc-row"><span><Art e="👹" size="1.15em" className="art-inline" /></span><b>{boss.name}</b><span className="mc-dim">{boss.hp} can · {boss.phases} evre</span></div>}
        {p && p.best > 0 && <div className="mc-row"><span><Art e="🏅" size="1.15em" className="art-inline" /></span><b>En iyi skor</b><span className="mc-dim">{p.best.toLocaleString('tr-TR')}</span></div>}
        {tr && <div className="mc-row"><span><Art e="🎁" size="1.15em" className="art-inline" /></span><b>Hazine</b><RewardChips items={tr.reward} small /></div>}
      </div>
      {locked
        ? <button className="map-btn locked" disabled><Art e="🔒" size="1.15em" className="art-inline" /> {n - 1}. bölümü geç</button>
        : <button className="map-btn shine" onClick={() => { onClose(); onPlay(n); }}>{p?.stars ? 'Tekrar oyna' : 'Oyna'} <Icon name="play" size="0.9em" className="ic-inline" /></button>}
    </Sheet>
  );
}

function TreasureCard({ n, unlocked, onClose }: { n: number; unlocked: number; onClose: () => void }) {
  const meta = useStore((s) => s.meta); const open = meta.treasures.includes(n);
  const items = open ? treasureItems(meta, n) : treasureAt(n)?.reward ?? [];
  const left = Math.max(0, n - unlocked + 1);
  return (
    <Sheet onClose={onClose} tone="gold">
      <div className="mc-chest" aria-hidden><Art name={open ? 'mail' : 'chest'} size={48} /></div>
      <h2 className="center">Hazine · Bölüm {n}</h2>
      <div className="mc-dim center">{open ? 'Bu hazineyi açtın. İçinden çıkanlar:' : left <= 1 ? 'Bu bölümü bitirince açılır! İçinde:' : `${left} bölüm sonra açılır. İçinde:`}</div>
      <div className="center"><RewardChips items={items} /></div>
      <div className="mc-dim center small">İçerik önceden belli; şans yok.</div>
      <button className="map-btn" onClick={onClose}>Tamam</button>
    </Sheet>
  );
}

function ZoneCard({ z, stars, onClose }: { z: ZoneId; stars: StarMap; onClose: () => void }) {
  const progress = useStore((s) => s.progress); const cards = useStore((s) => s.meta.cards);
  const v = zoneVitality(z, stars);
  const note = useNote(z === 'finale' ? null : (z as BiomeId), 'map', v > 0, Date.now() % 97);
  if (z === 'finale') {
    return (
      <Sheet onClose={onClose} tone="gold">
        <div className="mc-chest" aria-hidden><Art e="👑" size="1.15em" className="art-inline" /></div>
        <h2 className="center">Ninni Merkezi</h2>
        <div className="mc-dim center">Yolculuğun sonu: annenin ninnisi burada anlama dönüşür. Son bölümü bitirince ışıkları yanar; tüm yıldızlarla parıl parıl parlar.</div>
        <Vital v={v} />
        <button className="map-btn" onClick={onClose}>Tamam</button>
      </Sheet>
    );
  }
  const b = BIOMES[z as BiomeId]; const ls = HUMAN_JOURNEY.levels.filter((l) => l.biome === z); const st = biomeStats(ls, progress);
  const alb = albumProgress(cards).biomes.find((x) => x.biome === z);
  const need = nextVitalityNeed(z as BiomeId, stars);
  const terms = GLOSSARY.filter((g) => g.region === z);
  const needText = !need ? 'Bu bölge ışıl ışıl! Tüm yıldızlar senin.' : need.to === 1 ? 'Önceki bölgeyi bitirince uyanır.' : need.clears ? `${need.clears} bölüm daha geç: ${VITALITY_NAMES[need.to].toLowerCase()}.` : `${need.stars} yıldız daha: ışıl ışıl.`;
  return (
    <Sheet onClose={onClose}>
      <div className="mc-head" style={{ ['--acc' as string]: hex(b.palette.accent) }}>
        <div className="mc-medal"><Art e="🗺️" size="1.15em" className="art-inline" /></div>
        <div className="min0"><div className="mc-kicker">{ZONE_PLACE[z]}</div><h2>{b.name}</h2></div>
      </div>
      <div className="mc-dim">{b.blurb}</div>
      <Vital v={v} />
      {note && <NoteCard note={note} />}
      <div className="mc-rows">
        <div className="mc-row"><span><Art e="⭐" size="1.15em" className="art-inline" /></span><b>Yıldız</b><span className="mc-dim">{st.stars}/{st.maxStars} · {st.cleared}/{st.total} bölüm</span></div>
        {alb && <div className="mc-row"><span><Art e="🃏" size="1.15em" className="art-inline" /></span><b>Kulak Kartları</b><span className="mc-dim">{alb.owned}/{alb.total}{alb.complete ? ' · rozet!' : ''}</span></div>}
        {terms.length > 0 && <div className="mc-row"><span><Art name="bulb" size="1.15em" className="art-inline" /></span><b>Kulak Sözlüğü</b><span className="mc-dim">{terms.map((t) => t.term.split(' (')[0]).slice(0, 3).join(', ')}{terms.length > 3 ? ` +${terms.length - 3}` : ''}</span></div>}
        <div className="mc-row"><span><Art e="🌱" size="1.15em" className="art-inline" /></span><b>Sıradaki</b><span className="mc-dim">{needText}</span></div>
      </div>
      <div className="mc-fact"><Art e="👂" size="1.15em" className="art-inline" /> {b.fact}</div>
      <button className="map-btn" onClick={onClose}>Tamam</button>
    </Sheet>
  );
}
function Vital({ v }: { v: number }) {
  return (
    <div className="mc-vital" aria-label={`Canlanma: ${VITALITY_NAMES[v as 0]}`}>
      {[1, 2, 3, 4].map((i) => <i key={i} className={i <= v ? 'on' : ''} />)}
      <b>{VITALITY_NAMES[v as 0]}</b>
    </div>
  );
}
