#!/usr/bin/env python3
"""29 Ekim Reels "Bir sesin içinde ne saklıdır?" (29-ekim-spektrogram): spektrogram sanatı + özgün tören müziği (numpy; kayıt/marş YOK).

Fikir: Resmî bayrak geometrisinden (Türk Bayrağı Kanunu oranları; ay ve yıldız) bir maske çıkarılır. Maske zaman–frekans düzlemine
yerleştirilir (yatay: zaman, 8 sn = bayrak boyu 1,5 G; dikey: LOGARİTMİK frekans, 250–8000 Hz = bayrak eni G = tam 5 oktav, odyogram
aralığı). Beyaz bölgeler (ay ve yıldız) enerjiye dönüşür:
  1) ters STFT (2048 nokta Hann, 256 adım, rastgele faz): maske büyüklüğü × pembe eğim (oktav başına eşit enerji) → yumuşak hışırtı;
  2) maskenin satırlarında Fa majör pentatonik sinüsler (F5…G7) → hışırtının içinde cam gibi bir akor.
Görüntü olarak kullanılan spektrogram bu sesin GERÇEK STFT'sidir (2048 nokta Hann, sütun başına 1/116,25 sn; dB, oktav başına +3 dB ön
vurgu, Praat'taki gibi; 52 dB dinamik aralık) → spek.png. Hiçbir piksel elle çizilmez; eşik, maskeyle örtüşmeyi en büyükleyen değerdir.
Bağlam sesleri de sentezdir: kadın sesiyle "aaa→iii" ünlüsü (kaynak-süzgeç; formantlar Peterson & Barney 1952 kadın ortalamaları)
ve kuş cıvıltısı (FM çırpıntılar).
Müzik: 15,5. sn'ye kadar yalnız 250 Hz altında (spektrogram aralığının dışında) alçak bir Fa pedalı; ardından kreşendo, bayrakta Fa majör
tören vuruşu, 72 BPM'de üç ölçü F–B♭–C, son Fa. Ses yüksekliği −14 LUFS, gerçek tepe ≤ −1 dBTP.

Kullanım (kökten):
  python3 tools/reels/29-ekim-spektrogram.py          → zaman.json, spek.png, ses.wav (tools/harness/out/29-ekim-spektrogram/)
  node tools/reels/29-ekim-spektrogram.mjs --video     → video.mp4 (sessiz) + kapak.png
  python3 tools/reels/29-ekim-spektrogram.py --mux    → marketing/reels/29-ekim-spektrogram.mp4 (+ kapak)
"""
import json, os, shutil, subprocess, sys, wave
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
AD = '29-ekim-spektrogram'
OUT = os.path.join(ROOT, 'tools', 'harness', 'out', AD)
os.makedirs(OUT, exist_ok=True)
SR = 48000
rng = np.random.default_rng(1923)

# ------------------------------------------------------------------ zaman çizelgesi (görüntü de bunu okur)
PX, PY, PW, PH = 75, 470, 930, 620          # spektrogram paneli = bayrak çerçevesi (3:2)
FD = 8.0                                    # bayrak boyu (1500 birim) = 8 sn
V = PW / FD                                 # kayma hızı: 116,25 px/sn (1 sütun = 1 piksel)
F_LO, OCT = 250.0, 5                        # 250 Hz … 8000 Hz (bayrak eni = 5 oktav)
BPM = 72; BEAT = 60 / BPM; BAR = 4 * BEAT
T = dict(dur=33.0, hook0=0.45, s0=5.0, vowel=[5.45, 7.85], birds=[8.15, 9.75], tf=10.6, fd=FD, v=V,
         panel=[PX, PY, PW, PH], flo=F_LO, oct=OCT, bpm=BPM)
