#!/usr/bin/env python3
"""29 Ekim Cumhuriyet Bayramı Reels'i için özgün tören müziği (Si bemol majör, 90 BPM; bakır + yaylı benzeri sentez).
Tamamen numpy sentezi, reklam_ses.py çalgılarıyla; hiçbir marş, şarkı ya da kayıttan alıntı/uyarlama YOK.
Kullanım: python3 tools/reels/ekim29_ses.py <çıktı.wav> [saniye=15]
Vuruşlar sahneyle (ekim29.html) eş: 0,55 tek atım · 2,55 bayrak · 5,3–7,95 sayaç yükselişi · 7,95 "103" · 11,7 imza.
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reklam_ses import SR, Bus, T, fftfilt, noise, env, norm, taiko, bell, glock, pad, choir, brass, crash, pizz, sub, write_wav

out = sys.argv[1]; total = float(sys.argv[2]) if len(sys.argv) > 2 else 15.0
bus = Bus(total + 0.5)
B = 60 / 90
Bb2, F3, Bb3, D4, F4, Bb4 = 46, 53, 58, 62, 65, 70
CH = {'Bb': [46, 58, 62, 65], 'Gm': [43, 55, 58, 62], 'Eb': [39, 55, 58, 63], 'F': [41, 57, 60, 65], 'Bbh': [46, 58, 62, 65, 70]}

def strings(notes, d, vol=0.07, a=0.5):
    return pad(notes, d, vol=vol, a=a, r=0.8, cut=2600, kind='saw')

def timp(vol, f0=58.27 * 1.0):
    return taiko(vol, f0=f0, d=1.4)

def riser(d, vol=0.12):
    t = T(d); x = fftfilt(noise(d), lo=400, hi=6000) * (t / d) ** 2.2
    return vol * x

# 1) karanlıkta tek atım + yankıları
bus.add(timp(0.55, 46.25), 0.55, rev=0.5)
bus.add(bell(82, 3.0, 0.10), 0.55, rev=0.7)
for k, (tt, g) in enumerate(((1.15, .5), (1.75, .3))):
    bus.add(bell(82, 2.0, 0.10 * g), tt, pan=(-.4, .4)[k], rev=0.8)
# 2) yaylı kabarma → bayrak
bus.add(strings([Bb2, F3, Bb3, D4, F4], 2.4, 0.09, a=1.7), 0.55, rev=0.35)
bus.add(sub(Bb2 - 12, 2.2, 0.25) * np.linspace(0, 1, int(2.2 * SR)) ** 2, 0.5)
bus.add(riser(1.9), 0.65, rev=0.3)
# 3) bayrak: tutti
def tutti(t, ch, d, v=1.0, cym=True):
    bus.add(brass(CH[ch][1:], d, 0.20 * v, cut=2200), t, rev=0.3)
    bus.add(strings(CH[ch], d, 0.08 * v), t, rev=0.3)
    bus.add(sub(CH[ch][0] - 12 if CH[ch][0] > 40 else CH[ch][0], d, 0.32 * v), t)
    bus.add(timp(0.8 * v, 58.27 if ch in ('Bb', 'Bbh', 'Gm') else 43.65), t, rev=0.4)
    if cym: bus.add(crash(0.22 * v, 2.6), t, rev=0.3)
tutti(2.55, 'Bb', 1.4)
# bakır fanfar (özgün motif)
mel1 = [(2.55 + 2 * B, 70, B), (2.55 + 3 * B, 72, B / 2), (2.55 + 3.5 * B, 74, B / 2), (2.55 + 4 * B, 77, 1.5 * B), (2.55 + 5.5 * B, 75, B / 2),
        (2.55 + 6 * B, 74, B), (2.55 + 7 * B, 72, B)]
for t0, n, d in mel1: bus.add(brass([n], d * 1.05, 0.13, cut=2600), t0, pan=0.15, rev=0.35)
bus.add(strings(CH['Bb'], 2 * B, 0.07), 2.55 + 2 * B, rev=0.3)
bus.add(strings(CH['Gm'], 2 * B, 0.07), 2.55 + 4 * B, rev=0.3); bus.add(sub(43 - 12 + 12, 2 * B, 0.25), 2.55 + 4 * B)
bus.add(strings(CH['Eb'], 2 * B, 0.07), 2.55 + 6 * B, rev=0.3); bus.add(sub(39, 2 * B, 0.25), 2.55 + 6 * B)
# 4) sayaç: yükselen yaylı ostinato + timpani gürlemesi → "103"
t0 = 5.3; t1 = 7.95
seq = [58, 62, 65, 70]; i = 0; t = t0
while t < t1 - 0.05:
    p = (t - t0) / (t1 - t0); ch = 'Eb' if p < 0.5 else 'F'
    base = CH[ch][1:]; n = base[i % 3] + 12 * (1 + (i // 6) % 2)
    bus.add(pizz(n, 0.10 + 0.10 * p, 0.35), t, pan=(-.3, .3)[i % 2], rev=0.25)
    i += 1; t += B / 2 if p < 0.45 else B / 4
bus.add(strings(CH['Eb'], 1.4, 0.06, a=0.3), 5.3, rev=0.3); bus.add(sub(39, 1.4, 0.22), 5.3)
bus.add(strings(CH['F'] + [72], 1.3, 0.08, a=0.3), 6.65, rev=0.3); bus.add(sub(41, 1.3, 0.26), 6.65)
t = 6.6
while t < t1 - 0.04:
    p = (t - 6.6) / (t1 - 6.6); bus.add(timp(0.10 + 0.35 * p ** 1.5, 43.65), t, rev=0.2); t += 0.07
bus.add(riser(1.6, 0.16), t1 - 1.6, rev=0.2)
tutti(t1, 'Bbh', 1.4, 1.15)
bus.add(choir([58, 62, 65, 70], 3.6, 0.06, a=0.4), t1, rev=0.5)
# 5) marş benzeri olmayan, geniş bir kapanış cümlesi (özgün)
mel2 = [(t1 + 2 * B, 77, B), (t1 + 3 * B, 75, B / 2), (t1 + 3.5 * B, 74, B / 2), (t1 + 4 * B, 75, B), (t1 + 5 * B, 79, B),
        (t1 + 6 * B, 77, 1.5 * B), (t1 + 7.5 * B, 72, B / 2 + 0.05)]
for tt, n, d in mel2: bus.add(brass([n], d * 1.05, 0.13, cut=2600), tt, pan=0.15, rev=0.4)
for k, ch in enumerate(('Eb', 'Gm', 'F')):
    tt = t1 + (2 + 2 * k) * B
    bus.add(strings(CH[ch], 2 * B + 0.1, 0.075), tt, rev=0.35); bus.add(sub(CH[ch][0], 2 * B, 0.24), tt)
    bus.add(timp(0.35, 58.27 if ch == 'Gm' else 43.65), tt, rev=0.3)
# 6) imza: büyük son akor, uzun söner + ODİ çanları
te = 11.7; dl = total - te + 0.3
bus.add(brass([58, 62, 65, 70], dl, 0.20, cut=2000) * np.exp(-T(dl) * 0.55)[: int(dl * SR)], te, rev=0.45)
bus.add(strings([46, 58, 62, 65, 70, 74], dl, 0.09, a=0.05) * np.exp(-T(dl) * 0.35)[: int(dl * SR)], te, rev=0.45)
bus.add(sub(34, dl, 0.30) * np.exp(-T(dl) * 0.6)[: int(dl * SR)], te)
bus.add(timp(0.95, 58.27), te, rev=0.5); bus.add(crash(0.24, 3.0), te, rev=0.35)
bus.add(choir([62, 65, 70, 74], dl, 0.055, a=0.3), te, rev=0.6)
for q, n in enumerate((82, 86, 89, 94)): bus.add(glock(n, 1.6, 0.07), te + 0.35 + 0.11 * q, pan=-.3 + .2 * q, rev=0.6)

st = bus.render(2.6, 5000)
n = int(total * SR); st = st[:, :n]
fade = int(0.9 * SR); st[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
st[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
write_wav(out, st)
print('yazıldı:', out)
