import type { ChunkSpec, Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';

/**
 * Bölge patolojileri (content/src/patolojiler.ts): bölgenin VAR OLAN engellerini kulak hastalığı olarak işaretler. Geometri,
 * zamanlama ve çarpışma değişmez (zorluk eğrisi aynı kalır); yalnız `props.patoloji` eklenir ve düşmeyle ilgili patolojiler
 * için çarpışmasız bir bölge (`decor`, kind 'patoloji') konur. Oyun ilk görüşte adı ve Tüy Dede'nin cümlesini gösterir;
 * Tedavi Odası malzemesi (LevelOptions.remedies) o patolojinin ilk karşılaşmasını bir kez etkisiz kılar (sim.ts).
 *
 * Eşleme (bölge → engel → patoloji):
 * - kanal: serumen yığını → serumen-tikaci · kıl perdesi → otitis-eksterna · diken → eksostoz (kemik çıkıntısı)
 * - zar: zemindeki çukur → perforasyon (zarın deliği; düşme bölgesi) · plaklı zar → timpanoskleroz · çöken cep → retraksiyon
 * - kemikcikler: temas anahtarlı kapı → ostaki · çakılma anahtarlı kapı → otoskleroz · hareketli köprülü çukur → zincir-kopuk
 *   · yükselip çekilen sıvı → otitis-media
 * - koklea-1/2/3: durgun gürültü bulutu → gurultu-hasari · inip kalkan damla → ototoksisite · ufalanan basamak → presbiakuzi
 *   · hareketli platform ve asansör → meniere
 * - sinir: gürültü duvarı → noroma · ritim basamağı → noropati; beyin-sapi: ritim basamağı → noropati
 * - korteks: yankı basamağı → merkezi · nabızlı (zamanlı) bulut → tinnitus
 */
export const PATOLOJI_ZONE = 'patoloji';

/**
 * Bölge patolojisi odaları (tag 'patoloji-oda'; normal oda havuzunda yok): yalnız burada adı geçen bölümde, gelişim bölüm-içi
 * bölümünün ikinci odası olarak eklenir. Zar sertleşmesi (plaklı zar) 10, zar çekilmesi (çöken cep) 11, orta kulakta sıvı 14.
 */
export const PATHOLOGY_ROOMS: Record<number, string[]> = { 10: ['zr-plak'], 11: ['zr-cep'], 14: ['km-sivi'] };

const tag = (e: Entity, id: string): Entity => ({ ...e, props: { ...(e.props ?? {}), patoloji: id } });
const zone = (x: number, w: number, id: string): Entity => ({ type: 'decor', x, y: GROUND_Y, w, props: { kind: PATOLOJI_ZONE, patoloji: id } });

/** zemindeki çukurlar (yüksek zemin blokları arasında ≥ 40 px açıklık; oda kenarındakiler sayılmaz) */
export function floorPits(c: ChunkSpec): [number, number][] {
  const floors = c.entities.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - GROUND_Y) <= 12)
    .map((e) => [e.x, e.x + (e.w ?? 0)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = []; let cover = -1;
  for (const [a, b] of floors) { if (cover >= 0 && a - cover >= 40) out.push([cover, a]); cover = Math.max(cover, b); }
  return out;
}

const isCurtain = (e: Entity) => e.type === 'hazard' && !!e.props?.curtain;
const isPulse = (e: Entity) => e.type === 'hazard' && Number(e.props?.on ?? 0) > 0;
const moves = (e: Entity) => Number(e.props?.dy ?? 0) !== 0;

function tagChunk(c: ChunkSpec, biome: string): ChunkSpec {
  const ents = c.entities; let out: Entity[] | null = null;
  const set = (i: number, id: string) => { out ??= ents.slice(); out[i] = tag(ents[i]!, id); };
  const extra: Entity[] = [];
  const koklea = biome.startsWith('koklea');
  ents.forEach((e, i) => {
    if (e.props?.patoloji) return;
    if (biome === 'kanal') {
      if (isCurtain(e)) set(i, 'otitis-eksterna');
      else if (e.type === 'hazard' && e.props?.kind === 'serumen') set(i, 'serumen-tikaci');
      else if (e.type === 'spike') set(i, 'eksostoz');
    } else if (biome === 'zar') {
      if (e.type === 'trampoline' && e.props?.plak) set(i, 'timpanoskleroz');
      else if (e.type === 'lift' && e.props?.sag) set(i, 'retraksiyon');
    } else if (biome === 'kemikcikler') {
      if (e.type === 'hazard' && e.props?.kind === 'sivi') set(i, 'otitis-media');
      else if (e.type === 'door' && e.props?.open !== true) {
        const sw = ents.find((s) => s.type === 'switch' && s.props?.id === e.props?.id);
        if (sw?.props?.by === 'temas') set(i, 'ostaki'); else if (sw?.props?.by === 'cakil') set(i, 'otoskleroz');
      }
    } else if (koklea) {
      if (e.type === 'hazard' && !isCurtain(e) && !isPulse(e)) set(i, moves(e) ? 'ototoksisite' : 'gurultu-hasari');
      else if (e.type === 'moving' || e.type === 'lift') set(i, 'meniere');
      else if (e.type === 'crumble') { set(i, 'presbiakuzi'); extra.push(zone(e.x - 20, (e.w ?? 110) + 40, 'presbiakuzi')); }
    } else if (biome === 'sinir' || biome === 'beyin-sapi') {
      if (e.type === 'barrier' && biome === 'sinir') set(i, 'noroma');
      else if (e.type === 'beat') { set(i, 'noropati'); extra.push(zone(e.x - 20, (e.w ?? 110) + 40 + Number(e.props?.dx ?? 0), 'noropati')); }
    } else if (biome === 'korteks') {
      if (e.type === 'echo') { set(i, 'merkezi'); extra.push(zone(e.x - 20, (e.w ?? 110) + 40, 'merkezi')); }
      else if (isPulse(e)) set(i, 'tinnitus');
    }
  });
  if (biome === 'zar') for (const [a, b] of floorPits(c)) extra.push(zone(a, b - a, 'perforasyon'));
  if (biome === 'kemikcikler' && ents.some((e) => e.type === 'moving')) {
    for (const [a, b] of floorPits(c)) if (ents.some((e) => e.type === 'moving' && e.x < b && e.x + (e.w ?? 120) + Math.max(0, Number(e.props?.dx ?? 0)) > a)) extra.push(zone(a, b - a, 'zincir-kopuk'));
  }
  if (!out && !extra.length) return c;
  return { ...c, entities: [...(out ?? ents), ...extra] };
}

/** bölümün odalarını bölge patolojileriyle işaretler (boss bölümlerinde oda yok) */
export function tagPathologies(chunks: ChunkSpec[], biome: string): ChunkSpec[] {
  if (biome === 'dis-kulak') return chunks;
  return chunks.map((c) => tagChunk(c, biome));
}

/** bir bölümde görünen patoloji kimlikleri (oda sırasıyla, tekrarsız) */
export function pathologiesIn(chunks: ChunkSpec[]): string[] {
  const seen: string[] = [];
  for (const c of chunks) for (const e of c.entities) { const p = e.props?.patoloji; if (typeof p === 'string' && !seen.includes(p)) seen.push(p); }
  return seen;
}
