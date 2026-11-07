#!/usr/bin/env python3
"""Ru Motion: make the Sinhala speech model for the Captions tab.

It takes a Sinhala-trained Whisper model from Hugging Face, converts it to whisper.cpp's format and saves it as
ggml-sinhala.bin in Ru Motion's models folder (or the folder you give with --out). The Sinhala Transcript button then uses it.

    python convert_sinhala_model.py
    python convert_sinhala_model.py --model kasunw/whisper-small-sinhala --out C:\\temp

Needs: Python 3.9 or newer, about 6 GB of free disk space, and an internet connection. The first run installs torch, transformers,
numpy and huggingface_hub with pip (a few minutes). The conversion can take several minutes and a few GB of memory.

NOT TESTED by the author: it follows whisper.cpp's documented conversion steps, but it was written without being able to run them.
If a step fails, copy the message it prints and send it back.

Check the model's licence on its Hugging Face page before you give the converted file to other people.
"""
import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

DEFAULT_MODEL = "seniruk/whisper-medium-si"   # reported ~29% word errors on its own test set (not verified); about 1.5 GB converted
CONVERT_URL = "https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/models/convert-h5-to-ggml.py"
WHISPER_ZIP = "https://github.com/openai/whisper/archive/refs/heads/main.zip"


def models_folder():
    home = os.path.expanduser("~")
    if platform.system() == "Windows":
        base = os.environ.get("APPDATA") or os.path.join(home, "AppData", "Roaming")
    elif platform.system() == "Darwin":
        base = os.path.join(home, "Library", "Application Support")
    else:
        base = os.path.join(home, ".config")
    return os.path.join(base, "RuMotion", "whisper", "models")


def say(msg):
    print("\n== " + msg, flush=True)


def ensure_packages():
    need = {"torch": "torch", "transformers": "transformers", "numpy": "numpy", "huggingface_hub": "huggingface_hub"}
    missing = []
    for mod, pkg in need.items():
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    if missing:
        say("Installing " + ", ".join(missing) + " (this can take a few minutes)")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade"] + missing)


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "RuMotion"})
    with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def main():
    ap = argparse.ArgumentParser(description="Convert a Sinhala Whisper model for Ru Motion")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="Hugging Face model id (default: %s)" % DEFAULT_MODEL)
    ap.add_argument("--out", default=models_folder(), help="folder for ggml-sinhala.bin (default: Ru Motion's models folder)")
    args = ap.parse_args()

    if sys.version_info < (3, 9):
        sys.exit("Python 3.9 or newer is needed.")
    ensure_packages()
    from huggingface_hub import snapshot_download

    work = tempfile.mkdtemp(prefix="rumotion-convert-")
    try:
        say("Downloading the model " + args.model + " (large, please wait)")
        model_dir = snapshot_download(repo_id=args.model, local_dir=os.path.join(work, "model"))

        say("Getting whisper.cpp's converter and OpenAI's Whisper files")
        script = os.path.join(work, "convert-h5-to-ggml.py")
        download(CONVERT_URL, script)
        zpath = os.path.join(work, "whisper.zip")
        download(WHISPER_ZIP, zpath)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(work)
        whisper_repo = os.path.join(work, "whisper-main")
        if not os.path.isdir(os.path.join(whisper_repo, "whisper", "assets")):
            sys.exit("The OpenAI Whisper download did not contain whisper/assets. Its layout may have changed.")

        say("Converting (a few minutes)")
        out_tmp = os.path.join(work, "out")
        os.makedirs(out_tmp)
        subprocess.check_call([sys.executable, script, model_dir, whisper_repo, out_tmp], cwd=out_tmp)
        produced = os.path.join(out_tmp, "ggml-model.bin")
        if not os.path.isfile(produced):
            sys.exit("The converter finished but ggml-model.bin was not created. Look at its messages above.")

        os.makedirs(args.out, exist_ok=True)
        target = os.path.join(args.out, "ggml-sinhala.bin")
        shutil.move(produced, target)
        size_mb = os.path.getsize(target) / (1024 * 1024)
        say("Done: %s (%.0f MB)" % (target, size_mb))
        print("No restart needed: open Ru Motion > Text > Captions and click Sinhala Transcript.")
        print("To give the model to other users, put the file online and set SINHALA_MODEL_URL in cep/transcribe.js (see docs/sinhala-model.md).")
        print("Remember to check the licence of " + args.model + " on https://huggingface.co/" + args.model)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
