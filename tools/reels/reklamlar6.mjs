/**
 * ODİ Reels, 6. dalga (A bölümü): ODYOLOJİ ÖĞRENCİLERİ İÇİN PAYLAŞILABİLİR İÇERİK. Sayfayı tanımayan bir öğrencinin durup
 * hikâyesinde paylaşacağı, yorum yazacağı ya da arkadaşını etiketleyeceği beş video: kimlik ("bu tam ben"), quiz, kişilik testi,
 * sınıf tipleri, akraba sohbeti. İçerik önce; ODİ markası hafif: köşede küçük filigran + son ≈2 sn kapanış ("Çok yakında").
 * Şema reklamlar.mjs ile aynı (record.mjs tanır: node tools/reels/record.mjs --reel odyogrami-oku).
 *
 * Görüntü tamamen hareketli grafik (oyun klibi yok): bütün çizimler bu dosyadaki SVG'ler (Odi'nin yüz ifadeleri, odyogram,
 * diyapazon, ses düzeyi göstergesi…). Özel CSS her sahnenin ilk katmanında bir <style> bloğu olarak gelir (overlay.html'e dokunmaz).
 * Tıbbi içerik: docs/odyoloji-icerik.md (Katz; ASHA odyogram simgeleri; Jerger sınıflaması; NIOSH 1998). Odyogram deseni
 * "… ile uyumlu" bulgu olarak anlatılır; timpanogram tek başına tanı koydurmaz. Sahte kişi, yorum, sayı yok; sohbet arayüzü genel tasarım.
 */
import { YARDIMCI } from './reklamlar.mjs';

const { grid, LOGO } = YARDIMCI;

/* =================================================================== ortak: stil, Odi yüzleri, filigran, kapanış */
const CSS = `<style>
.bg6 { width:1080px; height:1920px; position:relative; overflow:hidden; }
.bg6 .dots { position:absolute; inset:0; opacity:.13; background-image:radial-gradient(circle, #fff 2.4px, transparent 3px); background-size:46px 46px; }
.bg6 .glow { position:absolute; left:50%; top:46%; width:1400px; height:1400px; margin:-700px 0 0 -700px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.16), rgba(255,255,255,0) 62%); }
.cap6 { display:inline-flex; align-items:center; gap:18px; max-width:900px; padding:18px 30px 16px 18px; border-radius:26px; background:#fff; color:#14082e;
  font:900 56px/1.12 'Nunito','Baloo 2',sans-serif; box-shadow:0 12px 0 rgba(0,0,0,.28), 0 24px 50px rgba(0,0,0,.35); text-align:left; }
.cap6 b { flex:none; display:grid; place-items:center; width:74px; height:74px; border-radius:50%; background:#14082e; color:#ffc93c; font:800 50px/1 'Baloo 2'; padding-top:6px; }
.cap6.c { text-align:center; padding:18px 34px 16px; }
.pun6 { text-align:center; font:800 112px/0.98 'Baloo 2','Nunito',sans-serif; text-transform:uppercase; color:#fff; padding:0 50px; -webkit-text-stroke:16px #14082e; paint-order:stroke fill; letter-spacing:.5px; }
.pun6.md { font-size:96px; -webkit-text-stroke:14px #14082e; } .pun6.sm { font-size:80px; -webkit-text-stroke:12px #14082e; } .pun6.xl { font-size:136px; -webkit-text-stroke:18px #14082e; }
.pun6 em { font-style:normal; color:#ffc93c; } .pun6 i { font-style:normal; color:#2ee6d6; } .pun6 u { text-decoration:none; color:#ff5c8a; }
.pun6 .lo { text-transform:none; }
.strike6 { position:relative; display:inline-block; color:#6b5fa0; }
.strike6:after { content:''; position:absolute; left:-6px; right:-6px; top:50%; height:7px; border-radius:4px; background:rgba(255,59,92,.9); transform:rotate(-4deg); box-shadow:0 3px 0 rgba(0,0,0,.35); }
.wm6 { display:inline-flex; align-items:center; gap:10px; padding:6px 20px 6px 8px; border-radius:999px; background:rgba(10,6,32,.55); border:2px solid rgba(255,255,255,.22);
  font:800 30px/1 'Baloo 2'; letter-spacing:2px; color:#fff6e5; }
.wm6 span { color:#2ee6d6; }
.wm6 small { font:800 22px/1 'Nunito'; letter-spacing:1px; color:#cfc8f0; text-transform:none; }
.made6 { font:900 46px/1.2 'Nunito'; color:#fff6e5; text-align:center; text-shadow:0 3px 0 rgba(10,5,30,.7), 0 0 20px rgba(10,5,30,.9); }
.soon6 { display:flex; flex-direction:column; align-items:center; gap:14px; }
.soon6 b { padding:16px 44px 12px; border-radius:999px; font:800 62px/1 'Baloo 2'; color:#14082e; text-transform:uppercase; background:linear-gradient(180deg,#fff3b0,#ffc93c 55%,#ff9f1c); box-shadow:0 8px 0 rgba(138,69,0,.6), 0 0 50px rgba(255,201,60,.5); }
.soon6 span { font:900 40px/1.2 'Nunito'; color:#fff6e5; text-shadow:0 0 16px rgba(0,0,0,.9); }
.follow6 { display:inline-flex; align-items:center; gap:18px; padding:22px 56px 18px; border-radius:999px; font:900 58px/1 'Nunito'; color:#062a28;
  background:linear-gradient(180deg,#e9fffc,#2ee6d6 60%,#12a89e); box-shadow:0 10px 0 rgba(5,70,66,.65), 0 0 56px rgba(46,230,214,.55); }
.follow6 i { font-style:normal; font-size:64px; margin-top:-6px; }
.tag6 { display:inline-flex; align-items:center; gap:16px; padding:20px 40px 16px; border-radius:999px; background:#ff5c8a; color:#fff; font:900 52px/1 'Nunito';
  box-shadow:0 10px 0 rgba(110,10,50,.6), 0 0 40px rgba(255,92,138,.5); }
.tag6 b { font:800 64px/1 'Baloo 2'; margin-top:-6px; }
.tag6.teal { background:#2ee6d6; color:#062a28; box-shadow:0 10px 0 rgba(5,70,66,.65), 0 0 40px rgba(46,230,214,.5); }
.tag6.gold { background:#ffc93c; color:#14082e; box-shadow:0 10px 0 rgba(138,69,0,.6), 0 0 40px rgba(255,201,60,.5); }
.grid6 { display:grid; grid-template-columns:repeat(3, 290px); gap:22px; }
.grid6.two { grid-template-columns:repeat(2, 420px); }
.gi6 { position:relative; height:250px; border-radius:30px; background:rgba(255,255,255,.95); color:#14082e; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding:0 10px 18px;
  font:900 31px/1.08 'Nunito'; text-align:center; box-shadow:0 10px 0 rgba(0,0,0,.25); }
.gi6 .ic { position:absolute; left:0; right:0; top:14px; display:flex; justify-content:center; }
.gi6 b { position:absolute; z-index:2; left:12px; top:10px; width:54px; height:54px; border-radius:50%; background:#14082e; color:#ffc93c; font:800 36px/1 'Baloo 2'; display:grid; place-items:center; padding-top:4px; }
.box6 { padding:22px 34px 20px; border-radius:30px; background:rgba(12,7,36,.92); border:5px solid #2ee6d6; color:#fff6e5; text-align:center; font:900 46px/1.16 'Nunito'; box-shadow:0 14px 40px rgba(0,0,0,.5); }
.box6 small { display:block; font:900 28px/1 'Nunito'; letter-spacing:6px; text-transform:uppercase; color:#2ee6d6; margin-bottom:10px; }
.box6 em { font-style:normal; color:#ffc93c; }
.box6.gold { border-color:#ffc93c; } .box6.gold small { color:#ffc93c; }
.box6.coral { border-color:#ff5c8a; } .box6.coral small { color:#ff9bb8; }
.note6 { font:800 30px/1.25 'Nunito'; color:#e4defc; text-align:center; padding:0 120px; text-shadow:0 0 12px rgba(0,0,0,.9); }
.note6 b { color:#ffc93c; }
.note6.lg { font-size:40px; }
/* odyogram kartı */
.aud6 { padding:0; border-radius:30px; background:#fffdf7; box-shadow:0 0 0 6px #14082e, 0 26px 70px rgba(0,0,0,.6); overflow:hidden; }
.aud6 text { font-family:'Nunito'; font-weight:900; }
.hdr6 { display:flex; align-items:center; gap:22px; }
.round6 { padding:14px 26px 10px; border-radius:16px; background:#ffc93c; color:#14082e; font:800 50px/1 'Baloo 2'; letter-spacing:3px; box-shadow:0 8px 0 rgba(90,40,0,.55); }
.ask6 { font:900 44px/1.1 'Nunito'; color:#fff6e5; text-shadow:0 0 14px rgba(0,0,0,.9); }
.cd6 { width:150px; height:150px; border-radius:50%; display:grid; place-items:center; background:#14082e; border:8px solid #2ee6d6; font:800 110px/1 'Baloo 2'; color:#fff6e5; padding-top:12px; box-shadow:0 0 40px rgba(46,230,214,.5); }
.cd6.red { border-color:#ff3b5c; color:#ffd1da; box-shadow:0 0 50px rgba(255,59,92,.7); }
.pips6 { display:flex; gap:14px; } .pips6 i { width:120px; height:22px; border-radius:11px; background:#2ee6d6; box-shadow:0 0 16px rgba(46,230,214,.6); } .pips6 i.off { background:rgba(255,255,255,.14); box-shadow:none; }
.pips6.red i { background:#ff3b5c; box-shadow:0 0 16px rgba(255,59,92,.7); } .pips6.red i.off { background:rgba(255,255,255,.14); box-shadow:none; }
.find6 { max-width:940px; padding:22px 34px 20px; border-radius:30px; background:#14082e; border:6px solid #ffc93c; text-align:center; box-shadow:0 18px 50px rgba(0,0,0,.6), 0 0 50px rgba(255,201,60,.35); }
.find6 b { display:block; font:800 60px/1.02 'Baloo 2'; color:#fff; }
.find6 span { display:block; margin-top:10px; font:900 40px/1.15 'Nunito'; color:#2ee6d6; }
.find6 small { display:block; margin-top:8px; font:800 26px/1.1 'Nunito'; color:#cfc8f0; letter-spacing:1px; }
/* timpanogram kişilik kartları */
.tip6 { display:inline-flex; align-items:baseline; gap:6px; padding:16px 44px 8px; border-radius:26px; font:800 150px/0.9 'Baloo 2'; color:#14082e; box-shadow:0 12px 0 rgba(0,0,0,.35), 0 0 60px rgba(255,255,255,.25); }
.tip6 small { font-size:86px; }
.per6 { text-align:center; font:800 100px/1.0 'Baloo 2'; color:#fff; padding:0 60px; -webkit-text-stroke:13px #14082e; paint-order:stroke fill; }
.real6 { max-width:900px; padding:18px 30px 16px; border-radius:24px; background:rgba(8,5,24,.88); border:4px solid rgba(255,255,255,.35); text-align:center; font:900 38px/1.18 'Nunito'; color:#fff6e5; }
.real6 small { display:block; font:900 26px/1 'Nunito'; letter-spacing:6px; text-transform:uppercase; color:#2ee6d6; margin-bottom:8px; }
.tlist6 { display:flex; flex-direction:column; gap:14px; width:920px; }
.tr6 { display:flex; align-items:center; gap:20px; padding:10px 20px 10px 12px; border-radius:28px; background:#fff; color:#14082e; box-shadow:0 8px 0 rgba(0,0,0,.28); }
.tr6 .k { flex:none; width:190px; height:118px; border-radius:18px; background:#160d3d; display:grid; place-items:center; }
.tr6 .n { flex:none; width:120px; font:800 84px/0.85 'Baloo 2'; text-align:center; padding-top:6px; }
.tr6 .n small { font-size:52px; }
.tr6 .n i { display:block; font:900 24px/1 'Nunito'; font-style:normal; letter-spacing:4px; color:#7a6fa6; margin-bottom:4px; }
.tr6 .p { font:900 37px/1.05 'Nunito'; }
.tr6 .p small { display:block; font:800 25px/1.15 'Nunito'; color:#5a4a8a; margin-top:6px; }
.ttl6 { font:800 104px/0.95 'Baloo 2'; text-align:center; color:#fff; -webkit-text-stroke:14px #14082e; paint-order:stroke fill; text-transform:uppercase; }
.ttl6 em { font-style:normal; color:#ffc93c; }
/* sınıf tipleri */
.big6 { font:800 300px/0.8 'Baloo 2'; color:#ffc93c; -webkit-text-stroke:16px #14082e; paint-order:stroke fill; padding-top:40px; filter:drop-shadow(0 12px 0 rgba(0,0,0,.35)); }
.chalk6 { padding:26px 40px; border-radius:18px; border:10px solid #8a5a2b; background:#1f3b2c; color:#f2f2e6; font:800 76px/1.1 'Baloo 2'; text-align:center; box-shadow:0 14px 30px rgba(0,0,0,.5); }
.chalk6 small { display:block; font:800 40px/1.25 'Nunito'; color:#bfe8cf; }
/* sohbet arayüzü (genel tasarım; hiçbir uygulamanın taklidi değil) */
.chat6 { width:1080px; height:1920px; position:relative; background:linear-gradient(180deg, #241a52 0%, #1a1240 60%, #120c2e 100%); }
.chat6 .pat { position:absolute; inset:0; opacity:.07; background-image:radial-gradient(circle at 20px 20px, #fff 3px, transparent 4px), radial-gradient(circle at 60px 60px, #fff 2px, transparent 3px); background-size:80px 80px; }
.chh6 { width:1080px; padding:0 40px; display:flex; align-items:center; gap:22px; height:150px; background:rgba(10,6,30,.96); border-bottom:3px solid rgba(255,255,255,.08); }
.chh6 .av { display:flex; } .chh6 .av i { width:70px; height:70px; border-radius:50%; margin-right:-20px; border:4px solid #120c2e; display:grid; place-items:center; font:800 34px/1 'Baloo 2'; color:#14082e; font-style:normal; padding-top:4px; }
.chh6 .t { margin-left:30px; } .chh6 .t b { display:block; font:900 44px/1 'Nunito'; color:#fff6e5; } .chh6 .t span { display:block; font:800 28px/1.3 'Nunito'; color:#a99fd6; margin-top:6px; }
.msg6 { width:1080px; padding:0 40px; display:flex; align-items:flex-end; gap:16px; }
.msg6 .av { flex:none; width:84px; height:84px; border-radius:50%; display:grid; place-items:center; font:800 40px/1 'Baloo 2'; color:#14082e; padding-top:5px; }
.msg6 .bb { max-width:760px; padding:20px 30px 18px; border-radius:34px 34px 34px 8px; background:#f4f0ff; color:#14082e; font:800 52px/1.14 'Nunito'; box-shadow:0 8px 20px rgba(0,0,0,.35); }
.msg6 .bb small { display:block; font:900 28px/1 'Nunito'; letter-spacing:1px; margin-bottom:8px; }
.msg6.me { justify-content:flex-end; } .msg6.me .bb { background:linear-gradient(180deg,#fff3b0,#ffc93c); border-radius:34px 34px 8px 34px; }
.msg6.me .bb.big { max-width:960px; font-size:64px; line-height:1.14; padding:30px 40px 28px; border:5px solid #fff6e5; box-shadow:0 0 60px rgba(255,201,60,.55), 0 10px 30px rgba(0,0,0,.4); }
.msg6 .typ { padding:24px 30px; border-radius:34px 34px 34px 8px; background:#f4f0ff; display:flex; gap:12px; } .msg6 .typ i { width:20px; height:20px; border-radius:50%; background:#8a7fc0; }
.sys6 { padding:10px 26px; border-radius:999px; background:rgba(255,255,255,.1); font:800 30px/1 'Nunito'; color:#cfc8f0; }
</style>`;
const css = () => ({ kind: 'html', html: CSS, y: 0, at: 0, anim: 'none' });

