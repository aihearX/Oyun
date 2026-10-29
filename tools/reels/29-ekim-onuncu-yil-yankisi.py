#!/usr/bin/env python3
"""29 Ekim — «Yankı» Reels'inin sesi: anlatıcı (10. Yıl Nutku'ndan okuma + bugünün anlatısı), yankı (reverb kuyruğu) ve özgün sinematik müzik.

Kullanım: python3 tools/reels/29-ekim-onuncu-yil-yankisi.py <çıktı.wav> <zaman.json>
  - Anlatıcı satırları: tools/reels/vo/29-ekim-onuncu-yil-yankisi/<id>.mp3 (tools/reels/vo.py ile üretilir; Chatterbox Multilingual, sentetik ses).
  - Zaman çizelgesi (satır başı/sonu, toplam süre) <zaman.json>'a yazılır; sahne (29-ekim-onuncu-yil-yankisi.html) aynı çizelgeyle çizilir.
  - Müzik: tamamen özgün; FluidSynth (libfluidsynth, ctypes) + GM ses bankası /usr/share/sounds/sf2/TimGM6mb.sf2 (GPL-2, yalnız örnek
    sesler; besteleme bu dosyada) ile piyano, yaylılar, koro, korno, timpani; numpy ile oda yankısı, nefes/yükselme dokuları.
    İstiklal Marşı, 10. Yıl Marşı, herhangi bir şarkı ya da kayıt ve Atatürk'ün arşiv ses kaydı KULLANILMAZ.
  - Anlatıcı altında müzik kısılır (duck); alıntılarda anlatıcıya hafif yankı kuyruğu (nutkun "yankısı"), bugünün satırları daha kuru.
Re minör → doruğa B♭–C–Re majör (pikardi) kadansı.
"""
import ctypes, json, os, subprocess, sys, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, 'vo', '29-ekim-onuncu-yil-yankisi')
SF2 = '/usr/share/sounds/sf2/TimGM6mb.sf2'
out_wav, out_tl = sys.argv[1], sys.argv[2]
RNG = np.random.default_rng(29)

# ------------------------------------------------------------------ anlatı ve zaman çizelgesi
ORDER = ['n1', 'n2', 'n3', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'n4', 'n5', 'n6', 'n7']
GAP = {'n1': 0.9, 'n2': 0.45, 'n3': 0.8, 'q1': 1.35, 'q2': 0.5, 'q3': 0.4, 'q4': 0.45, 'q5': 1.45, 'q6': 1.35, 'q7': 0.3,
       'n4': 1.55, 'n5': 1.05, 'n6': 0.5, 'n7': 1.9}
TAIL = 4.3   # n7 sonrası: bayrak 2,1 sn + ayrı ODİ karesi 2,2 sn
MAXDUR = 59.0


# ağır, tok okuma: alıntılar %5, ünlemler %8, bugünün satırları %2 yavaşlatılır (rubberband, perde değişmez).
# q5 yavaşlatılmaz: yavaşlatılmış + yankılı hâlinde Whisper "muasır"ı "muazır/muhasır" duydu (özgün hız + yankı: doğru)
TEMPO = {'q1': 0.92, 'q4': 0.92, 'q5': 1.0, 'n1': 0.98, 'n2': 0.98, 'n3': 0.98, 'n4': 0.98, 'n5': 0.98, 'n6': 0.98, 'n7': 0.98}


def load(path, tempo=1.0):
    af = ['-af', f'rubberband=tempo={tempo}:pitchq=quality:transients=smooth'] if tempo != 1.0 else []
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, *af, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).astype(np.float64)


V = {i: load(os.path.join(VO, f'{i}.mp3'), TEMPO.get(i, 0.95)) for i in ORDER}
speech = sum(len(v) / SR for v in V.values())
gsum = sum(GAP.values())
over = speech + gsum + TAIL - MAXDUR
k = 1.0 if over <= 0 else max(0.55, (gsum - over) / gsum)
t = 0.0; TL = {}
for i in ORDER:
    t += GAP[i] * (k if i != 'n1' else 1.0); TL[i] = [round(t, 3), round(t + len(V[i]) / SR, 3)]; t = TL[i][1]
