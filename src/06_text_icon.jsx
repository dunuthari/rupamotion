
    // =====================================================================
    // TEXT GROUP — "Text + Icon": type a sentence, choose where the icon goes
    // =====================================================================
    // Every number below was measured from a reference clip ("feature ✦ requests", cut at 2.50 s):
    //   - the words start 5% smaller and 44% closer to the icon slot, then slide apart and grow (ease-out, ~1 s)
    //   - the gap around the icon ends at 3.03x the text height; the icon is 1.85x the text height at rest
    //   - the highlight moves word to word: white -> lavender -> magenta -> white
    // The icon is left still on purpose: the user animates it by hand.
    var TI = {
        slotH: 3.03,            // final gap (edge to edge) around the icon, in text heights
        slotStart: 0.56,        // starting gap as a fraction of the final gap
        iconH: 1.85,            // icon size at rest, in text heights
        spaceK: 0.3,            // normal space between words, in font sizes
        scaleFrom: 95,          // starting word scale, %
        posCurve: [0.05, 1.1, 0.95, 1], posDur: 0.8,
        sclCurve: [0.05, 1.0, 0.95, 1], sclDur: 1.3,
        hiIn: 0.1, hiToMagenta: 0.5, hiOut: 0.4
    };
    var TI_LAVENDER = [178 / 255, 130 / 255, 215 / 255];    // #B282D7
    var TI_MAGENTA = [193 / 255, 88 / 255, 190 / 255];      // #C158BE

    function tiWords(str) {
        var parts = trim(str).split(/\s+/), out = [];
        for (var i = 0; i < parts.length; i++) { if (parts[i] !== "") { out.push(parts[i]); } }
        return out;
    }

    // Labels for "where does the icon go": before the first word, between each pair, after the last
    function tiSlotLabels(words) {
        var out = [], n = words.length;
        for (var i = 0; i <= n; i++) {
            if (n === 0) { break; }
            if (i === 0) { out.push("Before \"" + words[0] + "\""); }
            else if (i === n) { out.push("After \"" + words[n - 1] + "\""); }
            else { out.push("Between \"" + words[i - 1] + "\" and \"" + words[i] + "\""); }
        }
        return out;
    }

    // Left-to-right layout. widths: word widths at 100%. Returns word centers and the icon slot center.
    function tiLayout(widths, iconIndex, scale, slotGap, space, cx, endGap) {
        var n = widths.length, tokens = [], i, total = 0;
        for (i = 0; i <= n; i++) {
            if (i === iconIndex) { tokens.push({ icon: true, w: (i === 0 || i === n) ? endGap : slotGap }); }
            if (i < n) { tokens.push({ icon: false, w: widths[i] * scale, k: i }); }
        }
        for (i = 0; i < tokens.length; i++) {
            total += tokens[i].w;
            // normal word space only between two words that touch
            if (i > 0 && !tokens[i].icon && !tokens[i - 1].icon) { total += space; }
        }
        var x = cx - total / 2, centers = [], iconX = cx;
        for (i = 0; i < tokens.length; i++) {
            if (i > 0 && !tokens[i].icon && !tokens[i - 1].icon) { x += space; }
            if (tokens[i].icon) { iconX = x + tokens[i].w / 2; } else { centers[tokens[i].k] = x + tokens[i].w / 2; }
            x += tokens[i].w;
        }
        return { centers: centers, iconX: iconX };
    }

    // Concave four-point sparkle. R = radius (tip distance from the center).
    function sparkleShape(R) {
        var o = [0.07 * R, 0.55 * R], inn = [-0.55 * R, -0.07 * R], v = [], it = [], ot = [], k;
        function rot(p, q) { for (var j = 0; j < q; j++) { p = [-p[1], p[0]]; } return p; }
        var tips = [[0, -R], [R, 0], [0, R], [-R, 0]];
        for (k = 0; k < 4; k++) { v.push(tips[k]); ot.push(rot(o, k)); it.push(rot(inn, k + 3)); }
        return makeShape(v, it, ot, true);
    }

    function tiSparkleLayer(comp, size, color) {
        var L = shapeLayer(comp, "MK Text+Icon · Icon");
        var gi = newGroup(L, "Sparkle");
        addPathVec(L, gi, sparkleShape(size / 2));
        addFill(L, gi, color, 100);
        return L;
    }

    function tiIconFromFile(comp, file, size) {
        var io = new ImportOptions(file);
        try { io.importAs = ImportAsType.FOOTAGE; } catch (e) {}
        var item = app.project.importFile(io);
        var L = comp.layers.add(item);
        L.name = "MK Text+Icon · Icon";
        var s = size / Math.max(item.width, item.height) * 100;
        L.transform.scale.setValue(L.threeDLayer ? [s, s, s] : [s, s]);
        return L;
    }

    // Word colour sweep: white -> lavender -> magenta -> white. The last word keeps the highlight.
    function tiHighlight(L, t, step, last) {
        function anims() { return L.property("ADBE Text Properties").property("ADBE Text Animators"); }
        anims().addProperty("ADBE Text Animator");
        var idx = anims().numProperties;
        function an() { return anims().property(idx); }
        an().name = "MK Highlight";
        an().property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
        if (an().property("ADBE Text Selectors").numProperties === 0) { an().property("ADBE Text Selectors").addProperty("ADBE Text Selector"); }
        var fill = an().property("ADBE Text Animator Properties").property("ADBE Text Fill Color");
        try { fill.setValue(c4(TI_MAGENTA)); } catch (e) { fill.setValue(TI_MAGENTA); }
        setKeys(fill, [[t + TI.hiIn, c4(TI_LAVENDER)], [t + TI.hiIn + TI.hiToMagenta, c4(TI_MAGENTA)]]);
        var amt = an().property("ADBE Text Selectors").property(1).property("ADBE Text Range Advanced").property("ADBE Text Selector Max Amount");
        var pairs = [[t, 0], [t + TI.hiIn, 100]];
        if (!last) { pairs.push([t + step - TI.hiOut, 100]); pairs.push([t + step, 0]); }
        setKeys(amt, pairs);
    }

    // o: sentence, iconIndex (0..n), iconFile (File or null), size, iconPct, gap (extra px around the icon), textColor, iconColor,
    //    length, highlight, step
    function doTextIcon(o) {
        var comp = activeComp(); if (!comp) { return; }
        var words = tiWords(o.sentence), n = words.length, i;
        if (n < 2 || n > 10) { alert("Type 2 to 6 words (up to 10 works).", NAME); return; }
        var idx = Math.max(0, Math.min(n, o.iconIndex));
        var t0 = comp.time, cx = comp.width / 2, cy = comp.height / 2, font = pickFont(true);

        var nul = comp.layers.addNull();
        nul.name = "MK Text+Icon · Move";
        // Anchor at the null's own centre, null sitting at the comp centre (so scaling/rotating it pivots on the middle of
        // the frame). The children are placed relative to it: local = comp position - (null position - null anchor).
        var nw = 100, nh = 100;
        try { nw = nul.source.width; nh = nul.source.height; } catch (eN) {}
        setXY(nul.transform.anchorPoint, nw / 2, nh / 2);
        setXY(nul.transform.position, cx, cy);
        var offX = cx - nw / 2, offY = cy - nh / 2;

        // words: one text layer each, measured at 100%
        var layers = [], widths = [], lefts = [], top = 0;
        for (i = 0; i < n; i++) {
            var L = makeText(comp, words[i], { size: o.size, color: o.textColor, font: font, just: "left" });
            L.name = "MK Text+Icon · " + words[i];
            var r = L.sourceRectAtTime(t0, false);
            widths.push(r.width);
            lefts.push(r.left);
            top = Math.min(top, r.top);          // text layers sit on y = 0 (the baseline); top is negative
            layers.push(L);
        }
        // Text height = ascender height, the same for every word. Using each word's own box would lift words with
        // descenders (y, g, p) a few pixels above the rest. One shared anchor keeps every baseline on one line.
        var h = -top, anchorY = top / 2;
        var space = o.size * TI.spaceK, slot1 = Math.max(0.3 * h, TI.slotH * h + o.gap), slot0 = TI.slotStart * slot1;
        var endGap = (slot1 + TI.iconH * h) / 2;
        var from = tiLayout(widths, idx, TI.scaleFrom / 100, slot0, space * TI.scaleFrom / 100, cx, (slot0 + TI.iconH * h * TI.scaleFrom / 100) / 2);
        var to = tiLayout(widths, idx, 1, slot1, space, cx, endGap);

        for (i = 0; i < n; i++) {
            var W = layers[i];
            setXY(W.transform.anchorPoint, lefts[i] + widths[i] / 2, anchorY);
            W.parent = nul;
            var pp = W.transform.position, sp = W.transform.scale;
            setKeys(pp, [[t0, vecLike(pp, from.centers[i] - offX, cy - offY)], [t0 + TI.posDur, vecLike(pp, to.centers[i] - offX, cy - offY)]]);
            easeBetweenKeys(pp, t0, t0 + TI.posDur, TI.posCurve);
            setKeys(sp, [[t0, [TI.scaleFrom, TI.scaleFrom]], [t0 + TI.sclDur, [100, 100]]]);
            easeBetweenKeys(sp, t0, t0 + TI.sclDur, TI.sclCurve);
            if (o.highlight) { tiHighlight(W, t0 + i * o.step, o.step, i === n - 1); }
        }

        // icon: placed in its slot at rest size; no animation (the user animates it)
        var iconSize = TI.iconH * h * o.iconPct / 100, icon;
        icon = o.iconFile ? tiIconFromFile(comp, o.iconFile, iconSize) : tiSparkleLayer(comp, iconSize, o.iconColor);
        icon.parent = nul;
        setXY(icon.transform.position, to.iconX - offX, cy - offY);

        var all = layers.concat([icon, nul]);
        for (i = 0; i < all.length; i++) {
            try { all[i].inPoint = Math.max(0, t0); all[i].outPoint = Math.min(comp.duration, t0 + o.length); } catch (e1) {}
            all[i].selected = false;
        }
        icon.selected = true;
        try { nul.moveToBeginning(); } catch (eT) {}      // the Move null sits on top of the stack
    }

    // =====================================================================
    // TEXT GROUP — "Star Swipe": an icon sweeps across sentence 1; sentence 2 appears in its wake
    // =====================================================================
    // Read from a reference clip: the star sits in front of sentence 1, then accelerates to the right. Everything behind it
    // (left of the star) is sentence 2, everything ahead of it is still sentence 1, with a soft edge and a glowing trail
    // that is strongest mid-flight. The star stops just past the end of the wider sentence; sentence 2 stays. Timings and the curve are estimates from
    // the clip (not measured to the frame), so they are plain fields / one constant: tune freely.
    var SS = { curve: [0.55, 0, 0.3, 1], dur: 0.8, hold: 0.4, trailK: 0.3, softness: 30 };

    // o: first, second, size, iconPct, iconFile, textColor, iconColor, trail (bool), trailColor, hold, dur, softness, spin (bool), length
    function doStarSwipe(o) {
        var comp = activeComp(); if (!comp) { return; }
        var s1 = trim(o.first), s2 = trim(o.second);
        if (s1 === "" || s2 === "") { alert("Type both sentences.", NAME); return; }
        var t0 = comp.time, cx = comp.width / 2, cy = comp.height / 2, font = pickFont(true), i;

        var texts = [], strs = [s1, s2], rects = [], top = 0;
        for (i = 0; i < 2; i++) {
            var T = makeText(comp, strs[i], { size: o.size, color: o.textColor, font: font, just: "left" });
            T.name = "MK Star Swipe · Sentence " + (i + 1);
            var r = T.sourceRectAtTime(t0, false);
            rects.push(r); top = Math.min(top, r.top); texts.push(T);
        }
        var h = -top, anchorY = top / 2;                      // one shared baseline for both sentences
        for (i = 0; i < 2; i++) {
            setXY(texts[i].transform.anchorPoint, rects[i].left + rects[i].width / 2, anchorY);
            setXY(texts[i].transform.position, cx, cy);
        }
        var iconSize = TI.iconH * h * o.iconPct / 100;
        // The star starts just before and stops just after whichever sentence is wider (it stays in the frame, it does not exit).
        // The gap is the star's half width plus a small margin, and never less than the wipe softness, so sentence 2 is fully
        // hidden at the start and sentence 1 is fully gone at the end.
        var half = Math.max(rects[0].width, rects[1].width) / 2;
        var gapX = Math.max(iconSize * 0.7, o.softness * 1.5);
        var x0 = cx - half - gapX;
        var x1 = cx + half + gapX;

        // the mover: its centre is the star's centre, so the wipe edge, the trail and the star all travel with it
        var nul = comp.layers.addNull();
        nul.name = "MK Star Swipe · Move";
        var nw = 100, nh = 100;
        try { nw = nul.source.width; nh = nul.source.height; } catch (eN) {}
        setXY(nul.transform.anchorPoint, nw / 2, nh / 2);
        setXY(nul.transform.position, x0, cy);
        var lx = nw / 2, ly = nh / 2;                                             // the star centre in the null's own space

        // soft-edged half-plane mattes: side -1 = everything left of the star (sentence 2), +1 = right of it (sentence 1)
        function edge(side) {
            var M = shapeLayer(comp, "MK Star Swipe · Reveal " + (side < 0 ? "2" : "1"));
            var gi = newGroup(M, "Reveal"), big = comp.width * 3;
            addRect(M, gi, big, comp.height * 2, 0, [side * big / 2, 0]);
            addFill(M, gi, [1, 1, 1], 100);
            fxSet(fxAdd(M, "ADBE Gaussian Blur 2"), 1, o.softness);
            M.parent = nul;
            setXY(M.transform.position, lx, ly);
            return M;
        }
        var mA = edge(-1), mB = edge(1);
        setMatte(texts[1], mA, "alpha");
        setMatte(texts[0], mB, "alpha");
        try { mA.enabled = false; mB.enabled = false; } catch (eM) {}

        var tA = t0 + o.hold, tB = tA + o.dur, trailL = null;
        if (o.trail) {
            var len = comp.width * SS.trailK;
            trailL = shapeLayer(comp, "MK Star Swipe · Trail");
            var gt = newGroup(trailL, "Trail");
            addRect(trailL, gt, len, h * 1.3, h * 0.65, [-len / 2 - iconSize * 0.1, 0]);
            addFill(trailL, gt, o.trailColor, 100);
            fxSet(fxAdd(trailL, "ADBE Gaussian Blur 2"), 1, h * 0.45);
            trailL.parent = nul;
            setXY(trailL.transform.position, lx, ly);
            setKeys(trailL.transform.opacity, [[t0, 0], [tA, 0], [tA + o.dur * 0.45, 100], [tB, 0]]);
        }

        var star = o.iconFile ? tiIconFromFile(comp, o.iconFile, iconSize) : tiSparkleLayer(comp, iconSize, o.iconColor);
        star.name = "MK Star Swipe · Star";
        star.parent = nul;
        setXY(star.transform.position, lx, ly);

        // keys go on last, once everything is linked (links are made while the mover is at rest)
        var pp = nul.transform.position;
        setKeys(pp, [[tA, vecLike(pp, x0, cy)], [tB, vecLike(pp, x1, cy)]]);
        easeBetweenKeys(pp, tA, tB, SS.curve);
        if (o.spin) {
            var rot = star.transform.rotation;
            setKeys(rot, [[tA, 0], [tB, 180]]);
            easeBetweenKeys(rot, tA, tB, SS.curve);
        }

        var all = texts.concat([mA, mB, star, nul]);
        if (trailL) { all.push(trailL); }
        for (i = 0; i < all.length; i++) {
            try { all[i].inPoint = Math.max(0, t0); all[i].outPoint = Math.min(comp.duration, t0 + o.length); } catch (e1) {}
            all[i].selected = false;
        }
        star.selected = true;
        try { nul.moveToBeginning(); } catch (eT) {}
    }
