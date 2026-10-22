import type { AbilityId, ChunkSpec, Entity, LevelSpec, ModifierId, PlayerSkills } from '@odi/shared';
import { mulberry32, hashString, pick, GROUND_Y } from '@odi/shared';
import { ALL_CHUNKS, BOSSES, MODIFIERS, abilitiesAt, chunkNeeds, journeyById, newAbilitiesAt, objective, type LevelPlan } from '@odi/content';
import { quietProfile, startsWithPit } from './pacing';
import { CURVE_ZONES, knobsFor, tuningAt, zoneOf, zonePos, type LevelKnobs } from './curve';
import { predictDmg, roomStats } from './rooms';
import { KALIBRASYON } from './kalibrasyon';
import { tagPathologies } from './patoloji';

/**
 * İmza gösterileri: bölümün kendine ait doruğu (tag 'imza'; döngüdeki gösterilerden çıkarılır). 4 "Rüzgârla Yarış" → rüzgâr
 * kapılarıyla bayrak yarışı; 8 "Damlalar" (Kanal finali) → Damla Sınavı (docs/12 §8).
 */
export const SIGNATURE: Record<number, string> = { 4: 'dk-sp-ruzgar-yarisi', 8: 'kn-sp-damla-sinavi' };

export interface PlayerProfile {
  /** son 5 bölümdeki ortalama yıldız (0-3); dinamik zorluk */
  recentStars: number;
  /** aynı bölümde üst üste başarısızlık */
  failStreak: number;
  skills: PlayerSkills;
}

export const DEFAULT_PROFILE: PlayerProfile = { recentStars: 2, failStreak: 0, skills: { doubleJump: false, longSlide: false, magnet: 0, shield: 0, breath: 0, echoSight: false } };

/** bir bölümde en çok nota (docs/11 §5) */
export const MAX_NOTES = 100;

/**
 * Bölümün zorluk düğmeleri (docs/12-zorluk-egrisi.md, `curve.ts`) + uyarlanabilir yardım. Profil yalnızca YUMUŞAK bir yardımdır:
 * aynı bölümde üst üste 3 başarısızlık bir kademe, 5 başarısızlık iki kademe kolaylaştırır; usta oyuncu (son 5 bölüm ort. ≥ 2,8 yıldız)
 * yalnızca ilk bölgeden sonra, final ve boss olmayan bölümlerde çok küçük bir ek alır — ilk bölümler asla zorlaşmaz.
 */
export function levelKnobs(number: number, profile: PlayerProfile = DEFAULT_PROFILE): LevelKnobs {
  const n = Math.min(40, Math.max(1, number));
  const ease = profile.failStreak >= 5 ? 2 : profile.failStreak >= 3 ? 1 : 0;
  const z = zoneOf(n);
  const bonus = !ease && profile.recentStars >= 2.8 && n > 5 && n !== z.peak && n % 20 !== 0 ? 0.06 : 0;
  return knobsFor(n, { ease, bonus });
}
/** geriye uyum: 1..5 ölçeğinde zorluk (hedef beklenen can kaybından) */
export function difficultyFor(number: number, profile: PlayerProfile = DEFAULT_PROFILE): number {
  return Math.max(1, Math.min(5, 1 + (4 * levelKnobs(number, profile).lambda) / 2.2));
}

/** değiştiriciler artık rastgele değil: eğrinin sabit tablosu (yalnız ileri bölgeler ve finaller; `curve.ts`) */
function pickModifiers(plan: LevelPlan, knobs: LevelKnobs): ModifierId[] {
  if (plan.mechanic === 'boss') return [];
  return knobs.modifiers.filter((m) => MODIFIERS[m] && !(m === 'ters-yercekimi' && abilitiesAt(plan.number).includes('cevir')));
}

/** odanın bu bölümün düğmelerine uyup uymadığı (`strict` 0 tam, 1 boşluk/iniş serbest, 2 aile serbest, 3 yalnız tavan ×1,6) */
function knobOk(c: ChunkSpec, k: LevelKnobs, strict: number): boolean {
  const st = roomStats(c);
  // tek oda bölümün tahmini can kaybı hedefinin yarısından fazlasını yemesin (tek odalık ani zorluk sıçraması yok)
  if (predictDmg(c, k.tight) > Math.max(0.07, 0.5 * k.lambda)) return false;
  // ilk üç bölümde hareketli, ritim, ufalanan, yankı ve asansör basamağı yok (her kısıt düzeyinde)
  if (k.early.noMoving && c.entities.some((e) => MOVING.has(e.type))) return false;
  // ilk beş bölümde geri dönüş bulmacası yalnız öğretici odasında (normal odada dönüş gerekmez)
  if (k.assist?.turnOnlyWhenNeeded && chunkNeeds(c).includes('don')) return false;
  // yavaş koşulu ilk bölümler: odanın kendi sessiz yolları tempo sınırına sığmalı (mikro oda yalnız odalar ARASINA girer)
  if (k.assist) {
    const lim = PACE_LIMIT * (k.assist.run / 260); const q = quietProfile(applyEarly(c, k), { flight: true });
    if (!q.actions.length || q.inner > lim || q.entry > lim - 200 || q.exit > lim - 200) return false;
  }
  if (strict >= 3) return st.score <= k.roomMax * 1.5;
  if (st.score > k.roomMax) return false;
  if (!st.enemies.every((e) => k.enemies.includes(e))) return false;
  if (strict < 2 && st.families.length > k.maxFamilies) return false;
  if (strict < 1 && (st.maxGap > k.maxGap || st.minLanding < k.minLanding)) return false;
  return true;
}
const MOVING = new Set(['moving', 'beat', 'crumble', 'echo', 'lift']);
/** ilk bölümün tehlikeleri: diken, düşman, tehlike alanı (1. bölümde hiçbiri yok) */
const HARM = new Set(['spike', 'enemy', 'hazard', 'gear']);
/**
 * İlk bölümlerin içerik kısıtları (docs/12 §4): 1. bölümde (2-3'te öğretici odası dışında, 4-12'de kontrol noktası odasında)
 * diken/düşman/tehlike alanı kaldırılır,
 * zemindeki diken küçük çukura dönüşür (zıplama ritmi korunur); 1-3'te zemin çukurları en çok `maxPit` px'e daralır (sağdaki
 * zemin uzar: iniş geniş kalır).
 */
