#!/usr/bin/env node
// Odyoloji içeriğini uzman incelemesi için tek belgede toplar: docs/odyoloji-icerik.md
// Kaynak: packages/content/src/{odyoloji,cards,quiz}.ts (tek kaynak; belge elle düzenlenmez).
//   node tools/odyoloji/docs.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { GLOSSARY, EAR_NOTES } = await import(join(root, 'packages/content/src/odyoloji.ts'));
const { CARDS } = await import(join(root, 'packages/content/src/cards.ts'));
const { QUIZ_QUESTIONS } = await import(join(root, 'packages/content/src/quiz.ts'));

const REGION = { 'dis-kulak': 'Dış kulak', kanal: 'Dış kulak yolu', zar: 'Kulak zarı ve orta kulak', kemikcikler: 'Kemikçikler', 'koklea-1': 'Koklea (giriş)', 'koklea-2': 'Koklea (Corti organı)', 'koklea-3': 'Koklea (tonotopi)', sinir: 'İşitme siniri', 'beyin-sapi': 'Beyin sapı', korteks: 'İşitsel korteks' };
const esc = (s) => String(s).replace(/\|/g, '\\|');
const lvl = { merakli: 'Meraklı', odyoloji: 'Odyoloji' };
const byLevel = (l) => QUIZ_QUESTIONS.filter((q) => q.level === l).length;

const md = `# Odyoloji içeriği (uzman incelemesi için)

> Bu belge \`node tools/odyoloji/docs.mjs\` ile üretilir; kaynak dosyalar: \`packages/content/src/odyoloji.ts\`, \`cards.ts\`, \`quiz.ts\`.
> Elle düzenlemeyin; düzeltmeyi kaynakta yapıp belgeyi yeniden üretin.

**İlke:** yalnızca ders kitabı düzeyinde yerleşik bilgiler (Gelfand, *Hearing: An Introduction to Psychological and Physiological
Acoustics*; Katz, *Handbook of Clinical Audiology*; Pickles, *An Introduction to the Physiology of Hearing*; NIOSH 1998; JCIH).
Sayılar yaklaşık ve aralık olarak verilir. Emin olunmayan bilgi eklenmez. Her madde iki derinliktedir: herkes için sade cümle +
isteğe bağlı teknik ayrıntı ("Daha fazla").

**Sayılar:** ${GLOSSARY.length} sözlük terimi · ${EAR_NOTES.length} Tüy Dede notu · ${CARDS.length} Kulak Kartı ·
${QUIZ_QUESTIONS.length} quiz sorusu (${byLevel('merakli')} Meraklı, ${byLevel('odyoloji')} Odyoloji).

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

## Quiz (${QUIZ_QUESTIONS.length})

Doğru cevap **kalın**. Kaynak: Meraklı düzeyi genel bilgi; Odyoloji düzeyi yukarıdaki ders kitaplarının ilgili bölümleri.

| # | düzey | konu | soru | seçenekler | açıklama |
|---|---|---|---|---|---|
${QUIZ_QUESTIONS.map((q) => `| ${q.id} | ${lvl[q.level]} | ${q.topic} | ${esc(q.text)} | ${q.choices.map((c, i) => (i === q.answer ? `**${esc(c)}**` : esc(c))).join(' · ')} | ${esc(q.explain)} |`).join('\n')}
`;
writeFileSync(join(root, 'docs/odyoloji-icerik.md'), md);
console.log(`✓ docs/odyoloji-icerik.md · ${GLOSSARY.length} terim, ${EAR_NOTES.length} not, ${CARDS.length} kart, ${QUIZ_QUESTIONS.length} soru`);
