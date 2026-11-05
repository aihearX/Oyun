/**
 * Yerel meta ödüllerinin (hazine, başarım, Şanslı Nota, görev, sandık…) hesaba geçen jetonu (YN-200, OT-rekabetci-44).
 * İstemci ödülü kendi defterine yazar ve jetonunu `wallet.local` ile sunucuya gönderir (net.ts outbox); sunucu günlük yerel ödül
 * sınırını (`LOCAL_JETON_DAILY_MAX`) uygular ve `credited` döndürür. Ekranda yazan jeton = hesaba geçen jeton: sınır kestiyse eksik
 * kısım açıkça yazılır, yanıt gelmeden (çevrimdışı) "eklendi" denmez. Sahip kararı 54 (YN-270): sınırı aşan kısım kaybolmaz,
 * "bekleyen ödül" olarak sonraki günlere devreder ("110 jeton yarın hesabına geçecek"); sunucu bunu yanıttaki `carry` ile söyler.
 * `carry` göndermeyen (güncellenmemiş) sunucuda aşan kısım gerçekten eklenmez ve eski cümle yazar ("110 jeton eklenmedi").
 * Saf: React'e ve ağa bağlı değildir (birim testi: odul-durum.test.ts).
 */
import type { RewardItem } from '@odi/content';
import { LOCAL_JETON_DAILY_MAX } from '@odi/shared';

