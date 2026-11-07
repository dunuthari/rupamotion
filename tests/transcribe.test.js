// Tests for cep/transcribe.js: the pure helpers, and the whole pipeline with a fake whisper engine, a fake ffmpeg and a local web server
// standing in for the model download. (Real whisper.cpp, ffmpeg and the real downloads are not available here.)
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const T = require('../cep/transcribe.js');
const R = {};
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---- pure helpers
const whisperJson = JSON.stringify({ transcription: [
  { timestamps: { from: '00:00:00,000', to: '00:00:02,500' }, offsets: { from: 0, to: 2500 }, text: ' Hello  there,' },
  { timestamps: { from: '00:00:02,500', to: '00:00:02,600' }, offsets: { from: 2500, to: 2600 }, text: ' [BLANK_AUDIO]' },
  { timestamps: { from: '00:00:03,000', to: '00:00:03,100' }, offsets: { from: 3000, to: 3100 }, text: ' short' },
  { timestamps: { from: '00:00:03,300', to: '00:00:05,000' }, offsets: { from: 3300, to: 5000 }, text: ' (music) welcome back' },
  { timestamps: { from: '00:00:04,900', to: '00:00:07,000' }, offsets: { from: 4900, to: 7000 }, text: ' overlapping line' },
  { timestamps: { from: '00:00:08,000', to: '00:00:08,000' }, offsets: { from: 8000, to: 8000 }, text: ' zero length' },
  { timestamps: { from: '00:00:09,000', to: '00:00:09,200' }, text: '♪' }
] });
const parsed = T.parseWhisperJson(whisperJson);
R['parse: 7 raw lines, offsets in seconds'] = parsed.length === 7 && near(parsed[0].end, 2.5) && near(parsed[3].start, 3.3);
const clean = T.cleanSegments(parsed);
R['clean: tags, music note and zero-length lines are dropped'] = clean.map(s => s.text).join('|') === 'Hello there,|short|welcome back|overlapping line';
R['clean: spaces collapsed, tag removed inside a line'] = clean[0].text === 'Hello there,' && clean[2].text === 'welcome back';
R['clean: a 0.1 s line is stretched to 0.4 s but never into the next line'] = near(clean[1].end - clean[1].start, 0.3) || near(clean[1].end, 3.3);
R['clean: overlap trimmed (welcome back ends where the next line starts)'] = near(clean[2].end, 4.9) && near(clean[3].start, 4.9);
R['clean: lines are in time order and never overlap'] = clean.every((s, i) => i === 0 || s.start >= clean[i - 1].end - 1e-9);
const tc = T.parseWhisperJson(JSON.stringify({ transcription: [{ timestamps: { from: '00:01:02,500', to: '01:00:00,000' }, text: 'x' }] }));
R['parse: falls back to the HH:MM:SS,mmm stamps'] = near(tc[0].start, 62.5) && near(tc[0].end, 3600);

const wav = T.encodeWav(new Int16Array([0, 1000, -1000, 32767]), 16000), dv = new DataView(wav.buffer);
R['wav: RIFF header, 16 kHz mono 16-bit, 4 samples'] = String.fromCharCode(...wav.slice(0, 4)) === 'RIFF' && String.fromCharCode(...wav.slice(8, 12)) === 'WAVE'
  && dv.getUint32(24, true) === 16000 && dv.getUint16(22, true) === 1 && dv.getUint16(34, true) === 16 && dv.getUint32(40, true) === 8 && wav.length === 52 && dv.getInt16(44 + 6, true) === 32767;
