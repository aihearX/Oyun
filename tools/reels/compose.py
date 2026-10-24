#!/usr/bin/env python3
"""ODİ Reels birleştirme.

Teaser:   python3 tools/reels/compose.py --reel <slug|all> [--out marketing/reels]
  plan.json (record.mjs --reel) → her çıktı karesi: oynanış klibinden simülasyon saniyesine en yakın kare (kırpılıp 1080×1920'ye
  ölçeklenir) + saydam yazı/kart katmanı. Ses: özgün müzik (music.py, sahne kesmelerine göre) + Tüy Dede'nin kayıtları
  (müzik ses altında kısılır) → sıkıştırma + kazanç + tepe sınırlayıcı, −14 LUFS. Çıktı: <out>/<slug>.mp4 (H.264 + AAC, 30 kare/sn, faststart)
  ve <out>/<slug>-kapak.png (1080×1920).
Reklam:   plan.ad (tools/reels/reklamlar.mjs) → render_video_ad: hız rampalı/ağır çekim klip, alt-piksel kamera (yakınlaşma, darbe),
  son işlem (sinema şeritleri, renk, vinyet, sarsıntı, RGB kayması, bozulma, gren, parlama); ses: reklam_ses.py bölümlü müzik +
  efekt izi + anlatıcı ('trailer': tok, yankılı). --audio-only: görüntüyü yeniden çizmeden yalnız sesi karıştırır.
Eski:     python3 tools/reels/compose.py [<çıktı.mp4>]   (record.mjs bayraksız: "Nasıl oynanır?" Reels'i)
"""
import bisect, json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels')
W, H, FPS = 1080, 1920, 30
BG = (20, 12, 53)


def sh(cmd, inp=None):
    r = subprocess.run(cmd, capture_output=True, input=inp)
    if r.returncode != 0:
        print(r.stderr.decode(errors='replace')[-3000:]); raise SystemExit(f'hata: {" ".join(map(str, cmd[:8]))}')
    return r


# ------------------------------------------------------------------ görüntü
class Clip:
    """clips/<id>/index.json: kareler ve simülasyon saniyeleri; en yakın kare seçilir (önbellekli)"""
    def __init__(self, d):
        self.dir = d['dir']; idx = json.load(open(os.path.join(self.dir, 'index.json')))
        self.frames = idx['frames']; self.ts = [f['t'] for f in self.frames]; self.cache = {}
    def at(self, t):
        i = bisect.bisect_left(self.ts, t)
        if i > 0 and (i == len(self.ts) or abs(self.ts[i - 1] - t) <= abs(self.ts[i] - t)): i -= 1
        return self.frames[min(i, len(self.frames) - 1)]['f']


def frame_box(img_w, img_h, fr):
    """oyun kadrajı: tuval 390×780 oyun pikselinin img_w/390 katı; top (oyun px) üstten kırpılır, zoom ile yakınlaşır"""
    from PIL import Image  # noqa
    s = img_w / 390.0
    fr = fr or {}
    zoom = float(fr.get('zoom', 1.0)); top = float(fr.get('top', 100)); x = float(fr.get('x', 0))
    gw = 390.0 / zoom; gh = gw * H / W
    top = max(0.0, min(top, img_h / s - gh))
    left = max(0.0, min(195.0 + x - gw / 2, 390.0 - gw))
    return (round(left * s), round(top * s), round((left + gw) * s), round((top + gh) * s))


def base_frame(clip, t, fr, cache):
    from PIL import Image
    f = clip.at(t)
    key = (clip.dir, f, json.dumps(fr, sort_keys=True))
    if key in cache: return cache[key]
    im = Image.open(os.path.join(clip.dir, f)).convert('RGB')
    im = im.crop(frame_box(im.width, im.height, fr)).resize((W, H), Image.LANCZOS)
    cache.clear(); cache[key] = im
    return im


