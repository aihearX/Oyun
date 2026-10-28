#!/usr/bin/env python3
"""29 Ekim Reels "Bu odyogramda bir şey var…": özgün skor + ses tasarımı (numpy sentezi; örnek, marş, kayıt YOK).

Akış (zaman tools/harness/out/29-ekim-odyogram/zaman.json'dan; 29-ekim-odyogram.mjs yazar):
  odyometri odası (çok alçak oda tonu) → darbeli saf tonlar (125, 250, 750 Hz… gerçek frekansında, yumuşak düzeyde) + yanıt düğmesi
  → tonlar hızlanır ve yükselen bir arpej motifine dönüşür (C – Am – F – G) → alan açılır (vınlama) → üç dalga "hızlı ateş"
  (onlarca kısa bip, yaylılar + timpani kreşendosu) → semboller dizilir (parıltı) → tek başına son ton → eğri çizilirken G7 gerilimi
  → BAYRAK: büyük Do majör tören kabarışı (bakırlar, yaylılar, timpani, zil; marş değil) → rapor (kâğıt, mühür) → "29 Ekim 1923"
  vuruşu → plagal kapanış (F → C) ve imza olarak yumuşak bir 750 → 1000 Hz bip.
Akort: 1000 Hz = Do6 (odyometrinin oktav frekansları 125…8000 Hz hep "Do", 750/1500/3000/6000 Hz "Sol" olur).
Ses yüksekliği: −14 LUFS, tepe sınırlayıcı (gerçek tepe ≤ −1 dBTP). Çıktı: marketing/reels/29-ekim-odyogram.mp4 (+ kapak).
Kullanım (kökten): python3 tools/reels/29-ekim-odyogram_ses.py [--no-mux]
"""
import json, os, shutil, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'harness', 'out', '29-ekim-odyogram')
T = json.load(open(os.path.join(OUT, 'zaman.json')))
SR = 48000
DUR = T['dur']; N = int(SR * DUR) + SR
BEAT = 60 / T['bpm']; BAR = 4 * BEAT
FLOOD = T['flood']; Z0, Z1 = T['zoom']; A0, A1 = T['align']; TR0, TR1 = T['trace']
PTS = T['points']
rng = np.random.default_rng(1923)
music = np.zeros((2, N)); sfx = np.zeros((2, N)); beeps = np.zeros((2, N))


def midi(n): return 1000.0 * 2 ** ((n - 84) / 12)   # Do6 = 1000 Hz


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
    X = np.fft.rfft(x, axis=-1); f = np.fft.rfftfreq(x.shape[-1], 1 / SR); H = np.ones_like(f)
    if lo: H *= 1 / np.sqrt(1 + (f / lo) ** (2 * order))
    if hi: H *= 1 / np.sqrt(1 + (np.maximum(f, 1e-3) / hi) ** (-2 * order))
    return np.fft.irfft(X * H, n=x.shape[-1], axis=-1)


def saw(f, n, det=0.0, vib=0.0, vib_rate=5.2, ph=0.0):
    t = tt(n); fr = f * 2 ** (det / 1200) * (1 + vib * np.sin(2 * np.pi * vib_rate * t + ph) * np.clip(t / 0.6, 0, 1))
    p = (np.cumsum(fr) / SR + ph / (2 * np.pi)) % 1.0
    return 2 * p - 1


# ------------------------------------------------------------------ çalgılar
def tone(f, dur, vol):
    """odyometre tonu: saf sinüs, 20 ms yükselme/düşme (tık sesi yok)"""
    n = int(dur * SR); t = tt(n); e = np.ones(n); k = int(0.02 * SR)
    e[:k] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, k)); e[-k:] = e[:k][::-1]
    return vol * np.sin(2 * np.pi * f * t) * e


def button(vel=0.3):
    """hasta yanıt düğmesi: kısa, yumuşak plastik tık"""
    n = int(0.05 * SR); t = tt(n)
    s = filt(rng.standard_normal(n) * np.exp(-t * 260), lo=3000, hi=400) * 0.8 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.5
    return vel * s


def pad(notes, at, dur, vol=0.02, a=1.0, r=1.2):
    n = int((dur + r) * SR); t = tt(n)
    for i, nt in enumerate(notes):
        f = midi(nt); s = np.zeros(n)
        for d in (-6, 0, 7):
            s += np.sin(2 * np.pi * f * 2 ** (d / 1200) * t + rng.random() * 6.28)
        s += 0.25 * np.sin(2 * np.pi * 2 * f * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.3 * t + i))
        add(music, s * env(n, a, r) * vol, at, pan=np.clip((nt - 66) / 30, -0.6, 0.6))


