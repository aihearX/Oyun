#!/usr/bin/env python3
"""29 Ekim Reels (2) "Bir odyoloğun kulağından": özgün sinematik skor + ses tasarımı (numpy sentezi; örnek, marş, kayıt YOK).

Akış (zaman tools/harness/out/ekim29b/zaman.json'dan; ekim29b.mjs yazar):
  sessizlik (oda tonu, çok alçak D) → kalp atışı → seyrek piyano (Re minör) → anne sesi motifi, bebeğin yanıtı (çan)
  → her şey boğuklaşır (alçak geçiren süzgeç: işitme kaybı gibi) → implant "klik" → süzgeç açılır (ses geri gelir), parıltı
  → yaylılar + timpani tremolosu yükselir → tam sessizlik (0,4 sn) → BAYRAK: büyük vuruş (Fa majör: bakırlar, timpani, zil)
  → marş havasında dört ölçü (65 BPM; timpani kalp atışı ritminde "lub-dub") → son akor, piyanoyla ilk sese dönüş.
Ses yüksekliği: −14 LUFS, tepe sınırlayıcı (gerçek tepe ≤ −1 dBTP). Çıktı: marketing/reels/29-ekim-odyolog.mp4 (+ kapak).
Kullanım (kökten): python3 tools/reels/ekim29b_ses.py [--no-mux]
"""
import json, os, shutil, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'harness', 'out', 'ekim29b')
T = json.load(open(os.path.join(OUT, 'zaman.json')))
SR = 48000
DUR = T['dur']; N = int(SR * DUR) + SR
BEAT = 60 / T['bpm']; BAR = 4 * BEAT; F0 = T['flag']; CUT = T['cut']; CLICK = T['click']; END = T['end']
rng = np.random.default_rng(1923)

music = np.zeros((2, N)); sfx = np.zeros((2, N)); strings_bus = np.zeros((2, N))


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


def heartbeat(vel=0.5):
    n = int(0.62 * SR); t = tt(n); s = np.zeros(n)
    for off, g, fb in ((0, 1.0, 58), (0.27, 0.72, 66)):
        i = int(off * SR); m = n - i; u = tt(m); f = fb * (1 + 0.5 * np.exp(-u * 30))
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-u * 16) + 0.45 * np.sin(2 * np.pi * np.cumsum(f * 2.4) / SR) * np.exp(-u * 26)
        b += filt(rng.standard_normal(m) * np.exp(-u * 70), lo=400) * 0.6
        s[i:] += g * b
    return vel * 0.9 * np.tanh(s * 1.4)


def implant_click(vel=0.6):
    n = int(0.08 * SR); t = tt(n); s = np.zeros(n); s[0], s[1], s[2] = 1, -0.8, 0.3
    s = filt(s, hi=900) * 6 + np.sin(2 * np.pi * 3800 * t) * np.exp(-t * 600) * 0.6 + np.sin(2 * np.pi * 1200 * t) * np.exp(-t * 300) * 0.3
    return vel * s


def shimmer(notes, at, dur, vol=0.03):
    n = int(dur * SR); t = tt(n)
    for i, nt in enumerate(notes):
        f = midi(nt); a = 0.25 + 0.15 * i
        s = np.sin(2 * np.pi * f * t + i) * (0.8 + 0.2 * np.sin(2 * np.pi * (3 + i * 0.7) * t))
        add(music, s * env(n, a, dur * 0.6) * vol, at + i * 0.07, pan=(-1) ** i * 0.5)


# ------------------------------------------------------------------ 1) sessizlik → kalp → piyano (Re minör)
room = filt(rng.standard_normal((2, N)), lo=900, hi=60) * 0.004
rt = tt(N); room *= np.clip(rt / 1.5, 0, 1) * (rt < CUT)
add(sfx, room, 0)
drone_n = int((CUT - 0.4) * SR); dt = tt(drone_n)
dr = (np.sin(2 * np.pi * midi(38) * dt) + 0.4 * np.sin(2 * np.pi * midi(50) * dt) + 0.25 * np.sin(2 * np.pi * midi(57) * dt + 1)) * np.interp(dt, [0, 4, 11, CUT - 0.4], [0, 0.02, 0.03, 0.06])
add(music, dr, 0.4)
for i, h in enumerate(T['heart']):
    add(music, heartbeat(np.interp(h, [3.9, 6.9, 10.0], [0.3, 0.42, 0.18])), h)

