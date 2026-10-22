#!/usr/bin/env python3
"""ODİ Reels müziği: telifsiz, tamamen özgün (numpy ile sentez; örnek/sample yok).

Kullanım: python3 tools/reels/music.py <çıktı.wav> <saniye> [işaretler.json]
İşaretler (isteğe bağlı JSON):
  {"cuts": [sn, ...], "boss": [[başla, bitir], ...]}                       → eski "Nasıl oynanır?" parçası (104 BPM, Do majör)
  {"style": "merak"|"takim"|"masal", "bpm": 120, "cuts": [...], "accents": [...], "end": sn, "boss": [...]}
      merak: meraklı, tıngırtılı arpej (La minör: Am-F-C-G), 2 ve 4'te alkış — keşif/ders Reels'i
      takim: enerjik, dörtlük bas davul, akor vuruşları (Fa-Sol-Lam-Do) — takım/yarış Reels'i
      masal: ninni gibi müzik kutusu, yumuşak pad, hafif çıngırak (Do majör, 3/4 hissi yok; 4/4 yavaş) — Tüy Dede Reels'i
      cuts → geçişten hemen önce yükselen "vuuş" + geçişte çan; accents → hafif vurgu (kesme ritmi);
      end → bitiş kartı: davul susar, büyük akor + çan; ilk ölçüden önce kısa yükselen giriş (kanca).
"""
import sys, wave, json
import numpy as np

SR = 44100
out_path = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 60
cues = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
STYLE = cues.get('style')
BPM = float(cues.get('bpm', 104 if not STYLE else 120))
BEAT = 60 / BPM
CUTS = [float(x) for x in cues.get('cuts', [])]
ACCENTS = [float(x) for x in cues.get('accents', [])]
BOSS = [(float(a), float(b)) for a, b in cues.get('boss', [])]
END = float(cues['end']) if cues.get('end') is not None else None
in_boss = lambda t: any(a <= t < b for a, b in BOSS)
N = int(SR * seconds)
mix = np.zeros(N)
rng = np.random.default_rng(7)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def env(n, a=0.005, d=0.12, s=0.5, r=0.2):
    e = np.full(n, s, dtype=float)
    a_n = min(n, max(1, int(a * SR))); e[:a_n] = np.linspace(0, 1, a_n)
    d_end = min(n, a_n + max(1, int(d * SR))); e[a_n:d_end] = np.linspace(1, s, d_end - a_n)
    r_n = min(n, max(1, int(r * SR))); e[n - r_n:] *= np.linspace(1, 0, r_n)
    return e

def add(sig, at, buf=None):
    b = mix if buf is None else buf
    i = int(at * SR)
    if i >= len(b) or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(b), i + len(sig)); b[i:j] += sig[: j - i]

def pluck(note, dur, vol=0.22, decay=2.2):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = 0.6 * np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return vol * s * env(n, 0.004, 0.18, 0.25, 0.15) * np.exp(-t * decay)

def bell(note, dur, vol=0.12):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2.76 * f * t) + 0.25 * np.sin(2 * np.pi * 5.4 * f * t)
    return vol * s * np.exp(-t * 3.2)

def musicbox(note, dur, vol=0.13):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 9) + 0.15 * np.sin(2 * np.pi * 5.98 * f * t) * np.exp(-t * 14)
    a = min(n, int(0.002 * SR)); e = np.exp(-t * 2.6); e[:a] *= np.linspace(0, 1, a)
    return vol * s * e

def pad(notes, dur, vol=0.05, a=0.25):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * midi(x) * t) + 0.3 * np.sin(2 * np.pi * midi(x) * 1.003 * t) + 0.12 * np.sin(2 * np.pi * midi(x) * 2.001 * t) for x in notes)
    return vol * s * env(n, a, 0.3, 0.8, 0.4)

def stab(notes, dur, vol=0.07):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sign(np.sin(2 * np.pi * midi(x) * t)) * 0.35 + np.sin(2 * np.pi * midi(x) * t) for x in notes)
    return vol * s * env(n, 0.003, 0.08, 0.2, 0.06) * np.exp(-t * 6)

def bass(note, dur, vol=0.28):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return vol * s * env(n, 0.005, 0.1, 0.7, 0.08)

def kick(vol=0.55):
    n = int(0.28 * SR); t = np.arange(n) / SR
    f = 120 * np.exp(-t * 18) + 45
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def hat(vol=0.05):
    n = int(0.06 * SR); t = np.arange(n) / SR
    w = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    return vol * w * np.exp(-t * 60)

