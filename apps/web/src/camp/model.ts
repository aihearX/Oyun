/**
 * Kulak Kampı arayüz modeli: etki metinleri, yükseltme uygunluğu (nedeniyle), hızlandırıcılar, eylemler (gerçek/demo).
 */
import { create } from 'zustand';
import { useNet } from '@odi/net/store';
import { BUILDINGS, CAMP_POWER_LEVEL, buildCost, type BuildingDef, type BuildingId, type BuildingState, type CampState, type Wallet } from '@odi/shared';
import { CAMP_TIER_NAMES, DEPOT_CAP_H, DEPOT_RATE, tierOf } from '@odi/game-core/lite';
import { audio } from '@odi/audio';
import { BUILDING_INFO, CAMP_TERMS, districtOfBuilding, LIB_CAP_HOURS, LIB_XP_PER_LEVEL_HOUR, campUnlocksAt, cosmeticById, depotCapHours, kabinXpPct, levelLineId, parkDecorSlots, remediesAt, remedyById, remedyShelfCap, taramaFactor, type CampUnlock } from '@odi/content';
import { celebrate } from '../celebrate';
import { platform } from '../platform';
import { sayDede } from './dede';

export { DEPOT_CAP_H, DEPOT_RATE };
/**
 * İnşaat süresi saniyesine kadar (OT-ekonomi-denetci-21): "6 dk 26 sn", "1 sa 2 dk 5 sn". Pencere yuvarlamaz: sayaç aynı süreden
 * başlar ve kristalle bitirme bedeli (kalan her başlamış dakika için 1) yazılan süreyle tutar (6 dk 26 sn → 7 kristal).
 */
export function sureTam(sec: number): string {
  const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const out = [h && `${h} sa`, m && `${m} dk`, r && `${r} sn`].filter(Boolean).join(' ');
  return out || '0 sn';
}
/** kristalle bitirme notu (bedel kuralı sunucuda: crystalsToFinish) */
export const KRISTAL_KURAL = 'Kristal: kalan her başlamış dakika için 1';
const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));
/** bina gücü Sv 15'te tavan yapar (sunucu ile aynı) */
const P = (l: number) => Math.min(CAMP_POWER_LEVEL, l);
/** gücü olan (yüzde veren) binalar */
export const POWER_BUILDINGS: BuildingId[] = ['laboratuvar', 'atolye', 'kule', 'revir'];
export const defOf = (id: BuildingId): BuildingDef => BUILDINGS.find((b) => b.id === id)!;
export function effect(id: BuildingId, l: number): string {
  switch (id) {
    case 'merkez': return l ? `Diğer binalar en çok Sv ${l}` : 'Kamp kurulmadı';
    case 'laboratuvar': return `Bölüm jetonu +%${P(l) * 3}`;
    case 'atolye': return `Bölüm başında kalkan şansı %${P(l) * 4}`;
    case 'depo': return l ? `${l * DEPOT_RATE} jeton/saat (${DEPOT_CAP_H} saatte dolar)` : 'Pasif jeton üretimi yok';
    case 'kule': return `Bölüm jetonu +%${P(l) * 2}`;
    case 'revir': return `İlk vuruşta canını koruma şansı %${P(l) * 3}`;
    case 'tedavi': return l ? `${remediesAt(l).length} tarif · rafta en çok ${remedyShelfCap(l)}` : 'Malzeme hazırlanmıyor';
    case 'kabin': return l ? `Kamp XP +%${kabinXpPct(l)}` : 'Kamp XP bonusu yok';
    case 'tarama': return l ? `Tedavi Odası hazırlık süresi −%${Math.round((1 - taramaFactor(l)) * 100)}` : 'Hazırlık süresi bonusu yok';
    case 'park': return l ? `+${parkDecorSlots(l)} süs yeri` : 'Ek süs yeri yok';
    case 'denge': return `Depo ${fmtH(depotCapHours(l))} saatte dolar`;
    case 'kutuphane': return l ? `Saatte ${l * LIB_XP_PER_LEVEL_HOUR} Kamp XP (${LIB_CAP_HOURS} saatte dolar)` : 'Okuma köşesi yok';
  }
}
/** binanın gerçek hayattaki karşılığı (sade + "Daha fazla") */
export const infoOf = (id: BuildingId) => BUILDING_INFO[id];
/** açılımın kısa adı (panel ve kutlama) */
export function unlockLabel(u: CampUnlock): string {
  switch (u.kind) {
    case 'kozmetik': return `Dolap: ${cosmeticById(u.id)?.name ?? 'kozmetik'}`;
    case 'terim': return `Sözlük: ${CAMP_TERMS.find((t) => t.id === u.id)?.term ?? 'terim'}`;
    case 'tarif': return `Tarif: ${remedyById(u.id)?.name ?? 'malzeme'}`;
    case 'canta': return 'Çantaya +1 yer';
  }
}
/** Merkez'in "kısa ad"ı (dar yerler) */
export const shortOf = (id: BuildingId) => defOf(id).short ?? defOf(id).name.split(' ')[0]!;
export const ITEMS = [{ k: 'm5', label: '5 dk', sec: 300 }, { k: 'm60', label: '60 dk', sec: 3600 }, { k: 's8', label: '8 sa', sec: 28_800 }] as const;
export type SpeedItem = 'm5' | 'm60' | 's8' | 'kristal';

