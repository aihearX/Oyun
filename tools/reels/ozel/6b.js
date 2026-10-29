/* ODİ Reels 6. dalga (B) ek çizimleri: overlay.html katmanı { kind: 'ozel', fn: '<ad>', ... } (reel.scripts: ['ozel/6b.js']).
 * Her çizim: setup(inner, L, ids) DOM'u kurar; draw(inner, a, L, { lt, t, dur }) a (katmanın yerel saniyesi) anını çizer ve
 * değişmeyen kareleri atlamak için bir imza döndürür. Hepsi özgün SVG; fotoğraf, marka ya da hazır görsel yok.
 * Yazı tipi: overlay.html'deki Baloo 2 / Nunito (OFL). Renkler "Kulak Gecesi" paleti (altın, turkuaz, mercan, krem, lavanta).
 */
(() => {
  const O = (window.OZEL = window.OZEL || {});
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const backOut = (x) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const f2 = (x) => x.toFixed(2);
  const css = (txt) => { const s = document.createElement('style'); s.textContent = txt; document.head.appendChild(s); };
  const GOLD = '#ffc93c', TEAL = '#2ee6d6', CORAL = '#ff5c8a', CREAM = '#fff6e5', LAV = '#c9c1ff', INK = '#14082e';

  css(`
  .ozel { position:relative; }
  .ozel svg { overflow:visible; display:block; }
  .ozel text { font-family:'Nunito','Baloo 2',sans-serif; font-weight:900; }
  .oz-full { position:relative; width:1080px; height:1920px; }
  .oz-tile { position:absolute; left:0; top:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:10px 18px 6px;
    border-radius:22px; font:900 40px/1.05 'Nunito','Baloo 2',sans-serif; color:${INK}; background:${CREAM}; border:5px solid ${INK};
    box-shadow:0 10px 0 rgba(20,8,46,.55), 0 18px 34px rgba(0,0,0,.45); will-change:transform; }
  .oz-tile .n { position:absolute; left:-26px; top:50%; width:58px; height:58px; margin-top:-29px; border-radius:50%; display:grid; place-items:center;
    font:800 34px/1 'Baloo 2',sans-serif; color:${INK}; background:linear-gradient(180deg,#fff3b0,${GOLD} 55%,#ff9f1c); border:4px solid ${INK}; padding-top:4px; }
  .oz-tile .g { position:absolute; right:14px; top:8px; font:900 20px/1 'Nunito',sans-serif; letter-spacing:2px; text-transform:uppercase; opacity:.75; }
  /* 6b sınıfları: köşe imzası, özet kartı, etiket, harekete çağrı, kaynak notu */
  .kose6 { display:inline-flex; align-items:center; gap:10px; padding:10px 20px 8px 14px; border-radius:999px; background:rgba(16,9,46,.72); border:3px solid rgba(255,201,60,.7);
    font:900 26px/1 'Nunito',sans-serif; letter-spacing:3px; color:${CREAM}; text-transform:uppercase; }
  .kose6 b { font:800 34px/1 'Baloo 2',sans-serif; letter-spacing:1px; color:${GOLD}; } .kose6 b span { color:${TEAL}; }
  .tag6 { padding:14px 26px 10px; border-radius:18px; font:900 38px/1.05 'Nunito',sans-serif; text-align:center; color:#fff; background:${CORAL}; border:5px solid ${INK}; box-shadow:0 8px 0 rgba(20,8,46,.55); }
  .tag6.ok { background:#1fc4a0; } .tag6.gold { background:${GOLD}; color:${INK}; } .tag6.ink { background:rgba(16,9,46,.9); border-color:${LAV}; }
  .big6 { text-align:center; font:800 104px/1 'Baloo 2',sans-serif; text-transform:uppercase; color:#fff; text-shadow:0 7px 0 rgba(10,5,30,.6), 0 0 34px rgba(10,5,30,.8); padding:0 50px; }
  .big6 em { font-style:normal; color:${GOLD}; } .big6 i { font-style:normal; color:${TEAL}; } .big6 u { text-decoration:none; color:${CORAL}; }
  .big6.sm { font-size:78px; } .big6.xs { font-size:60px; } .big6.lo { text-transform:none; }
  .lead6 { text-align:center; font:900 46px/1.2 'Nunito',sans-serif; color:${CREAM}; padding:0 90px; text-shadow:0 3px 0 rgba(10,5,30,.8), 0 0 18px rgba(10,5,30,.9); }
  .lead6 b { color:${GOLD}; } .lead6 i { font-style:normal; color:${TEAL}; }
  .src6 { font:800 26px/1.25 'Nunito',sans-serif; color:${LAV}; text-align:center; padding:0 120px; opacity:.95; text-shadow:0 0 12px rgba(0,0,0,.9); }
  .kart6 { width:940px; padding:34px 40px 28px; border-radius:42px; background:${CREAM}; color:${INK}; border:7px solid ${INK}; box-shadow:0 18px 0 rgba(20,8,46,.55), 0 30px 70px rgba(0,0,0,.5); }
  .kart6 h3 { display:flex; align-items:center; gap:16px; font:800 58px/1 'Baloo 2',sans-serif; letter-spacing:2px; text-transform:uppercase; margin:6px 0 12px; }
  .kart6 h3 small { font:900 26px/1 'Nunito',sans-serif; letter-spacing:1px; text-transform:none; color:#6b4ea8; }
  .kart6 .r { display:flex; align-items:center; gap:18px; font:900 38px/1.15 'Nunito',sans-serif; padding:10px 0; border-top:3px dashed rgba(20,8,46,.18); }
  .kart6 .r b { flex:none; min-width:250px; } .kart6 .r .ar { flex:none; font:800 44px/1 'Baloo 2',sans-serif; color:#7b5ce0; }
  .kart6 .c { color:#d93a6a; } .kart6 .t { color:#0b8f86; } .kart6 .g { color:#b86a08; }
  .kart6 .ft { margin-top:14px; padding:14px 20px 10px; border-radius:20px; background:#ffe3ec; color:#7a1838; font:900 32px/1.2 'Nunito',sans-serif; text-align:center; }
  .kart6 .src { margin-top:10px; font:800 22px/1.2 'Nunito',sans-serif; color:#6b4ea8; text-align:center; }
  .cta6 { display:inline-flex; align-items:center; gap:22px; padding:22px 40px 18px; border-radius:30px; background:linear-gradient(180deg,#e9fffc,${TEAL} 60%,#12a89e); color:#062a28;
    font:900 48px/1.12 'Nunito',sans-serif; text-align:left; border:5px solid ${INK}; box-shadow:0 10px 0 rgba(5,70,66,.65), 0 0 50px rgba(46,230,214,.45); max-width:900px; }
  .cta6.gold { background:linear-gradient(180deg,#fff3b0,${GOLD} 55%,#ff9f1c); color:${INK}; box-shadow:0 10px 0 rgba(138,69,0,.6), 0 0 50px rgba(255,201,60,.5); }
  .cta6 svg { flex:none; }
  .son6 { display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; }
  .son6 .a { font:900 40px/1.2 'Nunito',sans-serif; color:${CREAM}; } .son6 .b { font:900 44px/1.15 'Nunito',sans-serif; color:${GOLD}; }
  .son6 .c { margin-top:8px; padding:16px 44px 12px; border-radius:999px; font:900 44px/1 'Nunito',sans-serif; color:#062a28; background:linear-gradient(180deg,#e9fffc,${TEAL} 60%,#12a89e); box-shadow:0 8px 0 rgba(5,70,66,.6); }
  .oz-rung { position:absolute; left:50%; display:flex; align-items:center; justify-content:center; border-radius:999px; font:800 64px/1 'Baloo 2',sans-serif; letter-spacing:1px; will-change:transform; }
  `);

  /* ------------------------------------------------------------------ diyapazon (tuning fork) */
  // titreşim: kollar ±d kayar (iki yarı saydam kopya = hareket bulanıklığı), yanlarda titreşim yayları; d = amp · e^(−(a−vuruş)/τ)
  function forkSVG(id, label) {
    return `<defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d93a8"/><stop offset=".35" stop-color="#f4f6fb"/><stop offset=".6" stop-color="#c9cedb"/><stop offset="1" stop-color="#7d8397"/></linearGradient></defs>
      <g class="vib" fill="none" stroke="${TEAL}" stroke-width="7" stroke-linecap="round">
        <path class="va" d="M22 70 Q4 140 22 210"/><path class="va" d="M4 50 Q-22 140 4 230" opacity=".55"/>
        <path class="vb" d="M178 70 Q196 140 178 210"/><path class="vb" d="M196 50 Q222 140 196 230" opacity=".55"/></g>
      <g class="tl"><rect x="52" y="20" width="26" height="250" rx="13" fill="url(#${id}m)" stroke="#4b5068" stroke-width="3"/></g>
      <g class="tr"><rect x="122" y="20" width="26" height="250" rx="13" fill="url(#${id}m)" stroke="#4b5068" stroke-width="3"/></g>
      <path d="M52 250 Q52 320 100 320 Q148 320 148 250 L122 250 Q122 292 100 292 Q78 292 78 250 Z" fill="url(#${id}m)" stroke="#4b5068" stroke-width="3"/>
      <rect x="88" y="312" width="24" height="170" rx="10" fill="url(#${id}m)" stroke="#4b5068" stroke-width="3"/>
      <ellipse cx="100" cy="488" rx="22" ry="14" fill="url(#${id}m)" stroke="#4b5068" stroke-width="3"/>
      ${label ? `<text x="100" y="430" text-anchor="middle" transform="rotate(-90 100 430)" style="font-size:17px;fill:#3b3f55;letter-spacing:1px">${label}</text>` : ''}`;
  }
  function forkAmp(a, L) {
    let d = 0; for (const s of L.strikes ?? [0]) if (a >= s) d = Math.max(d, Math.exp(-(a - s) / (L.tau ?? 2.2)));
    if (L.stopAt != null && a >= L.stopAt) d *= clamp(1 - (a - L.stopAt) / 0.25);
    return d;
  }
  function forkDraw(g, a, L) {
    const d = forkAmp(a, L); const amp = (L.amp ?? 9) * d; const ph = Math.floor(a * 30) % 2 ? 1 : -1;  // kare başına yön değişir
    const tl = g.querySelector('.tl'), tr = g.querySelector('.tr');
    tl.setAttribute('transform', `translate(${f2(-amp * (ph > 0 ? 1 : 0.4))} 0)`); tr.setAttribute('transform', `translate(${f2(amp * (ph > 0 ? 1 : 0.4))} 0)`);
    g.querySelectorAll('.va,.vb').forEach((p, i) => { p.style.opacity = f2(clamp(d * 1.3) * (i % 2 ? 0.5 : 1)); });
    return f2(amp) + ph;
  }
  O.diyapazon = {
    setup(inner, L, { si, li }) {
      const s = L.size ?? 1; inner.innerHTML = `<svg width="${200 * s}" height="${500 * s}" viewBox="0 0 200 500"><g class="fk">${forkSVG(`fk${si}_${li}`, L.label ?? '512 Hz')}</g></svg>`;
      L._g = inner.querySelector('.fk');
    },
    draw(inner, a, L) { return forkDraw(L._g, a, L); },
  };

  /* ------------------------------------------------------------------ önden baş (Weber) */
  // L: { kotu: 'L'|'R'|null (izleyiciye göre sol/sağ), tip: 'iletim'|'sn', heard: 'L'|'R'|'both', heardAt, strikes }
  const EAR_L = 'M118 330 C70 318 62 380 70 420 C78 470 100 500 128 492', EAR_R = 'M582 330 C630 318 638 380 630 420 C622 470 600 500 572 492';
  function headFront(id, L) {
    const plug = (x, side) => `<g class="plug"><ellipse cx="${x}" cy="414" rx="22" ry="26" fill="#b8742a" stroke="#5a3108" stroke-width="4"/><ellipse cx="${x - side * 6}" cy="404" rx="7" ry="9" fill="#ffd38a" opacity=".7"/></g>`;
    const coch = (x) => `<g class="coch" transform="translate(${x} 414)"><circle r="34" fill="rgba(20,8,46,.75)" stroke="${CORAL}" stroke-width="4"/><path d="M0 0 m-2 -3 a5 5 0 1 1 6 6 a10 10 0 1 1 -14 -12 a16 16 0 1 1 22 20" fill="none" stroke="#9a8fc4" stroke-width="4" stroke-linecap="round"/><path d="M-20 -20 L20 20 M20 -20 L-20 20" stroke="${CORAL}" stroke-width="6" stroke-linecap="round"/></g>`;
    let bad = '';
    if (L.kotu) { const x = L.kotu === 'L' ? 100 : 600; bad = L.tip === 'sn' ? coch(L.kotu === 'L' ? 34 : 666) : plug(x, L.kotu === 'L' ? 1 : -1); }
    const waves = (cx, dir, cls) => `<g class="${cls}" fill="none" stroke="${GOLD}" stroke-linecap="round">${[0, 1, 2].map((k) => `<path class="w${k}" d="M${cx + dir * (30 + k * 34)} ${414 - 40 - k * 22} Q${cx + dir * (52 + k * 40)} 414 ${cx + dir * (30 + k * 34)} ${414 + 40 + k * 22}" stroke-width="${12 - k * 2}"/>`).join('')}</g>`;
    return `<defs><radialGradient id="${id}h" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#efeaff"/><stop offset=".6" stop-color="#b8acf0"/><stop offset="1" stop-color="#7d6bd6"/></radialGradient>
      <clipPath id="${id}c"><ellipse cx="350" cy="380" rx="232" ry="292"/></clipPath></defs>
      <path d="M190 640 Q350 700 510 640 L560 760 L140 760 Z" fill="#5a46b8" opacity=".9"/>
      <path d="${EAR_L}" fill="#c9bff7" stroke="#3b2a8a" stroke-width="8" stroke-linecap="round"/><path d="${EAR_R}" fill="#c9bff7" stroke="#3b2a8a" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="350" cy="380" rx="232" ry="292" fill="url(#${id}h)" stroke="#3b2a8a" stroke-width="8"/>
      <g clip-path="url(#${id}c)"><g class="rip" fill="none" stroke="${TEAL}" stroke-width="6">${[0, 1, 2, 3].map((k) => `<circle class="r${k}" cx="350" cy="96" r="10"/>`).join('')}</g></g>
      <path d="M262 360 q22 -14 44 0 M394 360 q22 -14 44 0" fill="none" stroke="#3b2a8a" stroke-width="8" stroke-linecap="round"/>
      <path d="M312 470 q38 22 76 0" fill="none" stroke="#3b2a8a" stroke-width="8" stroke-linecap="round"/>
      <circle cx="262" cy="430" r="20" fill="${CORAL}" opacity=".3"/><circle cx="438" cy="430" r="20" fill="${CORAL}" opacity=".3"/>
      ${waves(60, -1, 'hL')}${waves(640, 1, 'hR')}${bad}
      <g class="fk" transform="translate(308 -113) scale(.42)">${forkSVG(id + 'f', '')}</g>`;
  }
  O.basOn = {
    setup(inner, L, { si, li }) {
      const s = L.size ?? 1; inner.innerHTML = `<svg width="${700 * s}" height="${865 * s}" viewBox="0 -105 700 865">${headFront(`bo${si}_${li}`, L)}</svg>`;
      L._fk = inner.querySelector('.fk'); L._rip = [...inner.querySelectorAll('.rip circle')]; L._hL = inner.querySelector('.hL'); L._hR = inner.querySelector('.hR');
    },
    draw(inner, a, L) {
      const sig = forkDraw(L._fk, a, { strikes: L.strikes ?? [0.1], amp: 14, tau: L.tau ?? 3 });
      const d = forkAmp(a, { strikes: L.strikes ?? [0.1], tau: L.tau ?? 3 });
      L._rip.forEach((c, k) => { const q = ((a * 0.9 + k / 4) % 1); c.setAttribute('r', f2(10 + q * 560)); c.style.opacity = f2((1 - q) * 0.5 * clamp(d * 1.5)); });
      const on = clamp((a - (L.heardAt ?? 0.6)) / 0.3); const h = L.heard ?? 'both';
      const pulse = (g, w) => g.querySelectorAll('path').forEach((p, k) => { const q = (a * 1.6 - k * 0.22) % 1; p.style.opacity = f2(w * on * (0.35 + 0.65 * Math.max(0, Math.sin(Math.PI * q)))); });
      pulse(L._hL, h === 'both' ? 0.6 : h === 'L' ? 1 : 0); pulse(L._hR, h === 'both' ? 0.6 : h === 'R' ? 1 : 0);
      const gl = h === 'L' ? L._hL : h === 'R' ? L._hR : null; if (gl) gl.style.filter = on > 0 ? `drop-shadow(0 0 ${f2(10 + 12 * on)}px rgba(255,201,60,.9))` : 'none';
      return sig + f2(a);
    },
  };

  /* ------------------------------------------------------------------ yandan baş (Rinne): diyapazon mastoidden kulak önüne */
  // L: { moveAt (sn), strikes }  — profil sola bakar; kulak (420,380), mastoid kemiği kulak arkası-altı (505,470)
  O.basYan = {
    setup(inner, L, { si, li }) {
      const id = `by${si}_${li}`, s = L.size ?? 1;
      inner.innerHTML = `<svg width="${700 * s}" height="${760 * s}" viewBox="0 0 700 760"><defs><radialGradient id="${id}h" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#efeaff"/><stop offset=".6" stop-color="#b8acf0"/><stop offset="1" stop-color="#7d6bd6"/></radialGradient></defs>
        <path d="M250 640 Q400 690 520 640 L570 760 L210 760 Z" fill="#5a46b8" opacity=".9"/>
        <path d="M360 90 C520 80 610 190 600 360 C594 470 560 540 500 590 L470 660 L300 660 L292 600 C240 600 196 590 184 548 C176 520 186 500 174 486 C160 470 140 466 146 446 C152 428 168 424 160 404 C150 384 122 382 130 360 C150 330 176 300 176 250 C176 150 240 96 360 90 Z" fill="url(#${id}h)" stroke="#3b2a8a" stroke-width="8" stroke-linejoin="round"/>
        <path d="M232 318 q20 -10 40 2" fill="none" stroke="#3b2a8a" stroke-width="8" stroke-linecap="round"/>
        <g class="mast"><circle cx="505" cy="478" r="30" fill="rgba(255,246,229,.9)" stroke="${GOLD}" stroke-width="6"/><circle class="mp" cx="505" cy="478" r="30" fill="none" stroke="${GOLD}" stroke-width="6"/></g>
        <path d="M430 300 C500 290 520 360 506 410 C494 456 456 470 430 452 C412 440 420 418 438 414 C460 408 466 380 452 362 C440 346 420 350 414 334 C410 318 416 304 430 300 Z" fill="#c9bff7" stroke="#3b2a8a" stroke-width="8" stroke-linejoin="round"/>
        <ellipse cx="428" cy="388" rx="11" ry="15" fill="#3b2a8a"/>
        <g class="cnl"><circle class="cp" cx="428" cy="388" r="26" fill="none" stroke="${TEAL}" stroke-width="6"/></g>
        <g class="fk">${forkSVG(id + 'f', '')}</g></svg>`;
      L._fk = inner.querySelector('.fk'); L._mp = inner.querySelector('.mp'); L._cp = inner.querySelector('.cp');
    },
    draw(inner, a, L) {
      const mv = L.moveAt ?? 99; const p = easeIO(clamp((a - mv) / 0.45));
      // 1: sap mastoidde (kollar yukarı-sağa yatık) → 2: kollar kanal ağzının yanında, dik
      const A = { x: 505, y: 478, r: 28, s: 0.5 }, B = { x: 372, y: 539, r: 0, s: 0.5 };
      const x = A.x + (B.x - A.x) * p, y = A.y + (B.y - A.y) * p, r = A.r + (B.r - A.r) * p;
      // forkSVG'de sap ucu (100,488): o nokta (x,y)'ye otursun
      L._fk.setAttribute('transform', `translate(${f2(x)} ${f2(y)}) rotate(${f2(r)}) scale(${A.s}) translate(-100 -488)`);
      if (p > 0 && p < 1) L._fk.setAttribute('transform', `translate(${f2(x)} ${f2(y - Math.sin(Math.PI * p) * 120)}) rotate(${f2(r)}) scale(${A.s}) translate(-100 -488)`);
      const sig = forkDraw(L._fk, a, { strikes: L.strikes ?? [0.1], amp: 14, tau: L.tau ?? 3 });
      const q = (a * 1.3) % 1;
      L._mp.setAttribute('r', f2(30 + q * 40)); L._mp.style.opacity = f2((1 - q) * (1 - p) * (a < mv ? 1 : 0));
      L._cp.setAttribute('r', f2(26 + q * 40)); L._cp.style.opacity = f2((1 - q) * p);
      return sig + f2(p) + f2(q);
    },
  };
  // Rinne'de kolların konumu (B) bir kulak çizimine göre ayarlı: diyapazon kulak kepçesinin önünde, kanal ağzına ≈2 cm

  /* ------------------------------------------------------------------ süre çubukları (Rinne: kemik yolu ↔ hava yolu) */
  // L: { bars: [{ label, sub, color, from, to, len (0..1) }], w } — çubuk from..to arasında len'e dolar; dolunca "duymuyor" işareti
  O.sureler = {
    setup(inner, L) {
      const w = L.w ?? 860;
      inner.innerHTML = `<div style="width:${w}px;display:flex;flex-direction:column;gap:30px">${L.bars.map((b, i) => `
        <div class="sb" data-i="${i}" style="opacity:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px"><span style="font:900 46px/1 Nunito,sans-serif;color:${CREAM};text-shadow:0 3px 0 rgba(10,5,30,.7)">${b.label}</span><span style="font:800 32px/1 Nunito,sans-serif;color:${LAV}">${b.sub ?? ''}</span></div>
          <div style="position:relative;height:64px;border-radius:32px;background:rgba(16,9,46,.85);border:5px solid rgba(201,193,255,.45);overflow:hidden">
            <div class="fill" style="position:absolute;left:0;top:0;bottom:0;width:0;border-radius:32px;background:linear-gradient(90deg,${b.color}88,${b.color});box-shadow:0 0 30px ${b.color}"></div></div></div>`).join('')}</div>`;
      L._b = [...inner.querySelectorAll('.sb')];
    },
    draw(inner, a, L) {
      let sig = '';
      L.bars.forEach((b, i) => {
        const el = L._b[i]; el.style.opacity = f2(clamp((a - (b.show ?? b.from - 0.2)) / 0.2));
        const p = clamp((a - b.from) / Math.max(0.01, b.to - b.from)); el.querySelector('.fill').style.width = (p * (b.len ?? 1) * 100).toFixed(2) + '%'; sig += f2(p);
      });
      return sig;
    },
  };

  /* ------------------------------------------------------------------ kulaktan beyne: karışık kartlar → doğru sıra */
  // L: { items: [{ t, g }] (doğru sırada), shuffle: [doğru sıra indisi…] (ekrandaki karışık düzen), revealAt, step, grid: { y0, ... }, list: { y0, h } }
  O.sirala = {
    setup(inner, L) {
      inner.className = 'ozel oz-full';
      const n = L.items.length; const sh = L.shuffle;
      // karışık yerleşim: 2 sütun, hafif eğik "yapışkan not" kartları
      const cols = 2, cw = 452, ch = 118, gx = 34, x0 = (1080 - cols * cw - gx) / 2, y0 = L.gridY ?? 500, gy = 16;
      L._pos = []; L._el = [];
      const rot = [-3, 2.5, 1.5, -2, 3, -1.5, 2, -2.5, 1, -3, 2.5, -1, 1.5, -2];
      sh.forEach((ord, k) => {
        const c = k % cols, r = Math.floor(k / cols);
        const lastOdd = n % 2 && k === n - 1;
        const x = lastOdd ? (1080 - cw) / 2 : x0 + c * (cw + gx), y = y0 + r * (ch + gy);
        L._pos[ord] = { x, y, w: cw, h: ch, r: rot[k % rot.length] };
      });
      const ly0 = L.listY ?? 330, lh = L.listH ?? 80, lw = 780, lx = (1080 - lw) / 2 + 30;
      L._dst = L.items.map((_, i) => ({ x: lx, y: ly0 + i * lh, w: lw, h: lh - 12, r: 0 }));
      L.items.forEach((it, i) => {
        const d = document.createElement('div'); d.className = 'oz-tile'; d.innerHTML = `<span class="tx">${it.t}</span><span class="n" style="opacity:0">${i + 1}</span>${it.g ? `<span class="g" style="opacity:0">${it.g}</span>` : ''}`;
        d.style.background = CREAM; inner.appendChild(d); L._el[i] = d;
      });
    },
    draw(inner, a0, L) {
      const a = a0 + (L.t0 ?? 0);  // sahneler arası süreklilik: t0 = önceki sahnelerde geçen süre
      const R = L.revealAt ?? 99, st = L.step ?? 0.32, T = 0.42; let sig = '';
      L.items.forEach((it, i) => {
        const el = L._el[i], A = L._pos[i], B = L._dst[i];
        const intro = clamp((a - 0.05 * L.shuffle.indexOf(i)) / 0.35); const ib = backOut(intro);
        const p = easeIO(clamp((a - R - i * st) / T));
        const wob = p > 0 ? 0 : Math.sin(a * 2.2 + i * 1.7) * 1.2;
        const x = A.x + (B.x - A.x) * p, y = A.y + (B.y - A.y) * p - Math.sin(Math.PI * p) * 60, w = A.w + (B.w - A.w) * p, h = A.h + (B.h - A.h) * p;
        const r = (A.r + wob) * (1 - p); const s = 0.3 + 0.7 * ib;
        el.style.width = w.toFixed(1) + 'px'; el.style.height = h.toFixed(1) + 'px';
        el.style.fontSize = (40 - 6 * p).toFixed(1) + 'px';
        el.style.transform = `translate(${x.toFixed(1)}px, ${(y + (1 - ib) * 120).toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
        el.style.opacity = f2(clamp(intro * 3));
        const done = p >= 1; const lab = clamp((a - R - i * st - T * 0.6) / 0.15); el.querySelector('.n').style.opacity = f2(lab);
        const gl = el.querySelector('.g'); if (gl) gl.style.opacity = f2(lab * 0.8);
        el.style.background = lab > 0.5 && it.c ? it.c : CREAM; el.style.justifyContent = p > 0.5 ? 'flex-start' : 'center'; el.style.paddingLeft = p > 0.5 ? '52px' : '18px';
        el.style.boxShadow = done ? `0 8px 0 rgba(20,8,46,.55), 0 0 ${18 + 10 * Math.max(0, Math.sin(a * 4 - i * 0.5))}px rgba(255,201,60,.75)` : '';
        el.style.zIndex = p > 0 && p < 1 ? 5 : 1;
        sig += `${x.toFixed(0)},${y.toFixed(0)},${r.toFixed(1)},${s.toFixed(2)}|`;
      });
      return sig;
    },
  };

  /* ------------------------------------------------------------------ dB cetveli (dikey, 0–120 dB): işaretler cevapla eklenir */
  // L: { marks: [{ v, v2?, label, at, c }], h, y0, line85At? }
  O.dbCetvel = {
    setup(inner, L, { si, li }) {
      const gid = `dbg${si}_${li}`;
      const H = L.h ?? 1000, W = 300, vmax = 120; const yOf = (v) => H - (v / vmax) * H;
      L._yOf = yOf;
      let g = `<defs><linearGradient id="${gid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3ef08a"/><stop offset=".55" stop-color="#ffc93c"/><stop offset=".72" stop-color="#ff9f1c"/><stop offset="1" stop-color="#ff3b5c"/></linearGradient></defs>`;
      g += `<rect x="0" y="0" width="54" height="${H}" rx="27" fill="rgba(16,9,46,.85)" stroke="rgba(201,193,255,.45)" stroke-width="4"/>`;
      g += `<rect class="fill" x="7" y="${H}" width="40" height="0" rx="20" fill="url(#${gid})"/>`;
      for (let v = 0; v <= vmax; v += 20) g += `<line x1="60" x2="78" y1="${yOf(v)}" y2="${yOf(v)}" stroke="${LAV}" stroke-width="4"/><text x="86" y="${yOf(v) + 11}" style="font-size:30px;fill:${LAV}">${v}</text>`;
      g += `<text x="0" y="${H + 50}" style="font-size:30px;fill:${LAV}">dB</text>`;
      g += `<g class="l85" style="opacity:0"><line x1="-10" x2="${W + 330}" y1="${yOf(85)}" y2="${yOf(85)}" stroke="${CORAL}" stroke-width="5" stroke-dasharray="14 10"/><text x="${W + 330}" y="${yOf(85) - 14}" text-anchor="end" style="font-size:30px;fill:${CORAL}">85 dBA · 8 saat sınırı</text></g>`;
      L.marks.forEach((m, i) => {
        const y = yOf(m.v2 != null ? (m.v + m.v2) / 2 : m.v); const yb = m.v2 != null ? [yOf(m.v2), yOf(m.v)] : null;
        g += `<g class="mk" data-i="${i}" style="opacity:0">${yb ? `<rect x="-4" y="${yb[0]}" width="62" height="${yb[1] - yb[0]}" rx="10" fill="none" stroke="${m.c ?? GOLD}" stroke-width="6"/>` : `<circle cx="27" cy="${y}" r="16" fill="${m.c ?? GOLD}" stroke="${INK}" stroke-width="4"/>`}
          <line x1="64" x2="${W - 40}" y1="${y}" y2="${y}" stroke="${m.c ?? GOLD}" stroke-width="5"/>
          <g transform="translate(${W - 30} ${y})"><rect x="0" y="-36" width="${m.w ?? 330}" height="72" rx="20" fill="rgba(16,9,46,.92)" stroke="${m.c ?? GOLD}" stroke-width="5"/>
          <text x="22" y="13" style="font-size:38px;fill:${CREAM}">${m.label}</text></g></g>`;
      });
      inner.innerHTML = `<svg width="${W + 340}" height="${H + 60}" viewBox="-10 -10 ${W + 350} ${H + 70}">${g}</svg>`;
      L._fill = inner.querySelector('.fill'); L._mk = [...inner.querySelectorAll('.mk')]; L._l85 = inner.querySelector('.l85');
    },
    draw(inner, a, L) {
      // dolgu: son açılan işaretin değerine yükselir (cevap anında)
      let v = L.base ?? 0, sig = '';
      L.marks.forEach((m, i) => {
        const p = clamp((a - m.at) / 0.5); const tgt = m.v2 ?? m.v; if (p > 0) v = Math.max(L.base ?? 0, (L.marks[i - 1] ? (L.marks[i - 1].v2 ?? L.marks[i - 1].v) : 0) * (1 - easeOut(p)) + tgt * easeOut(p));
        const op = clamp((a - m.at - 0.25) / 0.2); L._mk[i].style.opacity = f2(op); L._mk[i].style.transform = `translateX(${f2((1 - easeOut(op)) * 40)}px)`; sig += f2(op);
      });
      if (L.fillOff != null && a >= L.fillOff) v = v * (1 - clamp((a - L.fillOff) / 0.4));
      const H = L.h ?? 1000, y = L._yOf(v); L._fill.setAttribute('y', f2(y)); L._fill.setAttribute('height', f2(Math.max(0, H - y - 7)));
      if (L.line85At != null) L._l85.style.opacity = f2(clamp((a - L.line85At) / 0.3));
      return sig + f2(v);
    },
  };

  /* ------------------------------------------------------------------ gündelik ses simgeleri (görsel; videoda yüksek ses çalınmaz) */
  // L: { ikon: 'fisilti'|'konusma'|'trafik'|'konser', lvl: 0..1 (dalga gücü), size }
  const IK = {
    fisilti: `<g transform="translate(40 30)"><path d="M150 40 C240 30 300 100 296 190 C292 250 270 290 240 320 L230 380 L110 380 L104 330 C70 330 46 318 40 290 C36 270 44 258 36 248 C26 236 20 228 26 214 C32 202 40 198 34 186 C26 172 12 168 18 152 C34 126 52 104 56 80 C70 52 104 42 150 40 Z" fill="#b8acf0" stroke="#3b2a8a" stroke-width="8" stroke-linejoin="round"/>
      <path d="M44 210 q-8 4 -4 12" stroke="#3b2a8a" stroke-width="6" fill="none"/><path d="M90 120 q14 -8 28 2" stroke="#3b2a8a" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M-20 170 C-30 120 30 110 40 150 L46 230 C40 270 -10 270 -16 230 Z" fill="#c9bff7" stroke="#3b2a8a" stroke-width="7"/></g>
      <text class="sh" x="-170" y="110" style="font-size:64px;fill:${LAV}">şşş…</text>`,
    konusma: `<g><path d="M20 40 h250 a40 40 0 0 1 40 40 v90 a40 40 0 0 1 -40 40 h-150 l-60 50 v-50 h-40 a40 40 0 0 1 -40 -40 v-90 a40 40 0 0 1 40 -40 z" fill="${CREAM}" stroke="${INK}" stroke-width="8" transform="translate(-60 0)"/>
      <g fill="${INK}"><circle cx="40" cy="125" r="14"/><circle cx="90" cy="125" r="14"/><circle cx="140" cy="125" r="14"/></g>
      <path d="M250 190 h200 a40 40 0 0 1 40 40 v80 a40 40 0 0 1 -40 40 h-30 v50 l-60 -50 h-110 a40 40 0 0 1 -40 -40 v-80 a40 40 0 0 1 40 -40 z" fill="${TEAL}" stroke="${INK}" stroke-width="8"/>
      <g fill="${INK}"><circle cx="300" cy="270" r="14"/><circle cx="350" cy="270" r="14"/><circle cx="400" cy="270" r="14"/></g></g>`,
    trafik: `<g transform="translate(-40 60)"><path d="M30 230 L60 150 Q74 116 110 116 L300 116 Q334 116 350 150 L380 230 Q420 236 420 270 L420 320 L0 320 L0 270 Q0 236 30 230 Z" fill="${CORAL}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
      <path d="M90 160 L110 140 L190 140 L190 220 L74 220 Z M220 140 L300 140 L330 220 L220 220 Z" fill="#c9f3ff" stroke="${INK}" stroke-width="6"/>
      <circle cx="96" cy="326" r="44" fill="#2a1b63" stroke="${INK}" stroke-width="8"/><circle cx="96" cy="326" r="16" fill="#9a8fc4"/><circle cx="324" cy="326" r="44" fill="#2a1b63" stroke="${INK}" stroke-width="8"/><circle cx="324" cy="326" r="16" fill="#9a8fc4"/>
      <rect x="392" y="250" width="28" height="22" rx="6" fill="#fff3b0" stroke="${INK}" stroke-width="5"/></g>`,
    konser: `<g><rect x="-40" y="70" width="150" height="300" rx="16" fill="#2a1b63" stroke="${INK}" stroke-width="8"/><circle cx="35" cy="150" r="44" fill="#120a30" stroke="${LAV}" stroke-width="7"/><circle cx="35" cy="150" r="16" fill="${LAV}"/><circle cx="35" cy="290" r="58" fill="#120a30" stroke="${LAV}" stroke-width="7"/><circle cx="35" cy="290" r="20" fill="${LAV}"/>
      <rect x="340" y="70" width="150" height="300" rx="16" fill="#2a1b63" stroke="${INK}" stroke-width="8"/><circle cx="415" cy="150" r="44" fill="#120a30" stroke="${LAV}" stroke-width="7"/><circle cx="415" cy="150" r="16" fill="${LAV}"/><circle cx="415" cy="290" r="58" fill="#120a30" stroke="${LAV}" stroke-width="7"/><circle cx="415" cy="290" r="20" fill="${LAV}"/>
      <g fill="${GOLD}" stroke="${INK}" stroke-width="5"><path d="M190 120 v110 a26 20 0 1 1 -14 -18 v-112 l80 -20 v100 a26 20 0 1 1 -14 -18 v-62 z"/></g>
      <g fill="#7d6bd6" stroke="${INK}" stroke-width="5">${[120, 200, 280].map((x, i) => `<path d="M${x} 420 l14 -70 q8 -16 18 0 l14 70 z" transform="rotate(${(i - 1) * 10} ${x + 20} 420)"/>`).join('')}</g></g>`,
  };
  O.sesIkon = {
    setup(inner, L) {
      const s = L.size ?? 1; const wv = (cx, cy, dir) => `<g class="wv" fill="none" stroke="${L.wc ?? GOLD}" stroke-linecap="round">${[0, 1, 2].map((k) => `<path d="M${cx + dir * (k * 40)} ${cy - 50 - k * 26} Q${cx + dir * (30 + k * 46)} ${cy} ${cx + dir * (k * 40)} ${cy + 50 + k * 26}" stroke-width="${11 - k * 2}"/>`).join('')}</g>`;
      const pos = { fisilti: [[-140, 230, -1]], konusma: [[520, 120, 1]], trafik: [[420, 300, 1], [-80, 300, -1]], konser: [[540, 220, 1], [-90, 220, -1]] }[L.ikon];
      inner.innerHTML = `<svg width="${460 * s}" height="${460 * s}" viewBox="-20 0 480 480">${IK[L.ikon]}${pos.map(([x, y, d]) => wv(x, y, d)).join('')}</svg>`;
      L._wv = [...inner.querySelectorAll('.wv path')];
    },
    draw(inner, a, L) {
      const lvl = L.lvl ?? 0.5; let sig = '';
      L._wv.forEach((p, k) => { const kk = k % 3; const q = (a * (0.8 + lvl * 1.6) - kk * 0.25) % 1; const on = kk < 1 + Math.round(lvl * 2) ? 1 : 0.12; const o = on * (0.3 + 0.7 * Math.max(0, Math.sin(Math.PI * q))); p.style.opacity = f2(o); sig += f2(o); });
      if (L.shake) { const k = L.shake * lvl; inner.style.transform = `translate(${f2(Math.sin(a * 53) * k)}px, ${f2(Math.cos(a * 41) * k)}px)`; }
      return sig;
    },
  };

  /* ------------------------------------------------------------------ frekans merdiveni (Kaç Hz'e kadar?) */
  // L: { steps: [{ f, at, d }], y0, gap } — basamaklar alttan üste; ton çalarken basamak yanar, üstte sinüs şeridi (yoğunluk ∝ frekans)
  O.merdiven = {
    setup(inner, L) {
      inner.className = 'ozel oz-full';
      const n = L.steps.length, y0 = L.y0 ?? 1380, gap = L.gap ?? 118;
      L._r = L.steps.map((s, i) => {
        const d = document.createElement('div'); d.className = 'oz-rung'; const w = 420 + i * 46;
        d.style.width = w + 'px'; d.style.height = '96px'; d.style.marginLeft = -w / 2 + 'px'; d.style.top = (y0 - i * gap) + 'px';
        d.innerHTML = `<span>${(s.f / 1000).toLocaleString('tr-TR')} kHz</span>`; inner.appendChild(d); return d;
      });
      const wv = document.createElement('div'); wv.style.cssText = `position:absolute;left:90px;top:${L.waveY ?? 300}px;width:900px;height:170px;border-radius:30px;background:rgba(16,9,46,.85);border:5px solid rgba(46,230,214,.5);overflow:hidden`;
      wv.innerHTML = `<svg width="900" height="170" viewBox="0 0 900 170"><path class="sw" fill="none" stroke="${TEAL}" stroke-width="4"/><line x1="0" x2="900" y1="85" y2="85" stroke="rgba(201,193,255,.25)" stroke-width="2"/></svg>`;
      inner.appendChild(wv); L._sw = wv.querySelector('.sw'); L._wv = wv;
    },
    draw(inner, a, L) {
      let cur = -1, amp = 0, sig = '';
      L.steps.forEach((s, i) => { if (a >= s.at) cur = i; if (a >= s.at && a < s.at + s.d) amp = Math.min(1, (a - s.at) / 0.08, (s.at + s.d - a) / 0.08); });
      L._r.forEach((el, i) => {
        const s = L.steps[i]; const playing = a >= s.at && a < s.at + s.d; const past = i < cur || (i === cur && !playing);
        const seen = a >= s.at - 0.25 || (L.showAll != null && a >= L.showAll);
        el.style.opacity = seen ? (playing ? '1' : past ? '.9' : '.5') : '0.18';
        el.style.color = playing ? INK : past ? INK : CREAM;
        el.style.background = playing ? `linear-gradient(180deg,#e9fffc,${TEAL} 60%,#12a89e)` : past ? `linear-gradient(180deg,#fff3b0,${GOLD} 55%,#ff9f1c)` : 'rgba(16,9,46,.85)';
        el.style.border = playing ? '5px solid #e9fffc' : past ? '5px solid #fff3b0' : '5px dashed rgba(201,193,255,.45)';
        el.style.boxShadow = playing ? '0 0 60px rgba(46,230,214,.85), 0 10px 0 rgba(5,70,66,.6)' : past ? '0 8px 0 rgba(90,40,0,.5)' : 'none';
        const pop = playing ? 1 + 0.08 * Math.exp(-(a - s.at) * 8) : 1; el.style.transform = `scale(${pop.toFixed(3)})`;
        sig += (playing ? 'p' : past ? 'x' : '-') + pop.toFixed(2);
      });
      // sinüs şeridi: görünen döngü sayısı frekansla artar (8 kHz → 9, 17 kHz → 19 döngü); genlik yalnız ton çalarken
      const f = cur >= 0 ? L.steps[cur].f : 8000; const cyc = f / 900; let d = '';
      for (let x = 0; x <= 900; x += 3) { const y = 85 + Math.sin((x / 900) * cyc * 2 * Math.PI - a * 18) * 62 * amp; d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1); }
      L._sw.setAttribute('d', d); sig += amp.toFixed(2) + (amp > 0 ? (a % 1).toFixed(2) : '');
      return sig;
    },
  };

  /* ------------------------------------------------------------------ kulaklık (kırmızı = sağ, mavi = sol): kararsız dönüş → oturur */
  // L: { flipUntil (sn), settleLabel } — hasta karşıdan bakıyor: hastanın SAĞ kulağı izleyicinin solunda
  O.kulaklik = {
    setup(inner, L) {
      const s = L.size ?? 1;
      inner.innerHTML = `<svg width="${720 * s}" height="${560 * s}" viewBox="0 0 720 560"><g class="hp">
        <path d="M120 330 C120 120 230 40 360 40 C490 40 600 120 600 330" fill="none" stroke="#2a1b63" stroke-width="44" stroke-linecap="round"/>
        <path d="M120 330 C120 120 230 40 360 40 C490 40 600 120 600 330" fill="none" stroke="#7d6bd6" stroke-width="22" stroke-linecap="round"/>
        <g class="cl"><rect x="40" y="270" width="160" height="230" rx="70" fill="#e8364f" stroke="${INK}" stroke-width="9"/><text x="120" y="420" text-anchor="middle" style="font-size:84px;fill:#fff">R</text></g>
        <g class="cr"><rect x="520" y="270" width="160" height="230" rx="70" fill="#2f6bff" stroke="${INK}" stroke-width="9"/><text x="600" y="420" text-anchor="middle" style="font-size:84px;fill:#fff">L</text></g></g></svg>`;
      L._hp = inner.querySelector('.hp');
    },
    draw(inner, a, L) {
      const fu = L.flipUntil ?? 1.6; let sx = 1;
      if (a < fu) { sx = Math.cos(a * Math.PI * 2 * 1.6); } else { const q = clamp((a - fu) / 0.3); sx = Math.cos(fu * Math.PI * 2 * 1.6) * (1 - q) + 1 * q; }
      L._hp.setAttribute('transform', `translate(360 0) scale(${sx.toFixed(3)} 1) translate(-360 0)`);
      L._hp.querySelectorAll('text').forEach((t) => { t.style.opacity = Math.abs(sx) > 0.3 ? '1' : '0'; t.setAttribute('transform', sx < 0 ? `translate(${t.getAttribute('x') * 2} 0) scale(-1 1)` : ''); });
      return sx.toFixed(2);
    },
  };

  /* ------------------------------------------------------------------ odyometre paneli: TON ve YANIT lambaları (hasta her sese basıyor) */
  // L: { tones: [[a, d]], presses: [a…] }
  O.odyometre = {
    setup(inner, L) {
      inner.innerHTML = `<svg width="860" height="420" viewBox="0 0 860 420">
        <rect x="10" y="10" width="840" height="400" rx="40" fill="#1d1450" stroke="${LAV}" stroke-width="6"/>
        <rect x="50" y="50" width="330" height="150" rx="20" fill="#0b1a2a" stroke="#3e5a7a" stroke-width="4"/>
        <text x="80" y="115" style="font-size:44px;fill:#7ff3e8">1000 Hz</text><text x="80" y="175" style="font-size:44px;fill:#7ff3e8">30 dB HL</text>
        <g class="tn"><circle cx="520" cy="110" r="44" fill="#3a2a10" stroke="${GOLD}" stroke-width="6"/><text x="520" y="200" text-anchor="middle" style="font-size:34px;fill:${CREAM}">TON</text></g>
        <g class="yn"><circle cx="700" cy="110" r="44" fill="#103a20" stroke="#3ef08a" stroke-width="6"/><text x="700" y="200" text-anchor="middle" style="font-size:34px;fill:${CREAM}">YANIT</text></g>
        <rect x="50" y="250" width="760" height="120" rx="24" fill="#120a30" stroke="#3e3570" stroke-width="4"/>
        <circle cx="140" cy="310" r="40" fill="#2a1b63" stroke="${LAV}" stroke-width="5"/><path d="M140 310 L140 278" stroke="${CREAM}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="270" cy="310" r="40" fill="#2a1b63" stroke="${LAV}" stroke-width="5"/><path d="M270 310 L296 290" stroke="${CREAM}" stroke-width="7" stroke-linecap="round"/>
        <rect x="390" y="282" width="380" height="56" rx="28" fill="#2a1b63" stroke="${LAV}" stroke-width="5"/><text x="580" y="322" text-anchor="middle" style="font-size:30px;fill:${LAV}">TON VER</text></svg>`;
      L._tn = inner.querySelector('.tn circle'); L._yn = inner.querySelector('.yn circle');
    },
    draw(inner, a, L) {
      const ton = (L.tones ?? []).some(([s, d]) => a >= s && a < s + d);
      let yn = 0; for (const p of L.presses ?? []) if (a >= p && a < p + 0.22) yn = 1;
      L._tn.setAttribute('fill', ton ? GOLD : '#3a2a10'); L._tn.style.filter = ton ? 'drop-shadow(0 0 22px rgba(255,201,60,.95))' : 'none';
      L._yn.setAttribute('fill', yn ? '#3ef08a' : '#103a20'); L._yn.style.filter = yn ? 'drop-shadow(0 0 22px rgba(62,240,138,.95))' : 'none';
      return `${ton ? 1 : 0}${yn}`;
    },
  };

  /* ------------------------------------------------------------------ yanıt düğmesi (elde): her basışta çöker */
  O.dugme = {
    setup(inner, L) {
      inner.innerHTML = `<svg width="300" height="420" viewBox="0 0 300 420"><path d="M150 400 C150 360 230 360 230 320" fill="none" stroke="#2a1b63" stroke-width="12"/>
        <rect x="70" y="120" width="160" height="230" rx="60" fill="#3b2c78" stroke="${INK}" stroke-width="8"/>
        <g class="bt"><ellipse cx="150" cy="150" rx="56" ry="30" fill="#b3112e" stroke="${INK}" stroke-width="7"/><ellipse cx="150" cy="130" rx="56" ry="30" fill="#ff3b5c" stroke="${INK}" stroke-width="7"/></g>
        <g class="th"><path d="M110 40 C110 0 190 0 190 40 L196 120 C196 150 104 150 104 120 Z" fill="#f0c8a8" stroke="${INK}" stroke-width="7"/></g></svg>`;
      L._bt = inner.querySelector('.bt'); L._th = inner.querySelector('.th');
    },
    draw(inner, a, L) {
      let d = 0; for (const p of L.presses ?? []) if (a >= p - 0.06 && a < p + 0.16) d = 1 - Math.abs(a - p - 0.04) / 0.12;
      d = clamp(d); L._bt.setAttribute('transform', `translate(0 ${f2(14 * d)})`); L._th.setAttribute('transform', `translate(0 ${f2(-30 + 44 * d)})`);
      return f2(d);
    },
  };

  /* ------------------------------------------------------------------ kabin: camın ardında kulaklıklı, adsız siluet hasta */
  O.kabin = {
    setup(inner, L) {
      inner.innerHTML = `<svg width="${L.w ?? 900}" height="${(L.w ?? 900) * 0.8}" viewBox="0 0 900 720">
        <rect x="20" y="20" width="860" height="680" rx="30" fill="#0e1830" stroke="#5d6b8a" stroke-width="14"/>
        <rect x="60" y="60" width="780" height="600" rx="16" fill="#1a2b4a"/>
        <g opacity=".22" stroke="#9fb7d6" stroke-width="4">${Array.from({ length: 13 }, (_, i) => `<line x1="${60 + i * 65}" y1="60" x2="${60 + i * 65}" y2="660"/>`).join('')}</g>
        <g class="pt"><path d="M260 660 C260 520 330 470 450 470 C570 470 640 520 640 660 Z" fill="#3b2c78"/>
        <ellipse cx="450" cy="340" rx="120" ry="140" fill="#4a3a96"/>
        <path d="M330 330 C330 180 570 180 570 330" fill="none" stroke="#2a1b63" stroke-width="24"/>
        <rect x="306" y="300" width="56" height="100" rx="24" fill="#e8364f" stroke="${INK}" stroke-width="6"/><rect x="538" y="300" width="56" height="100" rx="24" fill="#2f6bff" stroke="${INK}" stroke-width="6"/>
        <g class="q" style="opacity:0"><text x="450" y="170" text-anchor="middle" style="font-size:150px;fill:${GOLD};font-family:'Baloo 2'">?</text></g></g>
        <path d="M60 60 L300 60 L60 300 Z" fill="rgba(255,255,255,.06)"/></svg>`;
      L._q = inner.querySelector('.q'); L._pt = inner.querySelector('.pt');
    },
    draw(inner, a, L) {
      const q = L.qAt != null ? clamp((a - L.qAt) / 0.2) : 0; L._q.style.opacity = f2(q);
      L._q.setAttribute('transform', `translate(450 170) scale(${f2(0.6 + 0.4 * backOut(q))}) rotate(${f2(Math.sin(a * 5) * 8 * q)}) translate(-450 -170)`);
      const bob = Math.sin(a * 2.4) * 4; L._pt.setAttribute('transform', `translate(0 ${f2(bob)})`);
      return f2(q) + f2(bob);
    },
  };
})();