def shaker(vol=0.03):
    n = int(0.09 * SR); t = np.arange(n) / SR
    w = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    return vol * w * np.sin(np.pi * t / t[-1]) ** 2

def clap(vol=0.12):
    n = int(0.18 * SR); t = np.arange(n) / SR
    w = rng.standard_normal(n)
    return vol * w * (np.exp(-t * 25) + 0.5 * np.exp(-np.maximum(0, t - 0.012) * 30))

def whoosh(dur=0.7, vol=0.16):
    n = int(dur * SR); t = np.arange(n) / SR
    w = rng.standard_normal(n)
    hp = np.diff(np.concatenate([[0], w])) * (0.3 + 0.7 * t / dur) + w * 0.25 * (1 - t / dur)
    return vol * hp * (t / dur) ** 2

def riser(dur=1.2, vol=0.08, f0=300, f1=1800):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 + whoosh(dur, vol * 0.8)

def boom(vol=0.6):
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = 70 * np.exp(-t * 6) + 32
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5)

def tick(vol=0.08):
    n = int(0.05 * SR); t = np.arange(n) / SR
    return vol * np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 90)

bar = 4 * BEAT
bars = int(seconds / bar) + 2

if not STYLE:
    # ---- eski "Nasıl oynanır?" parçası (v2) ----
    chords = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]
    motif = [(72, 1), (76, 0.5), (74, 0.5), (72, 1), (67, 1), (71, 1), (74, 0.5), (72, 0.5), (71, 1), (67, 1),
             (69, 1), (72, 0.5), (71, 0.5), (69, 1), (76, 1), (77, 1), (76, 0.5), (74, 0.5), (72, 2)]
    boss_chords = [(45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62]), (40, [56, 59, 64])]
    for b in range(bars):
        t0 = b * bar; boss = in_boss(t0 + bar / 2)
        root, tri = (boss_chords if boss else chords)[b % 4]
        add(pad(tri, bar * 1.02, 0.065 if boss else 0.05), t0)
        for k in range(4):
            add(bass((root - 12 if boss else root) if k % 2 == 0 else root + (0 if boss else 12), BEAT * 0.9, 0.34 if boss else 0.28), t0 + k * BEAT)
        if b >= 1:
            for k in range(4):
                add(kick(0.7 if boss else 0.55), t0 + k * BEAT); add(hat(), t0 + k * BEAT + BEAT / 2)
                if boss: add(hat(0.035), t0 + k * BEAT + BEAT / 4); add(hat(0.035), t0 + k * BEAT + 3 * BEAT / 4)
                if k in (1, 3): add(clap(0.15 if boss else 0.12), t0 + k * BEAT)
            if boss: add(boom(), t0)
    for c in CUTS:
        add(whoosh(), max(0, c - 0.7)); add(bell(84, 1.4, 0.1), c); add(bell(79, 1.4, 0.06), c)
    t = bar; i = 0
    while t < seconds - 0.5:
        note, beats = motif[i % len(motif)]
        add(pluck(note, beats * BEAT * 1.1), t)
        if i % 5 == 0: add(bell(note + 12, 1.2), t)
        t += beats * BEAT; i += 1
