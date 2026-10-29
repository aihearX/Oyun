#!/usr/bin/env python3
"""«Cumhuriyet herkese bir ses verdi» (29 Ekim, 103. yıl) — anlatıcı satırlarını üretir ve seçer.

Ses: tools/reels/vo.py ile AYNI onaylı anlatıcı (Chatterbox Multilingual, Türkçe, sentetik referans tools/reels/vo/ref-tr-erkek.wav;
gerçek kişi klonu yok). Bu reels için ağır, tok, duygulu okuma: satır başına birkaç tohum üretilir, Whisper large-v3-turbo her
çekimi yazıya döker; yalnız WER 0 çekimler aday olur, aralarından en sakin hızlı + iç duraksaması düzgün + perde aralığı geniş
(duygulu) olan seçilir. Hızlandırma yok (anlatı ağır kalsın); yalnız sessizlik kırpılır, kenarlar yumuşatılır.
Ortak tools/reels/vo/metin.json ve secim.json'a dokunmaz (aynı anda çalışan diğer reels'lerle çakışmasın diye kendi dosyaları var):
  girdi  tools/reels/vo/29-ekim-herkese-bir-ses/metin.json
  çıktı  tools/reels/vo/29-ekim-herkese-bir-ses/<id>.wav (48 kHz mono, işlenmiş) + secim.json
Kullanım (RAM için kilitli; aynı anda tek model):
  HF_HOME=/home/user/ses-ortam/hf flock /home/user/ses-ortam/vo.lock /home/user/ses-ortam/venv/bin/python \
      tools/reels/29-ekim-herkese-bir-ses_vo.py [--ids a,b] [--force]
"""
import hashlib, json, os, re, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VO = os.path.join(ROOT, 'tools', 'reels', 'vo')
D = os.path.join(VO, '29-ekim-herkese-bir-ses')
CACHE = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels', 'vo-uretim', '29-ekim-herkese-bir-ses')
a = sys.argv[1:]
IDS = set(a[a.index('--ids') + 1].split(',')) if '--ids' in a else None
FORCE = '--force' in a

meta = json.load(open(os.path.join(D, 'metin.json'), encoding='utf-8'))
V = meta['voice']
sel_path = os.path.join(D, 'secim.json')
sel = json.load(open(sel_path, encoding='utf-8')) if os.path.exists(sel_path) else {}


def norm(s):
    s = s.replace('I', 'ı').replace('İ', 'i').lower().replace("'", '').replace('’', '').replace('â', 'a').replace('î', 'i').replace('û', 'u')
    return re.sub(r"[^\wçğıöşü\s]", ' ', s).split()


def syl(s): return sum(1 for ch in s.lower() if ch in 'aeıioöuüâîû')


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp); d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1): d[i][0] = i
    for j in range(len(h) + 1): d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1): d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1][-1] / max(1, len(r))


