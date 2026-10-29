#!/usr/bin/env python3
"""29 Ekim — «Ben bir sesim»: Sesin Yolculuğu (1919 → bugün). Zaman çizelgesi, anlatıcı izi, özgün müzik ve son karışım.

Anlatıcı (milletin sesi, birinci tekil kişi) tools/reels/vo/29-ekim-sesin-yolculugu/y1..y14.mp3 (vo.py, Chatterbox Multilingual,
sentetik ses; Whisper WER 0). Sahne: tools/reels/29-ekim-sesin-yolculugu.html; çekim + birleştirme: 29-ekim-sesin-yolculugu.mjs.
Müzik tamamen numpy sentezi (reklam_ses.py çalgıları); İstiklal Marşı, 10. Yıl Marşı, hiçbir şarkı/kayıt alıntısı YOK.

Kullanım:
  python3 tools/reels/29-ekim-sesin-yolculugu.py zaman      → <iş>/zaman.js (sahne zamanları + anlatı zarfı) ve <iş>/vo.wav
  python3 tools/reels/29-ekim-sesin-yolculugu.py ses        → <iş>/muzik.wav ve <iş>/karisim.wav (müzik anlatı altında kısılır)
"""
import json, os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from reklam_ses import SR, Bus, T, fftfilt, noise, pad, choir, brass, piano, bell, glock, taiko, sub, reverb  # noqa: E402

SLUG = '29-ekim-sesin-yolculugu'
WORK = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels', SLUG); os.makedirs(WORK, exist_ok=True)
VO = os.path.join(HERE, 'vo', SLUG)
META = json.load(open(os.path.join(HERE, 'vo', 'metin.json'), encoding='utf-8'))['lines'][SLUG]
FPS = 30


def dur(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)


def load(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).astype(np.float64)


def timeline():
    """anlatı satırlarının başlangıçları ve sahne vuruşları (sn). Boşluklar duygu için: sahne değişiminden önce nefes."""
    D = {l['id']: dur(os.path.join(VO, l['id'] + '.mp3')) for l in META}
    L = {}

    def at(i, t): L[i] = (round(t, 3), round(t + D[i], 3))
    at('y1', 1.2)                       # karanlıkta tek bir çizgi: "Ben bir sesim."
    at('y2', L['y1'][1] + 0.85)         # Samsun (tipografi, ufuk çizgisi)
    at('y3', L['y2'][1] + 0.75)         # Erzurum → Sivas
    at('y4', L['y3'][1] + 0.45)         # "Ya istiklâl ya ölüm!"
    at('y5', L['y4'][1] + 0.8)         # TBMM 1920
    at('y6', L['y5'][1] + 0.7)          # siper, 1922
    at('y7', L['y6'][1] + 2.3)         # (Kocatepe sessiz) → 29 Ekim 1923
    at('y8', L['y7'][1] + 0.6)          # "Cumhuriyet!" → bayrak
    S = {}
    S['anniv1'] = L['y8'][1] + 1.55     # 10. yıl, mikrofonlar
    S['anniv2'] = S['anniv1'] + 1.45    # 10. yıl, kürsü
    at('y9', S['anniv2'] + 1.3)        # harfler
    at('y10', L['y9'][1] + 0.65)        # kadınlar
    at('y11', L['y10'][1] + 0.75)        # 103 yıl (akan şerit)
    at('y12', L['y11'][1] + 0.45)       # "sizsiniz"
    at('y13', L['y12'][1] + 0.85)       # kulak (hafif dokunuş)
    at('y14', L['y13'][1] + 0.9)        # bayrak + kutlama
    y3a, y3b = L['y3']
    S.update({
        'samsun': L['y2'][0] - 0.55,
        'erzurum': y3a - 0.35, 'sivas': y3a + 0.46 * (y3b - y3a),
        'tbmm': L['y5'][0] - 0.35, 'siper': L['y6'][0] - 0.35, 'kocatepe': L['y6'][1] + 0.3,
        'tarih': L['y7'][0] - 0.45, 'bayrak': L['y8'][0] - 0.04,
        'harf': L['y9'][0] - 0.35, 'kadin': L['y10'][0] - 0.35, 'serit': L['y11'][0] - 0.4, 'siz': L['y12'][0] + 0.9 * D['y12'],
        'kulak': L['y13'][0] - 0.5, 'bayrak2': L['y14'][0] - 0.55, 'son': L['y14'][1] + 1.35,
    })
    S['odi'] = S['son'] + 0.25; S['dur'] = round(S['odi'] + 2.1, 2)
    return L, {k: round(v, 3) for k, v in S.items()}