else:
    # ---- teaser stilleri ----
    if STYLE == 'merak':
        chords = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]   # Am F C G
        arp = [0, 2, 1, 2, 0, 2, 1, 3]
        lead = [(76, 1.5), (74, 0.5), (72, 1), (69, 1), (72, 1.5), (74, 0.5), (76, 2), (77, 1.5), (76, 0.5), (74, 1), (72, 1), (71, 2), (74, 1), (67, 1)]
    elif STYLE == 'takim':
        chords = [(41, [57, 60, 65]), (43, [59, 62, 67]), (45, [60, 64, 69]), (48, [60, 64, 67])]   # F G Am C
        arp = [0, 1, 2, 1, 0, 1, 2, 3]
        lead = [(72, 0.5), (72, 0.5), (74, 0.5), (76, 1), (79, 1.5), (77, 0.5), (76, 0.5), (74, 1), (72, 1), (74, 0.5), (76, 0.5), (79, 1), (81, 1), (79, 2)]
    else:  # masal
        chords = [(48, [60, 64, 67]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67])]   # C Am F G
        arp = [0, 1, 2, 1]
        lead = [(79, 1), (76, 1), (77, 0.5), (76, 0.5), (74, 1), (72, 1.5), (74, 0.5), (76, 2), (77, 1), (74, 1), (76, 0.5), (74, 0.5), (72, 1), (71, 1), (72, 3)]
    stop = END if END is not None else seconds
    for b in range(bars):
        t0 = b * bar
        if t0 >= stop: break
        boss = in_boss(t0 + bar / 2)
        root, tri = chords[b % 4]
        drums = b >= 1 and t0 < stop
        if STYLE == 'masal':
            add(pad(tri, bar * 1.05, 0.055, a=0.5), t0)
            for k in range(4): add(bass(root if k % 2 == 0 else root + 7, BEAT * 1.6, 0.17), t0 + k * BEAT) if k % 2 == 0 else None
            if drums:
                for k in range(8): add(shaker(0.028 if k % 2 else 0.04), t0 + k * BEAT / 2)
                add(kick(0.28), t0); add(kick(0.2), t0 + 2.5 * BEAT)
            # müzik kutusu arpeji
            for k in range(8):
                note = tri[arp[k % len(arp)]] + 12
                add(musicbox(note, 1.2, 0.05), t0 + k * BEAT / 2)
        else:
            add(pad(tri, bar * 1.02, 0.042), t0)
            sub = 8 if STYLE == 'merak' else 4
            for k in range(sub):
                bn = root - (12 if boss else 0)
                add(bass(bn if k % 2 == 0 else bn + 12, bar / sub * 0.85, 0.27), t0 + k * bar / sub)
            # tıngırtılı arpej (16'lık)
            for k in range(16):
                quad = tri + [tri[0] + 12]; note = quad[arp[k % len(arp)]] + 12 + (12 if k % 8 == 7 else 0)
                add(pluck(note, BEAT * 0.4, 0.075 if STYLE == 'merak' else 0.05, decay=6), t0 + k * BEAT / 4)
            if drums:
                for k in range(4):
                    if STYLE == 'takim' or k in (0, 2): add(kick(0.62 if STYLE == 'takim' else 0.55), t0 + k * BEAT)
                    add(hat(0.05), t0 + k * BEAT + BEAT / 2)
                    if STYLE == 'takim': add(hat(0.03), t0 + k * BEAT + BEAT / 4); add(hat(0.03), t0 + k * BEAT + 3 * BEAT / 4)
                    if k in (1, 3): add(clap(0.14), t0 + k * BEAT)
                if STYLE == 'takim': add(stab(tri, BEAT * 0.5, 0.05), t0 + 1.5 * BEAT); add(stab(tri, BEAT * 0.5, 0.05), t0 + 3.5 * BEAT)
                if boss: add(boom(0.5), t0)
    # melodi: 2. ölçüden bitiş kartına dek
    t = bar; i = 0
    while t < stop - 0.3:
        note, beats = lead[i % len(lead)]
        if STYLE == 'masal': add(musicbox(note, beats * BEAT * 1.6, 0.11), t)
        else: add(pluck(note, beats * BEAT * 1.1, 0.13 if STYLE == 'merak' else 0.12, decay=3), t)
        if i % 6 == 0: add(bell(note + 12, 1.0, 0.05), t)
        t += beats * BEAT; i += 1
    # kanca girişi: ilk ölçü boyunca yükselen süpürme, ilk kesmede boom
    add(riser(min(bar, 2.2), 0.06), max(0, bar - min(bar, 2.2)))
    for c in CUTS:
        add(whoosh(0.5, 0.12), max(0, c - 0.5)); add(bell(84, 1.2, 0.07), c)
    for c in ACCENTS: add(tick(0.06), c)
    if END is not None:
        root, tri = chords[0]
        add(boom(0.55), END); add(whoosh(0.6, 0.14), max(0, END - 0.6))
        add(pad([x for x in tri] + [tri[0] + 12], seconds - END + 0.5, 0.07, a=0.05), END)
        add(bass(root, 2.5, 0.3), END)
        for k, nn in enumerate([tri[0] + 24, tri[1] + 24, tri[2] + 24, tri[0] + 36]):
            add(bell(nn, 2.2, 0.08), END + 0.12 * k)
        if STYLE != 'masal':
            add(kick(0.5), END)

# oda yankısı
for d, g in ((0.11, 0.22), (0.23, 0.14), (0.37, 0.07)):
    k = int(d * SR); mix[k:] += g * mix[:-k]
fade = int(0.25 * SR) if STYLE else int(0.6 * SR)
mix[:fade] *= np.linspace(0, 1, fade); tail = int(1.2 * SR); mix[-tail:] *= np.linspace(1, 0, tail)
mix /= max(1e-9, np.max(np.abs(mix))) / 0.85
pcm = (mix * 32767).astype('<i2')
stereo = np.stack([pcm, pcm], axis=1).reshape(-1)
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(stereo.tobytes())
print(f'müzik: {out_path} ({seconds:.1f} sn{", " + STYLE if STYLE else ""})')