T['ta'] = T['tf'] + FD                      # bayrak çerçevesi tam oturur (18,6 sn) → kesin bayrak
T['shape'] = [T['tf'] + 250 / 1500 * FD, T['tf'] + 921.93 / 1500 * FD]   # ayın sol ucu … yıldızın sağ ucu
T['hook_len'] = 3.85; T['hook_src'] = T['tf'] + 1.2                         # kancada çalan parça (aynı örnekler)
T['shift'] = [T['shape'][1] + 0.1, T['ta'] - 0.15]                         # ısı haritası → kırmızı-beyaz
T['end'] = T['ta'] + 3 * BAR                                               # 28,6: bitiş kartı
TF, TA, DUR = T['tf'], T['ta'], T['dur']
N = int(SR * DUR) + SR

# ------------------------------------------------------------------ çalgılar (ekim29b_ses.py ile aynı sentez)
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)


def tt(n): return np.arange(n) / SR


def env(n, a=0.01, r=0.2, hold=None):
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
    X = np.fft.rfft(x, axis=-1); f = np.fft.rfftfreq(x.shape[-1], 1 / SR); H = np.ones_like(f)
    if lo: H *= 1 / np.sqrt(1 + (f / lo) ** (2 * order))
    if hi: H *= 1 / np.sqrt(1 + (np.maximum(f, 1e-3) / hi) ** (-2 * order))
    return np.fft.irfft(X * H, n=x.shape[-1], axis=-1)


def saw(f, n, det=0.0, vib=0.0, vib_rate=5.2, ph=0.0):
    t = tt(n); fr = f * 2 ** (det / 1200) * (1 + vib * np.sin(2 * np.pi * vib_rate * t + ph) * np.clip(t / 0.6, 0, 1))
    p = (np.cumsum(fr) / SR + ph / (2 * np.pi)) % 1.0
    return 2 * p - 1


# ------------------------------------------------------------------ çalgılar
def piano(note, dur=3.0, vel=0.5):
    n = int(dur * SR); t = tt(n); f = midi(note); s = np.zeros(n); B = 0.00035
    for k in range(1, 9):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 12000: break
        s += (1 / k ** 1.25) * np.sin(2 * np.pi * fk * t + k) * np.exp(-t * (0.55 + 0.38 * k) * (1 + (note - 60) / 60))
    ham = filt(rng.standard_normal(n) * np.exp(-t * 180), lo=2500) * 0.25
    return vel * 0.22 * (s + ham) * env(n, 0.003, 0.3)


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
        if swell is not None: e *= np.interp(tt(n), [0, dur], swell)
        add(strings_bus if bus is None else bus, v * e * vol, at, pan=np.clip((nt - 60) / 30, -0.6, 0.6))


def brass(notes, at, dur, vol=0.06, a=0.07, r=0.5, bright=1.0):
    n = int((dur + r) * SR); t = tt(n)
    for i, nt in enumerate(notes):
        f = midi(nt); v = sum(saw(f, n, det=d, vib=0.0035, vib_rate=5.0, ph=rng.random() * 6.28) for d in (-5, 0, 6))
        dark, br = filt(v, lo=min(700, f * 5)), filt(v, lo=min(3200, f * 14))
        b = bright * (np.exp(-t / 0.35) * 0.7 + 0.3)  # "blat": parlak başlar, yumuşar
        s = dark * (1 - b) + br * b
        add(music, np.tanh(s * 0.9) * env(n, a, r) * vol, at, pan=np.clip((nt - 57) / 36, -0.5, 0.5))


def timpani(note, vel=0.8):
    n = int(2.2 * SR); t = tt(n); f = midi(note) * (1 + 0.025 * np.exp(-t * 8))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 2.2) + 0.5 * np.sin(1.5 * ph) * np.exp(-t * 3.5) + 0.3 * np.sin(1.98 * ph) * np.exp(-t * 4.5) + 0.15 * np.sin(2.44 * ph) * np.exp(-t * 6)
    mallet = filt(rng.standard_normal(n) * np.exp(-t * 60), lo=1200, hi=60) * 0.8
    return vel * 0.5 * np.tanh((s + mallet) * 1.2) * env(n, 0.002, 0.3)