def render_video(plan, video_path):
    from PIL import Image
    n = int(round(plan['total'] * FPS))
    clips = {}
    for sc in plan['scenes']:
        if sc.get('clip'): clips[sc['clip']['dir']] = Clip(sc['clip'])
    bg = Image.new('RGB', (W, H), BG)
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '6500k', '-bufsize', '13000k', '-pix_fmt', 'yuv420p',
                            '-profile:v', 'high', '-level', '4.1', '-r', str(FPS), '-movflags', '+faststart', video_path], stdin=subprocess.PIPE)
    cache = {}; ovl_cache = {}
    starts = [sc['start'] for sc in plan['scenes']]
    for i in range(n):
        t = i / FPS
        si = max(0, bisect.bisect_right(starts, t + 1e-6) - 1); sc = plan['scenes'][si]
        if sc.get('clip'):
            c = sc['clip']; lt = (t - sc['start']) * float(sc.get('speed', 1))
            im = base_frame(clips[c['dir']], c['fromT'] + lt, sc.get('frame'), cache)
        else:
            im = bg
        op = os.path.join(plan['overlay'], f'o{i + 1:05d}.png')
        ino = os.stat(op).st_ino
        if ino not in ovl_cache: ovl_cache.clear(); ovl_cache[ino] = Image.open(op).convert('RGBA')
        out = im.convert('RGBA'); out.alpha_composite(ovl_cache[ino])
        enc.stdin.write(out.convert('RGB').tobytes())
        if i % 150 == 0: print(f'  kare {i}/{n}', flush=True)
    enc.stdin.close(); enc.wait()
    if enc.returncode != 0: raise SystemExit('ffmpeg kodlama hatası')


def render_cover(plan, png_out):
    from PIL import Image
    cv = plan.get('cover')
    if not cv: return
    if cv.get('clip'):
        from PIL import ImageFilter, ImageEnhance
        c = Clip(cv['clip']); im = base_frame(c, cv['clip']['fromT'] + float(cv.get('t', 1)), cv.get('frame'), {})
        # kapakta yazı öne çıksın: oynanış hafif bulanık ve koyu (küçük resimde de okunur)
        im = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(cv.get('blur') if cv.get('blur') is not None else 3))).enhance(cv.get('dim') or 0.62)
    else:
        im = Image.new('RGB', (W, H), BG)
    out = im.convert('RGBA'); out.alpha_composite(Image.open(cv['png']).convert('RGBA'))
    out.convert('RGB').save(png_out, optimize=True)


# ------------------------------------------------------------------ reklam: kamera, hız rampası, son işlem
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))


def ease(p, k='io'):
    if k == 'lin': return p
    if k == 'out': return 1 - (1 - p) ** 3
    if k == 'in': return p ** 3
    return 3 * p * p - 2 * p * p * p  # io


def clip_time(speed, lt):
    """hız rampası: sayı ya da [[yerel sn, hız], ...] → klipte geçen simülasyon süresi (record.mjs clipTime ile aynı)"""
    if not isinstance(speed, list): return lt * float(speed or 1)
    def at(x):
        if x <= speed[0][0]: return speed[0][1]
        for i in range(1, len(speed)):
            if x <= speed[i][0]:
                (a, va), (b, vb) = speed[i - 1], speed[i]; return va + (vb - va) * (x - a) / (b - a)
        return speed[-1][1]
    n = max(1, int(np.ceil(lt / 0.01))); h = lt / n
    return sum(at((i + 0.5) * h) * h for i in range(n))


def cam_frame(sc, lt):
    """sahne kamerası: frame + cam { z: [z0, z1], x: [..], top: [..], ease, T, punch: [[at, miktar, süre]] }"""
    fr = dict(sc.get('frame') or {}); cam = sc.get('cam')
    if not cam: return fr
    p = ease(clamp(lt / float(cam.get('T', sc['dur']))), cam.get('ease', 'io'))
    for ks, kd in (('z', 'zoom'), ('x', 'x'), ('top', 'top')):
        if ks in cam:
            v = cam[ks]; fr[kd] = v[0] + (v[1] - v[0]) * p if isinstance(v, list) else v
    z0 = fr.get('zoom', 1.0)
    for at, amt, dur in cam.get('punch', []):
        if lt >= at: fr['zoom'] = fr.get('zoom', 1.0) * (1 + amt * np.exp(-(lt - at) / max(0.02, dur)))
    if cam.get('anchor') and fr.get('zoom', 1.0) != z0:  # darbe yakınlaşması bu noktaya doğru (oyun px; ör. Merkez binası)
        ay = cam['anchor'][1]; k = fr['zoom'] / z0; fr['top'] = ay - (ay - fr.get('top', 100)) / k
    return fr