const i16 = T.floatToInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]));
R['float -> int16 clips at full scale'] = i16[1] === 32767 && i16[2] === -32768 && i16[3] === 32767 && i16[4] === -32768 && Math.abs(i16[5] - 16383.5) < 1;
R['whisper arguments for Sinhala: language si, a Sinhala-script prompt, no -ml/-sow (they can cut a multi-byte letter)'] = (() => { const a = T.whisperArgs('/m/b.bin', '/t/a.wav', '/t/out', 4, 'si'); const i = a.indexOf('--prompt'); return i > 0 && /^[\u0D80-\u0DFF .]+$/.test(a[i + 1]) && /[\u0D80-\u0DFF]/.test(a[i + 1]) && a[i + 1].length > 10 && a.join(' ').startsWith('-m /m/b.bin -f /t/a.wav -l si -oj -of /t/out --prompt ') && a.slice(-3).join(' ') === '-t 4 -pp' && a.indexOf('-ml') < 0 && a.indexOf('-mc') < 0; })();
R['English arguments have no prompt'] = T.whisperArgs('m', 'w', 'o', 2, 'en').indexOf('--prompt') < 0;
R['hasSinhala tells Sinhala script from Latin letters'] = T.hasSinhala([{ text: 'Mei ni amal' }, { text: '\u0DB8\u0DB8' }]) === true && T.hasSinhala([{ text: 'Mei ni amal, amal tati eno' }]) === false;
R['model names: English uses .en, other languages the multilingual ones, Best = medium'] = T.modelName('en', 'fast') === 'tiny.en' && T.modelName('si', 'fast') === 'tiny' && T.modelName('si', 'best') === 'medium' && T.modelName('en', 'best') === 'medium.en' && T.MODELS.medium.mb === 1530;
const long = [{ start: 10, end: 20, text: 'aaaa bbbb cccc dddd eeee ffff gggg hhhh' }, { start: 20, end: 22, text: 'short one' }];
const sp = T.splitLong(long, 20);
R['splitLong: a long segment is cut at spaces into lines of at most 20 characters'] = sp.length === 3 && sp.every(s => s.text.length <= 20) && sp.map(s => s.text).join(' ') === long[0].text + ' short one' && sp[2].text === 'short one';
R['splitLong: the segment time is shared in proportion to length and stays continuous'] = near(sp[0].start, 10) && near(sp[1].start, sp[0].end) && near(sp[1].end, 20) && sp[0].end > 10 && sp[0].end < 20;
R['dropRepeats: an identical line right after itself is dropped (Whisper loops)'] = T.dropRepeats([{ text: 'a' }, { text: 'a' }, { text: 'b' }, { text: 'a' }]).map(s => s.text).join('') === 'aba';
R['whisper arguments: English, JSON, 42-char lines split on words, progress'] = (() => { const a = T.whisperArgs('/m/b.bin', '/t/a.wav', '/t/out', 4); return a.join(' ') === '-m /m/b.bin -f /t/a.wav -l en -oj -of /t/out -ml 42 -sow -t 4 -pp'; })();


// ---- picking the Windows engine download from a list of releases
const rel = (tag, names, extra) => Object.assign({ tag_name: tag, assets: names.map(n => ({ name: n, browser_download_url: 'https://x/' + tag + '/' + n })) }, extra || {});
const rels = [rel('v9.9', []), rel('v9.8', ['whisper-v9.8-xcframework.zip', 'whisper-cublas-12.4.0-bin-x64.zip']), rel('v9.7', ['whisper-blas-bin-x64.zip', 'whisper-bin-Win32.zip', 'whisper-bin-x64.zip']), rel('v9.6', ['whisper-bin-x64.zip'])];
const pk = T.pickWindowsAsset(rels);
R['picker: skips releases without files and CUDA-only ones, takes whisper-bin-x64.zip of the newest usable release'] = !!pk && pk.tag === 'v9.7' && pk.name === 'whisper-bin-x64.zip' && pk.url === 'https://x/v9.7/whisper-bin-x64.zip';
R['picker: falls back to an OpenBLAS x64 zip when that is all there is'] = (T.pickWindowsAsset([rel('v1', ['whisper-blas-bin-x64.zip'])]) || {}).name === 'whisper-blas-bin-x64.zip';
R['picker: a differently named x64 zip is accepted (e.g. whisper-v1.8-bin-x64.zip)'] = (T.pickWindowsAsset([rel('v1', ['whisper-v1.8-bin-x64.zip'])]) || {}).name === 'whisper-v1.8-bin-x64.zip';
R['picker: nothing usable -> null, and the error text lists what was seen'] = T.pickWindowsAsset([rel('v1', ['a.zip'])]) === null && /v1: a\.zip/.test(T.describeReleases([rel('v1', ['a.zip'])])) && T.pickWindowsAsset([rel('v1', ['whisper-bin-x64.zip'], { draft: true })]) === null;

