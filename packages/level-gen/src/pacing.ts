import type { ChunkSpec, Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';

/**
 * Tempo (pacing) çözümlemesi: bir odada oyuncudan GİRDİ İSTEYEN noktaların (oda içi x) kaba, durağan tahmini.
 * Otomatik koşuda "ölü bölge" = hiçbir dokunuş/kaydırma gerektirmeden geçilen uzun düz yol. Üretici bu profile bakarak
 * iki girdi arasındaki sessiz yolu ~3,5 sn'nin (≈ 900 px) altında tutar; gerekirse araya mikro oda ekler.
 * Gerçek ölçüm planlayıcı botladır (game-core `play/pacing.test.ts`); bu tahmin üreticinin hızlı kuralıdır.
 *
 * Girdi isteyen: yerdeki diken, zemin boşluğu (çukur, havuz, ufalanan/ritim köprüsü), yerden yükselen blok, yerdeki/alçak
 * düşman, koşu bandına inen tehlike (perde, nabız, dişli), duvar, gürültü duvarı, kapı, frekans kapısı, kanca, zar
 * (trambolin), yerçekimi bölgesi, sıvı. Girdi istemeyen: fırlatıcı, yay, jeton, süs, kontrol noktası.
 */

/** koşu bandı: zeminden bu yüksekliğe kadar olan tehlike koşanı vurur */
const BAND = 60;
const G = GROUND_Y;

const isFloor = (e: Entity) => (e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - G) <= 12) || (e.type === 'crumble' && Math.abs(e.y - G) <= 24);
const risesFromFloor = (e: Entity) => e.type === 'platform' && (e.h ?? 24) > 32 && e.y < G - 12 && e.y + (e.h ?? 0) >= G - 12;

/** odada girdi isteyen noktalar (oda içi x, sıralı). `flight`: yay/fırlatıcının uçuşu altında kalan noktalar sayılmaz
 *  (kahraman üstünden uçar; yavaş koşulu ilk bölümlerde bu sessizlik uzar — yalnız yardımlı bölümlerde kullanılır) */
export function actionXs(c: Pick<ChunkSpec, 'entities' | 'length'>, o: { flight?: boolean } = {}): number[] {
  const xs: number[] = [];
  const L = c.length;
  // sıvı ve yerçekimi bölgelerinin içindeki her tehlike girdi ister (yüzerek/çevirerek kaçılır)
  const zones = c.entities.filter((e) => e.type === 'water' || e.type === 'gravzone').map((e) => ({ l: e.x, r: e.x + (e.w ?? 0), t: e.y, b: e.y + (e.h ?? 0) }));
  const inZone = (e: Entity) => zones.some((z) => e.x < z.r && e.x + (e.w ?? 0) > z.l && e.y < z.b && e.y + (e.h ?? 0) > z.t);
  for (const e of c.entities) {
    const w = e.w ?? 0; const h = e.h ?? 0;
    switch (e.type) {
      case 'spike': xs.push(e.x); break;
      case 'wall': case 'barrier': case 'door': case 'freqgate': case 'hook': case 'trampoline': case 'gravzone': case 'water': case 'gear': case 'beat': case 'echo': case 'moving':
        xs.push(e.type === 'hook' ? e.x - 120 : e.x); break;
      case 'enemy': {
        const k = String(e.props?.kind ?? 'devriye');
        if (k === 'atici') xs.push(Math.max(0, e.x - Number(e.props?.range ?? 400) * 0.5));
        else if (e.y >= G - 60) xs.push(e.x - 30);
        break;
      }
      case 'hazard': {
        const top = e.y, bot = e.y + h; const dy = Number(e.props?.dy ?? 0);
        if (e.props?.chase) { xs.push(e.x + Number(e.props.start ?? 300)); break; }
        if ((bot + Math.max(0, dy) >= G - BAND && top <= G + 4) || inZone(e)) xs.push(e.x);
        break;
      }
      case 'platform': if (risesFromFloor(e)) xs.push(e.x); break;
      default: break;
    }
    void w;
  }
  // zemin boşlukları: zemin seviyesindeki kalın platformların kapsamadığı aralıklar (≥ 40 px)
  const floors = c.entities.filter(isFloor).map((e) => [e.x, e.x + (e.w ?? 0)] as [number, number]).sort((a, b) => a[0] - b[0]);
  let cover = 0;
  for (const [a, b] of floors) { if (a - cover >= 40) xs.push(cover); cover = Math.max(cover, b); }
  if (L - cover >= 40) xs.push(cover);
  const flights = o.flight ? c.entities.filter((e) => e.type === 'spring' || e.type === 'launcher').map((e) => [e.x, e.x + (e.type === 'spring' ? 480 : 700)] as const) : [];
  return [...new Set(xs.filter((x) => !flights.some(([a, b]) => x > a && x < b)).map((x) => Math.max(0, Math.min(L, Math.round(x)))))].sort((a, b) => a - b);
}

export interface QuietProfile {
  /** odaya girişten ilk girdiye kadar sessiz yol (px) */
  entry: number;
  /** son girdiden oda sonuna kadar (px) */
  exit: number;
  /** oda içindeki en uzun sessiz yol (px) */
  inner: number;
  actions: number[];
}

export function quietProfile(c: Pick<ChunkSpec, 'entities' | 'length'>, o: { flight?: boolean } = {}): QuietProfile {
  const a = actionXs(c, o);
  if (!a.length) return { entry: c.length, exit: c.length, inner: c.length, actions: a };
  let inner = 0; for (let i = 1; i < a.length; i++) inner = Math.max(inner, a[i]! - a[i - 1]!);
  return { entry: a[0]!, exit: c.length - a[a.length - 1]!, inner, actions: a };
}

/** odanın İLK girdi noktası bir zemin boşluğu (çukur) mu — boşta oyuncu orada ölür (sıvı havuzu ve zarlı çukur sayılmaz: yüzülür / sekilir) */
export function startsWithPit(c: Pick<ChunkSpec, 'entities' | 'length'>): boolean {
  const a = actionXs(c); if (!a.length) return false;
  const first = a[0]!;
  const floors = c.entities.filter(isFloor).map((e) => [e.x, e.x + (e.w ?? 0)] as [number, number]).sort((p, q) => p[0] - q[0]);
  if (c.entities.some((e) => e.type === 'water')) return false;
  let cover = 0;
  // çukurda zar varsa boşta oyuncu orada sonsuza dek seker: ölüm çukuru sayılmaz
  const tramp = (l: number, r: number) => c.entities.some((e) => e.type === 'trampoline' && e.x < r && e.x + (e.w ?? 0) > l);
  for (const [l, r] of floors) { if (l - cover >= 40) return Math.abs(cover - first) <= 2 && !tramp(cover, l); cover = Math.max(cover, r); }
  return false;
}
