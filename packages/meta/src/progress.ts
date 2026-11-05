import { BUILDINGS, RAHAT, TEAM_TECH, levelFromXp, noteThresholds, type BiomeId, type LevelSpec, type MechanicId, type ModifierId, type JetonBonusPart, type ObjectiveId, type RunResult } from '@odi/shared';
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
    const hedef = yaDaSonrasi(spec.objective.label);
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
 * İki parçalı koşulda ("3 altın kokleayı bul ve 60 nota") parts her parçanın ilerlemesi; note bunların " · " ile birleşimi. Koşulun
 * tamamı tutmadıkça tutan parça "tamam" demez, nötr "var" der; eksik parça açıkça "eksik" ya da "kaldı" (OT-buyuk-yazi-74, YN-262).
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
 * "ya da"dan sonra gelen koşul cümle içinde okunur, ilk harfi Türkçe küçük harf olur ("89 nota ya da hiç hasar alma ve 59 nota";
 * OT-ogrenci-birinci-45). Fısıltı yoldaşın adıdır, büyük kalır. Tek başına ya da ilk satır olan koşul büyük harfle başlar.
 */
function yaDaSonrasi(s: string): string { return s.startsWith('Fısıltı') ? s : s.charAt(0).toLocaleLowerCase('tr-TR') + s.slice(1); }
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
    rows.push(`${yaDaSonrasi(o.label)}${need > 0 ? ` ve ${need} nota` : ''}`);
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
    // yazıdan düşmez; not iki parçanın ilerlemesini söyler (OT-rekabetci-17). Koşulun tamamı tutmadıkça tutan parça "tamam" demez
    // (OT-buyuk-yazi-74: "59 nota tamam" 3. yıldız alındı sanıldı): "59 nota: var · 0/3 altın koklea: eksik"
    const need = notesAt(th.star3Objective); const short = need > r.coins;
    const text = texts[1]!;
    const sayi = (s: string) => `${s}: ${r.objectiveMet ? 'var' : 'eksik'}`;
    const prog = o.id === 'no-damage' ? (r.objectiveMet ? 'hasar almadın' : dmg.note)
      : o.id === 'secret' ? sayi(`${num('cochleas')}/${num('cochleasTotal') || 3}\u00a0altın koklea`)
      : o.id === 'melody' ? sayi(`${num('melody')}/${num('melodyTotal') || o.target || 0}\u00a0sırayla`)
      : o.id === 'timed' ? (r.objectiveMet ? 'süreye yetiştin' : lateNote(runTimeSec(spec, r), o.target ?? spec.parTimeSec))
      : o.id === 'escort' ? (r.objectiveMet ? 'Fısıltı kapıda' : 'Fısıltı yolda kaldı')
      : r.objectiveMet ? 'hedef: var' : '';
    const done = r.objectiveMet && !short;
    const objPart = { text: prog, done: r.objectiveMet };
    // tutan parça önde, eksik olan sonda
    const parts = need <= 0 ? [objPart] : !short ? [{ text: `${need}\u00a0nota: var`, done: true }, objPart] : [...(r.objectiveMet ? [objPart] : []), { text: `${need - r.coins}\u00a0nota kaldı`, done: false }, ...(r.objectiveMet ? [] : [objPart])];
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
  nefes: 'Su altında nefesin azalır (Odi\'nin üstündeki çubuk): yüzeye çık ya da kabarcığa değ.',
  freq: 'Kapıdan önce diyapazona değ: rengin kapıyla aynı olsun.',
};
/**
 * yüzme mekaniğinin kendi nedenleri: ipuçları mekaniğin ipucundan daha yerinde (nefes, diyapazon). Bu nedenle kaybedince ipucu
 * her denemede önce o nedeni anlatır, öbür ipuçları yalnız ikinci satırda sırayla gelir (OT-ilk-kez-oyun-73, YN-254: 7 nefes
 * kaybının yalnız ilkinde nefes anlatılmıştı)
 */
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
/** golemde genel "uzaklaş" yerine uyarıların ne olduğu: yumruktan kaçmanın güvenilir yolu zıplamak (GOLEM_TIP ölçümü) */
const BOSS_TIPS_BY: Record<string, string[]> = {
  'serumen-golemi': ['Her saldırıdan önce bir uyarı görünür: yumrukta yere düşen gölge, topta parlayan duvar, damlada yere düşen küçük gölge.'],
};
/**
 * Canavarın kendi vuruş yolu (OT-ilk-kez-oyun-46), play/boss.ts kuralıyla: Gürültü Canavarı bağırınca 3 nota belirir, hepsi toplanınca
 * kalbi yere iner; ses darbesiyle (koşu yönüne kaydırma) ya da çakılmayla vurulur. Fiiller kartlardaki gibi (OT-ilk-kez-oyun-16/-37).
 */
