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
  /** ödül kutusundan alınmış, henüz kullanılmamış kalkanlar */
  shields: number;
  /** sahip olunan kozmetik kimlikleri */
  cosmetics: string[];
  /** açılmış kulak kartı kimlikleri */
  cards: string[];
}

/** feed: Takım Akışı kartı · hazir: hazır söz (Hızlı Sohbet) · soru: Günün Sorusu kartı (bkz. İLETİŞİM bölümü) */
export type ChatKind = 'text' | 'emoji' | 'system' | 'help' | 'race' | 'war' | 'feed' | 'hazir' | 'soru';
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
  /** tepki kimliği (CHAT_REACTIONS) → tepki veren oyuncular */
  reactions?: Record<string, string[]>;
  /** bu mesaj bir kartın/mesajın konusuna (thread) yazılmış yanıtsa üst mesajın kimliği */
  replyTo?: string;
  /** konudaki yanıt sayısı (yalnızca üst mesajlarda) */
  replies?: number;
  /** konunun son yanıtları (en çok 2; geçmişte gelir) */
  thread?: ChatMessage[];
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
  /** Çalışma Grubu modu (Günün Sorusu öğrenci düzeyinden) */
  study?: boolean;
}
export interface TeamMember extends PublicProfile { role: TeamRole; weekPoints: number; joinedAt: number }
export interface HelpRequest { id: string; from: string; name: string; level: number; helpers: string[]; max: number; at: number; expiresAt: number }
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
export interface RacePlayer { id: string; name: string; color: number; hat: string; ready: boolean; pct: number; finishedAt: number | null; place: number | null; score: number | null; left: boolean; /** takım yarışı: taraf (docs/16-takim-rekabeti.md) */ side?: TeamRaceSideId }
export interface RaceRoom { id: string; hostId: string; level: number; salt: number; status: RaceStatus; startsAt: number | null; players: RacePlayer[]; max: number; createdAt: number; /** takım yarışı ise iki takım */ team?: TeamRaceInfo }
export interface RacePos { id: string; x: number; y: number; pct: number; at: number }

// ---------- Lig (haftalık, 30 kişilik grup)
export interface LeagueState { tier: LeagueTier; week: string; endsAt: number; rank: number; points: number; group: { id: string; name: string; color: number; points: number }[]; promoteTop: number; demoteBottom: number }

// ---------- Ödül kutusu (sunucu verdiği ödüller; istemci alınca yerel cüzdana ekler)
export type InboxKind = 'jeton' | 'kristal' | 'kalkan' | 'kozmetik' | 'kart';
export interface InboxItem { id: string; kind: InboxKind; amount: number; ref: string; reason: string; at: number }

// ---------- İlerleme bildirimi (her bölüm sonunda)
export interface ProgressSubmit { /** istemcinin ürettiği benzersiz koşu kimliği: aynı koşu iki kez sayılmaz */ runId: string; level: number; completed: boolean; stars: number; score: number; timeSec: number; coins: number; biome: string; mechanic: string; raceId?: string; /** bu koşuda bulunan altın koklea (0-3; Takım Akışı kartı için) */ cochleas?: number; /** bölümde kullanılan Tedavi Odası malzemeleri (sunucu envanterden düşer; runId ile bir kez) */ remediesUsed?: { id: string; count: number }[] }
export interface ProgressAck { highest: number; stars: number; warPoints: number; raidDamage: number; leaguePoints: number; newInbox: number; jeton: number; wallet: Wallet }


// =====================================================================
// İTTİFAK EKONOMİSİ (Whiteout tarzı ortak ilerleme)
// =====================================================================

/** Para birimleri: jeton (oynayarak), kristal (az miktarda oynayarak + satın alarak). */
export interface Wallet { jeton: number; kristal: number; hizlandirici: { m5: number; m60: number; s8: number } }

// ---------- Kulak Kampı (kişisel üs; süreli inşaat, takım yardımıyla hızlanır)
// Kimlikler kalıcıdır (kayıtlar ve sunucu satırları bunlara bağlı); adlar ve açıklamalar odyoloji temasına göre (docs/14-kamp.md).
export type BuildingId = 'merkez' | 'laboratuvar' | 'atolye' | 'depo' | 'kule' | 'revir' | 'tedavi';
export interface BuildingDef { id: BuildingId; name: string; emoji: string; desc: string; maxLevel: number; /** dar yerlerde (üst gösterge) kısa ad */ short?: string }
export const BUILDINGS: BuildingDef[] = [
  { id: 'merkez', name: 'Odyoloji Merkezi', short: 'Merkez', emoji: '🏕️', desc: 'Kampın kalbi: diğer binaların en yüksek seviyesini belirler.', maxLevel: 15 },
  { id: 'laboratuvar', name: 'Odyometri Odası', short: 'Odyometri', emoji: '🔬', desc: 'Ölçtükçe daha çok öğrenirsin: bölüm jetonu +%3/seviye.', maxLevel: 15 },
  { id: 'atolye', name: 'İşitme Cihazı Atölyesi', short: 'Atölye', emoji: '🛠️', desc: 'Ayarlı cihaz zor anda destek olur: bölüm başında kalkan şansı +%4/seviye.', maxLevel: 15 },
  { id: 'depo', name: 'Kulak Deposu', short: 'Depo', emoji: '📦', desc: 'Kulak kiri gibi kendiliğinden birikir: saatte seviye × 20 jeton, 8 saatte dolar.', maxLevel: 15 },
  { id: 'kule', name: 'Timpanometri Kulesi', short: 'Kule', emoji: '🗼', desc: 'Zarın titreşimini yoklar, takımının sesini uzağa taşır: savaş puanı +%2/seviye.', maxLevel: 15 },
  { id: 'revir', name: 'Odyoloji Kliniği', short: 'Klinik', emoji: '💚', desc: 'Erken fark edilen sorun kolay atlatılır: bölümde ilk hasarı yok sayma şansı +%3/seviye.', maxLevel: 15 },
  { id: 'tedavi', name: 'Tedavi Odası', short: 'Tedavi', emoji: '🩹', desc: 'Koruma ve tedavi malzemesi hazırlar; bölüme yanında götürür, uygun engeli bir kez aşarsın.', maxLevel: 15 },
];
/** inşaat maliyeti ve süresi (sn): seviyeyle üstel büyür; şeffaf formül */
export function buildCost(id: BuildingId, toLevel: number): { jeton: number; seconds: number } {
  const base = id === 'merkez' ? 1.4 : 1;
  return { jeton: Math.round(80 * base * Math.pow(toLevel, 1.9)), seconds: Math.round(60 * base * Math.pow(toLevel, 2.2)) };
}
export interface BuildingState { id: BuildingId; level: number; upgradingTo: number | null; startedAt: number | null; endsAt: number | null; helpsReceived: number }
/** Tedavi Odası üretimi ve çanta (sunucu yetkili; kurallar @odi/content remedies.ts) */
export interface RemedyState {
  /** şu an hazırlanan malzeme (yoksa null) ve sayacın başladığı an */
  item: string | null; since: number;
  /** envanter: malzeme kimliği → adet */
  inv: Record<string, number>;
}
export interface CampState { buildings: BuildingState[]; depotStoredAt: number; serverTime: number; /** Tedavi Odası (eski sunucularda yok) */ remedy?: RemedyState }
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
export interface TeamGoal { id: string; name: string; metric: 'yildiz' | 'bolum' | 'baskin'; progress: number; tiers: TeamGoalTier[]; claimedTiers: number[]; endsAt: number }
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
  /** takım hediyesi olarak diğer üyelere düşen içerik (teamGift true ise) */
  teamGiftContents?: { kind: InboxKind; amount: number; ref: string }[];
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
  { id: 'odi.pass', name: 'Odi Sezon Kartı', desc: '28 gün boyunca her gün 30 kristal (toplam 840) + Altın Koklea kostümü', priceTry: 99.99, contents: [{ kind: 'pass', amount: 28 }, { kind: 'kozmetik', amount: 1, ref: 'kostum-altin' }], teamGift: true, limit: 1 },
];
/** kristal ile hızlandırma: kalan her dakika için 1 kristal (yukarı yuvarlanır) — şeffaf */
export function crystalsToFinish(remainingSec: number): number { return Math.max(1, Math.ceil(remainingSec / 60)); }
export interface PurchaseRecord { id: string; productId: string; at: number; store: 'test' | 'app-store' | 'play'; amountTry: number }
/** harcama sınırı (aylık TL); oyuncu ayarlardan düşürebilir; 18 yaş altı beyanında 0 */
export interface SpendState { monthTry: number; limitTry: number; purchases: PurchaseRecord[]; /** yükseltme isteği 24 saat sonra geçerli olur */ pendingLimitTry: number | null; pendingLimitAt: number | null }

