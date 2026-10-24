#!/usr/bin/env python3
"""ODİ reklam Reels'leri için ses tasarımı: özgün müzik (bölümlü, vuruş ızgarasında) + ses efektleri. Tamamen sentez (numpy);
örnek/sample, hazır ses paketi ya da telifli müzik YOK.

Kullanım (compose.py --reel çağırır; elle denemek için):
  python3 tools/reels/reklam_ses.py <çıktı.wav> <stil> <bpm> <saniye> [bölümler.json]   → yalnız müzik
  python3 tools/reels/reklam_ses.py --sfx <çıktı.wav> <tür> [tür ...]                      → efekt kataloğu dinleme

Müzik stilleri ve bölüm türleri (sahnelerin `mus` alanı; bölüm o sahnenin başından bir sonraki `mus`'a dek sürer):
  fragman (sinema fragmanı, Re minör): off · drone · pulse · build · full · hit · cute · end
  komedi  (oyunbaz, Fa majör, tuba + pizzicato): off · bouncy · bright · tension · boss · end
  panik   (sınav gecesi; gergin 16'lıklar → neşeli groove): off · tick · panic · groove · end
  spor    (stadyum marşı, Mi minör): off · drums · count · drop · break · end
  kur     (kamp büyümesi, Re majör): off · intro · grow · lift · wide · end
  detay   (fark ettin mi, La minör/Do majör): off · soft · full · end
  gizem   (vaka saati, La minör gerilim): off · tick · pulse · rise · hit · end
  yarisma (eğri yarışması, Si bemol majör): off · fanfar · think · reveal · end
  sessiz  (kulaklık; ton anlarında 'off'): off · amb · pulse · end
Efektler (sfx): boom, braam, hit, taiko, whoosh, swish, riser, reverse, downer, subdrop, heartbeat, tick, tock, scratch, boing,
  squish, cricket, pop, ding, buzzer, whistle, crowd, cheer, horn, beep, glitch, snap, stamp, paper, gulp, sparkle, thud,
  chime (n), lens, tone (f; Ton Avı tonu — ayrı, sınırlı düzeyli izde karışır), flash, drumroll, type
"""
import json, sys, wave
import numpy as np

SR = 44100
RNG = np.random.default_rng(11)


# ------------------------------------------------------------------ temel
def T(d): return np.arange(max(1, int(d * SR))) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def noise(d): return RNG.standard_normal(max(1, int(d * SR)))


def fftfilt(x, lo=None, hi=None, order=2, peak=None):
    """genlik yanıtıyla süzgeç (FFT): lo = yüksek geçiren köşe, hi = alçak geçiren köşe; peak = (f, kazanç dB, genişlik oktav)"""
    if len(x) < 8: return x
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); H = np.ones_like(f)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if peak:
        fc, g, bw = peak; H *= 1 + (10 ** (g / 20) - 1) * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / (bw / 2)) ** 2)
    return np.fft.irfft(X * H, n)


def sweep(x, f0, f1, bw=0.8, segs=20, mode='band'):
    """zamanla kayan süzgeç (örtüşen pencerelerle): band / low"""
    n = len(x); out = np.zeros(n); hop = n // segs; win = max(hop * 2, 64)
    w = np.hanning(win)
    for i in range(segs + 1):
        a = i * hop; b = min(n, a + win)
        if b - a < 16: break
        fc = f0 * (f1 / f0) ** min(1, i / segs)
        seg = x[a:b] * w[: b - a]
        seg = fftfilt(seg, lo=fc / (2 ** bw), hi=fc * (2 ** bw), order=2) if mode == 'band' else fftfilt(seg, hi=fc, order=2)
        out[a:b] += seg
    return out / 1.0


def env(n, a=0.005, d=0.1, s=0.7, r=0.1):
    e = np.full(n, float(s)); an = min(n, max(1, int(a * SR))); e[:an] = np.linspace(0, 1, an)
    de = min(n, an + max(1, int(d * SR))); e[an:de] = np.linspace(1, s, de - an)
    rn = min(n, max(1, int(r * SR))); e[n - rn:] *= np.linspace(1, 0, rn)
    return e


def osc(freq, d, kind='sin', ph0=0.0):
    n = max(1, int(d * SR)); f = np.broadcast_to(np.asarray(freq, float), (n,)) if np.ndim(freq) else np.full(n, float(freq))
    ph = ph0 + 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sin': return np.sin(ph)
    if kind == 'saw': return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == 'sq': return np.sign(np.sin(ph))
    if kind == 'tri': return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    raise ValueError(kind)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) if len(x) else 0
    return x * (peak / m) if m > 0 else x


def softclip(x, drive=1.0): return np.tanh(x * drive) / np.tanh(drive)


# ------------------------------------------------------------------ çalgılar (mono)
def kick(vol=0.8, punch=1.0, d=0.35):
    t = T(d); f = 50 + 110 * punch * np.exp(-t * 28)
    return vol * (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5) + 0.25 * fftfilt(noise(d), lo=2000) * np.exp(-t * 120))


def snare(vol=0.4, d=0.25, tone=190):
    t = T(d); n = fftfilt(noise(d), lo=900, hi=9000)
    return vol * (0.75 * n * np.exp(-t * 18) + 0.5 * np.sin(2 * np.pi * tone * t) * np.exp(-t * 30))


def clap(vol=0.35):
    d = 0.22; t = T(d); n = fftfilt(noise(d), lo=800, hi=6000); e = np.exp(-t * 22)
    for k in (0.0, 0.011, 0.022): e += 0.7 * np.exp(-np.maximum(0, t - k) * 160) * (t >= k)
    return vol * n * e / 2


def hat(vol=0.12, open_=False):
    d = 0.35 if open_ else 0.06; t = T(d)
    return vol * fftfilt(noise(d), lo=7000) * np.exp(-t * (9 if open_ else 70))


def shaker(vol=0.06):
    d = 0.1; t = T(d); return vol * fftfilt(noise(d), lo=5000) * np.sin(np.pi * t / d) ** 2


def taiko(vol=0.9, f0=95, d=1.1):
    t = T(d); f = f0 * (1 + 0.5 * np.exp(-t * 30))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.2)
    skin = fftfilt(noise(d), lo=120, hi=1500) * np.exp(-t * 26)
    return vol * (body + 0.55 * skin)


def tom(vol=0.5, f0=140):
    d = 0.5; t = T(d); f = f0 * (1 + 0.4 * np.exp(-t * 25))
    return vol * (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + 0.2 * fftfilt(noise(d), hi=2500) * np.exp(-t * 30))


def sub(note, d, vol=0.5):
    n = int(d * SR); return vol * np.sin(2 * np.pi * midi(note) * T(d)) * env(n, 0.01, 0.1, 0.9, 0.08)


