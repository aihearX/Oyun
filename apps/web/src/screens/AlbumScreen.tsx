import { useState } from 'react';
import { BIOMES, CARDS, cardSlotText, type CardDef } from '@odi/content';
import { albumProgress, biomeHasSecret } from '@odi/meta';
import { useStore } from '../store';
import { Bar, ScreenHead } from '../ui/bits';
import { Art } from '../ui/art';

/** Kulak Kartları albümü: her biyomda 5 gerçek bilgi kartı; tamamlanan biyom rozet kazanır. */
export function AlbumScreen({ onBack }: { onBack: () => void }) {
  const s = useStore(); const owned = new Set(s.meta.cards); const album = albumProgress(s.meta.cards);
  const [open, setOpen] = useState<CardDef | null>(null);
  return (
    <div className="screen fade-in">
      <ScreenHead title="Kulak Kartları" onBack={onBack} right={<span className="pill">%{album.pct}</span>} />
      <div className="card">
        <div className="row between"><b>Albüm</b><span className="muted">{album.owned}/{album.total} kart</span></div>
        <Bar value={album.owned / album.total} tone="green" label="Albüm tamamlama" />
        <div className="muted small-note">Kartlar ilk geçiş, 3 yıldız, altın koklea (ya da hasarsız geçiş), günlük sandık ve biyomu bitirmekle açılır.</div>
      </div>
      {album.biomes.map((b) => (
        <section key={b.biome} className="album-biome">
          <div className="biome-head"><h2>{b.complete && <Art name="medal" size="1em" className="art-inline" />}{BIOMES[b.biome].name}</h2><span className="muted">{b.owned}/{b.total}</span></div>
          <div className="cards-grid">
            {CARDS.filter((c) => c.biome === b.biome).map((c) => { const has = owned.has(c.id); return (
              <button key={c.id} className={`ear-card${has ? ' has' : ''}`} onClick={() => setOpen(c)} aria-label={has ? c.title : 'Kilitli kart'}>
                <span className="ec-e">{has ? c.emoji : <Art name="question" size={22} />}</span>
                <span className="ec-t">{has ? c.title : cardSlotText(c.slot, biomeHasSecret(c.biome))}</span>
              </button>); })}
          </div>
        </section>
      ))}
      {open && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <div className="card fact-card" role="dialog" aria-label={owned.has(open.id) ? open.title : 'Kilitli kart'}>
            <div className="fc-e">{owned.has(open.id) ? open.emoji : <Art name="lock" size={48} />}</div>
            <div className="muted">{BIOMES[open.biome].name}</div>
            {owned.has(open.id) ? <><h2>{open.title}</h2><p className="fact-text">{open.fact}</p></> : <><h2>Kilitli kart</h2><p className="fact-text">Nasıl açılır: {cardSlotText(open.slot, biomeHasSecret(open.biome))}.</p></>}
            <button className="btn" onClick={() => setOpen(null)}>Tamam</button>
          </div>
        </div>
      )}
    </div>
  );
}