function applyEarly(c: ChunkSpec, k: Pick<LevelKnobs, 'early'>): ChunkSpec {
  const ea = k.early; if (!ea.noHazards && ea.maxPit >= 9999 && !ea.softHazards) return c;
  let ents = c.entities.map((e) => ({ ...e }));
  if (ea.softHazards) for (const e of ents) {
    if (e.type !== 'hazard' || e.props?.dy || e.props?.chase) continue;
    const kind = String(e.props?.kind ?? ''); const w = e.w ?? 60, h = e.h ?? 60; const bot = e.y + h;
    // zemindeki serumen yığını: dar ve alçak (kısa zıplama yeter); perde (altından kayılan): dar
    if (kind === 'serumen' && Math.abs(bot - (GROUND_Y + 8)) <= 10 && h <= 80) { const nw = Math.max(36, Math.round(w * 0.7)); e.x += Math.round((w - nw) / 2); e.w = nw; e.y = bot - 52; e.h = 52; }
    else if (h >= 120 && e.y <= GROUND_Y - 150 && bot >= GROUND_Y - 40 && bot <= GROUND_Y) { const nw = Math.max(80, Math.round(w * 0.7)); e.x += Math.round((w - nw) / 2); e.w = nw; }
  }
  if (ea.noHazards === 'hepsi' || (ea.noHazards === 'ogretici-disi' && !isTutorial(c)) || (ea.noHazards && c.id.startsWith('cp-'))) {
    // zemindeki diken yerine küçük çukur (odanın zıplama ritmi korunur: tempo kuralı); iki yanda en az 100 px zemin kalmalı
    for (const sp of ents.filter((e) => e.type === 'spike' && e.y === GROUND_Y)) {
      const pw = Math.min(ea.maxPit, Math.max(60, (sp.w ?? 32) + 28)); const cx0 = sp.x + (sp.w ?? 32) / 2;
      const F = ents.find((f) => f.type === 'platform' && (f.h ?? 24) >= 100 && Math.abs(f.y - GROUND_Y) <= 2 && f.x <= cx0 && f.x + (f.w ?? 0) >= cx0 && (f.w ?? 0) >= 200 + pw);
      if (!F) continue;
      // çukur dikenin yerinde; iniş için gerekirse en çok 60 px kayar
      const cx = Math.max(F.x + 100 + pw / 2, Math.min(F.x + (F.w ?? 0) - 100 - pw / 2, cx0)); if (Math.abs(cx - cx0) > 60) continue;
      const l = Math.round(cx - pw / 2), r = Math.round(cx + pw / 2);
      ents.push({ ...F, x: r, w: F.x + (F.w ?? 0) - r }); F.w = l - F.x;
    }
    ents = ents.filter((e) => !HARM.has(e.type));
  }
  if (ea.maxPit < 9999 && !ents.some((e) => e.type === 'wall')) {
    const floors = ents.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - GROUND_Y) <= 12).sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < floors.length; i++) {
      const A = floors[i]!, B = floors[i + 1]!; const aR = A.x + (A.w ?? 0); const gap = B.x - aR;
      if (gap <= ea.maxPit || gap > 260) continue;
      // çukurun içinde/kenarında etkin varlık (zar, diken, düşman) varsa dokunma; üstteki raf ya da nota engel değil
      if (ents.some((e) => e !== A && e !== B && !PASSIVE.has(e.type) && e.x < B.x + 10 && e.x + (e.w ?? 0) > aR - 10 && e.y > GROUND_Y - 100)) continue;
      const d = gap - ea.maxPit; B.x -= d; B.w = (B.w ?? 0) + d;
    }
  }
  return { ...c, entities: ents };
}
/** boşlukta durabilen (çukurun "boş" sayılmasını bozmayan) varlıklar */
const PASSIVE = new Set(['coin', 'note', 'collect', 'secret', 'decor', 'text', 'tutor', 'powerup', 'checkpoint']);
/**
 * Geometri düğmeleri (oda tanımı paylaşılır: kopyala): diken genişliği, içi boş zemin çukurlarının genişliği ve dar basamakların
 * (hareketli/ritim/ufalanan/yankı) iniş genişliği bölümün sıkılığına göre ölçeklenir. Çukur en çok 190 px (tam zıplama 221 px),
 * basamak en az 60 px, diken en az 24 px. Genişleyen diken komşu zemine taşmaz (oda sınırı içinde kalır).
 */
function applyGeometry(c: ChunkSpec, k: Pick<LevelKnobs, 'geom'>): ChunkSpec {
  const gm = k.geom; if (gm.spike === 1 && gm.gap === 1 && gm.landing === 1) return c;
  const ents = c.entities.map((e) => ({ ...e }));
  for (const e of ents) {
    if (e.type === 'spike' && e.y === GROUND_Y) {
      const w = e.w ?? 32; const nw = Math.max(24, Math.round(w * gm.spike)); const nx = Math.round(e.x - (nw - w) / 2);
      // yalnız zemindeki diken; genişlemiş hali de tek bir zemin platformunun üstünde kalmalı
      if (ents.some((f) => f.type === 'platform' && (f.h ?? 24) >= 100 && Math.abs(f.y - GROUND_Y) <= 2 && f.x <= nx && f.x + (f.w ?? 0) >= nx + nw)) { e.x = nx; e.w = nw; }
    }
    // ufalanan taşlar yalnızca daralır: genişlerse aralarındaki boşluk kapanır ve zıplamadan geçilir (tempo kuralı bozulur)
    else if (e.type === 'moving' || e.type === 'beat' || e.type === 'crumble' || e.type === 'echo') { const w = e.w ?? 120; const k = e.type === 'crumble' ? Math.min(1, gm.landing) : gm.landing; const nw = Math.max(60, Math.round(w * k)); e.x = Math.round(e.x - (nw - w) / 2); e.w = nw; }
  }
  // zemin çukurları: ardışık iki zemin platformu arasındaki, içinde etkin varlık olmayan aralık; sağdaki zemin kaydırılır
  // (duvar odalarında değil: oradaki çukur boşta oyuncu içindir, inişi doğrudan duvara dayanır)
  if (ents.some((e) => e.type === 'wall')) return { ...c, entities: ents };
  const floors = ents.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - GROUND_Y) <= 12).sort((a, b) => a.x - b.x);
  for (let i = 0; i + 1 < floors.length; i++) {
    const A = floors[i]!, B = floors[i + 1]!; const aR = A.x + (A.w ?? 0), bL = B.x; const gap = bL - aR;
    if (gap < 60 || gap > 200) continue;
    if (ents.some((e) => e !== A && e !== B && !PASSIVE.has(e.type) && e.x < bL + 10 && e.x + (e.w ?? 0) > aR - 10 && e.y > GROUND_Y - 260)) continue;
    const ng = Math.max(50, Math.min(190, Math.round(gap * gm.gap))); const d = ng - gap;
    if ((B.w ?? 0) - d < 140) continue;
    B.x += d; B.w = (B.w ?? 0) - d;
  }
  return { ...c, entities: ents };
}
/**
 * Diken seyrekliği: oyuncu "yerden çıkan kırmızı dikenleri" en zor şey olarak gördü. `knobs.spikes`:
 *  'yok' (1-5): hiç diken kalmaz · 'bolum' (6-12): bölüm-içi bölüm başına en çok `perSection` diken; kontrol noktası ve geri
 *  dönüş odalarında, inişten (zemin başlangıcı, platform kenarı) sonraki 160 px'te hiç · 'seyrek' (13+): sıradaki her beş
 *  dikenden ikisi kalır (kontrol noktası odasında hiç). Kalkan zemin dikeni, iki yanda en az 100 px zemin kalıyorsa 60-110 px'lik çukura döner.
 */
