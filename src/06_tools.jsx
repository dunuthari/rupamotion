
    // =====================================================================
    // Shared naming helper
    // =====================================================================

    function nextItemNumber(prefix) {
        var n = 1, re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)$");
        for (var i = 1; i <= app.project.numItems; i++) {
            var m = re.exec(app.project.item(i).name);
            if (m) { n = Math.max(n, parseInt(m[1], 10) + 1); }
        }
        return n;
    }

    // =====================================================================
    // LAYERS GROUP — layer operations
    // =====================================================================

    function topmost(layers) {
        var top = layers[0];
        for (var i = 1; i < layers.length; i++) { if (layers[i].index < top.index) { top = layers[i]; } }
        return top;
    }

    function doPrecomposeSafe() {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layers to pre-compose."); if (!sel) { return; }
        var idx = [], t0 = Infinity, t1 = -Infinity, i;
        for (i = 0; i < sel.length; i++) {
            idx.push(sel[i].index);
            t0 = Math.min(t0, sel[i].inPoint);
            t1 = Math.max(t1, sel[i].outPoint);
        }
        var name = "MK Precomp " + nextItemNumber("MK Precomp ");
        var nc = comp.layers.precompose(idx, name, true);
        for (i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            if (L.source === nc) {
                try { L.inPoint = Math.max(0, t0); L.outPoint = t1; } catch (e) {}
                L.selected = true;
            } else {
                L.selected = false;
            }
        }
    }

    function nextName(name) {
        var m = /^(.*?)(\d+)$/.exec(name);
        if (m) {
            var s = String(parseInt(m[2], 10) + 1);
            while (s.length < m[2].length) { s = "0" + s; }
            return m[1] + s;
        }
        return name + " 02";
    }

    function uniqueItemName(name) {
        var taken = {}, i;
        for (i = 1; i <= app.project.numItems; i++) { taken[app.project.item(i).name] = true; }
        var n = name, guard = 0;
        while (taken[n] && guard < 5000) { n = nextName(n); guard++; }
        return n;
    }

    // Copies a comp and every comp nested inside it, so nothing stays shared.
    function deepDuplicateComp(c, map) {
        if (map["c" + c.id]) { return map["c" + c.id]; }
        var d = c.duplicate();
        d.name = uniqueItemName(nextName(c.name));
        map["c" + c.id] = d;
        for (var i = 1; i <= d.numLayers; i++) {
            var L = d.layer(i);
            if (L.source && L.source instanceof CompItem) {
                L.replaceSource(deepDuplicateComp(L.source, map), false);
            }
        }
        return d;
    }

    // independent: precomp copies get their own comp (deep copy), so edits don't affect the others
    function doSmartDuplicate(count, independent) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layers to duplicate."); if (!sel) { return; }
        var made = 0;
        for (var i = 0; i < sel.length; i++) {
            var cur = sel[i];
            if (!/\d+$/.test(cur.name)) { cur.name = cur.name + " 01"; }
            for (var k = 0; k < count; k++) {
                var d = cur.duplicate();
                d.name = nextName(cur.name);
                if (independent && d.source && d.source instanceof CompItem) {
                    d.replaceSource(deepDuplicateComp(d.source, {}), false);
                    made++;
                }
                cur = d;
            }
        }
        if (independent && made === 0) {
            alert("Done. None of the selected layers were precomps, so there were no comps to copy.", NAME);
        }
    }

    // ---- unwrap composition ----

    function copyKeyedProp(from, to) {
        if (from.numKeys === 0) { to.setValue(from.value); return; }
        var i;
        for (i = 1; i <= from.numKeys; i++) { to.setValueAtTime(from.keyTime(i), from.keyValue(i)); }
        for (i = 1; i <= from.numKeys; i++) {
            try { to.setInterpolationTypeAtKey(i, from.keyInInterpolationType(i), from.keyOutInterpolationType(i)); } catch (e1) {}
            try { to.setTemporalEaseAtKey(i, from.keyInTemporalEase(i), from.keyOutTemporalEase(i)); } catch (e2) {}
        }
    }

    function sameVec(a, b) {
        for (var i = 0; i < 2; i++) { if (Math.abs(a[i] - b[i]) > 0.001) { return false; } }
        return true;
    }

    // True when the precomp layer's own transform would move or scale its contents
    function hasOwnTransform(pl, src, comp) {
        var tr = pl.transform, props = [tr.anchorPoint, tr.position, tr.scale, tr.rotation], i;
        for (i = 0; i < props.length; i++) { if (props[i].numKeys > 0 || props[i].expression !== "") { return true; } }
        if (!sameVec(tr.anchorPoint.value, [src.width / 2, src.height / 2])) { return true; }
        if (!sameVec(tr.position.value, [comp.width / 2, comp.height / 2])) { return true; }
        if (!sameVec(tr.scale.value, [100, 100]) || tr.rotation.value !== 0) { return true; }
        return false;
    }

    // Moves a precomp's layers into the parent comp, at the right time, and removes the precomp layer.
    // o: keepTransform (null carries the precomp layer's transform), removeLayer
    function unwrapLayer(comp, pl, o, notes) {
        var src = pl.source, n = src.numLayers, i;
        if (pl.timeRemapEnabled || Math.abs(pl.stretch - 100) > 0.001) {
            notes.push("\"" + pl.name + "\" skipped: it uses time remap or time stretch.");
            return false;
        }
        if (n === 0) { notes.push("\"" + pl.name + "\" is empty."); return false; }

        var parentIdx = [];
        for (i = 1; i <= n; i++) { parentIdx.push(src.layer(i).parent ? src.layer(i).parent.index : 0); }

        // Each copy lands on top of the stack, so copying bottom to top keeps the order
        var copies = [];
        for (i = n; i >= 1; i--) {
            src.layer(i).copyToComp(comp);
            copies[i - 1] = comp.layer(1);
        }

        var t0 = pl.startTime, a = pl.inPoint, b = pl.outPoint;
        for (i = 0; i < n; i++) {
            var C = copies[i];
            C.startTime = C.startTime + t0;
            if (C.inPoint < a) { C.inPoint = a; }
            if (C.outPoint > b) { C.outPoint = b; }
            C.moveBefore(pl);
            C.selected = false;
        }
        for (i = 0; i < n; i++) {
            if (parentIdx[i] > 0) { try { copies[i].parent = copies[parentIdx[i] - 1]; } catch (e1) {} }
        }

        if (o.keepTransform && hasOwnTransform(pl, src, comp)) {
            var nul = comp.layers.addNull();
            nul.name = "MK Unwrap · " + src.name;
            nul.source.width = src.width; nul.source.height = src.height;
            if (pl.threeDLayer) { nul.threeDLayer = true; }
            var keys = ["anchorPoint", "position", "scale", "rotation"];
            for (i = 0; i < keys.length; i++) {
                try { copyKeyedProp(pl.transform[keys[i]], nul.transform[keys[i]]); } catch (e2) {}
            }
            nul.moveBefore(copies[0]);
            for (i = 0; i < n; i++) { if (!copies[i].parent) { copies[i].parent = nul; } }
            notes.push("\"" + pl.name + "\" had its own transform, so a null (\"" + nul.name + "\") carries it.");
        }
        if (pl.transform.opacity.numKeys > 0 || pl.transform.opacity.value !== 100) {
            notes.push("\"" + pl.name + "\" opacity was not carried over.");
        }
        if (pl.property("ADBE Effect Parade").numProperties > 0 || pl.property("ADBE Mask Parade").numProperties > 0) {
            notes.push("\"" + pl.name + "\" effects/masks were not carried over.");
        }

        if (o.removeLayer) { pl.remove(); } else { pl.enabled = false; }
        for (i = 0; i < n; i++) { copies[i].selected = true; }
        return true;
    }

    function doUnwrapComp(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the composition layer(s) to unwrap."); if (!sel) { return; }
        if (typeof sel[0].copyToComp !== "function") {
            alert("Unwrap needs a newer After Effects (Layer.copyToComp).", NAME);
            return;
        }
        var targets = [], i;
        for (i = 0; i < sel.length; i++) {
            if (sel[i].source && sel[i].source instanceof CompItem) { targets.push(sel[i]); }
        }
        if (targets.length === 0) { alert("None of the selected layers is a composition. Select a pre-comp layer.", NAME); return; }
        for (i = 0; i < sel.length; i++) { sel[i].selected = false; }
        var notes = [], done = 0;
        for (i = 0; i < targets.length; i++) { if (unwrapLayer(comp, targets[i], o, notes)) { done++; } }
        if (notes.length > 0) { alert("Unwrapped " + done + " composition(s).\n\n" + notes.join("\n"), NAME); }
    }

    function doSmartNull() {
        var comp = activeComp(); if (!comp) { return; }
        var s = comp.selectedLayers, sel = [], i, is3D = false;
        for (i = 0; i < s.length; i++) { sel.push(s[i]); if (s[i].threeDLayer) { is3D = true; } }
        var n = comp.layers.addNull();
        n.name = "MK Null " + stamp(comp);
        var w = 100, h = 100;
        try { n.source.width = 50; n.source.height = 50; w = 50; h = 50; } catch (e) {}
        setXY(n.transform.anchorPoint, w / 2, h / 2);
        var pos = [comp.width / 2, comp.height / 2];
        if (sel.length > 0) {
            var sx = 0, sy = 0;
            for (i = 0; i < sel.length; i++) {
                var p = sel[i].transform.position.valueAtTime(comp.time, false);
                sx += p[0]; sy += p[1];
            }
            pos = [sx / sel.length, sy / sel.length];
        }
        if (is3D) { n.threeDLayer = true; }
        setXY(n.transform.position, pos[0], pos[1]);
        if (sel.length > 0) {
            n.moveBefore(topmost(sel));
            for (i = 0; i < sel.length; i++) { if (!sel[i].parent) { sel[i].parent = n; } }
        }
    }

    function doAdjustmentLayer() {
        var comp = activeComp(); if (!comp) { return; }
        var s = comp.selectedLayers, sel = [];
        for (var i = 0; i < s.length; i++) { sel.push(s[i]); }
        var a = addAdjustment(comp, "MK Adjustment " + stamp(comp));
        if (sel.length > 0) { a.moveBefore(topmost(sel)); }
    }

    function doSolidLayer(rgb) {
        var comp = activeComp(); if (!comp) { return; }
        var s = comp.selectedLayers, sel = [];
        for (var i = 0; i < s.length; i++) { sel.push(s[i]); }
        var L = addSolid(comp, rgb, "MK Solid · " + rgbToHex(rgb));
        if (sel.length > 0) { L.moveAfter(sel[sel.length - 1]); }
    }

    function buildCameraRig(comp) {
        var W = comp.width, H = comp.height;
        var orbit = addNull(comp, "MK Cam · Orbit", [W / 2, H / 2]);
        orbit.threeDLayer = true;
        orbit.transform.position.setValue([W / 2, H / 2, 0]);
        var dolly = addNull(comp, "MK Cam · Dolly", [W / 2, H / 2]);
        dolly.threeDLayer = true;
        dolly.transform.position.setValue([W / 2, H / 2, 0]);
        var cam = comp.layers.addCamera("MK Camera 3-Node", [W / 2, H / 2]);
        try { cam.autoOrient = AutoOrientType.NO_AUTO_ORIENT; } catch (e) {}
        var opts = cam.property("ADBE Camera Options Group");
        var zoom = opts.property("ADBE Camera Zoom").value;
        cam.transform.position.setValue([W / 2, H / 2, -zoom]);
        try {
            opts.property("ADBE Camera Focus Distance").setValue(zoom);
        } catch (e2) {}
        dolly.parent = orbit;
        cam.parent = dolly;
        return cam;
    }

    function doCamera3Node(dof, aperture) {
        var comp = activeComp(); if (!comp) { return; }
        var cam = buildCameraRig(comp);
        if (dof) {
            var opts = cam.property("ADBE Camera Options Group");
            try { opts.property("ADBE Camera Depth of Field").setValue(1); } catch (e1) {}
            try { opts.property("ADBE Camera Aperture").setValue(aperture); } catch (e2) {}
            try { opts.property("ADBE Camera Blur Level").setValue(100); } catch (e3) {}
        }
    }

    function cameraZoom(comp) {
        try {
            var cam = comp.activeCamera;
            if (cam) { return cam.property("ADBE Camera Options Group").property("ADBE Camera Zoom").value; }
        } catch (e) {}
        return comp.width * 1.3889; // After Effects' default 50 mm camera
    }

    // Arranges selected layers one behind another in Z.
    // frontTop: the top layer in the timeline is closest to the camera.
    // keepSize: scales layers so they look the same size as before (only the parallax changes).
    function doParallax(dist, startZ, frontTop, keepSize, addRig) {
        var comp = activeComp(); if (!comp) { return; }
        var s = comp.selectedLayers, sel = [], i;
        for (i = 0; i < s.length; i++) {
            if (!(s[i] instanceof CameraLayer) && !(s[i] instanceof LightLayer)) { sel.push(s[i]); }
        }
        if (sel.length === 0) { alert("Select the layers to arrange in depth.", NAME); return; }
        if (addRig && !comp.activeCamera) { buildCameraRig(comp); }
        var zoom = cameraZoom(comp);
        sel.sort(function (a, b) { return frontTop ? a.index - b.index : b.index - a.index; });
        var skipped = 0;
        for (i = 0; i < sel.length; i++) {
            var L = sel[i], tr = L.transform;
            var z = startZ + i * dist;
            var oldZ = 0;
            if (L.threeDLayer) {
                try { oldZ = tr.position.dimensionsSeparated ? tr.zPosition.value : tr.position.value[2]; } catch (e0) {}
            }
            L.threeDLayer = true;
            try {
                if (tr.position.dimensionsSeparated) {
                    if (tr.zPosition.numKeys > 0) { skipped++; continue; }
                    tr.zPosition.setValue(z);
                } else {
                    if (tr.position.numKeys > 0) { skipped++; continue; }
                    var p = tr.position.value;
                    tr.position.setValue([p[0], p[1], z]);
                }
            } catch (e1) { skipped++; continue; }
            if (keepSize && tr.scale.numKeys === 0) {
                var f = sd(zoom + z, zoom + oldZ);
                if (f > 0) { tr.scale.setValue(scaled(tr.scale.value, f)); }
            }
        }
        if (skipped > 0) { alert(skipped + " layer(s) skipped because their position is keyframed.", NAME); }
    }

    // =====================================================================
    // SHAPES GROUP — smart shape with settings
    // =====================================================================

    // Squircle-like rounded shape: 4 points with long tangents
    function squircleShape(w, h) {
        var rx = w / 2, ry = h / 2, kx = rx * 0.82, ky = ry * 0.82;
        return makeShape(
            [[0, -ry], [rx, 0], [0, ry], [-rx, 0]],
            [[-kx, 0], [0, -ky], [kx, 0], [0, ky]],
            [[kx, 0], [0, ky], [-kx, 0], [0, -ky]],
            true
        );
    }

    var SHAPE_TYPES = ["Squircle", "Rounded rectangle", "Pill", "Circle / Ellipse", "Triangle", "Star", "Polygon"];

    // o: type, w, h, radius, points, inset
    function addGeometry(L, gi, o, inset) {
        var w = Math.max(1, o.w - inset), h = Math.max(1, o.h - inset), m = Math.min(w, h);
        switch (o.type) {
            case 0: addPathVec(L, gi, squircleShape(w, h)); break;
            case 1: addRect(L, gi, w, h, Math.max(0, Math.min(o.radius - inset / 2, m / 2))); break;
            case 2: addRect(L, gi, w, h, m / 2); break;
            case 3: addEllipse(L, gi, w, h); break;
            case 4: addStar(L, gi, 2, 3, m / 2, 0, 0); break;
            case 5: addStar(L, gi, 1, Math.max(3, o.points), m / 2, m / 2 * o.inner, 0); break;
            default: addStar(L, gi, 2, Math.max(3, o.points), m / 2, 0, 0); break;
        }
    }

    // Ramp start/end follow the layer's bounds. Effect points on shape and text layers live in
    // comp space, so the corners go through toComp(): the gradient then moves, scales and rotates
    // with the element. (A fixed half-comp offset only works while the layer sits at the comp center.)
    // Footage and solids use plain layer pixels.
    function addLockedGradient(L, dir) {
        var e = fxAdd(L, "ADBE Ramp");
        if (!e) { return; }
        e.name = "MK Locked Gradient";
        var g = L.property("ADBE Effect Parade").property("MK Locked Gradient");
        fxSet(g, 2, c4(col("gradStart")));
        fxSet(g, 4, c4(col("gradEnd")));
        var r = "var r = thisLayer.sourceRectAtTime(time, false);\n";
        var a, b;
        if (dir === 1) {
            a = "[r.left + r.width / 2, r.top]";
            b = "[r.left + r.width / 2, r.top + r.height]";
        } else if (dir === 2) {
            a = "[r.left, r.top]";
            b = "[r.left + r.width, r.top + r.height]";
        } else {
            a = "[r.left, r.top + r.height / 2]";
            b = "[r.left + r.width, r.top + r.height / 2]";
        }
        function pointExpr(pt) {
            if (!isVectorLayer(L)) { return r + pt + ";"; }
            return r + "var q = thisLayer.toComp(" + pt + ");\n[q[0], q[1]];";
        }
        g.property(1).expression = pointExpr(a);
        g.property(3).expression = pointExpr(b);
    }

    // o: type, w, h, radius, points, inner, fill(rgb), fillOpacity, gradient, gradDir,
    //    stroke, strokeColor, strokeWidth, innerStroke, shadow
    function buildShapeContents(L, o) {
        var gi;
        if (o.innerStroke) {
            gi = newGroup(L, "Inner Stroke");
            addGeometry(L, gi, o, 6);
            addStroke(L, gi, [1, 1, 1], 2, 40);
        }
        if (o.stroke) {
            gi = newGroup(L, "Stroke");
            addGeometry(L, gi, o, 0);
            addStroke(L, gi, o.strokeColor, o.strokeWidth, 100);
        }
        gi = newGroup(L, "Fill");
        addGeometry(L, gi, o, 0);
        addFill(L, gi, o.fill, o.fillOpacity);
    }

    function applyShapeEffects(L, o) {
        var fx = L.property("ADBE Effect Parade");
        for (var i = fx.numProperties; i >= 1; i--) {
            var e = fx.property(i);
            if (e.matchName === "ADBE Drop Shadow" || e.name === "MK Locked Gradient") { e.remove(); }
            fx = L.property("ADBE Effect Parade");
        }
        if (o.gradient) { addLockedGradient(L, o.gradDir); }
        if (o.shadow) { softShadow(L); }
    }

    function doCreateShape(o) {
        var comp = activeComp(); if (!comp) { return; }
        var L = shapeLayer(comp, "MK Shape · " + SHAPE_TYPES[o.type] + " " + stamp(comp));
        buildShapeContents(L, o);
        applyShapeEffects(L, o);
        setXY(L.transform.position, comp.width / 2, comp.height / 2);
        if (o.frosted) { makeFrosted(comp, L, 30); }
        if (o.pop) {
            ensureBounce(L);
            var t = comp.time;
            setKeys(L.transform.scale, [[t, [0, 0]], [t + animDur(comp), [100, 100]]], { bounce: true, clamp: true });
        }
        mb(L);
    }

    // Rebuilds the selected shape layers with the current settings (keeps transform + animation).
    function doUpdateShape(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the shape layers to update."); if (!sel) { return; }
        var done = 0;
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i];
            if (!(L instanceof ShapeLayer)) { continue; }
            var root = contentsOf(L);
            while (root.numProperties > 0) { root.property(1).remove(); root = contentsOf(L); }
            buildShapeContents(L, o);
            applyShapeEffects(L, o);
            if (/^MK Shape · /.test(L.name)) { L.name = "MK Shape · " + SHAPE_TYPES[o.type] + " " + L.index; }
            done++;
        }
        if (done === 0) { alert("Select shape layers to update.", NAME); }
    }

    // Expression reference to a layer's first mask or shape path
    function pathRef(L) {
        var base = "thisComp.layer(\"" + esc(L.name) + "\")";
        try {
            var masks = L.property("ADBE Mask Parade");
            if (masks && masks.numProperties > 0) { return base + ".mask(1).maskPath"; }
        } catch (e) {}
        if (L instanceof ShapeLayer) {
            var p = findFirst(contentsOf(L), "ADBE Vector Shape - Group");
            if (!p) { return null; }
            var names = [], q = p;
            while (q && q.matchName !== "ADBE Root Vectors Group") {
                if (q.matchName === "ADBE Vector Group" || q.matchName === "ADBE Vector Shape - Group") { names.unshift(q.name); }
                q = q.parentProperty;
            }
            for (var i = 0; i < names.length; i++) { base += ".content(\"" + esc(names[i]) + "\")"; }
            return base + ".path";
        }
        return null;
    }

    function doFollowPath(seconds, loop, orient) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = comp.selectedLayers;
        if (sel.length !== 2) { alert("Select 2 layers: the path (a mask or shape path) and the layer that should follow it.", NAME); return; }
        var r0 = pathRef(sel[0]), r1 = pathRef(sel[1]);
        var pathL, follower, ref;
        if (r0 && !r1) { pathL = sel[0]; follower = sel[1]; ref = r0; }
        else if (r1 && !r0) { pathL = sel[1]; follower = sel[0]; ref = r1; }
        else if (r0 && r1) { pathL = sel[0]; follower = sel[1]; ref = r0; }
        else { alert("Neither layer has a mask or shape path. Draw one with the Pen tool first.", NAME); return; }

        var t = comp.time;
        var fx = follower.property("ADBE Effect Parade");
        if (!fx.property("MK Path Progress")) {
            var sl = fx.addProperty("ADBE Slider Control");
            sl.name = "MK Path Progress";
        }
        var prog = follower.property("ADBE Effect Parade").property("MK Path Progress").property(1);
        setKeys(prog, [[t, 0], [t + seconds, 100]]);
        if (loop) { prog.expression = "loopOut(\"cycle\");"; }

        var pos = follower.transform.position;
        if (pos.dimensionsSeparated) { pos.dimensionsSeparated = false; }
        pos = follower.transform.position;
        var head =
            "var L = thisComp.layer(\"" + esc(pathL.name) + "\");\n" +
            "var p = " + ref + ";\n" +
            "var prog = clamp(effect(\"MK Path Progress\")(1) / 100, 0, 1);\n";
        pos.expression = head +
            "var pt = L.toComp(p.pointOnPath(prog));\n" +
            "if (hasParent) { pt = parent.fromComp(pt); }\n" +
            "(value.length == 3) ? [pt[0], pt[1], value[2]] : [pt[0], pt[1]];";
        if (orient) {
            follower.transform.rotation.expression = head +
                "var tg = p.tangentOnPath(prog);\n" +
                "radiansToDegrees(Math.atan2(tg[1], tg[0]));";
        }
        mb(follower);
    }

    // =====================================================================
    // QUICK ACTIONS GROUP — one-click keyframing
    // =====================================================================

    function eachSelected(comp, msg, fn) {
        var sel = selLayers(comp, 1, msg); if (!sel) { return; }
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof CameraLayer || sel[i] instanceof LightLayer) { continue; }
            fn(sel[i], i);
        }
    }

    // Temporarily uses a given bounce state (Quick Actions has its own toggle)
    function withBounce(on, fn) {
        var old = style.bounceOn;
        style.bounceOn = on ? "1" : "0";
        try { fn(); } finally { style.bounceOn = old; }
    }

    // Bounce for fades: in = springy scale-up, out = small anticipation before shrinking
    function fadeBounce(L, t, d, fadeIn) {
        var sp = L.transform.scale, s = sp.valueAtTime(t, false);
        if (fadeIn) {
            ensureBounce(L);
            setKeys(sp, [[t, scaled(s, 0.88)], [t + d, s]], { bounce: true });
        } else {
            setKeys(sp, [[t, s], [t + d * 0.3, scaled(s, 1.06)], [t + d, scaled(s, 0.9)]]);
        }
    }

    function doFade(fadeIn, stagger, bounce) {
        var comp = activeComp(); if (!comp) { return; }
        var d = animDur(comp), fr = comp.frameDuration;
        eachSelected(comp, "Select at least one layer.", function (L, i) {
            var t = comp.time + i * stagger * fr;
            var op = L.transform.opacity.valueAtTime(t, false) || 100;
            if (fadeIn) { setKeys(L.transform.opacity, [[t, 0], [t + d, op]]); }
            else { setKeys(L.transform.opacity, [[t, op], [t + d, 0]]); }
            if (bounce) { fadeBounce(L, t, d, fadeIn); mb(L); }
        });
    }

    function doBlurFade(stagger, bounce) {
        var comp = activeComp(); if (!comp) { return; }
        var d = animDur(comp), fr = comp.frameDuration;
        eachSelected(comp, "Select at least one layer.", function (L, i) {
            var t = comp.time + i * stagger * fr;
            var e = fxAdd(L, "ADBE Gaussian Blur 2");
            if (!e) { return; }
            e.name = "MK Blur Fade";
            fxSet(e, 3, 1);
            setKeys(L.property("ADBE Effect Parade").property("MK Blur Fade").property(1), [[t, 40], [t + d, 0]]);
            var op = L.transform.opacity.valueAtTime(t, false) || 100;
            setKeys(L.transform.opacity, [[t, 0], [t + d * 0.7, op]]);
            if (bounce) { fadeBounce(L, t, d, true); }
            mb(L);
        });
    }

    function keyedProps(group, out) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                try { if (p.numKeys > 1) { out.push(p); } } catch (e) {}
            } else {
                keyedProps(p, out);
            }
        }
        return out;
    }

    function targetProps(comp, minKeys) {
        var sel = comp.selectedLayers, props = [], i, j;
        for (i = 0; i < sel.length; i++) {
            var sp = sel[i].selectedProperties;
            for (j = 0; j < sp.length; j++) {
                if (sp[j].propertyType === PropertyType.PROPERTY && sp[j].numKeys >= minKeys) { props.push(sp[j]); }
            }
        }
        return props;
    }

    function reverseProp(prop) {
        var n = prop.numKeys, i, k;
        if (n < 2) { return false; }
        var keys = [];
        for (i = 1; i <= n; i++) {
            k = { t: prop.keyTime(i), v: prop.keyValue(i) };
            try { k.inI = prop.keyInInterpolationType(i); k.outI = prop.keyOutInterpolationType(i); } catch (e1) {}
            try { k.inE = prop.keyInTemporalEase(i); k.outE = prop.keyOutTemporalEase(i); } catch (e2) {}
            if (prop.isSpatial) {
                try { k.inS = prop.keyInSpatialTangent(i); k.outS = prop.keyOutSpatialTangent(i); } catch (e3) {}
            }
            keys.push(k);
        }
        var t0 = keys[0].t, t1 = keys[n - 1].t;
        for (i = n; i >= 1; i--) { prop.removeKey(i); }
        for (i = 0; i < n; i++) { prop.setValueAtTime(t0 + t1 - keys[i].t, keys[i].v); }
        for (i = 0; i < n; i++) {
            k = keys[i];
            var idx = prop.nearestKeyIndex(t0 + t1 - k.t);
            if (k.inI !== undefined) { try { prop.setInterpolationTypeAtKey(idx, k.outI, k.inI); } catch (e4) {} }
            if (k.inE) { try { prop.setTemporalEaseAtKey(idx, k.outE, k.inE); } catch (e5) {} }
            if (k.inS) { try { prop.setSpatialTangentsAtKey(idx, k.outS, k.inS); } catch (e6) {} }
        }
        return true;
    }

    function doReverseKeys() {
        var comp = activeComp(); if (!comp) { return; }
        var props = targetProps(comp, 2);
        if (props.length === 0) {
            var sel = comp.selectedLayers;
            for (var i = 0; i < sel.length; i++) { keyedProps(sel[i], props); }
        }
        if (props.length === 0) { alert("Select layers (or properties) that have 2 or more keyframes.", NAME); return; }
        for (var j = 0; j < props.length; j++) { reverseProp(props[j]); }
    }

    // dir: 0 horizontal, 1 vertical, 2 diagonal
    function doLockGradient(dir) {
        var comp = activeComp(); if (!comp) { return; }
        eachSelected(comp, "Select the text or shape layers.", function (L) { addLockedGradient(L, dir); });
    }

    function physicsExpr(amp) {
        return "// Motion Kit bounce physics (ball-like bounce after each keyframe)\n" +
            "var amp = " + amp.toFixed(3) + ", freq = 3, decay = 6;\n" +
            "var n = 0, out = value;\n" +
            "if (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) { n--; } }\n" +
            "if (n > 0) {\n" +
            "  var t = time - key(n).time;\n" +
            "  if (t > 0 && t < 2) {\n" +
            "    var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);\n" +
            "    out = add(value, mul(v, amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t)));\n" +
            "  }\n" +
            "}\n" +
            "out;";
    }

    function doBouncePhysics(strength) {
        var comp = activeComp(); if (!comp) { return; }
        var props = targetProps(comp, 1), i;
        if (props.length === 0) {
            var sel = comp.selectedLayers;
            for (i = 0; i < sel.length; i++) {
                var tr = sel[i].transform, cand = [tr.position, tr.scale, tr.rotation];
                for (var j = 0; j < cand.length; j++) {
                    try { if (cand[j] && cand[j].numKeys > 0) { props.push(cand[j]); } } catch (e) {}
                }
            }
        }
        if (props.length === 0) { alert("Select keyframed layers (position, scale or rotation) or keyframed properties.", NAME); return; }
        var amp = 0.05 * num(strength, 10, 1, 100) / 10, skipped = 0;
        for (i = 0; i < props.length; i++) {
            var ex = props[i].expression;
            if (ex !== "" && !/Motion Kit/.test(ex)) { skipped++; continue; }
            try { props[i].expression = physicsExpr(amp); } catch (e2) { skipped++; }
        }
        if (skipped > 0) { alert(skipped + " propert" + (skipped === 1 ? "y was" : "ies were") + " skipped because they already have your own expression.", NAME); }
    }