// ---- the pipeline with fakes (Linux/Mac only: the fakes are shell scripts)
async function pipeline() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ru-t-'));
  const prevHome = process.env.HOME, prevAppdata = process.env.APPDATA, prevPath = process.env.PATH;
  process.env.HOME = root; process.env.APPDATA = root; const prevTmp = process.env.TMPDIR; process.env.TMPDIR = path.join(root, 'tmp'); fs.mkdirSync(process.env.TMPDIR);
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  // fake whisper-cli: prints progress, writes <prefix>.json from the -of argument
  const engine = path.join(bin, 'whisper-cli');
  fs.writeFileSync(engine, `#!/bin/sh
prefix=""; model=""; wavf=""
while [ $# -gt 0 ]; do case "$1" in -of) prefix="$2"; shift;; -m) model="$2"; shift;; -f) wavf="$2"; shift;; esac; shift; done
[ -f "$model" ] || { echo "no model" >&2; exit 3; }
[ -f "$wavf" ] || { echo "no wav" >&2; exit 4; }
echo "whisper_print_progress_callback: progress =  40%" >&2
echo "whisper_print_progress_callback: progress = 100%" >&2
cat > "$prefix.json" <<'EOF2'
${whisperJson.replace(/\\/g, '\\\\')}
EOF2
`); fs.chmodSync(engine, 0o755);
  // fake ffmpeg: copies the input to the output (the last argument)
  fs.writeFileSync(path.join(bin, 'ffmpeg'), '#!/bin/sh\nfor last; do :; done\ncp "$3" "$last"\n'); fs.chmodSync(path.join(bin, 'ffmpeg'), 0o755);
  process.env.PATH = bin + ':' + prevPath;
  // a local server standing in for the model download
  const srv = http.createServer((req, res) => { if (req.url === '/ggml-tiny.en.bin' || req.url === '/ggml-tiny.bin') { res.writeHead(200, { 'Content-Length': 2000 }); res.end(Buffer.alloc(2000, 7)); } else { res.writeHead(404); res.end(); } });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  T.MODELS['tiny.en'].mb = 0.001;   // 1 KB "model" for the test
  const input = path.join(root, 'voice.wav'); fs.writeFileSync(input, T.encodeWav(new Int16Array(16000), 16000));
  const msgs = [], fracs = [];
  try {
    R['engine is found on PATH'] = T.findEngine() === engine;
    R['ffmpeg is found on PATH'] = T.findFfmpeg() === path.join(bin, 'ffmpeg');
    const h = T.transcribe({ file: input, model: 'tiny.en', modelBase: base, onStatus: (m, f) => { msgs.push(m); if (typeof f === 'number') fracs.push(f); } });
    const segs = await h.promise;
    R['pipeline: 4 clean captions come back'] = segs.length === 4 && segs[0].text === 'Hello there,' && near(segs[3].start, 4.9);
    R['pipeline: the model was downloaded to the app folder'] = fs.existsSync(path.join(T.baseDir(), 'models', 'ggml-tiny.en.bin'));
    R['pipeline: status covers model download, audio, transcribing with progress'] = msgs.some(m => /Downloading the tiny.en model/.test(m)) && msgs.some(m => /Reading the audio/.test(m)) && msgs.some(m => /Transcribing… 40%/.test(m)) && fracs.some(f => f === 0.4);
    R['pipeline: temp files are cleaned up'] = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('rumotion-')).length === 0;
    // second run: the model is reused (no download message)
    const msgs2 = [];
    await T.transcribe({ file: input, model: 'tiny.en', modelBase: base, onStatus: m => msgs2.push(m) }).promise;
    R['second run reuses the model'] = !msgs2.some(m => /Downloading/.test(m));
    // Sinhala: multilingual model, language flag, long segments cut into lines, repeats dropped
    const argsFile = path.join(root, 'args.txt');
    const siJson = JSON.stringify({ transcription: [
      { offsets: { from: 0, to: 12000 }, text: ' \u0DB8\u0DB8 \u0D9A\u0DD9\u0DB1\u0DD9\u0D9A\u0DCA \u0DC0\u0DD2\u0DBA \u0DC4\u0DD0\u0D9A\u0DD2 \u0DB6\u0DC0 \u0DB4\u0DD0\u0DC0\u0DC3\u0DD3\u0DB8 \u0D9A\u0DD2\u0DBA\u0DB1 \u0D9C\u0DD0\u0DB1 \u0D9A\u0DAD\u0DCF \u0D9A\u0DBB\u0DB8\u0DD2' },
      { offsets: { from: 12000, to: 14000 }, text: ' \u0DB8\u0DB8' }, { offsets: { from: 14000, to: 16000 }, text: ' \u0DB8\u0DB8' }] });
    fs.writeFileSync(engine, `#!/bin/sh
echo "$@" > "${argsFile}"
prefix=""; while [ $# -gt 0 ]; do case "$1" in -of) prefix="$2"; shift;; esac; shift; done
cat > "$prefix.json" <<'EOF3'
${siJson}
EOF3
`);
    fs.chmodSync(engine, 0o755);
    T.MODELS['tiny'].mb = 0.001;
    const sSegs = await T.transcribe({ file: input, model: 'tiny', lang: 'si', modelBase: base }).promise;
    const sArgs = fs.readFileSync(argsFile, 'utf8');
    R['Sinhala pipeline: engine called with -l si and the multilingual model, no -ml'] = /-l si /.test(sArgs) && /ggml-tiny\.bin/.test(sArgs) && sArgs.indexOf('-ml') < 0;
    R['Sinhala pipeline: long segment split into <= 40 character lines, repeated line dropped, Sinhala text intact'] = sSegs.length >= 2 && sSegs.every(s => s.text.length <= 40) && sSegs[sSegs.length - 1].text === '\u0DB8\u0DB8' && sSegs.filter(s => s.text === '\u0DB8\u0DB8').length === 1 && /\u0DB8\u0DB8 \u0D9A\u0DD9/.test(sSegs[0].text);
    // a user-supplied Sinhala model (ggml-sinhala.bin in the models folder) is used instead of a download
    fs.writeFileSync(path.join(T.baseDir(), 'models', 'ggml-sinhala.bin'), 'x');
    const msgsC = [];
    await T.transcribe({ file: input, model: 'small', lang: 'si', modelBase: 'http://127.0.0.1:1', onStatus: m => msgsC.push(m) }).promise;
    R['a ggml-sinhala.bin in the models folder is used instead of downloading a model'] = msgsC.some(m => /Using your model ggml-sinhala\.bin/.test(m)) && /ggml-sinhala\.bin/.test(fs.readFileSync(argsFile, 'utf8'));
    fs.unlinkSync(path.join(T.baseDir(), 'models', 'ggml-sinhala.bin'));
    // a failing engine reports its message
    fs.writeFileSync(engine, '#!/bin/sh\necho "boom: bad model" >&2\nexit 7\n');
    let err = null; try { await T.transcribe({ file: input, model: 'tiny.en', modelBase: base }).promise; } catch (e) { err = e; }
    R['engine failure: error carries the exit code and message'] = !!err && /exit code 7/.test(err.message) && /boom/.test(err.message);
    // cancel
    fs.writeFileSync(engine, '#!/bin/sh\nsleep 5\n');
    const slow = T.transcribe({ file: input, model: 'tiny.en', modelBase: base });
    setTimeout(() => slow.cancel(), 400);
    let cerr = null; try { await slow.promise; } catch (e) { cerr = e; }
    R['cancel stops the engine and reports cancelled'] = !!cerr && cerr.cancelled === true;
    // unknown model / missing model server
    let e2 = null; try { await T.ensureModel('nope', () => {}); } catch (e) { e2 = e; }
    R['no temp files are left after a failure or a cancel'] = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('rumotion-')).length === 0;
    R['unknown model is refused'] = !!e2 && /Unknown model/.test(e2.message);
  } finally {
    srv.close(); if (prevTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = prevTmp; process.env.HOME = prevHome; process.env.PATH = prevPath; if (prevAppdata === undefined) delete process.env.APPDATA; else process.env.APPDATA = prevAppdata;
  }
}