def sawbass(note, d, vol=0.35, cut=600, a=0.005, rel=0.06):
    n = int(d * SR); f = midi(note)
    x = osc(f, d, 'saw') + 0.6 * osc(f * 1.007, d, 'saw') + 0.5 * np.sin(2 * np.pi * f / 2 * T(d))
    return vol * fftfilt(x, hi=cut) * env(n, a, 0.12, 0.75, rel) / 1.6


def tuba(note, d, vol=0.4):
    n = int(d * SR); f = midi(note); t = T(d)
    x = osc(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)), d, 'sq') * 0.6 + osc(f, d, 'saw') * 0.4
    return vol * fftfilt(x, hi=700, peak=(300, 6, 1.2)) * env(n, 0.03, 0.08, 0.7, 0.08)


def pizz(note, vol=0.25, d=0.4):
    t = T(d); f = midi(note)
    x = osc(f, d, 'tri') + 0.3 * np.sin(4 * np.pi * f * t)
    return vol * fftfilt(x, hi=3000) * np.exp(-t * 11) * env(len(t), 0.002, 0.05, 1, 0.03)


def pluck(note, d=0.5, vol=0.2, decay=5):
    t = T(d); f = midi(note)
    x = 0.6 * np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return vol * x * np.exp(-t * decay) * env(len(t), 0.003, 0.05, 1, 0.05)


def bell(note, d=1.6, vol=0.15):
    t = T(d); f = midi(note)
    return vol * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 3) + 0.25 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 6)) * np.exp(-t * 2.8)


def glock(note, d=0.9, vol=0.12):
    t = T(d); f = midi(note)
    return vol * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 3.9 * f * t) * np.exp(-t * 12)) * np.exp(-t * 5)


def pad(notes, d, vol=0.08, a=0.4, r=0.6, cut=2200, kind='saw', trem=0.0):
    n = int(d * SR); x = np.zeros(n); t = T(d)
    for k, nt in enumerate(notes):
        f = midi(nt)
        for det in (-0.006, 0.0, 0.0065):
            x += osc(f * (1 + det), d, kind, ph0=k * 1.3 + det * 400)
    x = fftfilt(x, hi=cut) / max(1, len(notes) * 3) * 2.2
    if trem: x *= 1 - 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * trem * t))
    return vol * x * env(n, a, 0.2, 0.9, r)


def choir(notes, d, vol=0.07, a=0.6):
    n = int(d * SR); t = T(d); x = np.zeros(n)
    for k, nt in enumerate(notes):
        f = midi(nt); vib = 1 + 0.006 * np.sin(2 * np.pi * (5.2 + k * 0.3) * t + k)
        x += osc(f * vib, d, 'saw') + 0.7 * osc(f * 1.004 * vib, d, 'saw')
    x = fftfilt(x, hi=3500, peak=(750, 9, 0.9)); x = fftfilt(x, peak=(1150, 6, 0.8))
    return vol * norm(x) * env(n, a, 0.3, 0.9, 0.7)


def brass(notes, d, vol=0.18, cut=1800):
    n = int(d * SR); x = np.zeros(n)
    for nt in notes:
        f = midi(nt); x += osc(f, d, 'saw') + 0.8 * osc(f * 1.005, d, 'saw')
    x = fftfilt(x, hi=cut, peak=(900, 4, 1.0))
    e = env(n, 0.025, 0.15, 0.6, 0.1)
    return vol * softclip(norm(x) * 1.5, 1.4) * e


def supersaw(notes, d, vol=0.12, cut=5000, a=0.004, rel=0.12):
    n = int(d * SR); x = np.zeros(n)
    for nt in notes:
        f = midi(nt)
        for det in (-0.012, -0.005, 0.0, 0.006, 0.013): x += osc(f * (1 + det), d, 'saw', ph0=det * 900)
    return vol * fftfilt(norm(x), hi=cut) * env(n, a, 0.1, 0.8, rel)


def lead(note, d, vol=0.12, kind='sq', cut=3000, vib=0.006):
    n = int(d * SR); t = T(d); f = midi(note) * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t * 4))
    return vol * fftfilt(osc(f, d, kind), hi=cut) * env(n, 0.01, 0.08, 0.75, 0.06)


# ------------------------------------------------------------------ ses efektleri (mono; kanca: 'pre' olanlar olay anında BİTER)
PRE = {'whoosh', 'riser', 'reverse', 'swish'}


