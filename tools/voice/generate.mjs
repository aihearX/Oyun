#!/usr/bin/env node
// Tüy Dede'nin sesleri: bütün satırları BİR KEZ üretir, uygulamaya gömülecek küçük MP3'lere çevirir.
// Uygulama bu betiği hiç çalıştırmaz; yalnız apps/web/public/voice/ altındaki hazır dosyaları çalar.
//
//   node tools/voice/generate.mjs --export          # docs/anlatici-metinleri.md + .csv (seslendiren / TTS için metin listesi)
//   node tools/voice/generate.mjs                   # eksik/değişen satırları üret (Chatterbox + Whisper seçimi + ffmpeg), manifest ve mobil eşlemeyi yaz
//   node tools/voice/generate.mjs --all             # hepsini yeniden üret
//   node tools/voice/generate.mjs --priority a,b,c  # önce bu satırlar (örnek dinletmek için)
//   node tools/voice/generate.mjs --samples a,b --out klasör   # önbellekteki hazır satırları manifest'e dokunmadan MP3'e çevir
//   node tools/voice/generate.mjs --engine coqui    # eski yedek motor (Coqui TTS, "dede" üslupları; --candidates ile karşılaştırma)
//   node tools/voice/generate.mjs --check           # her satırın güncel bir kaydı var mı (CI / test)
//
// Gerekenler (yalnız üretim için; hiçbiri depoya/uygulamaya girmez): ffmpeg (libmp3lame), ayrı bir Python venv.
// Chatterbox (varsayılan): `pip install chatterbox-tts==0.1.7 transformers librosa` (CPU torch yeter); modeller Hugging Face'ten
// (ResembleAI/chatterbox, openai/whisper-large-v3-turbo) ilk çalıştırmada iner. Ortam değişkenleri:
//   ODI_CB_PY       Chatterbox kurulu python        ODI_CB_CACHE  deneme/seçim önbelleği (sürdürülebilir; varsayılan geçici klasör)
//   ODI_CB_THREADS  CPU iş parçacığı (3)            ODI_CB_NICE   öncelik (10; CPU başka işlerle paylaşılırken)
//   HF_HOME         Hugging Face önbelleği (isteğe bağlı)
// Coqui (yedek): ODI_TTS_PY, ODI_TTS_MODELS (tts_models--tr--common-voice--glow-tts/ + vocoder_models--tr--common-voice--hifigan/), ODI_TTS_CACHE
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { NARRATOR_LINES: SCRIPT_LINES, VOICE_DIRECTION, textHash } = await import(join(root, 'apps/web/src/ftue/script.ts'));
const { EAR_NOTES } = await import(join(root, 'packages/content/src/odyoloji.ts'));
const { PATOLOJILER, PATOLOJI_IDS } = await import(join(root, 'packages/content/src/patolojiler.ts'));
/** seslendirilen her şey: anlatıcı satırları + Tüy Dede'nin Notu'nun sade cümleleri (teknik satırlar yalnız yazılı) +
 *  bölge patolojilerinin ilk karşılaşma cümleleri (`pat-<kimlik>`; kabuk `pathology` olayında çalar: apps/web/src/ftue/pathology.ts) */
