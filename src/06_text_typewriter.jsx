
    // =====================================================================
    // TEXT GROUP — "Typewriter": letters pop in one by one with a caret that follows the last letter
    // =====================================================================
    // Read from a reference clip ("Let's choose a style"): the caret shows first, the first letter lands, then the rest
    // arrive at an even pace (roughly 14 letters a second) with a thin caret hugging the last letter. The line stays centred
    // while it grows. When the last letter lands the caret blinks and goes away. Pace, first-letter hold, caret size and blink
    // are read off the clip (not frame-measured), so they are fields or constants here.
    var TW = { cps: 14, hold: 0.3, caretW: 0.045, caretH: 1.1, caretGap: 0.06, caretRise: 0.3, blinkOn: 0.4, blinkOff: 0.4 };

    // Hold keys: the value jumps at each key and stays until the next one (crisp per-letter steps)
    function holdKeys(prop, pairs) {
        var i, idx;
        for (i = 0; i < pairs.length; i++) { prop.setValueAtTime(pairs[i][0], pairs[i][1]); }
        for (i = 0; i < pairs.length; i++) {
            idx = prop.nearestKeyIndex(pairs[i][0]);
            try { prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); } catch (e) {}
        }
    }

    // o: text, size, color, cps, hold, caret (bool), blinks, centred (bool), length
    function doTypewriter(o) {
        var comp = activeComp(); if (!comp) { return; }
        var str = trim(o.text), n = str.length, i;
        if (n < 1) { alert("Type some text first.", NAME); return; }
        var t0 = comp.time, cx = comp.width / 2, cy = comp.height / 2, font = pickFont(true);
        var dt = 1 / o.cps;

        var L = makeText(comp, str, { size: o.size, color: o.color, font: font, just: "left" });
        L.name = "MK Typewriter · Text";
        var full = L.sourceRectAtTime(t0, false), top = Math.min(0, full.top), h = -top;

        // width of every prefix, measured on a scratch layer ("|" is appended so trailing spaces still count)
        var tmp = makeText(comp, "|", { size: o.size, color: o.color, font: font, just: "left" });
        var tsp = textDocProp(tmp);
        function widthOf(s) {
            var d = tsp.value; d.text = s; tsp.setValue(d);
            var r = tmp.sourceRectAtTime(t0, false);
            return r.left + r.width;
        }
        var bar = widthOf("|"), edge = [0];
        for (i = 1; i <= n; i++) { edge.push(Math.max(0, widthOf(str.substring(0, i) + "|") - bar)); }
        try { tmp.remove(); } catch (eR) {}

        // text sits left-anchored on the baseline; position steps with every letter so the line stays centred as it grows
        setXY(L.transform.anchorPoint, 0, top / 2);
        var leftAt = [];
        for (i = 0; i <= n; i++) { leftAt.push(o.centred ? cx - edge[i] / 2 : cx - edge[n] / 2); }
        var times = [];
        for (i = 0; i <= n; i++) { times.push(i === 0 ? t0 : t0 + o.hold + (i - 1) * dt); }
        var tEnd = times[n];

        // reveal: an animator hides everything from the Start index onwards; Start steps 0 -> n, one letter per step
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        anims.addProperty("ADBE Text Animator");
        var an = anims.property(anims.numProperties);
        an.name = "MK Typewriter";
        an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
        if (an.property("ADBE Text Selectors").numProperties === 0) { an.property("ADBE Text Selectors").addProperty("ADBE Text Selector"); }
        an.property("ADBE Text Animator Properties").property("ADBE Text Opacity").setValue(0);
        var sel = an.property("ADBE Text Selectors").property(1);
        try { sel.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2); } catch (eU) {}     // 2 = Index
        try { sel.property("ADBE Text Index End").setValue(100000); } catch (eE) {}
        var startProp = sel.property("ADBE Text Index Start"), pairs = [];
        for (i = 0; i <= n; i++) { pairs.push([times[i], i]); }
        holdKeys(startProp, pairs);

        var pp = L.transform.position, pk = [];
        for (i = 0; i <= n; i++) { pk.push([times[i], vecLike(pp, leftAt[i], cy)]); }
        if (o.centred) { holdKeys(pp, pk); } else { setXY(pp, leftAt[0], cy); }

        var all = [L], caret = null;
        if (o.caret) {
            var cw = Math.max(2, o.size * TW.caretW), ch = o.size * TW.caretH, baseline = cy + h / 2;
            caret = shapeLayer(comp, "MK Typewriter · Caret");
            var gi = newGroup(caret, "Caret");
            addRect(caret, gi, cw, ch, cw / 2);
            addFill(caret, gi, o.color, 100);
            var cp = caret.transform.position, ck = [], cyy = baseline - o.size * TW.caretRise;
            for (i = 0; i <= n; i++) { ck.push([times[i], vecLike(cp, leftAt[i] + edge[i] + o.size * TW.caretGap + cw / 2, cyy)]); }
            holdKeys(cp, ck);
            // blinks once typing stops, then it goes away
            var ok = [[t0, 100]], b, tt = tEnd + TW.blinkOn;
            for (b = 0; b < o.blinks; b++) { ok.push([tt, 0]); tt += TW.blinkOff; ok.push([tt, 100]); tt += TW.blinkOn; }
            ok.push([Math.max(tt, tEnd + TW.blinkOn), 0]);
            holdKeys(caret.transform.opacity, ok);
            all.push(caret);
        }

        var life = Math.max(o.length, tEnd - t0 + (o.blinks * (TW.blinkOn + TW.blinkOff) + TW.blinkOn) + 0.5);
        for (i = 0; i < all.length; i++) {
            try { all[i].inPoint = Math.max(0, t0); all[i].outPoint = Math.min(comp.duration, t0 + life); } catch (e1) {}
            all[i].selected = false;
        }
        L.selected = true;
    }
