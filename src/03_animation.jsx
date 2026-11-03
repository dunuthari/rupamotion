
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
        var rect = findFirst(contentsOf(L), VN.rect);
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
        var sr = L.sourceRectAtTime(t, false), ls = totalScale([], L, t);
        return {
            center: layerToComp([sr.left + sr.width / 2, sr.top + sr.height / 2], L, t),
            size: [Math.abs(sr.width * ls[0]), Math.abs(sr.height * ls[1])],
            round: null
        };
    }

    function morphParametric(src, tgt, shp, isRect, t, d) {
        var sizeP = shp.property(isRect ? VN.rectSize : VN.ellipseSize);
        var posP = shp.property(isRect ? VN.rectPos : VN.ellipsePos);
        var chain = getChain(shp), ts = totalScale(chain, src, t), box = shapeCompBox(tgt, t);
        var tPos = layerToGroup(compToLayer(box.center, src, t), chain, t);
        var tSize = [Math.abs(sd(box.size[0], ts[0])), Math.abs(sd(box.size[1], ts[1]))];
        setKeys(sizeP, [[t, sizeP.valueAtTime(t, false)], [t + d, tSize]], { bounce: true, clamp: true });
        setKeys(posP, [[t, posP.valueAtTime(t, false)], [t + d, tPos]], { bounce: true });
        if (isRect) {
            var rP = shp.property(VN.rectRound), r0 = rP.valueAtTime(t, false);
            var r1 = (box.round !== null) ? sd(box.round, (Math.abs(ts[0]) + Math.abs(ts[1])) / 2) : r0;
            if (r1 !== r0) { setKeys(rP, [[t, r0], [t + d, r1]], { bounce: true, clamp: true }); }
        }
    }

    function morphPath(src, tgt, pg, t, d) {
        var pathP = pg.property(VN.pathValue), chainA = getChain(pg), tsA = totalScale(chainA, src, t);
        var a = pathP.valueAtTime(t, false), target, i;
        var tp = findFirst(contentsOf(tgt), VN.path);
        if (tp) {
            var chainB = getChain(tp), tsB = totalScale(chainB, tgt, t), b = tp.property(VN.pathValue).valueAtTime(t, false);
            var rx = sd(tsB[0], tsA[0]), ry = sd(tsB[1], tsA[1]), v = [], it = [], ot = [];
            for (i = 0; i < b.vertices.length; i++) {
                var cp = layerToComp(groupToLayer(b.vertices[i], chainB, t), tgt, t);
                v.push(layerToGroup(compToLayer(cp, src, t), chainA, t));
                it.push([b.inTangents[i][0] * rx, b.inTangents[i][1] * ry]);
                ot.push([b.outTangents[i][0] * rx, b.outTangents[i][1] * ry]);
            }
            target = makeShape(v, it, ot, b.closed);
        } else {
            var box = shapeCompBox(tgt, t);
            var tc = layerToGroup(compToLayer(box.center, src, t), chainA, t);
            var tsz = [Math.abs(sd(box.size[0], tsA[0])), Math.abs(sd(box.size[1], tsA[1]))];
            var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (i = 0; i < a.vertices.length; i++) {
                x0 = Math.min(x0, a.vertices[i][0]); x1 = Math.max(x1, a.vertices[i][0]);
                y0 = Math.min(y0, a.vertices[i][1]); y1 = Math.max(y1, a.vertices[i][1]);
            }
            var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sx = sd(tsz[0], x1 - x0), sy = sd(tsz[1], y1 - y0);
            var v2 = [], it2 = [], ot2 = [];
            for (i = 0; i < a.vertices.length; i++) {
                v2.push([tc[0] + (a.vertices[i][0] - cx) * sx, tc[1] + (a.vertices[i][1] - cy) * sy]);
                it2.push([a.inTangents[i][0] * sx, a.inTangents[i][1] * sy]);
                ot2.push([a.outTangents[i][0] * sx, a.outTangents[i][1] * sy]);
            }
            target = makeShape(v2, it2, ot2, a.closed);
        }
        setKeys(pathP, [[t, a], [t + d, target]], { bounce: true, isShape: true });
        return target.vertices.length !== a.vertices.length;
    }

    function doMorph(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = comp.selectedLayers;
        if (sel.length !== 2 || !(sel[0] instanceof ShapeLayer) || !(sel[1] instanceof ShapeLayer)) {
            alert("Select exactly 2 shape layers: the shape to morph and the shape it should become.", NAME);
            return;
        }
        var ls = [sel[0], sel[1]].sort(function (a, b) { return a.index - b.index; });
        var src = o.fromLower ? ls[1] : ls[0], tgt = o.fromLower ? ls[0] : ls[1];
        var t = comp.time, d = animDur(comp);

        ensureBounce(src);
        var c = contentsOf(src);
        var rect = findFirst(c, VN.rect), ell = rect ? null : findFirst(c, VN.ellipse);
        var path = (rect || ell) ? null : findFirst(c, VN.path);
        if (!rect && !ell && !path) { alert("\"" + src.name + "\" has no rectangle, ellipse or path to morph.", NAME); return; }

        var mismatch = false;
        if (rect) { morphParametric(src, tgt, rect, true, t, d); }
        else if (ell) { morphParametric(src, tgt, ell, false, t, d); }
        else { mismatch = morphPath(src, tgt, path, t, d); }

        if (o.color) {
            var fa = findFirst(contentsOf(src), VN.fill), fb = findFirst(contentsOf(tgt), VN.fill);
            if (fa && fb) {
                var ca = fa.property(VN.fillColor);
                var s0 = ca.valueAtTime(t, false), s1 = fb.property(VN.fillColor).valueAtTime(t, false);
                if (s0.toString() !== s1.toString()) { setKeys(ca, [[t, s0], [t + d, s1]]); }
            }
        }
        mb(src);
        if (o.hide) { tgt.enabled = false; }
        if (o.precomp) {
            var n = 1;
            for (var i = 1; i <= app.project.numItems; i++) {
                var m = /^Ru Shape Morph (\d+)$/.exec(app.project.item(i).name);
                if (m) { n = Math.max(n, parseInt(m[1], 10) + 1); }
            }
            var nc = comp.layers.precompose([src.index, tgt.index], "Ru Shape Morph " + n, true);
            for (var j = 1; j <= comp.numLayers; j++) { comp.layer(j).selected = (comp.layer(j).source === nc); }
        }
        if (mismatch) {
            alert("The two paths have a different number of points, so the morph may look uneven.\nTip: use the Rectangle tool for both shapes.", NAME);
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
