/**
 * Profil fotoğrafı (1.1.0): isteğe bağlı, herkese görünür. Sunucu: apps/server/src/foto.ts, kurallar: @odi/shared PHOTO_RULES.
 * - Görünen oyuncuların fotoğraf sürümleri burada tutulur: profilde gelen sürüm (PublicProfile.photo), 'photo.changed' olayı ya da
 *   toplu sorgu ('photo.of', görünen kimlikler kısa aralıkla birleştirilir). Fotoğraf yoksa ya da yüklenemezse renkli Odi çizilir.
 * - Yükleme: telefonda platform().pickPhoto (kare JPEG data URL), tarayıcıda dosya seçici; tuvalde 256×256 JPEG'e küçültülür,
 *   HTTP ile gönderilir (POST /foto, oturum anahtarıyla).
 */
import { PHOTO_RULES, serverHttpEndpoint } from '@odi/shared';
import { platform } from '../platform';
import { notePhoto, photoNet as getNet } from './foto-store';
export { notePhoto, usePhoto, markBadPhoto, usePhotos } from './foto-store';

// ------------------------------------------------------------------ seçme, küçültme, gönderme
/** tarayıcıda dosya seçtir (telefonda platform().pickPhoto) */
function pickFile(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.style.display = 'none';
    let done = false;
    const end = (b: Blob | null) => { if (done) return; done = true; input.remove(); resolve(b); };
    input.addEventListener('change', () => end(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => end(null));
    document.body.appendChild(input);
    input.click();
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('resim'));
    img.src = src;
  });
}

/** ortadan kare kırp, 256×256 JPEG; sunucu sınırına sığana kadar kaliteyi düşür */
export async function toSquareJpeg(src: string): Promise<Blob> {
  const img = await loadImage(src);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('resim');
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_RULES.size; canvas.height = PHOTO_RULES.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('tuval');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.75, 0.6, 0.45]) {
    const b = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (b && b.size <= PHOTO_RULES.maxBytes) return b;
  }
  throw new Error('buyuk');
}

export type PhotoPick = { ok: true; v: number } | { ok: false; error: string } | null;

/** fotoğraf seç, küçült, gönder. Vazgeçilirse null. */
export async function chooseAndUpload(onStage?: (s: 'kucult' | 'gonder') => void): Promise<PhotoPick> {
  const p = platform();
  let src: string | null = null; let revoke: string | null = null;
  try {
    if (p.pickPhoto) src = await p.pickPhoto();
    else { const f = await pickFile(); if (f) { src = URL.createObjectURL(f); revoke = src; } }
  } catch { return { ok: false, error: 'Fotoğraf açılamadı.' }; }
  if (!src) return null;
  let blob: Blob;
  onStage?.('kucult');
  try { blob = await toSquareJpeg(src); } catch { return { ok: false, error: 'Bu resim kullanılamadı; başka bir fotoğraf dener misin?' }; } finally { if (revoke) URL.revokeObjectURL(revoke); }
  onStage?.('gonder');
  return uploadPhoto(blob);
}

/** POST /foto (oturum anahtarıyla) */
export async function uploadPhoto(blob: Blob): Promise<Exclude<PhotoPick, null>> {
  const url = serverHttpEndpoint(platform().serverUrl(), 'foto');
  if (!url) return { ok: false, error: 'Sunucuya bağlı değilsin.' };
  const token = await platform().storage.getItem('odi.net.token').catch(() => null);
  if (!token) return { ok: false, error: 'Önce sunucuya bağlanmalısın.' };
  try {
    const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' }, body: blob });
    const j = await r.json().catch(() => ({})) as { ok?: boolean; v?: number; error?: string };
    if (!r.ok || !j.v) return { ok: false, error: j.error ?? 'Fotoğraf gönderilemedi; bir daha dener misin?' };
    // kendi profilim (me.photo) yenilensin
    const c = getNet();
    if (c) { const me = c.me; if (me) notePhoto(me.id, j.v); void c.call('profile.update', {}).catch(() => undefined); }
    return { ok: true, v: j.v };
  } catch { return { ok: false, error: 'Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden dene.' }; }
}

/** kendi fotoğrafını kaldır */
export async function removePhoto(): Promise<boolean> {
  const c = getNet(); if (!c) return false;
  try { const r = await c.call('photo.remove', {}); notePhoto(r.me.id, undefined); void c.call('profile.update', {}).catch(() => undefined); return true; } catch { return false; }
}