def boom(vel=1.0, dur=2.4):
    n = int(dur * SR); t = tt(n); f = 32 + 40 * np.exp(-t * 7)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += 0.35 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 4)  # telefon hoparlöründe de duyulsun
    return vel * 0.9 * np.tanh(s * 1.6) * env(n, 0.002, 0.4)


def crash(vel=0.5, dur=4.0):
    n = int(dur * SR); t = tt(n); w = rng.standard_normal((2, n))
    s = filt(w, lo=11000, hi=3000) * np.exp(-t * 1.7) + 0.4 * filt(w, lo=8000, hi=5000) * np.exp(-t * 3.5)
    return vel * 0.05 * s * env(n, 0.003, 0.6)


def riser(dur, vel=0.4, f0=180, f1=1400):
    n = int(dur * SR); t = tt(n); k = (t / dur) ** 2
    w = rng.standard_normal((2, n)); s = filt(w, hi=700, lo=5000) * k * 0.1
    s += 0.06 * np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / dur)) / SR) * k
    return vel * s * env(n, 0.01, 0.02)



def shimmer(notes, at, dur, vol=0.03):
    n = int(dur * SR); t = tt(n)
    for i, nt in enumerate(notes):
        f = midi(nt); a = 0.25 + 0.15 * i
        s = np.sin(2 * np.pi * f * t + i) * (0.8 + 0.2 * np.sin(2 * np.pi * (3 + i * 0.7) * t))
        add(music, s * env(n, a, dur * 0.6) * vol, at + i * 0.07, pan=(-1) ** i * 0.5)



def reverb(x, rt60=2.6, wet=0.22):
    n = int(rt60 * SR); t = tt(n); y = np.zeros_like(x)
    for c in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.91 * t / rt60); ir = filt(ir, lo=5000); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        L = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        y[c] = np.fft.irfft(np.fft.rfft(x[c], L) * np.fft.rfft(ir, L), L)[: x.shape[1]]
    return x + wet * y



music = np.zeros((2, N)); strings_bus = np.zeros((2, N)); spek = np.zeros(N)


# ------------------------------------------------------------------ 1) resmî bayrak maskesi (1500 × 1000 birim; bayrak.svg ile aynı)
STAR = np.array([(695.80, 500.00), (782.17, 471.94), (782.17, 381.12), (835.55, 454.59), (921.93, 426.53), (868.55, 500.00),
                 (921.93, 573.47), (835.55, 545.41), (782.17, 618.88), (782.17, 528.06)])


def in_poly(x, y, P):
    ins = np.zeros(x.shape, bool)
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[(i + 1) % len(P)]
        ins ^= ((y1 > y) != (y2 > y)) & (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1)
    return ins


def flag_mask(nu=1500, nw=1000):
    u = (np.arange(nu) + 0.5) * 1500 / nu; w = (np.arange(nw) + 0.5) * 1000 / nw
    uu, ww = np.meshgrid(u, w)
    white = (((uu - 500) ** 2 + (ww - 500) ** 2 <= 250 ** 2) & ~((uu - 562.5) ** 2 + (ww - 500) ** 2 <= 200 ** 2)) | in_poly(uu, ww, STAR)
    return white.astype(float)


MASK = flag_mask()
k = np.exp(-0.5 * (np.arange(-10, 11) / 3.0) ** 2); k /= k.sum()          # yumuşak kenar (σ = 3 birim ≈ 16 ms / 0,03 oktav)
MS = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 1, MASK)
MS = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 0, MS)


def samp(M, u, w):
    """maske değeri: u ∈ [0,1500] (zaman), w ∈ [0,1000] (yukarıdan aşağı)"""
    x = np.clip(u - 0.5, 0, 1499 - 1e-6); y = np.clip(w - 0.5, 0, 999 - 1e-6)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = x - x0; fy = y - y0
    v = (M[y0, x0] * (1 - fx) * (1 - fy) + M[y0, x0 + 1] * fx * (1 - fy) + M[y0 + 1, x0] * (1 - fx) * fy + M[y0 + 1, x0 + 1] * fx * fy)
    out = (u >= 0) & (u <= 1500) & (w >= 0) & (w <= 1000)
    return v * out


