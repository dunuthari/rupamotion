
    // =====================================================================
    // TEXT GROUP — animation presets (.ffx) embedded in the script
    // =====================================================================
    // build.js fills this from presets/text/*.ffx (base64), so dist/RupaMotion.jsx stays the only file to install.
    var TEXT_PRESETS = /*__TEXT_PRESETS__*/ [];

    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var B64_INDEX = null;

    // base64 -> binary string (one char per byte), ES3
    function b64decode(s) {
        var i, c;
        if (!B64_INDEX) {
            B64_INDEX = {};
            for (i = 0; i < B64.length; i++) { B64_INDEX[B64.charAt(i)] = i; }
        }
        var out = [], buf = 0, bits = 0;
        for (i = 0; i < s.length; i++) {
            c = s.charAt(i);
            if (c === "=") { break; }
            if (B64_INDEX[c] === undefined) { continue; }
            buf = (buf << 6) | B64_INDEX[c];
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.push(String.fromCharCode((buf >> bits) & 255));
                buf = buf & ((1 << bits) - 1);
            }
        }
        return out.join("");
    }

    // Writes the embedded preset to a temp .ffx and applies it to every selected layer
    function doTextPreset(idx) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the text layer(s) to animate."); if (!sel) { return; }
        var preset = TEXT_PRESETS[idx], safe = preset.name.replace(/[^A-Za-z0-9_-]+/g, "_");
        var f = new File(Folder.temp.fsName + "/RupaMotion_" + safe + ".ffx");
        f.encoding = "BINARY";
        if (!f.open("w")) { alert("Couldn't write the preset to the temp folder.", NAME); return; }
        f.write(b64decode(preset.data));
        f.close();
        var failed = "", i;
        for (i = 0; i < sel.length; i++) {
            try { sel[i].applyPreset(f); } catch (e) { failed = e.toString(); }
        }
        try { f.remove(); } catch (e2) {}
        if (failed !== "") { alert("After Effects couldn't apply \"" + preset.name + "\":\n" + failed, NAME); }
    }
