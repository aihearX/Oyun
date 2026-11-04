import { useEffect, useRef, useState } from 'react';
import { EAR_NOTES, type EarNote } from '@odi/content/odyoloji';
import { biliyorMuydunSatiri, type BiliyorMuydun } from '@odi/content/biliyor-muydun';
import type { BiomeId } from '@odi/shared';
import { useStore } from '../store';
import { Icon } from '../ui/icons';
import { TuyDede } from './Narrator';
import { speakLine, stopVoiceIf } from './voice';

/**
 * "Tüy Dede'nin Notu · Biliyor muydun?" — doğal duraklarda (biyom tanıtımı, sonuç ekranı, harita bölge kartı) tek cümlelik,
 * dostça ve doğru bir bilgi. Ekran başına en çok bir not, kapatılabilir, hiçbir şeyi engellemez, sıklığı sınırlı.
 * İki derinlik: herkes için sade cümle + isteyene "Daha fazla" (öğrenci düzeyi). Bilgi düzeyi "Odyoloji öğrencisi" ise
 * teknik satır açık gelir (biyom tanıtımında kapalı: kart kısa kalsın, "Haydi!" ilk ekranda; YN-175) ve notlar daha sık çıkar.
 */
export type NotePlace = 'biome' | 'result' | 'map';
/** iki not arası en az süre (biyom tanıtımı hariç: orası zaten doğal bir duraktır) */
const CAP_MS = { genel: 150_000, odyoloji: 60_000 } as const;

/**
 * Biyom tanıtımının notu: o yapıyı anlatan onaylı satırlar (EAR_NOTES), sırayla ilk görülmemişi; hepsi görüldüyse ilki yine gelir
 * (tanıtım biyom başına bir kez). Başka bir yapının notu tanıtımda çıkmaz (YN-122): Apeks'te tabanın presbiakuzi notu, İşitme
 * Siniri'nde yenidoğan taraması, Beyin Sapı'nda maskeleme yok. Yeni metin yok: o yapıyı anlatan onaylı not olmayan Apeks ve İşitme
 * Siniri'nde not çıkmaz, kart biyomun onaylı bilgisini (BIOMES fact) gösterir (yeni not sahip onayı ister). Kemikçikler'de kaldıraç
 * satırı yeni seslendirme ve onay ister; stapedius refleksi ve üzengi tabanı notları kullanılır.
 */
const BIOME_NOTES: Record<BiomeId, string[]> = {
  'dis-kulak': ['kepce-yon'], kanal: ['kanal-rezonans', 'serumen-temiz'], zar: ['empedans', 'timpanometri'], kemikcikler: ['akustik-refleks', 'otoskleroz'],
  'koklea-1': ['dalga', 'presbiakuzi'], 'koklea-2': ['prestin', 'oae-not'], 'koklea-3': [], sinir: [], 'beyin-sapi': ['yon'], korteks: ['kokteyl'],
};

export function pickNote(region: BiomeId, place: NotePlace, seed = 0): EarNote | null {
  const s = useStore.getState();
  if (place !== 'biome' && Date.now() - s.noteAt < CAP_MS[s.knowledge]) return null;
  const pool = EAR_NOTES.filter((n) => n.region === region);
  const fresh = pool.filter((n) => !s.notesSeen.includes(n.id));
  // biyom tanıtımı: yalnız o yapıyı anlatan onaylı notlar; ilk görülmemişi, hepsi görüldüyse ilki (YN-175, YN-122)
  if (place === 'biome') {
    const own = BIOME_NOTES[region].flatMap((id) => pool.filter((n) => n.id === id));
    return own.find((n) => !s.notesSeen.includes(n.id)) ?? own[0] ?? null;
  }
  // hepsi görüldüyse yalnız haritada (oyuncunun açtığı kartta) tekrar edilir
  const list = fresh.length ? fresh : place === 'map' ? pool : [];
  return list.length ? list[Math.abs(seed) % list.length]! : null;
}

/**
 * Sonuç ekranının "Biliyor muydun?" satırı (karar 31): tekrarda biyomun sıradaki satırı (YN-127) ve yakın zamanda gösterilenlerden
 * farklı (kayıttaki `bilgiSonlar`; Bölüm 13 tekrarı ile ardından Bölüm 14 (YN-175), 24 → 25 → 26 tekrarı (YN-212) aynı satırı
 * göstermesin). Yalnız seçer, kaydetmez.
 */
export function pickBilgi(bolum: number, tekrar: number): BiliyorMuydun | null {
  return biliyorMuydunSatiri(bolum, tekrar, useStore.getState().bilgiSonlar);
}

/** ekran açılırken bir kez seçilen "Biliyor muydun?" satırı (yeniden çizimlerde değişmez); gösterilince kayda (son gösterilenler) yazılır */
export function useBiliyorMuydun(bolum: number, duzey: 'genel' | 'odyoloji', tekrar: number): string | null {
  const [s] = useState(() => pickBilgi(bolum, tekrar));
  useEffect(() => { if (s) useStore.getState().bilgiGoruldu(s.bolum); }, [s]);
  return s ? s[duzey] : null;
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

/** `techOpen`: teknik satırın başlangıcı (verilmezse Bilgi düzeyine göre; biyom tanıtımı kapalı verir) */
export function NoteCard({ note, voice = true, techOpen }: { note: EarNote; voice?: boolean; techOpen?: boolean }) {
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
        <MoreLine text={note.tech} initial={techOpen} />
      </div>
      <button type="button" className="en-x" aria-label="Notu kapat" onClick={(e) => { e.stopPropagation(); stopVoiceIf(talk.current); setGone(true); }}><Icon name="close" size="0.95em" /></button>
    </aside>
  );
}
