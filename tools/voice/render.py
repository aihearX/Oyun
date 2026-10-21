#!/usr/bin/env python3
"""
Tüy Dede ham ses üretimi (yalnız geliştirici makinesinde; uygulama bu betiği hiç çalıştırmaz).
Coqui TTS Türkçe modeli: tts_models/tr/common-voice/glow-tts + vocoder_models/tr/common-voice/hifigan
(Fatih Akademi, MIT lisansı; Common Voice Türkçe verisiyle eğitilmiş, CC0). Bkz. docs/anlatici-metinleri.md "Ses lisansı".

Kullanım (tools/voice/generate.mjs çağırır):
  python render.py <iş.json> <model_klasörü> <çıktı_klasörü>
iş.json: [{"id": "...", "spoken": "...", "hash": "...", "ls": 0.88}]  → <çıktı>/<id>.<hash>.ls<ls>.wav (zaten varsa atlanır)
ls: modelin kendi hız ayarı (GlowTTS length_scale; <1 daha hızlı). Prozodi doğal kalır (yalnız atempo ile hızlandırmaktan iyidir).
"""
import json
import os
import sys
import warnings

warnings.filterwarnings('ignore')


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    job_path, models, out = sys.argv[1:]
    job = json.load(open(job_path, encoding='utf-8'))
    os.makedirs(out, exist_ok=True)
    name = lambda j: f"{j['id']}.{j['hash']}.ls{j.get('ls', 1.0)}.wav"
    todo = [j for j in job if not os.path.exists(os.path.join(out, name(j)))]
    if not todo:
        print('ham ses: hepsi hazır (önbellek)')
        return 0
    from TTS.utils.synthesizer import Synthesizer  # ağır içe aktarma: yalnız gerekince

    tts = os.path.join(models, 'tts_models--tr--common-voice--glow-tts')
    voc = os.path.join(models, 'vocoder_models--tr--common-voice--hifigan')
    syn = Synthesizer(
        tts_checkpoint=os.path.join(tts, 'model_file.pth'), tts_config_path=os.path.join(tts, 'config.json'),
        vocoder_checkpoint=os.path.join(voc, 'model_file.pth'), vocoder_config=os.path.join(voc, 'config.json'),
        use_cuda=False,
    )
    for i, j in enumerate(todo, 1):
        syn.tts_model.length_scale = float(j.get('ls', 1.0))
        wav = syn.tts(j['spoken'])
        syn.save_wav(wav, os.path.join(out, name(j)))
        print(f"  [{i}/{len(todo)}] {j['id']}", flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
