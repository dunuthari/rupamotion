
    // =====================================================================
    // TEXT GROUP — "SaaS Text Preset 1": a two-line text rolls up through a one-line window
    // =====================================================================
    // Read from a clip ("into a fiery 🔥 brand launch" -> "with Google Vids"): both sentences live in one text layer on two lines.
    // A window about one line tall (a mask) hides everything outside it. Every word moves up by one line height, so the first
    // line leaves through the top of the window and the second line rises into its place from below. The words move one after
    // another, each line on its own (about 0.08 s apart, about 0.2 s each, ease-out). It is one button on the selected text
    // layer(s), no settings. Timings are read off the clip, not frame-measured.
    // Two ways to give it the two sentences: TWO text layers (select both: the lower one in the stack is visible first and leaves, the upper one arrives, and
    // both should sit in the same place), or ONE text layer with the sentences on two lines.
    //
    // Two keyframes: a "Roll" slider effect on the text layer goes 0 -> T seconds; an expression selector on a Position animator
    // turns that into each word's own 0-100% amount. If the expression selector cannot be created the whole block rolls instead.
    var SR = { dur: 0.2, stagger: 0.08, top: 0.95, bottom: 0.30 };

    function clearRoll(L) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators"), i, fx, m;
        for (i = anims.numProperties; i >= 1; i--) { if (anims.property(i).name === "MK SaaS Roll") { anims.property(i).remove(); } }
        try { fx = L.property("ADBE Effect Parade"); for (i = fx.numProperties; i >= 1; i--) { if (fx.property(i).name === "Roll") { fx.property(i).remove(); } } } catch (e1) {}
        try { m = L.property("ADBE Mask Parade"); for (i = m.numProperties; i >= 1; i--) { if (m.property(i).name === "MK Roll Window") { m.property(i).remove(); } } } catch (e2) {}
    }

    // mode: "both" (one layer, two lines), "out" (this layer's text leaves upwards) or "in" (this layer's text arrives from below)
    function rollOne(comp, L, t0, mode) {
        var sp = textDocProp(L), src = sp.value;
        if (trim(src.text) === "") { return "skipped"; }
        clearRoll(L);
        var lay = layoutText(comp, L, t0);
        if (mode === "both" && (lay.lines < 2 || lay.wx.length < 2)) { return "needs two lines"; }
        if (lay.wx.length < 1) { return "skipped"; }
        var fs = src.fontSize, step = lay.lineStep;

        // each word's place within its own line (0, 1, 2 ...), per word and per character (spaces take the word before them)
        var inLine = [], seen = {}, w, maxK = 0;
        for (w = 0; w < lay.wl.length; w++) { seen[lay.wl[w]] = (seen[lay.wl[w]] === undefined) ? 0 : seen[lay.wl[w]] + 1; inLine.push(seen[lay.wl[w]]); maxK = Math.max(maxK, seen[lay.wl[w]]); }
        var perChar = [], re = /\S+/g, m, c = 0, last = 0, wi = 0;
        while ((m = re.exec(src.text)) !== null) {
            for (; c < m.index; c++) { perChar.push(last); }
            last = inLine[wi] === undefined ? 0 : inLine[wi]; wi++;
            for (; c < m.index + m[0].length; c++) { perChar.push(last); }
        }
        for (; c < src.text.length; c++) { perChar.push(last); }
        var T = maxK * SR.stagger + SR.dur;

        // the window: one line tall, very wide, in layer space on the first line
        var top = lay.baseY - SR.top * fs, bot = lay.baseY + SR.bottom * fs, X = comp.width * 3;
        var win = addMask(L, makeShape([[-X, top], [X, top], [X, bot], [-X, bot]], [[0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0]], true));
        try { win.name = "MK Roll Window"; } catch (eN) {}

        // the two keyframes
        var e = fxAdd(L, "ADBE Slider Control");
        var sl = null;
        if (e) {
            e.name = "Roll";
            sl = e.property(1);
            sl.setValueAtTime(t0, 0);
            sl.setValueAtTime(t0 + T, T);
            try { sl.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e1) {}
            try { sl.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e2) {}
        }

        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        anims.addProperty("ADBE Text Animator");
        var an = anims.property(anims.numProperties);
        an.name = "MK SaaS Roll";
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Position 3D");
        var pos = an.property("ADBE Text Animator Properties").property("ADBE Text Position 3D");
        var dir = (mode === "in") ? 1 : -1;                  // arriving text starts one line lower and rises into place
        pos.setValue([0, dir * step, 0]);

        var ok = false;
        if (sl) {
            try {
                var selGroup = an.property("ADBE Text Selectors");
                // a new animator starts with a Range Selector; replace it with an Expression Selector
                while (selGroup.numProperties > 0) { selGroup.property(1).remove(); }
                selGroup.addProperty("ADBE Text Expressible Selector");
                var sel = selGroup.property(1), amt = sel.property("ADBE Text Expressible Amount");
                if (amt) {
                    // Based On: Words (3) when the property can be found; otherwise it stays on Characters and the expression copes
                    var names = ["ADBE Text Expressible Type", "ADBE Text Expressible Basis", "ADBE Text Expressible Units", "Based On"], q;
                    for (q = 0; q < names.length; q++) { try { var bo = sel.property(names[q]); if (bo) { bo.setValue(3); break; } } catch (eB) {} }
                    amt.expression = "// MK SaaS Text Roll\nvar LW=" + arrExpr(inLine) + ";\nvar LC=" + arrExpr(perChar) + ";\nvar NW=" + inLine.length + ";\n" +
                        "var v=effect(\"Roll\")(\"Slider\");\n" +
                        "var k=(textTotal===NW)?LW[textIndex-1]:LC[textIndex-1];\n" +
                        "var u=(v-k*" + SR.stagger + ")/" + SR.dur + ";\nu=Math.max(0,Math.min(1,u));\nu=1-Math.pow(1-u,3);\n" + (mode === "in" ? "(1-u)*100" : "u*100");
                    ok = true;
                }
            } catch (eS) { ok = false; }
        }
        if (!ok) {
            // fallback: the whole block rolls up together (two keys on the animator's own Position)
            try { var sg = an.property("ADBE Text Selectors"); if (sg.numProperties === 0) { sg.addProperty("ADBE Text Selector"); } } catch (eF) {}
            pos.setValue([0, 0, 0]);
            pos.setValueAtTime(t0, [0, mode === "in" ? step : 0, 0]);
            pos.setValueAtTime(t0 + T, [0, mode === "in" ? 0 : -step, 0]);
            try { easeBetweenKeys(pos, t0, t0 + T, [0.2, 0, 0.2, 1]); } catch (eE) {}
        }
        return ok ? "ok" : "fallback";
    }

    function doSaasRoll() {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the two text layers (first sentence BELOW, second sentence ABOVE), or one text layer with two lines."); if (!sel) { return; }
        var t0 = comp.time, i, texts = [];
        for (i = 0; i < sel.length; i++) { if (isTextLayer(sel[i])) { texts.push(sel[i]); } }
        if (texts.length === 2) {
            // the LOWER layer in the stack is the sentence that is visible first and leaves; the UPPER layer is the one that arrives
            if (texts[0].index > texts[1].index) { var sw = texts[0]; texts[0] = texts[1]; texts[1] = sw; }
            var r1 = rollOne(comp, texts[0], t0, "in"), r2 = rollOne(comp, texts[1], t0, "out");
            for (i = 0; i < sel.length; i++) { try { sel[i].selected = true; } catch (e) {} }
            if ((r1 !== "ok" && r1 !== "fallback") || (r2 !== "ok" && r2 !== "fallback")) { alert("One of the two text layers has no text. Nothing was rolled.", NAME); }
            return;
        }
        if (texts.length === 1) {
            var res = rollOne(comp, texts[0], t0, "both");
            try { texts[0].selected = true; } catch (e2) {}
            if (res !== "ok" && res !== "fallback") { alert("This text layer needs the two sentences on two lines. Or select two text layers: the first sentence below, the second above.", NAME); }
            return;
        }
        alert("Select two text layers (first sentence below, second sentence above), or one text layer with two lines.", NAME);
    }