def frame_boxf(img_w, img_h, fr):
    s = img_w / 390.0; fr = fr or {}
    zoom = float(fr.get('zoom', 1.0)); top = float(fr.get('top', 100)); x = float(fr.get('x', 0))
    gw = 390.0 / zoom; gh = gw * H / W; ih = img_h / s  # oyun klibi: 780; hazır 9:16 kare dizisi: ≈693
    top = max(0.0, min(top, ih - gh)); left = max(0.0, min(195.0 + x - gw / 2, 390.0 - gw))
    return (left * s, top * s, (left + gw) * s, (top + gh) * s)


def ad_base(clip, sc, lt, cache):
    """reklam karesi: hız rampalı simülasyon saniyesi, alt-piksel kamera (EXTENT), istenirse iki kare harmanı (ağır çekim)"""
    from PIL import Image
    st = sc['clip']['fromT'] + float(sc.get('skip') or 0) + clip_time(sc.get('speed', 1), lt)
    fr = cam_frame(sc, lt)
    def load(f):
        if f not in cache:
            if len(cache) > 6: cache.pop(next(iter(cache)))
            cache[f] = Image.open(os.path.join(clip.dir, f)).convert('RGB')
        return cache[f]
    if sc.get('blend'):
        i = bisect.bisect_right(clip.ts, st) - 1; i = max(0, min(i, len(clip.ts) - 2))
        a, b = clip.ts[i], clip.ts[i + 1]; w = clamp((st - a) / max(1e-6, b - a))
        im0 = load(clip.frames[i]['f']); im = im0 if w < 0.02 else Image.blend(im0, load(clip.frames[i + 1]['f']), w)
    else:
        im = load(clip.at(st))
    return im.transform((W, H), Image.EXTENT, frame_boxf(im.width, im.height, fr), Image.BICUBIC)


def _noise(t, k): return np.sin(t * 61.7 + k * 3.1) * 0.5 + np.sin(t * 37.3 + k * 7.7) * 0.35 + np.sin(t * 93.1 + k) * 0.15


def _active(lst, lt):
    for it in lst or []:
        at, dur = it[0], it[1]
        if at <= lt < at + dur: yield it, (lt - at) / max(1e-6, dur)


