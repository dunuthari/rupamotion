# Sinhala model for the Captions tab

The **Sinhala Transcript** button runs offline with one model file, `ggml-sinhala.bin`: a Sinhala-trained Whisper model converted to
whisper.cpp's format. Stock Whisper models answer Sinhala in Latin letters and make far too many mistakes, so a Sinhala-trained model is needed.

## 1. Make the file (you, once)

Needs Python 3.9+, about 6 GB of free disk space and internet.

```
python tools/convert_sinhala_model.py
```

- Default model: `seniruk/whisper-medium-si` (about 1.5 GB converted, slow on a CPU, reported about 29% word errors on its own test set; not verified).
- Smaller and faster, less accurate: `python tools/convert_sinhala_model.py --model kasunw/whisper-small-sinhala` (about 0.5 GB).
- The file is saved to `%APPDATA%\RuMotion\whisper\models\ggml-sinhala.bin` (Windows) or `~/Library/Application Support/RuMotion/whisper/models/` (Mac).
  The Sinhala Transcript button uses it straight away. That is also how you try it before giving it to anyone.
- The script was written without being able to run it. If a step fails, send the message it prints.
- Check the model's licence on its Hugging Face page before sharing the converted file.

## 2. Let every user get it automatically (you, once, after you tried it)

1. Put `ggml-sinhala.bin` online where anyone can download it (for example upload it to a Hugging Face model repo you own) and copy its direct download link.
2. Open `cep/transcribe.js`, find `api.SINHALA_MODEL_URL = "";` and put the link between the quotes.
3. Run `npm run check` and `npm run cep`, then give users the new `cep/RuMotion-CEP.zip`.

Users then click Sinhala Transcript; the first time, the panel downloads the file once (with a progress bar) and keeps it.
Without a link and without the file in the models folder, the button says the Sinhala model is not installed yet and names the folder.

## 3. For the user

- After Effects > Preferences > Type > Text Engine: **South Asian and Middle Eastern** (restart After Effects), or Sinhala letters may display wrongly.
- Check every caption line: speech recognition makes mistakes.