def sfx(kind, d=None, **o):
    if kind == 'boom':  # sinema darbesi: alçalan alt + gövde + uzun kuyruk
        d = d or 2.6; t = T(d); f = 30 + 60 * np.exp(-t * 5)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * 1.1
        x += 0.6 * fftfilt(noise(d), hi=400) * np.exp(-t * 6) + 0.35 * fftfilt(noise(d), lo=1500, hi=7000) * np.exp(-t * 30)
        return softclip(x, 1.5)
    if kind == 'braam':  # fragman "bıraaam": kalın bakır akor, bozulmuş
        d = d or 2.8; t = T(d); n = len(t); x = np.zeros(n)
        for nt in (26, 38, 45, 50):
            f = midi(nt) * (1 - 0.02 * np.exp(-t * 6)); x += osc(f, d, 'saw') + osc(f * 1.008, d, 'saw')
        x = fftfilt(x, hi=1400, peak=(220, 5, 1.0)); x = softclip(norm(x) * 2.2, 2.0)
        x = x * env(n, 0.02, 0.4, 0.55, 1.2) + 0.7 * sfx('boom', d)
        return x
    if kind == 'hit':  # sert vuruş (metalik)
        d = d or 1.2; t = T(d)
        x = taiko(1.0, 70, d) + 0.5 * fftfilt(noise(d), lo=2500) * np.exp(-t * 14)
        for fr, g in ((523, .3), (1187, .2), (2063, .12)): x += g * np.sin(2 * np.pi * fr * t) * np.exp(-t * 5)
        return softclip(x, 1.3)
    if kind == 'taiko': return taiko(1.0, o.get('f', 80), d or 1.2)
    if kind == 'thud': return taiko(0.9, 55, d or 0.6) * np.exp(-T(d or 0.6) * 4)
    if kind == 'whoosh':
        d = d or 0.6; t = T(d); x = sweep(noise(d), 300, 4500, bw=0.7, segs=16)
        return x * np.sin(np.pi * np.minimum(1, t / d * 1.15)) ** 2 * (t / d) ** 0.6
    if kind == 'swish':  # kısa savrulma
        d = d or 0.22; t = T(d); x = sweep(noise(d), 1500, 6000, bw=0.6, segs=8)
        return x * np.sin(np.pi * t / d) ** 2
    if kind == 'riser':
        d = d or 2.0; t = T(d); f = 180 * (12 ** (t / d)); x = 0.35 * osc(f, d, 'saw') + 0.25 * osc(f * 1.5, d, 'sin')
        x = fftfilt(x, hi=5000) + sweep(noise(d), 400, 9000, bw=0.6, segs=24) * 0.9
        return x * (t / d) ** 2.2
    if kind == 'reverse':  # ters zil/yankı kabarması
        d = d or 1.4; t = T(d); x = fftfilt(noise(d), lo=2000, hi=12000) * 0.6 + 0.4 * np.sin(2 * np.pi * 880 * t)
        return x * (t / d) ** 3
    if kind == 'downer':
        d = d or 1.2; t = T(d); f = 900 * (0.08 ** (t / d)); return (osc(f, d, 'saw') * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 1.5) * 0.6
    if kind == 'subdrop':
        d = d or 1.6; t = T(d); f = 90 * (0.3 ** (t / d)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.4)
    if kind == 'heartbeat':  # lup-dup
        d = d or 0.9; out = np.zeros(int(d * SR))
        for off, g in ((0.0, 1.0), (0.24, 0.7)):
            tt = T(0.32); f = 55 + 40 * np.exp(-tt * 30); b = g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14)
            i = int(off * SR); out[i:i + len(b)] += b[: len(out) - i]
        return fftfilt(out, hi=180) * 2.2
    if kind in ('tick', 'tock'):
        d = 0.08; t = T(d); fr = 3100 if kind == 'tick' else 2300
        return (np.sin(2 * np.pi * fr * t) * 0.6 + fftfilt(noise(d), lo=3000) * 0.5) * np.exp(-t * 95)
    if kind == 'scratch':  # plak cızırtısı: ileri-geri perde kayması
        d = d or 0.55; t = T(d); rate = 1 + 0.9 * np.sin(2 * np.pi * 3.3 * t + 0.6)
        n = noise(d); idx = np.clip(np.cumsum(np.abs(rate)) % len(n), 0, len(n) - 1).astype(int)
        x = fftfilt(n[idx], lo=500, hi=4500, peak=(1400, 8, 1.0))
        tone = np.sin(2 * np.pi * np.cumsum(300 + 900 * np.abs(np.sin(2 * np.pi * 3.3 * t))) / SR)
        return (0.7 * x + 0.35 * tone) * np.sin(np.pi * np.minimum(1, t / d)) ** 0.5 * np.exp(-t * 1.5)
    if kind == 'boing':  # yaylı komik zıplama
        d = d or 0.6; t = T(d); f = 150 + 260 * (1 - np.exp(-t * 7)) * (1 + 0.25 * np.sin(2 * np.pi * 18 * t) * np.exp(-t * 4))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5) * env(len(t), 0.005, 0.05, 1, 0.05)
    if kind == 'squish':  # yapışkan "vıcık"
        d = d or 0.45; t = T(d); n = noise(d)
        x = sweep(n, 1200, 250, bw=0.35, segs=14) * 1.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(220 * (0.5 ** (t / d)) * (1 + 0.3 * np.sin(2 * np.pi * 30 * t))) / SR)
        return x * np.exp(-t * 6) * env(len(t), 0.01, 0.05, 1, 0.08)
    if kind == 'gulp':
        d = 0.3; t = T(d); f = 380 * (0.35 ** (t / d)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) * 0.8
    if kind == 'cricket':  # cırcır böceği (sessizlik şakası)
        d = d or 1.6; t = T(d); out = np.zeros(len(t))
        for c in np.arange(0.05, d - 0.3, 0.42):
            for k in range(3):
                s0 = c + k * 0.045; tt = T(0.03); b = np.sin(2 * np.pi * 4300 * tt) * np.sin(np.pi * tt / 0.03) * (1 + 0.5 * np.sin(2 * np.pi * 900 * tt))
                i = int(s0 * SR); out[i:i + len(b)] += b[: len(out) - i] * 0.5
        return out
    if kind == 'pop':
        d = 0.12; t = T(d); f = 500 + 900 * (t / d); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)
    if kind == 'ding': return bell(o.get('n', 88), d or 1.8, 1.0)
    if kind == 'sparkle':
        d = d or 0.9; out = np.zeros(int(d * SR))
        for k, nt in enumerate((88, 91, 95, 100)):
            b = glock(nt, 0.6, 0.6); i = int(k * 0.06 * SR); out[i:i + len(b)] += b[: len(out) - i]
        return out
    if kind == 'buzzer':
        d = d or 0.5; t = T(d); return fftfilt(osc(110, d, 'sq') + osc(116, d, 'sq'), hi=1800) * env(len(t), 0.005, 0.05, 0.9, 0.05) * 0.5
    if kind == 'whistle':  # hakem düdüğü (çift ton, titreşimli)
        d = d or 0.7; t = T(d); trill = 1 + 0.03 * np.sign(np.sin(2 * np.pi * 28 * t))
        x = np.sin(2 * np.pi * np.cumsum(2900 * trill) / SR) + 0.6 * np.sin(2 * np.pi * np.cumsum(3350 * trill) / SR)
        x += 0.25 * fftfilt(noise(d), lo=2500, hi=6000)
        return x * env(len(t), 0.01, 0.05, 0.85, 0.06) * 0.45
    if kind == 'crowd':  # stadyum uğultusu: kabaran kalabalık
        d = d or 3.0; t = T(d); n = noise(d)
        x = fftfilt(n, lo=250, hi=2600, peak=(700, 6, 1.5)); x2 = fftfilt(noise(d), lo=180, hi=1800, peak=(450, 5, 1.2))
        swell = (1 - np.exp(-t * o.get('rise', 2.5))) * np.exp(-np.maximum(0, t - d * 0.65) * 2.5)
        am = 1 + 0.25 * np.sin(2 * np.pi * 0.7 * t) + 0.15 * np.sin(2 * np.pi * 1.9 * t + 1)
        y = (x + 0.8 * x2) * swell * am
        for c in RNG.uniform(0.2, d - 0.4, int(d * 3)):  # tek tük "hey!" (biçimlendirilmiş gürültü + perde)
            tt = T(0.3); fr = RNG.uniform(280, 520) * (1 + 0.2 * tt)
            b = fftfilt(osc(fr, 0.3, 'saw') * 0.5 + noise(0.3) * 0.2, hi=2500, peak=(900, 8, 0.8)) * np.sin(np.pi * tt / 0.3) ** 2
            i = int(c * SR); y[i:i + len(b)] += 0.25 * b[: len(y) - i] * swell[min(len(y) - 1, i)]
        return y
    if kind == 'cheer': return sfx('crowd', d or 2.2, rise=9)
    if kind == 'horn':  # stadyum borusu
        d = d or 1.0; t = T(d); x = np.zeros(len(t))
        for nt in (52, 56, 59): x += osc(midi(nt), d, 'saw') + osc(midi(nt) * 1.006, d, 'saw')
        return softclip(fftfilt(norm(x), hi=2200, peak=(1000, 6, 1)) * 1.6, 1.5) * env(len(t), 0.03, 0.1, 0.85, 0.15)
    if kind == 'beep':
        d = d or 0.18; t = T(d); return np.sin(2 * np.pi * o.get('f', 880) * t) * env(len(t), 0.003, 0.02, 0.9, 0.03) * 0.7
    if kind == 'glitch':
        d = d or 0.35; out = np.zeros(int(d * SR)); i = 0
        while i < len(out):
            L = int(RNG.uniform(0.01, 0.04) * SR); fr = RNG.choice([220, 440, 880, 1760, 3520])
            seg = (np.sign(np.sin(2 * np.pi * fr * T(L / SR))) * 0.4 if RNG.random() < 0.5 else fftfilt(noise(L / SR), lo=1000) * 0.6)
            m = min(L, len(seg), len(out) - i); out[i:i + m] += seg[:m]; i += L + int(RNG.uniform(0, 0.02) * SR)
        return out
    if kind == 'snap':  # dondurma karesi: deklanşör "çık" + kısa sıyırma
        d = 0.25; t = T(d); x = fftfilt(noise(d), lo=1500) * (np.exp(-t * 90) + 0.6 * np.exp(-np.maximum(0, t - 0.06) * 70) * (t > 0.06))
        return x
    if kind == 'stamp':
        d = 0.5; t = T(d); return taiko(0.8, 75, d) + 0.6 * fftfilt(noise(d), lo=500, hi=4000) * np.exp(-t * 40)
    if kind == 'paper':  # uçuşan not kâğıdı
        d = d or 0.35; t = T(d); x = fftfilt(noise(d), lo=1200, hi=8000) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 37 * t)))
        return x * np.sin(np.pi * t / d) ** 2 * 0.6
    if kind == 'chime':  # seviye çanı: perde n (MIDI), parlak ve kısa
        nt = o.get('n', 86); d = d or 0.9; return glock(nt, d, 1.0) + 0.5 * bell(nt - 12, d, 0.6) + 0.25 * pluck(nt + 12, d, 0.6, 9)
    if kind == 'lens':  # büyüteç: cam "tın" + kısa sıyırma
        d = d or 0.6; t = T(d); x = 0.5 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 9) + 0.35 * np.sin(2 * np.pi * 3951 * t) * np.exp(-t * 14)
        return x + 0.3 * fftfilt(noise(d), lo=3000) * np.exp(-t * 40)
    if kind == 'tone':  # Ton Avı tonu: saf sinüs, 20 ms yumuşak giriş/çıkış (patlama yok); düzey karışımda ayarlanır
        d = d or 0.45; t = T(d); n = len(t); r = min(n // 2, int(0.02 * SR)); e = np.ones(n); e[:r] = np.sin(np.linspace(0, np.pi / 2, r)) ** 2; e[n - r:] = e[:r][::-1]
        return np.sin(2 * np.pi * o.get('f', 1000) * t) * e
    if kind == 'flash':  # fotoğraf flaşı: "pıt" + şarj vızıltısı
        d = 0.5; t = T(d); return fftfilt(noise(d), lo=2500) * np.exp(-t * 60) + 0.2 * np.sin(2 * np.pi * np.cumsum(3000 + 4000 * t) / SR) * np.exp(-t * 6)
    if kind == 'drumroll':
        d = d or 1.2; out = np.zeros(int(d * SR)); tt = 0.0
        while tt < d - 0.05: p = tt / d; b = snare(0.25 + 0.5 * p, 0.12); i = int(tt * SR); out[i:i + len(b)] += b[: len(out) - i]; tt += 0.045
        return out
    if kind == 'type':  # daktilo tuşu
        d = 0.08; t = T(d); return fftfilt(noise(d), lo=1500, hi=7000) * np.exp(-t * 80) + 0.3 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 120)
    raise ValueError(f'bilinmeyen efekt: {kind}')


