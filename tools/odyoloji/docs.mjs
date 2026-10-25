#!/usr/bin/env node
// Odyoloji içeriğini uzman incelemesi için tek belgede toplar: docs/odyoloji-icerik.md
// Kaynak: packages/content/src/{odyoloji,cards,quiz}.ts (tek kaynak; belge elle düzenlenmez).
//   node tools/odyoloji/docs.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { GLOSSARY, EAR_NOTES } = await import(join(root, 'packages/content/src/odyoloji.ts'));
const { CARDS } = await import(join(root, 'packages/content/src/cards.ts'));
const { QUIZ_QUESTIONS } = await import(join(root, 'packages/content/src/quiz.ts'));
// Kulak Kampı (kamp.ts başka modül içe aktardığı için esbuild ile tek parça yüklenir)
const { build } = await import('esbuild');
const bundled = await build({ entryPoints: [join(root, 'packages/content/src/kamp.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', external: ['@odi/shared'] });
const { BUILDING_INFO, CAMP_TERMS, MONUMENTS, REMEDIES, PATHOLOGY_NAMES, CAMP_COSMETICS } = { ...(await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text + "\nexport { REMEDIES, PATHOLOGY_NAMES } from '" + pathToFileURL(join(root, 'packages/content/src/remedies.ts')).href + "';").toString('base64'))) };
// Hasta Vakaları (Kamp Kliniği, docs/17-kamp-gorevleri.md): tek parça yüklenir
const vb = await build({ entryPoints: [join(root, 'packages/content/src/kamp-gorev.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', external: ['@odi/shared'] });
const KG = await import('data:text/javascript;base64,' + Buffer.from(vb.outputFiles[0].text).toString('base64'));
// Bölge patolojileri (oyun ekibi): yalnız tür içe aktarır
const { PATOLOJI_IDS, PATOLOJILER } = await import(join(root, 'packages/content/src/patolojiler.ts'));
const BNAME = { merkez: 'Odyoloji Merkezi', laboratuvar: 'Odyometri Odası', atolye: 'İşitme Cihazı Atölyesi', depo: 'Kulak Deposu', kule: 'Timpanometri Kulesi', revir: 'Odyoloji Kliniği', tedavi: 'Tedavi Odası' };

const REGION = { 'dis-kulak': 'Dış kulak', kanal: 'Dış kulak yolu', zar: 'Kulak zarı ve orta kulak', kemikcikler: 'Kemikçikler', 'koklea-1': 'Koklea (giriş)', 'koklea-2': 'Koklea (Corti organı)', 'koklea-3': 'Koklea (tonotopi)', sinir: 'İşitme siniri', 'beyin-sapi': 'Beyin sapı', korteks: 'İşitsel korteks' };
const esc = (s) => String(s).replace(/\|/g, '\\|');
const lvl = { merakli: 'Meraklı', odyoloji: 'Odyoloji' };
const byLevel = (l) => QUIZ_QUESTIONS.filter((q) => q.level === l).length;

const md = `# Odyoloji içeriği (uzman incelemesi için)

> Bu belge \`node tools/odyoloji/docs.mjs\` ile üretilir; kaynak dosyalar: \`packages/content/src/odyoloji.ts\`, \`cards.ts\`, \`quiz.ts\`, \`kamp.ts\`, \`remedies.ts\`, \`patolojiler.ts\`, \`kamp-gorev-vakalar.ts\`.
> Elle düzenlemeyin; düzeltmeyi kaynakta yapıp belgeyi yeniden üretin.

**İlke:** yalnızca ders kitabı düzeyinde yerleşik bilgiler (Gelfand, *Hearing: An Introduction to Psychological and Physiological
Acoustics*; Katz, *Handbook of Clinical Audiology*; Pickles, *An Introduction to the Physiology of Hearing*; NIOSH 1998; JCIH).
Sayılar yaklaşık ve aralık olarak verilir. Emin olunmayan bilgi eklenmez. Her madde iki derinliktedir: herkes için sade cümle +
isteğe bağlı teknik ayrıntı ("Daha fazla").

**Sayılar:** ${GLOSSARY.length} sözlük terimi · ${EAR_NOTES.length} Tüy Dede notu · ${CARDS.length} Kulak Kartı ·
${QUIZ_QUESTIONS.length} quiz sorusu (${byLevel('merakli')} Meraklı, ${byLevel('odyoloji')} Odyoloji) · Kulak Kampı: ${Object.keys(BUILDING_INFO).length} bina,
${CAMP_TERMS.length} kamp terimi, ${REMEDIES.length} Tedavi Odası malzemesi, ${MONUMENTS.length} bölge anıtı ·
${PATOLOJI_IDS.length} bölge patolojisi (${PATOLOJI_IDS.filter((id) => PATOLOJILER[id].ilkBolum > 0).length} tanesi bölümlerde) · ${KG.VAKALAR.length} kurgusal hasta vakası (Kamp Kliniği).

## Kulak Sözlüğü (${GLOSSARY.length})

| bölge | terim | sade | teknik | kaynak |
|---|---|---|---|---|
${GLOSSARY.map((g) => `| ${REGION[g.region]} | **${esc(g.term)}** | ${esc(g.plain)} | ${esc(g.tech)} | ${esc(g.src)} |`).join('\n')}

## Tüy Dede'nin Notu (${EAR_NOTES.length})

| bölge | sade (seslendirilir) | Daha fazla | kaynak |
|---|---|---|---|
${EAR_NOTES.map((n) => `| ${REGION[n.region]} | ${esc(n.plain)} | ${esc(n.tech)} | ${esc(n.src)} |`).join('\n')}

## Kulak Kartları (${CARDS.length})

| kart | başlık | sade | teknik |
|---|---|---|---|
${CARDS.map((c) => `| \`${c.id}\` | ${esc(c.title)} | ${esc(c.fact)} | ${esc(c.tech ?? '')} |`).join('\n')}

