/**
 * Hesaba ve takıma bağlı veri: TEK sınıflandırma tablosu (YN-029; KVKK m.7 / GDPR m.17 silme hakkı, mağaza "hesap silme" şartı).
 *
 * Şemadaki her tablo burada bir kez yer alır; oyuncu ya da takım kimliği taşıyan her sütun için karar yazılıdır:
 * - **sil**: satır fiziksel olarak silinir.
 * - **anonim**: satır başkasının verisini bozmamak için kalır (ör. takımın toplam puanı satırların toplamı). Kimlik, artık hiçbir
 *   anahtarla eşleşmeyen anonim oyuncu satırına ("Silinmiş Oyuncu") işaret eder; ad kopyaları ve kişisel alanlar silinir.
 * - **tut**: gerekçe ve süre yazılıdır (makbuz, moderasyon, rakip takımın geçmişi …).
 *
 * `account.ts` (hesap silme), `teams.ts` (takım silme) ve göç (`migrations.ts`, önceden silinmiş hesapların artıkları) bu tabloyla
 * çalışır. `test/account.test.ts` şemayı `sqlite_master`'dan okur: tabloda olmayan bir tablo ya da kimlik benzeri sütun (`*_id`,
 * `*_by`, `a`/`b`, `*name` …) eklenirse test düşer; yeni tablo ekleyen karar vermek zorunda kalır. Gizlilik taslağındaki saklama
 * tablosu (apps/web/src/yasal/metin.ts §3 ve docs/yonetim/gizlilik.md) bu dosyaya göre yazılır.
 */
import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DELETED_PLAYER_NAME } from '@odi/shared';

type Deger = string | number | null;
export type Karar = 'sil' | 'anonim' | 'tut';
export interface Kural {
  karar: Karar;
  /** anonim / tut için gerekçe (zorunlu) */
  neden?: string;
  /** tut: ne kadar süre */
  sure?: string;
  /** satırları seçen koşul; varsayılan `<sütun> = ?`. Her `?` silinen kimlikle doldurulur. */
  kosul?: string;
  /** anonim / tut: seçilen satırlarda değiştirilecek sütunlar (ad kopyası, kimlik yerine işaret …) */
  degistir?: Record<string, Deger>;
  /** anonim: satırdaki JSON içinde kimliğin ad kopyasını siler (ör. yarış odası oyuncu listesi) */
  jsonOyuncular?: string;
}
export interface Bagli {
  tur: 'oyuncu' | 'takim';
  /** bu tablodaki sütun … */
  sutun: string;
  /** … silinen satırların kimliklerinden biriyse satır silinir (alt sorgu; her `?` silinen kimlik) */
  kaynak: string;
}
export interface Tablo {
  /** oyuncu silinince (hesap silme) */
  oyuncu?: Record<string, Kural>;
  /** takım silinince (son üye ayrılınca) */
  takim?: Record<string, Kural>;
  /** başka tablodan silinen satırlara bağlı satırlar (önce bunlar silinir) */
  bagli?: Bagli[];
  /** ad kopyası sütunu → hangi kimliğin adı */
  adKopyasi?: Record<string, string>;
  /** serbest metinde silinen oyuncunun adı geçebilir: tam sözcük olarak "Silinmiş Oyuncu" yapılır (oyuncu kurulduktan sonraki satırlar) */
  metinAd?: { sutun: string; kosul?: string; zaman: string }[];
  /** kimlik gibi görünen ama oyuncu/takım kimliği olmayan sütunlar (açık karar) */
  degil?: string[];
  /** tablo kimlik taşımıyorsa ya da ek açıklama */
  not?: string;
}

const SIL: Kural = { karar: 'sil' };
const sil = (kosul?: string): Kural => (kosul ? { karar: 'sil', kosul } : SIL);
const SILINMIS = DELETED_PLAYER_NAME;

/** silinen oyuncunun sohbet satırları: kendi yazdıkları + onun hakkındaki kartlar (Takım Akışı, yardım, meydan okuma; meta.pid) */
const OYUNCU_SOHBET = `SELECT id FROM chat WHERE from_id = ? OR instr(meta, '"pid":"' || ? || '"') > 0`;
const TAKIM_SOHBET = `SELECT id FROM chat WHERE room = 'takim:' || ?`;

/** moderasyon kayıtlarının silinen hesaptan sonra saklanma süresi (pruneDeletedReports) */
export const REPORT_RETAIN_AFTER_DELETE_MS = 90 * 24 * 3_600_000;
/** şikâyet kayıtlarının saklanma süresi (pruneReports; gizlilik metni §3) */
export const REPORT_RETAIN_MS = 90 * 24 * 3_600_000;
/** satın alma kayıtlarının saklanma süresi: işlem yılının sonundan başlayarak (prunePurchases; VUK m.253, TTK m.82) */
export const PURCHASE_RETAIN_YEARS = 10;

