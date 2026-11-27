import { create } from 'zustand';
import { isTeamUpdate, type ChatMessage } from '@odi/shared';

/**
 * Takım › Sohbet iki bölme (1.3.0, sahibin isteği): Mesajlar (oyuncuların yazdıkları) ve Güncellemeler (takım arkadaşlarının
 * gelişmeleri ve takım duyuruları). Ayrım yalnız istemcide: sunucu ve protokol aynı, eski istemciler tek akışı görür.
 *  - Güncelleme: sistemin yazdığı her ileti (isTeamUpdate: akış kartı, yardım kartı, katıldı/ayrıldı, hediye, savaş, ralli…).
 *  - Mesaj: oyuncunun yazısı, emojisi, hazır sözü; Günün Sorusu (tartışma kartı).
 *  - Güncelleme kartına oyuncunun yanıtı (Tebrik et, ipucu, "Rica ederim") kartın altında kalır VE Mesajlar'da da görünür,
 *    üstünde hangi karta yanıt olduğu yazar (dokununca konu açılır): konuşma Mesajlar'da kaybolmaz.
 */
export type ChatPane = 'mesaj' | 'guncelleme';

const SEEN_KEY = 'odi.takim.guncelleme';
function loadSeen(): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as unknown; return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number')) as Record<string, number> : {}; } catch { return {}; }
}

/** açık bölme (ekran kapanıp açılınca da kalır) ve oda başına en son görülen güncellemenin zamanı (bu cihazda kalıcı) */
export const useChatPane = create<{ pane: ChatPane; seen: Record<string, number> }>(() => ({ pane: 'mesaj', seen: loadSeen() }));
export const setChatPane = (pane: ChatPane): void => useChatPane.setState({ pane });

/** Güncellemeler görüldü: o anki en yeni güncellemenin zamanına kadar (geri gitmez) */
export function markUpdatesSeen(room: string, at: number): void {
  const cur = useChatPane.getState().seen[room] ?? 0;
  if (at <= cur) return;
  const seen = { ...useChatPane.getState().seen, [room]: at };
  useChatPane.setState({ seen });
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* gizli mod: yalnız bu oturum */ }
}

export interface TeamSplit {
  /** Mesajlar (zamana göre): üst düzey oyuncu iletileri, Günün Sorusu ve güncelleme kartlarına oyuncu yanıtları */
  messages: ChatMessage[];
  /** Güncellemeler (zamana göre): üst düzey sistem kartları ve duyuruları */
  updates: ChatMessage[];
  /** üst ileti → listedeki konu yanıtları (kartın / mesajın altında) */
  repliesOf: Map<string, ChatMessage[]>;
  /** Mesajlar'a taşınan yanıt → yanıtlanan güncelleme kartı */
  parentOf: Map<string, ChatMessage>;
}

/**
 * Takım sohbetini iki bölmeye ayır. hide: gösterilmeyecek iletiler (sessize alınan kişi, kapalı özellik). Konu yanıtı, üst iletisi
 * listedeyse onun altına gider; üst ileti yoksa tek başına (kendi türüne göre) görünür. Güncelleme kartının son yanıtları geçmişte
 * yalnız kartın `thread` önizlemesiyle gelir (sunucu konu yanıtlarını ayrıca göndermez): oyuncu yanıtları oradan da Mesajlar'a alınır.
 */
export function splitTeamChat(msgs: ChatMessage[], hide: (m: ChatMessage) => boolean = () => false): TeamSplit {
  const shown = msgs.filter((m) => !hide(m));
  const byId = new Map(shown.map((m) => [m.id, m]));
  const messages: ChatMessage[] = []; const updates: ChatMessage[] = [];
  const repliesOf = new Map<string, ChatMessage[]>(); const parentOf = new Map<string, ChatMessage>();
  const lifted = new Set<string>();
  const lift = (r: ChatMessage, parent: ChatMessage) => {
    if (lifted.has(r.id) || isTeamUpdate(r) || hide(r)) return;
    lifted.add(r.id); parentOf.set(r.id, parent); messages.push(r);
  };
  for (const m of shown) {
    const parent = m.replyTo ? byId.get(m.replyTo) : undefined;
    if (parent) {
      const l = repliesOf.get(parent.id) ?? []; l.push(m); repliesOf.set(parent.id, l);
      if (isTeamUpdate(parent)) lift(m, parent);
      continue;
    }
    (isTeamUpdate(m) ? updates : messages).push(m);
  }
  for (const u of updates) for (const r of u.thread ?? []) if (!byId.has(r.id)) lift(r, u);
  if (lifted.size) messages.sort((a, b) => a.at - b.at);
  return { messages, updates, repliesOf, parentOf };
}

/** bölme rozeti: `since` anından sonra gelen, benim yazmadığım ve benimle ilgili olmayan iletiler */
export function newCount(list: ChatMessage[], since: number, me: string | undefined): number {
  let n = 0;
  for (const m of list) if (m.at > since && m.from !== me && !(me && m.meta?.pid === me)) n++;
  return n;
}

/** Takım › Sohbet'i ilgili bölmesiyle aç (bildirim, anlatıcı turu, Günün Sorusu) */
export function chatPaneFor(kind: 'mention' | 'dq' | 'thanks' | 'challenge' | string): ChatPane {
  return kind === 'mention' || kind === 'dq' ? 'mesaj' : 'guncelleme';
}
