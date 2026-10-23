#!/usr/bin/env python3
"""Reels denetimi: kare tabakaları, ses yüksekliği ve (isteğe bağlı) son karışımın Whisper dökümü.

Kullanım: python3 tools/reels/denetle.py <slug> [--every 0.5] [--asr <python>]
  --asr: Whisper çalıştırılacak Python (chatterbox/transformers venv'i; HF_HOME ayarlı olmalı)
Çıktı: tools/harness/out/reels/<slug>/denetim-NN.jpg (her kare küçük, zaman damgalı; güvenli alan çizgileri: üst 250, alt 350 px)
ve ekrana: süre, boyut, bütünleşik ses yüksekliği (LUFS), gerçek tepe (dBTP), video/ses biçimi.
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
a = sys.argv[1:]; slug = a[0]
every = float(a[a.index('--every') + 1]) if '--every' in a else 0.5
mp4 = os.path.join(ROOT, 'marketing', 'reels', f'{slug}.mp4'); work = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels', slug)
os.makedirs(work, exist_ok=True)

pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4], capture_output=True, text=True).stdout)
dur = float(pr['format']['duration'])
v = next(s for s in pr['streams'] if s['codec_type'] == 'video'); au = next(s for s in pr['streams'] if s['codec_type'] == 'audio')
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mp4, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
summ = r[r.rindex('Summary:'):]
I = float(summ.split('I:')[1].split('LUFS')[0]); TP = float(summ.split('Peak:')[1].split('dBFS')[0])
print(f'{slug}: {dur:.2f} sn, {os.path.getsize(mp4) / 1e6:.1f} MB, {v["codec_name"]} {v["width"]}x{v["height"]} {v["pix_fmt"]} {v["r_frame_rate"]}, '
      f'{au["codec_name"]} {au["sample_rate"]} Hz {au["channels"]} kanal · {I:.1f} LUFS, gerçek tepe {TP:.1f} dBTP')

# kare tabakaları
tmp = os.path.join(work, 'denetim-kare'); os.makedirs(tmp, exist_ok=True)
for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'fps=1/{every},scale=270:480', os.path.join(tmp, 'k%04d.png')], check=True)
files = sorted(os.listdir(tmp)); per = 16
for p in range(0, len(files), per):
    sheet = Image.new('RGB', (8 * 270, 2 * 500), (40, 40, 40)); d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files[p:p + per]):
        im = Image.open(os.path.join(tmp, f)); x = (i % 8) * 270; y = (i // 8) * 500
        sheet.paste(im, (x, y + 20)); dd = ImageDraw.Draw(sheet)
        for yy in (250, 1920 - 350): dd.line([(x, y + 20 + yy / 4), (x + 270, y + 20 + yy / 4)], fill=(255, 0, 0))
        d.text((x + 4, y + 3), f'{(p + i) * every + every / 2:.1f}s', fill=(255, 255, 0))
    sheet.save(os.path.join(work, f'denetim-{p // per:02d}.jpg'), quality=82)
print(f'tabakalar: {work}/denetim-*.jpg ({len(files)} kare)')

if '--asr' in a:
    py = a[a.index('--asr') + 1]
    code = ("import sys,librosa;from transformers import pipeline;y,_=librosa.load(sys.argv[1],sr=16000);"
            "p=pipeline('automatic-speech-recognition',model='openai/whisper-large-v3-turbo',device='cpu');"
            "r=p(y,return_timestamps=True,generate_kwargs={'language':'turkish','task':'transcribe'});"
            "[print(f\"{c['timestamp'][0]:6.2f}-{c['timestamp'][1] if c['timestamp'][1] is not None else 0:6.2f} {c['text'].strip()}\") for c in r['chunks']]")
    print(subprocess.run([py, '-c', code, mp4], capture_output=True, text=True).stdout)