const NARRATOR_LINES = [
  ...SCRIPT_LINES,
  ...EAR_NOTES.map((n) => ({ id: `not-${n.id}`, text: n.plain, spoken: n.spoken, context: `Tüy Dede'nin Notu · ${n.region}`, emotion: 'bilge, sıcak, merak uyandıran (wise, warm)' })),
  ...PATOLOJI_IDS.map((k) => { const P = PATOLOJILER[k]; return { id: `pat-${k}`, text: P.sade, context: `Bölümde ilk karşılaşma: ${P.ad} (${P.terim})${P.ilkBolum ? ` · ${P.ilkBolum}. bölüm` : ' · henüz bölümlerde yok'}`, emotion: 'bilge, sakin, yol gösteren (wise, calm, guiding)' }; }),
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
/** motor: Chatterbox (sahibinin onayladığı akıcı erkek anlatıcı) ya da yedek Coqui */
const ENGINE = val('--engine') ?? 'chatterbox';
/** Coqui üslubu: iki aday ölçüldü (konuşma hızı, f0); sahibi "dede-dogal"ı seçmişti. Chatterbox'ta üslup yok: temiz anlatım */
const STYLE = ENGINE === 'coqui' ? (val('--style') ?? 'dede-dogal') : 'chatterbox-erkek';
const BITRATE = ENGINE === 'coqui' ? '48k' : '56k';

/**
 * Chatterbox ayarları (reels ekibinin onaylı erkek anlatıcısıyla aynı): exaggeration 0.8, cfg_weight 0.3, temperature 0.8,
 * sabit tohumlar; satır başına en çok 3 deneme, Whisper ile seçim (WER → duraksama → hız). "Dede" efekti YOK: perde, titreme,
 * yankı yok; yalnız kırpma, uzun duraksamayı kısaltma, gerekirse en çok ×1,2 hızlandırma (yavaşsa), 60 Hz altı temizlik, −16 LUFS.
 */
const CB = { exaggeration: 0.8, cfg_weight: 0.3, temperature: 0.8, seeds: [1, 2, 3], min_sps: 4.8, accept_gap: 0.8, accept_sps: 4.3, target_sps: 5.2, max_tempo: 1.2, pause: 0.4 };
const CB_REF = join(root, 'tools/voice/ref-tr-erkek.flac');
/**
 * Chatterbox'ın yanlış okuduğu terimler için okunuş (Whisper ile denendi; her tohumda doğru duyuldu). Yalnız sese verilen metni
 * değiştirir; ekrandaki yazı ve parmak izi aynı kalır. "jeton" için genel bir yazım yok (j → c/y duyulabiliyor); satır bazında
 * `spoken` ile önünde virgüllü duraklama ve "jöton'un" yazımı tam satırda "jetonun" duyuldu (kamp-sira-01).
 */
const CB_PRON = [
  [/(?<!\p{L})Koklear(?!\p{L})/gu, 'Kokle-ar'], [/(?<!\p{L})koklear(?!\p{L})/gu, 'kokle-ar'],
  [/(?<!\p{L})Östaki(?!\p{L})/gu, 'Östâki'],
];
/** Chatterbox'a verilen metin: okunuş alanı varsa o (ör. "0 dB" → "sıfır desibel"), büyük/küçük harf ve noktalama korunur */
export function cbText(line) {
  let s = (line.spoken ?? line.text).replace(/[’‘`]/g, "'").replace(/[“”"«»]/g, '').replace(/…/g, '.').replace(/\s+/g, ' ').trim();
  for (const [re, to] of CB_PRON) s = s.replace(re, to);
  if (/\d/.test(s)) throw new Error(`${line.id}: rakamı yazıyla "spoken" alanına yazın (${s})`);
  return s;
}

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

const COQUI_DOC = () => { const cs = STYLES[STYLE] ? STYLE : 'dede-dogal'; return `- Üretim: **Coqui TTS** (MPL-2.0 kitaplık; yalnız geliştirici makinesinde çalışır, uygulamaya girmez).
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

Üslup: hız modelin kendi ayarıyla (length_scale ${STYLES[cs].ls}; doğal prozodi, sonradan yavaşlatma yok), perde ${STYLES[cs].semitones} yarım ton
(biçimleyiciler korunur; hiçbir zaman yukarı değil), 80 Hz yüksek geçiren (boğukluk yok), hafif sıcaklık, ~3 kHz'te hafif netlik, cümle arası
duraklamalar ≤ ${Math.round(STYLES[cs].pause * 1000)} ms, vibrato/tremolo yok, ${STYLES[cs].echo ? 'çok hafif yankı' : 'yankı yok'}, −16 LUFS, sessizlik kırpma.
Adaylar: ${Object.keys(STYLES).join(', ')} (seçilen: **${cs}**).`; };
const CB_DOC = `- Ses: **Chatterbox Multilingual** (Resemble AI, **MIT** lisansı; \`chatterbox-tts\` 0.1.7, \`language_id='tr'\`).
  Model: https://huggingface.co/ResembleAI/chatterbox
- Erkek anlatıcı tınısı: \`tools/voice/ref-tr-erkek.flac\` — sentetik bir temel ses (**Kokoro-82M**, hexgrad, **Apache-2.0**)
  Chatterbox ile Türkçeye taşındı; gerçek bir kişinin sesi değildir (reels ekibiyle aynı onaylı ses).
- Seçim: satır başına en çok 3 deneme (sabit tohumlar 1-3); **Whisper large-v3-turbo** (OpenAI, MIT) dökümüyle en iyisi seçilir:
  önce anlaşılırlık (WER), sonra uzun duraksama, sonra hız.
- Filigran: Chatterbox her çıktıya duyulmayan **Perth** filigranı ekler (Resemble AI; sentetik sesin izlenebilirliği için).
- Uygulamada anma: Ayarlar › "Anlatıcı sesi: Chatterbox Multilingual (Resemble AI, MIT) · temel tını Kokoro-82M (Apache-2.0)".
- Üretilen ses dosyaları bu projenin parçasıdır; MIT ve Apache-2.0 ticari kullanıma izin verir (bildirimler yukarıda).

## Üretim

\`\`\`
python3.11 -m venv ~/odi-cb
~/odi-cb/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
~/odi-cb/bin/pip install chatterbox-tts==0.1.7 transformers librosa
ODI_CB_PY=~/odi-cb/bin/python ODI_CB_CACHE=~/odi-cb/cache node tools/voice/generate.mjs   # yarıda kalırsa aynı komut sürdürür
\`\`\`

Ayarlar: exaggeration ${CB.exaggeration}, cfg_weight ${CB.cfg_weight}, temperature ${CB.temperature}. "Dede" efekti yok (perde, titreme, yankı
yok); yalnız sessizlik kırpma, uzun duraksamaları ≤ ${Math.round(CB.pause * 1000)} ms'ye kısaltma, ${CB.target_sps} hece/sn altındaysa en çok
×${CB.max_tempo} hızlandırma, 60 Hz altı temizlik, −16 LUFS, mono ${BITRATE} MP3. Yedek motor: \`--engine coqui\` (Coqui TTS, Fatih Akademi, MIT).`;

// ---------------------------------------------------------------- metin dışa aktarımı (seslendiren / TTS hizmeti için)
function exportScript() {
  const csv = ['id,text,spoken,context,emotion,file', ...NARRATOR_LINES.map((l) => [l.id, l.text, spokenOf(l), l.context, l.emotion, `${l.id}.mp3`].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
  writeFileSync(join(root, 'docs/anlatici-metinleri.csv'), '﻿' + csv + '\n');
  const md = `# Tüy Dede — anlatıcı metinleri

> Bu dosya \`node tools/voice/generate.mjs --export\` ile üretilir; kaynak: \`apps/web/src/ftue/script.ts\`. Elle düzenlemeyin.
> Aynı liste CSV olarak: \`docs/anlatici-metinleri.csv\` (id, metin, okunuş, bağlam, duygu, dosya adı).

## Seslendirme yönergesi

${VOICE_DIRECTION}

Dosyalar \`apps/web/public/voice/<id>.mp3\` adıyla konur (mono, ~${BITRATE}bps MP3, −16 LUFS). Uygulama bir satırı yalnızca
kayıt metni ekrandaki altyazıyla aynıysa çalar (manifest'teki parmak izi); kaydı olmayan satırda cihazın sesi (TTS) devreye girer.

## Ses lisansı ve emeği geçenler

${ENGINE === 'coqui' ? COQUI_DOC() : CB_DOC}

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

function renderCoqui(lines, style, outDir) {
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

// ---------------------------------------------------------------- Chatterbox (varsayılan motor)
const cbCache = () => process.env.ODI_CB_CACHE ?? join(tmpdir(), 'odi-voice-cb');
/** Whisper'ın birebir duyması gereken sözcük kökleri: seçimde bu köklerle başlayan sözcüklere harf farkı payı tanınmaz
 *  ("yetonun"/"cetonun" doğru sayılmaz, yeni deneme yapılır). Yalnız seçimi etkiler; önbellek anahtarı değişmez. */
const CB_STRICT = ['jeton'];
function cbJob(lines) {
  return lines.map((l) => { const text = cbText(l); const strict = CB_STRICT.filter((k) => new RegExp(k, 'i').test(l.text)); return { id: l.id, hash: textHash(text), text, refs: [...new Set([text, l.text])], ...(strict.length ? { strict } : {}) }; });
}
/** seçilmiş ham kayıt → MP3: kırp, uzun duraksamayı kısalt, yavaşsa en çok ×1,2 hızlandır, 60 Hz altı temizle, −16 LUFS */
function postCb(wav, metrics, mp3) {
  mkdirSync(dirname(mp3), { recursive: true });
  const tempo = metrics.sps > 0 && metrics.sps < CB.target_sps ? Math.min(CB.max_tempo, CB.target_sps / metrics.sps) : 1;
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03';
  const chain = [
    trim, 'areverse', trim, 'areverse',
    `silenceremove=stop_periods=-1:stop_duration=${CB.pause}:stop_threshold=-42dB:stop_silence=${CB.pause}`,
    'highpass=f=60:poles=2', ...(tempo > 1.005 ? [`atempo=${tempo.toFixed(3)}`] : []),
    'afade=t=in:d=0.01', 'areverse', 'afade=t=in:d=0.04', 'areverse', 'adelay=40', 'apad=pad_dur=0.1',
  ].join(',');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `${chain},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', `${chain},${ln},alimiter=limit=0.85:attack=2:release=40:level=false`, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', BITRATE, mp3]);
  return tempo;
}
function cbInstructions() {
  console.log(`Tüy Dede seslerini üretmek için Chatterbox Multilingual gerekir (yalnız geliştirici makinesinde, depo dışında bir venv):

  python3.11 -m venv ~/odi-cb
  ~/odi-cb/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
  ~/odi-cb/bin/pip install chatterbox-tts==0.1.7 transformers librosa

  ODI_CB_PY=~/odi-cb/bin/python ODI_CB_CACHE=~/odi-cb/cache node tools/voice/generate.mjs

Modeller (ResembleAI/chatterbox, openai/whisper-large-v3-turbo) ilk çalıştırmada Hugging Face'ten iner. CPU'da deneme başına ~40-60 sn;
yarıda kalırsa aynı komut kaldığı yerden sürer (ODI_CB_CACHE). ffmpeg (libmp3lame) de gerekir.`);
}
/** sonuçları önbellekten oku; eksik satır varsa null */
function cbResults(job) {
  const cache = cbCache();
  return job.map((j) => { const js = join(cache, `${j.id}.${j.hash}.json`); return existsSync(js) ? { ...j, wav: join(cache, `${j.id}.${j.hash}.wav`), m: JSON.parse(readFileSync(js, 'utf8')) } : null; });
}
function renderChatterbox(lines, outDir) {
  const job = cbJob(lines); const cache = cbCache(); mkdirSync(cache, { recursive: true });
  const py = process.env.ODI_CB_PY;
  const missing = cbResults(job).some((r) => !r);
  // venv varsa her zaman çalışır: eksikleri üretir, bitmiş satırların denemelerini güncel kurallarla yeniden seçer (model yüklemeden)
  if (missing || (py && existsSync(py))) {
    if (!py || !existsSync(py)) { cbInstructions(); process.exit(has('--require') ? 1 : 0); }
    const jobFile = join(cache, 'job.json');
    writeFileSync(jobFile, JSON.stringify({ ref: CB_REF, settings: { ...CB, threads: Number(process.env.ODI_CB_THREADS ?? 3) }, lines: job }));
    console.log(`▶ Chatterbox: ${job.length} satır (önbellek: ${cache}; ilerleme: ${join(cache, 'progress.jsonl')})`);
    const r = spawnSync('nice', ['-n', String(process.env.ODI_CB_NICE ?? 10), py, join(root, 'tools/voice/cb_render.py'), jobFile, cache], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('Chatterbox üretimi yarıda kaldı (aynı komutla sürdürün)');
  }
  const res = cbResults(job);
  if (res.some((r) => !r)) throw new Error(`eksik satır: ${job.filter((_, i) => !res[i]).map((j) => j.id).join(', ')}`);
  return res.map((r) => {
    const mp3 = join(outDir, `${r.id}.mp3`); const tempo = postCb(r.wav, r.m, mp3);
    return { id: r.id, file: `${r.id}.mp3`, ms: durMs(mp3), bytes: statSync(mp3).size, wer: r.m.wer, tempo: Math.round(tempo * 100) / 100, seed: r.m.seed };
  });
}
const render = (lines, style, outDir) => (ENGINE === 'coqui' ? renderCoqui(lines, style, outDir) : renderChatterbox(lines, outDir));
const VOICE_CREDIT = ENGINE === 'coqui'
  ? 'Coqui TTS · Fatih Akademi tr common-voice glow-tts + hifigan (MIT)'
  : 'Chatterbox Multilingual (Resemble AI, MIT) · erkek anlatıcı, temel tını Kokoro-82M (Apache-2.0) · Perth filigranı';

function writeManifest(rendered) {
  const lines = {};
  const byId = new Map(rendered.map((r) => [r.id, r]));
  for (const l of NARRATOR_LINES) {
    const r = byId.get(l.id); if (!r) continue;
    // hash: ekrandaki metin (uygulama bununla eşler); src: sese verilen metin (okunuş değişince yeniden üretilsin)
    lines[l.id] = { file: r.file, hash: textHash(l.text), ...(ENGINE === 'coqui' ? {} : { src: textHash(cbText(l)) }), ms: r.ms };
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ version: 1, format: 'mp3', voice: VOICE_CREDIT, engine: ENGINE, style: STYLE, lines }, null, 1) + '\n');
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
else if (has('--samples')) {
  // önbellekte hazır olan satırları (Chatterbox) manifest'e dokunmadan MP3'e çevir: erken örnek dinletmek için
  const ids = (val('--samples') ?? '').split(',');
  const dir = val('--out') ?? join(tmpdir(), 'odi-voice-ornek'); mkdirSync(dir, { recursive: true });
  const lines = NARRATOR_LINES.filter((l) => ids.includes(l.id)); const res = cbResults(cbJob(lines));
  lines.forEach((l, i) => { const r = res[i]; if (!r) { console.log(`  ${l.id}: henüz hazır değil`); return; } const t = postCb(r.wav, r.m, join(dir, `${l.id}.mp3`)); console.log(`  ${l.id}: tohum ${r.m.seed}, WER ${r.m.wer}, ${r.m.sps} hece/sn, ×${t.toFixed(2)}`); });
  console.log(`örnekler: ${dir}`);
} else if (has('--candidates')) {
  if (ENGINE !== 'coqui') { console.log('--candidates yalnız --engine coqui ile (üslup karşılaştırması)'); process.exit(1); }
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
  const fresh = (l) => { const e = man.lines?.[l.id]; return !has('--all') && man.style === STYLE && e && e.hash === textHash(l.text) && (ENGINE === 'coqui' || e.src === textHash(cbText(l))) && existsSync(join(OUT, e.file)); };
  const pri = (val('--priority') ?? '').split(',').filter(Boolean);
  const todo = NARRATOR_LINES.filter((l) => !fresh(l)).sort((a, b) => (pri.includes(a.id) ? pri.indexOf(a.id) : 1e9) - (pri.includes(b.id) ? pri.indexOf(b.id) : 1e9));
  const kept = NARRATOR_LINES.filter(fresh).map((l) => { const f = join(OUT, man.lines[l.id].file); return { id: l.id, file: man.lines[l.id].file, ms: man.lines[l.id].ms ?? durMs(f), bytes: statSync(f).size }; });
  const made = todo.length ? render(todo, STYLE, OUT) : [];
  writeManifest([...kept, ...made]);
}
