#!/usr/bin/env python3
"""Kayıtlı sahneleri (tools/harness/out/reels/raw/*.webm) birleştirip 1080×1920 Reels MP4 üretir.
Sahne kesimi scenes.json'daki başlangıç ofsetlerine göre; geçişler 0,3 sn yumuşak; özgün müzik altına eklenir.
Kullanım: python3 tools/reels/compose.py <çıktı.mp4>
"""
import json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'harness', 'out', 'reels')
final = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'marketing', 'reels', 'odi-nasil-oynanir.mp4')
meta = json.load(open(os.path.join(OUT, 'scenes.json')))
order = meta['order']
XF = 0.3
FPS = 30

def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:]); raise SystemExit(f'ffmpeg hata: {" ".join(cmd[:6])}')

segs = []
for sid in order:
    m = meta[sid]
    seg = os.path.join(OUT, f'seg-{sid}.mp4')
    sp = float(m.get('speed', 1))  # ağır çekim kayıt: 1/sp hızlandır
    sh(['ffmpeg', '-y', '-ss', f"{m['start']:.3f}", '-i', m['file'], '-t', f"{m['dur'] / sp:.3f}",
        '-vf', f'setpts={sp}*(PTS-STARTPTS),fps={FPS},scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', seg])
    segs.append((seg, m['dur']))
    print(f'✂️  {sid}: {m["dur"]} sn')

# geçişli zincir
inputs = []
for s, _ in segs: inputs += ['-i', s]
parts = []; prev = '[0:v]'; t = segs[0][1]
starts = [0.0]
for i in range(1, len(segs)):
    off = t - XF; starts.append(off)
    lab = f'[v{i}]'
    parts.append(f'{prev}[{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}{lab}')
    prev = lab; t = off + segs[i][1]
total = t
video_only = os.path.join(OUT, 'video-only.mp4')
sh(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(parts), '-map', prev, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', str(FPS), video_only])

# müzik işaretleri: sahne geçişleri ve boss sahneleri (record.mjs meta[...].boss)
cues = {'cuts': [round(x + XF / 2, 3) for x in starts[1:]],
        'boss': [[round(starts[i], 3), round(starts[i] + segs[i][1], 3)] for i, sid in enumerate(order) if meta[sid].get('boss')]}
cues_path = os.path.join(OUT, 'cues.json'); json.dump(cues, open(cues_path, 'w'))
music = os.path.join(OUT, 'music.wav')
sh([sys.executable, os.path.join(ROOT, 'tools', 'reels', 'music.py'), music, f'{total + 0.5:.2f}', cues_path])
os.makedirs(os.path.dirname(final), exist_ok=True)
sh(['ffmpeg', '-y', '-i', video_only, '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-af', f'afade=t=out:st={max(0, total - 1.2):.2f}:d=1.2', '-shortest', '-movflags', '+faststart', final])
print(f'✅ {final} ({total:.1f} sn)')
