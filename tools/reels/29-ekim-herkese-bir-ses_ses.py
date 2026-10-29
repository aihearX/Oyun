#!/usr/bin/env python3
"""«Cumhuriyet herkese bir ses verdi» (29 Ekim, 103. yıl) — zaman çizelgesi + özgün müzik + anlatıcı karışımı.

Kullanım: python3 tools/reels/29-ekim-herkese-bir-ses_ses.py <çıktı.wav> <zaman.json>
  - Anlatıcı satırları: tools/reels/vo/29-ekim-herkese-bir-ses/<id>.wav (29-ekim-herkese-bir-ses_vo.py üretir).
  - Zaman çizelgesi satır sürelerinden hesaplanır ve sahneye (29-ekim-herkese-bir-ses.html) zaman.json olarak verilir:
    her sahnenin "sessiz" başlangıcı, "sesin açıldığı" an (U), satır başı/sonu, altyazı, ses zarfı (dalga motifi için, 30 kare/sn).
Tasarım fikri — "sesin açılması": her sahne sessiz/boğuk başlar (müzik ~300 Hz alçak geçiren süzgeçten, fotoğraf karanlık ve
bulanık); anlatıcı konuşmaya başlarken süzgeç ~0,9 sn'de açılır (boğuk → net; işitme cihazı/kulak tıkanıklığının açılması gibi
hafif bir odyoloji benzetmesi), fotoğraf netleşir, altyazı altındaki dalga canlanır. Anlatıcının kendisi hep nettir (anlaşılırlık).
Müzik tamamen numpy sentezi (reklam_ses.py çalgıları): Re minör → Fa majör → Si bemol majör; piyano, yaylılar, koro dokusu, timpani.
Hiçbir marş, şarkı ya da kayıt (İstiklal Marşı, 10. Yıl Marşı, arşiv ses kayıtları) kullanılmamış, alıntılanmamış ya da uyarlanmamıştır.
"""
import json, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reklam_ses
from reklam_ses import SR, Bus, T, noise, pad, choir, brass, piano, bell, glock, taiko


def fftfilt(x, lo=None, hi=None, order=2, peak=None):
    """reklam_ses.fftfilt ile aynı yanıt; FFT boyu 2'nin kuvvetine tamamlanır (asal uzunlukta FFT çok yavaş kalıyordu)"""
    if len(x) < 8: return x
    n = len(x); N = 1 << int(np.ceil(np.log2(n))); X = np.fft.rfft(x, N); f = np.fft.rfftfreq(N, 1 / SR); H = np.ones_like(f)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if peak:
        fc, g, bw = peak; H *= 1 + (10 ** (g / 20) - 1) * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / (bw / 2)) ** 2)
    return np.fft.irfft(X * H, N)[:n]


reklam_ses.fftfilt = fftfilt  # çalgılar da hızlı sürümü kullansın (sonuç aynı)
reverb = reklam_ses.reverb


def sub(note, d, vol=0.5):
    """alt bas: reklam_ses.sub'un %45'i (yoksa karışımda baskın kalıp orta frekansları gömüyordu)"""
    return reklam_ses.sub(note, d, vol * 0.45)

HERE = os.path.dirname(os.path.abspath(__file__))
VOD = os.environ.get('HBS_VOD') or os.path.join(HERE, 'vo', '29-ekim-herkese-bir-ses')
out_wav, out_json = sys.argv[1], sys.argv[2]

# ekranda görünen altyazı (sayılar rakamla); söylenen metin metin.json'da
SUB = {
    'h1': 'Bir zamanlar bu topraklarda,<br>pek çok ses duyulmazdı.',
    'c1': 'Bir çocuğun sesi… harflerle buluştu.',
    'k1': 'Bir kadının sesi… sandıkta yankılandı.',
    'm1': 'Ve bir milletin sesi…<br>kendi meclisinde yükseldi.',
    'm2': '29 Ekim 1923.',
    'm3': 'Bu sesin adı: Cumhuriyet.',
    'o1': 'Biz işitme uzmanları iyi biliriz:<br>Duyulmak, var olmaktır.',
    'o2': 'Cumhuriyet, bir milletin<br>kendi sesiyle duyulmasıdır.',
    'f1': '103 yıldır… hepimizin sesi.',
    'f2': 'Cumhuriyetimizin 103. yılı,<br>kutlu olsun!',
}