/** tam ekran renkli zemin (sahne bg 'black' üstünde; opak → JPEG kare) */
const bgL = (a, b, o = {}) => ({ kind: 'html', y: 0, at: 0, anim: 'none', html: `<div class="bg6" style="background:radial-gradient(90% 60% at 50% ${o.cy ?? 42}%, ${a} 0%, ${b} 100%)">${o.dots === false ? '' : '<div class="dots"></div>'}<div class="glow"></div></div>` });

/** Odi'nin yüz ifadeleri (oyun karakteri; overlay.html › ODI ile aynı çizim + göz/ağız/aksesuar seçenekleri) */
function odi6(size, id, o = {}) {
  const ink = '#22153f';
  const EY = {
    n: `<ellipse cx="80" cy="96" rx="13" ry="14.5" fill="#fff"/><ellipse cx="120" cy="96" rx="13" ry="14.5" fill="#fff"/><circle cx="83" cy="99" r="7" fill="${ink}"/><circle cx="123" cy="99" r="7" fill="${ink}"/><circle cx="86" cy="95" r="2.6" fill="#fff"/><circle cx="126" cy="95" r="2.6" fill="#fff"/>`,
    wide: `<ellipse cx="79" cy="94" rx="16" ry="18" fill="#fff"/><ellipse cx="121" cy="94" rx="16" ry="18" fill="#fff"/><circle cx="79" cy="95" r="5" fill="${ink}"/><circle cx="121" cy="95" r="5" fill="${ink}"/>`,
    happy: `<path d="M68 99q12-15 24 0M108 99q12-15 24 0" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`,
    side: `<ellipse cx="80" cy="97" rx="13" ry="13" fill="#fff"/><ellipse cx="120" cy="97" rx="13" ry="13" fill="#fff"/><circle cx="88" cy="100" r="6.5" fill="${ink}"/><circle cx="128" cy="100" r="6.5" fill="${ink}"/><path d="M65 97a15 15 0 0 1 30 0zM105 97a15 15 0 0 1 30 0z" fill="#6447e6"/><path d="M65 97h30M105 97h30" stroke="#2d1a85" stroke-width="3"/>`,
    tired: `<ellipse cx="80" cy="98" rx="13" ry="12" fill="#fff"/><ellipse cx="120" cy="98" rx="13" ry="12" fill="#fff"/><circle cx="81" cy="102" r="6" fill="${ink}"/><circle cx="121" cy="102" r="6" fill="${ink}"/><path d="M65 99a15 15 0 0 1 30 0zM105 99a15 15 0 0 1 30 0z" fill="#6447e6"/><path d="M65 99h30M105 99h30" stroke="#2d1a85" stroke-width="3"/><path d="M68 115q12 7 24 0M108 115q12 7 24 0" fill="none" stroke="#3b1fae" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
    star: [80, 120].map((x) => `<path d="M${x} ${82}l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3-9.3-4.9-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#ffc93c" stroke="#a35a00" stroke-width="2" stroke-linejoin="round"/>`).join(''),
    focus: `<ellipse cx="80" cy="96" rx="13" ry="14.5" fill="#fff"/><ellipse cx="120" cy="96" rx="13" ry="14.5" fill="#fff"/><circle cx="80" cy="99" r="7" fill="${ink}"/><circle cx="120" cy="99" r="7" fill="${ink}"/><circle cx="83" cy="95" r="2.6" fill="#fff"/><circle cx="123" cy="95" r="2.6" fill="#fff"/><path d="M64 78l26 6M136 78l-26 6" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`,
  };
  const MO = {
    smile: `<path d="M86 124q14 14 28 0" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`,
    grin: `<path d="M82 120h36q-2 22-18 22t-18-22z" fill="${ink}"/><path d="M90 134q10-7 20 0q-4 7-10 7t-10-7z" fill="#ff5c8a"/>`,
    o: `<ellipse cx="100" cy="130" rx="8" ry="10" fill="${ink}"/>`,
    flat: `<path d="M88 128h24" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`,
    wavy: `<path d="M82 129q4.5-6 9 0t9 0t9 0t9 0" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`,
    smug: `<path d="M88 127q14 9 26-5" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`,
  };
  const x = o.x ?? [];
  const extra = [
    x.includes('glasses') ? `<g fill="rgba(255,255,255,.12)" stroke="${ink}" stroke-width="4.5"><circle cx="80" cy="97" r="19"/><circle cx="120" cy="97" r="19"/></g><path d="M99 95q1-3 2 0M61 92l-14-4M139 92l14-4" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` : '',
    x.includes('sweat') ? '<path d="M152 64q10 15 0 22q-10-7 0-22z" fill="#9be7ff" stroke="#2a6fb0" stroke-width="2.5"/>' : '',
    x.includes('excl') ? '<g fill="#ffc93c" stroke="#14082e" stroke-width="3"><rect x="156" y="14" width="13" height="34" rx="6"/><circle cx="162.5" cy="58" r="7"/><rect x="178" y="26" width="11" height="26" rx="5" transform="rotate(18 183 39)"/></g>' : '',
    x.includes('zzz') ? '<g fill="#fff6e5" font-family="Baloo 2" font-weight="800"><text x="146" y="54" font-size="30">z</text><text x="164" y="34" font-size="24">z</text><text x="178" y="18" font-size="18">z</text></g>' : '',
    x.includes('heart') ? '<path d="M160 40c-8-12-26-4-18 10l18 16 18-16c8-14-10-22-18-10z" fill="#ff5c8a" stroke="#14082e" stroke-width="3"/>' : '',
    x.includes('blushx') ? '<g stroke="#ff5c8a" stroke-width="3" stroke-linecap="round"><path d="M62 118l6-6M70 120l6-6M124 120l6-6M132 118l6-6"/></g>' : '',
  ].join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 200 200"><defs>
<radialGradient id="${id}b" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="#c9b8ff"/><stop offset=".38" stop-color="#8b6bff"/><stop offset=".78" stop-color="#5a36e0"/><stop offset="1" stop-color="#3b1fae"/></radialGradient>
<radialGradient id="${id}c" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff5c8a" stop-opacity=".55"/><stop offset="1" stop-color="#ff5c8a" stop-opacity="0"/></radialGradient></defs>
${o.waves === false ? '' : '<g fill="none" stroke-linecap="round"><path d="M160 74a40 40 0 0 1 0 52" stroke="#2ee6d6" stroke-width="5" opacity=".9"/><path d="M174 60a62 62 0 0 1 0 80" stroke="#2ee6d6" stroke-width="4" opacity=".55"/><path d="M40 74a40 40 0 0 0 0 52" stroke="#ffc93c" stroke-width="5" opacity=".9"/><path d="M26 60a62 62 0 0 0 0 80" stroke="#ffc93c" stroke-width="4" opacity=".55"/></g>'}
<ellipse cx="100" cy="176" rx="40" ry="7" fill="rgba(5,2,20,.4)"/><circle cx="100" cy="102" r="58" fill="url(#${id}b)"/><circle cx="100" cy="102" r="57" fill="none" stroke="#2d1a85" stroke-width="3"/>
<ellipse cx="76" cy="70" rx="20" ry="11" transform="rotate(-28 76 70)" fill="#fff" opacity=".5"/>
<circle cx="70" cy="118" r="11" fill="url(#${id}c)"/><circle cx="130" cy="118" r="11" fill="url(#${id}c)"/>
${EY[o.e ?? 'n']}${MO[o.m ?? 'smile']}${extra}</svg>`;
}
/** Odi katmanı (yüz ifadesiyle) */
const odiL = (size, id, o = {}) => ({ kind: 'html', cls: 'art', html: odi6(size, id, o), y: o.y ?? 900, at: o.at ?? 0, anim: o.anim ?? 'pop', ...(o.dx ? { dx: o.dx } : {}), ...(o.bob ? { bob: o.bob, bobAmp: o.bobAmp ?? 10 } : {}), ...(o.rot ? { rot: o.rot } : {}), ...(o.z ? { z: o.z } : {}), ...(o.until ? { until: o.until } : {}), ...(o.jitter ? { jitter: o.jitter } : {}) });

/** köşe filigranı: küçük Odi + ODİ (alt güvenli sınırın hemen üstünde, sol) */
const wm = (id) => ({ kind: 'html', html: `<div class="wm6">${odi6(46, `wm${id}`, { waves: false })}OD<span>İ</span> <small>Sesin Yolu</small></div>`, y: 1500, dx: -330, at: 0, anim: 'none', z: 9 });
/** kapanış (≈2 sn): ODİ: Sesin Yolu · Odyoloji camiası için yapıldı · Çok yakında App Store ve Google Play'de · Takip et */
const kapanis = (id) => [
  css(),
  odiL(250, `kp${id}`, { e: 'happy', m: 'grin', y: 300, at: 0, anim: 'drop', bob: 1.4 }),
  { kind: 'html', cls: 'logo sm', html: LOGO, y: 540, at: 0.05, anim: 'zoom' },
  { kind: 'html', cls: 'made6', html: 'Odyoloji camiası için yapıldı', y: 900, at: 0.2, anim: 'rise' },
  { kind: 'html', cls: 'soon6', html: "<b>Çok yakında</b><span>App Store ve Google Play'de</span>", y: 1010, at: 0.3, anim: 'pop' },
  { kind: 'html', cls: 'follow6', html: 'Takip et <i>+</i>', y: 1250, at: 0.45, anim: 'pop', pulse: 120, pulseAt: 0.45, pulseAmt: 0.05 },
];
const sonSahne = (id, dur, o = {}) => ({ id: 'son', dur, bg: 'launch', mus: 'end', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'boom', 0.45], [0.05, 'sparkle', 0.5], ...(o.sfx ?? [])], layers: kapanis(id) });