## Kulak Kampı (docs/14-kamp.md)

Ek kaynaklar: Katz, *Handbook of Clinical Audiology* (test bataryası, saf ses ve konuşma odyometrisi, timpanometri, işitme cihazı,
tinnitus, işitsel işlemleme ve nöropati bölümleri); Gelfand, *Essentials of Audiology*; standart KBB kitapları (Cummings
*Otolaryngology*; Scott-Brown's *Otorhinolaryngology*: dış kulak hastalıkları, otitis media, otoskleroz, timpanoplasti, osikuloplasti);
Jerger ve Hayes (1976) çapraz kontrol ilkesi; Clark (1981) işitme kaybı dereceleri. Malzemeler öğretmek içindir, tıbbi öneri değildir.

### Binalar (${Object.keys(BUILDING_INFO).length})

| bina | sade | Daha fazla | kaynak |
|---|---|---|---|
${Object.entries(BUILDING_INFO).map(([id, b]) => `| **${BNAME[id]}** | ${esc(b.plain)} | ${esc(b.tech)} | ${esc(b.src)} |`).join('\n')}

### Kamp sözlük terimleri (${CAMP_TERMS.length})

| açan bina | terim | sade | teknik | kaynak |
|---|---|---|---|---|
${CAMP_TERMS.map((t) => `| ${BNAME[t.building]} Sv ${t.level} | **${esc(t.term)}** | ${esc(t.plain)} | ${esc(t.tech)} | ${esc(t.src)} |`).join('\n')}

### Tedavi Odası malzemeleri (${REMEDIES.length})

| malzeme | terim | etkisiz kıldığı engel | sade | teknik | kaynak |
|---|---|---|---|---|---|
${REMEDIES.map((r) => `| **${esc(r.name)}** (Sv ${r.level}) | ${esc(r.term)} | ${r.counters.map((p) => PATHOLOGY_NAMES[p]).join(', ')} | ${esc(r.plain)} | ${esc(r.tech)} | ${esc(r.src)} |`).join('\n')}

### Kampta açılan kozmetikler ve bölge anıtları

${CAMP_COSMETICS.map((c) => `- \`${c.id}\` — ${BNAME[c.building]} Sv ${c.level}`).join('\n')}

| bölge | anıt | açıklama |
|---|---|---|
${MONUMENTS.map((m) => `| ${REGION[m.region]} | **${esc(m.name)}** | ${esc(m.plain)} |`).join('\n')}

## Bölge patolojileri (${PATOLOJI_IDS.length})

Kaynak: \`packages/content/src/patolojiler.ts\` (kimlikler kamp ekibinin \`remedies.ts\` → \`PATHOLOGY_IDS\` listesiyle aynı). Odi'nin
geçtiği bölgeye özgü kulak hastalıkları, bölgenin VAR OLAN engelleri olarak oynanır (\`level-gen/src/patoloji.ts\` yalnız etiket
ekler; geometri ve zorluk eğrisi değişmez). İlk görüşte engelin üstünde adı (✚) ve iltihaplı görünüm, oyuncunun ilk karşılaşmasında
Tüy Dede'nin sade cümlesi çıkar (kalıcı anahtar \`patoloji:<kimlik>\`). Tedavi Odası malzemesi o patolojinin ilk karşılaşmasını bir
kez etkisiz kılar (docs/14-kamp.md §4). Dil eğitseldir, tıbbi öneri değildir: tanı ve tedaviyi hekim ve odyolog birlikte koyar.
Kaynaklar ders kitabı düzeyindedir (Katz, *Handbook of Clinical Audiology*; Gelfand, *Essentials of Audiology*; Cummings
*Otolaryngology*; Scott-Brown's *Otorhinolaryngology*).

| ilk görüş (6. bölüm, kanal kemik çıkıntısı) | malzeme etkisi (21. bölüm, kulak tıkacı gürültü bulutunu söndürdü) |
|---|---|
| ![ilk görüş](img/patoloji-ilk-gorus.png) | ![malzeme](img/patoloji-malzeme.png) |

| kimlik | ad | terim | bölge | ilk bölüm | oyundaki karşılığı | Tüy Dede (sade) | teknik | işe yarayan malzeme | kaynak |
|---|---|---|---|---|---|---|---|---|---|
${PATOLOJI_IDS.map((id) => { const p = PATOLOJILER[id]; const rs = REMEDIES.filter((r) => r.counters.includes(id)).map((r) => r.name).join(', ') || '— (hekim süreci)'; return `| \`${id}\` | **${esc(p.ad)}** | ${esc(p.terim)} | ${p.bolge.map((b) => REGION[b]).join(', ')} | ${p.ilkBolum || '—'} | ${esc(p.mekanik)} | ${esc(p.sade)} | ${esc(p.teknik)} | ${esc(rs)} | ${esc(p.kaynak)} |`; }).join('\n')}

