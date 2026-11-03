
    // =====================================================================
    // TEXT > MOTION — seven one-click styles read from a SaaS text showreel (select the layer, click the button, no settings)
    // =====================================================================
    //   Hero Zoom      a giant, blurred word pulls back and sharpens (any layer)
    //   Hero Blur      the word blurs in and settles in place (any layer)
    //   Letter Blur    letters fade in one after another with a little blur (text)
    //   Two-Line Stack the first line sits, then the words of the second line come in below and the block re-centres (text, two lines)
    //   Word Highlight the current word turns teal, the highlight moves word to word (text)
    //   Blur Out       the layer blurs out and shrinks a little (any layer)
    //   Delete Out     the letters disappear from the right, with blur (text)
    // Timings are read off the clip, not frame-measured. The per-letter / per-word ones use an Expression Selector driven by a
    // two-key slider effect (like SaaS Text Preset 1); its matchNames are from memory and unverified in AE: when it cannot be
    // created the effect falls back to a whole-layer version where there is one, otherwise says so.
    var TS = { teal: [0.12, 0.92, 0.72],
        zoom: { from: 3.2, dur: 1.0, blur: 80, fade: 0.35, curve: [0.16, 1, 0.3, 1] },
        blurIn: { from: 0.94, dur: 0.9, blur: 36, fade: 0.5, curve: [0.2, 0.7, 0.2, 1] },
        letter: { stagger: 0.035, dur: 0.28, blur: 16, drop: 10 },
        stack: { delay: 0.5, stagger: 0.08, dur: 0.3, glide: 0.5, blur: 12, drop: 14 },
        highlight: { step: 0.4, ramp: 0.12 },
        blurOut: { dur: 0.55, blur: 30, to: 0.92, hold: 0.1 },
        del: { stagger: 0.03, dur: 0.2, blur: 14 } };

    function tsSmooth(prop, pairs, curve) {
        var i;
        for (i = 0; i < pairs.length; i++) { prop.setValueAtTime(pairs[i][0], pairs[i][1]); }
        for (i = 0; i + 1 < pairs.length; i++) { try { easeBetweenKeys(prop, pairs[i][0], pairs[i + 1][0], curve); } catch (e) {} }
    }

    function tsRemoveNamed(group, prefix) {
        var i;
        for (i = group.numProperties; i >= 1; i--) { if (group.property(i).name.indexOf(prefix) === 0) { group.property(i).remove(); } }
    }

    // a Slider Control effect with exactly two linear keys, 0 -> T seconds from t
    function tsSlider(L, name, t, T) {
        tsRemoveNamed(L.property("ADBE Effect Parade"), name);
        var e = fxAdd(L, "ADBE Slider Control");
        if (!e) { return null; }
        e.name = name;
        var sl = e.property(1);
        sl.setValueAtTime(t, 0);
        sl.setValueAtTime(t + T, T);
        try { sl.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e1) {}
        try { sl.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e2) {}
        return sl;
    }

    // A text animator with the given properties whose only selector is an Expression Selector (Amount = amountExpr, 0-100).
    // props: [[matchName, value], ...]. basedOn: 3 = Words, anything else = leave on Characters. Returns false (and leaves nothing behind) on failure.
    function tsExprAnimator(L, name, props, amountExpr, basedOn) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators"), an = null, i;
        tsRemoveNamed(anims, name);
        try {
            anims.addProperty("ADBE Text Animator");
            an = anims.property(anims.numProperties);
            an.name = name;
            var pg = an.property("ADBE Text Animator Properties");
            for (i = 0; i < props.length; i++) {
                pg.addProperty(props[i][0]);
                var pr = pg.property(props[i][0]);
                if (props[i][0] === "ADBE Text Fill Color") { try { pr.setValue(c4(props[i][1])); } catch (eC) { pr.setValue(props[i][1]); } }
                else { pr.setValue(props[i][1]); }
            }
            var sg = an.property("ADBE Text Selectors");
            while (sg.numProperties > 0) { sg.property(1).remove(); }
            sg.addProperty("ADBE Text Expressible Selector");
            var sel = sg.property(1), amt = sel.property("ADBE Text Expressible Amount");
            if (!amt) { throw new Error("no amount"); }
            if (basedOn === 3) {
                var names = ["ADBE Text Expressible Type", "ADBE Text Expressible Basis", "ADBE Text Expressible Units", "Based On"], q;
                for (q = 0; q < names.length; q++) { try { var bo = sel.property(names[q]); if (bo) { bo.setValue(3); break; } } catch (eB) {} }
            }
            amt.expression = amountExpr;
            return true;
        } catch (e) {
            try { if (an) { an.remove(); } } catch (e2) {}
            return false;
        }
    }

    // ---- shared by the whole-layer styles -----------------------------------------------------
    function tsLayers(comp, msg) {
        var sel = selLayers(comp, 1, msg), out = [], i;
        if (!sel) { return null; }
        for (i = 0; i < sel.length; i++) { if (!(sel[i] instanceof CameraLayer || sel[i] instanceof LightLayer)) { out.push(sel[i]); } }
        return out;
    }

    function tsCenterAnchor(L, t) {
        try { if ((L instanceof TextLayer) && allZero(L.transform.anchorPoint.value)) { anchorTo(L, "center", t); } } catch (e) {}
    }

    function tsBlur(L, name, pairs, curve) {
        tsRemoveNamed(L.property("ADBE Effect Parade"), name);
        var e = fxAdd(L, "ADBE Gaussian Blur 2");
        if (!e) { return null; }
        e.name = name;
        tsSmooth(e.property(1), pairs, curve);
        return e;
    }

    function tsFadeIn(L, t, dur) {
        var op = L.transform.opacity, to = 100;
        try { if (op.numKeys === 0) { to = op.value; } else { to = op.valueAtTime(t + dur, false); } } catch (e) {}
        tsSmooth(op, [[t, 0], [t + dur, to]], [0.2, 0, 0.4, 1]);
    }

    function tsHero(L, t, o) {
        tsCenterAnchor(L, t);
        var sp = L.transform.scale, base = sp.valueAtTime(t, false);
        if (allZero(base)) { base = [100, 100]; }
        tsSmooth(sp, [[t, scaled(base, o.from)], [t + o.dur, base]], o.curve);
        tsBlur(L, "Ru Hero Blur", [[t, o.blur], [t + o.dur, 0]], o.curve);
        tsFadeIn(L, t, o.fade);
    }

    function doHeroZoom() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsLayers(comp, "Select the layer(s) to zoom in."); if (!list) { return; }
        for (var i = 0; i < list.length; i++) { tsHero(list[i], comp.time, TS.zoom); }
    }

    function doHeroBlur() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsLayers(comp, "Select the layer(s) to blur in."); if (!list) { return; }
        for (var i = 0; i < list.length; i++) { tsHero(list[i], comp.time, TS.blurIn); }
    }

    function tsBlurOut(L, t) {
        tsCenterAnchor(L, t);
        var sp = L.transform.scale, base = sp.valueAtTime(t, false), op = L.transform.opacity, to = 100, o = TS.blurOut;
        if (allZero(base)) { base = [100, 100]; }
        tsSmooth(sp, [[t, base], [t + o.dur, scaled(base, o.to)]], [0.4, 0, 0.6, 1]);
        tsBlur(L, "Ru Blur Out", [[t, 0], [t + o.dur, o.blur]], [0.4, 0, 0.6, 1]);
        try { to = op.numKeys === 0 ? op.value : op.valueAtTime(t, false); } catch (e) {}
        tsSmooth(op, [[t, to], [t + o.hold, to], [t + o.dur, 0]], [0.4, 0, 0.6, 1]);
    }

    function doBlurOut() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsLayers(comp, "Select the layer(s) to blur out."); if (!list) { return; }
        for (var i = 0; i < list.length; i++) { tsBlurOut(list[i], comp.time); }
    }

    // ---- per-letter / per-word styles (text layers) -----------------------------------------------
    function tsTextLayers(comp, msg) {
        var list = tsLayers(comp, msg), out = [], i;
        if (!list) { return null; }
        for (i = 0; i < list.length; i++) { if (isTextLayer(list[i])) { out.push(list[i]); } }
        if (out.length === 0) { alert("Select a text layer. Nothing was changed.", NAME); return null; }
        return out;
    }

    function doLetterBlur() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsTextLayers(comp, "Select the text layer(s) to reveal letter by letter."); if (!list) { return; }
        var t = comp.time, o = TS.letter, i, failed = 0;
        for (i = 0; i < list.length; i++) {
            var L = list[i], n = textDocProp(L).value.text.length, T = Math.max(1, n - 1) * o.stagger + o.dur;
            var sl = tsSlider(L, "Ru Reveal", t, T), ok = false;
            if (sl) {
                ok = tsExprAnimator(L, "Ru Letter Blur", [["ADBE Text Opacity", 0], ["ADBE Text Blur", [o.blur, o.blur]], ["ADBE Text Position 3D", [0, o.drop, 0]]],
                    "// Ru Letter Blur\nvar v=effect(\"Ru Reveal\")(\"Slider\");\nvar u=(v-(textIndex-1)*" + o.stagger + ")/" + o.dur + ";\nu=Math.max(0,Math.min(1,u));\nu=1-Math.pow(1-u,3);\n(1-u)*100", 1);
            }
            if (!ok) { failed++; tsHero(L, t, TS.blurIn); }       // fallback: the whole line blurs in
        }
        if (failed > 0) { alert("The per-letter selector could not be created; the whole line was blurred in instead.", NAME); }
    }

    function doDeleteOut() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsTextLayers(comp, "Select the text layer(s) to delete letter by letter."); if (!list) { return; }
        var t = comp.time, o = TS.del, i, failed = 0;
        for (i = 0; i < list.length; i++) {
            var L = list[i], n = textDocProp(L).value.text.length, T = Math.max(1, n - 1) * o.stagger + o.dur;
            var sl = tsSlider(L, "Ru Delete", t, T), ok = false;
            if (sl) {
                // letters leave from the END: the last letter starts first
                ok = tsExprAnimator(L, "Ru Delete Out", [["ADBE Text Opacity", 0], ["ADBE Text Blur", [o.blur, o.blur]]],
                    "// Ru Delete Out\nvar v=effect(\"Ru Delete\")(\"Slider\");\nvar u=(v-(" + n + "-textIndex)*" + o.stagger + ")/" + o.dur + ";\nu=Math.max(0,Math.min(1,u));\nu=u*u*(3-2*u);\nu*100", 1);
            }
            if (!ok) { failed++; tsBlurOut(L, t); }
        }
        if (failed > 0) { alert("The per-letter selector could not be created; the whole line was blurred out instead.", NAME); }
    }

    // per-word and per-character tables for the expressions: word index (and place within its line) for every character
    function tsTables(lay, text) {
        var inLine = [], seen = {}, w, perChar = [], perCharWord = [], perCharLine = [], re = /\S+/g, m, c = 0, last = 0, lastW = 0, lastLine = 0, wi = 0;
        for (w = 0; w < lay.wl.length; w++) { seen[lay.wl[w]] = (seen[lay.wl[w]] === undefined) ? 0 : seen[lay.wl[w]] + 1; inLine.push(seen[lay.wl[w]]); }
        while ((m = re.exec(text)) !== null) {
            for (; c < m.index; c++) { perChar.push(last); perCharWord.push(lastW); perCharLine.push(lastLine); }
            last = inLine[wi] === undefined ? 0 : inLine[wi]; lastW = wi; lastLine = lay.wl[wi] === undefined ? 0 : lay.wl[wi]; wi++;
            for (; c < m.index + m[0].length; c++) { perChar.push(last); perCharWord.push(lastW); perCharLine.push(lastLine); }
        }
        for (; c < text.length; c++) { perChar.push(last); perCharWord.push(lastW); perCharLine.push(lastLine); }
        return { wordK: inLine, wordLine: lay.wl, charK: perChar, charWord: perCharWord, charLine: perCharLine, n: inLine.length };
    }

    function doWordHighlight() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsTextLayers(comp, "Select the text layer(s) to highlight word by word."); if (!list) { return; }
        var t = comp.time, o = TS.highlight, i, failed = 0;
        for (i = 0; i < list.length; i++) {
            var L = list[i], src = textDocProp(L).value, lay = layoutText(comp, L, t), tb = tsTables(lay, src.text);
            if (tb.n < 1) { continue; }
            var T = tb.n * o.step + o.ramp * 2 + 0.2, sl = tsSlider(L, "Ru Highlight", t, T), ok = false;
            if (sl) {
                ok = tsExprAnimator(L, "Ru Word Highlight", [["ADBE Text Fill Color", TS.teal]],
                    "// Ru Word Highlight\nvar WI=" + arrExpr(tb.charWord) + ";\nvar NW=" + tb.n + ";\nvar v=effect(\"Ru Highlight\")(\"Slider\");\nvar k=(textTotal===NW)?(textIndex-1):WI[textIndex-1];\n" +
                    "var a=Math.max(0,Math.min(1,(v-k*" + o.step + ")/" + o.ramp + "));\nvar b=Math.max(0,Math.min(1,1-(v-(k+1)*" + o.step + ")/" + o.ramp + "));\nMath.min(a,b)*100", 3);
            }
            if (!ok) { failed++; }
        }
        if (failed > 0) { alert("The per-word selector could not be created on " + failed + " layer(s); nothing was highlighted there.", NAME); }
    }

    function doTwoLineStack() {
        var comp = activeComp(); if (!comp) { return; }
        var list = tsTextLayers(comp, "Select a text layer with two lines."); if (!list) { return; }
        var t = comp.time, o = TS.stack, i, bad = 0;
        for (i = 0; i < list.length; i++) {
            var L = list[i], src = textDocProp(L).value, lay = layoutText(comp, L, t);
            if (lay.lines < 2 || lay.wx.length < 2) { bad++; continue; }
            var tb = tsTables(lay, src.text), maxK = 0, w;
            for (w = 0; w < tb.n; w++) { if (tb.wordLine[w] > 0) { maxK = Math.max(maxK, tb.wordK[w]); } }
            var T = o.delay + maxK * o.stagger + o.dur + 0.1;
            tsRemoveNamed(L.property("ADBE Effect Parade"), "Ru Stack");
            var sl = tsSlider(L, "Ru Stack", t, T), ok = false;
            if (sl) {
                ok = tsExprAnimator(L, "Ru Stack", [["ADBE Text Opacity", 0], ["ADBE Text Blur", [o.blur, o.blur]], ["ADBE Text Position 3D", [0, o.drop, 0]]],
                    "// Ru Stack\nvar LN=" + arrExpr(tb.wordLine) + ";\nvar KK=" + arrExpr(tb.wordK) + ";\nvar CL=" + arrExpr(tb.charLine) + ";\nvar CK=" + arrExpr(tb.charK) + ";\nvar NW=" + tb.n + ";\n" +
                    "var v=effect(\"Ru Stack\")(\"Slider\");\nvar w=(textTotal===NW);\nvar ln=w?LN[textIndex-1]:CL[textIndex-1];\nvar k=w?KK[textIndex-1]:CK[textIndex-1];\nvar out=0;\n" +
                    "if(ln>0){var u=(v-" + o.delay + "-k*" + o.stagger + ")/" + o.dur + ";u=Math.max(0,Math.min(1,u));u=1-Math.pow(1-u,3);out=(1-u)*100;}\nout", 3);
            }
            if (!ok) { bad++; continue; }
            // the block starts with line 1 alone in the middle, then glides up to its own place as line 2 arrives
            var s = L.transform.scale.value[0] / 100, off = (lay.lines - 1) * lay.lineStep * s / 2;
            try {
                if (L.transform.position.numKeys === 0 && !L.parent && L.transform.position.expression === "") {
                    L.transform.position.expression = "// Ru Stack\nvar v=effect(\"Ru Stack\")(\"Slider\");\nvar p=Math.max(0,Math.min(1,(v-" + o.delay + ")/" + o.glide + "));p=1-Math.pow(1-p,3);\n[value[0],value[1]+" + num2(off) + "*(1-p)]";
                }
            } catch (eP) {}
        }
        if (bad > 0) { alert(bad + " layer(s) skipped (they need two lines, or the per-word selector could not be created).", NAME); }
    }