function capSpikes(chunks: ChunkSpec[], starts: number[], k: Pick<LevelKnobs, 'spikes' | 'early'>, done: WeakSet<ChunkSpec> = new WeakSet()): void {
  const sp = k.spikes; if (sp.mode === 'serbest') return;
  const secOf = (i: number) => Math.max(0, starts.filter((st) => i >= st).length - 1);
  // önceki geçişte işlenmiş odalarda kalan dikenler sayılır (ikinci geçiş yalnız sonradan eklenen mikro odalara bakar)
  const kept = [0, 0, 0]; let idx = 0;
  chunks.forEach((c, i) => { if (done.has(c)) kept[secOf(i)]! += c.entities.filter((e) => e.type === 'spike').length; });
  chunks.forEach((c, i) => {
    if (done.has(c)) return;
    if (!c.entities.some((e) => e.type === 'spike')) { done.add(c); return; }
    const sec = secOf(i);
    const ents = c.entities.map((e) => ({ ...e }));
    const floors = ents.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - GROUND_Y) <= 2);
    const ledges = ents.filter((e) => e.type === 'platform' && e.y < GROUND_Y - 12);
    const calm = c.id.startsWith('cp-') || c.tags.includes('geri') || c.tags.includes('anahtar');
    const goodSpot = (e: Entity) => {
      const F = floors.find((f) => f.x <= e.x && f.x + (f.w ?? 0) >= e.x + (e.w ?? 32));
      if (!F || e.x - F.x < 160) return false;
      return !ledges.some((l) => l.x + (l.w ?? 0) <= e.x && l.x + (l.w ?? 0) > e.x - 160);
    };
    const drop: Entity[] = [];
    for (const e of ents.filter((q) => q.type === 'spike').sort((a, b) => a.x - b.x)) {
      let keep = false;
      if (sp.mode === 'bolum') { keep = !calm && kept[sec]! < sp.perSection && e.y === GROUND_Y && goodSpot(e); if (keep) kept[sec]! += 1; }
      else if (sp.mode === 'seyrek') {
        // su altındaki diken (havuz tabanı) yüzme sınavının parçası: kalır (yerden çıkan diken değil; tempo da onunla tutulur)
        const wet = ents.some((w) => w.type === 'water' && e.x >= w.x && e.x <= w.x + (w.w ?? 0) && e.y >= w.y);
        const m = wet ? 0 : idx++ % 5; keep = wet || ((m === 0 || m === 2) && !c.id.startsWith('cp-'));
      }
      if (!keep) drop.push(e);
    }
    if (!drop.length) return;
    const pits = new Set<Entity>();
    for (const e of drop) {
      // anahtar ve kapının 200 px yakınında çukur açılmaz (dönüş yolunda sürpriz çukur olmasın): diken yalnız kalkar
      if (e.y !== GROUND_Y || ents.some((q) => q.type === 'wall')) continue;
      if (ents.some((q) => (q.type === 'switch' || q.type === 'door') && Math.abs(q.x - e.x) < 200)) continue;
      const pw = Math.min(k.early.maxPit, 110, Math.max(60, (e.w ?? 32) + 28)); const cx0 = e.x + (e.w ?? 32) / 2;
      const F = ents.find((f) => f.type === 'platform' && (f.h ?? 24) >= 100 && Math.abs(f.y - GROUND_Y) <= 2 && f.x <= cx0 && f.x + (f.w ?? 0) >= cx0 && (f.w ?? 0) >= 200 + pw);
      if (!F) continue;
      const cx = Math.max(F.x + 100 + pw / 2, Math.min(F.x + (F.w ?? 0) - 100 - pw / 2, cx0)); if (Math.abs(cx - cx0) > 60) continue;
      if (ents.some((q) => q !== e && q.type !== 'coin' && q.type !== 'note' && q.type !== 'decor' && !(q.type === 'platform' && q.y < GROUND_Y - 12) && q.x < cx + pw / 2 && q.x + (q.w ?? 0) > cx - pw / 2 && q !== F && q.type !== 'spike')) continue;
      const l = Math.round(cx - pw / 2), r = Math.round(cx + pw / 2);
      ents.push({ ...F, x: r, w: F.x + (F.w ?? 0) - r }); F.w = l - F.x; pits.add(e);
    }
    // çukura dönüşemeyen diken, kalkınca odada zorunlu engeller arasında 480 px'ten uzun (≈ 1,8 sn) boşluk bırakıyorsa kalır
    // (13+; isteğe bağlı basamaklar/yankı merdiveni zorunlu sayılmaz: ana yol oyuncusu onlara basmadan geçer)
    let out = ents.filter((e) => !pits.has(e));
    const base = mandatoryGap({ ...c, entities: out });
    for (const e of drop.filter((d) => !pits.has(d))) {
      const trial = out.filter((q) => q !== e);
      if (sp.mode === 'seyrek' && mandatoryGap({ ...c, entities: trial }) > Math.max(480, base)) continue;
      out = trial;
    }
    chunks[i] = { ...c, entities: out }; done.add(chunks[i]!);
  });
}
/**
 * Kıl perdesi (altından kayılan asılı tehlike): `props.curtain` ile işaretlenir (ayrı görsel: asılı perde, aydınlık açıklık,
 * aşağı ok). Belirsiz "neredeyse aşılır" yükseklik kalmasın: üstünde yer varsa perde G-290'a kadar uzar (zıplayarak aşılamaz,
 * tam zıplama 163 px); yardımlı bölümlerde (1-12) alt kenar G-27 (kayan kahramanla 17 px pay — eskiden 14 —, ayaktaki kahraman
 * yine değer).
 */
function markCurtains(c: ChunkSpec, assisted: boolean): ChunkSpec {
  const isCurtain = (e: Entity) => e.type === 'hazard' && !e.props?.dx && !e.props?.dy && !e.props?.period && !e.props?.on && !e.props?.chase
    && (e.h ?? 0) >= 120 && e.y <= GROUND_Y - 140 && e.y + (e.h ?? 0) >= GROUND_Y - 40 && e.y + (e.h ?? 0) <= GROUND_Y - 10;
  if (!c.entities.some(isCurtain)) return c;
  const ents = c.entities.map((e) => ({ ...e }));
  for (const e of ents) {
    if (!isCurtain(e)) continue;
    const w = e.w ?? 100; const bot = assisted ? GROUND_Y - 27 : e.y + (e.h ?? 0);
    const roof = ents.some((q) => q !== e && (q.type === 'platform' || q.type === 'wall' || q.type === 'hazard' || q.type === 'spike' || q.type === 'moving') && q.x < e.x + w + 20 && q.x + (q.w ?? 0) > e.x - 20 && q.y < e.y && q.y + (q.h ?? 24) > GROUND_Y - 300);
    const top = roof ? e.y : GROUND_Y - 290;
    e.y = top; e.h = bot - top; e.props = { ...e.props, curtain: true };
  }
  return { ...c, entities: ents };
}
/** odada zorunlu engeller (zemin dikeni, zemin çukuru, zemindeki düşman/tehlike, duvar, bariyer, kapı, zeminden yükselen
 *  blok) arasındaki en uzun boşluk (oda girişi ve çıkışı dahil, px) */