const ANONIM_TAKIM_TOPLAMI = 'Takımın toplamı bu satırların toplamı; silinirse takım arkadaşlarının puanı düşer. Kimlik anonim oyuncu satırına işaret eder.';
const RAKIP_GECMISI = 'Rakip takımın geçmişi (düello/yarış/lig kaydı); kişisel veri yok, yalnız takım kimliği.';

export const VERI_SINIFI: Record<string, Tablo> = {
  // ------------------------------------------------------------------ kimlik ve sistem
  players: {
    oyuncu: { id: { karar: 'anonim', neden: 'Geçmiş takım kayıtları (düello puanı, yarış yıldızı, rozet) bu kimliğe bağlı; satır anonimleşir: ad "Silinmiş Oyuncu", anahtar özeti hiçbir anahtarla eşleşmez, arkadaş kodu yenilenir, ilerleme/cüzdan/kozmetik sıfırlanır (account.ts).' } },
    takim: { team_id: { karar: 'tut', neden: 'Takım yalnız son üye ayrılınca silinir; o anda bu sütun hiçbir satırda takımı göstermez.', sure: 'yok (sütun o anda boş)' } },
    adKopyasi: { name: 'id' },
  },
  deleted_players: {
    oyuncu: { player_id: { karar: 'tut', neden: 'Tasarım gereği: silinen hesabı sıralama, arama ve /saglik dışında tutar; ad ya da iletişim yok.', sure: 'süresiz' } },
  },
  meta: { not: 'Sunucu anahtar–değer kayıtları (hafta, sezon kapanışı); oyuncu kimliği yok.' },
  sqlite_sequence: { degil: ['name'], not: 'SQLite iç tablosu (AUTOINCREMENT sayaçları); name tablo adıdır.' },
  player_flags: { oyuncu: { player_id: SIL } },
  promo_codes: {
    oyuncu: { created_by: { karar: 'tut', neden: 'Yönetim denetimi: kodu kimin oluşturduğu. Yalnız yönetici hesapları; kimlik anonim satıra işaret eder.', sure: 'kod durdukça' } },
  },
  promo_log: {
    oyuncu: { player_id: { karar: 'tut', neden: 'Güvenlik kaydı (kod deneme sınırı, kötüye kullanım; IP ile).', sure: '90 gün, sonra otomatik silinir (prunePromoLog)' } },
  },
  promo_uses: { oyuncu: { player_id: SIL } },
  player_badges: { oyuncu: { player_id: SIL }, not: 'Kalıcı rozetler (YN-041, rozet.ts): Kurucu Yolcu, Hata Avcısı; listede (Kurucular ekranı) ve çerçeve oyuncunun seçimi. Hesap silinince rozet ve liste kaydı silinir.' },
  purchases: {
    oyuncu: { player_id: { karar: 'tut', neden: 'Satın alma makbuzu: yasal saklama (ticari defter/vergi) ve aynı makbuzun ikinci kez kullanılmasını önleme. Oyuncu kimliği yerine "silinmis" işareti yazılır.', sure: '10 yıl, işlem yılının sonundan başlayarak (VUK m.253, TTK m.82), sonra otomatik silinir (prunePurchases)', degistir: { player_id: 'silinmis' } } },
    degil: ['id', 'product_id'],
  },

  // ------------------------------------------------------------------ ilerleme, cüzdan, kamp
  level_best: { oyuncu: { player_id: SIL } },
  level_koklea: { oyuncu: { player_id: SIL } },
  play_days: { oyuncu: { player_id: SIL } },
  progress_runs: { oyuncu: { player_id: SIL }, degil: ['run_id'] },
  local_grants: { oyuncu: { player_id: SIL }, degil: ['ledger_id'] },
  daily: { oyuncu: { player_id: SIL } },
  inbox: {
    oyuncu: { player_id: SIL },
    metinAd: [{ sutun: 'reason', zaman: 'at' }],
    degil: ['id'],
  },
  player_skills: { oyuncu: { player_id: SIL }, degil: ['skill_id'] },
  buildings: { oyuncu: { player_id: SIL }, degil: ['id'] },
  camp_queue: { oyuncu: { player_id: SIL }, degil: ['id'] },
  camp_helps: { oyuncu: { player_id: SIL, helper_id: SIL } },
  camp_unlocks: { oyuncu: { player_id: SIL } },
  camp_xp: { oyuncu: { player_id: SIL } },
  camp_xp_log: { oyuncu: { player_id: SIL } },
  camp_cheers: { oyuncu: { from_id: SIL, to_id: SIL } },
  decor_inv: { oyuncu: { player_id: SIL }, degil: ['id'] },
  decor_placed: { oyuncu: { player_id: SIL }, degil: ['id'] },
  remedy_inv: { oyuncu: { player_id: SIL }, degil: ['id'] },
  remedy_prod: { oyuncu: { player_id: SIL } },
  remedy_use: { oyuncu: { player_id: SIL }, degil: ['run_id'] },
  // Kamp Görevleri, Hasta Vakaları, kamp oyunları
  kg_count: { oyuncu: { player_id: SIL } },
  kg_seen: { oyuncu: { player_id: SIL } },
  kg_claim: { oyuncu: { player_id: SIL } },
  kg_daily: { oyuncu: { player_id: SIL } },
  kg_story_base: { oyuncu: { player_id: SIL } },
  kg_week: { oyuncu: { player_id: SIL } },
  kg_pending: { oyuncu: { player_id: SIL } },
  kv_book: { oyuncu: { player_id: SIL }, degil: ['case_id'] },
  kv_queue: { oyuncu: { player_id: SIL }, degil: ['case_id'] },
  kv_attempt: { oyuncu: { player_id: SIL }, degil: ['case_id'] },
  kv_konsult: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, degil: ['msg_id', 'case_id'] },
  kv_oy: {
    oyuncu: { player_id: SIL },
    bagli: [
      { tur: 'oyuncu', sutun: 'msg_id', kaynak: 'SELECT msg_id FROM kv_konsult WHERE player_id = ?' },
      { tur: 'takim', sutun: 'msg_id', kaynak: 'SELECT msg_id FROM kv_konsult WHERE team_id = ?' },
    ],
    degil: ['msg_id'],
  },
  kv_team_week: {
    oyuncu: { player_id: { karar: 'anonim', neden: `Takım kliniği haftalık ilerlemesi: ${ANONIM_TAKIM_TOPLAMI}` } },
    takim: { team_id: SIL },
  },
  ko_round: { oyuncu: { player_id: SIL }, degil: ['id'] },
  ko_items: {
    bagli: [{ tur: 'oyuncu', sutun: 'round_id', kaynak: 'SELECT id FROM ko_round WHERE player_id = ?' }],
    degil: ['round_id'],
  },
  ko_deck: { oyuncu: { player_id: SIL } },

  // ------------------------------------------------------------------ sosyal: arkadaş, engel, özel mesaj, sohbet
  friends: { oyuncu: { a: SIL, b: SIL } },
  friend_requests: { oyuncu: { from_id: SIL, to_id: SIL }, degil: ['id'] },
  friend_gifts: { oyuncu: { from_id: SIL, to_id: SIL } },
  blocks: { oyuncu: { a: SIL, b: SIL } },
  dm: { oyuncu: { from_id: SIL, to_id: SIL }, degil: ['id', 'pair'] },
  dm_reactions: {
    oyuncu: { player_id: SIL },
    bagli: [{ tur: 'oyuncu', sutun: 'msg_id', kaynak: 'SELECT id FROM dm WHERE from_id = ? OR to_id = ?' }],
    degil: ['msg_id'],
  },
  dm_reads: { oyuncu: { player_id: SIL, other_id: SIL } },
  chat: {
    oyuncu: {
      from_id: SIL,
      meta: sil(`instr(meta, '"pid":"' || ? || '"') > 0`),
    },
    takim: { room: sil(`room = 'takim:' || ?`) },
    adKopyasi: { name: 'from_id' },
    metinAd: [{ sutun: 'text', kosul: "from_id = 'sistem'", zaman: 'at' }],
    degil: ['id'],
    not: 'Başka oyuncuların yazdığı metinlere dokunulmaz (onların içeriği); sohbet 30 günde silinir (pruneChat).',
  },
  chat_cid: { oyuncu: { player_id: SIL }, degil: ['msg_id'] },
  chat_reactions: {
    oyuncu: { player_id: SIL },
    bagli: [
      { tur: 'oyuncu', sutun: 'msg_id', kaynak: OYUNCU_SOHBET },
      { tur: 'takim', sutun: 'msg_id', kaynak: TAKIM_SOHBET },
    ],
    degil: ['msg_id'],
  },
  chat_thread: {
    bagli: [
      { tur: 'oyuncu', sutun: 'msg_id', kaynak: OYUNCU_SOHBET },
      { tur: 'oyuncu', sutun: 'parent_id', kaynak: OYUNCU_SOHBET },
      { tur: 'takim', sutun: 'msg_id', kaynak: TAKIM_SOHBET },
    ],
    degil: ['msg_id', 'parent_id'],
  },
  chat_reports: {
    oyuncu: { reporter: { karar: 'tut', neden: 'Moderasyon: başka oyuncunun iletisi hakkındaki şikâyet (gizleme eşiği, kötüye kullanım incelemesi).', sure: 'şikâyetten 90 gün sonra otomatik silinir (pruneReports; silinen hesapta da en çok 90 gün)' } },
    bagli: [{ tur: 'oyuncu', sutun: 'msg_id', kaynak: OYUNCU_SOHBET }],
    degil: ['msg_id'],
    not: 'Silinen oyuncunun iletileri hakkındaki şikâyetler ileti silindiği için anlamsız kalır: silinir.',
  },
  player_reports: {
    oyuncu: {
      target: { karar: 'tut', neden: 'Moderasyon: şikâyet edilen hesabın kaydı (kötüye kullanım incelemesi, hukuki talep).', sure: 'şikâyetten 90 gün sonra otomatik silinir (pruneReports; silinen hesapta da en çok 90 gün)' },
      reporter: { karar: 'tut', neden: 'Moderasyon: başka oyuncu hakkındaki şikâyet (otomatik susturma eşiği).', sure: 'şikâyetten 90 gün sonra otomatik silinir (pruneReports; silinen hesapta da en çok 90 gün)' },
    },
    degil: ['msg_id'],
  },
  comm_settings: { oyuncu: { player_id: SIL } },
  comm_metrics: { not: 'Günlük toplam sayaçlar (ör. hazır söz sayısı); oyuncu kimliği yok.' },
  feedback: { degil: ['id'], not: 'Beta geri bildirimi (geribildirim.ts): konu, temizlenmiş metin (e-posta, telefon, uzun rakam dizisi çıkarılır), ekran, sürüm, derleme, platform, dakikaya yuvarlı zaman; oyuncu kimliği, takma ad, IP yok, hesapla eşleştirilemez. 90 günde silinir (pruneFeedback). id yalnız satır sırası.' },
  crash_reports: { not: 'Çökme raporları (YN-011, hata.ts): hata adı, temizlenmiş ileti, yığın, sürüm, platform, ekran, sayaç; oyuncu kimliği, takma ad, IP yok. 30 günde silinir (pruneCrashes).' },
  feed_recent: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, degil: ['msg_id'] },
  challenges: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, degil: ['msg_id'] },
  challenge_beats: {
    oyuncu: { player_id: SIL },
    bagli: [
      { tur: 'oyuncu', sutun: 'msg_id', kaynak: 'SELECT msg_id FROM challenges WHERE player_id = ?' },
      { tur: 'takim', sutun: 'msg_id', kaynak: 'SELECT msg_id FROM challenges WHERE team_id = ?' },
    ],
    degil: ['msg_id'],
  },
  help_requests: { oyuncu: { from_id: SIL }, takim: { team_id: SIL }, degil: ['id'] },
  help_cards: {
    bagli: [
      { tur: 'oyuncu', sutun: 'request_id', kaynak: 'SELECT id FROM help_requests WHERE from_id = ?' },
      { tur: 'takim', sutun: 'request_id', kaynak: 'SELECT id FROM help_requests WHERE team_id = ?' },
    ],
    degil: ['request_id', 'msg_id'],
  },
  help_actions: {
    oyuncu: { helper_id: SIL },
    bagli: [
      { tur: 'oyuncu', sutun: 'request_id', kaynak: 'SELECT id FROM help_requests WHERE from_id = ?' },
      { tur: 'takim', sutun: 'request_id', kaynak: 'SELECT id FROM help_requests WHERE team_id = ?' },
    ],
    degil: ['request_id'],
  },
  help_resolved: {
    bagli: [
      { tur: 'oyuncu', sutun: 'request_id', kaynak: 'SELECT id FROM help_requests WHERE from_id = ?' },
      { tur: 'takim', sutun: 'request_id', kaynak: 'SELECT id FROM help_requests WHERE team_id = ?' },
    ],
    degil: ['request_id'],
  },
  dq: { takim: { team_id: SIL }, degil: ['msg_id'] },
  dq_answers: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, not: 'Takım ligi ve sıralama silinen hesapları zaten saymaz (ADMIN_IDS_SQL).' },
  dq_rewards: { oyuncu: { player_id: SIL } },
  team_comm: { takim: { team_id: SIL } },
  duo: { oyuncu: { a: SIL, b: SIL }, degil: ['id'], not: 'Ortak bu haftanın İkili Görevinden çıkar; yeni ortak seçebilir.' },
  duo_invites: { oyuncu: { from_id: SIL, to_id: SIL }, degil: ['id'] },
  duo_notes: {
    oyuncu: { player_id: SIL },
    bagli: [{ tur: 'oyuncu', sutun: 'duo_id', kaynak: 'SELECT id FROM duo WHERE a = ? OR b = ?' }],
    degil: ['duo_id'],
  },
  duo_tiers: {
    bagli: [{ tur: 'oyuncu', sutun: 'duo_id', kaynak: 'SELECT id FROM duo WHERE a = ? OR b = ?' }],
    degil: ['duo_id'],
  },
  mentor_links: { oyuncu: { mentor: SIL, apprentice: SIL }, degil: ['id'], not: 'Çırak ustasız kalır, yeni usta seçebilir.' },
  mentor_offers: { oyuncu: { mentor: SIL, apprentice: SIL, by_id: SIL }, degil: ['id'] },
  mentor_milestones: {
    oyuncu: {
      apprentice: SIL,
      mentor: { karar: 'anonim', neden: 'Çırağın dönüm noktası ödülü bir kez verilir (başka ustayla yeniden kazanılmaz); satır silinirse kural delinir.' },
    },
    degil: ['link_id'],
  },

  // ------------------------------------------------------------------ takım
  teams: { takim: { id: SIL }, adKopyasi: { name: 'id' } },
  team_apps: {
    oyuncu: {
      player_id: SIL,
      decided_by: { karar: 'anonim', neden: 'Başvuranın kaydı (kabul/ret kararı ve bekleme süresi); karar veren anonim satıra işaret eder.' },
    },
    takim: { team_id: { karar: 'tut', neden: 'Başvuranın kendi kaydı ("takım dağıldı" iptali, bildirim); takım adı kişisel veri değil.', sure: 'başvuran hesabını silene kadar' } },
    adKopyasi: { team_name: 'team_id' },
    degil: ['id'],
  },
  team_tech: { takim: { team_id: SIL } },
  team_week: { takim: { team_id: SIL } },
  team_gifts: {
    oyuncu: { from_id: { karar: 'anonim', neden: 'Takım arkadaşlarının alacağı hediye; gönderenin adı silinir.', degistir: { from_name: SILINMIS } } },
    takim: { team_id: SIL },
    adKopyasi: { from_name: 'from_id' },
    metinAd: [{ sutun: 'reason', zaman: 'at' }],
    degil: ['id'],
  },
  gift_recipients: {
    oyuncu: { player_id: SIL },
    bagli: [{ tur: 'takim', sutun: 'gift_id', kaynak: 'SELECT id FROM team_gifts WHERE team_id = ?' }],
    degil: ['gift_id'],
  },
  contrib: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, not: 'Takım listesi yalnız şimdiki üyeleri gösterir; takım XP\'si teams.xp\'de.' },
  goal_progress: { takim: { team_id: SIL } },
  war_points: { takim: { team_id: { karar: 'tut', neden: 'Bu haftanın satırı teams.ts deleteTeam\'de silinir (harita yeniden hesaplanır); geçmiş haftalar bölge sonucudur (diğer takımların sonucu bunlara göre).', sure: 'süresiz (kişisel veri yok)' } } },
  war_owner: { takim: { team_id: { karar: 'tut', neden: 'Bu haftanın satırı deleteTeam\'de silinir; geçmiş haftaların bölge sahibi diğer takımların geçmişidir.', sure: 'süresiz (kişisel veri yok)' } } },
  player_week: { oyuncu: { player_id: SIL }, not: 'Takımın savaş puanı war_points\'te ayrı tutulur.' },
  raids: { takim: { team_id: SIL }, degil: ['raid_id'] },
  raid_damage: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, degil: ['raid_id'], not: 'Takım ligi ve baskın sıralaması silinen hesapları zaten saymaz (ADMIN_IDS_SQL); can raids.hp\'de.' },
  league_groups: { degil: ['id'], not: 'Lig grubu; kimlik yok.' },
  league: { oyuncu: { player_id: SIL }, degil: ['group_id'], not: 'Bütün haftalar silinir (geçmiş haftalar yalnız hafta kapanışında okunur).' },
  league_level_runs: { oyuncu: { player_id: SIL }, not: 'Lig puanı tekrar sınırı sayacı (karar 26, league.ts): bu haftanın bölüm başına tam puanlı bitiriş sayısı; hafta kapanışında eski haftalar silinir.' },

  // ------------------------------------------------------------------ sıralama
  rank_level: { oyuncu: { player_id: SIL } },
  rank_week: { oyuncu: { player_id: SIL } },
  rank_day: { oyuncu: { player_id: SIL } },
  rank_snap: { oyuncu: { id: SIL }, takim: { id: SIL } },
  rank_final: {
    oyuncu: { id: { karar: 'anonim', neden: 'Geçen haftanın son sıralaması (başka oyuncuların sırası ve rozeti); ad ve şapka silinir.', degistir: { name: SILINMIS, hat: '' } } },
    takim: { id: { karar: 'tut', neden: 'Geçen haftanın takım sıralaması (diğer takımların sırası); takım adı kişisel veri değil.', sure: 'süresiz' } },
    adKopyasi: { name: 'id' },
  },
  rank_rewards: { oyuncu: { player_id: SIL } },

  // ------------------------------------------------------------------ etkinlikler
  ev_done: { not: 'Dönem kapanış işareti; kimlik yok.' },
  ev_rally: {
    oyuncu: { starter: { karar: 'anonim', neden: 'Takımın rallisi; başlatanın adı silinir.', degistir: { starter_name: SILINMIS } } },
    takim: { team_id: SIL },
    adKopyasi: { starter_name: 'starter' },
    degil: ['id'],
  },
  ev_rally_part: {
    oyuncu: { player_id: { karar: 'anonim', neden: 'Rallinin katılımcı sayısı (en az katılımcı şartı) ve takımın ödülü bu satırlara bağlı.' } },
    bagli: [{ tur: 'takim', sutun: 'rally_id', kaynak: 'SELECT id FROM ev_rally WHERE team_id = ?' }],
    degil: ['rally_id'],
  },
  ev_rally_hit: {
    oyuncu: { player_id: SIL },
    bagli: [{ tur: 'takim', sutun: 'rally_id', kaynak: 'SELECT id FROM ev_rally WHERE team_id = ?' }],
    degil: ['run_id', 'rally_id'],
  },
  ev_duel: { takim: { team_id: SIL, rival_id: { karar: 'tut', neden: `${RAKIP_GECMISI} Dağılan takımın puanı silindiği için düello rakip lehine kapanır.`, sure: 'süresiz' } } },
  ev_duel_pts: { oyuncu: { player_id: { karar: 'anonim', neden: `Düello puanı: ${ANONIM_TAKIM_TOPLAMI}` } }, takim: { team_id: SIL } },
  ev_relay: {
    oyuncu: {
      carrier: { karar: 'anonim', neden: 'Takımın bayrak durumu; bayrak silinen hesapta kalmasın diye boşaltılır.', degistir: { carrier: null, carrier_at: null } },
      last_runner: { karar: 'anonim', neden: 'Takımın bayrak durumu; son koşan boşaltılır.', degistir: { last_runner: null } },
    },
    takim: { team_id: SIL },
  },
  ev_relay_leg: {
    oyuncu: {
      best_by: { karar: 'anonim', neden: 'Takımın ayak rekoru; rekor sahibi "Silinmiş Oyuncu" görünür.' },
      first_by: { karar: 'anonim', neden: 'Takımın ayak geçmişi (ilk koşan).' },
    },
    takim: { team_id: SIL },
  },
  ev_relay_run: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, degil: ['run_id'] },
  ev_hunt: { takim: { team_id: SIL }, degil: ['target'] },
  ev_hunt_contrib: { oyuncu: { player_id: SIL }, takim: { team_id: SIL }, not: 'Takımın ilerlemesi ev_hunt.progress\'te ayrı tutulur.' },
  ev_quiz: {
    oyuncu: { started_by: { karar: 'anonim', neden: 'Takımın yarışması; başlatan anonim satıra işaret eder.' } },
    takim: { team_id: SIL },
    degil: ['id'],
  },
  ev_quiz_player: {
    oyuncu: { player_id: SIL },
    bagli: [{ tur: 'takim', sutun: 'quiz_id', kaynak: 'SELECT id FROM ev_quiz WHERE team_id = ?' }],
    degil: ['quiz_id'],
  },
  ev_tquest: { takim: { team_id: SIL } },
  ev_tquest_prog: { takim: { team_id: SIL } },
  ev_tquest_member: { oyuncu: { player_id: SIL }, takim: { team_id: SIL } },
  ev_challenge: { oyuncu: { player_id: SIL } },
  ev_challenge_run: { oyuncu: { player_id: SIL }, degil: ['run_id'] },
  ev_tourney_group: { degil: ['id'], not: 'Turnuva grubu; kimlik yok.' },
  ev_tourney: { oyuncu: { player_id: SIL }, degil: ['group_id'] },
  ev_tourney_best: { oyuncu: { player_id: SIL } },
  ev_tourney_run: { oyuncu: { player_id: SIL }, degil: ['run_id'] },

  // ------------------------------------------------------------------ takım rekabeti
  tl_team: { takim: { team_id: SIL } },
  tl_group: { degil: ['id'], not: 'Takım ligi grubu; kimlik yok.' },
  tl_member: { takim: { team_id: SIL }, degil: ['group_id'] },
  tl_history: { takim: { team_id: SIL } },
  tl_rewards: { oyuncu: { player_id: SIL }, takim: { team_id: SIL } },
  tl_race: { takim: { team_id: SIL, rival_id: { karar: 'tut', neden: RAKIP_GECMISI, sure: 'süresiz' } }, degil: ['match_id'] },
  race_room: {
    oyuncu: { data: { karar: 'anonim', neden: 'Başlamış canlı yarış odası (MK-031: sunucu yarış sürerken yeniden başlarsa yarış sürsün). Öbür yarışçıların derecesi bozulmasın diye satır kalır; oda kaydındaki oyuncu adı ve şapkası silinir. Satır yarış bitince en geç 10 dk sonra silinir.', kosul: `instr(data, '"id":"' || ? || '"') > 0`, jsonOyuncular: 'data' } },
    degil: ['id'],
  },
  tr_match: {
    oyuncu: { room: { karar: 'anonim', neden: 'Takım yarışının sonucu (iki takımın geçmişi); oda kaydındaki oyuncu adı ve şapkası silinir.', kosul: `instr(room, '"id":"' || ? || '"') > 0`, jsonOyuncular: 'room' } },
    takim: {
      team_a: { karar: 'tut', neden: RAKIP_GECMISI, sure: 'süresiz' },
      team_b: { karar: 'tut', neden: RAKIP_GECMISI, sure: 'süresiz' },
    },
    degil: ['id', 'race_id'],
  },
  tr_star: { oyuncu: { player_id: { karar: 'anonim', neden: `Takım yarışı sonucu: ${ANONIM_TAKIM_TOPLAMI}` } }, degil: ['match_id'] },
};

