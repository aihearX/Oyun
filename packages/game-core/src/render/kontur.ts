/**
 * Yüksek görünürlük zemin konturu (LevelScene.drawHiVis; YN-268): bir katı zemin parçasının açık çizgiyle çizilecek kenarları.
 * Düz zemin ve platform: üst kenar + gerçek yan kenarların üst 140 px'i (bitişik aynı yükseklikte zemin varsa ek yeri çizilmez).
 * Asılı şekil (duvar sütunu, ters yerçekimi tavanı): bütün dış kenar; yanlar boyunca (bitişik zeminin örttüğü yer hariç) ve
 * altı boşta ise yuvarlak alt ucu da (Odi altından geçerken ucun nerede bittiği seçilsin). Phaser'dan bağımsız (kontur.test.ts).
 */

/** dünya koordinatlı dikdörtgen; `asili`: duvar sütunu ya da tavan (bütün dış kenarı çizilir) */
export interface KonturRect { l: number; t: number; r: number; b: number; asili?: boolean }
/** kırık çizgi: [x0, y0, x1, y1, ...]; `kapali`: son nokta ilkine bağlanır */
export interface KonturCizgi { pts: number[]; kapali: boolean }

/** düz zeminde yan kenarın üstten çizilen boyu */
const YAN_BOY = 140;
/** zemin görselinin köşe yarıçapı (render/terrain.ts gövde dokusu: ince levha / kalın gövde) */
const koseR = (e: KonturRect) => Math.min((e.b - e.t) < 90 ? 14 : 20, (e.r - e.l) / 2, (e.b - e.t) / 2);

/** `e`'nin çizilecek kenarları; `komsu`: görünen diğer katı zeminler (e de içinde olabilir) */
export function zeminKonturu(e: KonturRect, komsu: readonly KonturRect[]): KonturCizgi[] {
  const others = komsu.filter((o) => o !== e);
  // [x, y, görünür mü (bu noktadan sonrakine giden kenar)]
  const path: [number, number, boolean][] = [];
  const push = (x: number, y: number, vis: boolean) => path.push([x, y, vis]);
  // yan kenarın örtülmeyen aralıkları (yukarıdan aşağı, [y0, y1])
  const yanAcik = (x: number, y0: number, y1: number): [number, number][] => {
    if (!e.asili) {
      // düz zemin: aynı yükseklikte bitişik zemin varsa yan kenar yok
      const joined = others.some((o) => o.l <= x + 2 && o.r >= x - 2 && o.t <= e.t + 6 && o.b > e.t + 6);
      return joined ? [] : [[y0, Math.min(y1, e.t + YAN_BOY)]];
    }
    const cov = others.filter((o) => o.l <= x + 2 && o.r >= x - 2 && o.b > y0 && o.t < y1).map((o) => [Math.max(y0, o.t), Math.min(y1, o.b)] as const).sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = []; let y = y0;
    for (const [a, b] of cov) { if (a > y + 4) out.push([y, a]); y = Math.max(y, b); }
    if (y1 > y + 4) out.push([y, y1]);
    return out;
  };
  // altı boşta mı: hemen altında başka katı zemin yoksa (yerdeki sütunun tabanı zeminin kendi üst çizgisiyle zaten çizili)
  const altAcik = !!e.asili && !others.some((o) => o.l < e.r - 2 && o.r > e.l + 2 && o.t <= e.b + 6 && o.b > e.b);
  // alt köşe yuvarlak (zemin görseli gibi); yanına bitişik zemin varsa (birleşik görsel) köşe düz
  const bitisik = (x: number) => others.some((o) => o.l <= x + 2 && o.r >= x - 2 && o.t < e.b - 2 && o.b > e.b - 2);
  const radR = altAcik && !bitisik(e.r) ? koseR(e) : 0, radL = altAcik && !bitisik(e.l) ? koseR(e) : 0;
  // bir yan kenarı yolun sırasıyla ekler (aşağı: sağ yan, yukarı: sol yan)
  const yan = (x: number, from: number, to: number) => {
    const open = yanAcik(x, e.t, Math.max(from, to));
    const down = to > from;
    const marks = new Set<number>([from, to]); for (const [a, b] of open) { marks.add(a); marks.add(b); }
    const ys = [...marks].filter((y) => y >= Math.min(from, to) && y <= Math.max(from, to)).sort((a, b) => (down ? a - b : b - a));
    for (let i = 0; i < ys.length - 1; i++) { const mid = (ys[i]! + ys[i + 1]!) / 2; push(x, ys[i]!, open.some(([a, b]) => mid > a && mid < b)); }
  };
  // çeyrek yay (`son`: bitiş noktası da; yoksa onu sonraki adım ekler)
  const yay = (cx: number, cy: number, rad: number, a0: number, a1: number, son: boolean) => { const n = rad > 0 ? 6 : 1; for (let i = 0; i < n + (son && rad > 0 ? 1 : 0); i++) { const a = a0 + ((a1 - a0) * i) / n; push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, true); } };
  push(e.l, e.t, true); // üst kenar her zaman
  yan(e.r, e.t, e.b - radR);
  if (altAcik) { yay(e.r - radR, e.b - radR, radR, 0, Math.PI / 2, true); yay(e.l + radL, e.b - radL, radL, Math.PI / 2, Math.PI, false); }
  else push(e.r, e.b, false);
  yan(e.l, e.b - radL, e.t);
  // görünür kenarları kesintisiz kırık çizgilere topla (kapalı yol: görünmeyen bir kenardan sonra başlar)
  const n = path.length; const off = path.findIndex((p) => !p[2]);
  if (off < 0) return [{ pts: path.flatMap(([x, y]) => [x, y]), kapali: true }];
  const out: KonturCizgi[] = []; let cur: number[] | null = null;
  for (let k = 1; k <= n; k++) {
    const i = (off + k) % n; const [x, y, vis] = path[i]!;
    if (vis) { if (!cur) cur = [x, y]; else cur.push(x, y); }
    else if (cur) { cur.push(x, y); out.push({ pts: cur, kapali: false }); cur = null; }
  }
  return out;
}
