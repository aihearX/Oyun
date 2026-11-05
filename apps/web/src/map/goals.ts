/** Haritanın "Sıradaki hedef" rozeti ve kart metinleri: gerçek ilerlemeden, dürüst sayılar. */
import { BIOME_ORDER, BIOMES, HUMAN_JOURNEY, TREASURES, treasureAt, type LevelPlan, type RewardItem } from '@odi/content';
import { passText, star3Rules, starHead, type MetaState, type RunSpecLite } from '@odi/meta';
import { journeyDone, nextVitalityNeed, planReturn, unlockedOf, vitalityOf, type StarMap, type Vitality } from '@odi/game-core/lite';
import type { BiomeId } from '@odi/shared';

export interface Goal {
  icon: string; text: string; /** hedefe ulaşılınca bir kez söylenir */ small?: string;
  /** yolculuk bu dönüşte bitti (son bölüm ilk kez geçildi): kutu Ninni Merkezi başlığını örtmez, "Sıradaki" yıldız hedefi söylenmez */
  final?: boolean;
}

/** aşama fiilleri: gelecek ("çiçeklenir") ve ulaşıldı ("çiçeklendi"); sıra VITALITY_NAMES ile aynı (uyanır → çiçeklenir → canlanır → ışıl ışıl) */
export const VITALITY_WILL: Record<Vitality, string> = { 0: '', 1: 'uyanır', 2: 'çiçeklenir', 3: 'canlanır', 4: 'ışıl ışıl olur' };
const DID: Record<Vitality, string> = { 0: '', 1: 'uyandı', 2: 'çiçeklendi', 3: 'canlandı', 4: 'ışıl ışıl oldu' };
const STAGE_ICON: Record<Vitality, string> = { 0: '🌱', 1: '🌱', 2: '🌱', 3: '🌟', 4: '✨' };

/** seçilen tek hedef: hangi olay(lar), kaç bölüm/yıldız sonra */
export interface GoalPick {
  /** hedefin kimliği (aynı hedef sürerken değişmez): "t:15", "b:zar:2", "s:dis-kulak", "son" */
  key: string;
  /** bölüm hedefi: kaç bölüm sonra (1 = sıradaki bölümün sonunda); yıldız hedefinde yıldız sayısı */
  left: number;
  /** bölüm hedefi: gerçekleşeceği bölüm (o bölüm bitince) */
  level?: number;
  treasure?: number;
  biome?: { id: BiomeId; to: Vitality };
  stars?: { id: BiomeId; n: number };
}

/**
 * "Sıradaki hedef" seçimi (OT-ilk-kez-oyun-13): haritada dönen birkaç hedef yerine TEK hedef, ulaşılana kadar aynı kalır.
 * Öncelik kuralı:
 *  1. Bölüm hedefleri: sıradaki hazine ve her bölgenin sıradaki canlanma aşaması (uyanmış bölgeler: çiçeklenir, canlanır).
 *     Her birinin hangi bölümü bitirince gerçekleşeceği bellidir (bölgelerin bölümleri ardışık olmayabilir: Kulak Kanalı
 *     6-8, 17, 20); en YAKIN olan seçilir. Bölümler sırayla açıldığı için her bölüm hepsini bir yaklaştırır, yani seçilen hedef
 *     ulaşılana kadar en yakın kalır. Aynı bölümde hazine de aşama da varsa ikisi birlikte söylenir.
 *  2. Yolculuk bitince yıldız hedefi: "ışıl ışıl" olmasına en az yıldız kalan bölge (eşitlikte harita sırası); önceki
 *     yıldız hedefi (`keep`) hâlâ sürüyorsa o korunur.
 *  3. Hepsi tamamsa taç.
 * Yalnız yıldız haritasından hesaplanır (hazine, bölümü ilk bitirişte açılır); saf ve testlidir.
 */
