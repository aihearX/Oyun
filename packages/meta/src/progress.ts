import { RAHAT, levelFromXp, noteThresholds, type BiomeId, type LevelSpec, type MechanicId, type ModifierId, type ObjectiveId, type RunResult } from '@odi/shared';
import { BIOMES, COSMETICS, HUMAN_JOURNEY, MECHANICS, TIER_NAMES, TREASURES, objective, achievementById, achievementDesc, achievementName, cosmeticById, type HatId, type Reward, type RewardItem, type Tier } from '@odi/content';
import type { LevelProgressLite, MetaState } from './state';

/** XP çubuğu: bu seviyenin başı/sonu ve doluluk. levelFromXp ile aynı formül. */
export function xpThreshold(level: number): number { return level <= 1 ? 0 : Math.round(100 * Math.pow(level, 1.4)); }
export function levelProgress(xp: number): { level: number; from: number; to: number; pct: number } {
  const level = levelFromXp(xp); const from = xpThreshold(level); const to = xpThreshold(level + 1);
  return { level, from, to, pct: Math.max(0, Math.min(1, (xp - from) / Math.max(1, to - from))) };
}

export type RunSpecLite = Pick<LevelSpec, 'number' | 'name' | 'biome' | 'mechanic' | 'objective' | 'parTimeSec' | 'coinsTotal'> & Partial<Pick<LevelSpec, 'boss'>>;
export interface NextGoal { text: string; kind: 'yakin' | 'yildiz' | 'hazine' | 'sirada' | 'son' }

/** "yüzde N"nin iyelik + belirtme eki, sayının okunuşuna göre: %1'ini %2'sini %3'ünü %6'sını %9'unu %40'ını %100'ünü */
export function yuzdeEki(n: number): string {
  const birler = ['ını', 'ini', 'sini', 'ünü', 'ünü', 'ini', 'sını', 'sini', 'ini', 'unu'];
  const onlar = ['', 'unu', 'sini', 'unu', 'ını', 'sini', 'ını', 'ini', 'ini', 'ını'];
  const k = Math.abs(Math.round(n));
  if (k === 0) return 'ını';
  if (k % 100 === 0) return 'ünü';
  return k % 10 ? birler[k % 10]! : onlar[(k % 100) / 10]!;
}

/** "yüzde N"nin iyelik eki (yalın): %43'ü %2'si %40'ı — yuzdeEki'nin belirtme eki ("-nı/-ni/-nu/-nü") düşülmüş hali */
export function yuzdeIyelik(n: number): string { return yuzdeEki(n).slice(0, -2); }

/** saniyenin onda biri yukarı yuvarlanır, Türkçe virgülle: 64 → "64", 64,04 → "64,1" (gösterilen süre gerçek süreden kısa olmaz) */
export function sureYazi(sec: number): string {
  const t = Math.ceil(Math.max(0, sec) * 10 - 1e-6) / 10;
  return Number.isInteger(t) ? String(t) : t.toFixed(1).replace('.', ',');
}
/**
 * Sonuç ekranında bölümün süresi (süre kartı ve süreli hedefin notu aynı sayıyı söyler; OT-sinav-adayi-12). Süreli hedef
 * tutmadıysa gösterilen süre hedeften kısa ya da ona eşit olamaz ("64 sn sürdü · yapılmadı" çelişkisi): hedef karşılaştırması
 * yuvarlanmamış süreyle yapılır (LevelScene), sonuçtaki süre onda bire yuvarlanmıştır.
 */
export function runTimeSec(spec: RunSpecLite, r: RunResult): number {
  const target = spec.objective.id === 'timed' ? spec.objective.target : undefined;
  return r.completed && target != null && !r.objectiveMet ? Math.max(r.timeSec, target + 0.1) : r.timeSec;
}
/** "64,4 sn sürdü, 0,4 sn geç" (hedef süreyi tutmayan satırın notu) */
function lateNote(t: number, target: number): string { return `${sureYazi(t)}\u00a0sn sürdü, ${sureYazi(Math.max(0.1, t - target))}\u00a0sn geç`; }