# ------------------------------------------------------------------ yankı
def reverb(x, seconds=2.2, damp=4000, seed=5):
    """basit evrişimli yankı: üstel sönen, süzülmüş gürültü dürtü yanıtı (stereo için iki farklı tohum)"""
    r = np.random.default_rng(seed); n = int(seconds * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / seconds); ir = fftfilt(ir, hi=damp); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n; N = 1 << int(np.ceil(np.log2(L)))
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[: len(x)]


class Bus:
    """stereo karıştırıcı: kuru + yankı gönderimi"""
    def __init__(self, seconds):
        self.n = int(seconds * SR); self.L = np.zeros(self.n); self.R = np.zeros(self.n); self.rv = np.zeros(self.n)

    def add(self, sig, t, pan=0.0, rev=0.15, g=1.0):
        i = int(round(t * SR))
        if i >= self.n or len(sig) == 0: return
        if i < 0: sig = sig[-i:]; i = 0
        j = min(self.n, i + len(sig)); s = sig[: j - i] * g
        lp = np.cos((pan + 1) * np.pi / 4); rp = np.sin((pan + 1) * np.pi / 4)
        self.L[i:j] += s * lp * 1.414; self.R[i:j] += s * rp * 1.414
        if rev: self.rv[i:j] += s * rev

    def render(self, seconds=2.2, damp=4500):
        wl = reverb(self.rv, seconds, damp, 5); wr = reverb(self.rv, seconds, damp, 9)
        return np.stack([self.L + wl, self.R + wr])


# ------------------------------------------------------------------ müzik
def sections_of(sections, total):
    """[(t, tür)] → [(başla, bitir, tür)]"""
    s = sorted(sections, key=lambda x: x[0]); out = []
    for i, (t, k) in enumerate(s):
        e = s[i + 1][0] if i + 1 < len(s) else total
        if e > t: out.append((t, e, k))
    return out