// ------------------------------------------------------------------ uygulama

/** Db ya da ham DatabaseSync üstünde en az arayüz (göç ham bağlantıyla çalışır) */
export interface Sorgu {
  run(sql: string, ...p: Deger[]): number;
  all<T>(sql: string, ...p: Deger[]): T[];
}

const soru = (sql: string) => (sql.match(/\?/g) ?? []).length;
const kosulOf = (sutun: string, k: Kural) => k.kosul ?? `${sutun} = ?`;

/** şemada olan tablolar ve sütunları (göç, sonradan eklenecek sütunları henüz görmeyebilir); bağlantı başına bir kez okunur */
const semaOnbellek = new WeakMap<object, Map<string, Set<string>>>();
function sema(db: Sorgu): Map<string, Set<string>> {
  const hazir = semaOnbellek.get(db);
  if (hazir) return hazir;
  const m = new Map<string, Set<string>>();
  semaOnbellek.set(db, m);
  for (const t of db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")) {
    m.set(t.name, new Set(db.all<{ name: string }>(`PRAGMA table_info(${t.name})`).map((c) => c.name)));
  }
  return m;
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export interface TemizleSecenek {
  /** oyuncunun (silinmeden önceki) adı: serbest metinlerde geçen kopyaları silinir */
  ad?: string;
  /** oyuncunun kuruluş anı: metin taraması yalnız bundan sonraki satırlara bakar */
  createdAt?: number;
}

/**
 * Bir oyuncunun ya da takımın verisini sınıflandırmaya göre temizler. Çağıran tek işlem (BEGIN … COMMIT) içinde çağırır.
 * Sıra: bağlı satırlar (kaynakları silinmeden önce) → anonimleştirme / işaret → serbest metindeki ad → silme.
 */
export function veriyiTemizle(db: Sorgu, tur: 'oyuncu' | 'takim', id: string, o: TemizleSecenek = {}): void {
  const s = sema(db);
  const has = (t: string, c: string) => !!s.get(t)?.has(c);
  // 1) bağlı satırlar
  for (const [t, d] of Object.entries(VERI_SINIFI)) {
    for (const b of d.bagli ?? []) {
      if (b.tur !== tur || !has(t, b.sutun)) continue;
      db.run(`DELETE FROM ${t} WHERE ${b.sutun} IN (${b.kaynak})`, ...Array<string>(soru(b.kaynak)).fill(id));
    }
  }
  // 2) anonimleştirme ve işaretler
  for (const [t, d] of Object.entries(VERI_SINIFI)) {
    for (const [c, k] of Object.entries(d[tur] ?? {})) {
      if (k.karar === 'sil' || !has(t, c)) continue;
      const where = kosulOf(c, k); const args = Array<string>(soru(where)).fill(id);
      if (k.degistir) {
        const cols = Object.keys(k.degistir).filter((x) => has(t, x));
        if (cols.length) db.run(`UPDATE ${t} SET ${cols.map((x) => `${x} = ?`).join(', ')} WHERE ${where}`, ...cols.map((x) => k.degistir![x]!), ...args);
      }
      if (k.jsonOyuncular) anonimJson(db, t, k.jsonOyuncular, where, args, id);
    }
  }
  // 3) serbest metindeki ad (yalnız hesap silmede ve ad biliniyorsa)
  if (tur === 'oyuncu' && o.ad && o.ad !== SILINMIS) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(o.ad)}(?![\\p{L}\\p{N}_])`, 'gu');
    for (const [t, d] of Object.entries(VERI_SINIFI)) {
      for (const m of d.metinAd ?? []) {
        if (!has(t, m.sutun)) continue;
        const rows = db.all<{ r: number; v: string }>(`SELECT rowid AS r, ${m.sutun} AS v FROM ${t} WHERE instr(${m.sutun}, ?) > 0 AND ${m.zaman} >= ?${m.kosul ? ` AND ${m.kosul}` : ''}`, o.ad, o.createdAt ?? 0);
        for (const r of rows) {
          const nv = r.v.replace(re, SILINMIS);
          if (nv !== r.v) db.run(`UPDATE ${t} SET ${m.sutun} = ? WHERE rowid = ?`, nv, r.r);
        }
      }
    }
  }
  // 4) silme
  for (const [t, d] of Object.entries(VERI_SINIFI)) {
    for (const [c, k] of Object.entries(d[tur] ?? {})) {
      if (k.karar !== 'sil' || !has(t, c)) continue;
      const where = kosulOf(c, k);
      db.run(`DELETE FROM ${t} WHERE ${where}`, ...Array<string>(soru(where)).fill(id));
    }
  }
}

/** JSON sütunundaki `players` listesinde bu oyuncunun ad ve şapkasını siler (kimlik kalır: sonuç hesabı bozulmaz) */
function anonimJson(db: Sorgu, t: string, sutun: string, where: string, args: string[], id: string): void {
  for (const r of db.all<{ r: number; v: string | null }>(`SELECT rowid AS r, ${sutun} AS v FROM ${t} WHERE ${where}`, ...args)) {
    if (!r.v) continue;
    let o: { players?: { id: string; name?: string; hat?: string }[] };
    try { o = JSON.parse(r.v) as typeof o; } catch { continue; }
    if (!Array.isArray(o.players)) continue;
    let changed = false;
    for (const pl of o.players) if (pl.id === id) { pl.name = SILINMIS; pl.hat = ''; changed = true; }
    if (changed) db.run(`UPDATE ${t} SET ${sutun} = ? WHERE rowid = ?`, JSON.stringify(o), r.r);
  }
}

/** anonim oyuncu satırı: kimlik kalır, kişisel ve ilerleme alanları sıfırlanır (ad, anahtar, arkadaş kodu çağıran tarafından) */
export const ANONIM_OYUNCU_SQL = `UPDATE players SET name = ?, token_hash = ?, friend_code = ?, hat = '', muted = '[]', cosmetics = '[]', cards = '{}',
  xp = 0, highest = 1, stars = 0, team_id = NULL, team_role = NULL, team_joined_at = NULL, league_tier = 'bronz', jeton = 0, kristal = 0,
  m5 = 0, m60 = 0, s8 = 0, shields = 0, chat_muted_until = 0, last_chat_at = 0, pass_until = 0, pass_day = '', spend_pending = NULL,
  spend_pending_at = NULL WHERE id = ?`;

/**
 * Göç 7–8'in eklediği oyuncu alanları (aylık sınır seçimi, Sezon Kartı). ANONIM_OYUNCU_SQL'den ayrı: göç 2 bu sütunlar eklenmeden
 * önce de çalışır (eski veritabanı); hesap silmede ikisi birlikte uygulanır.
 */
export const ANONIM_OYUNCU_EK_SQL = 'UPDATE players SET spend_chosen = 0, pass_start = 0, pass_days = 0, pass_paid = 0 WHERE id = ?';

/** anonim oyuncu satırı + silindi işareti (hesap silme ve göç) */
export function anonimOyuncu(db: Sorgu, pid: string, at: number, ekAlanlar = false): void {
  db.run(ANONIM_OYUNCU_SQL, SILINMIS, `silindi:${pid}`, `X${randomBytes(8).toString('hex').toUpperCase()}`, pid);
  if (ekAlanlar) db.run(ANONIM_OYUNCU_EK_SQL, pid);
  db.run('INSERT OR IGNORE INTO deleted_players(player_id, at) VALUES(?, ?)', pid, at);
}

/** takım kimliği taşıyan ve takım silinince satırı silinen düz sütunlar (göçte sahipsiz takım satırlarını bulmak için) */
function takimSilSutunlari(): [string, string][] {
  const out: [string, string][] = [];
  for (const [t, d] of Object.entries(VERI_SINIFI)) {
    for (const [c, k] of Object.entries(d.takim ?? {})) {
      if (k.karar === 'sil' && !k.kosul && !d.oyuncu?.[c] && !(t === 'teams' && c === 'id')) out.push([t, c]);
    }
  }
  return out;
}

/**
 * Göç (tek seferlik): bu sınıflandırmadan ÖNCE silinmiş hesapların ve silinmiş takımların artık satırlarını temizler.
 * Hesaplar `deleted_players`'a göre; takımlar: takım satırı olmayan takım kimlikleri. Eski adlar bilinmediği için serbest
 * metin taraması yapılamaz (o metinler sohbette 30 günde, ödül kutusunda alınınca anlamını yitirir).
 */
export function silinmisArtiklariTemizle(raw: DatabaseSync): { oyuncu: number; takim: number } {
  const db: Sorgu = {
    run: (sql, ...p) => Number(raw.prepare(sql).run(...p).changes),
    all: <T>(sql: string, ...p: Deger[]) => raw.prepare(sql).all(...p) as T[],
  };
  const silinen = db.all<{ player_id: string; at: number }>('SELECT player_id, at FROM deleted_players ORDER BY at');
  for (const r of silinen) {
    veriyiTemizle(db, 'oyuncu', r.player_id);
    anonimOyuncu(db, r.player_id, r.at);
  }
  const s = sema(db);
  const takimlar = new Set<string>();
  for (const [t, c] of takimSilSutunlari()) {
    if (!s.get(t)?.has(c)) continue;
    for (const r of db.all<{ id: string }>(`SELECT DISTINCT ${c} AS id FROM ${t} WHERE ${c} IS NOT NULL AND ${c} NOT IN (SELECT id FROM teams)`)) takimlar.add(r.id);
  }
  for (const r of db.all<{ id: string }>("SELECT DISTINCT substr(room, 7) AS id FROM chat WHERE room LIKE 'takim:%' AND substr(room, 7) NOT IN (SELECT id FROM teams)")) takimlar.add(r.id);
  for (const id of takimlar) veriyiTemizle(db, 'takim', id);
  return { oyuncu: silinen.length, takim: takimlar.size };
}
