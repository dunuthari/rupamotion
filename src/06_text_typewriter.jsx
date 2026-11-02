
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

    function doTypewriter() {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the text layer(s) to type out."); if (!sel) { return; }
        var t0 = comp.time, done = 0, skipped = 0, i;
        for (i = 0; i < sel.length; i++) {
            if (!isTextLayer(sel[i])) { skipped++; continue; }
            if (typewriterOne(comp, sel[i], t0) === "skipped") { skipped++; } else { done++; }
        }
        for (i = 0; i < sel.length; i++) { try { sel[i].selected = true; } catch (e) {} }
        if (done === 0) { alert("Select a single-line text layer. Nothing was typed out.", NAME); }
        else if (skipped > 0) { alert(skipped + " layer(s) were skipped (not text, or more than one line).", NAME); }
    }