const cap = (n, html, o = {}) => ({ kind: 'html', cls: `cap6 ${n ? '' : 'c'}`, html: n ? `<b>${n}</b><span>${html}</span>` : html, y: o.y ?? 262, at: o.at ?? 0, anim: o.anim ?? 'whipL', ...o });
const pun = (html, o = {}) => ({ kind: 'html', cls: `pun6 ${o.c ?? ''}`, html, y: o.y ?? 1170, at: o.at ?? 0.5, anim: o.anim ?? 'slam', slamFrom: o.slamFrom ?? 1.8, ...o });
const art = (html, o = {}) => ({ kind: 'html', cls: 'art', html, y: o.y ?? 560, at: o.at ?? 0.1, anim: o.anim ?? 'pop', ...o });

/* =================================================================== çizimler (SVG) */
/** ses düzeyi göstergesi (dB(A)); renk bölgeleri NIOSH 1998: 85 dB(A) 8 saatlik sınır */
function gauge(w = 720) {
  const cx = 360, cy = 380, r = 290; const ang = (v) => (-90 + ((v - 30) / 80) * 180) * Math.PI / 180; // 30..110 dB → −90..+90°
  const pt = (v, rr) => [cx + rr * Math.sin(ang(v)), cy - rr * Math.cos(ang(v))];
  const arc = (v0, v1, col) => { const [x0, y0] = pt(v0, r), [x1, y1] = pt(v1, r); return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${col}" stroke-width="46" fill="none"/>`; };
  let g = `<rect x="10" y="20" width="700" height="440" rx="60" fill="#14082e" stroke="#fff6e5" stroke-width="8"/>`;
  g += arc(30, 70, '#3ef08a') + arc(70, 85, '#ffc93c') + arc(85, 110, '#ff3b5c');
  for (let v = 30; v <= 110; v += 5) { const [a, b] = pt(v, r - 34), [c, d] = pt(v, r - (v % 20 === 10 ? 64 : 50)); g += `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="#fff6e5" stroke-width="${v % 20 === 10 ? 6 : 3}"/>`; }
  for (const v of [30, 50, 70, 90, 110]) { const [a, b] = pt(v, r - 100); g += `<text x="${a.toFixed(1)}" y="${(b + 14).toFixed(1)}" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="42" fill="#fff6e5">${v}</text>`; }
  g += `<text x="${cx}" y="300" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="64" fill="#2ee6d6">dB(A)</text>`;
  return `<svg width="${w}" height="${Math.round(w * 480 / 720)}" viewBox="0 0 720 480">${g}</svg>`;
}
const gaugeNeedle = (w = 720) => `<svg width="${w}" height="${Math.round(w * 480 / 720)}" viewBox="0 0 720 480"><path d="M352 380L360 120L368 380z" fill="#fff" stroke="#14082e" stroke-width="4"/><circle cx="360" cy="380" r="30" fill="#ffc93c" stroke="#14082e" stroke-width="6"/></svg>`;
/** kablolu kulaklık teki + ses dalgaları + dolu ses çubuğu */
const EARBUD = `<svg width="760" height="560" viewBox="0 0 760 560">
<g fill="none" stroke-linecap="round"><path class="draw" pathLength="1" stroke-dasharray="1 1" d="M470 170a120 120 0 0 1 0 170" stroke="#ff5c8a" stroke-width="16"/><path class="draw" pathLength="1" stroke-dasharray="1 1" d="M520 120a190 190 0 0 1 0 270" stroke="#ff5c8a" stroke-width="14" opacity=".75"/><path class="draw" pathLength="1" stroke-dasharray="1 1" d="M570 70a260 260 0 0 1 0 370" stroke="#ff5c8a" stroke-width="12" opacity=".5"/></g>
<path d="M300 330q-10 120 -150 210" stroke="#f4f0ff" stroke-width="16" fill="none" stroke-linecap="round"/>
<circle cx="330" cy="250" r="120" fill="#f4f0ff" stroke="#14082e" stroke-width="10"/><circle cx="345" cy="245" r="70" fill="#cfc8f0" stroke="#14082e" stroke-width="6"/>
<g fill="#14082e">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${320 + (i % 3) * 25}" cy="${225 + Math.floor(i / 3) * 40}" r="7"/>`).join('')}</g>
<g transform="translate(40 30)">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 30}" y="${100 - i * 11}" width="22" height="${30 + i * 11}" rx="5" fill="${i < 5 ? '#3ef08a' : i < 6 ? '#ffc93c' : '#ff3b5c'}" stroke="#14082e" stroke-width="3"/>`).join('')}</g>
</svg>`;
/** diyapazon (512 Hz) */
const fork = (w = 300, o = {}) => `<svg width="${w}" height="${Math.round(w * 2)}" viewBox="0 0 300 600">
${o.vib === false ? '' : '<g fill="none" stroke="#2ee6d6" stroke-width="8" stroke-linecap="round" opacity=".9"><path d="M40 60q-26 60 0 120"/><path d="M14 40q-36 80 0 160" opacity=".55"/><path d="M260 60q26 60 0 120"/><path d="M286 40q36 80 0 160" opacity=".55"/></g>'}
<path d="M95 20v250q0 70 55 70t55-70V20" fill="none" stroke="#14082e" stroke-width="58" stroke-linecap="round"/>
<path d="M95 20v250q0 70 55 70t55-70V20" fill="none" stroke="url(#fkg)" stroke-width="40" stroke-linecap="round"/>
<rect x="132" y="330" width="36" height="210" rx="16" fill="url(#fkg)" stroke="#14082e" stroke-width="9"/><circle cx="150" cy="560" r="32" fill="url(#fkg)" stroke="#14082e" stroke-width="9"/>
<defs><linearGradient id="fkg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f9ab0"/><stop offset=".45" stop-color="#f4f7ff"/><stop offset="1" stop-color="#9aa6bf"/></linearGradient></defs>
<text x="150" y="250" text-anchor="middle" transform="rotate(-90 150 250)" font-family="Baloo 2" font-weight="800" font-size="40" fill="#14082e" opacity=".75">512 Hz</text></svg>`;
/** çanta (önden) */
const BAG = `<svg width="620" height="560" viewBox="0 0 620 560"><path d="M200 170q0-120 110-120t110 120" fill="none" stroke="#14082e" stroke-width="40" stroke-linecap="round"/><path d="M200 170q0-120 110-120t110 120" fill="none" stroke="#ff9f1c" stroke-width="22" stroke-linecap="round"/>
<path d="M70 190h480l-40 340q-4 26-30 26H140q-26 0-30-26z" fill="#ff7a3c" stroke="#14082e" stroke-width="12" stroke-linejoin="round"/><path d="M70 190h480v60H70z" fill="#e85f22" stroke="#14082e" stroke-width="12"/><rect x="270" y="300" width="80" height="60" rx="14" fill="#ffc93c" stroke="#14082e" stroke-width="8"/></svg>`;
const PENCIL = `<svg width="120" height="360" viewBox="0 0 120 360"><g transform="rotate(-12 60 180)"><rect x="35" y="40" width="50" height="250" fill="#ffc93c" stroke="#14082e" stroke-width="8"/><path d="M35 290l25 60 25-60z" fill="#ffe2b8" stroke="#14082e" stroke-width="8" stroke-linejoin="round"/><path d="M52 330l8 20 8-20z" fill="#14082e"/><rect x="35" y="14" width="50" height="34" rx="8" fill="#ff5c8a" stroke="#14082e" stroke-width="8"/></g></svg>`;
const CHARGER = `<svg width="200" height="360" viewBox="0 0 200 360"><g transform="rotate(10 100 180)"><rect x="50" y="30" width="100" height="120" rx="20" fill="#f4f0ff" stroke="#14082e" stroke-width="8"/><rect x="70" y="0" width="14" height="40" fill="#cfc8f0" stroke="#14082e" stroke-width="5"/><rect x="116" y="0" width="14" height="40" fill="#cfc8f0" stroke="#14082e" stroke-width="5"/><path d="M100 150q0 80 -40 120t20 80" fill="none" stroke="#f4f0ff" stroke-width="14" stroke-linecap="round"/></g></svg>`;
/** düşünce balonu + küçük odyogram (sağ kulak, tize doğru inen) */
function thoughtAud(w = 720) {
  const x0 = 170, x1 = 560, y0 = 150, y1 = 400; const fx = (i) => x0 + i * (x1 - x0) / 5; const fy = (db) => y0 + (db + 10) * (y1 - y0) / 110;
  const pts = [[0, 15], [1, 20], [2, 30], [3, 45], [4, 55], [5, 60]];
  let g = '<g fill="#fffdf7" stroke="#14082e" stroke-width="10">' + [[360, 280, 270, 200], [150, 470, 30, 30], [90, 530, 18, 18]].map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`).join('') + '</g>';
  g += `<g stroke="#c7c0e0" stroke-width="3">${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${fx(i)}" x2="${fx(i)}" y1="${y0}" y2="${y1}"/>`).join('')}${[0, 20, 40, 60, 80, 100].map((d) => `<line x1="${x0}" x2="${x1}" y1="${fy(d)}" y2="${fy(d)}"/>`).join('')}</g>`;
  g += `<path class="draw" pathLength="1" stroke-dasharray="1 1" d="${pts.map(([i, d], k) => `${k ? 'L' : 'M'}${fx(i)} ${fy(d)}`).join(' ')}" fill="none" stroke="#e8202f" stroke-width="7"/>`;
  g += pts.map(([i, d]) => `<circle cx="${fx(i)}" cy="${fy(d)}" r="14" fill="#fffdf7" stroke="#e8202f" stroke-width="6"/>`).join('');
  return `<svg width="${w}" height="${Math.round(w * 580 / 720)}" viewBox="0 0 720 580">${g}</svg>`;
}
/** Koklea sarmalı (çizilerek gelir) */
function spiral(w = 600) {
  const pts = []; for (let a = 0; a <= Math.PI * 5.2; a += 0.08) { const r = 250 * Math.exp(-0.19 * a); pts.push([300 + r * Math.cos(a + Math.PI), 300 + r * Math.sin(a + Math.PI) * 0.92]); }
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${w}" viewBox="0 0 600 600"><path class="draw" pathLength="1" stroke-dasharray="1 1" d="${d}" fill="none" stroke="#14082e" stroke-width="70" stroke-linecap="round"/><path class="draw" pathLength="1" stroke-dasharray="1 1" d="${d}" fill="none" stroke="url(#kg)" stroke-width="50" stroke-linecap="round"/>
<defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9bb8"/><stop offset=".5" stop-color="#ffc93c"/><stop offset="1" stop-color="#2ee6d6"/></linearGradient></defs></svg>`;
}
/** köpük kulak tıkacı çifti */
const PLUGS = `<svg width="640" height="420" viewBox="0 0 640 420">${[[180, 210, -18], [450, 220, 14]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><rect x="${x - 80}" y="${y - 150}" width="160" height="300" rx="70" fill="#ff8a3c" stroke="#14082e" stroke-width="12"/><rect x="${x - 50}" y="${y - 120}" width="38" height="200" rx="19" fill="#ffc07a" opacity=".8"/>${[0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${x - 30 + (k % 3) * 34}" cy="${y - 40 + Math.floor(k / 3) * 90}" r="7" fill="#d9601c"/>`).join('')}</g>`).join('')}</svg>`;
/** sahne ışıkları (konser) */
const NOTES = `<svg width="760" height="260" viewBox="0 0 760 260"><g fill="#fff6e5" stroke="#14082e" stroke-width="6">${[[80, 150], [640, 120], [330, 60]].map(([x, y]) => `<path d="M${x} ${y}v-90l70-18v90" fill="none" stroke-width="12"/><ellipse cx="${x - 16}" cy="${y}" rx="26" ry="20"/><ellipse cx="${x + 54}" cy="${y - 18}" rx="26" ry="20"/>`).join('')}</g></svg>`;