export function pickGoal(stars: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels, keep?: GoalPick | null): GoalPick | null {
  const total = levels.length; const unlocked = unlockedOf(stars, total);
  const open = (n: number) => !((stars[n] ?? 0) > 0);
  // bölüm hedefleri: gerçekleşeceği bölüm numarası
  const at = new Map<number, { treasure?: number; biome?: { id: BiomeId; to: Vitality } }>();
  const tr = TREASURES.find((t) => t.level >= unlocked && t.level <= total && open(t.level));
  if (tr) at.set(tr.level, { treasure: tr.level });
  for (const b of BIOME_ORDER) {
    const v = vitalityOf(b, stars, levels); if (v !== 1 && v !== 2) continue;
    const ls = levels.filter((l) => l.biome === b); const k = v === 1 ? Math.ceil(ls.length / 2) : ls.length;
    const lv = ls[k - 1]!.number; if (!open(lv)) continue;
    at.set(lv, { ...at.get(lv), biome: { id: b, to: (v + 1) as Vitality } });
  }
  if (at.size) {
    const lv = Math.min(...at.keys()); const g = at.get(lv)!;
    return { key: [g.treasure ? `t:${g.treasure}` : '', g.biome ? `b:${g.biome.id}:${g.biome.to}` : ''].filter(Boolean).join('+'), left: lv - unlocked + 1, level: lv, ...g };
  }
  let best: { id: BiomeId; n: number } | null = null;
  // önceki yıldız hedefi sürüyorsa o korunur (başka bölgeden gelen yıldız hedefi değiştirmez)
  const kept = keep?.stars && vitalityOf(keep.stars.id, stars, levels) === 3 ? nextVitalityNeed(keep.stars.id, stars, levels)?.stars : undefined;
  if (keep?.stars && kept) best = { id: keep.stars.id, n: kept };
  else for (const b of BIOME_ORDER) { if (vitalityOf(b, stars, levels) !== 3) continue; const need = nextVitalityNeed(b, stars, levels); if (need?.stars && (!best || need.stars < best.n)) best = { id: b, n: need.stars }; }
  if (best) return { key: `s:${best.id}`, left: best.n, stars: best };
  return journeyDone(stars, total) ? { key: 'son', left: 0 } : null;
}

const name = (b: BiomeId) => BIOMES[b].name;
/** "da/de" bağlacı: son ünlüye göre (Kulak Zarı da, Kemikçikler de) */
const daDe = (w: string) => (/[aıou][^aıoueiöü]*$/i.test(w) ? 'da' : 'de');
/**
 * canlanmanın getirdiği, tek sözle (OT-ogrenci-birinci-30: "canlanır" ne getirir belli değildi). Bölge, bütün bölümleri geçilince
 * canlanır (layout.ts vitalityOf); o son bölüm bitince açılan bölüm yeni bir bölgenin ilk bölümüyse o bölge açılır
 * ("Dış Kulak canlanır: Kulak Kanalı açılır"), değilse (Kemikçikler 19 → Kulak Kanalı 20, zaten açık) bölge tamamlanır.
 */
function riseGain(g: GoalPick, levels: LevelPlan[]): string {
  if (!g.biome || g.biome.to !== 3 || !g.level) return '';
  const opens = opensAfter(g, levels);
  return opens ? `: ${name(opens)} açılır` : ': bölge tamamlanır';
}
/** hedef bölümü bitince ilk kez açılan bölge (yoksa null) */
function opensAfter(g: GoalPick, levels: LevelPlan[]): BiomeId | null {
  const next = g.level ? levels.find((l) => l.number === g.level! + 1) : undefined;
  return next && next.biome !== g.biome?.id && levels.find((l) => l.biome === next.biome)?.number === next.number ? next.biome : null;
}
/** yeni bölgenin kısa adı: "Koklea · Taban" → "Koklea" (bölgenin ilk kısmı açılır; haritanın başlığı tam adı yazar) */
const shortName = (b: BiomeId) => name(b).split(' · ')[0]!;
/**
 * hedef metni: her zaman yer adı ve ne zaman (OT-sinav-adayi-24: "Sıradaki: Bu bölümün sonunda canlanır" neyin canlanacağını ve
 * hangi bölümü söylemiyordu). Sıradaki bölümde gerçekleşecekse bölüm numarası: "Bölüm 33 bitince İşitme Siniri canlanır: Beyin Sapı açılır".
 */