def load(id_):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(VOD, id_ + '.wav'), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, '<f4').astype(np.float64)


V = {k: load(k) for k in SUB}


def pause(x, extra, lo=0.25, hi=0.75):
    """virgüldeki iç duraksamayı uzatır (dramatik nefes): ortadaki en uzun sessiz bölgenin ortasına sessizlik ekler"""
    h = int(0.01 * SR); n = len(x) // h
    db = 20 * np.log10(np.array([np.sqrt(np.mean(x[i * h:(i + 1) * h] ** 2)) for i in range(n)]) + 1e-7)
    q = db < db.max() - 32; best = (0, 0); run = 0
    for i in range(int(n * lo), int(n * hi)):
        run = run + 1 if q[i] else 0
        if run > best[0]: best = (run, i)
    if best[0] < 4: return x, None  # belirgin duraksama yok
    cut = (best[1] - best[0] // 2) * h
    return np.concatenate([x[:cut], np.zeros(int(extra * SR)), x[cut:]]), cut / SR


PAUSE = {'c1': 0.45, 'k1': 0.45, 'm1': 0.4, 'm3': 0.3, 'o1': 0.3, 'f1': 0.35, 'f2': 0.3}
RANGE = {'f2': (0.5, 0.9), 'o1': (0.4, 0.75)}  # "Bir çocuğun sesi … harflerle buluştu."
PAT = {}
for k, e in PAUSE.items():
    V[k], at = pause(V[k], e, *RANGE.get(k, (0.25, 0.75))); print('duraksama', k, at)
    if at is not None: PAT[k] = at + e  # duraksamadan sonraki sözcüğün başı (satır içinde)
dur = {k: len(x) / SR for k, x in V.items()}

# ------------------------------------------------------------------ zaman çizelgesi (satır sürelerinden)
L = {}
def put(k, t): L[k] = (round(t, 3), round(t + dur[k], 3)); return t + dur[k]

S = {}                                   # sahne başları ve sesin açıldığı anlar (U)
S['hook'] = 0.0
e = put('h1', 1.7)                       # karanlıkta tek fotoğraf belirir; hâlâ "sessiz"
S['U2'] = e + 0.95                       # 1. açılma: harfler (kara tahta) — kamera geri çekilir
e = put('c1', S['U2'] + 0.25)
S['c_alt'] = e + 0.55                    # aynı sahnede ikinci fotoğraf: sınıf (1931)
S['kad'] = S['c_alt'] + 3.1              # kadınlar sahnesi (sessiz başlar)
S['U3'] = S['kad'] + 0.95
e = put('k1', S['U3'] + 0.25)
S['mil'] = e + 2.75                      # millet sahnesi: Meclis binası (sessiz başlar)
S['U4'] = S['mil'] + 0.95
e = put('m1', S['U4'] + 0.25)
e = put('m2', e + 0.85)                  # 29 Ekim 1923 — büyük tarih
e = put('m3', e + 0.65)                  # "Bu sesin adı: Cumhuriyet."
S['cum'] = L['m3'][0] + PAT.get('m3', dur['m3'] * 0.5) - 0.05  # "Cumhuriyet" sözcüğüne vuruş
S['dur'] = e + 1.7                       # odyoloji köprüsü (sessiz başlar)
S['U5'] = S['dur'] + 1.0
e = put('o1', S['U5'] + 0.25)
e = put('o2', e + 0.85)
S['flag'] = e + 1.25                     # doruk: bayrak
e = put('f1', S['flag'] + 0.9)
e = put('f2', e + 0.75)
S['odi'] = e + 1.9                       # ayrı son kare: küçük ODİ imzası
TOTAL = round(S['odi'] + 2.6, 2)
S = {k: round(v, 3) for k, v in S.items()}
print('süre', TOTAL, 'sn;', json.dumps(S))

# ------------------------------------------------------------------ müzik
bus = Bus(TOTAL + 4)
Dm, Bb, F, C, Gm, Am, Eb = [50, 57, 62, 65], [46, 58, 62, 65], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 58, 62], [45, 57, 60, 64], [39, 55, 58, 63]