END = round(t + TAIL, 2)
json.dump({'L': TL, 'END': END}, open(out_tl, 'w'), indent=1)
print(f'anlatı {speech:.1f} sn, aralık ölçeği {k:.2f}, toplam {END:.2f} sn')
N = int((END + 0.5) * SR)
L = lambda i: TL[i][0]
E = lambda i: TL[i][1]


# ------------------------------------------------------------------ yardımcılar
def fftconv(x, h):
    n = len(x) + len(h) - 1; m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:n]


def lowpass(x, hz):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / hz) ** 4); return np.fft.irfft(X, len(x))


def highpass(x, hz):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (hz / np.maximum(f, 1e-3)) ** 4); return np.fft.irfft(X, len(x))


def ir(sec, damp_hz=5000, pre=0.02, seed=1):
    """sentetik oda/salon yankısı: üstel sönümlü, zamanla kararan stereo gürültü"""
    r = np.random.default_rng(seed); n = int(sec * SR); tt = np.arange(n) / SR
    outs = []
    for ch in range(2):
        nz = r.standard_normal(n) * np.exp(-6.9 * tt / sec)
        # zamanla kararma: iki bant karışımı
        lo = lowpass(nz, damp_hz * 0.35); hi = nz
        w = np.clip(tt / sec * 1.6, 0, 1); x = hi * (1 - w) + lo * w
        x = np.concatenate([np.zeros(int(pre * SR)), x]); outs.append(x / np.sqrt(np.sum(x ** 2)))
    return outs


def reverb_st(x, sec, wet, damp=5000, pre=0.02, seed=1):
    h = ir(sec, damp, pre, seed); return [fftconv(x, h[c])[:len(x)] * wet for c in range(2)]


# ------------------------------------------------------------------ anlatıcı izi
voL = np.zeros(N); voR = np.zeros(N); dry = np.zeros(N); qbus = np.zeros(N); nbus = np.zeros(N)
for i in ORDER:
    v = V[i]; v = highpass(v, 70)
    s = int(L(i) * SR); dry[s:s + len(v)] += v
    (qbus if i.startswith('q') else nbus)[s:s + len(v)] += v
# alıntılar: salon yankısı + yumuşak tek tekrar (0,38 sn, alçak geçiren) → "yankı"
# yankı gönderimi satır içinde çok düşük (sözcükler net kalsın: Whisper "muasır"ı yankılı karışımda "muazır" duydu), son 0,8 sn'de tama
# çıkar → yankı esas olarak cümle sonlarından taşar
send = np.full(N, 0.1)
for i in ORDER:
    if not i.startswith('q'): continue
    a_, b_ = int((E(i) - 0.7) * SR), int(E(i) * SR); send[a_:b_] = np.linspace(0.1, 1.0, b_ - a_); send[b_:b_ + int(0.3 * SR)] = 1.0
qs = qbus * send
qr = reverb_st(qs, 3.2, 0.36, damp=4200, pre=0.03, seed=3)
echo = np.zeros(N); d = int(0.38 * SR); echo[d:] = lowpass(qs, 2600)[:-d] * 0.18
d2 = int(0.76 * SR); echo[d2:] += lowpass(qs, 1800)[:-d2] * 0.07
nr = reverb_st(nbus, 1.4, 0.13, damp=6000, pre=0.012, seed=4)
voL = dry + qr[0] + echo * 0.9 + nr[0]; voR = dry + qr[1] + np.roll(echo, int(0.011 * SR)) * 0.9 + nr[1]
vo_peak = np.max(np.abs(dry)); voL /= vo_peak; voR /= vo_peak

