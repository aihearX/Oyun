/**
 * ODİ sosyal protokolü (v1). Sunucu (apps/server) ve istemci (packages/net) bu dosyayı paylaşır.
 * Taşıma: tek WebSocket. İstemci → sunucu: Req. Sunucu → istemci: Res (isteğe yanıt) veya Evt (itme).
 * Dürüstlük kuralları: sahte oyuncu/bot üye yok, gizli olasılık yok, savaş/lig puanı parayla alınamaz.
 */
export const PROTOCOL_VERSION = 1;

// ---------- temel varlıklar
export type LeagueTier = 'bronz' | 'gumus' | 'altin' | 'koklea';
export type TeamRole = 'lider' | 'yardimci' | 'uye';

export interface PublicProfile {
  id: string;
  name: string;
  /** Odi gövde rengi (0xRRGGBB) */
  color: number;
  /** kozmetik şapka kimliği (boş = yok) */
  hat: string;
  /** oyuncu seviyesi (XP'den) */
  level: number;
  /** en yüksek açılmış bölüm */
  highest: number;
  /** toplam yıldız */
  stars: number;
  teamId: string | null;
  teamName: string | null;
  teamEmblem: string | null;
  league: LeagueTier;
  online: boolean;
  /** son görülme (ms) */
  lastSeen: number;
}

export interface MyProfile extends PublicProfile {
  /** arkadaş kodu (6 karakter, büyük harf) */
  friendCode: string;
  /** cihazda saklanan gizli anahtar; yalnızca hello yanıtında döner */
  token?: string;
}

export type ChatKind = 'text' | 'emoji' | 'system' | 'help' | 'race' | 'war';
export interface ChatMessage {
  id: string;
  /** 'genel' | `takim:${teamId}` | `dm:${idA}:${idB}` (idA < idB) */
  room: string;
  from: string; // 'sistem' sistem mesajları için
  name: string;
  color: number;
  text: string;
  kind: ChatKind;
  at: number;
  meta?: Record<string, string | number | boolean>;
}

export interface TeamSummary {
  id: string;
  name: string;
  /** tek emoji */
  emblem: string;
  description: string;
  members: number;
  max: number;
  /** üyelerin toplam yıldızı */
  power: number;
  open: boolean;
  code: string;
  /** en az bölüm şartı */
  minLevel: number;
}
export interface TeamMember extends PublicProfile { role: TeamRole; weekPoints: number; joinedAt: number }
export interface HelpRequest { id: string; from: string; name: string; level: number; helpers: string[]; max: number; at: number }
export interface TeamDetail extends TeamSummary { roster: TeamMember[]; help: HelpRequest[]; weekPoints: number }

// ---------- Bölge Savaşı (haftalık)
export interface RegionScore { teamId: string; name: string; emblem: string; points: number }
export interface RegionState {
  id: string;           // ör. 'kepce'
  name: string;         // ör. 'Kulak Kepçesi'
  biomes: string[];     // bu bölgeye puan yazan biyomlar
  owner: RegionScore | null; // şu an önde olan takım
  top: RegionScore[];   // ilk 5
}
export interface WarState {
  week: string;         // ISO hafta, ör. '2026-W42'
  startsAt: number;
  endsAt: number;
  regions: RegionState[];
  /** benim takımımın hedef bölgeleri (en çok 3) */
  targets: string[];
  /** benim takımımın bu haftaki toplam savaş puanı */
  teamPoints: number;
  myPoints: number;
}

// ---------- Baskın (haftalık, takım ortak can barı)
export interface RaidState {
  open: boolean;
  opensAt: number;
  closesAt: number;
  hp: number;
  maxHp: number;
  defeatedAt: number | null;
  contributors: { id: string; name: string; damage: number }[];
  /** takımlar arası sıralama: yenme süresi (ms) küçük olan önde */
  ranking: { teamId: string; name: string; emblem: string; timeMs: number | null; damage: number }[];
}