def strings(notes, d, vol=0.07, a=0.8, r=1.0, cut=2400): return pad(notes, d, vol=vol, a=a, r=r, cut=cut, kind='saw')
def soft(notes, d, vol=0.06, a=1.2, r=1.2): return pad(notes, d, vol=vol, a=a, r=r, cut=1800, kind='tri')
def swell(d, vol=0.10, lo=300, hi=5000, p=2.0): t = T(d); return vol * fftfilt(noise(d), lo=lo, hi=hi) * (t / d) ** p


def timp_roll(t0, t1, v0=0.04, v1=0.3, f0=43.65):
    t = t0
    while t < t1:
        p = (t - t0) / (t1 - t0); bus.add(taiko(v0 + (v1 - v0) * p ** 1.6, f0=f0, d=0.9), t, rev=0.35); t += 0.075


def motif(t0, notes, gap=0.42, vol=0.12, d=2.6, pan=0.1):
    """"ses" motifi: yükselen 4 nota (La–Re–Mi–Fa) — her açılmada duyulur, sonda doruğa taşınır"""
    for q, n in enumerate(notes): bus.add(piano(n, d, vol * (1 - 0.06 * q)), t0 + q * gap, pan=pan, rev=0.55)


# 1) kanca: neredeyse sessizlik — alçak yaylı yatak, seyrek piyano (sahne boğuk)
bus.add(soft([38, 45, 50], S['U2'] + 0.8, 0.07, a=2.5, r=1.0), 0.0, rev=0.5)
bus.add(sub(38, S['U2'], 0.12) * np.linspace(0, 1, int(S['U2'] * SR)) ** 1.4, 0.2)
for tt, n in ((1.0, 62), (2.6, 65), (4.4, 69)): bus.add(piano(n, 3.0, 0.10), tt, rev=0.6)

# 2) çocuk / harfler — Re minör → Si bemol, motif
u = S['U2']; d2 = S['kad'] - u
motif(u, [57, 62, 64, 65])
for j, (ch, tt) in enumerate(((Dm, u), (Bb, u + d2 * 0.33), (F, u + d2 * 0.62))):
    dd = d2 * 0.36 + 0.6 if j < 2 else S['kad'] - tt + 0.8
    bus.add(soft(ch[1:], dd, 0.065, a=0.7, r=0.9), tt, rev=0.45); bus.add(sub(ch[0] - 12 if ch[0] > 44 else ch[0], dd, 0.14), tt)
for tt, n in ((S['c_alt'], 72), (S['c_alt'] + 0.6, 69), (S['c_alt'] + 1.2, 74)): bus.add(piano(n, 2.2, 0.09), tt, pan=-0.15, rev=0.55)
bus.add(glock(86, 1.2, 0.025), S['c_alt'], rev=0.8)

# 3) kadın / sandık — sessiz giriş, açılmada motif + çello benzeri alçak yaylı ezgi
bus.add(soft([45, 52, 57], S['U3'] - S['kad'] + 0.5, 0.05, a=0.4, r=0.6), S['kad'], rev=0.5)
u = S['U3']; d3 = S['mil'] - u
motif(u, [57, 62, 64, 67], vol=0.12)
for j, (ch, tt) in enumerate(((Gm, u), (Eb, u + d3 * 0.35), (F, u + d3 * 0.68))):
    dd = d3 * 0.36 + 0.6 if j < 2 else S['mil'] - tt + 0.8
    bus.add(strings(ch[1:], dd, 0.055, a=0.6, r=0.9, cut=2000), tt, rev=0.45); bus.add(sub(ch[0] if ch[0] < 44 else ch[0] - 12, dd, 0.15), tt)
