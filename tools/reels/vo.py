#!/usr/bin/env python3
"""ODİ Reels anlatıcı sesi (VO): bir kez üretilir, depoya işlenir (çalışma anında API yok).

Model: Chatterbox Multilingual (Resemble AI, MIT lisansı, Türkçe 'tr'), pip paketi `chatterbox-tts` 0.1.7, Hugging Face
`ResembleAI/chatterbox` (t3_mtl23ls_v2). Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır (lisansa uygun).
Ses kaynağı (gerçek kişi klonu YOK): tools/reels/vo/ref-tr-erkek.wav — tamamen sentetik. Kokoro-82M (Apache-2.0) "am_michael"
İngilizce sentetik sesi → Chatterbox ile Türkçe bir cümle (cfg_weight 0: aksan taşınmasın) → en iyi çekim Türkçe referans oldu.
Denetim: Whisper large-v3-turbo (MIT) her çekimi yazıya döker; en iyi çekim = en düşük hata, kısa iç duraksama, akıcı hız.
Sonra sessizlik kırpılır, hız gerekirse ffmpeg atempo ile hedefe (≈5,6 hece/sn) çekilir (en çok ×1,22), kenarlar yumuşatılır.

Kurulum (depo DIŞINDA bir venv; CPU yeterli):
  python3.11 -m venv ~/odi-vo && ~/odi-vo/bin/pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
  ~/odi-vo/bin/pip install chatterbox-tts==0.1.7
Kullanım (kökten; ağır iş: başka üretim varsa `nice -n 5`):
  HF_HOME=~/.cache/huggingface nice -n 5 ~/odi-vo/bin/python tools/reels/vo.py [--only kulak-yolculugu,tuy-dede] [--ids k1,k2] [--force]
Girdi: tools/reels/vo/metin.json (metinler + ses ayarları). Çıktı: tools/reels/vo/<reels>/<id>.mp3 (işlenmiş, yerleştirmeye hazır)
ve tools/reels/vo/secim.json (seçilen çekim, tohum, ölçümler). Çekimler önbellekte: tools/harness/out/reels/vo-uretim/.
Metni değişmeyen satır yeniden üretilmez (metin özeti secim.json'da).
"""
import hashlib, json, os, re, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VO = os.path.join(ROOT, 'tools', 'reels', 'vo')
CACHE = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels', 'vo-uretim')
a = sys.argv[1:]
arg = lambda k: a[a.index(k) + 1] if k in a else None
ONLY = set(arg('--only').split(',')) if arg('--only') else None
IDS = set(arg('--ids').split(',')) if arg('--ids') else None
FORCE = '--force' in a

meta = json.load(open(os.path.join(VO, 'metin.json'), encoding='utf-8'))
V = meta['voice']
sel_path = os.path.join(VO, 'secim.json')
sel = json.load(open(sel_path, encoding='utf-8')) if os.path.exists(sel_path) else {}


def norm(s):
    s = s.replace('I', 'ı').replace('İ', 'i').lower().replace("'", '').replace('’', '').replace('â', 'a').replace('î', 'i').replace('û', 'u')
    return re.sub(r"[^\wçğıöşü\s]", ' ', s).split()


def syl(s): return sum(1 for ch in s.lower() if ch in 'aeıioöuüâîû')


def wer(ref, hyp):
    import numpy as np
    r, h = norm(ref), norm(hyp); d = np.zeros((len(r) + 1, len(h) + 1), int); d[:, 0] = range(len(r) + 1); d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1): d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1, -1] / max(1, len(r))