P = []  # (zaman, nota, vuruş gücü)
P += [(0.65, 38, .35), (0.68, 57, .25), (0.72, 62, .22), (0.76, 65, .22), (1.45, 69, .32), (2.6, 64, .24), (3.0, 62, .26)]          # Dm
P += [(3.9, 34, .34), (3.93, 53, .22), (3.97, 58, .22), (4.01, 62, .22), (4.6, 65, .3), (5.2, 67, .3), (5.8, 69, .33), (6.6, 72, .3)]  # B♭
P += [(7.35, 41, .34), (7.38, 57, .22), (7.42, 60, .22), (7.46, 65, .2), (8.0, 72, .36), (8.4, 69, .32)]                               # F, anne
P += [(9.35, 36, .32), (9.38, 55, .2), (9.42, 60, .2), (9.46, 64, .2), (9.4, 74, .3), (9.8, 72, .28)]                                  # C
for at, nt, v in P: add(music, piano(nt, 4.5 if nt < 50 else 3.2, v * 0.62), at, pan=np.clip((nt - 62) / 30, -0.5, 0.5))
pk = T['packets']
add(music, bell(89, 3, 0.32), pk[0]['t0'] + pk[0]['dur'], pan=0.45)   # bebek: F6
add(music, bell(91, 3, 0.26), pk[1]['t0'] + pk[1]['dur'], pan=0.45)   # G6
strings([50, 53, 57], 7.3, 3.8, vol=0.012, a=1.2, r=0.8)
strings([38, 50, 53, 57, 62], 11.0, CLICK - 11.0 + 0.2, vol=0.012, a=0.5, r=0.2)   # boğuk Dm (süzgeçte)

# ------------------------------------------------------------------ 2) klik → ses geri gelir (B♭) → yükseliş
add(sfx, implant_click(0.55), CLICK)
shimmer([82, 84, 86, 89, 94, 96], CLICK + 0.02, 5.0, vol=0.022)
add(music, riser(0.9, 0.5, 300, 2400) * np.linspace(1, 0, int(0.9 * SR)), CLICK + 0.02)  # açılan "nefes"
for at, nt, v in [(CLICK, 34, .45), (CLICK + .03, 58, .3), (CLICK + .06, 62, .3), (CLICK + .09, 65, .3), (CLICK + .12, 74, .38), (13.6, 77, .34), (14.05, 74, .3)]:
    add(music, piano(nt, 3.5, v), at, pan=np.clip((nt - 62) / 30, -0.5, 0.5))
strings([46, 58, 62, 65], CLICK + 0.05, 2.2, vol=0.02, a=0.9, r=0.4)
b5 = T['b5']['a']
seq = [(b5, 2 * BEAT * 0.65 + 0.4, [45, 57, 60, 65, 69], 72), (16.1, 1.1, [43, 55, 58, 62, 67], 74), (17.2, 0.55, [48, 60, 65, 67, 72], 76), (17.75, CUT - 17.75, [48, 60, 64, 67, 72], 76)]
lvl = lambda x: float(np.interp(x, [b5, CUT], [0.02, 0.04]))
for at, dur, ns, mel in seq:
    strings(ns, at, dur, vol=lvl(at), a=0.35 if at > b5 else 0.6, r=0.05, swell=[1, lvl(at + dur) / lvl(at)])
    add(music, piano(mel, 2.5, 0.42), at, pan=0.2); add(music, piano(mel - 12, 2.5, 0.3), at, pan=-0.1)
for k, at in enumerate(np.arange(b5, CUT - 0.01, BEAT / 2)):  # alçak yaylı ostinato
    nt = {0: 41, 1: 43, 2: 48}[0 if at < 16.1 else (1 if at < 17.2 else 2)]
    strings([nt - 12 + 12 * (k % 2)], at, BEAT / 2 * 0.8, vol=float(np.interp(at, [b5, CUT], [0.018, 0.04])), a=0.02, r=0.04)
for at in np.arange(16.6, CUT - 0.03, 0.075):  # timpani tremolosu, kreşendo
    add(music, timpani(36, float(np.interp(at, [16.6, CUT], [0.04, 0.26]))) * 0.7, at)
add(music, riser(CUT - 15.6, 0.42), 15.6)
# keskin kesim: CUT'ta her şey susar
cut_i = int(CUT * SR); fz = int(0.012 * SR)
for bus in (music, strings_bus):
    bus[:, cut_i:cut_i + fz] *= np.linspace(1, 0, fz); bus[:, cut_i + fz:int(F0 * SR) - 10] = 0

# ------------------------------------------------------------------ 3) BAYRAK: Fa majör, marş havası
add(music, boom(1.35), F0); add(music, crash(1.0), F0); add(music, timpani(41, 1.0), F0); add(music, timpani(29, 0.8), F0)
chords = [(41, [53, 57, 60, 65, 69, 72]), (38, [50, 57, 62, 65, 69, 74]), (34, [50, 53, 58, 62, 65, 70]), (36, [52, 55, 60, 64, 67, 72])]
for b, (root, tri) in enumerate(chords):
    at = F0 + b * BAR
    strings([root, root + 12] + tri, at, BAR, vol=0.03 + 0.005 * b, a=0.05 if b == 0 else 0.25, r=0.3)
    brass([root + 12, tri[0], tri[1], tri[2]], at, BAR * (0.5 if b < 3 else 0.48), vol=0.05 + 0.006 * b, bright=1.0 if b == 0 else 0.6)
    for k in range(8):  # yaylı ostinato (sekizlik)
        strings([root + 12 * (k % 2)], at + k * BEAT / 2, BEAT / 2 * 0.75, vol=0.04, a=0.015, r=0.05)
    for beat in (0, 2):  # timpani: kalp atışı gibi lub-dub
        if b == 0 and beat == 0: continue
        add(music, timpani(root - 12 if root > 40 else root, 0.75), at + beat * BEAT)
        add(music, timpani(root - 12 if root > 40 else root, 0.42), at + beat * BEAT + 0.27)
    add(music, crash(0.18, 3), at) if b else None
