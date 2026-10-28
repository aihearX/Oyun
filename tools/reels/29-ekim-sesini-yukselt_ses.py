#!/usr/bin/env python3
"""29 Ekim Reels (3) "Sesini yükselt": özgün müzik + ses tasarımı (numpy sentezi; örnek, marş, kayıt YOK).

Akış (zaman tools/harness/out/29-ekim-sesini-yukselt/zaman.json'dan; 29-ekim-sesini-yukselt.mjs yazar):
  klinik: oda tonu, odyometre "bip"leri, sinsi/komik pizzicato (Re minör, 120 BPM)
    · kulaklıktan sızan cılız müzik → "kıs" anında kısılır
    · konser gürültüsü (güç akoru + kalabalık) → "tıkaç" anında boğuklaşır (alçak geçiren süzgeç: tıkaç gibi)
    · 85'e sürünen ton, 85'in hemen altında fren
    · "Kıs. / Biraz daha. / KIS DEDİM." üç inen ve giderek kısılan nota
  plak cızırtısı + bant durması → sessizlik → "Ama bugün…" (üç tık) → birim döner ("dB GURUR") → yükseliş:
    davul (bas davul her vuruşta), uzaktan yaklaşan trampet marşı, sentez kalabalık tezahüratı/alkış/ıslık, her basamakta bakır vuruşu (Re majör)
  dönüşüm: timpani tremolosu + yaylı/bakır yükselişi → BAYRAK: büyük tören vuruşu, üç ölçü özgün tören teması
  son kart: yumuşak Re majör, "bip" sesinin çana dönüşen hatırlatması.
Ses yüksekliği: −14 LUFS, tepe sınırlayıcı (gerçek tepe ≤ −1 dBTP). Çıktı: marketing/reels/29-ekim-sesini-yukselt.mp4 (+ kapak).
Kullanım (kökten): python3 tools/reels/29-ekim-sesini-yukselt_ses.py [--no-mux]
"""
import json, os, shutil, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SLUG = '29-ekim-sesini-yukselt'
OUT = os.path.join(ROOT, 'tools', 'harness', 'out', SLUG)
T = json.load(open(os.path.join(OUT, 'zaman.json')))
SR = 48000
DUR = T['dur']; N = int(SR * DUR) + SR
BEAT = 60 / T['bpm']; BAR = 4 * BEAT
C0, M0, F, E, SCR = T['C0'], T['M0'], T['F'], T['E'], T['scratch']
rng = np.random.default_rng(2910)

music = np.zeros((2, N)); sfx = np.zeros((2, N)); crowd_bus = np.zeros((2, N)); far_bus = np.zeros((2, N))


def midi(n): return 440.0 * 2 ** ((n - 69) / 12)


def tt(n): return np.arange(n) / SR


def env(n, a=0.01, r=0.2):
    e = np.ones(n); an = max(1, min(n, int(a * SR))); e[:an] = np.linspace(0, 1, an) ** 1.5
    rn = max(1, min(n - an, int(r * SR))); e[n - rn:] *= np.linspace(1, 0, rn) ** 1.3
    return e


def add(bus, sig, at, pan=0.0, g=1.0):
    i = int(round(at * SR))
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414])
    if i < 0: sig = sig[:, -i:]; i = 0
    j = min(N, i + sig.shape[1])
    if j > i: bus[:, i:j] += g * sig[:, : j - i]


def filt(x, lo=None, hi=None, order=2):
    """FFT süzgeci (sıfır faz): lo = alçak geçiren kesim, hi = yüksek geçiren kesim"""
    X = np.fft.rfft(x, axis=-1); f = np.fft.rfftfreq(x.shape[-1], 1 / SR); Hh = np.ones_like(f)
    if lo: Hh *= 1 / np.sqrt(1 + (f / lo) ** (2 * order))
    if hi: Hh *= 1 / np.sqrt(1 + (np.maximum(f, 1e-3) / hi) ** (-2 * order))
    return np.fft.irfft(X * Hh, n=x.shape[-1], axis=-1)


