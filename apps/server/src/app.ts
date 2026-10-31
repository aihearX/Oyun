import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  levelFromXp, PURCHASE_GIFT_REF, type Evt, type EvtMap, type InboxItem, type InboxKind, type LeagueTier, type MyProfile, type Op, type OpMap,
  type PublicProfile, type TeamRole, type Wallet,
} from '@odi/shared';
import { Db } from './db';
import { weekInfo } from './time';
import { badgeFields } from './rozet';

/** sunucunun ödül kutusuna / hediyeye koyabildiği tek ödül */
export interface Grant { kind: InboxKind; amount: number; ref: string }

export interface ServerConfig {
  port: number;
  host: string;
  dbFile: string;
  now: () => number;
  raidAlways: boolean;
  testStore: boolean;
  revenueCatKey: string | null;
  raceCountdownMs: number;
  raceFinishGraceMs: number;
  sweepMs: number;
  pingMs: number;
  msgPerSec: number;
  log: boolean;
  version: string;
  /** ODI_EVENTS_FAST=1: etkinlik süreleri kısalır (saat → dakika), quiz her an açılabilir (test) */
  eventsFast: boolean;
  /** hızlı modda etkinlik dönemlerinin başlangıç anı (varsayılan: sunucu açılışı) */
  eventsEpoch: number;
  /** güvenli sohbet: serbest yazı için geçilmesi gereken bölüm (varsayılan COMM_RULES.freeTextLevel = 8; ODI_FREE_TEXT_AT yalnızca test) */
  freeTextCleared: number;
  /** takım yarışı: bağlantısı kopanın dönmesi için bekleme (varsayılan TEAM_RACE_RULES.graceMs; testte kısa) */
  teamRaceGraceMs?: number;
  /** canlı yarış: yarış sürerken kopanın (ve sunucu yeniden başlayınca herkesin) dönmesi için bekleme (varsayılan race.ts RACE_REJOIN_MS) */
  raceRejoinMs?: number;
  /** yönetici kodunun tuzlu özeti (scrypt:tuz:özet); yoksa codes.ts'teki varsayılan. Düz metin hiçbir yerde tutulmaz. */
  adminCodeHash?: string;
  /** sunucunun önündeki güvenilir vekil sayısı (ODI_TRUST_PROXY); 0/yok = X-Forwarded-For yok sayılır */
  trustProxy?: number;
  /** IP başına saatte en çok yeni hesap (ODI_NEW_PER_IP_HOUR); 0/yok = sınırsız. IP için ODI_TRUST_PROXY doğru ayarlanmalı. */
  newAccountsPerIpHour?: number;
  /** yedek klasörü (ODI_BACKUP_DIR); yoksa yedek alınmaz */
  backupDir?: string;
  /** yedek aralığı, saat (ODI_BACKUP_HOURS, varsayılan 6) */
  backupHours?: number;
  /** tutulacak yedek sayısı (ODI_BACKUP_KEEP, varsayılan 28 = 6 saatte bir 7 gün) */
  backupKeep?: number;
}

export class OdiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export function fail(code: string, message: string): never { throw new OdiError(code, message); }

export interface Conn {
  id: number;
  ws: WebSocket;
  pid: string | null;
  rooms: Set<string>;
  tokens: number;
  refillAt: number;
  alive: boolean;
  lastPosAt: number;
  /** bağlantının IP'si (kod denemesi sınırı) */
  ip?: string;
  /** istemcinin anladığı kamp sürümü (hello.campV; yoksa 0 = eski istemci, yalnız eski binalar) */
  campV?: number;
}

export interface Session { conn: Conn; pid: string }

export interface PlayerRow {
  id: string; token_hash: string; name: string; color: number; hat: string; friend_code: string; xp: number; highest: number; stars: number;
  team_id: string | null; team_role: TeamRole | null; team_joined_at: number | null; league_tier: LeagueTier;
  jeton: number; kristal: number; m5: number; m60: number; s8: number; shields: number; cosmetics: string; cards: string; muted: string;
  chat_muted_until: number; last_chat_at: number; depot_at: number; pass_until: number; pass_day: string;
  spend_limit: number; spend_pending: number | null; spend_pending_at: number | null;
  /** göç 7–8 (karar 28, 30): oyuncu aylık sınırı seçti mi (0/1); Sezon Kartı başlangıç günü (dayNumber, 0 = yok), gün sayısı, ödenen gün */
  spend_chosen: number; pass_start: number; pass_days: number; pass_paid: number; created_at: number; last_seen: number;
  /** göç 9 (YN-065): `jeton`un içindeki satın alma hediyesi jetonu; takım teknolojisine bağışlanamaz (her zaman ≤ jeton) */
  gift_jeton: number;
}
export interface TeamRow { id: string; name: string; name_key: string; emblem: string; description: string; open: number; code: string; min_level: number; xp: number; targets: string; created_at: number }

