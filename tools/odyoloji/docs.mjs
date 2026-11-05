#!/usr/bin/env node
// Odyoloji içeriğini uzman incelemesi için tek belgede toplar: docs/odyoloji-icerik.md
// Kaynak: packages/content/src/{odyoloji,cards,quiz}.ts (tek kaynak; belge elle düzenlenmez).
//   node tools/odyoloji/docs.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// İçerik modülleri ortak yardımcıları (metin.ts) içe aktardığı için esbuild ile tek parça yüklenir
const { build } = await import('esbuild');
const yukle = async (rel, external = ['@odi/shared']) => {
  const b = await build({ entryPoints: [join(root, rel)], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', external });
  return import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
};
const { GLOSSARY, EAR_NOTES } = await yukle('packages/content/src/odyoloji.ts');
const { CARDS } = await yukle('packages/content/src/cards.ts');
const { QUIZ_QUESTIONS } = await yukle('packages/content/src/quiz.ts');
const { BILIYOR_MUYDUN, BIYOM_EK } = await yukle('packages/content/src/biliyor-muydun.ts');
// Kulak Kampı
const { BUILDING_INFO, CAMP_TERMS, MONUMENTS, CAMP_COSMETICS } = await yukle('packages/content/src/kamp.ts');
const { REMEDIES, PATHOLOGY_NAMES } = await yukle('packages/content/src/remedies.ts');
// Hasta Vakaları (Kamp Kliniği, docs/17-kamp-gorevleri.md)
const KG = await yukle('packages/content/src/kamp-gorev.ts');
// Bölge patolojileri (oyun ekibi)
const { PATOLOJI_IDS, PATOLOJILER } = await yukle('packages/content/src/patolojiler.ts');
// Harita bölgelerinin kart cümlesi ve kamp süslerinin bilgi satırı
const { BIOMES, BIOME_ORDER } = await yukle('packages/content/src/biomes.ts');
const { DECORATIONS } = await yukle('packages/content/src/kamp-susler.ts');
// Kamp Kliniği sonuç ekranının odyogram özeti (örnek satırlar gerçek yardımcıdan üretilir)
const { odyoSatir } = await yukle('apps/web/src/camp/gorev/yorum.ts', []);
const BNAME = { merkez: 'Odyoloji Merkezi', laboratuvar: 'Odyometri Odası', atolye: 'İşitme Cihazı Atölyesi', depo: 'Kulak Deposu', kule: 'Timpanometri Kulesi', revir: 'Odyoloji Kliniği', tedavi: 'Tedavi Odası' };

const REGION = { 'dis-kulak': 'Dış kulak', kanal: 'Dış kulak yolu', zar: 'Kulak zarı ve orta kulak', kemikcikler: 'Kemikçikler', 'koklea-1': 'Koklea (giriş)', 'koklea-2': 'Koklea (orta kıvrım)', 'koklea-3': 'Koklea (tonotopi)', sinir: 'İşitme siniri', 'beyin-sapi': 'Beyin sapı', korteks: 'İşitsel korteks' };
const esc = (s) => String(s).replace(/\|/g, '\\|');
const lvl = { merakli: 'Meraklı', odyoloji: 'Odyoloji' };
const byLevel = (l) => QUIZ_QUESTIONS.filter((q) => q.level === l).length;

const md = `# Odyoloji içeriği (uzman incelemesi için)

> Bu belge \`node tools/odyoloji/docs.mjs\` ile üretilir; kaynak dosyalar: \`packages/content/src/odyoloji.ts\`, \`biliyor-muydun.ts\`, \`cards.ts\`, \`quiz.ts\`, \`kamp.ts\`, \`kamp-susler.ts\`, \`biomes.ts\`, \`remedies.ts\`, \`patolojiler.ts\`, \`kamp-gorev-vakalar.ts\`, \`apps/web/src/camp/gorev/yorum.ts\`.
> Elle düzenlemeyin; düzeltmeyi kaynakta yapıp belgeyi yeniden üretin.

**İlke:** yalnızca ders kitabı düzeyinde yerleşik bilgiler (Gelfand, *Hearing: An Introduction to Psychological and Physiological
Acoustics*; Katz, *Handbook of Clinical Audiology*; Pickles, *An Introduction to the Physiology of Hearing*; NIOSH 1998; JCIH).
Sayılar yaklaşık ve aralık olarak verilir. Emin olunmayan bilgi eklenmez. Her madde iki derinliktedir: herkes için sade cümle +
isteğe bağlı teknik ayrıntı ("Daha fazla").

**Sayılar:** ${GLOSSARY.length} sözlük terimi · ${EAR_NOTES.length} Tüy Dede notu · ${BILIYOR_MUYDUN.length} bölüm sonu "Biliyor muydun?" satırı + ${BIYOM_EK.length} biyom ek satırı (×2 düzey) · ${CARDS.length} Kulak Kartı ·
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

## Biliyor muydun? — Sahip onayı bekliyor (karar 31) (${BILIYOR_MUYDUN.length + BIYOM_EK.length})

> **Sahip onayı bekliyor (karar 31, YN-059).** Satırlar oyunda yayında; sahip listeyi gözden geçirecek. Kaynak:
> \`packages/content/src/biliyor-muydun.ts\`. Her bölümün sonuç ekranında tek satır, seslendirilmez. Ayarlar › Bilgi düzeyi
> "Genel" ise **genel**, "Odyoloji öğrencisi" ise **odyoloji** satırı gösterilir. Her satır tek cümle, en çok 120 karakter;
> Tüy Dede notlarını, sözlüğü ve kartları kelimesi kelimesine tekrar etmez; tanı ya da tedavi önerisi yoktur. Bir sonuç ekranındaki
> satır bölümün biyom havuzundan seçilir (havuz = biyomun bölüm satırları + bölüme bağlı olmayan **biyom ek satırları**; yakın zamanda
> gösterilen tekrar etmez); oyunun son bölümü (40) kazanılınca o bölümün kendi satırı gelir (YN-236).

| bölüm | genel | odyoloji öğrencisi | kaynak |
|---|---|---|---|
${BILIYOR_MUYDUN.map((b) => `| ${b.bolum} | ${esc(b.genel)} | ${esc(b.odyoloji)}${b.inceleme ? ` *(${esc(b.inceleme)})*` : ''} | ${esc(b.src)} |`).join('\n')}
${BIYOM_EK.map((b) => `| ek · ${REGION[b.biyom]} | ${esc(b.genel)} | ${esc(b.odyoloji)}${b.inceleme ? ` *(${esc(b.inceleme)})*` : ''} | ${esc(b.src)} |`).join('\n')}

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

### Kamp süsleri (${DECORATIONS.length}, docs/14-kamp.md §10)

| kimlik | süs | bilgi (dokununca) |
|---|---|---|
${DECORATIONS.map((d) => `| \`${d.id}\` | **${esc(d.name)}** | ${esc(d.plain)} |`).join('\n')}

