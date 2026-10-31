import { ABILITIES, BIOMES, MECHANICS } from '@odi/content';
import type { LevelSpec } from '@odi/shared';
import { useEffect, useState } from 'react';
import { platform } from '../platform';
import { Art, Glyph } from '../ui/art';
import { Icon } from '../ui/icons';
import { NoteCard, useNote } from '../ftue/Notes';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
/**
 * Kontroller: her hareket ayrı satır. Bölümdeki bütün yetenekler bu bölümde yeni açılıyorsa (yolculuğun ilk bölümü) yalnız onların
 * hareketleri; geri kalanı ilk gerektiği yerde öğretici anda (el işaretiyle) gösterilir.
 */
function moves(spec: LevelSpec): string[] {
  const a = spec.abilities ?? []; const fresh = spec.newAbilities ?? [];
  const lines = a.length && a.every((x) => fresh.includes(x)) ? a.flatMap((x) => ABILITIES[x].how.split(' · ')) : MECHANICS[spec.mechanic].hint.split(' · ');
  return lines.map((l) => l.trim()).filter(Boolean);
}
/** İlk kez girilen biyom için kısa sinematik kart. Tek dokunuşla geçilir. */
export function BiomeIntro({ spec, onGo }: { spec: LevelSpec; onGo: () => void }) {
  const b = BIOMES[spec.biome]; const m = MECHANICS[spec.mechanic];
  const [ready, setReady] = useState(false);
  // ekran başına en çok bir bilgi: Tüy Dede'nin Notu varsa biyom bilgisinin yerini alır
  const note = useNote(spec.biome, 'biome', true, spec.number);
  useEffect(() => { platform().haptic('medium'); const t = setTimeout(() => setReady(true), 500); return () => clearTimeout(t); }, []);
  const dark = ['kanal', 'sinir', 'beyin-sapi'].includes(spec.biome);
  return (
    <div className={`biome-intro${dark ? ' dark' : ''}`} style={{ ['--b1' as string]: hex(b.palette.bgFar), ['--b2' as string]: hex(b.palette.bgNear), ['--ba' as string]: hex(b.palette.accent) }} onClick={() => { if (ready) onGo(); }}>
      <div className="bi-rings" aria-hidden><i /><i /><i /></div>
      <div className="bi-body">
        <div className="bi-kicker">Yeni biyom</div>
        <h1 className="bi-title">{b.name}</h1>
        <p className="bi-blurb">{b.blurb}</p>
        {/* ne yapacağını önce okusun: kontroller notun üstünde */}
        <div className="bi-mech">
          <div className="bi-mech-head"><Glyph e={m.icon} size="1.2em" /> {`${m.name}:`}</div>
          <ul className="bi-moves">{moves(spec).map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
        {note ? <NoteCard note={note} /> : <div className="bi-fact"><Art name="ear" size="1.2em" className="art-inline" /> {b.fact}</div>}
        <button className="btn" style={{ opacity: ready ? 1 : 0 }} onClick={(e) => { e.stopPropagation(); onGo(); }}>Haydi! <Icon name="play" size="0.9em" className="ic-inline" /></button>
      </div>
    </div>
  );
}