function mandatoryGap(c: ChunkSpec): number {
  const xs: number[] = [0, c.length];
  for (const e of c.entities) {
    const h = e.h ?? 0;
    if (e.type === 'spike' || e.type === 'wall' || e.type === 'barrier' || e.type === 'door' || e.type === 'freqgate') xs.push(e.x);
    else if (e.type === 'enemy' && e.y >= GROUND_Y - 60) xs.push(e.x);
    else if (e.type === 'hazard' && e.y + h >= GROUND_Y - 30 && e.y <= GROUND_Y + 10) xs.push(e.x);
    else if (e.type === 'platform' && h > 32 && e.y < GROUND_Y - 12 && e.y + h >= GROUND_Y - 12) xs.push(e.x);
  }
  const floors = c.entities.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - GROUND_Y) <= 12).map((e) => [e.x, e.x + (e.w ?? 0)] as [number, number]).sort((a, b) => a[0] - b[0]);
  let cover = 0; for (const [a, b] of floors) { if (a - cover >= 40) xs.push(cover); cover = Math.max(cover, b); }
  xs.sort((a, b) => a - b); let g = 0; for (let i = 1; i < xs.length; i++) g = Math.max(g, xs[i]! - xs[i - 1]!); return g;
}
/** tek odanın bütün dikenleri (çukura döner ya da kalkar): ilk bölümlerin tempo mikro odaları için */
function despike(c: ChunkSpec, k: Pick<LevelKnobs, 'early'>): ChunkSpec {
  const one = [c]; capSpikes(one, [0], { early: k.early, spikes: { mode: 'yok', perSection: 0 } }); return one[0]!;
}
/** odaya bir sıkılık düzeyinin geometri ve zamanlama düğmelerini uygula (oda puanlama aracı da bunu kullanır) */
export function tuneRoom(c: ChunkSpec, tight: number): ChunkSpec { const t = tuningAt(tight); return applyTiming(applyGeometry(c, t), t); }
/** zamanlama düğmelerini odanın varlıklarına yaz (oda tanımı paylaşılır: kopyala) */
function applyTiming(c: ChunkSpec, k: Pick<LevelKnobs, 'timing'>): ChunkSpec {
  const tm = k.timing;
  const ents = c.entities.map((e) => {
    switch (e.type) {
      case 'crumble': return { ...e, props: { ...e.props, delay: tm.crumble } };
      case 'trampoline': return { ...e, props: { ...e.props, window: tm.tramp } };
      case 'enemy': return tm.enemy === 1 ? e : { ...e, props: { ...e.props, tempo: tm.enemy } };
      case 'moving': return tm.moving === 1 ? e : { ...e, props: { ...e.props, tempo: tm.moving } };
      case 'hazard': return e.props?.period && !e.props?.on && tm.moving !== 1 ? { ...e, props: { ...e.props, tempo: tm.moving } } : e;
      default: return e;
    }
  });
  return { ...c, entities: ents };
}

const isTutorial = (c: ChunkSpec) => c.tags.includes('ogretici');
const isMicro = (c: ChunkSpec) => c.tags.includes('mikro');
const isRisk = (c: ChunkSpec) => c.tags.includes('risk');
const isCheckpoint = (c: ChunkSpec) => !!c.rest && c.entities.some((e) => e.type === 'checkpoint');
const hasSecret = (c: ChunkSpec) => c.entities.some((e) => e.type === 'secret');
const fits = (c: ChunkSpec, abil: Set<AbilityId>) => chunkNeeds(c).every((a) => abil.has(a));

/** ağırlıklı seçim */
function weighted<T>(rng: () => number, items: { v: T; w: number }[]): T | undefined {
  const tot = items.reduce((a, i) => a + Math.max(0, i.w), 0); if (tot <= 0) return items[0]?.v;
  let r = rng() * tot; for (const i of items) { r -= Math.max(0, i.w); if (r <= 0) return i.v; }
  return items[items.length - 1]?.v;
}

/** Bölüm üretimi: deterministik (journey + number + seedSalt). Profil yalnızca zorluk ve parça seçimini etkiler.
 *  Bir önceki bölümün odaları düşük ağırlık alır: art arda bölümler farklı hissettirsin. */
export function generateLevel(journeyId: string, number: number, profile: PlayerProfile = DEFAULT_PROFILE, seedSalt = 0, o: { variant?: number } = {}): LevelSpec {
  const prev = new Set<string>();
  // önceki iki bölümün odaları (varsayılan varyantlarıyla: bir bölümün kalibrasyonu komşularını değiştirmesin)
  for (const k of [1, 2]) if (number > k) { try { for (const c of generateCore(journeyId, number - k, profile, seedSalt, new Set(), 0).chunks) prev.add(c.id); } catch { /* yok */ } }
  return generateCore(journeyId, number, profile, seedSalt, prev, o.variant);
}

/**
 * Kalibrasyon varyantı: aynı düğmelerle üretilebilecek bölümler arasından, insan modeliyle ÖLÇÜLÜNCE hedef eğriye en yakın olanın
 * numarası (`kalibrasyon.ts`, `tools/harness/zorluk.mjs --kalibre` üretir). Yalnızca yolculuğun kendi bölümleri.
 */
export const variantOf = (journeyId: string, number: number): number => (journeyId === 'insan' ? KALIBRASYON[number] ?? 0 : 0);