def saw(f, n, det=0.0, vib=0.0, vib_rate=5.2, ph=0.0):
    t = tt(n); fr = f * 2 ** (det / 1200) * (1 + vib * np.sin(2 * np.pi * vib_rate * t + ph) * np.clip(t / 0.6, 0, 1))
    p = (np.cumsum(fr) / SR + ph / (2 * np.pi)) % 1.0
    return 2 * p - 1


def envc(t, pts):
    xs, ys = zip(*pts); return np.interp(t, xs, ys)


# ------------------------------------------------------------------ çalgılar
def pluck(note, dur=0.5, vel=0.5):
    n = int(dur * SR); t = tt(n); f = midi(note); s = np.zeros(n)
    for k in range(1, 7): s += (1 / k ** 1.1) * np.sin(2 * np.pi * k * f * t + k) * np.exp(-t * (9 + 5 * k))
    return vel * 0.3 * s * env(n, 0.002, 0.05)


def pip(freq=1000, dur=0.22, vel=0.2):  # odyometre bip'i (yumuşak kenarlı saf ton)
    n = int(dur * SR); t = tt(n)
    return vel * np.sin(2 * np.pi * freq * t) * env(n, 0.02, 0.04)


def bell(note, dur=3.0, vel=0.3):
    n = int(dur * SR); t = tt(n); f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 3) + 0.15 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 6)
    return vel * 0.16 * s * np.exp(-t * 1.6) * env(n, 0.004, 0.2)


def strings(notes, at, dur, vol=0.05, a=0.6, r=0.8, bus=None, swell=None):
    n = int((dur + r) * SR)
    for i, nt in enumerate(notes):
        f = midi(nt); v = np.zeros(n)
        for d in (-7, -2, 3, 8):
            v += saw(f, n, det=d, vib=0.004, vib_rate=4.8 + 0.3 * i + d * 0.02, ph=rng.random() * 6.28)
        e = env(n, a, r)
        if swell is not None: e *= np.interp(tt(n), np.linspace(0, dur, len(swell)), swell)
        add(music if bus is None else bus, filt(v, lo=4200) * e * vol, at, pan=float(np.clip((nt - 60) / 30, -0.6, 0.6)))


def brass(notes, at, dur, vol=0.06, a=0.05, r=0.4, bright=1.0, bus=None):
    n = int((dur + r) * SR); t = tt(n)
    for nt in notes:
        f = midi(nt); v = sum(saw(f, n, det=d, vib=0.0035, vib_rate=5.0, ph=rng.random() * 6.28) for d in (-5, 0, 6))
        dark, br = filt(v, lo=min(700, f * 5)), filt(v, lo=min(3200, f * 14))
        b = bright * (np.exp(-t / 0.3) * 0.7 + 0.3)
        add(music if bus is None else bus, np.tanh((dark * (1 - b) + br * b) * 0.9) * env(n, a, r) * vol, at, pan=float(np.clip((nt - 57) / 36, -0.5, 0.5)))


def timpani(note, vel=0.8):
    n = int(2.0 * SR); t = tt(n); f = midi(note) * (1 + 0.025 * np.exp(-t * 8))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 2.2) + 0.5 * np.sin(1.5 * ph) * np.exp(-t * 3.5) + 0.3 * np.sin(1.98 * ph) * np.exp(-t * 4.5)
    mallet = filt(rng.standard_normal(n) * np.exp(-t * 60), lo=1200, hi=60) * 0.8
    return vel * 0.5 * np.tanh((s + mallet) * 1.2) * env(n, 0.002, 0.3)


def kick(vel=0.8):
    n = int(0.45 * SR); t = tt(n); f = 45 + 110 * np.exp(-t * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + 0.25 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 14)
    return vel * 0.8 * np.tanh(s * 1.5) * env(n, 0.001, 0.05)


def snare(vel=0.5, dur=0.25):
    n = int(dur * SR); t = tt(n)
    s = filt(rng.standard_normal(n), lo=9000, hi=1500) * np.exp(-t * 22) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    return vel * 0.5 * s * env(n, 0.001, 0.04)


def hat(vel=0.3):
    n = int(0.06 * SR); t = tt(n)
    return vel * 0.3 * filt(rng.standard_normal(n), hi=7000) * np.exp(-t * 80)