/** Dürüst "neredeyse" geri bildirimi: gerçekte ne eksikse onu söyler. */
export function nextGoal(spec: RunSpecLite, r: RunResult, progress: Record<number, LevelProgressLite> = {}): NextGoal {
  if (!r.completed) {
    const pct = typeof r.extra?.pct === 'number' ? r.extra.pct : null;
    // boss bölümünde kapı yok: pct canavarın yitirdiği güç (LevelScene.pct); bölüm içi bitiş kartıyla aynı dil (YN-082)
    if (pct != null && (spec.mechanic === 'boss' || spec.objective.id === 'boss')) {
      const k = Math.max(1, 100 - Math.round(pct * 100));
      return { kind: 'yakin', text: `${spec.boss?.name ?? 'Canavar'} gücünün %${k}'${yuzdeIyelik(k)} kaldı!` };
    }
    if (pct != null && pct >= 0.5) return { kind: 'yakin', text: `Kapıya %${Math.max(1, 100 - Math.round(pct * 100))} kaldı!` };
    if (pct != null) return { kind: 'yakin', text: `Yolun %${Math.round(pct * 100)}'${yuzdeEki(Math.round(pct * 100))} geçtin. Bir dahakine daha ileri!` };
    return { kind: 'yakin', text: 'Bir daha dene: her denemede yol biraz daha tanıdık.' };
  }
  // Rahat denemede yıldız 1'de kalır: sıradaki yıldız ancak normal denemeyle (karar 42)
  if (r.rahat && spec.coinsTotal <= 0) return { kind: 'yildiz', text: 'Normal denemede 2. yıldız için en çok 1 kez hasar al' };
  if (spec.coinsTotal <= 0) {
    if (r.stars < 3) return { kind: 'yildiz', text: r.stars === 1 ? '2. yıldız için en çok 1 kez hasar al' : '3. yıldız için hiç hasar almadan yen' };
  } else if (r.stars < 3) {
    // eşikler yıldız kuralıyla aynı yerden (shared economy.ts → noteThresholds; yüzmede 2★ %45 nota). Tek cümle, nota sayısı
    // toplam olarak (sonuç ekranındaki "78/98 nota" ile yan yana okunur): "3. yıldız: 90 nota ya da hiç hasar alma"
    const th = noteThresholds(spec); const notesAt = (q: number) => Math.ceil(spec.coinsTotal * q - 1e-9);
    if (r.stars === 1) {
      const t2 = spec.objective.id === 'timed' ? spec.objective.target2 : undefined;
      return { kind: 'yildiz', text: `2. yıldız: ${notesAt(th.star2)} nota${t2 ? ` ya da ${t2} saniyede bitir` : ''}` };
    }
    const n3 = `3. yıldız: ${notesAt(th.star3)} nota`;
    // "hepsini topla" 90 notanın içinde kalır: ikinci yarı yazılmaz (sonuç kartıyla aynı tek sayı; OT-rekabetci-7)
    if (spec.objective.id === 'reach' || spec.objective.id === 'collect-all') return { kind: 'yildiz', text: n3 };
    const hedef = spec.objective.label.charAt(0).toLocaleLowerCase('tr-TR') + spec.objective.label.slice(1);
    // hedefle 3★ için %60 nota da gerekir: koşul her zaman tam yazılır, nota şartı tuttu diye yazıdan düşmez (OT-rekabetci-17)
    const withObj = th.star3Objective ? notesAt(th.star3Objective) : 0;
    return { kind: 'yildiz', text: `${n3} ya da ${hedef}${withObj > 0 ? ` ve ${withObj} nota` : ''}` };
  }
  const t = nextTreasure(spec.number + 1, progress);
  if (t && t.remaining <= 3) return { kind: 'hazine', text: t.remaining === 1 ? 'Sıradaki bölümün sonunda hazine var!' : `${t.remaining} bölüm sonra hazine!` };
  const next = HUMAN_JOURNEY.levels[spec.number];
  return next ? { kind: 'sirada', text: `Sırada: ${next.number}. ${next.name}` } : { kind: 'son', text: 'Yolculuğun sonuna ulaştın. Ninni beyne ulaştı!' };
}

/**
 * Sonuç ekranındaki 3. yıldız kartının bir satırı: koşul, tutturuldu mu, tutmadıysa ne kadar yapıldığı (yazıyla; simge tek başına yetmez).
 * İki parçalı koşulda ("3 altın kokleayı bul ve 60 nota") parts her parçanın ilerlemesi; note bunların " · " ile birleşimi.
 */
export interface StarRow { text: string; done: boolean; note: string; parts?: { text: string; done: boolean }[] }
export interface Star3View { rows: StarRow[]; done: boolean }