## Harita bölgeleri (${BIOME_ORDER.length})

Kaynak: \`packages/content/src/biomes.ts\`. Harita kartındaki tek cümle (anlatı) ve bölge bilgisi.

| bölge | ad | kart cümlesi | bilgi |
|---|---|---|---|
${BIOME_ORDER.map((id) => `| ${REGION[id]} | **${esc(BIOMES[id].name)}** | ${esc(BIOMES[id].blurb)} | ${esc(BIOMES[id].fact)} |`).join('\n')}

## Bölge patolojileri (${PATOLOJI_IDS.length})

Kaynak: \`packages/content/src/patolojiler.ts\` (kimlikler kamp ekibinin \`remedies.ts\` → \`PATHOLOGY_IDS\` listesiyle aynı). Odi'nin
geçtiği bölgeye özgü kulak hastalıkları, bölgenin VAR OLAN engelleri olarak oynanır (\`level-gen/src/patoloji.ts\` yalnız etiket
ekler; geometri ve zorluk eğrisi değişmez). İlk görüşte engelin üstünde uyarı üçgeni, göstergenin üst bandında adı ve iltihaplı görünüm, oyuncunun ilk karşılaşmasında
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
Vakada uygun olmayan test (\`uygunsuz\`, karar 46) puanı değiştirmez; istenirse sonuçta kısa not çıkar: ${KG.VAKALAR.filter((v) => v.uygunsuz).flatMap((v) => Object.entries(v.uygunsuz).map(([t, n]) => `\`${v.id}\` ${esc(v.hasta.ad)}, ${t}: "${esc(n)}"`)).join('; ')}
Sonuç ekranı (YN-080): bulgular "İstediğin testler" (yalnız oyuncunun istedikleri) ve "İsteseydin şunu görecektin" (istenmeyen,
bu vakada yapılabilen testler) diye ayrılır; aşağıdaki açıklama bütün testlere dayandığı için "Tam tablo (bütün testlerle)" başlığıyla gösterilir.
Odyogram özeti (\`yorum.ts\` → \`odyoSatir\`, YN-101/YN-118): saf ses ortalaması dar bir yüksek frekans düşüşünü göstermediği için en kötü
bölge ayrıca söylenir; 8 kHz'te en az 10 dB düzelme varsa çentiğin frekansı (en kötü eşiğin frekansı) adıyla yazılır. Örnek (\`kv05\`):
- Genel: ${odyoSatir(KG.vakaById('kv05').testler.odyometri, 'R', 'genel')}
- Odyoloji: ${odyoSatir(KG.vakaById('kv05').testler.odyometri, 'L', 'odyoloji')}

> **Sahip onayı bekliyor (YN-080, OT-uzman-odyolog-13).** \`kv01\` (Ece, konser sonrası) için uzman önerisi: normal odyogram gürültü
> etkisini kesin olarak dışlamaz; çınlama sürer ya da tekrarlarsa işitme yeniden kontrol edilmeli. Yeni tıbbi cümle olduğu için oyuna
> eklenmedi; sahip onaylarsa vakanın açıklamasına eklenir.

| # | kademe | başlık | hasta | kategori | doğru tanı | anahtar testler | odyogram (SSO 500–2000 Hz) | timpanogram | doğru yönetim | açıklama (sade) | açıklama (teknik) | sözlük | kaynak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${KG.VAKALAR.map((v) => {
  const T = v.testler; const o = KG.isYok(T.odyometri) ? null : T.odyometri; const tp = KG.isYok(T.timpanometri) ? null : T.timpanometri;
  const ody = o ? ['R', 'L'].map((e) => `${e === 'R' ? 'Sağ' : 'Sol'} ${Math.round(KG.pta3(o.ac[e]))} dB (${v.kayip?.[e] ?? KG.kayipTipi(o, e)})`).join('; ') : '—';
  const tim = tp ? ['R', 'L'].map((e) => (tp[e] ? `${e === 'R' ? 'Sağ' : 'Sol'} ${tp[e].tip} (${tp[e].hacim} ml)` : `${e === 'R' ? 'Sağ' : 'Sol'} —`)).join('; ') : '—';
  return `| \`${v.id}\` | ${v.kademe} | **${esc(v.baslik)}** | ${esc(v.hasta.ad)}, ${esc(v.hasta.yas)} | ${v.kat} | ${esc(KG.taniById(v.tani.dogru).teknik)} | ${v.anahtar.join(', ')} | ${esc(ody)} | ${esc(tim)} | ${esc(v.yonetim[0].sade)} | ${esc(v.aciklama.sade)} | ${esc(v.aciklama.teknik)} | \`${v.terim}\` | ${esc(v.kaynak)} |`;
}).join('\n')}

