
    // =====================================================================
    // TEXT GROUP — "Typewriter": letters pop in one by one with a caret that follows the last letter
    // =====================================================================
    // A one-click button in Text > Motion: applies to the selected text layer(s) with no settings.
    // Read from a reference clip ("Let's choose a style"): the caret shows first, the first letter lands, then the rest
    // arrive at an even pace (roughly 14 letters a second) with a thin caret hugging the last letter. The line stays centred
    // while it grows. When the last letter lands the caret blinks and goes away. Pace, first-letter hold, caret size and blink
    // are read off the clip (not frame-measured), so they live in one constant.
    var TW = { cps: 14, hold: 0.3, caretW: 0.045, caretH: 1.1, caretGap: 0.06, caretRise: 0.3, blinkOn: 0.4, blinkOff: 0.4, blinks: 2 };

    // Hold keys: the value jumps at each key and stays until the next one (crisp per-letter steps)
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

    // Types out one text layer. Returns the caret layer (or null).
    function typewriterOne(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, str = src.text, n = str.length, i;
        var dt = 1 / TW.cps;
        if (n < 1 || /[\r\n\u0003]/.test(str)) { return "skipped"; }

        // a second typewriter on the same layer replaces the first
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        for (i = anims.numProperties; i >= 1; i--) { if (anims.property(i).name === "MK Typewriter") { anims.property(i).remove(); } }

        // width of every prefix, measured on a scratch layer that copies this layer's character style ("|" is appended so
        // trailing spaces still count, and the bar width is taken off again)
        var tmp = comp.layers.addText("|"), tsp = textDocProp(tmp);
        function widthOf(s) {
            var d = sp.value; d.text = s; d.justification = ParagraphJustification.LEFT_JUSTIFY; tsp.setValue(d);
            var r = tmp.sourceRectAtTime(t0, false);
            return r.left + r.width;
        }
        var bar = widthOf("|"), edge = [0], W;
        for (i = 1; i <= n; i++) { edge.push(Math.max(0, widthOf(str.substring(0, i) + "|") - bar)); }
        W = edge[n];
        try { tmp.remove(); } catch (eR) {}

        // where the finished text sits in the comp (position / anchor / scale of the layer as it is now)
        var s = L.transform.scale.value[0] / 100, P = L.transform.position.value, A = L.transform.anchorPoint.value;
        var full = L.sourceRectAtTime(t0, false);
        var L0 = P[0] + (full.left - A[0]) * s;                   // left edge of the finished line
        var baseline = P[1] + (0 - A[1]) * s;                     // text sits on y = 0 in layer space
        var fs = src.fontSize * s;
        var movable = L.transform.position.numKeys === 0 && !L.parent;
        var times = [];
        for (i = 0; i <= n; i++) { times.push(i === 0 ? t0 : t0 + TW.hold + (i - 1) * dt); }
        var tEnd = times[n];

        // reveal: an animator hides everything from the Start index on; Start steps 0 -> n, one letter per key
        anims.addProperty("ADBE Text Animator");
        var an = anims.property(anims.numProperties);
        an.name = "MK Typewriter";
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        if (an.property("ADBE Text Selectors").numProperties === 0) { an.property("ADBE Text Selectors").addProperty("ADBE Text Selector"); }
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = an.property("ADBE Text Selectors").property(1);
        try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2); } catch (eU) {}     // 2 = Index
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        var pairs = [];
        for (i = 0; i <= n; i++) { pairs.push([times[i], i]); }
        holdKeys(sel.property("ADBE Text Index Start"), pairs);

        // keep the growing line centred: shift the layer right by half of what is still missing
        var shift = movable ? 1 : 0;
        if (movable) {
            var pp = L.transform.position, pk = [];
            for (i = 0; i <= n; i++) { pk.push([times[i], vecLike(pp, P[0] + s * (W - edge[i]) / 2, P[1])]); }
            holdKeys(pp, pk);
        }

        // caret: a thin bar hugging the last letter; on from the start, blinks after the last letter, then goes away
        var cw = Math.max(2, fs * TW.caretW), ch = fs * TW.caretH, cyy = baseline - fs * TW.caretRise, color = [0.6, 0.63, 0.65];
        try { if (src.applyFill) { color = src.fillColor; } } catch (eC) {}
        var caret = shapeLayer(comp, "MK Typewriter · Caret");
        var gi = newGroup(caret, "Caret");
        addRect(caret, gi, cw, ch, cw / 2);
        addFill(caret, gi, color, 100);
        var cp = caret.transform.position, ck = [];
        for (i = 0; i <= n; i++) { ck.push([times[i], vecLike(cp, L0 + s * (shift ? (W + edge[i]) / 2 : edge[i]) + fs * TW.caretGap + cw / 2, cyy)]); }
        holdKeys(cp, ck);
        var ok = [[t0, 100]], b, tt = tEnd + TW.blinkOn;
        for (b = 0; b < TW.blinks; b++) { ok.push([tt, 0]); tt += TW.blinkOff; ok.push([tt, 100]); tt += TW.blinkOn; }
        ok.push([Math.max(tt, tEnd + TW.blinkOn), 0]);
        holdKeys(caret.transform.opacity, ok);
        try { caret.inPoint = Math.max(0, t0); caret.outPoint = Math.max(caret.inPoint + 0.1, Math.min(comp.duration, L.outPoint)); } catch (e1) {}
        caret.selected = false;
        return caret;
    }

    // =====================================================================
    // "Typewriter Block": word by word, with a gradient block over the next word and a blue wave behind it
    // =====================================================================
    // Read from a second reference clip ("Never let a dead battery ruin your wilderness adventure again."): the text is typed one
    // WORD at a time (about 6 words a second), a solid gradient block sits over the word that comes next (the same width as that
    // word, wrapping with the text), and the words just typed are blue and fade back to the text colour over the next
    // few words. When the last word lands the block goes away. Camera zoom and the following scenes were left out.
    var TB = { wps: 6, hold: 0.3, wave: 7, blockH: 0.95, blockRise: 0.375, blue: [0.231, 0.510, 0.965],
               c0: [0.10, 0.64, 0.96], c1: [0.55, 0.70, 0.98], slices: 10 };

    function copyStyle(from, to) {
        var keys = ["font", "fontSize", "tracking", "horizontalScale", "verticalScale", "baselineShift", "fauxBold", "fauxItalic", "allCaps", "smallCaps", "applyFill", "applyStroke"], i;
        for (i = 0; i < keys.length; i++) { try { to[keys[i]] = from[keys[i]]; } catch (e) {} }
    }

    function typewriterBlockOne(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, str = src.text, i, k;
        if (trim(str) === "" || /[\r\n\u0003]/.test(str)) { return "skipped"; }
        var words = [], re = /\S+/g, m;
        while ((m = re.exec(str)) !== null) { words.push(m[0]); }
        var n = words.length;

        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        for (i = anims.numProperties; i >= 1; i--) {
            if (anims.property(i).name === "MK Typewriter" || anims.property(i).name === "MK Typewriter Wave") { anims.property(i).remove(); }
        }

        // word positions: measured on a point-text scratch layer with this layer's character style; wrapping is simulated
        // greedily against the box width when the layer is paragraph text
        var tmp = comp.layers.addText("|"), tsp = textDocProp(tmp);
        var d0 = tsp.value; copyStyle(src, d0); try { d0.justification = ParagraphJustification.LEFT_JUSTIFY; } catch (eJ) {} tsp.setValue(d0);
        function widthOf(t) {
            var d = tsp.value; d.text = t; tsp.setValue(d);
            var r = tmp.sourceRectAtTime(t0, false);
            return r.left + r.width;
        }
        var bar = widthOf("|"), boxW = 1e9;
        try { if (src.boxText) { boxW = src.boxTextSize[0]; } } catch (eB) {}
        var fsRaw = src.fontSize, lineStep = fsRaw * 1.2;
        try { if (!src.autoLeading && src.leading) { lineStep = src.leading; } } catch (eL) {}
        var wx = [], ww = [], wl = [], lineText = "", line = 0, cand;
        for (k = 0; k < n; k++) {
            cand = lineText + words[k];
            if (lineText !== "" && widthOf(cand + "|") - bar > boxW) { lineText = ""; line++; }
            var x = lineText === "" ? 0 : widthOf(lineText + "|") - bar;
            wx.push(x); ww.push(Math.max(1, widthOf(lineText + words[k] + "|") - bar - x)); wl.push(line);
            lineText += words[k] + " ";
        }
        try { tmp.remove(); } catch (eR) {}

        var s = L.transform.scale.value[0] / 100, P = L.transform.position.value, A = L.transform.anchorPoint.value;
        var L0 = P[0] - A[0] * s, baseline = P[1] - A[1] * s, fs = fsRaw * s;
        var dt = 1 / TB.wps, times = [];
        for (i = 0; i <= n; i++) { times.push(i === 0 ? t0 : t0 + TB.hold + (i - 1) * dt); }

        // 1) reveal: everything from word `Start` on is hidden; Start steps 0 -> n (Based On: Words, Index units)
        function wordSelector(an) {
            an.property("ADBE Text Animator Properties");
            if (an.property("ADBE Text Selectors").numProperties === 0) { an.property("ADBE Text Selectors").addProperty("ADBE Text Selector"); }
            var sel = an.property("ADBE Text Selectors").property(1);
            try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2); } catch (e1) {}      // Index
            try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Type2").setValue(3); } catch (e2) {}      // Words
            return sel;
        }
        anims.addProperty("ADBE Text Animator");
        var an = anims.property(anims.numProperties);
        an.name = "MK Typewriter";
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = wordSelector(an);
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        var pairs = [];
        for (i = 0; i <= n; i++) { pairs.push([times[i], i]); }
        holdKeys(sel.property("ADBE Text Index Start"), pairs);

        // 2) colour wave: the last TB.wave words are blue, strongest on the newest word (Range Shape: Ramp Up)
        anims.addProperty("ADBE Text Animator");
        var an2 = anims.property(anims.numProperties);
        an2.name = "MK Typewriter Wave";
        an2.property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
        try { an2.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(c4(TB.blue)); } catch (eF) { an2.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(TB.blue); }
        var sel2 = wordSelector(an2);
        try { sel2.property("ADBE Text Range Advanced").property("ADBE Text Range Shape").setValue(2); } catch (eS) {}       // Ramp Up
        var ps = [], pe = [];
        for (i = 0; i <= n; i++) { ps.push([times[i], Math.max(0, i - TB.wave)]); pe.push([times[i], i]); }
        holdKeys(sel2.property("ADBE Text Index Start"), ps);
        holdKeys(sel2.property("ADBE Text Index End"), pe);

        // 3) the block: 100 px wide gradient slices scaled to the width of the next word; it sits on that word, then goes away
        var bh = fs * TB.blockH, block = shapeLayer(comp, "MK Typewriter · Block"), sw = 100 / TB.slices, c;
        for (i = 0; i < TB.slices; i++) {
            var tt = TB.slices > 1 ? i / (TB.slices - 1) : 0;
            c = [TB.c0[0] + (TB.c1[0] - TB.c0[0]) * tt, TB.c0[1] + (TB.c1[1] - TB.c0[1]) * tt, TB.c0[2] + (TB.c1[2] - TB.c0[2]) * tt];
            var gi = newGroup(block, "Block " + (i + 1));
            addRect(block, gi, sw + 0.6, bh, 0, [i * sw + sw / 2, 0]);
            addFill(block, gi, c, 100);
        }
        var bp = block.transform.position, bs = block.transform.scale, kp = [], ks = [];
        for (i = 0; i < n; i++) {
            kp.push([times[i], vecLike(bp, L0 + s * wx[i], baseline + s * wl[i] * lineStep - fs * TB.blockRise)]);
            ks.push([times[i], [Math.max(1, s * ww[i]), 100]]);
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
        var t0 = comp.time, done = 0, skipped = 0, i;
        for (i = 0; i < sel.length; i++) {
            if (!isTextLayer(sel[i])) { skipped++; continue; }
            var res = (kind === "block") ? typewriterBlockOne(comp, sel[i], t0) : typewriterOne(comp, sel[i], t0);
            if (res === "skipped") { skipped++; } else { done++; }
        }
        for (i = 0; i < sel.length; i++) { try { sel[i].selected = true; } catch (e) {} }
        if (done === 0) { alert("Select a single-line text layer. Nothing was typed out.", NAME); }
        else if (skipped > 0) { alert(skipped + " layer(s) were skipped (not text, or more than one line).", NAME); }
    }

    function doTypewriter() { runTypewriter("caret"); }
    function doTypewriterBlock() { runTypewriter("block"); }
