#!/usr/bin/env bash
# Anlatıcı ses ortamını (Chatterbox Multilingual + Whisper) sıfırdan kurar: venv + model önbelleği tek klasörde.
# Kullanım: tools/voice/ortam-kur.sh [klasör]   (varsayılan: tools/harness/out/ses — git'e girmez)
# Sonra:   HF_HOME=<klasör>/hf nice -n 5 <klasör>/venv/bin/python tools/reels/vo.py --only <reels>
#          ODI_CB_PY=<klasör>/venv/bin/python HF_HOME=<klasör>/hf ODI_CB_CACHE=<klasör>/cb node tools/voice/generate.mjs
# Gerekenler: python3.11, ffmpeg (libmp3lame). Disk: venv ≈1,9 GB + modeller ≈3 GB (ResembleAI/chatterbox, openai/whisper-large-v3-turbo).
# 2026-10'da sınandı: torch 2.6.0+cpu, chatterbox-tts 0.1.7 (bağımlılıklarıyla transformers 5.2.0, librosa 0.11.0); ilk çalıştırmada modeller iner.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${1:-$ROOT/tools/harness/out/ses}"
mkdir -p "$DIR/hf"
[ -x "$DIR/venv/bin/python" ] || python3.11 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
"$DIR/venv/bin/pip" install -q chatterbox-tts==0.1.7
# modelleri indir ve bir kez dene (Türkçe tek cümle + Whisper dökümü)
HF_HOME="$DIR/hf" "$DIR/venv/bin/python" - "$ROOT/tools/reels/vo/ref-tr-erkek.wav" <<'PY'
import sys, torch, librosa
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from transformers import pipeline
tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu'); torch.manual_seed(1)
w = tts.generate('Kulaktan beyne, bir sesin yolculuğu.', language_id='tr', audio_prompt_path=sys.argv[1], exaggeration=0.8, cfg_weight=0.3, temperature=0.8)
y = librosa.resample(w.squeeze(0).numpy(), orig_sr=tts.sr, target_sr=16000)
asr = pipeline('automatic-speech-recognition', model='openai/whisper-large-v3-turbo', device='cpu')
print('deneme dökümü:', asr(y, generate_kwargs={'language': 'turkish', 'task': 'transcribe'})['text'])
PY
echo "hazır: HF_HOME=$DIR/hf  python=$DIR/venv/bin/python"
