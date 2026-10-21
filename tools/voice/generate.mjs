#!/usr/bin/env node
// Tüy Dede'nin sesleri: bütün satırları BİR KEZ üretir, uygulamaya gömülecek küçük MP3'lere çevirir.
// Uygulama bu betiği hiç çalıştırmaz; yalnız apps/web/public/voice/ altındaki hazır dosyaları çalar.
//
//   node tools/voice/generate.mjs --export          # docs/anlatici-metinleri.md + .csv (seslendiren / TTS için metin listesi)
//   node tools/voice/generate.mjs                   # eksik/değişen satırları üret (Coqui TTS + ffmpeg), manifest ve mobil eşlemeyi yaz
//   node tools/voice/generate.mjs --all             # hepsini yeniden üret
//   node tools/voice/generate.mjs --candidates hikaye-01,sonuc-02 [--out klasör]   # üç üslubu yan yana üret (karşılaştırma için)
//   node tools/voice/generate.mjs --check           # her satırın güncel bir kaydı var mı (CI / test)
//
// Gerekenler (yalnız üretim için): ffmpeg (libmp3lame, rubberband), Python 3.10-3.12 + `pip install "coqui-tts[codec]"` (CPU torch yeter)
// ve Türkçe model dosyaları. Ortam değişkenleri:
//   ODI_TTS_PY      Coqui kurulu python (ör. ~/odi-tts/venv/bin/python)
//   ODI_TTS_MODELS  modellerin açıldığı klasör (içinde tts_models--tr--common-voice--glow-tts/ ve vocoder_models--tr--common-voice--hifigan/)
//   ODI_TTS_CACHE   ham WAV önbelleği (varsayılan: işletim sistemi geçici klasörü)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { NARRATOR_LINES: SCRIPT_LINES, VOICE_DIRECTION, textHash } = await import(join(root, 'apps/web/src/ftue/script.ts'));
const { EAR_NOTES } = await import(join(root, 'packages/content/src/odyoloji.ts'));
/** seslendirilen her şey: anlatıcı satırları + Tüy Dede'nin Notu'nun sade cümleleri (teknik satırlar yalnız yazılı) */
const NARRATOR_LINES = [
  ...SCRIPT_LINES,
  ...EAR_NOTES.map((n) => ({ id: `not-${n.id}`, text: n.plain, spoken: n.spoken, context: `Tüy Dede'nin Notu · ${n.region}`, emotion: 'bilge, sıcak, merak uyandıran (wise, warm)' })),
];
const OUT = join(root, 'apps/web/public/voice');
const MOBILE_MAP = join(root, 'apps/mobile/src/voice/files.ts');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

/**
 * Tüy Dede üslubu. Ham ses: Coqui Türkçe erkek (f0 ≈ 100-110 Hz).
 * Hız modelin kendi ayarıyla (GlowTTS length_scale < 1: doğal prozodiyle daha canlı); perde biraz aşağı (biçimleyiciler korunur;
 * asla yukarı değil, sesin incelmesin), 80 Hz altı kesilir (boğuk/gümbür olmasın), hafif sıcaklık, ~3 kHz'te hafif netlik,
 * cümle arası duraklamalar en çok ~0,2-0,25 sn, vibrato/tremolo yok, yankı yok ya da çok az; −16 LUFS, sınırlayıcı.
 * Önceki "dede" üslubu (tempo ×0,92 + vibrato/tremolo) sahibine fazla yavaş ve rahatsız edici geldi; kaldırıldı.
 */
const STYLES = {
  'dede-hizli': { ls: 0.85, semitones: -1.5, warm: 1.5, presence: 2, air: -1, echo: null, pause: 0.2 },
  'dede-dogal': { ls: 0.9, semitones: -1.5, warm: 2, presence: 1.5, air: -1.5, echo: '0.85:0.9:18:0.035', pause: 0.25 },
};
/** seçilen üslup: iki aday ölçüldü (konuşma hızı, f0); sahibi örnekleri dinleyip "dede-dogal"ı seçti — tüm satırlar, yeni eklenenler de, bununla */
const STYLE = val('--style') ?? 'dede-dogal';
const BITRATE = '48k';