def key(line): return hashlib.sha1(json.dumps([line['text'], V], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


todo = []
for slug, lines in meta['lines'].items():
    if ONLY and slug not in ONLY: continue
    for ln in lines:
        if IDS and ln['id'] not in IDS: continue
        out = os.path.join(VO, slug, f"{ln['id']}.mp3")
        if not FORCE and os.path.exists(out) and sel.get(slug, {}).get(ln['id'], {}).get('key') == key(ln): continue
        todo.append((slug, ln))
if not todo:
    print('VO: hepsi güncel'); sys.exit(0)

import numpy as np, torch, torchaudio as ta, librosa  # noqa: E402
from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402
from transformers import pipeline  # noqa: E402
torch.set_num_threads(int(os.environ.get('VO_THREADS', '3')))
tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu'); SR = tts.sr
asr = pipeline('automatic-speech-recognition', model='openai/whisper-large-v3-turbo', device='cpu')
REF = os.path.join(VO, V['ref'])


def analyse(path, ln):
    y, _ = librosa.load(path, sr=16000)
    yt, (s0, s1) = librosa.effects.trim(y, top_db=38)
    rms = librosa.feature.rms(y=yt, frame_length=400, hop_length=160)[0]; db = 20 * np.log10(rms + 1e-6); quiet = db < db.max() - 38
    longest = run = 0
    for q in quiet: run = run + 1 if q else 0; longest = max(longest, run)
    hyp = asr(yt, generate_kwargs={'language': 'turkish', 'task': 'transcribe'})['text'].strip()
    dur = len(yt) / 16000
    peak = float(np.abs(librosa.load(path, sr=None)[0]).max())
    return {'dur': round(dur, 2), 'sps': round(syl(ln['text']) / max(dur, .1), 2), 'gap': round(longest * 0.01, 2),
            'wer': round(wer(ln.get('asr', ln['text']), hyp), 2), 'asr': hyp, 'peak': round(peak, 2), 'trim': [s0 / 16000, s1 / 16000]}


def score(m): return m['wer'] * 10 + max(0, m['gap'] - 0.35) * 3 + max(0, V['target_sps'] - 0.4 - m['sps']) * 0.8 + (2 if m['peak'] > 0.98 else 0)


for slug, ln in todo:
    k = key(ln); cdir = os.path.join(CACHE, slug); os.makedirs(cdir, exist_ok=True); cands = []
    for sd in V['seeds']:
        wav = os.path.join(cdir, f"{ln['id']}-{k}-s{sd}.wav"); mj = wav[:-4] + '.json'
        if os.path.exists(mj): m = json.load(open(mj))
        else:
            t0 = time.time(); torch.manual_seed(sd)
            w = tts.generate(ln['text'], language_id=V['lang'], audio_prompt_path=REF, exaggeration=V['exaggeration'], cfg_weight=V['cfg_weight'], temperature=V['temperature'])
            ta.save(wav, w, SR); m = analyse(wav, ln); m['seed'] = sd; m['sec'] = round(time.time() - t0)
            json.dump(m, open(mj, 'w'), ensure_ascii=False)
        m['file'] = wav; m['score'] = round(score(m), 2); cands.append(m)
        print(json.dumps({'slug': slug, 'id': ln['id'], **{x: m[x] for x in ('seed', 'dur', 'sps', 'gap', 'wer', 'score', 'asr')}}, ensure_ascii=False), flush=True)
        if m['wer'] == 0 and m['gap'] <= 0.35 and m['sps'] >= V['target_sps'] - 1.0: break  # atempo (≤ ×1,22) farkı kapatır
    b = min(cands, key=lambda m: m['score'])
    # işle: kırp, gerekirse hızlandır, kenarları yumuşat → mp3
    s0, s1 = b['trim']; dur = (s1 + 0.08) - max(0, s0 - 0.03)
    tempo = min(V['max_tempo'], max(1.0, V['target_sps'] / (syl(ln['text']) / dur)))
    out = os.path.join(VO, slug, f"{ln['id']}.mp3"); os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{max(0, s0 - 0.03):.3f}', '-to', f'{s1 + 0.08:.3f}', '-i', b['file'],
                    '-af', f'atempo={tempo:.3f},afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse,aresample=48000',
                    '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', out], check=True)
    final = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
    sel.setdefault(slug, {})[ln['id']] = {'key': k, 'text': ln['text'], 'seed': b['seed'], 'wer': b['wer'], 'asr': b['asr'], 'gap': b['gap'],
                                          'tempo': round(tempo, 3), 'dur': round(final, 2), 'sps': round(syl(ln['text']) / final, 2)}
    json.dump(sel, open(sel_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"✅ {slug}/{ln['id']}: tohum {b['seed']}, {final:.2f} sn, ×{tempo:.2f}, hata {b['wer']}", flush=True)