/**
 * Hasar satırının notu: "2 hasar aldın". Kalkan ya da Klinik koruması bir vuruşu karşıladıysa can gitmemiştir ama vuruş yine
 * hasar sayılır (sahip kararı 37, YN-088); not bunu açıkça söyler, yoksa oyuncu "hasar almadım ki" der.
 * r.extra.guarded: korumanın karşıladığı vuruş (damageTaken'in içinde); r.extra.klinik: biri Klinik korumasıydı.
 */
export function damageNote(r: RunResult): string {
  const n = r.damageTaken; if (n <= 0) return '';
  const g0 = r.extra?.guarded; const g = Math.min(n, typeof g0 === 'number' && g0 > 0 ? Math.floor(g0) : 0);
  if (g === 0) return `${n}\u00a0hasar aldın`;
  // "Klinik" binanın adı (büyük harf kalır); "kalkan" cümle başında büyür
  const who = (start: boolean) => (r.extra?.klinik === true ? (g >= 2 ? `${start ? 'K' : 'k'}alkan ve Klinik` : 'Klinik') : `${start ? 'K' : 'k'}alkan`);
  const what = `${g === 1 ? 'bir vuruşu' : `${g}\u00a0vuruşu`} karşıladı`;
  if (g === n) return `${who(true)} ${what}, ${g === 1 ? 'bu da hasar sayılır' : 'bunlar da hasar sayılır'}`;
  return `${n}\u00a0hasar aldın (${who(false)} ${what}; ${g === 1 ? 'o da sayılır' : 'onlar da sayılır'})`;
}

/**
 * 3. yıldızın koşul metinleri (tek kaynak: sonuç kartı star3View ve harita bölüm kartı; YN-162). Birden çok satır "ya da"dır
 * (biri yeter). Notasız (boss) bölümde hasarsız; "Tüm notaları topla" 90 notanın içinde kaldığından tek satır; hedefli
 * bölümde ikinci satır hedef ve (gerekirse) %60 nota: "3 altın kokleayı bul ve 60 nota".
 */
export function star3Rules(spec: Pick<RunSpecLite, 'mechanic' | 'objective' | 'coinsTotal'>): string[] {
  if (spec.coinsTotal <= 0) return ['Hiç hasar alma'];
  const th = noteThresholds(spec); const notesAt = (q: number) => Math.ceil(spec.coinsTotal * q - 1e-9);
  const n3 = notesAt(th.star3); const o = spec.objective;
  const rows = [o.id === 'collect-all' ? `${n3} nota topla` : `${n3} nota`];
  if (o.id !== 'reach' && o.id !== 'collect-all' && th.star3Objective !== null) {
    const need = notesAt(th.star3Objective);
    rows.push(`${o.label}${need > 0 ? ` ve ${need} nota` : ''}`);
  }
  return rows;
}
/** yıldız kartının başlığı (sonuç ekranı ve harita bölüm kartı): "3. yıldız · biri yeter" */
export function starHead(n: number, rows: number): string { return `${n}. yıldız${rows > 1 ? ' · biri yeter' : ''}`; }
/**
 * Bölümü geçme koşulu (harita bölüm kartı; YN-162): canavar bölümünde canavarı yenmek, öbürlerinde kapıya ulaşmak. Bölüm
 * hedefi (altın koklea, süre, Fısıltı…) geçmeyi değil yalnız 3. yıldızı etkiler (scoreRun; LevelScene.objectiveMet).
 */
export function passText(spec: Pick<RunSpecLite, 'mechanic' | 'objective'>): string {
  return objective(spec.mechanic === 'boss' || spec.objective.id === 'boss' ? 'boss' : 'reach').label;
}

/**
 * 3. yıldızın koşulları, sonuç kartı için (yıldız kuralıyla aynı yerden: shared economy.ts → scoreRun / noteThresholds).
 * "Ya da"lı kural iki satır olur (biri yeter), her satır kendi ilerlemesini söyler: "7 nota kaldı", "1 hasar aldın", "3/7 sırayla".
 * "Tüm notaları topla" 90 notanın içinde kaldığından tek satır: "90 nota topla". Notasız (boss) bölümde 3★ hasarsız bitirmektir.
 */