/** odyogram (ASHA simgeleri): frekans üstte 250–8000 Hz, dB HL aşağı doğru artar (−10…120); bir oktav = 20 dB.
 *  e: { r: {ac, bc, bcm}, l: {ac, bc, bcm} } — her biri [[Hz, dB], …]; bc maskesiz (< >), bcm maskeli ([ ]). */
const AUD = { cw: 560, x0: 92, y0: 92, legend: 92 };
const OCT = AUD.cw / 5; const PXDB = OCT / 20;
const audX = (f) => AUD.x0 + Math.log2(f / 250) * OCT;
const audY = (db) => AUD.y0 + (db + 10) * PXDB;
const AUD_W = AUD.x0 + AUD.cw + 46; const AUD_H = AUD.y0 + 130 * PXDB + AUD.legend;
function audiogram(e, o = {}) {
  const R = '#e8202f', B = '#1f5fe0'; const s = o.scale ?? 1;
  let g = `<rect width="${AUD_W}" height="${AUD_H}" fill="#fffdf7"/>`;
  g += `<rect x="${AUD.x0}" y="${AUD.y0}" width="${AUD.cw}" height="${130 * PXDB}" fill="#fff" stroke="#14082e" stroke-width="3"/>`;
  for (let d = -10; d <= 120; d += 10) g += `<line x1="${AUD.x0}" x2="${AUD.x0 + AUD.cw}" y1="${audY(d)}" y2="${audY(d)}" stroke="${d === 0 ? '#6b5fa0' : '#cfc8e6'}" stroke-width="${d === 0 ? 3 : 2}"/>`;
  for (const d of [-10, 0, 20, 40, 60, 80, 100, 120]) g += `<text x="${AUD.x0 - 12}" y="${audY(d) + 9}" text-anchor="end" font-size="26" fill="#14082e">${d}</text>`;
  for (const f of [250, 500, 1000, 2000, 4000, 8000]) g += `<line x1="${audX(f)}" x2="${audX(f)}" y1="${AUD.y0}" y2="${AUD.y0 + 130 * PXDB}" stroke="#cfc8e6" stroke-width="2"/><text x="${audX(f)}" y="${AUD.y0 - 16}" text-anchor="middle" font-size="27" fill="#14082e">${f >= 1000 ? `${f / 1000}k` : f}</text>`;
  for (const f of [3000, 6000]) g += `<line x1="${audX(f)}" x2="${audX(f)}" y1="${AUD.y0}" y2="${AUD.y0 + 130 * PXDB}" stroke="#ddd8ee" stroke-width="2" stroke-dasharray="8 8"/>`;
  g += `<text x="${AUD.x0 + AUD.cw / 2}" y="34" text-anchor="middle" font-size="25" fill="#5a4a8a">Frekans (Hz)</text>`;
  g += `<text x="30" y="${AUD.y0 + 65 * PXDB}" text-anchor="middle" font-size="25" fill="#5a4a8a" transform="rotate(-90 30 ${AUD.y0 + 65 * PXDB})">İşitme düzeyi (dB HL)</text>`;
  const line = (pts, col) => `<path class="draw" pathLength="1" stroke-dasharray="1 1" d="${pts.map(([f, d], i) => `${i ? 'L' : 'M'}${audX(f).toFixed(1)} ${audY(d).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="4.5"/>`;
  const O = (f, d) => `<circle cx="${audX(f)}" cy="${audY(d)}" r="14" fill="#fff" stroke="${R}" stroke-width="5"/>`;
  const X = (f, d) => { const x = audX(f), y = audY(d); return `<path d="M${x - 12} ${y - 12}L${x + 12} ${y + 12}M${x + 12} ${y - 12}L${x - 12} ${y + 12}" stroke="${B}" stroke-width="5.5" stroke-linecap="round"/>`; };
  const lt = (f, d, col) => { const x = audX(f) - 24, y = audY(d); return `<path d="M${x + 9} ${y - 14}L${x - 7} ${y}L${x + 9} ${y + 14}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`; };   // sağ KY maskesiz: <
  const gt = (f, d, col) => { const x = audX(f) + 24, y = audY(d); return `<path d="M${x - 9} ${y - 14}L${x + 7} ${y}L${x - 9} ${y + 14}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`; };   // sol KY maskesiz: >
  const lb = (f, d, col) => { const x = audX(f) - 24, y = audY(d); return `<path d="M${x + 7} ${y - 15}H${x - 5}V${y + 15}H${x + 7}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`; };  // sağ KY maskeli: [
  const rb = (f, d, col) => { const x = audX(f) + 24, y = audY(d); return `<path d="M${x - 7} ${y - 15}H${x + 5}V${y + 15}H${x - 7}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`; };  // sol KY maskeli: ]
  if (e.l?.ac) g += line(e.l.ac, B); if (e.r?.ac) g += line(e.r.ac, R);
  if (e.l?.ac) g += e.l.ac.map(([f, d]) => X(f, d)).join(''); if (e.r?.ac) g += e.r.ac.map(([f, d]) => O(f, d)).join('');
  if (e.r?.bc) g += e.r.bc.map(([f, d]) => lt(f, d, R)).join(''); if (e.l?.bc) g += e.l.bc.map(([f, d]) => gt(f, d, B)).join('');
  if (e.r?.bcm) g += e.r.bcm.map(([f, d]) => lb(f, d, R)).join(''); if (e.l?.bcm) g += e.l.bcm.map(([f, d]) => rb(f, d, B)).join('');
  // açıklama (yalnız bu grafikte kullanılan simgeler)
  const yL = AUD.y0 + 130 * PXDB + 52; const items = [];
  if (e.r?.ac) items.push(['O', 'Sağ HY']);
  if (e.l?.ac) items.push(['X', 'Sol HY']);
  if (e.r?.bc || e.l?.bc) items.push(['<>', 'KY']);
  if (e.r?.bcm || e.l?.bcm) items.push(['[]', 'Maskeli KY']);
  const iw = AUD_W / items.length;
  items.forEach(([sym, lab], i) => {
    const cx = iw * i + 34;
    let symSvg;
    if (sym === 'X') { const x = cx, y = yL - 9; symSvg = `<path d="M${x - 11} ${y - 11}L${x + 11} ${y + 11}M${x + 11} ${y - 11}L${x - 11} ${y + 11}" stroke="${B}" stroke-width="5" stroke-linecap="round"/>`; }
    else if (sym === '<>') symSvg = `<text x="${cx}" y="${yL}" text-anchor="middle" font-size="34"><tspan fill="${R}">&lt;</tspan><tspan fill="${B}">&gt;</tspan></text>`;
    else if (sym === '[]') symSvg = `<text x="${cx}" y="${yL}" text-anchor="middle" font-size="34"><tspan fill="${R}">[</tspan><tspan fill="${B}">]</tspan></text>`;
    else symSvg = `<circle cx="${cx}" cy="${yL - 9}" r="12" fill="#fff" stroke="${R}" stroke-width="5"/>`;
    g += symSvg + `<text x="${cx + 24}" y="${yL}" font-size="26" fill="#14082e">${lab}</text>`;
  });
  const W = Math.round(AUD_W * s), H = Math.round(AUD_H * s);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${AUD_W} ${AUD_H}">${g}${o.extra ?? ''}</svg>`;
}

/* =================================================================== 1. ODYOLOJİ ÖĞRENCİSİ OLDUĞUNU SÖYLEMEDEN SÖYLE */
const ob = grid(120); // 0,5 sn
const BEATS1 = [
  { n: 1, id: 'db', cap: 'Kafeye girince ilk düşüncen:', pun: 'Burası<br><em>kaç <span class="lo">dB</span>?</em>', bg: ['#ff9f43', '#7a2e0b'], ic: 'gauge' },
  { n: 2, id: 'kulaklik', cap: 'Yanındakinin kulaklığı:', pun: 'Şarkıyı<br><u>sen de</u> duyuyorsun', bg: ['#2ec4b6', '#0b3d4a'], ic: 'bud' },
  { n: 3, id: 'canta', cap: 'Çantanda ne var?', pun: 'Kalem, şarj…<br><em>diyapazon</em>', bg: ['#a06bff', '#2a0f6e'], ic: 'fork' },
  { n: 4, id: 'duymuyorum', cap: 'Biri “pek duymuyorum” deyince:', pun: 'Kafanda<br><i>odyogram</i> çizilir', bg: ['#4a7dff', '#0d1a4a'], ic: 'aud' },
  { n: 5, id: 'koklea', cap: 'Biri <span class="strike6">salyangoz</span> deyince:', pun: '<em>Koklea.</em><br><span class="lo">Tam adıyla.</span>', bg: ['#ff6fa3', '#5a0a2c'], ic: 'koklea' },
  { n: 6, id: 'konser', cap: 'Konser günü:', pun: 'Kulak tıkacı<br><i>çantada</i>', bg: null, ic: 'plug' },
];
const ICON1 = {
  gauge: () => `<svg width="230" height="150" viewBox="0 0 720 480">${gauge(720).replace(/^<svg[^>]*>|<\/svg>$/g, '')}<path d="M352 380L360 120L368 380z" fill="#fff" stroke="#14082e" stroke-width="6"/></svg>`,
  bud: () => EARBUD.replace('width="760" height="560"', 'width="210" height="155"'),
  fork: () => fork(70, { vib: false }).replace(/width="70" height="140"/, 'width="80" height="160"'),
  aud: () => thoughtAud(200),
  koklea: () => spiral(150).replace(/class="draw" pathLength="1" stroke-dasharray="1 1" /g, ''),
  plug: () => PLUGS.replace('width="640" height="420"', 'width="220" height="145"'),
};
const sahne1 = (b, i) => {
  const L = [css(), ...(b.bg ? [bgL(b.bg[0], b.bg[1])] : []), cap(b.n, b.cap)];
  const sfx = [[0, 'whoosh', 0.4], [0.02, 'swish', 0.35], [0.5, 'hit', 0.45], [0.5, 'pop', 0.3]];
  if (b.ic === 'gauge') {
    L.push(art(gauge(720), { y: 470, at: 0.1 }));
    L.push({ kind: 'html', cls: 'art', html: gaugeNeedle(720), y: 470, at: 0.1, anim: 'pop', rot: 8, sway: 14, swayT: 0.9, jitter: 0, origin: 79 });
    L.push(odiL(300, `o1_${i}`, { e: 'focus', m: 'flat', y: 860, dx: -300, at: 0.9, rot: -6 }));
    sfx.push([0.15, 'beep', 0.25]);
  } else if (b.ic === 'bud') {
    L.push(art(EARBUD, { y: 430, at: 0.1, jitter: 3 }));
    L.push(odiL(320, `o1_${i}`, { e: 'wide', m: 'o', x: ['sweat'], y: 820, dx: 280, at: 0.8 }));
    sfx.push([0.2, 'buzzer', 0.15]);
  } else if (b.ic === 'fork') {
    L.push(art(BAG, { y: 640, at: 0.05, anim: 'rise' }));
    L.push(art(PENCIL, { y: 470, dx: -250, at: 0.3, anim: 'fly', from: [0, 500, -30], flyDur: 0.3 }));
    L.push(art(CHARGER, { y: 490, dx: 250, at: 0.55, anim: 'fly', from: [0, 500, 30], flyDur: 0.3 }));
    L.push(art(fork(220), { y: 400, at: 0.85, anim: 'fly', from: [0, 600, 0], flyDur: 0.3, jitter: 4 }));
    sfx.push([0.3, 'pop', 0.3], [0.55, 'pop', 0.3], [0.85, 'sparkle', 0.5]);
  } else if (b.ic === 'aud') {
    L.push(odiL(320, `o1_${i}`, { e: 'focus', m: 'smug', y: 860, dx: -290, at: 0.05 }));
    L.push({ ...art(thoughtAud(720), { y: 420, at: 0.25, anim: 'pop' }), draw: 0.7, drawAt: 0.3 });
    sfx.push([0.25, 'pop', 0.3], [0.55, 'scribble', 0.45]);
  } else if (b.ic === 'koklea') {
    L.push({ ...art(spiral(600), { y: 450, at: 0.05, anim: 'none' }), draw: 0.8, drawAt: 0.05 });
    L.push(odiL(300, `o1_${i}`, { e: 'happy', m: 'grin', x: ['excl'], y: 840, dx: 300, at: 0.9 }));
    sfx.push([0.05, 'riser', 0.3], [0.5, 'stamp', 0.4]);
  } else if (b.ic === 'plug') {
    L.push(art(NOTES, { y: 400, at: 0.05, anim: 'fade', jitter: 6 }));
    L.push(art(PLUGS, { y: 560, at: 0.2, anim: 'drop' }));
    L.push(odiL(300, `o1_${i}`, { e: 'happy', m: 'smile', x: ['heart'], y: 860, dx: -300, at: 0.85 }));
    sfx.push([0.2, 'thud', 0.35], [0.85, 'ding', 0.35]);
  }
  L.push(pun(b.pun, { c: b.pun.length > 40 ? 'md' : '', y: 1190 }));
  L.push(wm(`1_${i}`));
  return { id: b.id, dur: ob(5), bg: b.bg ? 'black' : 'stadium', ...(i === 0 ? { mus: 'drop' } : {}), fx: { flash: [[0, 0.08, [255, 255, 255], 0.35]], zoom: [[0.5, 0.2, 0.05]] }, sfx, layers: L };
};
const gridItems1 = BEATS1.map((b) => `<div class="gi6"><b>${b.n}</b><div class="ic">${ICON1[b.ic]()}</div>${{ gauge: 'dB tahmini', bud: 'Kulaklık sesi', fork: 'Diyapazon', aud: 'Kafada odyogram', koklea: 'Koklea, asla…', plug: 'Kulak tıkacı' }[b.ic]}</div>`).join('');
const soyleme = {
  slug: 'odyolog-oldugunu-soyleme', title: 'Odyoloji öğrencisi olduğunu söylemeden söyle', ad: true, bpm: 120, snap: ob(1), style: 'yayin', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.5, limit: 0.6, jpegOpaque: true,
  duck: { music: -8, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: ob(6), bg: 'black', mus: 'intro', fx: { flash: [[0, 0.14]], shake: [[0, 0.3, 16]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'hit', 0.7], [0, 'boom', 0.5], [0.9, 'scratch', 0.6], [1.0, 'stamp', 0.5]], layers: [
      css(), bgL('#3b2496', '#0a0624'),
      { kind: 'html', cls: 'pun6 md', html: 'Odyoloji<br>öğrencisi<br>olduğunu', y: 300, at: 0.02, anim: 'slam', slamFrom: 2.0 },
      { kind: 'html', cls: 'pun6 xl', html: '<u>söylemeden</u>', y: 720, at: 0.9, anim: 'stamp', rot: -4 },
      { kind: 'html', cls: 'pun6 md', html: 'söyle', y: 900, at: 1.25, anim: 'slam', slamFrom: 2.0 },
      odiL(420, 'o1h', { e: 'side', m: 'smug', y: 1040, at: 0.3, anim: 'drop', bob: 1.6 }),
      { kind: 'html', cls: 'tag6 gold', html: '6 işaret', y: 1440, at: 1.5, anim: 'pop' },
      wm('1h'),
    ] },
    ...BEATS1.map(sahne1),
    { id: 'hangisi', dur: ob(7), bg: 'black', mus: 'break', fx: { flash: [[0, 0.12]], zoom: [[0, 0.25, 0.05]] }, sfx: [[0, 'boom', 0.5], [0, 'hit', 0.4], ...BEATS1.map((_, k) => [0.25 + k * 0.08, 'pop', 0.22])], layers: [
      css(), bgL('#3b2496', '#0a0624'),
      { kind: 'html', cls: 'pun6 xl', html: 'Hangisi<br><em>sensin?</em>', y: 270, at: 0.02, anim: 'slam', slamFrom: 2.0 },
      { kind: 'html', cls: 'grid6', html: gridItems1, y: 600, at: 0.2, anim: 'pop' },
      { kind: 'html', cls: 'tag6', html: '<b>@</b> Sınıf arkadaşını etiketle', y: 1200, at: 0.6, anim: 'pop', pulse: 120, pulseAt: 0.6, pulseAmt: 0.05 },
      wm('1c'),
    ] },
    sonSahne('1', ob(4)),
  ],
  vo: [{ id: 'a1', scene: 'kanca', at: 0.2, nosub: true, dip: [[-0.05, 0.8, -9, -6]] }, { id: 'a2', scene: 'hangisi', at: 0.15, nosub: true }],
  cover: { bg: 'black', layers: [
    css(), bgL('#3b2496', '#0a0624'),
    { kind: 'html', cls: 'pun6 md', html: 'Odyoloji<br>öğrencisi<br>olduğunu', y: 280 },
    { kind: 'html', cls: 'pun6 xl', html: '<u>söylemeden</u>', y: 700, rot: -4 },
    { kind: 'html', cls: 'pun6 md', html: 'söyle', y: 880 },
    { kind: 'html', cls: 'grid6', html: gridItems1, y: 1060 },
  ] },
  post: {
    caption: 'Odyoloji öğrencisi olduğunu söylemeden söyle 👂\n1) Kafeye girince “burası kaç dB?”\n2) Yanındakinin kulaklığından şarkıyı sen de duyuyorsun\n3) Çantanda diyapazon\n4) Biri “pek duymuyorum” deyince kafanda odyogram çiziliyor\n5) Salyangoz değil: Koklea\n6) Konserde kulak tıkacı\nHangisi sensin? Sınıf arkadaşını etiketle 👇',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#odyolojibölümü', '#üniversite', '#işitme', '#koklea', '#odisesinyolu'],
  },
};

