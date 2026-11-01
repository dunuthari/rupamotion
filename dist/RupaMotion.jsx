/*
    Rupa Motion v1.0 — Google Vids–style motion toolkit for After Effects
    (Rupa · රූප · "image, visual")
    ---------------------------------------------------------------------
    A dockable ScriptUI panel.

    Install:
      Windows: C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\
      macOS:   /Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/
      Restart After Effects, then open Window > RupaMotion.jsx

    Groups:  Layers · Quick Actions · Flow · Camera · Shapes · Animation · Transitions · Text · UI Kit · Media · Style

    Every action is one undo step. Most actions start at the playhead.
*/

(function MotionKit(thisObj) {

    var NAME = "Rupa Motion";
    var SET = "MotionKit_v1";
    var FX_B = "MK Bounce";
    var FX_BS = "MK Bounce Strength";

    // =====================================================================
    // Basic helpers (ExtendScript is ES3: no JSON, Array.indexOf, trim…)
    // =====================================================================

    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

    function num(s, def, min, max) {
        var n = parseFloat(s);
        if (isNaN(n)) { n = def; }
        if (min !== undefined && n < min) { n = min; }
        if (max !== undefined && n > max) { n = max; }
        return n;
    }

    function splitList(s) {
        var parts = String(s).split(","), out = [];
        for (var i = 0; i < parts.length; i++) {
            var p = trim(parts[i]);
            if (p !== "") { out.push(p); }
        }
        return out;
    }

    function sd(a, b) { return (b === 0) ? a : a / b; }

    function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\""); }

    // =====================================================================
    // Settings + Style
    // =====================================================================

    function getS(key, def) {
        try {
            if (app.settings.haveSetting(SET, key)) { return app.settings.getSetting(SET, key); }
        } catch (e) {}
        return def;
    }

    function putS(key, val) {
        try { app.settings.saveSetting(SET, key, String(val)); } catch (e) {}
    }

    var DEFAULT_STYLE = {
        primary: "#4285F4",
        secondary: "#8AB4F8",
        periwinkle: "#C5CAE9",
        background: "#F5F7FF",
        glowPink: "#F8C8DC",
        accent: "#EA4335",
        textDark: "#202124",
        textGray: "#9AA0A6",
        gradStart: "#4285F4",
        gradEnd: "#8AB4F8",
        font: "GoogleSans-Regular",
        fontBold: "GoogleSans-Bold",
        curve: "expo",
        duration: "18",
        bounceOn: "1",
        bounceAmt: "10",
        motionBlur: "1"
    };

    var COLOR_KEYS = [
        ["primary", "Primary"], ["secondary", "Secondary"], ["periwinkle", "Periwinkle"],
        ["background", "Background"], ["glowPink", "Pink glow"], ["accent", "Accent (red)"],
        ["textDark", "Dark text"], ["textGray", "Gray text"],
        ["gradStart", "Gradient start"], ["gradEnd", "Gradient end"]
    ];

    var style = {};

    function loadStyle() {
        for (var k in DEFAULT_STYLE) { style[k] = getS("style_" + k, DEFAULT_STYLE[k]); }
    }

    function saveStyle() {
        for (var k in DEFAULT_STYLE) { putS("style_" + k, style[k]); }
    }

    function presetNames() {
        var s = getS("presets", "");
        return (s === "") ? [] : s.split("|");
    }

    function savePreset(name, data) {
        name = trim(name).replace(/[|]/g, "-");
        if (name === "" || name === "Google Vids") { return false; }
        var names = presetNames(), found = false;
        for (var i = 0; i < names.length; i++) { if (names[i] === name) { found = true; } }
        if (!found) { names.push(name); putS("presets", names.join("|")); }
        for (var k in DEFAULT_STYLE) { putS("preset_" + name + "_" + k, data[k]); }
        return true;
    }

    function loadPreset(name) {
        var d = {};
        for (var k in DEFAULT_STYLE) {
            d[k] = (name === "Google Vids") ? DEFAULT_STYLE[k] : getS("preset_" + name + "_" + k, DEFAULT_STYLE[k]);
        }
        return d;
    }

    function deletePreset(name) {
        var names = presetNames(), keep = [];
        for (var i = 0; i < names.length; i++) { if (names[i] !== name) { keep.push(names[i]); } }
        putS("presets", keep.join("|"));
    }

    // ---- colors ----

    function hexToRgb(h) {
        h = trim(h).replace("#", "");
        if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
        var n = parseInt(h, 16);
        if (isNaN(n)) { n = 0; }
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    function rgbToHex(c) {
        function h2(v) { var s = Math.round(v * 255).toString(16).toUpperCase(); return (s.length < 2) ? "0" + s : s; }
        return "#" + h2(c[0]) + h2(c[1]) + h2(c[2]);
    }

    function col(key) { return hexToRgb(style[key]); }
    function c4(c) { return [c[0], c[1], c[2], 1]; }

    // ---- fonts ----

    var FONT_FALLBACKS = [
        ["GoogleSans-Regular", "GoogleSans-Bold"],
        ["ProductSans-Regular", "ProductSans-Bold"],
        ["Inter-Regular", "Inter-Bold"],
        ["Manrope-Regular", "Manrope-Bold"],
        ["DMSans-Regular", "DMSans-Bold"],
        ["Outfit-Regular", "Outfit-Bold"],
        ["ArialMT", "Arial-BoldMT"]
    ];

    // true / false when AE can check (AE 2024+), null when it can't
    function fontInstalled(ps) {
        try {
            if (app.fonts && app.fonts.getFontsByPostScriptName) {
                var r = app.fonts.getFontsByPostScriptName(ps);
                return (r && r.length > 0);
            }
        } catch (e) {}
        return null;
    }

    function pickFont(bold) {
        var want = bold ? style.fontBold : style.font;
        if (fontInstalled(want) !== false) { return want; }
        for (var i = 0; i < FONT_FALLBACKS.length; i++) {
            var f = FONT_FALLBACKS[i][bold ? 1 : 0];
            if (fontInstalled(f) === true) { return f; }
        }
        return want;
    }

    function autoDetectFonts() {
        for (var i = 0; i < FONT_FALLBACKS.length; i++) {
            if (fontInstalled(FONT_FALLBACKS[i][0]) === true) { return FONT_FALLBACKS[i]; }
        }
        return null;
    }

    // =====================================================================
    // Comp, undo, time
    // =====================================================================

    function activeComp() {
        var c = app.project.activeItem;
        if (c && c instanceof CompItem) { return c; }
        alert("Open a composition first (click inside its timeline).", NAME);
        return null;
    }

    function run(label, fn) {
        app.beginUndoGroup(NAME + ": " + label);
        try {
            fn();
        } catch (e) {
            alert(label + " failed:\n" + e.toString() + (e.line ? "\n(line " + e.line + ")" : ""), NAME);
        }
        app.endUndoGroup();
    }

    function animDur(comp) { return num(style.duration, 18, 2, 600) * comp.frameDuration; }

    function selLayers(comp, min, msg) {
        var s = comp.selectedLayers, out = [];
        if (s.length < min) { alert(msg, NAME); return null; }
        for (var i = 0; i < s.length; i++) { out.push(s[i]); }
        return out;
    }

    function stamp(comp) { return String(comp.numLayers + 1); }

    // =====================================================================
    // Values
    // =====================================================================

    function vecLike(prop, x, y) {
        var v = prop.value;
        if (v instanceof Array && v.length === 3) { return [x, y, v[2]]; }
        return [x, y];
    }

    function setXY(prop, x, y) { prop.setValue(vecLike(prop, x, y)); }

    function scaled(v, f) {
        if (!(v instanceof Array)) { return v * f; }
        var o = [];
        for (var i = 0; i < v.length; i++) { o.push(v[i] * f); }
        return o;
    }

    function allZero(v) {
        if (!(v instanceof Array)) { return v === 0; }
        for (var i = 0; i < v.length; i++) { if (v[i] !== 0) { return false; } }
        return true;
    }

    function mb(layer) {
        if (style.motionBlur !== "1") { return; }
        try { layer.motionBlur = true; } catch (e) {}
        try { layer.containingComp.motionBlur = true; } catch (e2) {}
    }

    // =====================================================================
    // Easing + keyframes
    // =====================================================================

    var CURVES = {
        expo:   { first: 90, last: 90 },
        apple:  { first: 18, last: 92 },
        smooth: { first: 66, last: 66 }
    };
    var CURVE_IDS = ["expo", "apple", "smooth"];
    var CURVE_LABELS = ["Expo In/Out", "Apple smooth", "Ease in-out"];

    function curNow() { return CURVES[style.curve] || CURVES.expo; }

    function easeArr(n, inf) {
        var a = [];
        for (var i = 0; i < n; i++) { a.push(new KeyframeEase(0, Math.max(0.1, Math.min(100, inf)))); }
        return a;
    }

    function easeKey(prop, idx, inInf, outInf) {
        try {
            prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        } catch (e0) { return; }
        var counts = [];
        try {
            var v = prop.keyValue(idx);
            counts.push((v instanceof Array) ? v.length : 1);
        } catch (e1) {}
        counts.push(1); counts.push(2); counts.push(3);
        for (var i = 0; i < counts.length; i++) {
            try {
                prop.setTemporalEaseAtKey(idx, easeArr(counts[i], inInf), easeArr(counts[i], outInf));
                break;
            } catch (e2) {}
        }
        if (prop.isSpatial) {
            try { prop.setSpatialTangentsAtKey(idx, [0, 0], [0, 0]); }
            catch (e3) { try { prop.setSpatialTangentsAtKey(idx, [0, 0, 0], [0, 0, 0]); } catch (e4) {} }
        }
    }

    // pairs: [[time, value], ...]
    // opts: curve, mid, eases [[in,out],...], linear, bounce, clamp, isShape
    function setKeys(prop, pairs, opts) {
        opts = opts || {};
        var c = opts.curve || curNow();
        var i;
        for (i = 0; i < pairs.length; i++) { prop.setValueAtTime(pairs[i][0], pairs[i][1]); }
        for (i = 0; i < pairs.length; i++) {
            var idx = prop.nearestKeyIndex(pairs[i][0]);
            if (opts.linear) {
                prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                continue;
            }
            var inf, outf;
            if (opts.eases && opts.eases[i]) {
                inf = opts.eases[i][0]; outf = opts.eases[i][1];
            } else {
                var m = opts.mid || 60;
                inf = (i === pairs.length - 1) ? c.last : m;
                outf = (i === 0) ? c.first : m;
            }
            easeKey(prop, idx, inf, outf);
        }
        if (opts.bounce) {
            try { prop.expression = bounceExpr(!!opts.isShape, !!opts.clamp); } catch (e) {}
        }
    }

    // =====================================================================
    // Live bounce: effect controls on the layer + a spring expression
    // =====================================================================

    function ensureBounce(layer) {
        var fx = layer.property("ADBE Effect Parade");
        if (!fx.property(FX_B)) {
            var c = fx.addProperty("ADBE Checkbox Control");
            c.name = FX_B;
        }
        fx = layer.property("ADBE Effect Parade");
        if (!fx.property(FX_BS)) {
            var s = fx.addProperty("ADBE Slider Control");
            s.name = FX_BS;
        }
        fx = layer.property("ADBE Effect Parade");
        fx.property(FX_B).property(1).setValue(style.bounceOn === "1" ? 1 : 0);
        fx.property(FX_BS).property(1).setValue(num(style.bounceAmt, 10, 1, 60));
    }

    // Spring: e = 1 - exp(-d*p) * cos(2.5*PI*p), lands exactly on the end value.
    // Segments that end at zero (pop out, fade out) are left alone.
    function bounceExpr(isShape, clampZero) {
        var L = [];
        L.push("// Motion Kit live bounce. Toggle with the \"" + FX_B + "\" effect on this layer.");
        L.push("var b = 0, s = 10;");
        L.push("try { b = effect(\"" + FX_B + "\")(1).value; s = effect(\"" + FX_BS + "\")(1).value; } catch (err) {}");
        L.push("var out = value;");
        L.push("if (b != 0 && numKeys >= 2) {");
        L.push("  var i = nearestKey(time).index;");
        L.push("  if (key(i).time > time) { i = i - 1; }");
        L.push("  if (i >= 1 && i < numKeys) {");
        L.push("    var t1 = key(i).time, t2 = key(i + 1).time;");
        L.push("    var p = (time - t1) / (t2 - t1);");
        L.push("    var ov = Math.max(0.01, Math.min(0.6, s / 100));");
        L.push("    var d = -Math.log(ov) / 0.4;");
        L.push("    var e = 1 - Math.exp(-d * p) * Math.cos(2.5 * Math.PI * p);");
        if (isShape) {
            L.push("    var a1 = thisProperty.points(t1), a2 = thisProperty.points(t2);");
            L.push("    if (a1.length == a2.length) {");
            L.push("      var i1 = thisProperty.inTangents(t1), i2 = thisProperty.inTangents(t2);");
            L.push("      var o1 = thisProperty.outTangents(t1), o2 = thisProperty.outTangents(t2);");
            L.push("      var P = [], I = [], O = [];");
            L.push("      for (var k = 0; k < a1.length; k++) {");
            L.push("        P.push([a1[k][0] + (a2[k][0] - a1[k][0]) * e, a1[k][1] + (a2[k][1] - a1[k][1]) * e]);");
            L.push("        I.push([i1[k][0] + (i2[k][0] - i1[k][0]) * e, i1[k][1] + (i2[k][1] - i1[k][1]) * e]);");
            L.push("        O.push([o1[k][0] + (o2[k][0] - o1[k][0]) * e, o1[k][1] + (o2[k][1] - o1[k][1]) * e]);");
            L.push("      }");
            L.push("      out = createPath(P, I, O, thisProperty.isClosed());");
            L.push("    }");
        } else {
            L.push("    var v1 = key(i).value, v2 = key(i + 1).value;");
            L.push("    var toZero = true;");
            L.push("    if (typeof v2 == \"number\") { toZero = (v2 == 0); }");
            L.push("    else { for (var c = 0; c < v2.length; c++) { if (v2[c] != 0) { toZero = false; } } }");
            L.push("    if (!toZero) {");
            L.push("      out = add(v1, mul(sub(v2, v1), e));");
            if (clampZero) {
                L.push("      if (typeof out == \"number\") { out = Math.max(0, out); }");
                L.push("      else { for (var q = 0; q < out.length; q++) { out[q] = Math.max(0, out[q]); } }");
            }
            L.push("    }");
        }
        L.push("  }");
        L.push("}");
        L.push("out;");
        return L.join("\n");
    }

    function hasBounce(layer) {
        try {
            var fx = layer.property("ADBE Effect Parade");
            return !!(fx && fx.property(FX_B) && fx.property(FX_BS));
        } catch (e) { return false; }
    }

    // Applies the footer bounce state to selected layers, or to Motion Kit
    // layers inside selected precomp layers. Returns how many were changed.
    function applyBounceToSelection() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) { return 0; }
        var sel = comp.selectedLayers, targets = [];
        for (var i = 0; i < sel.length; i++) {
            if (hasBounce(sel[i])) {
                targets.push(sel[i]);
            } else if (sel[i].source && sel[i].source instanceof CompItem) {
                var src = sel[i].source;
                for (var j = 1; j <= src.numLayers; j++) {
                    if (hasBounce(src.layer(j))) { targets.push(src.layer(j)); }
                }
            }
        }
        if (targets.length === 0) { return 0; }
        app.beginUndoGroup(NAME + ": Bounce");
        for (var k = 0; k < targets.length; k++) {
            var fx = targets[k].property("ADBE Effect Parade");
            fx.property(FX_B).property(1).setValue(style.bounceOn === "1" ? 1 : 0);
            fx.property(FX_BS).property(1).setValue(num(style.bounceAmt, 10, 1, 60));
        }
        app.endUndoGroup();
        return targets.length;
    }

    // =====================================================================
    // Property search
    // =====================================================================

    function findFirst(group, matchName) {
        if (!group) { return null; }
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === matchName) { return p; }
            if (p.propertyType !== PropertyType.PROPERTY) {
                var r = findFirst(p, matchName);
                if (r) { return r; }
            }
        }
        return null;
    }

    function findAll(group, matchName, out) {
        out = out || [];
        if (!group) { return out; }
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === matchName) { out.push(p); }
            if (p.propertyType !== PropertyType.PROPERTY) { findAll(p, matchName, out); }
        }
        return out;
    }

    function contentsOf(layer) { return layer.property("ADBE Root Vectors Group"); }

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
                var m = /^MK Shape Morph (\d+)$/.exec(app.project.item(i).name);
                if (m) { n = Math.max(n, parseInt(m[1], 10) + 1); }
            }
            var nc = comp.layers.precompose([src.index, tgt.index], "MK Shape Morph " + n, true);
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

    // Swipe cut = a small rig of three linked nulls (the same set-up you would build by hand):
    //   MK Swipe · Move  a short null around the cut; its Position is the only thing animated (0.9 / 0.1 ease, one key each end)
    //   MK Swipe · Out   child of Move, holds the outgoing clip (runs up to the cut)
    //   MK Swipe · In    child of Move, offset by the swipe distance, holds the incoming clip (runs from the cut)
    // Move slides that distance, so the old clip leaves while the new one enters, and the hard cut happens mid-whoosh.
    // Anchor and position of the nulls are both (0,0), so linking a clip does not move it.
    // cubic-bezier (0.9, 0, 0.1, 1): the ease the hand-made version's Move keys actually hold (measured from its
    // Position values: 36.6% of the move done one frame before the cut, 63.4% on the cut frame). Slow, very fast in the
    // middle where the cut hides, slow again.
    var SWIPE_CURVE = [0.9, 0, 0.1, 1];

    function topParent(L) {
        while (L.parent) { L = L.parent; }
        return L;
    }

    function swipeNull(comp, name, t0, t1) {
        var n = comp.layers.addNull();
        n.name = name;
        setXY(n.transform.anchorPoint, 0, 0);
        setXY(n.transform.position, 0, 0);
        try { n.inPoint = Math.max(0, t0); n.outPoint = Math.min(comp.duration, t1); } catch (e) {}
        return n;
    }

    function doSwipeCut(dir, o) {
        var comp = activeComp(); if (!comp) { return; }
        var ctx = transitionContext(comp, true); if (!ctx) { return; }
        var fr = comp.frameDuration, cut = ctx.cut, outL = ctx.outL, inL = ctx.inL;
        // The whoosh is short: the move is a % of the frame (default 27%, about 520 px on 1920), so both clips stay
        // on screen. The keys sit N+1 frames before the cut and N after, so the middle of the move falls half a frame
        // before the cut and the last outgoing frame / first incoming frame are mirror images of each other.
        var t0 = cut - (o.frames + 1) * fr, t1 = cut + o.frames * fr;
        var dist = ((dir[0] !== 0) ? comp.width : comp.height) * o.distance / 100, off = [dir[0] * dist, dir[1] * dist];

        // Link the top of each clip's parent chain, so clips that already have parents keep their hierarchy
        var rootOut = topParent(outL), rootIn = topParent(inL);
        if (rootOut === rootIn) {
            alert("Both clips share the same parent layer, so they can't be moved apart. Unparent one of them first.", NAME);
            return;
        }

        // Hard cut: the outgoing clip ends and the incoming clip starts exactly at the cut, so the two never overlap
        try { if (outL.outPoint > cut) { outL.outPoint = cut; } } catch (e0) {}
        try { if (inL.inPoint < cut) { inL.inPoint = cut; } } catch (e1) {}

        var move = swipeNull(comp, "MK Swipe · Move", t0, t1);
        var outN = swipeNull(comp, "MK Swipe · Out", outL.inPoint, cut);
        var inN = swipeNull(comp, "MK Swipe · In", cut, inL.outPoint);
        // Link everything first, while all three nulls are still at rest (0,0). Assigning .parent makes AE shift
        // the child's own position so it doesn't jump, which would cancel the offset if it were already set.
        outN.parent = move;
        inN.parent = move;
        rootOut.parent = outN;
        rootIn.parent = inN;
        // Only now push In one screen away (the clips ride along with it)
        setXY(inN.transform.position, -off[0], -off[1]);

        // Position is the only animation: rest -> the swipe distance, 0.9 / 0.1 ease on both ends
        setKeys(move.transform.position, [[t0, vecLike(move.transform.position, 0, 0)], [t1, vecLike(move.transform.position, off[0], off[1])]]);
        easeBetweenKeys(move.transform.position, t0, t1, SWIPE_CURVE);

        // Neat stack: each link null sits on its clip, the move null on top
        outN.moveBefore(outL);
        inN.moveBefore(inL);
        move.moveBefore(outN.index < inN.index ? outN : inN);

        mb(outL); mb(inL);
        if (o.blur > 0 && style.motionBlur === "1") {
            try { if (comp.shutterAngle < o.blur) { comp.shutterAngle = Math.min(720, o.blur); } } catch (e) {}
        }
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

        var sp = shapeLayer(comp, "MK Sparkle");
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
        bloom.name = "MK Bloom · " + label;
        clearEffects(bloom);
        var gb = fxAdd(bloom, "ADBE Gaussian Blur 2");
        fxSet(gb, 1, 80);
        bloom.transform.opacity.expression = "60 + Math.sin(time * 2 * Math.PI * 0.5) * 20;";
        bloom.moveAfter(p.pill);

        var nul = addNull(comp, "MK AI Button · " + label, [pos[0], pos[1]]);
        p.pill.parent = nul;
        bloom.parent = nul;
        setKeys(nul.transform.scale, [[t, [0, 0]], [t + d * 0.6, [108, 108]], [t + d, [100, 100]]]);
        nul.transform.scale.expression = "var w = wiggle(0.8, 1.5)[0] - value[0];\n[value[0] + w, value[1] + w];";
    }

    // ---- fake cursor ----

    function findCursor(comp) {
        var sel = comp.selectedLayers;
        if (sel.length > 0) { return sel[0]; }
        for (var i = 1; i <= comp.numLayers; i++) { if (/^MK Cursor/.test(comp.layer(i).name)) { return comp.layer(i); } }
        return null;
    }

    function doAddCursor() {
        var comp = activeComp(); if (!comp) { return; }
        var L = shapeLayer(comp, "MK Cursor");
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
        var ring = shapeLayer(comp, "MK Click Ripple");
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

        var pill = shapeLayer(comp, "MK Avatar Pill");
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
            amp.name = "MK Audio Amplitude " + stamp(comp);
            ampName = amp.name;
        }
        var N = o.bars, barW = 12, spacing = 20, minH = 12, maxH = o.maxH;
        var L = shapeLayer(comp, "MK Waveform");
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
        txt.name = "MK Glass Label · " + label;
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

        var outer = ring("MK Glass · Outer", w + 96, h + 96, 22, 55);
        softShadow(outer);
        makeFrosted(comp, outer, 36);
        var middle = ring("MK Glass · Middle", w + 46, h + 46, 32, 65);
        var inner = ring("MK Glass · Inner", w, h, 85, 90);
        softShadow(inner);

        var icon = shapeLayer(comp, "MK Glass · Play Icon");
        var gi = newGroup(icon, "Play");
        addStar(icon, gi, 2, 3, iconW / 2, 0, 90);
        addFill(icon, gi, col("primary"), 100);
        var left = cx - (tw + iconW + gapI) / 2;
        setXY(icon.transform.position, left + iconW / 2, cy);
        anchorTo(txt, "center", t);
        setXY(txt.transform.position, left + iconW + gapI + tw / 2, cy);
        txt.moveBefore(icon);

        var nul = addNull(comp, "MK Glass Button · " + label, [cx, cy]);
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
        var g = app.project.items.addComp("MK Media Grid", W, H, comp.pixelAspect, dur, comp.frameRate);
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
        gl.name = "MK Media Grid";
        mb(gl);
    }

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

    // =====================================================================
    // TEXT GROUP — animation presets (.ffx) embedded in the script
    // =====================================================================
    // build.js fills this from presets/text/*.ffx (base64), so dist/RupaMotion.jsx stays the only file to install.
    var TEXT_PRESETS = [
        { name: "1by1", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYBAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAA" +
            "BAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAbGRhdAAAAGAAAAAAAQEAAMBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIYAAQEAAEBZAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoQAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAowEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIw" +
            "MjUtMDctMDNUMTI6MDI6NDkrMDU6MzA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA3" +
            "LTAzVDEyOjAyOjQ5KzA1OjMwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyNS0wNy0wM1Qx" +
            "MjowMjo0OSswNTozMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6YmE2YWQ2MDEt" +
            "MWQ1Zi0zODQ4LThhOTMtNzZmMzAzMjY2NGU1PC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54" +
            "bXAuZGlkOmJhNmFkNjAxLTFkNWYtMzg0OC04YTkzLTc2ZjMwMzI2NjRlNTwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHht" +
            "cE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOmJhNmFkNjAxLTFkNWYtMzg0OC04YTkzLTc2ZjMwMzI2NjRlNTwveG1wTU06" +
            "T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAg" +
            "ICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNy" +
            "ZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDpiYTZhZDYwMS0x" +
            "ZDVmLTM4NDgtOGE5My03NmYzMDMyNjY0ZTU8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVu" +
            "PjIwMjUtMDctMDNUMTI6MDI6NDkrMDU6MzA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFn" +
            "ZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAg" +
            "IDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgPC9yZGY6RGVz" +
            "Y3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0i" +
            "dyI/Pg==" },
        { name: "Bounce text", data: "UklGWAAAJXhGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYBAAAATElTVAAAJVRiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAACsdGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAAkxJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBFZmZlY3QgUGFyYWRlAAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBHZW9tZXRyeTIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAAS" +
            "VXRmOAAAAAlUcmFuc2Zvcm0ATElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/" +
            "////dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAI85zc3BjZm5hbQAAABJVdGY4" +
            "AAAACVRyYW5zZm9ybQBMSVNUAAALqHBhclRwYXJuAAAABAAAAA50ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////" +
            "/wAAAAAPAAAAAAAAAKzDhNp0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDEAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAA" +
            "AAAAAAAAAAAAAAAAAAZBbmNob3IgUG9pbnQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAgAAAAAAAADIAAAAyAAAA" +
            "AAAAAAAAAAAAAAABvgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAAPAAAAAAAAAKzDhNp0ZG1u" +
            "AAAAKEFEQkUgR2VvbWV0cnkyLTAwMDIAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAAZQb3NpdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAgUsAAAAAADIAAAAyAAAAAAAAAAAAAAAAAAABvgAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAAPAAAAAAAAAKzDhNp0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAw" +
            "MTEAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAEAAAAAAAAAAAQEAAAAAAAAAADIAAAAyAAAAAAAAAAAAAAAAAAABvgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAA/////wAAAAAPAAAAAAAAAKzDhNpwZG5tAAAAFlV0ZjgAAAANVW5pZm9ybSBTY2FsZQB0ZG1uAAAAKEFEQkUgR2Vv" +
            "bWV0cnkyLTAwMDMAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAAJTY2FsZSBIZWlnaHQAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAACAAAAAAAGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAACK0AAAdTAAAP84AAAAyAAAAGQAAAABAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAgAAAAAAAAAAJTY2FsZSBXaWR0aAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAA" +
            "AGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACK0AAAdTAA" +
            "AP84AAAAyAAAAGQAAAABAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDUAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAA" +
            "AAAAAAAAAAAAAAAAAAJTa2V3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/ugAAAEYAAP+6AAAARgAAAAAAAAABAAB0ZG1u" +
            "AAAAKEFEQkUgR2VvbWV0cnkyLTAwMDYAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAANTa2V3IEF4" +
            "aXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/ugAAAEYAAP+6AAAARgAAAAAAAAABAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAw" +
            "MDcAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAANSb3RhdGlvbgAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAD/ugAAAEYAAP+6AAAARgAAAAAAAAABAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDgAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABwYXJkAAAAlAAAAAAAAAAAAAAAAAAAAAJPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFu0VwAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQAAAAAAAAAZAAA" +
            "AGQAAAABAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDkAAAAAAAAAAAAAAAAAAAAAAAAAAABwYXJkAAAAlAAAAAAAAAAAAAAA" +
            "AAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQAAAAAAAAAZAAAAGQAAAABAABwZG5tAAAAKlV0ZjgA" +
            "AAAhVXNlIENvbXBvc2l0aW9u4oCZcyBTaHV0dGVyIEFuZ2xlAHRkbW4AAAAoQURCRSBHZW9tZXRyeTItMDAxMAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAHBhcmQAAACUAAAAAAAAAAAAAAAAAAAAAlNodXR0ZXIgQW5nbGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABaAAA" +
            "AAAAAAFoAAAAAAAAAAIAAHRkbW4AAAAoQURCRSBHZW9tZXRyeTItMDAxMgAAAAAAAAAAAAAAAAAAAAAAAAAAAHBhcmQAAACUAAAA" +
            "AAAAAAAAAAAAAAAAB1NhbXBsaW5nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAABAAIAAQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABaAAAAAAAAAFoAAAAAAAAAAIAAHBkbm0A" +
            "AAAYVXRmOAAAABBCaWxpbmVhcnxCaWN1YmljdGRtbgAAAChBREJFIEVmZmVjdCBCdWlsdCBJbiBQYXJhbXMAAAAAAAAAAAAAAAAA" +
            "cGFyZAAAAJQAAAAAAAAAAAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAF+B0ZGdwdGRzYgAAAAQAAAABdGRzbgAAABJVdGY4AAAACVRyYW5zZm9ybQB0ZG1uAAAAKEFEQkUgR2VvbWV0" +
            "cnkyLTAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA7HRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAACFV0ZjgAAAAAdGRiNAAA" +
            "AHzbmQABAAEAAAABAAAAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAACA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRwaQAAAAQAAA6/dGRwcwAAAAQAAAAAdGRtbgAAAChBREJFIEdlb21ldHJ5Mi0wMDAx" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAOh0ZGJzdGRzYgAAAAQAAAABdGRzbgAAABRVdGY4AAAADEFuY2hvciBQb2ludHRk" +
            "YjQAAAB825kAAgAPAAP/////AAB4AD2bfN/Z1728P+IAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBgAAAAAAAAAA" +
            "AAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAwP+AAAAAAAAA/4AAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIEdlb21ldHJ5Mi0wMDAyAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAA7J0ZGJzdGRzYgAAAAQAAAABdGRzbgAAABBVdGY4AAAACFBvc2l0aW9udGRiNAAAAHzbmQACAA4AA///" +
            "//8AAHgAPZt839nXvbw/4gAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQGAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAATElTVAAAARhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAAB" +
            "AAAAaAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAbGRhdAAAANAAAAAAAQEABwAAAAEAAAAAP68zMzMzMzAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAAAAAAAAP+HzMzMzMzMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "DgABAQAHAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/FVVVVVyp1P+AAAAAAAAA/4AAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVXRmOAAAAd5hbXAgPSAwLjA0OwpmcmVxID0gMS44OwpkZWNheSA9IDM7Cm4gPSAw" +
            "Owp0aW1lX21heCA9IDM7CmlmIChudW1LZXlzID4gMCkgewogICAgbiA9IG5lYXJlc3RLZXkodGltZSkuaW5kZXg7CiAgICBpZiAo" +
            "a2V5KG4pLnRpbWUgPiB0aW1lKSB7CiAgICAgICAgbi0tOwogICAgfQp9CmlmIChuID09IDApIHsKICAgIHQgPSAwOwp9IGVsc2Ug" +
            "ewogICAgdCA9IHRpbWUgLSBrZXkobikudGltZTsKfQppZiAobiA+IDAgJiYgdCA8IHRpbWVfbWF4KSB7CiAgICB2ID0gdmVsb2Np" +
            "dHlBdFRpbWUoa2V5KG4pLnRpbWUgLSB0aGlzQ29tcC5mcmFtZUR1cmF0aW9uIC8gMTApOwogICAgZWFzZUZhY3RvciA9IGVhc2VP" +
            "dXQodCwgMCwgdGltZV9tYXgsIDEsIDApOwogICAgdmFsdWUgKyB2ICogYW1wICogTWF0aC5zaW4oZnJlcSAqIHQgKiAyICogTWF0" +
            "aC5QSSkgLyBNYXRoLmV4cChkZWNheSAqIHQpICogZWFzZUZhY3RvcjsKfSBlbHNlIHsKICAgIHZhbHVlOwp9dGRtbgAAAChBREJF" +
            "IEdlb21ldHJ5Mi0wMDExAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAOJ0ZGJzdGRzYgAAAAQAAAABdGRzbgAAABZVdGY4AAAA" +
            "DVVuaWZvcm0gU2NhbGUAdGRiNAAAAHzbmQABAAEAAAABAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIEdlb21ldHJ5Mi0wMDAzAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABVNjYWxlAHRkYjQAAAB825kA" +
            "AQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBgAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwGkAAAAAAAB0ZHVNAAAACEBpAAAAAAAAdGRtbgAAAChBREJFIEdlb21ldHJ5Mi0w" +
            "MDA0AAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPZ0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAApVdGY4AAAAASAAdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQGAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAaQAAAAAAAHRkdU0AAAAIQGkAAAAAAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnky" +
            "LTAwMDUAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+HRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADFV0ZjgAAAAEU2tld3RkYjQA" +
            "AAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBgAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFGAAAAAAAB0ZHVNAAAACEBRgAAAAAAAdGRtbgAAAChBREJFIEdlb21l" +
            "dHJ5Mi0wMDA2AAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAN50ZGJzdGRzYgAAAAQAAAABdGRzbgAAABJVdGY4AAAACVNrZXcg" +
            "QXhpcwB0ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAYA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA3HRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAAEFV0ZjgAAAAIUm90YXRpb250ZGI0AAAAfNuZAAEAAQAA////" +
            "/wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMDgAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAADYnRkYnN0ZHNi" +
            "AAAABAAAAAF0ZHNuAAAAEFV0ZjgAAAAHT3BhY2l0eQB0ZGI0AAAAfNuZAAEAAAAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAYAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAEAAABMSVNUAAAAqGxpc3RsaGQzAAAANADQC+4AAAAAAAAAAgAAAAEAAAAwAAAABAAAAAEAAAAEAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABsZGF0AAAAYAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgABAQAA" +
            "QFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/xVVVVVcqdVV0ZjgAAAHeYW1wID0gMC4wNDsKZnJlcSA9IDEuODsKZGVj" +
            "YXkgPSAzOwpuID0gMDsKdGltZV9tYXggPSAzOwppZiAobnVtS2V5cyA+IDApIHsKICAgIG4gPSBuZWFyZXN0S2V5KHRpbWUpLmlu" +
            "ZGV4OwogICAgaWYgKGtleShuKS50aW1lID4gdGltZSkgewogICAgICAgIG4tLTsKICAgIH0KfQppZiAobiA9PSAwKSB7CiAgICB0" +
            "ID0gMDsKfSBlbHNlIHsKICAgIHQgPSB0aW1lIC0ga2V5KG4pLnRpbWU7Cn0KaWYgKG4gPiAwICYmIHQgPCB0aW1lX21heCkgewog" +
            "ICAgdiA9IHZlbG9jaXR5QXRUaW1lKGtleShuKS50aW1lIC0gdGhpc0NvbXAuZnJhbWVEdXJhdGlvbiAvIDEwKTsKICAgIGVhc2VG" +
            "YWN0b3IgPSBlYXNlT3V0KHQsIDAsIHRpbWVfbWF4LCAxLCAwKTsKICAgIHZhbHVlICsgdiAqIGFtcCAqIE1hdGguc2luKGZyZXEg" +
            "KiB0ICogMiAqIE1hdGguUEkpIC8gTWF0aC5leHAoZGVjYXkgKiB0KSAqIGVhc2VGYWN0b3I7Cn0gZWxzZSB7CiAgICB2YWx1ZTsK" +
            "fXRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIEdlb21ldHJ5Mi0wMDA5AAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPZ0ZGJzdGRzYgAAAAQAAAABdGRzbgAAACpVdGY4AAAAIVVzZSBDb21wb3NpdGlvbuKAmXMgU2h1dHRlciBB" +
            "bmdsZQB0ZGI0AAAAfNuZAAEAAQAAAAEABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR2VvbWV0cnkyLTAwMTAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABAnRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAAFlV0ZjgAAAANU2h1dHRlciBBbmdsZQB0ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAYAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAdoAAAAAAAHRkbW4AAAAoQURCRSBHZW9tZXRyeTItMDAx" +
            "MgAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADcdGRic3Rkc2IAAAAEAAAAAXRkc24AAAAQVXRmOAAAAAhTYW1wbGluZ3RkYjQA" +
            "AAB825kAAQABAAAAAQAEAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBFZmZlY3QgQnVpbHQgSW4gUGFyYW1zAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAM2dGRncHRkc2IAAAAEAAAAAXRkc24AAAAcVXRmOAAAABNDb21wb3NpdGluZyBPcHRpb25zAHRkbW4AAAAoQURCRSBFZmZl" +
            "Y3QgTWFzayBQYXJhZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABWdGRncHRkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgRWZmZWN0IE1hc2sg" +
            "T3BhY2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgRm9yY2Ug" +
            "Q1BVIEdQVQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIEdyb3VwIEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIEdyb3VwIEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcGd1aQAAABAAAAAAAAAAAAAAAAAAAAAA" +
            "PD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJh" +
            "ZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4wLWMwMDEgMTUyLmRlYjk1ODUsIDIwMjQvMDIvMDYtMDg6" +
            "MzY6MTAgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3lu" +
            "dGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8v" +
            "cHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgICAgICAgICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8x" +
            "LjAvIgogICAgICAgICAgICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgICAgICAgICAg" +
            "eG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyI+CiAgICAgICAgIDxk" +
            "Yzpmb3JtYXQ+YXBwbGljYXRpb24vdm5kLmFkb2JlLmFmdGVyZWZmZWN0cy5wcmVzZXQtYW5pbWF0aW9uPC9kYzpmb3JtYXQ+CiAg" +
            "ICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+QWRvYmUgQWZ0ZXIgRWZmZWN0cyAyMDI0IChXaW5kb3dzKTwveG1wOkNyZWF0b3JUb29s" +
            "PgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAyNS0wNy0wM1QxMjowNTowMyswNTozMDwveG1wOkNyZWF0ZURhdGU+CiAgICAg" +
            "ICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjUtMDctMDNUMTI6MDU6MDMrMDU6MzA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAg" +
            "IDx4bXA6TW9kaWZ5RGF0ZT4yMDI1LTA3LTAzVDEyOjA1OjAzKzA1OjMwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1N" +
            "Okluc3RhbmNlSUQ+eG1wLmlpZDpkMWJhY2YwOC0xZDQ3LTE1NGMtYjY1Ny04NjBlMjNkOWQyNGI8L3htcE1NOkluc3RhbmNlSUQ+" +
            "CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElEPnhtcC5kaWQ6ZDFiYWNmMDgtMWQ0Ny0xNTRjLWI2NTctODYwZTIzZDlkMjRiPC94" +
            "bXBNTTpEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06T3JpZ2luYWxEb2N1bWVudElEPnhtcC5kaWQ6ZDFiYWNmMDgtMWQ0Ny0x" +
            "NTRjLWI2NTctODYwZTIzZDlkMjRiPC94bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpIaXN0b3J5Pgog" +
            "ICAgICAgICAgICA8cmRmOlNlcT4KICAgICAgICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAg" +
            "ICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+Y3JlYXRlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6" +
            "aW5zdGFuY2VJRD54bXAuaWlkOmQxYmFjZjA4LTFkNDctMTU0Yy1iNjU3LTg2MGUyM2Q5ZDI0Yjwvc3RFdnQ6aW5zdGFuY2VJRD4K" +
            "ICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAyNS0wNy0wM1QxMjowNTowMyswNTozMDwvc3RFdnQ6d2hlbj4KICAgICAg" +
            "ICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgQWZ0ZXIgRWZmZWN0cyAyMDI0IChXaW5kb3dzKTwvc3RFdnQ6" +
            "c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOlNlcT4KICAgICAgICAgPC94" +
            "bXBNTTpIaXN0b3J5PgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAo8P3hwYWNrZXQgZW5kPSJ3Ij8+" },
        { name: "Bouncing Text HQ", data: "UklGWAAAjExGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYAAAAATElTVAAAjChiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABB4AEOD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAilp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAYHHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE250ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBJbmRleCBTdGFydAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQN9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBJbmRleCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQN9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBJbmRleCBPZmZzZXQAAAAAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjA30AAAAAAAHRkdU0AAAAIQN9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBBZHZhbmNlZAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAALqnRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgUmFuZ2Ug" +
            "VW5pdHMAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIFR5cGUyAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNb2RlAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3Ig" +
            "TWF4IEFtb3VudAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFu" +
            "Z2UgU2hhcGUAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVjdG9yIFNtb290aG5lc3MAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IExldmVscyBNYXggRWFzZQAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IExldmVscyBNaW4gRWFzZQAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmRvbWl6ZSBP" +
            "cmRlcgAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAA//8ABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5kb20gU2VlZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQMOIAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBFeHByZXNzaWJs" +
            "ZSBTZWxlY3RvcgAAAAAAAAAAAABMSVNUAAAD6HRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAAHlV0ZjgAAAAVRXhwcmVzc2lvbiBTZWxl" +
            "Y3RvciAxAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIFR5cGUyAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAE" +
            "AAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBF" +
            "eHByZXNzaWJsZSBBbW91bnQAAAAAAAAAAAAAAABMSVNUAAACOHRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAY2RhdAAAAHhAWQAAAAAAAEBZ" +
            "AAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVdGY4AAAA5WRlbGF5ID0gLjA2MCA7DW15RGVsYXkgPSBkZWxheSp0" +
            "ZXh0SW5kZXg7DXQgPSAodGltZSAtIGluUG9pbnQpIC0gbXlEZWxheTsNaWYgKHQgPj0gMCl7DcKgwqBmcmVxID0yOw3CoMKgYW1w" +
            "bGl0dWRlID0gNTA7DcKgwqBkZWNheSA9IDguMDsNwqDCoHMgPSBhbXBsaXR1ZGUqTWF0aC5jb3MoZnJlcSp0KjIqTWF0aC5QSSkv" +
            "TWF0aC5leHAoZGVjYXkqdCk7DcKgwqBbcyxzXQ19ZWxzZXsNwqDCoHZhbHVlDX0AdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5k" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBBbmltYXRvciBQcm9wZXJ0aWVzAAAAAAAAAAAAAABM" +
            "SVNUAABxdHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgQW5jaG9yIFBvaW50" +
            "IDNEAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AwAPAAP/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUG9zaXRp" +
            "b24gM0QAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAwAPAAP/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABIwDYAAAAAAABANwAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQg" +
            "U2NhbGUgM0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAUp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAwABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAB4AAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA30AAAAAAAHRkdU0AAAAIQN9AAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBTa2V3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "AChAQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAUYAAAAAAAHRkdU0AAAAIQFGAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgVGV4dCBTa2V3IEF4aXMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUm90YXRpb24g" +
            "WAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uIFkAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBSb3RhdGlvbgAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChARgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgT3BhY2l0eQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgRmlsbCBP" +
            "cGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQg" +
            "U3Ryb2tlIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IFRleHQgRmlsbCBDb2xvcgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAB" +
            "AQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/g" +
            "AAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgU3Ryb2tlIENvbG9yAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgRmlsbCBIdWUA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBGaWxsIFNhdHVyYXRpb24AAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgU2F0dXJhdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEJyaWdodG5lc3MAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAB" +
            "EnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEh1ZQAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "dW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBCcmlnaHQAAAAAAAAAAAAAAAAA" +
            "AAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8a" +
            "NuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBPcGFjaXR5AAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////" +
            "AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBBbWJpZW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBE" +
            "aWZmdXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBG" +
            "cm9udCBTcGVjdWxhcgAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNE" +
            "VGV4dCBGcm9udCBTaGluaW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1f" +
            "MF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChB" +
            "REJFIDNEVGV4dCBGcm9udCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4" +
            "AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAA" +
            "AAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAo" +
            "QFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRt" +
            "bgAAAChBREJFIDNEVGV4dCBGcm9udCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAA" +
            "AA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNk" +
            "YXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAA" +
            "AAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAAD" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAA" +
            "CEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIP/AAAAAAAAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBSR0IAAAAAAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAARJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBIdWUAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgU2F0AAAAAAAAAAAA" +
            "AAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA////" +
            "/wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgQnJpZ2h0" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwg" +
            "T3BhY2l0eQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQg" +
            "QmV2ZWwgQW1iaWVudAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmV2ZWwgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgQmV2ZWwgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KEBJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRk" +
            "bW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgU2hpbmluZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKEAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAA" +
            "AAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAA" +
            "AAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IA" +
            "AAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAA" +
            "dGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRi" +
            "c3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAA" +
            "AAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgRnJlc25lbAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgWHBhcmVuY3kAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgWHBhclJvbGwAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgSU9SAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBSR0IA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAA" +
            "AAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUg" +
            "U2F0AAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IFNpZGUgQnJpZ2h0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IFNpZGUgT3BhY2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IFNpZGUgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "AChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0A" +
            "AAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNi" +
            "AAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAA" +
            "AHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgR2xvc3MAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgRnJlc25lbAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgWHBhcmVuY3kA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgWHBh" +
            "clJvbGwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNp" +
            "ZGUgSU9SAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAA" +
            "AEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCYWNrIFNhdAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCYWNrIEJyaWdodAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIEFtYmllbnQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIERpZmZ1c2UAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFNwZWN1bGFyAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "AAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFNoaW5pbmVzcwAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "dW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIE1ldGFsAAAAAAAAAAAAAAAAAAAA" +
            "AAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8a" +
            "NuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFJlZmxlY3Rpb24AAAAA" +
            "AAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//" +
            "AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIEdsb3NzAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIEZy" +
            "ZXNuZWwAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBC" +
            "YWNrIFhwYXJlbmN5AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNE" +
            "VGV4dCBCYWNrIFhwYXJSb2xsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1f" +
            "MF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChB" +
            "REJFIDNEVGV4dCBCYWNrIElPUgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4" +
            "AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAA" +
            "AAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAo" +
            "P/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAAAAB0ZHVNAAAACEAAAAAAAAAAdGRt" +
            "bgAAAChBREJFIDNEVGV4dCBCZXZlbCBEZXB0aAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAA" +
            "AA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNk" +
            "YXQAAAAoQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEAkAAAA" +
            "AAAAdGRtbgAAAChBREJFIDNEVGV4dCBFeHRydWRlIERlcHRoAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAAD" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAA" +
            "CECPQAAAAAAAdGRtbgAAAChBREJFIFRleHQgU3Ryb2tlIFdpZHRoAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwI9AAAAAAAB0" +
            "ZHVNAAAACECPQAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGluZSBBbmNob3IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2sgVHlwZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "ANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAEAAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4A" +
            "AAAoQURCRSBUZXh0IFRyYWNraW5nIEFtb3VudAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAA" +
            "AHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBDaGFuZ2UgVHlwZQAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0" +
            "ZXIgUmFuZ2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAACAAAAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVyIFJlcGxhY2UAAAAAAAAAAAAAAAAATElT" +
            "VAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "dW0AAAAIwO//4AAAAAB0ZHVNAAAACEDv/+AAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVyIE9mZnNldAAAAAAAAAAAAAAA" +
            "AAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8a" +
            "NuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkdW0AAAAIwO//4AAAAAB0ZHVNAAAACEDv/+AAAAAAdGRtbgAAAChBREJFIFRleHQgTGluZSBTcGFjaW5nAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAgABAAAAAv//" +
            "AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA" +
            "30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEJsdXIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAEidGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAIAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQMOIAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5k" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8" +
            "P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFk" +
            "b2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA5LjAtYzAwMSAxNTIuZGViOTU4NSwgMjAyNC8wMi8wNi0wODoz" +
            "NjoxMCAgICAgICAgIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50" +
            "YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6ZGM9Imh0dHA6Ly9w" +
            "dXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEu" +
            "MC8iCiAgICAgICAgICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgICAgICAgICB4" +
            "bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIj4KICAgICAgICAgPGRj" +
            "OmZvcm1hdD5hcHBsaWNhdGlvbi92bmQuYWRvYmUuYWZ0ZXJlZmZlY3RzLnByZXNldC1hbmltYXRpb248L2RjOmZvcm1hdD4KICAg" +
            "ICAgICAgPHhtcDpDcmVhdG9yVG9vbD5BZG9iZSBBZnRlciBFZmZlY3RzIDIwMjQgKE1hY2ludG9zaCk8L3htcDpDcmVhdG9yVG9v" +
            "bD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIwMjUtMDktMDJUMTY6MjY6NTQrMDE6MDA8L3htcDpDcmVhdGVEYXRlPgogICAg" +
            "ICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA5LTAyVDE2OjI2OjU0KzAxOjAwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAg" +
            "ICA8eG1wOk1vZGlmeURhdGU+MjAyNS0wOS0wMlQxNjoyNjo1NCswMTowMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBN" +
            "TTpJbnN0YW5jZUlEPnhtcC5paWQ6NTc0NjVlYzQtZTE1NS00MzQyLTliMzUtNjVlYjM4MzJjMGJhPC94bXBNTTpJbnN0YW5jZUlE" +
            "PgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54bXAuZGlkOjU3NDY1ZWM0LWUxNTUtNDM0Mi05YjM1LTY1ZWIzODMyYzBiYTwv" +
            "eG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjU3NDY1ZWM0LWUxNTUt" +
            "NDM0Mi05YjM1LTY1ZWIzODMyYzBiYTwveG1wTU06T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4K" +
            "ICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAg" +
            "ICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNyZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0" +
            "Omluc3RhbmNlSUQ+eG1wLmlpZDo1NzQ2NWVjNC1lMTU1LTQzNDItOWIzNS02NWViMzgzMmMwYmE8L3N0RXZ0Omluc3RhbmNlSUQ+" +
            "CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMjUtMDktMDJUMTY6MjY6NTQrMDE6MDA8L3N0RXZ0OndoZW4+CiAgICAg" +
            "ICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoTWFjaW50b3NoKTwvc3RF" +
            "dnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOlNlcT4KICAgICAgICAg" +
            "PC94bXBNTTpIaXN0b3J5PgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAo8P3hwYWNrZXQgZW5kPSJ3Ij8+" },
        { name: "Bouncy Color FadeOut HQ", data: "UklGWAABFCRGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYAAAAATElTVAABFABiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABB4AEOD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAPR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAADTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIFRleHQgUHJvcGVydGllcwAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAEB0ZHNpdGRpeAAAAAT/////dGRt" +
            "bgAAAChBREJFIFRleHQgQW5pbWF0b3JzAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAEB0ZHNpdGRpeAAAAAQAAAABdGRtbgAA" +
            "AChBREJFIFRleHQgQW5pbWF0b3IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRzbgAAABJVdGY4AAAACkFuaW1hdG9yIDJMSVNUAAAA" +
            "ZHRkc3B0ZG90AAAABP////90ZHBsAAAABAAAAAFMSVNUAAAAQHRkc2l0ZGl4AAAABP////90ZG1uAAAAKEFEQkUgRW5kIG9mIHBh" +
            "dGggc2VudGluZWwAAAAAAAAAAAAAAAAAAABMSVNUAACKWnRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAAElV0ZjgAAAAKQW5pbWF0b3Ig" +
            "MXRkbW4AAAAoQURCRSBUZXh0IFNlbGVjdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAABgcdGRncHRkc2IAAAAEAAAAAXRk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcgAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAT" +
            "bnRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAAGFV0ZjgAAAAQUmFuZ2UgU2VsZWN0b3IgMXRkbW4AAAAoQURCRSBUZXh0IFBlcmNlbnQg" +
            "U3RhcnQAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFBl" +
            "cmNlbnQgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFBlcmNlbnQgT2Zmc2V0AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEV4cHJlc3NpYmxlIFNlbGVjdG9yAAAAAAAAAAAAAExJ" +
            "U1QAAAPodGRncHRkc2IAAAAEAAAAAXRkc24AAAAeVXRmOAAAABVFeHByZXNzaW9uIFNlbGVjdG9yIDEAdGRtbgAAAChBREJFIFRl" +
            "eHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1f" +
            "MF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEV4cHJlc3NpYmxlIEFtb3VudAAAAAAA" +
            "AAAAAAAAAExJU1QAAAI4dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAMAAQAAAAL//wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAABjZGF0AAAAeEBZAAAAAAAAQFkAAAAAAABAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAFV0ZjgAAADlZGVsYXkgPSAuMDYwIDsNbXlEZWxheSA9IGRlbGF5KnRleHRJbmRleDsNdCA9ICh0aW1lIC0g" +
            "aW5Qb2ludCkgLSBteURlbGF5Ow1pZiAodCA+PSAwKXsNwqDCoGZyZXEgPTI7DcKgwqBhbXBsaXR1ZGUgPSA1MDsNwqDCoGRlY2F5" +
            "ID0gOC4wOw3CoMKgcyA9IGFtcGxpdHVkZSpNYXRoLmNvcyhmcmVxKnQqMipNYXRoLlBJKS9NYXRoLmV4cChkZWNheSp0KTsNwqDC" +
            "oFtzLHNdDX1lbHNlew3CoMKgdmFsdWUNfQB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBHcm91" +
            "cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAA" +
            "AXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo2" +
            "4uscQy0//HHHHHHHHD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEhAOwAAAAAAAEA3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBAgAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcg" +
            "QXhpcwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGRtbgAAAChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9u" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBGAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcA" +
            "AAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGRtbgAAAChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0" +
            "dXJhdGlvbgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0" +
            "cm9rZSBTYXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IEZpbGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRk" +
            "bW4AAAAoQURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFs" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IFJlZmxlY3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0A" +
            "AAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNi" +
            "AAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVj" +
            "dWxhcgAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBTaGluaW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "P/AAAAAAAAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAARJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBT" +
            "aWRlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJp" +
            "ZW50AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBEaWZmdXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAU" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAB0ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL/" +
            "/wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJp" +
            "Z2h0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgT3BhY2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVs" +
            "IERlcHRoAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEV4dHJ1ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBTdHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "AChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcg" +
            "QW1vdW50AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hh" +
            "cmFjdGVyIENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRk" +
            "dU0AAAAIQO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRl" +
            "eHQgQmx1cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1f" +
            "MF8vLXRkYjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAIa6dGRncHRkc2IAAAAEAAAA" +
            "AXRkc24AAAASVXRmOAAAAApBbmltYXRvciAydGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3JzAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAFHx0ZGdwdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkbW4AAAAoQURCRSBUZXh0IFNlbGVjdG9yAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAABPudGRncHRkc2IAAAAEAAAAAXRkc24AAAAYVXRmOAAAABBSYW5nZSBTZWxlY3RvciAx" +
            "dGRtbgAAAChBREJFIFRleHQgUGVyY2VudCBTdGFydAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAXp0ZGJzdGRzYgAAAAQAAAABdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAAAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAACobGlzdGxoZDMAAAA0ANAL7gAAAAAAAAACAAAAAQAAADAAAAAEAAAAAQAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAGxk" +
            "YXQAAABgAAAIAAEBAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnUAAAAAAAAAAD/FVVVVVyp1AABOAAEBAABAWQAAAAAAAAAAAAAA" +
            "AAAAP8VVVVVXKnUAAAAAAAAAAD/FVVVVVyp1dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4" +
            "dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBJbmRleCBTdGFydAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQN9AAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBJbmRleCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QN9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBJbmRleCBPZmZzZXQAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA30AAAAAAAHRk" +
            "dU0AAAAIQN9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBBZHZhbmNlZAAAAAAAAAAAAAAAAAAAAABMSVNUAAALqnRkZ3B0" +
            "ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVW5pdHMAAAAAAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIFR5cGUyAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAE" +
            "AAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "ZWxlY3RvciBNb2RlAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgTWF4IEFtb3VudAAAAAAAAAAA" +
            "AAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8a" +
            "NuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgU2hhcGUAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAA" +
            "AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVjdG9yIFNtb290aG5lc3MAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAA" +
            "dGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IExldmVscyBNYXggRWFzZQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRi" +
            "c3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZ" +
            "AAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IExldmVscyBNaW4gRWFzZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmRvbWl6ZSBPcmRlcgAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA//8ABAAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5kb20gU2VlZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QMOIAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAg" +
            "RW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBBbmltYXRvciBQcm9wZXJ0aWVzAAAAAAAAAAAAAABMSVNUAABxdHRkZ3B0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgQW5jaG9yIFBvaW50IDNEAAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAwAPAAP/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUG9zaXRpb24gM0QAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAwAPAAP/////AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2NhbGUgM0QAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAUp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAwABAAAAAv//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAB4QFkAAAAAAABAWQAAAAAAAEBZAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAjA30AAAAAAAHRkdU0AAAAIQN9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTa2V3AAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAUYAAAAAAAHRkdU0AAAAIQFGAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTa2V3IEF4" +
            "aXMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUm90YXRpb24gWAAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uIFkAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbgAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgT3BhY2l0eQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgRmlsbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgU3Ryb2tlIE9wYWNpdHkAAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgRmlsbCBDb2xvcgAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAATElTVAAAARJ0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAA" +
            "Av//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABASBf/0AAAAEBj9/KhYAAAQG/g" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIENvbG9yAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgRmlsbCBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFN0cm9rZSBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIFNhdHVy" +
            "YXRpb24AAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJv" +
            "a2UgU2F0dXJhdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4" +
            "dCBGaWxsIEJyaWdodG5lc3MAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEh1ZQAAAAAAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBBbWJpZW50AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "AAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBEaWZmdXNlAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "dW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBTcGVjdWxhcgAAAAAAAAAAAAAA" +
            "AAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8a" +
            "NuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBTaGluaW5lc3MAAAAA" +
            "AAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//" +
            "AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBNZXRhbAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBS" +
            "ZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBG" +
            "cm9udCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNE" +
            "VGV4dCBGcm9udCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1f" +
            "MF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChB" +
            "REJFIDNEVGV4dCBGcm9udCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4" +
            "AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAA" +
            "AAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAo" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRt" +
            "bgAAAChBREJFIDNEVGV4dCBGcm9udCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAA" +
            "AA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNk" +
            "YXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAA" +
            "AAAAdGRtbgAAAChBREJFIDNEVGV4dCBGcm9udCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAAD" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAAAAB0ZHVNAAAA" +
            "CEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBSR0IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBIdWUAAAAAAAAA" +
            "AAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Av//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgU2F0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgQnJpZ2h0AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgT3BhY2l0eQAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgQW1iaWVudAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgRGlmZnVzZQAAAAAA" +
            "AAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH/" +
            "/wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgU3BlY3Vs" +
            "YXIAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwg" +
            "U2hpbmluZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQg" +
            "QmV2ZWwgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmV2ZWwgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgQmV2ZWwgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRk" +
            "bW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgRnJlc25lbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAA" +
            "AAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAA" +
            "AAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgWHBhclJvbGwAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IA" +
            "AAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAA" +
            "dGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmV2ZWwgSU9SAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRi" +
            "c3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACD/w" +
            "AAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBSR0IAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgU2F0AAAAAAAAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgQnJpZ2h0AAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgT3BhY2l0eQAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgQW1iaWVu" +
            "dAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUg" +
            "RGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IFNpZGUgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IFNpZGUgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IFNpZGUgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "AChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0A" +
            "AAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNi" +
            "AAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAA" +
            "AHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgWHBhclJvbGwAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IFNpZGUgSU9SAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUkdCAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFNhdAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/" +
            "////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIEJyaWdo" +
            "dAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNr" +
            "IE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCYWNrIEFtYmllbnQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCYWNrIERpZmZ1c2UAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCYWNrIFNwZWN1bGFyAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFNoaW5pbmVzcwAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIE1ldGFsAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFJlZmxlY3Rpb24AAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIEdsb3NzAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "AAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIEZyZXNuZWwAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "dW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFhwYXJlbmN5AAAAAAAAAAAAAAAA" +
            "AAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8a" +
            "NuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIFhwYXJSb2xsAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//" +
            "AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCYWNrIElPUgAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAAAAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBE" +
            "ZXB0aAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEAkAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBF" +
            "eHRydWRlIERlcHRoAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACECPQAAAAAAAdGRtbgAAAChBREJFIFRl" +
            "eHQgU3Ryb2tlIFdpZHRoAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1f" +
            "MF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwI9AAAAAAAB0ZHVNAAAACECPQAAAAAAAdGRtbgAAAChB" +
            "REJFIFRleHQgTGluZSBBbmNob3IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4" +
            "AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAA" +
            "AAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAo" +
            "QEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRt" +
            "bgAAAChBREJFIFRleHQgVHJhY2sgVHlwZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAA" +
            "AA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAEAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNk" +
            "YXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFRyYWNraW5nIEFt" +
            "b3VudAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJh" +
            "Y3RlciBDaGFuZ2UgVHlwZQAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmFuZ2UAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVyIFJlcGxhY2UAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwO//4AAAAAB0ZHVNAAAACEDv" +
            "/+AAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVyIE9mZnNldAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwO//4AAAAAB0ZHVN" +
            "AAAACEDv/+AAAAAAdGRtbgAAAChBREJFIFRleHQgTGluZSBTcGFjaW5nAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0" +
            "IEJsdXIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAEidGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAIAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAUAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQMOIAAAAAAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgR3JvdXAgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9" +
            "Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJB" +
            "ZG9iZSBYTVAgQ29yZSA5LjAtYzAwMSAxNTIuZGViOTU4NSwgMjAyNC8wMi8wNi0wODozNjoxMCAgICAgICAgIj4KICAgPHJkZjpS" +
            "REYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNj" +
            "cmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEv" +
            "IgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOnht" +
            "cE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgICAgICAgICB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFk" +
            "b2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIj4KICAgICAgICAgPGRjOmZvcm1hdD5hcHBsaWNhdGlvbi92bmQu" +
            "YWRvYmUuYWZ0ZXJlZmZlY3RzLnByZXNldC1hbmltYXRpb248L2RjOmZvcm1hdD4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5B" +
            "ZG9iZSBBZnRlciBFZmZlY3RzIDIwMjQgKE1hY2ludG9zaCk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVE" +
            "YXRlPjIwMjUtMDktMDJUMTY6Mjg6NDErMDE6MDA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4y" +
            "MDI1LTA5LTAyVDE2OjI4OjQxKzAxOjAwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyNS0w" +
            "OS0wMlQxNjoyODo0MSswMTowMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6NjVm" +
            "YmQwNTAtYjk2OS00OWNiLThjNjgtMGY5NTQ2N2RiN2ZiPC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1l" +
            "bnRJRD54bXAuZGlkOjY1ZmJkMDUwLWI5NjktNDljYi04YzY4LTBmOTU0NjdkYjdmYjwveG1wTU06RG9jdW1lbnRJRD4KICAgICAg" +
            "ICAgPHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjY1ZmJkMDUwLWI5NjktNDljYi04YzY4LTBmOTU0NjdkYjdmYjwv" +
            "eG1wTU06T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAg" +
            "ICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0" +
            "aW9uPmNyZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDo2NWZi" +
            "ZDA1MC1iOTY5LTQ5Y2ItOGM2OC0wZjk1NDY3ZGI3ZmI8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2" +
            "dDp3aGVuPjIwMjUtMDktMDJUMTY6Mjg6NDErMDE6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0" +
            "d2FyZUFnZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAg" +
            "ICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOlNlcT4KICAgICAgICAgPC94bXBNTTpIaXN0b3J5PgogICAgICA8" +
            "L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAog" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "IAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgIAo8P3hwYWNr" +
            "ZXQgZW5kPSJ3Ij8+" },
        { name: "Character down", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYBAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAA" +
            "BAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAbGRhdAAAAGAAAAAAAQEAAMBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANQAAQEAAEBZAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAowEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/4gAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "4gAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIw" +
            "MjUtMDctMDNUMTI6MDA6MjUrMDU6MzA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA3" +
            "LTAzVDEyOjAwOjI1KzA1OjMwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyNS0wNy0wM1Qx" +
            "MjowMDoyNSswNTozMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6Nzc0ZmEzZjQt" +
            "ODg5Mi1mMTQ2LThmODUtOTJiN2U5MTZkMDhjPC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54" +
            "bXAuZGlkOjc3NGZhM2Y0LTg4OTItZjE0Ni04Zjg1LTkyYjdlOTE2ZDA4YzwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHht" +
            "cE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjc3NGZhM2Y0LTg4OTItZjE0Ni04Zjg1LTkyYjdlOTE2ZDA4YzwveG1wTU06" +
            "T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAg" +
            "ICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNy" +
            "ZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDo3NzRmYTNmNC04" +
            "ODkyLWYxNDYtOGY4NS05MmI3ZTkxNmQwOGM8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVu" +
            "PjIwMjUtMDctMDNUMTI6MDA6MjUrMDU6MzA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFn" +
            "ZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAg" +
            "IDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgPC9yZGY6RGVz" +
            "Y3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0i" +
            "dyI/Pg==" },
        { name: "Character right", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYBAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAA" +
            "BAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAbGRhdAAAAGAAAAAAAQEAAMBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANQAAQEAAEBZAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAowEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/4gAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "4gAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEhAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIw" +
            "MjUtMDctMDNUMTE6NTk6NTYrMDU6MzA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA3" +
            "LTAzVDExOjU5OjU2KzA1OjMwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyNS0wNy0wM1Qx" +
            "MTo1OTo1NiswNTozMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6NjlhMWUzNTgt" +
            "OWM3Zi1iNDQ5LWExZjAtYjA3NDllOWRmNDk5PC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54" +
            "bXAuZGlkOjY5YTFlMzU4LTljN2YtYjQ0OS1hMWYwLWIwNzQ5ZTlkZjQ5OTwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHht" +
            "cE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjY5YTFlMzU4LTljN2YtYjQ0OS1hMWYwLWIwNzQ5ZTlkZjQ5OTwveG1wTU06" +
            "T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAg" +
            "ICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNy" +
            "ZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDo2OWExZTM1OC05" +
            "YzdmLWI0NDktYTFmMC1iMDc0OWU5ZGY0OTk8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVu" +
            "PjIwMjUtMDctMDNUMTE6NTk6NTYrMDU6MzA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFn" +
            "ZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAg" +
            "IDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgPC9yZGY6RGVz" +
            "Y3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0i" +
            "dyI/Pg==" },
        { name: "Color FadeOut HQ", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYAAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABB4AEOD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAbGRhdAAA" +
            "AGAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAA/xVVVVVcqdQAAAAAAAAAAP8VVVVVXKnUAAEYAAQEAAEBZAAAAAAAAAAAAAAAAAAA/" +
            "xVVVVVcqdQAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFBl" +
            "cmNlbnQgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAA/xVVVVVcqdQAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFBlcmNlbnQgT2Zmc2V0AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBIF//QAAAAQGP38qFgAABAb+AAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoTWFjaW50b3NoKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+" +
            "MjAyNS0wOS0wMlQxNjoyODoxOCswMTowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjUt" +
            "MDktMDJUMTY6Mjg6MTgrMDE6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDI1LTA5LTAy" +
            "VDE2OjI4OjE4KzAxOjAwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+eG1wLmlpZDo1MjdjNmIx" +
            "ZC04OTI1LTQ2MzYtYjA4ZS01YjMzMTViYzJjYTk8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElE" +
            "PnhtcC5kaWQ6NTI3YzZiMWQtODkyNS00NjM2LWIwOGUtNWIzMzE1YmMyY2E5PC94bXBNTTpEb2N1bWVudElEPgogICAgICAgICA8" +
            "eG1wTU06T3JpZ2luYWxEb2N1bWVudElEPnhtcC5kaWQ6NTI3YzZiMWQtODkyNS00NjM2LWIwOGUtNWIzMzE1YmMyY2E5PC94bXBN" +
            "TTpPcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpIaXN0b3J5PgogICAgICAgICAgICA8cmRmOlNlcT4KICAgICAg" +
            "ICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+" +
            "Y3JlYXRlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjUyN2M2YjFk" +
            "LTg5MjUtNDYzNi1iMDhlLTViMzMxNWJjMmNhOTwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Ondo" +
            "ZW4+MjAyNS0wOS0wMlQxNjoyODoxOCswMTowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJl" +
            "QWdlbnQ+QWRvYmUgQWZ0ZXIgRWZmZWN0cyAyMDI0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAg" +
            "ICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAgIDwvcmRm" +
            "OkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBl" +
            "bmQ9InciPz4=" },
        { name: "SNAP TEXT", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYAAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAAAeAB4A" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAbGRhdAAA" +
            "AGAAAAAAAgIAAAAAAAAAAAAAAAAAAAAAAAA/6FHrhR64UgAAAAAAAAAAP+hR64UeuFIAAEwAAgIAAEBZAAAAAAAAAAAAAAAAAAA/" +
            "6FHrhR64UgAAAAAAAAAAP+hR64UeuFJ0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFBl" +
            "cmNlbnQgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFBlcmNlbnQgT2Zmc2V0AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAEBDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAowDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoTWFjaW50b3NoKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+" +
            "MjAyNC0xMi0yN1QxMjozNjo1MyswMTowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjQt" +
            "MTItMjdUMTI6MzY6NTMrMDE6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDI0LTEyLTI3" +
            "VDEyOjM2OjUzKzAxOjAwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+eG1wLmlpZDphMTc5ZWY0" +
            "MC02OTBkLTQzZWItOTJjMi0zOTcwMTI3OGYzNzI8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElE" +
            "PnhtcC5kaWQ6YTE3OWVmNDAtNjkwZC00M2ViLTkyYzItMzk3MDEyNzhmMzcyPC94bXBNTTpEb2N1bWVudElEPgogICAgICAgICA8" +
            "eG1wTU06T3JpZ2luYWxEb2N1bWVudElEPnhtcC5kaWQ6YTE3OWVmNDAtNjkwZC00M2ViLTkyYzItMzk3MDEyNzhmMzcyPC94bXBN" +
            "TTpPcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpIaXN0b3J5PgogICAgICAgICAgICA8cmRmOlNlcT4KICAgICAg" +
            "ICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+" +
            "Y3JlYXRlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOmExNzllZjQw" +
            "LTY5MGQtNDNlYi05MmMyLTM5NzAxMjc4ZjM3Mjwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Ondo" +
            "ZW4+MjAyNC0xMi0yN1QxMjozNjo1MyswMTowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJl" +
            "QWdlbnQ+QWRvYmUgQWZ0ZXIgRWZmZWN0cyAyMDI0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAg" +
            "ICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAgIDwvcmRm" +
            "OkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBl" +
            "bmQ9InciPz4=" },
        { name: "SNAP TEXT 2", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYAAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHUoAB39" +
            "9AAAAAMAAQABB4AEOD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAbGRhdAAA" +
            "AGAAAAAAAgIAAAAAAAAAAAAAAAAAAAAAAAA/1VVVUcES2r7bAXJ8wAAAP/AAAAAAAAAAAE4gAgIAAEBZAAAAAAAAAAAAAAAAAAA/" +
            "1VVVUcES2gAAAAAAAAAAP9VVVVHBEtp0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFBl" +
            "cmNlbnQgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFBlcmNlbnQgT2Zmc2V0AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHUoPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHUo" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB1KD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHUoPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHUoPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHUoPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHUoPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHUoPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAdSg/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUo" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB1KD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB1" +
            "KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB1KD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "dSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAdSg/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAdSg/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAdSg/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAdSg/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUoPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHUo" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAowEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAdSg/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHUoPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB1KD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoTWFjaW50b3NoKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+" +
            "MjAyNS0wMS0wMlQxNDowMDowNSswMTowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjUt" +
            "MDEtMDJUMTQ6MDA6MDUrMDE6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDI1LTAxLTAy" +
            "VDE0OjAwOjA1KzAxOjAwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+eG1wLmlpZDoxMjRiMjk4" +
            "OC1mOTQ4LTQ0OTEtOGYwNC1kMmZjN2RjMzRkZGU8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElE" +
            "PnhtcC5kaWQ6MTI0YjI5ODgtZjk0OC00NDkxLThmMDQtZDJmYzdkYzM0ZGRlPC94bXBNTTpEb2N1bWVudElEPgogICAgICAgICA8" +
            "eG1wTU06T3JpZ2luYWxEb2N1bWVudElEPnhtcC5kaWQ6MTI0YjI5ODgtZjk0OC00NDkxLThmMDQtZDJmYzdkYzM0ZGRlPC94bXBN" +
            "TTpPcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpIaXN0b3J5PgogICAgICAgICAgICA8cmRmOlNlcT4KICAgICAg" +
            "ICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+" +
            "Y3JlYXRlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjEyNGIyOTg4" +
            "LWY5NDgtNDQ5MS04ZjA0LWQyZmM3ZGMzNGRkZTwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Ondo" +
            "ZW4+MjAyNS0wMS0wMlQxNDowMDowNSswMTowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJl" +
            "QWdlbnQ+QWRvYmUgQWZ0ZXIgRWZmZWN0cyAyMDI0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAg" +
            "ICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAgIDwvcmRm" +
            "OkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBl" +
            "bmQ9InciPz4=" },
        { name: "Snapping Text HQ", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYAAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABB4AEOD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAbGRhdAAA" +
            "AGAAAAAAAgIAAAAAAAAAAAAAAAAAAAAAAAA/1VVVUcES2gAAAAAAAAAAP9VVVVHBEtoAAFYAAgIAAEBZAAAAAAAAAAAAAAAAAAA/" +
            "1VVVUcES2gAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFBl" +
            "cmNlbnQgRW5kAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFBlcmNlbnQgT2Zmc2V0AAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAEA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAEBAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAowDEAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoTWFjaW50b3NoKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+" +
            "MjAyNS0wOS0wMlQxNjoyODo1NyswMTowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjUt" +
            "MDktMDJUMTY6Mjg6NTcrMDE6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDI1LTA5LTAy" +
            "VDE2OjI4OjU3KzAxOjAwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+eG1wLmlpZDpkYmJlNWIx" +
            "Ny1iYmI5LTQ4ZjktYTlkYS04YWE0NmYwYTczNGY8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElE" +
            "PnhtcC5kaWQ6ZGJiZTViMTctYmJiOS00OGY5LWE5ZGEtOGFhNDZmMGE3MzRmPC94bXBNTTpEb2N1bWVudElEPgogICAgICAgICA8" +
            "eG1wTU06T3JpZ2luYWxEb2N1bWVudElEPnhtcC5kaWQ6ZGJiZTViMTctYmJiOS00OGY5LWE5ZGEtOGFhNDZmMGE3MzRmPC94bXBN" +
            "TTpPcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpIaXN0b3J5PgogICAgICAgICAgICA8cmRmOlNlcT4KICAgICAg" +
            "ICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+" +
            "Y3JlYXRlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOmRiYmU1YjE3" +
            "LWJiYjktNDhmOS1hOWRhLThhYTQ2ZjBhNzM0Zjwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Ondo" +
            "ZW4+MjAyNS0wOS0wMlQxNjoyODo1NyswMTowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJl" +
            "QWdlbnQ+QWRvYmUgQWZ0ZXIgRWZmZWN0cyAyMDI0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAg" +
            "ICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAgIDwvcmRm" +
            "OkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBl" +
            "bmQ9InciPz4=" },
        { name: "Trix bounce", data: "UklGWAAABgxGYUZYaGVhZAAAABAAAAADAAAAYAAAAAEBAAAATElTVAAABehiZXNjYmVzbwAAADgAAAABAAAAAQABQAAAAHgAAB4A" +
            "AAAAAAAEOAeABDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAACsdGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAAkxJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUcmFuc2Zvcm0gR3JvdXAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBTY2FsZQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAAO" +
            "VXRmOAAAAAVTY2FsZQBMSVNUAAAAZHRkc3B0ZG90AAAABP////90ZHBsAAAABAAAAAFMSVNUAAAAQHRkc2l0ZGl4AAAABP////90" +
            "ZG1uAAAAKEFEQkUgRW5kIG9mIHBhdGggc2VudGluZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAEZnRkYnN0ZHNiAAAABAAAAAF0ZHNu" +
            "AAAADlV0ZjgAAAAFU2NhbGUAdGRiNAAAAHzbmQADAAAAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAA" +
            "TElTVAAAAUhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAgAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAbGRh" +
            "dAAAAQAAAAQAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/FVVVVVyp1P8VVVVVX" +
            "KnU/xVVVVVcqdQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/FVVVVVyp1P8VVVVVXKnU/xVVVVVcqdQAAFAABAQAAP864UeuFHrg/" +
            "zrhR64UeuD/euFHrhR64AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnU/xVVVVVcqdT/FVVVVVyp1AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAP8VVVVVXKnU/xVVVVVcqdT/FVVVVVyp1VXRmOAAAAkNhbXAgPSAuMDQ7DQpmcmVxID0gMS44Ow0KZGVjYXkg" +
            "PSAzOw0KbiA9IDA7DQp0aW1lX21heCA9IDM7DQoNCmlmIChudW1LZXlzID4gMCkgew0KICAgIG4gPSBuZWFyZXN0S2V5KHRpbWUp" +
            "LmluZGV4Ow0KICAgIGlmIChrZXkobikudGltZSA+IHRpbWUpIHsNCiAgICAgICAgbi0tOw0KICAgIH0NCn0NCg0KaWYgKG4gPT0g" +
            "MCkgew0KICAgIHQgPSAwOw0KfSBlbHNlIHsNCiAgICB0ID0gdGltZSAtIGtleShuKS50aW1lOw0KfQ0KDQppZiAobiA+IDAgJiYg" +
            "dCA8IHRpbWVfbWF4KSB7DQogICAgdiA9IHZlbG9jaXR5QXRUaW1lKGtleShuKS50aW1lIC0gdGhpc0NvbXAuZnJhbWVEdXJhdGlv" +
            "biAvIDEwKTsNCiAgICANCiAgICAvLyBFYXNlIE91dCBGYWN0b3IgKHN0YXJ0cyBhdCAxLCBncmFkdWFsbHkgcmVkdWNlcyB0byAw" +
            "KQ0KICAgIGVhc2VGYWN0b3IgPSBlYXNlT3V0KHQsIDAsIHRpbWVfbWF4LCAxLCAwKTsNCiAgICANCiAgICB2YWx1ZSArIHYgKiBh" +
            "bXAgKiBNYXRoLnNpbihmcmVxICogdCAqIDIgKiBNYXRoLlBJKSAvIE1hdGguZXhwKGRlY2F5ICogdCkgKiBlYXNlRmFjdG9yOw0K" +
            "fSBlbHNlIHsNCiAgICB2YWx1ZTsNCn0AdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIAAAAAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7" +
            "vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4Onht" +
            "cHRrPSJBZG9iZSBYTVAgQ29yZSA5LjAtYzAwMSAxNTIuZGViOTU4NSwgMjAyNC8wMi8wNi0wODozNjoxMCAgICAgICAgIj4KICAg" +
            "PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJk" +
            "ZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50" +
            "cy8xLjEvIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHht" +
            "bG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgICAgICAgICB4bWxuczpzdEV2dD0iaHR0cDov" +
            "L25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIj4KICAgICAgICAgPGRjOmZvcm1hdD5hcHBsaWNhdGlv" +
            "bi92bmQuYWRvYmUuYWZ0ZXJlZmZlY3RzLnByZXNldC1hbmltYXRpb248L2RjOmZvcm1hdD4KICAgICAgICAgPHhtcDpDcmVhdG9y" +
            "VG9vbD5BZG9iZSBBZnRlciBFZmZlY3RzIDIwMjUgKFdpbmRvd3MpPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgIDx4bXA6Q3Jl" +
            "YXRlRGF0ZT4yMDI1LTA2LTAzVDE4OjU4OjI4KzA1OjMwPC94bXA6Q3JlYXRlRGF0ZT4KICAgICAgICAgPHhtcDpNZXRhZGF0YURh" +
            "dGU+MjAyNS0wNi0wM1QxODo1ODoyOCswNTozMDwveG1wOk1ldGFkYXRhRGF0ZT4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIw" +
            "MjUtMDYtMDNUMTg6NTg6MjgrMDU6MzA8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wTU06SW5zdGFuY2VJRD54bXAuaWlk" +
            "OjlhNjMxM2ViLTRlZjItZWQ0Zi05NzY0LTgyYzkzYTJhMzYxMjwveG1wTU06SW5zdGFuY2VJRD4KICAgICAgICAgPHhtcE1NOkRv" +
            "Y3VtZW50SUQ+eG1wLmRpZDo5YTYzMTNlYi00ZWYyLWVkNGYtOTc2NC04MmM5M2EyYTM2MTI8L3htcE1NOkRvY3VtZW50SUQ+CiAg" +
            "ICAgICAgIDx4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ+eG1wLmRpZDo5YTYzMTNlYi00ZWYyLWVkNGYtOTc2NC04MmM5M2EyYTM2" +
            "MTI8L3htcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOkhpc3Rvcnk+CiAgICAgICAgICAgIDxyZGY6U2Vx" +
            "PgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0" +
            "OmFjdGlvbj5jcmVhdGVkPC9zdEV2dDphY3Rpb24+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDppbnN0YW5jZUlEPnhtcC5paWQ6" +
            "OWE2MzEzZWItNGVmMi1lZDRmLTk3NjQtODJjOTNhMmEzNjEyPC9zdEV2dDppbnN0YW5jZUlEPgogICAgICAgICAgICAgICAgICA8" +
            "c3RFdnQ6d2hlbj4yMDI1LTA2LTAzVDE4OjU4OjI4KzA1OjMwPC9zdEV2dDp3aGVuPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6" +
            "c29mdHdhcmVBZ2VudD5BZG9iZSBBZnRlciBFZmZlY3RzIDIwMjUgKFdpbmRvd3MpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAg" +
            "ICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAg" +
            "IDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBh" +
            "Y2tldCBlbmQ9InciPz4=" },
        { name: "Word down", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYBAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAA" +
            "BAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAbGRhdAAAAGAAAAAAAQEAAMBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANQAAQEAAEBZAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoQAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAowEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/4gAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "4gAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIw" +
            "MjUtMDctMDNUMTI6MDA6NDMrMDU6MzA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA3" +
            "LTAzVDEyOjAwOjQzKzA1OjMwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyNS0wNy0wM1Qx" +
            "MjowMDo0MyswNTozMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6MzEwNzljNGIt" +
            "NTIwZC0yYzRhLTgwMjEtM2M0YjIyZTk1ZjBjPC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54" +
            "bXAuZGlkOjMxMDc5YzRiLTUyMGQtMmM0YS04MDIxLTNjNGIyMmU5NWYwYzwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHht" +
            "cE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjMxMDc5YzRiLTUyMGQtMmM0YS04MDIxLTNjNGIyMmU5NWYwYzwveG1wTU06" +
            "T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAg" +
            "ICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNy" +
            "ZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDozMTA3OWM0Yi01" +
            "MjBkLTJjNGEtODAyMS0zYzRiMjJlOTVmMGM8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVu" +
            "PjIwMjUtMDctMDNUMTI6MDA6NDMrMDU6MzA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFn" +
            "ZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAg" +
            "IDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgPC9yZGY6RGVz" +
            "Y3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0i" +
            "dyI/Pg==" },
        { name: "Word right", data: "UklGWAAAiKxGYUZYaGVhZAAAABAAAAADAAAAXwAAAAYBAAAATElTVAAAiIhiZXNjYmVzbwAAADgAAAABAAAAAQAAAAAAAHgAADwA" +
            "AAAAAAMAAQABBDgHgD/wAAAAAAAAP/AAAAAAAAAAAAAA/////0xJU1QAAAD0dGRzcHRkb3QAAAAE/////3RkcGwAAAAEAAAAA0xJ" +
            "U1QAAABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IFByb3BlcnRpZXMAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AABAdGRzaXRkaXgAAAAE/////3RkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9ycwAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAABA" +
            "dGRzaXRkaXgAAAAEAAAAAHRkbW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkc24AAAASVXRm" +
            "OAAAAApBbmltYXRvciAxTElTVAAAAGR0ZHNwdGRvdAAAAAT/////dGRwbAAAAAQAAAABTElTVAAAAEB0ZHNpdGRpeAAAAAT/////" +
            "dGRtbgAAAChBREJFIEVuZCBvZiBwYXRoIHNlbnRpbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAhrp0ZGdwdGRzYgAAAAQAAAABdGRz" +
            "bgAAABJVdGY4AAAACkFuaW1hdG9yIDF0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvcnMAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAUfHRkZ3B0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAE+50ZGdwdGRzYgAAAAQAAAABdGRzbgAAABhVdGY4AAAAEFJhbmdlIFNlbGVjdG9yIDF0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBQZXJjZW50IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IEVuZAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQZXJjZW50IE9mZnNldAAAAAAAAAAAAAAAAAAAAABMSVNUAAABenRkYnN0ZHNiAAAA" +
            "BAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAAAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAATElTVAAAAKhsaXN0bGhkMwAAADQA0AvuAAAAAAAAAAIAAAABAAAAMAAAAAQAAAABAAAABAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAbGRhdAAAAGAAAAAAAQEAAMBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANQAAQEAAEBZAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8VVVVVXKnV0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSBUZXh0IEluZGV4IFN0YXJ0AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEluZGV4IEVuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA30AA" +
            "AAAAAHRkbW4AAAAoQURCRSBUZXh0IEluZGV4IE9mZnNldAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAA" +
            "A3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAA" +
            "AAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJhbmdlIEFkdmFuY2VkAAAAAAAAAAAAAAAAAAAAAExJU1QAAAuqdGRncHRkc2IA" +
            "AAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBVbml0cwAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGRtbgAAAChBREJFIFRleHQgUmFuZ2UgVHlwZTIAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAAB" +
            "dGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAGNkYXQAAAAoQAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNlbGVj" +
            "dG9yIE1vZGUAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAAXRkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAIABAAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTZWxlY3RvciBNYXggQW1vdW50AAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSYW5nZSBTaGFwZQAAAAAAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAAAAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGRtbgAAAChBREJFIFRleHQgU2VsZWN0b3IgU21vb3RobmVzcwAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1heCBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAowEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAA" +
            "AAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgTGV2ZWxzIE1pbiBFYXNlAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0" +
            "ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAI" +
            "wFkAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIFRleHQgUmFuZG9taXplIE9yZGVyAAAAAAAAAAAAAAAAAAAATElT" +
            "VAAAANp0ZGJzdGRzYgAAAAQAAAABdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD//wAEAAB4AD8aNuLrHEMt" +
            "P/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IFJhbmRvbSBTZWVkAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj" +
            "ZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAw4gA" +
            "AAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBUZXh0IEFuaW1hdG9yIFByb3BlcnRpZXMAAAAAAAAAAAAAAExJU1QAAHF0dGRncHRkc2IAAAAEAAAAAXRkc24A" +
            "AAAOVXRmOAAAAAYtXzBfLy10ZG1uAAAAKEFEQkUgVGV4dCBBbmNob3IgUG9pbnQgM0QAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/4gAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBQb3NpdGlvbiAzRAAAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAA8AA/////8AAHgAPxo24uscQy0/" +
            "4gAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAEhAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTY2FsZSAzRAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAABSnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQADAAEAAAAC//8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAHhAWQAAAAAAAEBZAAAAAAAAQFkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACMDfQAAAAAAAdGR1TQAAAAhA30AAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBRgAAAAAAAdGR1TQAAAAhAUYAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFNrZXcgQXhpcwAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBSb3RhdGlvbiBYAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgUm90YXRpb24gWQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFJvdGF0aW9uAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRk" +
            "YnN0ZHNiAAAABAAAAAF0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgA" +
            "AAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIE9wYWNpdHkAAAAAAAAAAAAAAAAAAAAAAABMSVNU" +
            "AAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1" +
            "bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBTdHJva2UgT3BhY2l0eQAAAAAAAAAAAAAAAAAA" +
            "AABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo2" +
            "4uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIENvbG9yAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgVGV4dCBTdHJva2UgQ29sb3IAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAGBA" +
            "b+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBGaWxsIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAA" +
            "AChBREJFIFRleHQgU3Ryb2tlIEh1ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZpbGwgU2F0dXJhdGlv" +
            "bgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEA" +
            "AQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IFN0cm9rZSBT" +
            "YXR1cmF0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAA" +
            "fNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IEZp" +
            "bGwgQnJpZ2h0bmVzcwAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10" +
            "ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSBU" +
            "ZXh0IFN0cm9rZSBCcmlnaHRuZXNzAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAo" +
            "QURCRSAzRFRleHQgRnJvbnQgUkdCAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRm" +
            "OAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "AAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAA" +
            "YEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgRnJvbnQgSHVlAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEZyb250IFNhdAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEJyaWdodAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE9wYWNpdHkAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IEFtYmllbnQAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IERpZmZ1c2UAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNwZWN1bGFyAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFNoaW5pbmVzcwAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IE1ldGFsAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IFJlZmxl" +
            "Y3Rpb24AAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250" +
            "IEdsb3NzAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0" +
            "IEZyb250IEZyZXNuZWwAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "M0RUZXh0IEZyb250IFhwYXJlbmN5AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgM0RUZXh0IEZyb250IFhwYXJSb2xsAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0" +
            "ZG1uAAAAKEFEQkUgM0RUZXh0IEZyb250IElPUgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNu" +
            "AAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "Y2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAA" +
            "AAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIFJHQgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABEnRkYnN0ZHNiAAAABAAA" +
            "AAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAEAAcAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAY2RhdAAAAGBAb+AAAAAAAEBv4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIEh1ZQAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAC//8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTYXQAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAA" +
            "AAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkAAAAAAAB0" +
            "ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBCcmlnaHQAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJz" +
            "dGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwFkA" +
            "AAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBPcGFjaXR5AAAAAAAAAAAAAAAAAAAATElTVAAA" +
            "APp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0A" +
            "AAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBBbWJpZW50AAAAAAAAAAAAAAAAAAAA" +
            "TElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLr" +
            "HEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBEaWZmdXNlAAAAAAAAAAAA" +
            "AAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4" +
            "AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTcGVjdWxhcgAA" +
            "AAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAA" +
            "Af//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBTaGlu" +
            "aW5lc3MAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kA" +
            "AQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQBQAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZl" +
            "bCBNZXRhbAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQA" +
            "AAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4" +
            "dCBCZXZlbCBSZWZsZWN0aW9uAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8v" +
            "LXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAAAChBREJF" +
            "IDNEVGV4dCBCZXZlbCBHbG9zcwAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAA" +
            "Bi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAI" +
            "CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoQFkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAAdGRtbgAA" +
            "AChBREJFIDNEVGV4dCBCZXZlbCBGcmVzbmVsAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5V" +
            "dGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQA" +
            "AAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZAAAAAAAA" +
            "dGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyZW5jeQAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRz" +
            "bgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVNAAAACEBZ" +
            "AAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBYcGFyUm9sbAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQA" +
            "AAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAAAAf//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIAAAAAAAAAAB0ZHVN" +
            "AAAACEBZAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBCZXZlbCBJT1IAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRz" +
            "YgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQABAAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIP/AAAAAA" +
            "AAB0ZHVNAAAACEAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIFJHQgAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAARJ0" +
            "ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kABAAHAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAA" +
            "AAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABgQG/gAAAAAABAb+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIDNEVGV4dCBTaWRlIEh1" +
            "ZQAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBTYXQAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVt" +
            "AAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBCcmlnaHQAAAAAAAAAAAAAAAAAAAAA" +
            "AExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi" +
            "6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAB0ZHVtAAAACMBZAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBPcGFjaXR5AAAAAAAAAAAA" +
            "AAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAA" +
            "eAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBBbWJpZW50AAAA" +
            "AAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA" +
            "AAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBEaWZm" +
            "dXNlAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZ" +
            "AAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lk" +
            "ZSBTcGVjdWxhcgAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0" +
            "AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRl" +
            "eHQgU2lkZSBTaGluaW5lc3MAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBf" +
            "Ly10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEAUAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURC" +
            "RSAzRFRleHQgU2lkZSBNZXRhbAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAA" +
            "AAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAA" +
            "CAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKEBZ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4A" +
            "AAAoQURCRSAzRFRleHQgU2lkZSBSZWZsZWN0aW9uAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAO" +
            "VXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAA" +
            "AAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0" +
            "AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAA" +
            "AHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBHbG9zcwAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rk" +
            "c24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AABjZGF0AAAAKEBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1TQAAAAhA" +
            "WQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBGcmVzbmVsAAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rkc2IAAAAE" +
            "AAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/" +
            "8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAAAAAAdGR1" +
            "TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyZW5jeQAAAAAAAAAAAAAAAAAAAExJU1QAAAD6dGRic3Rk" +
            "c2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AA" +
            "AAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAACAAAAAAA" +
            "AAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBYcGFyUm9sbAAAAAAAAAAAAAAAAAAAAExJU1QAAAD6" +
            "dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAH//wAAeAA/Gjbi6xxDLT/wAAAA" +
            "AAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAWQAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgU2lkZSBJT1IAAAAAAAAAAAAAAAAAAAAAAAAAAExJ" +
            "U1QAAAD6dGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAA/////wAAeAA/Gjbi6xxD" +
            "LT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0" +
            "ZHVtAAAACD/wAAAAAAAAdGR1TQAAAAhAAAAAAAAAAHRkbW4AAAAoQURCRSAzRFRleHQgQmFjayBSR0IAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAExJU1QAAAESdGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAQABwAAAAL//wAAeAA/" +
            "Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAYEBv4AAAAAAAQG/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSAz" +
            "RFRleHQgQmFjayBIdWUAAAAAAAAAAAAAAAAAAAAAAAAAAExJU1QAAADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYt" +
            "XzBfLy10ZGI0AAAAfNuZAAEAAQAAAAL//wAAeAA/Gjbi6xxDLT/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAACAkA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgU2F0AAAAAAAAAAAAAAAA" +
            "AAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8A" +
            "AHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgQnJpZ2h0AAAA" +
            "AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEA" +
            "AP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAWQAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgT3Bh" +
            "Y2l0eQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzb" +
            "mQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJh" +
            "Y2sgQW1iaWVudAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRi" +
            "NAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RU" +
            "ZXh0IEJhY2sgRGlmZnVzZQAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8w" +
            "Xy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFE" +
            "QkUgM0RUZXh0IEJhY2sgU3BlY3VsYXIAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgA" +
            "AAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAA" +
            "AAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChA" +
            "SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgM0RUZXh0IEJhY2sgU2hpbmluZXNzAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAAChAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAA" +
            "AAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgTWV0YWwAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAI" +
            "QFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgUmVmbGVjdGlvbgAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRk" +
            "dU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgR2xvc3MAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0" +
            "ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAAAAAAAD/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAA" +
            "AAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgRnJlc25lbAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA" +
            "+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24uscQy0/8AAA" +
            "AAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAA" +
            "AAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhcmVuY3kAAAAAAAAAAAAAAAAAAABM" +
            "SVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgAPxo24usc" +
            "Qy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "dGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgWHBhclJvbGwAAAAAAAAAAAAA" +
            "AAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAAB//8AAHgA" +
            "Pxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJhY2sgSU9SAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP//" +
            "//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAdGR1bQAAAAg/8AAAAAAAAHRkdU0AAAAIQAAAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEJldmVsIERlcHRo" +
            "AAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQAB" +
            "AAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQCQAAAAAAAB0ZG1uAAAAKEFEQkUgM0RUZXh0IEV4dHJ1" +
            "ZGUgRGVwdGgAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAA" +
            "AHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBT" +
            "dHJva2UgV2lkdGgAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8t" +
            "dGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAACgAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjAj0AAAAAAAHRkdU0AAAAIQI9AAAAAAAB0ZG1uAAAAKEFEQkUg" +
            "VGV4dCBMaW5lIEFuY2hvcgAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0ZjgAAAAG" +
            "LV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAAAAAAAAgJ" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAAAChASQAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAgAAAAAAAAAAHRkdU0AAAAIQFkAAAAAAAB0ZG1uAAAA" +
            "KEFEQkUgVGV4dCBUcmFjayBUeXBlAAAAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAAA2nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAADlV0" +
            "ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAAACAAQAAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAAAAAA" +
            "AAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2RhdAAA" +
            "ACg/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGRtbgAAAChBREJFIFRleHQgVHJhY2tpbmcgQW1vdW50" +
            "AAAAAAAAAAAAAAAAAAAATElTVAAAAPp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB825kAAQAB" +
            "AAD/////AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQ2hhcmFjdGVy" +
            "IENoYW5nZSBUeXBlAAAAAAAAAAAATElTVAAAANp0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRkYjQAAAB8" +
            "25kAAQABAAAAAgAAAAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAAAoP/AAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkbW4AAAAoQURCRSBUZXh0IENoYXJhY3RlciBSYW5nZQAAAAAAAAAAAAAAAAAAAExJU1QA" +
            "AADadGRic3Rkc2IAAAAEAAAAA3Rkc24AAAAOVXRmOAAAAAYtXzBfLy10ZGI0AAAAfNuZAAEAAQAAAAIAAAAAeAA/Gjbi6xxDLT/w" +
            "AAAAAAAAP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGF0AAAAKD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZG1u" +
            "AAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgUmVwbGFjZQAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0ZHNuAAAA" +
            "DlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAA/8AAA" +
            "AAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY2Rh" +
            "dAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAIQO//4AAA" +
            "AAB0ZG1uAAAAKEFEQkUgVGV4dCBDaGFyYWN0ZXIgT2Zmc2V0AAAAAAAAAAAAAAAAAABMSVNUAAAA+nRkYnN0ZHNiAAAABAAAAAN0" +
            "ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQABAAEAAP////8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAAP/AAAAAA" +
            "AAA/8AAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAY2RhdAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdGR1bQAAAAjA7//gAAAAAHRkdU0AAAAI" +
            "QO//4AAAAAB0ZG1uAAAAKEFEQkUgVGV4dCBMaW5lIFNwYWNpbmcAAAAAAAAAAAAAAAAAAAAAAABMSVNUAAABInRkYnN0ZHNiAAAA" +
            "BAAAAAN0ZHNuAAAADlV0ZjgAAAAGLV8wXy8tdGRiNAAAAHzbmQACAAEAAAAC//8AAHgAPxo24uscQy0/8AAAAAAAAD/wAAAAAAAA" +
            "P/AAAAAAAAA/8AAAAAAAAAAAAAgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAY2RhdAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRkdW0AAAAIwN9AAAAAAAB0ZHVNAAAACEDfQAAAAAAAdGRtbgAAAChBREJFIFRleHQgQmx1" +
            "cgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATElTVAAAASJ0ZGJzdGRzYgAAAAQAAAADdGRzbgAAAA5VdGY4AAAABi1fMF8vLXRk" +
            "YjQAAAB825kAAgABAAAAAv//AAB4AD8aNuLrHEMtP/AAAAAAAAA/8AAAAAAAAD/wAAAAAAAAP/AAAAAAAAAAAAAICQAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGNkYXQAAABQAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB0ZHVtAAAA" +
            "CAAAAAAAAAAAdGR1TQAAAAhAw4gAAAAAAHRkbW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRk" +
            "bW4AAAAoQURCRSBHcm91cCBFbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVN" +
            "ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2Jl" +
            "IFhNUCBDb3JlIDkuMC1jMDAxIDE1Mi5kZWI5NTg1LCAyMDI0LzAyLzA2LTA4OjM2OjEwICAgICAgICAiPgogICA8cmRmOlJERiB4" +
            "bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0" +
            "aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAg" +
            "ICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09" +
            "Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUu" +
            "Y29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiPgogICAgICAgICA8ZGM6Zm9ybWF0PmFwcGxpY2F0aW9uL3ZuZC5hZG9i" +
            "ZS5hZnRlcmVmZmVjdHMucHJlc2V0LWFuaW1hdGlvbjwvZGM6Zm9ybWF0PgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2Jl" +
            "IEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIw" +
            "MjUtMDctMDNUMTE6NTk6MDkrMDU6MzA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA3" +
            "LTAzVDExOjU5OjA5KzA1OjMwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyNS0wNy0wM1Qx" +
            "MTo1OTowOSswNTozMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6YzRiZGIxNzEt" +
            "YzI1OC1iNTQ1LWJkYTItNjczOWJkNGQyYWM2PC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54" +
            "bXAuZGlkOmM0YmRiMTcxLWMyNTgtYjU0NS1iZGEyLTY3MzliZDRkMmFjNjwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHht" +
            "cE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOmM0YmRiMTcxLWMyNTgtYjU0NS1iZGEyLTY3MzliZDRkMmFjNjwveG1wTU06" +
            "T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAg" +
            "ICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNy" +
            "ZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDpjNGJkYjE3MS1j" +
            "MjU4LWI1NDUtYmRhMi02NzM5YmQ0ZDJhYzY8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVu" +
            "PjIwMjUtMDctMDNUMTE6NTk6MDkrMDU6MzA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFn" +
            "ZW50PkFkb2JlIEFmdGVyIEVmZmVjdHMgMjAyNCAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAg" +
            "IDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgPC9yZGY6RGVz" +
            "Y3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAK" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
            "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0i" +
            "dyI/Pg==" }
    ];

    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var B64_INDEX = null;

    // base64 -> binary string (one char per byte), ES3
    function b64decode(s) {
        var i, c;
        if (!B64_INDEX) {
            B64_INDEX = {};
            for (i = 0; i < B64.length; i++) { B64_INDEX[B64.charAt(i)] = i; }
        }
        var out = [], buf = 0, bits = 0;
        for (i = 0; i < s.length; i++) {
            c = s.charAt(i);
            if (c === "=") { break; }
            if (B64_INDEX[c] === undefined) { continue; }
            buf = (buf << 6) | B64_INDEX[c];
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.push(String.fromCharCode((buf >> bits) & 255));
                buf = buf & ((1 << bits) - 1);
            }
        }
        return out.join("");
    }

    // Writes the embedded preset to a temp .ffx and applies it to every selected layer
    function doTextPreset(idx) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the text layer(s) to animate."); if (!sel) { return; }
        var preset = TEXT_PRESETS[idx], safe = preset.name.replace(/[^A-Za-z0-9_-]+/g, "_");
        var f = new File(Folder.temp.fsName + "/RupaMotion_" + safe + ".ffx");
        f.encoding = "BINARY";
        if (!f.open("w")) { alert("Couldn't write the preset to the temp folder.", NAME); return; }
        f.write(b64decode(preset.data));
        f.close();
        var failed = "", i;
        for (i = 0; i < sel.length; i++) {
            try { sel[i].applyPreset(f); } catch (e) { failed = e.toString(); }
        }
        try { f.remove(); } catch (e2) {}
        if (failed !== "") { alert("After Effects couldn't apply \"" + preset.name + "\":\n" + failed, NAME); }
    }

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

    // Temporarily uses a given bounce state and strength (Quick Actions has its own toggle and Bounce %)
    function withBounce(on, fn, amount) {
        var old = style.bounceOn, oldAmt = style.bounceAmt;
        style.bounceOn = on ? "1" : "0";
        if (amount !== undefined) { style.bounceAmt = String(amount); }
        try { fn(); } finally { style.bounceOn = old; style.bounceAmt = oldAmt; }
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

    // =====================================================================
    // FLOW GROUP — cubic-bezier easing applied to keyframes
    // =====================================================================

    // [name, x1, y1, x2, y2] — the curve between two keys, as a CSS-style cubic-bezier
    var FLOW_PRESETS = [
        ["linear", 0, 0, 1, 1], ["easeIn", 0.42, 0, 1, 1], ["easeOut", 0, 0, 0.58, 1], ["ease", 0.25, 0.1, 0.25, 1],
        ["sineIn", 0.12, 0, 0.39, 0], ["sineOut", 0.61, 1, 0.88, 1], ["sine", 0.37, 0, 0.63, 1],
        ["quadIn", 0.11, 0, 0.5, 0], ["quadOut", 0.5, 1, 0.89, 1], ["quad", 0.45, 0, 0.55, 1],
        ["cubicIn", 0.32, 0, 0.67, 0], ["cubicOut", 0.33, 1, 0.68, 1], ["cubic", 0.66, 0, 0.34, 1],
        ["quartIn", 0.5, 0, 0.75, 0], ["quartOut", 0.25, 1, 0.5, 1], ["quart", 0.76, 0, 0.24, 1],
        ["quintIn", 0.64, 0, 0.78, 0], ["quintOut", 0.22, 1, 0.36, 1], ["quint", 0.83, 0, 0.17, 1],
        ["expoIn", 0.7, 0, 0.84, 0], ["expoOut", 0.16, 1, 0.3, 1], ["expo", 0.87, 0, 0.13, 1],
        ["circIn", 0.55, 0, 1, 0.45], ["circOut", 0, 0.55, 0.45, 1], ["circ", 0.85, 0, 0.15, 1],
        ["backIn", 0.36, 0, 0.66, -0.56], ["backOut", 0.34, 1.56, 0.64, 1], ["back", 0.68, -0.6, 0.32, 1.6]
    ];

    // Point on the cubic bezier (0,0) (x1,y1) (x2,y2) (1,1) at parameter t
    function bezierAt(c, t) {
        var u = 1 - t;
        return [
            3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t,
            3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t
        ];
    }

    function flowIsLinear(c) { return c[0] === 0 && c[1] === 0 && c[2] === 1 && c[3] === 1; }

    // Linear is eased like every other curve, as a bezier whose handles sit on the straight line
    // (1/3, 1/3) (2/3, 2/3): constant speed, and it goes through the same path as the other 27 curves.
    function flowStraight() { return [1 / 3, 1 / 3, 2 / 3, 2 / 3]; }

    // Value change between keys a and b, one entry per ease dimension
    function flowDelta(prop, a, b, n) {
        var va = prop.keyValue(a), vb = prop.keyValue(b), out = [], i;
        if (typeof va === "number") { out.push(vb - va); }
        else if (va instanceof Array && n === 1) {
            var sum = 0;
            for (i = 0; i < va.length; i++) { sum += (vb[i] - va[i]) * (vb[i] - va[i]); }
            out.push(Math.sqrt(sum));
        } else if (va instanceof Array) {
            for (i = 0; i < n; i++) { out.push((vb[i] !== undefined && va[i] !== undefined) ? vb[i] - va[i] : 0); }
        }
        while (out.length < n) { out.push(0); }
        return out;
    }

    function flowEase(dv, slopeNum, dx, dt) {
        var inf = Math.max(0.1, Math.min(100, dx * 100)), arr = [];
        for (var i = 0; i < dv.length; i++) { arr.push(new KeyframeEase(slopeNum * dv[i] / (dx * dt), inf)); }
        return arr;
    }

    // Sets the temporal ease of the segment keys a -> b so it follows curve c.
    // mode: "both" | "in" (only the incoming side at b) | "out" (only the outgoing side at a)
    function flowSegment(prop, st, a, b, c, mode) {
        var dt = prop.keyTime(b) - prop.keyTime(a);
        if (dt <= 0) { return false; }
        function slot(k) {
            if (!st[k]) { st[k] = { i: prop.keyInTemporalEase(k), o: prop.keyOutTemporalEase(k), ti: false, to: false }; }
            return st[k];
        }
        var sa = slot(a), sb = slot(b), n = sa.o.length;
        if (flowIsLinear(c)) { c = flowStraight(); }
        if (mode !== "in") {
            sa.o = flowEase(flowDelta(prop, a, b, n), c[1], Math.max(c[0], 0.001), dt);
            sa.to = true;
        }
        if (mode !== "out") {
            sb.i = flowEase(flowDelta(prop, a, b, sb.i.length), 1 - c[3], Math.max(1 - c[2], 0.001), dt);
            sb.ti = true;
        }
        return true;
    }

    // True when the ease After Effects stored matches what we asked for (influence is what tells us it took)
    function flowEaseTook(prop, k, s, inT, outT) {
        var T = KeyframeInterpolationType;
        function same(a, b) {
            if (a.length !== b.length) { return false; }
            for (var j = 0; j < a.length; j++) { if (Math.abs(a[j].influence - b[j].influence) > 0.5) { return false; } }
            return true;
        }
        if (s.to && outT === T.BEZIER && !same(prop.keyOutTemporalEase(k), s.o)) { return false; }
        if (s.ti && inT === T.BEZIER && !same(prop.keyInTemporalEase(k), s.i)) { return false; }
        return true;
    }

    // Writes the planned ease to every touched key. report.failed counts keys that would not take it.
    function flowCommit(prop, st, report) {
        for (var key in st) {
            var k = parseInt(key, 10), s = st[key], T = KeyframeInterpolationType;
            if (!s.ti && !s.to) { continue; }
            var inT = s.ti ? T.BEZIER : prop.keyInInterpolationType(k);
            var outT = s.to ? T.BEZIER : prop.keyOutInterpolationType(k);
            prop.setInterpolationTypeAtKey(k, inT, outT);
            if (inT !== T.BEZIER && outT !== T.BEZIER) { continue; }
            // A key that is "continuous" or "auto bezier" must keep the same speed on both sides, so After Effects
            // rejects a new curve whose in and out speeds differ. That is why the first curve applied and later ones
            // did not. Untie the key first.
            try { prop.setTemporalAutoBezierAtKey(k, false); } catch (e1) {}
            try { prop.setTemporalContinuousAtKey(k, false); } catch (e2) {}
            var tries = 0, ok = false;
            while (tries < 2 && !ok) {
                try { prop.setTemporalEaseAtKey(k, s.i, s.o); } catch (e3) { report.error = e3.toString(); }
                ok = flowEaseTook(prop, k, s, inT, outT);
                tries++;
            }
            if (!ok) { report.failed++; }
        }
    }


    // Damped overshoot after every keyframe, sized as a % of that segment's travel. It sits on top of the
    // eased curve (the curve still drives the move), so the object arrives and then springs a little.
    var FLOW_BOUNCE_TAG = "Motion Kit flow bounce";

    function flowBounceExpr(pct) {
        return "// " + FLOW_BOUNCE_TAG + " (" + pct + "% overshoot after each keyframe). Turn off in Flow > Bounce effect.\n" +
            "var pct = " + (pct / 100).toFixed(3) + ", f = 3, d = 6, out = value;\n" +
            "if (numKeys > 1) {\n" +
            "  var n = nearestKey(time).index;\n" +
            "  if (key(n).time > time) { n = n - 1; }\n" +
            "  if (n > 1) {\n" +
            "    var t = time - key(n).time;\n" +
            "    if (t > 0 && t < 2) {\n" +
            "      var dv = sub(key(n).value, key(n - 1).value);\n" +
            "      var k = pct * Math.exp(d / (4 * f)) * Math.sin(2 * Math.PI * f * t) * Math.exp(-d * t);\n" +
            "      out = add(value, mul(dv, k));\n" +
            "    }\n" +
            "  }\n" +
            "}\n" +
            "out;";
    }

    // on: write the bounce; off: remove only our own flow bounce. Other people's expressions are never touched.
    // Returns "skipped" when the property already has an expression of the user's.
    function flowBounce(prop, on, pct) {
        var v = prop.keyValue(1), ex = "";
        if (typeof v !== "number" && !(v instanceof Array)) { return "n/a"; }
        try { ex = prop.expression; } catch (e0) { return "n/a"; }
        if (!on) {
            if (ex.indexOf(FLOW_BOUNCE_TAG) >= 0) { prop.expression = ""; }
            return "off";
        }
        if (ex !== "" && ex.indexOf("Motion Kit") < 0) { return "skipped"; }
        prop.expression = flowBounceExpr(pct);
        return "on";
    }

    // Eases the segment between the keys at t0 and t1 with a cubic-bezier c (same engine as Flow)
    function easeBetweenKeys(prop, t0, t1, c) {
        var a = prop.nearestKeyIndex(t0), b = prop.nearestKeyIndex(t1), st = {}, report = { failed: 0, error: "" };
        if (b <= a) { return; }
        flowSegment(prop, st, a, b, c, "both");
        flowCommit(prop, st, report);
    }

    // Segments (pairs of key indices) to ease for the chosen keys
    function flowSegments(idx, numKeys) {
        var segs = [], i, has = {};
        for (i = 0; i < idx.length; i++) { has[idx[i]] = true; }
        for (i = 0; i < idx.length; i++) { if (has[idx[i] + 1]) { segs.push([idx[i], idx[i] + 1]); } }
        if (segs.length === 0) {
            for (i = 0; i < idx.length; i++) {
                if (idx[i] < numKeys) { segs.push([idx[i], idx[i] + 1]); }
                else if (idx[i] > 1) { segs.push([idx[i] - 1, idx[i]]); }
            }
        }
        return segs;
    }

    // Selected keyframes first; otherwise every key of the selected properties; otherwise every keyed property of the selected layers
    function flowTargets(comp) {
        var sel = comp.selectedLayers, out = [], i, j, k;
        for (i = 0; i < sel.length; i++) {
            var sp = sel[i].selectedProperties;
            for (j = 0; j < sp.length; j++) {
                var p = sp[j];
                if (p.propertyType !== PropertyType.PROPERTY || p.numKeys < 2) { continue; }
                var idx = [];
                try { for (k = 0; k < p.selectedKeys.length; k++) { idx.push(p.selectedKeys[k]); } } catch (e) {}
                if (idx.length === 0) { for (k = 1; k <= p.numKeys; k++) { idx.push(k); } }
                idx.sort(function (a, b) { return a - b; });
                out.push({ prop: p, idx: idx });
            }
        }
        if (out.length === 0) {
            for (i = 0; i < sel.length; i++) {
                var all = keyedProps(sel[i], []);
                for (j = 0; j < all.length; j++) {
                    var ix = [];
                    for (k = 1; k <= all[j].numKeys; k++) { ix.push(k); }
                    out.push({ prop: all[j], idx: ix });
                }
            }
        }
        return out;
    }

    // c: [x1, y1, x2, y2]. opts: { bounce: bool, pct: number }. Returns the number of segments eased.
    function doFlowApply(c, mode, opts) {
        opts = opts || { bounce: false, pct: 10 };
        var comp = activeComp(); if (!comp) { return; }
        if (comp.selectedLayers.length === 0) { alert("Select a layer with keyframes (or select the keyframes).", NAME); return; }
        var targets = flowTargets(comp), done = 0, i, report = { failed: 0, error: "" }, skippedExpr = 0;
        for (i = 0; i < targets.length; i++) {
            var t = targets[i], st = {}, segs = flowSegments(t.idx, t.prop.numKeys), s;
            try {
                for (s = 0; s < segs.length; s++) { if (flowSegment(t.prop, st, segs[s][0], segs[s][1], c, mode)) { done++; } }
                flowCommit(t.prop, st, report);
                if (flowBounce(t.prop, opts.bounce, opts.pct) === "skipped") { skippedExpr++; }
            } catch (e) { report.failed++; report.error = e.toString(); }
        }
        if (done === 0) { alert("No keyframes to ease. Select a layer or properties with 2 or more keyframes.", NAME); }
        else if (report.failed > 0) {
            alert(report.failed + " keyframe(s) did not accept this curve." + (report.error ? "\n\n" + report.error : ""), NAME);
        } else if (skippedExpr > 0) {
            alert("Bounce skipped on " + skippedExpr + " propert" + (skippedExpr === 1 ? "y" : "ies") + " that already have your own expression.", NAME);
        }
        return done;
    }


    // =====================================================================
    // DESIGN SYSTEM  (based on a soft, light "Iconly" style)
    // ---------------------------------------------------------------------
    // Colors   page #EFF0F2 · surface #F7F8FA · card #FFFFFF · hairline #E2E4E8
    //          text #111316 · label #5F6368 · hint #94979C
    //          primary #0A6CFF · primary tint #E8F1FF
    // Radius   outer card 18 · inner card 14 · buttons, chips, toggles = pill
    // Type     title 15 bold · section 13/12 bold · body 12 · nav 10
    // Spacing  4 / 6 / 10 / 14
    // Parts    header · icon tab bar · feature chips · cards · pill buttons
    //          (primary / secondary) · toggle switches · hints
    // =====================================================================

    var THEMES = {
        light: {
            bg:      [0.937, 0.941, 0.949, 1],
            surface: [0.969, 0.973, 0.980, 1],
            card:    [1, 1, 1, 1],
            border:  [0.886, 0.894, 0.910, 1],
            text:    [0.067, 0.075, 0.086, 1],
            label:   [0.373, 0.388, 0.408, 1],
            muted:   [0.580, 0.592, 0.612, 1],
            primary: [0.039, 0.424, 1.000, 1],
            onPrimary: [1, 1, 1, 1],
            tint:    [0.910, 0.945, 1.000, 1],
            press:   [0.890, 0.898, 0.914, 1],
            pressPrimary: [0.020, 0.300, 0.780, 1],
            pressTint: [0.800, 0.890, 1.000, 1],
            shadow:  [0.06, 0.09, 0.16, 0.07],
            knob:    [1, 1, 1, 1]
        },
        dark: {
            bg:      [0.110, 0.114, 0.125, 1],
            surface: [0.137, 0.141, 0.157, 1],
            card:    [0.169, 0.176, 0.192, 1],
            border:  [0.235, 0.243, 0.263, 1],
            text:    [0.945, 0.949, 0.957, 1],
            label:   [0.745, 0.753, 0.769, 1],
            muted:   [0.565, 0.576, 0.600, 1],
            primary: [0.039, 0.424, 1.000, 1],
            onPrimary: [1, 1, 1, 1],
            tint:    [0.118, 0.200, 0.341, 1],
            press:   [0.250, 0.262, 0.290, 1],
            pressPrimary: [0.020, 0.300, 0.780, 1],
            pressTint: [0.070, 0.140, 0.260, 1],
            shadow:  [0, 0, 0, 0.25],
            knob:    [1, 1, 1, 1]
        }
    };

    var DS = THEMES.light;
    var CLASSIC = false;   // true = plain After Effects controls (fallback look)
    function applyTheme() {
        DS = THEMES.dark;
        CLASSIC = false;
    }

    var FONTS = {};
    function font(styleName, size) {
        var k = styleName + size;
        if (!FONTS[k]) {
            try { FONTS[k] = ScriptUI.newFont("dialog", styleName, size); } catch (e) { FONTS[k] = null; }
        }
        return FONTS[k];
    }

    function brush(g, c) { return g.newBrush(g.BrushType.SOLID_COLOR, c); }
    function pen(g, c, w) { return g.newPen(g.PenType.SOLID_COLOR, c, w || 1); }

    function setFg(el, c) { try { el.graphics.foregroundColor = pen(el.graphics, c); } catch (e) {} }
    function setFont(el, styleName, size) { try { var f = font(styleName, size); if (f) { el.graphics.font = f; } } catch (e) {} }

    // Rounded rectangle as a path (ScriptUI has no arcs, so corners are short line segments)
    function rrPath(g, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        var seg = 6, first = true;
        g.newPath();
        function arc(cx, cy, a0) {
            for (var i = 0; i <= seg; i++) {
                var a = a0 + (Math.PI / 2) * i / seg;
                var px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
                if (first) { g.moveTo(px, py); first = false; } else { g.lineTo(px, py); }
            }
        }
        arc(x + r, y + r, Math.PI);
        arc(x + w - r, y + r, Math.PI * 1.5);
        arc(x + w - r, y + h - r, 0);
        arc(x + r, y + h - r, Math.PI / 2);
        g.closePath();
    }

    function textAt(g, str, c, x, y, f) {
        if (f) { g.drawString(str, pen(g, c), x, y, f); } else { g.drawString(str, pen(g, c), x, y); }
    }

    function measure(g, str, f) {
        try { return f ? g.measureString(str, f) : g.measureString(str); } catch (e) { return [str.length * 6, 14]; }
    }

    function repaint(c) { try { c.hide(); c.show(); } catch (e) {} }

    // ---- cards ----

    // level 0 = outer card (surface), level 1 = inner card.
    // After Effects paints every group with a solid background, so a card is simply a group
    // with its own background color and a bold title label. Returns the card group (.wrap = itself).
    function card(parent, title, level) {
        level = level || 0;
        var c = parent.add("group");
        c.orientation = "column";
        c.alignChildren = ["fill", "top"];
        c.alignment = ["fill", "top"];
        c.spacing = 6;
        c.margins = (level === 0) ? [14, 12, 14, 14] : [12, 10, 12, 12];
        c.cardTitle = title || "";
        c.cardLevel = level;
        c.isSub = (level > 0);
        c.wrap = c;
        try { c.graphics.backgroundColor = brush(c.graphics, level === 0 ? DS.surface : DS.card); } catch (e) {}
        if (title) {
            var t = c.add("statictext", undefined, title);
            setFont(t, "BOLD", level === 0 ? 13 : 12);
            setFg(t, DS.text);
        }
        return c;
    }

    function subPanel(parent, title) { return card(parent, title, 1); }

    // ---- buttons ----
    // variants: primary (blue pill) · secondary (white pill, hairline) · chip / chip-on (feature tabs)

    function drawButton() {
        var g = this.graphics, w = this.size[0], h = this.size[1], v = this.variant || "primary", pr = !!this.pressed;
        var fill, stroke = null, tc, bold = false;
        if (v === "primary") { fill = pr ? DS.pressPrimary : DS.primary; tc = DS.onPrimary; bold = true; }
        else if (v === "chip-on") { fill = pr ? DS.pressTint : DS.tint; tc = DS.primary; bold = true; }
        else if (v === "chip") { fill = pr ? DS.press : DS.card; tc = DS.label; stroke = DS.border; }
        else { fill = pr ? DS.press : DS.card; tc = DS.text; stroke = DS.border; }
        if (pr && v !== "primary") { stroke = DS.primary; }
        rrPath(g, 0.5, 0.5, w - 1, h - 1, (h - 1) / 2);
        g.fillPath(brush(g, fill));
        if (stroke) { g.strokePath(pen(g, stroke, pr ? 2 : 1)); }
        var f = font(bold ? "BOLD" : "REGULAR", 12), m = measure(g, this.text, f);
        textAt(g, this.text, tc, Math.round((w - m[0]) / 2), Math.round((h - m[1]) / 2) + (pr ? 1 : 0), f);
    }

    // Click feedback: the button shows a pressed state while the mouse is down.
    function styleButton(b, variant, height) {
        b.variant = variant || "secondary";
        b.preferredSize.height = height || 32;
        if (!CLASSIC) {
            b.onDraw = drawButton;
            b.addEventListener("mousedown", function () { b.pressed = true; redraw(b); });
            b.addEventListener("mouseup", function () { b.pressed = false; redraw(b); });
            b.addEventListener("mouseout", function () { if (b.pressed) { b.pressed = false; redraw(b); } });
        }
        return b;
    }

    // ---- form rows ----

    var LABEL_W = 116;

    var STAGGER_TIP = "Delay between layers, in frames.\n0 = every selected layer starts together.\n3 = each next layer starts 3 frames after the one before it, so they animate one after another.";

    function row(parent, label) {
        var g = parent.add("group");
        g.orientation = "row";
        g.alignChildren = ["left", "center"];
        g.spacing = 6;
        if (label) {
            var s = g.add("statictext", undefined, label);
            s.preferredSize.width = LABEL_W;
            setFg(s, DS.label);
        }
        return g;
    }

    function field(parent, label, val, chars, tip) {
        var e = row(parent, label).add("edittext", undefined, val);
        e.characters = chars || 6;
        if (tip) { e.helpTip = tip; }
        return e;
    }

    function drop(parent, label, items, sel, tip) {
        var d = row(parent, label).add("dropdownlist", undefined, items);
        d.selection = sel || 0;
        if (tip) { d.helpTip = tip; }
        return d;
    }

    // Toggle switch (replaces checkboxes). Read .value; set .onToggle for change events.
    function check(parent, label, val, tip) {
        if (CLASSIC) {
            var cb = parent.add("checkbox", undefined, label);
            cb.value = !!val;
            cb.onClick = function () { if (this.onToggle) { this.onToggle(); } };
            if (tip) { cb.helpTip = tip; }
            return cb;
        }
        var b = parent.add("button", undefined, label);
        b.value = !!val;
        b.preferredSize.height = 24;
        b.alignment = ["fill", "center"];
        b.onDraw = function () {
            var g = this.graphics, h = this.size[1], tw = 32, th = 18, ty = Math.round((h - th) / 2);
            rrPath(g, 0.5, ty, tw, th, th / 2);
            g.fillPath(brush(g, this.value ? DS.primary : DS.border));
            var k = th - 4, kx = this.value ? tw - k - 1.5 : 2.5;
            g.newPath();
            g.ellipsePath(kx, ty + 2, k, k);
            g.fillPath(brush(g, DS.knob));
            var f = font("REGULAR", 12), m = measure(g, this.text, f);
            textAt(g, this.text, DS.text, tw + 10, Math.round((h - m[1]) / 2), f);
        };
        b.onClick = function () {
            this.value = !this.value;
            repaint(this);
            if (this.onToggle) { this.onToggle(); }
        };
        if (tip) { b.helpTip = tip; }
        return b;
    }

    function btnRow(parent) {
        var g = parent.add("group");
        g.orientation = "row";
        g.alignChildren = ["fill", "center"];
        g.spacing = 6;
        g.isBtnRow = true;
        return g;
    }

    // Standalone buttons are primary (main action); buttons in a row are secondary.
    function btn(parent, label, fn, tip, variant) {
        var b = parent.add("button", undefined, label);
        styleButton(b, variant || (parent.isBtnRow ? "secondary" : "primary"));
        b.onClick = function () {
            b.pressed = true;
            redraw(b);
            try { fn.call(b); }
            finally {
                try { $.sleep(80); } catch (e) {}
                b.pressed = false;
                redraw(b);
            }
        };
        if (tip) { b.helpTip = tip; }
        return b;
    }

    function hint(parent, text) {
        var s = parent.add("statictext", undefined, text);
        s.helpTip = text;
        setFg(s, DS.muted);
        setFont(s, "REGULAR", 11);
        return s;
    }

    // ---- nav icons (simple line drawings, ~18 px) ----

    var NAV_LABELS = {
        "Layers": "Layers", "Quick Actions": "Quick", "Flow": "Flow", "Camera": "Camera", "Shapes": "Shapes",
        "Animation": "Animate", "Transitions": "Cuts", "Text": "Text", "UI Kit": "UI Kit",
        "Media": "Media", "Style": "Style"
    };

    function poly(g, pts, close) {
        g.newPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) { g.lineTo(pts[i][0], pts[i][1]); }
        if (close) { g.closePath(); }
    }

    var NAV_ICONS = {
        "Layers": function (g, x, y, p) {
            rrPath(g, x - 9, y - 7, 13, 10, 3); g.strokePath(p);
            rrPath(g, x - 4, y - 2, 13, 10, 3); g.strokePath(p);
        },
        "Quick Actions": function (g, x, y, p) {
            poly(g, [[x + 2, y - 9], [x - 5, y + 1], [x, y + 1], [x - 2, y + 9], [x + 5, y - 1], [x, y - 1]], true); g.strokePath(p);
        },
        "Flow": function (g, x, y, p) {
            var pts = [], i, q;
            for (i = 0; i <= 16; i++) { q = bezierAt([0.66, 0, 0.34, 1], i / 16); pts.push([x - 9 + q[0] * 18, y + 8 - q[1] * 16]); }
            poly(g, pts, false); g.strokePath(p);
        },
        "Camera": function (g, x, y, p) {
            rrPath(g, x - 10, y - 6, 14, 12, 3); g.strokePath(p);
            poly(g, [[x + 5, y - 2], [x + 10, y - 5], [x + 10, y + 5], [x + 5, y + 2]], true); g.strokePath(p);
        },
        "Shapes": function (g, x, y, p) {
            g.newPath(); g.ellipsePath(x - 10, y - 9, 11, 11); g.strokePath(p);
            rrPath(g, x - 2, y - 1, 11, 10, 2); g.strokePath(p);
        },
        "Animation": function (g, x, y, p) {
            poly(g, [[x - 5, y - 8], [x + 8, y], [x - 5, y + 8]], true); g.strokePath(p);
        },
        "Transitions": function (g, x, y, p) {
            poly(g, [[x - 9, y - 4], [x + 8, y - 4]], false); g.strokePath(p);
            poly(g, [[x + 4, y - 8], [x + 8, y - 4], [x + 4, y]], false); g.strokePath(p);
            poly(g, [[x + 9, y + 4], [x - 8, y + 4]], false); g.strokePath(p);
            poly(g, [[x - 4, y], [x - 8, y + 4], [x - 4, y + 8]], false); g.strokePath(p);
        },
        "Text": function (g, x, y, p) {
            poly(g, [[x - 8, y - 7], [x + 8, y - 7]], false); g.strokePath(p);
            poly(g, [[x, y - 7], [x, y + 9]], false); g.strokePath(p);
        },
        "UI Kit": function (g, x, y, p, b) {
            rrPath(g, x - 11, y - 6, 22, 12, 6); g.strokePath(p);
            g.newPath(); g.ellipsePath(x - 8, y - 3, 6, 6); g.fillPath(b);
        },
        "Media": function (g, x, y, p) {
            rrPath(g, x - 9, y - 9, 8, 8, 2); g.strokePath(p);
            rrPath(g, x + 1, y - 9, 8, 8, 2); g.strokePath(p);
            rrPath(g, x - 9, y + 1, 8, 8, 2); g.strokePath(p);
            rrPath(g, x + 1, y + 1, 8, 8, 2); g.strokePath(p);
        },
        "Style": function (g, x, y, p, b) {
            g.newPath(); g.ellipsePath(x - 9, y - 9, 18, 18); g.strokePath(p);
            g.newPath(); g.ellipsePath(x - 5, y - 5, 4, 4); g.fillPath(b);
            g.newPath(); g.ellipsePath(x + 1, y - 5, 4, 4); g.fillPath(b);
            g.newPath(); g.ellipsePath(x - 2, y + 1, 4, 4); g.fillPath(b);
        }
    };

    function navTile(parent, groupName, onPick) {
        if (CLASSIC) {
            var nb = parent.add("button", undefined, NAV_LABELS[groupName] || groupName);
            nb.preferredSize = [62, 26];
            nb.groupName = groupName;
            nb.active = false;
            nb.helpTip = groupName;
            nb.baseText = NAV_LABELS[groupName] || groupName;
            nb.onClick = function () { onPick(groupName); };
            return nb;
        }
        var b = parent.add("button", undefined, NAV_LABELS[groupName] || groupName);
        b.preferredSize = [60, 56];
        b.groupName = groupName;
        b.active = false;
        b.helpTip = groupName;
        b.onDraw = function () {
            var g = this.graphics, w = this.size[0], h = this.size[1];
            var c = this.active ? DS.text : DS.muted;
            if (this.active) {
                rrPath(g, 1.5, 1.5, w - 3, h - 3, 14);
                g.fillPath(brush(g, DS.card));
                g.strokePath(pen(g, DS.border, 1));
            }
            var ic = NAV_ICONS[this.groupName];
            if (ic) { ic(g, Math.round(w / 2), 21, pen(g, c, this.active ? 2 : 1.5), brush(g, c)); }
            var f = font(this.active ? "BOLD" : "REGULAR", 10), m = measure(g, this.text, f);
            textAt(g, this.text, c, Math.round((w - m[0]) / 2), h - m[1] - 6, f);
        };
        b.onClick = function () { onPick(groupName); };
        return b;
    }

    // ---- header logo ----

    function logo(parent) {
        var l = parent.add("group");
        l.preferredSize = [26, 26];
        l.onDraw = function () {
            var g = this.graphics;
            rrPath(g, 0.5, 0.5, 25, 25, 8);
            g.fillPath(brush(g, DS.primary));
            var f = font("BOLD", 13), m = measure(g, "R", f);
            textAt(g, "R", DS.onPrimary, Math.round((26 - m[0]) / 2), Math.round((26 - m[1]) / 2), f);
        };
        return l;
    }

    // =====================================================================
    // Feature panels
    // =====================================================================

    loadStyle();
    var FEATURES = [];
    var SUBGROUP_CHIPS = { "Text": true };
    function feature(group, name, build) { FEATURES.push({ group: group, name: name, build: build }); }

    // ---------------- shared UI bits ----------------

    function grid(parent, items) {
        // items: [[label, fn, tip], ...] laid out 2 per row as secondary pill buttons
        for (var i = 0; i < items.length; i += 2) {
            var r = btnRow(parent);
            for (var k = i; k < Math.min(i + 2, items.length); k++) {
                var b = btn(r, items[k][0], items[k][1], items[k][2], "secondary");
                b.preferredSize.width = 132;
            }
        }
    }

    // ---- color picker (dark, After Effects style: saturation/brightness square + hue strip) ----

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function hsvToRgb(h, s, v) {
        h = ((h % 360) + 360) % 360;
        var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0, i = Math.floor(h / 60);
        if (i === 0) { r = c; g = x; }
        else if (i === 1) { r = x; g = c; }
        else if (i === 2) { g = c; b = x; }
        else if (i === 3) { g = x; b = c; }
        else if (i === 4) { r = x; b = c; }
        else { r = c; b = x; }
        return [r + m, g + m, b + m];
    }

    function rgbToHsv(c) {
        var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
        if (d > 0) {
            if (mx === r) { h = 60 * (((g - b) / d) % 6); }
            else if (mx === g) { h = 60 * ((b - r) / d + 2); }
            else { h = 60 * ((r - g) / d + 4); }
        }
        if (h < 0) { h += 360; }
        return { h: h, s: (mx === 0) ? 0 : d / mx, v: mx };
    }

    function redraw(c) { try { c.notify("onDraw"); } catch (e) { repaint(c); } }

    // Returns an rgb array [0..1], or null when cancelled.
    function pickColor(title, startRgb) {
        var hsv = rgbToHsv(startRgb), oldRgb = startRgb, result = null, fields = [];
        var SQ = 200, HW = 22, CELL = 10;

        function cur() { return hsvToRgb(hsv.h, hsv.s, hsv.v); }

        var dlg = new Window("dialog", title);
        dlg.orientation = "row";
        dlg.alignChildren = ["left", "top"];
        dlg.spacing = 12;
        dlg.margins = 14;
        try { dlg.graphics.backgroundColor = brush(dlg.graphics, DS.bg); } catch (e0) {}

        var sq = dlg.add("group");
        sq.preferredSize = [SQ, SQ];
        var hb = dlg.add("group");
        hb.preferredSize = [HW, SQ];
        var side = dlg.add("group");
        side.orientation = "column";
        side.alignChildren = ["fill", "top"];
        side.spacing = 6;
        var cmp = side.add("group");
        cmp.preferredSize = [96, 44];

        sq.onDraw = function () {
            var g = this.graphics, n = SQ / CELL, x, y, c;
            for (y = 0; y < n; y++) {
                for (x = 0; x < n; x++) {
                    c = hsvToRgb(hsv.h, (x + 0.5) / n, 1 - (y + 0.5) / n);
                    g.newPath();
                    g.rectPath(x * CELL, y * CELL, CELL, CELL);
                    g.fillPath(brush(g, [c[0], c[1], c[2], 1]));
                }
            }
            var cx = hsv.s * SQ, cy = (1 - hsv.v) * SQ;
            g.newPath(); g.ellipsePath(cx - 6, cy - 6, 12, 12); g.strokePath(pen(g, [0, 0, 0, 1], 3));
            g.newPath(); g.ellipsePath(cx - 6, cy - 6, 12, 12); g.strokePath(pen(g, [1, 1, 1, 1], 1.5));
        };

        hb.onDraw = function () {
            var g = this.graphics, n = SQ / 5, y, c;
            for (y = 0; y < n; y++) {
                c = hsvToRgb((y + 0.5) / n * 360, 1, 1);
                g.newPath();
                g.rectPath(0, y * 5, HW, 5);
                g.fillPath(brush(g, [c[0], c[1], c[2], 1]));
            }
            var my = Math.round(hsv.h / 360 * SQ);
            g.newPath(); g.rectPath(0, my - 2, HW, 4); g.strokePath(pen(g, [0, 0, 0, 1], 3));
            g.newPath(); g.rectPath(0, my - 2, HW, 4); g.strokePath(pen(g, [1, 1, 1, 1], 1.5));
        };

        cmp.onDraw = function () {
            var g = this.graphics, a = cur(), o = oldRgb;
            g.newPath(); g.rectPath(0, 0, 96, 22); g.fillPath(brush(g, [a[0], a[1], a[2], 1]));
            g.newPath(); g.rectPath(0, 22, 96, 22); g.fillPath(brush(g, [o[0], o[1], o[2], 1]));
            rrPath(g, 0.5, 0.5, 95, 43, 2); g.strokePath(pen(g, DS.border, 1));
        };

        var down = null;
        function mouseMove(e) {
            if (!down) { return; }
            if (down === "sq") { hsv.s = clamp01(e.clientX / SQ); hsv.v = 1 - clamp01(e.clientY / SQ); }
            else { hsv.h = clamp01(e.clientY / SQ) * 360; }
            refresh();
        }
        function bindMouse(ctrl, which) {
            ctrl.addEventListener("mousedown", function (e) { down = which; mouseMove(e); });
            ctrl.addEventListener("mousemove", mouseMove);
            ctrl.addEventListener("mouseup", function () { down = null; });
        }
        bindMouse(sq, "sq");
        bindMouse(hb, "hue");

        function addNum(name, get, set) {
            var r = side.add("group");
            r.orientation = "row";
            r.alignChildren = ["left", "center"];
            var l = r.add("statictext", undefined, name);
            l.preferredSize.width = 14;
            setFg(l, DS.label);
            var e = r.add("edittext", undefined, "");
            e.characters = 5;
            e.onChange = function () { set(num(e.text, get())); refresh(); };
            fields.push({ edit: e, get: get });
        }
        function setChannel(i, v) {
            var c = cur(), n;
            c[i] = Math.max(0, Math.min(255, v)) / 255;
            n = rgbToHsv(c);
            if (n.s === 0) { n.h = hsv.h; }
            hsv = n;
        }
        addNum("H", function () { return Math.round(hsv.h); }, function (v) { hsv.h = Math.max(0, Math.min(360, v)); });
        addNum("S", function () { return Math.round(hsv.s * 100); }, function (v) { hsv.s = Math.max(0, Math.min(100, v)) / 100; });
        addNum("B", function () { return Math.round(hsv.v * 100); }, function (v) { hsv.v = Math.max(0, Math.min(100, v)) / 100; });
        addNum("R", function () { return Math.round(cur()[0] * 255); }, function (v) { setChannel(0, v); });
        addNum("G", function () { return Math.round(cur()[1] * 255); }, function (v) { setChannel(1, v); });
        addNum("B", function () { return Math.round(cur()[2] * 255); }, function (v) { setChannel(2, v); });

        var hr = side.add("group");
        hr.orientation = "row";
        hr.alignChildren = ["left", "center"];
        var hl = hr.add("statictext", undefined, "#");
        hl.preferredSize.width = 14;
        setFg(hl, DS.label);
        var hexE = hr.add("edittext", undefined, "");
        hexE.characters = 7;
        hexE.onChange = function () {
            var n = rgbToHsv(hexToRgb(hexE.text));
            if (n.s === 0) { n.h = hsv.h; }
            hsv = n;
            refresh();
        };

        function refresh() {
            for (var i = 0; i < fields.length; i++) { fields[i].edit.text = String(fields[i].get()); }
            hexE.text = rgbToHex(cur()).replace("#", "");
            redraw(sq); redraw(hb); redraw(cmp);
        }

        var br = side.add("group");
        br.orientation = "row";
        br.alignChildren = ["fill", "center"];
        br.spacing = 6;
        var okB = styleButton(br.add("button", undefined, "OK", { name: "ok" }), "primary", 30);
        var noB = styleButton(br.add("button", undefined, "Cancel", { name: "cancel" }), "secondary", 30);
        okB.preferredSize.width = 60;
        noB.preferredSize.width = 60;
        okB.onClick = function () { result = cur(); dlg.close(1); };
        noB.onClick = function () { dlg.close(0); };

        refresh();
        dlg.show();
        return result;
    }

    // Opens the dark picker; falls back to the system picker if it can't be built.
    function colorTitle(label) {
        var n = trim(String(label).replace(/:/g, ""));
        return /color/i.test(n) ? n : n + " color";
    }

    function chooseColor(title, rgb) {
        try { return pickColor(title, rgb); } catch (e) {}
        var res = $.colorPicker((Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255));
        return (res >= 0) ? [((res >> 16) & 255) / 255, ((res >> 8) & 255) / 255, (res & 255) / 255] : null;
    }

    // Hex color field with a live swatch and a color picker. Returns { get: fn -> rgb }
    function colorChooser(parent, label, defHex, key, big) {
        var start = key ? getS(key, defHex) : defHex;
        var r = row(parent, label);
        var sw, pick = null;
        if (big) {
            // Large swatch that is itself the button: click it to open the color picker
            sw = r.add("button", undefined, "");
            sw.isSwatch = true;
            sw.hexStr = start;
            sw.preferredSize = [64, 40];
            sw.helpTip = "Click to choose a color";
            sw.onDraw = function () {
                var g = this.graphics, c = hexToRgb(this.hexStr);
                rrPath(g, 0.5, 0.5, this.size[0] - 1, this.size[1] - 1, 8);
                g.fillPath(brush(g, [c[0], c[1], c[2], 1]));
                g.strokePath(pen(g, DS.border, 1));
            };
        } else {
            sw = r.add("group");
            sw.preferredSize = [24, 20];
        }
        var hex = r.add("edittext", undefined, start);
        hex.characters = 8;
        hex.helpTip = "Hex color, e.g. #4285F4";
        function update() {
            hex.text = rgbToHex(hexToRgb(hex.text));
            paintSwatch(sw, hex.text);
            if (key) { putS(key, hex.text); }
        }
        function choose() {
            var c = chooseColor(colorTitle(label), hexToRgb(hex.text));
            if (c) {
                hex.text = rgbToHex(c);
                update();
            }
        }
        hex.onChange = update;
        if (big) {
            sw.onClick = choose;
        } else {
            pick = styleButton(r.add("button", undefined, "Pick…"), "secondary", 26);
            pick.preferredSize.width = 60;
            pick.onClick = choose;
        }
        paintSwatch(sw, start);
        return { get: function () { return hexToRgb(hex.text); } };
    }

    // ---------------- Layers ----------------

    feature("Layers", "Layer operations", function (p) {
        grid(p, [
            ["Pre-comp", function () { run("Pre-comp", doPrecomposeSafe); }, "Group layers safely — keeps their in/out range"],
            ["Unwrap Comp", function () {
                run("Unwrap Comp", function () { doUnwrapComp({ keepTransform: true, removeLayer: true }); });
            }, "Moves the layers of the selected pre-comp into this comp, with timing and parenting. A null keeps the pre-comp layer's transform."],
            ["Adjustment Layer", function () { run("Adjustment Layer", doAdjustmentLayer); }, "Full comp bounds, above the selection"],
            ["Smart Null", function () { run("Smart Null", doSmartNull); }, "50×50 null at the comp center (or the selection's center), parents selected layers"]
        ]);

        var dup = subPanel(p, "Smart Duplicate");
        var dupN = field(dup, "Copies:", "1", 4);
        var dupMode = drop(dup, "Precomp copies:", ["Linked — edits affect all", "Independent — own comp"], 1,
            "Linked: every copy uses the same comp, so editing one changes all.\nIndependent: each copy gets its own comp (nested comps copied too), so edits stay separate.");
        btn(dup, "Smart Duplicate", function () {
            run("Smart Duplicate", function () {
                doSmartDuplicate(Math.round(num(dupN.text, 1, 1, 100)), dupMode.selection.index === 1);
            });
        }, "Index duplicate: Card 01 → Card 02");

        var sol = subPanel(p, "Solid Layer");
        var solidC = colorChooser(sol, "Color:", "#4285F4", "solid_color", true);
        btn(sol, "Solid Layer", function () {
            run("Solid Layer", function () { doSolidLayer(solidC.get()); });
        });

        var fp = subPanel(p, "Follow Path");
        hint(fp, "Select a path layer (mask or shape) + the follower.");
        var fpD = field(fp, "Path time (s):", "3", 4);
        var fpL = check(fp, "Loop along path", true);
        var fpO = check(fp, "Orient along path", false);
        btn(fp, "Follow Path", function () {
            run("Follow Path", function () { doFollowPath(num(fpD.text, 3, 0.1, 600), fpL.value, fpO.value); });
        }, "The follower moves along the path, driven by an \"MK Path Progress\" slider.");
    });

    // ---------------- Quick Actions ----------------

    feature("Quick Actions", "Motion quick actions", function (p) {
        var qb = getS("quick_bounce", style.bounceOn) === "1";
        var bT = check(p, "Bounce effect", qb, "ON: every animation below bounces (slides, pops and fades overshoot and settle).\nOFF: clean eased motion with no bounce.\nSet how much with Bounce (%) below.");
        bT.onToggle = function () {
            qb = bT.value;
            putS("quick_bounce", qb ? "1" : "0");
        };

        var bPct = field(p, "Bounce (%):", getS("quick_bounce_pct", style.bounceAmt), 4,
            "How far animations overshoot before settling.\n5 = subtle, 10 = default, 30 = very springy.");
        bPct.onChange = function () { bPct.text = String(num(bPct.text, 10, 1, 60)); putS("quick_bounce_pct", bPct.text); };
        var dist = field(p, "Slide distance (px):", "200", 5);
        var gdir = drop(p, "Gradient direction:", ["Horizontal", "Vertical", "Diagonal"], 0);

        // Runs an animation action with the Quick Actions bounce state
        function anim(label, fn) {
            return function () { run(label, function () { withBounce(qb, fn, num(bPct.text, 10, 1, 60)); }); };
        }
        function slide(dir, label) {
            return anim(label, function () {
                doMove(dir, { mode: "in", offscreen: false, distance: num(dist.text, 200, 1, 20000), fade: true, stagger: 0 });
            });
        }
        grid(p, [
            ["Fade In", anim("Fade In", function () { doFade(true, 0, qb); })],
            ["Fade Out", anim("Fade Out", function () { doFade(false, 0, qb); })],
            ["Slide Left", slide([-1, 0], "Slide Left"), "Slides in, travelling left"],
            ["Slide Right", slide([1, 0], "Slide Right"), "Slides in, travelling right"],
            ["Slide Up", slide([0, -1], "Slide Up"), "Slides in, travelling up"],
            ["Slide Down", slide([0, 1], "Slide Down"), "Slides in, travelling down"],
            ["Scale Pop", anim("Scale Pop", function () { doPop("up", { fade: true, center: "auto", stagger: 0 }); })],
            ["Blur Fade", anim("Blur Fade", function () { doBlurFade(0, qb); })],
            ["Reverse Keys", function () { run("Reverse Keys", doReverseKeys); }, "Reverses selected keyframed properties (or all on the selected layers)"],
            ["Lock Gradient", function () { run("Lock Gradient", function () { doLockGradient(gdir.selection.index); }); }, "Gradient that stays locked to the layer: it moves, scales and rotates with it"]
        ]);
        hint(p, "Bounce applies to Fade, Slide, Scale Pop and Blur Fade.");
        hint(p, "Uses Duration and Curve from the Style group. Anchor points are kept as you set them.");

        var ball = subPanel(p, "Bounce the ball effect");
        hint(ball, "Keyframed layers bounce like a ball after each key.");
        var ballAmt = field(ball, "Amount (%):", getS("quick_ball", "10"), 4,
            "How far it bounces after each keyframe.\n5 = small settle, 10 = default, 30+ = big rubber-ball bounce.");
        ballAmt.onChange = function () { ballAmt.text = String(num(ballAmt.text, 10, 1, 100)); putS("quick_ball", ballAmt.text); };
        btn(ball, "Bounce the ball effect", function () {
            run("Bounce the ball effect", function () { doBouncePhysics(num(ballAmt.text, 10, 1, 100)); });
        }, "Adds a ball-like bounce after every keyframe of the selected layers (position, scale, rotation) or selected keyframed properties.");
    });

    // ---------------- Flow ----------------

    var FLOW_ORANGE = [0.96, 0.65, 0.14, 1];

    // Draws a bezier curve as a smooth polyline into box (bx, by, bw, bh); yOf maps a value to y
    function flowCurvePath(g, c, xOf, yOf) {
        var i, q;
        g.newPath();
        for (i = 0; i <= 64; i++) {
            q = bezierAt(c, i / 64);
            if (i === 0) { g.moveTo(xOf(q[0]), yOf(q[1])); } else { g.lineTo(xOf(q[0]), yOf(q[1])); }
        }
    }

    feature("Flow", "Easing curves", function (p) {
        var GW = 204, GH = 190, X0 = 14, XW = 176, Y0 = 134, YS = 80;     // plot: u 0..1 -> X0..X0+XW, v 0..1 -> Y0..Y0-YS
        var cur = [0.66, 0, 0.34, 1], mode = "both", picked = -1, drag = -1, i;
        var saved = splitList(getS("flow_curve", ""));
        if (saved.length === 4) { for (i = 0; i < 4; i++) { cur[i] = num(saved[i], cur[i], -1, 2); } }
        for (i = 0; i < FLOW_PRESETS.length; i++) {
            if (FLOW_PRESETS[i][1] === cur[0] && FLOW_PRESETS[i][2] === cur[1] && FLOW_PRESETS[i][3] === cur[2] && FLOW_PRESETS[i][4] === cur[3]) { picked = i; }
        }
        function xOf(u) { return X0 + u * XW; }
        function yOf(v) { return Y0 - v * YS; }

        hint(p, "Select keyframes, pick a curve, edit it if you like, then Apply.");

        var gr = p.add("group");
        gr.preferredSize = [GW, GH];
        gr.alignment = ["center", "top"];
        gr.helpTip = "Drag the orange handles to shape the curve.";
        gr.onDraw = function () {
            var g = this.graphics, k;
            rrPath(g, 0.5, 0.5, GW - 1, GH - 1, 10);
            g.fillPath(brush(g, DS.card));
            for (k = 0; k <= 4; k++) {
                poly(g, [[xOf(k / 4), yOf(-0.6)], [xOf(k / 4), yOf(1.6)]], false); g.strokePath(pen(g, DS.border, 1));
            }
            for (k = -2; k <= 6; k++) {
                poly(g, [[X0 - 8, yOf(k / 4)], [X0 + XW + 8, yOf(k / 4)]], false); g.strokePath(pen(g, DS.border, 1));
            }
            g.newPath(); g.rectPath(X0, yOf(1), XW, YS); g.strokePath(pen(g, DS.primary, 1));
            poly(g, [[xOf(0), yOf(0)], [xOf(1), yOf(1)]], false); g.strokePath(pen(g, DS.muted, 1));
            poly(g, [[xOf(0), yOf(0)], [xOf(cur[0]), yOf(cur[1])]], false); g.strokePath(pen(g, FLOW_ORANGE, 2));
            poly(g, [[xOf(1), yOf(1)], [xOf(cur[2]), yOf(cur[3])]], false); g.strokePath(pen(g, FLOW_ORANGE, 2));
            flowCurvePath(g, cur, xOf, yOf); g.strokePath(pen(g, DS.text, 3));
            var pts = [[0, 0, DS.text], [1, 1, DS.text], [cur[0], cur[1], FLOW_ORANGE], [cur[2], cur[3], FLOW_ORANGE]];
            for (k = 0; k < 4; k++) {
                g.newPath(); g.ellipsePath(xOf(pts[k][0]) - 5, yOf(pts[k][1]) - 5, 10, 10); g.fillPath(brush(g, pts[k][2]));
            }
        };

        var vals = row(p, "Curve:");
        var ef = [], names = ["x1", "y1", "x2", "y2"];
        function two(v) { return String(Math.round(v * 100) / 100); }
        var tiles = [];

        function refresh(fromPreset) {
            for (var k = 0; k < 4; k++) { ef[k].text = two(cur[k]); }
            if (!fromPreset) { picked = -1; }
            putS("flow_curve", cur.join(","));
            redraw(gr);
            for (k = 0; k < tiles.length; k++) { redraw(tiles[k]); }
        }
        for (i = 0; i < 4; i++) {
            (function (k) {
                var e = vals.add("edittext", undefined, two(cur[k]));
                e.characters = 4;
                e.helpTip = names[k] + (k % 2 === 0 ? " (time, 0–1)" : " (value)");
                e.onChange = function () {
                    cur[k] = (k % 2 === 0) ? num(e.text, cur[k], 0, 1) : num(e.text, cur[k], -1, 2);
                    refresh(false);
                };
                ef.push(e);
            })(i);
        }

        function moveHandle(e) {
            if (drag < 0) { return; }
            var u = Math.max(0, Math.min(1, (e.clientX - X0) / XW)), v = Math.max(-0.6, Math.min(1.6, (Y0 - e.clientY) / YS));
            cur[drag * 2] = Math.round(u * 100) / 100;
            cur[drag * 2 + 1] = Math.round(v * 100) / 100;
            refresh(false);
        }
        gr.addEventListener("mousedown", function (e) {
            var d0 = Math.abs(e.clientX - xOf(cur[0])) + Math.abs(e.clientY - yOf(cur[1]));
            var d1 = Math.abs(e.clientX - xOf(cur[2])) + Math.abs(e.clientY - yOf(cur[3]));
            drag = (d0 <= d1) ? 0 : 1;
            moveHandle(e);
        });
        gr.addEventListener("mousemove", moveHandle);
        gr.addEventListener("mouseup", function () { drag = -1; });
        gr.addEventListener("mouseout", function () { drag = -1; });

        // Which keyframe side the curve is applied to
        var mr = btnRow(p);
        var modeBtns = [];
        var modeDefs = [["◂ In", "in"], ["Both", "both"], ["Out ▸", "out"]];
        function paintModes() {
            for (var k = 0; k < modeBtns.length; k++) {
                modeBtns[k].variant = (modeBtns[k].modeId === mode) ? "primary" : "secondary";
                redraw(modeBtns[k]);
            }
        }
        for (i = 0; i < modeDefs.length; i++) {
            (function (d) {
                var b = styleButton(mr.add("button", undefined, d[0]), d[1] === mode ? "primary" : "secondary", 28);
                b.modeId = d[1];
                b.helpTip = (d[1] === "both") ? "Ease into and out of the keyframes."
                    : (d[1] === "in") ? "Only the incoming side of each segment (slow arrival)."
                    : "Only the outgoing side of each segment (slow departure).";
                b.onClick = function () { mode = d[1]; paintModes(); };
                modeBtns.push(b);
            })(modeDefs[i]);
        }

        var bounceT = check(p, "Bounce effect", getS("flow_bounce", "0") === "1",
            "ON: after each keyframe the layer springs a little past its end value and settles.\nOFF: no bounce (also removes a Flow bounce added earlier).");
        bounceT.onToggle = function () { putS("flow_bounce", bounceT.value ? "1" : "0"); };
        var bounceP = field(p, "Bounce (%):", getS("flow_bounce_pct", "10"), 4,
            "How far it overshoots, as a % of the move. 5 = subtle, 10 = default, 30 = very springy.");
        bounceP.onChange = function () { bounceP.text = String(num(bounceP.text, 10, 1, 100)); putS("flow_bounce_pct", bounceP.text); };

        btn(p, "Apply", function () {
            run("Flow easing", function () {
                doFlowApply(cur, mode, { bounce: bounceT.value, pct: num(bounceP.text, 10, 1, 100) });
            });
        }, "Applies this curve (and the bounce, if on) to the selected keyframes, or to every key of the selected properties.");

        // Preset tiles, 7 per row: click one to load it into the graph above
        var pr = null;
        function drawTile() {
            var g = this.graphics, w = this.size[0], h = this.size[1], c = this.curve, on = (this.presetIndex === picked);
            rrPath(g, 0.5, 0.5, w - 1, h - 1, 8);
            g.fillPath(brush(g, on ? DS.primary : DS.card));
            if (!on) { g.strokePath(pen(g, DS.border, 1)); }
            var ink = on ? DS.onPrimary : DS.text, soft = on ? [1, 1, 1, 0.55] : DS.muted;
            var lo = Math.min(0, c[1], c[3]), hi = Math.max(1, c[1], c[3]), k, q;
            for (k = 0; k <= 16; k++) { q = bezierAt(c, k / 16); lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
            var bx = 8, bw = w - 16, by = 6, bh = h - 24, span = hi - lo;
            function tx(u) { return bx + u * bw; }
            function ty(v) { return by + bh - (v - lo) / span * bh; }
            poly(g, [[tx(0), ty(0)], [tx(c[0]), ty(c[1])]], false); g.strokePath(pen(g, soft, 1));
            poly(g, [[tx(1), ty(1)], [tx(c[2]), ty(c[3])]], false); g.strokePath(pen(g, soft, 1));
            flowCurvePath(g, c, tx, ty); g.strokePath(pen(g, ink, 2));
            var dots = [[0, 0], [1, 1], [c[0], c[1]], [c[2], c[3]]];
            for (k = 0; k < 4; k++) {
                g.newPath(); g.ellipsePath(tx(dots[k][0]) - 2, ty(dots[k][1]) - 2, 4, 4);
                g.fillPath(brush(g, k < 2 ? ink : soft));
            }
            var f = font(on ? "BOLD" : "REGULAR", 9), m = measure(g, this.text, f);
            textAt(g, this.text, on ? DS.onPrimary : DS.muted, Math.round((w - m[0]) / 2), h - m[1] - 4, f);
        }
        for (i = 0; i < FLOW_PRESETS.length; i++) {
            if (i % 7 === 0) {
                pr = p.add("group");
                pr.orientation = "row";
                pr.alignChildren = ["fill", "center"];
                pr.spacing = 4;
            }
            (function (idx) {
                var d = FLOW_PRESETS[idx];
                var t = pr.add("button", undefined, d[0]);
                t.preferredSize = [44, 60];
                t.presetIndex = idx;
                t.curve = [d[1], d[2], d[3], d[4]];
                t.helpTip = d[0] + "  (" + d[1] + ", " + d[2] + ", " + d[3] + ", " + d[4] + ")\nClick to load it into the graph, then Apply.";
                t.onDraw = drawTile;
                t.onClick = function () {
                    cur = [d[1], d[2], d[3], d[4]];
                    picked = idx;
                    refresh(true);
                };
                tiles.push(t);
            })(i);
        }
    });

    // ---------------- Camera ----------------

    feature("Camera", "Camera", function (p) {
        var rig = subPanel(p, "3-node camera");
        hint(rig, "Orbit null › Dolly null › Camera");
        var dof = check(rig, "Depth of field", true);
        var ap = field(rig, "Aperture (blur):", "60", 5);
        btn(rig, "Create 3-node camera", function () {
            run("Camera 3-Node", function () { doCamera3Node(dof.value, num(ap.text, 60, 1, 500)); });
        });

        var par = subPanel(p, "Parallax: arrange layers in depth");
        hint(par, "Select layers, then set the gap between them.");
        var dist = field(par, "Distance (px):", "300", 5, "Z gap between each layer. Bigger = stronger parallax.");
        var startZ = field(par, "Front layer Z (px):", "0", 5);
        var front = drop(par, "In front:", ["Top layer", "Bottom layer"], 0, "Which end of your timeline selection is closest to the camera.");
        var keep = check(par, "Keep on-screen size", true, "Scales layers so they look the same size; only the parallax changes.");
        var addRig = check(par, "Add camera rig if none", true);
        btn(par, "Arrange selected in depth", function () {
            run("Parallax depth", function () {
                doParallax(num(dist.text, 300, -100000, 100000), num(startZ.text, 0, -100000, 100000), front.selection.index === 0, keep.value, addRig.value);
            });
        });

    });

    // ---------------- Shapes ----------------

    feature("Shapes", "Smart shape", function (p) {
        var geo = subPanel(p, "Shape");
        var type = drop(geo, "Type:", SHAPE_TYPES, 0);
        var sizeRow = row(geo, "Width × Height:");
        var w = sizeRow.add("edittext", undefined, "400"); w.characters = 5;
        var h = sizeRow.add("edittext", undefined, "400"); h.characters = 5;
        var rad = field(geo, "Corner radius:", "60", 5, "Rounded rectangle only.");
        var pts = field(geo, "Points / sides:", "5", 4, "Star and Polygon.");
        var inner = field(geo, "Star inner (%):", "45", 4, "Star only: inner radius as % of outer.");

        var look = subPanel(p, "Fill & stroke");
        var fillC = colorChooser(look, "Fill color:", "#4285F4", "shape_fill");
        var fillO = field(look, "Fill opacity (%):", "100", 4);
        var grad = check(look, "Gradient fill (locked to shape)", false, "Uses Gradient start/end colors from Style.");
        var gdir = drop(look, "Gradient direction:", ["Horizontal", "Vertical", "Diagonal"], 2);
        var strk = check(look, "Stroke", false);
        var strkC = colorChooser(look, "Stroke color:", "#1A73E8", "shape_stroke");
        var strkW = field(look, "Stroke width:", "4", 4);

        var fx = subPanel(p, "Effects");
        var shadow = check(fx, "Soft shadow", true);
        var frost = check(fx, "Frosted glass behind (new shapes)", false);

        function settings() {
            return {
                type: type.selection.index,
                w: num(w.text, 400, 2, 8000), h: num(h.text, 400, 2, 8000),
                radius: num(rad.text, 60, 0, 4000),
                points: Math.round(num(pts.text, 5, 3, 64)), inner: num(inner.text, 45, 5, 95) / 100,
                fill: fillC.get(), fillOpacity: num(fillO.text, 100, 0, 100),
                gradient: grad.value, gradDir: gdir.selection.index,
                stroke: strk.value, strokeColor: strkC.get(), strokeWidth: num(strkW.text, 4, 0.5, 200),
                innerStroke: false, shadow: shadow.value, frosted: frost.value, pop: false
            };
        }

        var r = btnRow(p);
        btn(r, "Create shape", function () { run("Create shape", function () { doCreateShape(settings()); }); }, null, "primary");
        btn(r, "Update selected", function () { run("Update shape", function () { doUpdateShape(settings()); }); },
            "Rebuilds the selected shape layers with these settings. Layer position, scale and animation are kept.");
    });

    // ---------------- Animation ----------------

    feature("Animation", "Shape morph", function (p) {
        hint(p, "Select 2 shape layers, playhead at the start.");
        var from = drop(p, "Morph from:", ["Lower layer", "Upper layer"], 0, "Lower layer = the shape you drew first.");
        var colr = check(p, "Morph fill color", true);
        var hide = check(p, "Hide target layer", true);
        var pre = check(p, "Put morph in a new composition", true);
        btn(p, "Morph", function () {
            run("Shape morph", function () {
                doMorph({ fromLower: from.selection.index === 0, color: colr.value, hide: hide.value, precomp: pre.value });
            });
        });
    });

    feature("Animation", "Pop", function (p) {
        var fade = check(p, "Fade opacity too", true);
        var center = check(p, "Scale from layer center", true, "Moves the anchor point to the layer's center first.");
        hint(p, "Springs past the end size and settles. Edit freq / decay / amp in the scale expression to tune.");
        var r = btnRow(p);
        function go(mode) {
            run("Pop " + mode, function () { doPop(mode, { fade: fade.value, center: center.value, stagger: 0, smooth: true }); });
        }
        btn(r, "Pop Up", function () { go("up"); });
        btn(r, "Pop Out", function () { go("out"); });
    });

    feature("Animation", "Move in / out", function (p) {
        var mode = drop(p, "Mode:", ["In", "Out"], 0);
        var dist = drop(p, "Distance:", ["Off screen", "Custom"], 0);
        var px = field(p, "Custom (px):", "300", 5, "Used when Distance is Custom.");
        // The custom distance only applies when Distance is "Custom": grey it out otherwise
        function syncCustom() {
            var on = !!dist.selection && dist.selection.index === 1;
            px.enabled = on;
            try { px.parent.children[0].enabled = on; } catch (e) {}
        }
        dist.onChange = syncCustom;
        syncCustom();
        var fade = check(p, "Fade opacity too", false);
        var stag = field(p, "Stagger (frames):", "0", 4, STAGGER_TIP);
        hint(p, "Arrow = direction of travel:");
        var r = btnRow(p);
        function go(dir) {
            run("Move", function () {
                doMove(dir, {
                    mode: mode.selection.index === 0 ? "in" : "out", offscreen: dist.selection.index === 0,
                    distance: num(px.text, 300, 1, 20000), fade: fade.value, stagger: num(stag.text, 0, 0, 120)
                });
            });
        }
        btn(r, "←", function () { go([-1, 0]); });
        btn(r, "↑", function () { go([0, -1]); });
        btn(r, "↓", function () { go([0, 1]); });
        btn(r, "→", function () { go([1, 0]); });
    });

    feature("Animation", "UI list stagger", function (p) {
        hint(p, "Select imported UI rows. Animates top to bottom.");
        var off = field(p, "Slide up (px):", "40", 5);
        var stag = field(p, "Stagger (frames):", "2", 4, STAGGER_TIP);
        var fade = check(p, "Fade opacity too", true);
        btn(p, "Stagger selected layers", function () {
            run("UI list stagger", function () {
                doListStagger({ offset: num(off.text, 40, 0, 2000), stagger: num(stag.text, 2, 0, 60), fade: fade.value });
            });
        });
    });

    feature("Animation", "Hold push-in", function (p) {
        hint(p, "Slow scale-up on holds (100% → 105%).");
        var amt = field(p, "Amount (%):", "5", 4);
        var range = drop(p, "Range:", ["Whole layer", "Playhead to layer end"], 0);
        btn(p, "Push in selected", function () {
            run("Hold push-in", function () { doPushIn(num(amt.text, 5, 0.5, 100), range.selection.index === 1); });
        });
    });

    // ---------------- Transitions ----------------

    feature("Transitions", "Zoom cut", function (p) {
        hint(p, "Select 2 clips, or put the playhead on the cut.");
        var fr = field(p, "Frames each side:", "6", 4);
        var k = field(p, "Intensity (×):", "3", 4);
        var blur = field(p, "Blur (shutter °):", "270", 4);
        var r = btnRow(p);
        function go(zin) {
            run("Zoom cut", function () {
                doZoomCut(zin, { frames: num(fr.text, 6, 1, 60), intensity: num(k.text, 3, 1.2, 10), blur: num(blur.text, 270, 0, 720) });
            });
        }
        btn(r, "Zoom In", function () { go(true); });
        btn(r, "Zoom Out", function () { go(false); });
    });

    feature("Transitions", "Swipe cut", function (p) {
        hint(p, "Select the outgoing + incoming clips, or put the playhead on the cut.");
        hint(p, "Adds 3 linked nulls: Out, In and a Move null at the cut.");
        var fr = field(p, "Frames each side:", "15", 4, "How long the whoosh lasts on each side of the cut.");
        var dist = field(p, "Distance (%):", "27", 4, "How far the clips slide. 27% is about 520 px on a 1920 frame, so both stay on screen. 100% = a full screen.");
        var blur = field(p, "Blur (shutter °):", "300", 4, "Raises the comp's shutter angle to at least this, for motion blur.");
        var r = btnRow(p);
        function go(dir) {
            run("Swipe cut", function () { doSwipeCut(dir, { frames: Math.round(num(fr.text, 15, 1, 60)), distance: num(dist.text, 27, 1, 300), blur: num(blur.text, 300, 0, 720) }); });
        }
        btn(r, "←", function () { go([-1, 0]); });
        btn(r, "↑", function () { go([0, -1]); });
        btn(r, "↓", function () { go([0, 1]); });
        btn(r, "→", function () { go([1, 0]); });
    });

    feature("Transitions", "Shape wipe", function (p) {
        hint(p, "Select 2 clips, or put the playhead on the cut.");
        var shp = drop(p, "Shape:", ["Circle", "Triangle"], 0);
        var org = drop(p, "Grow from:", ["Center", "Left", "Right", "Top", "Bottom"], 0);
        var acc = check(p, "Blue accent shape leads the reveal", true);
        var lead = field(p, "Accent lead (frames):", "3", 4);
        btn(p, "Add shape wipe", function () {
            var ids = ["center", "left", "right", "top", "bottom"];
            run("Shape wipe", function () {
                doShapeWipe({
                    shape: shp.selection.index === 0 ? "circle" : "triangle", origin: ids[org.selection.index],
                    accent: acc.value, lead: num(lead.text, 3, 0, 30)
                });
            });
        });
    });

    // ---------------- Text ----------------

    feature("Text", "Motion", function (p) {
        if (TEXT_PRESETS.length === 0) {
            hint(p, "No text presets yet.");
            hint(p, "Add .ffx files to presets/text and rebuild.");
            return;
        }
        hint(p, "Select text layer(s), put the playhead where it should start, click a preset.");
        // two columns; every button gets the same preferred width so the pair splits the row evenly
        var row2 = null;
        for (var i = 0; i < TEXT_PRESETS.length; i++) {
            if (i % 2 === 0) { row2 = btnRow(p); }
            (function (idx) {
                var tb = btn(row2, TEXT_PRESETS[idx].name, function () {
                    run("Text preset: " + TEXT_PRESETS[idx].name, function () { doTextPreset(idx); });
                }, "Applies the \"" + TEXT_PRESETS[idx].name + "\" animation preset to the selected layers, starting at the playhead.");
                tb.preferredSize.width = 120;
            })(i);
        }
        if (TEXT_PRESETS.length % 2 === 1) {
            // keep the last button the same width as the others
            var pad = row2.add("group");
            pad.preferredSize = [120, 32];
        }
    });

    feature("Text", "Text + Icon", function (p) {
        hint(p, "Type 2–6 words, choose where the icon goes, browse for your icon.");
        var sent = field(p, "Sentence:", getS("ti_sentence", "feature requests"), 24, "Your words. The icon is placed in the gap you choose below.");
        var where = drop(p, "Icon position:", ["…"], 0, "Where the icon sits in the sentence.");
        var look = hint(p, "");
        look.alignment = ["fill", "top"];

        // icon file (browse) or the built-in sparkle
        var iconFile = null;
        var iconRow = row(p, "Icon:");
        var iconName = iconRow.add("statictext", undefined, "Built-in sparkle");
        iconName.preferredSize.width = 112;
        setFg(iconName, DS.label);
        var browseB = styleButton(iconRow.add("button", undefined, "Browse…"), "secondary", 26);
        browseB.preferredSize.width = 74;
        browseB.helpTip = "Choose your own icon: PNG, SVG, AI, PSD or JPG.";
        var sparkB = styleButton(iconRow.add("button", undefined, "Sparkle"), "secondary", 26);
        sparkB.preferredSize.width = 66;
        sparkB.helpTip = "Go back to the built-in sparkle.";

        function iconFilter() {
            try { if ($.os.indexOf("Windows") >= 0) { return "Images:*.png;*.svg;*.ai;*.psd;*.jpg;*.jpeg;*.gif;*.tif;*.tiff,All files:*.*"; } } catch (e) {}
            return function (f) { return (f instanceof Folder) || /\.(png|svg|ai|psd|jpe?g|gif|tiff?|eps)$/i.test(f.name); };
        }
        browseB.onClick = function () {
            var f = null;
            try { f = File.openDialog("Choose an icon (PNG, SVG, AI, PSD, JPG)", iconFilter()); } catch (e) {}
            if (f) { iconFile = f; iconName.text = f.name; putS("ti_icon", f.fsName); }
        };
        sparkB.onClick = function () { iconFile = null; iconName.text = "Built-in sparkle"; putS("ti_icon", ""); };
        var savedIcon = getS("ti_icon", "");
        if (savedIcon !== "") {
            try { var sf = new File(savedIcon); if (sf.exists) { iconFile = sf; iconName.text = sf.name; } } catch (e2) {}
        }

        // the position list follows the words you type
        function updateLine() {
            var words = tiWords(sent.text), at = where.selection ? where.selection.index : 1, out = [], i;
            for (i = 0; i <= words.length; i++) {
                if (i === at) { out.push("(icon)"); }
                if (i < words.length) { out.push(words[i]); }
            }
            look.text = "Preview:  " + out.join(" ");
        }
        function refresh() {
            var labels = tiSlotLabels(tiWords(sent.text)), keep = where.selection ? where.selection.index : 1, i;
            where.removeAll();
            for (i = 0; i < labels.length; i++) { where.add("item", labels[i]); }
            if (labels.length > 0) { where.selection = Math.max(0, Math.min(keep, labels.length - 1)); }
            updateLine();
        }
        where.onChange = updateLine;
        sent.onChanging = refresh;
        sent.onChange = function () { putS("ti_sentence", sent.text); refresh(); };
        refresh();

        var tcol = colorChooser(p, "Text color:", style.textGray, "ti_text_color");
        var icol = colorChooser(p, "Icon color:", style.textGray, "ti_icon_color");
        var size = field(p, "Font size:", getS("ti_size", "90"), 4, "Text size in pixels.");
        size.onChange = function () { size.text = String(num(size.text, 90, 12, 600)); putS("ti_size", size.text); };
        var pct = field(p, "Icon size (%):", "100", 4, "100% = the icon at its natural size for this text. Scale it freely afterwards.");
        var gap = field(p, "Icon gap (px):", getS("ti_gap", "0"), 5, "Extra space between the two words around the icon. Positive = wider, negative = tighter. 0 = the natural gap. Undo and rebuild to change it.");
        gap.onChange = function () { gap.text = String(num(gap.text, 0, -600, 1200)); putS("ti_gap", gap.text); };
        var len = field(p, "Length (s):", "4", 4, "How long the layers last from the playhead.");
        var hi = check(p, "Highlight words", false, "Optional colour sweep: each word goes lavender, then magenta, then back to its normal colour. Off keeps everything gray.");
        var step = field(p, "Highlight (s/word):", "1", 4, "How long each word keeps the highlight.");
        hint(p, "The icon is left still, so you can animate it yourself.");

        btn(p, "Build text + icon", function () {
            run("Text + icon", function () {
                doTextIcon({
                    sentence: sent.text, iconIndex: where.selection ? where.selection.index : 1, iconFile: iconFile,
                    size: num(size.text, 90, 12, 600), iconPct: num(pct.text, 100, 10, 500), gap: num(gap.text, 0, -600, 1200), length: num(len.text, 4, 0.5, 120),
                    textColor: tcol.get(), iconColor: icol.get(),
                    highlight: hi.value, step: num(step.text, 1, 0.3, 10)
                });
            });
        }, "Builds the words (sliding apart and growing), the icon slot and the highlight at the playhead.");
    });

    // ---------------- UI Kit ----------------

    feature("UI Kit", "Pill button", function (p) {
        var lb = field(p, "Label:", "+ New", 16);
        var kind = drop(p, "Style:", ["Primary", "White glass", "Outline"], 0);
        var pop = check(p, "Pop in at playhead", true);
        btn(p, "Create pill button", function () {
            run("Pill button", function () { doPillButton({ label: lb.text, kind: kind.selection.index, pop: pop.value }); });
        });
    });

    feature("UI Kit", "Frosted glass", function (p) {
        hint(p, "Select shapes; blurs whatever is behind them.");
        var r = field(p, "Blur radius:", "30", 4);
        btn(p, "Frost selected shapes", function () { run("Frosted glass", function () { doFrost(num(r.text, 30, 1, 500)); }); });
    });

    feature("UI Kit", "AI glow button", function (p) {
        var lb = field(p, "Label:", "Creating…", 16);
        btn(p, "Create AI glow button", function () { run("AI glow button", function () { doAiButton(lb.text); }); });
    });

    feature("UI Kit", "Fake cursor", function (p) {
        hint(p, "Add cursor → move playhead → drag cursor → repeat.");
        btn(p, "Add cursor", function () { run("Add cursor", doAddCursor); });
        btn(p, "Click at playhead", function () { run("Cursor click", doCursorClick); }, "Scale-down press plus a ripple circle.");
        btn(p, "Smooth moves", function () { run("Smooth cursor", doSmoothCursor); }, "Applies the footer curve to every cursor move.");
    });

    feature("UI Kit", "Avatar bubble", function (p) {
        hint(p, "Select photo layers.");
        var D = field(p, "Avatar size (px):", "120", 5);
        btn(p, "Bubble selected photos", function () { run("Avatar bubble", function () { doAvatarBubble(num(D.text, 120, 16, 2000)); }); });
        btn(p, "Press at playhead", function () { run("Press", doPress); }, "Click animation + a 'Next scene' marker.");
    });

    feature("UI Kit", "Audio waveform", function (p) {
        var mode = drop(p, "Mode:", ["From selected audio", "Idle loop"], 0);
        var bars = field(p, "Bars:", "24", 4);
        var hmax = field(p, "Max height (px):", "140", 5);
        btn(p, "Create waveform", function () {
            run("Audio waveform", function () {
                doWaveform({ fromAudio: mode.selection.index === 0, bars: Math.round(num(bars.text, 24, 3, 120)), maxH: num(hmax.text, 140, 20, 2000) });
            });
        });
    });

    feature("UI Kit", "Liquid-glass button", function (p) {
        var lb = field(p, "Label:", "Play", 16);
        var depth = check(p, "3D depth + camera blur", false, "Makes the rings 3D and adds a DOF camera push-in.");
        btn(p, "Create glass button", function () { run("Liquid-glass button", function () { doLiquidGlass(lb.text, depth.value); }); });
    });

    // ---------------- Media ----------------

    feature("Media", "Stock grid wall", function (p) {
        hint(p, "Select clips/images in the Project panel.");
        var cols = field(p, "Columns:", "5", 4);
        var gap = field(p, "Gap (px):", "24", 4);
        var rad = field(p, "Corner radius:", "24", 4);
        var tilt = field(p, "Tilt (°):", "-8", 4);
        var spd = field(p, "Scroll speed (px/s):", "40", 4);
        var dir = drop(p, "Scroll:", ["Up", "Down"], 0);
        btn(p, "Build grid wall", function () {
            run("Stock grid wall", function () {
                doStockGrid({
                    cols: Math.round(num(cols.text, 5, 1, 20)), gap: num(gap.text, 24, 0, 400), radius: num(rad.text, 24, 0, 500),
                    tilt: num(tilt.text, -8, -45, 45), speed: num(spd.text, 40, 0, 2000), dir: dir.selection.index === 0 ? "up" : "down"
                });
            });
        });
    });

    // ---------------- Style ----------------

    feature("Style", "Style", function (p) {
        hint(p, "These settings apply to every group.");
        var mo = subPanel(p, "Motion");
        var cIdx = 0, i;
        for (i = 0; i < CURVE_IDS.length; i++) { if (CURVE_IDS[i] === style.curve) { cIdx = i; } }
        var curveDrop = drop(mo, "Curve:", CURVE_LABELS, cIdx);
        var durF = field(mo, "Duration (frames):", style.duration, 4);
        var mbC = check(mo, "Motion blur on animated layers", style.motionBlur === "1");

        var bo = subPanel(p, "Bounce");
        var br = row(bo, null);
        var bounceB = styleButton(br.add("button", undefined, style.bounceOn === "1" ? "Bounce: ON" : "Bounce: OFF"), style.bounceOn === "1" ? "primary" : "secondary", 30);
        bounceB.preferredSize.width = 112;
        bounceB.helpTip = "Live bounce. Select Motion Kit layers (or their precomp) to change them any time.\nWith nothing selected it sets the default for new animations.";
        setFg(br.add("statictext", undefined, "Strength %:"), DS.label);
        var bAmt = br.add("edittext", undefined, style.bounceAmt);
        bAmt.characters = 4;

        var co = subPanel(p, "Brand");
        hint(co, "Colors, fonts and saved presets.");
        var styleB = styleButton(co.add("button", undefined, "Colors & fonts…"), "primary");

        curveDrop.onChange = function () { style.curve = CURVE_IDS[curveDrop.selection.index]; saveStyle(); };
        durF.onChange = function () { style.duration = String(num(durF.text, 18, 2, 600)); durF.text = style.duration; saveStyle(); };
        mbC.onToggle = function () { style.motionBlur = mbC.value ? "1" : "0"; saveStyle(); };
        bounceB.onClick = function () {
            style.bounceOn = (style.bounceOn === "1") ? "0" : "1";
            bounceB.text = (style.bounceOn === "1") ? "Bounce: ON" : "Bounce: OFF";
            bounceB.variant = (style.bounceOn === "1") ? "primary" : "secondary";
            repaint(bounceB);
            saveStyle();
            applyBounceToSelection();
        };
        bAmt.onChange = function () {
            style.bounceAmt = String(num(bAmt.text, 10, 1, 60));
            bAmt.text = style.bounceAmt;
            saveStyle();
            applyBounceToSelection();
        };
        styleB.onClick = function () { openStyleDialog(); };
    });

    // =====================================================================
    // Style dialog (colors, fonts, presets)
    // =====================================================================

    function paintSwatch(sw, hexStr) {
        if (sw.isSwatch) { sw.hexStr = hexStr; repaint(sw); return; }
        try {
            var c = hexToRgb(hexStr);
            sw.graphics.backgroundColor = sw.graphics.newBrush(sw.graphics.BrushType.SOLID_COLOR, [c[0], c[1], c[2], 1]);
        } catch (e) {}
    }

    function openStyleDialog() {
        var dlg = new Window("dialog", NAME + " · Style");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];

        var pr = dlg.add("panel", undefined, "Preset");
        pr.orientation = "row";
        pr.alignChildren = ["left", "center"];
        var names = ["Google Vids"].concat(presetNames());
        var pDrop = pr.add("dropdownlist", undefined, names);
        pDrop.selection = 0;
        var loadB = pr.add("button", undefined, "Load");
        var delB = pr.add("button", undefined, "Delete");

        var cp = dlg.add("panel", undefined, "Colors");
        cp.alignChildren = ["fill", "top"];
        var fields = {};
        for (var i = 0; i < COLOR_KEYS.length; i++) {
            (function (key, label) {
                var g = row(cp, label);
                var e = g.add("edittext", undefined, style[key]);
                e.characters = 9;
                var sw = g.add("group");
                sw.preferredSize = [26, 18];
                paintSwatch(sw, style[key]);
                var pick = g.add("button", undefined, "Pick…");
                pick.preferredSize.width = 56;
                e.onChange = function () { paintSwatch(sw, e.text); };
                pick.onClick = function () {
                    var c = chooseColor(colorTitle(label), hexToRgb(e.text));
                    if (c) {
                        e.text = rgbToHex(c);
                        paintSwatch(sw, e.text);
                    }
                };
                fields[key] = { edit: e, swatch: sw };
            })(COLOR_KEYS[i][0], COLOR_KEYS[i][1]);
        }

        var fp = dlg.add("panel", undefined, "Fonts (PostScript names)");
        fp.alignChildren = ["fill", "top"];
        var fReg = row(fp, "Regular:").add("edittext", undefined, style.font); fReg.characters = 22;
        var fBold = row(fp, "Bold:").add("edittext", undefined, style.fontBold); fBold.characters = 22;
        var autoB = fp.add("button", undefined, "Auto-detect (Google Sans → Inter → Manrope → DM Sans → Outfit)");

        var sp = dlg.add("panel", undefined, "Save as preset");
        sp.orientation = "row";
        var pName = sp.add("edittext", undefined, "My brand");
        pName.characters = 18;
        var saveB = sp.add("button", undefined, "Save preset");

        var ok = dlg.add("group");
        ok.alignment = ["right", "top"];
        ok.add("button", undefined, "Cancel", { name: "cancel" });
        var okB = ok.add("button", undefined, "OK", { name: "ok" });

        function collect() {
            var d = {};
            for (var k in DEFAULT_STYLE) { d[k] = style[k]; }
            for (var j = 0; j < COLOR_KEYS.length; j++) {
                var key = COLOR_KEYS[j][0];
                d[key] = rgbToHex(hexToRgb(fields[key].edit.text));
            }
            d.font = trim(fReg.text) || DEFAULT_STYLE.font;
            d.fontBold = trim(fBold.text) || DEFAULT_STYLE.fontBold;
            return d;
        }

        function fill(d) {
            for (var j = 0; j < COLOR_KEYS.length; j++) {
                var key = COLOR_KEYS[j][0];
                fields[key].edit.text = d[key];
                paintSwatch(fields[key].swatch, d[key]);
            }
            fReg.text = d.font;
            fBold.text = d.fontBold;
        }

        loadB.onClick = function () { if (pDrop.selection) { fill(loadPreset(pDrop.selection.text)); } };
        delB.onClick = function () {
            if (!pDrop.selection || pDrop.selection.text === "Google Vids") { return; }
            deletePreset(pDrop.selection.text);
            pDrop.remove(pDrop.selection.index);
            pDrop.selection = 0;
        };
        autoB.onClick = function () {
            var f = autoDetectFonts();
            if (f) { fReg.text = f[0]; fBold.text = f[1]; }
            else { alert("This version of After Effects can't check installed fonts.\nType the PostScript names instead (e.g. GoogleSans-Regular).", NAME); }
        };
        saveB.onClick = function () {
            var nm = trim(pName.text).replace(/[|]/g, "-");
            if (savePreset(nm, collect())) {
                var exists = false;
                for (var j = 0; j < pDrop.items.length; j++) { if (pDrop.items[j].text === nm) { exists = true; } }
                if (!exists) { pDrop.add("item", nm); }
                alert("Preset \"" + nm + "\" saved.", NAME);
            }
        };
        okB.onClick = function () {
            var d = collect();
            for (var k in d) { style[k] = d[k]; }
            saveStyle();
            dlg.close(1);
        };
        dlg.show();
    }

    // =====================================================================
    // Main panel
    // =====================================================================

    function buildContent(win) {
        applyTheme();
        if (!CLASSIC) {
            try { win.graphics.backgroundColor = brush(win.graphics, DS.bg); } catch (e0) {}
        }
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 14;

        var groups = [], i, j;
        for (i = 0; i < FEATURES.length; i++) {
            var found = false;
            for (j = 0; j < groups.length; j++) { if (groups[j] === FEATURES[i].group) { found = true; } }
            if (!found) { groups.push(FEATURES[i].group); }
        }

        // ---- header ----
        var head = win.add("group");
        head.orientation = "row";
        head.alignChildren = ["left", "center"];
        head.spacing = 8;
        logo(head);
        var title = head.add("statictext", undefined, "Rupa Motion");
        setFont(title, "BOLD", 15);
        if (!CLASSIC) { setFg(title, DS.text); }
        var spacer = head.add("group");
        spacer.alignment = ["fill", "center"];
        var ver = head.add("statictext", undefined, "Toolkit");
        setFg(ver, DS.muted);
        ver.alignment = ["right", "center"];

        // ---- layout: icon rail on the left, chips + feature card on the right ----
        var body = win.add("group");
        body.orientation = "row";
        body.alignChildren = ["left", "top"];
        body.alignment = ["fill", "top"];
        body.spacing = 10;

        var nav = card(body, "", 0);
        nav.alignment = ["left", "top"];
        nav.alignChildren = ["center", "top"];
        nav.margins = [6, 6, 6, 6];
        nav.spacing = 2;
        var tiles = [];
        for (i = 0; i < groups.length; i++) {
            tiles.push(navTile(nav, groups[i], function (gName) { pickGroup(gName, null); }));
        }

        var main = body.add("group");
        main.orientation = "column";
        main.alignChildren = ["fill", "top"];
        main.alignment = ["fill", "top"];
        main.spacing = 10;

        // ---- feature chips (only for groups with several features) ----
        var chips = main.add("group");
        chips.orientation = "column";
        chips.alignChildren = ["fill", "top"];
        chips.spacing = 6;

        // ---- feature cards (stacked, one visible) ----
        var stack = main.add("group");
        stack.orientation = "stack";
        stack.alignChildren = ["fill", "top"];
        for (i = 0; i < FEATURES.length; i++) {
            var p = card(stack, FEATURES[i].name, 0);
            p.spacing = 7;
            FEATURES[i].build(p);
            p.wrap.visible = false;
            FEATURES[i].panel = p.wrap;
        }

        var curGroup = null;

        function showFeature(groupName, featName) {
            for (var k = 0; k < FEATURES.length; k++) {
                FEATURES[k].panel.visible = (FEATURES[k].group === groupName && FEATURES[k].name === featName);
            }
            putS("ui_group", groupName);
            putS("ui_feature", featName);
            try { win.layout.layout(true); } catch (e) {}
        }

        function buildChips(groupName, featName) {
            while (chips.children.length > 0) { chips.remove(chips.children[0]); }
            var names = [], k;
            for (k = 0; k < FEATURES.length; k++) { if (FEATURES[k].group === groupName) { names.push(FEATURES[k].name); } }
            // groups with named sub-groups (Text > Motion) always show their chip row, even with one sub-group
            var single = names.length <= 1 && !SUBGROUP_CHIPS[groupName];
            chips.visible = !single;
            chips.maximumSize.height = single ? 0 : 1000;
            if (single) { return; }
            var r = null, made = [];
            for (k = 0; k < names.length; k++) {
                if (k % 3 === 0) {
                    r = chips.add("group");
                    r.orientation = "row";
                    r.alignChildren = ["fill", "center"];
                    r.spacing = 6;
                }
                (function (nm) {
                    var c = styleButton(r.add("button", undefined, nm), nm === featName ? "chip-on" : "chip", 28);
                    c.preferredSize.width = 80;
                    c.baseText = nm;
                    if (CLASSIC && nm === featName) { c.text = "● " + nm; }
                    c.onClick = function () {
                        for (var q = 0; q < made.length; q++) {
                            made[q].variant = (made[q] === c) ? "chip-on" : "chip";
                            if (CLASSIC) { made[q].text = (made[q] === c ? "● " : "") + made[q].baseText; }
                            else { repaint(made[q]); }
                        }
                        showFeature(groupName, nm);
                    };
                    made.push(c);
                })(names[k]);
            }
        }

        function pickGroup(groupName, featName) {
            var names = [], k;
            for (k = 0; k < FEATURES.length; k++) { if (FEATURES[k].group === groupName) { names.push(FEATURES[k].name); } }
            if (names.length === 0) { return; }
            var feat = names[0];
            for (k = 0; k < names.length; k++) { if (names[k] === featName) { feat = featName; } }
            curGroup = groupName;
            for (k = 0; k < tiles.length; k++) {
                tiles[k].active = (tiles[k].groupName === groupName);
                if (CLASSIC) { tiles[k].text = (tiles[k].active ? "● " : "") + tiles[k].baseText; }
                else { repaint(tiles[k]); }
            }
            buildChips(groupName, feat);
            showFeature(groupName, feat);
        }

        var lastG = getS("ui_group", groups[0]), ok = false;
        for (i = 0; i < groups.length; i++) { if (groups[i] === lastG) { ok = true; } }
        pickGroup(ok ? lastG : groups[0], getS("ui_feature", ""));
        return curGroup;
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", NAME, undefined, { resizeable: true });
        buildContent(win);
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    var ui = buildUI(thisObj);
    if (ui instanceof Window) {
        ui.center();
        ui.show();
    } else {
        ui.layout.layout(true);
    }

})(this);