def strings(notes, at, dur, vol=0.05, a=0.6, r=0.8, swell=None):
    n = int((dur + r) * SR)
    for i, nt in enumerate(notes):
        f = midi(nt); v = np.zeros(n)
        for d in (-7, -2, 3, 8):
            v += saw(f, n, det=d, vib=0.004, vib_rate=4.8 + 0.3 * i + d * 0.02, ph=rng.random() * 6.28)
        e = env(n, a, r)
        if swell is not None: e *= np.interp(tt(n), np.linspace(0, dur, len(swell)), swell)
        add(music, filt(v, lo=min(5000, f * 9)) * e * vol, at, pan=np.clip((nt - 60) / 30, -0.6, 0.6))


def brass(notes, at, dur, vol=0.06, a=0.07, r=0.5, bright=1.0):
    n = int((dur + r) * SR); t = tt(n)
    for nt in notes:
        f = midi(nt); v = sum(saw(f, n, det=d, vib=0.0035, vib_rate=5.0, ph=rng.random() * 6.28) for d in (-5, 0, 6))
        dark, br = filt(v, lo=min(700, f * 5)), filt(v, lo=min(3200, f * 14))
        b = bright * (np.exp(-t / 0.35) * 0.7 + 0.3)
        add(music, np.tanh((dark * (1 - b) + br * b) * 0.9) * env(n, a, r) * vol, at, pan=np.clip((nt - 57) / 36, -0.5, 0.5))


def piano(note, dur=3.0, vel=0.5):
    n = int(dur * SR); t = tt(n); f = midi(note); s = np.zeros(n); B = 0.00035
    for k in range(1, 9):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 12000: break
        s += (1 / k ** 1.25) * np.sin(2 * np.pi * fk * t + k) * np.exp(-t * (0.55 + 0.38 * k) * (1 + (note - 60) / 60))
    return vel * 0.22 * s * env(n, 0.003, 0.3)


def bell(note, dur=2.5, vel=0.3):
    n = int(dur * SR); t = tt(n); f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 3) + 0.12 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 6)
    return vel * 0.16 * s * np.exp(-t * 1.8) * env(n, 0.004, 0.2)


def timpani(note, vel=0.8):
    n = int(2.2 * SR); t = tt(n); f = midi(note) * (1 + 0.025 * np.exp(-t * 8))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 2.2) + 0.5 * np.sin(1.5 * ph) * np.exp(-t * 3.5) + 0.3 * np.sin(1.98 * ph) * np.exp(-t * 4.5)
    mallet = filt(rng.standard_normal(n) * np.exp(-t * 60), lo=1200, hi=60) * 0.8
    return vel * 0.5 * np.tanh((s + mallet) * 1.2) * env(n, 0.002, 0.3)


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
    w = rng.standard_normal((2, n)); s = filt(w, hi=700, lo=5000) * k * 0.1
    s += 0.05 * np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / dur)) / SR) * k
    return vel * s * env(n, 0.01, 0.02)


def whoosh(dur, vel=0.4):
    n = int(dur * SR); t = tt(n); w = rng.standard_normal((2, n)); k = np.sin(np.pi * t / dur) ** 2
    return vel * 0.12 * (filt(w, lo=2500, hi=300) * k)


def thud(vel=0.6):
    n = int(0.5 * SR); t = tt(n)
    s = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 14) + filt(rng.standard_normal(n) * np.exp(-t * 50), lo=1500) * 0.4
    return vel * s


# ------------------------------------------------------------------ 1) oda + tonlar + yanıtlar
room = filt(rng.standard_normal((2, N)), lo=700, hi=50) * 0.0035
rt = tt(N); room *= np.clip(rt / 1.0, 0, 1) * (rt < FLOOD)
add(sfx, room, 0)
BEEP_VOL = {'slow': 0.085, 'acc': 0.072, 'burst': 0.045, 'last': 0.09}
for p in PTS:
    ph = p['phase']; f = p['f'] if p['note'] is None else midi(p['note']); v = BEEP_VOL[ph]
    pan = -0.35 if p['ear'] == 'L' else 0.35   # sol kulak solda, sağ kulak sağda (kulaklıkta)
    if ph in ('slow', 'last'):
        for k in range(p['pulses']): add(beeps, tone(f, 0.2, v), p['on'] + k * 0.3, pan=pan)
    elif ph == 'acc': add(beeps, tone(f, 0.15, v), p['on'], pan=pan)
    else: add(beeps, tone(f, 0.075, v * (0.8 + 0.4 * rng.random())), p['on'], pan=pan * 0.6 + (rng.random() - 0.5) * 0.5)
    add(sfx, button(0.22 if ph != 'burst' else 0.07), p['t'], pan=0.1)
    if ph in ('acc', 'burst'):  # tonun müzikal yankısı: çan
        add(music, bell(p['note'], 1.6, 0.22 if ph == 'acc' else 0.08), p['on'], pan=pan * 0.5)

