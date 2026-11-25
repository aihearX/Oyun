/**
 * Profil fotoğrafı sürümleri (1.1.0): avatarlar (ui/OdiAvatar.tsx) buradan okur. Bilinmeyen kimlikler kısa aralıkla birleşen toplu
 * sorguyla ('photo.of') sorulur; 'photo.changed' olayı sürümü hemen yeniler. Ağ istemcisi net.ts'ten bağlanır (bindPhotos);
 * bu dosya net.ts'i içe aktarmaz (avatar her yerde çizilir, paket bağımlılığı hafif kalsın).
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { photoUrl } from '@odi/shared';
import type { NetClient } from '@odi/net';
import { platform } from '../platform';

interface PhotoState {
  /** oyuncu → sürüm (0: fotoğraf yok) */
  v: Record<string, number>;
  /** yüklenemeyen adresler (renkli Odi'ye düşülür) */
  bad: Record<string, true>;
}
export const usePhotos = create<PhotoState>()(() => ({ v: {}, bad: {} }));

/** toplu sorgu: sorulan zaman (yeniden sormak için) ve bekleyenler */
const asked = new Map<string, number>();
const queue = new Set<string>();
const ASK_TTL_MS = 10 * 60_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let bound: NetClient | null = null;
const getNet = () => bound;
/** bağlı istemci (yükleme sonrası profil yenileme; foto.ts net.ts'i içe aktarmasın diye) */
export const photoNet = () => bound;

/** net.ts startNet: fotoğraf olayları ve toplu sorgu bu istemciyle */
export function bindPhotos(c: NetClient): void {
  if (bound === c) return;
  bound = c;
  c.on('photo.changed', ({ id, v }) => { asked.set(id, Date.now()); usePhotos.setState((s) => ({ v: { ...s.v, [id]: v } })); });
  c.onStatus((st) => { if (st === 'bağlı' && queue.size) flushSoon(); });
  if (c.status === 'bağlı' && queue.size) flushSoon();
}

function flushSoon(): void {
  if (timer) return;
  timer = setTimeout(() => { timer = null; void flush(); }, 80);
}

async function flush(): Promise<void> {
  const c = getNet();
  if (!c || c.status !== 'bağlı' || !queue.size) return;
  const ids = [...queue].slice(0, 100);
  for (const id of ids) queue.delete(id);
  try {
    const { photos } = await c.call('photo.of', { ids });
    const now = Date.now();
    usePhotos.setState((s) => {
      const v = { ...s.v };
      for (const id of ids) { v[id] = photos[id] ?? 0; asked.set(id, now); }
      return { v };
    });
  } catch { for (const id of ids) asked.delete(id); }
  if (queue.size) flushSoon();
}

/** kimliğin fotoğrafını (gerekirse) sor */
function want(id: string): void {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return; // oyuncu kimliği değil (ör. sistem kartı): sorulmaz
  const t = asked.get(id);
  if (t !== undefined && Date.now() - t < ASK_TTL_MS) return;
  asked.set(id, Date.now());
  queue.add(id);
  // istemci henüz yoksa ya da bağlı değilse bağlanınca sorulur (bindPhotos, onStatus)
  if (getNet()?.status === 'bağlı') flushSoon();
}

/** profilde gelen sürümü kaydet (ör. kendi profilim, yükleme sonrası) */
export function notePhoto(id: string, v: number | undefined): void {
  asked.set(id, Date.now());
  usePhotos.setState((s) => (s.v[id] === (v ?? 0) ? s : { v: { ...s.v, [id]: v ?? 0 } }));
}

/**
 * Oyuncunun fotoğraf adresi ya da boş. `known`: profilde gelen sürüm (varsa; olay ya da sorgu daha yeniyse o geçerli).
 * Bilinmiyorsa kısa aralıkla birleşen toplu sorgu gönderilir.
 */
export function usePhoto(id: string | undefined, known?: number): string {
  const stored = usePhotos((s) => (id ? s.v[id] : undefined));
  useEffect(() => { if (id && known === undefined && stored === undefined) want(id); }, [id, known, stored]);
  const v = stored ?? known;
  const url = id && v ? photoUrl(platform().serverUrl(), id, v) : '';
  const bad = usePhotos((s) => (url ? !!s.bad[url] : false));
  return bad ? '' : url;
}
export const markBadPhoto = (url: string) => usePhotos.setState((s) => ({ bad: { ...s.bad, [url]: true } }));