/** defter kaydının sunucu kimliği (net.ts scanLedger; sunucu ledgerId ile tek yazar) */
export const ledgerKey = (at: number, reason: string) => `${at}:${reason}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);

/**
 * sunucunun yanıtı: istenen ve hesaba geçen jeton. `gun` (karar 54): hesaba geçmeyen kısım bekleyen ödüle yazıldı; bekleyenin
 * tamamı en geç kaç gün sonra hesaba geçer (1 = yarın). Yoksa sunucu bekleyen ödülü bilmiyor: eksik kısım eklenmedi.
 */
export interface Kredi { jeton: number; credited: number; gun?: number }
/** bekleyen ödülün (yanıttaki `carry`) tamamının kaç günde hesaba geçeceği: her gün en çok sınır kadar (1 = yarın) */
export const bekleyenGun = (carry: number) => Math.max(1, Math.ceil(carry / LOCAL_JETON_DAILY_MAX));

/**
 * Bir defter kaydının jetonu nerede:
 *  - `tam`: hesaba tamamı geçti (ya da sunucu yok: cüzdan yereldir)
 *  - `kesik`: sunucu günlük sınırla kesti; `eksik` jeton bugün hesaba geçmedi (`gun` varsa bekleyen ödülde, o kadar gün içinde geçer;
 *    yoksa güncellenmemiş sunucu: eklenmedi)
 *  - `bekliyor`: sunucuya gitmedi ya da yanıtı gelmedi; `bagli` değilse bağlanınca gidecek (kesin tutar henüz bilinmez)
 */
export type OdulDurum = { k: 'tam' } | { k: 'kesik'; eksik: number; gun?: number } | { k: 'bekliyor'; bagli: boolean };

export interface DurumKaynak {
  /** ledgerId → sunucu yanıtı */
  krediler: Readonly<Record<string, Kredi>>;
  /** gönderilmeyi ya da yanıtı bekleyen ledgerId'ler (outbox) */
  bekleyen: ReadonlySet<string>;
  /** sosyal katman açık mı (sunucu adresi var); kapalıysa cüzdan yereldir, her ödül tam */
  sosyal: boolean;
  bagli: boolean;
}

export function odulDurumu(g: { at?: number; reason: string }, d: DurumKaynak): OdulDurum {
  // bölüm jetonu progress.submit ile gider (sınırsız; sunucu onayı sonuç ekranında ayrıca); sunucu ödülü sunucudan gelir
  if (g.at == null || g.reason.startsWith('bolum:') || g.reason.startsWith('sunucu:')) return { k: 'tam' };
  const id = ledgerKey(g.at, g.reason);
  const kr = d.krediler[id];
  if (kr) return kr.credited < kr.jeton ? { k: 'kesik', eksik: kr.jeton - kr.credited, ...(kr.gun ? { gun: kr.gun } : {}) } : { k: 'tam' };
  if (!d.sosyal) return { k: 'tam' };
  if (d.bekleyen.has(id)) return { k: 'bekliyor', bagli: d.bagli };
  return { k: 'tam' };
}

const jetonOf = (items: readonly RewardItem[]) => items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0);

/**
 * Sonuç kartının defter kayıtları, hesaba geçenle: sınır kestiyse kaydın `eksik`i (earnLines satırı hesaba geçeni gösterir, eksik
 * notta), yanıtı beklenenlerin jetonu `bekleyen`de (çevrimdışı: bağlanınca). Toplam `eksik` kartın alt satırı ve üst sayaç içindir.
 * `gun` (karar 54): eksik kısım bekleyen ödülde, en geç bu kadar gün içinde hesaba geçer (kesilen kayıtların en büyüğü); kesilen
 * kayıtlardan biri bile bekleyen ödülsüz (güncellenmemiş sunucu) ise yok: eski "eklenmedi" cümlesi.
 */
export function hesabaGecen<G extends { at?: number; reason: string; items: RewardItem[] }>(grants: readonly G[], d: DurumKaynak): { grants: (G & { eksik?: number })[]; eksik: number; gun?: number; bekleyen: number; bagli: boolean } {
  let eksik = 0; let bekleyen = 0; let gun = 0; let eski = false;
  const out = grants.map((g) => {
    const s = odulDurumu(g, d);
    if (s.k === 'kesik') {
      const e = Math.min(s.eksik, jetonOf(g.items)); eksik += e;
      if (e > 0) { if (s.gun) gun = Math.max(gun, s.gun); else eski = true; }
      return e > 0 ? { ...g, eksik: e } : g;
    }
    if (s.k === 'bekliyor') bekleyen += jetonOf(g.items);
    return g;
  });
  return { grants: out, eksik, ...(eksik > 0 && gun > 0 && !eski ? { gun } : {}), bekleyen, bagli: d.bagli };
}

/** ödül öğelerinde jetonu hesaba geçenle değiştir (0 kaldıysa jeton öğesi çıkar): pencerede yazan = verilen (Hazine penceresi) */
export function gecenOgeler(items: readonly RewardItem[], eksik: number): RewardItem[] {
  let kalan = Math.max(0, eksik);
  const out: RewardItem[] = [];
  for (const it of items) {
    if (it.kind !== 'jeton' || kalan <= 0) { out.push(it); continue; }
    const cut = Math.min(kalan, it.amount); kalan -= cut;
    if (it.amount - cut > 0) out.push({ ...it, amount: it.amount - cut });
  }
  return out;
}

/**
 * Haritadaki Hazine penceresi (MapScreen onTreasure, "Yolda kazandıkların"): kartlar hesaba geçeni gösterir, not ne olduğunu söyler.
 * Sınır kestiyse bugün geçmeyen (karar 54: bekleyen ödülde, "yarın hesabına geçecek"); jeton sunucuya henüz gitmediyse (çevrimdışı)
 * "bağlanınca", gidiyorsa "kaydediliyor"; tamamsa `verildi`.
 */
export function hazinePenceresi(items: readonly RewardItem[], d: OdulDurum, verildi: string): { items: RewardItem[]; note: string; eksik: number; gun?: number; bekliyor: boolean } {
  if (d.k === 'kesik') return { items: gecenOgeler(items, d.eksik), note: sinirNotu(d.eksik, d.gun), eksik: d.eksik, ...(d.gun ? { gun: d.gun } : {}), bekliyor: false };
  if (d.k === 'bekliyor') return { items: [...items], note: d.bagli ? 'Jetonu hesabına kaydediliyor' : 'Jetonu bağlanınca cüzdanına eklenecek', eksik: 0, bekliyor: !d.bagli };
  return { items: [...items], note: verildi, eksik: 0, bekliyor: false };
}

const tr = (n: number) => n.toLocaleString('tr-TR');
/** bekleyen ödülün ne zaman hesaba geçeceği: "yarın" ya da "3 gün içinde" (her gün en çok sınır kadar) */
export const bekleyenNe = (gun: number) => (gun <= 1 ? 'yarın' : `${gun} gün içinde`);
/**
 * sınır cümlesi (sonuç kartı, Hazine penceresi, başarım bildirimi aynı söz): bugün geçmeyen ve kısa nedeni (YN-269, OT-rekabetci-53:
 * hazine sandığı konfetiyle açılıp yalnız "110 jeton eklenmedi" diyordu). Karar 54: `gun` varsa jeton kaybolmaz, bekleyen ödülde
 * ("110 jeton yarın hesabına geçecek"); yoksa sunucu güncellenmemiştir ve jeton gerçekten eklenmedi (eski kural, dürüst söz).
 */
export const sinirSatiri = (eksik: number, gun?: number) => (gun
  ? `${tr(eksik)}\u00a0jeton ${bekleyenNe(gun)} hesabına geçecek: bugünkü ${tr(LOCAL_JETON_DAILY_MAX)}\u00a0jetonluk ödül sınırı doldu`
  : `${tr(eksik)}\u00a0jeton eklenmedi: bugünkü ${tr(LOCAL_JETON_DAILY_MAX)}\u00a0jetonluk ödül sınırı doldu`);
/** sonuç kartında sınır cümlesinin ardından kural (karar 54: aşan kısım devreder) */
export const sinirKurali = (gun?: number) => (gun
  ? `Hazine, başarım, görev ve sandık jetonlarından günde en çok ${tr(LOCAL_JETON_DAILY_MAX)} jeton hesaba geçer; aşan kısım kaybolmaz, bekleyen ödül olarak sonraki günlerde geçer.`
  : `Hazine, başarım, görev ve sandık jetonlarından günde en çok ${tr(LOCAL_JETON_DAILY_MAX)} jeton hesaba geçer; sınır yarın yenilenir.`);
/** kuralın yeri (Profil › Nasıl çalışır?, InfoScreen "Günlük ödül jetonu sınırı") */
export const SINIR_IPUCU = 'Kural: Profil › Nasıl çalışır?';
/** Hazine penceresinin notu: sınır cümlesi ve kuralın yeri */
export const sinirNotu = (eksik: number, gun?: number) => `${sinirSatiri(eksik, gun)}. ${SINIR_IPUCU}`;
/** çevrimdışı bekleyen ödülün cümlesi: tutar sunucuda kesinleşir, "eklendi" denmez */
export const bekleyenSatiri = (jeton: number) => `${tr(jeton)}\u00a0jeton bağlanınca hesabına eklenecek`;

/** günlük yerel ödül sınırının sunucudan son okunan durumu (wallet.get / wallet.local yanıtı; YN-269) */
export interface GunlukSinir {
  /** bugün kalan jeton */ left: number; /** sınırın yenileneceği an (sunucu saati, İstanbul gece yarısı) */ resetAt: number;
  /** karar 54: sonraki günlere bekleyen ödül jetonu (eski sunucu göndermez: yok) */ carry?: number;
  /** karar 54: bugün bekleyenden hesaba geçen (bugünkü sayıya dahil) */ carried?: number;
}
export interface GunlukSatir {
  metin: string;
  /** karar 54: bekleyen ödül satırı ("Bekleyen ödül: 110 jeton, yarın hesabına geçecek"); yoksa yok */
  bekleyen?: string;
  /** hesaba geçen; bilinmiyorsa null (sayı uydurulmaz) */
  gecen: number | null;
  /** `yakin`: %80 ve üstü, `dolu`: sınır doldu */
  seviye: 'normal' | 'yakin' | 'dolu';
  not?: string;
}
/** Bugün sekmesinin bu kadarından sonrası "sınıra yaklaştın" diye belirgin (YN-269) */
export const GUNLUK_YAKIN = 0.8;
/**
 * Bugün sekmesinin "Günlük ödül jetonu: X / 1.500" satırı (YN-269, OT-rekabetci-54): X sunucunun bugün hesaba geçirdiği. Sosyal katman
 * kapalıysa (cüzdan yerel, sınır yok) satır yok. Değer bilinmiyorsa ya da gün döndüyse sayı yazılmaz; çevrimdışıyken son bilinen
 * değer ve bunu söyleyen not (sunucuya henüz gitmeyen ödül sayılmamıştır).
 */
export function gunlukSatiri(g: GunlukSinir | null, o: { sosyal: boolean; bagli: boolean; now: number }): GunlukSatir | null {
  if (!o.sosyal) return null;
  const max = LOCAL_JETON_DAILY_MAX;
  if (!g || o.now >= g.resetAt) return { metin: `Günlük ödül jetonu: ${o.bagli ? 'okunuyor' : 'bağlanınca görünür'}`, gecen: null, seviye: 'normal' };
  const gecen = Math.max(0, Math.min(max, max - g.left)); const kalan = max - gecen;
  const seviye = kalan <= 0 ? 'dolu' : gecen >= max * GUNLUK_YAKIN ? 'yakin' : 'normal';
  const devreder = typeof g.carry === 'number';
  const notlar = [
    seviye === 'dolu' ? (devreder
      ? 'Sınır doldu: bugün gelen hazine, başarım, görev, sandık, takvim ve Şanslı Nota jetonu kaybolmaz, bekleyen ödül olarak yarın hesabına geçer.'
      : 'Sınır doldu: bugün gelen hazine, başarım, görev, sandık, takvim ve Şanslı Nota jetonu eklenmez. Gece yarısı yenilenir.')
      : seviye === 'yakin' ? `Sınıra ${tr(kalan)}\u00a0jeton kaldı.` : '',
    (g.carried ?? 0) > 0 ? `Bugün bekleyen ödülden ${tr(g.carried!)}\u00a0jeton hesabına geçti (bu sayıya dahil).` : '',
    o.bagli ? '' : 'Son bilinen değer (çevrimdışısın); bağlanınca güncellenir.',
  ].filter(Boolean);
  const bekleyen = (g.carry ?? 0) > 0 ? `Bekleyen ödül: ${tr(g.carry!)}\u00a0jeton, ${bekleyenNe(bekleyenGun(g.carry!))} hesabına geçecek${bekleyenGun(g.carry!) > 1 ? ` (günde en çok ${tr(max)})` : ''}.` : undefined;
  return { metin: `Günlük ödül jetonu: ${tr(gecen)} / ${tr(max)}`, gecen, seviye, ...(bekleyen ? { bekleyen } : {}), ...(notlar.length ? { not: notlar.join(' ') } : {}) };
}