/** modelin okuyabildiği biçime çevir: Türkçe küçük harf, düz kesme işareti, desteklenen noktalama */
const ALLOWED = /^[abcçdefgğhıijklmnoöprsştuüvyz!'(),\-.:;? ]*$/;
export function spokenOf(line) {
  const s = (line.spoken ?? line.text)
    .replace(/[’‘`]/g, "'").replace(/[“”"«»]/g, '').replace(/…/g, '.').replace(/\s+/g, ' ').trim()
    .toLocaleLowerCase('tr')
    // şapkalı ünlüler (şikâyet, hâlâ, millî) modelin alfabesinde yok: düz ünlüyle okunur
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
  if (!ALLOWED.test(s)) {
    const bad = [...new Set([...s].filter((c) => !ALLOWED.test(c)))].join(' ');
    throw new Error(`${line.id}: model bu karakterleri okuyamaz → "spoken" alanında okunduğu gibi yazın: ${bad}`);
  }
  return s;
}

function filters(st) {
  const ratio = Math.pow(2, st.semitones / 12).toFixed(5);
  const trim = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04';
  // cümle arası sessizlikler en çok st.pause sn (uzun duraklama kısaltılır, kısa olanlar olduğu gibi)
  const pauses = `silenceremove=stop_periods=-1:stop_duration=${st.pause}:stop_threshold=-42dB:stop_silence=${st.pause}`;
  return [
    trim, 'areverse', trim, 'areverse', pauses,
    `rubberband=pitch=${ratio}:formant=preserved:pitchq=quality`,
    'highpass=f=80:poles=2',
    `equalizer=f=220:t=q:w=0.9:g=${st.warm}`, `equalizer=f=3000:t=q:w=1.2:g=${st.presence}`, `treble=g=${st.air}:f=8000`,
    ...(st.echo ? [`aecho=${st.echo}`] : []),
    'afade=t=in:d=0.015', 'adelay=60', 'apad=pad_dur=0.12',
  ].join(',');
}

/** iki geçişli loudnorm: önce ölç, sonra doğrusal kazançla tam −16 LUFS (kısa kliplerde tek geçiş hedefi tutturamaz) */
function post(wav, mp3, style) {
  mkdirSync(dirname(mp3), { recursive: true });
  const chain = filters(STYLES[style]);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `${chain},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', `${chain},${ln},alimiter=limit=0.8:attack=2:release=40:level=false`, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', BITRATE, mp3]);
}
const durMs = (f) => Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()) * 1000);