def boom(vel=1.0, dur=2.4):
    n = int(dur * SR); t = tt(n); f = 32 + 40 * np.exp(-t * 7)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + 0.35 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 4)
    return vel * 0.9 * np.tanh(s * 1.6) * env(n, 0.002, 0.4)


def crash(vel=0.5, dur=4.0):
    n = int(dur * SR); t = tt(n); w = rng.standard_normal((2, n))
    s = filt(w, lo=11000, hi=3000) * np.exp(-t * 1.7) + 0.4 * filt(w, lo=8000, hi=5000) * np.exp(-t * 3.5)
    return vel * 0.05 * s * env(n, 0.003, 0.6)


def riser(dur, vel=0.4, f0=180, f1=1400):
    n = int(dur * SR); t = tt(n); k = (t / dur) ** 2
    s = filt(rng.standard_normal((2, n)), hi=700, lo=5000) * k * 0.1
    s = s + 0.06 * np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / dur)) / SR) * k
    return vel * s * env(n, 0.01, 0.02)


def thunk(vel=0.5):  # kart çarpması
    n = int(0.25 * SR); t = tt(n); f = 70 + 120 * np.exp(-t * 40)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) + filt(rng.standard_normal(n), lo=2500, hi=200) * np.exp(-t * 60) * 0.5
    return vel * np.tanh(s * 1.4)


def slide(f0, f1, dur, vel=0.12):  # komik inen kaydırma (kayan düdük)
    n = int(dur * SR); t = tt(n); f = f0 * (f1 / f0) ** ((t / dur) ** 0.8)
    s = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))) / SR)
    return vel * s * env(n, 0.02, 0.08)


def tick(freq=1800, vel=0.3):
    n = int(0.05 * SR); t = tt(n)
    return vel * (np.sin(2 * np.pi * freq * t) * np.exp(-t * 120) + filt(rng.standard_normal(n), hi=2000) * np.exp(-t * 200) * 0.3)


def scratch(dur=0.42, vel=0.5):  # plak cızırtısı + bant durması
    n = int(dur * SR); t = tt(n)
    pos = np.sin(2 * np.pi * t / dur * 1.5) * np.exp(-t * 2)  # elle ileri-geri
    rate = np.abs(np.gradient(pos)) * SR / 40 + 0.05
    src = filt(rng.standard_normal(n), lo=6000, hi=300)
    s = src * np.clip(rate, 0, 2) * 0.8
    tone = np.sin(2 * np.pi * np.cumsum(420 * rate + 60) / SR) * 0.5
    return vel * np.tanh((s + tone) * 1.5) * env(n, 0.003, 0.08)


# ------------------------------------------------------------------ kalabalık (sentez): "aaa" sesleri, alkış, ıslık
def crowd_layer(t0, t1, dens, gains, seed):
    r = np.random.default_rng(seed); dur = t1 - t0; n = int(dur * SR)
    tl = tt(n)
    # nefes gibi uğultu
    roar = filt(r.standard_normal((2, n)), lo=2600, hi=280) * 0.05
    roar = roar + filt(r.standard_normal((2, n)), lo=1500, hi=600) * 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * tl))
    g = envc(t0 + tl, gains)
    add(crowd_bus, roar * g, t0)
    # sesler
    for _ in range(int(dens * dur)):
        at = r.uniform(0, dur); d = r.uniform(0.4, 1.3); m = int(d * SR); u = tt(m)
        f0 = r.uniform(170, 420); glide = 1 + r.uniform(0.0, 0.25) * np.clip(u / d, 0, 1)
        p = np.cumsum(f0 * glide) / SR % 1.0; v = 2 * p - 1
        vow = filt(v, lo=1300, hi=500) + 0.5 * filt(v, lo=2600, hi=1600)
        e = env(m, r.uniform(0.08, 0.3), r.uniform(0.2, 0.5)) * float(np.interp(t0 + at, *zip(*gains)))
        add(crowd_bus, vow * e * 0.035, t0 + at, pan=r.uniform(-0.8, 0.8))
    # alkış
    for _ in range(int(dens * 3.2 * dur)):
        at = r.uniform(0, dur); m = int(0.03 * SR); u = tt(m)
        c = filt(r.standard_normal(m), lo=6000, hi=900) * np.exp(-u * 160)
        add(crowd_bus, c * 0.09 * float(np.interp(t0 + at, *zip(*gains))), t0 + at, pan=r.uniform(-0.9, 0.9))
    # ıslık
    for _ in range(int(dens * 0.07 * dur) + 1):
        at = r.uniform(0.3, dur); d = r.uniform(0.35, 0.8); m = int(d * SR); u = tt(m)
        f = r.uniform(1900, 2800) * (1 + 0.08 * np.sin(np.pi * u / d)) * (1 + 0.01 * np.sin(2 * np.pi * 7 * u))
        w = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(m, 0.04, 0.12)
        add(crowd_bus, w * 0.03 * float(np.interp(t0 + at, *zip(*gains))), t0 + at, pan=r.uniform(-0.7, 0.7))