# ------------------------------------------------------------------ 2) alt yapı: ped, hızlanan nabız
pad([48, 55, 64, 74], 0.3, 4.9, vol=0.010, a=2.0, r=1.0)                       # Cadd9, çok alçak
acc = [p for p in PTS if p['phase'] == 'acc']
ch = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 53, 57, 65], [43, 55, 59, 62]]   # C Am F G
for g in range(4):
    a0 = acc[4 * g]['on']; a1 = acc[4 * g + 4]['on'] if g < 3 else Z0
    pad(ch[g], a0 - 0.05, a1 - a0 + 0.1, vol=0.011 + 0.003 * g, a=0.25, r=0.5)
for k, at in enumerate(np.arange(acc[0]['on'], Z0, BEAT / 2)):                  # yumuşak nabız (kalp gibi)
    add(music, timpani(36, 0.10 + 0.12 * (at - acc[0]['on']) / (Z0 - acc[0]['on'])) * 0.6, at)

# ------------------------------------------------------------------ 3) alan açılır → hızlı ateş
add(sfx, whoosh(Z1 - Z0 + 0.3, 0.9), Z0 - 0.1)
add(music, boom(0.35, 2.0), Z1 - 0.05)
strings([48, 60, 67, 76], Z0, 1.2, vol=0.012, a=0.6, r=0.3)
bursts = [(10.8, 12.0, [48, 55, 64, 72, 76]), (12.2, 13.55, [41, 53, 57, 69, 72]), (13.7, 15.2, [43, 55, 59, 65, 71, 74])]
for i, (b0, b1, ns) in enumerate(bursts):
    strings(ns, b0 - 0.1, b1 - b0 + 0.25, vol=0.014 + 0.005 * i, a=0.3, r=0.25, swell=[0.7, 1.0, 1.3])
    for k, at in enumerate(np.arange(b0, b1, BEAT / 2)):
        strings([ns[0] - 12 + 12 * (k % 2)], at, BEAT / 2 * 0.8, vol=0.02 + 0.006 * i, a=0.02, r=0.04)
for at in np.arange(13.9, A0, 0.07):
    add(music, timpani(43, float(np.interp(at, [13.9, A0], [0.05, 0.3]))) * 0.6, at)
add(music, riser(A0 - 13.2, 0.4), 13.2)
# dizilme: aşağı inen parıltı
for k, nt in enumerate([96, 91, 88, 84, 79, 76]): add(music, bell(nt, 2.0, 0.22), A0 + k * 0.08, pan=0.4 * (-1) ** k)
add(music, timpani(31, 0.35), A0)
# son ton tek başına (müzik çekilir): yalnızca alçak Sol pedalı
pad([43, 55], A0, T['last']['r'] - A0 + 0.4, vol=0.012, a=0.1, r=0.4)
# eğri çizilir: G7 gerilimi, kreşendo, ters zil
strings([43, 55, 59, 62, 65, 71], TR0 - 0.05, FLOOD - TR0 + 0.05, vol=0.03, a=0.2, r=0.02, swell=[0.4, 1.0, 1.9])
for at in np.arange(TR0, FLOOD - 0.02, 0.06): add(music, timpani(43, float(np.interp(at, [TR0, FLOOD], [0.08, 0.45]))) * 0.6, at)
rc = crash(0.8, FLOOD - TR0 + 0.1)[:, ::-1]; add(music, rc, TR0 - 0.1)

# ------------------------------------------------------------------ 4) BAYRAK: Do majör tören kabarışı
cut = int((FLOOD - 0.015) * SR); music[:, cut:int(FLOOD * SR)] *= np.linspace(1, 0.2, int(FLOOD * SR) - cut)
add(music, boom(1.3), FLOOD); add(music, crash(1.0), FLOOD); add(music, timpani(36, 1.0), FLOOD); add(music, timpani(24, 0.8), FLOOD)
bars = [(FLOOD, 1.0, 36, [48, 52, 55, 60, 64, 67]), (FLOOD + BAR, 1.0, 33, [45, 52, 57, 60, 64, 69]),
        (FLOOD + 2 * BAR, 0.5, 29, [45, 53, 57, 60, 65, 69]), (FLOOD + 2.5 * BAR, 0.5, 31, [47, 50, 55, 59, 62, 67]),
        (FLOOD + 3 * BAR, 1.0, 36, [48, 52, 55, 60, 64, 67, 72]), (FLOOD + 4 * BAR, 0.5, 29, [45, 53, 57, 60, 65, 69])]
