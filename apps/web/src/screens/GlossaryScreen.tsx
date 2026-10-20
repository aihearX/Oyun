import { useMemo, useState } from 'react';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { GLOSSARY, type GlossaryTerm } from '@odi/content/odyoloji';
import type { BiomeId } from '@odi/shared';
import { useStore } from '../store';
import { clearedCount } from '../ftue/features';
import { MoreLine } from '../ftue/Notes';
import { ScreenHead } from '../ui/bits';
import { Art } from '../ui/art';
import { AnatomyGlyph } from '../ui/anatomy';

/** sözlükteki bölge sırası: kulaktan beyne */
const ORDER: BiomeId[] = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];

/** oyuncunun ulaştığı bölgeler: geçtiği bölümlerin ve sıradaki bölümün biyomları */
export function reachedRegions(cleared: number): Set<BiomeId> {
  const upto = Math.min(HUMAN_JOURNEY.levels.length, cleared + 1);
  return new Set(HUMAN_JOURNEY.levels.slice(0, upto).map((l) => l.biome));
}

/**
 * Kulak Sözlüğü: bölgelere ulaştıkça açılan terimler. Her terimde küçük bir çizim, herkes için sade tanım ve isteğe bağlı
 * teknik tanım ("Daha fazla"). Önce sade Türkçe ad, sonra terim: "Kulak zarı (timpanik membran)".
 */
export function GlossaryScreen({ onBack }: { onBack: () => void }) {
  const progress = useStore((s) => s.progress);
  const reached = useMemo(() => reachedRegions(clearedCount(progress)), [progress]);
  const [q, setQ] = useState('');
  const open = GLOSSARY.filter((g) => reached.has(g.region));
  const norm = (x: string) => x.toLocaleLowerCase('tr');
  const hit = (g: GlossaryTerm) => !q.trim() || norm(`${g.term} ${g.plain}`).includes(norm(q.trim()));
  return (
    <div className="screen fade-in glossary" data-testid="sozluk">
      <ScreenHead title="Kulak Sözlüğü" onBack={onBack} right={<span className="pill">{open.length}/{GLOSSARY.length}</span>} />
      <div className="card gl-intro">
        <div className="muted">Yolculukta ulaştığın her bölgenin terimleri burada açılır. Önce sade anlatım; “Daha fazla” ile odyoloji ayrıntısı.</div>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Terim ara (ör. koklea)" aria-label="Terim ara" />
      </div>
      {ORDER.map((r) => {
        const terms = GLOSSARY.filter((g) => g.region === r);
        if (!terms.length) return null;
        if (!reached.has(r)) return (
          <section key={r} className="gl-region locked" data-region={r}>
            <div className="gl-head"><h2><Art name="lock" size="0.95em" className="art-inline" /> {BIOMES[r].name}</h2><span className="muted">{terms.length} terim · bölgeye ulaşınca açılır</span></div>
          </section>
        );
        const shown = terms.filter(hit);
        if (!shown.length) return null;
        return (
          <section key={r} className="gl-region" data-region={r}>
            <div className="gl-head"><h2>{BIOMES[r].name}</h2><span className="muted">{terms.length} terim</span></div>
            {shown.map((g) => (
              <article key={g.id} className="card gl-term" data-term={g.id}>
                <span className="gl-art" aria-hidden><AnatomyGlyph region={g.region} size={38} /></span>
                <div className="gl-body">
                  <h3>{g.term}</h3>
                  <p className="gl-plain">{g.plain}</p>
                  <MoreLine text={g.tech} />
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