# ================================================================== 1) KLİNİK (Re minör, sinsi pizzicato)
room = filt(rng.standard_normal((2, N)), lo=900, hi=60) * 0.004
rt = tt(N); room *= np.clip(rt / 1.0, 0, 1) * (rt < SCR)
add(sfx, room, 0)
add(sfx, pip(1000, 0.2, 0.09), 0.15, pan=0.6); add(sfx, pip(1000, 0.2, 0.09), 0.45, pan=0.6)   # odyometre bip-bip
# klinik ped (steril, sinüs)
pn = int((SCR - 0.2) * SR); pt = tt(pn)
pad = (np.sin(2 * np.pi * midi(50) * pt) + 0.5 * np.sin(2 * np.pi * midi(57) * pt) + 0.3 * np.sin(2 * np.pi * midi(65) * pt + 1)) * envc(pt, [(0, 0), (1, 0.012), (SCR - 0.4, 0.016), (SCR - 0.2, 0)])
add(music, pad, 0.2)
pat = [50, None, 45, None, 50, 53, 52, None, 50, None, 45, 57, 55, None, 53, None]
for k in range(int((7.2 - 0.8) / (BEAT / 2))):
    nt = pat[k % len(pat)]
    if nt is None: continue
    at = 0.8 + k * BEAT / 2
    add(music, pluck(nt - 12, 0.5, 0.55), at, pan=-0.15); add(music, pluck(nt, 0.35, 0.22), at + 0.004, pan=0.2)
for k in range(int((7.2 - 0.8) / BEAT)):
    add(music, hat(0.25 if k % 2 else 0.15), 0.8 + k * BEAT + BEAT / 2, pan=0.35)
for c in T['cards']:
    add(sfx, thunk(0.55), c['a']); add(sfx, pip(2000, 0.09, 0.07), c['a'] + 0.02, pan=0.3)