for b, (at, ln, root, tri) in enumerate(bars):
    d = BAR * ln
    strings([root, root + 12] + tri, at, d, vol=0.026 + 0.004 * min(b, 4), a=0.05 if b in (0, 4) else 0.3, r=0.35)
    brass([root + 12, tri[1], tri[2], tri[3]], at, d * 0.9, vol=0.045 + 0.005 * min(b, 4), bright=1.0 if b in (0, 4) else 0.55)
    for k in range(int(8 * ln)):
        strings([root + 12 * (k % 2)], at + k * BEAT / 2, BEAT / 2 * 0.75, vol=0.032, a=0.015, r=0.05)
    for bt in range(0, int(4 * ln), 2):
        if bt == 0 and b in (0, 4): continue
        add(music, timpani(root if root < 34 else root - 12, 0.6), at + bt * BEAT)
    if b in (1, 2): add(music, crash(0.15, 3), at)
# korno motifi: tonların "Sol → Do" yükselişi, şimdi bakırlarda
horn = [(1, 67, 1), (2, 72, 1), (3, 76, 2), (5, 74, 0.5), (5.5, 72, 0.5), (6, 69, 2), (8, 72, 1), (9, 77, 1), (10, 79, 2),
        (12, 79, 0.5), (12.5, 77, 0.5), (13, 76, 1), (14, 74, 2)]
for bt, nt, dd in horn:
    brass([nt - 12], FLOOD + bt * BEAT, dd * BEAT * 0.95, vol=0.07, a=0.06, r=0.25, bright=0.7)
    strings([nt], FLOOD + bt * BEAT, dd * BEAT * 0.95, vol=0.022, a=0.08, r=0.2)
# rapor: kâğıt sesi, mühür
R = T['report']
add(sfx, whoosh(0.7, 0.5), R['a'] - 0.05)
for k, t0 in enumerate(R['lines']):
    for j in range(10): add(sfx, button(0.05), t0 + j * 0.045 + 0.02 * rng.random(), pan=0.3)
add(sfx, thud(0.7), R['stamp'])
# "29 Ekim 1923": büyük vuruş (3. ölçü başı ≈ kutlu.a)
K = T['kutlu']['a']
add(music, boom(1.0, 2.6), K); add(music, crash(0.8, 4.5), K); add(music, timpani(36, 0.9), K)
for at in np.arange(K - 1.2, K - 0.02, 0.07): add(music, timpani(43, float(np.interp(at, [K - 1.2, K], [0.05, 0.35]))) * 0.6, at)
brass([79], K + 2 * BEAT, 2 * BEAT, vol=0.07, bright=0.8)
# kapanış: F → C (plagal), imza bip
E = FLOOD + 4.5 * BAR
strings([36, 48, 55, 60, 64, 67, 72, 79], E, DUR - E, vol=0.03, a=0.4, r=0.8)
brass([48, 55, 60, 64], E, DUR - E - 0.5, vol=0.05, a=0.3, r=1.0, bright=0.5)
add(music, timpani(36, 0.7), E); add(music, crash(0.4, 4), E)
sig = T['end'] + 1.6
add(beeps, tone(750, 0.2, 0.07), sig, pan=-0.3); add(beeps, tone(1000, 0.35, 0.07), sig + 0.3, pan=0.3)
for k, nt in enumerate([84, 88, 91, 96]): add(music, bell(nt, 2.5, 0.12), sig + 0.65 + k * 0.1)

# ------------------------------------------------------------------ yankı + karışım
def reverb(x, rt60=2.4, wet=0.2):
    n = int(rt60 * SR); t = tt(n); y = np.zeros_like(x)
    for c in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.91 * t / rt60); ir = filt(ir, lo=5000); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        L = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        y[c] = np.fft.irfft(np.fft.rfft(x[c], L) * np.fft.rfft(ir, L), L)[: x.shape[1]]
    return x + wet * y


# odyometri odası kuru (yankısız): tonlar ve düğme kuru; müzik salonlu
mix = reverb(music) + beeps + 0.12 * reverb(beeps, 1.2, 0.5) - 0.12 * beeps + 0.7 * sfx
mix[:, int(DUR * SR):] = 0
mix = filt(mix, hi=28, lo=15000)[:, : int(DUR * SR)]
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
sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', f'{chain(gain)},afade=t=out:st={DUR - 0.6:.2f}:d=0.6', '-ar', '48000', final_wav])
print('ses: I=%.2f LUFS, TP=%.2f dBTP' % measure(final_wav))
if '--no-mux' in sys.argv: sys.exit(0)
dst = os.path.join(ROOT, 'marketing', 'reels', '29-ekim-odyogram.mp4')
sh(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(OUT, 'video.mp4'), '-i', final_wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', dst])
shutil.copy(os.path.join(OUT, 'kapak.png'), os.path.join(ROOT, 'marketing', 'reels', '29-ekim-odyogram-kapak.png'))
print('✅', dst)
