
    // =====================================================================
    // CAPTIONS (Text > Captions, CEP panel): one text layer per caption line, made from a transcript, then styled and animated
    // =====================================================================
    // The speech-to-text itself runs in the CEP panel (cep/transcribe.js: whisper.cpp on the user's computer). This file
    //   - describes the selected audio/video layer for the panel (captionSource),
    //   - turns the transcript the panel sends back into text layers (buildCaptions),
    //   - restyles and re-animates the existing "Ru Caption N" layers at any time (applyCaptionStyle): font, outline, background box,
    //     shadow, position, wrapping, and an In and an Out animation.
    // Transcript times are seconds from the start of the SOURCE FILE; they are mapped onto the comp with the layer's start time and
    // stretch, and clipped to the layer's in/out points, so a trimmed or moved clip still gets captions in the right place.
    // The original text of every caption is kept in the layer's comment ("ru:" + text) so case and wrapping can be changed back.

    var CAP = {};   // the Captions card controls (filled in 07_ui.jsx)

    var CAP_FONTS = [
        ["From the Style tab", null],
        ["Inter", ["Inter-Regular", "Inter-Medium", "Inter-Bold"]],
        ["Manrope", ["Manrope-Regular", "Manrope-Medium", "Manrope-Bold"]],
        ["DM Sans", ["DMSans-Regular", "DMSans-Medium", "DMSans-Bold"]],
        ["Outfit", ["Outfit-Regular", "Outfit-Medium", "Outfit-Bold"]],
        ["Noto Sans Sinhala", ["NotoSansSinhala-Regular", "NotoSansSinhala-Medium", "NotoSansSinhala-Bold"]],
        ["Arial", ["ArialMT", "ArialMT", "Arial-BoldMT"]]
    ];
    var CAP_IN = [["None", "none"], ["Fade", "fade"], ["Pop", "pop"], ["Slide up", "slideup"], ["Blur in", "blur"], ["Typewriter", "type"], ["Word by word", "words"]];
    var CAP_OUT = [["None", "none"], ["Fade", "fade"], ["Slide down", "slidedown"], ["Blur out", "blur"], ["Pop out", "pop"]];
    var CAP_EASE = ["Expo out", "Smooth", "Linear"];
    var CAP_MODELS = ["tiny.en", "base.en", "small.en", "medium.en"];
    var CAP_MODELS_MULTI = ["tiny", "base", "small", "medium"];   // Sinhala and every other language: the multilingual models
    var CAP_SINHALA_FONTS = ["NotoSansSinhala-Bold", "NirmalaUI-Bold", "NirmalaUI", "IskoolaPota", "SinhalaSangamMN-Bold", "SinhalaMN-Bold", "SinhalaMN"];

    function capLabels(list, col) {
        var out = [], i;
        for (i = 0; i < list.length; i++) { out.push(col === undefined ? list[i] : list[i][col]); }
        return out;
    }

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

    // ---- settings (read from the card; sensible defaults when a control is missing) ----
    function capIdx(ctl, def) { try { if (ctl && ctl.selection) { return ctl.selection.index; } } catch (e) {} return def; }
    function capNum(ctl, def, lo, hi) { try { if (ctl) { return num(ctl.text, def, lo, hi); } } catch (e) {} return def; }
    function capOn(ctl, def) { try { if (ctl && typeof ctl.value === "boolean") { return ctl.value; } } catch (e) {} return def; }
    function capHex(c, def) { try { if (c) { return rgbToHex(c.get()); } } catch (e) {} return def; }
    function capText(ctl, def) { try { if (ctl) { return trim(ctl.text); } } catch (e) {} return def; }

    function captionSettings() {
        return {
            modelIdx: capIdx(CAP.model, 1),
            model: CAP_MODELS[capIdx(CAP.model, 1)] || "base.en",
            family: capIdx(CAP.family, 0), weight: capIdx(CAP.weight, 2), custom: capText(CAP.custom, ""),
            size: capNum(CAP.size, 64, 8, 400), tracking: capNum(CAP.tracking, 0, -100, 1000), caseMode: capIdx(CAP.caseMode, 0),
            color: capHex(CAP.color, "#FFFFFF"),
            stroke: capOn(CAP.stroke, false), strokeColor: capHex(CAP.strokeColor, "#101010"), strokeW: capNum(CAP.strokeW, 4, 0, 60),
            box: capOn(CAP.box, false), boxColor: capHex(CAP.boxColor, "#101010"), boxOp: capNum(CAP.boxOp, 70, 0, 100),
            boxPad: capNum(CAP.boxPad, 14, 0, 200), boxRad: capNum(CAP.boxRad, 12, 0, 200),
            shadow: capOn(CAP.shadow, true), bottom: capNum(CAP.bottom, 10, 0, 90), maxW: capNum(CAP.maxW, 88, 20, 100),
            inIdx: capIdx(CAP.inT, 1), inLen: capNum(CAP.inLen, 8, 1, 120), outIdx: capIdx(CAP.outT, 1), outLen: capNum(CAP.outLen, 6, 1, 120),
            ease: capIdx(CAP.ease, 0), dist: capNum(CAP.dist, 40, 0, 600),
            fontControls: !!CAP.size   // the card has no Font section: the look is whatever the layers have, only the animation is applied
        };
    }

    // the model name for a language, from the Accuracy choice (the panel downloads it)
    function captionModelFor(lang) {
        var i = capIdx(CAP.model, 1);
        return ((lang === "en" || !lang) ? CAP_MODELS : CAP_MODELS_MULTI)[i] || ((lang === "en" || !lang) ? "base.en" : "base");
    }

    // a font that has Sinhala letters: Noto Sans Sinhala, Windows' Nirmala UI or Iskoola Pota, the Mac's Sinhala fonts
    function sinhalaFont() {
        var i, r, unknown = false;
        for (i = 0; i < CAP_SINHALA_FONTS.length; i++) {
            r = fontInstalled(CAP_SINHALA_FONTS[i]);
            if (r === true) { return CAP_SINHALA_FONTS[i]; }
            if (r === null) { unknown = true; }
        }
        return unknown ? CAP_SINHALA_FONTS[0] : pickFont(true);
    }

    function capFont(cs, txt) {
        if (cs.fontName) { return cs.fontName; }
        // a caption that contains Sinhala letters gets a Sinhala font whatever button made it (a Latin font would show empty boxes);
        // Latin text (English, or Sinhala written in Latin letters) keeps the normal font
        if (txt && /[\u0D80-\u0DFF]/.test(txt)) { return sinhalaFont(); }
        var f = CAP_FONTS[cs.family] || CAP_FONTS[0], name;
        if (cs.custom) { return cs.custom; }
        if (!f[1]) { return pickFont(cs.weight >= 1); }
        name = f[1][cs.weight] || f[1][2];
        if (fontInstalled(name) === false) { return pickFont(cs.weight >= 1); }
        return name;
    }

    // ---- helpers ----
    function capNumberOf(name) {
        var m = /^Ru Caption (\d+)$/.exec(name);
        return m ? parseInt(m[1], 10) : -1;
    }

    function captionLayers(comp, selectedOnly) {
        var out = [], i, L, src = selectedOnly ? comp.selectedLayers : null;
        if (selectedOnly) {
            for (i = 0; i < src.length; i++) { if (capNumberOf(src[i].name) >= 0) { out.push(src[i]); } }
        } else {
            for (i = 1; i <= comp.numLayers; i++) { L = comp.layer(i); if (L && capNumberOf(L.name) >= 0) { out.push(L); } }
        }
        out.sort(function (a, b) { return capNumberOf(a.name) - capNumberOf(b.name); });
        return out;
    }

    function capOrig(L) {
        var c = "", t;
        try { c = L.comment; } catch (e) {}
        if (c && c.indexOf("ru:") === 0) { return c.substring(3); }
        t = textDocProp(L).value.text;
        try { L.comment = "ru:" + t; } catch (e1) {}
        return t;
    }

    function capClear(prop) {
        var n = 0;
        try { while (prop.numKeys > 0 && n < 300) { prop.removeKey(1); n++; } } catch (e) {}
    }

    function capRemoveNamed(parent, name) {
        try { var p = parent.property(name); if (p) { p.remove(); } } catch (e) {}
    }

    function capCase(text, mode) {
        if (mode === 2) { return text.toLowerCase(); }
        if (mode === 3) { return text.toLowerCase().replace(/(^|[\s\-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
        return text;
    }

    // splits text into k lines of similar length, only at spaces (AE line break = \r)
    function capWrap(text, k) {
        var words = text.split(" "), lines = [], cur = "", target = Math.ceil(text.length / k), i;
        for (i = 0; i < words.length; i++) {
            if (cur && (cur + " " + words[i]).length > target && lines.length < k - 1) { lines.push(cur); cur = words[i]; }
            else { cur = cur ? cur + " " + words[i] : words[i]; }
        }
        lines.push(cur);
        return lines.join("\r");
    }

    // text look, wrapping, anchor and position of one caption; returns where it ended up
    function capStyleText(comp, L, cs) {
        var t0 = L.inPoint, t1 = L.outPoint, sp = textDocProp(L), d = sp.value, txt = capCase(capOrig(L), cs.caseMode), rect, k, maxPx = comp.width * cs.maxW / 100, x, y;
        d.fontSize = cs.size;
        try { d.font = capFont(cs, txt); } catch (e0) {}
        d.applyFill = true;
        d.fillColor = hexToRgb(cs.color);
        try { d.tracking = cs.tracking; } catch (e1) {}
        try { d.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (e2) {}
        d.applyStroke = !!cs.stroke;
        if (cs.stroke) {
            d.strokeColor = hexToRgb(cs.strokeColor);
            d.strokeWidth = cs.strokeW;
            try { d.strokeOverFill = false; } catch (e3) {}
        }
        try { d.allCaps = (cs.caseMode === 1); } catch (e4) {}
        d.text = txt;
        sp.setValue(d);
        rect = L.sourceRectAtTime(t0, false);
        if (rect.width > maxPx && maxPx > 0) {
            k = Math.min(4, Math.ceil(rect.width / maxPx));
            if (k > 1) { d = sp.value; d.text = capWrap(txt, k); sp.setValue(d); rect = L.sourceRectAtTime(t0, false); }
        }
        capClear(L.transform.position); capClear(L.transform.scale); capClear(L.transform.opacity);
        setXY(L.transform.anchorPoint, rect.left + rect.width / 2, rect.top + rect.height / 2);
        x = comp.width / 2;
        y = comp.height * (1 - cs.bottom / 100) - rect.height / 2;
        setXY(L.transform.position, x, y);
        setXY(L.transform.scale, 100, 100);
        L.transform.opacity.setValue(100);
        return { x: x, y: y, rect: rect, t0: t0, t1: t1 };
    }

    function capShadow(L, cs) {
        var fx = L.property("ADBE Effect Parade"), e;
        capRemoveNamed(fx, "Ru Caption Shadow");
        if (!cs.shadow) { return; }
        try {
            e = fxAdd(L, "ADBE Drop Shadow");
            e.name = "Ru Caption Shadow";
            fxSet(e, 1, [0, 0, 0, 1]);
            fxSet(e, 2, 170);
            fxSet(e, 3, 180);
            fxSet(e, 4, 3);
            fxSet(e, 5, 14);
        } catch (e2) {}
    }

    // In and Out animation as keyframes on opacity / position / scale / blur (or a text animator for Typewriter and Word by word).
    // isBox: the background box moves and fades with its caption (it cannot type, so it fades in for those).
    function capAnimate(comp, L, cs, geo, isBox) {
        var fl = comp.frameDuration, dur = geo.t1 - geo.t0, maxPart = dur * 0.45, inD = Math.min(cs.inLen * fl, maxPart), outD = Math.min(cs.outLen * fl, maxPart);
        var inT = CAP_IN[cs.inIdx] ? CAP_IN[cs.inIdx][1] : "none", outT = CAP_OUT[cs.outIdx] ? CAP_OUT[cs.outIdx][1] : "none";
        var a = geo.t0, b = geo.t1, x = geo.x, y = geo.y, d = cs.dist, ease = cs.ease;
        var op = [], opE = [], pos = [], posE = [], sc = [], scE = [], bl = [], blE = [], IN_E = [[33, 12], [92, 33]], OUT_E = [[33, 92], [12, 33]], typed = (inT === "type" || inT === "words"), typeD, e, an, anims, sg, sel;
        if (isBox && typed) { inT = "fade"; typed = false; }
        function put(list, el, pair, i) { list.push(pair); el.push(i); }
        function keys(prop, pairs, eases) {
            if (!pairs.length) { return; }
            if (ease === 2) { setKeys(prop, pairs, { linear: true }); }
            else if (ease === 1) { var sm = [], k; for (k = 0; k < pairs.length; k++) { sm.push([66, 66]); } setKeys(prop, pairs, { eases: sm }); }
            else { setKeys(prop, pairs, { eases: eases }); }
        }
        capClear(L.transform.opacity);
        if (inT === "fade" || inT === "pop" || inT === "slideup" || inT === "blur") {
            put(op, opE, [a, 0], IN_E[0]); put(op, opE, [a + inD, 100], IN_E[1]);
        }
        if (inT === "pop") { put(sc, scE, [a, [70, 70]], IN_E[0]); put(sc, scE, [a + inD, [100, 100]], IN_E[1]); }
        if (inT === "slideup") { put(pos, posE, [a, [x, y + d]], IN_E[0]); put(pos, posE, [a + inD, [x, y]], IN_E[1]); }
        if (inT === "blur") { put(bl, blE, [a, 14], IN_E[0]); put(bl, blE, [a + inD, 0], IN_E[1]); }
        if (outT !== "none") {
            put(op, opE, [b - outD, 100], OUT_E[0]); put(op, opE, [b, 0], OUT_E[1]);
            if (outT === "slidedown") { put(pos, posE, [b - outD, [x, y]], OUT_E[0]); put(pos, posE, [b, [x, y + d]], OUT_E[1]); }
            if (outT === "blur") { put(bl, blE, [b - outD, 0], OUT_E[0]); put(bl, blE, [b, 14], OUT_E[1]); }
            if (outT === "pop") { put(sc, scE, [b - outD, [100, 100]], OUT_E[0]); put(sc, scE, [b, [70, 70]], OUT_E[1]); }
        }
        keys(L.transform.opacity, op, opE);
        keys(L.transform.position, pos, posE);
        keys(L.transform.scale, sc, scE);
        if (bl.length) {
            try {
                e = fxAdd(L, "ADBE Gaussian Blur 2");
                e.name = "Ru Caption Blur";
                keys(e.property(1), bl, blE);
            } catch (e1) {}
        }
        if (typed && !isBox) {
            typeD = Math.min(dur * 0.6, inD * (inT === "type" ? 4 : 3));
            try {
                anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
                anims.addProperty("ADBE Text Animator");
                an = anims.property(anims.numProperties);
                an.name = "Ru Caption In";
                an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
                an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
                sg = an.property("ADBE Text Selectors");
                if (sg.numProperties === 0) { sg.addProperty("ADBE Text Selector"); }
                sel = sg.property(1);
                // Sinhala letters join into clusters, so a "letter by letter" reveal would cut them apart: Sinhala always reveals by words
                try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Type2").setValue((inT === "words" || /[\u0D80-\u0DFF]/.test(capOrig(L))) ? 3 : 1); } catch (e2) {}
                setKeys(sel.property("ADBE Text Percent Start"), [[a, 0], [a + typeD, 100]], { linear: true });
            } catch (e3) {}
        }
    }

    // removes the old animation parts before a new one is built
    function capResetFx(L) {
        var fx = L.property("ADBE Effect Parade");
        capRemoveNamed(fx, "Ru Caption Blur");
        try { capRemoveNamed(L.property("ADBE Text Properties").property("ADBE Text Animators"), "Ru Caption In"); } catch (e) {}
    }

    function capMakeBox(comp, L, cs, geo, n) {
        var padX = cs.boxPad, padY = Math.round(cs.boxPad * 0.6), w = geo.rect.width + padX * 2, h = geo.rect.height + padY * 2, B, gi;
        B = shapeLayer(comp, "Ru Caption Box " + n);
        gi = newGroup(B, "Box");
        addRect(B, gi, w, h, cs.boxRad);
        addFill(B, gi, hexToRgb(cs.boxColor), cs.boxOp);
        try { B.startTime = geo.t0; } catch (e) {}
        B.inPoint = geo.t0;
        B.outPoint = geo.t1;
        setXY(B.transform.position, geo.x, geo.y);
        try { B.moveAfter(L); } catch (e1) {}
        return B;
    }

    function capRemoveBoxes(comp, nums) {
        var found = [], i, L, m, j;
        for (i = 1; i <= comp.numLayers; i++) {
            L = comp.layer(i);
            m = L ? /^Ru Caption Box (\d+)$/.exec(L.name) : null;
            if (m) { for (j = 0; j < nums.length; j++) { if (nums[j] === parseInt(m[1], 10)) { found.push(L); break; } } }
        }
        for (i = 0; i < found.length; i++) { try { found[i].remove(); } catch (e) {} }
    }

    // where a caption already is (its resting position: the middle of its time is between the In and the Out animation)
    function capGeoOf(comp, L) {
        var t0 = L.inPoint, t1 = L.outPoint, v = L.transform.position.valueAtTime((t0 + t1) / 2, false);
        return { x: v[0], y: v[1], rect: null, t0: t0, t1: t1 };
    }

    // full: restyle the text too (a new transcript). Otherwise, without a Font section, only the animation is rebuilt and the layers'
    // own look (font, size, colour, position, anything edited by hand) is left alone.
    function applyCaptionStyle(comp, layers, full, fontName) {
        var cs = captionSettings(), textToo = !!full || cs.fontControls, i, L, geo, B, boxes = 0, nums = [];
        for (i = 0; i < layers.length; i++) { nums.push(capNumberOf(layers[i].name)); }
        if (fontName) { cs.fontName = fontName; }
        if (textToo) { capRemoveBoxes(comp, nums); }
        for (i = 0; i < layers.length; i++) {
            L = layers[i];
            capResetFx(L);
            if (textToo) {
                geo = capStyleText(comp, L, cs);
                capShadow(L, cs);
            } else {
                geo = capGeoOf(comp, L);
                capClear(L.transform.position); capClear(L.transform.scale); capClear(L.transform.opacity);
                setXY(L.transform.position, geo.x, geo.y);
                setXY(L.transform.scale, 100, 100);
                L.transform.opacity.setValue(100);
            }
            capAnimate(comp, L, cs, geo, false);
            if (textToo && cs.box) {
                B = capMakeBox(comp, L, cs, geo, nums[i]);
                capAnimate(comp, B, cs, geo, true);
                boxes++;
            }
        }
        return { n: layers.length, boxes: boxes };
    }

    function doCaptionApply(selectedOnly) {
        var comp = activeComp(), layers, r;
        if (!comp) { return; }
        layers = captionLayers(comp, selectedOnly);
        if (!layers.length) {
            alert(selectedOnly ? "Select one or more caption layers (named Ru Caption N) first." : "There are no captions in this composition yet. Click English Transcript first.", NAME);
            return;
        }
        r = applyCaptionStyle(comp, layers);
        return r;
    }

    function doCaptionSelectAll() {
        var comp = activeComp(), i, L, keep, n = 0;
        if (!comp) { return; }
        for (i = 1; i <= comp.numLayers; i++) {
            L = comp.layer(i);
            keep = !!L && capNumberOf(L.name) >= 0;
            try { L.selected = keep; } catch (e) {}
            if (keep) { n++; }
        }
        if (!n) { alert("There are no captions in this composition yet.", NAME); }
    }

    // data: { layerIndex, layerName, lang: "en"|"si", segments: [{ start, end, text }] }  (seconds in the source file)
    function buildCaptions(data) {
        var comp = app.project.activeItem, src, made = 0, skipped = 0, i, seg, L, k, t0, t1, lo, hi, layers = [], res, col;
        if (!(comp && comp instanceof CompItem)) { return { error: "Open a composition first." }; }
        src = comp.layer(data.layerIndex);
        if (!src || src.name !== data.layerName) { return { error: "The layer moved while transcribing. Select it again and run the transcript again." }; }
        k = Math.abs(src.stretch) / 100; if (!(k > 0)) { k = 1; }
        lo = Math.max(0, src.inPoint); hi = Math.min(comp.duration, src.outPoint);
        col = hexToRgb("#FFFFFF");
        for (i = 0; i < data.segments.length; i++) {
            seg = data.segments[i];
            t0 = src.startTime + seg.start * k;
            t1 = src.startTime + seg.end * k;
            if (t0 < lo) { t0 = lo; }
            if (t1 > hi) { t1 = hi; }
            if (!(t1 - t0 >= comp.frameDuration) || !trim(seg.text)) { skipped++; continue; }
            L = makeText(comp, trim(seg.text), { size: 64, color: col, font: pickFont(true), just: "center" });
            L.name = "Ru Caption " + (made + 1);
            try { L.comment = "ru:" + trim(seg.text); } catch (e0) {}
            L.startTime = t0;
            L.inPoint = t0;
            L.outPoint = t1;
            layers.push(L);
            made++;
        }
        res = applyCaptionStyle(comp, layers, true);
        return { made: made, skipped: skipped, boxes: res.boxes };
    }