function goalText(g: GoalPick, levels: LevelPlan[] = HUMAN_JOURNEY.levels, short = false): string {
  if (g.stars) return `${g.stars.n} yıldız daha: ${name(g.stars.id)} ışıl ışıl olur`;
  if (!g.treasure && !g.biome) return 'Ninni beyne ulaştı!';
  // yol başka bölgeden bu bölüme geri dönüyorsa önce ne yapılacağı (YN-195, OT-uzman-odyolog-35: Kemikçikler'den sonra Bölüm 20
  // yine dış kulak yolunda), kısa ve düğme gibi okunmadan (YN-241, OT-ilk-kez-oyun-72: "Geri dön (Bölüm 20)" düğme sanıldı, dört
  // satır haritayı kapladı, "Koklea · Taban açılır" anlaşılmadı): "Bölüm 20 · Kulak Kanalı'na dön, kanalı tıkayan Serumen
  // Golemi'ni temizle. Bitince hazine ve yeni bölge: Koklea." Kutu 320 px'te de en çok üç satır: "Hedefe ulaştın!" anında (`short`)
  // yalnız ne yapılacağı, ödül kutu sıradaki hedefe dönünce
  const back = g.left <= 1 && g.level ? levels.find((l) => l.number === g.level)?.back : undefined;
  if (back && short) return `Bölüm ${g.level} · ${back}.`;
  if (back) {
    const opens = g.biome?.to === 3 ? opensAfter(g, levels) : null;
    const gain = [g.treasure ? 'hazine' : '', opens ? `yeni bölge: ${shortName(opens)}` : g.biome ? `${name(g.biome.id)} ${VITALITY_WILL[g.biome.to]}` : ''].filter(Boolean).join(' ve ');
    return `Bölüm ${g.level} · ${back}. Bitince ${gain}.`;
  }
  const when = g.left <= 1 && g.level ? `Bölüm ${g.level} bitince` : `${g.left} bölüm sonra`;
  if (g.treasure && g.biome) { const who = name(g.biome.id); return `${when} hazine! ${who} ${daDe(who)} ${VITALITY_WILL[g.biome.to]}${riseGain(g, levels)}.`; }
  if (g.biome) return `${when} ${name(g.biome.id)} ${VITALITY_WILL[g.biome.to]}${riseGain(g, levels)}`;
  return g.left <= 1 ? `${when} hazine!` : `${when} hazine`;
}
const goalIcon = (g: GoalPick) => (g.treasure ? '🎁' : g.biome ? STAGE_ICON[g.biome.to] : g.stars ? '✨' : '👑');
/** ulaşılan hedefin kutlama cümlesi */
function reachedText(g: GoalPick): string {
  const parts: string[] = [];
  if (g.treasure) parts.push('Hazine açıldı');
  if (g.biome) parts.push(`${name(g.biome.id)} ${DID[g.biome.to]}`);
  if (g.stars) parts.push(`${name(g.stars.id)} ışıl ışıl oldu`);
  return `${parts.join(', ')}!`;
}
/** hedef gerçekten gerçekleşti mi (yalnız gerçekleşen söylenir) */
function reached(g: GoalPick, stars: StarMap): boolean {
  if (g.treasure && !((stars[g.treasure] ?? 0) > 0)) return false;
  if (g.biome && vitalityOf(g.biome.id, stars) < g.biome.to) return false;
  if (g.stars && vitalityOf(g.stars.id, stars) < 4) return false;
  return !!(g.treasure || g.biome || g.stars);
}

/**
 * Haritadaki tek "Sıradaki hedef". `before`: haritanın en son gösterdiği yıldızlar (mapSeen; ilk açılışta null).
 * Önceki hedefe bu dönüşte ulaşıldıysa bir kez söylenir: "Kulak Zarı çiçeklendi! Sıradaki: 2 bölüm sonra Kulak Zarı canlanır: Kemikçikler açılır".
 */
