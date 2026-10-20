import { useEffect, useRef, useState } from 'react';
import { EAR_NOTES, type EarNote } from '@odi/content/odyoloji';
import type { BiomeId } from '@odi/shared';
import { useStore } from '../store';
import { Icon } from '../ui/icons';
import { TuyDede } from './Narrator';
import { speakLine, stopVoiceIf } from './voice';

/**
 * "Tüy Dede'nin Notu · Biliyor muydun?" — doğal duraklarda (biyom tanıtımı, sonuç ekranı, harita bölge kartı) tek cümlelik,
 * dostça ve doğru bir bilgi. Ekran başına en çok bir not, kapatılabilir, hiçbir şeyi engellemez, sıklığı sınırlı.
 * İki derinlik: herkes için sade cümle + isteyene "Daha fazla" (öğrenci düzeyi). Bilgi düzeyi "Odyoloji öğrencisi" ise
 * teknik satır açık gelir ve notlar daha sık çıkar.
 */
export type NotePlace = 'biome' | 'result' | 'map';
/** iki not arası en az süre (biyom tanıtımı hariç: orası zaten doğal bir duraktır) */
const CAP_MS = { genel: 150_000, odyoloji: 60_000 } as const;

export function pickNote(region: BiomeId, place: NotePlace, seed = 0): EarNote | null {
  const s = useStore.getState();
  if (place !== 'biome' && Date.now() - s.noteAt < CAP_MS[s.knowledge]) return null;
  const pool = EAR_NOTES.filter((n) => n.region === region);
  const fresh = pool.filter((n) => !s.notesSeen.includes(n.id));
  // hepsi görüldüyse yalnız haritada (oyuncunun açtığı kartta) tekrar edilir
  const list = fresh.length ? fresh : place === 'map' ? pool : [];
  return list.length ? list[Math.abs(seed) % list.length]! : null;
}

/** ekran açılırken bir kez seçilen not (yeniden çizimlerde değişmez) */
export function useNote(region: BiomeId | null | undefined, place: NotePlace, enabled = true, seed = 0): EarNote | null {
  const [note] = useState(() => (enabled && region ? pickNote(region, place, seed) : null));
  return note;
}

/** "Daha fazla" ile açılan teknik satır (albüm, sözlük ve notlar ortak) */
export function MoreLine({ text, initial }: { text: string; initial?: boolean }) {
  const odyo = useStore((s) => s.knowledge === 'odyoloji');
  const [open, setOpen] = useState(initial ?? odyo);
  return (
    <div className="more-line">
      {open && <p className="ml-tech">{text}</p>}
      <button type="button" className="ml-btn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {open ? 'Daha az' : 'Daha fazla'} <Icon name="chevron" size="0.9em" className={`ic-inline${open ? ' up' : ''}`} />
      </button>
    </div>
  );
}

export function NoteCard({ note, voice = true }: { note: EarNote; voice?: boolean }) {
  const [gone, setGone] = useState(false);
  const talk = useRef(-1);
  useEffect(() => {
    useStore.getState().noteShown(note.id);
    if (voice) talk.current = speakLine(note.plain, `not-${note.id}`);
    return () => stopVoiceIf(talk.current);
  }, [note.id]); // bir kez: not değişince yeniden
  if (gone) return null;
  return (
    <aside className="ear-note" data-testid="tuy-notu" data-note={note.id} onClick={(e) => e.stopPropagation()} aria-label="Tüy Dede'nin Notu">
      <span className="en-face" aria-hidden><TuyDede size={46} talking={false} mood="wink" /></span>
      <div className="en-body">
        <div className="en-k">Tüy Dede’nin Notu · Biliyor muydun?</div>
        <p className="en-plain">{note.plain}</p>
        <MoreLine text={note.tech} />
      </div>
      <button type="button" className="en-x" aria-label="Notu kapat" onClick={(e) => { e.stopPropagation(); stopVoiceIf(talk.current); setGone(true); }}><Icon name="close" size="0.95em" /></button>
    </aside>
  );
}
