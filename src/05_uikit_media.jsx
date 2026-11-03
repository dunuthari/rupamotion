
    // =====================================================================
    // UI KIT GROUP
    // =====================================================================

    function doPillButton(o) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time, d = animDur(comp), p;
        if (o.kind === 1) {
            p = makePill(comp, { label: o.label, size: 44, fill: [1, 1, 1], fillOpacity: 70, textColor: col("textDark") });
            makeFrosted(comp, p.pill, 30);
        } else if (o.kind === 2) {
            p = makePill(comp, { label: o.label, size: 44, fill: [1, 1, 1], textColor: col("primary"), stroke: col("primary") });
        } else {
            p = makePill(comp, { label: o.label, size: 44, fill: col("primary"), textColor: [1, 1, 1] });
        }
        if (o.pop) {
            ensureBounce(p.pill);
            setKeys(p.pill.transform.scale, [[t, [0, 0]], [t + d, [100, 100]]], { bounce: true, clamp: true });
        }
    }

    function doFrost(radius) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the shape layers (pills, cards) to turn into frosted glass."); if (!sel) { return; }
        for (var i = 0; i < sel.length; i++) { makeFrosted(comp, sel[i], radius); }
    }

    function doAiButton(label) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time, d = animDur(comp);
        var sparkW = 44, size = 44;
        var p = makePill(comp, { label: label, size: size, fill: col("primary"), textColor: [1, 1, 1], extraLeft: sparkW + 14 });
        var pos = p.pill.transform.position.value;

        var sp = shapeLayer(comp, "Ru Sparkle");
        var gs = newGroup(sp, "Sparkle");
        addStar(sp, gs, 1, 4, 22, 6, 0);
        addFill(sp, gs, [1, 1, 1], 100);
        setXY(sp.transform.position, pos[0], pos[1]);
        sp.parent = p.pill;
        setXY(sp.transform.position, -p.w / 2 + size * 0.9 + sparkW / 2, 0);
        setKeys(sp.transform.scale, [[t, [85, 85]], [t + 0.6, [118, 118]]], { curve: CURVES.smooth });
        sp.transform.scale.expression = "loopOut(\"pingpong\");";
        setKeys(sp.transform.rotation, [[t, 0], [t + 0.6, 45]], { curve: CURVES.smooth });
        sp.transform.rotation.expression = "loopOut(\"pingpong\");";
        sp.moveBefore(p.text);

        var bloom = p.pill.duplicate();
        bloom.name = "Ru Bloom · " + label;
        clearEffects(bloom);
        var gb = fxAdd(bloom, "ADBE Gaussian Blur 2");
        fxSet(gb, 1, 80);
        bloom.transform.opacity.expression = "60 + Math.sin(time * 2 * Math.PI * 0.5) * 20;";
        bloom.moveAfter(p.pill);

        var nul = addNull(comp, "Ru AI Button · " + label, [pos[0], pos[1]]);
        p.pill.parent = nul;
        bloom.parent = nul;
        setKeys(nul.transform.scale, [[t, [0, 0]], [t + d * 0.6, [108, 108]], [t + d, [100, 100]]]);
        nul.transform.scale.expression = "var w = wiggle(0.8, 1.5)[0] - value[0];\n[value[0] + w, value[1] + w];";
    }

    // ---- fake cursor ----

    function findCursor(comp) {
        var sel = comp.selectedLayers;
        if (sel.length > 0) { return sel[0]; }
        for (var i = 1; i <= comp.numLayers; i++) { if (/^Ru Cursor/.test(comp.layer(i).name)) { return comp.layer(i); } }
        return null;
    }

    function doAddCursor() {
        var comp = activeComp(); if (!comp) { return; }
        var L = shapeLayer(comp, "Ru Cursor");
        var gi = newGroup(L, "Pointer");
        var v = [[0, 0], [0, 36], [9, 28], [15, 42], [21, 39], [15, 26], [27, 26]];
        var z = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
        addPathVec(L, gi, makeShape(v, z, z, true));
        addStroke(L, gi, col("textDark"), 2.5, 100);
        addFill(L, gi, [1, 1, 1], 100);
        softShadow(L);
        L.transform.scale.setValue([150, 150]);
        L.transform.position.setValueAtTime(comp.time, vecLike(L.transform.position, comp.width / 2, comp.height / 2));
        mb(L);
        alert("Cursor added with a position keyframe.\nMove the playhead, drag the cursor to its next spot (AE adds keys), then click \"Smooth moves\".", NAME);
    }

    function doCursorClick() {
        var comp = activeComp(); if (!comp) { return; }
        var L = findCursor(comp);
        if (!L) { alert("Select the cursor layer (or add one first).", NAME); return; }
        var t = comp.time, fr = comp.frameDuration;
        var s = L.transform.scale.valueAtTime(t, false);
        setKeys(L.transform.scale, [[t, s], [t + 3 * fr, scaled(s, 0.85)], [t + 9 * fr, s]], { curve: CURVES.apple });
        var p = L.transform.position.valueAtTime(t, false);
        var ring = shapeLayer(comp, "Ru Click Ripple");
        var gi = newGroup(ring, "Ring");
        addEllipse(ring, gi, 40, 40);
        addStroke(ring, gi, col("primary"), 4, 100);
        setXY(ring.transform.position, p[0], p[1]);
        setKeys(ring.transform.scale, [[t, [20, 20]], [t + 15 * fr, [240, 240]]], { curve: CURVES.apple });
        setKeys(ring.transform.opacity, [[t, 100], [t + 15 * fr, 0]], { curve: CURVES.apple });
        ring.inPoint = Math.max(0, t);
        ring.outPoint = t + 16 * fr;
        ring.moveAfter(L);
    }

    function doSmoothCursor() {
        var comp = activeComp(); if (!comp) { return; }
        var L = findCursor(comp);
        if (!L) { alert("Select the cursor layer.", NAME); return; }
        var p = L.transform.position, c = curNow();
        for (var k = 1; k <= p.numKeys; k++) { easeKey(p, k, c.last, c.first); }
    }

    // ---- avatars ----

    function doAvatarBubble(D) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select one or more photo layers."); if (!sel) { return; }
        var t = comp.time, d = animDur(comp), n = sel.length, i;
        var step = D * 0.78, pad = D * 0.12, totalW = D + (n - 1) * step;
        var cx = comp.width / 2, cy = comp.height / 2;

        var pill = shapeLayer(comp, "Ru Avatar Pill");
        var g1 = newGroup(pill, "Inner Stroke");
        addRect(pill, g1, totalW + pad * 2 - 6, D + pad * 2 - 6, (D + pad * 2 - 6) / 2);
        addStroke(pill, g1, [1, 1, 1], 2, 45);
        var g2 = newGroup(pill, "Pill");
        addRect(pill, g2, totalW + pad * 2, D + pad * 2, (D + pad * 2) / 2);
        addFill(pill, g2, col("primary"), 100);
        softShadow(pill);
        setXY(pill.transform.position, cx, cy);

        var lowest = sel[0];
        for (i = 0; i < n; i++) {
            var L = sel[i];
            if (L.index > lowest.index) { lowest = L; }
            var r = L.sourceRectAtTime(t, false);
            var dia = Math.min(r.width, r.height) || 1;
            var c = [r.left + r.width / 2, r.top + r.height / 2];
            addMask(L, roundRectShape(c[0], c[1], dia, dia, dia / 2));
            setXY(L.transform.anchorPoint, c[0], c[1]);
            var s = D / dia * 100;
            L.transform.scale.setValue(L.threeDLayer ? [s, s, s] : [s, s]);
            setXY(L.transform.position, cx - totalW / 2 + D / 2 + i * step, cy);
            L.parent = pill;
        }
        pill.moveAfter(lowest);
        ensureBounce(pill);
        setKeys(pill.transform.scale, [[t, [0, 0]], [t + d, [100, 100]]], { bounce: true, clamp: true });
        mb(pill);
    }

    function doPress() {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layer to press (avatar pill, button…)."); if (!sel) { return; }
        var t = comp.time, fr = comp.frameDuration;
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i], s = L.transform.scale.valueAtTime(t, false);
            setKeys(L.transform.scale, [[t, s], [t + 3 * fr, scaled(s, 0.94)], [t + 9 * fr, s]], { curve: CURVES.apple });
            L.property("ADBE Marker").setValueAtTime(t + 9 * fr, new MarkerValue("Next scene"));
        }
    }

    // ---- audio waveform ----

    function doWaveform(o) {
        var comp = activeComp(); if (!comp) { return; }
        var ampName = null, i;
        if (o.fromAudio) {
            var sel = comp.selectedLayers;
            if (sel.length !== 1 || !sel[0].hasAudio) { alert("Select one layer that has audio (or switch Mode to Idle loop).", NAME); return; }
            var before = comp.numLayers;
            app.executeCommand(app.findMenuCommandId("Convert Audio to Keyframes"));
            if (comp.numLayers === before) { alert("After Effects couldn't convert the audio to keyframes.", NAME); return; }
            var amp = comp.layer(1);
            amp.name = "Ru Audio Amplitude " + stamp(comp);
            ampName = amp.name;
        }
        var N = o.bars, barW = 12, spacing = 20, minH = 12, maxH = o.maxH;
        var L = shapeLayer(comp, "Ru Waveform");
        for (i = 0; i < N; i++) {
            var x = (i - (N - 1) / 2) * spacing;
            var env = Math.exp(-Math.pow((i - (N - 1) / 2) / (N / 3), 2));
            var gi = newGroup(L, "Bar " + (i + 1));
            addRect(L, gi, barW, minH, barW / 2, [x, 0]);
            addFill(L, gi, col("primary"), 100);
            var expr;
            if (ampName) {
                expr = "var a = thisComp.layer(\"" + esc(ampName) + "\").effect(3)(1);\n" +
                    "var v = 0.55 + 0.45 * noise(time * 3 + " + (i * 0.9).toFixed(2) + ");\n" +
                    "var h = " + minH + " + linear(a, 0, 25, 0, " + (maxH - minH) + ") * v * " + env.toFixed(3) + ";\n" +
                    "[" + barW + ", h];";
            } else {
                expr = "var v = (noise(time * 2.5 + " + (i * 0.7).toFixed(2) + ") + 1) / 2;\n" +
                    "var h = " + minH + " + " + (maxH - minH) + " * v * " + env.toFixed(3) + ";\n" +
                    "[" + barW + ", h];";
            }
            grp(L, gi).property("ADBE Vectors Group").property(1).property("ADBE Vector Rect Size").expression = expr;
        }
        setXY(L.transform.position, comp.width / 2, comp.height / 2);
    }

    // ---- liquid glass ----

    function doLiquidGlass(label, depth) {
        var comp = activeComp(); if (!comp) { return; }
        var t = comp.time, d = animDur(comp), cx = comp.width / 2, cy = comp.height / 2;
        var size = 48;
        var txt = makeText(comp, label, { size: size, color: col("primary"), font: pickFont(true), just: "center" });
        txt.name = "Ru Glass Label · " + label;
        var tw = textWidth(txt, t), iconW = 34, gapI = 18;
        var w = Math.round(tw + iconW + gapI + 120), h = 112;

        function ring(name, ww, hh, fillOp, strokeOp) {
            var L = shapeLayer(comp, name);
            var g1 = newGroup(L, "Inner Stroke");
            addRect(L, g1, ww - 4, hh - 4, (hh - 4) / 2);
            addStroke(L, g1, [1, 1, 1], 2, strokeOp);
            var g2 = newGroup(L, "Glass");
            addRect(L, g2, ww, hh, hh / 2);
            addFill(L, g2, [1, 1, 1], fillOp);
            setXY(L.transform.position, cx, cy);
            return L;
        }

        var outer = ring("Ru Glass · Outer", w + 96, h + 96, 22, 55);
        softShadow(outer);
        makeFrosted(comp, outer, 36);
        var middle = ring("Ru Glass · Middle", w + 46, h + 46, 32, 65);
        var inner = ring("Ru Glass · Inner", w, h, 85, 90);
        softShadow(inner);

        var icon = shapeLayer(comp, "Ru Glass · Play Icon");
        var gi = newGroup(icon, "Play");
        addStar(icon, gi, 2, 3, iconW / 2, 0, 90);
        addFill(icon, gi, col("primary"), 100);
        var left = cx - (tw + iconW + gapI) / 2;
        setXY(icon.transform.position, left + iconW / 2, cy);
        anchorTo(txt, "center", t);
        setXY(txt.transform.position, left + iconW + gapI + tw / 2, cy);
        txt.moveBefore(icon);

        var nul = addNull(comp, "Ru Glass Button · " + label, [cx, cy]);
        var parts = [outer, middle, inner, icon, txt];
        var mt = comp.layer(outer.index + 1);
        if (/glass matte/.test(mt.name)) { parts.push(mt); }
        for (var i = 0; i < parts.length; i++) { parts[i].parent = nul; }

        setKeys(nul.transform.scale, [[t, [85, 85]], [t + d, [100, 100]]]);
        setKeys(nul.transform.scale, [[t + d + 0.1, [100, 100]], [t + d + 3, [105, 105]]], { curve: { first: 33, last: 33 } });
        setKeys(outer.transform.opacity, [[t, 0], [t + d * 0.6, 100]]);

        if (depth) {
            var z = [[outer, 160], [middle, 80], [inner, 0], [icon, -20], [txt, -20]];
            nul.threeDLayer = true;
            for (var k = 0; k < z.length; k++) {
                z[k][0].threeDLayer = true;
                var pv = z[k][0].transform.position.value;
                z[k][0].transform.position.setValue([pv[0], pv[1], z[k][1]]);
            }
            cameraPush(comp, t, 4, 140, 90);
        }
    }

    // =====================================================================
    // MEDIA GROUP — stock grid wall
    // =====================================================================

    function doStockGrid(o) {
        var comp = activeComp(); if (!comp) { return; }
        var items = [], sel = app.project.selection, i;
        for (i = 0; i < sel.length; i++) {
            var it = sel[i];
            if ((it instanceof FootageItem && it.width > 0) || (it instanceof CompItem && it !== comp)) { items.push(it); }
        }
        if (items.length === 0) { alert("Select clips or images in the Project panel first.", NAME); return; }

        var W = comp.width, H = comp.height, dur = comp.duration;
        var g = app.project.items.addComp("Ru Media Grid", W, H, comp.pixelAspect, dur, comp.frameRate);
        g.motionBlur = true;
        var cols = o.cols, gap = o.gap, gridW = W * 1.5;
        var cellW = (gridW - gap * (cols - 1)) / cols, cellH = cellW * 9 / 16;
        var travel = Math.abs(o.speed) * dur * 1.35;
        var rows = Math.min(40, Math.ceil((H * 1.8 + travel) / (cellH + gap)));
        var up = (o.dir === "up");

        var root = addNull(g, "Grid Root", [W / 2, H / 2]);
        var colNulls = [];
        for (var c = 0; c < cols; c++) { colNulls.push(addNull(g, "Grid Column " + (c + 1), [W / 2, H / 2])); }

        var k = 0;
        for (c = 0; c < cols; c++) {
            for (var r = 0; r < rows; r++) {
                var item = items[k % items.length]; k++;
                var L = g.layers.add(item);
                var fw = item.width, fh = item.height;
                var s = Math.max(cellW / fw, cellH / fh);
                setXY(L.transform.anchorPoint, fw / 2, fh / 2);
                L.transform.scale.setValue([s * 100, s * 100]);
                addMask(L, roundRectShape(fw / 2, fh / 2, cellW / s, cellH / s, o.radius / s));
                var x = W / 2 - gridW / 2 + c * (cellW + gap) + cellW / 2;
                var y = up ? (H / 2 - H * 0.9) + r * (cellH + gap) + cellH / 2
                           : (H / 2 + H * 0.9) - r * (cellH + gap) - cellH / 2;
                setXY(L.transform.position, x, y);
                var isVideo = (item instanceof CompItem) || (item instanceof FootageItem && !item.mainSource.isStill);
                if (isVideo && item.duration < dur) {
                    try {
                        L.timeRemapEnabled = true;
                        L.property("ADBE Time Remapping").expression = "loopOut(\"cycle\");";
                        L.outPoint = dur;
                    } catch (e) {}
                }
                try { if (L.hasAudio) { L.audioEnabled = false; } } catch (e2) {}
                L.parent = colNulls[c];
                mb(L);
            }
        }
        for (c = 0; c < cols; c++) {
            colNulls[c].parent = root;
            var sp = Math.abs(o.speed) * (1 + (c % 2) * 0.18) * (up ? -1 : 1);
            colNulls[c].transform.position.expression = "value + [0, " + sp.toFixed(2) + " * time];";
        }
        root.transform.rotation.setValue(o.tilt);

        var gl = comp.layers.add(g);
        gl.name = "Ru Media Grid";
        mb(gl);
    }
