
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
        setXY(nul.transform.anchorPoint, 0, 0);
        setXY(nul.transform.position, 0, 0);

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
            setKeys(pp, [[t0, vecLike(pp, from.centers[i], cy)], [t0 + TI.posDur, vecLike(pp, to.centers[i], cy)]]);
            easeBetweenKeys(pp, t0, t0 + TI.posDur, TI.posCurve);
            setKeys(sp, [[t0, [TI.scaleFrom, TI.scaleFrom]], [t0 + TI.sclDur, [100, 100]]]);
            easeBetweenKeys(sp, t0, t0 + TI.sclDur, TI.sclCurve);
            if (o.highlight) { tiHighlight(W, t0 + i * o.step, o.step, i === n - 1); }
        }

        // icon: placed in its slot at rest size; no animation (the user animates it)
        var iconSize = TI.iconH * h * o.iconPct / 100, icon;
        icon = o.iconFile ? tiIconFromFile(comp, o.iconFile, iconSize) : tiSparkleLayer(comp, iconSize, o.iconColor);
        icon.parent = nul;
        setXY(icon.transform.position, to.iconX, cy);

        var all = layers.concat([icon, nul]);
        for (i = 0; i < all.length; i++) {
            try { all[i].inPoint = Math.max(0, t0); all[i].outPoint = Math.min(comp.duration, t0 + o.length); } catch (e1) {}
            all[i].selected = false;
        }
        icon.selected = true;
    }
