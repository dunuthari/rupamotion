
    // =====================================================================
    // ANIMATION GROUP — Shape morph
    // =====================================================================

    var VN = {
        rect: "ADBE Vector Shape - Rect", rectSize: "ADBE Vector Rect Size", rectPos: "ADBE Vector Rect Position",
        rectRound: "ADBE Vector Rect Roundness", ellipse: "ADBE Vector Shape - Ellipse",
        ellipseSize: "ADBE Vector Ellipse Size", ellipsePos: "ADBE Vector Ellipse Position",
        path: "ADBE Vector Shape - Group", pathValue: "ADBE Vector Shape",
        fill: "ADBE Vector Graphic - Fill", fillColor: "ADBE Vector Fill Color"
    };

    function getChain(prop) {
        var chain = [], p = prop.parentProperty;
        while (p) {
            if (p.matchName === "ADBE Vector Group") { chain.push(p.property("ADBE Vector Transform Group")); }
            p = p.parentProperty;
        }
        return chain;
    }

    function readGroupTr(tr, t) {
        return {
            pos: tr.property("ADBE Vector Position").valueAtTime(t, false),
            anc: tr.property("ADBE Vector Anchor").valueAtTime(t, false),
            scl: tr.property("ADBE Vector Scale").valueAtTime(t, false)
        };
    }

    function readLayerTr(L, t) {
        return {
            pos: L.transform.position.valueAtTime(t, false),
            anc: L.transform.anchorPoint.valueAtTime(t, false),
            scl: L.transform.scale.valueAtTime(t, false)
        };
    }

    function fwd(pt, o) { return [(pt[0] - o.anc[0]) * o.scl[0] / 100 + o.pos[0], (pt[1] - o.anc[1]) * o.scl[1] / 100 + o.pos[1]]; }
    function inv(pt, o) { return [sd(pt[0] - o.pos[0], o.scl[0] / 100) + o.anc[0], sd(pt[1] - o.pos[1], o.scl[1] / 100) + o.anc[1]]; }

    function groupToLayer(pt, chain, t) { for (var i = 0; i < chain.length; i++) { pt = fwd(pt, readGroupTr(chain[i], t)); } return pt; }
    function layerToGroup(pt, chain, t) { for (var i = chain.length - 1; i >= 0; i--) { pt = inv(pt, readGroupTr(chain[i], t)); } return pt; }
    function layerToComp(pt, L, t) { return fwd(pt, readLayerTr(L, t)); }
    function compToLayer(pt, L, t) { return inv(pt, readLayerTr(L, t)); }

    function totalScale(chain, L, t) {
        var s = [1, 1];
        for (var i = 0; i < chain.length; i++) {
            var g = readGroupTr(chain[i], t).scl;
            s[0] *= g[0] / 100; s[1] *= g[1] / 100;
        }
        var l = readLayerTr(L, t).scl;
        s[0] *= l[0] / 100; s[1] *= l[1] / 100;
        return s;
    }

    function shapeCompBox(L, t) {
        var isShape = (L instanceof ShapeLayer), rect = isShape ? findFirst(contentsOf(L), VN.rect) : null, ell = (isShape && !rect) ? findFirst(contentsOf(L), VN.ellipse) : null;
        if (rect) {
            var chain = getChain(rect), ts = totalScale(chain, L, t);
            var c = rect.property(VN.rectPos).valueAtTime(t, false);
            var s = rect.property(VN.rectSize).valueAtTime(t, false);
            var r = rect.property(VN.rectRound).valueAtTime(t, false);
            return {
                center: layerToComp(groupToLayer(c, chain, t), L, t),
                size: [Math.abs(s[0] * ts[0]), Math.abs(s[1] * ts[1])],
                round: r * (Math.abs(ts[0]) + Math.abs(ts[1])) / 2
            };
        }
        if (ell) {                                    // an ellipse is a rounded rectangle with the largest roundness
            var chainE = getChain(ell), tsE = totalScale(chainE, L, t);
            var ce = ell.property(VN.ellipsePos).valueAtTime(t, false), se = ell.property(VN.ellipseSize).valueAtTime(t, false);
            var szE = [Math.abs(se[0] * tsE[0]), Math.abs(se[1] * tsE[1])];
            return { center: layerToComp(groupToLayer(ce, chainE, t), L, t), size: szE, round: Math.min(szE[0], szE[1]) / 2 };
        }
        var sr = L.sourceRectAtTime(t, false), ls = totalScale([], L, t);
        return {
            center: layerToComp([sr.left + sr.width / 2, sr.top + sr.height / 2], L, t),
            size: [Math.abs(sr.width * ls[0]), Math.abs(sr.height * ls[1])],
            round: null
        };
    }

    // ---------------------------------------------------------------------
    // The morph (timing and values measured from the user's reference morph, frame by frame at 25 fps; S = the playhead):
    //   Position   S, S+0.16 (pull-back: 5% back and 9.1% sideways), a roving key just past the start, S+0.64 (arrival, linear):
    //              the layer winds up, swoops under the straight line and arrives from the side; then it bounces.
    //   Scale      S+0.08, S+0.40 (80%), S+0.72 (back, linear) + bounce: it shrinks in flight and pops on landing.
    //   Rotation   S -> S+0.64: to the second layer's rotation.
    //   Transform effect "Ru Morph Transform": Scale Width / Height S -> S+0.64 (to the second layer's proportions, slow start),
    //              Rotation S+0.16, S+0.48 (18 degree lean), S+0.80 (0, linear) + bounce: it leans into the move and swings back.
    //   Opacity    the first layer shows until the arrival key, the second one from then on (both carry the same landing).
    // Bounce = value + speed at the last key * amp * sin(freq*t*2pi) / exp(decay*t); amp comes from the Amplitude slider
    // (position /2000, scale /200, rotation /300), decay = 5 / the Decay slider.
    // ---------------------------------------------------------------------
    var MORPH = { ant: 0.16, rove: 0.38, end: 0.64, back: 0.05, side: 0.091, past: 0.2, sc: [0.08, 0.40, 0.72], dip: 0.8,
                  rot: [0.16, 0.48, 0.80], lean: 18, amp: 100, freq: 1.5, decay: 1.0 };
    var MORPH_FX = { amp: "Ru Morph Amplitude", freq: "Ru Morph Frequency", decay: "Ru Morph Decay", tr: "Ru Morph Transform" };

    function morphBounceExpr(div) {
        return "// Ru Morph Bounce\n" +
            "var amp=effect(\"" + MORPH_FX.amp + "\")(\"Slider\")/" + div + ";\n" +
            "var freq=effect(\"" + MORPH_FX.freq + "\")(\"Slider\");\n" +
            "var dc=Math.max(0.01,effect(\"" + MORPH_FX.decay + "\")(\"Slider\"));\n" +
            "var decay=5/dc;\n" +
            "var n=0;\n" +
            "if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time){n--;}}\n" +
            "if(n>0){\n" +
            "var t=time-key(n).time;\n" +
            "var v=velocityAtTime(key(n).time-thisComp.frameDuration/10);\n" +
            "add(value,mul(v,amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t)));\n" +
            "}else{value;}";
    }

    function morphSlider(L, name, val) {
        var fx = L.property("ADBE Effect Parade"), e = null;
        try { e = fx.property(name); } catch (e0) {}
        if (!e) { e = fxAdd(L, "ADBE Slider Control"); if (e) { e.name = name; } }
        if (e) { try { e.property(1).setValue(val); } catch (e1) {} }
    }
    function ensureMorphController(L, o) {
        morphSlider(L, MORPH_FX.amp, o && o.amp !== undefined ? o.amp : MORPH.amp);
        morphSlider(L, MORPH_FX.freq, o && o.freq !== undefined ? o.freq : MORPH.freq);
        morphSlider(L, MORPH_FX.decay, o && o.decay !== undefined ? o.decay : MORPH.decay);
    }

    // keys with their own eases ([in influence, out influence] per key); the last key arrives linear
    function morphKeys(prop, pairs, eases, expr) {
        setKeys(prop, pairs, { eases: eases });
        try { prop.setInterpolationTypeAtKey(pairs.length, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e0) {}
        if (expr) { try { prop.expression = expr; } catch (e1) {} }
    }

    // shape and text layers are not `instanceof AVLayer` in After Effects (only footage, solids and pre-comps are), so check all three
    function isMorphLayer(L) { return (L instanceof ShapeLayer) || (L instanceof TextLayer) || (L instanceof AVLayer); }

    function morphVec(pos, x, y) { return (pos.length > 2) ? [x, y, pos[2]] : [x, y]; }
    function morphTan(pos, x, y) { return (pos.length > 2) ? [x, y, 0] : [x, y]; }

    // the Transform effect that carries the stretch and the lean (anchor and position follow the layer's anchor point)
    function morphTransformFx(L) {
        var fx = L.property("ADBE Effect Parade"), e = null, pt;
        try { e = fx.property(MORPH_FX.tr); } catch (e0) {}
        if (e) { try { e.remove(); } catch (e1) {} }
        e = fxAdd(L, "ADBE Geometry2");
        if (!e) { return null; }
        e.name = MORPH_FX.tr;
        pt = isVectorLayer(L) ? "thisLayer.toComp(transform.anchorPoint)" : "transform.anchorPoint";
        try { e.property(1).expression = "// Ru Morph\n" + pt; } catch (e2) {}
        try { e.property(2).expression = "// Ru Morph\n" + pt; } catch (e3) {}
        try { e.property(3).setValue(0); } catch (e4) {}                      // Uniform Scale off
        return e;
    }

    // one layer's part of the morph. posKeys: the four comp positions; ratio: [w, h] stretch at the arrival (null = none);
    // rot1: rotation at the arrival (null = keep); lean: degrees; show: "before" or "after" the arrival
    function morphLayerKeys(L, t, posKeys, tans, ratio, rot1, lean, show) {
        var T = [t, t + MORPH.ant, t + MORPH.rove, t + MORPH.end], pos = L.transform.position, sc = L.transform.scale.valueAtTime(t, false), e, r0, s2 = [], i;
        var tr = morphTransformFx(L);                                        // effects first: adding one can invalidate other references
        pos = L.transform.position;
        morphKeys(pos, [[T[0], posKeys[0]], [T[1], posKeys[1]], [T[2], posKeys[2]], [T[3], posKeys[3]]], [[33, 5], [90, 90], [33, 33], [33, 33]], morphBounceExpr(2000));
        try { pos.setSpatialTangentsAtKey(3, tans.in3, tans.out3); } catch (e0) {}
        try { pos.setSpatialTangentsAtKey(4, tans.in4, morphTan(posKeys[0], 0, 0)); } catch (e1) {}
        try { pos.setRovingAtKey(3, true); } catch (e2) {}
        for (i = 0; i < sc.length; i++) { s2.push(sc[i] * MORPH.dip); }
        morphKeys(L.transform.scale, [[t + MORPH.sc[0], sc], [t + MORPH.sc[1], s2], [t + MORPH.sc[2], sc]], [[33, 33], [33, 33], [33, 33]], morphBounceExpr(200));
        if (rot1 !== null) {
            r0 = L.transform.rotation.valueAtTime(t, false);
            if (Math.abs(rot1 - r0) > 0.01) { morphKeys(L.transform.rotation, [[T[0], r0], [T[3], rot1]], [[33, 33], [33, 33]], null); }
        }
        if (tr) {
            e = L.property("ADBE Effect Parade").property(MORPH_FX.tr);
            if (ratio) {
                morphKeys(e.property(4), [[T[0], 100], [T[3], ratio[1] * 100]], [[33, 95], [33, 33]], null);   // Scale Height
                morphKeys(e.property(5), [[T[0], 100], [T[3], ratio[0] * 100]], [[33, 95], [33, 33]], null);   // Scale Width
            }
            morphKeys(e.property(8), [[t + MORPH.rot[0], 0], [t + MORPH.rot[1], lean], [t + MORPH.rot[2], 0]], [[33, 33], [33, 33], [33, 33]], morphBounceExpr(300));
        }
        try {
            L.transform.opacity.expression = "// Ru Morph\nvar p=transform.position;\nvar on=(p.numKeys>=4)?(time" + (show === "before" ? "<" : ">=") + "p.key(4).time):true;\non?value:0";
        } catch (e3) {}
        mb(L);
    }

    function doMorph(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = comp.selectedLayers;
        if (sel.length !== 2 || !isMorphLayer(sel[0]) || !isMorphLayer(sel[1])) {
            alert("Select exactly 2 layers (shapes, pictures, footage, solids or text): the layer to morph and the layer it should become.", NAME);
            return;
        }
        var ls = [sel[0], sel[1]].sort(function (a, b) { return a.index - b.index; });
        var src = o.fromLower ? ls[1] : ls[0], tgt = o.fromLower ? ls[0] : ls[1];
        var t = comp.time, bA = shapeCompBox(src, t), bB = shapeCompBox(tgt, t), pA = src.transform.position.valueAtTime(t, false), pB = tgt.transform.position.valueAtTime(t, false);
        var dx = bB.center[0] - bA.center[0], dy = bB.center[1] - bA.center[1], D = Math.sqrt(dx * dx + dy * dy), ux, uy, nx, ny, ax, ay, L3, out3, in4, tans, keysA, keysB, ox, oy, lean, ratio;
        if (D < 1) { ux = 1; uy = 0; D = 0; } else { ux = dx / D; uy = dy / D; }
        nx = uy; ny = -ux;                                                    // the side the wind-up goes to (up when moving right)
        ax = (-MORPH.back * ux + MORPH.side * nx) * D; ay = (-MORPH.back * uy + MORPH.side * ny) * D;
        L3 = D / 3;
        out3 = [(0.65 * ux - 0.76 * nx) * L3, (0.65 * uy - 0.76 * ny) * L3];
        in4 = [-(0.47 * ux + 0.88 * nx) * L3, -(0.47 * uy + 0.88 * ny) * L3];
        tans = { in3: morphTan(pA, -out3[0] * 0.15, -out3[1] * 0.15), out3: morphTan(pA, out3[0], out3[1]), in4: morphTan(pA, in4[0], in4[1]) };
        keysA = [pA, morphVec(pA, pA[0] + ax, pA[1] + ay), morphVec(pA, pA[0] - ax * MORPH.past, pA[1] - ay * MORPH.past), morphVec(pA, pA[0] + dx, pA[1] + dy)];
        ox = pB[0] - keysA[3][0]; oy = pB[1] - keysA[3][1];                   // the second layer flies the same path, shifted onto its own position
        keysB = [morphVec(pB, keysA[0][0] + ox, keysA[0][1] + oy), morphVec(pB, keysA[1][0] + ox, keysA[1][1] + oy), morphVec(pB, keysA[2][0] + ox, keysA[2][1] + oy), pB];
        lean = MORPH.lean * (dx < 0 ? -1 : 1);
        ratio = [sd(bB.size[0], bA.size[0]), sd(bB.size[1], bA.size[1])];
        if (!(ratio[0] > 0)) { ratio[0] = 1; }
        if (!(ratio[1] > 0)) { ratio[1] = 1; }

        ensureMorphController(src, o);
        ensureMorphController(tgt, o);
        morphLayerKeys(src, t, keysA, tans, ratio, tgt.transform.rotation.valueAtTime(t, false), lean, "before");
        morphLayerKeys(tgt, t, keysB, { in3: morphTan(pB, tans.in3[0], tans.in3[1]), out3: morphTan(pB, tans.out3[0], tans.out3[1]), in4: morphTan(pB, tans.in4[0], tans.in4[1]) }, null, null, lean, "after");

        if (o.precomp) {
            var n = 1;
            for (var i = 1; i <= app.project.numItems; i++) {
                var m = /^Ru Shape Morph (\d+)$/.exec(app.project.item(i).name);
                if (m) { n = Math.max(n, parseInt(m[1], 10) + 1); }
            }
            var nc = comp.layers.precompose([src.index, tgt.index], "Ru Shape Morph " + n, true);
            for (var j = 1; j <= comp.numLayers; j++) { comp.layer(j).selected = (comp.layer(j).source === nc); }
        }
    }

    // =====================================================================
    // ANIMATION GROUP — Pop, Move, List stagger, Hold push-in
    // =====================================================================

    // cubic-bezier for the old Pop Out (Quick actions): handles (0.45, -0.45) and (0.25, 1)
    var POP_OUT_CURVE = [0.45, -0.45, 0.25, 1];

    // Curves for the smooth-bounce pops. The bounce expression works from the speed at each keyframe, so unlike
    // an ease to zero these arrive / leave with real speed:
    //   up:  starts gently, arrives fast (about 1.8x the average speed) -> a clear, speed-matched overshoot
    //   out: leaves at about the average speed (the expression winds up first), then lands softly on zero
    var POP_UP_CURVE = [0.4, 0.2, 0.75, 0.55];
    var POP_OUT_SMOOTH = [0.3, 0.36, 0.6, 1];

    // "Smooth Bounce In + Out": overshoot where motion stops, wind-up where motion starts (speed-matched).
    // Edit freq / decay / amp in the expression to taste. clampZero keeps Scale from going negative.
    function smoothBounceExpr(clampZero) {
        var L = [];
        L.push("// Motion Kit smooth bounce in + out (Animation > Pop). Edit freq / decay / amp to taste.");
        L.push("freq     = 2.5;   // bounces per second");
        L.push("decay    = 5.0;   // how fast the bounce settles");
        L.push("amp      = 1.0;   // 1.0 = smoothest (speed-matched). Lower = softer, higher = bouncier");
        L.push("fadeTime = 0.2;   // seconds to fade a bounce before the next key");
        L.push("clampZero = " + (clampZero ? "true" : "false") + "; // true for Scale/Opacity, false for Position/Rotation");
        L.push("");
        L.push("w   = 2 * Math.PI * freq;");
        L.push("eps = thisComp.frameDuration / 10;");
        L.push("");
        L.push("function mag(v){ return (v instanceof Array) ? length(v) : Math.abs(v); }");
        L.push("function clamp0(v){");
        L.push("  if (v instanceof Array){");
        L.push("    var r = [];");
        L.push("    for (var i = 0; i < v.length; i++) r[i] = Math.max(0, v[i]);");
        L.push("    return r;");
        L.push("  }");
        L.push("  return Math.max(0, v);");
        L.push("}");
        L.push("");
        L.push("result = value;");
        L.push("");
        L.push("if (numKeys > 1){");
        L.push("  n = nearestKey(time).index;");
        L.push("  if (key(n).time > time) n--;");
        L.push("");
        L.push("  // ---- OUT: smooth overshoot where motion STOPS ----");
        L.push("  if (n > 0){");
        L.push("    vIn  = velocityAtTime(key(n).time - eps);");
        L.push("    vAft = velocityAtTime(key(n).time + eps);");
        L.push("    if (mag(vIn) > 0.01 && mag(vAft) < 0.01 && mag(key(n).value) > 0.001){");
        L.push("      t = time - key(n).time;");
        L.push("      k = amp * Math.sin(w * t) / w * Math.exp(-decay * t);");
        L.push("      if (n < numKeys){");
        L.push("        seg = key(n + 1).time - key(n).time;");
        L.push("        f   = Math.min(fadeTime, seg / 2);");
        L.push("        k  *= ease(time, key(n + 1).time - f, key(n + 1).time, 1, 0);");
        L.push("      }");
        L.push("      result = add(result, mul(vIn, k));");
        L.push("    }");
        L.push("  }");
        L.push("");
        L.push("  // ---- IN: smooth wind-up where motion STARTS ----");
        L.push("  m = n + 1;");
        L.push("  if (m <= numKeys){");
        L.push("    vPrev = velocityAtTime(key(m).time - eps);");
        L.push("    vOut  = velocityAtTime(key(m).time + eps);");
        L.push("    if (mag(vPrev) < 0.01 && mag(vOut) > 0.01){");
        L.push("      t2 = key(m).time - time;");
        L.push("      k2 = amp * Math.sin(w * t2) / w * Math.exp(-decay * t2);");
        L.push("      if (n > 0){");
        L.push("        seg2 = key(m).time - key(n).time;");
        L.push("        f2   = Math.min(fadeTime, seg2 / 2);");
        L.push("        k2  *= ease(time, key(n).time, key(n).time + f2, 0, 1);");
        L.push("      }");
        L.push("      result = sub(result, mul(vOut, k2));");
        L.push("    }");
        L.push("  }");
        L.push("}");
        L.push("");
        L.push("clampZero ? clamp0(result) : result;");
        return L.join("\n");
    }

    // Puts the smooth bounce on a property unless it already has an expression of the user's
    function applySmoothBounce(prop, clampZero) {
        var ex = "";
        try { ex = prop.expression; } catch (e0) { return; }
        if (ex !== "" && ex.indexOf("Motion Kit") < 0) { return; }
        try { prop.expression = smoothBounceExpr(clampZero); } catch (e1) {}
    }

    function doPop(mode, o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select at least one layer."); if (!sel) { return; }
        var fr = comp.frameDuration, d = animDur(comp);
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i];
            if (L instanceof CameraLayer || L instanceof LightLayer) { continue; }
            var t = comp.time + i * o.stagger * fr;
            if (mode === "up" && !o.smooth) { ensureBounce(L); }
            // center: true = always re-center; "auto" = respect a hand-placed anchor and only
            // center a text layer that still has its default anchor (baseline-left, at 0,0)
            var recenter = (o.center === "auto") ? ((L instanceof TextLayer) && allZero(L.transform.anchorPoint.value)) : o.center;
            if (recenter) { anchorTo(L, "center", t); }
            var sp = L.transform.scale, base = sp.valueAtTime(t, false);
            if (mode === "up" && allZero(base)) { base = scaled(base, 0); for (var k = 0; k < base.length; k++) { base[k] = 100; } }
            if (o.smooth) {
                // keys that arrive / leave with speed, then the smooth bounce expression does the springing
                var up = (mode === "up");
                setKeys(sp, [[t, up ? scaled(base, 0) : base], [t + d, up ? base : scaled(base, 0)]]);
                easeBetweenKeys(sp, t, t + d, up ? POP_UP_CURVE : POP_OUT_SMOOTH);
                applySmoothBounce(sp, true);
            } else if (mode === "up") {
                setKeys(sp, [[t, scaled(base, 0)], [t + d, base]], { bounce: true, clamp: true });
            } else {
                // One continuous curve instead of three keys: a small anticipation (~9% up), a sweep down,
                // and a soft landing at zero. (Easing each key to speed 0 made the scale stop at the peak.)
                setKeys(sp, [[t, base], [t + d, scaled(base, 0)]]);
                easeBetweenKeys(sp, t, t + d, POP_OUT_CURVE);
            }
            if (o.fade) {
                var op = L.transform.opacity.valueAtTime(t, false);
                if (mode === "up" && op === 0) { op = 100; }
                if (mode === "up") { setKeys(L.transform.opacity, [[t, 0], [t + d * 0.4, op]]); }
                else { setKeys(L.transform.opacity, [[t + d * 0.45, op], [t + d, 0]]); }
            }
            mb(L);
        }
    }

    // dir = direction of travel: [dx, dy]
    function doMove(dir, o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select at least one layer."); if (!sel) { return; }
        var fr = comp.frameDuration, d = animDur(comp), W = comp.width, H = comp.height, M = 40;
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i];
            if (L instanceof CameraLayer || L instanceof LightLayer) { continue; }
            var t = comp.time + i * o.stagger * fr;
            if (o.mode === "in") { ensureBounce(L); }
            var dist = o.distance;
            if (o.offscreen) {
                var b = compBounds(L, t);
                if (o.mode === "in") {
                    if (dir[0] > 0) { dist = b.right + M; } else if (dir[0] < 0) { dist = W - b.left + M; }
                    else if (dir[1] > 0) { dist = b.bottom + M; } else { dist = H - b.top + M; }
                } else {
                    if (dir[0] > 0) { dist = W - b.left + M; } else if (dir[0] < 0) { dist = b.right + M; }
                    else if (dir[1] > 0) { dist = H - b.top + M; } else { dist = b.bottom + M; }
                }
            }
            var off = [dir[0] * dist, dir[1] * dist];
            var tr = L.transform, opts = { bounce: o.mode === "in" };
            if (tr.position.dimensionsSeparated) {
                var axisProp = (dir[0] !== 0) ? tr.xPosition : tr.yPosition;
                var delta = (dir[0] !== 0) ? off[0] : off[1];
                var bv = axisProp.valueAtTime(t, false);
                if (o.mode === "in") { setKeys(axisProp, [[t, bv - delta], [t + d, bv]], opts); }
                else { setKeys(axisProp, [[t, bv], [t + d, bv + delta]], opts); }
            } else {
                var p = tr.position.valueAtTime(t, false);
                var moved = [p[0] + off[0], p[1] + off[1]], back = [p[0] - off[0], p[1] - off[1]];
                if (p.length === 3) { moved.push(p[2]); back.push(p[2]); }
                if (o.mode === "in") { setKeys(tr.position, [[t, back], [t + d, p]], opts); }
                else { setKeys(tr.position, [[t, p], [t + d, moved]], opts); }
            }
            if (o.fade) {
                var op = tr.opacity.valueAtTime(t, false) || 100;
                if (o.mode === "in") { setKeys(tr.opacity, [[t, 0], [t + d * 0.5, op]]); }
                else { setKeys(tr.opacity, [[t + d * 0.5, op], [t + d, 0]]); }
            }
            mb(L);
        }
    }

    function doListStagger(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the UI layers (rows) to stagger."); if (!sel) { return; }
        var t0 = comp.time, fr = comp.frameDuration, d = animDur(comp);
        sel.sort(function (a, b) {
            var ya = a.transform.position.valueAtTime(t0, false)[1], yb = b.transform.position.valueAtTime(t0, false)[1];
            return (ya === yb) ? a.index - b.index : ya - yb;
        });
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i], t = t0 + i * o.stagger * fr;
            ensureBounce(L);
            var pp = L.transform.position;
            if (pp.dimensionsSeparated) {
                var y = L.transform.yPosition.valueAtTime(t, false);
                setKeys(L.transform.yPosition, [[t, y + o.offset], [t + d, y]], { bounce: true });
            } else {
                var p = pp.valueAtTime(t, false), s = [p[0], p[1] + o.offset];
                if (p.length === 3) { s.push(p[2]); }
                setKeys(pp, [[t, s], [t + d, p]], { bounce: true });
            }
            if (o.fade) {
                var op = L.transform.opacity.valueAtTime(t, false) || 100;
                setKeys(L.transform.opacity, [[t, 0], [t + d * 0.6, op]]);
            }
            mb(L);
        }
    }

    function doPushIn(amount, fromPlayhead) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layers or scene precomps to push in."); if (!sel) { return; }
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i];
            var t0 = fromPlayhead ? Math.max(comp.time, L.inPoint) : L.inPoint;
            var t1 = Math.min(L.outPoint, comp.duration);
            if (t1 - t0 < comp.frameDuration * 2) { continue; }
            var s = L.transform.scale.valueAtTime(t0, false);
            setKeys(L.transform.scale, [[t0, s], [t1, scaled(s, 1 + amount / 100)]], { curve: { first: 33, last: 33 } });
        }
    }
