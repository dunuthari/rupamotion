#!/bin/bash
# Builds cep/RuMotion-Setup.exe (Windows installer). Needs: mono-mcs, python3. Run `npm run cep` first (it fills cep/RuMotion).
set -e
cd "$(dirname "$0")"
[ -d ../cep/RuMotion ] || { echo "run npm run cep first"; exit 1; }
rm -f /tmp/RuMotion.zip
python3 - <<'EOF'
import os, zipfile
root = "../cep/RuMotion"
with zipfile.ZipFile("/tmp/RuMotion.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, fs in os.walk(root):
        for f in fs:
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, root).replace(os.sep, "/"))
EOF
mcs -nologo -target:winexe -optimize+ -out:../cep/RuMotion-Setup.exe -win32icon:ru.ico \
  -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.IO.Compression.dll -r:System.IO.Compression.FileSystem.dll \
  -resource:/tmp/RuMotion.zip,RuMotion.zip RuSetup.cs LogoData.cs
ls -l ../cep/RuMotion-Setup.exe
(cd ../cep && zip -q RuMotion-CEP.zip RuMotion-Setup.exe)
echo "added to cep/RuMotion-CEP.zip"
