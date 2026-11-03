import type { ChatMessage } from '@odi/shared';

/**
 * Takım sohbetinde sistem satırlarını sadeleştirme (YN-148, OT-ilk-kez-oyun-41 / OT-sinav-adayi-29): yeni katılan üyenin ilk
 * gördüğü satırlar "X takımdan ayrıldı" yığını olmasın.
 *  - art arda en az iki "… takımdan ayrıldı." satırı tek satır olur: "4 oyuncu takımdan ayrıldı."
 *  - bakan oyuncunun takıma katılmasından (since) önceki sistem duyuruları ve akış kartları tek katlı satırda toplanır (ilkinin yerinde);
 *    dokununca sırasıyla açılır. Yardım kartı, Günün Sorusu, ralli ve oyuncu iletileri yerinde kalır (hâlâ yanıtlanabilir).
 * Yalnız çizim: iletiler silinmez, sunucuya bir şey gitmez. Ad içermeyen birleşik satır, silinen hesabın adını da yeniden yazmaz.
 */
export type ChatRow =
  | { kind: 'msg'; m: ChatMessage; i: number }
  | { kind: 'left'; id: string; n: number; at: number }
  | { kind: 'before'; id: string; n: number; rows: ChatRow[] };

const LEFT = / takımdan ayrıldı\.$/u;
/** düz sistem duyurusu (ralli başlangıcı kart olarak çizilir, yerinde kalır) */
const plainSys = (m: ChatMessage) => m.from === 'sistem' && m.kind === 'system' && !m.replyTo && m.meta?.event !== 'ralli';
/** katılmadan önceyse katlanabilir: düz duyuru ya da Takım Akışı kartı (eski haber; yanıt beklemez) */
const foldable = (m: ChatMessage) => plainSys(m) || (m.from === 'sistem' && m.kind === 'feed' && !m.replyTo);
const isLeft = (m: ChatMessage) => plainSys(m) && !m.meta && LEFT.test(m.text);

/** art arda ayrılma satırlarını birleştir */
function mergeLeaves(list: { m: ChatMessage; i: number }[]): ChatRow[] {
  const out: ChatRow[] = [];
  for (let k = 0; k < list.length; k++) {
    let e = k;
    while (isLeft(list[k]!.m) && e + 1 < list.length && isLeft(list[e + 1]!.m)) e++;
    if (e > k) { out.push({ kind: 'left', id: `ayrildi:${list[k]!.m.id}`, n: e - k + 1, at: list[e]!.m.at }); k = e; }
    else out.push({ kind: 'msg', m: list[k]!.m, i: list[k]!.i });
  }
  return out;
}

export function foldSystemRows(top: ChatMessage[], since?: number): ChatRow[] {
  const all = top.map((m, i) => ({ m, i }));
  const old = since === undefined ? [] : all.filter((x) => x.m.at < since && foldable(x.m));
  if (old.length < 2) return mergeLeaves(all);
  const inFold = new Set(old.map((x) => x.i));
  const out: ChatRow[] = [];
  let run: { m: ChatMessage; i: number }[] = [];
  for (const x of all) {
    if (x.i === old[0]!.i) { out.push(...mergeLeaves(run)); run = []; out.push({ kind: 'before', id: `once:${x.m.id}`, n: old.length, rows: mergeLeaves(old) }); continue; }
    if (inFold.has(x.i)) continue;
    run.push(x);
  }
  out.push(...mergeLeaves(run));
  return out;
}
