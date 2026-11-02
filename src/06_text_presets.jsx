
    // =====================================================================
    // TEXT GROUP — animation presets (.ffx) embedded in the script
    // =====================================================================
    // build.js fills this from presets/text/*.ffx (base64), so dist/RupaMotion.jsx stays the only file to install.
    var TEXT_PRESETS = /*__TEXT_PRESETS__*/ [];

    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var B64_CODES = null;      // char code -> 6-bit value (an array lookup is much faster than a string-keyed object in ExtendScript)
    var PRESET_FILES = {};     // preset index -> temp .ffx already written this session (decoded once, reused on every click)

    // base64 -> binary string (one char per byte), ES3. Works on 4 characters at a time and joins in chunks.
    function b64decode(s) {
        var i, n = s.length;
        if (!B64_CODES) {
            B64_CODES = [];
            for (i = 0; i < 256; i++) { B64_CODES[i] = -1; }
            for (i = 0; i < B64.length; i++) { B64_CODES[B64.charCodeAt(i)] = i; }
        }
        while (n > 0 && s.charAt(n - 1) === "=") { n--; }
        var chunks = [], part = "", count = 0, c0, c1, c2, c3, fc = String.fromCharCode;
        for (i = 0; i + 3 < n; i += 4) {
            c0 = B64_CODES[s.charCodeAt(i)]; c1 = B64_CODES[s.charCodeAt(i + 1)]; c2 = B64_CODES[s.charCodeAt(i + 2)]; c3 = B64_CODES[s.charCodeAt(i + 3)];
            part += fc((c0 << 2) | (c1 >> 4), ((c1 & 15) << 4) | (c2 >> 2), ((c2 & 3) << 6) | c3);
            if (++count === 2000) { chunks.push(part); part = ""; count = 0; }
        }
        if (i < n) {
            c0 = B64_CODES[s.charCodeAt(i)]; c1 = i + 1 < n ? B64_CODES[s.charCodeAt(i + 1)] : 0; c2 = i + 2 < n ? B64_CODES[s.charCodeAt(i + 2)] : -1;
            part += fc((c0 << 2) | (c1 >> 4));
            if (c2 >= 0) { part += fc(((c1 & 15) << 4) | (c2 >> 2)); }
        }
        chunks.push(part);
        return chunks.join("");
    }

    // Writes the embedded preset to a temp .ffx and applies it to every selected layer
    function doTextPreset(idx) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the text layer(s) to animate."); if (!sel) { return; }
        var preset = TEXT_PRESETS[idx], safe = preset.name.replace(/[^A-Za-z0-9_-]+/g, "_");
        var f = PRESET_FILES[idx] ? new File(PRESET_FILES[idx]) : null;
        if (!f || !f.exists) {          // decode + write once per session; later clicks only apply the file
            f = new File(Folder.temp.fsName + "/RupaMotion_" + safe + ".ffx");
            f.encoding = "BINARY";
            if (!f.open("w")) { alert("Couldn't write the preset to the temp folder.", NAME); return; }
            f.write(b64decode(preset.data));
            f.close();
            PRESET_FILES[idx] = f.fsName || f.path;
        }
        var failed = "", i;
        for (i = 0; i < sel.length; i++) {
            try { sel[i].applyPreset(f); } catch (e) { failed = e.toString(); }
        }
        if (failed !== "") { alert("After Effects couldn't apply \"" + preset.name + "\":\n" + failed, NAME); }
    }