// ---------- Canlı yarış
export type RaceStatus = 'lobi' | 'geri-sayim' | 'yarista' | 'bitti';
export interface RacePlayer { id: string; name: string; color: number; hat: string; ready: boolean; pct: number; finishedAt: number | null; place: number | null; score: number | null; left: boolean }
export interface RaceRoom { id: string; hostId: string; level: number; salt: number; status: RaceStatus; startsAt: number | null; players: RacePlayer[]; max: number; createdAt: number }
export interface RacePos { id: string; x: number; y: number; pct: number; at: number }

// ---------- Lig (haftalık, 30 kişilik grup)
export interface LeagueState { tier: LeagueTier; week: string; endsAt: number; rank: number; points: number; group: { id: string; name: string; color: number; points: number }[]; promoteTop: number; demoteBottom: number }

// ---------- Ödül kutusu (sunucu verdiği ödüller; istemci alınca yerel cüzdana ekler)
export type InboxKind = 'jeton' | 'kalkan' | 'kozmetik' | 'kart';
export interface InboxItem { id: string; kind: InboxKind; amount: number; ref: string; reason: string; at: number }

// ---------- İlerleme bildirimi (her bölüm sonunda)
export interface ProgressSubmit { level: number; completed: boolean; stars: number; score: number; timeSec: number; coins: number; biome: string; mechanic: string; raceId?: string }
export interface ProgressAck { highest: number; stars: number; warPoints: number; raidDamage: number; leaguePoints: number; newInbox: number; jeton: number; wallet: Wallet }


// =====================================================================
// İTTİFAK EKONOMİSİ (Whiteout tarzı ortak ilerleme)
// =====================================================================

/** Para birimleri: jeton (oynayarak), kristal (az miktarda oynayarak + satın alarak). */
export interface Wallet { jeton: number; kristal: number; hizlandirici: { m5: number; m60: number; s8: number } }

// ---------- Kulak Kampı (kişisel üs; süreli inşaat, takım yardımıyla hızlanır)
export type BuildingId = 'merkez' | 'laboratuvar' | 'atolye' | 'depo' | 'kule' | 'revir';
export interface BuildingDef { id: BuildingId; name: string; emoji: string; desc: string; maxLevel: number }
export const BUILDINGS: BuildingDef[] = [
  { id: 'merkez', name: 'Kamp Merkezi', emoji: '🏕️', desc: 'Diğer binaların en yüksek seviyesini belirler.', maxLevel: 15 },
  { id: 'laboratuvar', name: 'Ses Laboratuvarı', emoji: '🔬', desc: 'Bölüm jetonlarını artırır (+%3/seviye).', maxLevel: 15 },
  { id: 'atolye', name: 'Atölye', emoji: '🛠️', desc: 'Her bölüme ek kalkan şansı (+%4/seviye).', maxLevel: 15 },
  { id: 'depo', name: 'Kulak Deposu', emoji: '📦', desc: 'Saatlik pasif jeton üretir (seviye × 20/saat, 8 saatte dolar).', maxLevel: 15 },
  { id: 'kule', name: 'Yankı Kulesi', emoji: '🗼', desc: 'Savaş puanını artırır (+%2/seviye).', maxLevel: 15 },
  { id: 'revir', name: 'Revir', emoji: '💚', desc: 'Bölümde ilk hasarı yok sayma şansı (+%3/seviye).', maxLevel: 15 },
];
/** inşaat maliyeti ve süresi (sn): seviyeyle üstel büyür; şeffaf formül */
export function buildCost(id: BuildingId, toLevel: number): { jeton: number; seconds: number } {
  const base = id === 'merkez' ? 1.4 : 1;
  return { jeton: Math.round(80 * base * Math.pow(toLevel, 1.9)), seconds: Math.round(60 * base * Math.pow(toLevel, 2.2)) };
}
export interface BuildingState { id: BuildingId; level: number; upgradingTo: number | null; startedAt: number | null; endsAt: number | null; helpsReceived: number }
export interface CampState { buildings: BuildingState[]; depotStoredAt: number; serverTime: number }
/** takım yardımı: her yardım kalan sürenin %1'i, en az 60 sn; inşaat başına en çok helpMax(takım tekno ile artar) */
export function helpReductionSec(remainingSec: number): number { return Math.max(60, Math.round(remainingSec * 0.01)); }