/* =================================================================== 2. BU ODYOGRAMI 5 SANİYEDE OKU */
const qb = grid(120); // 0,5 sn: saniye = 2 vuruş
const F8 = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];
const ROUNDS = [
  { // iki kulak, 4 kHz çentik, 8 kHz'te kısmi düzelme (Katz: gürültüye bağlı işitme kaybı)
    e: { r: { ac: F8.map((f, i) => [f, [10, 10, 15, 20, 40, 55, 45, 25][i]]) }, l: { ac: F8.map((f, i) => [f, [15, 10, 15, 25, 45, 60, 50, 30][i]]) } },
    hl: () => { const x = audX(4000), y = audY(57); return `<ellipse class="draw" pathLength="1" stroke-dasharray="1 1" cx="${x}" cy="${y}" rx="120" ry="70" fill="none" stroke="#ff9f1c" stroke-width="9"/><text x="${x}" y="${y + 120}" text-anchor="middle" font-size="34" fill="#c25100">çentik</text><path class="draw" pathLength="1" stroke-dasharray="1 1" d="M${audX(6000) + 10} ${audY(30)}Q${audX(8000) - 10} ${audY(20)} ${audX(8000) + 6} ${audY(10)}" fill="none" stroke="#0f9f8f" stroke-width="7" stroke-linecap="round"/><text x="${audX(8000) - 6}" y="${audY(4)}" text-anchor="end" font-size="28" fill="#0f7f72">düzelme</text>`; },
    b: '4 kHz’te çentik,<br>8 kHz’te kısmi düzelme', s: 'Gürültüye maruz kalmakla uyumlu', vo: 'b2',
  },
  { // sağ kulak: hava yolu ≈35–40 dB, maskeli kemik yolu 0–10 dB → hava–kemik aralığı (Katz: >10 dB iletim tipi bileşen)
    e: { r: { ac: [[250, 40], [500, 40], [1000, 35], [2000, 35], [4000, 35], [8000, 40]], bcm: [[250, 5], [500, 5], [1000, 5], [2000, 5], [4000, 5]] }, l: { ac: [[250, 15], [500, 10], [1000, 15], [2000, 15], [4000, 15], [8000, 20]] } },
    hl: () => { const x = audX(1000), y0 = audY(5), y1 = audY(35); return `<path class="draw" pathLength="1" stroke-dasharray="1 1" d="M${x + 60} ${y0}h22v${y1 - y0}h-22" fill="none" stroke="#ff9f1c" stroke-width="8" stroke-linejoin="round"/><text x="${x + 96}" y="${(y0 + y1) / 2 + 12}" font-size="34" fill="#c25100">≈30 dB aralık</text>`; },
    b: 'Sağda hava–kemik aralığı:<br>kemik yolu iyi, hava yolu düşük', s: 'İletim tipi bileşenle uyumlu', vo: 'b3',
  },
  { // iki kulak, tize doğru inen kayıp; maskesiz kemik yolu hava yoluyla aynı (aralık yok) → sensörinöral tiple uyumlu (Katz)
    e: { r: { ac: [[250, 15], [500, 20], [1000, 30], [2000, 45], [4000, 60], [8000, 70]], bc: [[500, 20], [1000, 30], [2000, 45], [4000, 60]] }, l: { ac: [[250, 20], [500, 20], [1000, 35], [2000, 50], [4000, 65], [8000, 75]], bc: [[500, 20], [1000, 35], [2000, 50], [4000, 65]] } },
    hl: () => `<path class="draw" pathLength="1" stroke-dasharray="1 1" d="M${audX(500)} ${audY(-2)}L${audX(8000) - 20} ${audY(52)}" fill="none" stroke="#ff9f1c" stroke-width="9" stroke-linecap="round"/><path d="M${audX(8000) - 20} ${audY(52)}l-12-30M${audX(8000) - 20} ${audY(52)}l-32 6" stroke="#ff9f1c" stroke-width="9" stroke-linecap="round"/><text x="${audX(1000)}" y="${audY(-1) + 4}" font-size="32" fill="#c25100">tize doğru iniyor</text>`,
    b: 'Tize doğru inen kayıp,<br>hava–kemik aralığı yok', s: 'Sensörinöral tiple uyumlu', vo: 'b4',
  },
];
const AUD_Y = 470; const AUD_SCALE = 1.1;
const audL = (e, o = {}) => ({ kind: 'html', cls: 'aud6', html: audiogram(e, { scale: AUD_SCALE }), y: AUD_Y, at: o.at ?? 0, anim: o.anim ?? 'none', draw: o.draw ?? 0.6, drawAt: o.drawAt ?? 0.05 });
const hlL = (svg, o = {}) => ({ kind: 'html', cls: 'art', html: `<svg width="${Math.round(AUD_W * AUD_SCALE)}" height="${Math.round(AUD_H * AUD_SCALE)}" viewBox="0 0 ${AUD_W} ${AUD_H}" style="font-family:Nunito;font-weight:900">${svg}</svg>`, y: AUD_Y, at: o.at ?? 0.15, anim: 'none', draw: 0.4, drawAt: 0 });
const hdr = (i, o = {}) => ({ kind: 'html', cls: 'hdr6', html: `<span class="round6">${i + 1}/3</span><span class="ask6">${o.ask ?? 'Ne görüyorsun?'}</span>`, y: 285, dx: -110, at: 0, anim: o.anim ?? 'none' });
const cd = (sec, k) => ({ kind: 'html', cls: `cd6 ${sec <= 2 ? 'red' : ''}`, html: String(sec), y: 255, dx: 380, at: qb(2 * k), until: qb(2 * k + 2), anim: 'pop', z: 3 });
const pips = (k) => ({ kind: 'html', cls: `pips6 ${5 - k <= 2 ? 'red' : ''}`, html: [0, 1, 2, 3, 4].map((j) => `<i class="${j < 5 - k ? '' : 'off'}"></i>`).join(''), y: 435, at: qb(2 * k), until: qb(2 * k + 2), anim: 'none' });
const turSahne = (R, i) => [
  { id: `t${i + 1}`, dur: qb(10), bg: 'quiz', mus: 'think', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'swish', 0.5], [0.05, 'scribble', 0.35], ...[0, 1, 2, 3, 4].map((k) => [qb(2 * k) + 0.02, 'beep', k >= 3 ? 0.4 : 0.28]), [qb(10) - 0.06, 'buzzer', 0.5]], layers: [
    css(), hdr(i, { anim: 'whipL' }),
    audL(R.e, { at: 0, anim: i ? 'pop' : 'none', draw: 0.6, drawAt: 0.1 }),
    ...[5, 4, 3, 2, 1].map((s, k) => cd(s, k)),
    ...[0, 1, 2, 3, 4].map((k) => pips(k)),
  ] },
  { id: `c${i + 1}`, dur: qb(6), bg: 'quiz', mus: 'reveal', fx: { flash: [[0, 0.12, [255, 214, 90], 0.45]], zoom: [[0, 0.25, 0.03]] }, sfx: [[0, 'ding', 0.6], [0, 'hit', 0.3], [0.05, 'cheer', 0.2, { d: 1.4 }]], layers: [
    css(), hdr(i, { ask: 'Bulgu' }),
    audL(R.e, { draw: 0.01, drawAt: -1 }), hlL(R.hl()),
    { kind: 'html', cls: 'find6', html: `<b>${R.b}</b><span>→ ${R.s}</span>`, y: 1290, at: 0.1, anim: 'stamp', rot: -1.5, z: 4 },
    odiL(170, `o2c${i}`, { e: 'happy', m: 'grin', y: 250, dx: 390, at: 0.05 }),
  ] },
];
const odyogram = {
  slug: 'odyogrami-oku', title: 'Bu odyogramı 5 saniyede oku', ad: true, bpm: 120, snap: qb(1), style: 'yarisma', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.5, limit: 0.6, jpegOpaque: true,
  duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: qb(4), bg: 'quiz', mus: 'fanfar', fx: { flash: [[0, 0.14]], shake: [[0, 0.3, 14]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'hit', 0.8], [0, 'horn', 0.35], [0.2, 'drumroll', 0.35, { d: 1.2 }]], layers: [
      css(),
      { kind: 'html', cls: 'pun6 md', html: 'Bu odyogramı<br><em>5 saniyede</em> oku', y: 262, at: 0.02, anim: 'slam', slamFrom: 2.0, z: 3 },
      { kind: 'html', cls: 'aud6', html: audiogram(ROUNDS[0].e, { scale: 0.95 }), y: 560, at: 0.25, anim: 'pop', draw: 0.5, drawAt: 0.3 },
      { kind: 'html', cls: 'tag6 gold', html: '3 odyogram · 5’er saniye', y: 1470, at: 0.6, anim: 'pop' },
    ] },
    ...ROUNDS.flatMap(turSahne),
    { id: 'kacini', dur: qb(4), bg: 'quiz', mus: 'fanfar', fx: { flash: [[0, 0.12]], zoom: [[0, 0.25, 0.05]] }, sfx: [[0, 'boom', 0.45], [0, 'horn', 0.3], [0.4, 'pop', 0.3]], layers: [
      css(),
      { kind: 'html', cls: 'pun6 xl', html: 'Kaçını<br><em>bildin?</em>', y: 280, at: 0.02, anim: 'slam', slamFrom: 2.0 },
      { kind: 'html', cls: 'tag6', html: 'Cevabını yorumlara yaz', y: 700, at: 0.15, anim: 'pop', pulse: 120, pulseAt: 0.15, pulseAmt: 0.05 },
      odiL(320, 'o2k', { e: 'star', m: 'grin', y: 860, at: 0.1, anim: 'drop', bob: 1.4 }),
      { kind: 'html', cls: 'note6', html: 'Odyogram deseni bir <b>bulgudur</b>; tanıyı öykü ve bütün testler birlikte koyar.', y: 1260, at: 0.3, anim: 'fade' },
    ] },
    sonSahne('2', qb(3)),
  ],
  vo: [
    { id: 'b1', scene: 'kanca', at: 0.15, nosub: true },
    ...ROUNDS.map((R, i) => ({ id: R.vo, scene: `c${i + 1}`, at: 0.2, nosub: true })),
    { id: 'b5', scene: 'kacini', at: 0.1, nosub: true },
  ],
  cover: { bg: 'quiz', layers: [
    css(),
    { kind: 'html', cls: 'pun6 md', html: 'Bu odyogramı<br><em>5 saniyede</em> oku', y: 262 },
    { kind: 'html', cls: 'aud6', html: audiogram(ROUNDS[1].e, { scale: 0.95 }), y: 560, draw: 0.01, drawAt: -1 },
    { kind: 'html', cls: 'cd6 red', html: '5', y: 1420, dx: 0 },
  ] },
  post: {
    caption: 'Bu odyogramı 5 saniyede oku ⏱️\n1) İki kulakta 4 kHz’te çentik, 8 kHz’te kısmi düzelme → gürültüye maruz kalmakla uyumlu\n2) Sağda hava–kemik aralığı (maskeli kemik yolu iyi, hava yolu düşük) → iletim tipi bileşenle uyumlu\n3) Tize doğru inen kayıp, aralık yok → sensörinöral tiple uyumlu\nSimgeler ASHA: O sağ hava yolu (kırmızı), X sol hava yolu (mavi), < > maskesiz kemik yolu, [ ] maskeli kemik yolu. Odyogram deseni bir bulgudur; tanıyı öykü ve bütün testler birlikte koyar.\nKaçını bildin? Cevabını yorumlara yaz 👇 Sınavdan önce kaydet.',
    tags: ['#odyoloji', '#odyogram', '#odyolojiöğrencisi', '#odyolog', '#işitmekaybı', '#odyometri', '#quiz', '#odisesinyolu'],
  },
};