for tt, n, d in ((u + 0.3, 50, 1.6), (u + 1.9, 53, 1.4), (u + 3.3, 55, 1.6), (u + 4.9, 57, 2.4)):
    bus.add(strings([n], d + 0.3, 0.05, a=0.3, r=0.6, cut=1400), tt, pan=-0.25, rev=0.5)

# 4) millet / Meclis — koro dokusu, timpani; 29 Ekim 1923 ve "Cumhuriyet" vuruşu
bus.add(soft([38, 45, 50], S['U4'] - S['mil'] + 0.5, 0.05, a=0.4, r=0.6), S['mil'], rev=0.5)
u = S['U4']
motif(u, [57, 62, 64, 69], vol=0.13)
bus.add(choir([50, 57, 62], L['m2'][0] - u + 0.8, 0.035, a=1.2), u, rev=0.6)
bus.add(strings(Dm[1:], L['m2'][0] - u + 0.6, 0.06, a=0.8, r=0.8), u, rev=0.45); bus.add(sub(38, L['m2'][0] - u, 0.16), u)
t2 = L['m2'][0]
bus.add(taiko(0.55, f0=43.65, d=1.6), t2 - 0.05, rev=0.5)
bus.add(strings(Bb[1:] + [70], S['cum'] - t2 + 0.3, 0.07, a=0.4, r=0.5), t2, rev=0.45); bus.add(sub(34, S['cum'] - t2, 0.2), t2)
timp_roll(S['cum'] - 1.1, S['cum'] - 0.02, 0.03, 0.26, 43.65)
bus.add(swell(1.0, 0.07), S['cum'] - 1.0, rev=0.3)
c = S['cum']; dc = S['dur'] - c + 1.2; dec = np.exp(-T(dc) * 0.55)[: int(dc * SR)]
bus.add(taiko(0.9, f0=58.27, d=2.0), c, rev=0.55)
bus.add(strings([46, 58, 62, 65, 70], dc, 0.10, a=0.08, r=1.0) * dec, c, rev=0.5)
bus.add(brass([58, 62, 65], dc, 0.07, cut=1500) * dec, c, rev=0.45)
bus.add(choir([58, 62, 65, 70], dc, 0.045, a=0.3) * dec, c, rev=0.65)
bus.add(sub(34, dc, 0.28) * dec, c)

# 5) odyoloji köprüsü — yalın, içten: piyano + yumuşak yaylı (Fa majör), motif
bus.add(soft([41, 48, 53], S['U5'] - S['dur'] + 0.5, 0.045, a=0.4, r=0.6), S['dur'], rev=0.5)
u = S['U5']; d5 = S['flag'] - u
motif(u, [57, 62, 64, 65], vol=0.11, gap=0.5)
for j, (ch, tt) in enumerate(((F, u), (C, u + d5 * 0.3), (Dm, u + d5 * 0.55), (Bb, u + d5 * 0.8))):
    dd = d5 * 0.27 + 0.6 if j < 3 else S['flag'] - tt + 0.4
    bus.add(soft(ch[1:], dd, 0.06, a=0.6, r=0.8), tt, rev=0.45); bus.add(sub(ch[0] if ch[0] < 44 else ch[0] - 12, dd, 0.15), tt)
bus.add(swell(1.5, 0.09), S['flag'] - 1.5, rev=0.3)
timp_roll(S['flag'] - 1.3, S['flag'] - 0.02, 0.03, 0.32, 46.25)

