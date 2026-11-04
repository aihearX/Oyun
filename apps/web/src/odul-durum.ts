/**
 * Yerel meta ödüllerinin (hazine, başarım, Şanslı Nota, görev, sandık…) hesaba geçen jetonu (YN-200, OT-rekabetci-44).
 * İstemci ödülü kendi defterine yazar ve jetonunu `wallet.local` ile sunucuya gönderir (net.ts outbox); sunucu günlük yerel ödül
 * sınırını (`LOCAL_JETON_DAILY_MAX`) uygular ve `credited` döndürür. Ekranda yazan jeton = hesaba geçen jeton: sınır kestiyse eksik
 * kısım açıkça yazılır ("Günlük ödül sınırı doldu: 115 jeton eklenmedi"), yanıt gelmeden (çevrimdışı) "eklendi" denmez.
 * Saf: React'e ve ağa bağlı değildir (birim testi: odul-durum.test.ts).
 */
import type { RewardItem } from '@odi/content';

/** defter kaydının sunucu kimliği (net.ts scanLedger; sunucu ledgerId ile tek yazar) */
export const ledgerKey = (at: number, reason: string) => `${at}:${reason}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);

/** sunucunun yanıtı: istenen ve hesaba geçen jeton */
export interface Kredi { jeton: number; credited: number }

/**
 * Bir defter kaydının jetonu nerede:
 *  - `tam`: hesaba tamamı geçti (ya da sunucu yok: cüzdan yereldir)
 *  - `kesik`: sunucu günlük sınırla kesti; `eksik` jeton eklenmedi
 *  - `bekliyor`: sunucuya gitmedi ya da yanıtı gelmedi; `bagli` değilse bağlanınca gidecek (kesin tutar henüz bilinmez)
 */
export type OdulDurum = { k: 'tam' } | { k: 'kesik'; eksik: number } | { k: 'bekliyor'; bagli: boolean };

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
  if (kr) return kr.credited < kr.jeton ? { k: 'kesik', eksik: kr.jeton - kr.credited } : { k: 'tam' };
  if (!d.sosyal) return { k: 'tam' };
  if (d.bekleyen.has(id)) return { k: 'bekliyor', bagli: d.bagli };
  return { k: 'tam' };
}

const jetonOf = (items: readonly RewardItem[]) => items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0);

/**
 * Sonuç kartının defter kayıtları, hesaba geçenle: sınır kestiyse kaydın `eksik`i (earnLines satırı hesaba geçeni gösterir, eksik
 * notta), yanıtı beklenenlerin jetonu `bekleyen`de (çevrimdışı: bağlanınca). Toplam `eksik` kartın alt satırı ve üst sayaç içindir.
 */
export function hesabaGecen<G extends { at?: number; reason: string; items: RewardItem[] }>(grants: readonly G[], d: DurumKaynak): { grants: (G & { eksik?: number })[]; eksik: number; bekleyen: number; bagli: boolean } {
  let eksik = 0; let bekleyen = 0;
  const out = grants.map((g) => {
    const s = odulDurumu(g, d);
    if (s.k === 'kesik') { const e = Math.min(s.eksik, jetonOf(g.items)); eksik += e; return e > 0 ? { ...g, eksik: e } : g; }
    if (s.k === 'bekliyor') bekleyen += jetonOf(g.items);
    return g;
  });
  return { grants: out, eksik, bekleyen, bagli: d.bagli };
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
 * Sınır kestiyse eklenmeyen; jeton sunucuya henüz gitmediyse (çevrimdışı) "bağlanınca", gidiyorsa "kaydediliyor"; tamamsa `verildi`.
 */
export function hazinePenceresi(items: readonly RewardItem[], d: OdulDurum, verildi: string): { items: RewardItem[]; note: string; eksik: number; bekliyor: boolean } {
  if (d.k === 'kesik') return { items: gecenOgeler(items, d.eksik), note: sinirSatiri(d.eksik), eksik: d.eksik, bekliyor: false };
  if (d.k === 'bekliyor') return { items: [...items], note: d.bagli ? 'Jetonu hesabına kaydediliyor' : 'Jetonu bağlanınca cüzdanına eklenecek', eksik: 0, bekliyor: !d.bagli };
  return { items: [...items], note: verildi, eksik: 0, bekliyor: false };
}

const tr = (n: number) => n.toLocaleString('tr-TR');
/** sınır cümlesi (sonuç kartı, Hazine penceresi, başarım bildirimi aynı söz) */
export const sinirSatiri = (eksik: number) => `Günlük ödül sınırı doldu: ${tr(eksik)}\u00a0jeton eklenmedi`;
/** çevrimdışı bekleyen ödülün cümlesi: tutar sunucuda kesinleşir, "eklendi" denmez */
export const bekleyenSatiri = (jeton: number) => `${tr(jeton)}\u00a0jeton bağlanınca hesabına eklenecek`;