export type Handler<O extends Op> = (app: App, s: Session, data: OpMap[O]['req']) => OpMap[O]['res'] | Promise<OpMap[O]['res']>;
export type Handlers = { [O in Op]?: Handler<O> };

/** profil kartında herkese görünen rozet alanları (liste seçimi yalnız kendi profilinde) */
const pubBadges = ({ listede: _l, ...rest }: ReturnType<typeof badgeFields>) => rest;

/** karışmayan harfler: I, O, 0, 1, L yok */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function randomCode(len = 6): string {
  const b = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[b[i]! % CODE_ALPHABET.length];
  return s;
}
export const rid = (prefix: string) => prefix + randomBytes(8).toString('hex');

export class App {
  readonly db: Db;
  readonly cfg: ServerConfig;
  /** çevrimiçi oyuncu → bağlantı (oyuncu başına tek bağlantı) */
  readonly online = new Map<string, Conn>();
  /** sohbet odası → abone oyuncular */
  readonly rooms = new Map<string, Set<string>>();
  private pending: (() => void)[] = [];
  private weekKey: string | null = null;
  readonly weekHooks: ((oldWeek: string, newWeek: string) => void)[] = [];
  readonly disconnectHooks: ((pid: string) => void)[] = [];
  /** sohbet odasına katılınca (ör. Günün Sorusu kartı tembel açılır) */
  readonly chatJoinHooks: ((pid: string, room: string) => void)[] = [];
  /** oyuncu bir takıma girdi (kurma, doğrudan katılma, kod, başvuru kabulü) — aynı işlem içinde */
  readonly teamJoinHooks: ((pid: string, teamId: string) => void)[] = [];
  /** takım silindi (son üye ayrıldı) — aynı işlem içinde */
  readonly teamDeleteHooks: ((teamId: string) => void)[] = [];

  constructor(cfg: ServerConfig) {
    this.cfg = cfg;
    this.db = new Db(cfg.dbFile);
  }

  now(): number { return this.cfg.now(); }
  week() { return weekInfo(this.now()); }

  /** tek işlem (transaction) içinde çalıştırır; olaylar yalnızca başarıyla COMMIT olursa gönderilir */
  run<T>(fn: () => T): T {
    if (this.db.inTx) return fn();
    this.pending = [];
    let r: T;
    try {
      r = this.db.tx(() => { this.ensureWeek(); return fn(); });
    } catch (e) { this.pending = []; throw e; }
    const out = this.pending; this.pending = [];
    for (const f of out) { try { f(); } catch (e) { if (this.cfg.log) console.error('[olay]', e); } }
    return r;
  }

  /** hafta değişimini tembel işle (ilk erişimde) */
  private ensureWeek(): void {
    const cur = this.week().key;
    if (this.weekKey === cur) return;
    const stored = this.db.metaGet('week');
    if (stored && stored !== cur) for (const h of this.weekHooks) h(stored, cur);
    if (stored !== cur) this.db.metaSet('week', cur);
    this.weekKey = cur;
  }

  // ---------- olaylar
  emit<E extends Evt>(pid: string, ev: E, data: EvtMap[E]): void {
    const send = () => { const c = this.online.get(pid); if (c) sendJson(c, { t: 'evt', ev, data }); };
    if (this.db.inTx) this.pending.push(send); else send();
  }
  /** her alıcı için ayrı veri üretir (ör. kişiye özel TeamExtra) */
  emitEach<E extends Evt>(pids: Iterable<string>, ev: E, make: (pid: string) => EvtMap[E] | null): void {
    for (const pid of pids) { if (!this.online.has(pid)) continue; const d = make(pid); if (d) this.emit(pid, ev, d); }
  }
  /** işlem bittikten sonra çalışacak iş (ör. zamanlayıcı kurma) */
  after(fn: () => void): void { if (this.db.inTx) this.pending.push(fn); else fn(); }