def vo_track(L, total):
    """anlatı izi: hafif oda yankısı (tok, sıcak), mono merkez; zarf (30 kare/sn) ses dalgası çizgisini sürer"""
    n = int(total * SR); x = np.zeros(n)
    for i, (a, b) in L.items():
        y = load(os.path.join(VO, i + '.mp3')); k = int(a * SR); x[k:k + len(y)] += y[: max(0, n - k)]
    x = fftfilt(x, lo=70)
    wet = reverb(x, 1.3, 3800, 3) * 0.10
    st = np.stack([x + wet, x + reverb(x, 1.3, 3800, 7) * 0.10])
    # zarf: 30 kare/sn RMS, yumuşak (çizgi titremesin)
    hop = SR // FPS; fr = n // hop
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'same')[::hop][:fr])
    env = rms / (np.percentile(rms[rms > 1e-4], 95) + 1e-9); env = np.clip(env, 0, 1.3)
    sm = np.zeros_like(env); v = 0
    for j, e in enumerate(env): v = v + (e - v) * (0.55 if e > v else 0.18); sm[j] = v
    return st, sm


def write(path, st):
    import wave
    pcm = (np.clip(st.T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def read(path):
    import wave
    with wave.open(path) as w: return np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).T.astype(np.float64) / 32767


# ------------------------------------------------------------------ müzik
def music(L, S):
    total = S['dur']; bus = Bus(total + 1)

    def strings(notes, d, vol=0.07, a=0.8, r=1.0, cut=2400): return pad(notes, d, vol=vol, a=a, r=r, cut=cut, kind='saw')
    def soft(notes, d, vol=0.06, a=1.2, r=1.2): return pad(notes, d, vol=vol, a=a, r=r, cut=1700, kind='tri')
    def swell(d, vol=0.1, lo=300, hi=5000, p=2.0):
        t = T(d); return vol * fftfilt(noise(d), lo=lo, hi=hi) * (t / d) ** p

    def roll(t0, t1, v0=0.03, v1=0.3, f0=43.65):
        t = t0
        while t < t1:
            p = (t - t0) / (t1 - t0); bus.add(taiko(v0 + (v1 - v0) * p ** 1.6, f0=f0, d=0.9), t, rev=0.35); t += 0.075

    # akorlar (MIDI): Re minör yolculuk → Si bemol majör doruk
    Dm, Bb, F, C, Gm, Eb, Am = [38, 50, 57, 62, 65], [34, 46, 58, 62, 65], [41, 53, 57, 60, 65], [36, 48, 55, 60, 64], [43, 55, 58, 62, 67], [39, 51, 58, 63, 67], [45, 52, 57, 60, 64]
    y = lambda i: L[i][0]
    # 1) karanlık: alçak yatak + tek nota (ses doğar)
    bus.add(soft([38, 45, 50], y('y2') + 0.5, 0.07, a=2.5, r=1.2), 0.0, rev=0.5)
    bus.add(sub(26, y('y2') + 0.3, 0.13) * np.linspace(0.2, 1, int((y('y2') + 0.3) * SR)), 0.0)
    bus.add(piano(62, 3.0, 0.11), 0.6, rev=0.6); bus.add(piano(69, 3.0, 0.09), y('y1') + 1.1, rev=0.6)
    bus.add(bell(86, 3.0, 0.03), y('y1') - 0.05, pan=0.3, rev=0.8)
    # 2) Samsun → Erzurum → Sivas: piyano motifi (Re–Fa–La–Sol), çello ostinatosu yavaşça girer
    motif = [62, 65, 69, 67, 65, 64]
    t = S['samsun'] + 0.3; k = 0
    while t < S['tbmm'] - 0.2:
        bus.add(piano(motif[k % 6] + (12 if k >= 12 else 0) * 0, 2.4, 0.10 + 0.01 * (k % 2)), t, pan=0.12, rev=0.5); t += 0.62; k += 1
    seq = [(S['samsun'], Dm), (S['erzurum'], Bb), (S['sivas'], F), (y('y4'), Gm), (L['y4'][0] + 0.55 * (L['y4'][1] - L['y4'][0]), C)]
    for j, (t0, ch) in enumerate(seq):
        t1 = seq[j + 1][0] if j + 1 < len(seq) else S['tbmm']
        bus.add(soft(ch[1:], t1 - t0 + 0.6, 0.06 + 0.006 * j, a=0.7, r=0.8), t0, rev=0.45)
        bus.add(sub(ch[0] if ch[0] < 40 else ch[0] - 12, t1 - t0 + 0.3, 0.17), t0)
    # çello ostinato (sekizlikler) Erzurum'dan itibaren
    t = S['erzurum']; k = 0
    while t < S['kocatepe']:
        root = 38 if t < S['sivas'] else (41 if t < y('y4') else (43 if t < S['tbmm'] else (34 if t < S['siper'] else 38)))
        v = 0.045 + 0.03 * min(1, (t - S['erzurum']) / 12)
        bus.add(strings([root + (0 if k % 2 == 0 else 7)], 0.3, v, a=0.02, r=0.15, cut=1400), t, pan=-0.2, rev=0.3); t += 0.31; k += 1
    # "ya istiklâl ya ölüm": kısa timpani vurgusu
    bus.add(taiko(0.45, f0=43.65, d=1.4), L['y4'][0] + 0.62 * (L['y4'][1] - L['y4'][0]), rev=0.45)
    # 3) TBMM, siper: yaylılar kalınlaşır, koro girer
    for t0, t1, ch in ((S['tbmm'], S['siper'], Bb), (S['siper'], S['kocatepe'], Gm), (S['kocatepe'], S['tarih'], Am)):
        bus.add(strings(ch[1:] + [ch[2] + 12], t1 - t0 + 0.5, 0.07, a=0.6, r=0.6), t0, rev=0.45)
        bus.add(sub(ch[0] if ch[0] < 40 else ch[0] - 12, t1 - t0 + 0.2, 0.2), t0)
    bus.add(choir([57, 62, 65], S['tarih'] - S['siper'] + 0.4, 0.035, a=1.2), S['siper'], rev=0.6)
    for tt, n in ((S['tbmm'] + 0.2, 74), (S['tbmm'] + 1.5, 72), (S['tbmm'] + 2.8, 70), (S['siper'] + 0.2, 69), (S['siper'] + 1.6, 67), (S['kocatepe'] + 0.1, 69), (S['kocatepe'] + 1.0, 73)):
        bus.add(piano(n, 2.4, 0.11), tt, pan=0.1, rev=0.5)
    roll(S['kocatepe'] + 0.2, S['tarih'] + 0.15, 0.02, 0.22)
    # 4) "29 Ekim 1923'te… bir isim aldım:" — neredeyse sessizlik, yüksek yaylı tremolo, kalp atışı gibi alçak vuruş
    gap = S['bayrak'] - S['tarih']
    bus.add(pad([69, 74, 81], gap + 0.1, 0.035, a=0.4, r=0.2, cut=4000, kind='saw', trem=7.0), S['tarih'], rev=0.6)
    for q in range(int(gap / 0.85)): bus.add(taiko(0.16 + 0.05 * q, f0=36.7, d=0.8), S['tarih'] + 0.25 + q * 0.85, rev=0.3)
    bus.add(swell(1.3, 0.12), S['bayrak'] - 1.3, rev=0.3); roll(S['bayrak'] - 1.0, S['bayrak'], 0.04, 0.36, 46.25)
    # 5) "Cumhuriyet!" — doruk: Si bemol majör, timpani, bakır, koro; 10. yıl fotoğrafları boyunca geniş tema
    B0 = S['bayrak']; B1 = y('y9') - 0.2
    bus.add(taiko(0.95, f0=58.27, d=2.2), B0, rev=0.55); bus.add(taiko(0.6, f0=46.25, d=1.6), B0 + 0.02, rev=0.4)
    prog = [(0.0, Bb, 1.75), (1.75, F, 1.75), (3.5, Gm, 1.2), (4.7, Eb, 1.0), (5.7, F, 99)]
    for j, (o, ch, d) in enumerate(prog):
        t0 = B0 + o; d = min(d, B1 - t0)
        if d <= 0: break
        bus.add(strings(ch[1:] + [ch[1] + 12, ch[2] + 12], d + 0.3, 0.10, a=0.2, r=0.5), t0, rev=0.45)
        bus.add(brass(ch[1:4], d + 0.1, 0.085, cut=1600), t0, rev=0.45)
        bus.add(sub(ch[0] if ch[0] < 44 else ch[0] - 12, d, 0.3), t0)
        if j: bus.add(taiko(0.38, f0=43.65, d=1.2), t0, rev=0.4)
    bus.add(choir([58, 62, 65, 70], B1 - B0, 0.05, a=0.4), B0, rev=0.65)
    for o, n, d in ((0.0, 74, 1.2), (1.2, 77, 0.55), (1.75, 77, 1.2), (2.95, 76, 0.55), (3.5, 74, 1.2), (4.7, 75, 1.0), (5.7, 77, 1.6)):
        if B0 + o < B1: bus.add(strings([n], d + 0.2, 0.08, a=0.06, r=0.4, cut=3400), B0 + o, pan=0.15, rev=0.5); bus.add(piano(n, 1.8, 0.09), B0 + o, rev=0.45)
    # 6) harfler, kadınlar, 103 yıl: akan piyano arpejleri + sıcak yaylılar, yeniden yükseliş
    arp = {0: [58, 62, 65, 70], 1: [57, 60, 65, 69], 2: [55, 58, 62, 67], 3: [55, 58, 63, 67]}
    secs = [(B1, Bb, 0), (y('y10') - 0.3, F, 1), (S['serit'], Gm, 2), (S['siz'] - 0.4, Eb, 3), (S['kulak'], Bb, 0)]
    for j, (t0, ch, a) in enumerate(secs[:-1]):
        t1 = secs[j + 1][0]
        bus.add(strings(ch[1:], t1 - t0 + 0.5, 0.065 + 0.008 * j, a=0.5, r=0.7), t0, rev=0.5)
        bus.add(sub(ch[0] if ch[0] < 44 else ch[0] - 12, t1 - t0 + 0.2, 0.2), t0)
        t = t0; k = 0
        while t < t1 - 0.05:
            bus.add(piano(arp[a][k % 4] + (12 if (k // 4) % 2 else 0), 1.6, 0.075), t, pan=-0.2 + 0.1 * (k % 4), rev=0.5); t += 0.24; k += 1
    bus.add(choir([62, 67, 70], S['kulak'] - S['serit'] + 0.6, 0.04, a=1.4), S['serit'], rev=0.6)
    bus.add(swell(1.0, 0.07), S['siz'] - 1.0, rev=0.35); bus.add(taiko(0.5, f0=51.9, d=1.6), S['siz'], rev=0.5)
    # 7) kulak: yalnız piyano ve ince yatak (hafif dokunuş)
    K0, K1 = S['kulak'], S['bayrak2']
    bus.add(soft([58, 62, 65], K1 - K0 + 0.4, 0.05, a=0.6, r=0.6), K0, rev=0.6); bus.add(sub(34, K1 - K0, 0.12), K0)
    for q, n in enumerate((70, 74, 77, 74)): bus.add(piano(n, 2.6, 0.09), K0 + 0.25 + q * 0.75, rev=0.6)
    # 8) son kutlama: geniş Si bemol akoru, uzun söner; ayrı son karede tek çan
    E0 = S['bayrak2']; dl = S['odi'] - E0 + 1.2; dec = np.exp(-T(dl) * 0.32)[: int(dl * SR)]
    bus.add(taiko(0.8, f0=58.27, d=2.4), E0, rev=0.6); bus.add(swell(0.8, 0.06), E0 - 0.8, rev=0.3)
    bus.add(strings([46, 58, 62, 65, 70, 74], dl, 0.095, a=0.25, r=1.6) * dec, E0, rev=0.55)
    bus.add(brass([58, 62, 65], 2.8, 0.06, cut=1500), E0, rev=0.5)
    bus.add(choir([62, 65, 70, 74], dl, 0.045, a=0.5) * dec, E0, rev=0.7); bus.add(sub(34, dl, 0.26) * dec, E0)
    for q, n in enumerate((70, 74, 77, 82)): bus.add(piano(n, 3.2, 0.09), E0 + 0.6 + 0.3 * q, pan=-0.2 + 0.13 * q, rev=0.6)
    bus.add(glock(94, 1.6, 0.03), S['odi'] + 0.5, rev=0.85)
    st = bus.render(3.0, 4800)[:, : int(total * SR)]
    st[:, : int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
    f = int(1.2 * SR); st[:, -f:] *= np.linspace(1, 0, f) ** 1.5
    return st


if __name__ == '__main__':
    L, S = timeline()
    if sys.argv[1] == 'zaman':
        st, env = vo_track(L, S['dur'])
        write(os.path.join(WORK, 'vo.wav'), st * 0.9 / max(1e-9, np.abs(st).max()))
        subs = {l['id']: l.get('sub', l['text']) for l in META}
        js = {'L': {i: [a, b, subs[i]] for i, (a, b) in L.items()}, 'S': S, 'env': [round(float(e), 3) for e in env],
              'erzurum': os.path.exists(os.path.join(ROOT, 'marketing', 'reels', 'kaynak', '1919-erzurum.png'))}
        open(os.path.join(WORK, 'zaman.js'), 'w', encoding='utf-8').write('window.TL = ' + json.dumps(js, ensure_ascii=False) + ';\n')
        print(json.dumps({'S': S, 'L': L}, ensure_ascii=False))
    elif sys.argv[1] == 'ses':
        mus = music(L, S); n = mus.shape[1]
        vo = read(os.path.join(WORK, 'vo.wav'))[:, :n]; vo = np.pad(vo, ((0, 0), (0, n - vo.shape[1])))
        write(os.path.join(WORK, 'muzik.wav'), mus * 0.89 / np.abs(mus).max())
        # duck: anlatı zarfı (atak 40 ms, bırakma 350 ms) → müzik ≈ −8 dB anlatı altında
        m = np.abs(vo).max(0); hop = 441; e = np.array([m[i:i + hop].max() for i in range(0, n, hop)])
        g = np.zeros_like(e); v = 0
        for i, x in enumerate(e): v = v + (x - v) * (0.6 if x > v else 0.06); g[i] = v
        g = np.clip(g / (np.percentile(g, 98) + 1e-9), 0, 1); duck = 1 - 0.6 * np.repeat(g, hop)[:n]
        mus = mus / np.abs(mus).max() * 0.55; vo = vo / np.abs(vo).max() * 0.85
        # doruk otomasyonu: anlatının sustuğu doruklarda müzik öne çıkar (Kocatepe yükselişi, "Cumhuriyet!" + 10. yıl, son kutlama)
        tt = np.arange(n) / SR; auto = np.ones(n)
        for t0, t1, gmax in ((S['kocatepe'], L['y7'][0], 1.3), (S['bayrak'], L['y9'][0] - 0.1, 1.75), (S['bayrak2'], S['dur'], 1.5)):
            up = np.clip((tt - t0) / 0.25, 0, 1) * np.clip((t1 - tt) / 0.6, 0, 1); auto = np.maximum(auto, 1 + (gmax - 1) * up)
        mus = mus * auto
        mix = mus * duck + vo
        write(os.path.join(WORK, 'karisim.wav'), mix * 0.89 / np.abs(mix).max())
        print('ses yazıldı', round(n / SR, 2))