# kart 1: kulaklıktan sızan cılız müzik (0.95–2.8), "kıs"ta kısılır
lk0, lk1 = 0.95, T['cards'][0]['b']; ln = int((lk1 - lk0) * SR); lt = tt(ln); leak = np.zeros(ln); lb = 60 / 128
for k in range(int((lk1 - lk0) / lb * 2)):
    i = int(k * lb / 2 * SR)
    if k % 2 == 0: s = kick(0.9)
    else: s = hat(1.0) * 3
    seg = s[: ln - i]; leak[i:i + len(seg)] += seg
    if k % 4 == 2: s = snare(0.9); seg = s[: ln - i]; leak[i:i + len(seg)] += seg
    s = pluck([38, 38, 45, 41][k // 2 % 4] + 24, 0.2, 0.6); seg = s[: ln - i]; leak[i:i + len(seg)] += seg
leak = filt(leak, lo=4500, hi=900) * 2.2 * envc(lk0 + lt, [(lk0, 0), (lk0 + 0.05, 1), (1.6, 1), (2.05, 0.1), (lk1 - 0.15, 0.1), (lk1, 0)])
add(sfx, np.tanh(leak * 2) * 0.25, lk0, pan=0.25)
add(sfx, slide(900, 260, 0.45, 0.07), 1.6, pan=-0.2)

# kart 2: konser (güç akoru + kalabalık) 3.05–4.8; tıkaç (3.6–4.1) = boğuklaşma
cn0, cn1 = 3.05, T['cards'][1]['b']; cn = int((cn1 - cn0) * SR); ct = tt(cn)
gtr = sum(saw(midi(nt), cn, det=d) for nt in (38, 45, 50) for d in (-8, 8))
gtr = np.tanh(gtr * 2.5) * 0.12
for k in range(int((cn1 - cn0) / (BEAT / 2))):
    i = int(k * BEAT / 2 * SR); s = kick(0.8) if k % 2 == 0 else snare(0.7); seg = s[: cn - i]; gtr[i:i + len(seg)] += seg * 0.6
ccrowd = filt(rng.standard_normal(cn), lo=3000, hi=300) * 0.12
con = gtr + ccrowd
mask = envc(cn0 + ct, [(3.6, 0), (4.1, 1)])
con_f = con * (1 - mask) + filt(con, lo=420, order=3) * mask * 0.7
con_f *= envc(cn0 + ct, [(cn0, 0), (cn0 + 0.03, 1), (cn1 - 0.2, 1), (cn1, 0)])
add(sfx, np.stack([con_f, np.roll(con_f, 300)]) * 0.9, cn0)
add(sfx, tick(600, 0.3), 3.6, pan=-0.4); add(sfx, tick(450, 0.3), 3.62, pan=0.4)   # tıkaç takılır

# kart 3: 85'e sürünen ton, hemen altında fren
c3 = T['cards'][2]; tn0, tn1 = 5.1, 6.2; tn = int((tn1 - tn0 + 0.3) * SR); tq = tt(tn)
fr = midi(57) * 2 ** (np.clip(tq / (tn1 - tn0), 0, 1) ** 1.3 * 5 / 12)
ton = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(fr) / SR)
add(music, ton * env(tn, 0.3, 0.12) * 0.035, tn0)
add(sfx, tick(2400, 0.35), 6.2); add(sfx, slide(700, 640, 0.25, 0.05), 6.55)

# "Kıs. / Biraz daha. / KIS DEDİM." — inen, giderek kısılan notalar
for (r, nt, g) in zip(T['rapid'], (62, 57, 50), (0.55, 0.32, 0.18)):
    add(music, pluck(nt, 0.4, g), r['a']); add(music, pluck(nt - 12, 0.4, g), r['a'])
    add(sfx, slide(midi(nt + 12), midi(nt), 0.18, 0.05 * g / 0.5), r['a'] + 0.05)

# ================================================================== 2) CIZIRTI → "Ama bugün…"
add(sfx, scratch(0.42, 0.5), SCR)
amaA = T['ama']['a']
pn2 = int((C0 - amaA) * SR); p2 = tt(pn2)
low = (np.sin(2 * np.pi * midi(38) * p2) + 0.4 * np.sin(2 * np.pi * midi(45) * p2)) * envc(p2, [(0, 0), (0.6, 0.03), (C0 - amaA - 0.25, 0.04), (C0 - amaA - 0.1, 0)])
add(music, low, amaA)
for i, d in enumerate(T['ama']['dots']): add(sfx, tick(1400 + 300 * i, 0.32), d, pan=-0.3 + 0.3 * i)
add(sfx, tick(900, 0.4), T['flip']); add(music, bell(86, 2.0, 0.35), T['flip'] + 0.02, pan=0.3)
add(music, riser(C0 - T['flip'] - 0.1, 0.35, 200, 1600), T['flip'])

# ================================================================== 3) YÜKSELİŞ (Re majör, 120 BPM)
steps = T['steps']
for k in range(int((M0 - C0) / BEAT)):
    at = C0 + k * BEAT; v = float(np.interp(at, [C0, M0], [0.55, 0.95]))
    add(music, kick(v), at)
    add(music, hat(0.3), at + BEAT / 2, pan=0.3)
# uzaktan yaklaşan trampet marşı (far_bus: alçak geçiren + yankı)
march = [0, 0.75, 1, 2, 2.5, 3, 3.25, 3.5]   # vuruş
for b in range(int((F - C0) / BAR) + 1):
    for m in march:
        at = C0 + b * BAR + m * BEAT
        if at < M0 + 3.6: add(far_bus, snare(0.5 + 0.1 * (m == 0)), at, pan=0.1)
# kalabalık: alçak başlar, her basamakta büyür
crowd_layer(C0, F + 1.0, 14, [(C0, 0.15), (steps[0]['t'], 0.4), (steps[1]['t'], 0.65), (steps[2]['t'], 1.0), (M0, 1.0), (F - 0.4, 0.75), (F, 0.4), (F + 1.0, 0)], 11)
crowd_layer(F + 0.2, DUR, 7, [(F + 0.2, 0.0), (F + 1.5, 0.35), (E, 0.3), (E + 1, 0.18), (DUR, 0.08)], 12)
for k in range(int((M0 - C0) / (BEAT / 2))):
    at = C0 + k * BEAT / 2; si = sum(at >= s['t'] for s in steps); nt = [38, 38, 43, 45][si]
    add(music, pluck(nt - 12 + 12 * (k % 2), 0.3, 0.5), at)
chords = [[62, 66, 69], [62, 67, 71], [62, 66, 69, 74]]
for i, s in enumerate(steps):
    add(music, crash(0.35 + 0.25 * i, 3.0), s['t'])
    brass([n + (12 if i == 2 else 0) - 12 for n in chords[i]] + [50], s['t'], 0.55 if i < 2 else 0.9, vol=0.05 + 0.012 * i, bright=1.0)
    add(music, timpani(38, 0.6 + 0.2 * i), s['t'])
strings([50, 57, 62, 66], C0, M0 - C0, vol=0.022, a=1.5, r=0.2, swell=[0.4, 0.7, 1.0])

# ================================================================== 4) DÖNÜŞÜM → BAYRAK
for at in np.arange(M0, F - 0.05, 0.07):
    add(music, timpani(38, float(np.interp(at, [M0, F], [0.08, 0.5]))) * 0.6, at)
strings([38, 50, 57, 62, 66, 69], M0, F - M0, vol=0.03, a=0.4, r=0.05, swell=[0.5, 0.7, 1.0, 1.4])
climb = [62, 64, 66, 67, 69, 71, 73, 74]
for i, nt in enumerate(climb):
    at = M0 + i * (F - M0) / len(climb)
    brass([nt - 12], at, (F - M0) / len(climb) * 0.95, vol=0.06 + 0.004 * i, a=0.04, r=0.12, bright=0.8)
add(music, riser(F - M0, 0.5, 150, 2000), M0)
add(music, crash(0.8, 1.6)[:, ::-1], F - 1.6)
# BAYRAK vuruşu
add(music, boom(1.3), F); add(music, crash(1.0, 4.5), F); add(music, timpani(38, 1.0), F); add(music, timpani(26, 0.8), F)
# tören teması (özgün): 3 ölçü, Re majör
prog = [(38, [62, 66, 69]), (43, [62, 67, 71]), (45, [61, 64, 69])]
for b, (root, tri) in enumerate(prog):
    at = F + b * BAR
    strings([root, root + 12] + tri, at, BAR, vol=0.026, a=0.05 if b == 0 else 0.2, r=0.3)
    brass([root + 12] + [n - 12 for n in tri], at, BAR * 0.5, vol=0.05, bright=1.0 if b == 0 else 0.6)
    for k in range(8): strings([root + 12 * (k % 2)], at + k * BEAT / 2, BEAT / 2 * 0.75, vol=0.032, a=0.015, r=0.05)
    for beat in (0, 2):
        if b == 0 and beat == 0: continue
        add(music, timpani(root - 12 if root > 40 else root, 0.7), at + beat * BEAT)
    for m in march: add(music, snare(0.32 + 0.12 * (m == 0)), at + m * BEAT, pan=0.15)
    if b: add(music, crash(0.2, 2.5), at)
melody = [(0, 69, 1), (1, 74, 1), (2, 78, 2), (4, 79, 1), (5, 76, 1), (6, 81, 2), (8, 78, 1), (9, 74, 1), (10, 76, 1), (11, 73, 1)]
for beat, nt, d in melody:
    brass([nt - 12], F + beat * BEAT, d * BEAT * 0.95, vol=0.07, a=0.05, r=0.2, bright=0.75)
    strings([nt], F + beat * BEAT, d * BEAT * 0.95, vol=0.026, a=0.06, r=0.2)
for at in np.arange(F + 2 * BAR + 2 * BEAT, E - 0.02, 0.07):
    add(music, timpani(33, float(np.interp(at, [F + 2 * BAR + 2 * BEAT, E], [0.06, 0.35]))) * 0.6, at)

# ================================================================== 5) SON KART: Re majör, bip → çan
add(music, boom(0.6, 3.0), E); add(music, crash(0.55, 5), E); add(music, timpani(38, 0.7), E)
tail = DUR - E
strings([26, 38, 50, 57, 62, 66, 69, 74], E, tail - 1.2, vol=0.026, a=0.05, r=1.4)
brass([38, 50, 57, 62, 66], E, 1.6, vol=0.05, r=1.0, bright=0.9)
for i, nt in enumerate([74, 78, 81, 86]): add(music, bell(nt, 3.0, 0.32), E + 1.0 + i * 0.5, pan=-0.3 + 0.2 * i)
add(sfx, pip(1000, 0.2, 0.06), DUR - 1.25, pan=0.6); add(sfx, pip(1000, 0.2, 0.06), DUR - 0.95, pan=0.6)   # odyometre bip-bip: başa dönüş

# ------------------------------------------------------------------ karışım
def reverb(x, rt60=2.2, wet=0.2, lo=5000):
    n = int(rt60 * SR); t = tt(n); y = np.zeros_like(x)
    for c in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.91 * t / rt60); ir = filt(ir, lo=lo); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        Lf = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        y[c] = np.fft.irfft(np.fft.rfft(x[c], Lf) * np.fft.rfft(ir, Lf), Lf)[: x.shape[1]]
    return x + wet * y