  // ---------- oyuncu
  player(pid: string): PlayerRow {
    const p = this.db.get<PlayerRow>('SELECT * FROM players WHERE id = ?', pid);
    if (!p) return fail('YOK', 'Oyuncu bulunamadı.');
    return p;
  }
  playerOrNull(pid: string): PlayerRow | null { return this.db.get<PlayerRow>('SELECT * FROM players WHERE id = ?', pid) ?? null; }
  team(teamId: string): TeamRow | null { return this.db.get<TeamRow>('SELECT * FROM teams WHERE id = ?', teamId) ?? null; }
  teamMemberIds(teamId: string): string[] { return this.db.all<{ id: string }>('SELECT id FROM players WHERE team_id = ? ORDER BY team_joined_at', teamId).map((r) => r.id); }

  publicProfile(p: PlayerRow): PublicProfile {
    const t = p.team_id ? this.team(p.team_id) : null;
    return {
      id: p.id, name: p.name, color: p.color, hat: p.hat, level: levelFromXp(p.xp), highest: p.highest, stars: p.stars,
      teamId: t?.id ?? null, teamName: t?.name ?? null, teamEmblem: t?.emblem ?? null, league: p.league_tier,
      online: this.online.has(p.id), lastSeen: this.online.has(p.id) ? this.now() : p.last_seen,
      ...pubBadges(badgeFields(this, p.id)),
    };
  }
  myProfile(p: PlayerRow): MyProfile {
    const { listede } = badgeFields(this, p.id);
    return {
      ...this.publicProfile(p), friendCode: p.friend_code, shields: p.shields,
      cosmetics: parseJson<string[]>(p.cosmetics, []),
      cards: Object.keys(parseJson<Record<string, number>>(p.cards, {})),
      ...(listede === undefined ? {} : { listede }),
    };
  }

  wallet(pid: string): Wallet {
    const p = this.player(pid);
    const gift = Math.min(p.gift_jeton, p.jeton);
    return { jeton: p.jeton, kristal: p.kristal, hizlandirici: { m5: p.m5, m60: p.m60, s8: p.s8 }, ...(gift > 0 ? { bagislanamaz: gift } : {}) };
  }
  walletChanged(pid: string): Wallet { const w = this.wallet(pid); this.emit(pid, 'wallet.updated', { wallet: w }); return w; }

  /**
   * cüzdandan düş; yetmezse Türkçe hata. Jetonda önce satın alma hediyesi jetonu harcanır (bağışlanabilir jeton korunur);
   * dönen değer bu harcamada kullanılan hediye jetonudur (geri verilirse aynı ayrımla geri verilsin: `addJeton`).
   * Takım teknolojisine bağış bu yolu değil `spendDonatable`ı kullanır.
   */
  spend(pid: string, col: 'jeton' | 'kristal' | 'm5' | 'm60' | 's8', amount: number): number {
    if (amount <= 0) return 0;
    if (col === 'jeton') {
      const p = this.player(pid);
      const gift = Math.min(Math.min(p.gift_jeton, p.jeton), amount);
      const n = this.db.run('UPDATE players SET jeton = jeton - ?, gift_jeton = MAX(0, MIN(gift_jeton, jeton) - ?) WHERE id = ? AND jeton >= ?', amount, amount, pid, amount);
      if (n === 0) fail('YETERSIZ', 'Yeterli jeton yok.');
      return gift;
    }
    const n = this.db.run(`UPDATE players SET ${col} = ${col} - ? WHERE id = ? AND ${col} >= ?`, amount, pid, amount);
    if (n === 0) fail('YETERSIZ', `Yeterli ${col === 'kristal' ? 'kristal' : 'hızlandırıcı'} yok.`);
    return 0;
  }
  /**
   * Takım teknolojisine bağış: yalnız bağışlanabilir jetondan (jeton − satın alma hediyesi jetonu). Hediye jetonu yüzünden
   * yetmiyorsa oyuncuya nedenini söyler (karar 29 / YN-065).
   */
  spendDonatable(pid: string, amount: number): void {
    if (amount <= 0) return;
    const n = this.db.run('UPDATE players SET jeton = jeton - ? WHERE id = ? AND jeton - MIN(gift_jeton, jeton) >= ?', amount, pid, amount);
    if (n > 0) return;
    const p = this.player(pid);
    if (p.jeton < amount) fail('YETERSIZ', 'Yeterli jeton yok.');
    const free = p.jeton - Math.min(p.gift_jeton, p.jeton);
    fail('HEDIYE_JETONU', `Satın alma hediyesinden gelen ${p.jeton - free} jetonun takım teknolojisine bağışlanamaz (parayla takım gücü olmasın diye); kampta ve yeteneklerde harcanır. Bağışlayabileceğin: ${free} jeton.`);
  }
  /**
   * jeton ekle; `gift` kadarı satın alma hediyesi jetonu sayılır (hediye alma; harcanmış jetonu aynı ayrımla geri verme,
   * ör. inşaat sırasından çıkarma: sıraya alıp çıkararak hediye jetonu bağışlanabilir olmasın)
   */
  addJeton(pid: string, amount: number, gift: number): void {
    if (amount <= 0) return;
    this.db.run('UPDATE players SET jeton = jeton + ?, gift_jeton = MIN(jeton + ?, MIN(gift_jeton, jeton) + ?) WHERE id = ?', amount, amount, Math.max(0, Math.min(gift, amount)), pid);
  }
  addCurrency(pid: string, col: 'jeton' | 'kristal' | 'm5' | 'm60' | 's8', amount: number): void {
    if (amount) this.db.run(`UPDATE players SET ${col} = ${col} + ? WHERE id = ?`, amount, pid);
  }