VIG = None
def post_fx(img, fx, lt, t):
    """sahne son işlemi (yerel zaman lt): zoom/sarsıntı, renk, vinyet, RGB kayması, bozulma, grenlilik, parlama, karartma, sinema şeritleri"""
    from PIL import Image
    global VIG
    if not fx: return img
    z = 1.0 + float(fx.get('push', 0)) * clamp(lt / max(0.01, float(fx.get('pushT', 3.0)))); dx = dy = 0.0
    for (at, dur, amt), p in _active(fx.get('zoom'), lt): z *= 1 + amt * (1 - p) ** 2
    for (at, dur, amp), p in _active(fx.get('shake'), lt):
        k = (1 - p) ** 1.5; dx += _noise(t, 1) * amp * k; dy += _noise(t + 2.1, 2) * amp * k
    if fx.get('jitter'): dx += _noise(t, 5) * fx['jitter']; dy += _noise(t + 1.3, 6) * fx['jitter']
    if z != 1.0 or dx or dy:
        z = max(z, 1 + 2.2 * max(abs(dx), abs(dy)) / W)
        gw, gh = W / z, H / z; cx, cy = W / 2 - dx / z, H / 2 - dy / z
        img = img.transform((W, H), Image.EXTENT, (cx - gw / 2, cy - gh / 2, cx + gw / 2, cy + gh / 2), Image.BICUBIC)
    a = None
    def arr():
        nonlocal a
        if a is None: a = np.asarray(img, dtype=np.float32)
        return a
    g = fx.get('grade')
    if g and lt >= float(fx.get('gradeFrom', -1)) and lt < float(fx.get('gradeUntil', 1e9)):
        x = arr(); lum = (x[..., 0] * 0.299 + x[..., 1] * 0.587 + x[..., 2] * 0.114)[..., None]
        amt = float(fx.get('gradeAmt', 1.0))
        if g == 'bw': y = np.repeat(lum, 3, axis=2); y = (y - 128) * 1.18 + 128
        elif g == 'teal':
            w = lum / 255.0; tint = (1 - w) * np.array([0.82, 1.0, 1.18], np.float32) + w * np.array([1.12, 1.0, 0.86], np.float32)
            y = lum + (x - lum) * 0.8; y = ((y - 128) * 1.15 + 128) * tint
        elif g == 'amber': y = (lum + (x - lum) * 1.1) * np.array([1.15, 1.0, 0.72], np.float32)
        elif g == 'cold': y = (lum + (x - lum) * 0.55) * np.array([0.85, 0.97, 1.18], np.float32)
        elif g == 'red': y = (lum + (x - lum) * 0.4) * np.array([1.35, 0.7, 0.75], np.float32)
        elif g == 'dark': y = x * 0.55
        else: y = x
        a = x * (1 - amt) + y * amt
    if fx.get('vignette'):
        if VIG is None:
            yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.6)) ** 2)
            VIG = np.clip(1 - np.clip(r - 0.55, 0, None) ** 1.6 * 1.6, 0, 1)[..., None]
        v = float(fx['vignette']); a = arr() * (1 - v + v * VIG)
    for (at, dur, px), p in _active(fx.get('rgb'), lt):
        x = arr(); s = int(round(px * (1 - p))); 
        if s: a = x.copy(); a[:, s:, 0] = x[:, :-s, 0]; a[:, :-s, 2] = x[:, s:, 2]
    for (at, dur, amt), p in _active(fx.get('glitch'), lt):
        x = arr().copy(); r = np.random.default_rng(int(t * 30))
        for _ in range(int(6 * amt)):
            y0 = int(r.integers(0, H - 40)); h = int(r.integers(12, 120)); sft = int(r.integers(-80, 80) * amt)
            x[y0:y0 + h] = np.roll(x[y0:y0 + h], sft, axis=1)
        a = x
    if fx.get('grain'):
        r = np.random.default_rng(int(t * 30) + 7); a = arr() + r.normal(0, 255 * fx['grain'], (H // 2, W // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1)
    for it, p in _active(fx.get('flash'), lt):
        col = np.array(it[2] if len(it) > 2 else [255, 246, 229], np.float32); o = (1 - p) ** 2 * (it[3] if len(it) > 3 else 1.0)
        a = arr() * (1 - o) + col * o
    for it, p in _active(fx.get('black'), lt): a = arr() * 0.0
    if fx.get('fadeIn'):
        o = clamp(lt / fx['fadeIn']); a = arr() * o
    if fx.get('fadeOut'):
        T0, d = fx['fadeOut']; o = 1 - clamp((lt - T0) / d); a = arr() * o
    if fx.get('bars'):
        b = int(fx['bars']); x = arr().copy(); x[:b] = 0; x[H - b:] = 0; a = x
    if a is None: return img
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def render_video_ad(plan, video_path):
    from PIL import Image
    n = int(round(plan['total'] * FPS))
    clips = {sc['clip']['dir']: Clip(sc['clip']) for sc in plan['scenes'] if sc.get('clip')}
    bg = Image.new('RGB', (W, H), (0, 0, 0))
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '4200k', '-bufsize', '8400k', '-pix_fmt', 'yuv420p',
                            '-profile:v', 'high', '-level', '4.1', '-r', str(FPS), '-movflags', '+faststart', video_path], stdin=subprocess.PIPE)
    caches = {}; ovl_cache = {}
    starts = [sc['start'] for sc in plan['scenes']]
    for i in range(n):
        t = i / FPS
        si = max(0, bisect.bisect_right(starts, t + 1e-6) - 1); sc = plan['scenes'][si]; lt = t - sc['start']
        im = ad_base(clips[sc['clip']['dir']], sc, lt, caches.setdefault(sc['clip']['dir'], {})) if sc.get('clip') else bg
        if (sc.get('fx') or {}).get('base'): im = post_fx(im, sc['fx']['base'], lt, t)  # yalnız alttaki görüntüye (ör. donup griye dönme; büyüteç renkli kalır)
        op = os.path.join(plan['overlay'], f'o{i + 1:05d}.png'); ino = os.stat(op).st_ino
        if ino not in ovl_cache: ovl_cache.clear(); ovl_cache[ino] = Image.open(op).convert('RGBA')
        out = im.convert('RGBA'); out.alpha_composite(ovl_cache[ino]); out = out.convert('RGB')
        out = post_fx(out, sc.get('fx'), lt, t)
        enc.stdin.write(out.tobytes())
        if i % 150 == 0: print(f'  kare {i}/{n}', flush=True)
    enc.stdin.close(); enc.wait()
    if enc.returncode != 0: raise SystemExit('ffmpeg kodlama hatası')


