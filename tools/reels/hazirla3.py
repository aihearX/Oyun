#!/usr/bin/env python3
"""Reels (3. dalga): kamp-cekim.mjs çekimlerinden compose.py'nin "klip" olarak okuduğu hazır kare dizileri (index.json + kareler).

Kullanım: python3 tools/reels/hazirla3.py [--ada-sn 4.0]
Çıktı: tools/harness/out/reels3/seq/<ad>/ (index.json: {frames: [{f, t}]}; t = "simülasyon" saniyesi, sahne hızıyla oynatılır)
  zaman   Merkez Sv 1..25: kare i (Sv i+1) t ∈ [i, i+1) aralığında görünür (t = i + 0,5); sahne hızı 1/vuruş → her vuruşta bir seviye.
          Kareler kamera merkezine göre hizalanır (sürükleme ±1 px kayabilir).
  ada     Merkez'den bütün takımadaya kesintisiz geri çekilme: oyunun gerçek yakınlaştırma basamaklarından (her biri ×0,9) her karede
          hedef görüşü kapsayan en ayrıntılı basamak kırpılır (büyütme ≤ ×1,11; netlik korunur). 30 kare/sn, --ada-sn saniye.
  s-<yol> Tek görüntü (vaka/oyun/anıt/süsle ekranları): t = 0.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CEK = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels3', 'cekim')
SEQ = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels3', 'seq')
a = sys.argv[1:]
ADA_SN = float(a[a.index('--ada-sn') + 1]) if '--ada-sn' in a else 4.0
DSF = 2.25  # kamp çekimi: 480×853 CSS px, cihaz ölçeği 2,25 → 1080×1919


def write_index(d, frames):
    json.dump({'clip': {'seq': os.path.basename(d)}, 'fps': 30, 'frames': frames}, open(os.path.join(d, 'index.json'), 'w'))


def zaman():
    src = os.path.join(CEK, 'zaman'); idx = json.load(open(os.path.join(src, 'index.json')))
    d = os.path.join(SEQ, 'zaman'); os.makedirs(d, exist_ok=True); frames = []
    ref = idx[0]['view']
    for i, it in enumerate(idx):
        im = Image.open(it['file']).convert('RGB'); v = it['view']; k = v['zoom'] * DSF
        dx, dy = (v['x'] - ref['x']) * k, (v['y'] - ref['y']) * k  # bu karenin merkezi referanstan bu kadar kaymış → geri kaydır
        if abs(dx) > 0.3 or abs(dy) > 0.3:
            s = 1.012; W, H = im.size; cw, ch = W / s, H / s
            im = im.transform((W, H), Image.EXTENT, (W / 2 + dx - cw / 2, H / 2 + dy - ch / 2, W / 2 + dx + cw / 2, H / 2 + dy + ch / 2), Image.BICUBIC)
        f = f'k{i + 1:03d}.jpg'; im.save(os.path.join(d, f), quality=93); frames.append({'f': f, 't': i + 0.5})
    write_index(d, frames); print('zaman:', len(frames), 'kare')


def ada():
    src = os.path.join(CEK, 'ada'); idx = json.load(open(os.path.join(src, 'index.json')))
    steps = sorted(idx['steps'], key=lambda s: -s['view']['zoom'])
    ims = [Image.open(s['file']).convert('RGB') for s in steps]; W, H = ims[0].size
    v0, v1 = steps[0]['view'], steps[-1]['view']
    d = os.path.join(SEQ, 'ada'); os.makedirs(d, exist_ok=True); frames = []
    n = int(round(ADA_SN * 30))
    for k in range(n):
        u = k / (n - 1); e = u * u * (3 - 2 * u)  # yumuşak başla, yumuşak dur
        Z = v0['zoom'] * (v1['zoom'] / v0['zoom']) ** e
        cx = v0['x'] + (v1['x'] - v0['x']) * e; cy = v0['y'] + (v1['y'] - v0['y']) * e
        best = None
        for i, s in enumerate(steps):
            v = s['view']; kk = v['zoom'] * DSF; cw = W * v['zoom'] / Z; ch = H * v['zoom'] / Z
            x0 = (cx - v['x']) * kk + W / 2 - cw / 2; y0 = (cy - v['y']) * kk + H / 2 - ch / 2
            inside = x0 >= -1 and y0 >= -1 and x0 + cw <= W + 1 and y0 + ch <= H + 1
            if inside: best = (i, (x0, y0, x0 + cw, y0 + ch)); break
        if best is None:  # en uzak basamak: sınırlara kıs
            i = len(steps) - 1; v = steps[i]['view']; kk = v['zoom'] * DSF; cw = min(W, W * v['zoom'] / Z); ch = min(H, H * v['zoom'] / Z)
            x0 = min(max(0, (cx - v['x']) * kk + W / 2 - cw / 2), W - cw); y0 = min(max(0, (cy - v['y']) * kk + H / 2 - ch / 2), H - ch); best = (i, (x0, y0, x0 + cw, y0 + ch))
        i, box = best
        im = ims[i].transform((1080, 1920), Image.EXTENT, box, Image.BICUBIC)
        f = f'k{k + 1:03d}.jpg'; im.save(os.path.join(d, f), quality=92); frames.append({'f': f, 't': round(k / 30, 4)})
    write_index(d, frames)
    # son karede bölgelerin ekran konumu (etiketler için; 1080×1920)
    # bölge merkezleri (packages/content/src/kamp-arazi.ts › DISTRICTS cx, cy) → son karede ekran konumu
    D = {'koru': (-780, -405), 'koy': (1090, 80), 'tepe': (-800, 420), 'yerleske': (700, -445), 'orman': (740, 515)}
    e = 1.0; Z = v1['zoom']; cx, cy = v1['x'], v1['y']; kz = Z * DSF * 1080 / W
    pos = {k: [round((x - cx) * kz + 540), round((y - cy) * kz + 960)] for k, (x, y) in D.items()}
    json.dump({'son_gorus': v1, 'bolgeler': pos}, open(os.path.join(d, 'bolgeler.json'), 'w'), indent=1)
    print('ada:', n, 'kare;', pos)


def stills():
    for sub in ('vaka', 'oyun', 'anit', 'susle'):
        sd = os.path.join(CEK, sub)
        if not os.path.isdir(sd): continue
        for fn in sorted(os.listdir(sd)):
            if not fn.endswith('.png') or fn.startswith('anit-'): continue
            d = os.path.join(SEQ, f's-{sub}-{fn[:-4]}'); os.makedirs(d, exist_ok=True)
            im = Image.open(os.path.join(sd, fn)).convert('RGB'); im.save(os.path.join(d, 'k001.jpg'), quality=94)
            write_index(d, [{'f': 'k001.jpg', 't': 0.0}])
    print('tek görüntüler hazır')


if __name__ == '__main__':
    which = [x for x in a if not x.startswith('--') and x != str(ADA_SN)] or ['zaman', 'ada', 'stills']
    for w in which: {'zaman': zaman, 'ada': ada, 'stills': stills}[w]()