/* =================================================================== 3. HANGİ TİMPANOGRAM TİPİSİN? (Jerger) */
const tb = grid(112); // ≈0,536 sn
const TIPLER = [
  { k: 'A', t: { tip: 'A', basinc: 0, uyum: 0.9, hacim: 1.2 }, per: 'Dengeli.<br>Ne eksik, ne fazla.', real: 'Normal basınçta, normal yükseklikte tepe', col: '#3ef08a', bg: ['#1f8a5b', '#06261a'], o: { e: 'happy', m: 'smile' }, vo: 'c2' },
  { k: 'A<small>s</small>', t: { tip: 'As', basinc: 0, uyum: 0.22, hacim: 1.2 }, per: 'Biraz kasıntı.<br>Pek esnemez.', real: 'Normal basınçta sığ tepe: sertleşmiş, az hareketli sistem', col: '#9fb4ff', bg: ['#3c4f9e', '#0b1236'], o: { e: 'side', m: 'flat' }, vo: 'c3' },
  { k: 'A<small>d</small>', t: { tip: 'Ad', basinc: 0, uyum: 2.4, hacim: 1.2 }, per: 'Fazla rahat.<br>Her şeye esner.', real: 'Normal basınçta çok yüksek tepe: aşırı hareketli sistem', col: '#ffc93c', bg: ['#b8701a', '#3a1c02'], o: { e: 'happy', m: 'grin', x: ['heart'] }, vo: 'c4' },
  { k: 'B', t: { tip: 'B', basinc: null, uyum: 0.1, hacim: 1.1 }, per: 'Dümdüz.<br>Tepki yok.', real: 'Tepe yok, düz eğri: kanal hacmine bakılır', col: '#cfc8f0', bg: ['#5b5675', '#16131f'], o: { e: 'tired', m: 'flat', x: ['zzz'] }, vo: 'c5' },
  { k: 'C', t: { tip: 'C', basinc: -220, uyum: 0.8, hacim: 1.2 }, per: 'Biraz negatif,<br>ama tepesi var.', real: 'Tepe belirgin negatif basınçta: orta kulak basıncı negatif', col: '#ff5c8a', bg: ['#a3245a', '#2c0516'], o: { e: 'side', m: 'smug' }, vo: 'c6' },
];
const tipSahne = (T, i) => ({ id: `tip${i + 1}`, dur: tb(6), bg: 'black', ...(i === 0 ? { mus: 'claim' } : {}), fx: { flash: [[0, 0.1, [255, 255, 255], 0.4]], zoom: [[0, 0.25, 0.05]] },
  sfx: [[0, 'whoosh', 0.4], [0, 'hit', 0.4], [0.05, 'stamp', 0.35], [0.4, 'scribble', 0.3]], layers: [
    css(), bgL(T.bg[0], T.bg[1]),
    { kind: 'html', html: `<div class="tip6" style="background:${T.col}">Tip ${T.k}</div>`, y: 262, dx: -150, at: 0, anim: 'stamp', rot: -4, z: 2 },
    { kind: 'timp', t: T.t, w: 880, y: 440, at: 0.1, anim: 'pop', draw: 0.7, values: true },
    { kind: 'html', cls: 'per6', html: T.per, y: 1050, at: 0.35, anim: 'slam', slamFrom: 1.8 },
    { kind: 'html', cls: 'real6', html: `<small>Gerçekte</small>${T.real}`, y: 1300, at: 0.7, anim: 'rise' },
    odiL(240, `o3_${i}`, { ...T.o, y: 215, dx: 350, at: 0.3, rot: 6 }),
    wm(`3_${i}`),
  ] });
