"""Tüy Dede satırlarını Chatterbox Multilingual (MIT) ile üretir; her satır için en çok birkaç deneme, Whisper ile en iyisi seçilir.

Kullanım (tools/voice/generate.mjs çağırır):  python cb_render.py iş.json <önbellek klasörü>
iş.json: {"ref": "ref-tr-erkek.flac", "settings": {...}, "lines": [{"id", "hash", "text", "refs": ["karşılaştırma metni", ...]}]}

Sürdürülebilir: her deneme <önbellek>/<id>.<hash>.s<tohum>.wav + .json olarak kalır; seçilen <id>.<hash>.wav + .json.
Kapsayıcı yeniden başlarsa yarım kalan satır kaldığı denemeden sürer. İlerleme: <önbellek>/progress.jsonl.

Ses: Chatterbox Multilingual (Resemble AI, MIT; language_id='tr'), erkek anlatıcı tınısı tools/voice/ref-tr-erkek.flac
(Kokoro-82M, Apache-2.0, sentetik İngilizce temel ses → Chatterbox ile Türkçe referans). Çıktıda Chatterbox'ın Perth
filigranı (duyulmaz) bulunur. Model ve Python paketleri depoya girmez (geliştirici makinesinde, ayrı venv).
"""
import json
import os
import re
import sys
import time

import librosa
import numpy as np
import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from transformers import pipeline

job = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
S = job['settings']
torch.set_num_threads(int(S.get('threads', 3)))
SEEDS = S.get('seeds', [1, 2, 3])
TARGET_SPS = float(S.get('min_sps', 4.8))  # bunun altı "yavaş" sayılır (sonradan en çok ×1,2 hızlandırılır)
# kabul: sözcükler tam doğruysa ve duraksama/hız sonradan düzeltilebilir aralıktaysa yeni deneme yapılmaz (CPU'da deneme ~1-2 dk)
ACCEPT_GAP = float(S.get('accept_gap', 0.8))
ACCEPT_SPS = float(S.get('accept_sps', 4.3))
PROGRESS = os.path.join(out, 'progress.jsonl')


def log(rec):
    rec['t'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    with open(PROGRESS, 'a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')
    print(json.dumps(rec, ensure_ascii=False), flush=True)


SR = 24000  # Chatterbox çıkışı (tts.sr)
tts = asr = None


def norm(s):
    s = s.replace('I', 'ı').replace('İ', 'i').lower().replace("'", '').replace('’', '').replace('â', 'a').replace('î', 'i').replace('û', 'u')
    s = re.sub(r"[^\wçğıöşü\s]", ' ', s)
    return s.split()


def syl(s):
    return sum(1 for ch in s.lower() if ch in 'aeıioöuüâîû')


def lev(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
    return d[-1]


def same(a, b, strict=()):
    # terimler (koklea, odyogram, timpanogram...) dökümde farklı yazılabilir: 7+ harfli sözcükte ~%25'e kadar harf farkı eşleşme sayılır (kısa sözcük ve ekler birebir)
    # strict: bu köklerle başlayan sözcükler birebir duyulmalı (ör. "jeton": "yetonun"/"cetonun" yanlış okunuştur)
    if any(a.startswith(k) for k in strict):
        return a == b
    return a == b or (min(len(a), len(b)) >= 7 and lev(a, b) <= max(1, round(0.25 * max(len(a), len(b)))))


def wer(ref, hyp, strict=()):
    r, h = norm(ref), norm(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), int)
    d[:, 0] = range(len(r) + 1)
    d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (not same(r[i - 1], h[j - 1], strict)))
    return d[-1, -1] / max(1, len(r))


def analyse(y, text, refs, strict=()):
    y16 = librosa.resample(y, orig_sr=SR, target_sr=16000)
    yt, (a, b) = librosa.effects.trim(y16, top_db=38)
    dur = len(yt) / 16000
    rms = librosa.feature.rms(y=yt, frame_length=400, hop_length=160)[0]
    db = 20 * np.log10(rms + 1e-6)
    quiet = db < db.max() - 38
    longest = run = 0
    for q in quiet:
        run = run + 1 if q else 0
        longest = max(longest, run)
    hyp = asr(yt, generate_kwargs={'language': 'turkish', 'task': 'transcribe'})['text'].strip()
    f0, _, _ = librosa.pyin(yt, fmin=60, fmax=300, sr=16000)
    f0 = f0[~np.isnan(f0)]
    return {
        'dur': round(dur, 2), 'sps': round(syl(text) / max(dur, .1), 2), 'gap': round(longest * 0.01, 2),
        'wer': round(min(wer(r, hyp, strict) for r in refs), 3), 'asr': hyp,
        'f0': round(float(np.median(f0))) if len(f0) else 0, 'peak': round(float(np.abs(y).max()), 3),
        # tail: metin bitti ama ses sürüyor mu (Chatterbox ara sıra sonda mırıldanır) → ASR fazladan sözcük
        'extra': max(0, len(norm(hyp)) - len(norm(text))),
    }