w_of_f = lambda f: 1000 * (1 - np.log2(np.maximum(f, 1) / F_LO) / OCT)
NS, HS = 2048, 256
HANN = np.hanning(NS + 1)[:NS]


# ------------------------------------------------------------------ 2) bayrak sesi: ters STFT (hışırtı) + pentatonik sinüsler
def flag_noise():
    L = int(FD * SR) + NS; nfr = (L - NS) // HS + 1
    f = np.fft.rfftfreq(NS, 1 / SR)
    U = (np.arange(nfr) * HS / SR) / FD * 1500
    mag = samp(MS, U[:, None], w_of_f(f)[None, :]) * np.where(f > 150, (np.maximum(f, 1) / 1000) ** -0.5, 0)
    X = mag * np.exp(2j * np.pi * rng.random(mag.shape))
    fr = np.fft.irfft(X, n=NS, axis=1) * HANN
    y = np.zeros(L); norm = np.zeros(L)
    for m in range(nfr):
        y[m * HS:m * HS + NS] += fr[m]; norm[m * HS:m * HS + NS] += HANN ** 2
    return y / np.maximum(norm, norm.max() * 0.1)           # örnek 0 = TF − NS/2


PENTA = [77, 79, 81, 84, 86, 89, 91, 93, 96, 98, 101, 103]   # F5 … G7 (Fa majör pentatonik), hepsi ayın/yıldızın frekans aralığında


def midi(n): return 440.0 * 2 ** ((n - 69) / 12)


def flag_tones():
    L = int(FD * SR); t = np.arange(L) / SR; y = np.zeros(L)
    tc = np.arange(0, FD, 0.004); sm = np.ones(8) / 8
    for i, n in enumerate(PENTA):
        f = midi(n); e = np.convolve(samp(MS, tc / FD * 1500, np.full_like(tc, w_of_f(f))), sm, 'same')
        y += np.interp(t, tc, e) * (f / 1000) ** -0.5 * np.sin(2 * np.pi * f * t + rng.random() * 6.28)
    return y                                                  # örnek 0 = TF


# ------------------------------------------------------------------ 3) bağlam sesleri: ünlü "aaa→iii" ve kuş
def vowel(dur=2.4):
    n = int(dur * SR); t = np.arange(n) / SR
    glide = np.interp(t, [0, 1.05, 1.45, dur], [0, 0, 1, 1]); glide = glide * glide * (3 - 2 * glide)
    f0 = midi(57) * 2 ** (3 / 12 * glide) * (1 + 0.013 * np.sin(2 * np.pi * 5.3 * t) * np.clip((t - 0.25) / 0.5, 0, 1))
    FA = [(850, 90), (1220, 100), (2810, 140), (3800, 200)]; FI = [(310, 60), (2790, 120), (3310, 140), (4200, 200)]   # kadın /a/, /i/
    F = [(fa + (fi - fa) * glide, ba + (bi - ba) * glide) for (fa, ba), (fi, bi) in zip(FA, FI)]
    ph = 2 * np.pi * np.cumsum(f0) / SR; y = np.zeros(n)
    for h in range(1, int(9000 / midi(57)) + 1):
        fh = h * f0; H = np.ones(n)
        for Fc, B in F: H /= np.sqrt((1 - (fh / Fc) ** 2) ** 2 + (fh * B / Fc ** 2) ** 2)
        y += (1 / h) * H * np.sin(h * ph) * (fh < 9000)
    e = np.interp(t, [0, 0.14, dur - 0.35, dur], [0, 1, 0.9, 0]) ** 1.3
    return y * e


