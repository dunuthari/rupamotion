/* Ru Motion: offline English transcription for the CEP panel (whisper.cpp running on the user's computer).
   Works in the panel (Node is enabled in the manifest) and in plain Node, which is how it is tested.
   Flow: find or download the engine -> find or download the model -> turn the audio into 16 kHz mono WAV -> run whisper -> clean up the lines. */
(function (root) {
  "use strict";

  var nodeRequire = (typeof require === "function") ? require
    : (root && root.require) ? root.require
    : (root && root.cep_node && root.cep_node.require) ? root.cep_node.require : null;
  var proc = (typeof process !== "undefined") ? process : (nodeRequire ? nodeRequire("process") : null);

  var api = {};
  api.MODELS = { "tiny.en": { mb: 75 }, "base.en": { mb: 142 }, "small.en": { mb: 466 }, "medium.en": { mb: 1530 }, "tiny": { mb: 75 }, "base": { mb: 142 }, "small": { mb: 466 }, "medium": { mb: 1530 } };
  api.available = function () { return !!nodeRequire && !!proc; };

  // ---------------------------------------------------------------- pure helpers

  function hms(s) {   // "00:00:03,120" -> seconds
    var m = /^(\d+):(\d+):(\d+)[,.](\d+)$/.exec(String(s || "").trim());
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+("0." + m[4])) : NaN;
  }

  // whisper-cli -oj output -> [{ start, end, text }] in seconds
  api.parseWhisperJson = function (text) {
    var obj = JSON.parse(text), list = obj.transcription || [], out = [], i, t, a, b;
    for (i = 0; i < list.length; i++) {
      t = list[i];
      if (t.offsets && typeof t.offsets.from === "number") { a = t.offsets.from / 1000; b = t.offsets.to / 1000; }
      else { a = hms(t.timestamps && t.timestamps.from); b = hms(t.timestamps && t.timestamps.to); }
      out.push({ start: a, end: b, text: String(t.text || "") });
    }
    return out;
  };

  // drop sound tags like [BLANK_AUDIO] or (music), fix overlaps, give every line a readable minimum length
  api.cleanSegments = function (segs) {
    var out = [], i, s, txt, n, minLen = 0.4;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      txt = String(s.text || "").replace(/\[[^\]]*\]|\([^)]*\)|\u266a+/g, " ").replace(/\s+/g, " ").trim();
      if (!txt || !(s.start >= 0) || !(s.end > s.start)) { continue; }
      out.push({ start: s.start, end: s.end, text: txt });
    }
    out.sort(function (x, y) { return x.start - y.start; });
    for (i = 0; i < out.length; i++) {
      n = out[i + 1];
      if (n && out[i].end > n.start) { out[i].end = n.start; }
      if (out[i].end - out[i].start < minLen) { out[i].end = n ? Math.min(out[i].start + minLen, n.start) : out[i].start + minLen; }
    }
    return out.filter(function (x) { return x.end > x.start; }).map(function (x) {
      return { start: Math.round(x.start * 1000) / 1000, end: Math.round(x.end * 1000) / 1000, text: x.text };
    });
  };


  // Whisper's own segments can be 10 to 30 seconds of text. Cut them at spaces into caption-sized lines (at most maxChars each, similar
  // lengths) and share the segment's time between the pieces in proportion to their length.
  api.splitLong = function (segs, maxChars) {
    var out = [], i, j, s, words, lines, cur, k, target, total, t, len, piece;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      if (s.text.length <= maxChars) { out.push(s); continue; }
      k = Math.ceil(s.text.length / maxChars);
      target = Math.ceil(s.text.length / k);
      words = s.text.split(" "); lines = []; cur = "";
      for (j = 0; j < words.length; j++) {
        if (cur && (cur + " " + words[j]).length > target && lines.length < k - 1) { lines.push(cur); cur = words[j]; }
        else { cur = cur ? cur + " " + words[j] : words[j]; }
      }
      if (cur) { lines.push(cur); }
      total = 0; for (j = 0; j < lines.length; j++) { total += lines[j].length; }
      t = s.start;
      for (j = 0; j < lines.length; j++) {
        len = (s.end - s.start) * lines[j].length / total;
        piece = { start: Math.round(t * 1000) / 1000, end: Math.round((j === lines.length - 1 ? s.end : t + len) * 1000) / 1000, text: lines[j] };
        out.push(piece);
        t += len;
      }
    }
    return out;
  };

  // low-resource languages make Whisper loop on one line; an identical line right after itself is dropped
  api.dropRepeats = function (segs) {
    var out = [], i;
    for (i = 0; i < segs.length; i++) {
      if (out.length && out[out.length - 1].text === segs[i].text) { continue; }
      out.push(segs[i]);
    }
    return out;
  };

  // the model file for a language: English uses the .en models, everything else the multilingual ones
  api.modelName = function (lang, size) {
    var en = { fast: "tiny.en", balanced: "base.en", accurate: "small.en", best: "medium.en" }, multi = { fast: "tiny", balanced: "base", accurate: "small", best: "medium" };
    return (lang === "en" ? en : multi)[size] || (lang === "en" ? "base.en" : "base");
  };

  // 16-bit mono PCM -> WAV bytes
  api.encodeWav = function (samples, rate) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i;
    function str(o, s) { for (var k = 0; k < s.length; k++) { v.setUint8(o + k, s.charCodeAt(k)); } }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) { v.setInt16(44 + i * 2, samples[i], true); }
    return new Uint8Array(buf);
  };

  api.floatToInt16 = function (f) {
    var out = new Int16Array(f.length), i, x;
    for (i = 0; i < f.length; i++) { x = Math.max(-1, Math.min(1, f[i])); out[i] = x < 0 ? x * 32768 : x * 32767; }
    return out;
  };

  // ---------------------------------------------------------------- files and processes (Node)

  function mods() {
    if (!nodeRequire) { throw new Error("This panel cannot reach Node.js. Reinstall Ru Motion with the latest installer."); }
    return { fs: nodeRequire("fs"), path: nodeRequire("path"), os: nodeRequire("os"), cp: nodeRequire("child_process") };
  }
  var isWin = function () { return proc && proc.platform === "win32"; };
  var isMac = function () { return proc && proc.platform === "darwin"; };

  api.baseDir = function () {
    var m = mods(), base;
    if (isWin()) { base = proc.env.APPDATA || m.path.join(m.os.homedir(), "AppData", "Roaming"); }
    else if (isMac()) { base = m.path.join(m.os.homedir(), "Library", "Application Support"); }
    else { base = m.path.join(m.os.homedir(), ".config"); }
    return m.path.join(base, "RuMotion", "whisper");
  };

  function mkdirp(dir) {
    var m = mods();
    if (m.fs.existsSync(dir)) { return; }
    mkdirp(m.path.dirname(dir));
    m.fs.mkdirSync(dir);
  }

  function walk(dir, depth, names) {   // first file named in `names` (in that order of preference) below dir
    var m = mods(), list, i, hit, full;
    if (depth < 0 || !m.fs.existsSync(dir)) { return null; }
    try { list = m.fs.readdirSync(dir); } catch (e) { return null; }
    for (i = 0; i < names.length; i++) { if (list.indexOf(names[i]) >= 0 && m.fs.statSync(m.path.join(dir, names[i])).isFile()) { return m.path.join(dir, names[i]); } }
    for (i = 0; i < list.length; i++) {
      full = m.path.join(dir, list[i]);
      try { if (m.fs.statSync(full).isDirectory()) { hit = walk(full, depth - 1, names); if (hit) { return hit; } } } catch (e1) {}
    }
    return null;
  }

  function onPath(names, extraDirs) {
    var m = mods(), dirs = String(proc.env.PATH || "").split(isWin() ? ";" : ":").concat(extraDirs || []), i, j, f;
    for (i = 0; i < dirs.length; i++) {
      if (!dirs[i]) { continue; }
      for (j = 0; j < names.length; j++) { f = m.path.join(dirs[i], names[j]); try { if (m.fs.existsSync(f) && m.fs.statSync(f).isFile()) { return f; } } catch (e) {} }
    }
    return null;
  }

  api.findEngine = function (custom) {
    var m = mods(), names = isWin() ? ["whisper-cli.exe", "whisper-cpp.exe", "main.exe"] : ["whisper-cli", "whisper-cpp"];
    if (custom && m.fs.existsSync(custom)) { return custom; }
    return walk(m.path.join(api.baseDir(), "engine"), 5, names)
      || onPath(names, isMac() ? ["/opt/homebrew/bin", "/usr/local/bin"] : []);
  };

  api.findFfmpeg = function () {
    return onPath(isWin() ? ["ffmpeg.exe"] : ["ffmpeg"], isMac() ? ["/opt/homebrew/bin", "/usr/local/bin"] : (isWin() ? ["C:\\ffmpeg\\bin"] : ["/usr/bin", "/usr/local/bin"]));
  };

  function request(url, cb, redirects, headers) {
    var lib = nodeRequire(/^http:/i.test(url) ? "http" : "https"), URLc = (typeof URL !== "undefined") ? URL : nodeRequire("url").URL, h = { "User-Agent": "RuMotion", "Accept": "*/*" }, k;
    for (k in (headers || {})) { h[k] = headers[k]; }
    var req = lib.get(url, { headers: h }, function (res) {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location && (redirects || 0) < 8) {
        res.resume();
        request(new URLc(res.headers.location, url).toString(), cb, (redirects || 0) + 1, headers);
        return;
      }
      cb(null, res);
    });
    req.setTimeout(30000, function () { req.destroy(Object.assign(new Error("connection timed out"), { code: "ETIMEDOUT" })); });
    req.on("error", function (e) { cb(e); });
  }

  function isNetErr(e) { return !!e && /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EPIPE|EHOSTUNREACH|ENETUNREACH|socket hang up|timed out|certificate|SSL|TLS|aborted/i.test(String(e.code || "") + " " + String(e.message || "")); }
  api._retryDelay = 1500;
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function retrying(fn, tries) {   // a dropped connection is retried, anything else is not
    return fn().catch(function (e) { return (tries > 1 && isNetErr(e)) ? delay(api._retryDelay).then(function () { return retrying(fn, tries - 1); }) : Promise.reject(e); });
  }
  api.isNetErr = isNetErr;
  api.netHint = function (e) {
    return isNetErr(e) ? " Check your internet connection, VPN or firewall (it needs github.com and huggingface.co) and try again." : "";
  };

  function curlPath() {
    return onPath(isWin() ? ["curl.exe"] : ["curl"], isWin() ? ["C:\\Windows\\System32"] : ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"]);
  }

  // curl uses the system's own network stack (proxy, certificates), so it often works where Node's connection is reset
  api._curlJson = function (url) {
    var m = mods(), c = curlPath(), tmp;
    if (!c) { return Promise.reject(new Error("curl was not found")); }
    tmp = m.path.join(m.os.tmpdir(), "rumotion-j-" + Date.now() + ".json");
    return run(c, ["-sSL", "--retry", "3", "--retry-delay", "2", "--fail", "-H", "User-Agent: RuMotion-curl", "-o", tmp, url]).then(function () {
      var t = m.fs.readFileSync(tmp, "utf8"); try { m.fs.unlinkSync(tmp); } catch (e) {}
      return JSON.parse(t);
    });
  };

  api._curlDownload = function (url, dest, onFrac, expectedBytes) {
    var m = mods(), c = curlPath(), part = dest + ".part", poll;
    if (!c) { return Promise.reject(new Error("curl was not found")); }
    mkdirp(m.path.dirname(dest));
    poll = setInterval(function () { try { if (onFrac && expectedBytes) { onFrac(Math.min(0.99, m.fs.statSync(part).size / expectedBytes)); } } catch (e) {} }, 500);
    return run(c, ["-sSL", "--fail", "--retry", "5", "--retry-delay", "2", "-C", "-", "-o", part, url]).then(function () {
      clearInterval(poll);
      if (m.fs.existsSync(dest)) { m.fs.unlinkSync(dest); }
      m.fs.renameSync(part, dest);
      return dest;
    }, function (e) { clearInterval(poll); throw e; });
  };

  function nodeJson(url) {
    return new Promise(function (resolve, reject) {
      request(url, function (err, res) {
        if (err) { reject(err); return; }
        var chunks = [];
        if (res.statusCode !== 200) { res.resume(); reject(new Error("Could not reach " + url + " (" + res.statusCode + ")")); return; }
        res.on("data", function (c) { chunks.push(c); });
        res.on("error", reject);
        res.on("end", function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(e); } });
      });
    });
  }

  api.getJson = function (url) {
    return retrying(function () { return nodeJson(url); }, 3).catch(function (e) {
      if (!isNetErr(e)) { throw e; }
      return api._curlJson(url).catch(function () { throw e; });   // report the original problem if curl fails too
    });
  };

  // one attempt: continues a partial file with a Range request when the server allows it
  function nodeDownload(url, dest, onFrac) {
    var m = mods(), part = dest + ".part";
    return new Promise(function (resolve, reject) {
      var have = 0;
      try { have = m.fs.existsSync(part) ? m.fs.statSync(part).size : 0; } catch (e) { have = 0; }
      request(url, function (err, res) {
        if (err) { reject(err); return; }
        var resumed = res.statusCode === 206, total, got, out;
        if (res.statusCode !== 200 && !resumed) {
          res.resume();
          if (res.statusCode === 416) { try { m.fs.unlinkSync(part); } catch (e1) {} reject(Object.assign(new Error("restarting the download"), { code: "ECONNRESET" })); return; }
          reject(new Error("Download failed (" + res.statusCode + "): " + url)); return;
        }
        total = (+res.headers["content-length"] || 0) + (resumed ? have : 0);
        got = resumed ? have : 0;
        mkdirp(m.path.dirname(dest));
        out = m.fs.createWriteStream(part, { flags: resumed ? "a" : "w" });
        res.on("data", function (c) { got += c.length; if (onFrac && total) { onFrac(Math.min(1, got / total)); } });
        res.pipe(out);
        out.on("finish", function () {
          out.close(function () {
            if (total && got < total) { reject(Object.assign(new Error("the connection closed early"), { code: "ECONNRESET" })); return; }
            try { if (m.fs.existsSync(dest)) { m.fs.unlinkSync(dest); } m.fs.renameSync(part, dest); resolve(dest); } catch (e2) { reject(e2); }
          });
        });
        out.on("error", reject);
        res.on("error", function (e3) { out.end(); reject(e3); });
        res.on("aborted", function () { out.end(); reject(Object.assign(new Error("the connection closed early"), { code: "ECONNRESET" })); });
      }, 0, have > 0 ? { Range: "bytes=" + have + "-" } : null);
    });
  }

  // download with retries and resume, then curl as a last resort; expectedBytes only feeds curl's progress bar
  api.download = function (url, dest, onFrac, expectedBytes) {
    return retrying(function () { return nodeDownload(url, dest, onFrac); }, 4).catch(function (e) {
      if (!isNetErr(e)) { throw e; }
      return api._curlDownload(url, dest, onFrac, expectedBytes).catch(function () { throw e; });
    });
  };

  function run(cmd, args, onLine, opts) {   // spawn, collect the tail of stderr, report lines
    var m = mods();
    return new Promise(function (resolve, reject) {
      var child, tail = "";
      try { child = m.cp.spawn(cmd, args, { windowsHide: true }); } catch (e) { reject(e); return; }
      if (opts && opts.onChild) { opts.onChild(child); }
      function feed(chunk) { var s = chunk.toString(); tail = (tail + s).slice(-1500); if (onLine) { s.split(/\r?\n|\r/).forEach(function (l) { if (l) { onLine(l); } }); } }
      child.stdout.on("data", feed);
      child.stderr.on("data", feed);
      child.on("error", reject);
      child.on("close", function (code, sig) {
        if (code === 0) { resolve(tail); }
        else { var e = new Error(sig ? "stopped" : "exit code " + code + ": " + tail.slice(-300)); e.code = code; e.killed = !!sig; reject(e); }
      });
    });
  }
  api._run = run;

  // the newest release that has a Windows 64-bit CPU build: whisper-bin-x64.zip first, then other x64 zips (OpenBLAS is fine, CUDA is not)
  api.pickWindowsAsset = function (releases) {
    var i, j, a, best, score, r;
    if (!releases || !releases.length) { return null; }
    for (i = 0; i < releases.length; i++) {
      r = releases[i]; best = null;
      if (r.draft) { continue; }
      for (j = 0; j < (r.assets || []).length; j++) {
        a = r.assets[j]; score = 0;
        if (/^whisper-bin-x64\.zip$/i.test(a.name)) { score = 4; }
        else if (/x64.*\.zip$/i.test(a.name) && !/blas|cuda|cublas|vulkan|xcframework/i.test(a.name)) { score = 3; }
        else if (/blas.*x64.*\.zip$/i.test(a.name) && !/cublas|cuda/i.test(a.name)) { score = 2; }
        if (score && (!best || score > best.score)) { best = { score: score, url: a.browser_download_url, name: a.name, tag: r.tag_name }; }
      }
      if (best) { return best; }
    }
    return null;
  };

  api.describeReleases = function (releases) {   // for error messages: what the newest releases contain
    return (releases || []).slice(0, 3).map(function (r) { return r.tag_name + ": " + ((r.assets || []).map(function (a) { return a.name; }).join(", ") || "no files"); }).join("; ") || "no releases";
  };

  api.ensureEngine = function (status, custom) {
    var m = mods(), found = api.findEngine(custom), dir = m.path.join(api.baseDir(), "engine"), zip;
    if (found) { return Promise.resolve(found); }
    if (isWin()) {
      status("Downloading the speech engine…", 0);
      return api.getJson("https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=30").then(function (rels) {
        var pick = api.pickWindowsAsset(rels);
        if (!pick) {
          throw new Error("No Windows speech engine download was found on the whisper.cpp releases page (" + api.describeReleases(rels) + "). "
            + "Download whisper-bin-x64.zip from github.com/ggml-org/whisper.cpp/releases, unzip it into " + dir + " and try again.");
        }
        zip = m.path.join(api.baseDir(), "engine.zip");
        status("Downloading the speech engine (" + pick.tag + ")…", 0);
        return api.download(pick.url, zip, function (f) { status("Downloading the speech engine… " + Math.round(f * 100) + "%", f); }, 20 * 1024 * 1024);
      }).catch(function (e) {
        if (!/^(No Windows|Downloading the speech engine failed)/.test(e.message)) { e.message = "Downloading the speech engine failed: " + e.message + api.netHint(e); }
        throw e;
      }).then(function () {
        status("Unpacking the speech engine…", null);
        mkdirp(dir);
        return run("tar", ["-xf", zip, "-C", dir]).catch(function () {
          return run("powershell", ["-NoProfile", "-Command", "Expand-Archive -Force -LiteralPath '" + zip + "' -DestinationPath '" + dir + "'"]);
        });
      }).then(function () {
        var f = api.findEngine(custom);
        if (!f) { throw new Error("The speech engine was unpacked but whisper-cli.exe was not found in " + dir); }
        try { m.fs.unlinkSync(zip); } catch (e) {}
        return f;
      });
    }
    if (isMac()) {
      var brew = null, cand = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"], i2;
      for (i2 = 0; i2 < cand.length; i2++) { if (!brew && m.fs.existsSync(cand[i2])) { brew = cand[i2]; } }
      if (!brew) { return Promise.reject(new Error("On a Mac the speech engine is installed once with Homebrew. Open Terminal and run:  brew install whisper-cpp  (Homebrew: brew.sh), then try again.")); }
      status("Installing the speech engine with Homebrew (a few minutes)…", null);
      return run(brew, ["install", "whisper-cpp"], function (l) { status("Homebrew: " + l.slice(0, 80), null); }).then(function () {
        var f = api.findEngine(custom);
        if (!f) { throw new Error("Homebrew finished but whisper-cli was not found. Try running  brew install whisper-cpp  in Terminal."); }
        return f;
      });
    }
    return Promise.reject(new Error("Install whisper.cpp and make sure whisper-cli is on your PATH."));
  };

  api.ensureModel = function (name, status, base) {
    var m = mods(), info = api.MODELS[name];
    if (!info) { return Promise.reject(new Error("Unknown model " + name)); }
    var file = m.path.join(api.baseDir(), "models", "ggml-" + name + ".bin");
    try { if (m.fs.existsSync(file) && m.fs.statSync(file).size > info.mb * 1024 * 1024 * 0.9) { return Promise.resolve(file); } } catch (e) {}
    status("Downloading the " + name + " model (" + info.mb + " MB)…", 0);
    return api.download((base || "https://huggingface.co/ggerganov/whisper.cpp/resolve/main") + "/ggml-" + name + ".bin", file,
      function (f) { status("Downloading the " + name + " model… " + Math.round(f * 100) + "%", f); }, info.mb * 1024 * 1024).catch(function (e) {
      e.message = "Downloading the " + name + " model failed: " + e.message + api.netHint(e);
      throw e;
    });
  };

  // audio file -> 16 kHz mono WAV. ffmpeg when it is installed, otherwise the panel's own decoder.
  api.prepareAudio = function (src, outWav, status) {
    var m = mods(), ff = api.findFfmpeg();
    if (ff) {
      status("Reading the audio…", null);
      return run(ff, ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outWav]);
    }
    status("Reading the audio…", null);
    return new Promise(function (resolve, reject) {
      var Ctx = root.AudioContext || root.webkitAudioContext, size;
      if (!Ctx || !root.OfflineAudioContext) { reject(new Error("This file needs ffmpeg to read its audio. Install ffmpeg (free), or use a .wav or .mp3 file.")); return; }
      size = m.fs.statSync(src).size;
      if (size > 700 * 1024 * 1024) { reject(new Error("This file is large. Install ffmpeg (free), or export the audio as a .wav or .mp3 and use that.")); return; }
      var b = m.fs.readFileSync(src), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ctx = new Ctx();
      ctx.decodeAudioData(ab, function (audio) {
        try { ctx.close(); } catch (e) {}
        var frames = Math.max(1, Math.ceil(audio.duration * 16000)), off = new root.OfflineAudioContext(1, frames, 16000), s = off.createBufferSource();
        s.buffer = audio; s.connect(off.destination); s.start();
        var done = function (r) { m.fs.writeFileSync(outWav, Buffer.from(api.encodeWav(api.floatToInt16(r.getChannelData(0)), 16000))); resolve(); };
        var p = off.startRendering(); if (p && p.then) { p.then(done, reject); } else { off.oncomplete = function (e) { done(e.renderedBuffer); }; }
      }, function () { reject(new Error("The audio in this file could not be read. Install ffmpeg (free), or use a .wav or .mp3 file.")); });
    });
  };

  // English: lines of at most 42 characters split on words. Other languages: Whisper's own segments (splitting inside a word can cut a
  // multi-byte letter in two), no carry-over of earlier text (stops repeating loops), then api.splitLong makes the lines.
  api.whisperArgs = function (model, wav, prefix, threads, lang) {
    lang = lang || "en";
    if (lang === "en") { return ["-m", model, "-f", wav, "-l", "en", "-oj", "-of", prefix, "-ml", "42", "-sow", "-t", String(threads), "-pp"]; }
    return ["-m", model, "-f", wav, "-l", lang, "-oj", "-of", prefix, "-mc", "0", "-t", String(threads), "-pp"];
  };

  // a model the user put there (for example a Sinhala fine-tune converted to ggml): models/ggml-<lang name>.bin
  api.customModel = function (lang) {
    var m = mods(), f = m.path.join(api.baseDir(), "models", lang === "si" ? "ggml-sinhala.bin" : "ggml-" + lang + ".bin");
    return (lang !== "en" && m.fs.existsSync(f)) ? f : null;
  };

  // o: { file, model: "base.en", lang: "en"|"si", onStatus(message, fraction|null), enginePath, modelBase }
  // returns { promise -> segments [{start,end,text}] in source-file seconds, cancel() }
  api.transcribe = function (o) {
    var m = mods(), cancelled = false, child = null, status = o.onStatus || function () {}, tmp, wav, prefix;
    function cleanup() {   // the temporary WAV and JSON, also after a failure or a cancel
      try {
        if (tmp && m.fs.existsSync(tmp)) { m.fs.readdirSync(tmp).forEach(function (f) { m.fs.unlinkSync(m.path.join(tmp, f)); }); m.fs.rmdirSync(tmp); }
      } catch (e) {}
    }
    function stopCheck() { if (cancelled) { var e = new Error("Cancelled."); e.cancelled = true; throw e; } }
    var promise = api.ensureEngine(status, o.enginePath).then(function (engine) {
      stopCheck();
      var custom = api.customModel(o.lang || "en");
      if (custom) { status("Using your model " + custom.split(/[\\/]/).pop() + "…", null); }
      return (custom ? Promise.resolve(custom) : api.ensureModel(o.model || "base.en", status, o.modelBase)).then(function (model) {
        stopCheck();
        tmp = m.path.join(m.os.tmpdir(), "rumotion-" + Date.now());
        mkdirp(tmp);
        wav = m.path.join(tmp, "audio.wav");
        prefix = m.path.join(tmp, "out");
        return api.prepareAudio(o.file, wav, status).then(function () {
          stopCheck();
          status("Transcribing…", 0);
          var threads = Math.max(2, Math.min(8, m.os.cpus().length - 1));
          return run(engine, api.whisperArgs(model, wav, prefix, threads, o.lang), function (l) {
            var p = /progress\s*=\s*(\d+)\s*%/.exec(l);
            if (p) { status("Transcribing… " + p[1] + "%", (+p[1]) / 100); }
          }, { onChild: function (c) { child = c; } });
        });
      });
    }).then(function () {
      var jsonFile = prefix + ".json";
      if (!m.fs.existsSync(jsonFile)) { throw new Error("The speech engine finished but wrote no transcript."); }
      var segs = api.cleanSegments(api.parseWhisperJson(m.fs.readFileSync(jsonFile, "utf8")));
      if (o.lang && o.lang !== "en") { segs = api.splitLong(api.dropRepeats(segs), 40); }
      cleanup();
      return segs;
    }).catch(function (e) {
      cleanup();
      if (cancelled) { var c = new Error("Cancelled."); c.cancelled = true; throw c; }
      throw e;
    });
    return { promise: promise, cancel: function () { cancelled = true; try { if (child) { child.kill(); } } catch (e) {} } };
  };

  if (root) { root.RuTranscribe = api; }
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