# 6) doruk: bayrak — Si bemol majör, tam orkestra dokusu; motif doruğa taşınır
fl = S['flag']; dfl = S['odi'] - fl
bus.add(taiko(0.95, f0=58.27, d=2.0), fl, rev=0.5)
prog = [(Bb, 0.0, 0.22), (F, 0.22, 0.44), (Gm, 0.44, 0.62), (Eb, 0.62, 0.78), (F, 0.78, 0.9)]
for ch, a0, a1 in prog:
    tt = fl + a0 * dfl; dd = (a1 - a0) * dfl
    bus.add(strings(ch[1:] + [ch[1] + 12, ch[2] + 12], dd + 0.25, 0.10, a=0.25, r=0.5), tt, rev=0.4)
    bus.add(brass(ch[1:], dd + 0.1, 0.075, cut=1600), tt, rev=0.4)
    bus.add(sub(ch[0] if ch[0] < 44 else ch[0] - 12, dd, 0.28), tt)
bus.add(choir([58, 62, 65, 70], dfl * 0.9, 0.05, a=0.6), fl, rev=0.6)
mel = [(0.0, 69, 0.11), (0.06, 74, 0.12), (0.12, 76, 0.1), (0.18, 77, 0.2), (0.4, 76, 0.1), (0.5, 74, 0.12), (0.62, 79, 0.16), (0.78, 77, 0.14)]
for a0, n, dd in mel:
    tt = fl + a0 * dfl; d = dd * dfl + 0.3
    bus.add(strings([n], d * 1.05, 0.075, a=0.08, r=0.35, cut=3200), tt, pan=0.15, rev=0.5); bus.add(piano(n, 2.0, 0.10), tt, rev=0.45)
for a0 in (0.44, 0.78): bus.add(taiko(0.45, f0=43.65, d=1.2), fl + a0 * dfl, rev=0.4)
# kapanış akoru (son satır biter bitmez), uzun söner
ce = fl + 0.9 * dfl; dl = TOTAL - ce + 0.5; dec = np.exp(-T(dl) * 0.5)[: int(dl * SR)]
bus.add(strings([46, 58, 62, 65, 70, 74], dl, 0.085, a=0.2, r=1.5) * dec, ce, rev=0.55)
bus.add(choir([62, 65, 70], dl, 0.035, a=0.6) * dec, ce, rev=0.7); bus.add(sub(34, dl, 0.24) * dec, ce)
bus.add(taiko(0.5, f0=58.27, d=2.0), ce, rev=0.6)
# 7) ayrı son kare: tek yumuşak çan
bus.add(bell(82, 3.0, 0.035), S['odi'] + 0.35, rev=0.85)

mus = bus.render(3.0, 4800)[:, : int(TOTAL * SR)]
mus = np.stack([fftfilt(mus[0], lo=38), fftfilt(mus[1], lo=38)])

# ------------------------------------------------------------------ "sesin açılması": zamanla değişen alçak geçiren süzgeç (STFT)
def cutoff(t):
    """sahne başından U'ya dek boğuk (~320 Hz), U'dan sonra 0,9 sn'de açılır (~18 kHz)"""
    closed = [(0.0, S['U2']), (S['kad'] + 0.05, S['U3']), (S['mil'] + 0.05, S['U4']), (S['dur'] + 0.05, S['U5'])]
    fc = np.full_like(t, 18000.0)
    for a, u in closed:
        m = (t >= a) & (t < u); fc[m] = 320
        o = (t >= u) & (t < u + 0.9); p = (t[o] - u) / 0.9; fc[o] = 320 * (18000 / 320) ** (p ** 1.6)
        c = (t >= a - 0.35) & (t < a); p = (t[c] - (a - 0.35)) / 0.35; fc[c] = np.minimum(fc[c], 18000 * (320 / 18000) ** p)
    return fc


def tv_lowpass(x, fcfun, n=2048, hop=512):
    w = np.hanning(n); out = np.zeros(len(x) + n); norm_ = np.zeros(len(x) + n); xp = np.concatenate([x, np.zeros(n)])
    f = np.fft.rfftfreq(n, 1 / SR)
    for i in range(0, len(x), hop):
        fc = fcfun(np.array([(i + n / 2) / SR]))[0]
        H = 1 / np.sqrt(1 + (f / fc) ** 8)
        seg = np.fft.irfft(np.fft.rfft(xp[i:i + n] * w) * H, n) * w
        out[i:i + n] += seg; norm_[i:i + n] += w * w
    return out[: len(x)] / np.maximum(norm_[: len(x)], 1e-6)