## Hasta Vakaları — Kamp Kliniği (${KG.VAKALAR.length}, docs/17-kamp-gorevleri.md)

Kaynak: \`packages/content/src/kamp-gorev-vakalar.ts\` (vakalar), \`kamp-gorev-vaka.ts\` (model, sınıflama, puanlama, tutarlılık denetimi).
Vakalar KURGUSALDIR (çizim karakterler; gerçek kişi değildir) ve eğitim içindir; oyuncuya ya da gerçek bir kişiye tıbbi öneri
değildir. Her vakanın odyogramı, timpanogramı, refleksi, OAE/ABR'si ve konuşma testi tanısıyla tutarlıdır: \`vakaTutarsizliklari\`
(ASHA odyogram kuralı: hava–kemik aralığı ≥15 dB en az iki frekansta = iletim bileşeni; kemik yolu >25 dB HL = koklear bileşen;
Jerger timpanogram değerleri; otoskopi ↔ timpanogram ↔ kanal hacmi; OAE ↔ orta kulak ve eşik; refleks ↔ iletim kaybı; SRT ↔ saf ses
ortalaması ±10 dB; kategoriye özgü örüntüler) her vaka için birim testinde sınanır. Kademe: Odyoloji Kliniği Sv ${KG.KG_KURAL.kademeSv.join(' / ')}.
Puanlama: doğru tanı 1★, doğru yönetim +1★, verimli test seçimi (anahtar testlerin hepsi ve toplam ≤ anahtar + 1) +1★.

| # | kademe | başlık | hasta | kategori | doğru tanı | anahtar testler | odyogram (SSO 500–2000 Hz) | timpanogram | doğru yönetim | açıklama (teknik) | sözlük | kaynak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${KG.VAKALAR.map((v) => {
  const T = v.testler; const o = KG.isYok(T.odyometri) ? null : T.odyometri; const tp = KG.isYok(T.timpanometri) ? null : T.timpanometri;
  const ody = o ? ['R', 'L'].map((e) => `${e === 'R' ? 'Sağ' : 'Sol'} ${Math.round(KG.pta3(o.ac[e]))} dB (${v.kayip?.[e] ?? KG.kayipTipi(o, e)})`).join('; ') : '—';
  const tim = tp ? ['R', 'L'].map((e) => (tp[e] ? `${e === 'R' ? 'Sağ' : 'Sol'} ${tp[e].tip} (${tp[e].hacim} ml)` : `${e === 'R' ? 'Sağ' : 'Sol'} —`)).join('; ') : '—';
  return `| \`${v.id}\` | ${v.kademe} | **${esc(v.baslik)}** | ${esc(v.hasta.ad)}, ${esc(v.hasta.yas)} | ${v.kat} | ${esc(KG.taniById(v.tani.dogru).teknik)} | ${v.anahtar.join(', ')} | ${esc(ody)} | ${esc(tim)} | ${esc(v.yonetim[0].sade)} | ${esc(v.aciklama.teknik)} | \`${v.terim}\` | ${esc(v.kaynak)} |`;
}).join('\n')}

