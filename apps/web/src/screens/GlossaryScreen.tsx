import { useMemo, useState } from 'react';
import { BIOMES, BUILDING_INFO, CAMP_TERMS, HUMAN_JOURNEY, openCampTerms } from '@odi/content';
import { BUILDINGS, type BuildingId } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { GLOSSARY, type GlossaryTerm } from '@odi/content/odyoloji';
import type { BiomeId } from '@odi/shared';
import { useStore } from '../store';
import { clearedCount } from '../ftue/features';
import { MoreLine } from '../ftue/Notes';
import { ScreenHead } from '../ui/bits';
import { Art } from '../ui/art';
import { AnatomyGlyph } from '../ui/anatomy';
import '../camp/camp.css';

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
  // Kulak Kampı: bina seviyesiyle açılan terimler (kamp sunucudadır; bağlı değilse kilitli görünür)
  const camp = useNet((s) => s.camp);
  const campOpen = useMemo(() => new Set(openCampTerms((b) => camp?.buildings.find((x) => x.id === b)?.level ?? 0).map((t) => t.id)), [camp]);
  const norm = (x: string) => x.toLocaleLowerCase('tr');
  const hit = (g: GlossaryTerm) => !q.trim() || norm(`${g.term} ${g.plain}`).includes(norm(q.trim()));
  return (
    <div className="screen fade-in glossary" data-testid="sozluk">
      <ScreenHead title="Kulak Sözlüğü" onBack={onBack} right={<span className="pill">{open.length + campOpen.size}/{GLOSSARY.length + CAMP_TERMS.length}</span>} />
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
      <CampTerms open={campOpen} hit={hit} />
    </div>
  );
}

const bName = (b: BuildingId) => BUILDINGS.find((x) => x.id === b)?.name ?? b;
/** Kulak Kampı terimleri: binayı yükselttikçe açılır (açık olanlar tam, kilitliler hangi binanın kaçıncı seviyesiyle açılacağını söyler) */
function CampTerms({ open, hit }: { open: Set<string>; hit: (g: GlossaryTerm) => boolean }) {
  const shown = CAMP_TERMS.filter((t) => open.has(t.id) && hit(t)); const locked = CAMP_TERMS.filter((t) => !open.has(t.id));
  return (
    <section className="gl-region gl-camp" data-region="kamp">
      <div className="gl-head"><h2><Art name="tent" size="0.95em" className="art-inline" /> Kulak Kampı</h2><span className="muted">{open.size}/{CAMP_TERMS.length} terim · binaları yükselttikçe açılır</span></div>
      {shown.map((g) => (
        <article key={g.id} className="card gl-term" data-term={g.id}>
          <span className="gl-art" aria-hidden><AnatomyGlyph region={g.region} size={38} /></span>
          <div className="gl-body">
            <h3>{g.term}</h3>
            <p className="gl-plain">{g.plain}</p>
            <MoreLine text={g.tech} />
            <div className="gl-from">{bName(g.building)} Sv {g.level}</div>
          </div>
        </article>
      ))}
      {locked.length > 0 && (
        <div className="card gl-locked-list">
          {locked.map((t) => <div key={t.id} className="gl-locked" data-locked-term={t.id}><Art name="lock" size={16} /> <span>{bName(t.building)} Sv {t.level}</span><i title={BUILDING_INFO[t.building].plain}>yeni terim</i></div>)}
        </div>
      )}
    </section>
  );
}
