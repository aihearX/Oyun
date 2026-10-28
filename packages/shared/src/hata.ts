/**
 * Çökme raporu (YN-011): kişisel veri içermeyen, kendi sunucumuza giden hata kaydı. Web (window.onerror, unhandledrejection,
 * React hata sınırları), telefon kabuğu (ErrorBoundary, ErrorUtils) ve sunucu (POST /hata) bu dosyadaki kuralları paylaşır.
 *
 * Rapor YALNIZ şu alanları taşır (sunucu şeması fazla alanı reddeder): hata adı ve temizlenmiş iletisi, en çok 20 yığın satırı
 * (yalnız işlev adı + dosya adı:satır:sütun), uygulama sürümü ve derleme, platform (web/ios/android) ve işletim sistemi ana
 * sürümü, ekran adı, dakikaya yuvarlanmış zaman. Oyuncu kimliği, takma ad, anahtar, IP'ye bağlı kalıcı bir kimlik, sohbet metni
 * HİÇ gönderilmez. Gizlilik metni: apps/web/src/yasal/metin.ts §3; mağaza beyanları: marketing/magaza/*.md.
 */

export const CRASH_LIMITS = {
  /** istek gövdesi en çok (bayt) */
  maxBytes: 8 * 1024,
  /** yığın satırı en çok */
  stackLines: 20,
  /** ileti en çok (karakter, temizlendikten sonra) */
  messageMax: 300,
  /** oturum başına en çok yeni rapor */
  perSession: 5,
  /** bağlantısızken bekleyen en çok rapor (en yeniler) */
  queueMax: 5,
  /** sunucu: IP başına dakikada / günde (IP yalnız bellekte, sınır için) */
  perIpMinute: 10,
  perIpDay: 100,
  /** sunucu: günde en çok yeni (saat, imza) satırı (çok adresten gelen sel veritabanını şişirmesin) */
  newRowsPerDay: 2000,
  /** sunucu: kayıtlar bu kadar gün sonra kendiliğinden silinir */
  retainDays: 30,
} as const;

export type CrashPlatform = 'web' | 'ios' | 'android';

/** sunucuya giden raporun tamamı (başka alan yok) */
export interface CrashReport {
  v: 1;
  /** hata adı (TypeError, Error …) */
  kind: string;
  /** temizlenmiş ileti */
  message: string;
  /** parmak izi satırları: `işlev@dosya.js:satır:sütun` ya da `dosya.js:satır:sütun` */
  stack: string[];
  /** uygulama sürümü (0.1.0) */
  app: string;
  /** derleme (web: derleme kimliği; telefon: mağaza derleme numarası) */
  build: string;
  platform: CrashPlatform;
  /** işletim sistemi ve ana sürümü (ör. "android 14", "ios 17", "windows") */
  os: string;
  /** ekran/rota adı (map, level, settings …) */
  screen: string;
  /** dakikaya yuvarlanmış zaman (ms) */
  at: number;
}

export const CRASH_KIND_RE = /^[A-Za-z_$][\w$.-]{0,59}$/;
export const CRASH_STACK_RE = /^(?:[\w$.<>-]{1,60}@)?[\w.-]{1,80}:\d{1,7}(?::\d{1,7})?$/;
export const CRASH_APP_RE = /^\d{1,3}\.\d{1,3}\.\d{1,4}$/;
export const CRASH_BUILD_RE = /^[\w.-]{0,40}$/;
export const CRASH_OS_RE = /^[a-z]{2,8}(?: \d{1,3})?$/;
export const CRASH_SCREEN_RE = /^[\w-]{0,40}$/;

/**
 * Serbest metni kişisel veriden arındırır: URL'lerin sorgu/parça kısmı, e-postalar, anahtar/kimlik benzeri dizgiler, arkadaş
 * kodu benzeri dizgiler, tırnak içindeki serbest yazı (ör. JSON hatasında sohbet metni) ve rakam dizileri çıkarılır.
 * Rakam dizileri `#` olur: aynı hatanın farklı sayılarla gelen kopyaları tek imzada toplanır.
 */