# ------------------------------------------------------------------ duck zarfı (anlatı varken müzik −9 dB, n7’de −17 dB)
envv = np.zeros(N)
for i in ORDER: envv[int((L(i) - 0.12) * SR):int((E(i) + 0.25) * SR)] = 1
kern = np.hanning(int(0.35 * SR)); kern /= kern.sum(); envv = fftconv(envv, kern)[len(kern) // 2:len(kern) // 2 + N]
# doruk satırında (n7) müzik en yüksek yerinde: anlatı net kalsın diye 8 dB daha kısılır
env7 = np.zeros(N); env7[int((L('n7') - 0.2) * SR):int((E('n7') + 0.3) * SR)] = 1; env7 = fftconv(env7, kern)[len(kern) // 2:len(kern) // 2 + N]
duck = 10 ** ((-9 * envv - 8 * env7) / 20)

# ------------------------------------------------------------------ müzik (FluidSynth)
lib = ctypes.CDLL('libfluidsynth.so.3')
vp, ci, cd = ctypes.c_void_p, ctypes.c_int, ctypes.c_double
lib.new_fluid_settings.restype = vp; lib.new_fluid_synth.restype = vp; lib.new_fluid_synth.argtypes = [vp]
lib.fluid_settings_setnum.argtypes = [vp, ctypes.c_char_p, cd]; lib.fluid_settings_setint.argtypes = [vp, ctypes.c_char_p, ci]
lib.fluid_synth_sfload.argtypes = [vp, ctypes.c_char_p, ci]
lib.fluid_synth_noteon.argtypes = [vp, ci, ci, ci]; lib.fluid_synth_noteoff.argtypes = [vp, ci, ci]
lib.fluid_synth_program_change.argtypes = [vp, ci, ci]; lib.fluid_synth_cc.argtypes = [vp, ci, ci, ci]
lib.fluid_synth_write_float.argtypes = [vp, ci, vp, ci, ci, vp, ci, ci]
lib.fluid_synth_set_gain.argtypes = [vp, ctypes.c_float]

# her çalgı ayrı bir sentezleyicide → ayrı iz (karışım, yankı, kısma ayrı ayarlanır)
INST = {'piano': 0, 'str': 48, 'slow': 49, 'cello': 42, 'bass': 43, 'choir': 52, 'horn': 60, 'tbn': 57, 'timp': 47, 'bell': 14, 'pizz': 45, 'harp': 46}
EV = {k: [] for k in INST}   # (zaman, tür, a, b)


def note(inst, tt, n, d, vel=80):
    EV[inst].append((tt, 1, n, vel)); EV[inst].append((tt + d, 0, n, 0))


def chord(inst, tt, ns, d, vel=70):
    for n in ns: note(inst, tt, n, d, vel)


def expr(inst, t0, t1, v0, v1, step=0.04):
    """CC11 ifade rampası (yaylı/koro kabarması)"""
    nn = max(1, int((t1 - t0) / step))
    for j in range(nn + 1):
        x = j / nn; EV[inst].append((t0 + (t1 - t0) * x, 2, 11, int(v0 + (v1 - v0) * (x * x * (3 - 2 * x)))))


def render(inst):
    st = lib.new_fluid_settings(); lib.fluid_settings_setnum(st, b'synth.sample-rate', float(SR))
    lib.fluid_settings_setint(st, b'synth.reverb.active', 0); lib.fluid_settings_setint(st, b'synth.chorus.active', 0)
    lib.fluid_settings_setint(st, b'synth.polyphony', 256)
    sy = lib.new_fluid_synth(st); lib.fluid_synth_sfload(sy, SF2.encode(), 1); lib.fluid_synth_set_gain(sy, ctypes.c_float(0.5))
    lib.fluid_synth_program_change(sy, 0, INST[inst]); lib.fluid_synth_cc(sy, 0, 7, 110); lib.fluid_synth_cc(sy, 0, 11, 100)
    ev = sorted(EV[inst], key=lambda e: (e[0], e[1] != 2, e[1]))  # ifade önce, sonra note-off, sonra note-on
    bufL = np.zeros(N, np.float32); bufR = np.zeros(N, np.float32); pos = 0
    def adv(to):
        nonlocal pos
        to = min(N, to)
        while pos < to:
            n = min(4096, to - pos); l = np.zeros(n, np.float32); r = np.zeros(n, np.float32)
            lib.fluid_synth_write_float(sy, n, l.ctypes.data, 0, 1, r.ctypes.data, 0, 1)
            bufL[pos:pos + n] = l; bufR[pos:pos + n] = r; pos += n
    for tt, kind, a, b in ev:
        adv(int(max(0, tt) * SR))
        if kind == 1: lib.fluid_synth_noteon(sy, 0, a, b)
        elif kind == 0: lib.fluid_synth_noteoff(sy, 0, a)
        else: lib.fluid_synth_cc(sy, 0, a, b)
    adv(N)
    return np.stack([bufL, bufR]).astype(np.float64)


# notalar (MIDI): Re minör
D2, F2, G2, A2, Bb1, C2 = 38, 41, 43, 45, 34, 36
def tri(root, minor=True, oct_=0):
    r = root + 12 * oct_; return [r, r + (3 if minor else 4), r + 7]


Dm, Bb, F, C, Gm, A, Dmaj = tri(50), tri(46, False), tri(53, False), tri(48, False), tri(55), tri(45, False), tri(50, False)
bassof = {'Dm': 38, 'Bb': 34, 'F': 41, 'C': 36, 'Gm': 43, 'A': 33, 'D': 38}
CH = {'Dm': Dm, 'Bb': Bb, 'F': F, 'C': C, 'Gm': Gm, 'A': A, 'D': Dmaj}


def bed(t0, t1, name, vel=62, inst='slow', cello=True, bass=True, up=0):
    ns = [n + up for n in CH[name]]
    chord(inst, t0, ns + [ns[0] + 12], t1 - t0 + 0.25, vel)
    if cello: note('cello', t0, bassof[name] + 12, t1 - t0 + 0.2, vel - 4)
    if bass: note('bass', t0, bassof[name], t1 - t0 + 0.2, vel - 8)


# --- 1) 1933: karanlıktan açılış. Re pedal + seyrek piyano, her yankı halkasında yumuşak çan
A2s = L('n3') - 0.5; A3s = L('q1') - 0.9; A4s = L('q5') - 0.8; A5s = L('q6') - 0.9; A6s = L('n5') - 0.6; A7s = L('n7') - 1.7; A8s = END - 2.2
note('bass', 0.0, 38, A2s + 0.4, 58); note('cello', 0.2, 50, A2s + 0.2, 50)
expr('slow', 0.0, 2.5, 30, 92); chord('slow', 0.0, [57, 62, 65], 4.3, 50); chord('slow', 4.2, [58, 62, 65], 3.6, 52)
for tt, n in [(0.35, 74), (1.45, 69), (2.3, 72), (3.2, 69), (4.3, 70), (5.35, 74), (6.3, 77), (7.0, 76)]:
    if tt < A2s + 0.4: note('piano', tt, n, 1.6, 52)
note('bell', L('n1') - 0.02, 62, 3.0, 50)
# --- 2) "Ve Atatürk milletine seslenir": Gm → A (gerilim, dominant)
bed(A2s, A2s + (A3s - A2s) * 0.55, 'Gm', 60); bed(A2s + (A3s - A2s) * 0.55, L('q1') - 0.1, 'A', 64)
expr('slow', A2s, L('q1') - 0.2, 80, 104)
note('timp', L('q1') - 1.2, 33, 1.0, 40); note('timp', L('q1') - 0.6, 33, 1.0, 55)
# --- 3) Nutuk 1: Dm – B♭ – F – C; koro q3'te girer, "Kutlu olsun!" F majöre açılır
q = [L('q1') - 0.05, L('q2') - 0.1, L('q3') - 0.1, L('q4') - 0.1, L('q5') - 0.6]
for (a, b), nm in zip(zip(q[:-1], q[1:]), ['Dm', 'Bb', 'Gm', 'F']):
    bed(a, b, nm, 66, inst='str')
expr('str', q[0], q[3], 82, 100)
for j, (tt, n) in enumerate([(q[0] + 0.05, 74), (q[1] + 0.1, 70), (q[1] + 1.4, 72), (q[2] + 0.1, 74), (q[2] + 1.6, 77), (q[3] + 0.05, 81)]):
    note('piano', tt, n, 1.8, 58 + 2 * j)
chord('choir', q[2], [62, 67, 70], q[3] - q[2] + 0.2, 52); chord('choir', q[3], [65, 69, 72], q[4] - q[3] + 0.5, 60)
expr('choir', q[2], q[3] + 0.5, 60, 96)
note('timp', q[3] - 0.02, 41, 1.6, 70); note('bell', q[3], 65, 3, 46); chord('horn', q[3], [53, 57, 60], 1.9, 62)
# --- 4) Nutuk 2 (q5): B♭ – F – C – A, ileriye bakan yükseliş
b5 = [L('q5') - 0.6, L('q5') + 1.4, L('q5') + 2.8, E('q5') + 0.2, L('q6') - 0.3]
for (a, b), nm in zip(zip(b5[:-1], b5[1:]), ['Bb', 'F', 'C', 'A']):
    bed(a, b, nm, 64, inst='str')
for tt, n in [(b5[0] + 0.1, 70), (b5[0] + 0.9, 74), (b5[1] + 0.1, 77), (b5[2] + 0.1, 79), (b5[3] + 0.1, 76)]:
    note('piano', tt, n, 1.6, 60)
chord('choir', b5[0], [62, 65, 70], b5[3] - b5[0], 46)
# --- 5) Nutuk 3 → zaman: her "on senede" bir yankı; pizzicato nabız + koro ve yaylı kabarması, 93 yıl'da F majör
d0, d1 = L('q6') + 0.3, E('q7') - 0.2
decades = [d0 + (d1 - d0) * j / 8 for j in range(9)]
prog = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'A']
for j, dd in enumerate(decades):
    nxt = decades[j + 1] if j < 8 else L('n4') - 0.1
    bed(dd - 0.05, nxt, prog[j], 58 + 3 * j, inst='str')
    note('bell', dd, [62, 65, 69, 67, 62, 65, 70, 69, 73][j], 2.6, 40 + 3 * j)
    note('timp', dd, bassof[prog[j]] - 2 if prog[j] in ('Dm', 'C') else bassof[prog[j]], 1.2, 40 + 5 * j)
# pizzicato nabız (≈ 92 vuruş/dk) q6 başından n4'e
pt = L('q6') - 0.2; beat = 60 / 92
while pt < L('n4') - 0.15:
    cur = next((prog[j] for j in range(8, -1, -1) if pt >= decades[j] - 0.05), 'Dm')
    note('pizz', pt, CH[cur][0] - 12 + (7 if int(pt / beat) % 2 else 0), 0.3, 64); pt += beat
expr('str', d0, L('n4'), 70, 112); chord('choir', d0 + (d1 - d0) * 0.4, [62, 65, 69], L('n4') - (d0 + (d1 - d0) * 0.4), 50)
expr('choir', d0 + (d1 - d0) * 0.4, L('n4'), 50, 100)
# 93 yıl: F majör geniş akor + korno
bed(L('n4') - 0.1, A6s + 0.4, 'F', 74, inst='str'); chord('horn', L('n4') - 0.1, [53, 57, 60, 65], A6s - L('n4') + 0.4, 66)
note('timp', L('n4') - 0.1, 41, 2.0, 84); chord('choir', L('n4') - 0.1, [65, 69, 72], A6s - L('n4') + 0.4, 70)
expr('str', A6s - 0.6, A6s + 0.4, 112, 40)
# --- 6) "Bazı sesler kulaktan silinir": incelip susar; "yankılanır": tek yüksek nota + çan yankıları, doruğa kabarma
note('slow', A6s + 0.2, 81, E('n5') - A6s, 46); expr('slow', A6s + 0.2, E('n5') + 0.2, 90, 10)
for j in range(5): note('piano', L('n6') + 0.5 + 0.42 * j, [74, 69, 74, 69, 74][j], 2.5, 54 - 6 * j)
for j in range(3): note('bell', L('n6') + 0.5 + 0.84 * j, 74, 3.0, 44 - 8 * j)
# doruk öncesi kabarma: B♭ → C (♭VI–♭VII)
bed(E('n6') + 0.1, A7s + 0.9, 'Bb', 62, inst='str'); expr('str', E('n6') + 0.1, A7s + 0.9, 30, 118)
chord('choir', E('n6') + 0.1, [62, 65, 70], A7s + 0.9 - E('n6'), 52); expr('choir', E('n6') + 0.1, A7s + 0.9, 30, 110)
for j in range(6): note('timp', A7s - 0.9 + 0.15 * j, 36, 0.3, 50 + 10 * j)
# --- 7) bayrak: C → Re majör (pikardi) doruk, tam orkestra; uzun sönüş ODİ karesine taşar
c7 = A7s + 0.9
bed(c7, c7 + 1.3, 'C', 92, inst='str'); chord('horn', c7, [48, 55, 60, 64], 1.3, 92); chord('tbn', c7, [36, 43, 48], 1.3, 84)
chord('choir', c7, [60, 64, 67, 72], 1.3, 92); note('timp', c7, 36, 1.2, 110)
dm = c7 + 1.3
bed(dm, END + 0.3, 'D', 100, inst='str'); chord('str', dm, [62, 66, 69, 74, 78], END - dm + 0.3, 92)
chord('horn', dm, [50, 57, 62, 66], A8s - dm + 1.0, 100); chord('tbn', dm, [38, 45, 50], A8s - dm + 0.6, 92)
chord('choir', dm, [62, 66, 69, 74], A8s - dm + 1.5, 100); note('timp', dm, 38, 2.5, 124); note('timp', dm + 0.02, 26, 2.5, 100)
for tt in (L('n7') + 0.05, E('n7') - 0.2): note('timp', tt, 38, 1.4, 96)
for j, n in enumerate([74, 78, 81, 86]): note('piano', dm + 0.25 * j, n, 2.5, 70)
expr('str', dm, A8s - 0.4, 124, 110); expr('str', A8s - 0.4, END, 110, 40)
expr('choir', dm, A8s, 120, 100); expr('choir', A8s, END, 100, 20)
expr('horn', dm, A8s, 115, 70); expr('tbn', dm, A8s, 110, 50)
# ODİ karesi: tek piyano Re + çan
note('piano', A8s + 0.3, 62, 2.0, 58); note('piano', A8s + 0.3, 74, 2.0, 50); note('bell', A8s + 0.32, 74, 2.0, 34)

# stem render ve karışım (kazanç, pan, yankı)
# (tepe hedefi, pan, yankı): her iz önce kendi tepesine göre ölçeklenir (ses bankasındaki çalgı düzeyleri çok farklı)
MIX = {'piano': (0.26, -0.15, 0.30), 'str': (0.30, 0.0, 0.32), 'slow': (0.20, 0.0, 0.34), 'cello': (0.17, 0.2, 0.25), 'bass': (0.17, 0.1, 0.2),
       'choir': (0.19, -0.05, 0.42), 'horn': (0.20, 0.25, 0.32), 'tbn': (0.13, 0.3, 0.3), 'timp': (0.36, 0.0, 0.28),
       'bell': (0.11, 0.25, 0.45), 'pizz': (0.13, -0.25, 0.25), 'harp': (0.12, -0.3, 0.3)}
mus = np.zeros((2, N))
for inst, (g, pan, rv) in MIX.items():
    if not EV[inst]: continue
    s = render(inst); s = s / max(1e-9, np.max(np.abs(s))) * g
    s[0] *= np.sqrt(0.5 * (1 - pan)) * 1.414; s[1] *= np.sqrt(0.5 * (1 + pan)) * 1.414
    mus += s; mono = s.mean(0); r = reverb_st(mono, 3.6, rv, damp=4500, pre=0.025, seed=11 + len(inst))
    mus[0] += r[0]; mus[1] += r[1]
    print('çalgı', inst, f'{np.max(np.abs(s)):.3f}', flush=True)

# numpy dokuları: açılışta nefes, bayrak öncesi yükselen dalga + alt vuruş
tt = np.arange(N) / SR
def swell(t0, t1, lo, hi, vol, p=2.0):
    i0, i1 = int(t0 * SR), int(t1 * SR); n = i1 - i0; x = RNG.standard_normal(n)
    x = highpass(lowpass(x, hi), lo) * (np.arange(n) / n) ** p * vol; return i0, x
for (t0, t1, lo, hi, vol) in [(A7s - 1.2, c7, 300, 6000, 0.05), (L('q1') - 1.5, L('q1') - 0.05, 400, 5000, 0.025), (L('n4') - 1.4, L('n4') - 0.1, 400, 5000, 0.03)]:
    i0, x = swell(t0, t1, lo, hi, vol); mus[0, i0:i0 + len(x)] += x; mus[1, i0:i0 + len(x)] += x[::-1] * 0.9
def boom(t0, vol=0.5, f=42, d=2.2):
    i0 = int(t0 * SR); n = int(d * SR); x = np.sin(2 * np.pi * f * np.arange(n) / SR * (1 - 0.2 * np.arange(n) / n)) * np.exp(-np.arange(n) / SR * 2.4) * vol
    mus[0, i0:i0 + n] += x; mus[1, i0:i0 + n] += x
boom(c7, 0.35); boom(dm, 0.55); boom(L('q1') - 0.05, 0.22, 46); boom(L('n4') - 0.1, 0.3, 44)
# hafif bant/film tıslaması (arşiv hissi), yalnız 1933 bölümlerinde
hiss = highpass(RNG.standard_normal(N), 2500) * 0.0035 * np.clip(1 - (tt - A6s) / 1.0, 0, 1)
mus += hiss

# ------------------------------------------------------------------ karışım
mus = np.stack([highpass(mus[0], 32), highpass(mus[1], 32)])  # alt uçtaki çamuru temizle
m_rms = np.sqrt(np.mean(mus ** 2)); mus = mus / m_rms * 0.075
mus *= duck
fade = np.clip((END - tt) / 1.2, 0, 1) ** 1.5; fin = np.clip(tt / 0.25, 0, 1)
mix = np.stack([voL, voR]) * 0.42 + mus
mix *= fade * fin
pk = np.max(np.abs(mix)); mix = mix / pk * 0.89
with wave.open(out_wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
# yalnız anlatıcı (denetim için)
with wave.open(out_wav[:-4] + '-vo.wav', 'wb') as w:
    vv = np.stack([voL, voR]) * 0.42 / pk * 0.89
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(vv.T, -1, 1) * 32767).astype('<i2').tobytes())
with wave.open(out_wav[:-4] + '-muzik.wav', 'wb') as w:
    mm = mus * fade * fin / pk * 0.89
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mm.T, -1, 1) * 32767).astype('<i2').tobytes())
print('yazıldı', out_wav, f'{END:.2f} sn')