def score(m):
    # sıra: önce anlaşılırlık (WER ve fazladan sözcük, baskın), sonra uzun duraksama, sonra hız; patlama cezası.
    # (duraksama sonradan ≤0,4 sn'ye kısaltılır, hız ≤×1,2 düzeltilir: yanlış sözcüğü asla geçemezler)
    return m['wer'] * 100 + m['extra'] * 15 + max(0, m['gap'] - 0.4) * 3 + max(0, TARGET_SPS - m['sps']) * 0.6 + (2 if m['peak'] > 0.99 else 0)


def takes_of(ln):
    base = os.path.join(out, f"{ln['id']}.{ln['hash']}")
    refs = ln.get('refs') or [ln['text']]
    strict = tuple(ln.get('strict') or ())
    got = []
    for sd in SEEDS:
        wav_p, js_p = f'{base}.s{sd}.wav', f'{base}.s{sd}.json'
        if os.path.exists(js_p) and os.path.exists(wav_p):
            m = json.load(open(js_p, encoding='utf-8'))
            m['wer'] = round(min(wer(r, m['asr'], strict) for r in refs), 3)
            m['score'] = round(score(m), 3)
            m['file'] = wav_p
            got.append(m)
    return got


def choose(ln, cands, n=None, of=None):
    base = os.path.join(out, f"{ln['id']}.{ln['hash']}")
    best = min(cands, key=lambda m: m['score'])
    y, _ = librosa.load(best['file'], sr=SR)
    ta.save(f'{base}.wav', torch.tensor(y).unsqueeze(0), SR)
    json.dump({**best, 'takes': len(cands)}, open(f'{base}.json', 'w', encoding='utf-8'), ensure_ascii=False)
    return best


# ---- yeniden seçim: biten satırların denemeleri güncel kurallarla yeniden puanlanır (model gerekmez)
for ln in job['lines']:
    bj = os.path.join(out, f"{ln['id']}.{ln['hash']}.json")
    if not os.path.exists(bj):
        continue
    cands = takes_of(ln)
    if not cands:
        continue
    old = json.load(open(bj, encoding='utf-8'))
    new = min(cands, key=lambda m: m['score'])
    if new['seed'] != old.get('seed') or new['wer'] != old.get('wer'):
        choose(ln, cands)
        log({'event': 'reselect', 'id': ln['id'], 'from': old.get('seed'), 'to': new['seed'], 'wer': new['wer']})

todo = [ln for ln in job['lines'] if not os.path.exists(os.path.join(out, f"{ln['id']}.{ln['hash']}.json"))]
log({'event': 'start', 'lines': len(job['lines']), 'todo': len(todo)})
if not todo:
    sys.exit(0)

tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
asr = pipeline('automatic-speech-recognition', model='openai/whisper-large-v3-turbo', device='cpu')
SR = tts.sr


for n, ln in enumerate(todo, 1):
    base = os.path.join(out, f"{ln['id']}.{ln['hash']}")
    refs = ln.get('refs') or [ln['text']]
    cands = []
    cached = {m['seed']: m for m in takes_of(ln)}
    for sd in SEEDS:
        wav_p, js_p = f'{base}.s{sd}.wav', f'{base}.s{sd}.json'
        if sd in cached:
            m = cached[sd]
        else:
            torch.manual_seed(sd)
            t0 = time.time()
            wav = tts.generate(ln['text'], language_id='tr', audio_prompt_path=job['ref'], exaggeration=S.get('exaggeration', 0.8),
                               cfg_weight=S.get('cfg_weight', 0.3), temperature=S.get('temperature', 0.8))
            y = wav.squeeze(0).numpy().astype(np.float32)
            m = analyse(y, ln['text'], refs, tuple(ln.get('strict') or ()))
            m.update({'seed': sd, 'sec': round(time.time() - t0)})
            m['score'] = round(score(m), 3)
            ta.save(wav_p, wav, SR)
            json.dump(m, open(js_p, 'w', encoding='utf-8'), ensure_ascii=False)
            log({'event': 'take', 'id': ln['id'], **{k: m[k] for k in ('seed', 'wer', 'gap', 'sps', 'f0', 'extra', 'score', 'sec', 'asr')}})
        m['file'] = wav_p
        cands.append(m)
        if m['wer'] == 0 and m['extra'] == 0 and m['gap'] <= ACCEPT_GAP and m['sps'] >= ACCEPT_SPS:
            break
    best = choose(ln, cands)
    log({'event': 'line', 'n': n, 'of': len(todo), 'id': ln['id'], 'seed': best['seed'], 'wer': best['wer'], 'sps': best['sps'], 'takes': len(cands)})
log({'event': 'done'})