## Timpanogram Eşleştir — soru bankası (${KG.TIMP_SORULAR.length}, docs/17-kamp-gorevleri.md)

Kaynak: \`packages/content/src/kamp-gorev-timpano.ts\`. Timpanogram tek başına tanı koydurmaz: "eğri → bulgu" cevapları yalnız eğrinin
gösterdiğini söyler; olası nedenler cevaptan sonraki açıklamada olasılık diliyle geçer. Tanı düzeyinde cevap yalnız otoskopi ya da öykü
verilen kısa vakalarda. Değerler 226 Hz prob tonu; yetişkin ve çocuk kanal hacmi normlarıyla \`timpHatasi\` denetiminden geçer.
Genel havuz ${KG.timpanoHavuzu('genel').length} soru, odyoloji havuzu ${KG.timpanoHavuzu('odyoloji').length} soru; oyuncu başına sunucu destesi.

| # | düzey | biçim | yaş | soru / eğri | doğru cevap | kaynak |
|---|---|---|---|---|---|---|
${KG.TIMP_SORULAR.map((q) => { const b = KG.timpBulmaca(q, 1); const d = b.secenek[b.dogru]; const cev = d.egri ? `${d.egri.tip} (${d.egri.basinc ?? '—'} daPa, ${d.egri.uyum} ml, ${d.egri.hacim} ml)` : (d.teknik ? `${d.teknik}: ${d.metin}` : d.metin); const eg = b.egri ? ` · ${b.egri.tip} (${b.egri.basinc ?? '—'} daPa, ${b.egri.uyum} ml, ${b.egri.hacim} ml)` : b.sag ? ` · Sağ ${b.sag.tip} ${b.sag.hacim} ml / Sol ${b.sol.tip} ${b.sol.hacim} ml` : ''; return `| \`${q.id}\` | ${q.duzey === 'genel' ? 'Genel' : 'Odyoloji'} | ${KG.TIMP_BICIM_ADI[q.bicim]} | ${q.yas ?? 'yetişkin'} | ${esc((b.hikaye ? b.hikaye + ' ' : '') + b.soru + (b.bulgu ? ' ' + KG.EGRI_ADI[b.bulgu].sade : '') + eg)} | ${esc(cev)} | ${esc(q.kaynak)} |`; }).join('\n')}

## Quiz (${QUIZ_QUESTIONS.length})

Doğru cevap **kalın**. Kaynak: Meraklı düzeyi genel bilgi; Odyoloji düzeyi yukarıdaki ders kitaplarının ilgili bölümleri.

| # | düzey | konu | soru | seçenekler | açıklama |
|---|---|---|---|---|---|
${QUIZ_QUESTIONS.map((q) => `| ${q.id} | ${lvl[q.level]} | ${q.topic} | ${esc(q.text)} | ${q.choices.map((c, i) => (i === q.answer ? `**${esc(c)}**` : esc(c))).join(' · ')} | ${esc(q.explain)} |`).join('\n')}
`;
writeFileSync(join(root, 'docs/odyoloji-icerik.md'), md);
console.log(`✓ docs/odyoloji-icerik.md · ${GLOSSARY.length} terim, ${EAR_NOTES.length} not, ${CARDS.length} kart, ${QUIZ_QUESTIONS.length} soru`);