export function scrubText(raw: unknown, max: number = CRASH_LIMITS.messageMax): string {
  let s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  s = s.slice(0, 4000);
  s = s
    // URL: sorgu ve parça kısmı (anahtar, kimlik taşıyabilir)
    .replace(/\b((?:https?|wss?|file):\/\/[^\s?#"'`<>)]*)[?#][^\s"'`<>)]*/gi, '$1')
    // e-posta
    .replace(/[^\s@<>()[\]"'`,;:]+@[^\s@<>()[\]"'`,;:]+\.[A-Za-z]{2,}/g, '<e-posta>')
    // tırnak içinde boşluklu ya da uzun serbest yazı (sohbet metni, takma ad, JSON içeriği)
    .replace(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g, (q) => (/\s/.test(q.slice(1, -1)) || q.length > 42 ? `${q[0]}…${q[0]}` : q))
    // anahtar / kimlik benzeri: ≥ 12 karakterlik, rakam da içeren dizgi; ya da ≥ 32 karakterlik herhangi bir dizgi
    .replace(/[A-Za-z0-9_+/=-]{12,}/g, (w) => (/\d/.test(w) || w.length >= 32 ? '<anahtar>' : w))
    // arkadaş kodu benzeri: harf ve rakam karışık, büyük harfli 6+ karakter
    .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g, '<kod>')
    // rakam dizileri
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** hata adı: yalnız tanımlayıcı karakterleri */
export function scrubKind(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.replace(/[^\w$.-]/g, '').slice(0, 60) : '';
  return CRASH_KIND_RE.test(s) ? s : 'Error';
}

/**
 * Yığın metni → parmak izi satırları. Her satırdan yalnız işlev adı, dosyanın ADI (klasör, alan adı, sorgu yok) ve
 * satır:sütun kalır; bunlara uymayan satırlar atılır. V8/Chrome, Safari/JSC, Firefox ve Hermes biçimleri.
 */
export function fingerprintStack(raw: unknown, max: number = CRASH_LIMITS.stackLines): string[] {
  if (typeof raw !== 'string') return [];
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    if (out.length >= max) break;
    const t = line.trim();
    const loc = /([^\s()@]*?)(?:[?#][^\s():]*)?:(\d{1,7})(?::(\d{1,7}))?\)?$/.exec(t);
    if (!loc) continue;
    const file = (loc[1] ?? '').split(/[\\/]/).pop()!.replace(/[^\w.-]/g, '').slice(-80);
    if (!file) continue;
    let fn = '';
    const v8 = /^at\s+(?:async\s+)?([^\s(]+)\s+\(/.exec(t);
    const jsc = /^([^@\s]*)@/.exec(t);
    if (v8) fn = v8[1]!; else if (jsc && !t.startsWith('at ')) fn = jsc[1]!;
    fn = fn.replace(/[^\w$.<>-]/g, '').slice(0, 60);
    const s = `${fn ? `${fn}@` : ''}${file}:${loc[2]}${loc[3] ? `:${loc[3]}` : ''}`;
    if (CRASH_STACK_RE.test(s)) out.push(s);
  }
  return out;
}

/** dakikaya yuvarlanmış zaman */
export const crashMinute = (t: number) => Math.floor(t / 60_000) * 60_000;

/** hata nesnesi (ya da reddedilen herhangi bir değer) → ad, ileti, yığın */
export function describeError(e: unknown): { kind: string; message: string; stack: string[] } {
  if (e && typeof e === 'object') {
    const o = e as { name?: unknown; message?: unknown; stack?: unknown };
    return { kind: scrubKind(o.name), message: scrubText(o.message), stack: fingerprintStack(o.stack) };
  }
  // Error olmayan değer: içeriği gönderilmez, yalnız türü
  return { kind: 'NonError', message: e === undefined ? 'undefined' : typeof e, stack: [] };
}

/** raporun imzası (istemci: oturumda tekrar göndermemek için). Sunucu kendi imzasını ayrıca hesaplar. */
export function crashSignature(r: Pick<CrashReport, 'kind' | 'message' | 'stack'>): string {
  const s = `${r.kind}|${r.message}|${r.stack.slice(0, 5).join('|')}`;
  let a = 0x811c9dc5, b = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** işletim sistemi + ana sürüm, tarayıcı kimliğinden (ince ayrıntı yok: yalnız aile ve ana sürüm) */
export function osFromUserAgent(ua: string): string {
  const and = /Android (\d{1,3})/.exec(ua); if (and) return `android ${and[1]}`;
  const ios = /(?:iPhone|iPad|iPod).*? OS (\d{1,3})_/.exec(ua); if (ios) return `ios ${ios[1]}`;
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X/.test(ua)) return 'macos';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}

export interface CrashContext { app: string; build: string; platform: CrashPlatform; os: string; screen: string }

/** hata + bağlam → rapor (her alan biçim denetiminden geçer; uymayan değer boş/varsayılan olur) */
export function buildCrashReport(e: unknown, ctx: CrashContext, now: number = Date.now()): CrashReport {
  const d = describeError(e);
  return {
    v: 1, kind: d.kind, message: d.message, stack: d.stack,
    app: CRASH_APP_RE.test(ctx.app) ? ctx.app : '0.0.0',
    build: CRASH_BUILD_RE.test(ctx.build) ? ctx.build : '',
    platform: ctx.platform,
    os: CRASH_OS_RE.test(ctx.os) ? ctx.os : 'other',
    screen: CRASH_SCREEN_RE.test(ctx.screen) ? ctx.screen : '',
    at: crashMinute(now),
  };
}

/** ws://, wss://, http(s):// sunucu adresi → rapor ucu (http(s)://kök/hata); geçersizse boş */
export function crashEndpoint(serverUrl: string): string {
  const m = /^(ws|wss|http|https):\/\/([^/?#\s]+)/i.exec(serverUrl.trim());
  if (!m) return '';
  const proto = /^(wss|https)$/i.test(m[1]!) ? 'https' : 'http';
  return `${proto}://${m[2]}/hata`;
}

export interface CrashStore { get(): Promise<string | null>; set(v: string): Promise<void> }
export interface CrashReporterDeps {
  /** rapor bağlamı (sürüm, platform, ekran …) o anki değeriyle */
  context: () => CrashContext;
  /** gönderim: true = sunucu aldı ya da kalıcı olarak reddetti (kuyruktan çıkar); false = sonra yeniden dene */
  post: (body: string) => Promise<boolean>;
  /** bağlantısız bekleyen raporlar (en çok queueMax) */
  store?: CrashStore;
  now?: () => number;
}

/**
 * İstemci raporlayıcısı (web ve telefon kabuğu ortak): aynı imza oturumda bir kez, oturumda en çok 5 rapor; gönderilemeyen
 * son 5 rapor kalıcı kuyrukta bekler. Hiçbir hata dışarı sızmaz (raporlama oyunu asla bozmaz).
 */
export class CrashReporter {
  private seen = new Set<string>();
  private count = 0;
  private flushing: Promise<void> | null = null;
  constructor(private deps: CrashReporterDeps) {}

  /** hatayı kaydet ve göndermeyi dene; rapor oluşturulduysa döndürür */
  report(e: unknown, screen?: string): CrashReport | null {
    try {
      if (this.count >= CRASH_LIMITS.perSession) return null;
      const ctx = this.deps.context();
      const r = buildCrashReport(e, screen != null ? { ...ctx, screen } : ctx, (this.deps.now ?? Date.now)());
      const sig = crashSignature(r);
      if (this.seen.has(sig)) return null;
      this.seen.add(sig);
      this.count++;
      void this.enqueue(r).then(() => this.flush()).catch(() => undefined);
      return r;
    } catch { return null; }
  }

  private async read(): Promise<CrashReport[]> {
    try {
      const raw = await this.deps.store?.get();
      const list = raw ? JSON.parse(raw) as unknown : [];
      return Array.isArray(list) ? (list as CrashReport[]).filter((x) => x && typeof x === 'object' && x.v === 1).slice(-CRASH_LIMITS.queueMax) : [];
    } catch { return []; }
  }
  private async write(list: CrashReport[]): Promise<void> {
    try { await this.deps.store?.set(JSON.stringify(list.slice(-CRASH_LIMITS.queueMax))); } catch { /* depolama yok */ }
  }
  private mem: CrashReport[] = [];
  private async load(): Promise<CrashReport[]> { return this.deps.store ? this.read() : this.mem; }
  private async save(list: CrashReport[]): Promise<void> { if (this.deps.store) await this.write(list); else this.mem = list.slice(-CRASH_LIMITS.queueMax); }
  /** kuyruk işlemleri sırayla (eşzamanlı oku-yaz birbirinin yazdığını silmesin) */
  private chain: Promise<unknown> = Promise.resolve();
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.chain.then(fn, fn);
    this.chain = p.catch(() => undefined);
    return p;
  }
  private enqueue(r: CrashReport): Promise<void> { return this.locked(async () => this.save([...(await this.load()), r])); }

  /** bekleyenleri sırayla gönder (bağlantı gelince, açılışta). Gönderim sırasında eklenen rapor kaybolmaz: kuyruk her adımda yeniden okunur. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing.then(() => this.flush());
    this.flushing = (async () => {
      try {
        for (let guard = 0; guard < CRASH_LIMITS.queueMax * 2; guard++) {
          const head = (await this.locked(() => this.load()))[0];
          if (!head) break;
          const body = JSON.stringify(head);
          let ok = false;
          try { ok = await this.deps.post(body); } catch { ok = false; }
          if (!ok) break;
          await this.locked(async () => {
            const now = await this.load();
            const i = now.findIndex((x) => JSON.stringify(x) === body);
            if (i >= 0) await this.save([...now.slice(0, i), ...now.slice(i + 1)]);
          });
        }
      } catch { /* yut */ } finally { this.flushing = null; }
    })();
    return this.flushing;
  }
}