const BOSS_HIT_TIP: Record<string, string> = {
  'gurultu-canavari': 'Bağırınca çıkan 3 notayı topla: kalbi açılınca ileri fırla ya da havadan aşağı kaydırıp üstüne in.',
  // öğretici anla aynı söz (tutorial.ts BOSS_TUTOR_TEXT): saplı yumruğa çakılma −2 (play/boss.ts golem)
  'serumen-golemi': 'Yere saplanan yumruk parlar: üstüne zıpla, havada aşağı kaydırıp çakıl.',
};
/**
 * Serumen Golemi'nde kaybettiren saldırıya ve faza göre somut ipucu (sahip kararı 52 (c), YN-249; ölçüm docs/yonetim/canavar-olcum.md).
 * play/boss.ts golem() kuralıyla: yumruk gölgenin düştüğü yere iner ve yalnız yerdekine değer; gölge belirdikten sonra (gölge
 * büyürken, tam boyuna gelmeden) zıplayan hiç vurulmadı (normal ve Rahat, 20'şer uyarı), ters yöne dönen uyarıların %20-80'inde
 * yine vuruldu. Faz 2'den sonra parlayan duvardan top yuvarlanır (üstünden zıplanır), Faz 3'te iki yumruk ve tavandan damla
 * (gölgesi yere düşer; koşu yönüne göre nişanlanır). Kayıp ekranında bu ipucu her denemede tek başına (ikinci satır yok: Rahat
 * deneme teklifi ve takım yardımı kartı 320×640'ta ilk ekranda kalsın; faz ve saldırı "en son Faz 2'de yumruğa yakalandın" satırında).
 * "Gölge büyürken": normalde gölge tam boyundayken (0,92 sn) zıplayan vuruldu.
 */
const GOLEM_TIP: Record<string, Partial<Record<1 | 2 | 3, string>>> = {
  yumruk: {
    1: 'Gölge yumruğun ineceği yer: gölge büyürken zıpla.',
    2: 'Faz 2\'de de yumruk sürer: gölge büyürken zıpla.',
    3: 'Faz 3\'te iki yumruk iner: iki gölgeye de bak, büyürken zıpla.',
  },
  top: {
    2: 'Duvar parlayınca top yuvarlanır: yaklaşınca üstünden zıpla.',
    3: 'Duvar parlayınca top yuvarlanır: yaklaşınca üstünden zıpla.',
  },
  damla: {
    3: 'Damlanın gölgesine doğru koşuyorsan ters yöne kaydırıp dön.',
  },
};
/** canavarın kaybettiren saldırısının adı (sonuç "en son …"; genel söz LOSS_WHAT) */
const GOLEM_WHAT: Record<string, string> = { yumruk: 'yumruğa yakalandın', top: 'yuvarlanan topa çarptın', damla: 'tavandan düşen damla sana değdi' };
/** bölüm canavar bölümüyse canavarın kimliği (yolculuktan) */
const bossOf = (spec?: Pick<RunSpecLite, 'number' | 'mechanic'>) => (spec?.mechanic === 'boss' ? HUMAN_JOURNEY.levels.find((l) => l.number === spec.number)?.boss : undefined);
/** golemin faz ipucu (yoksa undefined): kaybettiren saldırı ve o andaki faz (LevelScene.fail → extra.faz) */
export function golemTip(reason: string, faz: number | undefined, spec?: Pick<RunSpecLite, 'number' | 'mechanic'>): string | undefined {
  if (bossOf(spec) !== 'serumen-golemi' || !faz) return undefined;
  return GOLEM_TIP[reason]?.[Math.max(1, Math.min(3, Math.round(faz))) as 1 | 2 | 3];
}
type LossSpec = Pick<RunSpecLite, 'number' | 'mechanic'> & Partial<Pick<LevelSpec, 'modifiers' | 'objective'>>;
/**
 * Bir bölümün kayıp ipuçları, gösterilme sırasıyla. Yeni bir mekaniğin ilk iki bölümünde önce mekaniğin kendisi (kanca
 * bölümünde zıplama anlatılmasın; OT-ilk-kez-oyun-15; yüzmenin kendi nedenleri nefes/diyapazon ve MECH_REASON_TIP kendi cümlesiyle), sonra
 * son hasarın nedeni (bilinen nedende önce o: OT-ilk-kez-oyun-50), bölümün zorluğu (değiştirici, canavar), hedef ve mekaniğin ipucu.
 * Her gruptan birer cümle sırayla alınır (art arda kayıpta aynı türden iki cümle üst üste gelmez).
 */