### İstenmeyen testlerin yorumu (YN-090)

Sonuç ekranında "İsteseydin şunu görecektin" altında, istenmeyen test satırının altında tek cümle (\`testler.<test>.yorum\`, isteğe bağlı).
Tanıyı söylemez; bulgunun neyle uyumlu olduğunu söyler; timpanogram yorumu tek başına tanı demez. Kaynak: vakanın kaynağı ve
Katz, *Handbook of Clinical Audiology* (OAE, akustik refleks, konuşma odyometrisi, işitsel nöropati bölümleri); JCIH (2019).

| vaka | test | yorum | kaynak |
|---|---|---|---|
${KG.VAKALAR.flatMap((v) => KG.VAKA_TESTLERI.map((t) => [t, KG.testYorumu(v, t.id)]).filter(([, y]) => y).map(([t, y]) => `| \`${v.id}\` ${esc(v.hasta.ad)} | ${esc(t.ad)} | ${esc(y)} | ${esc(v.kaynak)} |`)).join('\n')}

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
// satır sonu bölünmesin diye içerikteki görünmez WORD JOINER (metin.ts) belgede gerekmez
writeFileSync(join(root, 'docs/odyoloji-icerik.md'), md.replace(/\u2060/g, ''));
console.log(`✓ docs/odyoloji-icerik.md · ${GLOSSARY.length} terim, ${EAR_NOTES.length} not, ${BILIYOR_MUYDUN.length}+${BIYOM_EK.length} biliyor muydun, ${CARDS.length} kart, ${QUIZ_QUESTIONS.length} soru`);
