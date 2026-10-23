/**
 * ODİ ağ istemcisi: tarayıcı ve React Native'de çalışır (yalnızca standart WebSocket).
 * React'e bağımlı değildir; React yardımcıları için bkz. ./store.ts
 */
import { CAMP_V, PROTOCOL_VERSION, type Evt, type EvtMap, type FireMap, type FireOp, type MyProfile, type Op, type OpMap, type ProgressSubmit } from '@odi/shared';

export type NetStatus = 'kapalı' | 'bağlanıyor' | 'bağlı' | 'çevrimdışı';

/** benzersiz koşu kimliği: crypto.randomUUID varsa o, yoksa zaman + rastgele */
export function newRunId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}
/** runId eksikse üretir (eski kuyruk kayıtları ve runId vermeyen çağıranlar için) */
const withRunId = (d: ProgressSubmit): ProgressSubmit => (d.runId ? d : { ...d, runId: newRunId() });

type MaybePromise<T> = T | Promise<T>;

export interface ClientOptions {
  /** ws://… ya da wss://… */
  url: string;
  /** cihazda saklanan gizli anahtar (yoksa null/boş) */
  getToken: () => MaybePromise<string | null | undefined>;
  saveToken: (token: string) => MaybePromise<void>;
  /** ilk kayıt için istenen isim (geçersizse sunucu 'OdiNNNN' verir) */
  name?: string;
  /** çevrimdışı ilerleme kuyruğu için kalıcı depolama (ör. localStorage / AsyncStorage) */
  getQueue?: () => MaybePromise<ProgressSubmit[] | null | undefined>;
  saveQueue?: (queue: ProgressSubmit[]) => MaybePromise<void>;
  /** test/özel ortam için WebSocket sınıfı (varsayılan: globalThis.WebSocket) */
  WebSocketImpl?: typeof WebSocket;
  /** istek zaman aşımı (ms), varsayılan 10 000 */
  timeoutMs?: number;
  /** yeniden bağlanma bekleme üst sınırı (ms), varsayılan 15 000 */
  maxBackoffMs?: number;
}

export class NetError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'NetError'; }
}

export interface NetClient {
  connect(): void;
  close(): void;
  readonly status: NetStatus;
  readonly me: MyProfile | null;
  /** sunucu saati tahmini (ms) */
  serverNow(): number;
  call<O extends Op>(op: O, data: OpMap[O]['req']): Promise<OpMap[O]['res']>;
  /** yanıtsız anlık ileti: 'race.pos' (yarış konumu), 'dm.typing' (yazıyor…) */
  fire<F extends FireOp>(op: F, data: FireMap[F]): void;
  on<E extends Evt>(ev: E, cb: (data: EvtMap[E]) => void): () => void;
  onStatus(cb: (s: NetStatus) => void): () => void;
  /** profil değişince (hello, profile.update) */
  onMe(cb: (me: MyProfile) => void): () => void;
  /** gönderilmeyi bekleyen ilerleme kayıtları */
  queued(): number;
  /** progress.submit kısayolu: runId verilmezse üretilir; kuyruk üzerinden gider */
  submitProgress(p: Omit<ProgressSubmit, 'runId'> & { runId?: string }): Promise<OpMap['progress.submit']['res']>;
}

interface Pending { resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: ReturnType<typeof setTimeout>; op: Op }
interface Waiting { op: Op; data: unknown; resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: ReturnType<typeof setTimeout> }
interface QueueItem { data: ProgressSubmit; resolve?: (v: OpMap['progress.submit']['res']) => void; reject?: (e: unknown) => void }

const OPEN = 1;