  /** bir ödülü doğrudan oyuncuya uygular (ödül kutusundan alma, hediye alma) */
  grant(pid: string, g: Grant): void {
    switch (g.kind) {
      case 'jeton':
        // satın alma hediyesinin jetonu ayrı sayılır: takım teknolojisine bağışlanamaz (karar 29 / YN-065)
        if (g.ref === PURCHASE_GIFT_REF) this.addJeton(pid, g.amount, g.amount);
        else this.addCurrency(pid, 'jeton', g.amount);
        break;
      case 'kristal': this.addCurrency(pid, 'kristal', g.amount); break;
      case 'kalkan': this.db.run('UPDATE players SET shields = shields + ? WHERE id = ?', g.amount, pid); break;
      case 'kozmetik': {
        const p = this.player(pid);
        const list = new Set<string>(JSON.parse(p.cosmetics) as string[]);
        list.add(g.ref);
        this.db.run('UPDATE players SET cosmetics = ? WHERE id = ?', JSON.stringify([...list]), pid);
        break;
      }
      case 'kart': {
        const p = this.player(pid);
        const cards = JSON.parse(p.cards) as Record<string, number>;
        cards[g.ref] = (cards[g.ref] ?? 0) + g.amount;
        this.db.run('UPDATE players SET cards = ? WHERE id = ?', JSON.stringify(cards), pid);
        break;
      }
    }
  }

  addInbox(pid: string, g: Grant, reason: string): InboxItem {
    const item: InboxItem = { id: rid('i'), kind: g.kind, amount: g.amount, ref: g.ref, reason, at: this.now() };
    this.db.run('INSERT INTO inbox(id, player_id, kind, amount, ref, reason, at) VALUES(?, ?, ?, ?, ?, ?, ?)', item.id, pid, g.kind, g.amount, g.ref, reason, item.at);
    this.emit(pid, 'inbox.new', { item });
    return item;
  }
  unclaimedInbox(pid: string): number { return this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM inbox WHERE player_id = ? AND claimed = 0', pid)!.n; }

  /** günlük sayaç (İstanbul günü) */
  dailyCount(pid: string, day: string, kind: string): number { return this.db.get<{ n: number }>('SELECT n FROM daily WHERE player_id = ? AND day = ? AND kind = ?', pid, day, kind)?.n ?? 0; }
  dailyInc(pid: string, day: string, kind: string): number {
    this.db.run('INSERT INTO daily(player_id, day, kind, n) VALUES(?, ?, ?, 1) ON CONFLICT(player_id, day, kind) DO UPDATE SET n = n + 1', pid, day, kind);
    return this.dailyCount(pid, day, kind);
  }

  // ---------- sohbet odaları (abonelik)
  subscribe(pid: string, room: string): void {
    let s = this.rooms.get(room); if (!s) { s = new Set(); this.rooms.set(room, s); }
    s.add(pid); this.online.get(pid)?.rooms.add(room);
  }
  unsubscribe(pid: string, room: string): void {
    const s = this.rooms.get(room); if (s) { s.delete(pid); if (!s.size) this.rooms.delete(room); }
    this.online.get(pid)?.rooms.delete(room);
  }

  close(): void { this.db.close(); }
}

export function sendJson(c: Conn, obj: unknown): void {
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(obj));
}

export const parseJson = <T>(s: string, fallback: T): T => { try { return JSON.parse(s) as T; } catch { return fallback; } };