function generateCore(journeyId: string, number: number, profile: PlayerProfile, seedSalt: number, prevIds: Set<string>, variantOverride?: number): LevelSpec {
  const journey = journeyById(journeyId);
  if (!journey) throw new Error(`yolculuk yok: ${journeyId}`);
  const plan = journey.levels.find((l) => l.number === number) ?? journey.levels[journey.levels.length - 1]!;
  const variant = variantOverride ?? variantOf(journeyId, number);
  const seed = hashString(`${journeyId}:${number}:${seedSalt}${variant ? `:v${variant}` : ''}`);
  const rng = mulberry32(seed);
  const knobs = levelKnobs(plan.number, profile);
  const modifiers = pickModifiers(plan, knobs);
  const abilities = abilitiesAt(plan.number); const abil = new Set(abilities);
  const newAbilities = newAbilitiesAt(plan.number);

  if (plan.mechanic === 'boss') {
    const boss = BOSSES[plan.boss ?? ''];
    if (!boss) throw new Error(`boss yok: ${plan.boss}`);
    const tuned = { ...boss, hp: knobs.timing.bossHp ?? boss.hp, warn: knobs.timing.bossWarn, tempo: knobs.timing.bossTempo ?? 1 };
    return { id: `${journeyId}-${number}`, number, journey: journeyId, name: plan.name, biome: plan.biome, mechanic: 'boss', objective: objective('boss'), modifiers: [], seed, chunks: [], lengthPx: 0, parTimeSec: 120, coinsTotal: 0, intro: plan.intro, boss: tuned, abilities, newAbilities: [], sectionStarts: [0], cochleasTotal: 0 };
  }

  // ---- havuz: biyoma uygun, açık yeteneklerle oynanabilir parçalar
  const biomeOk = (c: ChunkSpec) => !c.biomes || c.biomes.includes(plan.biome);
  // imza gösterisi yalnız kendi bölümünün havuzunda (öteki bölümlerin oda seçimi ve rastgele sırası değişmesin)
  const pool = ALL_CHUNKS.filter((c) => biomeOk(c) && fits(c, abil) && (!c.tags.includes('imza') || SIGNATURE[plan.number] === c.id));
  // sınav odaları yalnızca bölge finalinde (öğrenilen her şey bir arada): final bölüm-içi bölümün son odası
  const isExam = (c: ChunkSpec) => c.tags.includes('sinav');
  const normalAll = pool.filter((c) => !c.rest && !c.setPiece && !isTutorial(c) && !isMicro(c) && !isExam(c));
  const zone = zoneOf(plan.number);
  // son iki bölgede finalden önceki bölümler de bir "prova" sınavı alır (Beyin Sapı girişi ve Korteks'in tüm bölümleri; tahminen
  // en ağırı): son kademeler baştan sona zorlu kalsın, final yine iki sınavla doruk
  const zi = CURVE_ZONES.indexOf(zone); const isFinale = plan.number === zone.peak;
  const rehearsal = !isFinale && (zi === 9 || (zi === 8 && plan.number === zone.from));
  const exams = isFinale || rehearsal ? pool.filter(isExam).sort((a, b) => predictDmg(b, knobs.tight) - predictDmg(a, knobs.tight) || a.id.localeCompare(b.id)) : [];
  // sınav sayısı (ölçülerek ayarlandı): Zar'dan sonra Koklea Taban dışındaki her final iki sınav ister (final zinciri her
  // kademede yükselsin: Koklea Orta ve Beyin Sapı tek sınavla bir önceki finalin altında kalıyordu), diğerleri bir; prova bir
  // (en ağır); biri tahminen en zoru, biri dönüşümlü
  const examFull = rehearsal ? 1 : [2, 5, 6, 7, 8, 9].includes(zi) ? 2 : 1; const examN = Math.max(0, examFull - knobs.ease);
  const picked = !exams.length || !examN ? [] : rehearsal ? exams.slice(0, 1) : [...new Set([exams[seedSalt % exams.length]!, ...exams])].slice(0, examN);
  // düğmelere uyan odalar; yetmezse kısıtlar kademeli gevşer (boşluk/iniş → aile sayısı → yalnız can kaybı tavanı)
  let normal: ChunkSpec[] = [];
  for (let strict = 0; strict <= 3 && normal.length < Math.max(6, knobs.rooms + 2); strict++) normal = normalAll.filter((c) => knobOk(c, knobs, strict));
  if (normal.length < 3) normal = normalAll.slice().sort((a, b) => roomStats(a).score - roomStats(b).score).slice(0, Math.max(6, knobs.rooms + 2));
  const opener = pool.find((c) => c.tags.includes('giris'));
  const microsAll = pool.filter((c) => isMicro(c) && !c.tags.includes('giris'));
  // mikro odalar (tempo ve risk yolu) bütçe dışı eklenir: pahalı olanlar elenir (tahmini can kaybı ≤ max(0,03; λ/6))
  const microsOk = microsAll.filter((c) => knobOk(c, knobs, 2) && predictDmg(c, knobs.tight) <= Math.max(0.03, knobs.lambda / 6));
  const micros = microsOk.length >= 3 ? microsOk : microsAll;
  if (!normal.length) throw new Error(`parça yok: ${plan.biome}`);
  const focus = new Set(plan.focus ?? []);
  // bu biyomda açılan / en yeni yetenek: o yeteneği kullanan parçalar öne çıkar
  const latest = abilities[abilities.length - 1]!;
  const total = knobs.rooms;
  const counts = [Math.max(1, Math.round(total * 0.3)), Math.max(1, Math.round(total * 0.36))];
  counts.push(Math.max(1, total - counts[0]! - counts[1]!));
  const used = new Set<string>();
  const chunks: ChunkSpec[] = []; const sectionStarts: number[] = [];

  /**
   * oda seçimi: bölümün can kaybı bütçesinden bu odaya düşen pay (`target`, λ birimi) — odanın bu bölümün sıkılığındaki tahmini
   * can kaybı (ölçülen) ona yakın olan öne çıkar; eşit tahminlerde oda puanı bölümün puan hedefine yakın olan (çeşitlilik ve biyom)
   */
  const pd = (c: ChunkSpec) => predictDmg(c, knobs.tight);
  const pickChunk = (target: number, scoreTarget: number, needSecret: boolean): ChunkSpec => {
    const tol = Math.max(0.03, target * 0.5);
    let cands = normal.filter((c) => !used.has(c.id) && Math.abs(pd(c) - target) <= tol * 3);
    if (needSecret) { const s = cands.filter(hasSecret); if (s.length) cands = s; }
    if (cands.length < 2) cands = normal.filter((c) => !used.has(c.id));
    if (!cands.length) cands = normal;
    const last = chunks[chunks.length - 1];
    const c = weighted(rng, cands.map((c) => {
      let w = 1 / Math.pow(1 + Math.abs(pd(c) - target) / tol, 2) / (1 + Math.abs(roomStats(c).score - scoreTarget) / 2.5);
      if (c.biomes?.includes(plan.biome)) w *= 3;
      const needs = chunkNeeds(c);
      if (needs.includes(latest)) w *= 2.2;
      if (c.tags.some((t) => focus.has(t))) w *= 3;
      if (plan.biome === 'zar' && c.tags.includes('zar')) w *= 2.5; // kulak zarı: zar sıçrayışı biyomun kalbi
      if (isRisk(c) && !chunks.slice(sectionStarts[sectionStarts.length - 1] ?? 0).some(isRisk)) w *= 1.8; // bölüm-içi bölümde risk yolu yoksa öne çıkar
      if (last && c.tags.length && last.tags[0] === c.tags[0]) w *= 0.5; // aynı tür art arda gelmesin
      if (prevIds.has(c.id)) w *= 0.1; // önceki iki bölümde vardı
      return { v: c, w };
    }))!;
    used.add(c.id);
    return c;
  };
  const checkpointChunk = (): ChunkSpec | undefined => {
    const cps = pool.filter(isCheckpoint);
    const own = cps.filter((c) => c.biomes?.includes(plan.biome));
    return pick(rng, own.length ? own : cps);
  };

  // gösteri parçası (set piece): biyomun gösterilerinden; bölge girişinde en kolayı, finalde en zoru, arada dönüşümlü
  const biomeLevels = journey.levels.filter((l) => l.biome === plan.biome && l.mechanic !== 'boss').map((l) => l.number);
  const idxInBiome = biomeLevels.indexOf(plan.number);
  const sets = pool.filter((c) => c.setPiece && !c.tags.includes('imza') && c.biomes?.includes(plan.biome)).sort((a, b) => roomStats(a).score - roomStats(b).score);
  const zp = zonePos(plan.number);
  const setsOk = sets.filter((c) => predictDmg(c, knobs.tight) <= Math.max(0.08, 0.5 * knobs.lambda)).sort((a, b) => predictDmg(a, knobs.tight) - predictDmg(b, knobs.tight));
  const sp = setsOk.length ? setsOk : sets.slice(0, 1);
  const signature = SIGNATURE[plan.number] ? pool.find((c) => c.id === SIGNATURE[plan.number]) : undefined;
  const setPiece = signature ? signature : !sp.length ? undefined : seedSalt ? sp[(idxInBiome + seedSalt) % sp.length]! : zp <= 0.01 || plan.number <= 3 ? sp[0]! : zp >= 0.99 ? sp[sp.length - 1]! : sp[idxInBiome % sp.length]!;
  // can kaybı bütçesi: hedef λ − gösteri ve öğreticilerin tahmini payı − mikro odalar için küçük pay; bölüm-içi bölümler %27 / %33 / %40
  // (oda puanı hedefi de ×0,7 / ×1 / ×1,25: her bölüm-içi bölüm bir öncekinden biraz zor, son odası kendi küçük doruğu)
  const tutorCost = pool.filter((c) => isTutorial(c) && c.entities.some((e) => e.type === 'tutor' && newAbilities.includes(String(e.props?.ability) as AbilityId))).reduce((a, c) => a + pd(c), 0);
  // yardım kademesinde düşen sınavın payı bütçeye geri eklenmez (kolaylaştırma gerçekten kolaylaştırsın)
  const examCost = Math.max(picked.reduce((a, c) => a + pd(c), 0), exams.slice(0, examFull).reduce((a, c) => a + pd(c), 0));
  const budget = Math.max(0, knobs.lambda - (setPiece ? pd(setPiece) : 0) - examCost - tutorCost - 0.05);
  const shares = [0.27, 0.33, 0.4]; const secK = [0.7, 1, 1.25];
  for (let s = 0; s < 3; s++) {
    sectionStarts.push(chunks.length);
    const startLen = chunks.length;
    if (s === 0) {
      // öğretici: yeni açılan her yetenek için oynanarak öğrenilen parça
      for (const a of newAbilities) {
        const tut = pool.filter((c) => isTutorial(c) && c.entities.some((e) => e.type === 'tutor' && e.props?.ability === a));
        const own = tut.filter((c) => c.biomes?.includes(plan.biome)); const t = pick(rng, own.length ? own : tut);
        if (t) { chunks.push(t); used.add(t.id); }
      }
    } else { const cp = checkpointChunk(); if (cp) chunks.push(cp); }
    const n = counts[s]!; let left = budget * shares[s]!;
    for (let i = 0; i < n; i++) {
      const secretSoFar = chunks.slice(startLen).some(hasSecret);
      const last = i === n - 1 && n > 1;
      const c = pickChunk(Math.max(0, left / (n - i)) * (last ? 1.3 : 1), knobs.roomTarget * secK[s]! + (last ? 0.5 : 0), !secretSoFar && i === n - 1);
      chunks.push(c); left -= pd(c);
    }
  }
  // bölge finali: sınav odası, ardından doruk gösterisi (her bölüm bir gösteriyle biter: giriş öğretir → gelişim birleştirir → final doruk)
  for (const ex of picked) { chunks.push(ex); used.add(ex.id); }
  if (setPiece) chunks.push(setPiece);

  // ---- altın koklealar: her bölüm-içi bölümde tam bir tane; notalar en çok 100
  const sectionOf = (i: number) => (i >= sectionStarts[2]! ? 2 : i >= sectionStarts[1]! ? 1 : 0);
  const keepSecret: (string | null)[] = [null, null, null];
  for (let s = 0; s < 3; s++) {
    const cands: string[] = [];
    chunks.forEach((c, i) => { if (sectionOf(i) === s) c.entities.forEach((e, j) => { if (e.type === 'secret') cands.push(`${i}:${j}`); }); });
    keepSecret[s] = cands.length ? pick(rng, cands) : null;
  }
  const finalChunks: ChunkSpec[] = chunks.map((c, i) => {
    const ents: Entity[] = [];
    c.entities.forEach((e, j) => {
      if (e.type === 'secret' && keepSecret[sectionOf(i)] !== `${i}:${j}`) return;
      if (e.type === 'tutor' && !newAbilities.includes(String(e.props?.ability) as AbilityId)) return; // tekrar oynanan öğretici parça: yalnızca metin
      ents.push(e);
    });
    return { ...c, entities: ents };
  });
  // ---- risk yolu: her bölüm-içi bölümde en az bir isteğe bağlı zor (daha çok notalı) yol
  const riskMicros = micros.filter(isRisk).length ? micros.filter(isRisk) : microsAll.filter(isRisk).sort((a, b) => predictDmg(a, knobs.tight) - predictDmg(b, knobs.tight)).slice(0, 1);
  if (riskMicros.length) {
    for (let k = 2; k >= 0; k--) {
      const a = sectionStarts[k]!, b = k < 2 ? sectionStarts[k + 1]! : finalChunks.length;
      if (finalChunks.slice(a, b).some(isRisk)) continue;
      const at = Math.min(k === 2 && finalChunks[b - 1]?.setPiece ? b - 1 : b, a + 2); // doruk gösterisi en sonda kalsın
      const m = weighted(rng, riskMicros.map((c) => ({ v: c, w: (chunkNeeds(c).includes(latest) ? 3 : 1) * (plan.biome === 'zar' && c.tags.includes('zar') ? 3 : 1) / Math.pow(1 + roomStats(c).score / Math.max(0.5, knobs.roomMax), 2) })))!;
      finalChunks.splice(at, 0, { ...m, entities: m.entities.slice() });
      for (let j = k + 1; j < 3; j++) sectionStarts[j]! += 1;
    }
  }
  // ---- tırmanış odağı (kanal 7, 8, 17): bölümde uzun tırmanış odası yoksa gelişim bölümüne bir tane eklenir
  if (focus.has('tirmanis') && !finalChunks.some((c) => c.tags.includes('tirmanis'))) {
    const climb = pool.filter((c) => c.tags.includes('tirmanis') && !c.setPiece);
    if (climb.length) { const c = climb[(plan.number + seedSalt) % climb.length]!; const at = sectionStarts[1]! + 1; finalChunks.splice(at, 0, { ...c, entities: c.entities.filter((e) => e.type !== 'secret') }); sectionStarts[2]! += 1; } // koklea sayısı bölüm-içi bölümde bir kalır
  }
  // ---- kulak zarı: zar biyomun kalbi — bölümde en az 8 zar yoksa bölüm-içi bölüm sınırlarına zar mikro odası eklenir
  if (plan.biome === 'zar') {
    const tramps = () => finalChunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'trampoline').length, 0);
    const zm = micros.filter((c) => c.tags.includes('zar') && !isRisk(c));
    for (let k = 0; tramps() < 8 && zm.length && k < 6; k++) {
      const sec = 1 + (k % 2); const at = sectionStarts[sec]!; const m = zm[(plan.number + k + seedSalt) % zm.length]!;
      finalChunks.splice(at, 0, { ...m, entities: m.entities.slice() }); for (let j = sec; j < 3; j++) sectionStarts[j]! += 1;
    }
  }
  // geometri (diken, çukur, basamak) ve zamanlama düğmeleri (ufalanma gecikmesi, zar penceresi, düşman/platform temposu)
  // odaların varlıklarına yazılır — tempo çözümlemesi düğmeli geometriyi görsün diye ondan önce; sonradan eklenen mikro odalar
  // ve giriş çukuru da aşağıda bir kez ayarlanır
  const tuned = new WeakSet<ChunkSpec>();
  const tune = (c: ChunkSpec) => { if (tuned.has(c)) return c; const t = applyTiming(applyGeometry(applyEarly(markCurtains(c, !!knobs.assist), knobs), knobs), knobs); tuned.add(t); return t; };
  for (let i = 0; i < finalChunks.length; i++) finalChunks[i] = tune(finalChunks[i]!);
  // diken seyrekliği (docs/12 §4): 1-5'te hiç, 6-12'de bölüm-içi bölüm başına en çok bir, 13+'da yaklaşık %40'ı kalır;
  // kalkan diken zeminde küçük çukura döner. Tempo kuralı dikensiz hâli görsün diye mikro odalardan ÖNCE; sonradan eklenen
  // mikro odalar aşağıda ikinci geçişte (ilk bölümlerde mikro odalar baştan dikensiz)
  const spiked = new WeakSet<ChunkSpec>();
  capSpikes(finalChunks, sectionStarts, knobs, spiked);
  for (const c of finalChunks) tuned.add(c);
  // ---- tempo: iki girdi arasındaki sessiz yol PACE_LIMIT'i aşmasın — gerekirse araya mikro oda (pacing.ts)
  // mikro odalar da ayarlı halleriyle (ilk bölümde dikensiz kalan mikro oda girdi istemiyorsa tempo için işe yaramaz);
  // sessiz yol sınırı koşu hızıyla ölçeklenir (yavaş koşuda aynı süre daha kısa yol)
  // (yalnız yardımlı ilk bölümlerde; sonrakiler eskisi gibi ham mikro odayla, eklendikten sonra ayarlanır)
  const noSpikeMicros = knobs.spikes.mode === 'yok' || knobs.spikes.mode === 'bolum';
  const pacedMicros = knobs.assist ? micros.map(tune).map((c) => (noSpikeMicros ? despike(c, knobs) : c)).filter((c) => quietProfile(c).actions.length > 0) : [];
  for (const c of pacedMicros) tuned.add(c);
  const paceLimit = Math.round(PACE_LIMIT * (knobs.assist ? knobs.assist.run / 260 : 1));
  const paced = paceChunks(finalChunks, sectionStarts, pacedMicros.length ? pacedMicros : micros, { latest, biome: plan.biome, rng, limit: paceLimit, flight: !!knobs.assist, onInsert: pacedMicros.length ? (c) => tuned.add(c) : undefined });
  finalChunks.length = 0; finalChunks.push(...paced.chunks); sectionStarts.splice(0, 3, ...paced.sectionStarts);
  // boşta oyuncu ölmeli: bölüm bir çukurla başlamıyorsa en başa kısa giriş çukuru (yoksa gidip-gelme odalarında sonsuza dek koşar)
  // ilk odanın engeli hemen başlıyorsa giriş çukurunun iniş zemini uzar: çukurdan inip ikinci zıplamaya hazırlanacak yer kalsın
  if (opener && !startsWithPit(finalChunks[0]!)) {
    const extra = Math.max(0, 200 - quietProfile(finalChunks[0]!).entry);
    const ents = opener.entities.map((e) => ({ ...e })); const last = ents.filter((e) => e.type === 'platform').sort((a, b) => b.x - a.x)[0];
    if (last && extra) last.w = (last.w ?? 0) + extra;
    finalChunks.unshift({ ...opener, length: opener.length + (last ? extra : 0), entities: ents }); sectionStarts[1]! += 1; sectionStarts[2]! += 1;
  }
  for (let i = 0; i < finalChunks.length; i++) finalChunks[i] = tune(finalChunks[i]!);
  capSpikes(finalChunks, sectionStarts, knobs, spiked);
  // 5. bölüm: ilk kıl perdesinden önce kayma tazeleme anı (3. bölümdeki dersin aynısı; daha önce öğrenilmiş olsa da)
  if (plan.number === 5) {
    if (!finalChunks.some((c) => c.entities.some((e) => e.props?.curtain))) {
      // perdesiz çıkan 5. bölüme kısa bir perde odası (tazeleme anı için), ilk bölüm-içi bölümün ikinci odası olarak
      const m = pool.find((c) => c.id === 'mk-perde');
      if (m) { finalChunks.splice(Math.min(2, finalChunks.length), 0, tune({ ...m, entities: m.entities.slice() })); for (let j = 1; j < sectionStarts.length; j++) sectionStarts[j]! += 1; }
    }
    const ci = finalChunks.findIndex((c) => c.entities.some((e) => e.props?.curtain));
    if (ci >= 0) {
      let c = finalChunks[ci]!; let cx = Math.min(...c.entities.filter((e) => e.props?.curtain).map((e) => e.x));
      // uzun koşu payı: perde odanın başına yakınsa oda öne doğru uzar (baştaki zemin genişler)
      if (cx < 300) {
        const d = 300 - cx;
        c = { ...c, length: c.length + d, entities: c.entities.map((e) => (e.x === 0 && e.type === 'platform' && Math.abs(e.y - GROUND_Y) <= 2 ? { ...e, w: (e.w ?? 0) + d } : { ...e, x: e.x + d })) }; cx += d;
      }
      finalChunks[ci] = { ...c, entities: [{ type: 'tutor', x: cx - 260, y: GROUND_Y, w: 110, props: { ability: 'kayma', refresher: true } }, ...c.entities] };
    }
  }
  // nota sınırı: fazlası, en uzun nota dizilerinin uçlarından kırpılır (yaylar bölünmez, yalnız kısalır)
  const countNotes = () => finalChunks.reduce((a, c) => a + c.entities.reduce((b, e) => b + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0), 0);
  let notes = countNotes();
  if (notes > MAX_NOTES) { thinNotes(finalChunks, notes - MAX_NOTES); notes = countNotes(); }
  let coinBudget = notes;
  // ---- hedefe özel: melodi notaları (yol üstündeki jetonlardan), eskort başlangıcı
  if (plan.objective === 'melody') {
    const want = 6 + Math.floor(plan.number / 10);
    const spots: { ci: number; ei: number }[] = [];
    finalChunks.forEach((c, ci) => { if (c.tags.includes('duvar') || c.tags.includes('su')) return; c.entities.forEach((e, ei) => { if (e.type === 'coin' && e.y >= GROUND_Y - 130) spots.push({ ci, ei }); }); });
    const chosen: { ci: number; ei: number }[] = [];
    for (let i = 0; i < want && spots.length; i++) { const idx = Math.min(spots.length - 1, Math.floor(((i + 0.5) / want) * spots.length)); chosen.push(spots[idx]!); }
    chosen.forEach((p, i) => { const c = finalChunks[p.ci]!; const e = c.entities[p.ei]!; c.entities = c.entities.slice(); c.entities[p.ei] = { type: 'note', x: e.x, y: e.y, props: { t: chosen.length > 1 ? i / (chosen.length - 1) : 0.5 } }; });
    coinBudget = countNotes();
  }
  if (plan.objective === 'escort') {
    const c0 = finalChunks[0]!; finalChunks[0] = { ...c0, entities: [{ type: 'escortee', x: 10, y: GROUND_Y - 40 }, ...c0.entities] };
  }

  // ilk bölümlerde her odanın başında kontrol noktası: düşen yeni oyuncu az geri döner
  if (knobs.early.cpEveryRoom) for (let i = 1; i < finalChunks.length; i++) {
    const c = finalChunks[i]!; if (c.entities.some((e) => e.type === 'checkpoint')) continue;
    finalChunks[i] = { ...c, entities: [{ type: 'checkpoint', x: 24, y: c.entryY ?? GROUND_Y }, ...c.entities] };
  }
  const lengthPx = finalChunks.reduce((a, c) => a + c.length, 0) + 600;
  const melodyNotes = finalChunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'note').length, 0);
  const speedPx = (knobs.assist?.run ?? 260) * (modifiers.includes('hiz') ? 1.3 : 1);
  const slow = finalChunks.reduce((a, c) => a + (c.tags.includes('duvar') ? 2.5 : 0) + (c.tags.includes('su') ? 1.5 : 0) + (c.tags.includes('anahtar') ? 3 : 0), 0);
  const parTimeSec = Math.round(lengthPx / speedPx + slow + finalChunks.length * 1.5 + 6);
  const obj = plan.objective === 'collect-all' ? objective('collect-all', coinBudget)
    : plan.objective === 'timed' ? objective('timed', Math.max(25, Math.round(parTimeSec * 0.95)))
    : plan.objective === 'melody' ? objective('melody', melodyNotes || 5)
    : objective(plan.objective);
  const sectionChunkStarts = sectionStarts.slice();
  return {
    id: `${journeyId}-${number}`, number, journey: journeyId, name: plan.name, biome: plan.biome, mechanic: plan.mechanic, objective: obj, modifiers, seed,
    chunks: tagPathologies(finalChunks, plan.biome), lengthPx, parTimeSec, coinsTotal: coinBudget, intro: plan.intro, tutorial: plan.tutorial || newAbilities.length > 0,
    abilities, newAbilities, sectionStarts: sectionChunkStarts, cochleasTotal: keepSecret.filter(Boolean).length,
    ...(knobs.assist ? { assist: knobs.assist } : {}),
  };
}