export function createClient(opts: ClientOptions): NetClient {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBackoff = opts.maxBackoffMs ?? 15_000;
  const WS = opts.WebSocketImpl ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;

  let status: NetStatus = 'kapalı';
  let ws: WebSocket | null = null;
  let me: MyProfile | null = null;
  let offset = 0;
  let nextId = 1;
  let attempt = 0;
  let wanted = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Map<number, Pending>();
  const waiting: Waiting[] = [];
  const listeners = new Map<string, Set<(d: unknown) => void>>();
  const statusCbs = new Set<(s: NetStatus) => void>();
  const meCbs = new Set<(m: MyProfile) => void>();
  let queue: QueueItem[] = [];
  let flushing = false;

  const setStatus = (s: NetStatus) => {
    if (s === status) return;
    status = s;
    for (const cb of [...statusCbs]) { try { cb(s); } catch {} }
  };
  const setMe = (m: MyProfile) => {
    me = { ...m };
    delete me.token;
    for (const cb of [...meCbs]) { try { cb(me); } catch {} }
  };

  let loadP: Promise<void> | null = null;
  let queueReady = false;
  function loadQueue(): Promise<void> {
    if (!loadP) loadP = (async () => {
      try {
        const saved = (await opts.getQueue?.()) ?? [];
        queue = [...saved.map((data) => ({ data: withRunId(data) })), ...queue];
      } catch {}
      queueReady = true;
      persistQueue();
    })();
    return loadP;
  }
  /** kalıcı kuyruğu yaz (kayıtlı kuyruk okunmadan yazılmaz; aksi halde eski kayıtlar silinebilirdi) */
  const persistQueue = () => { if (!queueReady) return; try { void opts.saveQueue?.(queue.map((q) => q.data)); } catch {} };

  function rawSend(op: Op, data: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== OPEN) { reject(new NetError('CEVRIMDISI', 'Sunucuya bağlı değilsin.')); return; }
      const id = nextId++;
      const timer = setTimeout(() => { pending.delete(id); reject(new NetError('ZAMAN_ASIMI', 'Sunucu zamanında yanıt vermedi.')); }, timeoutMs);
      pending.set(id, { resolve, reject, timer, op });
      ws.send(JSON.stringify({ t: 'req', id, op, data }));
    });
  }

  function failAll(code: string, message: string): void {
    for (const [id, p] of pending) { clearTimeout(p.timer); p.reject(new NetError(code, message)); pending.delete(id); }
  }

  async function flushQueue(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      await loadQueue();
      while (queue.length && status === 'bağlı') {
        const item = queue[0]!;
        try {
          const res = await rawSend('progress.submit', item.data) as OpMap['progress.submit']['res'];
          queue.shift(); persistQueue();
          item.resolve?.(res);
        } catch (e) {
          // bağlantı koptuysa kuyrukta kalır; sunucu reddettiyse (geçersiz kayıt) atılır
          if (e instanceof NetError && (e.code === 'CEVRIMDISI' || e.code === 'ZAMAN_ASIMI' || e.code === 'KOPTU' || e.code === 'HIZ')) break;
          queue.shift(); persistQueue();
          item.reject?.(e);
        }
      }
    } finally { flushing = false; }
  }

  function onOpenReady(): void {
    attempt = 0;
    setStatus('bağlı');
    for (const w of waiting.splice(0)) { clearTimeout(w.timer); rawSend(w.op, w.data).then(w.resolve, w.reject); }
    void flushQueue();
  }

  async function hello(): Promise<void> {
    const token = (await opts.getToken()) || undefined;
    try {
      const res = await rawSend('hello', { token, name: opts.name, version: PROTOCOL_VERSION, campV: CAMP_V }) as OpMap['hello']['res'];
      offset = res.serverTime - Date.now();
      if (res.me.token) await opts.saveToken(res.me.token);
      setMe(res.me);
      onOpenReady();
    } catch (e) {
      if (e instanceof NetError && e.code === 'TOKEN') {
        // sunucu bu anahtarı tanımıyor (ör. veritabanı sıfırlandı): yeni hesapla devam
        await opts.saveToken('');
        const res = await rawSend('hello', { name: opts.name, version: PROTOCOL_VERSION, campV: CAMP_V }) as OpMap['hello']['res'];
        offset = res.serverTime - Date.now();
        if (res.me.token) await opts.saveToken(res.me.token);
        setMe(res.me);
        onOpenReady();
        return;
      }
      if (e instanceof NetError && e.code === 'SURUM') { wanted = false; setStatus('kapalı'); ws?.close(); return; }
      ws?.close();
    }
  }

  function scheduleReconnect(): void {
    if (!wanted || reconnectTimer) return;
    setStatus('çevrimdışı');
    const base = Math.min(maxBackoff, 500 * Math.pow(2, attempt));
    const delay = Math.round(base * (0.75 + Math.random() * 0.25));
    attempt++;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; open(); }, delay);
  }

  function handleMessage(raw: unknown): void {
    let m: { t?: string; id?: number; ok?: boolean; data?: unknown; error?: string; code?: string; ev?: string };
    try { m = JSON.parse(String(raw)); } catch { return; }
    if (m.t === 'res' && typeof m.id === 'number') {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer);
      if (m.ok) {
        if (p.op === 'profile.update') setMe((m.data as OpMap['profile.update']['res']).me);
        p.resolve(m.data);
      } else p.reject(new NetError(m.code ?? 'HATA', m.error ?? 'Bilinmeyen hata.'));
    } else if (m.t === 'evt' && typeof m.ev === 'string') {
      if (m.ev === 'kicked') { wanted = false; }
      for (const cb of [...(listeners.get(m.ev) ?? [])]) { try { cb(m.data); } catch {} }
    }
  }

  function open(): void {
    if (!wanted) return;
    if (!WS) { setStatus('çevrimdışı'); return; }
    setStatus('bağlanıyor');
    let sock: WebSocket;
    try { sock = new WS(opts.url); } catch { scheduleReconnect(); return; }
    ws = sock;
    let opened = false;
    // bağlantı hiç açılmazsa (bazı ortamlarda yalnızca 'error' gelir, 'close' gelmez) düşmüş say
    const connectTimer = setTimeout(() => down(), timeoutMs);
    const down = () => {
      clearTimeout(connectTimer);
      if (ws !== sock) return;
      ws = null;
      try { sock.close(); } catch {}
      failAll('KOPTU', 'Bağlantı koptu.');
      if (wanted) scheduleReconnect(); else setStatus('kapalı');
    };
    sock.onopen = () => { opened = true; clearTimeout(connectTimer); if (ws === sock) void hello(); };
    sock.onmessage = (e: MessageEvent) => { if (ws === sock) handleMessage(e.data); };
    sock.onerror = () => { if (!opened) down(); };
    sock.onclose = () => down();
  }

  const client: NetClient = {
    connect() {
      if (wanted) return;
      wanted = true;
      void loadQueue();
      open();
    },
    close() {
      wanted = false;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      for (const w of waiting.splice(0)) { clearTimeout(w.timer); w.reject(new NetError('KAPALI', 'Bağlantı kapatıldı.')); }
      failAll('KAPALI', 'Bağlantı kapatıldı.');
      const s = ws; ws = null;
      try { s?.close(); } catch {}
      setStatus('kapalı');
    },
    get status() { return status; },
    get me() { return me; },
    serverNow: () => Date.now() + offset,
    call<O extends Op>(op: O, data: OpMap[O]['req']): Promise<OpMap[O]['res']> {
      if (op === 'progress.submit') {
        // ilerleme her zaman kuyruktan gider: çevrimdışıyken saklanır, bağlanınca sırayla gönderilir
        return new Promise((resolve, reject) => {
          queue.push({ data: withRunId(data as ProgressSubmit), resolve: resolve as QueueItem['resolve'], reject });
          persistQueue();
          if (status === 'bağlı') void flushQueue();
        }) as Promise<OpMap[O]['res']>;
      }
      if (status === 'bağlı') return rawSend(op, data) as Promise<OpMap[O]['res']>;
      if (!wanted) return Promise.reject(new NetError('KAPALI', 'Bağlantı kapalı.'));
      // bağlanırken/çevrimdışıyken: bağlantı gelene kadar (en çok zaman aşımı kadar) bekle
      return new Promise((resolve, reject) => {
        const w: Waiting = { op, data, resolve: resolve as (v: unknown) => void, reject, timer: setTimeout(() => {
          const i = waiting.indexOf(w); if (i >= 0) waiting.splice(i, 1);
          reject(new NetError('CEVRIMDISI', 'Sunucuya bağlanılamadı.'));
        }, timeoutMs) };
        waiting.push(w);
      });
    },
    fire(op, data) {
      if (status !== 'bağlı' || !ws || ws.readyState !== OPEN) return;
      ws.send(JSON.stringify({ t: 'fire', op, data }));
    },
    on(ev, cb) {
      let set = listeners.get(ev);
      if (!set) { set = new Set(); listeners.set(ev, set); }
      set.add(cb as (d: unknown) => void);
      return () => { set!.delete(cb as (d: unknown) => void); };
    },
    onStatus(cb) { statusCbs.add(cb); return () => { statusCbs.delete(cb); }; },
    onMe(cb) { meCbs.add(cb); return () => { meCbs.delete(cb); }; },
    queued: () => queue.length,
    submitProgress: (p) => client.call('progress.submit', withRunId(p as ProgressSubmit)),
  };
  return client;
}
