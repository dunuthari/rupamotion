/*
    Rupa Motion v1.0 — Google Vids–style motion toolkit for After Effects
    (Rupa · රූප · "image, visual")
    ---------------------------------------------------------------------
    A dockable ScriptUI panel.

    Install:
      Windows: C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\
      macOS:   /Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/
      Restart After Effects, then open Window > RupaMotion.jsx

    Groups:  Layers · Quick Actions · Camera · Shapes · Animation · Transitions · Text · UI Kit · Media · Style

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

    // Effect point parameters on shape and text layers are measured from the top-left of
    // their comp-sized layer area, not from the layer origin. Returns that offset.
    function isVectorLayer(L) { return (L instanceof ShapeLayer) || (L instanceof TextLayer); }

    function fxPointOffset(L) {
        if (!isVectorLayer(L)) { return [0, 0]; }
        var c = L.containingComp;
        return [c.width / 2, c.height / 2];
    }

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

    function setTextSize(L, size) {
        var sp = textDocProp(L);
        var d = sp.value;
        d.fontSize = size;
        sp.setValue(d);
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

    function animatorAt(L, idx) { return L.property("ADBE Text Properties").property("ADBE Text Animators").property(idx); }

    // props: [[matchName, value], ...]; basedOn: 1 characters, 3 words. Returns animator index.
    function addTextAnimator(L, name, props, basedOn) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        anims.addProperty("ADBE Text Animator");
        var idx = L.property("ADBE Text Properties").property("ADBE Text Animators").numProperties;
        animatorAt(L, idx).name = name;
        for (var i = 0; i < props.length; i++) {
            animatorAt(L, idx).property("ADBE Text Animator Properties").addProperty(props[i][0]);
            var p = animatorAt(L, idx).property("ADBE Text Animator Properties").property(props[i][0]);
            var v = props[i][1];
            try { p.setValue(v); }
            catch (e) {
                if (v instanceof Array && v.length > 2) {
                    try { p.setValue([v[0], v[1]]); } catch (e2) {}
                }
                if (v instanceof Array && v.length === 4) {
                    try { p.setValue([v[0], v[1], v[2]]); } catch (e3) {}
                }
            }
        }
        var sels = animatorAt(L, idx).property("ADBE Text Selectors");
        if (sels.numProperties === 0) { sels.addProperty("ADBE Text Selector"); }
        try {
            selectorAt(L, idx).property("ADBE Text Range Advanced").property("ADBE Text Range Type2").setValue(basedOn || 1);
        } catch (e4) {}
        return idx;
    }

    function selectorAt(L, idx) { return animatorAt(L, idx).property("ADBE Text Selectors").property(1); }

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

    function newTrackMatteAPI(layer) { return typeof layer.setTrackMatte === "function"; }

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

    function doPop(mode, o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select at least one layer."); if (!sel) { return; }
        var fr = comp.frameDuration, d = animDur(comp);
        for (var i = 0; i < sel.length; i++) {
            var L = sel[i];
            if (L instanceof CameraLayer || L instanceof LightLayer) { continue; }
            var t = comp.time + i * o.stagger * fr;
            if (mode === "up") { ensureBounce(L); }
            if (o.center) { anchorTo(L, "center", t); }
            var sp = L.transform.scale, base = sp.valueAtTime(t, false);
            if (mode === "up" && allZero(base)) { base = scaled(base, 0); for (var k = 0; k < base.length; k++) { base[k] = 100; } }
            if (mode === "up") {
                setKeys(sp, [[t, scaled(base, 0)], [t + d, base]], { bounce: true, clamp: true });
            } else {
                setKeys(sp, [[t, base], [t + d * 0.35, scaled(base, 1.08)], [t + d, scaled(base, 0)]]);
            }
            if (o.fade) {
                var op = L.transform.opacity.valueAtTime(t, false);
                if (mode === "up" && op === 0) { op = 100; }
                if (mode === "up") { setKeys(L.transform.opacity, [[t, 0], [t + d * 0.4, op]]); }
                else { setKeys(L.transform.opacity, [[t + d * 0.6, op], [t + d, 0]]); }
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

    function addLockedGradient(L, dir) {
        var e = fxAdd(L, "ADBE Ramp");
        if (!e) { return; }
        e.name = "MK Locked Gradient";
        var g = L.property("ADBE Effect Parade").property("MK Locked Gradient");
        fxSet(g, 2, c4(col("gradStart")));
        fxSet(g, 4, c4(col("gradEnd")));
        // Shape/text layers: effect points start at the top-left of the comp-sized layer area
        var r = "var r = thisLayer.sourceRectAtTime(time, false);\n" +
            (isVectorLayer(L) ? "var o = [thisComp.width / 2, thisComp.height / 2];\n" : "var o = [0, 0];\n");
        var a, b;
        if (dir === 1) {
            a = "[r.left + r.width / 2 + o[0], r.top + o[1]]";
            b = "[r.left + r.width / 2 + o[0], r.top + r.height + o[1]]";
        } else if (dir === 2) {
            a = "[r.left + o[0], r.top + o[1]]";
            b = "[r.left + r.width + o[0], r.top + r.height + o[1]]";
        } else {
            a = "[r.left + o[0], r.top + r.height / 2 + o[1]]";
            b = "[r.left + r.width + o[0], r.top + r.height / 2 + o[1]]";
        }
        g.property(1).expression = r + a + ";";
        g.property(3).expression = r + b + ";";
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
        return "// Motion Kit bounce physics (inertial bounce after each keyframe)\n" +
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

    function doBouncePhysics() {
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
        var amp = 0.05 * num(style.bounceAmt, 10, 1, 60) / 10, skipped = 0;
        for (i = 0; i < props.length; i++) {
            var ex = props[i].expression;
            if (ex !== "" && !/Motion Kit/.test(ex)) { skipped++; continue; }
            try { props[i].expression = physicsExpr(amp); } catch (e2) { skipped++; }
        }
        if (skipped > 0) { alert(skipped + " propert" + (skipped === 1 ? "y was" : "ies were") + " skipped because they already have your own expression.", NAME); }
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
        var g = this.graphics, w = this.size[0], h = this.size[1], v = this.variant || "primary";
        var fill, stroke = null, tc, bold = false;
        if (v === "primary") { fill = DS.primary; tc = DS.onPrimary; bold = true; }
        else if (v === "chip-on") { fill = DS.tint; tc = DS.primary; bold = true; }
        else if (v === "chip") { fill = DS.card; tc = DS.label; stroke = DS.border; }
        else { fill = DS.card; tc = DS.text; stroke = DS.border; }
        rrPath(g, 0.5, 0.5, w - 1, h - 1, (h - 1) / 2);
        g.fillPath(brush(g, fill));
        if (stroke) { g.strokePath(pen(g, stroke, 1)); }
        var f = font(bold ? "BOLD" : "REGULAR", 12), m = measure(g, this.text, f);
        textAt(g, this.text, tc, Math.round((w - m[0]) / 2), Math.round((h - m[1]) / 2), f);
    }

    function styleButton(b, variant, height) {
        b.variant = variant || "secondary";
        b.preferredSize.height = height || 32;
        if (!CLASSIC) { b.onDraw = drawButton; }
        return b;
    }

    // ---- form rows ----

    var LABEL_W = 116;

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
        b.onClick = fn;
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
        "Layers": "Layers", "Quick Actions": "Quick", "Camera": "Camera", "Shapes": "Shapes",
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
            var c = hexToRgb(hex.text);
            var res = $.colorPicker((Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255));
            if (res >= 0) {
                hex.text = rgbToHex([((res >> 16) & 255) / 255, ((res >> 8) & 255) / 255, (res & 255) / 255]);
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
            ["Pre-compose", function () { run("Pre-compose", doPrecomposeSafe); }, "Group layers safely — keeps their in/out range"],
            ["Smart Null", function () { run("Smart Null", doSmartNull); }, "50×50 null at the comp center (or the selection's center), parents selected layers"],
            ["Adjustment Layer", function () { run("Adjustment Layer", doAdjustmentLayer); }, "Full comp bounds, above the selection"],
            ["Unwrap Composition", function () {
                run("Unwrap Composition", function () { doUnwrapComp({ keepTransform: true, removeLayer: true }); });
            }, "Moves the layers of the selected pre-comp into this comp, with timing and parenting. A null keeps the pre-comp layer's transform."]
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
        var br = row(p, "Bounce:");
        var bBtn = styleButton(br.add("button", undefined, qb ? "Bounce: ON" : "Bounce: OFF"), qb ? "primary" : "secondary", 30);
        bBtn.preferredSize.width = 128;
        bBtn.helpTip = "ON: every animation below bounces (slides, pops and fades overshoot and settle).\nOFF: clean eased motion with no bounce.\nStrength comes from Style › Strength %.";
        var bInfo = br.add("statictext", undefined, qb ? "with bounce" : "no bounce");
        setFg(bInfo, DS.muted);
        bInfo.preferredSize.width = 90;
        bBtn.onClick = function () {
            qb = !qb;
            bBtn.text = qb ? "Bounce: ON" : "Bounce: OFF";
            bInfo.text = qb ? "with bounce" : "no bounce";
            bBtn.variant = qb ? "primary" : "secondary";
            repaint(bBtn);
            putS("quick_bounce", qb ? "1" : "0");
        };

        var stag = field(p, "Stagger (frames):", "0", 4);
        var dist = field(p, "Slide distance (px):", "200", 5);
        var gdir = drop(p, "Gradient direction:", ["Horizontal", "Vertical", "Diagonal"], 0);
        function st() { return num(stag.text, 0, 0, 120); }

        // Runs an animation action with the Quick Actions bounce state
        function anim(label, fn) {
            return function () { run(label, function () { withBounce(qb, fn); }); };
        }
        function slide(dir, label) {
            return anim(label, function () {
                doMove(dir, { mode: "in", offscreen: false, distance: num(dist.text, 200, 1, 20000), fade: true, stagger: st() });
            });
        }
        grid(p, [
            ["Fade In", anim("Fade In", function () { doFade(true, st(), qb); })],
            ["Fade Out", anim("Fade Out", function () { doFade(false, st(), qb); })],
            ["Slide Left", slide([-1, 0], "Slide Left"), "Slides in, travelling left"],
            ["Slide Right", slide([1, 0], "Slide Right"), "Slides in, travelling right"],
            ["Slide Up", slide([0, -1], "Slide Up"), "Slides in, travelling up"],
            ["Slide Down", slide([0, 1], "Slide Down"), "Slides in, travelling down"],
            ["Scale Pop", anim("Scale Pop", function () { doPop("up", { fade: true, center: true, stagger: st() }); })],
            ["Blur Fade", anim("Blur Fade", function () { doBlurFade(st(), qb); })],
            ["Reverse Keys", function () { run("Reverse Keys", doReverseKeys); }, "Reverses selected keyframed properties (or all on the selected layers)"],
            ["Lock Gradient", function () { run("Lock Gradient", function () { doLockGradient(gdir.selection.index); }); }, "Gradient that stays locked to the layer's bounds"],
            ["Bounce Physics", function () { run("Bounce Physics", doBouncePhysics); }, "Inertial bounce after keyframes (uses Style › Strength %)"]
        ]);
        hint(p, "Bounce applies to Fade, Slide, Scale Pop and Blur Fade.");
        hint(p, "Uses Duration, Curve and Strength from the Style group.");
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
        var stag = field(p, "Stagger (frames):", "0", 4);
        var r = btnRow(p);
        function go(mode) {
            run("Pop " + mode, function () { doPop(mode, { fade: fade.value, center: center.value, stagger: num(stag.text, 0, 0, 120) }); });
        }
        btn(r, "Pop Up", function () { go("up"); });
        btn(r, "Pop Out", function () { go("out"); });
    });

    feature("Animation", "Move in / out", function (p) {
        var mode = drop(p, "Mode:", ["In", "Out"], 0);
        var dist = drop(p, "Distance:", ["Off screen", "Custom"], 0);
        var px = field(p, "Custom (px):", "300", 5);
        var fade = check(p, "Fade opacity too", false);
        var stag = field(p, "Stagger (frames):", "0", 4);
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
        var stag = field(p, "Stagger (frames):", "2", 4);
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
        hint(p, "Select 2 clips, or put the playhead on the cut.");
        var fr = field(p, "Frames each side:", "6", 4);
        var blur = field(p, "Blur (shutter °):", "300", 4);
        var r = btnRow(p);
        function go(dir) {
            run("Swipe cut", function () { doSwipeCut(dir, { frames: num(fr.text, 6, 1, 60), blur: num(blur.text, 300, 0, 720) }); });
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

    feature("Text", "Word swap", function (p) {
        var st = field(p, "Start text:", "Meet your", 18);
        var pl = field(p, "Pill label:", "+ New", 18);
        var wd = field(p, "Swap words:", "storyteller, producer, editor", 18, "Comma separated.");
        var hold = field(p, "Hold per word (s):", "1.2", 4);
        var size = field(p, "Font size:", "96", 4);
        var fade = check(p, "Gradient fade on trailing letters", true, "Needs After Effects 2023 or newer.");
        btn(p, "Build word swap", function () {
            run("Word swap", function () {
                doWordSwap({
                    start: st.text, pill: pl.text, words: splitList(wd.text),
                    hold: num(hold.text, 1.2, 0.3, 20), size: num(size.text, 96, 12, 600), fade: fade.value
                });
            });
        });
    });

    feature("Text", "Typing prompt", function (p) {
        var tx = field(p, "Prompt text:", "Make a launch video for our new app", 18);
        var cps = field(p, "Typing speed (chars/s):", "22", 4);
        var w = field(p, "Box width (px):", "1100", 5);
        btn(p, "Build typing prompt", function () {
            run("Typing prompt", function () {
                doTypingPrompt({ text: tx.text, cps: num(cps.text, 22, 1, 200), width: num(w.text, 1100, 200, 4000) });
            });
        });
    });

    feature("Text", "Karaoke highlight", function (p) {
        var timing = drop(p, "Timing:", ["Even", "Layer markers"], 0, "Markers: put one marker on the text layer where each word is spoken.");
        var dur = field(p, "Duration (s):", "3", 4, "Used with Even timing.");
        var unit = drop(p, "Highlight by:", ["Words", "Characters"], 0);
        var grad = check(p, "Gradient overlay", false);
        function opts() {
            return { markers: timing.selection.index === 1, dur: num(dur.text, 3, 0.2, 600), words: unit.selection.index === 0, gradient: grad.value };
        }
        btn(p, "Apply to selected text", function () { run("Karaoke highlight", function () { doKaraoke(opts()); }); });
        var kt = field(p, "Big kinetic text:", "Never let a dead battery ruin your day", 18);
        btn(p, "Create big kinetic text", function () { run("Kinetic text", function () { doKineticText(kt.text, opts()); }); });
    });

    feature("Text", "Title card", function (p) {
        hint(p, "Uses the selected text layer, or creates the word.");
        var wd = field(p, "Word:", "voice", 16);
        btn(p, "Create title card", function () { run("Title card", function () { doTitleCard(wd.text); }); });
    });

    feature("Text", "Glow streak title", function (p) {
        hint(p, "Uses the selected text layer, or creates the word.");
        var wd = field(p, "Word:", "testimonials", 16);
        var method = drop(p, "Method:", ["Light streaks", "CC Light Rays"], 0);
        var dir = drop(p, "Streaks:", ["Vertical", "Horizontal"], 0);
        var dg = check(p, "Use Deep Glow if installed", true);
        var bg = check(p, "Add blue background", true);
        btn(p, "Create glow title", function () {
            run("Glow streak title", function () {
                doGlowStreak(wd.text, { method: method.selection.index === 1 ? "rays" : "streaks", vertical: dir.selection.index === 0, deepGlow: dg.value, bg: bg.value });
            });
        });
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
                    var c = hexToRgb(e.text);
                    var start = (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
                    var res = $.colorPicker(start);
                    if (res >= 0) {
                        e.text = rgbToHex([((res >> 16) & 255) / 255, ((res >> 8) & 255) / 255, (res & 255) / 255]);
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

        // ---- icon tab bar ----
        var nav = card(win, "", 0);
        nav.margins = [6, 6, 6, 6];
        nav.spacing = 2;
        var tiles = [], navRow = null;
        for (i = 0; i < groups.length; i++) {
            if (i % 5 === 0) {
                navRow = nav.add("group");
                navRow.orientation = "row";
                navRow.alignChildren = ["center", "center"];
                navRow.alignment = ["center", "top"];
                navRow.spacing = 2;
            }
            tiles.push(navTile(navRow, groups[i], function (gName) { pickGroup(gName, null); }));
        }

        // ---- feature chips (only for groups with several features) ----
        var chips = win.add("group");
        chips.orientation = "column";
        chips.alignChildren = ["fill", "top"];
        chips.spacing = 6;

        // ---- feature cards (stacked, one visible) ----
        var stack = win.add("group");
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
            var single = names.length <= 1;
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
                    c.preferredSize.width = 104;
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