def chirp(dur, f1, f2):
    n = int(dur * SR); t = np.arange(n) / SR; f = f1 * (f2 / f1) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 2


def birds():
    y = np.zeros(int(1.6 * SR))
    ev = [(0.00, .075, 3000, 4700), (0.15, .075, 3000, 4800), (0.42, .13, 5200, 2900), (0.70, .06, 3600, 4400), (0.79, .06, 3600, 4400)]
    ev += [(0.98 + i * 0.058, .042, 4300, 3500) for i in range(8)]
    for at, d, a, b in ev:
        c = chirp(d, a, b); i = int(at * SR); y[i:i + len(c)] += c
    return y


# ------------------------------------------------------------------ 4) ölçüm: ekrandaki spektrogramın tanımıyla aynı STFT
def stft_cols(x, times):
    idx = np.round(np.asarray(times) * SR).astype(int)
    fr = np.stack([x[i - NS // 2:i + NS // 2] for i in idx]) * HANN
    return np.abs(np.fft.rfft(fr, axis=1)) ** 2              # güç


FB = np.fft.rfftfreq(NS, 1 / SR)
ROWF = F_LO * 2 ** (OCT * (PH - 0.5 - np.arange(PH)) / PH)   # panel satırlarının frekansı (0 = üst = 8 kHz)


def to_rows(P):
    """güç (sütun × kutu) → dB, +3 dB/oktav ön vurgu (1 kHz'e göre), log frekans satırları (satır × sütun)"""
    pb = np.fft.rfftfreq(NS, 1 / SR); fi = ROWF / (SR / NS)
    i0 = np.floor(fi).astype(int); a = fi - i0
    rows = P[:, i0] * (1 - a) + P[:, i0 + 1] * a
    return (10 * np.log10(rows + 1e-20) + 10 * np.log10(ROWF / 1000)).T


def db_at(x, t0, t1, fsel):
    tc = np.arange(t0, t1, 0.01); return to_rows(stft_cols(x, tc))[fsel]


# --- bileşenler, düzey ayarı (ekrandaki dB'ye göre)
fn = flag_noise(); ft = flag_tones()
i0 = int(round((TF - NS / 2 / SR) * SR)); noise_full = np.zeros(N); noise_full[i0:i0 + len(fn)] = fn
tones_full = np.zeros(N); j0 = int(round(TF * SR)); tones_full[j0:j0 + len(ft)] = ft
# ölçüm bölgesi: ayın gövdesi (u = 280…330, w = 560…640 → 1 kHz civarı)
t_body = (TF + 280 / 1500 * FD, TF + 330 / 1500 * FD)
fsel = (w_of_f(ROWF) > 560) & (w_of_f(ROWF) < 640)
L_noise = np.median(db_at(noise_full, *t_body, fsel))
tone_row = np.argmin(np.abs(ROWF - midi(84)))                # C6 ≈ 1047 Hz
L_tone = np.max(to_rows(stft_cols(tones_full, np.arange(*t_body, 0.01)))[tone_row])
g_t = 10 ** ((L_noise + 5 - L_tone) / 20)                    # sinüsler hışırtının ~5 dB üstünde
flag_sig = noise_full + g_t * tones_full
L_flag = np.median(db_at(flag_sig, *t_body, fsel))

vw = vowel(); vw_full = np.zeros(N); a = int(T['vowel'][0] * SR); vw_full[a:a + len(vw)] = vw
L_v = np.percentile(db_at(vw_full, T['vowel'][0] + 0.3, T['vowel'][1] - 0.4, slice(None)), 99.5)
vw_full *= 10 ** ((L_flag + 8 - L_v) / 20)
bd = birds(); bd_full = np.zeros(N); a = int(T['birds'][0] * SR); bd_full[a:a + len(bd)] = bd
L_b = np.percentile(db_at(bd_full, T['birds'][0], T['birds'][0] + 1.6, slice(None)), 99.7)
bd_full *= 10 ** ((L_flag + 6 - L_b) / 20)
# gürültü tabanı: pembe, 150 Hz–9 kHz, bayrak hışırtısının 34 dB altında; analizle başlar, bayrak oturunca söner
wn = np.fft.rfft(rng.standard_normal(N)); ff = np.fft.rfftfreq(N, 1 / SR)
floor = np.fft.irfft(wn * np.where((ff > 150) & (ff < 9000), (np.maximum(ff, 1) / 1000) ** -0.5, 0), n=N)
tN = np.arange(N) / SR
floor *= np.interp(tN, [T['s0'] - 0.4, T['s0'] + 0.3, TA, TA + 1.6], [0, 1, 1, 0])
L_fl = np.median(db_at(floor, T['s0'] + 1, TF, fsel))
floor *= 10 ** ((L_flag - 34 - L_fl) / 20)

spek = flag_sig + vw_full + bd_full + floor
# kanca: bayrak sesinin aynı örnekleri, analiz başlamadan önce (0,45 sn)
hs = int(T['hook_src'] * SR); hl = int(T['hook_len'] * SR); hd = int(T['hook0'] * SR)
hook = spek[hs:hs + hl] - floor[hs:hs + hl]
hook = hook * np.interp(np.arange(hl), [0, 0.02 * SR, hl - 0.25 * SR, hl], [0, 1, 1, 0])
spek[hd:hd + hl] += hook

# ------------------------------------------------------------------ 5) GERÇEK spektrogram → spek.png
NJ = int(np.ceil((TA + 0.3 - T['s0']) * V)) + 1
tj = T['s0'] + np.arange(NJ) / V
D = to_rows(stft_cols(spek, tj))                              # (PH × NJ) dB
jA = int(round((TF - T['s0']) * V))                           # bayrak çerçevesinin ilk sütunu
body = D[:, jA:jA + PW]
mres = flag_mask(PW, PH) > 0.5                                # çerçevenin piksel maskesi (satır 0 = 8 kHz = bayrağın üst kenarı)
REF = np.percentile(body[mres], 97); DR = 52.0
VAL = np.clip((D - REF) / DR + 0.92, 0, 1)
Image.fromarray(np.round(VAL * 255).astype(np.uint8)).save(os.path.join(OUT, 'spek.png'))
vb = VAL[:, jA:jA + PW]
best = max(((np.sum((vb > th) & mres) / np.sum((vb > th) | mres), th) for th in np.arange(0.3, 0.9, 0.01)))
T['th'] = round(float(best[1]), 3); T['iou'] = round(float(best[0]), 4); T['nj'] = NJ
print(f'spektrogram: {NJ}×{PH}, eşik {best[1]:.2f}, maske örtüşmesi (IoU) {best[0]:.3f}; bayrak hışırtı {L_noise:.1f} dB, sinüs +5 dB')
# kanca dalga biçimi (gerçek örnekler; piksel başına tepe)
seg = np.abs(hook); wf = [float(np.max(c)) for c in np.array_split(seg, PW)]
T['wave'] = [round(v / max(wf), 3) for v in wf]
json.dump(T, open(os.path.join(OUT, 'zaman.json'), 'w'))


# ------------------------------------------------------------------ 6) müzik (özgün; Fa majör)
# a) 0 … 18,35 sn: yalnız 250 Hz altında Fa pedalı (spektrogram 250–8000 Hz'i gösterir; müzik görüntüye karışmaz)
CUT = TA - 0.25
pad = np.zeros(N)
for f, g, r in ((midi(29), 0.5, 0.07), (midi(41), 0.8, 0.11), (midi(48), 0.35, 0.05), (midi(53), 0.22, 0.09)):
    pad += g * np.sin(2 * np.pi * f * tN + rng.random() * 6) * (1 + 0.25 * np.sin(2 * np.pi * r * tN))
pad *= np.interp(tN, [0.1, 2.5, 10, T['shape'][1], CUT - 0.05, CUT], [0, 0.5, 0.6, 0.85, 1.3, 0]) * 0.05
pad = filt(pad, lo=200, order=4)
music += pad
# b) yükseliş: bayrak sesi bitince (15,5) yaylılar Csus4, timpani tremolosu, süpürme; 18,35'te 0,25 sn tam sessizlik
s1 = T['shape'][1] + 0.05
strings([36, 48, 55, 60, 65, 67, 72], s1, CUT - s1, vol=0.03, a=1.6, r=0.05, swell=[0.35, 1.0])
strings([79, 84], s1 + 1.2, CUT - s1 - 1.2, vol=0.016, a=1.0, r=0.05, swell=[0.4, 1.0])
for at in np.arange(s1 + 1.0, CUT - 0.03, 0.075):
    add(music, timpani(36, float(np.interp(at, [s1 + 1.0, CUT], [0.03, 0.3]))) * 0.7, at)
add(music, riser(CUT - s1, 0.45, 220, 1800), s1)
ci = int(CUT * SR); fz = int(0.012 * SR)
for bus in (music, strings_bus):
    bus[:, ci:ci + fz] *= np.linspace(1, 0, fz); bus[:, ci + fz:int(TA * SR) - 10] = 0
# c) BAYRAK (18,6): büyük vuruş + pentatonik parıltı (bayrak sesinin notaları), 72 BPM üç ölçü: F – B♭ – C, sonra Fa
add(music, boom(1.35), TA); add(music, crash(1.0), TA); add(music, timpani(41, 1.0), TA); add(music, timpani(29, 0.8), TA)
shimmer([89, 93, 96, 101], TA + 0.02, 4.0, vol=0.016)
chords = [(41, [53, 57, 60, 65, 69, 72]), (34, [50, 53, 58, 62, 65, 70]), (36, [52, 55, 60, 64, 67, 72])]
for b, (root, tri) in enumerate(chords):
    at = TA + b * BAR
    strings([root, root + 12] + tri, at, BAR, vol=0.03 + 0.005 * b, a=0.05 if b == 0 else 0.25, r=0.3)
    brass([root + 12, tri[0], tri[1], tri[2]], at, BAR * 0.5, vol=0.05 + 0.006 * b, bright=1.0 if b == 0 else 0.6)
    for kk in range(8):
        strings([root + 12 * (kk % 2)], at + kk * BEAT / 2, BEAT / 2 * 0.75, vol=0.04, a=0.015, r=0.05)
    for bt in (0, 2):
        if b == 0 and bt == 0: continue
        add(music, timpani(root - 12 if root > 40 else root, 0.75), at + bt * BEAT)
        add(music, timpani(root - 12 if root > 40 else root, 0.42), at + bt * BEAT + 0.27)
    if b: add(music, crash(0.18, 3), at)
brass([60, 65, 67], TA + 2 * BAR, 2 * BEAT, vol=0.06, bright=0.8)          # Csus4 → C
horn = [(0, 65, 2), (2, 69, 1), (3, 72, 1), (4, 74, 1.5), (5.5, 72, 0.5), (6, 70, 1), (7, 74, 1), (8, 72, 2), (10, 67, 1), (11, 70, 1)]
for bt, nt, d in horn:
    brass([nt - 12], TA + bt * BEAT, d * BEAT * 0.95, vol=0.075, a=0.06, r=0.25, bright=0.7)
    strings([nt], TA + bt * BEAT, d * BEAT * 0.95, vol=0.03, a=0.08, r=0.2)
END = T['end']
for at in np.arange(TA + 2 * BAR + 2 * BEAT, END - 0.02, 0.07):
    add(music, timpani(36, float(np.interp(at, [TA + 2 * BAR + 2 * BEAT, END], [0.08, 0.5]))) * 0.6, at)
add(music, crash(0.8, 1.6)[:, ::-1], END - 1.6); add(music, riser(2.0, 0.4), END - 2.0)
# d) son: büyük Fa; sonra bayrak sesinin pentatonik notaları piyanoda (F6 – C6 – A5 – F5)
add(music, boom(0.9, 3.0), END); add(music, crash(0.8, 5), END); add(music, timpani(41, 0.9), END); add(music, timpani(29, 0.7), END)
strings([29, 41, 53, 57, 60, 65, 69, 72, 77], END, DUR - END - 1.0, vol=0.032, a=0.05, r=1.6)
brass([41, 53, 57, 60, 65], END, 2.6, vol=0.06, r=1.2, bright=1.0); brass([65], END, 2.8, vol=0.07, r=1.2, bright=0.8)
for at, nt, v in [(END + 1.9, 89, .28), (END + 2.3, 84, .26), (END + 2.7, 81, .26), (END + 3.1, 77, .3), (END + 3.15, 65, .2)]:
    add(music, piano(nt, 3.0, v), at, pan=0.15)
shimmer([89, 93, 96], END + 0.1, 4.0, vol=0.01)

# ------------------------------------------------------------------ 7) karışım: bayrak sesi kuru (analiz edilen örneklerin aynısı), müzik salonda
mus = reverb(music + strings_bus)
mus[:, int(DUR * SR):] = 0
seg_rms = lambda x, a, b: np.sqrt(np.mean(x[..., int(a * SR):int(b * SR)] ** 2))
r_mus = seg_rms(mus, TA + 0.5, END); r_flag = seg_rms(spek, T['shape'][0] + 0.3, T['shape'][1] - 0.3)
g_spek = r_mus / r_flag * 10 ** (-9 / 20)                    # bayrak sesi, tören müziğinden ~9 dB alçak (yumuşak, asla tiz/sert değil)
mix = mus + g_spek * np.stack([spek, spek])
mix = filt(mix, hi=28, lo=16000)[:, :int(DUR * SR)]
mix /= np.max(np.abs(mix)) / 0.9
raw = os.path.join(OUT, 'ses-ham.wav')
with wave.open(raw, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype('<i2').tobytes())


def sh(c): subprocess.run(c, check=True)


def measure(path, extra=()):
    r = subprocess.run(['ffmpeg', '-hide_banner', *extra, '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    s = r.stderr; j = json.loads(s[s.rindex('{'):s.rindex('}') + 1]); return float(j['input_i']), float(j['input_tp'])


LIMIT = 0.75
chain = lambda g: f'volume={g:.2f}dB,alimiter=limit={LIMIT}:attack=3:release=120:level=0'
gain = -14.0 - measure(raw)[0]
for _ in range(2):
    tmp = os.path.join(OUT, 'ses-dene.wav'); sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', chain(gain), tmp]); gain += -14.0 - measure(tmp)[0]
final_wav = os.path.join(OUT, 'ses.wav')
sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', f'{chain(gain)},afade=t=out:st={DUR - 0.6:.2f}:d=0.6', '-ar', '48000', final_wav])
print('ses: I=%.2f LUFS, TP=%.2f dBTP' % measure(final_wav))
for nm, a, b in (('kanca (bayrak sesi)', 0.5, 4.2), ('ünlü + kuş', 5.5, 9.7), ('bayrak sesi + spektrogram', T['shape'][0], T['shape'][1]), ('tören müziği', TA, END)):
    print(f'  {nm:28s} {a:5.1f}–{b:5.1f} sn: {measure(final_wav, ("-ss", f"{a}", "-t", f"{b - a}"))[0]:6.1f} LUFS')
if '--mux' in sys.argv:
    dst = os.path.join(ROOT, 'marketing', 'reels', f'{AD}.mp4')
    sh(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(OUT, 'video.mp4'), '-i', final_wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', dst])
    shutil.copy(os.path.join(OUT, 'kapak.png'), os.path.join(ROOT, 'marketing', 'reels', f'{AD}-kapak.png'))
    print('✅', dst)