const tipRow = (T, i) => `<div class="tr6"><div class="k">${miniTimp(T.t, 180, T.col, i)}</div><div class="n"><i>TİP</i>${T.k}</div><div class="p">${T.per.replace('<br>', ' ')}<small>${T.real}</small></div></div>`;
/** küçük timpanogram (kart için; overlay TIMP ile aynı eğri biçimi) */
function miniTimp(t, w, col, i) {
  const pts = []; for (let p = -400; p <= 200; p += 10) { let y; if (t.tip === 'B') y = t.uyum * 0.8 + (p + 400) * 0.00012; else { const wd = t.tip === 'As' ? 55 : t.tip === 'Ad' ? 75 : 65; y = 0.06 + t.uyum * Math.exp(-(((p - (t.basinc ?? 0)) / wd) ** 2)); } pts.push([p, y]); }
  const ymax = 2.8; const xOf = (p) => 10 + ((p + 400) / 600) * 180; const yOf = (v) => 120 - (v / ymax) * 105;
  void i;
  return `<svg width="${w}" height="${Math.round(w * 130 / 200)}" viewBox="0 0 200 130"><rect x="${xOf(-100)}" y="${yOf(1.7)}" width="${xOf(50) - xOf(-100)}" height="${yOf(0.3) - yOf(1.7)}" fill="rgba(95,227,154,.14)" stroke="rgba(142,240,176,.45)" stroke-dasharray="3 3"/><line x1="${xOf(0)}" x2="${xOf(0)}" y1="10" y2="122" stroke="rgba(255,255,255,.2)"/><line x1="10" x2="190" y1="${yOf(0)}" y2="${yOf(0)}" stroke="rgba(255,255,255,.25)"/><path d="${pts.map(([p, v], k) => `${k ? 'L' : 'M'}${xOf(p).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"/></svg>`;
}
const timpTip = {
  slug: 'timpanogram-tipin', title: 'Hangi timpanogram tipisin?', ad: true, bpm: 112, snap: tb(1), style: 'mit', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.5, limit: 0.6, jpegOpaque: true,
  duck: { music: -8, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: tb(5), bg: 'black', mus: 'intro', fx: { flash: [[0, 0.14]], shake: [[0, 0.3, 14]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'hit', 0.7], [0, 'boom', 0.4], ...TIPLER.map((_, k) => [0.45 + k * 0.1, 'pop', 0.25])], layers: [
      css(), bgL('#3b2496', '#0a0624'),
      { kind: 'html', cls: 'ttl6', html: 'Hangi<br><em>timpanogram</em><br>tipisin?', y: 290, at: 0.02, anim: 'slam', slamFrom: 2.0 },
      ...TIPLER.map((T, k) => ({ kind: 'html', cls: 'art', html: `<div style="padding:12px 12px 6px;border-radius:24px;background:#160d3d;box-shadow:0 0 0 6px ${T.col}, 0 14px 30px rgba(0,0,0,.5);text-align:center">${miniTimp(T.t, 260, T.col, k)}<div style="font:800 54px/1.1 'Baloo 2';color:${T.col}">${T.k}</div></div>`, y: k < 3 ? 690 : 990, dx: k < 3 ? (k - 1) * 330 : (k - 3.5) * 330, at: 0.45 + k * 0.1, anim: 'pop', rot: (k - 2) * 3 })),
      { kind: 'html', cls: 'tag6 gold', html: 'Seninkini bul ↓', y: 1340, at: 1.0, anim: 'pop' },
      wm('3h'),
    ] },
    ...TIPLER.map(tipSahne),
    { id: 'gercek', dur: tb(5), bg: 'black', mus: 'think', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'whoosh', 0.4], [0.1, 'stamp', 0.5]], layers: [
      css(), bgL('#123c5a', '#04101c'),
      { kind: 'html', html: '<div class="tip6" style="background:#2ee6d6">Gerçekte</div>', y: 300, at: 0, anim: 'stamp', rot: -3 },
      { kind: 'html', cls: 'per6', html: 'Timpanogram<br>tek başına<br><span style="color:#2ee6d6">tanı koydurmaz.</span>', y: 560, at: 0.15, anim: 'slam', slamFrom: 1.6 },
      { kind: 'html', cls: 'note6', html: 'Eğri bir <b>bulgudur</b>. Tanıyı öykü, otoskopi, odyogram ve diğer testler birlikte koyar.', y: 1060, at: 0.5, anim: 'fade' },
      odiL(240, 'o3g', { e: 'focus', m: 'smile', x: ['glasses'], y: 1170, at: 0.3 }),
      wm('3g'),
    ] },
    { id: 'kart', dur: tb(8), bg: 'black', mus: 'reveal', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'boom', 0.45], ...TIPLER.map((_, k) => [0.1 + k * 0.08, 'pop', 0.25])], layers: [
      css(), bgL('#3b2496', '#0a0624'),
      { kind: 'html', cls: 'ttl6', html: 'Sen <em>hangi</em><br>tipsin?', y: 262, at: 0, anim: 'slam', slamFrom: 1.8 },
      { kind: 'html', cls: 'tlist6', html: TIPLER.map(tipRow).join(''), y: 500, at: 0.1, anim: 'pop' },
      { kind: 'html', cls: 'tag6', html: 'Hikâyende paylaş', y: 1385, at: 0.5, anim: 'pop', pulse: 112, pulseAt: 0.5, pulseAmt: 0.05 },
      { kind: 'html', cls: 'note6', html: 'Jerger sınıflaması · <b>Gerçekte: timpanogram tek başına tanı koydurmaz.</b>', y: 1500, at: 0.6, anim: 'fade' },
    ] },
    sonSahne('3', tb(4)),
  ],
  vo: [
    { id: 'c1', scene: 'kanca', at: 0.1, nosub: true },
    ...TIPLER.map((T, i) => ({ id: T.vo, scene: `tip${i + 1}`, at: 0.35, nosub: true })),
    { id: 'c7', scene: 'gercek', at: 0.15, nosub: true }, { id: 'c8', scene: 'kart', at: 0.5, nosub: true, dip: [[-0.05, 0.9, -10, -6]] },
  ],
  cover: { bg: 'black', layers: [
    css(), bgL('#3b2496', '#0a0624'),
    { kind: 'html', cls: 'ttl6', html: 'Hangi<br><em>timpanogram</em><br>tipisin?', y: 262 },
    { kind: 'html', cls: 'tlist6', html: TIPLER.map(tipRow).join(''), y: 690 },
  ] },
  post: {
    caption: 'Hangi timpanogram tipisin? 👂\nTip A: dengeli (normal basınçta, normal yükseklikte tepe)\nTip As: biraz kasıntı (sığ tepe: sertleşmiş sistem)\nTip Ad: fazla rahat (çok yüksek tepe: aşırı hareketli sistem)\nTip B: dümdüz (tepe yok; kanal hacmine bakılır)\nTip C: biraz negatif ama tepesi var (tepe negatif basınçta)\nGerçekte: timpanogram tek başına tanı koydurmaz (Jerger sınıflaması).\nHikâyende paylaş: sen hangi tipsin? 👇',
    tags: ['#odyoloji', '#timpanometri', '#timpanogram', '#odyolojiöğrencisi', '#odyolog', '#hangitipsin', '#kişiliktesti', '#odisesinyolu'],
  },
};

/* =================================================================== 4. ODYOLOJİ SINIFINDAKİ 5 TİP */
const sb = grid(112);
const SINIF = [
  { id: 's1', no: 1, pun: 'Diyapazonu<br><em>her yere</em> götüren', sub: 'kafe, otobüs, düğün…', o: { e: 'star', m: 'grin' }, prop: 'fork', bg: ['#2b6b4f', '#0a1f17'], vo: 'd2' },
  { id: 's2', no: 2, pun: 'Herkese<br><em>maskelemeyi</em> anlatan', sub: '“Bir dakika, burada maskeleme lazım!”', o: { e: 'focus', m: 'grin', x: ['glasses'] }, prop: 'board', bg: ['#2b4f8a', '#0a1430'], vo: 'd3' },
  { id: 's3', no: 3, pun: 'Her timpanogramı<br><em>“Tip A”</em> sanan', sub: '(o eğri dümdüz… Tip B)', o: { e: 'happy', m: 'smile' }, prop: 'stamp', bg: ['#8a4a2b', '#2a0f05'], vo: 'd4' },
  { id: 's4', no: 4, pun: 'Sembolleri<br><em>çoktan</em> ezberleyen', sub: 'sağ O, sol X, &lt; &gt;, [ ]… uykusunda bile', o: { e: 'focus', m: 'smug', x: ['glasses'] }, prop: 'cards', bg: ['#6b2b8a', '#1d0a2a'], vo: 'd5' },
  { id: 's5', no: 5, pun: 'Sınavdan<br><em>bir gece önce</em> başlayan', sub: '“Bir gecede biter.” Bitmez.', o: { e: 'tired', m: 'wavy', x: ['sweat'] }, prop: 'night', bg: ['#1c2350', '#05060f'], vo: 'd6' },
];
const STAMP_B = `<svg width="660" height="440" viewBox="0 0 660 440"><rect x="10" y="10" width="640" height="420" rx="30" fill="#fffdf7" stroke="#14082e" stroke-width="10"/>
<g stroke="#ddd6ee" stroke-width="3">${[0, 1, 2, 3, 4, 5, 6].map((k) => `<line x1="${60 + k * 90}" x2="${60 + k * 90}" y1="40" y2="380"/>`).join('')}${[0, 1, 2, 3].map((k) => `<line x1="40" x2="620" y1="${80 + k * 95}" y2="${80 + k * 95}"/>`).join('')}</g>
<path d="M50 330L610 322" stroke="#e8a400" stroke-width="9" fill="none" stroke-linecap="round"/><text x="330" y="414" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="30" fill="#5a4a8a">basınç (daPa)</text></svg>`;
const STAMPMARK = '<div style="padding:14px 34px 6px;border:12px solid #ff3b5c;border-radius:20px;color:#ff3b5c;font:800 120px/1 \'Baloo 2\';letter-spacing:8px;background:rgba(255,255,255,.75)">TİP A</div>';
const BOARD = '<div class="chalk6">MASKELEME<small>Test edilmeyen kulağa gürültü:</small><small>çapraz işitmeyi önle!</small></div>';
const CARDS = ['<span style="color:#e8202f">O</span>', '<span style="color:#1f5fe0">X</span>', '<span style="color:#e8202f">&lt;</span>', '<span style="color:#1f5fe0">&gt;</span>', '<span style="color:#e8202f">[</span>', '<span style="color:#1f5fe0">]</span>'];
const card = (s) => `<div style="width:150px;height:190px;border-radius:22px;background:#fffdf7;border:7px solid #14082e;display:grid;place-items:center;font:800 120px/1 'Baloo 2';padding-top:16px;box-shadow:0 10px 0 rgba(0,0,0,.3)">${s}</div>`;
const MUG = `<svg width="220" height="240" viewBox="0 0 220 240"><g fill="none" stroke="#fff6e5" stroke-width="7" stroke-linecap="round" opacity=".8"><path d="M70 50q-14-20 0-40"/><path d="M110 50q-14-20 0-40"/></g><rect x="30" y="70" width="140" height="150" rx="24" fill="#ff5c8a" stroke="#14082e" stroke-width="10"/><path d="M170 100q50 0 40 50t-40 40" fill="none" stroke="#14082e" stroke-width="10"/><text x="100" y="168" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="46" fill="#fff">x4</text></svg>`;
const propL = (p) => {
  if (p === 'fork') return [art(fork(250), { y: 440, dx: 170, at: 0.15, anim: 'fly', from: [500, 0, 40], jitter: 5, rot: 14 })];
  if (p === 'board') return [{ kind: 'html', cls: 'art', html: BOARD, y: 470, dx: 60, at: 0.15, anim: 'pop', rot: -2 }];
  if (p === 'stamp') return [art(STAMP_B, { y: 500, at: 0.05, anim: 'pop' }), { kind: 'html', cls: 'art', html: STAMPMARK, y: 640, at: 0.6, anim: 'stamp', rot: -12, z: 3 }];
  if (p === 'cards') return CARDS.map((s, k) => ({ kind: 'html', cls: 'art', html: card(s), y: 500 + (k % 2) * 220, dx: -330 + Math.floor(k / 2) * 230 + (k % 2) * 40, at: 0.1 + k * 0.08, anim: 'fly', from: [0, -900, (k - 3) * 15], rot: (k - 2.5) * 5 }));
  if (p === 'night') return [{ kind: 'clock', cls: 'md', y: 470, at: 0.05, anim: 'pop', from: [3, 0], rate: 20, blink: true }, art(MUG, { y: 760, dx: 290, at: 0.3, anim: 'drop' })];
  return [];
};
const sinifSahne = (S, i) => ({ id: S.id, dur: sb(6), bg: 'black', ...(i === 0 ? { mus: 'bouncy' } : {}), fx: { flash: [[0, 0.08, [255, 255, 255], 0.4]], zoom: [[0, 0.25, 0.05]] },
  sfx: [[0, 'whoosh', 0.4], [0.03, 'pop', 0.35], ...(S.prop === 'stamp' ? [[0.6, 'stamp', 0.8], [0.62, 'bonk', 0.4]] : S.prop === 'cards' ? [0, 1, 2, 3, 4, 5].map((k) => [0.1 + k * 0.08, 'paper', 0.3]) : S.prop === 'night' ? [[0.05, 'tick', 0.4], [0.55, 'tock', 0.4], [1.05, 'tick', 0.4]] : S.prop === 'fork' ? [[0.2, 'ding', 0.35]] : [[0.2, 'scribble', 0.45]])], layers: [
    css(), bgL(S.bg[0], S.bg[1]),
    { kind: 'html', cls: 'big6', html: String(S.no), y: 250, dx: -340, at: 0, anim: 'stamp', rot: -8 },
    ...propL(S.prop),
    odiL(S.prop === 'stamp' ? 260 : 330, `o4_${i}`, { ...S.o, y: S.prop === 'stamp' ? 900 : 800, dx: S.prop === 'cards' || S.prop === 'stamp' ? 320 : -200, at: 0.1, anim: 'pop', bob: 1.2, bobAmp: 8 }),
    { kind: 'html', cls: 'pun6 md', html: S.pun, y: 1150, at: 0.25, anim: 'slam', slamFrom: 1.7 },
    { kind: 'html', cls: 'note6 lg', html: S.sub, y: 1420, at: 0.7, anim: 'fade' },
    wm(`4_${i}`),
  ] });
