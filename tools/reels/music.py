#!/usr/bin/env python3
"""ODİ Reels müziği: telifsiz, özgün, ninni esintili neşeli bir parça (numpy ile sentez).
Yapı: 104 BPM, Do majör; C-G-Am-F akoru; yumuşak davul, bas, pluck melodi, parlak çan vurguları.
Kullanım: python3 tools/reels/music.py <çıktı.wav> <saniye>
"""
import sys, wave
import numpy as np

SR = 44100
BPM = 104
BEAT = 60 / BPM
out_path = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 60
N = int(SR * seconds)
mix = np.zeros(N)

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)

def env(n, a=0.005, d=0.12, s=0.5, r=0.2):
    e = np.full(n, s, dtype=float)
    a_n = min(n, max(1, int(a * SR)))
    e[:a_n] = np.linspace(0, 1, a_n)
    d_end = min(n, a_n + max(1, int(d * SR)))
    e[a_n:d_end] = np.linspace(1, s, d_end - a_n)
    r_n = min(n, max(1, int(r * SR)))
    e[n - r_n:] *= np.linspace(1, 0, r_n)
    return e

def add(sig, at):
    i = int(at * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    mix[i:j] += sig[: j - i]

def pluck(note, dur, vol=0.22):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = 0.6 * np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return vol * s * env(n, 0.004, 0.18, 0.25, 0.15) * np.exp(-t * 2.2)

def bell(note, dur, vol=0.12):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2.76 * f * t) + 0.25 * np.sin(2 * np.pi * 5.4 * f * t)
    return vol * s * np.exp(-t * 3.2)

def pad(notes, dur, vol=0.05):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * midi(x) * t) + 0.3 * np.sin(2 * np.pi * midi(x) * 1.003 * t) for x in notes)
    return vol * s * env(n, 0.25, 0.3, 0.8, 0.4)

def bass(note, dur, vol=0.28):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return vol * s * env(n, 0.005, 0.1, 0.7, 0.08)

def kick(vol=0.55):
    n = int(0.28 * SR); t = np.arange(n) / SR
    f = 120 * np.exp(-t * 18) + 45
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

rng = np.random.default_rng(7)
def hat(vol=0.05):
    n = int(0.06 * SR); t = np.arange(n) / SR
    w = rng.standard_normal(n); w = np.diff(np.concatenate([[0], w]))  # parlak gürültü
    return vol * w * np.exp(-t * 60)

def clap(vol=0.12):
    n = int(0.18 * SR); t = np.arange(n) / SR
    w = rng.standard_normal(n)
    return vol * w * (np.exp(-t * 25) + 0.5 * np.exp(-np.maximum(0, t - 0.012) * 30))

# akorlar (her biri 1 ölçü = 4 vuruş): C G Am F
chords = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]
# özgün melodi (8 ölçü), ninni gibi inen-çıkan: (nota, vuruş uzunluğu)
motif = [
    (72, 1), (76, 0.5), (74, 0.5), (72, 1), (67, 1),
    (71, 1), (74, 0.5), (72, 0.5), (71, 1), (67, 1),
    (69, 1), (72, 0.5), (71, 0.5), (69, 1), (76, 1),
    (77, 1), (76, 0.5), (74, 0.5), (72, 2),
]
bar = 4 * BEAT
bars = int(seconds / bar) + 1
for b in range(bars):
    t0 = b * bar
    root, tri = chords[b % 4]
    add(pad(tri, bar * 1.02), t0)
    for k in range(4):
        add(bass(root if k % 2 == 0 else root + 12, BEAT * 0.9), t0 + k * BEAT)
    if b >= 1:  # davul ilk ölçüden sonra girer
        for k in range(4):
            add(kick(), t0 + k * BEAT)
            add(hat(), t0 + k * BEAT + BEAT / 2)
            if k in (1, 3): add(clap(), t0 + k * BEAT)
# melodi: 2. ölçüden itibaren, döngü
t = bar
i = 0
while t < seconds - 0.5:
    note, beats = motif[i % len(motif)]
    add(pluck(note, beats * BEAT * 1.1), t)
    if i % 5 == 0: add(bell(note + 12, 1.2), t)
    t += beats * BEAT; i += 1

# basit oda yankısı (gecikmeli kopyalar)
for d, g in ((0.11, 0.25), (0.23, 0.15), (0.37, 0.08)):
    k = int(d * SR); mix[k:] += g * mix[:-k]
# giriş/çıkış sönümü + normalize
fade = int(0.6 * SR)
mix[:fade] *= np.linspace(0, 1, fade); mix[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))
mix /= max(1e-9, np.max(np.abs(mix))) / 0.85
pcm = (mix * 32767).astype('<i2')
stereo = np.stack([pcm, pcm], axis=1).reshape(-1)
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(stereo.tobytes())
print(f'müzik: {out_path} ({seconds:.1f} sn)')
