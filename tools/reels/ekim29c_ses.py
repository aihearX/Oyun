#!/usr/bin/env python3
"""29 Ekim — Atatürk anma/kutlama Reels'i için özgün, ağırbaşlı sinematik müzik (Re minör → Si bemol majör; piyano, yaylı, koro dokusu).
Tamamen numpy sentezi, reklam_ses.py çalgılarıyla; hiçbir marş, şarkı ya da kayıttan alıntı/uyarlama YOK
(İstiklal Marşı, 10. Yıl Marşı ve arşiv ses kayıtları kullanılmamıştır).
Kullanım: python3 tools/reels/ekim29c_ses.py <çıktı.wav> [saniye=39.5]
Vuruşlar sahneyle (ekim29c.html) eş: 0,9–6,2 portre belirir · 7,6 + k·0,95 söz satırları · 19,5 / 21,7 köprü ·
26,0 bayrak (kabarma) · 27,3 tarih · 28,3 kutlama · 32,7 "Saygı, minnet ve özlemle." · 33,7 imza · 38,1 ayrı son kare.
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reklam_ses import SR, Bus, T, fftfilt, noise, pad, choir, brass, piano, bell, glock, taiko, sub, write_wav

out = sys.argv[1]; total = float(sys.argv[2]) if len(sys.argv) > 2 else 39.5
bus = Bus(total + 0.5)


def strings(notes, d, vol=0.07, a=0.8, r=1.0, cut=2400):
    return pad(notes, d, vol=vol, a=a, r=r, cut=cut, kind='saw')


def soft_strings(notes, d, vol=0.06, a=1.2, r=1.2):
    """daha yumuşak (üçgen dalga) yaylı yatağı"""
    return pad(notes, d, vol=vol, a=a, r=r, cut=1800, kind='tri')


def swell(d, vol=0.10, lo=300, hi=5000, p=2.0):
    t = T(d); return vol * fftfilt(noise(d), lo=lo, hi=hi) * (t / d) ** p


def timp_roll(t0, t1, v0=0.04, v1=0.32, f0=43.65):
    t = t0
    while t < t1:
        p = (t - t0) / (t1 - t0); bus.add(taiko(v0 + (v1 - v0) * p ** 1.6, f0=f0, d=0.9), t, rev=0.35); t += 0.075


# akorlar (MIDI)
Dm, Bb, F, C, Gm, Eb, FA = [50, 57, 62, 65], [46, 58, 62, 65], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 58, 62], [39, 55, 58, 63], [45, 57, 60, 65]

# 1) karanlık: alçak, ağırbaşlı yatak + seyrek piyano (portre karanlıktan belirir)
bus.add(soft_strings([38, 45, 50], 7.8, 0.075, a=3.0, r=1.5), 0.2, rev=0.5)
bus.add(sub(38, 7.6, 0.16) * np.linspace(0, 1, int(7.6 * SR)) ** 1.5, 0.3)
for tt, n, v in ((1.3, 62, .13), (2.5, 65, .11), (3.7, 69, .12), (5.2, 67, .11), (6.4, 65, .12)):
    bus.add(piano(n, 3.0, v), tt, pan=-0.1, rev=0.55)
bus.add(piano(38, 4.0, 0.10), 1.3, rev=0.5)

# 2) söz: her satıra bir piyano notası, iki satırda bir akor (Re minör → Si bemol → Fa → Do), yaylı yatak
Q0, QD = 7.6, 0.95
chords = [(Dm, 50), (Bb, 46), (F, 41), (C, 48)]
mel = [69, 65, 74, 72, 69, 67]
for k in range(6):
    bus.add(piano(mel[k], 2.4, 0.13), Q0 + k * QD, pan=0.1, rev=0.5)
for j, (ch, root) in enumerate(chords):
    tt = Q0 + j * 2 * QD; d = 2 * QD + 0.35 if j < 3 else 4.6
    bus.add(soft_strings(ch[1:], d, 0.065, a=0.6, r=0.9), tt, rev=0.45)
    bus.add(sub(root - 12 if root > 40 else root, d, 0.17), tt)
    bus.add(piano(root - 12 if root > 40 else root, 2.6, 0.08), tt, rev=0.4)
# künye (13,6): yumuşak çözülme Re minöre, uzun nefes
bus.add(piano(62, 3.2, 0.11), 13.6, rev=0.6); bus.add(piano(57, 3.2, 0.08), 13.75, rev=0.6)
bus.add(soft_strings([50, 57, 62, 65], 4.6, 0.06, a=1.0, r=1.6), 14.1, rev=0.5); bus.add(sub(38, 4.4, 0.16), 14.1)
bus.add(bell(86, 3.0, 0.035), 15.2, pan=0.3, rev=0.8)

# 3) köprü: umutlu dönüş (Si bemol → Fa/La → Sol minör → Fa), yaylılar yavaşça kalınlaşır
for tt, ch, d, v in ((19.0, Bb, 2.3, .07), (21.2, FA, 2.3, .075), (23.4, Gm, 1.3, .08), (24.6, F, 1.45, .09)):
    bus.add(strings(ch[1:] + [ch[1] + 12], d + 0.3, v, a=0.7, r=0.6), tt, rev=0.45)
    bus.add(sub(ch[0], d, 0.2), tt)
for tt, n in ((19.5, 74), (20.3, 72), (21.7, 72), (22.5, 69), (23.4, 70), (24.6, 72)):
    bus.add(piano(n, 2.2, 0.12), tt, pan=0.1, rev=0.5)
bus.add(swell(1.6, 0.11), 24.4, rev=0.3)
timp_roll(24.7, 26.0, 0.03, 0.30, 43.65)

# 4) bayrak: kabarma (Si bemol majör), koro, yumuşak bakır, timpani; özgün geniş melodi
bus.add(taiko(0.85, f0=58.27, d=1.8), 26.0, rev=0.5)
fl = [(26.0, Bb, 1.5), (27.5, FA, 1.5), (29.0, Gm, 1.2), (30.2, Eb, 0.8), (31.0, F, 1.3)]
for tt, ch, d in fl:
    bus.add(strings(ch[1:] + [ch[1] + 12, ch[2] + 12], d + 0.25, 0.10, a=0.25, r=0.5), tt, rev=0.4)
    bus.add(brass(ch[1:], d + 0.1, 0.09, cut=1600), tt, rev=0.4)
    bus.add(sub(ch[0] if ch[0] < 44 else ch[0] - 12, d, 0.30), tt)
bus.add(choir([58, 62, 65, 70], 6.3, 0.05, a=0.5), 26.0, rev=0.6)
for tt, n, d in ((26.0, 74, 1.5), (27.5, 72, 1.0), (28.5, 74, 0.5), (29.0, 70, 1.2), (30.2, 79, 0.8), (31.0, 77, 1.3)):
    bus.add(strings([n], d * 1.05 + 0.15, 0.085, a=0.08, r=0.35, cut=3200), tt, pan=0.15, rev=0.5)
    bus.add(piano(n, 1.8, 0.10), tt, rev=0.45)
bus.add(taiko(0.4, f0=43.65, d=1.2), 29.0, rev=0.4); bus.add(taiko(0.5, f0=43.65, d=1.2), 31.0, rev=0.4)
bus.add(swell(0.9, 0.06), 31.4, rev=0.3)

# 5) kapanış: geniş Si bemol akoru, uzun söner; imzada piyano yükselen arpej
dl = 5.6; dec = np.exp(-T(dl) * 0.45)[: int(dl * SR)]
bus.add(strings([46, 58, 62, 65, 70, 74], dl, 0.09, a=0.2, r=1.5) * dec, 32.3, rev=0.55)
bus.add(choir([62, 65, 70], dl, 0.04, a=0.6) * dec, 32.3, rev=0.7)
bus.add(sub(34, dl, 0.26) * dec, 32.3)
bus.add(taiko(0.55, f0=58.27, d=2.0), 32.3, rev=0.6)
bus.add(piano(77, 3.0, 0.12), 32.7, rev=0.6)
for q, n in enumerate((70, 74, 77, 82)):
    bus.add(piano(n, 3.4, 0.10), 33.7 + 0.32 * q, pan=-0.2 + 0.13 * q, rev=0.6)
bus.add(bell(82, 3.5, 0.04), 35.1, rev=0.85)
# 6) ayrı son kare: tek, çok yumuşak çan
bus.add(glock(94, 1.4, 0.03), 38.7, rev=0.8)

st = bus.render(3.0, 4800)
n = int(total * SR); st = st[:, :n]
st[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
fade = int(1.5 * SR); st[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
write_wav(out, st)
print('yazıldı:', out)