const sinifGrid = SINIF.map((S, i) => `<div class="gi6" style="height:270px"><b>${S.no}</b><div class="ic">${odi6(150, `g4_${i}`, S.o)}</div>${S.pun.replace(/<br>|<\/?em>/g, ' ').replace(/\s+/g, ' ')}</div>`).join('');
const sinif = {
  slug: 'siniftaki-tipler', title: 'Odyoloji sınıfındaki 5 tip', ad: true, bpm: 112, snap: sb(1), style: 'komedi', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.5, limit: 0.6, jpegOpaque: true,
  duck: { music: -9, sfx: -3 },
  scenes: [
    { id: 'kanca', dur: sb(5), bg: 'board', mus: 'off', fx: { flash: [[0, 0.12]], shake: [[0, 0.3, 14]] }, sfx: [[0, 'hit', 0.6], [0, 'scratch', 0.6], [0.6, 'boing', 0.35]], layers: [
      css(),
      { kind: 'html', cls: 'pun6', html: 'Odyoloji<br>sınıfındaki', y: 300, at: 0.02, anim: 'slam', slamFrom: 2.0 },
      { kind: 'html', cls: 'big6', html: '5', y: 560, at: 0.45, anim: 'stamp', rot: -6 },
      { kind: 'html', cls: 'pun6 xl', html: '<em>tip</em>', y: 900, at: 0.6, anim: 'slam', slamFrom: 2.0 },
      ...SINIF.map((S, k) => odiL(250, `o4h${k}`, { ...S.o, y: 1110 + (k % 2) * 150, dx: (k - 2) * 200, at: 0.7 + k * 0.08, anim: 'drop' })),
      wm('4h'),
    ] },
    ...SINIF.map(sinifSahne),
    { id: 'hangisi', dur: sb(7), bg: 'black', mus: 'bright', fx: { flash: [[0, 0.12]], zoom: [[0, 0.25, 0.05]] }, sfx: [[0, 'boom', 0.45], ...SINIF.map((_, k) => [0.2 + k * 0.08, 'pop', 0.22])], layers: [
      css(), bgL('#3b2496', '#0a0624'),
      { kind: 'html', cls: 'pun6', html: 'Sınıfında<br><em>hangisi var?</em>', y: 262, at: 0, anim: 'slam', slamFrom: 1.8 },
      { kind: 'html', cls: 'grid6', html: sinifGrid + '<div class="gi6" style="height:270px;background:#ffc93c"><div class="ic" style="top:40px;font:800 120px/1 \'Baloo 2\'">?</div>Sen hangisisin?</div>', y: 560, at: 0.15, anim: 'pop' },
      { kind: 'html', cls: 'tag6', html: '<b>@</b> Etiketle', y: 1200, at: 0.5, anim: 'pop', pulse: 112, pulseAt: 0.5, pulseAmt: 0.05 },
      wm('4c'),
    ] },
    sonSahne('4', sb(4)),
  ],
  vo: [
    { id: 'd1', scene: 'kanca', at: 0.1, nosub: true },
    ...SINIF.map((S) => ({ id: S.vo, scene: S.id, at: 0.2, nosub: true })),
    { id: 'd7', scene: 'hangisi', at: 0.15, nosub: true },
  ],
  cover: { bg: 'board', layers: [
    css(),
    { kind: 'html', cls: 'pun6', html: 'Odyoloji<br>sınıfındaki', y: 262 },
    { kind: 'html', cls: 'pun6 xl', html: '<em>5 tip</em>', y: 540 },
    { kind: 'html', cls: 'grid6', html: sinifGrid + '<div class="gi6" style="height:270px;background:#ffc93c"><div class="ic" style="top:40px;font:800 120px/1 \'Baloo 2\'">?</div>Sen hangisisin?</div>', y: 800 },
  ] },
  post: {
    caption: 'Odyoloji sınıfındaki 5 tip 😄\n1) Diyapazonu her yere götüren\n2) Herkese maskelemeyi anlatan\n3) Her timpanogramı “Tip A” sanan\n4) Odyogram sembollerini çoktan ezberleyen\n5) Sınavdan bir gece önce başlayan\nSınıfında hangisi var? Etiketle 👇 (Karakterler kurgusaldır.)',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#üniversite', '#sınıf', '#öğrencihayatı', '#vize', '#odisesinyolu'],
  },
};

/* =================================================================== 5. AKRABALARA "ODYOLOJİ OKUYORUM" DEYİNCE */
const ab = grid(96); // 0,625 sn
const AKRABA = [
  { who: 'Teyze', c: '#ff9bb8', txt: 'Kulak mı temizliyorsun?', o: { e: 'side', m: 'flat' } },
  { who: 'Amca', c: '#9be7ff', txt: 'Benim de kulağım çınlıyor, bir bak', o: { e: 'wide', m: 'o', x: ['sweat'] } },
  { who: 'Hala', c: '#ffd36a', txt: 'Cihaz mı satıyorsun?', o: { e: 'tired', m: 'flat' } },
  { who: 'Dayı', c: '#b9f5c9', txt: 'Kulak burun boğaz gibi bir şey mi?', o: { e: 'side', m: 'wavy', x: ['sweat'] } },
];
const HEAD = `<div class="chh6"><div class="av">${AKRABA.map((a) => `<i style="background:${a.c}">${a.who[0]}</i>`).join('')}</div><div class="t"><b>Aile grubu</b><span>Teyze, Amca, Hala, Dayı, Sen</span></div></div>`;
const msgH = (a) => `<div class="msg6"><div class="av" style="background:${a.c}">${a.who[0]}</div><div class="bb"><small style="color:${a.c === '#ffd36a' ? '#a36a00' : a.c === '#b9f5c9' ? '#1f8a4b' : a.c === '#9be7ff' ? '#1f6fa0' : '#c2185b'}">${a.who}</small>${a.txt}</div></div>`;
const meH = (t, big) => `<div class="msg6 me"><div class="bb ${big ? 'big' : ''}">${t}</div></div>`;
const typH = (a) => `<div class="msg6"><div class="av" style="background:${a.c}">${a.who[0]}</div><div class="typ"><i></i><i></i><i style="opacity:.5"></i></div></div>`;
const chatBase = () => [css(), { kind: 'html', y: 0, at: 0, anim: 'none', html: '<div class="chat6"><div class="pat"></div></div>' }, { kind: 'html', html: HEAD, y: 245, at: 0, anim: 'none', z: 5 }];
const BUB_Y = [410, 560, 715, 935, 1090];  // tek satır ≈135 px, iki satır ≈200 px
const wm5 = (id) => ({ ...wm(id), y: 288, dx: 330 });
const sahne5 = (k) => {
  const L = [...chatBase()];
  // önceki mesajlar (sabit), sonuncusu yeni
  const all = [{ me: 'Odyoloji okuyorum' }, ...AKRABA.slice(0, k + 1)];
  const shift = Math.max(0, all.length - 5);
  all.forEach((m, j) => {
    const y = BUB_Y[j - shift] ?? null; if (y == null || j < shift) return;
    const isNew = j === all.length - 1;
    L.push({ kind: 'html', html: m.me ? meH(m.me) : msgH(m), y: y + (m.me ? 0 : 0), at: isNew ? 0.35 : 0, anim: isNew ? 'pop' : 'none', ...(isNew ? {} : {}) });
    if (isNew && !m.me) L.push({ kind: 'html', html: typH(m), y, at: 0, until: 0.35, anim: 'fade', fadeT: 0.08 });
  });
  const a = AKRABA[k];
  L.push(odiL(250, `o5_${k}`, { ...a.o, y: 1320, dx: -300, at: 0.55, anim: 'pop' }));
  L.push({ kind: 'html', cls: 'pun6 md', html: `<span class="lo">${['…', 'Hı hı.', 'Yok.', 'Değil.'][k]}</span>`, y: 1370, dx: 110, at: 0.75, anim: 'slam', slamFrom: 1.6 });
  L.push(wm5(`5_${k}`));
  return { id: `m${k + 1}`, dur: ab(4), bg: 'black', ...(k === 0 ? { mus: 'dusty' } : {}), sfx: [[0, 'type', 0.25], [0.35, 'pop', 0.5], [0.36, 'ding', 0.2], [0.75, ['scratch', 'boing', 'bonk', 'trombone'][k], 0.3]], layers: L };
};
const akraba = {
  slug: 'akrabalar-odyoloji', title: 'Akrabalara “odyoloji okuyorum” deyince', ad: true, bpm: 96, snap: ab(1), style: 'lofi', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.5, limit: 0.6, jpegOpaque: true,
  duck: { music: -7, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: ab(5), bg: 'black', mus: 'off', fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.05]] }, sfx: [[0, 'hit', 0.5], [0.9, 'type', 0.35], [1.4, 'pop', 0.5]], layers: [
      ...chatBase(),
      { kind: 'html', cls: 'pun6 md', html: 'Akrabalara<br><em>“odyoloji<br>okuyorum”</em><br>deyince', y: 520, at: 0.02, anim: 'slam', slamFrom: 2.0, z: 6 },
      { kind: 'html', html: meH('Odyoloji okuyorum'), y: 1240, at: 1.4, anim: 'pop', z: 6 },
      wm5('5h'),
    ] },
    ...AKRABA.map((_, k) => sahne5(k)),
    { id: 'cevap', dur: ab(10), bg: 'black', mus: 'lift', fx: { flash: [[0, 0.1, [255, 214, 90], 0.4]] }, sfx: [[0, 'type', 0.3], [0.35, 'sparkle', 0.5], [0.4, 'pop', 0.5]], layers: [
      ...chatBase(),
      { kind: 'html', html: '<div class="sys6">Sen yazıyor…</div>', y: 420, at: 0, until: 0.4, anim: 'fade' },
      { kind: 'html', html: meH('<b style="font-size:62px">Odyoloji;</b><br>işitme ve dengeyi <u style="text-decoration:none;color:#7a2bd1">değerlendiren</u>, <u style="text-decoration:none;color:#7a2bd1">rehabilite eden</u> ve <u style="text-decoration:none;color:#7a2bd1">koruyan</u> bilim dalıdır.', true), y: 480, at: 0.4, anim: 'pop' },
      { kind: 'html', html: meH('Kulak çınlaması da konumuz: önce odyolojik değerlendirme.'), y: 1000, at: 2.4, anim: 'pop' },
      odiL(260, 'o5c', { e: 'star', m: 'grin', y: 1220, dx: -300, at: 0.5, anim: 'drop', bob: 1.4 }),
      { kind: 'html', cls: 'pun6 sm', html: 'Gururla.', y: 1330, dx: 120, at: 1.0, anim: 'stamp', rot: -4 },
      wm5('5c'),
    ] },
    { id: 'gonder', dur: ab(5), bg: 'black', mus: 'lift', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'whoosh', 0.4], [0.2, 'pop', 0.4]], layers: [
      ...chatBase(),
      { kind: 'html', html: meH('<b style="font-size:62px">Odyoloji;</b><br>işitme ve dengeyi <u style="text-decoration:none;color:#7a2bd1">değerlendiren</u>, <u style="text-decoration:none;color:#7a2bd1">rehabilite eden</u> ve <u style="text-decoration:none;color:#7a2bd1">koruyan</u> bilim dalıdır.', true), y: 480, at: 0, anim: 'none' },
      { kind: 'html', html: '<div style="width:1080px;height:1920px;background:rgba(8,5,24,.55)"></div>', y: 0, at: 0, anim: 'fade', z: 4 },
      { kind: 'html', cls: 'pun6 xl', html: 'Sen de<br><em>duydun mu?</em>', y: 1010, at: 0.05, anim: 'slam', slamFrom: 1.8, z: 6 },
      { kind: 'html', cls: 'tag6 teal', html: 'Arkadaşına gönder', y: 1360, at: 0.35, anim: 'pop', z: 6, pulse: 96, pulseAt: 0.35, pulseAmt: 0.05 },
      wm5('5g'),
    ] },
    sonSahne('5', ab(3)),
  ],
  vo: [
    { id: 'e1', scene: 'kanca', at: 0.1, nosub: true },
    { id: 'e2', scene: 'cevap', at: 0.4, nosub: true },
    { id: 'e3', scene: 'gonder', at: 0.1, nosub: true },
  ],
  cover: { bg: 'black', layers: [
    ...chatBase(),
    { kind: 'html', html: msgH(AKRABA[0]), y: 430 }, { kind: 'html', html: msgH(AKRABA[1]), y: 610 }, { kind: 'html', html: msgH(AKRABA[2]), y: 790 },
    { kind: 'html', html: '<div style="width:1080px;height:1920px;background:rgba(8,5,24,.5)"></div>', y: 0, z: 4 },
    { kind: 'html', cls: 'pun6 md', html: 'Akrabalara<br><em>“odyoloji<br>okuyorum”</em><br>deyince', y: 820, z: 6 },
  ] },
  post: {
    caption: 'Akrabalara “odyoloji okuyorum” deyince 😅\n“Kulak mı temizliyorsun?” “Benim de kulağım çınlıyor, bir bak.” “Cihaz mı satıyorsun?” “Kulak burun boğaz gibi bir şey mi?”\nCevap: Odyoloji; işitme ve dengeyi değerlendiren, rehabilite eden ve koruyan bilim dalıdır. (Kulak çınlaması da konumuz: önce odyolojik değerlendirme.)\nSen de duydun mu? Arkadaşına gönder 👇',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#akrabalar', '#aile', '#üniversite', '#işitme', '#odisesinyolu'],
  },
};

export const REELS = Object.fromEntries([soyleme, odyogram, timpTip, sinif, akraba].map((r) => [r.slug, r]));