export function star3View(spec: RunSpecLite, r: RunResult): Star3View {
  const num = (k: string) => { const v = r.extra?.[k]; return typeof v === 'number' ? v : 0; };
  const texts = star3Rules(spec);
  const dmg: StarRow = { text: texts[0]!, done: r.damageTaken === 0, note: damageNote(r) };
  if (spec.coinsTotal <= 0) return { rows: [dmg], done: r.stars === 3 };
  const th = noteThresholds(spec); const notesAt = (q: number) => Math.ceil(spec.coinsTotal * q - 1e-9);
  const n3 = notesAt(th.star3); const o = spec.objective;
  const rows: StarRow[] = [{ text: texts[0]!, done: r.coins >= n3, note: r.coins >= n3 ? '' : `${n3 - r.coins}\u00a0nota kaldı` }];
  if (texts.length > 1 && th.star3Objective !== null) {
    // hedefle 3★ için %60 nota da gerekir (yüzmede 2★ %45 notayla gelir): koşul her zaman tam yazılır, nota şartı tuttu diye
    // yazıdan düşmez; not iki parçanın ilerlemesini söyler, tutan parça "tamam" (OT-rekabetci-17): "60 nota tamam · 2/3 altın koklea"
    const need = notesAt(th.star3Objective); const short = need > r.coins;
    const text = texts[1]!;
    const prog = o.id === 'no-damage' ? (r.objectiveMet ? 'hasar almadın' : dmg.note)
      : o.id === 'secret' ? `${num('cochleas')}/${num('cochleasTotal') || 3}\u00a0altın koklea`
      : o.id === 'melody' ? `${num('melody')}/${num('melodyTotal') || o.target || 0}\u00a0sırayla`
      : o.id === 'timed' ? (r.objectiveMet ? 'süre tamam' : lateNote(runTimeSec(spec, r), o.target ?? spec.parTimeSec))
      : o.id === 'escort' ? (r.objectiveMet ? 'Fısıltı kapıda' : 'Fısıltı yolda kaldı')
      : r.objectiveMet ? 'hedef tamam' : '';
    const done = r.objectiveMet && !short;
    const objPart = { text: prog, done: r.objectiveMet };
    // tutan parça önde, eksik olan sonda
    const parts = need <= 0 ? [objPart] : !short ? [{ text: `${need}\u00a0nota tamam`, done: true }, objPart] : [...(r.objectiveMet ? [objPart] : []), { text: `${need - r.coins}\u00a0nota kaldı`, done: false }, ...(r.objectiveMet ? [] : [objPart])];
    const shown = parts.filter((x) => x.text);
    rows.push({ text, done, note: done ? '' : shown.map((x) => x.text).join(' · '), ...(done || shown.length < 2 ? {} : { parts: shown }) });
  }
  return { rows, done: r.stars === 3 };
}

/**
 * 1★ sonucunda 2. yıldızın koşulları (yıldız kuralıyla aynı yerden: scoreRun / noteThresholds): nota eşiği, süreli bölümde
 * ya da 2★ süresi (biri yeter); notasız (boss) bölümde en çok 1 hasar. 3. yıldız kartının yerinde gösterilir (OT-buyuk-yazi-16):
 * 2★ yokken 3★'ın koşulları yanıltır.
 */
export function star2View(spec: RunSpecLite, r: RunResult): Star3View {
  if (spec.coinsTotal <= 0) return { rows: [{ text: 'En çok 1 kez hasar al', done: r.damageTaken <= 1, note: r.damageTaken > 1 ? damageNote(r) : '' }], done: r.stars >= 2 };
  const n2 = Math.ceil(spec.coinsTotal * noteThresholds(spec).star2 - 1e-9);
  const rows: StarRow[] = [{ text: `${n2} nota`, done: r.coins >= n2, note: r.coins >= n2 ? '' : `${n2 - r.coins}\u00a0nota kaldı` }];
  const t2 = spec.objective.id === 'timed' ? spec.objective.target2 : undefined;
  if (t2) { const met = r.timeSec <= t2; rows.push({ text: `${t2} saniyede bitir`, done: met, note: met ? '' : lateNote(r.timeSec, t2) }); }
  return { rows, done: r.stars >= 2 };
}

