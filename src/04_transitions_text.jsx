
    // =====================================================================
    // TRANSITION GROUP
    // =====================================================================

    function isContentLayer(L) {
        if (!(L instanceof AVLayer)) { return false; }
        if (L.adjustmentLayer || L.guideLayer || !L.enabled) { return false; }
        if (/^MK /.test(L.name)) { return false; }
        return true;
    }

    // Two selected clips → those. Otherwise the cut is at the playhead.
    function transitionContext(comp, needLayers) {
        var sel = comp.selectedLayers, fr = comp.frameDuration, ctx = { cut: comp.time, outL: null, inL: null };
        if (sel.length === 2) {
            var a = sel[0], b = sel[1];
            if (a.inPoint > b.inPoint) { var tmp = a; a = b; b = tmp; }
            ctx.outL = a; ctx.inL = b; ctx.cut = b.inPoint;
            return ctx;
        }
        if (!needLayers) { return ctx; }
        var t = comp.time, i, L;
        for (i = 1; i <= comp.numLayers; i++) {
            L = comp.layer(i);
            if (isContentLayer(L) && L.inPoint <= t + fr / 2 && L.outPoint > t + fr / 2) { ctx.inL = L; break; }
        }
        if (ctx.inL) {
            for (i = ctx.inL.index + 1; i <= comp.numLayers; i++) {
                L = comp.layer(i);
                if (isContentLayer(L) && L.inPoint <= t - fr / 2 && L.outPoint >= t - fr / 2) { ctx.outL = L; break; }
            }
        }
        if (!ctx.inL || !ctx.outL) {
            alert("Couldn't find two clips at the playhead.\nSelect the outgoing and incoming clips, or put the playhead exactly on the cut.", NAME);
            return null;
        }
        return ctx;
    }

    // Eases for a 4-key cut: slow → fast into the cut, fast → slow out of it.
    var CUT_EASES = [[33, 90], [0.1, 33], [33, 0.1], [90, 33]];

    function cutAdjustment(comp, name, cut, d, shutter) {
        var adj = addAdjustment(comp, name, cut - d, cut + d);
        var tile = fxAdd(adj, "ADBE Tile");
        fxSet(tile, 4, 300);
        fxSet(tile, 5, 300);
        fxSet(tile, 6, 1);
        var tr = fxAdd(adj, "ADBE Geometry2");
        fxSet(tr, 10, 0);
        fxSet(tr, 11, shutter);
        return adj;
    }

    function transformFx(adj) {
        var fx = adj.property("ADBE Effect Parade");
        return fx.property(fx.numProperties);
    }

    function doZoomCut(zoomIn, o) {
        var comp = activeComp(); if (!comp) { return; }
        var ctx = transitionContext(comp, false); if (!ctx) { return; }
        var fr = comp.frameDuration, d = o.frames * fr, k = Math.max(1.2, o.intensity), cut = ctx.cut;
        var adj = cutAdjustment(comp, "MK Zoom " + (zoomIn ? "In" : "Out") + " Cut", cut, d, o.blur);
        var sc = transformFx(adj).property(4);
        var a = zoomIn ? 100 * k : 100 / k, b = zoomIn ? 100 / k : 100 * k;
        setKeys(sc, [[cut - d, 100], [cut - fr, a], [cut, b], [cut + d, 100]], { eases: CUT_EASES });
    }

    function doSwipeCut(dir, o) {
        var comp = activeComp(); if (!comp) { return; }
        var ctx = transitionContext(comp, false); if (!ctx) { return; }
        var fr = comp.frameDuration, d = o.frames * fr, cut = ctx.cut;
        var W = comp.width, H = comp.height, c = [W / 2, H / 2];
        var dist = (dir[0] !== 0) ? W : H;
        var adj = cutAdjustment(comp, "MK Swipe Cut", cut, d, o.blur);
        var pos = transformFx(adj).property(2);
        setKeys(pos, [
            [cut - d, c],
            [cut - fr, [c[0] + dir[0] * dist, c[1] + dir[1] * dist]],
            [cut, [c[0] - dir[0] * dist, c[1] - dir[1] * dist]],
            [cut + d, c]
        ], { eases: CUT_EASES });
    }

    function doShapeWipe(o) {
        var comp = activeComp(); if (!comp) { return; }
        var ctx = transitionContext(comp, true); if (!ctx) { return; }
        var W = comp.width, H = comp.height, fr = comp.frameDuration, d = animDur(comp);
        var inL = ctx.inL, outL = ctx.outL, cut = ctx.cut, lead = o.accent ? o.lead * fr : 0;
        if (inL.index > outL.index) { inL.moveBefore(outL); }
        var origins = { center: [W / 2, H / 2], left: [0, H / 2], right: [W, H / 2], top: [W / 2, 0], bottom: [W / 2, H] };
        var org = origins[o.origin] || origins.center;
        var corners = [[0, 0], [W, 0], [0, H], [W, H]], R = 0;
        for (var i = 0; i < 4; i++) {
            R = Math.max(R, Math.sqrt(Math.pow(corners[i][0] - org[0], 2) + Math.pow(corners[i][1] - org[1], 2)));
        }
        R *= 1.08;
        var ease = { curve: { first: 85, last: 85 } };

        function buildShape(name, rgb) {
            var L = shapeLayer(comp, name);
            var gi = newGroup(L, "Wipe");
            if (o.shape === "triangle") { addStar(L, gi, 2, 3, R * 2.1, 0, 0); }
            else { addEllipse(L, gi, R * 2, R * 2); }
            addFill(L, gi, rgb, 100);
            setXY(L.transform.position, org[0], org[1]);
            return L;
        }

        function animateShape(L, t0) {
            setKeys(L.transform.scale, [[t0, [0, 0]], [t0 + d, [100, 100]]], ease);
            if (o.shape === "triangle") { setKeys(L.transform.rotation, [[t0, -40], [t0 + d, 0]], ease); }
            mb(L);
        }

        if (o.accent) {
            var acc = buildShape("MK Wipe Accent", col("primary"));
            animateShape(acc, cut);
            acc.inPoint = Math.max(0, cut);
            acc.outPoint = Math.min(comp.duration, cut + d + lead + fr);
            acc.moveAfter(inL);
        }
        var matte = buildShape("MK Wipe Matte", [1, 1, 1]);
        animateShape(matte, cut + lead);
        matte.inPoint = Math.max(0, cut);
        matte.outPoint = inL.outPoint;
        matte.moveBefore(inL);
        setMatte(inL, matte, "alpha");
        try { if (outL.outPoint < cut + d + lead) { outL.outPoint = cut + d + lead; } } catch (e) {}
    }

    // =====================================================================
    // TEXT GROUP
    // =====================================================================

    // Reveal (and optional hide) by character with opacity, position Y and blur.
    function textInOut(L, size, tIn, inDur, tOut, outDur) {
        var dy = size * 0.4;
        var a = addTextAnimator(L, "MK In", [
            ["ADBE Text Opacity", 0], ["ADBE Text Position 3D", [0, dy, 0]], ["ADBE Text Blur", [12, 12]]
        ], 1);
        setKeys(selectorAt(L, a).property("ADBE Text Percent Start"), [[tIn, 0], [tIn + inDur, 100]]);
        if (tOut !== null) {
            var b = addTextAnimator(L, "MK Out", [
                ["ADBE Text Opacity", 0], ["ADBE Text Position 3D", [0, -dy, 0]], ["ADBE Text Blur", [12, 12]]
            ], 1);
            var sel = selectorAt(L, b);
            sel.property("ADBE Text Percent Start").setValue(0);
            setKeys(sel.property("ADBE Text Percent End"), [[tOut - outDur, 0], [tOut, 100]]);
        }
    }

    function gradientRamp(L, t, c1, c2, blend) {
        var r = L.sourceRectAtTime(t, false), o = fxPointOffset(L);
        var e = fxAdd(L, "ADBE Ramp");
        fxSet(e, 1, [r.left + o[0], r.top + o[1]]);
        fxSet(e, 2, c4(c1));
        fxSet(e, 3, [r.left + r.width + o[0], r.top + r.height + o[1]]);
        fxSet(e, 4, c4(c2));
        fxSet(e, 7, blend || 0);
    }

    function doWordSwap(o) {
        var comp = activeComp(); if (!comp) { return; }
        if (o.words.length === 0) { alert("Type at least one swap word (comma separated).", NAME); return; }
        var t = comp.time, W = comp.width, H = comp.height, size = o.size, fr = comp.frameDuration;
        var font = pickFont(false), cy = H / 2, gap = size * 0.28;
        var inDur = 0.45, outDur = 0.35, hold = o.hold;

        var A = makeText(comp, o.start, { size: size, color: col("textDark"), font: font, just: "left" });
        A.name = "MK Swap · Start";
        var wA = textWidth(A, t);

        var words = [], maxW = 0, i;
        for (i = 0; i < o.words.length; i++) {
            var w = makeText(comp, o.words[i], { size: size, color: col("textDark"), font: pickFont(true), just: "left" });
            w.name = "MK Swap · " + o.words[i];
            maxW = Math.max(maxW, textWidth(w, t));
            words.push(w);
        }

        var p = makePill(comp, { label: o.pill, size: size * 0.5, fill: col("primary"), textColor: [1, 1, 1] });
        var total = wA + gap + p.w + gap + maxW;
        var x0 = (W - total) / 2;
        var wordsX0 = x0 + wA + gap, wordsX1 = wordsX0 + p.w + gap;

        anchorTo(A, "left", t);
        setXY(A.transform.position, x0, cy);
        textInOut(A, size, t, inDur, null, 0);
        mb(A);

        setXY(p.pill.transform.position, x0 + wA + gap + p.w / 2, cy);
        var tPill = t + hold * 0.6;
        ensureBounce(p.pill);
        setKeys(p.pill.transform.scale, [[tPill, [0, 0]], [tPill + 0.5, [100, 100]]], { bounce: true, clamp: true });

        var nul = addNull(comp, "MK Swap · Words", [wordsX0, cy]);
        for (i = 0; i < words.length; i++) {
            var L = words[i];
            anchorTo(L, "left", t);
            setXY(L.transform.position, wordsX0, cy);
            L.parent = nul;
            var tw = t + i * hold, last = (i === words.length - 1);
            L.inPoint = Math.max(0, tw);
            if (!last) { L.outPoint = tw + hold + fr; }
            textInOut(L, size, tw, inDur, last ? null : tw + hold, outDur);
            mb(L);
        }
        setKeys(nul.transform.position, [[tPill, [wordsX0, cy]], [tPill + 0.5, [wordsX1, cy]]]);

        if (o.fade && newTrackMatteAPI(A)) {
            var m = addSolid(comp, [1, 1, 1], "MK Swap · Fade Matte");
            var e = fxAdd(m, "ADBE Ramp");
            fxSet(e, 1, [wordsX0 + maxW * 0.55, cy]);
            fxSet(e, 2, [1, 1, 1, 1]);
            fxSet(e, 3, [wordsX0 + maxW + size * 0.35, cy]);
            fxSet(e, 4, [0, 0, 0, 1]);
            m.parent = nul;
            for (i = 0; i < words.length; i++) { setMatte(words[i], m, "luma"); }
        }
    }

    function doTypingPrompt(o) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time, W = comp.width, H = comp.height, d = animDur(comp), id = stamp(comp);
        var bw = o.width, bh = 120, cx = W / 2, cy = H / 2, size = 44;

        var box = shapeLayer(comp, "MK Prompt Box " + id);
        var g1 = newGroup(box, "Inner Stroke");
        addRect(box, g1, bw - 6, bh - 6, (bh - 6) / 2);
        addStroke(box, g1, [1, 1, 1], 2, 70);
        var g2 = newGroup(box, "Glass");
        addRect(box, g2, bw, bh, bh / 2);
        addFill(box, g2, [1, 1, 1], 72);
        softShadow(box);
        setXY(box.transform.position, cx, cy);
        makeFrosted(comp, box, 30);

        var txtName = "MK Prompt Text " + id;
        var txt = makeText(comp, o.text, { size: size, color: col("textDark"), font: pickFont(false), just: "left" });
        txt.name = txtName;
        anchorTo(txt, "left", t);
        setXY(txt.transform.position, cx - bw / 2 + 52, cy);
        var delay = d + 0.2, cps = o.cps, typeEnd = delay + o.text.length / cps;
        txt.property("ADBE Text Properties").property("ADBE Text Document").expression =
            "var s = String(value);\n" +
            "var n = Math.floor(Math.max(0, time - inPoint - " + delay + ") * " + cps + ");\n" +
            "s.substr(0, n);";
        txt.inPoint = Math.max(0, t);

        var caret = shapeLayer(comp, "MK Prompt Caret " + id);
        var gc = newGroup(caret, "Caret");
        addRect(caret, gc, 3, size * 1.15, 1.5);
        addFill(caret, gc, col("primary"), 100);
        caret.transform.position.expression =
            "var L = thisComp.layer(\"" + esc(txtName) + "\");\n" +
            "var r = L.sourceRectAtTime(time, false);\n" +
            "var a = L.toComp(L.transform.anchorPoint);\n" +
            "var x = (r.width > 0) ? L.toComp([r.left + r.width, 0])[0] + 6 : a[0] + 2;\n" +
            "[x, a[1]];";
        caret.transform.opacity.expression =
            "var L = thisComp.layer(\"" + esc(txtName) + "\");\n" +
            "var t0 = L.inPoint + " + delay + ", t1 = L.inPoint + " + typeEnd + ";\n" +
            "(time > t0 && time < t1) ? 100 : (Math.floor(time * 2.2) % 2 == 0 ? 100 : 0);";
        caret.inPoint = Math.max(0, t);

        var send = shapeLayer(comp, "MK Prompt Send " + id);
        var gA = newGroup(send, "Arrow");
        addStar(send, gA, 2, 3, 15, 0, 90, [2, 0]);
        addFill(send, gA, [1, 1, 1], 100);
        var gB = newGroup(send, "Circle");
        addEllipse(send, gB, 68, 68);
        addFill(send, gB, col("primary"), 100);
        setXY(send.transform.position, cx + bw / 2 - 64, cy);
        ensureBounce(send);
        var ts = t + typeEnd;
        setKeys(send.transform.scale, [[ts, [0, 0]], [ts + d, [100, 100]]], { bounce: true, clamp: true });

        var nul = addNull(comp, "MK Prompt " + id, [cx, cy]);
        box.parent = nul; txt.parent = nul; send.parent = nul;
        var matte = comp.layer(box.index + 1);
        if (/glass matte/.test(matte.name)) { matte.parent = nul; }
        setKeys(nul.transform.scale, [[t, [92, 92]], [t + d, [100, 100]]]);
        setKeys(box.transform.opacity, [[t, 0], [t + d * 0.6, 100]]);
        mb(box); mb(send);
    }

    function doKaraoke(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select a text layer."); if (!sel) { return; }
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) { karaokeOn(comp, sel[i], o); }
        }
    }

    function karaokeOn(comp, L, o) {
        var t = comp.time;
        try {
            var sp = textDocProp(L), d = sp.value;
            d.fillColor = col("textGray");
            sp.setValue(d);
        } catch (e) {}
        var basedOn = (o.markers || o.words) ? 3 : 1;
        var a = addTextAnimator(L, "MK Highlight", [["ADBE Text Fill Color", c4(col("primary"))]], basedOn);
        var end = selectorAt(L, a).property("ADBE Text Percent End");
        if (o.markers) {
            var txt = String(textDocProp(L).value.text);
            var units = splitList(txt.replace(/\s+/g, ",")).length || 1;
            end.expression =
                "var m = thisLayer.marker, n = m.numKeys, units = " + units + ", out = 0;\n" +
                "if (n > 0) {\n" +
                "  var i = 0;\n" +
                "  for (var k = 1; k <= n; k++) { if (time >= m.key(k).time) { i = k; } }\n" +
                "  if (i > 0) {\n" +
                "    var t0 = m.key(i).time;\n" +
                "    var t1 = (i < n) ? m.key(i + 1).time : t0 + 0.4;\n" +
                "    var f = linear(time, t0, Math.min(t1, t0 + 0.35), 0, 1);\n" +
                "    out = Math.min(units, (i - 1) + f) / units * 100;\n" +
                "  }\n" +
                "}\n" +
                "out;";
        } else {
            setKeys(end, [[t, 0], [t + o.dur, 100]], { linear: true });
        }
        if (o.gradient) { gradientRamp(L, t, col("primary"), col("gradEnd"), 55); }
    }

    function doKineticText(text, o) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time;
        var L = makeText(comp, text, { size: 100, color: col("textGray"), font: pickFont(true), just: "center" });
        L.name = "MK Kinetic · " + text.substr(0, 24);
        var w = textWidth(L, t) || 1;
        setTextSize(L, Math.min(420, Math.round(100 * comp.width * 0.86 / w)));
        anchorTo(L, "center", t);
        setXY(L.transform.position, comp.width / 2, comp.height / 2);
        karaokeOn(comp, L, o);
        mb(L);
    }

    function doTitleCard(word) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time, d = Math.max(animDur(comp), 0.5);
        var sel = comp.selectedLayers, L = null;
        if (sel.length > 0 && sel[0] instanceof TextLayer) {
            L = sel[0];
        } else {
            if (trim(word) === "") { alert("Type a word or select a text layer.", NAME); return; }
            L = makeText(comp, word, { size: 100, color: [1, 1, 1], font: pickFont(true), just: "center" });
            L.name = "MK Title · " + word;
            var w = textWidth(L, t) || 1;
            setTextSize(L, Math.min(320, Math.round(100 * comp.width * 0.6 / w)));
            anchorTo(L, "center", t);
            setXY(L.transform.position, comp.width / 2, comp.height / 2);
        }
        ensureBounce(L);
        gradientRamp(L, t, col("gradStart"), col("gradEnd"), 0);
        var s = L.transform.scale.valueAtTime(t, false);
        setKeys(L.transform.scale, [[t, scaled(s, 0.8)], [t + d, s]], { bounce: true });
        setKeys(L.transform.opacity, [[t, 0], [t + d * 0.5, 100]]);
        mb(L);
    }

    function doGlowStreak(word, o) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time, sel = comp.selectedLayers, L = null;
        if (sel.length > 0 && sel[0] instanceof TextLayer) {
            L = sel[0];
        } else {
            if (trim(word) === "") { alert("Type a word or select a text layer.", NAME); return; }
            L = makeText(comp, word, { size: 100, color: [1, 1, 1], font: pickFont(true), just: "center" });
            L.name = "MK Glow Title · " + word;
            var w = textWidth(L, t) || 1;
            setTextSize(L, Math.min(260, Math.round(100 * comp.width * 0.6 / w)));
            anchorTo(L, "center", t);
            setXY(L.transform.position, comp.width / 2, comp.height / 2);
        }
        if (o.bg) {
            var bg = addSolid(comp, col("primary"), "MK Glow Title BG");
            bg.moveAfter(L);
        }
        if (o.method === "rays") {
            var r = L.sourceRectAtTime(t, false), po = fxPointOffset(L);
            var lr = fxAdd(L, "CC Light Rays");
            fxSet(lr, 1, 60);
            fxSet(lr, 2, [r.left + r.width / 2 + po[0], r.top + r.height / 2 + po[1]]);
            fxSet(lr, 3, 50);
        } else {
            var dup = L.duplicate();
            dup.name = L.name + " · streaks";
            clearEffects(dup);
            var db = fxAdd(dup, "ADBE Motion Blur");
            fxSet(db, 1, o.vertical ? 0 : 90);
            fxSet(db, 2, 160);
            dup.blendingMode = BlendingMode.ADD;
            dup.transform.opacity.setValue(85);
        }
        var g = fxAdd(L, o.deepGlow ? ["Deep Glow", "ADBE Glo2"] : ["ADBE Glo2"]);
        if (g && g.matchName === "ADBE Glo2") {
            fxSet(g, 3, 60);
            fxSet(g, 4, 1.2);
        }
    }