// ---------- Takım teknolojisi (üyeler bağışlar, herkes yararlanır)
export type TechId = 'jeton' | 'kalkan' | 'yardim' | 'insaat' | 'savas' | 'baskin';
export interface TechDef { id: TechId; name: string; emoji: string; desc: string; maxLevel: number; perLevel: number }
export const TEAM_TECH: TechDef[] = [
  { id: 'jeton', name: 'Ortak Kazanç', emoji: '🪙', desc: 'Tüm üyelere bölüm jetonu +%', maxLevel: 10, perLevel: 3 },
  { id: 'kalkan', name: 'Ortak Kalkan', emoji: '🛡️', desc: 'Tüm üyelere bölüm başı kalkan şansı +%', maxLevel: 10, perLevel: 4 },
  { id: 'yardim', name: 'Dayanışma', emoji: '🤝', desc: 'İnşaat başına alınabilen yardım sayısı +', maxLevel: 10, perLevel: 1 },
  { id: 'insaat', name: 'Hızlı İnşaat', emoji: '🏗️', desc: 'İnşaat süreleri -%', maxLevel: 10, perLevel: 2 },
  { id: 'savas', name: 'Savaş Borusu', emoji: '📯', desc: 'Savaş puanı +%', maxLevel: 10, perLevel: 3 },
  { id: 'baskin', name: 'Baskın Gücü', emoji: '⚔️', desc: 'Baskın hasarı +%', maxLevel: 10, perLevel: 4 },
];
export function techCost(level: number): number { return Math.round(500 * Math.pow(level + 1, 1.7)); }
export interface TechState { id: TechId; level: number; progress: number; cost: number }

// ---------- Takım hediyeleri ve ortak hedefler
export interface TeamGift { id: string; from: string; fromName: string; reason: string; contents: { kind: InboxKind; amount: number; ref: string }[]; at: number; expiresAt: number; claimed: boolean }
export interface TeamGoalTier { need: number; reward: { kind: InboxKind; amount: number; ref: string }[] }
export interface TeamGoal { id: string; name: string; metric: 'yildiz' | 'bolum' | 'baskin' | 'savas'; progress: number; tiers: TeamGoalTier[]; claimedTiers: number[]; endsAt: number }
export interface TeamExtra { level: number; xp: number; xpNext: number; tech: TechState[]; gifts: TeamGift[]; goals: TeamGoal[]; contributionWeek: { id: string; name: string; donated: number; helps: number; stars: number }[] }