/** son hasarın kaynağı → "en son …" (sim.ts hurt nedenleri; boss saldırıları tek cümle) */
const LOSS_WHAT: Record<string, string> = {
  fall: 'boşluğa düştün', diken: 'dikene değdin', gurultu: 'bir engele çarptın', dusman: 'bir gürültü yaratığına çarptın',
  mermi: 'bir mermi sana değdi', nefes: 'nefesin tükendi', freq: 'kapıya yanlış frekansla girdin',
  yumruk: 'canavarın saldırısına yakalandın', top: 'canavarın saldırısına yakalandın', damla: 'canavarın saldırısına yakalandın',
  dalga: 'canavarın saldırısına yakalandın', bulut: 'canavarın saldırısına yakalandın',
};
const LOSS_TIP: Record<string, string> = {
  fall: 'Boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.',
  diken: 'Dikenin üstünden zıpla; basılı tutarsan daha yükseğe çıkarsın.',
  // sim'de "gurultu": fırlamadan gürültü duvarına dayanmak ya da diken dışı bir engele (perde, buşon, bulut) değmek
  gurultu: 'Engele değme: üstünden zıpla, sarkan perdenin altından aşağı kaydırıp kay, yanıp sönen engelde söndüğü anı bekle.',
  dusman: 'Gürültü yaratıklarının çoğunu üstüne zıplayarak ezebilirsin.',
  nefes: 'Arada yüzeye çıkıp nefes al.',
  freq: 'Kapıdan önce diyapazona değ: rengin kapıyla aynı olsun.',
};
/** yüzme mekaniğinin kendi nedenleri: ipuçları mekaniğin ipucundan daha yerinde (nefes, diyapazon) */
const MECHANIC_OWN_TIP = new Set(['nefes', 'freq']);
/**
 * Mekaniğe göre neden ipucu (OT-ilk-kez-oyun-37): koşunun genel cümlesinin yerine o mekaniğin hareketiyle. Kurallar sim.ts'den:
 * gürültü duvarı yalnız fırlarken (ses darbesi) kırılır, fırlamadan dayanınca hasar verir; yankı yolu fırladıktan sonra ~3 sn
 * görünür ve katıdır; fırlama havada bir kez yapılabilir; oklu yerçekimi bölgesinde dokunuş zıplatmaz, yerçekimini çevirir.
 * Mekaniğin kendi cümlesi olduğundan yeni mekaniğin ilk bölümlerinde de mekanik listesinden önce gelir.
 */
const MECH_REASON_TIP: Partial<Record<MechanicId, Partial<Record<string, string>>>> = {
  impuls: {
    gurultu: 'Gürültü duvarına koşu yönüne kaydırarak fırla: kırılır. Fırlamadan değersen hasar alırsın.',
    fall: 'Yankı yoluna gelmeden koşu yönüne kaydır: fırlayınca yol 3 saniye belirir. Havadayken de bir kez fırlayabilirsin.',
  },
  ruya: {
    gurultu: 'Gürültü duvarına koşu yönüne kaydırarak fırla: kırılır. Fırlamadan değersen hasar alırsın.',
    fall: 'Oklu mor bölgede dokunuş zıplatmaz, yerçekimini çevirir: zemin bitmeden tavana, tavan bitmeden zemine çevir.',
  },
};
/** bölüm, mekaniğinin yolculuktaki ilk iki bölümünden biri mi (koşu temel mekanik: ipuçlarını nedenler verir) */
function newMechanic(spec: Pick<RunSpecLite, 'number' | 'mechanic'>): boolean {
  if (spec.mechanic === 'kosu') return false;
  return HUMAN_JOURNEY.levels.filter((l) => l.mechanic === spec.mechanic).slice(0, 2).some((l) => l.number === spec.number);
}
/**
 * Bölümün kendi zorluğuna göre kayıp ipuçları (OT-ilk-kez-oyun-19): değiştiriciler, hedef, canavar. Her cümle oyunda görünen
 * bir şeye dayanır, yalnız sese değil: sis/gece LevelScene.buildFog (Odi'nin çevresinde aydınlık halka), gecikme sim effectiveInput
 * (dokunuş 0,14 sn geç işler), melodi LevelScene (nota biçimli altın notalar soldan sağa, her doğruda "Nota 3/7" yazısı), canavar
 * render/boss.ts telegrafları (gölge, parlayan duvar, ok). Jetonla alınan yetenek önerilmez (OT-ilk-kez-oyun-50: gürültü duvarına
 * çarpıp kaybedene "Yankı Görüşü" önerisi hem ilgisizdi hem satın almaya yönlendiriyordu).
 */