/** dizi: aynı odada art arda gelen ve birbirine yakın (≤ 70 px) notalar */
function noteGroups(c: ChunkSpec): number[][] {
  const out: number[][] = []; let cur: number[] = [];
  c.entities.forEach((e, i) => {
    const prev = cur.length ? c.entities[cur[cur.length - 1]!]! : null;
    if (e.type === 'coin' && (!prev || Math.hypot(e.x - prev.x, e.y - prev.y) <= 70)) cur.push(i);
    else { if (cur.length) out.push(cur); cur = e.type === 'coin' ? [i] : []; }
  });
  if (cur.length) out.push(cur);
  return out;
}
/**
 * Nota sınırı: fazlası BÜTÜN diziler halinde çıkarılır (yay bölünmez, tek tük nota kalmaz). Önce gösteri/öğretici dışındaki,
 * en çok notası olan odaların dizileri; eşitlikte sondaki. Deterministik.
 */
function thinNotes(chunks: ChunkSpec[], drop: number) {
  const gone = chunks.map(() => new Set<number>());
  const left = chunks.map((c) => c.entities.filter((e) => e.type === 'coin').length);
  const protectedC = (c: ChunkSpec) => !!c.setPiece || c.tags.includes('ogretici');
  while (drop > 0) {
    let best: { ci: number; g: number[]; key: number } | null = null;
    for (let ci = 0; ci < chunks.length; ci++) {
      const c = chunks[ci]!;
      for (const g0 of noteGroups(c)) {
        const g = g0.filter((i) => !gone[ci]!.has(i)); if (!g.length) continue;
        const key = (protectedC(c) ? 0 : 1000) + left[ci]! * 10 + Math.min(9, g.length) + ci * 0.001;
        if (!best || key > best.key) best = { ci, g, key };
      }
    }
    if (!best) break;
    const b = best as { ci: number; g: number[] };
    for (const i of b.g) gone[b.ci]!.add(i);
    left[b.ci]! -= b.g.length; drop -= b.g.length;
  }
  chunks.forEach((c, ci) => { if (gone[ci]!.size) c.entities = c.entities.filter((_, i) => !gone[ci]!.has(i)); });
}

