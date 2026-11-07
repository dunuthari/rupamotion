
    // =====================================================================
    // CAPTIONS (Text > Captions, CEP panel only): one text layer per caption line, made from a transcript
    // =====================================================================
    // The speech-to-text itself runs in the CEP panel (cep/transcribe.js: whisper.cpp on the user's computer). This file only
    //   - describes the selected audio/video layer for the panel (captionSource),
    //   - turns the transcript the panel sends back into text layers (buildCaptions).
    // Transcript times are seconds from the start of the SOURCE FILE; they are mapped onto the comp with the layer's start time and
    // stretch, and clipped to the layer's in/out points, so a trimmed or moved clip still gets captions in the right place.

    var CAP = {};   // the Captions card controls (filled in 07_ui.jsx): model, size, bottom, color, shadow

    // strict JSON reader for ES3 (the text comes from our own panel; the check is the one json2 uses)
    function jparse(s) {
        var t = String(s);
        var probe = t.replace(/\\(?:["\\\/bfnrtu])/g, "@")
            .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
            .replace(/(?:^|:|,)(?:\s*\[)+/g, "");
        if (!/^[\],:{}\s]*$/.test(probe)) { throw new Error("The transcript could not be read."); }
        return eval("(" + t + ")");
    }

    function captionSource() {
        var comp = app.project.activeItem, sel, L, src = null;
        if (!(comp && comp instanceof CompItem)) { return { error: "Open a composition first (click inside its timeline)." }; }
        sel = comp.selectedLayers;
        if (sel.length !== 1) { return { error: "Select one audio or video layer first." }; }
        L = sel[0];
        try { src = L.source; } catch (e) { src = null; }
        if (!src || !(src instanceof FootageItem) || !src.file) {
            return { error: "Select a layer that comes from an audio or video file (not a pre-comp, solid or text)." };
        }
        try { if (L.hasAudio === false) { return { error: "That layer has no audio." }; } } catch (e1) {}
        return {
            path: src.file.fsName, name: L.name, index: L.index,
            startTime: L.startTime, inPoint: L.inPoint, outPoint: L.outPoint, stretch: L.stretch,
            sourceDuration: src.duration, comp: comp.name
        };
    }

    function captionSettings() {
        var d = { model: "base.en", size: 64, bottom: 10, color: "#FFFFFF", shadow: true }, models = ["tiny.en", "base.en", "small.en"];
        try { if (CAP.model && CAP.model.selection) { d.model = models[CAP.model.selection.index] || d.model; } } catch (e) {}
        try { if (CAP.size) { d.size = num(CAP.size.text, 64, 8, 400); } } catch (e1) {}
        try { if (CAP.bottom) { d.bottom = num(CAP.bottom.text, 10, 0, 90); } } catch (e2) {}
        try { if (CAP.color) { d.color = rgbToHex(CAP.color.get()); } } catch (e3) {}
        try { if (CAP.shadow) { d.shadow = !!CAP.shadow.value; } } catch (e4) {}
        return d;
    }

    // data: { layerIndex, layerName, segments: [{ start, end, text }] }  (seconds in the source file)
    function buildCaptions(data) {
        var comp = app.project.activeItem, src, cs = captionSettings(), made = 0, skipped = 0, i, seg, L, k, t0, t1, lo, hi, rect, x, y, col;
        if (!(comp && comp instanceof CompItem)) { return { error: "Open a composition first." }; }
        src = comp.layer(data.layerIndex);
        if (!src || src.name !== data.layerName) { return { error: "The layer moved while transcribing. Select it again and run the transcript again." }; }
        k = Math.abs(src.stretch) / 100; if (!(k > 0)) { k = 1; }
        lo = Math.max(0, src.inPoint); hi = Math.min(comp.duration, src.outPoint);
        col = hexToRgb(cs.color);
        for (i = 0; i < data.segments.length; i++) {
            seg = data.segments[i];
            t0 = src.startTime + seg.start * k;
            t1 = src.startTime + seg.end * k;
            if (t0 < lo) { t0 = lo; }
            if (t1 > hi) { t1 = hi; }
            if (!(t1 - t0 >= comp.frameDuration) || !trim(seg.text)) { skipped++; continue; }
            L = makeText(comp, trim(seg.text), { size: cs.size, color: col, font: pickFont(true), just: "center" });
            L.name = "Ru Caption " + (made + 1);
            L.startTime = t0;
            L.inPoint = t0;
            L.outPoint = t1;
            try { rect = L.sourceRectAtTime(t0, false); } catch (e0) { rect = null; }
            x = comp.width / 2;
            y = comp.height * (1 - cs.bottom / 100);
            if (rect) {
                anchorTo(L, "center", t0);
                y -= rect.height / 2;
            }
            setXY(L.transform.position, x, y);
            if (cs.shadow) {
                try {
                    var e = fxAdd(L, "ADBE Drop Shadow");
                    fxSet(e, 1, [0, 0, 0, 1]);
                    fxSet(e, 2, 170);
                    fxSet(e, 3, 180);
                    fxSet(e, 4, 3);
                    fxSet(e, 5, 14);
                } catch (e2) {}
            }
            made++;
        }
        return { made: made, skipped: skipped };
    }