def mix_audio_ad(plan, out_wav):
    """reklam sesi: bölümlü özgün müzik (anlatıcı altında kısılır) + efekt izi + anlatıcı (satıra göre: 'trailer' = tok, yankılı)"""
    sys.path.insert(0, os.path.dirname(__file__)); import reklam_ses as RS
    total = plan['total']; n = int((total + 0.05) * SR)
    secs = [(sc['start'], sc['mus']) for sc in plan['scenes'] if sc.get('mus')]
    mus = RS.music(plan['style'], plan['bpm'], total + 0.6, secs)[:, :n]; mus = np.pad(mus, ((0, 0), (0, max(0, n - mus.shape[1]))))
    fx = RS.sfx_track(plan.get('sfx', []), total + 0.6)[:, :n]; fx = np.pad(fx, ((0, 0), (0, max(0, n - fx.shape[1]))))
    v = np.zeros(n); vrev = np.zeros(n)
    for vo in plan['voice']:
        x = read_audio(vo['file'], vo.get('from') or 0, vo.get('to'))
        fade = int(0.012 * SR); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
        x = x / max(1e-6, np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2))) * 0.12  # satırlar arası eşit düzey
        send = 0.04
        if vo.get('fx') == 'trailer':  # fragman sesi: aynı anlatıcı; alt frekans dolgunluğu + hafif salon yankısı
            x = RS.fftfilt(x, peak=(110, 5, 1.6)); x = RS.fftfilt(x, peak=(3200, 2, 1.2)); send = 0.22
        i = int(vo['at'] * SR); j = min(n, i + len(x)); v[i:j] += x[: j - i] * float(vo.get('gain', 1)); vrev[i:j] += x[: j - i] * send
    vr = RS.reverb(vrev, 1.8, 5000, 3)
    act = (np.abs(v) > 0.004).astype(float); k = int(0.2 * SR); act = np.convolve(act, np.ones(k) / k, mode='same') > 0
    look = int(0.08 * SR); act = np.concatenate([act[look:], np.zeros(look, dtype=bool)])
    dec = act[::64].astype(float); e = smooth_env(dec, 0.05 * 64, 0.4 * 64); e = np.repeat(e, 64)[:n]; e = np.pad(e, (0, n - len(e)))
    duck = plan.get('duck') or {}
    gm = 1 - (1 - 10 ** (duck.get('music', -10) / 20)) * e; gf = 1 - (1 - 10 ** (duck.get('sfx', -4) / 20)) * e
    rms = lambda z: np.sqrt(np.mean(z ** 2)) + 1e-9
    mus = mus / rms(mus) * 0.05 * float(duck.get('musicGain', 1.0)); fx = fx / max(1e-9, np.max(np.abs(fx))) * 0.55 * float(duck.get('sfxGain', 1.0))
    # Ton Avı tonları: saf sinüs, anlatıcının ~16 dB altında sabit düzey (sıkıştırma/sınırlayıcıya takılmaz; ani yüksek ses yok)
    tn = np.zeros(n)
    for ev in plan.get('tones') or []:
        x = RS.sfx('tone', ev.get('d', 0.45), f=ev['f']) * 0.028 * float(ev.get('g', 1)); i = int(ev['t'] * SR); j = min(n, i + len(x)); tn[i:j] += x[: j - i]
    L = mus[0] * gm + fx[0] * gf + v + vr + tn; R = mus[1] * gm + fx[1] * gf + v + vr + tn
    y = np.stack([L, R]); y = np.tanh(y * 1.4) / 1.4
    pcm = (np.clip(y.T, -1, 1) * 32767).astype('<i2')
    with wave.open(out_wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


# ------------------------------------------------------------------ ses
SR = 44100

def read_audio(path, start=0.0, end=None):
    a = ['ffmpeg', '-v', 'error']
    if start: a += ['-ss', f'{start:.3f}']
    if end: a += ['-to', f'{end:.3f}']
    a += ['-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(sh(a).stdout, dtype='<f4').astype(np.float64)


def smooth_env(x, attack, release):
    out = np.empty_like(x); g = 0.0
    a = np.exp(-1 / (attack * SR)); r = np.exp(-1 / (release * SR))
    for i, v in enumerate(x):
        c = a if v > g else r
        g = c * g + (1 - c) * v; out[i] = g
    return out


def mix_audio(plan, music_wav, out_wav):
    total = plan['total']; n = int((total + 0.05) * SR)
    m = read_audio(music_wav)[:n]; m = np.pad(m, (0, max(0, n - len(m))))
    v = np.zeros(n)
    for vo in plan['voice']:
        x = read_audio(vo['file'], vo.get('from') or 0, vo.get('to'))
        fade = int(0.012 * SR); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
        i = int(vo['at'] * SR); j = min(n, i + len(x)); v[i:j] += x[: j - i] * float(vo.get('gain', 1))
    # ses varken müziği kıs (ön-dinleme 80 ms, bırakma 350 ms): −11 dB
    act = (np.abs(v) > 0.003).astype(float)
    # pencere ile doldur (kelime arası boşluklar müziği zıplatmasın)
    k = int(0.18 * SR); act = np.convolve(act, np.ones(k) / k, mode='same') > 0
    look = int(0.08 * SR); act = np.concatenate([act[look:], np.zeros(look, dtype=bool)])
    dec = act[::64].astype(float); env = smooth_env(dec, 0.06 * 64, 0.35 * 64)  # 64 örnekte bir hesap
    env = np.repeat(env, 64)[:n]; env = np.pad(env, (0, n - len(env)))
    duck = 10 ** (-11 / 20)
    gain = 1 - (1 - duck) * env
    # ses −16 LUFS kayıtlı; müzik normalize (tepe 0.85) → müziği 0.32'ye, sesi 1.0'a getir, sonra loudnorm
    y = m * 0.32 * gain + v * 1.0
    y = np.tanh(y * 1.1) / 1.1
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(out_wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def measure_i(wav):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    txt = r.stderr; return float(json.loads(txt[txt.rindex('{'):txt.rindex('}') + 1])['input_i'])


def loudness_chain(wav, target=-14.0, limit=0.75):
    """hedef bütünleşik ses yüksekliği için kazanç + tepe sınırlayıcı (varsayılan 0,75 ≈ −2,5 dBFS); iki ölçümle"""
    gain = target - measure_i(wav)
    tmp = wav.replace('.wav', '-dene.wav')
    chain = lambda g: f'volume={g:.2f}dB,alimiter=limit={limit}:attack=2:release=80:level=0'
    sh(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', chain(gain), tmp])
    gain += target - measure_i(tmp)
    return chain(gain)


def compose_reel(slug, out_dir):
    work = os.path.join(OUT, slug)
    plan = json.load(open(os.path.join(work, 'plan.json')))
    os.makedirs(out_dir, exist_ok=True)
    print(f'🎞  {slug}: {plan["total"]:.1f} sn')
    video = os.path.join(work, 'video.mp4')
    if plan.get('ad'): return compose_ad(plan, work, out_dir, video)
    render_video(plan, video)
    # müzik işaretleri: kesmeler (parlamalı sahneler), vurgular (her kesme), bitiş kartı
    cues = {'style': plan['style'], 'bpm': plan['bpm'],
            'cuts': [sc['start'] for sc in plan['scenes'] if sc.get('flash')],
            'accents': [sc['start'] for sc in plan['scenes'][1:] if not sc.get('flash') and sc['id'] != 'son'],
            'end': next((sc['start'] for sc in plan['scenes'] if sc['id'] == 'son'), None),
            'boss': [[sc['start'], sc['start'] + sc['dur']] for sc in plan['scenes'] if sc.get('boss')]}
    cues_path = os.path.join(work, 'cues.json'); json.dump(cues, open(cues_path, 'w'))
    music = os.path.join(work, 'music.wav')
    sh([sys.executable, os.path.join(ROOT, 'tools', 'reels', 'music.py'), music, f'{plan["total"] + 0.6:.2f}', cues_path])
    raw = os.path.join(work, 'mix-ham.wav'); mix_audio(plan, music, raw)
    # sosyal platform düzeyi: hafif sıkıştırma + tepe sınırlayıcı, sonra iki geçişli loudnorm (−14 LUFS, gerçek tepe −1,5 dBTP)
    mixed = os.path.join(work, 'mix.wav')
    sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', 'acompressor=threshold=-20dB:ratio=2.5:attack=8:release=150:makeup=3dB', mixed])
    ln = loudness_chain(mixed)
    final = os.path.join(out_dir, f'{slug}.mp4')
    sh(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', mixed, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-af', f'{ln},aresample=48000,afade=t=in:d=0.05,afade=t=out:st={max(0, plan["total"] - 0.6):.2f}:d=0.6', '-ac', '2',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final])
    render_cover(plan, os.path.join(out_dir, f'{slug}-kapak.png'))
    size = os.path.getsize(final) / 1e6
    print(f'✅ {final} ({plan["total"]:.1f} sn, {size:.1f} MB)')


def compose_ad(plan, work, out_dir, video):
    slug = plan['slug']
    if '--audio-only' not in sys.argv: render_video_ad(plan, video)
    raw = os.path.join(work, 'mix-ham.wav'); mix_audio_ad(plan, raw)
    mixed = os.path.join(work, 'mix.wav')
    sh(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', 'acompressor=threshold=-18dB:ratio=3:attack=5:release=120:makeup=2dB', mixed])
    ln = loudness_chain(mixed, limit=plan.get('limit', 0.75))  # 3. dalga: 0,6 (parlak çan/glokenşpil geçişleri AAC'de gerçek tepeyi aşmasın)
    final = os.path.join(out_dir, f'{slug}.mp4')
    sh(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', mixed, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-af', f'{ln},aresample=48000,afade=t=in:d=0.02,afade=t=out:st={max(0, plan["total"] - 0.3):.2f}:d=0.3',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final])
    render_cover(plan, os.path.join(out_dir, f'{slug}-kapak.png'))
    print(f'✅ {final} ({plan["total"]:.1f} sn, {os.path.getsize(final) / 1e6:.1f} MB)')


# ------------------------------------------------------------------ eski
def legacy(final):
    meta = json.load(open(os.path.join(OUT, 'scenes.json')))
    order = meta['order']; XF = 0.3
    segs = []
    for sid in order:
        m = meta[sid]; seg = os.path.join(OUT, f'seg-{sid}.mp4'); sp = float(m.get('speed', 1))
        sh(['ffmpeg', '-y', '-ss', f"{m['start']:.3f}", '-i', m['file'], '-t', f"{m['dur'] / sp:.3f}",
            '-vf', f'setpts={sp}*(PTS-STARTPTS),fps={FPS},scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', seg])
        segs.append((seg, m['dur'])); print(f'✂️  {sid}: {m["dur"]} sn')
    inputs = []
    for s, _ in segs: inputs += ['-i', s]
    parts = []; prev = '[0:v]'; t = segs[0][1]; starts = [0.0]
    for i in range(1, len(segs)):
        off = t - XF; starts.append(off); lab = f'[v{i}]'
        parts.append(f'{prev}[{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}{lab}'); prev = lab; t = off + segs[i][1]
    total = t
    video_only = os.path.join(OUT, 'video-only.mp4')
    sh(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(parts), '-map', prev, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', str(FPS), video_only])
    cues = {'cuts': [round(x + XF / 2, 3) for x in starts[1:]],
            'boss': [[round(starts[i], 3), round(starts[i] + segs[i][1], 3)] for i, sid in enumerate(order) if meta[sid].get('boss')]}
    cues_path = os.path.join(OUT, 'cues.json'); json.dump(cues, open(cues_path, 'w'))
    music = os.path.join(OUT, 'music.wav')
    sh([sys.executable, os.path.join(ROOT, 'tools', 'reels', 'music.py'), music, f'{total + 0.5:.2f}', cues_path])
    os.makedirs(os.path.dirname(final), exist_ok=True)
    sh(['ffmpeg', '-y', '-i', video_only, '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-af', f'afade=t=out:st={max(0, total - 1.2):.2f}:d=1.2', '-shortest', '-movflags', '+faststart', final])
    print(f'✅ {final} ({total:.1f} sn)')


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--reel' in a:
        which = a[a.index('--reel') + 1]
        out_dir = a[a.index('--out') + 1] if '--out' in a else os.path.join(ROOT, 'marketing', 'reels')
        slugs = sorted(d for d in os.listdir(OUT) if os.path.exists(os.path.join(OUT, d, 'plan.json'))) if which == 'all' else which.split(',')
        for s in slugs:
            if '--cover-only' in a:
                render_cover(json.load(open(os.path.join(OUT, s, 'plan.json'))), os.path.join(out_dir, f'{s}-kapak.png'))
            else: compose_reel(s, out_dir)
    else:
        legacy(a[0] if a else os.path.join(ROOT, 'marketing', 'reels', 'odi-nasil-oynanir.mp4'))
