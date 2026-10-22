#!/usr/bin/env python3
"""ODİ Reels birleştirme.

Teaser:   python3 tools/reels/compose.py --reel <slug|all> [--out marketing/reels]
  plan.json (record.mjs --reel) → her çıktı karesi: oynanış klibinden simülasyon saniyesine en yakın kare (kırpılıp 1080×1920'ye
  ölçeklenir) + saydam yazı/kart katmanı. Ses: özgün müzik (music.py, sahne kesmelerine göre) + Tüy Dede'nin kayıtları
  (müzik ses altında kısılır) → sıkıştırma + kazanç + tepe sınırlayıcı, −14 LUFS. Çıktı: <out>/<slug>.mp4 (H.264 + AAC, 30 kare/sn, faststart)
  ve <out>/<slug>-kapak.png (1080×1920).
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
    top = max(0.0, min(top, 780.0 - gh))
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
        im = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(3))).enhance(0.62)
    else:
        im = Image.new('RGB', (W, H), BG)
    out = im.convert('RGBA'); out.alpha_composite(Image.open(cv['png']).convert('RGBA'))
    out.convert('RGB').save(png_out, optimize=True)


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


def loudness_chain(wav, target=-14.0):
    """hedef bütünleşik ses yüksekliği için kazanç + tepe sınırlayıcı (−1,9 dBFS); iki ölçümle"""
    gain = target - measure_i(wav)
    tmp = wav.replace('.wav', '-dene.wav')
    chain = lambda g: f'volume={g:.2f}dB,alimiter=limit=0.75:attack=2:release=80:level=0'
    sh(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', chain(gain), tmp])
    gain += target - measure_i(tmp)
    return chain(gain)


def compose_reel(slug, out_dir):
    work = os.path.join(OUT, slug)
    plan = json.load(open(os.path.join(work, 'plan.json')))
    os.makedirs(out_dir, exist_ok=True)
    print(f'🎞  {slug}: {plan["total"]:.1f} sn')
    video = os.path.join(work, 'video.mp4'); render_video(plan, video)
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