const MOD_TIPS: Partial<Record<ModifierId, string[]>> = {
  sis: ['Siste yalnız Odi\'nin çevresi aydınlık: engel o ışık halkasına girince zıpla.'],
  gece: ['Gecede yalnız Odi\'nin çevresi görünür: halkanın kenarına bak, engel orada belirir.'],
  yanki: ['Gecikmede dokunuşun bir an geç işler: zıplamaya biraz erken bas.'],
  hiz: ['Bu bölümde Odi daha hızlı koşar: engel ekrana girer girmez hazırlan.'],
};
const OBJECTIVE_TIPS: Partial<Record<ObjectiveId, string>> = {
  melody: 'Nota biçimli altın notaları soldan sağa, hiç atlamadan topla: her doğru notada "Nota 3/7" gibi sırası yazar.',
};
const BOSS_TIPS = ['Her saldırıdan önce bir uyarı görünür (yere düşen gölge, parlayan duvar, ok): onu görünce oradan uzaklaş.'];
/**
 * Canavarın kendi vuruş yolu (OT-ilk-kez-oyun-46), play/boss.ts kuralıyla: Gürültü Canavarı bağırınca 3 nota belirir, hepsi toplanınca
 * kalbi yere iner; ses darbesiyle (koşu yönüne kaydırma) ya da çakılmayla vurulur. Fiiller kartlardaki gibi (OT-ilk-kez-oyun-16/-37).
 */
const BOSS_HIT_TIP: Record<string, string> = {
  'gurultu-canavari': 'Bağırınca çıkan 3 notayı topla: kalbi açılınca ileri fırla ya da havadan aşağı kaydırıp üstüne in.',
};
type LossSpec = Pick<RunSpecLite, 'number' | 'mechanic'> & Partial<Pick<LevelSpec, 'modifiers' | 'objective'>>;
/**
 * Bir bölümün kayıp ipuçları, gösterilme sırasıyla. Yeni bir mekaniğin ilk iki bölümünde önce mekaniğin kendisi (kanca
 * bölümünde zıplama anlatılmasın; OT-ilk-kez-oyun-15; yüzmenin kendi nedenleri nefes/diyapazon ve MECH_REASON_TIP kendi cümlesiyle), sonra
 * son hasarın nedeni (bilinen nedende önce o: OT-ilk-kez-oyun-50), bölümün zorluğu (değiştirici, canavar), hedef ve mekaniğin ipucu.
 * Her gruptan birer cümle sırayla alınır (art arda kayıpta aynı türden iki cümle üst üste gelmez).
 */
export function lossTips(reason: string, spec?: LossSpec): string[] {
  const mechTip = spec ? MECH_REASON_TIP[spec.mechanic]?.[reason] : undefined;
  const own = MECHANIC_OWN_TIP.has(reason) || mechTip !== undefined; const reasonTip = mechTip ?? LOSS_TIP[reason];
  if (!spec) return reasonTip ? [reasonTip] : [];
  // canavar bölümünde mekaniğin genel cümlesi yerine o canavarın vuruş yolu (varsa)
  const bossId = spec.mechanic === 'boss' ? HUMAN_JOURNEY.levels.find((l) => l.number === spec.number)?.boss : undefined;
  const mech = (bossId && BOSS_HIT_TIP[bossId]) || MECHANICS[spec.mechanic].hint; const fresh = newMechanic(spec) && !own;
  const groups: string[][] = [
    fresh ? [mech] : [],
    reasonTip ? [reasonTip] : [],
    (spec.modifiers ?? []).flatMap((m) => MOD_TIPS[m] ?? []),
    spec.mechanic === 'boss' ? [mech, ...BOSS_TIPS] : [],
    spec.objective && OBJECTIVE_TIPS[spec.objective.id] ? [OBJECTIVE_TIPS[spec.objective.id]!] : [],
    // koşunun ipucu beş hareketlik bir liste (temel mekanik; ipuçlarını nedenler verir)
    spec.mechanic === 'kosu' ? [] : [mech],
  ];
  const out: string[] = []; const most = Math.max(...groups.map((g) => g.length));
  for (let i = 0; i < most; i++) for (const g of groups) { const t = g[i]; if (t && !out.includes(t)) out.push(t); }
  return out;
}
/**
 * Kayıpta neden (OT-ilk-kez-oyun-8): "Tekrar dene"nin üstünde. Canlar mı bitti, en son neye çarptı; tek cümle ipucu, bölümün
 * kendi zorluğuna göre (lossTips). attempt: bu bölümdeki deneme sayısı (1'den); aynı bölümde art arda kayıpta sıradaki cümle
 * gelir (OT-ilk-kez-oyun-19: 7 kayıptan 6'sında aynı "Boşluklarda…" cümlesi).
 * reason: LevelScene.fail (sim'in son hasar nedeni ya da 'yaris-bitti').
 */
