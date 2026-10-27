// Uygulama ikonu kavramları (YN-010, sahip kararı 6): elle yazılmış vektör SVG, dış görsel yok.
// Her kavram 1024×1024 çerçevede çizilir; özne (zemin hariç her şey) merkezde (512,512), `yaricap` içinde kalır.
//   zemin(sec)  tam kare zemin (koyu mor gece gökyüzü)
//   ozne(sec)   renkli özne; saydam zemine de oturur (uyarlanabilir ön yüz, açılış görseli)
//   mono(sec)   tek renk siluet (Android 13 temalı ikon): beyaz şekiller, yüz çizgileri oyuk
// Seçenek: { sade: true } küçük boyut için (yıldız tozu, ince parıltılar yok).
// Renkler oyunun tokenlarından: apps/web/src/styles.css (--bg-0 #140c35, --gold #ffc93c, --teal #2ee6d6),
// Odi çizimi apps/web/src/screens/TitleScreen.tsx (OdiHero) ve packages/game-core/src/render/hero.ts ile aynı.

const f = (n) => Math.round(n * 100) / 100;

/** ortak gece gökyüzü zemini: --bg-0 kenarlar, ortada mor ışık, açılış ekranındaki gibi turkuaz / mercan aurora */
function gece({ sade = false, isik = '#3b2795' } = {}) {
  const yildiz = [
    [160, 196, 5, '#fff6e5', 0.85], [842, 168, 4, '#ffe08a', 0.9], [884, 760, 4.5, '#fff', 0.6], [132, 812, 3.5, '#c9c1ff', 0.7],
    [262, 92, 3, '#fff', 0.55], [720, 92, 3.2, '#c9c1ff', 0.6], [948, 452, 3, '#fff6e5', 0.5], [78, 494, 3, '#fff', 0.45],
    [610, 950, 3.2, '#ffe08a', 0.55], [372, 944, 2.6, '#fff', 0.45],
  ];
  return {
    defs: `<radialGradient id="g-zemin" cx="50%" cy="44%" r="72%"><stop offset="0" stop-color="${isik}"/><stop offset=".52" stop-color="#1f1452"/><stop offset="1" stop-color="#120a30"/></radialGradient>
<radialGradient id="g-aur1" cx="14%" cy="6%" r="55%"><stop offset="0" stop-color="#2ee6d6" stop-opacity=".22"/><stop offset="1" stop-color="#2ee6d6" stop-opacity="0"/></radialGradient>
<radialGradient id="g-aur2" cx="90%" cy="96%" r="58%"><stop offset="0" stop-color="#ff5c8a" stop-opacity=".2"/><stop offset="1" stop-color="#ff5c8a" stop-opacity="0"/></radialGradient>`,
    body: `<rect width="1024" height="1024" fill="url(#g-zemin)"/><rect width="1024" height="1024" fill="url(#g-aur1)"/><rect width="1024" height="1024" fill="url(#g-aur2)"/>`
      + (sade ? '' : yildiz.map(([x, y, r, c, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`).join('')),
  };
}

/** dört kollu parıltı */
const parilti = (x, y, r, renk, op = 1) => `<path d="M${x} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${y}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${x} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${y}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${x} ${f(y - r)}Z" fill="${renk}" opacity="${op}"/>`;

// ===================================================================================== A · Odi
// Oyunun kahramanı: degrade küre, büyük parlak gözler, açık gülümseme; iki yanında ses dalgaları (sol altın, sağ turkuaz,
// açılış ekranındaki OdiHero ile aynı), arkasında altın-mor hale. Karakter odaklı, oyunu tek bakışta tanıtır.
// Çizim OdiHero'nun 200 birimlik koordinatlarında yapılır, 1024 çerçeveye ölçeklenir.
const ODI_K = 4.9; // 200 birim → 1024 (gövde yarıçapı 58 → 284 px)
const odiCerceve = (ic) => `<g transform="translate(512 512) scale(${ODI_K}) translate(-100 -103)">${ic}</g>`;
const odiDefs = `<radialGradient id="o-govde" cx="38%" cy="30%" r="74%"><stop offset="0" stop-color="#d6c9ff"/><stop offset=".36" stop-color="#8b6bff"/><stop offset=".78" stop-color="#5a36e0"/><stop offset="1" stop-color="#3b1fae"/></radialGradient>
<radialGradient id="o-hale" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffc93c" stop-opacity=".5"/><stop offset=".42" stop-color="#8b6bff" stop-opacity=".32"/><stop offset="1" stop-color="#8b6bff" stop-opacity="0"/></radialGradient>
<linearGradient id="o-kenar" x1="0" y1="0" x2="1" y2="1"><stop offset=".62" stop-color="#2ee6d6" stop-opacity="0"/><stop offset="1" stop-color="#2ee6d6" stop-opacity=".9"/></linearGradient>
<radialGradient id="o-golge" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#1a0b52" stop-opacity="0"/><stop offset="1" stop-color="#1a0b52" stop-opacity=".45"/></radialGradient>
<radialGradient id="o-alt" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#05021a" stop-opacity=".55"/><stop offset="1" stop-color="#05021a" stop-opacity="0"/></radialGradient>
<linearGradient id="o-goz" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#ddd3ff"/></linearGradient>
<radialGradient id="o-yanak" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff5c8a" stop-opacity=".62"/><stop offset="1" stop-color="#ff5c8a" stop-opacity="0"/></radialGradient>
<linearGradient id="o-altin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffc93c"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient>
<linearGradient id="o-turkuaz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8fff9"/><stop offset=".5" stop-color="#2ee6d6"/><stop offset="1" stop-color="#12a89e"/></linearGradient>`;
// ses dalgaları: merkez (100,103); iç yay yarıçap 44, dış yay 64, ±46° açıklık
const yay = (r, yon, aci = 46) => { const a = (aci * Math.PI) / 180; const x = 100 + yon * r * Math.cos(a), y0 = 103 - r * Math.sin(a), y1 = 103 + r * Math.sin(a); return `M${f(x)} ${f(y0)}A${r} ${r} 0 0 ${yon > 0 ? 1 : 0} ${f(x)} ${f(y1)}`; };
const odiDalgalar = (renkSol, renkSag, mono = false) => `<g fill="none" stroke-linecap="round">
<path d="${yay(85, -1, 34)}" stroke="${renkSol}" stroke-width="5.5" opacity="${mono ? 1 : 0.85}"/><path d="${yay(85, 1, 34)}" stroke="${renkSag}" stroke-width="5.5" opacity="${mono ? 1 : 0.85}"/>
<path d="${yay(71, -1, 42)}" stroke="${renkSol}" stroke-width="7.5"/><path d="${yay(71, 1, 42)}" stroke="${renkSag}" stroke-width="7.5"/></g>`;
function odiYuz() {
  return `<circle cx="70" cy="119" r="12" fill="url(#o-yanak)"/><circle cx="130" cy="119" r="12" fill="url(#o-yanak)"/>
<ellipse cx="79.5" cy="96" rx="14" ry="15.5" fill="url(#o-goz)"/><ellipse cx="120.5" cy="96" rx="14" ry="15.5" fill="url(#o-goz)"/>
<circle cx="81.5" cy="98.5" r="8" fill="#22153f"/><circle cx="122.5" cy="98.5" r="8" fill="#22153f"/>
<circle cx="84.6" cy="94.6" r="3.1" fill="#fff"/><circle cx="125.6" cy="94.6" r="3.1" fill="#fff"/>
<circle cx="78.6" cy="102" r="1.3" fill="#fff" opacity=".9"/><circle cx="119.6" cy="102" r="1.3" fill="#fff" opacity=".9"/>
<path d="M85.5 119.5Q100 122.5 114.5 119.5Q113.5 135.5 100 135.5Q86.5 135.5 85.5 119.5Z" fill="#22153f"/>
<clipPath id="o-agiz"><path d="M85.5 119.5Q100 122.5 114.5 119.5Q113.5 135.5 100 135.5Q86.5 135.5 85.5 119.5Z"/></clipPath>
<ellipse cx="100" cy="134" rx="9" ry="5.6" fill="#ff7a9a" clip-path="url(#o-agiz)"/>`;
}
export const odi = {
  ad: 'odi', baslik: 'A · Odi', aciklama: 'Oyunun kahramanı Odi; iki yanında ses dalgaları (altın ve turkuaz), altın hale.',
  yaricap: 435,
  zemin: (s = {}) => gece(s),
  ozne: ({ sade = false } = {}) => ({
    defs: odiDefs,
    body: odiCerceve(`<circle cx="100" cy="103" r="${sade ? 84 : 92}" fill="url(#o-hale)"/>
${odiDalgalar('url(#o-altin)', 'url(#o-turkuaz)')}
${sade ? '' : '<ellipse cx="100" cy="166" rx="44" ry="7" fill="url(#o-alt)"/>'}
<circle cx="100" cy="103" r="59.6" fill="#2d1a85"/>
<circle cx="100" cy="103" r="58" fill="url(#o-govde)"/>
<circle cx="100" cy="103" r="58" fill="url(#o-golge)"/>
<circle cx="100" cy="103" r="58" fill="url(#o-kenar)"/>
<path d="M51.6 81.7A53.5 53.5 0 0 1 78.4 53.9" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.6" stroke-linecap="round"/>
<ellipse cx="74" cy="69" rx="20" ry="10.5" transform="rotate(-30 74 69)" fill="#fff" opacity=".5"/>
<ellipse cx="68" cy="64.5" rx="6.4" ry="3.4" transform="rotate(-30 68 64.5)" fill="#fff" opacity=".92"/>
${odiYuz()}
${sade ? '' : parilti(158, 40, 7, '#fff3b0', 0.95) + parilti(30, 172, 4.5, '#c8fff9', 0.85)}`),
  }),
  mono: () => ({
    defs: `<mask id="o-mono"><rect x="-50" y="-50" width="300" height="300" fill="#fff"/>
<ellipse cx="79.5" cy="96" rx="14" ry="15.5" fill="#000"/><ellipse cx="120.5" cy="96" rx="14" ry="15.5" fill="#000"/>
<path d="M85.5 119.5Q100 122.5 114.5 119.5Q113.5 135.5 100 135.5Q86.5 135.5 85.5 119.5Z" fill="#000"/></mask>`,
    body: odiCerceve(`${odiDalgalar('#fff', '#fff', true)}<circle cx="100" cy="103" r="58" fill="#fff" mask="url(#o-mono)"/>
<circle cx="81.5" cy="98.5" r="8" fill="#fff"/><circle cx="122.5" cy="98.5" r="8" fill="#fff"/>`),
  }),
};

// ===================================================================================== B · Kulak
// Simge odaklı: altın çizgiyle tek hamlede kulak kepçesi; kepçenin içinde Koklea sarmalına dönüşür (dışarıdan gelen ses
// kulağın derinine yol alır). Soldan gelen ses dalgaları. Sakin, "işitme bilimi" duruşu.
const KULAK = {
  // sağ kulak, yüz solda: sarmal göbeğinden başlar, dışa açılıp kepçenin kıvrımına (heliks) bağlanır, kulak memesinde biter
  dis: 'M452 372C446 270 520 196 616 196C724 196 798 282 794 392C790 486 730 528 712 598C694 668 704 744 646 800C596 848 520 838 500 784',
  // kepçe gövdesi (dolgu): dış hat + ön kenar (kulak yolu / tragus) geri dönüş
  govde: 'M452 372C446 270 520 196 616 196C724 196 798 282 794 392C790 486 730 528 712 598C694 668 704 744 646 800C596 848 520 838 500 784C486 744 520 704 524 644C528 584 472 546 464 474C458 424 453 400 452 372Z',
};
function sarmal(cx, cy, r0, r1, donus, a0, n = 160) {
  // r0 dış yarıçap → r1 iç yarıçap, logaritmik; a0 başlangıç açısı (derece), saat yönü tersine içe kıvrılır
  const b = Math.log(r0 / r1) / (donus * 2 * Math.PI); const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const th = t * donus * 2 * Math.PI; const r = r0 * Math.exp(-b * th); const a = (a0 * Math.PI) / 180 - th; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
const yol = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
const kulakSarmal = sarmal(624, 420, 118, 20, 1.6, 150);
export const kulak = {
  ad: 'kulak', baslik: 'B · Kulak', aciklama: 'Altın çizgiyle kulak kepçesi; içinde Koklea sarmalı, soldan gelen ses dalgaları.',
  yaricap: 400,
  zemin: (s = {}) => gece(s),
  ozne: ({ sade = false } = {}) => ({
    defs: `<linearGradient id="k-altin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffc93c"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient>
<linearGradient id="k-govde" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#8b6bff"/><stop offset=".6" stop-color="#5a36e0"/><stop offset="1" stop-color="#3b1fae"/></linearGradient>
<radialGradient id="k-hale" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffc93c" stop-opacity=".34"/><stop offset=".5" stop-color="#8b6bff" stop-opacity=".22"/><stop offset="1" stop-color="#8b6bff" stop-opacity="0"/></radialGradient>`,
    body: `<circle cx="600" cy="500" r="400" fill="url(#k-hale)"/>
<g fill="none" stroke-linecap="round" stroke="url(#k-altin)">
<path d="M330 362A200 200 0 0 0 330 638" stroke-width="34"/>
<path d="M238 300A290 290 0 0 0 238 700" stroke-width="26" opacity=".85"/>
${sade ? '' : '<path d="M150 246A380 380 0 0 0 150 754" stroke-width="18" opacity=".7"/>'}</g>
<path d="${KULAK.govde}" fill="url(#k-govde)" opacity=".95"/>
<path d="${KULAK.govde}" fill="none" stroke="url(#k-altin)" stroke-width="16" stroke-linejoin="round"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="url(#k-altin)">
<path d="${KULAK.dis}" stroke-width="46"/>
<path d="${yol(kulakSarmal)}" stroke-width="34"/></g>
<path d="${KULAK.dis}" fill="none" stroke="#fff6d0" stroke-opacity=".55" stroke-width="8" stroke-linecap="round" transform="translate(-6 -8)"/>
${sade ? '' : parilti(812, 214, 26, '#fff3b0', 0.95)}`,
  }),
  mono: () => ({
    defs: '',
    body: `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="#fff">
<path d="M330 362A200 200 0 0 0 330 638" stroke-width="34"/><path d="M238 300A290 290 0 0 0 238 700" stroke-width="30"/>
<path d="${KULAK.dis}" stroke-width="46"/><path d="${yol(kulakSarmal)}" stroke-width="34"/></g>`,
  }),
};

// ===================================================================================== C · Koklea yolu
// Oyunun haritası: Koklea'nın 2,5 turu bir yol olarak, tabandan (ince sesler, mor) tepeye (kalın sesler, turuncu)
// tonotopik renklerle (packages/game-core/src/render/util.ts tono()). Tabanda Odi yola çıkıyor; tepede altın parıltı.
const TONO = ['#8b6bff', '#4c8dff', '#2ee6d6', '#8ef06a', '#ffd23c', '#ff8a2c'];
const tono = (t) => { const x = Math.max(0, Math.min(0.9999, t)) * (TONO.length - 1); const i = Math.floor(x); const a = TONO[i], b = TONO[i + 1]; const k = x - i;
  const c = (h, s) => parseInt(h.slice(s, s + 2), 16); const m = (s) => Math.round(c(a, s) * (1 - k) + c(b, s) * k).toString(16).padStart(2, '0'); return `#${m(1)}${m(3)}${m(5)}`; };
const KOKLEA = { cx: 512, cy: 530, r0: 350, r1: 44, donus: 2.5, a0: 120 };
const kokleaNokta = sarmal(KOKLEA.cx, KOKLEA.cy, KOKLEA.r0, KOKLEA.r1, KOKLEA.donus, KOKLEA.a0, 240);
function kokleaYol(mono) {
  const n = kokleaNokta.length - 1; let s = '';
  for (let i = 0; i < n; i++) {
    const t = i / n; const w = 92 - 58 * t; const [x0, y0] = kokleaNokta[i], [x1, y1] = kokleaNokta[i + 1];
    s += `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" stroke="${mono ? '#fff' : tono(t)}" stroke-width="${f(w)}"/>`;
  }
  return `<g fill="none" stroke-linecap="round">${s}</g>`;
}
const [odiX, odiY] = kokleaNokta[26]; // Odi yolun ilk dönemecinde (taban ucunda değil: sarmal + baş salyangoz gibi okunmasın)
export const koklea = {
  ad: 'koklea', baslik: 'C · Koklea yolu', aciklama: 'Koklea’nın 2,5 turu oyunun yolu olarak (tonotopik renkler); yolun ilk dönemecinde Odi, tepede altın parıltı.',
  yaricap: 420,
  zemin: (s = {}) => gece(s),
  ozne: ({ sade = false } = {}) => ({
    defs: `<radialGradient id="c-odi" cx="38%" cy="30%" r="74%"><stop offset="0" stop-color="#d6c9ff"/><stop offset=".36" stop-color="#8b6bff"/><stop offset=".78" stop-color="#5a36e0"/><stop offset="1" stop-color="#3b1fae"/></radialGradient>
<radialGradient id="c-tepe" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc93c" stop-opacity=".55"/><stop offset="1" stop-color="#ff9f1c" stop-opacity="0"/></radialGradient>`,
    body: `<g opacity=".55" transform="translate(0 14)">${kokleaYol(true).replace(/stroke="#fff"/g, 'stroke="#0a0520"')}</g>
${kokleaYol(false)}
<path d="${yol(kokleaNokta)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="10" stroke-linecap="round" transform="translate(-8 -10)"/>
<circle cx="${KOKLEA.cx}" cy="${KOKLEA.cy}" r="110" fill="url(#c-tepe)"/>${parilti(KOKLEA.cx, KOKLEA.cy, 54, '#fffbe0')}
<g transform="translate(${f(odiX)} ${f(odiY)})"><circle r="104" fill="#2d1a85"/><circle r="100" fill="url(#c-odi)"/>
<ellipse cx="-44" cy="-56" rx="30" ry="16" transform="rotate(-30 -44 -56)" fill="#fff" opacity=".5"/>
<ellipse cx="-10" cy="-14" rx="23" ry="26" fill="#fff"/><ellipse cx="44" cy="-14" rx="23" ry="26" fill="#fff"/>
<circle cx="-4" cy="-8" r="13" fill="#22153f"/><circle cx="50" cy="-8" r="13" fill="#22153f"/><circle cx="1" cy="-14" r="5" fill="#fff"/><circle cx="55" cy="-14" r="5" fill="#fff"/>
<path d="M2 30Q20 34 38 30Q36 54 20 54Q4 54 2 30Z" fill="#22153f"/></g>`,
  }),
  mono: () => ({
    defs: `<mask id="c-mono"><rect width="1024" height="1024" fill="#fff"/><g transform="translate(${f(odiX)} ${f(odiY)})"><ellipse cx="-10" cy="-14" rx="23" ry="26" fill="#000"/><ellipse cx="44" cy="-14" rx="23" ry="26" fill="#000"/><path d="M2 30Q20 34 38 30Q36 54 20 54Q4 54 2 30Z" fill="#000"/></g></mask>`,
    body: `${kokleaYol(true)}<circle cx="${f(odiX)}" cy="${f(odiY)}" r="112" fill="#000" opacity="1"/><g mask="url(#c-mono)"><circle cx="${f(odiX)}" cy="${f(odiY)}" r="100" fill="#fff"/></g>
<g transform="translate(${f(odiX)} ${f(odiY)})" fill="#fff"><circle cx="-4" cy="-8" r="13"/><circle cx="50" cy="-8" r="13"/></g>`,
  }),
};

export const KAVRAMLAR = { odi, kulak, koklea };

/**
 * Bir kavramdan tam SVG üret.
 * @param k kavram
 * @param o.tur 'tam' (zemin + özne), 'ozne' (saydam zemin), 'mono' (tek renk siluet), 'zemin' (yalnız zemin)
 * @param o.olcek öznenin ölçeği (merkez 512,512)
 * @param o.kose köşe yarıçapı (px, 1024 ölçeğinde; favicon için); 0 = kare
 */
export function kavramSvg(k, { tur = 'tam', olcek = 1, kose = 0, sade = false } = {}) {
  const z = tur === 'tam' || tur === 'zemin' ? k.zemin({ sade }) : { defs: '', body: '' };
  const o = tur === 'mono' ? k.mono({ sade }) : tur === 'zemin' ? { defs: '', body: '' } : k.ozne({ sade });
  const ozne = olcek === 1 ? o.body : `<g transform="translate(512 512) scale(${olcek}) translate(-512 -512)">${o.body}</g>`;
  const klip = kose > 0 ? `<clipPath id="kose"><rect width="1024" height="1024" rx="${kose}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${z.defs}${o.defs}${klip}</defs><g${kose > 0 ? ' clip-path="url(#kose)"' : ''}>${z.body}${ozne}</g></svg>`;
}
