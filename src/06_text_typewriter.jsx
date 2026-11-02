
    // =====================================================================
    // TEXT GROUP — two typewriter buttons in Text > Motion (no settings; they act on the selected text layer(s))
    // =====================================================================
    // "Typewriter": letter by letter with a thin caret. Read from a clip ("Let's choose a style"): the caret shows first, the
    // first letter lands, then the rest arrive at an even pace (roughly 14 letters a second) with the caret hugging the last
    // letter. A single line stays centred while it grows. When the last letter lands the caret blinks and goes away.
    // "Typewriter Block": word by word with a gradient block over the next word and a blue wave behind it (second clip).
    // Both work on single lines, paragraphs with explicit line breaks, and paragraph (box) text that wraps. Pace, first-letter
    // hold, caret/block sizes and blink timing are read off the clips (not frame-measured), so they live in these constants.
    var TW = { cps: 14, hold: 0.3, caretW: 0.045, caretH: 1.1, caretGap: 0.06, caretRise: 0.3, blinkOn: 0.4, blinkOff: 0.4, blinks: 2 };
    var TB = { wps: 6, hold: 0.3, wave: 7, blockH: 0.95, blockRise: 0.375, blue: [0.231, 0.510, 0.965],
               c0: [0.10, 0.64, 0.96], c1: [0.55, 0.70, 0.98], slices: 10 };

    // Hold keys: the value jumps at each key and stays until the next one (crisp per-letter / per-word steps)
    function holdKeys(prop, pairs) {
        var i, idx;
        for (i = 0; i < pairs.length; i++) { prop.setValueAtTime(pairs[i][0], pairs[i][1]); }
        for (i = 0; i < pairs.length; i++) {
            idx = prop.nearestKeyIndex(pairs[i][0]);
            try { prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); } catch (e) {}
        }
    }

    function isTextLayer(L) {
        try { return !!L.property("ADBE Text Properties") && L.property("ADBE Text Properties").property("ADBE Text Document") !== null; } catch (e) { return false; }
    }

    function copyStyle(from, to) {
        var keys = ["font", "fontSize", "tracking", "horizontalScale", "verticalScale", "baselineShift", "fauxBold", "fauxItalic", "allCaps", "smallCaps", "applyFill", "applyStroke"], i;
        for (i = 0; i < keys.length; i++) { try { to[keys[i]] = from[keys[i]]; } catch (e) {} }
    }

    // Where every letter and word of a text layer ends up, in layer space (origin = the text origin, y = 0 on the first baseline).
    // Lines come from explicit line breaks and, for paragraph (box) text, from a greedy word wrap against the box width.
    // Everything is measured on a scratch point-text layer that copies the layer's character style ("|" is appended so trailing
    // spaces count, then its width is taken off again).
    // Returns { n, cx[0..n] (caret x after letter i), cl[0..n] (its line), words: wx[], ww[], wl[], lineStep, lines: count, lineW[], off[] }
    function layoutText(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, str = src.text, n = str.length, i, j, k;
        var tmp = comp.layers.addText("|"), tsp = textDocProp(tmp);
        var d0 = tsp.value; copyStyle(src, d0); try { d0.justification = ParagraphJustification.LEFT_JUSTIFY; } catch (eJ) {} tsp.setValue(d0);
        function widthOf(t) {
            var d = tsp.value; d.text = t; tsp.setValue(d);
            var r = tmp.sourceRectAtTime(t0, false);
            return r.left + r.width;
        }
        var bar = widthOf("|"), boxW = 1e9, fsRaw = src.fontSize, lineStep = fsRaw * 1.2, just = 0;
        try { if (src.boxText) { boxW = src.boxTextSize[0]; } } catch (eB) {}
        try { if (!src.autoLeading && src.leading) { lineStep = src.leading; } } catch (eL) {}
        try {                                   // centre / right justified point text: the origin sits at the line centre / end
            var J = src.justification;
            if (!src.boxText && J !== undefined) {
                if (J === ParagraphJustification.CENTER_JUSTIFY) { just = 1; }
                else if (J === ParagraphJustification.RIGHT_JUSTIFY) { just = 2; }
            }
        } catch (eJ2) {}

        // 1) lines
        var paras = str.split(/[\r\n\u0003]/), lines = [], p, toks, cur, t, re;
        for (p = 0; p < paras.length; p++) {
            toks = paras[p].match(/\S+|\s+/g) || [];
            cur = "";
            for (k = 0; k < toks.length; k++) {
                t = toks[k];
                if (/\S/.test(t) && trim(cur) !== "" && widthOf(cur + t + "|") - bar > boxW) { lines.push({ text: cur, br: false }); cur = ""; }
                cur += t;
            }
            lines.push({ text: cur, br: p < paras.length - 1 });
        }
        // 2) edges of every prefix of every line
        var lineW = [], off = [], edges = [], e, prev;
        for (i = 0; i < lines.length; i++) {
            e = [0]; prev = 0;
            for (j = 1; j <= lines[i].text.length; j++) { prev = Math.max(prev, widthOf(lines[i].text.substring(0, j) + "|") - bar); e.push(prev); }
            edges.push(e);
            lineW.push(e[e.length - 1]);
            off.push(just === 1 ? -e[e.length - 1] / 2 : (just === 2 ? -e[e.length - 1] : 0));
        }
        try { tmp.remove(); } catch (eR) {}

        // 3) per letter / per word
        var cx = [off[0]], cl = [0], wx = [], ww = [], wl = [], m;
        for (i = 0; i < lines.length; i++) {
            for (j = 0; j < lines[i].text.length; j++) { cx.push(off[i] + edges[i][j + 1]); cl.push(i); }
            re = /\S+/g;
            while ((m = re.exec(lines[i].text)) !== null) {
                wx.push(off[i] + edges[i][m.index]);
                ww.push(Math.max(1, edges[i][m.index + m[0].length] - edges[i][m.index]));
                wl.push(i);
            }
            if (lines[i].br && i + 1 < lines.length) { cx.push(off[i + 1]); cl.push(i + 1); }     // the break itself is a letter: the caret moves to the next line
        }
        while (cx.length < n + 1) { cx.push(cx[cx.length - 1]); cl.push(cl[cl.length - 1]); }
        return { n: n, cx: cx, cl: cl, wx: wx, ww: ww, wl: wl, lineStep: lineStep, lines: lines.length, lineW: lineW, off: off, src: src };
    }

    // A second press replaces the first typewriter animators on the layer
    function clearTypewriter(L) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators"), i;
        for (i = anims.numProperties; i >= 1; i--) {
            if (anims.property(i).name === "MK Typewriter" || anims.property(i).name === "MK Typewriter Wave") { anims.property(i).remove(); }
        }
        return anims;
    }

    // Adds a text animator whose range selector works in Index units on Characters (type 1) or Words (3)
    function indexAnimator(anims, name, basedOn) {
        anims.addProperty("ADBE Text Animator");
        var an = anims.property(anims.numProperties);
        an.name = name;
        return an;
    }
    function indexSelector(an, basedOn) {
        if (an.property("ADBE Text Selectors").numProperties === 0) { an.property("ADBE Text Selectors").addProperty("ADBE Text Selector"); }
        var sel = an.property("ADBE Text Selectors").property(1);
        try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2); } catch (e1) {}               // Index
        if (basedOn !== 1) { try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Type2").setValue(basedOn); } catch (e2) {} }
        return sel;
    }

    // ---------------------------------------------------------------------
    // Typewriter: letter by letter + caret
    // ---------------------------------------------------------------------
    function typewriterOne(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, n = src.text.length, i;
        if (trim(src.text) === "") { return "skipped"; }
        var dt = 1 / TW.cps;
        var anims = clearTypewriter(L);
        var lay = layoutText(comp, L, t0);

        var s = L.transform.scale.value[0] / 100, P = L.transform.position.value, A = L.transform.anchorPoint.value;
        var ox = P[0] - A[0] * s, baseline = P[1] - A[1] * s, fs = src.fontSize * s;
        var single = lay.lines === 1;
        var movable = single && L.transform.position.numKeys === 0 && !L.parent;      // only a single line is kept centred while it grows
        var W = lay.lineW[0], off0 = lay.off[0];
        var times = [];
        for (i = 0; i <= n; i++) { times.push(i === 0 ? t0 : t0 + TW.hold + (i - 1) * dt); }
        var tEnd = times[n];

        // reveal: an animator hides everything from the Start index on; Start steps 0 -> n, one letter per key
        var an = indexAnimator(anims, "MK Typewriter");
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = indexSelector(an, 1);
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        var pairs = [];
        for (i = 0; i <= n; i++) { pairs.push([times[i], i]); }
        holdKeys(sel.property("ADBE Text Index Start"), pairs);

        // a single line stays centred: shift the layer right by half of what is still missing
        if (movable) {
            var pp = L.transform.position, pk = [];
            for (i = 0; i <= n; i++) { pk.push([times[i], vecLike(pp, P[0] + s * (W - (lay.cx[i] - off0)) / 2, P[1])]); }
            holdKeys(pp, pk);
        }

        // caret: a thin bar hugging the last letter (on the right line); on from the start, blinks after the last letter, then goes away
        var cw = Math.max(2, fs * TW.caretW), ch = fs * TW.caretH, color = [0.6, 0.63, 0.65];
        try { if (src.applyFill) { color = src.fillColor; } } catch (eC) {}
        var caret = shapeLayer(comp, "MK Typewriter · Caret");
        var gi = newGroup(caret, "Caret");
        addRect(caret, gi, cw, ch, cw / 2);
        addFill(caret, gi, color, 100);
        var cp = caret.transform.position, ck = [], x;
        for (i = 0; i <= n; i++) {
            x = movable ? ox + s * (off0 + (W + (lay.cx[i] - off0)) / 2) : ox + s * lay.cx[i];
            ck.push([times[i], vecLike(cp, x + fs * TW.caretGap + cw / 2, baseline + s * lay.cl[i] * lay.lineStep - fs * TW.caretRise)]);
        }
        holdKeys(cp, ck);
        var ok = [[t0, 100]], b, tt = tEnd + TW.blinkOn;
        for (b = 0; b < TW.blinks; b++) { ok.push([tt, 0]); tt += TW.blinkOff; ok.push([tt, 100]); tt += TW.blinkOn; }
        ok.push([Math.max(tt, tEnd + TW.blinkOn), 0]);
        holdKeys(caret.transform.opacity, ok);
        try { caret.inPoint = Math.max(0, t0); caret.outPoint = Math.max(caret.inPoint + 0.1, Math.min(comp.duration, L.outPoint)); } catch (e1) {}
        caret.selected = false;
        return caret;
    }

    // ---------------------------------------------------------------------
    // Typewriter Block: word by word, gradient block over the next word, blue wave behind it
    // ---------------------------------------------------------------------
    function typewriterBlockOne(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, i;
        if (trim(src.text) === "") { return "skipped"; }
        var anims = clearTypewriter(L);
        var lay = layoutText(comp, L, t0), n = lay.wx.length;
        if (n < 1) { return "skipped"; }

        var s = L.transform.scale.value[0] / 100, P = L.transform.position.value, A = L.transform.anchorPoint.value;
        var ox = P[0] - A[0] * s, baseline = P[1] - A[1] * s, fs = src.fontSize * s;
        var dt = 1 / TB.wps, times = [];
        for (i = 0; i <= n; i++) { times.push(i === 0 ? t0 : t0 + TB.hold + (i - 1) * dt); }

        // 1) reveal: everything from word `Start` on is hidden; Start steps 0 -> n (Based On: Words, Index units)
        var an = indexAnimator(anims, "MK Typewriter");
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = indexSelector(an, 3);
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        var pairs = [];
        for (i = 0; i <= n; i++) { pairs.push([times[i], i]); }
        holdKeys(sel.property("ADBE Text Index Start"), pairs);

        // 2) colour wave: the last TB.wave words are blue, strongest on the newest word (Range Shape: Ramp Up)
        var an2 = indexAnimator(anims, "MK Typewriter Wave");
        an2.property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
        try { an2.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(c4(TB.blue)); } catch (eF) { an2.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(TB.blue); }
        var sel2 = indexSelector(an2, 3);
        try { sel2.property("ADBE Text Range Advanced").property("ADBE Text Range Shape").setValue(2); } catch (eS) {}       // Ramp Up
        var ps = [], pe = [];
        for (i = 0; i <= n; i++) { ps.push([times[i], Math.max(0, i - TB.wave)]); pe.push([times[i], i]); }
        holdKeys(sel2.property("ADBE Text Index Start"), ps);
        holdKeys(sel2.property("ADBE Text Index End"), pe);

        // 3) the block: 100 px wide gradient slices scaled to the width of the NEXT word; it sits on that word, then goes away
        var bh = fs * TB.blockH, block = shapeLayer(comp, "MK Typewriter · Block"), sw = 100 / TB.slices, c, tt, gi;
        for (i = 0; i < TB.slices; i++) {
            tt = TB.slices > 1 ? i / (TB.slices - 1) : 0;
            c = [TB.c0[0] + (TB.c1[0] - TB.c0[0]) * tt, TB.c0[1] + (TB.c1[1] - TB.c0[1]) * tt, TB.c0[2] + (TB.c1[2] - TB.c0[2]) * tt];
            gi = newGroup(block, "Block " + (i + 1));
            addRect(block, gi, sw + 0.6, bh, 0, [i * sw + sw / 2, 0]);
            addFill(block, gi, c, 100);
        }
        var bp = block.transform.position, bs = block.transform.scale, kp = [], ks = [];
        for (i = 0; i < n; i++) {
            kp.push([times[i], vecLike(bp, ox + s * lay.wx[i], baseline + s * lay.wl[i] * lay.lineStep - fs * TB.blockRise)]);
            ks.push([times[i], [Math.max(1, s * lay.ww[i]), 100]]);
        }
        holdKeys(bp, kp);
        holdKeys(bs, ks);
        holdKeys(block.transform.opacity, [[t0, 100], [times[n], 0]]);
        try { block.inPoint = Math.max(0, t0); block.outPoint = Math.max(block.inPoint + 0.1, Math.min(comp.duration, L.outPoint)); } catch (e3) {}
        block.selected = false;
        return block;
    }

    // kind: "caret" (letter by letter, thin caret) or "block" (word by word, gradient block)
    function runTypewriter(kind) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the text layer(s) to type out."); if (!sel) { return; }
        var t0 = comp.time, done = 0, skipped = 0, i, res;
        for (i = 0; i < sel.length; i++) {
            if (!isTextLayer(sel[i])) { skipped++; continue; }
            res = (kind === "block") ? typewriterBlockOne(comp, sel[i], t0) : typewriterOne(comp, sel[i], t0);
            if (res === "skipped") { skipped++; } else { done++; }
        }
        for (i = 0; i < sel.length; i++) { try { sel[i].selected = true; } catch (e) {} }
        if (done === 0) { alert("Select a text layer with some text in it. Nothing was typed out.", NAME); }
        else if (skipped > 0) { alert(skipped + " layer(s) were skipped (not text, or empty).", NAME); }
    }

    function doTypewriter() { runTypewriter("caret"); }
    function doTypewriterBlock() { runTypewriter("block"); }
