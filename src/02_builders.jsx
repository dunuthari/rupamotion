
    // =====================================================================
    // Builders: shapes, text, effects, masks, mattes, nulls
    // =====================================================================

    function shapeLayer(comp, name) {
        var L = comp.layers.addShape();
        L.name = name;
        return L;
    }

    // Groups are appended at the bottom of Contents. Returns the group index.
    function newGroup(L, name) {
        var root = contentsOf(L);
        var g = root.addProperty("ADBE Vector Group");
        g.name = name;
        return contentsOf(L).numProperties;
    }

    function grp(L, gi) { return contentsOf(L).property(gi); }

    // Adds a vector item to group gi and returns it (use it before the next add).
    function addVec(L, gi, mn) {
        var vs = grp(L, gi).property("ADBE Vectors Group");
        vs.addProperty(mn);
        vs = grp(L, gi).property("ADBE Vectors Group");
        return vs.property(vs.numProperties);
    }

    function addRect(L, gi, w, h, r, pos) {
        var p = addVec(L, gi, "ADBE Vector Shape - Rect");
        p.property("ADBE Vector Rect Size").setValue([w, h]);
        p.property("ADBE Vector Rect Roundness").setValue(r);
        if (pos) { p.property("ADBE Vector Rect Position").setValue(pos); }
    }

    function addEllipse(L, gi, w, h, pos) {
        var p = addVec(L, gi, "ADBE Vector Shape - Ellipse");
        p.property("ADBE Vector Ellipse Size").setValue([w, h]);
        if (pos) { p.property("ADBE Vector Ellipse Position").setValue(pos); }
    }

    // type: 1 = star, 2 = polygon
    function addStar(L, gi, type, points, outer, inner, rot, pos) {
        var p = addVec(L, gi, "ADBE Vector Shape - Star");
        p.property("ADBE Vector Star Type").setValue(type);
        p.property("ADBE Vector Star Points").setValue(points);
        p.property("ADBE Vector Star Outer Radius").setValue(outer);
        if (type === 1) { p.property("ADBE Vector Star Inner Radius").setValue(inner); }
        if (rot) { p.property("ADBE Vector Star Rotation").setValue(rot); }
        if (pos) { p.property("ADBE Vector Star Position").setValue(pos); }
    }

    function addPathVec(L, gi, shape) {
        var p = addVec(L, gi, "ADBE Vector Shape - Group");
        p.property("ADBE Vector Shape").setValue(shape);
    }

    function addFill(L, gi, rgb, opacity) {
        var f = addVec(L, gi, "ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(c4(rgb));
        if (opacity !== undefined) { f.property("ADBE Vector Fill Opacity").setValue(opacity); }
    }

    function addStroke(L, gi, rgb, width, opacity) {
        var s = addVec(L, gi, "ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(c4(rgb));
        s.property("ADBE Vector Stroke Width").setValue(width);
        if (opacity !== undefined) { s.property("ADBE Vector Stroke Opacity").setValue(opacity); }
    }

    function makeShape(verts, inT, outT, closed) {
        var s = new Shape();
        s.vertices = verts;
        s.inTangents = inT;
        s.outTangents = outT;
        s.closed = closed;
        return s;
    }

    function roundRectShape(cx, cy, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        var k = 0.5523 * r;
        var x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
        return makeShape(
            [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]],
            [[-k, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]],
            [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]],
            true
        );
    }

    // ---- effects ----

    function fxAdd(L, names) {
        if (!(names instanceof Array)) { names = [names]; }
        for (var i = 0; i < names.length; i++) {
            try {
                var fx = L.property("ADBE Effect Parade");
                if (fx.canAddProperty(names[i])) {
                    fx.addProperty(names[i]);
                    fx = L.property("ADBE Effect Parade");
                    return fx.property(fx.numProperties);
                }
            } catch (e) {}
        }
        return null;
    }

    function isVectorLayer(L) { return (L instanceof ShapeLayer) || (L instanceof TextLayer); }

    function fxSet(e, idx, v) {
        if (!e) { return; }
        try { e.property(idx).setValue(v); } catch (err) {}
    }

    function clearEffects(L) {
        var fx = L.property("ADBE Effect Parade");
        while (fx.numProperties > 0) {
            fx.property(1).remove();
            fx = L.property("ADBE Effect Parade");
        }
    }

    // Soft shadow: big blur, ~15% opacity. (Drop Shadow opacity is stored 0–255.)
    function softShadow(L) {
        var e = fxAdd(L, "ADBE Drop Shadow");
        fxSet(e, 1, [0.10, 0.16, 0.36, 1]);
        fxSet(e, 2, 38);
        fxSet(e, 3, 180);
        fxSet(e, 4, 14);
        fxSet(e, 5, 70);
    }

    // ---- text ----

    function textDocProp(L) { return L.property("ADBE Text Properties").property("ADBE Text Document"); }

    // o: size, color(rgb), font, just ("left"|"center")
    function makeText(comp, str, o) {
        var L = comp.layers.addText(str);
        var sp = textDocProp(L);
        var d = sp.value;
        try { d.resetCharStyle(); } catch (e) {}
        d.fontSize = o.size;
        d.applyFill = true;
        d.fillColor = o.color;
        d.applyStroke = false;
        try { d.font = o.font; } catch (e1) {}
        d.justification = (o.just === "left") ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.CENTER_JUSTIFY;
        sp.setValue(d);
        return L;
    }

    // where: "center" | "left"  — keeps the layer's visual position
    function anchorTo(L, where, t) {
        var r = L.sourceRectAtTime(t, false);
        var a = (where === "left") ? [r.left, r.top + r.height / 2] : [r.left + r.width / 2, r.top + r.height / 2];
        var ap = L.transform.anchorPoint, pp = L.transform.position;
        if (ap.numKeys > 0 || pp.numKeys > 0) { return; }
        var old = ap.value, pv = pp.value, s = L.transform.scale.value;
        setXY(ap, a[0], a[1]);
        setXY(pp, pv[0] + (a[0] - old[0]) * s[0] / 100, pv[1] + (a[1] - old[1]) * s[1] / 100);
    }

    function textWidth(L, t) { return L.sourceRectAtTime(t, false).width; }

    // ---- masks + mattes ----

    function addMask(L, shape) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        m.property("ADBE Mask Shape").setValue(shape);
        return m;
    }

    // type: "alpha" | "luma". Uses the AE 2023+ track matte API when available.
    function setMatte(layer, matte, type) {
        var tm = (type === "luma") ? TrackMatteType.LUMA : TrackMatteType.ALPHA;
        if (typeof layer.setTrackMatte === "function") {
            layer.setTrackMatte(matte, tm);
            return true;
        }
        matte.moveBefore(layer);
        layer.trackMatteType = tm;
        return true;
    }

    // ---- nulls, solids ----

    function addNull(comp, name, pos) {
        var n = comp.layers.addNull();
        n.name = name;
        try { setXY(n.transform.anchorPoint, 50, 50); } catch (e) {}
        setXY(n.transform.position, pos[0], pos[1]);
        return n;
    }

    function addSolid(comp, rgb, name) {
        return comp.layers.addSolid(rgb, name, comp.width, comp.height, comp.pixelAspect, comp.duration);
    }

    function addAdjustment(comp, name, t0, t1) {
        var L = addSolid(comp, [1, 1, 1], name);
        L.adjustmentLayer = true;
        if (t0 !== undefined) {
            L.inPoint = Math.max(0, t0);
            L.outPoint = Math.min(comp.duration, t1);
        }
        return L;
    }

    // Comp-space bounds of a layer (ignores rotation and parenting)
    function compBounds(L, t) {
        var r = L.sourceRectAtTime(t, false);
        var a = L.transform.anchorPoint.valueAtTime(t, false);
        var p = L.transform.position.valueAtTime(t, false);
        var s = L.transform.scale.valueAtTime(t, false);
        var x1 = (r.left - a[0]) * s[0] / 100 + p[0];
        var x2 = (r.left + r.width - a[0]) * s[0] / 100 + p[0];
        var y1 = (r.top - a[1]) * s[1] / 100 + p[1];
        var y2 = (r.top + r.height - a[1]) * s[1] / 100 + p[1];
        return { left: Math.min(x1, x2), right: Math.max(x1, x2), top: Math.min(y1, y2), bottom: Math.max(y1, y2) };
    }

    // =====================================================================
    // Shared design pieces
    // =====================================================================

    // Frosted glass: blurs whatever is behind `layer`, masked to its shape.
    function makeFrosted(comp, layer, radius) {
        var dup = layer.duplicate();
        dup.name = layer.name + " · glass matte";
        clearEffects(dup);
        var fills = findAll(contentsOf(dup), "ADBE Vector Graphic - Fill");
        for (var i = 0; i < fills.length; i++) {
            try { fills[i].property("ADBE Vector Fill Opacity").setValue(100); } catch (e) {}
        }
        var adj = addAdjustment(comp, "MK Frost · " + layer.name);
        var b = fxAdd(adj, "ADBE Box Blur2");
        fxSet(b, 1, radius || 30);
        fxSet(b, 2, 3);
        fxSet(b, 4, 1);
        adj.moveAfter(layer);
        dup.moveBefore(adj);
        setMatte(adj, dup, "alpha");
        adj.inPoint = layer.inPoint;
        adj.outPoint = layer.outPoint;
        return adj;
    }

    // Pill: rounded rect + light inner stroke + soft shadow, label parented to it.
    // o: label, size, fill(rgb), fillOpacity, textColor(rgb), stroke(rgb) [outline], extraLeft, padX, padY, shadow
    function makePill(comp, o) {
        var t = comp.time;
        var size = o.size || 44;
        var text = makeText(comp, o.label, { size: size, color: o.textColor || [1, 1, 1], font: pickFont(true), just: "center" });
        text.name = "MK Pill Label · " + o.label;
        var r = text.sourceRectAtTime(t, false);
        var padX = (o.padX !== undefined) ? o.padX : size * 0.9;
        var padY = (o.padY !== undefined) ? o.padY : size * 0.5;
        var extra = o.extraLeft || 0;
        var w = Math.round(r.width + padX * 2 + extra);
        var h = Math.round(Math.max(r.height, size * 0.9) + padY * 2);

        var pill = shapeLayer(comp, "MK Pill · " + o.label);
        var g1 = newGroup(pill, "Inner Stroke");
        addRect(pill, g1, w - 6, h - 6, (h - 6) / 2);
        addStroke(pill, g1, [1, 1, 1], 2, 45);
        if (o.stroke) {
            var g0 = newGroup(pill, "Outline");
            addRect(pill, g0, w, h, h / 2);
            addStroke(pill, g0, o.stroke, 3, 100);
        }
        var g2 = newGroup(pill, "Pill");
        addRect(pill, g2, w, h, h / 2);
        addFill(pill, g2, o.fill || col("primary"), (o.fillOpacity !== undefined) ? o.fillOpacity : 100);
        if (o.shadow !== false) { softShadow(pill); }

        anchorTo(text, "center", t);
        var pp = pill.transform.position.value;
        setXY(text.transform.position, pp[0], pp[1]);
        text.parent = pill;
        setXY(text.transform.position, extra / 2, 0);
        text.moveBefore(pill);
        mb(pill); mb(text);
        return { pill: pill, text: text, w: w, h: h };
    }

    // Slow camera push-in with depth of field. Returns the camera.
    function cameraPush(comp, t, len, push, aperture) {
        var cam = comp.layers.addCamera("MK Camera", [comp.width / 2, comp.height / 2]);
        var opts = cam.property("ADBE Camera Options Group");
        var zoom = opts.property("ADBE Camera Zoom").value;
        try { opts.property("ADBE Camera Depth of Field").setValue(1); } catch (e1) {}
        try { opts.property("ADBE Camera Aperture").setValue(aperture); } catch (e2) {}
        try { opts.property("ADBE Camera Blur Level").setValue(100); } catch (e3) {}
        try { opts.property("ADBE Camera Focus Distance").expression = "length(transform.position, transform.pointOfInterest);"; } catch (e4) {}
        var p = [comp.width / 2, comp.height / 2, -zoom];
        setKeys(cam.transform.position, [[t, p], [t + len, [p[0], p[1], p[2] + push]]], { curve: { first: 40, last: 70 } });
        return cam;
    }