if True:  # Csus4 → C (son ölçünün ikinci yarısı)
    brass([60, 64, 67], F0 + 3 * BAR + 2 * BEAT, 2 * BEAT, vol=0.06, bright=0.8)
horn = [(2, 69, 1), (3, 72, 1), (4, 74, 2), (6, 72, 1), (7, 69, 1), (8, 70, 1.5), (9.5, 72, 0.5), (10, 74, 1), (11, 77, 1), (12, 76, 2), (14, 79, 1), (15, 76, 1)]
for beat, nt, d in horn:
    brass([nt - 12], F0 + beat * BEAT, d * BEAT * 0.95, vol=0.075, a=0.06, r=0.25, bright=0.7)
    strings([nt], F0 + beat * BEAT, d * BEAT * 0.95, vol=0.03, a=0.08, r=0.2)
for at in np.arange(F0 + 3 * BAR + 2 * BEAT, END - 0.02, 0.07):
    add(music, timpani(36, float(np.interp(at, [F0 + 3 * BAR + 2 * BEAT, END], [0.08, 0.5]))) * 0.6, at)
rc = crash(0.8, 1.8)[:, ::-1]; add(music, rc, END - 1.8)
add(music, riser(2.2, 0.45), END - 2.2)

# ------------------------------------------------------------------ 4) son: büyük Fa, sonra ilk sese dönüş
add(music, boom(0.9, 3.0), END); add(music, crash(0.8, 5), END); add(music, timpani(41, 0.9), END); add(music, timpani(29, 0.7), END)
tail = DUR - END + 0.5
strings([29, 41, 53, 57, 60, 65, 69, 72, 77], END, tail - 1.5, vol=0.032, a=0.05, r=1.8)
brass([41, 53, 57, 60, 65], END, 2.6, vol=0.06, r=1.2, bright=1.0)
brass([77 - 12], END, 2.8, vol=0.07, r=1.2, bright=0.8)
for at, nt, v in [(END + 2.35, 84, .3), (END + 2.85, 81, .27), (END + 3.35, 77, .3), (END + 3.4, 65, .2)]:
    add(music, piano(nt, 3.5, v), at, pan=0.15)
shimmer([89, 93, 96], END + 0.1, 4.5, vol=0.012)

# ------------------------------------------------------------------ boğukluk süzgeci (işitme kaybı → implant): müzik + yaylılar
mus = music + filt(strings_bus, lo=4200)
cut_curve = np.interp(rt, [0, T['b4']['a'], T['b4']['a'] + 0.7, CLICK, CLICK + 0.25, CLICK + 1.4, DUR + 1], [14.3, 14.3, 8.4, 8.4, 9.5, 14.3, 14.3])  # log2 Hz
levels = [8.4, 9.4, 10.4, 11.4, 12.4, 14.3]
vers = [filt(mus, lo=2 ** l, order=3) for l in levels[:-1]] + [mus]
idx = np.interp(cut_curve, levels, np.arange(len(levels)))
mus_f = np.zeros_like(mus)
for i in range(len(levels)):
    w = np.clip(1 - np.abs(idx - i), 0, 1); mus_f += vers[i] * w
mus_f *= np.interp(rt, [T['b4']['a'], T['b4']['a'] + 0.7, CLICK - 0.05, CLICK], [1, 0.75, 0.75, 1])

# ------------------------------------------------------------------ yankı (konser salonu) + karışım
def reverb(x, rt60=2.6, wet=0.22):
    n = int(rt60 * SR); t = tt(n); y = np.zeros_like(x)
    for c in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.91 * t / rt60); ir = filt(ir, lo=5000); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
        L = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        y[c] = np.fft.irfft(np.fft.rfft(x[c], L) * np.fft.rfft(ir, L), L)[: x.shape[1]]
    return x + wet * y


mix = reverb(mus_f + 0.6 * sfx)
mix[:, int(DUR * SR):] = 0
mix = filt(mix, hi=28, lo=15000)
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
dst = os.path.join(ROOT, 'marketing', 'reels', '29-ekim-odyolog.mp4')
sh(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(OUT, 'video.mp4'), '-i', final_wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', dst])
shutil.copy(os.path.join(OUT, 'kapak.png'), os.path.join(ROOT, 'marketing', 'reels', '29-ekim-odyolog-kapak.png'))
print('✅', dst)
