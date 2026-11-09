
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
        ["Arial", ["ArialMT", "ArialMT", "Arial-BoldMT"]]
    ];
    var CAP_IN = [["None", "none"], ["Fade", "fade"], ["Pop", "pop"], ["Slide up", "slideup"], ["Blur in", "blur"], ["Typewriter", "type"], ["Word by word", "words"]];
    var CAP_OUT = [["None", "none"], ["Fade", "fade"], ["Slide down", "slidedown"], ["Blur out", "blur"], ["Pop out", "pop"]];
    var CAP_EASE = ["Expo out", "Smooth", "Linear"];
    var CAP_MODELS = ["tiny.en", "base.en", "small.en", "medium.en"];

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
            hlLook: capIdx(CAP.hlLook, 0), hlText: capHex(CAP.hlText, "#FFFFFF"), hlBox: capHex(CAP.hlBox, "#E8A23A"),
            hlRad: capNum(CAP.hlRad, 10, 0, 100), hlDim: capNum(CAP.hlDim, 45, 0, 100), hlDimOn: capIdx(CAP.hlDimOn, 0) === 0,
            fontControls: !!CAP.size   // the card has no Font section: the look is whatever the layers have, only the animation is applied
        };
    }

    // the English model name from the Accuracy choice
    function captionModelFor() { return CAP_MODELS[capIdx(CAP.model, 1)] || "base.en"; }

    function capFont(cs) {
        if (cs.fontName) { return cs.fontName; }
        var f = CAP_FONTS[cs.family] || CAP_FONTS[0], name;
        if (cs.custom) { return cs.custom; }
        if (!f[1]) { return pickFont(cs.weight >= 1); }
        name = f[1][cs.weight] || f[1][2];
        if (fontInstalled(name) === false) { return pickFont(cs.weight >= 1); }
        return name;
    }

    // ---- word highlight ("Style"): the word being spoken is lit while the voice says it ----
    var CAP_LOOKS = ["Plain", "Word box", "Word colour", "Word pop", "Underline", "Karaoke fill"];
    // box / underline sizes in em (of the caption's font size); popScale in %
    var HL = { rise: 0.28, boxH: 1.08, padX: 0.2, underH: 0.07, underDrop: 0.17, popScale: 118, drawIn: 0.12 };

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
        if (c && c.indexOf("ru:") === 0) { c = c.substring(3); return c.indexOf("\n") >= 0 ? c.substring(0, c.indexOf("\n")) : c; }
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
        try { d.font = capFont(cs); } catch (e0) {}
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
                try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Type2").setValue(inT === "words" ? 3 : 1); } catch (e2) {}
                setKeys(sel.property("ADBE Text Percent Start"), [[a, 0], [a + typeD, 100]], { linear: true });
            } catch (e3) {}
        }
    }

    // removes the old animation parts before a new one is built
    function capResetFx(L, comp) {
        var fx = L.property("ADBE Effect Parade"), anims, i;
        capRemoveNamed(fx, "Ru Caption Blur");
        try {
            anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
            capRemoveNamed(anims, "Ru Caption In");
            for (i = anims.numProperties; i >= 1; i--) { if (anims.property(i).name.indexOf("Ru Word ") === 0) { anims.property(i).remove(); } }
        } catch (e) {}
        if (comp) { capRemoveBoxes(comp, [capNumberOf(L.name)]); }
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
            m = L ? /^Ru Caption (?:Box|Word) (\d+)$/.exec(L.name) : null;
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
        var cs = captionSettings(), textToo = !!full || cs.fontControls, i, L, geo, B, boxes = 0, words = 0, nums = [];
        for (i = 0; i < layers.length; i++) { nums.push(capNumberOf(layers[i].name)); }
        if (fontName) { cs.fontName = fontName; }
        if (textToo) { capRemoveBoxes(comp, nums); }
        for (i = 0; i < layers.length; i++) {
            L = layers[i];
            capResetFx(L, comp);
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
            if (cs.hlLook > 0) { try { if (capWordStyle(comp, L, cs, geo, nums[i])) { words++; } } catch (eW) {} }
            if (textToo && cs.box) {
                B = capMakeBox(comp, L, cs, geo, nums[i]);
                capAnimate(comp, B, cs, geo, true);
                boxes++;
            }
        }
        return { n: layers.length, boxes: boxes, words: words };
    }

    function capR4(x) { return String(Math.round(x * 10000) / 10000); }

    // "ru:<text>" plus, when the transcript knew when each word was said, "\nrw:s,e;s,e;..." (start and end as 0..1 of the caption)
    function capPutComment(L, text, words) {
        var c = "ru:" + text, i, a = [];
        if (words && words.length) {
            for (i = 0; i < words.length; i++) { a.push(capR4(words[i].s) + "," + capR4(words[i].e)); }
            c += "\nrw:" + a.join(";");
        }
        try { L.comment = c; } catch (e) {}
    }

    // when each of the n words is said, as fractions of the caption: the stored word times, else an even spread by letters
    function capWordTimes(L, text, n) {
        var c = "", m, parts, out = [], i, p, toks, tot = 0, pos = 0, len;
        try { c = L.comment; } catch (e0) {}
        m = /\nrw:(.*)$/.exec(c || "");
        if (m) {
            parts = m[1].split(";");
            if (parts.length === n) {
                for (i = 0; i < n; i++) {
                    p = parts[i].split(",");
                    out.push({ s: parseFloat(p[0]), e: parseFloat(p[1]) });
                    if (!(out[i].s >= 0 && out[i].s <= 1) || !(out[i].e >= out[i].s)) { out = []; break; }
                }
                if (out.length === n) { return { words: out, exact: true }; }
            }
        }
        out = [];
        toks = String(text).replace(/[\r\n\u0003]/g, " ").match(/\S+/g) || [];
        for (i = 0; i < n; i++) { len = (toks.length === n) ? toks[i].length : 3; tot += len + 1; }
        for (i = 0; i < n; i++) {
            len = (toks.length === n) ? toks[i].length : 3;
            out.push({ s: pos / tot, e: (pos + len) / tot });
            pos += len + 1;
        }
        return { words: out, exact: false };
    }

    function capN(x) { return String(Math.round(x * 1000) / 1000); }
    function capNumList(a) { var o = [], i; for (i = 0; i < a.length; i++) { o.push(String(Math.round(a[i] * 1000) / 1000)); } return "[" + o.join(",") + "]"; }

    // a text animator with one property (fill colour, opacity or scale) and a Range Selector in Index units
    function capWordAnimator(anims, name, prop, value, basedOn, startExpr, endExpr) {
        var an = indexAnimator(anims, name), pr, sel;
        an.property("ADBE Text Animator Properties").addProperty(prop);
        pr = an.property("ADBE Text Animator Properties").property(prop);
        if (prop === "ADBE Text Fill Color") { try { pr.setValue(c4(value)); } catch (e1) { pr.setValue(value); } }
        else { pr.setValue(value); }
        sel = indexSelector(an, basedOn);
        sel.property("ADBE Text Index Start").expression = startExpr;
        sel.property("ADBE Text Index End").expression = endExpr;
        return an;
    }

    // Lights the word that is being spoken. Everything is driven by the caption's own time, so moving the layer keeps it working.
    // look: 1 box, 2 colour, 3 pop, 4 underline, 5 karaoke fill. Returns true when something was built.
    function capWordStyle(comp, L, cs, geo, num) {
        var look = cs.hlLook, src, str, lay, n, wt, dur, rel0, st = [], en = [], i, anims, idx, sA, boxC = hexToRgb(cs.hlBox), textC = hexToRgb(cs.hlText), dim = cs.hlDim, fs, A;
        var cs0 = [], cl = [], re, m, B, gi, rc, parented = false, xs = [], ys = [], ws = [], lx = [], ox, oy, MK = "// Ru Word Style\n", filled;
        if (look <= 0 || look >= CAP_LOOKS.length) { return false; }
        src = textDocProp(L).value; str = src.text;
        if (!trim(str)) { return false; }
        lay = layoutText(comp, L, L.inPoint);
        n = lay.wx.length;
        if (n < 1) { return false; }
        wt = capWordTimes(L, str, n).words;
        dur = L.outPoint - L.inPoint;
        rel0 = L.inPoint - L.startTime;
        for (i = 0; i < n; i++) { st.push(rel0 + wt[i].s * dur); en.push(rel0 + wt[i].e * dur); }
        anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        fs = src.fontSize;
        A = L.transform.anchorPoint.value;
        idx = MK + "var st=" + capNumList(st) + ";\nvar t=time-thisLayer.startTime;\nvar i=0;\nfor(var k=0;k<st.length;k++){if(t>=st[k]){i=k;}}\n";

        if (look === 5) {
            re = /\S+/g;
            while ((m = re.exec(str)) !== null) { cs0.push(m.index); cl.push(m[0].length); }
            if (cs0.length !== n) { return false; }
            filled = MK + "var st=" + capNumList(st) + ";\nvar en=" + capNumList(en) + ";\nvar c0=" + capNumList(cs0) + ";\nvar cl=" + capNumList(cl) + ";\nvar t=time-thisLayer.startTime;\nvar f=0;\n" +
                "for(var k=0;k<st.length;k++){if(t>=st[k]){var u=(en[k]>st[k])?Math.min(1,(t-st[k])/(en[k]-st[k])):1;f=c0[k]+Math.round(u*cl[k]);}}\n";
            if (cs.hlDimOn && dim < 100) { capWordAnimator(anims, "Ru Word Dim", "ADBE Text Opacity", dim, 1, filled + "f", filled + "100000"); }
            capWordAnimator(anims, "Ru Word Fill", "ADBE Text Fill Color", boxC, 1, MK + "0", filled + "f");
            return true;
        }

        if (cs.hlDimOn && dim < 100) {
            capWordAnimator(anims, "Ru Word Dim", "ADBE Text Opacity", dim, 3, MK + "0", idx + "i");
            capWordAnimator(anims, "Ru Word Dim 2", "ADBE Text Opacity", dim, 3, idx + "i+1", idx + "100000");
        }
        if (look === 1) { capWordAnimator(anims, "Ru Word Active", "ADBE Text Fill Color", textC, 3, idx + "i", idx + "i+1"); }
        if (look === 2) { capWordAnimator(anims, "Ru Word Active", "ADBE Text Fill Color", boxC, 3, idx + "i", idx + "i+1"); }
        if (look === 3) {
            sA = capWordAnimator(anims, "Ru Word Active", "ADBE Text Fill Color", boxC, 3, idx + "i", idx + "i+1");
            try {
                sA.property("ADBE Text Animator Properties").addProperty("ADBE Text Scale");
                sA.property("ADBE Text Animator Properties").property("ADBE Text Scale").setValue([HL.popScale, HL.popScale]);
                try { sA.property("ADBE Text More Options").property("ADBE Text Anchor Point Option").setValue(2); } catch (eG) {}     // scale each word around its own centre
            } catch (eP) {}
        }
        if (look === 1 || look === 4) {
            // a shape layer behind the caption: one box (or underline) that jumps to the word being spoken
            for (i = 0; i < n; i++) {
                ox = lay.wx[i] - A[0]; oy = lay.baseY + lay.wl[i] * lay.lineStep - A[1];
                lx.push(ox); ws.push(lay.ww[i]);
                xs.push(ox + lay.ww[i] / 2); ys.push(oy);
            }
            B = shapeLayer(comp, "Ru Caption Word " + num);
            gi = newGroup(B, look === 1 ? "Box" : "Underline");
            rc = addVec(B, gi, "ADBE Vector Shape - Rect");
            rc.property("ADBE Vector Rect Size").setValue([100, 20]);
            rc.property("ADBE Vector Rect Roundness").setValue(look === 1 ? cs.hlRad : 0);
            try { B.startTime = L.startTime; } catch (e2) {}
            B.inPoint = L.inPoint; B.outPoint = L.outPoint;
            try { B.parent = L; parented = true; } catch (e3) {}
            if (!parented) { for (i = 0; i < n; i++) { xs[i] += geo.x; ys[i] += geo.y; lx[i] += geo.x; } }
            var bi = MK + "var st=" + capNumList(st) + ";\nvar t=time-thisLayer.startTime;\nvar i=0;\nfor(var k=0;k<st.length;k++){if(t>=st[k]){i=k;}}\n";
            if (look === 1) {
                for (i = 0; i < n; i++) { ys[i] = ys[i] - fs * HL.rise; }
                rc.property("ADBE Vector Rect Size").expression = bi + "var ws=" + capNumList(ws) + ";\n[ws[i]+" + capN(fs * HL.padX * 2) + "," + capN(fs * HL.boxH) + "]";
                B.transform.position.expression = bi + "var xs=" + capNumList(xs) + ";\nvar ys=" + capNumList(ys) + ";\n[xs[i],ys[i]]";
            } else {
                for (i = 0; i < n; i++) { ys[i] = ys[i] + fs * HL.underDrop; }
                rc.property("ADBE Vector Rect Size").expression = bi + "var ws=" + capNumList(ws) + ";\nvar u=Math.max(0.02,Math.min(1,(t-st[i])/" + HL.drawIn + "));\n[ws[i]*u," + capN(Math.max(2, fs * HL.underH)) + "]";
                B.transform.position.expression = bi + "var lx=" + capNumList(lx) + ";\nvar ws=" + capNumList(ws) + ";\nvar ys=" + capNumList(ys) + ";\nvar u=Math.max(0.02,Math.min(1,(t-st[i])/" + HL.drawIn + "));\n[lx[i]+ws[i]*u/2,ys[i]]";
            }
            addFill(B, gi, boxC, 100);
            capWordBoxFade(comp, B, cs, geo);
            try { B.moveAfter(L); } catch (e4) {}
            B.selected = false;
        }
        return true;
    }

    // the box fades with its caption (the box follows the caption's move and scale through the parent link)
    function capWordBoxFade(comp, B, cs, geo) {
        var fl = comp.frameDuration, dur = geo.t1 - geo.t0, maxPart = dur * 0.45, inD = Math.min(cs.inLen * fl, maxPart), outD = Math.min(cs.outLen * fl, maxPart);
        var inT = CAP_IN[cs.inIdx] ? CAP_IN[cs.inIdx][1] : "none", outT = CAP_OUT[cs.outIdx] ? CAP_OUT[cs.outIdx][1] : "none", pairs = [];
        if (inT !== "none") { pairs.push([geo.t0, 0]); pairs.push([geo.t0 + inD, 100]); }
        if (outT !== "none") { if (!pairs.length) { pairs.push([geo.t0, 100]); } pairs.push([geo.t1 - outD, 100]); pairs.push([geo.t1, 0]); }
        if (pairs.length) { try { setKeys(B.transform.opacity, pairs, { linear: true }); } catch (e) {} }
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

    // word times of one transcript line as 0..1 of the caption (clipped to it); null unless they line up with the words of the text
    function capSegWords(seg, src, k, t0, t1) {
        var out = [], i, w, a, b, toks = trim(seg.text).split(/\s+/), d = t1 - t0;
        if (!seg.words || seg.words.length !== toks.length || !(d > 0)) { return null; }
        for (i = 0; i < seg.words.length; i++) {
            w = seg.words[i];
            a = (src.startTime + w.s * k - t0) / d; b = (src.startTime + w.e * k - t0) / d;
            a = Math.max(0, Math.min(1, a)); b = Math.max(a, Math.min(1, b));
            out.push({ s: a, e: b });
        }
        return out;
    }

    // data: { layerIndex, layerName, segments: [{ start, end, text, words?: [{ s, e, w }] }] }  (seconds in the source file)
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
            capPutComment(L, trim(seg.text), capSegWords(seg, src, k, t0, t1));
            L.startTime = t0;
            L.inPoint = t0;
            L.outPoint = t1;
            layers.push(L);
            made++;
        }
        res = applyCaptionStyle(comp, layers, true);
        return { made: made, skipped: skipped, boxes: res.boxes };
    }

    // =====================================================================
    // TRANSCRIPT EDITOR (CEP panel): list the caption layers, apply edited words and times, splits, joins and empty captions
    // =====================================================================
    // The panel shows one row per Ru Caption layer (start time + words). On Apply it sends every row: { name, from, start, end, text }.
    // name = the layer the row came from (null for a new row), from = the layer a new row is copied from (it keeps that look).
    // Rows whose text or times differ from their layer are rewritten; new rows are duplicates; layers that no row refers to
    // (joined away) are removed; all layers are renamed Ru Caption 1..n in row order; touched layers get their In/Out animation rebuilt.

    function capRect(L, t) {
        try { return L.sourceRectAtTime(t, false); } catch (e) { return { left: 0, top: 0, width: 0, height: 0 }; }
    }

    function capCurText(L) {
        return trim(String(textDocProp(L).value.text).replace(/[\r\n]+/g, " "));
    }

    function captionListData() {
        var comp = app.project.activeItem, layers, rows = [], i, L;
        if (!(comp && comp instanceof CompItem)) { return { error: "Open a composition first (click inside its timeline)." }; }
        layers = captionLayers(comp, false);
        layers.sort(function (a, b) { return (a.inPoint - b.inPoint) || (capNumberOf(a.name) - capNumberOf(b.name)); });
        for (i = 0; i < layers.length; i++) {
            L = layers[i];
            rows.push({ name: L.name, start: Math.round(L.inPoint * 1000) / 1000, end: Math.round(L.outPoint * 1000) / 1000, text: capCurText(L) });
        }
        return { comp: comp.name, rows: rows };
    }

    // where a caption rests, then take its animation off so it can be moved, re-timed or copied
    function capRestState(comp, L) {
        var geo = capGeoOf(comp, L), rect = capRect(L, L.inPoint);
        capResetFx(L, comp);
        capClear(L.transform.position); capClear(L.transform.scale); capClear(L.transform.opacity);
        setXY(L.transform.position, geo.x, geo.y);
        setXY(L.transform.scale, 100, 100);
        L.transform.opacity.setValue(100);
        geo.h = rect.height;
        return geo;
    }

    // new words: wrapped like the others, centred, and the bottom edge stays where it was
    function capRetext(comp, L, text, geo, cs) {
        var sp = textDocProp(L), d = sp.value, maxPx = comp.width * cs.maxW / 100, rect, k, y;
        d.text = text;
        sp.setValue(d);
        rect = capRect(L, L.inPoint);
        if (text && maxPx > 0 && rect.width > maxPx) {
            k = Math.min(4, Math.ceil(rect.width / maxPx));
            if (k > 1) { d = sp.value; d.text = capWrap(text, k); sp.setValue(d); rect = capRect(L, L.inPoint); }
        }
        setXY(L.transform.anchorPoint, rect.left + rect.width / 2, rect.top + rect.height / 2);
        y = geo.y + geo.h / 2 - rect.height / 2;
        setXY(L.transform.position, geo.x, y);
        geo.y = y; geo.h = rect.height;
        capPutComment(L, text, null);
    }

    // the highlight layers of the comp by caption number
    function capWordBoxes(comp) {
        var out = {}, i, L, m;
        for (i = 1; i <= comp.numLayers; i++) {
            L = comp.layer(i);
            m = L ? /^Ru Caption Word (\d+)$/.exec(L.name) : null;
            if (m) { out[parseInt(m[1], 10)] = L; }
        }
        return out;
    }

    function captionApplyData(data) {
        var boxOf, comp = app.project.activeItem, cs = captionSettings(), rows = data.rows, layers, byName = {}, seen = {}, isSource = {}, geoOf = {}, work = [], touched = [], added = 0, changed = 0, removed = 0, eps = 0.0005, i, r, t, L, w, S, D, g, nm, endCap;
        if (!(comp && comp instanceof CompItem)) { return { error: "Open the composition with the captions first." }; }
        if (!rows || !rows.length) { return { error: "There are no lines to apply." }; }
        layers = captionLayers(comp, false);
        for (i = 0; i < layers.length; i++) { byName[layers[i].name] = layers[i]; }
        endCap = comp.duration;
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            t = trim(String(r.text === undefined || r.text === null ? "" : r.text).replace(/[\r\n]+/g, " "));
            if (r.start >= endCap - comp.frameDuration) { return { error: "A line starts at or after the end of the composition (" + Math.round(endCap * 10) / 10 + " s). Move it earlier." }; }
            r.end = Math.min(r.end, endCap);
            if (!(r.end - r.start >= comp.frameDuration)) { return { error: "A line is shorter than one frame. Change its time and try again." }; }
            if (r.name && byName[r.name]) {
                L = byName[r.name]; seen[r.name] = true;
                w = { row: r, text: t, layer: L, isNew: false, textChanged: t !== capCurText(L), differs: false };
                w.differs = w.textChanged || Math.abs(r.start - L.inPoint) > eps || Math.abs(r.end - L.outPoint) > eps;
            } else {
                if (!r.from || !byName[r.from]) { return { error: "A new line has no caption to copy the look from. Reload the list and try again." }; }
                isSource[r.from] = true;
                w = { row: r, text: t, layer: null, isNew: true, from: r.from, textChanged: true, differs: true };
            }
            work.push(w);
        }
        for (i = 0; i < work.length; i++) { if (!work[i].isNew && work[i].differs) { isSource[work[i].layer.name] = true; } }
        for (nm in isSource) { if (isSource.hasOwnProperty(nm)) { geoOf[nm] = capRestState(comp, byName[nm]); } }
        // copies first, while the layers they copy are still in their original state
        for (i = 0; i < work.length; i++) {
            w = work[i];
            if (!w.isNew) { continue; }
            S = byName[w.from]; D = S.duplicate();
            g = geoOf[w.from];
            w.layer = D; w.geo = { x: g.x, y: g.y, h: g.h };
        }
        for (i = 0; i < work.length; i++) {
            w = work[i];
            if (!w.isNew && w.differs) { g = geoOf[w.layer.name]; w.geo = { x: g.x, y: g.y, h: g.h }; }
        }
        for (i = 0; i < work.length; i++) {
            w = work[i];
            if (!w.differs) { continue; }
            L = w.layer;
            if (w.textChanged) { capRetext(comp, L, w.text, w.geo, cs); }
            L.startTime = w.row.start;
            L.inPoint = w.row.start;
            L.outPoint = w.row.end;
            touched.push(L);
            if (w.isNew) { added++; } else { changed++; }
        }
        for (i = 0; i < layers.length; i++) {
            if (!seen[layers[i].name]) { capRemoveBoxes(comp, [capNumberOf(layers[i].name)]); try { layers[i].remove(); removed++; } catch (e) {} }
        }
        for (i = 0; i < work.length; i++) { work[i].oldNum = work[i].isNew ? -1 : capNumberOf(work[i].layer.name); }
        boxOf = capWordBoxes(comp);
        for (i = 0; i < work.length; i++) { work[i].layer.name = "Ru Caption t" + i; }
        for (i = 0; i < work.length; i++) { work[i].layer.name = "Ru Caption " + (i + 1); }
        // each caption keeps its own highlight layer: the numbers in their names follow the captions
        for (i = 0; i < work.length; i++) { if (work[i].oldNum >= 0 && boxOf[work[i].oldNum]) { try { boxOf[work[i].oldNum].name = "Ru Caption Word t" + i; } catch (eB) {} } }
        for (i = 0; i < work.length; i++) { if (work[i].oldNum >= 0 && boxOf[work[i].oldNum]) { try { boxOf[work[i].oldNum].name = "Ru Caption Word " + (i + 1); } catch (eB2) {} } }
        if (touched.length) { applyCaptionStyle(comp, touched, false); }
        return { changed: changed, added: added, removed: removed };
    }

    function captionGotoName(name) {
        var comp = app.project.activeItem, i, L;
        if (!(comp && comp instanceof CompItem)) { return; }
        for (i = 1; i <= comp.numLayers; i++) {
            L = comp.layer(i);
            if (L && L.name === name) { comp.time = L.inPoint; return; }
        }
    }