/**
 * Kurulmamış binanın rozeti (YN-153): ilk inşaat sürerken "Kuruluyor", yoksa "Kurulmadı"; kurulu binada null (rozet "Sv N" yazar).
 * Panelde ve listede aynı kural (panel "Sv 1 yapılıyor" derken rozet "Kurulmadı" kalıyordu).
 */
export const kurulumYazisi = (b: Pick<BuildingState, 'level' | 'upgradingTo'>): string | null => (b.level > 0 ? null : b.upgradingTo ? 'Kuruluyor' : 'Kurulmadı');

/** Kamp + takım etkileri (sunucuda bonusesFor): kaynakları sunucuyla aynı */
export interface CampBonuses { coinPct: number; shieldChancePct: number; firstHitIgnorePct: number; warPct: number; raidPct: number }
/**
 * Sıfır kalan etkiler nasıl artar, tek satır (YN-153; ilk kez oynayan beş "%0" kutucuğunu yanlış bir şey yapıyor sanıyordu). Binalı
 * kaynak: jeton Odyometri + Kule, kalkan Atölye, klinik yalnız Klinik; savaş ve baskın yalnız takım teknolojisi (karar 29). Hepsi
 * sıfır değilse null.
 */
export function bonusArtisi(b: CampBonuses, team: boolean): string | null {
  const bina: string[] = [];
  if (b.coinPct <= 0) bina.push(`${shortOf('laboratuvar')} ve ${shortOf('kule')} (jeton)`);
  if (b.shieldChancePct <= 0) bina.push(`${shortOf('atolye')} (kalkan)`);
  if (b.firstHitIgnorePct <= 0) bina.push(`${shortOf('revir')} (klinik)`);
  const tk = [b.warPct <= 0 && 'savaş', b.raidPct <= 0 && 'baskın'].filter(Boolean).join(' ve ');
  const parts = [
    bina.length ? `Artırmak için yükselt: ${bina.join(', ')}.` : '',
    tk ? `${tk[0]!.toLocaleUpperCase('tr')}${tk.slice(1)} ${team ? 'takımının teknolojisiyle' : 'bir takıma katılınca takım teknolojisiyle'} artar.` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}
/** etkilerin kaynağı (dokununca): karar 29, binalar takım rekabetine girmez */
export const BONUS_KURAL = 'Jeton ve kalkan: kamp binaları ve takım teknolojisi; klinik: yalnız kamp binası. Savaş ve baskın yüzdesi yalnız takım teknolojisinden gelir; kamp binaları takım puanlarına eklenmez.';

/** bu oturumda yardım istenen inşaatlar (sunucu "istendi" bilgisini döndürmüyor) */
export const askedHelp = new Set<string>();
export const buildKey = (b: BuildingState) => `${b.id}:${b.upgradingTo}:${b.startedAt}`;

export type Verdict = { ok: true } | { ok: false; reason: string; short: string };
/** yükseltilebilir mi; değilse kullanıcıya söylenecek neden */
export function canUpgrade(camp: CampState, wallet: Wallet, id: BuildingId): Verdict {
  const d = defOf(id); const b = camp.buildings.find((x) => x.id === id)!; const to = b.level + 1;
  const merkez = camp.buildings.find((x) => x.id === 'merkez')?.level ?? 1;
  const busy = camp.buildings.find((x) => x.upgradingTo && x.endsAt);
  if (to > d.maxLevel) return { ok: false, reason: 'En yüksek seviyede.', short: 'En yüksek' };
  if (d.campLevel && (camp.xp?.level ?? 1) < d.campLevel) return { ok: false, reason: `Kamp Seviyesi ${d.campLevel} gerekli: ${districtOfBuilding(id)?.name ?? 'bölge'} açılınca kurulur.`, short: `Kamp Sv ${d.campLevel}` };
  if (busy) return { ok: false, reason: busy.id === id ? 'İnşaat sürüyor.' : `İnşaatçı meşgul: ${defOf(busy.id).name} yapılıyor. Aynı anda bir inşaat yapılır${queueSupported(camp) ? '; bir sonrakini sıraya alabilirsin' : ''}.`, short: busy.id === id ? 'Yapılıyor' : 'İnşaatçı meşgul' };
  if (id !== 'merkez' && to > merkez) return { ok: false, reason: `Önce Odyoloji Merkezi'ni Sv ${to} yap.`, short: `Merkez Sv ${to}` };
  const cost = buildCost(id, to).jeton;
  if (wallet.jeton < cost) return { ok: false, reason: `Jeton yetersiz: ${Math.round(cost - wallet.jeton).toLocaleString('tr-TR')} jeton daha gerekli. Bölüm oyna, görev bitir.`, short: 'Jeton yetersiz' };
  return { ok: true };
}

/** süren inşaat (yoksa undefined) */
export const activeOf = (camp: CampState) => camp.buildings.find((x) => x.upgradingTo && x.endsAt);
/** sunucu inşaat sırasını biliyor mu (eski sunucuda `queued` alanı hiç yok) */
export const queueSupported = (camp: CampState) => camp.queued !== undefined;
/**
 * sıraya alınabilir mi (docs/14-kamp.md "İnşaat sırası"): bir inşaat sürüyor, sıra boş, bu bina süren bina değil; Merkez sınırı
 * süren inşaat bittikten sonraki seviyeye göre (sunucu ile aynı kural). Süren inşaat yoksa sıra yok: doğrudan Yükselt.
 */
export function canQueue(camp: CampState, wallet: Wallet, id: BuildingId): Verdict {
  const d = defOf(id); const b = camp.buildings.find((x) => x.id === id)!; const to = b.level + 1;
  const busy = activeOf(camp);
  if (!queueSupported(camp) || !busy) return { ok: false, reason: '', short: '' };
  if (busy.id === id) return { ok: false, reason: 'İnşaat sürüyor.', short: 'Yapılıyor' };
  if (camp.queued) return camp.queued.id === id ? { ok: false, reason: 'Sırada.', short: 'Sırada' } : { ok: false, reason: `Sırada zaten ${defOf(camp.queued.id).name} var. Sıraya tek bina alınır.`, short: 'Sıra dolu' };
  if (to > d.maxLevel) return { ok: false, reason: 'En yüksek seviyede.', short: 'En yüksek' };
  if (d.campLevel && (camp.xp?.level ?? 1) < d.campLevel) return { ok: false, reason: `Kamp Seviyesi ${d.campLevel} gerekli: ${districtOfBuilding(id)?.name ?? 'bölge'} açılınca kurulur.`, short: `Kamp Sv ${d.campLevel}` };
  const m = camp.buildings.find((x) => x.id === 'merkez');
  const merkez = m?.upgradingTo ?? m?.level ?? 1;
  if (id !== 'merkez' && to > merkez) return { ok: false, reason: `Önce Odyoloji Merkezi'ni Sv ${to} yap.`, short: `Merkez Sv ${to}` };
  const cost = buildCost(id, to).jeton;
  if (wallet.jeton < cost) return { ok: false, reason: `Jeton yetersiz: ${Math.round(cost - wallet.jeton).toLocaleString('tr-TR')} jeton daha gerekli.`, short: 'Jeton yetersiz' };
  return { ok: true };
}

/**
 * Bağlantı yokken basılan Kur/Yükselt/Sıraya al (OT-eski-telefon-18): istek bağlantıyı bekler (net.ts `offlineWaitMs`) ve bağlanınca
 * bir kez gider. O arada binanın kartı "Bağlanınca başlayacak" der, yükseltme düğmeleri kilitli (ikinci istek, çift harcama denemesi
 * yok); istek düşerse (bekleme süresi doldu) kart eski haline döner, nedeni bildirimde.
 */
export const BEKLEYEN_INSAAT = 'Bağlanınca başlayacak';
export const useBekleyenInsaat = create<{ id: BuildingId | null }>()(() => ({ id: null }));
export async function insaatIstegi<T>(id: BuildingId, f: () => Promise<T>): Promise<T> {
  const off = useNet.getState().status !== 'bağlı';
  if (off) useBekleyenInsaat.setState({ id });
  try { return await f(); } finally { if (off && useBekleyenInsaat.getState().id === id) useBekleyenInsaat.setState({ id: null }); }
}

/** kamp eylemleri: gerçek (sunucu) ya da demo (yerel) */
export interface CampActions {
  upgrade(id: BuildingId): Promise<boolean>;
  /** sıraya al (bedel şimdi düşer; süren inşaat bitince kendiliğinden başlar) */
  queue(id: BuildingId): Promise<boolean>;
  /** sıradan çıkar (bedel tamamen geri) */
  unqueue(): Promise<boolean>;
  speed(id: BuildingId, item: SpeedItem): Promise<boolean>;
  ask(id: BuildingId): Promise<boolean>;
  /** toplanan jeton; başarısızsa null */
  collect(): Promise<number | null>;
  /** verilen yardım sayısı; başarısızsa null */
  helpAll(): Promise<number | null>;
  /** Tedavi Odası: hazırlanacak tarifi seç (null: dur) */
  remedyMake(item: string | null): Promise<boolean>;
  /** Tedavi Odası: raftakileri çantaya al; alınan adet (başarısızsa null) */
  remedyCollect(): Promise<number | null>;
  /** süs yerleştir / taşı-çevir (yeni kamp durumu; başarısızsa null) / depoya kaldır */
  decorPlace(id: string, gx: number, gy: number, flip: boolean): Promise<CampState | null>;
  decorMove(uid: number, gx: number, gy: number, flip: boolean): Promise<CampState | null>;
  decorStore(uid: number): Promise<boolean>;
  /** Kütüphane okuma köşesi: alınan Kamp XP (başarısızsa null) */
  libCollect(): Promise<number | null>;
}

/** inşaat bitti: her zaman fanfar + afiş (açılımlar yazılı); görsel kademe değiştiyse (Sv 4, 7, 10, 13) büyük "seviye" anı.
 *  Tüy Dede binanın odyolojik işleviyle ilgili tek satır söyler (bina başına üç satır, sırayla). */
export function celebrateBuilt(id: BuildingId, level: number, bigTier: boolean): void {
  const d = defOf(id); platform().haptic('success');
  const unlocks = campUnlocksAt(id, level).map(unlockLabel);
  sayDede(levelLineId(id, level), `${d.name} · Sv ${level}`, level === 1 ? BUILDING_INFO[id].tech : undefined);
  if (bigTier) {
    void celebrate.levelUp({ level, unlocks: [`${d.name}: ${CAMP_TIER_NAMES[tierOf(level)]} görünüm`, effect(id, level), ...unlocks] });
    return;
  }
  audio.play('fanfare');
  const body = [level === 1 ? `Kuruldu · ${effect(id, level)}` : effect(id, level), ...unlocks].join(' · ');
  celebrate.banner({ icon: d.emoji, title: `${d.name} Sv ${level}!`, body, tone: 'green' });
}