// ---------- İstek/yanıt sözleşmesi
export interface OpMap {
  'hello': { req: { token?: string; name?: string; version: number }; res: { me: MyProfile; serverTime: number } };
  'profile.update': { req: { name?: string; color?: number; hat?: string }; res: { me: MyProfile } };
  'profile.get': { req: { id: string }; res: { profile: PublicProfile } };
  'progress.submit': { req: ProgressSubmit; res: ProgressAck };
  'friends.list': { req: Record<string, never>; res: { friends: PublicProfile[]; /** bugün hediye gönderilen arkadaşlar */ gifted?: string[] } };
  /** geriye uyumlu: istek gönderir (karşı taraf da eklemişse anında arkadaş); status yeni istemciler için */
  'friends.add': { req: { code: string }; res: { friend: PublicProfile; status?: 'istek' | 'arkadas' } };
  'friends.remove': { req: { id: string }; res: Record<string, never> };
  'chat.join': { req: { room: string }; res: { history: ChatMessage[] } };
  'chat.leave': { req: { room: string }; res: Record<string, never> };
  /** kind 'hazir': text = hazır söz kimliği (QUICK_PHRASES); replyTo: bir kartın/mesajın konusuna yanıt */
  'chat.send': { req: { room: string; text: string; kind?: 'text' | 'emoji' | 'hazir'; replyTo?: string }; res: { msg: ChatMessage } };
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
  /** Tedavi Odası: hazırlanacak malzemeyi seç (rafta biriken önce çantaya alınır; null = dur) */
  'camp.remedy.make': { req: { item: string | null }; res: { camp: CampState; collected: number } };
  /** Tedavi Odası: raftakileri çantaya al (zamana bağlı; ikinci çağrı 0 alır) */
  'camp.remedy.collect': { req: Record<string, never>; res: { camp: CampState; collected: number } };
  'team.extra': { req: Record<string, never>; res: { extra: TeamExtra } };
  'team.donate': { req: { tech: TechId; jeton: number }; res: { extra: TeamExtra; wallet: Wallet } };
  'team.gift.claim': { req: { giftId: string }; res: { extra: TeamExtra; wallet: Wallet } };
  'team.goal.claim': { req: { goalId: string; tier: number }; res: { extra: TeamExtra; wallet: Wallet } };
  'shop.list': { req: Record<string, never>; res: { products: (ShopProduct & { bought: number })[]; spend: SpendState; testStore: boolean } };
  'shop.purchase': { req: { productId: string; store: 'test' | 'app-store' | 'play'; receipt?: string }; res: { wallet: Wallet; spend: SpendState; teamGiftSent: boolean } };
  'shop.limit': { req: { limitTry: number }; res: { spend: SpendState } };
  'me.bonuses': { req: Record<string, never>; res: { coinPct: number; shieldChancePct: number; firstHitIgnorePct: number; warPct: number; raidPct: number } };
  /** yerel meta ödüllerinin (görev/takvim/sandık/hazine…) jetonu: ledgerId ile idempotent, günlük üst sınırlı */
  'wallet.local': { req: { ledgerId: string; jeton: number; reason: string }; res: { wallet: Wallet; credited: number; dailyLeft: number } };
  /** jeton harcama (şimdilik yalnızca `yetenek:<id>`; sunucu maliyeti doğrular, aynı yetenek iki kez alınmaz) */
  'wallet.spend': { req: { jeton: number; reason: string }; res: { wallet: Wallet; skills: string[] } };
  /** sunucuda kayıtlı yetenekler (SKILL_TREE kimlikleri) */
  'skills.list': { req: Record<string, never>; res: { skills: string[] } };
  /** cihazdaki çevrimdışı bölüm ilerlemesini hesaba taşır: yalnızca açık bölüm ve en iyi yıldız/skor (jeton, savaş, baskın, lig vermez) */
  'progress.sync': { req: { best: { level: number; stars: number; score: number }[] }; res: { highest: number; stars: number } };
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
export type WireFire = { t: 'fire'; op: 'race.pos'; data: { x: number; y: number; pct: number } } | { t: 'fire'; op: 'dm.typing'; data: { to: string } };
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

// =====================================================================
// ETKİNLİKLER (grup + bireysel). Yalnızca EKLEME: OpMap/EvtMap aşağıda arayüz birleştirme ile genişler.
// Dürüstlük: tüm puanlar oynayarak kazanılır (parayla alınmaz), ödüller sabit ve önceden görünür,
// geri sayımlar gerçek etkinlik süreleridir, rakip/katılımcıların hepsi gerçek oyuncudur.
// =====================================================================

export type EventKind = 'ralli' | 'duello' | 'bayrak' | 'avi' | 'quiz' | 'gorev' | 'meydan' | 'turnuva';
export interface EventReward { kind: InboxKind; amount: number; ref: string }
export interface EventPeriod { key: string; startsAt: number; endsAt: number }

// ---------- Ralli (takım ortak mini canavar)
export type RallyMonsterId = 'serumen-yavrusu' | 'cinlama-cini' | 'yanki-hayaleti';
export interface RallyMonsterDef {
  id: RallyMonsterId; name: string; emoji: string; desc: string;
  /** ralli bölümü: generateLevel('insan', level, DEFAULT_PROFILE, rally.salt) */
  level: number;
  /** can = hpBase + hpPerMember × üye sayısı (ralli başlarken sabitlenir) */
  hpBase: number; hpPerMember: number;
  /** kazanılınca katılan herkese (ödül kutusu) */
  reward: EventReward[];
  /** kazanılınca takım XP'si */
  teamXp: number;
}
export const RALLY_MONSTERS: RallyMonsterDef[] = [
  { id: 'serumen-yavrusu', name: 'Serumen Yavrusu', emoji: '🟤', desc: 'Kanalda yuvarlanan yapışkan bir yavru. Isınmak için ideal!', level: 6, hpBase: 80, hpPerMember: 60,
    reward: [{ kind: 'jeton', amount: 150, ref: 'ralli' }, { kind: 'kristal', amount: 10, ref: 'ralli' }], teamXp: 40 },
  { id: 'cinlama-cini', name: 'Çınlama Cini', emoji: '🧞', desc: 'Kulak zarında vızıldayan inatçı bir cin. Zıplamayı unutma!', level: 9, hpBase: 140, hpPerMember: 90,
    reward: [{ kind: 'jeton', amount: 220, ref: 'ralli' }, { kind: 'kristal', amount: 20, ref: 'ralli' }], teamXp: 70 },
  { id: 'yanki-hayaleti', name: 'Yankı Hayaleti', emoji: '👻', desc: 'Koklea sularında yankılanan hayalet. En zorlu ralli!', level: 21, hpBase: 200, hpPerMember: 120,
    reward: [{ kind: 'jeton', amount: 300, ref: 'ralli' }, { kind: 'kristal', amount: 35, ref: 'ralli' }, { kind: 'kalkan', amount: 1, ref: 'ralli' }], teamXp: 100 },
];
export const RALLY_RULES = { durationMs: 10 * 60_000, minPlayers: 2, triesPerPlayer: 3, startsPerTeamDay: 6, rewardsPerPlayerDay: 5, duelPoints: 60 } as const;
/** ralli hasarı: tamamlanırsa 60 + 30 × yıldız, tamamlanmazsa 15 (şeffaf) */
export function rallyDamageFor(r: { completed: boolean; stars: number }): number { return r.completed ? 60 + 30 * Math.max(0, Math.min(3, r.stars)) : 15; }
export function rallyMaxHp(m: Pick<RallyMonsterDef, 'hpBase' | 'hpPerMember'>, members: number): number { return m.hpBase + m.hpPerMember * Math.max(1, members); }
export type RallyStatus = 'acik' | 'kazanildi' | 'kaybedildi';
export interface RallyParticipant { id: string; name: string; color: number; hat: string; damage: number; tries: number; joinedAt: number }
export interface RallyHit { id: string; name: string; damage: number; stars: number; completed: boolean; at: number }
export interface RallyState {
  id: string; teamId: string; monster: RallyMonsterId; salt: number; starterId: string; starterName: string;
  status: RallyStatus; hp: number; maxHp: number; startsAt: number; endsAt: number; wonAt: number | null;
  participants: RallyParticipant[]; hits: RallyHit[];
}

// ---------- Takım Düellosu (48 saat, haftada 2 dönem)
export interface DuelSide { teamId: string; name: string; emblem: string; power: number; points: number; top: { id: string; name: string; points: number }[] }
export interface DuelState {
  /** şu anki düello dönemi (yoksa iki dönem arası) */
  period: EventPeriod | null;
  next: EventPeriod;
  status: 'kapali' | 'araniyor' | 'eslesti';
  me: DuelSide | null;
  rival: DuelSide | null;
  myPoints: number;
  /** son 2 saat (gerçek) */
  finalPush: boolean;
  finalPushMs: number;
  rewards: { win: EventReward[]; lose: EventReward[]; tie: EventReward[] };
  /** son biten düellonun sonucu (varsa) */
  last: { key: string; result: 'kazandi' | 'kaybetti' | 'berabere'; mine: number; theirs: number; rivalName: string; rivalEmblem: string } | null;
}
export const DUEL_RULES = { starPoints: 10, rallyWin: 60, relayLeg: 40, relayImprove: 10 } as const;

// ---------- Bayrak Yarışı (haftalık, 4 ayak, asenkron)
export interface RelayLeg { index: number; level: number; salt: number; best: { id: string; name: string; timeSec: number } | null; firstBy: { id: string; name: string } | null }
export interface RelayState {
  period: EventPeriod;
  legs: RelayLeg[];
  /** sıradaki ayak (0-3); 4 = parkur tamamlandı (artık her ayakta süre iyileştirilebilir) */
  current: number;
  carrier: { id: string; name: string; since: number; until: number } | null;
  lastRunner: { id: string; name: string } | null;
  totalSec: number | null;
  ranking: { teamId: string; name: string; emblem: string; totalSec: number | null; legs: number }[];
  history: { leg: number; id: string; name: string; timeSec: number; at: number }[];
  rewards: { finish: EventReward[]; podium: EventReward[][] };
}

// ---------- Ses Avı (3 günlük ortak toplama)
export interface HuntTier { need: number; reward: EventReward[]; reached: boolean }
export interface HuntState { period: EventPeriod | null; next: EventPeriod; target: number; progress: number; tiers: HuntTier[]; song: number[] | null; songName: string; contributors: { id: string; name: string; notes: number }[] }

// ---------- Kulak Bilgi Yarışması (canlı takım quizi)
export type QuizPhase = 'lobi' | 'soru' | 'cevap' | 'bitti';
export interface QuizQuestionView { index: number; total: number; text: string; choices: string[]; startsAt: number; endsAt: number; answer: number | null; explain: string | null; myChoice: number | null; answered: number }
export interface QuizPlayer { id: string; name: string; color: number; score: number; correct: number; answered: boolean; lastCorrect: boolean | null }
export interface QuizState { id: string; teamId: string; phase: QuizPhase; startedBy: string; lobbyEndsAt: number; endsAt: number; players: QuizPlayer[]; question: QuizQuestionView | null; teamAvg: number; questionMs: number; revealMs: number }
export interface QuizInfo { nextSlotAt: number; slotOpen: boolean; canStart: boolean; startsLeft: number; ranking: { teamId: string; name: string; emblem: string; avg: number }[]; rewards: { perCorrect: number; bonusAvg: number; bonus: EventReward[] } }

// ---------- Günlük takım görevleri
export type TeamQuestKind = 'bolum' | 'yildiz' | 'uye' | 'ralli' | 'quiz' | 'bayrak' | 'avi';
export interface TeamQuest { kind: TeamQuestKind; text: string; need: number; progress: number; done: boolean; reward: EventReward[] }
export interface TeamQuestsState { day: string; endsAt: number; quests: TeamQuest[]; bonus: EventReward[]; allDone: boolean }

// ---------- Günün Meydan Okuması (bireysel)
export interface RankRow { id: string; name: string; color: number; score: number; rank: number }
export interface ChallengeState {
  day: string; endsAt: number; level: number; salt: number; tries: number; maxTries: number; best: number | null;
  rank: number | null; total: number; top: RankRow[]; friends: RankRow[];
  rewards: { label: string; items: EventReward[] }[];
  last: { day: string; rank: number; score: number; total: number } | null;
}

// ---------- Haftalık Turnuva (bireysel, 50 kişilik grup)
export interface TourneyState {
  week: string; endsAt: number; levels: { slot: number; level: number; salt: number; best: number | null }[];
  total: number; rank: number | null; groupSize: number; group: RankRow[];
  rewards: { label: string; items: EventReward[] }[];
}

// ---------- Bildirim ve genel bakış
export interface EventNotice { id: string; kind: EventKind; icon: string; title: string; text: string; at: number; /** tıklayınca açılacak etkinlik */ target: EventKind; ref?: string }
export interface EventsOverview {
  serverTime: number; fast: boolean; inTeam: boolean;
  rally: RallyState | null; rallyStartsLeft: number;
  duel: DuelState | null; relay: RelayState | null; hunt: HuntState | null;
  quiz: QuizState | null; quizInfo: QuizInfo | null; quests: TeamQuestsState | null;
  challenge: ChallengeState; tourney: TourneyState;
}

/** etkinlik koşusu sonucu (sunucu makullük denetler; runId ile idempotent) */
export interface EventRun { runId: string; completed: boolean; stars: number; score: number; timeSec: number }

export interface OpMap {
  'events.overview': { req: Record<string, never>; res: { overview: EventsOverview } };
  'rally.state': { req: Record<string, never>; res: { rally: RallyState | null; startsLeft: number } };
  'rally.start': { req: { monster: RallyMonsterId }; res: { rally: RallyState } };
  'rally.join': { req: { rallyId: string }; res: { rally: RallyState } };
  'rally.hit': { req: EventRun & { rallyId: string }; res: { rally: RallyState; damage: number } };
  'duel.state': { req: Record<string, never>; res: { duel: DuelState } };
  'relay.state': { req: Record<string, never>; res: { relay: RelayState } };
  'relay.take': { req: Record<string, never>; res: { relay: RelayState } };
  'relay.pass': { req: { to: string }; res: { relay: RelayState } };
  'relay.submit': { req: EventRun & { leg: number }; res: { relay: RelayState; improved: boolean } };
  'hunt.state': { req: Record<string, never>; res: { hunt: HuntState } };
  'quiz.state': { req: Record<string, never>; res: { quiz: QuizState | null; info: QuizInfo } };
  'quiz.start': { req: { level?: 'genel' | 'odyoloji' }; res: { quiz: QuizState } };
  'quiz.join': { req: { quizId: string }; res: { quiz: QuizState } };
  'quiz.go': { req: { quizId: string }; res: { quiz: QuizState } };
  'quiz.answer': { req: { quizId: string; index: number; choice: number }; res: { quiz: QuizState } };
  'tquests.state': { req: Record<string, never>; res: { quests: TeamQuestsState } };
  'challenge.state': { req: Record<string, never>; res: { challenge: ChallengeState } };
  'challenge.submit': { req: EventRun; res: { challenge: ChallengeState } };
  'tourney.state': { req: Record<string, never>; res: { tourney: TourneyState } };
  'tourney.submit': { req: EventRun & { slot: number }; res: { tourney: TourneyState } };
}

export interface EvtMap {
  'events.notice': { notice: EventNotice };
  'rally.updated': { rally: RallyState };
  'duel.updated': { duel: DuelState };
  'relay.updated': { relay: RelayState };
  'hunt.updated': { hunt: HuntState };
  'quiz.updated': { quiz: QuizState };
  'tquests.updated': { quests: TeamQuestsState };
}

// =====================================================================
// ARKADAŞLIK VE ÖZEL MESAJ (v2). Yalnızca EKLEME: OpMap/EvtMap aşağıda arayüz birleştirme ile genişler.
// Arkadaşlık artık istekle kurulur (karşı taraf kabul eder); eski 'friends.add' {code} istek gönderir,
// iki taraf da birbirini eklediyse anında arkadaş olurlar.
// Özel mesaj izni: arkadaşlar ve AYNI TAKIMDAKİLER birbirine yazabilir; diğer herkese kapalı.
// Engelleme her iki yönde de mesajı, isteği, daveti ve hediyeyi keser; arkadaşlığı siler.
// =====================================================================

export const FRIEND_LIMITS = {
  friendsMax: 200, requestsPerDay: 50, outgoingMax: 100, searchMin: 3, searchPage: 20, suggestMax: 20,
  giftsPerDay: 20, giftJeton: 10, giftThanksJeton: 2,
  dmMax: 500, dmKeep: 500, dmPage: 30, dmCooldownMs: 600, typingMs: 4000, reportsToMute: 3,
} as const;
/** mesaj tepkileri: sabit 6 emoji, mesaj başına kişi başı bir tepki */
export const DM_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const;
export type DmReaction = (typeof DM_REACTIONS)[number];
/** Odi çıkartmaları: gönderenin Odi'si (renk + şapka) bu ifadeyle büyük çizilir */
export const DM_STICKERS: { id: string; emoji: string; label: string; mood: 'happy' | 'wow' }[] = [
  { id: 'selam', emoji: '👋', label: 'Selam!', mood: 'happy' },
  { id: 'kalp', emoji: '❤️', label: 'Seni seviyorum', mood: 'happy' },
  { id: 'kahkaha', emoji: '😂', label: 'Ahaha', mood: 'happy' },
  { id: 'vay', emoji: '😮', label: 'Vay be!', mood: 'wow' },
  { id: 'kupa', emoji: '🏆', label: 'Şampiyon', mood: 'happy' },
  { id: 'ates', emoji: '🔥', label: 'Yanıyorsun', mood: 'wow' },
  { id: 'uyku', emoji: '😴', label: 'Uykum geldi', mood: 'happy' },
  { id: 'tamam', emoji: '👍', label: 'Tamamdır', mood: 'happy' },
  { id: 'yaris', emoji: '🏁', label: 'Yarışalım!', mood: 'wow' },
  { id: 'nota', emoji: '🎵', label: 'La la la', mood: 'happy' },
];

/** iki oyuncu arasındaki durum (bakan kişiye göre) */
export type Relation = 'ben' | 'arkadas' | 'istek-giden' | 'istek-gelen' | 'engelledin' | 'yok';
export interface FriendRequest { id: string; from: PublicProfile; to: PublicProfile; at: number }
export interface SearchHit { profile: PublicProfile; relation: Relation }
export type SuggestReason = 'takim' | 'yaris' | 'lig' | 'ortak';
export interface FriendSuggestion { profile: PublicProfile; kind: SuggestReason; /** "Takım arkadaşın", "Seninle yarıştı" … */ reason: string }
export interface ProfileCard {
  profile: PublicProfile;
  relation: Relation;
  /** bekleyen istek (gelen ya da giden) */
  requestId: string | null;
  friendCount: number;
  mutualFriends: number;
  sameTeam: boolean;
  /** özel mesaj gönderilebilir mi (arkadaş ya da takım arkadaşı, engel yok) */
  canMessage: boolean;
  /** bugün bu arkadaşa hediye gönderildi mi */
  giftedToday: boolean;
}

export type DmKind = 'text' | 'emoji' | 'sticker' | 'davet' | 'hazir';
export interface DmMessage {
  id: string;
  /** konuşma içi sıra (artan) */
  seq: number;
  from: string;
  to: string;
  /** silinmişse boş */
  text: string;
  kind: DmKind;
  at: number;
  /** davet kartı: { type: 'yaris' | 'ralli' | …, roomId, level? } */
  meta?: Record<string, string | number | boolean>;
  deleted?: boolean;
  /** oyuncu kimliği → tepki emojisi */
  reactions?: Record<string, string>;
}
export interface DmThread { other: PublicProfile; last: DmMessage | null; unread: number; at: number; friend: boolean; canMessage: boolean }

export interface OpMap {
  'friends.request': { req: { code?: string; name?: string; id?: string }; res: { status: 'istek' | 'arkadas'; request: FriendRequest | null; friend: PublicProfile } };
  'friends.respond': { req: { requestId: string; accept: boolean }; res: { friend: PublicProfile | null } };
  'friends.requests': { req: Record<string, never>; res: { incoming: FriendRequest[]; outgoing: FriendRequest[] } };
  'friends.cancel': { req: { requestId: string }; res: Record<string, never> };
  'friends.suggest': { req: Record<string, never>; res: { suggestions: FriendSuggestion[] } };
  'friends.gift': { req: { id: string }; res: { wallet: Wallet; thanks: number; left: number } };
  'players.search': { req: { query: string; page?: number }; res: { players: SearchHit[]; hasMore: boolean } };
  'players.block': { req: { id: string }; res: { blocked: string[] } };
  'players.unblock': { req: { id: string }; res: { blocked: string[] } };
  'players.blocked': { req: Record<string, never>; res: { players: PublicProfile[] } };
  'players.report': { req: { id: string; reason: 'isim' | 'taciz' | 'diger' }; res: Record<string, never> };
  'profile.card': { req: { id: string }; res: { card: ProfileCard } };
  'dm.threads': { req: Record<string, never>; res: { threads: DmThread[]; unread: number } };
  'dm.open': { req: { id: string; before?: number }; res: { other: PublicProfile; messages: DmMessage[]; hasMore: boolean; peerReadSeq: number; myReadSeq: number; canMessage: boolean; reason: string | null } };
  'dm.send': { req: { to: string; text: string; kind?: DmKind; meta?: Record<string, string | number | boolean> }; res: { msg: DmMessage } };
  'dm.read': { req: { id: string; upTo?: number }; res: { unread: number } };
  'dm.react': { req: { msgId: string; emoji: string }; res: { msg: DmMessage } };
  'dm.delete': { req: { msgId: string }; res: { msg: DmMessage } };
  'dm.report': { req: { msgId: string }; res: Record<string, never> };
}

export interface EvtMap {
  'friend.request': { request: FriendRequest; /** gönderen iptal etti / reddedildi */ removed?: boolean };
  'friend.accepted': { friend: PublicProfile };
  /** arkadaşlıktan çıkarıldın ya da engellendin: listeden düş */
  'friend.removed': { id: string };
  'friend.gift': { from: PublicProfile; amount: number };
  'dm.message': { msg: DmMessage; from: PublicProfile };
  'dm.read': { by: string; seq: number };
  'dm.typing': { from: string; until: number };
  'dm.reaction': { msg: DmMessage };
  'dm.unread': { total: number };
}

/** WireFire işlemleri (yanıtsız, hız sınırlı) */
export interface FireMap {
  'race.pos': { x: number; y: number; pct: number };
  'dm.typing': { to: string };
}
export type FireOp = keyof FireMap;

// =====================================================================
// İLETİŞİM (v3, docs/13-iletisim.md). Yalnızca EKLEME: OpMap/EvtMap aşağıda arayüz birleştirme ile genişler.
// Dürüstlük: akış kartları yalnızca gerçek olaylardan (sunucunun gördüğü) üretilir; sahte oyuncu, sahte mesaj, sahte sayaç yok.
// Ödüller sabit, önceden görünür ve bir kez verilir. Yeni oyuncu 10. bölüme kadar (ya da kendisi açana kadar) yalnız hazır söz yazar.
// =====================================================================

/** Takım Akışı ve sohbet tepkileri (arayüzde resimli ikon; emoji değil) */
export const CHAT_REACTIONS = ['alkis', 'kalp', 'ates', 'yildiz', 'guc'] as const;
export type ChatReaction = (typeof CHAT_REACTIONS)[number];
export const REACTION_LABEL: Record<ChatReaction, string> = { alkis: 'Alkış', kalp: 'Kalp', ates: 'Ateş', yildiz: 'Yıldız', guc: 'Güç' };

/** Hızlı Sohbet: hazır sözler (kimlikle gönderilir, metni sunucu yazar) */
export type PhraseCtx = 'genel' | 'tebrik' | 'yaris' | 'ipucu' | 'tesekkur';
export interface QuickPhrase { id: string; text: string; ctx: PhraseCtx[] }
export const QUICK_PHRASES: QuickPhrase[] = [
  { id: 'selam', text: 'Selam!', ctx: ['genel', 'yaris'] },
  { id: 'nasilsin', text: 'Nasıl gidiyor?', ctx: ['genel'] },
  { id: 'birlikte', text: 'Birlikte oynayalım mı?', ctx: ['genel'] },
  { id: 'yardim-lazim', text: 'Yardım lazım mı?', ctx: ['genel'] },
  { id: 'hedef', text: 'Bu hafta hedefe yetişelim!', ctx: ['genel'] },
  { id: 'gorusuruz', text: 'Görüşürüz!', ctx: ['genel', 'yaris'] },
  { id: 'tebrik', text: 'Tebrikler!', ctx: ['tebrik', 'genel'] },
  { id: 'harika', text: 'Harikaydı!', ctx: ['tebrik', 'yaris'] },
  { id: 'devam', text: 'Böyle devam!', ctx: ['tebrik'] },
  { id: 'hosgeldin', text: 'Hoş geldin, aramıza katıldığına sevindik!', ctx: ['tebrik'] },
  { id: 'iyi-sans', text: 'İyi şanslar!', ctx: ['yaris'] },
  { id: 'hazirim', text: 'Hazırım!', ctx: ['yaris'] },
  { id: 'bir-daha', text: 'Bir daha yarışalım mı?', ctx: ['yaris'] },
  { id: 'iyi-yaris', text: 'İyi yarıştı!', ctx: ['yaris'] },
  { id: 'az-kaldi', text: 'Az kalmıştı!', ctx: ['yaris'] },
  { id: 'tesekkur', text: 'Teşekkürler!', ctx: ['tesekkur', 'genel'] },
  { id: 'rica', text: 'Rica ederim, ne demek!', ctx: ['tesekkur'] },
  { id: 'ipucu-erken', text: 'İpucu: boşluğa gelmeden hemen önce zıpla.', ctx: ['ipucu'] },
  { id: 'ipucu-bas', text: 'İpucu: uzun zıplamak için basılı tut.', ctx: ['ipucu'] },
  { id: 'ipucu-ritim', text: 'İpucu: acele etme, müziğin ritmini dinle.', ctx: ['ipucu'] },
  { id: 'ipucu-kaydir', text: 'İpucu: alçak engelin altından aşağı kaydır.', ctx: ['ipucu'] },
  { id: 'ipucu-duvar', text: 'İpucu: duvara değince dokun, karşıya sıçrarsın.', ctx: ['ipucu'] },
  { id: 'ipucu-kalkan', text: 'İpucu: zor yerde kalkanla başla, ilk darbe sayılmaz.', ctx: ['ipucu'] },
  { id: 'ipucu-yavas', text: 'İpucu: önce notaları değil, yolu öğren; yıldızlar sonra gelir.', ctx: ['ipucu'] },
];
export const phraseById = (id: string) => QUICK_PHRASES.find((p) => p.id === id);

/** sabit kurallar (sunucu ve istemci aynı değeri gösterir) */
export const COMM_RULES = {
  /** ZORUNLU güvenli sohbet: bu kadar bölüm GEÇİLENE kadar yalnızca hazır sözler ve emoji (açma seçeneği yok); sonra kendiliğinden açılır */
  freeTextLevel: 8,
  feedMergeMs: 30 * 60_000, feedPerTeamHour: 20, threadMax: 50, threadPreview: 2, mentionsMax: 3,
  reactMinMs: 250, reactPerMin: 60,
  challengePerDay: 3, challengeMs: 48 * 3_600_000,
  helpAskerJeton: 15, helpHelperJeton: 20, helpFailsToAsk: 3,
  dqRevealHour: 20, dqCorrectJeton: 10,
  duoInvitesPerDay: 5,
  duoTiers: [
    { need: 300, reward: [{ kind: 'jeton' as const, amount: 120, ref: 'ikili' }, { kind: 'kristal' as const, amount: 10, ref: 'ikili' }] },
    { need: 800, reward: [{ kind: 'jeton' as const, amount: 200, ref: 'ikili' }, { kind: 'kristal' as const, amount: 20, ref: 'ikili' }] },
  ],
  /** usta: en yüksek açık bölüm ≥ 11 (10 bölüm geçmiş); çırak: en yüksek ≤ 9 */
  mentorMinHighest: 11, apprenticeMaxHighest: 9, mentorMaxApprentices: 3, mentorOffersPerDay: 5,
  mentorMilestones: [5, 10, 15, 20] as const,
  mentorReward: {
    apprentice: [{ kind: 'jeton' as const, amount: 40, ref: 'usta-cirak' }],
    mentor: [{ kind: 'jeton' as const, amount: 30, ref: 'usta-cirak' }, { kind: 'kristal' as const, amount: 5, ref: 'usta-cirak' }],
  },
  streakMilestones: [3, 7, 14, 30, 60, 100] as const,
} as const;

/** Takım Akışı kartı türü (ChatMessage.kind 'feed', meta.type) */
export type FeedType = 'bolum' | 'boss' | 'koklea' | 'bina' | 'uye' | 'seri' | 'yardim' | 'meydan'
  /** haftalık sıralama kapanışında ilk 3 (docs/15-siralama.md) */
  | 'sira'
  /** Takım Yarışı sonucu (docs/16-takim-rekabeti.md) */
  | 'tyaris';

export interface CommSettings {
  /** serbest yazı açık mı (freeTextLevel bölüm geçildi; öncesinde yalnızca hazır sözler ve emoji, açma seçeneği yok) */
  canFreeText: boolean;
  /** başarılarım Takım Akışı'nda görünsün */
  feedShare: boolean;
  /** serbest yazının açılması için geçilmesi gereken bölüm sayısı */
  freeTextLevel: number;
}
/** gerçek zamanlı iletişim bildirimi (bahsetme, teşekkür, usta/ikili davet, meydan okuma geçildi…) */
export interface CommNotice {
  id: string;
  kind: 'mention' | 'thanks' | 'mentor' | 'duo' | 'challenge' | 'dq';
  title: string; text: string;
  from?: PublicProfile;
  /** ilgili sohbet odası ve mesaj (yanıt için) */
  room?: string; msgId?: string;
  at: number;
}

// ---------- Günün Sorusu
export interface DailyQuestion {
  day: string; msgId: string; text: string; choices: string[];
  level: 'merakli' | 'odyoloji';
  revealAt: number; revealed: boolean;
  /** açıklanınca */ answer: number | null; explain: string | null;
  answered: number; myChoice: number | null;
  /** açıklanınca doğru bilenler */
  correct: { id: string; name: string }[] | null;
}
export interface DqBoardRow { id: string; name: string; color: number; correct: number; answered: number }
export interface DqState { question: DailyQuestion | null; week: DqBoardRow[]; study: boolean; reward: number }

// ---------- İkili Görev
export interface DuoMember { id: string; name: string; color: number; hat: string; notes: number; online: boolean }
export interface DuoInvite { id: string; from: PublicProfile; to: PublicProfile; at: number }
export interface DuoState {
  week: string; endsAt: number;
  active: { id: string; members: DuoMember[]; progress: number; tiers: { need: number; reward: EventReward[]; reached: boolean }[] } | null;
  incoming: DuoInvite[]; outgoing: DuoInvite[];
  /** davet edilebilecek arkadaşlar (bu hafta görevi olmayan) */
  candidates: PublicProfile[];
  tiers: { need: number; reward: EventReward[] }[];
}

// ---------- Usta–Çırak
export interface MentorLink { id: string; mentor: PublicProfile; apprentice: PublicProfile; since: number; startHighest: number; next: number | null; reached: number[] }
export interface MentorOffer { id: string; mentor: PublicProfile; apprentice: PublicProfile; by: string; at: number }
export interface MentorState {
  canMentor: boolean; canBeApprentice: boolean;
  mentor: MentorLink | null; apprentices: MentorLink[];
  incoming: MentorOffer[]; outgoing: MentorOffer[];
  /** teklif edilebilecek arkadaş/takım arkadaşları */
  candidates: PublicProfile[];
  milestones: number[];
  rewards: { apprentice: EventReward[]; mentor: EventReward[] };
}

export interface OpMap {
  'chat.react': { req: { msgId: string; reaction: ChatReaction | '' }; res: { msg: ChatMessage } };
  'chat.thread': { req: { msgId: string }; res: { parent: ChatMessage; replies: ChatMessage[] } };
  'comm.state': { req: Record<string, never>; res: { settings: CommSettings } };
  'comm.settings': { req: { feedShare?: boolean }; res: { settings: CommSettings } };
  /** takıma meydan oku: sunucu oyuncunun kayıtlı en iyi skorunu kullanır */
  'feed.challenge': { req: { level: number }; res: { msg: ChatMessage } };
  'help.tip': { req: { requestId: string; phrase?: string; text?: string }; res: { msg: ChatMessage } };
  'help.race': { req: { requestId: string }; res: { room: RaceRoom } };
  'dq.state': { req: Record<string, never>; res: DqState };
  'dq.answer': { req: { choice: number }; res: DqState };
  'team.study': { req: { on: boolean }; res: { study: boolean } };
  'duo.state': { req: Record<string, never>; res: { duo: DuoState } };
  'duo.invite': { req: { friendId: string }; res: { duo: DuoState } };
  'duo.respond': { req: { inviteId: string; accept: boolean }; res: { duo: DuoState } };
  'mentor.state': { req: Record<string, never>; res: { mentor: MentorState } };
  /** as: teklif edenin rolü ('usta' → karşı taraf çırak olur) */
  'mentor.offer': { req: { id: string; as: 'usta' | 'cirak' }; res: { mentor: MentorState } };
  'mentor.respond': { req: { offerId: string; accept: boolean }; res: { mentor: MentorState } };
  'mentor.end': { req: { linkId: string }; res: { mentor: MentorState } };
}

export interface EvtMap {
  /** mesaj güncellendi (tepki, akış kartı birleşmesi, yardım kartı sayaçları, soru açıklandı) */
  'chat.updated': { msg: ChatMessage };
  'comm.notice': { notice: CommNotice };
  'duo.updated': { duo: DuoState };
  'mentor.updated': { mentor: MentorState };
}

// =====================================================================
// SIRALAMA (v4, docs/15-siralama.md). Yalnızca EKLEME. Tüm puanlar sunucunun doğruladığı olaylardan hesaplanır (istemci sayı söylemez).
// Haftalık tablolar Pazartesi 00:00 (İstanbul) sıfırlanır; biten haftanın son sıralaması saklanır, ilk sıralara sabit ve önceden görünen ödül.
// =====================================================================

export type RankBoardId =
  /** oyuncu: güç (formül RANK_RULES.power), haftalık yıldız, haftalık nota, haftalık Günün Sorusu doğruları, haftalık yarış galibiyeti */
  | 'guc' | 'yildiz' | 'nota' | 'soru' | 'yaris'
  /** takım: güç, haftalık savaş puanı, bu haftaki baskın hasarı, haftalık Günün Sorusu doğruları */
  | 't-guc' | 't-savas' | 't-baskin' | 't-soru'
  /** takım ligi: bu sezonun lig puanı (docs/16-takim-rekabeti.md) */
  | 't-lig';
export type RankScope = 'herkes' | 'arkadas' | 'yakin';

export interface RankBoardDef { id: RankBoardId; team: boolean; weekly: boolean; name: string; unit: string; desc: string }
export const RANK_BOARDS: RankBoardDef[] = [
  { id: 'guc', team: false, weekly: false, name: 'Güç', unit: 'güç', desc: 'Yıldız, geçilen bölüm, kamp ve doğru cevaplardan hesaplanan toplam güç.' },
  { id: 'yildiz', team: false, weekly: true, name: 'Haftalık yıldız', unit: 'yıldız', desc: 'Bu hafta kazanılan YENİ yıldızlar (aynı bölümü tekrar oynamak yıldız saymaz).' },
  { id: 'nota', team: false, weekly: true, name: 'Haftalık nota', unit: 'nota', desc: 'Bu hafta bölümlerde toplanan notalar (günde en çok 2.000 sayılır).' },
  { id: 'soru', team: false, weekly: true, name: 'Günün Sorusu', unit: 'doğru', desc: 'Bu hafta açıklanan Günün Sorusu’nda doğru cevaplar (odyoloji tablosu).' },
  { id: 'yaris', team: false, weekly: true, name: 'Yarış galibiyeti', unit: 'galibiyet', desc: 'Bu hafta en az iki kişinin bitirdiği canlı yarışlarda birincilik (günde en çok 10).' },
  { id: 't-guc', team: true, weekly: false, name: 'Takım gücü', unit: 'güç', desc: 'Üyelerin güç toplamı + takım teknolojisi seviyeleri × 100.' },
  { id: 't-savas', team: true, weekly: true, name: 'Bölge Savaşı', unit: 'puan', desc: 'Bu haftaki Bölge Savaşı puanı.' },
  { id: 't-baskin', team: true, weekly: true, name: 'Baskın', unit: 'hasar', desc: 'Bu haftaki baskında Gürültü Canavarı’na verilen toplam hasar.' },
  { id: 't-soru', team: true, weekly: true, name: 'Bilgi', unit: 'doğru', desc: 'Üyelerin bu hafta Günün Sorusu’nda verdiği doğru cevaplar.' },
  { id: 't-lig', team: true, weekly: false, name: 'Takım Ligi', unit: 'lig puanı', desc: 'Bu sezon (2 hafta) kazanılan takım ligi puanı: Bölge Savaşı, Baskın, Bilgi, Düello ve Takım Yarışı.' },
];
export const rankBoardById = (id: string) => RANK_BOARDS.find((b) => b.id === id);

/** şeffaf kurallar (bilgi sayfasında aynen gösterilir) */
export const RANK_RULES = {
  /** oyuncu gücü = yıldız × 10 + geçilen bölüm × 20 + kamp binası seviyeleri toplamı × 15 + Günün Sorusu doğruları × 5 */
  power: { star: 10, level: 20, camp: 15, dq: 5 },
  teamTech: 100,
  top: 100, near: 5,
  notesPerDay: 2000, raceWinsPerDay: 10,
  /** haftalık ödül (ödül kutusu, bir kez): oyuncu tabloları ilk 10, takım tabloları ilk 3 (takımın her üyesine) */
  playerRewards: [
    { upTo: 1, reward: [{ kind: 'kristal' as const, amount: 50, ref: 'siralama' }] },
    { upTo: 2, reward: [{ kind: 'kristal' as const, amount: 30, ref: 'siralama' }] },
    { upTo: 3, reward: [{ kind: 'kristal' as const, amount: 20, ref: 'siralama' }] },
    { upTo: 10, reward: [{ kind: 'kristal' as const, amount: 10, ref: 'siralama' }] },
  ],
  teamRewards: [
    { upTo: 1, reward: [{ kind: 'kristal' as const, amount: 20, ref: 'siralama' }] },
    { upTo: 2, reward: [{ kind: 'kristal' as const, amount: 12, ref: 'siralama' }] },
    { upTo: 3, reward: [{ kind: 'kristal' as const, amount: 8, ref: 'siralama' }] },
  ],
} as const;

export interface RankRowView {
  rank: number; id: string; name: string; value: number;
  /** oyuncu: Odi rengi + şapka; takım: amblem */
  color?: number; hat?: string; emblem?: string; teamName?: string | null;
  /** gün başındaki sıraya göre değişim (+ yükseldi, − düştü; null: yeni ya da kayıt yok) */
  delta: number | null;
  me?: boolean;
  /** geçen haftanın rozeti: bu tabloda ilk 3'e girdiyse sırası */
  badge?: number;
}
export interface RankBoardView {
  board: RankBoardId; scope: RankScope; rows: RankRowView[];
  /** benim satırım (tabloda görünmese de sabitlenir) */
  me: RankRowView | null;
  total: number; week: string; endsAt: number | null;
  /** geçen haftanın son sıralaması (ilk 3) — haftalık tablolarda */
  last: { week: string; rows: RankRowView[] } | null;
  updatedAt: number;
}

export interface OpMap {
  'rank.board': { req: { board: RankBoardId; scope: RankScope }; res: { view: RankBoardView } };
}


// =====================================================================
// TAKIM REKABETİ (v5, docs/16-takim-rekabeti.md): Canlı Takım Yarışı ve Takım Ligi. Yalnızca EKLEME.
// Sahte takım / rakip yok: eşleşecek takım yoksa açıkça söylenir. Zamanlama ve sonuçlar sunucuda.
// =====================================================================

export type TeamRaceSideId = 'a' | 'b';
export type TeamRaceSize = 3 | 5;
/** yarış odasındaki bir takım (oda görünümünde) */
export interface TeamRaceSide { teamId: string; name: string; emblem: string; /** yarışa katılan üye sayısı */ n: number; /** denge çarpanı (az kişili takımın ham puanı bununla çarpılır) */ mult: number }
export interface TeamRaceInfo { matchId: string; size: TeamRaceSize; a: TeamRaceSide; b: TeamRaceSide; friendly: boolean }

/** şeffaf kurallar (bilgi sayfasında aynen gösterilir) */
export const TEAM_RACE_RULES = {
  sizes: [3, 5] as const,
  /** en az bu kadar hazır üye (az kişiyle de yarışılır; denge çarpanı) */
  minPlayers: 2,
  /** genel bitiş sırasına göre puan: 1. 10, 2. 8, 3. 6, 4. 5, 5. 4, 6. 3, 7. 2, 8+ 1 */
  placePoints: [10, 8, 6, 5, 4, 3, 2, 1] as const,
  /** bitirenin her yıldızı */
  starPoints: 2,
  /** eşleşme: güç farkı en çok %25 (ya da 300); her 20 sn'de genişler, 60 sn sonra her takım */
  powerWindowPct: 25, powerWindowMin: 300, widenMs: 20_000,
  /** arama en çok 3 dk sürer */
  searchMaxMs: 180_000,
  /** dostluk daveti 10 dk geçerli */
  challengeMs: 600_000,
  /** bağlantısı kopan oyuncu bu kadar süre içinde dönmezse bitiremedi sayılır */
  graceMs: 20_000,
  /** yıldızların gelmesi için yarış bitiminden sonra en çok bu kadar beklenir */
  starWaitMs: 15_000,
  /** takım başına günde en çok arama / dostluk daveti */
  searchesPerDay: 40, challengesPerDay: 10,
  /** ödül (ödül kutusu): kazanan takımın katılımcılarına; berabere; kaybeden takımda bitirenlere. Oyuncu başına günde en çok 5 ödüllü yarış */
  rewards: { win: { jeton: 60, kristal: 3 }, draw: { jeton: 30, kristal: 0 }, lose: { jeton: 20, kristal: 0 } },
  rewardRacesPerDay: 5,
  /** takım ligi puanı (takım başına günde en çok 10 yarış sayılır) */
  league: { win: 20, draw: 8, lose: 4 }, leagueRacesPerDay: 10,
} as const;

export type TeamRaceLobbyStatus = 'toplaniyor' | 'ariyor' | 'eslesti';
export interface TeamRaceMember { id: string; name: string; color: number; hat: string; ready: boolean; online: boolean }
export interface TeamRaceChallenge { teamId: string; name: string; emblem: string; size: TeamRaceSize; until: number }
export interface TeamRaceLobby {
  teamId: string; size: TeamRaceSize; status: TeamRaceLobbyStatus; openedBy: string; members: TeamRaceMember[];
  /** arama başladıysa */
  searchingSince: number | null;
  /** eşleşti: yarış odası */
  raceId: string | null;
  /** gelen dostluk davetleri / bizim gönderdiğimiz */
  incoming: TeamRaceChallenge[]; outgoing: TeamRaceChallenge | null;
  /** dürüst durum notu (ör. "Şu an arayan başka takım yok") */
  note: string | null;
}
export interface TeamRaceRow { id: string; name: string; color: number; hat: string; side: TeamRaceSideId; place: number | null; timeSec: number | null; stars: number; points: number; left: boolean }
export interface TeamRaceSideResult extends TeamRaceSide { raw: number; score: number }
export interface TeamRaceResult {
  matchId: string; size: TeamRaceSize; level: number; friendly: boolean; a: TeamRaceSideResult; b: TeamRaceSideResult;
  winner: TeamRaceSideId | null; rows: TeamRaceRow[]; endedAt: number;
  /** bu sonuç takım ligine sayıldı mı (günlük sınır) */
  counted: boolean;
}
export interface TeamRaceState {
  lobby: TeamRaceLobby | null;
  /** takımımızın süren yarışı */
  live: RaceRoom | null;
  /** son sonuçlar (en yeni önce) */
  recent: TeamRaceResult[];
  /** şu an arayan diğer takım sayısı (dürüst bilgi) */
  searching: number;
  /** ben açabilir / arayabilir miyim (lider/yardımcı) */
  canLead: boolean;
}

// ---------- Takım Ligi (2 haftalık sezon, kademeli gruplar)
export type TeamLeagueTier = 'bronz' | 'gumus' | 'altin' | 'platin' | 'koklea';
export const TEAM_LEAGUE_TIERS: { id: TeamLeagueTier; name: string; color: number }[] = [
  { id: 'bronz', name: 'Bronz', color: 0xe0a06a }, { id: 'gumus', name: 'Gümüş', color: 0xc9cfe0 }, { id: 'altin', name: 'Altın', color: 0xffc93c },
  { id: 'platin', name: 'Platin', color: 0x8fe3ff }, { id: 'koklea', name: 'Koklea', color: 0xff8fd8 },
];
export const TEAM_LEAGUE_RULES = {
  seasonWeeks: 2, groupSize: 15,
  /** grupta en az 6 takım varsa ilk 3 yükselir, son 3 düşer; daha küçük grupta üçte biri (en az 1, puanı 0 olan yükselmez) */
  promote: 3, demote: 3,
  /** kaynaklar (sezon içinde, sunucu kayıtlarından): haftalık üst sınırlarla */
  sources: {
    war: { per: 100, capWeek: 60, label: 'Bölge Savaşı', desc: 'her 100 savaş puanı 1 (haftada en çok 60)' },
    raid: { per: 200, capWeek: 40, label: 'Baskın', desc: 'her 200 hasar 1 (haftada en çok 40)' },
    quiz: { per: 1, capWeek: 30, label: 'Bilgi', desc: 'Günün Sorusu’nda her doğru 1 (haftada en çok 30)' },
    duel: { win: 40, draw: 15, lose: 5, label: 'Düello', desc: 'kazanma 40, beraberlik 15, kayıp 5' },
    race: { label: 'Takım Yarışı', desc: 'kazanma 20, beraberlik 8, kayıp 4 (günde en çok 10 yarış)' },
  },
  /** sezon ödülü (üye başına, bir kez): kademe tabanı × (1. 3, 2. 2, 3. 1.5, diğer puanı olan 1) kristal */
  rewardBase: { bronz: 5, gumus: 8, altin: 12, platin: 16, koklea: 20 },
} as const;
export interface TeamLeagueRow { rank: number; teamId: string; name: string; emblem: string; points: number; me?: boolean }
export interface TeamLeagueBreakdown { war: number; raid: number; quiz: number; duel: number; race: number; total: number }
export interface TeamLeagueHistory { season: string; no: number; tier: TeamLeagueTier; rank: number; groupSize: number; outcome: 'yukseldi' | 'kaldi' | 'dustu'; points: number }
export interface TeamLeagueState {
  season: { key: string; no: number; startsAt: number; endsAt: number };
  tier: TeamLeagueTier; groupId: string; rows: TeamLeagueRow[]; mine: TeamLeagueBreakdown;
  promoteTop: number; demoteBottom: number; history: TeamLeagueHistory[];
  /** son sezonun rozeti (amblem çerçevesi) */
  badge: { tier: TeamLeagueTier; no: number; rank: number } | null;
}

export interface OpMap {
  'trace.state': { req: Record<string, never>; res: { state: TeamRaceState } };
  'trace.open': { req: { size: TeamRaceSize }; res: { lobby: TeamRaceLobby } };
  'trace.join': { req: Record<string, never>; res: { lobby: TeamRaceLobby } };
  'trace.leave': { req: Record<string, never>; res: { lobby: TeamRaceLobby | null } };
  'trace.ready': { req: { ready: boolean }; res: { lobby: TeamRaceLobby } };
  'trace.search': { req: { on: boolean }; res: { lobby: TeamRaceLobby } };
  'trace.close': { req: Record<string, never>; res: Record<string, never> };
  'trace.challenge': { req: { teamId: string }; res: { lobby: TeamRaceLobby } };
  'trace.accept': { req: { teamId: string }; res: { lobby: TeamRaceLobby } };
  'trace.decline': { req: { teamId: string }; res: { lobby: TeamRaceLobby | null } };
  'trace.rematch': { req: { matchId: string }; res: { lobby: TeamRaceLobby } };
  'trace.result': { req: { matchId: string }; res: { result: TeamRaceResult | null } };
  'trace.react': { req: { emoji: string }; res: Record<string, never> };
  'tlig.state': { req: Record<string, never>; res: { state: TeamLeagueState } };
}
export interface EvtMap {
  'trace.updated': { lobby: TeamRaceLobby | null };
  'trace.matched': { room: RaceRoom };
  'trace.result': { result: TeamRaceResult };
  'trace.reaction': { from: string; name: string; emoji: string; side: TeamRaceSideId };
  'trace.challenged': { challenge: TeamRaceChallenge };
}
/** yarış içi hızlı tepkiler (takım arkadaşlarına) */
export const TEAM_RACE_REACTIONS = ['🔥', '💪', '👏', '🏁', '😅'] as const;