// ---------------------------------------------------------------- metin dışa aktarımı (seslendiren / TTS hizmeti için)
function exportScript() {
  const csv = ['id,text,spoken,context,emotion,file', ...NARRATOR_LINES.map((l) => [l.id, l.text, spokenOf(l), l.context, l.emotion, `${l.id}.mp3`].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
  writeFileSync(join(root, 'docs/anlatici-metinleri.csv'), '﻿' + csv + '\n');
  const md = `# Tüy Dede — anlatıcı metinleri

> Bu dosya \`node tools/voice/generate.mjs --export\` ile üretilir; kaynak: \`apps/web/src/ftue/script.ts\`. Elle düzenlemeyin.
> Aynı liste CSV olarak: \`docs/anlatici-metinleri.csv\` (id, metin, okunuş, bağlam, duygu, dosya adı).

## Seslendirme yönergesi

${VOICE_DIRECTION}

Dosyalar \`apps/web/public/voice/<id>.mp3\` adıyla konur (mono, ~48 kbps MP3, −16 LUFS). Uygulama bir satırı yalnızca
kayıt metni ekrandaki altyazıyla aynıysa çalar (manifest'teki parmak izi); kaydı olmayan satırda cihazın sesi (TTS) devreye girer.

## Ses lisansı

- Üretim: **Coqui TTS** (MPL-2.0 kitaplık; yalnız geliştirici makinesinde çalışır, uygulamaya girmez).
- Model: \`tts_models/tr/common-voice/glow-tts\` + \`vocoder_models/tr/common-voice/hifigan\` — yazar **Fatih Akademi**, lisans **MIT**;
  eğitim verisi Mozilla **Common Voice** Türkçe (CC0). Model dosyaları:
  https://github.com/coqui-ai/TTS/releases/tag/v0.6.1_models
- Uygulamada anma: Ayarlar › "Anlatıcı sesi: Coqui TTS, Fatih Akademi Türkçe modeli (MIT)".
- Üretilen ses dosyaları bu projenin parçasıdır; model MIT olduğundan ticari kullanım serbesttir (MIT bildirimi yukarıdadır).

## Üretim

\`\`\`
python3.12 -m venv ~/odi-tts && ~/odi-tts/bin/pip install "coqui-tts[codec]" --extra-index-url https://download.pytorch.org/whl/cpu
# modeller (bir kez): yukarıdaki iki zip'i indirip bir klasöre açın
ODI_TTS_PY=~/odi-tts/bin/python ODI_TTS_MODELS=~/odi-tts/models node tools/voice/generate.mjs
\`\`\`

Üslup: hız modelin kendi ayarıyla (length_scale ${STYLES[STYLE].ls}; doğal prozodi, sonradan yavaşlatma yok), perde ${STYLES[STYLE].semitones} yarım ton
(biçimleyiciler korunur; hiçbir zaman yukarı değil), 80 Hz yüksek geçiren (boğukluk yok), hafif sıcaklık, ~3 kHz'te hafif netlik, cümle arası
duraklamalar ≤ ${Math.round(STYLES[STYLE].pause * 1000)} ms, vibrato/tremolo yok, ${STYLES[STYLE].echo ? 'çok hafif yankı' : 'yankı yok'}, −16 LUFS, sessizlik kırpma.
Adaylar: ${Object.keys(STYLES).join(', ')} (seçilen: **${STYLE}**).

## Satırlar (${NARRATOR_LINES.length})

| id | metin | bağlam | duygu |
|---|---|---|---|
${NARRATOR_LINES.map((l) => `| \`${l.id}\` | ${l.text}${l.spoken ? `<br><small>okunuş: ${l.spoken}</small>` : ''} | ${l.context} | ${l.emotion} |`).join('\n')}
`;
  writeFileSync(join(root, 'docs/anlatici-metinleri.md'), md);
  console.log(`✓ docs/anlatici-metinleri.md + .csv (${NARRATOR_LINES.length} satır)`);
}

// ---------------------------------------------------------------- denetim: her satırın güncel kaydı var mı
function check() {
  const man = existsSync(join(OUT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : { lines: {} };
  const missing = NARRATOR_LINES.filter((l) => { const e = man.lines?.[l.id]; return !e || e.hash !== textHash(l.text) || !existsSync(join(OUT, e.file)); });
  if (missing.length) { console.log(`✗ kaydı olmayan / eski satırlar (${missing.length}): ${missing.map((l) => l.id).join(', ')}`); return 1; }
  console.log(`✓ ${NARRATOR_LINES.length} satırın hepsinin güncel kaydı var`); return 0;
}

// ---------------------------------------------------------------- üretim
function instructions() {
  console.log(`Tüy Dede seslerini üretmek için Coqui TTS ve Türkçe model gerekir (yalnız bir kez, geliştirici makinesinde):

  python3.12 -m venv ~/odi-tts
  ~/odi-tts/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
  ~/odi-tts/bin/pip install "coqui-tts[codec]"
  mkdir -p ~/odi-tts/models && cd ~/odi-tts/models
  for m in tts_models--tr--common-voice--glow-tts vocoder_models--tr--common-voice--hifigan; do
    curl -LO https://github.com/coqui-ai/TTS/releases/download/v0.6.1_models/$m.zip && unzip -o $m.zip
  done

  ODI_TTS_PY=~/odi-tts/bin/python ODI_TTS_MODELS=~/odi-tts/models node tools/voice/generate.mjs

Not: ffmpeg (libmp3lame + rubberband) da gerekir.`);
}

function modelDir(models, name) {
  // zip'ler bazen iç içe aynı adla açılır
  const a = join(models, name); const b = join(a, name);
  return existsSync(join(b, 'model_file.pth')) ? b : a;
}

function render(lines, style, outDir) {
  const py = process.env.ODI_TTS_PY; const models = process.env.ODI_TTS_MODELS;
  if (!py || !models || !existsSync(py) || !existsSync(models)) { instructions(); process.exit(has('--require') ? 1 : 0); }
  const cache = process.env.ODI_TTS_CACHE ?? join(tmpdir(), 'odi-voice-cache');
  mkdirSync(cache, { recursive: true });
  // model klasör adları (iç içe açılmış olabilir) → render.py'nin beklediği düz klasör: bağlantıyla eşitle
  const flat = join(cache, 'models'); mkdirSync(flat, { recursive: true });
  for (const n of ['tts_models--tr--common-voice--glow-tts', 'vocoder_models--tr--common-voice--hifigan']) {
    const link = join(flat, n); if (!existsSync(link)) execFileSync('ln', ['-s', modelDir(models, n), link]);
  }
  const ls = STYLES[style].ls;
  const job = lines.map((l) => { const spoken = spokenOf(l); return { id: l.id, spoken, hash: textHash(spoken), ls }; });
  const jobFile = join(cache, 'job.json'); writeFileSync(jobFile, JSON.stringify(job));
  console.log(`▶ Coqui TTS: ${job.length} satır (önbellek: ${cache})`);
  const r = spawnSync(py, [join(root, 'tools/voice/render.py'), jobFile, flat, join(cache, 'wav')], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ham ses üretimi başarısız');
  const out = [];
  for (const j of job) {
    const wav = join(cache, 'wav', `${j.id}.${j.hash}.ls${j.ls}.wav`); // render.py ile aynı ad
    const mp3 = join(outDir, `${j.id}.mp3`);
    post(wav, mp3, style);
    out.push({ id: j.id, file: `${j.id}.mp3`, ms: durMs(mp3), bytes: statSync(mp3).size });
  }
  return out;
}

function writeManifest(rendered) {
  const lines = {};
  const byId = new Map(rendered.map((r) => [r.id, r]));
  for (const l of NARRATOR_LINES) {
    const r = byId.get(l.id); if (!r) continue;
    lines[l.id] = { file: r.file, hash: textHash(l.text), ms: r.ms };
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ version: 1, format: 'mp3', voice: 'Coqui TTS · Fatih Akademi tr common-voice glow-tts + hifigan (MIT)', style: STYLE, lines }, null, 1) + '\n');
  // mobil: dosyalar Metro varlığı olarak uygulama paketine girer (statik require şart)
  const map = Object.values(lines).map((e) => `  '${e.file}': require('../../../web/public/voice/${e.file}'),`).join('\n');
  writeFileSync(MOBILE_MAP, `// OTOMATİK ÜRETİLDİ: tools/voice/generate.mjs — elle düzenlemeyin.
// Tüy Dede'nin kayıtlı sesleri uygulama paketine gömülür (Metro varlığı); web tarafı aynı dosyaları apps/web/public/voice/ altından çalar.
/* eslint-disable @typescript-eslint/no-require-imports */
export const VOICE_FILES: Record<string, number> = {
${map}
};
`);
  // artık kullanılmayan dosyaları kaldır
  const keep = new Set([...Object.values(lines).map((e) => e.file), 'manifest.json']);
  for (const f of readdirSync(OUT)) if (!keep.has(f)) rmSync(join(OUT, f));
  const total = rendered.reduce((a, r) => a + r.bytes, 0);
  console.log(`✓ ${Object.keys(lines).length} satır · toplam ${(total / 1024).toFixed(0)} KB · apps/web/public/voice/ + manifest.json + apps/mobile/src/voice/files.ts`);
}

if (has('--export')) exportScript();
else if (has('--check')) process.exit(check());
else if (has('--candidates')) {
  const ids = (val('--candidates') ?? 'hikaye-01').split(',');
  const lines = NARRATOR_LINES.filter((l) => ids.includes(l.id));
  const dir = val('--out') ?? join(tmpdir(), 'odi-voice-adaylar'); mkdirSync(dir, { recursive: true });
  for (const style of Object.keys(STYLES)) {
    const r = render(lines, style, join(dir, style));
    console.log(`  ${style}: ${r.map((x) => `${x.id} ${x.ms} ms`).join(', ')}`);
  }
  console.log(`adaylar: ${dir}`);
} else {
  exportScript();
  const man = existsSync(join(OUT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : { lines: {} };
  const fresh = (l) => { const e = man.lines?.[l.id]; return !has('--all') && man.style === STYLE && e && e.hash === textHash(l.text) && existsSync(join(OUT, e.file)); };
  const todo = NARRATOR_LINES.filter((l) => !fresh(l));
  const kept = NARRATOR_LINES.filter(fresh).map((l) => { const f = join(OUT, man.lines[l.id].file); return { id: l.id, file: man.lines[l.id].file, ms: man.lines[l.id].ms ?? durMs(f), bytes: statSync(f).size }; });
  const made = todo.length ? render(todo, STYLE, OUT) : [];
  writeManifest([...kept, ...made]);
}