# uzak marş: boğuk, yankılı; dönüşümde yaklaşır (süzgeç açılır)
far_d = reverb(filt(far_bus, lo=900), 2.8, 0.6, lo=2500); far_n = reverb(far_bus, 1.5, 0.2)
near = envc(rt, [(C0, 0), (M0, 0.3), (F, 1)])
far_mix = far_d * (1 - near) * 0.8 + far_n * near * 0.55
crowd_mix = reverb(crowd_bus, 1.8, 0.3)
mix = reverb(music + 0.8 * sfx, 2.0, 0.18) + far_mix + 0.9 * crowd_mix
# cızırtıdan sonra tam sessizlik (oda tonu hariç)
s0 = int((SCR + 0.42) * SR); s1 = int((T['ama']['a']) * SR); mix[:, s0:s1] *= 0.15
mix[:, int(DUR * SR):] = 0
mix = filt(mix, hi=28, lo=16000)
mix = mix[:, : int(DUR * SR)]
mix /= np.max(np.abs(mix)) / 0.9
raw = os.path.join(OUT, 'ses-ham.wav')
with wave.open(raw, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype('<i2').tobytes())
print('ham ses:', raw)


def sh(c): subprocess.run(c, check=True)


def measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    s = r.stderr; j = json.loads(s[s.rindex('{'):s.rindex('}') + 1]); return float(j['input_i']), float(j['input_tp'])


LIMIT = 0.72
chain = lambda g: f'volume={g:.2f}dB,alimiter=limit={LIMIT}:attack=3:release=120:level=0'
gain = -14.0 - measure(raw)[0]
for _ in range(2):
    tmp = os.path.join(OUT, 'ses-dene.wav'); sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', chain(gain), tmp]); gain += -14.0 - measure(tmp)[0]
final_wav = os.path.join(OUT, 'ses.wav')
sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', f'{chain(gain)},afade=t=out:st={DUR - 0.5:.2f}:d=0.5', '-ar', '48000', final_wav])
print('ses: I=%.2f LUFS, TP=%.2f dBTP' % measure(final_wav))
if '--no-mux' in sys.argv: sys.exit(0)
dst = os.path.join(ROOT, 'marketing', 'reels', f'{SLUG}.mp4')
sh(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(OUT, 'video.mp4'), '-i', final_wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', dst])
shutil.copy(os.path.join(OUT, 'kapak.png'), os.path.join(ROOT, 'marketing', 'reels', f'{SLUG}-kapak.png'))
print('tamam:', dst)