export function lossTips(reason: string, spec?: LossSpec, faz?: number): string[] {
  const mechTip = (spec ? MECH_REASON_TIP[spec.mechanic]?.[reason] : undefined) ?? golemTip(reason, faz, spec);
  const own = MECHANIC_OWN_TIP.has(reason) || mechTip !== undefined; const reasonTip = mechTip ?? LOSS_TIP[reason];
  if (!spec) return reasonTip ? [reasonTip] : [];
  // canavar bölümünde mekaniğin genel cümlesi yerine o canavarın vuruş yolu (varsa)
  const bossId = bossOf(spec);
  const mech = (bossId && BOSS_HIT_TIP[bossId]) || MECHANICS[spec.mechanic].hint; const fresh = newMechanic(spec) && !own;
  const groups: string[][] = [
    fresh ? [mech] : [],
    reasonTip ? [reasonTip] : [],
    (spec.modifiers ?? []).flatMap((m) => MOD_TIPS[m] ?? []),
    spec.mechanic === 'boss' ? [mech, ...((bossId && BOSS_TIPS_BY[bossId]) || BOSS_TIPS)] : [],
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
 * reason: LevelScene.fail (sim'in son hasar nedeni ya da 'yaris-bitti'). Nefes ve diyapazon kaybında tip her denemede o nedenin
 * cümlesi, tip2 sıradaki öbür ipucu (MECHANIC_OWN_TIP).
 */
export function lossView(r: RunResult, spec?: LossSpec, attempt = 1): { title: string; detail: string; tip: string; tip2?: string } {
  const reason = typeof r.extra?.reason === 'string' ? r.extra.reason : '';
  if (reason === 'yaris-bitti') return { title: 'Yarış bitti', detail: 'Sen kapıya varmadan yarış kapandı.', tip: '' };
  // canavar bölümünde kaybın fazı (LevelScene.fail; karar 52): golemde ipucu o fazın o saldırısına göre, sonuç "en son Faz 2'de …"
  const faz = typeof r.extra?.faz === 'number' ? r.extra.faz : undefined;
  const golem = golemTip(reason, faz, spec);
  const n = r.damageTaken; const what = golem && GOLEM_WHAT[reason] ? `Faz ${faz}'${faz === 3 ? 'te' : 'de'} ${GOLEM_WHAT[reason]}` : LOSS_WHAT[reason];
  const detail = n > 0 ? `${n} kez hasar aldın${what ? `, en son ${what}` : ''}.` : what ? `${what.charAt(0).toLocaleUpperCase('tr-TR')}${what.slice(1)}.` : '';
  const tips = lossTips(reason, spec, faz); const i = Math.max(1, Math.floor(attempt)) - 1;
  const own = MECHANIC_OWN_TIP.has(reason) ? LOSS_TIP[reason] : undefined;
  if (golem) return { title: 'Canların bitti', detail, tip: golem };
  if (own) { const rest = tips.filter((t) => t !== own); return { title: 'Canların bitti', detail, tip: own, ...(rest.length ? { tip2: rest[i % rest.length]! } : {}) }; }
  const tip = tips.length ? tips[i % tips.length]! : '';
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

/**
 * "Bu bölümden" dökümünün bir satırı; birden çok başarım tek satırda toplanır, altında her biri (items) adıyla ve ödülüyle.
 * `eksik`: sunucunun günlük yerel ödül sınırıyla hesaba geçmeyen jeton (YN-200); `jeton` hesaba geçendir.
 */
export interface EarnLine { label: string; jeton: number; note?: string; items?: EarnLine[]; eksik?: number; /** büyük yazı özetindeki kısa ad (yoksa etiketten) */ kisa?: string }
/**
 * "Bu bölümden" dökümü: bu koşunun ödül defteri kayıtlarındaki jeton (+ sunucunun bölüm jetonuna eklediği bonus). Toplam =
 * cüzdana giren (YN-042). Başarımlar tek tek: "Yıldız Avcısı · Gümüş +40", altında koşulu (OT-ekonomi-denetci-17,
 * OT-ogrenci-birinci-16); ikiden çoksa "6 başarım +215" satırının altında. Kaydın `eksik`i varsa (sunucu günlük sınırla kesti)
 * satır hesaba geçeni yazar, eksik ayrı alanda (YN-200; tamamı kesilen kayıt da "+0" ile satırda kalır).
 */
export function earnLines(s: { grants: { reason: string; items: RewardItem[]; eksik?: number }[] }, serverBonus = 0, parts?: readonly JetonBonusPart[]): EarnLine[] {
  const out: EarnLine[] = []; const ach: EarnLine[] = [];
  for (const g of s.grants) {
    const asked = g.items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0); if (!asked) continue;
    const eksik = Math.max(0, Math.min(asked, g.eksik ?? 0)); const jeton = asked - eksik; const cut = eksik ? { eksik } : {};
    const [kind, id, t] = g.reason.split(':');
    if (kind === 'basarim') {
      const a = achievementById(id ?? ''); const tier = Math.max(1, Math.min(3, Number(t) || 1)) as Tier;
      ach.push(a ? { label: `${achievementName(a, tier)} · ${TIER_NAMES[tier]}`, jeton, note: achievementDesc(a, tier), ...cut } : { label: 'Başarım', jeton, ...cut });
      continue;
    }
    out.push({ label: kind === 'bolum' ? 'Toplanan notalar' : kind === 'sansli-nota' ? 'Şanslı Nota' : kind === 'hazine' ? `Bölüm ${id} hazinesi` : kind === 'kart' ? 'Kart karşılığı' : kind === 'kozmetik' ? 'Kozmetik karşılığı' : 'Ödül', jeton, ...cut });
  }
  if (ach.length === 1) out.push({ ...ach[0]!, label: `Başarım: ${ach[0]!.label}` });
  else if (ach.length) { const e = ach.reduce((a, x) => a + (x.eksik ?? 0), 0); out.push({ label: `${ach.length} başarım`, jeton: ach.reduce((a, x) => a + x.jeton, 0), items: ach, ...(e ? { eksik: e } : {}) }); }
  if (parts?.length) {
    // sunucunun kaynak kaynak dökümü (YN-240): her kaynak ayrı satır; dökümün dışında kalan fark (ör. sunucunun nota tavanı) düzeltmedir
    for (const p of parts) out.push(bonusLine(p));
    const rest = serverBonus - parts.reduce((a, p) => a + p.jeton, 0);
    if (rest) out.push({ label: 'Sunucu düzeltmesi', jeton: rest });
  } else if (serverBonus) out.push({ label: serverBonus > 0 ? 'Kamp/takım bonusu' : 'Sunucu düzeltmesi', jeton: serverBonus });
  return out;
}
/** bonus kaynağının satırı, oyuncunun kampta gördüğü adla: "Odyometri Odası Sv 1: notaların %3'ü +3", "Ortak Kazanç (takım) Sv 2: …" */
function bonusLine(p: JetonBonusPart): EarnLine {
  if (p.kaynak === 'yuvarlama') return { label: 'Yuvarlama', jeton: p.jeton, note: 'Bonus toplamı tek seferde yuvarlanır, kaynak satırları ayrı ayrı.', kisa: 'yuvarlama' };
  const b = p.kaynak === 'takim' ? null : BUILDINGS.find((x) => x.id === p.kaynak);
  const ad = b ? b.name : `${TEAM_TECH.find((t) => t.id === 'jeton')!.name} (takım)`;
  const sv = p.seviye ? ` Sv ${p.seviye}` : '';
  return { label: `${ad}${sv}: notaların %${p.pct}'${yuzdeIyelik(p.pct)}`, jeton: p.jeton, kisa: b?.short?.toLocaleLowerCase('tr') ?? 'takım' };
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