def music(style, bpm, total, sections):
    B = 60.0 / bpm; bus = Bus(total + 3.0)
    secs = sections_of(sections, total)

    def beats(a, e, step=1.0):
        """[a, e) aralığındaki ızgara vuruşları (0'dan sayılan küresel vuruş indeksiyle)"""
        k0 = int(np.ceil(a / (B * step) - 1e-6)); k = k0
        while k * B * step < e - 1e-6:
            yield k, k * B * step; k += 1

    if style == 'fragman':  # Re minör: Dm Bb Gm A
        prog = [(38, [50, 53, 57]), (34, [50, 53, 58]), (31, [50, 55, 58]), (33, [49, 52, 57])]
        for a, e, k in secs:
            if k == 'off': continue
            if k in ('drone', 'pulse', 'build'):
                dd = e - a + 0.8
                bus.add(pad([26, 38, 45], dd, 0.16, a=1.2 if a < 0.1 else 0.4, cut=380), a, rev=0.35)
                bus.add(sub(26, dd, 0.22) * env(int(dd * SR), 0.6, 0.1, 1, 0.6), a, rev=0)
                bus.add(0.04 * np.sin(2 * np.pi * midi(86) * T(dd)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.35 * T(dd))) * env(int(dd * SR), 1.0, 0.1, 1, 0.5), a, pan=0.4, rev=0.6)
            if k in ('pulse', 'build'):
                for i, t in beats(a, e, 0.5):
                    bus.add(sawbass(38 if (i // 8) % 2 == 0 else 34, B * 0.4, 0.16, cut=900, rel=0.04), t, rev=0.1)
                    bus.add(sfx('tick') * 0.12, t, pan=0.5 if i % 2 else -0.5, rev=0.2)
            if k == 'build':  # tremolo yaylılar yükselir, trampet sıklaşır
                dd = e - a; n = int(dd * SR); tt = T(dd)
                bus.add(pad([62, 65, 69], dd, 0.11, a=dd * 0.8, cut=3500, trem=12) * (tt / dd) ** 1.5, a, rev=0.3)
                t = a; step = B / 2
                while t < e - 0.05:
                    p = (t - a) / max(0.01, dd); bus.add(snare(0.08 + 0.35 * p ** 2, 0.15), t, rev=0.25); t += step * (1 - 0.75 * p)
            if k == 'full':
                for i, t in beats(a, e, 1):
                    bar = i // 4; root, tri = prog[bar % 4]; pos = i % 4
                    if pos == 0:
                        bus.add(brass([root + 12, root + 19, root + 24], B * 3.6, 0.2, cut=1500), t, rev=0.3)
                        bus.add(choir([x + 12 for x in tri], B * 4.1, 0.07), t, rev=0.5)
                        bus.add(sub(root, B * 3.8, 0.3), t, rev=0)
                    bus.add(taiko(0.75 if pos in (0, 2) else 0.45, 85 if pos != 3 else 110), t, rev=0.25)
                    if pos == 3: bus.add(taiko(0.4, 120), t + B / 2, rev=0.25)
                    for s in range(4):  # 16'lık yaylı ostinato
                        nt = [root + 24, root + 31, root + 36, root + 31][s]
                        bus.add(sawbass(nt, B / 4 * 0.8, 0.07, cut=3000, rel=0.03), t + s * B / 4, pan=0.3, rev=0.2)
                    bus.add(hat(0.05), t + B / 2, pan=-0.3, rev=0.1)
            if k == 'hit':
                bus.add(sub(26, min(4, e - a + 1.5), 0.25), a, rev=0)
                bus.add(pad([38, 45, 50], e - a + 1.5, 0.1, a=0.05, cut=600), a, rev=0.5)
            if k == 'cute':  # parodi: minik müzik kutusu
                mel = [79, 83, 86, 83, 88, 86, 83, 79]
                for i, t in beats(a, e, 0.5):
                    bus.add(glock(mel[i % len(mel)], 0.7, 0.16), t, rev=0.3)
                    if i % 2 == 0: bus.add(pizz(43 + (7 if (i // 2) % 2 else 0), 0.25), t, rev=0.15)
            if k == 'end':
                dd = e - a + 2.5
                bus.add(brass([38, 45, 50, 54], dd, 0.22, cut=1400), a, rev=0.45)  # Re majör (pikardi) son
                bus.add(choir([62, 66, 69], dd, 0.08, a=0.3), a, rev=0.6)
                bus.add(sub(26, dd, 0.3), a, rev=0)
                for q, nt in enumerate((74, 78, 81, 86)): bus.add(bell(nt, 2.5, 0.08), a + 0.1 * q, rev=0.5)
        return bus.render(3.2, 3500)

    if style == 'komedi':  # Fa majör, "um-pa" + klarnet; F Bb C F / gerilim: Re minör
        prog = [(29, [53, 57, 60]), (34, [53, 58, 62]), (36, [52, 55, 60]), (29, [53, 57, 60])]
        mel = [(72, 1), (74, .5), (72, .5), (69, 1), (65, 1), (67, .5), (69, .5), (70, 1), (69, 1), (67, 1), (72, 1), (77, 1.5), (76, .5), (74, 1), (72, 1)]
        for a, e, k in secs:
            if k == 'off': continue
            if k in ('bouncy', 'bright'):
                for i, t in beats(a, e, 1):
                    root, tri = prog[(i // 4) % 4]; pos = i % 4
                    if pos in (0, 2): bus.add(tuba(root + 12 if pos == 0 else root + 19, B * 0.8, 0.4), t, rev=0.1)
                    else:
                        for nt in tri: bus.add(pizz(nt + 12, 0.11), t, pan=0.2, rev=0.15)
                    bus.add(shaker(0.05), t + B / 2, pan=-0.4, rev=0.05)
                    if k == 'bright':
                        bus.add(hat(0.06), t + B / 2, rev=0.05)
                        if pos in (1, 3): bus.add(clap(0.22), t, rev=0.15)
                        if pos == 0: bus.add(kick(0.55, 0.6), t, rev=0)
                # melodi (klarnet benzeri), bölüm başından
                t = a; j = 0
                while t < e - 0.1:
                    nt, bl = mel[j % len(mel)]; dur = min(bl * B, e - t)
                    bus.add(lead(nt + (12 if k == 'bright' else 0) - 12, dur * 0.95, 0.09, kind='sq', cut=2200, vib=0.008), t, pan=-0.15, rev=0.2)
                    if k == 'bright' and j % 2 == 0: bus.add(glock(nt + 12, 0.6, 0.06), t, rev=0.3)
                    t += bl * B; j += 1
            if k == 'tension':
                dd = e - a; tt = T(dd)
                bus.add(pad([38, 45, 50], dd + 0.3, 0.13, a=0.2, cut=700, trem=10), a, rev=0.3)
                f = midi(74) * (1 + 0.06 * tt / dd); bus.add(0.05 * np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / dd), a, rev=0.4)
                t = a
                while t < e - 0.04:  # timpani tremolosu
                    p = (t - a) / max(0.01, dd); bus.add(taiko(0.12 + 0.4 * p, 70, 0.3), t, rev=0.2); t += 0.07
            if k == 'boss':
                for i, t in beats(a, e, 1):
                    pos = i % 4
                    if pos in (0, 2): bus.add(kick(0.85, 1.0), t, rev=0)
                    if pos in (1, 3): bus.add(snare(0.4), t, rev=0.2)
                    bus.add(softclip(sawbass(26 if (i // 4) % 2 == 0 else 25, B * 0.9, 0.35, cut=500) * 2, 2), t, rev=0)
                    if pos == 0: bus.add(brass([50, 53, 57] if (i // 4) % 2 == 0 else [49, 52, 56], B * 1.2, 0.2), t, rev=0.3)
                    bus.add(hat(0.05), t + B / 2, rev=0)
            if k == 'end':
                dd = e - a + 1.5
                bus.add(brass([53, 57, 60, 65], dd, 0.2, cut=2400), a, rev=0.4)
                bus.add(tuba(41, 0.6, 0.45), a, rev=0.1); bus.add(kick(0.6), a)
                for q, nt in enumerate((77, 81, 84, 89)): bus.add(glock(nt, 1.2, 0.1), a + 0.08 * q, rev=0.4)
        return bus.render(1.6, 5000)

    if style == 'panik':  # gergin: Do minör 16'lıklar yükselir → groove: Do majör C G Am F
        gprog = [(36, [55, 60, 64]), (31, [55, 59, 62]), (33, [57, 60, 64]), (29, [57, 60, 65])]
        for a, e, k in secs:
            if k == 'off': continue
            if k == 'tick':
                dd = e - a + 0.3; bus.add(pad([36, 43], dd, 0.1, a=0.3, cut=300), a, rev=0.3)
                for i, t in beats(a, e, 1): bus.add(sfx('tick' if i % 2 == 0 else 'tock') * 0.5, t, pan=0.25, rev=0.2)
            if k == 'panic':
                dd = e - a
                for i, t in beats(a, e, 0.25):
                    p = (t - a) / max(0.01, dd); semis = int(p * 6)
                    nt = [48, 51, 55, 51, 48, 51, 56, 51][i % 8] + semis
                    bus.add(sawbass(nt + 12, B / 4 * 0.7, 0.08 + 0.05 * p, cut=2500, rel=0.02), t, pan=0.3 if i % 2 else -0.3, rev=0.15)
                    if i % 4 == 0: bus.add(kick(0.7), t, rev=0); bus.add(sub(36 + semis, B * 0.9, 0.18), t, rev=0)
                    if i % 4 == 2: bus.add(hat(0.08, True), t, rev=0.05)
                    if i % 8 == 4: bus.add(snare(0.3), t, rev=0.2)
                    if i % 2 == 0: bus.add(sfx('tick') * (0.25 + 0.2 * p), t, pan=0.6, rev=0.1)
                tt = T(dd); bus.add(pad([60, 63, 67], dd, 0.08, a=dd * 0.7, cut=4000, trem=14) * (tt / dd), a, rev=0.3)
            if k == 'groove':
                for i, t in beats(a, e, 1):
                    root, tri = gprog[(i // 4) % 4]; pos = i % 4
                    bus.add(kick(0.75, 0.9), t, rev=0)
                    if pos in (1, 3): bus.add(clap(0.3), t, rev=0.2); bus.add(snare(0.18), t, rev=0.1)
                    bus.add(hat(0.08, open_=True), t + B / 2, pan=0.3, rev=0.05); bus.add(hat(0.04), t + B / 4, pan=-0.3); bus.add(hat(0.04), t + 3 * B / 4, pan=-0.3)
                    bus.add(sawbass(root + 12, B * 0.45, 0.22, cut=900), t + B / 2, rev=0)
                    bus.add(sub(root, B * 0.4, 0.2), t, rev=0)
                    for s in range(2):
                        bus.add(supersaw([x + 12 for x in tri], B * 0.3, 0.05, cut=4500, rel=0.05), t + s * B / 2 + (B / 4 if s else 0), rev=0.25)
                    if pos == 0:
                        for q, nt in enumerate([tri[2] + 12, tri[1] + 12, tri[0] + 24, tri[2] + 12]): bus.add(pluck(nt, 0.4, 0.09, 7), t + q * B, pan=0.35, rev=0.3)
            if k == 'end':
                dd = e - a + 1.8
                bus.add(supersaw([48, 55, 60, 64, 67], dd, 0.1, cut=3500, a=0.01, rel=1.2), a, rev=0.45); bus.add(sub(36, dd, 0.3), a, rev=0)
                bus.add(kick(0.8), a); bus.add(sfx('ding') * 0.25, a, rev=0.4)
        return bus.render(1.8, 5000)

    if style == 'spor':  # Mi minör marş: Em C G D
        prog = [(28, [55, 59, 64]), (24, [55, 60, 64]), (31, [55, 59, 62]), (26, [54, 57, 62])]
        hook = [(76, .75), (76, .25), (79, .5), (76, .5), (74, 1), (71, 1), (72, .75), (72, .25), (74, .5), (76, .5), (79, 2)]
        for a, e, k in secs:
            if k == 'off': continue
            if k == 'drums':  # büyük davullar: 1 ve 3 tok, 2 ve 4 dev el çırpma + davul turları
                for i, t in beats(a, e, 1):
                    pos = i % 4
                    if pos in (0, 2): bus.add(taiko(0.9, 70), t, rev=0.3); bus.add(kick(0.7), t)
                    else: bus.add(clap(0.5), t, rev=0.45); bus.add(snare(0.2), t, rev=0.3)
                    if pos == 3 and (i // 4) % 2 == 1:
                        for q in range(3): bus.add(tom(0.4, 160 - q * 30), t + B / 4 * (q + 1), rev=0.3)
                dd = e - a + 0.3; bus.add(pad([40, 47, 52], dd, 0.08, a=0.2, cut=500), a, rev=0.3)
            if k == 'count':
                for i, t in beats(a, e, 1):
                    bus.add(sub(28, B * 0.9, 0.35), t, rev=0); bus.add(taiko(0.8, 60), t, rev=0.35)
                dd = e - a; tt = T(dd); bus.add(supersaw([52, 59, 64], dd, 0.07, cut=1200, a=dd * 0.8) * (tt / dd), a, rev=0.3)
            if k in ('drop', 'break'):
                full = k == 'drop'
                for i, t in beats(a, e, 1):
                    root, tri = prog[(i // 4) % 4]; pos = i % 4
                    if full:
                        bus.add(kick(0.9, 1.1), t, rev=0)
                        if pos in (1, 3): bus.add(clap(0.4), t, rev=0.25); bus.add(snare(0.25), t, rev=0.2)
                        bus.add(hat(0.1, open_=True), t + B / 2, rev=0.05); bus.add(hat(0.04), t + B / 4, pan=0.4); bus.add(hat(0.04), t + 3 * B / 4, pan=-0.4)
                        bus.add(supersaw([x + 12 for x in tri], B * 0.35, 0.07, cut=6000, rel=0.06), t + B / 2, rev=0.3)
                        bus.add(sawbass(root + 12, B * 0.4, 0.28, cut=700), t + B / 2, rev=0)
                        bus.add(sub(root, B * 0.45, 0.25), t, rev=0)
                    else:
                        if pos == 0: bus.add(kick(0.6), t)
                        bus.add(hat(0.05), t + B / 2, rev=0.05)
                        bus.add(supersaw([x + 12 for x in tri], B * 0.9, 0.045, cut=1100, a=0.05), t, rev=0.3)
                        if pos == 0: bus.add(sub(root, B * 3.8, 0.22), t, rev=0)
                if full:  # bakır nakarat
                    t = a; j = 0
                    while t < e - 0.1:
                        nt, bl = hook[j % len(hook)]; dur = min(bl * B, e - t)
                        bus.add(brass([nt - 12, nt], dur * 0.92, 0.1, cut=2600), t, pan=-0.1, rev=0.3)
                        t += bl * B; j += 1
            if k == 'end':
                dd = e - a + 2.0
                bus.add(supersaw([40, 47, 52, 55, 59, 64], dd, 0.11, cut=4000, a=0.01, rel=1.4), a, rev=0.5); bus.add(sub(28, dd, 0.32), a, rev=0)
                bus.add(sfx('horn') * 0.25, a, rev=0.4); bus.add(taiko(1.0, 60), a, rev=0.4)
        return bus.render(2.0, 5000)

    if style == 'kur':  # kamp büyümesi (Re majör, 120 BPM): pırıltılı arpej + dört vuruş; seviye çanları efekt izinde
        prog = [(38, [62, 66, 69]), (35, [62, 66, 71]), (31, [62, 67, 71]), (33, [61, 64, 69])]
        for a, e, k in secs:
            if k == 'off': continue
            if k == 'intro':
                dd = e - a + 0.6; bus.add(pad([50, 57, 62, 66], dd, 0.07, a=0.3, cut=1800), a, rev=0.4)
                for i, t in beats(a, e, 0.5): bus.add(pluck([74, 78, 81, 86][i % 4], 0.5, 0.08, 6), t, pan=0.3 if i % 2 else -0.3, rev=0.35)
            if k in ('grow', 'lift'):
                big = k == 'lift'
                for i, t in beats(a, e, 1):
                    root, tri = prog[(i // 4) % 4]; pos = i % 4
                    bus.add(kick(0.75 if big else 0.6, 0.9), t, rev=0)
                    if pos in (1, 3): bus.add(clap(0.28), t, rev=0.2)
                    bus.add(hat(0.06, open_=big), t + B / 2, pan=0.3, rev=0.05)
                    bus.add(sub(root, B * 0.45, 0.22), t, rev=0); bus.add(sawbass(root + 12, B * 0.4, 0.16, cut=800), t + B / 2, rev=0)
                    for q in range(4): bus.add(pluck(tri[(q + i) % 3] + 12, 0.4, 0.07, 7), t + q * B / 4, pan=0.35 if q % 2 else -0.35, rev=0.3)
                    if big and pos == 0: bus.add(supersaw([x + 12 for x in tri], B * 3.8, 0.05, cut=4000, a=0.02, rel=0.3), t, rev=0.35); bus.add(brass([root + 24, root + 31], B * 1.5, 0.08, cut=2200), t, rev=0.3)
            if k == 'wide':
                dd = e - a + 1.0
                bus.add(pad([50, 57, 62, 66, 69], dd, 0.12, a=0.25, cut=3500), a, rev=0.6); bus.add(sub(38, dd, 0.25), a, rev=0)
                bus.add(choir([62, 66, 69], dd, 0.05, a=0.4), a, rev=0.6)
                for i, t in beats(a, e, 0.5): bus.add(glock([86, 90, 93, 98][i % 4], 0.8, 0.06), t, pan=0.4 if i % 2 else -0.4, rev=0.5)
                for i, t in beats(a, e, 1): bus.add(kick(0.45, 0.6), t, rev=0)
            if k == 'end':
                dd = e - a + 2.0
                bus.add(supersaw([50, 57, 62, 66, 69], dd, 0.09, cut=3500, a=0.01, rel=1.2), a, rev=0.45); bus.add(sub(38, dd, 0.3), a, rev=0)
                bus.add(kick(0.8), a); bus.add(brass([62, 66, 69, 74], dd * 0.6, 0.1, cut=2400), a, rev=0.4)
                for q, nt in enumerate((86, 90, 93, 98)): bus.add(bell(nt, 2.0, 0.07), a + 0.08 * q, rev=0.5)
        return bus.render(2.0, 5000)

    if style == 'detay':  # "fark ettin mi" (La minör → Do majör, 100 BPM): meraklı pizzicato + glokenşpil, yumuşak nabız
        prog = [(33, [57, 60, 64]), (29, [57, 60, 65]), (36, [55, 60, 64]), (31, [55, 59, 62])]
        mot = [76, 79, 81, 79, 84, 81, 79, 76]
        for a, e, k in secs:
            if k == 'off': continue
            if k in ('soft', 'full'):
                for i, t in beats(a, e, 0.5):
                    root, tri = prog[(i // 8) % 4]
                    bus.add(pizz([root + 24, tri[0] + 12, tri[1] + 12, tri[2] + 12][i % 4], 0.12), t, pan=0.25 if i % 2 else -0.25, rev=0.2)
                    if i % 4 == 0: bus.add(glock(mot[(i // 4) % 8], 0.9, 0.07), t, pan=0.3, rev=0.45)
                for i, t in beats(a, e, 1):
                    root, tri = prog[(i // 4) % 4]
                    if i % 4 == 0: bus.add(pad([x for x in tri], B * 4.2, 0.05, a=0.3, cut=1500), t, rev=0.5); bus.add(sub(root + 12, B * 3.8, 0.16), t, rev=0)
                    if k == 'full':
                        bus.add(kick(0.5, 0.6) if i % 2 == 0 else snare(0.12, 0.15), t, rev=0.15); bus.add(shaker(0.04), t + B / 2, rev=0.05)
            if k == 'end':
                dd = e - a + 1.8
                bus.add(pad([48, 55, 60, 64, 67], dd, 0.1, a=0.05, cut=2600), a, rev=0.5); bus.add(sub(36, dd, 0.25), a, rev=0)
                for q, nt in enumerate((72, 76, 79, 84)): bus.add(glock(nt + 12, 1.4, 0.09), a + 0.1 * q, rev=0.5)
        return bus.render(2.2, 5000)

    if style == 'gizem':  # vaka saati (La minör gerilim, 84 BPM): saat tikleri, pizzicato ostinato, tremolo, vuruşlu ipucu
        for a, e, k in secs:
            if k == 'off': continue
            if k in ('tick', 'pulse', 'rise'):
                dd = e - a + 0.5
                bus.add(pad([33, 40, 45], dd, 0.12, a=0.6, cut=420), a, rev=0.4); bus.add(sub(33, dd, 0.16) * env(int(dd * SR), 0.5, 0.1, 1, 0.5), a, rev=0)
                for i, t in beats(a, e, 1): bus.add(sfx('tick' if i % 2 == 0 else 'tock') * 0.4, t, pan=0.3, rev=0.25)
            if k in ('pulse', 'rise'):
                for i, t in beats(a, e, 0.5): bus.add(pizz([45, 52, 48, 52, 45, 53, 52, 48][i % 8], 0.2, 0.35), t, pan=-0.2, rev=0.25)
                for i, t in beats(a, e, 2): bus.add(sfx('heartbeat') * 0.3, t, rev=0.1)
            if k == 'rise':
                dd = e - a; tt = T(dd)
                bus.add(pad([57, 60, 64, 65], dd, 0.08, a=dd * 0.6, cut=3500, trem=11) * (tt / dd) ** 1.3, a, rev=0.35)
            if k == 'hit':
                bus.add(sub(33, min(3.5, e - a + 1.5), 0.3), a, rev=0); bus.add(brass([45, 48, 52, 56], min(3, e - a + 1), 0.14, cut=1200), a, rev=0.5)
            if k == 'end':
                dd = e - a + 2.0
                bus.add(pad([45, 52, 57, 60, 64], dd, 0.11, a=0.05, cut=1800), a, rev=0.55); bus.add(sub(33, dd, 0.28), a, rev=0)
                bus.add(bell(81, 2.5, 0.07), a, rev=0.6); bus.add(bell(76, 2.5, 0.05), a + 0.25, rev=0.6)
        return bus.render(2.6, 3800)

    if style == 'yarisma':  # eğri yarışması (Si bemol majör yarışma programı, 128 BPM): bakır fanfar, "düşünme" saati, parlak dönüş
        prog = [(34, [58, 62, 65]), (39, [58, 63, 67]), (41, [57, 60, 65]), (34, [58, 62, 65])]
        for a, e, k in secs:
            if k == 'off': continue
            if k == 'fanfar':
                for q, (nt, d0) in enumerate([(70, 0.5), (70, 0.25), (74, 0.25), (77, 1.0), (82, 1.5)]):
                    t = a + sum(x[1] for x in [(70, 0.5), (70, 0.25), (74, 0.25), (77, 1.0), (82, 1.5)][:q]) * B
                    if t < e: bus.add(brass([nt - 12, nt], min(d0 * B, e - t) * 0.95, 0.16, cut=3000), t, rev=0.3)
                for i, t in beats(a, e, 1): bus.add(taiko(0.6, 75), t, rev=0.3); bus.add(sub(34, B * 0.9, 0.25), t, rev=0)
            if k == 'think':  # sorudan sonra: tik-tak + yumuşak bas (anlatıcıya ve sayaca yer)
                for i, t in beats(a, e, 1):
                    bus.add(sfx('tick' if i % 2 == 0 else 'tock') * 0.55, t, pan=0.3, rev=0.15)
                    if i % 2 == 0: bus.add(sub(34 + (5 if (i // 4) % 2 else 0), B * 0.8, 0.18), t, rev=0)
                    bus.add(pizz([70, 74, 77, 74][i % 4], 0.1, 0.3), t + B / 2, pan=-0.3, rev=0.2)
            if k == 'reveal':
                for i, t in beats(a, e, 1):
                    root, tri = prog[(i // 4) % 4]; pos = i % 4
                    bus.add(kick(0.8, 1.0), t, rev=0)
                    if pos in (1, 3): bus.add(clap(0.35), t, rev=0.2)
                    bus.add(hat(0.08, open_=True), t + B / 2, rev=0.05); bus.add(hat(0.04), t + B / 4, pan=0.3); bus.add(hat(0.04), t + 3 * B / 4, pan=-0.3)
                    bus.add(sawbass(root + 12, B * 0.4, 0.24, cut=900), t + B / 2, rev=0); bus.add(sub(root, B * 0.45, 0.22), t, rev=0)
                    if pos in (0, 2): bus.add(brass([x + 12 for x in tri], B * 0.35, 0.09, cut=3200), t + B / 2, rev=0.25)
            if k == 'end':
                dd = e - a + 2.0
                bus.add(brass([46, 53, 58, 62, 65], dd * 0.7, 0.18, cut=2600), a, rev=0.4); bus.add(sub(34, dd, 0.3), a, rev=0); bus.add(taiko(1.0, 65), a, rev=0.4)
                bus.add(sfx('cheer', 2.0) * 0.15, a, rev=0.3)
        return bus.render(1.8, 5000)

    if style == 'sessiz':  # kulaklık meydan okuması (Fa majör, 90 BPM): çok yumuşak; ton anlarında müzik SUSAR ('off')
        for a, e, k in secs:
            if k == 'off': continue
            if k in ('amb', 'pulse'):
                dd = e - a + 0.4
                bus.add(pad([53, 60, 65, 69], dd, 0.06, a=0.4, r=0.35, cut=1400), a, rev=0.5)
                if k == 'pulse':
                    for i, t in beats(a, e, 1): bus.add(sub(41, B * 0.5, 0.12), t, rev=0); bus.add(glock([77, 81, 84, 81][i % 4], 0.6, 0.035), t, pan=0.3, rev=0.4)
            if k == 'end':
                dd = e - a + 1.8
                bus.add(pad([41, 48, 53, 57, 60, 65], dd, 0.1, a=0.05, cut=2400), a, rev=0.5); bus.add(sub(41, dd, 0.22), a, rev=0)
                for q, nt in enumerate((77, 81, 84, 89)): bus.add(glock(nt, 1.4, 0.07), a + 0.1 * q, rev=0.5)
        return bus.render(2.2, 4500)
    raise ValueError(style)


def sfx_track(events, total, gain=1.0):
    """[{t, k, g, d?, pan?, rev?}] → stereo efekt izi (efektler müziğin üstünde, yankılı)"""
    bus = Bus(total + 3.0)
    for ev in events:
        k = ev['k']; x = sfx(k, ev.get('d'), **{kk: v for kk, v in ev.items() if kk in ('n', 'f', 'rise')})
        t = ev['t'] - (len(x) / SR if k in PRE else 0) + ev.get('off', 0)
        bus.add(norm(x, 0.9) * ev.get('g', 1) * gain, t, pan=ev.get('pan', 0), rev=ev.get('rev', 0.25 if k in ('boom', 'braam', 'hit', 'taiko', 'stamp') else 0.12))
    return bus.render(2.6, 4000)


def write_wav(path, st):
    st = np.asarray(st); st = st / max(1e-9, np.max(np.abs(st))) * 0.89
    pcm = (np.clip(st.T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--sfx':
        out = a[1]; ev = []; t = 0.3
        for k in a[2:]:
            x = sfx(k); ev.append({'t': t + (len(x) / SR if k in PRE else 0), 'k': k}); t += len(x) / SR + 0.4
        write_wav(out, sfx_track(ev, t + 0.5))
    else:
        out, style, bpm, secs = a[0], a[1], float(a[2]), float(a[3])
        sections = json.load(open(a[4])) if len(a) > 4 else [[0, 'full']]
        write_wav(out, music(style, bpm, secs, sections))
    print('yazıldı:', a[1] if a[0] == '--sfx' else a[0])