export function mapGoal(stars: StarMap, before: StarMap | null): Goal {
  const was = before ? pickGoal(before) : null;
  const now = pickGoal(stars, undefined, was);
  const text = now ? goalText(now) : 'Ninni beyne ulaştı!'; const icon = now ? goalIcon(now) : '👑';
  if (!was || was.key === now?.key || !reached(was, stars)) return { icon, text };
  // yolculuk bu dönüşte bitti (YN-241, OT-sessiz-oyuncu-33): bitiş anında "Sıradaki: 2 yıldız daha: …" öne çıkmaz, ulaşılan ve
  // Ninni; yıldız hedefi kutu kapanınca (GOAL_REACHED_MS) her zamanki gibi
  const total = HUMAN_JOURNEY.levels.length;
  if (before && !journeyDone(before, total) && journeyDone(stars, total)) return { icon: '👑', small: 'Hedefe ulaştın!', text: `${reachedText(was)} Ninni beyne ulaştı!`, final: true };
  return { icon, small: 'Hedefe ulaştın!', text: now && now.key !== 'son' ? `${reachedText(was)} Sıradaki: ${goalText(now, undefined, true)}` : `${reachedText(was)} Ninni beyne ulaştı!` };
}

/** hazinenin GERÇEK verilen içeriği: defterdeki kayıt (tekrar gelen kozmetik jetona dönmüş olabilir); yoksa tanım */
export function treasureItems(meta: Pick<MetaState, 'ledger'>, n: number): RewardItem[] {
  const rec = [...meta.ledger].reverse().find((g) => g.reason === `hazine:${n}`);
  return rec ? rec.items : treasureAt(n)?.reward ?? [];
}

/**
 * Haritaya dönüş sahnesinin açacağı kutlama pencereleri: açılan hazineler ve ilk kez canlanan bölgeler (MapScreen onTreasure /
 * onZoneRise ile aynı kural; son bölge pencere değil şerittir). Üç ve daha çoksa tek pencerede toplanır (OT-sinav-adayi-17).
 */
export function returnCelebrations(seen: StarMap, now: StarMap, restored: readonly string[]): number {
  return planReturn(seen, now).filter((st) => st.kind === 'treasure' || (st.kind === 'zone' && st.to >= 3 && st.zone !== 'finale' && !restored.includes(st.zone))).length;
}

/**
 * Bölüm kartının hedef satırları (YN-162): geçme koşulu her zaman ayrı ("Kapıya ulaş", canavarda "Canavarı yen"); 3. yıldız
 * satırı sonuç ekranının 3. yıldız kartıyla aynı işlevden (meta star3Rules/starHead): "90 nota ya da 3 altın kokleayı bul ve 60 nota".
 * Bölüm hedefi (altın koklea, süre…) geçmek için gerekmez; yalnız 3. yıldızın bir yoludur.
 */
export function nodeGoalLines(spec: Pick<RunSpecLite, 'mechanic' | 'objective' | 'coinsTotal'>): { pass: string; star3Head: string; star3: string } {
  const rows = star3Rules(spec);
  return { pass: passText(spec), star3Head: starHead(3, rows.length), star3: rows.join(' ya da ') };
}
/**
 * 3. yıldızın tek satırı (YN-176): bölüm başı şeridi ve yeni biyom kartı, bölüm kartı ve sonuçla aynı kaynaktan (nodeGoalLines →
 * meta star3Rules): "3. yıldız: 89 nota ya da 88 saniyede bitir". Bölüm kartını atlayan ("Sonraki", haritanın büyük "Bölüm N"
 * düğmesi) oyuncu da koşulu bölüm başında okur.
 */
export function star3Line(spec: Pick<RunSpecLite, 'mechanic' | 'objective' | 'coinsTotal'>): string {
  return `3. yıldız: ${nodeGoalLines(spec).star3}`;
}