def voice(ln): return {**V, **ln.get('v', {})}
def key(ln): return hashlib.sha1(json.dumps([ln['text'], {k: v for k, v in voice(ln).items() if k not in ('seeds', 'enough')}, V['ref']], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


todo = [ln for ln in meta['lines'] if (not IDS or ln['id'] in IDS) and (FORCE or sel.get(ln['id'], {}).get('key') != key(ln)
                                                                         or not os.path.exists(os.path.join(D, ln['id'] + '.wav')))]
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
    f0, vf, _ = librosa.pyin(yt, fmin=60, fmax=300, sr=16000, frame_length=1024)
    f0 = f0[vf & ~np.isnan(f0)] if f0 is not None else np.array([])
    rng = float(12 * np.log2(np.percentile(f0, 90) / np.percentile(f0, 10))) if len(f0) > 10 else 0.0
    med = float(np.median(f0)) if len(f0) else 0.0
    dur = len(yt) / 16000
    peak = float(np.abs(librosa.load(path, sr=None)[0]).max())
    alts = ln['asr'] if isinstance(ln.get('asr'), list) else [ln.get('asr', ln['text'])]
    return {'dur': round(dur, 2), 'sps': round(syl(ln['text']) / max(dur, .1), 2), 'gap': round(longest * 0.01, 2),
            'wer': round(min(wer(x, hyp) for x in alts), 3), 'asr': hyp, 'peak': round(peak, 2), 'trim': [s0 / 16000, s1 / 16000],
            'f0_med': round(med, 1), 'f0_range_st': round(rng, 2)}


def score(m, Vl):
    # WER baskın; sonra hedef hıza yakınlık, uzun iç duraksama cezası, duygu (perde aralığı) ödülü, tok ses (düşük perde) ödülü
    return (m['wer'] * 20 + abs(m['sps'] - Vl['target_sps']) * 0.6 + max(0, m['gap'] - Vl['max_gap']) * 3
            - min(m['f0_range_st'], 9) * 0.08 + max(0, m['f0_med'] - 125) * 0.01 + (2 if m['peak'] > 0.98 else 0))


os.makedirs(CACHE, exist_ok=True)
for ln in todo:
    k = key(ln); Vl = voice(ln); cands = []
    for sd in Vl['seeds']:
        wav = os.path.join(CACHE, f"{ln['id']}-{k}-s{sd}.wav"); mj = wav[:-4] + '.json'
        if os.path.exists(mj): m = json.load(open(mj))
        else:
            t0 = time.time(); torch.manual_seed(sd)
            w = tts.generate(ln['text'], language_id=V['lang'], audio_prompt_path=REF, exaggeration=Vl['exaggeration'],
                             cfg_weight=Vl['cfg_weight'], temperature=Vl['temperature'])
            ta.save(wav, w, SR); m = analyse(wav, ln); m['seed'] = sd; m['sec'] = round(time.time() - t0)
            json.dump(m, open(mj, 'w'), ensure_ascii=False)
        m['file'] = wav; m['score'] = round(score(m, Vl), 3); cands.append(m)
        print(json.dumps({'id': ln['id'], **{x: m[x] for x in ('seed', 'dur', 'sps', 'gap', 'wer', 'f0_med', 'f0_range_st', 'score', 'asr')}},
                         ensure_ascii=False), flush=True)
        # yeterince iyi WER 0 aday birikince dur (CPU paylaşılıyor; tohum başına birkaç dakika)
        if sum(1 for q in cands if q['wer'] == 0 and q['gap'] <= Vl['max_gap']) >= Vl.get('enough', 2): break
    if 'pick' in ln: b = next(m for m in cands if m['seed'] == ln['pick'])  # elle dinlenip seçilen tohum
    else: b = min(cands, key=lambda m: m['score'])
    s0, s1 = b['trim']
    out = os.path.join(D, f"{ln['id']}.wav")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{max(0, s0 - 0.03):.3f}', '-to', f'{s1 + 0.12:.3f}', '-i', b['file'],
                    '-af', 'afade=t=in:d=0.02,areverse,afade=t=in:d=0.08,areverse,aresample=48000', '-ac', '1', '-c:a', 'pcm_s16le', out], check=True)
    final = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
    sel[ln['id']] = {'key': k, 'text': ln['text'], 'seed': b['seed'], 'wer': b['wer'], 'asr': b['asr'], 'gap': b['gap'], 'dur': round(final, 2),
                     'sps': round(syl(ln['text']) / final, 2), 'f0_med': b['f0_med'], 'f0_range_st': b['f0_range_st'],
                     'adaylar': [{x: m[x] for x in ('seed', 'wer', 'sps', 'gap', 'f0_range_st', 'score')} for m in cands]}
    json.dump(sel, open(sel_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"✅ {ln['id']}: tohum {b['seed']}, {final:.2f} sn, hata {b['wer']}", flush=True)