export function lossView(r: RunResult, spec?: LossSpec, attempt = 1): { title: string; detail: string; tip: string } {
  const reason = typeof r.extra?.reason === 'string' ? r.extra.reason : '';
  if (reason === 'yaris-bitti') return { title: 'Yarış bitti', detail: 'Sen kapıya varmadan yarış kapandı.', tip: '' };
  const n = r.damageTaken; const what = LOSS_WHAT[reason];
  const detail = n > 0 ? `${n} kez hasar aldın${what ? `, en son ${what}` : ''}.` : what ? `${what.charAt(0).toLocaleUpperCase('tr-TR')}${what.slice(1)}.` : '';
  const tips = lossTips(reason, spec);
  const tip = tips.length ? tips[(Math.max(1, Math.floor(attempt)) - 1) % tips.length]! : '';
  return { title: 'Canların bitti', detail, tip };
}

// ---------------------------------------------------------------- Rahat deneme (sahip kararı 42, YN-110)

/**
 * Kayıp ekranı Rahat denemeyi teklif eder mi: yalnız canavar bölümünde, o bölümde art arda `RAHAT.afterFails` kayıptan sonra
 * (sayaç `processRun`'da; normal geçişte sıfırlanır). Teklif her kayıpta yeniden gösterilir; oyuncu her seferinde kendisi seçer,
 * hiçbir deneme kendiliğinden Rahat olmaz.
 */
export function rahatOffer(spec: Pick<RunSpecLite, 'mechanic'>, p: Pick<LevelProgressLite, 'fails'> | undefined): boolean {
  return spec.mechanic === 'boss' && (p?.fails ?? 0) >= RAHAT.afterFails;
}
const RAHAT_PCT = Math.round((1 - RAHAT.slow) * 100);
/** Rahat denemenin oyuncuya söylenen yüzü: teklif kartı, sonuç kartı, harita kartı (hepsi aynı kurallarla, açıkça) */
export const RAHAT_TEXT = {
  title: 'Rahat deneme',
  /** ne değişir (teklif kartı ve Rahat kayıp satırı) */
  what: `Canavar %${RAHAT_PCT} yavaş, ${RAHAT.extraLives} can fazla.`,
  /** ne verir, ne vermez */
  rules: `En çok ${RAHAT.maxStars} yıldız verir; lig, düello ve takım puanı yazılmaz.`,
  offer: (fails: number) => `Bu canavarda üst üste ${fails} kez kaybettin. İstersen bir sonraki denemeyi rahat oyna; her seferinde sen seçersin.`,
  button: 'Rahat dene',
  /** düğmenin altındaki kısa satır */
  short: `%${RAHAT_PCT} yavaş, +${RAHAT.extraLives} can, en çok ${RAHAT.maxStars} yıldız`,
  /** Rahat denemeyle kazanınca sonuç kartının başlığı ve notu */
  passed: 'Rahat denemeyle geçildi',
  passedNote: `En çok ${RAHAT.maxStars} yıldız; lig, düello ve takım puanı yazılmadı. Normal denemede daha çok yıldız alırsan yıldızın yükselir.`,
  /** Rahat denemeyle kaybedince */
  lostNote: `Bu Rahat denemeydi (canavar %${RAHAT_PCT} yavaş, ${RAHAT.extraLives} can fazla).`,
  /** harita kartı: yıldız yalnız Rahat denemeyle alındıysa */
  mapNote: 'Rahat denemeyle geçildi: normal denemeyle yıldızını yükseltebilirsin.',
} as const;

/** "Bu bölümden" dökümünün bir satırı; birden çok başarım tek satırda toplanır, altında her biri (items) adıyla ve ödülüyle */
export interface EarnLine { label: string; jeton: number; note?: string; items?: EarnLine[] }
/**
 * "Bu bölümden" dökümü: bu koşunun ödül defteri kayıtlarındaki jeton (+ sunucunun bölüm jetonuna eklediği bonus). Toplam =
 * cüzdana giren (YN-042). Başarımlar tek tek: "Yıldız Avcısı · Gümüş +40", altında koşulu (OT-ekonomi-denetci-17,
 * OT-ogrenci-birinci-16); ikiden çoksa "6 başarım +215" satırının altında.
 */