// ---- flaky networks: dropped connections are retried, a cut-off download resumes, curl takes over when Node keeps failing
async function network() {
  T._retryDelay = 10;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ru-n-'));
  const payload = Buffer.alloc(3000, 5); for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
  let jsonHits = 0, cutHits = 0, rangeSeen = '', nodeBlocked = false;
  const srv = http.createServer((req, res) => {
    const ua = String(req.headers['user-agent'] || '');
    if (nodeBlocked && ua === 'RuMotion') { req.socket.destroy(); return; }
    if (req.url === '/flaky.json') { if (++jsonHits < 3) { req.socket.destroy(); return; } res.writeHead(200); res.end('{"ok":true}'); return; }
    if (req.url === '/cut.bin') {
      cutHits++;
      if (req.headers.range) { rangeSeen = req.headers.range; const from = +/bytes=(\d+)-/.exec(req.headers.range)[1]; res.writeHead(206, { 'Content-Length': payload.length - from, 'Content-Range': 'bytes ' + from + '-' + (payload.length - 1) + '/' + payload.length }); res.end(payload.slice(from)); return; }
      res.writeHead(200, { 'Content-Length': payload.length }); res.write(payload.slice(0, 1000)); setTimeout(() => req.socket.destroy(), 30); return;
    }
    if (req.url === '/file.bin') { res.writeHead(200, { 'Content-Length': payload.length }); res.end(payload); return; }
    if (req.url === '/data.json') { res.writeHead(200); res.end('{"via":"curl"}'); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    const j = await T.getJson(base + '/flaky.json');
    R['getJson retries a reset connection (3rd try works)'] = j.ok === true && jsonHits === 3;
    const dest = path.join(root, 'cut.bin');
    await T.download(base + '/cut.bin', dest);
    R['a download cut off half way resumes with a Range request and ends up byte for byte equal'] = Buffer.compare(fs.readFileSync(dest), payload) === 0 && /^bytes=\d+-$/.test(rangeSeen) && cutHits === 2 && !fs.existsSync(dest + '.part');
    const hasCurl = T.findFfmpeg !== undefined && require('child_process').spawnSync('curl', ['--version']).status === 0;
    if (hasCurl) {
      nodeBlocked = true;
      const d2 = path.join(root, 'file.bin');
      await T.download(base + '/file.bin', d2, null, 3000);
      R['when Node keeps getting reset, curl downloads the file'] = Buffer.compare(fs.readFileSync(d2), payload) === 0;
      const jj = await T.getJson(base + '/data.json');
      R['...and fetches JSON'] = jj.via === 'curl';
      nodeBlocked = false;
    }
    let nerr = null; try { await T.download(base + '/missing.bin', path.join(root, 'm.bin')); } catch (e) { nerr = e; }
    R['a 404 is reported at once (no retries)'] = !!nerr && /404/.test(nerr.message) && !T.isNetErr(nerr);
    R['network errors get a plain hint'] = /internet connection/.test(T.netHint(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))) && T.netHint(new Error('nope')) === '';
  } finally { srv.close(); T._retryDelay = 1500; }
}

(process.platform === 'win32' ? Promise.resolve() : pipeline().then(network)).then(() => {
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`transcribe.js: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
  if (bad.length) process.exitCode = 1;
}).catch(e => { console.log('transcribe.js: test crashed: ' + (e && e.stack || e) + ' | done: ' + Object.keys(R).slice(-4).join(' ; ')); process.exitCode = 1; });