// ---------- Mağaza (uygulama içi satın alma)
/** Gerçek para yalnızca App Store / Google Play üzerinden. Web'de "test mağazası" açıkça TEST etiketlidir, para çekmez. */
export interface ShopProduct {
  id: string;                 // mağaza ürün kimliği (App Store / Play ile aynı)
  name: string;
  desc: string;
  priceTry: number;           // gösterim için TL fiyat (mağazanın döndürdüğü yerel fiyat önceliklidir)
  contents: { kind: 'kristal' | 'jeton' | 'm5' | 'm60' | 's8' | 'kozmetik' | 'pass'; amount: number; ref?: string }[];
  /** satın alanın takımındaki herkese hediye düşer mi */
  teamGift: boolean;
  /** kişi başı satın alma sınırı (0 = sınırsız) */
  limit: number;
  tag?: 'populer' | 'en-iyi-deger' | 'baslangic';
}
export const SHOP: ShopProduct[] = [
  { id: 'odi.baslangic', name: 'Başlangıç Paketi', desc: '300 kristal, 10 adet 5 dk hızlandırıcı, Kaşif şapkası', priceTry: 49.99, contents: [{ kind: 'kristal', amount: 300 }, { kind: 'm5', amount: 10 }, { kind: 'kozmetik', amount: 1, ref: 'sapka-kasif' }], teamGift: true, limit: 1, tag: 'baslangic' },
  { id: 'odi.kristal.1', name: 'Avuç Kristal', desc: '120 kristal', priceTry: 29.99, contents: [{ kind: 'kristal', amount: 120 }], teamGift: false, limit: 0 },
  { id: 'odi.kristal.2', name: 'Kese Kristal', desc: '650 kristal (+%8)', priceTry: 149.99, contents: [{ kind: 'kristal', amount: 650 }], teamGift: true, limit: 0, tag: 'populer' },
  { id: 'odi.kristal.3', name: 'Sandık Kristal', desc: '1400 kristal (+%17)', priceTry: 299.99, contents: [{ kind: 'kristal', amount: 1400 }], teamGift: true, limit: 0, tag: 'en-iyi-deger' },
  { id: 'odi.hiz.1', name: 'İnşaatçı Paketi', desc: '10 × 60 dk, 20 × 5 dk hızlandırıcı', priceTry: 79.99, contents: [{ kind: 'm60', amount: 10 }, { kind: 'm5', amount: 20 }], teamGift: true, limit: 0 },
  { id: 'odi.hiz.2', name: 'Usta İnşaatçı', desc: '5 × 8 saat, 20 × 60 dk hızlandırıcı', priceTry: 199.99, contents: [{ kind: 's8', amount: 5 }, { kind: 'm60', amount: 20 }], teamGift: true, limit: 0 },
  { id: 'odi.pass', name: 'Odi Sezon Kartı', desc: '28 gün: her gün 30 kristal + sezon ödül yolunun altın sırası + Altın Koklea kostümü', priceTry: 99.99, contents: [{ kind: 'pass', amount: 28 }, { kind: 'kozmetik', amount: 1, ref: 'kostum-altin' }], teamGift: true, limit: 1 },
];
/** kristal ile hızlandırma: kalan her dakika için 1 kristal (yukarı yuvarlanır) — şeffaf */
export function crystalsToFinish(remainingSec: number): number { return Math.max(1, Math.ceil(remainingSec / 60)); }
export interface PurchaseRecord { id: string; productId: string; at: number; store: 'test' | 'app-store' | 'play'; amountTry: number }
/** harcama sınırı (aylık TL); oyuncu ayarlardan düşürebilir; 18 yaş altı beyanında 0 */
export interface SpendState { monthTry: number; limitTry: number; purchases: PurchaseRecord[] }