mus = np.stack([tv_lowpass(mus[0], cutoff), tv_lowpass(mus[1], cutoff)])
t_ax = np.arange(mus.shape[1]) / SR
fc_ax = cutoff(t_ax)
mus *= (0.55 + 0.45 * np.clip(np.log(fc_ax / 320) / np.log(18000 / 320), 0, 1))  # boğukken biraz da kısık

# ------------------------------------------------------------------ anlatıcı: tok ve sıcak (alçak raf + varlık), yumuşak sıkıştırma, oda yankısı
def movavg(x, k):
    """kayan ortalama (kümülatif toplamla; uzun çekirdekli evrişim dakikalar sürüyordu)"""
    k = max(1, int(k)); c = np.cumsum(np.concatenate([np.zeros(1), x])); h = k // 2
    i0 = np.clip(np.arange(len(x)) - h, 0, len(x)); i1 = np.clip(np.arange(len(x)) - h + k, 0, len(x))
    return (c[i1] - c[i0]) / k


def voice_fx(x):
    x = fftfilt(x, peak=(140, 2.5, 1.4)); x = fftfilt(x, peak=(3200, 1.5, 1.2)); x = fftfilt(x, lo=70)
    k = int(0.03 * SR); e = np.sqrt(np.maximum(movavg(x * x, k), 0)) + 1e-6
    thr = np.percentile(e[e > 1e-3], 70) if np.any(e > 1e-3) else 0.1
    g = np.where(e > thr, (e / thr) ** (1 / 2.5 - 1), 1.0); g = movavg(g, k)
    return x * g


vo = np.zeros(int(TOTAL * SR)); env_vo = np.zeros_like(vo)
for k, (a, b) in L.items():
    y = voice_fx(V[k]); i = int(a * SR); j = min(len(vo), i + len(y)); vo[i:j] += y[: j - i]
vo /= np.max(np.abs(vo)) + 1e-9
room = reverb(vo, 1.3, 3800, 21) * 0.07
# ses altında müzik kısılır (duck): anlatıcı zarfına göre −9 dB (doruğta −6 dB), yumuşak atak/bırakma
k = int(0.05 * SR); act = movavg((np.abs(vo) > 0.02).astype(float), k * 6); act = np.clip(act * 3, 0, 1)
act = movavg(act, int(0.25 * SR))
depth = np.where(t_ax[: len(act)] >= S['flag'], -6.0, -9.0)
duck = 10 ** (depth * act / 20)
mus = mus[:, : len(vo)] * duck
m_rms = np.sqrt(np.mean(mus[:, int(S['U2'] * SR):] ** 2)); v_rms = np.sqrt(np.mean(vo[np.abs(vo) > 0.02] ** 2))
mix = mus / m_rms * v_rms * 0.42 + np.stack([vo + room, vo + reverb(vo, 1.3, 3800, 23) * 0.07])
mix[:, : int(0.04 * SR)] *= np.linspace(0, 1, int(0.04 * SR))
fade = int(1.4 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
mix = mix / np.max(np.abs(mix)) * 0.89
import wave
with wave.open(out_wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())

# dalga motifi için anlatıcı zarfı (30 kare/sn, 0..1)
hop = SR // 30; n = int(TOTAL * 30)
envf = [float(np.sqrt(np.mean(vo[i * hop:(i + 1) * hop] ** 2))) if i * hop < len(vo) else 0.0 for i in range(n)]
mx = max(envf) or 1; envf = [round(min(1, (e / mx) ** 0.6 * 1.15), 3) for e in envf]
json.dump({'total': TOTAL, 'S': S, 'L': {k: {'a': a, 'b': b, 'sub': SUB[k], **({'p': round(a + PAT[k] - 0.05, 3)} if k in PAT else {})} for k, (a, b) in L.items()}, 'env': envf},
          open(out_json, 'w', encoding='utf-8'), ensure_ascii=False)
print('yazıldı:', out_wav, out_json)
