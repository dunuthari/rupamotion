
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
    // Returns { n, cx[0..n] (caret x after letter i, layer space), cl[0..n] (its line), words: wx[], ww[], wl[], lineStep, lines: count, lineW[], off[], baseY (first baseline, layer space) }
    function layoutText(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, str = src.text, n = str.length, i, j, k;
        var tmp = comp.layers.addText("|"), tsp = textDocProp(tmp);
        var d0 = tsp.value; copyStyle(src, d0); try { d0.justification = ParagraphJustification.LEFT_JUSTIFY; } catch (eJ) {} tsp.setValue(d0);
        function rectOf(t) {
            var d = tsp.value; d.text = t; tsp.setValue(d);
            return tmp.sourceRectAtTime(t0, false);
        }
        function widthOf(t) { var r = rectOf(t); return r.left + r.width; }
        var bar = widthOf("|"), boxW = 1e9, boxX = 0, fsRaw = src.fontSize, lineStep = fsRaw * 1.2, just = 0, isBox = false;
        // Paragraph (box) text is not drawn from the layer origin: the box sits at boxTextPos (its top-left) in layer space
        try { if (src.boxText) { isBox = true; boxW = src.boxTextSize[0]; boxX = src.boxTextPos[0] || 0; } } catch (eB) {}
        try { if (!src.autoLeading && src.leading) { lineStep = src.leading; } } catch (eL) {}
        try {                                   // centre / right justified text: lines are placed inside the box, or around the origin for point text
            var J = src.justification;
            if (J !== undefined) {
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
            if (isBox) { off.push(boxX + (just === 1 ? (boxW - e[e.length - 1]) / 2 : (just === 2 ? boxW - e[e.length - 1] : 0))); }
            else { off.push(just === 1 ? -e[e.length - 1] / 2 : (just === 2 ? -e[e.length - 1] : 0)); }
        }
        // first baseline in layer space: the top of the whole text minus the top of the same first line on a point-text
        // scratch layer (whose baseline is y = 0). That is 0 for point text and the box offset + ascent for paragraph text.
        var first = lines.length ? lines[0].text : "H";
        if (trim(first) === "") { first = "H"; }
        var baseY = 0;
        try { baseY = L.sourceRectAtTime(t0, false).top - rectOf(first).top; } catch (eY) {}
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
        return { n: n, cx: cx, cl: cl, wx: wx, ww: ww, wl: wl, lineStep: lineStep, lines: lines.length, lineW: lineW, off: off, baseY: baseY, isBox: isBox, src: src };
    }

    // ---------------------------------------------------------------------
    // Shared pieces. The whole effect runs on TWO keyframes: one slider ("Typed", on the caret / block layer) goes from 0 to the
    // number of letters (or words) over the typing time, and everything else (what is revealed, the colour wave, the caret or
    // block position, the blink, the centring shift) is an expression that reads that slider. Retime the effect by moving the
    // two keys; nothing else has to change. Expressions work in both the Legacy and JavaScript engines.
    // ---------------------------------------------------------------------
    var TW_MARK = "// Ru Typewriter";

    function num2(v) { return String(Math.round(v * 100) / 100); }
    function arrExpr(a) { var out = [], i; for (i = 0; i < a.length; i++) { out.push(num2(a[i])); } return "[" + out.join(",") + "]"; }
    function typedRef(helperName) { return "thisComp.layer(\"" + helperName + "\").effect(\"Typed\")(\"Slider\")"; }
    var TYPED_OWN = "effect(\"Typed\")(\"Slider\")";

    // Removes the previous typewriter on this layer: its animators, the helper layer and the centring expression
    function clearTypewriter(comp, L) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators"), i, nm, tags = [], j, names;
        for (i = anims.numProperties; i >= 1; i--) {
            nm = anims.property(i).name;
            if (nm.indexOf("Ru Typewriter") === 0) {
                if (nm.indexOf("Ru Typewriter Wave") !== 0) { tags.push(nm.substring("Ru Typewriter ".length)); }
                anims.property(i).remove();
            }
        }
        var gone = [];
        for (j = 0; j < tags.length; j++) { gone.push("Ru Typewriter · Caret " + tags[j]); gone.push("Ru Typewriter · Block " + tags[j]); }
        names = {};
        for (j = 0; j < gone.length; j++) { names[gone[j]] = true; }
        for (i = comp.numLayers; i >= 1; i--) {
            try { if (names[comp.layer(i).name]) { comp.layer(i).remove(); } } catch (e) {}
        }
        try { if (L.transform.position.expression.indexOf(TW_MARK) >= 0) { L.transform.position.expression = ""; } } catch (e2) {}
        return anims;
    }

    // The helper layer's slider: exactly two linear keys, 0 -> total
    function addTypedSlider(helper, tA, tB, total) {
        var e = fxAdd(helper, "ADBE Slider Control");
        if (!e) { return null; }
        e.name = "Typed";
        var sl = e.property(1);
        sl.setValueAtTime(tA, 0);
        sl.setValueAtTime(tB, total);
        try { sl.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e1) {}
        try { sl.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e2) {}
        return sl;
    }

    // Adds a text animator whose range selector works in Index units on Characters (1) or Words (3)
    function indexAnimator(anims, name) {
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

    function newTag(comp) { return String(comp.numLayers + 1) + "-" + String(Math.round(new Date().getTime() % 100000)); }

    // ---------------------------------------------------------------------
    // Typewriter: letter by letter + caret
    // ---------------------------------------------------------------------
    function typewriterOne(comp, L, t0) {
        var sp = textDocProp(L), src = sp.value, n = src.text.length, i;
        if (trim(src.text) === "") { return "skipped"; }
        var dt = 1 / TW.cps;
        var anims = clearTypewriter(comp, L);
        var lay = layoutText(comp, L, t0), tag = newTag(comp), helperName = "Ru Typewriter · Caret " + tag;

        var s = L.transform.scale.value[0] / 100, P = L.transform.position.value, A = L.transform.anchorPoint.value;
        var ox = P[0] - A[0] * s, baseline = P[1] + (lay.baseY - A[1]) * s, fs = src.fontSize * s;
        var single = lay.lines === 1;
        var movable = single && !lay.isBox && L.transform.position.numKeys === 0 && !L.parent && L.transform.position.expression === "";   // only a single line of point text is kept centred while it grows
        var W = lay.lineW[0], off0 = lay.off[0];
        var tA = t0 + TW.hold - dt, tB = t0 + TW.hold + (n - 1) * dt;        // the first letter lands at t0 + hold; the last one at tB

        // the helper layer carries the two keys: a thin caret hugging the last letter
        var cw = Math.max(2, fs * TW.caretW), ch = fs * TW.caretH, color = [0.6, 0.63, 0.65];
        try { if (src.applyFill) { color = src.fillColor; } } catch (eC) {}
        var caret = shapeLayer(comp, helperName);
        var gi = newGroup(caret, "Caret");
        addRect(caret, gi, cw, ch, cw / 2);
        addFill(caret, gi, color, 100);
        addTypedSlider(caret, tA, tB, n);

        var xs = [], ys = [], sh = [];
        for (i = 0; i <= n; i++) {
            xs.push((movable ? ox + s * (off0 + (W + (lay.cx[i] - off0)) / 2) : ox + s * lay.cx[i]) + fs * TW.caretGap + cw / 2);
            ys.push(baseline + s * lay.cl[i] * lay.lineStep - fs * TW.caretRise);
            sh.push(s * (W - (lay.cx[i] - off0)) / 2);
        }
        caret.transform.position.expression = TW_MARK + "\nvar xs=" + arrExpr(xs) + ";\nvar ys=" + arrExpr(ys) + ";\nvar i=Math.floor(" + TYPED_OWN + ");\ni=Math.max(0,Math.min(xs.length-1,i));\n[xs[i],ys[i]]";
        // on until the last letter lands, then it blinks and goes away
        caret.transform.opacity.expression = TW_MARK + "\nvar p=" + TYPED_OWN + ";\nvar out=100;\nif(p>=" + n + "){var u=time-p.key(2).time-" + TW.blinkOn + ";\nif(u>=0){out=(u>=" + num2(TW.blinks * (TW.blinkOn + TW.blinkOff)) + ")?0:((Math.floor(u/" + TW.blinkOff + ")%2===0)?0:100);}}\nout";

        // the text: everything from the Start index on is hidden; Start = letters typed so far
        var an = indexAnimator(anims, "Ru Typewriter " + tag);
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = indexSelector(an, 1);
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        sel.property("ADBE Text Index Start").expression = TW_MARK + "\nMath.floor(" + typedRef(helperName) + ")";

        // a single line stays centred: the layer starts half of the missing width too far right and settles on its own position
        if (movable) {
            L.transform.position.expression = TW_MARK + "\nvar sh=" + arrExpr(sh) + ";\nvar i=Math.floor(" + typedRef(helperName) + ");\ni=Math.max(0,Math.min(sh.length-1,i));\n[value[0]+sh[i],value[1]]";
        }
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
        var anims = clearTypewriter(comp, L);
        var lay = layoutText(comp, L, t0), n = lay.wx.length;
        if (n < 1) { return "skipped"; }
        var tag = newTag(comp), helperName = "Ru Typewriter · Block " + tag;

        var s = L.transform.scale.value[0] / 100, P = L.transform.position.value, A = L.transform.anchorPoint.value;
        var ox = P[0] - A[0] * s, baseline = P[1] + (lay.baseY - A[1]) * s, fs = src.fontSize * s;
        var dt = 1 / TB.wps;
        var tA = t0 + TB.hold - dt, tB = t0 + TB.hold + (n - 1) * dt;

        // the helper layer carries the two keys: 100 px wide gradient slices scaled to the width of the NEXT word
        var bh = fs * TB.blockH, block = shapeLayer(comp, helperName), sw = 100 / TB.slices, c, tt, gi;
        for (i = 0; i < TB.slices; i++) {
            tt = TB.slices > 1 ? i / (TB.slices - 1) : 0;
            c = [TB.c0[0] + (TB.c1[0] - TB.c0[0]) * tt, TB.c0[1] + (TB.c1[1] - TB.c0[1]) * tt, TB.c0[2] + (TB.c1[2] - TB.c0[2]) * tt];
            gi = newGroup(block, "Block " + (i + 1));
            addRect(block, gi, sw + 0.6, bh, 0, [i * sw + sw / 2, 0]);
            addFill(block, gi, c, 100);
        }
        addTypedSlider(block, tA, tB, n);
        var xs = [], ys = [], ws = [];
        for (i = 0; i < n; i++) {
            xs.push(ox + s * lay.wx[i]);
            ys.push(baseline + s * lay.wl[i] * lay.lineStep - fs * TB.blockRise);
            ws.push(Math.max(1, s * lay.ww[i]));
        }
        var idx = "var i=Math.floor(" + TYPED_OWN + ");\ni=Math.max(0,Math.min(" + (n - 1) + ",i));\n";
        block.transform.position.expression = TW_MARK + "\nvar xs=" + arrExpr(xs) + ";\nvar ys=" + arrExpr(ys) + ";\n" + idx + "[xs[i],ys[i]]";
        block.transform.scale.expression = TW_MARK + "\nvar ws=" + arrExpr(ws) + ";\n" + idx + "[ws[i],100]";
        block.transform.opacity.expression = TW_MARK + "\n(Math.floor(" + TYPED_OWN + ")>=" + n + ")?0:100";

        // 1) reveal: everything from word `Start` on is hidden (Based On: Words, Index units)
        var an = indexAnimator(anims, "Ru Typewriter " + tag);
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = indexSelector(an, 3);
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        var ref = typedRef(helperName);
        sel.property("ADBE Text Index Start").expression = TW_MARK + "\nMath.floor(" + ref + ")";

        // 2) colour wave: the last TB.wave words are blue, strongest on the newest word (Range Shape: Ramp Up)
        var an2 = indexAnimator(anims, "Ru Typewriter Wave " + tag);
        an2.property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
        try { an2.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(c4(TB.blue)); } catch (eF) { an2.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(TB.blue); }
        var sel2 = indexSelector(an2, 3);
        try { sel2.property("ADBE Text Range Advanced").property("ADBE Text Range Shape").setValue(2); } catch (eS) {}       // Ramp Up
        sel2.property("ADBE Text Index Start").expression = TW_MARK + "\nMath.max(0,Math.floor(" + ref + ")-" + TB.wave + ")";
        sel2.property("ADBE Text Index End").expression = TW_MARK + "\nMath.floor(" + ref + ")";

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