/**
 * Tempo kuralı: kahraman START_PAD'den başlar; her odanın girdi isteyen noktaları (pacing.actionXs) arasında ve odalar
 * arası geçişte sessiz yol PACE_LIMIT px'i (≈ 3,2 sn koşu) aşacaksa araya bir mikro oda konur. Mikro oda, bölüm-içi
 * bölümün kontrol noktası odasından ÖNCE eklenir (bölümler kontrol noktasıyla başlamaya devam eder).
 * Seçim: açık yeteneklere uygun; en yeni yeteneği kullanan ve biyoma yakışan (zarda zar) öne çıkar; art arda aynısı gelmez.
 */
export const PACE_LIMIT = 820;
const START_QUIET = 120; // START_PAD (220) − başlangıç x'i (100)
const END_QUIET = 110;   // END_PAD (260) − kapı payı (150)
export function paceChunks(chunks: ChunkSpec[], sectionStarts: number[], micros: ChunkSpec[], o: { latest: AbilityId; biome: string; rng: () => number; limit?: number; flight?: boolean; onInsert?: (c: ChunkSpec) => void }): { chunks: ChunkSpec[]; sectionStarts: number[]; inserted: number } {
  const LIMIT = o.limit ?? PACE_LIMIT;
  if (!micros.length) return { chunks, sectionStarts, inserted: 0 };
  const out: ChunkSpec[] = []; const map: number[] = []; let inserted = 0; let lastMicro = '';
  const pickMicro = (): ChunkSpec => {
    const m = weighted(o.rng, micros.filter((c) => !isRisk(c)).map((c) => {
      let w = 1;
      if (chunkNeeds(c).includes(o.latest)) w *= 3;
      if (o.biome === 'zar' && c.tags.includes('zar')) w *= 5;
      if (c.id === lastMicro) w *= 0.05;
      return { v: c, w };
    }))!;
    lastMicro = m.id; inserted++;
    const copy = { ...m, entities: m.entities.slice() }; o.onInsert?.(copy); return copy;
  };
  let carry = START_QUIET;
  chunks.forEach((c, i) => {
    const p = quietProfile(c, o);
    const need = p.actions.length ? p.entry : c.length + 160;
    if (carry + need > LIMIT) { const m = pickMicro(); out.push(m); carry = quietProfile(m, o).exit; }
    map[i] = out.length; out.push(c);
    carry = p.actions.length ? p.exit : carry + c.length;
  });
  if (carry + END_QUIET > LIMIT) out.push(pickMicro());
  return { chunks: out, sectionStarts: sectionStarts.map((k, i) => (i === 0 ? 0 : map[k] ?? k)), inserted };
}

export { GROUND_Y };