// ---------- İstek/yanıt sözleşmesi
export interface OpMap {
  'hello': { req: { token?: string; name?: string; version: number }; res: { me: MyProfile; serverTime: number } };
  'profile.update': { req: { name?: string; color?: number; hat?: string }; res: { me: MyProfile } };
  'profile.get': { req: { id: string }; res: { profile: PublicProfile } };
  'progress.submit': { req: ProgressSubmit; res: ProgressAck };
  'friends.list': { req: Record<string, never>; res: { friends: PublicProfile[] } };
  'friends.add': { req: { code: string }; res: { friend: PublicProfile } };
  'friends.remove': { req: { id: string }; res: Record<string, never> };
  'chat.join': { req: { room: string }; res: { history: ChatMessage[] } };
  'chat.leave': { req: { room: string }; res: Record<string, never> };
  'chat.send': { req: { room: string; text: string; kind?: 'text' | 'emoji' }; res: { msg: ChatMessage } };
  'chat.report': { req: { msgId: string }; res: Record<string, never> };
  'chat.mute': { req: { id: string; on: boolean }; res: { muted: string[] } };
  'team.list': { req: { query?: string }; res: { teams: TeamSummary[] } };
  'team.create': { req: { name: string; emblem: string; description?: string; open?: boolean; minLevel?: number }; res: { team: TeamDetail } };
  'team.join': { req: { teamId?: string; code?: string }; res: { team: TeamDetail } };
  'team.leave': { req: Record<string, never>; res: Record<string, never> };
  'team.detail': { req: { teamId?: string }; res: { team: TeamDetail | null } };
  'team.kick': { req: { id: string }; res: { team: TeamDetail } };
  'team.role': { req: { id: string; role: TeamRole }; res: { team: TeamDetail } };
  'team.help.request': { req: { level: number }; res: { request: HelpRequest } };
  'team.help.give': { req: { requestId: string }; res: { request: HelpRequest } };
  'war.state': { req: Record<string, never>; res: { war: WarState } };
  'war.targets': { req: { regions: string[] }; res: { war: WarState } };
  'raid.state': { req: Record<string, never>; res: { raid: RaidState } };
  'race.create': { req: { level?: number }; res: { room: RaceRoom } };
  'race.join': { req: { roomId: string }; res: { room: RaceRoom } };
  'race.quick': { req: Record<string, never>; res: { room: RaceRoom } };
  'race.invite': { req: { friendId: string }; res: Record<string, never> };
  'race.ready': { req: { ready: boolean }; res: { room: RaceRoom } };
  'race.leave': { req: Record<string, never>; res: Record<string, never> };
  'race.finish': { req: { completed: boolean; score: number; timeSec: number }; res: { room: RaceRoom } };
  'league.state': { req: Record<string, never>; res: { league: LeagueState } };
  'inbox.list': { req: Record<string, never>; res: { items: InboxItem[] } };
  'inbox.claim': { req: { id: string }; res: { item: InboxItem; wallet: Wallet } };
  'wallet.get': { req: Record<string, never>; res: { wallet: Wallet } };
  'camp.state': { req: Record<string, never>; res: { camp: CampState; wallet: Wallet } };
  'camp.upgrade': { req: { id: BuildingId }; res: { camp: CampState; wallet: Wallet } };
  'camp.speedup': { req: { id: BuildingId; item: 'm5' | 'm60' | 's8' | 'kristal'; count?: number }; res: { camp: CampState; wallet: Wallet } };
  'camp.collect': { req: Record<string, never>; res: { camp: CampState; wallet: Wallet; collected: number } };
  'camp.help.request': { req: { id: BuildingId }; res: { camp: CampState } };
  'team.camp.help': { req: { playerId: string; building: BuildingId }; res: { given: number } };
  'team.camp.helpAll': { req: Record<string, never>; res: { given: number } };
  'team.extra': { req: Record<string, never>; res: { extra: TeamExtra } };
  'team.donate': { req: { tech: TechId; jeton: number }; res: { extra: TeamExtra; wallet: Wallet } };
  'team.gift.claim': { req: { giftId: string }; res: { extra: TeamExtra; wallet: Wallet } };
  'team.goal.claim': { req: { goalId: string; tier: number }; res: { extra: TeamExtra; wallet: Wallet } };
  'shop.list': { req: Record<string, never>; res: { products: (ShopProduct & { bought: number })[]; spend: SpendState; testStore: boolean } };
  'shop.purchase': { req: { productId: string; store: 'test' | 'app-store' | 'play'; receipt?: string }; res: { wallet: Wallet; spend: SpendState; teamGiftSent: boolean } };
  'shop.limit': { req: { limitTry: number }; res: { spend: SpendState } };
}
export type Op = keyof OpMap;