export function earnLines(s: { grants: { reason: string; items: RewardItem[] }[] }, serverBonus = 0): EarnLine[] {
  const out: EarnLine[] = []; const ach: EarnLine[] = [];
  for (const g of s.grants) {
    const jeton = g.items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0); if (!jeton) continue;
    const [kind, id, t] = g.reason.split(':');
    if (kind === 'basarim') {
      const a = achievementById(id ?? ''); const tier = Math.max(1, Math.min(3, Number(t) || 1)) as Tier;
      ach.push(a ? { label: `${achievementName(a, tier)} · ${TIER_NAMES[tier]}`, jeton, note: achievementDesc(a, tier) } : { label: 'Başarım', jeton });
      continue;
    }
    out.push({ label: kind === 'bolum' ? 'Toplanan notalar' : kind === 'sansli-nota' ? 'Şanslı Nota' : kind === 'hazine' ? `Bölüm ${id} hazinesi` : kind === 'kart' ? 'Kart karşılığı' : kind === 'kozmetik' ? 'Kozmetik karşılığı' : 'Ödül', jeton });
  }
  if (ach.length === 1) out.push({ ...ach[0]!, label: `Başarım: ${ach[0]!.label}` });
  else if (ach.length) out.push({ label: `${ach.length} başarım`, jeton: ach.reduce((a, x) => a + x.jeton, 0), items: ach });
  if (serverBonus) out.push({ label: serverBonus > 0 ? 'Kamp/takım bonusu' : 'Sunucu düzeltmesi', jeton: serverBonus });
  return out;
}

/** Haritada görünür sıradaki hazine: "N bölüm sonra hazine". */
export function nextTreasure(fromLevel: number, progress: Record<number, LevelProgressLite>, claimed: number[] = []): { level: number; remaining: number; reward: Reward } | null {
  const t = TREASURES.find((x) => x.level >= fromLevel && !claimed.includes(x.level) && !((progress[x.level]?.stars ?? 0) > 0));
  if (!t) return null;
  return { level: t.level, reward: t.reward, remaining: t.level - fromLevel + 1 };
}

export function biomeStats(levels: { number: number }[], progress: Record<number, LevelProgressLite>) {
  const stars = levels.reduce((a, l) => a + (progress[l.number]?.stars ?? 0), 0); const cleared = levels.filter((l) => (progress[l.number]?.stars ?? 0) > 0).length;
  return { stars, maxStars: levels.length * 3, cleared, total: levels.length, pct: levels.length ? stars / (levels.length * 3) : 0 };
}

export interface Announcement { kind: 'biyom' | 'mekanik'; id: string; title: string; text: string }
/** Bölümü ilk kez bitirince kapısı aralanan yenilikler (bir sonraki bölümün yeni biyomu/mekaniği). */
export function unlockAnnouncements(levelNumber: number): Announcement[] {
  const levels = HUMAN_JOURNEY.levels; const next = levels[levelNumber]; if (!next) return [];
  const before = levels.slice(0, levelNumber); const out: Announcement[] = [];
  if (!before.some((l) => l.biome === next.biome)) out.push({ kind: 'biyom', id: next.biome, title: `Yeni biyom: ${BIOMES[next.biome].name}`, text: BIOMES[next.biome].blurb });
  // oyuncuya "mekanik" kelimesi ve simge (emoji) yazılmaz; seviye penceresi de bu başlığı gösterir (OT-ilk-kez-oyun-22)
  if (!before.some((l) => l.mechanic === next.mechanic)) { const m = MECHANICS[next.mechanic]; out.push({ kind: 'mekanik', id: next.mechanic, title: next.mechanic === 'boss' ? 'Yeni: Canavar bölümleri' : `Yeni: ${m.name}`, text: m.hint }); }
  return out;
}
/** Bölümden önce gösterilecek biyom sinematiği gerekli mi? */
export function needsBiomeIntro(meta: Pick<MetaState, 'seenBiomes'>, biome: BiomeId): boolean { return !meta.seenBiomes.includes(biome); }

// ---------------------------------------------------------------- kozmetik görünüm

export interface Look { color: number; hat?: HatId; colorId: string; hatId: string }
export function resolveLook(meta: Pick<MetaState, 'cosmetics'>): Look {
  const c = cosmeticById(meta.cosmetics.color); const h = cosmeticById(meta.cosmetics.hat);
  return { color: c?.color ?? 0x6c4cf1, hat: h?.hat ?? c?.hat, colorId: c?.id ?? 'renk-mor', hatId: h?.id ?? 'sapka-yok' };
}
export function equipCosmetic(meta: MetaState, id: string): MetaState {
  const def = cosmeticById(id); if (!def || !meta.cosmetics.owned.includes(id)) return meta;
  return { ...meta, cosmetics: { ...meta.cosmetics, ...(def.kind === 'renk' ? { color: id } : { hat: id }) } };
}
export const COSMETIC_COUNT = COSMETICS.length;