export interface EvtMap {
  'presence': { id: string; online: boolean };
  'chat': { msg: ChatMessage };
  'friend.updated': { friend: PublicProfile };
  'team.updated': { team: TeamDetail | null };
  'team.help': { request: HelpRequest };
  'war.updated': { war: WarState };
  'raid.updated': { raid: RaidState };
  'race.updated': { room: RaceRoom };
  'race.pos': RacePos;
  'race.invited': { room: RaceRoom; from: PublicProfile };
  'inbox.new': { item: InboxItem };
  'kicked': { reason: string };
  'wallet.updated': { wallet: Wallet };
  'camp.updated': { camp: CampState };
  'camp.helped': { from: string; name: string; building: BuildingId; seconds: number };
  'team.extra.updated': { extra: TeamExtra };
  'team.gift': { gift: TeamGift };
  'team.campHelpNeeded': { requests: { playerId: string; name: string; building: BuildingId; endsAt: number; helpsReceived: number; helpsMax: number }[] };
}
export type Evt = keyof EvtMap;

/** Kablo biçimi */
export type WireReq = { t: 'req'; id: number; op: Op; data: unknown };
export type WireFire = { t: 'fire'; op: 'race.pos'; data: { x: number; y: number; pct: number } };
export type WireRes = { t: 'res'; id: number; ok: true; data: unknown } | { t: 'res'; id: number; ok: false; error: string; code?: string };
export type WireEvt = { t: 'evt'; ev: Evt; data: unknown };

/** Sabitler (sunucu ve istemci aynı değeri kullanır) */
export const SOCIAL_LIMITS = {
  nameMin: 3, nameMax: 16, chatMax: 200, chatCooldownMs: 1200, teamMax: 30, teamNameMax: 20, targetsMax: 3,
  helpMax: 5, raceMax: 4, raceCountdownMs: 4000, racePosHz: 8, historySize: 50,
} as const;

/** Bölge Savaşı haritası: 12 bölge, her biri bir ya da iki biyomdan puan alır. */
export const WAR_REGIONS: { id: string; name: string; biomes: string[] }[] = [
  { id: 'kepce', name: 'Kulak Kepçesi', biomes: ['dis-kulak'] },
  { id: 'kanal', name: 'Dış Kanal', biomes: ['kanal'] },
  { id: 'zar', name: 'Kulak Zarı', biomes: ['zar'] },
  { id: 'cekic', name: 'Çekiç Ovası', biomes: ['kemikcikler'] },
  { id: 'uzengi', name: 'Üzengi Geçidi', biomes: ['kemikcikler', 'zar'] },
  { id: 'taban', name: 'Koklea Tabanı', biomes: ['koklea-1'] },
  { id: 'orta', name: 'Koklea Ortası', biomes: ['koklea-2'] },
  { id: 'tepe', name: 'Koklea Tepesi', biomes: ['koklea-3'] },
  { id: 'sinir', name: 'İşitme Siniri', biomes: ['sinir'] },
  { id: 'sap', name: 'Beyin Sapı', biomes: ['beyin-sapi'] },
  { id: 'korteks', name: 'İşitme Korteksi', biomes: ['korteks'] },
  { id: 'merkez', name: 'Ninni Merkezi', biomes: ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'] },
];

/** Bir bölüm sonucunun savaş puanı (tamamlanmadıysa 0). Para ile alınamaz; yalnızca oynayarak. */
export function warPointsFor(p: Pick<ProgressSubmit, 'completed' | 'stars' | 'level'>): number {
  if (!p.completed) return 0;
  return 10 * p.stars + Math.ceil(p.level / 4);
}
/** Baskın hasarı: tamamlanan her bölüm canavara vurur; boss bölümleri iki kat. */
export function raidDamageFor(p: Pick<ProgressSubmit, 'completed' | 'stars' | 'mechanic'>): number {
  if (!p.completed) return 0;
  return (5 + 5 * p.stars) * (p.mechanic === 'boss' ? 2 : 1);
}
/** Lig puanı: yıldız + hız bonusu + yarış derecesi (yarıştaysa). */
export function leaguePointsFor(p: Pick<ProgressSubmit, 'completed' | 'stars'>, racePlace?: number | null): number {
  if (!p.completed) return 1;
  const race = racePlace == null ? 0 : racePlace === 1 ? 30 : racePlace === 2 ? 15 : racePlace === 3 ? 8 : 3;
  return 5 + p.stars * 5 + race;
}
