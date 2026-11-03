/*
    Ru Motion v1.0 — Google Vids–style motion toolkit for After Effects
    (Ru · රූ · "form, image" — short for රූප, Rupa)
    ---------------------------------------------------------------------
    A dockable ScriptUI panel.

    Install:
      Windows: C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\
      macOS:   /Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/
      Restart After Effects, then open Window > RuMotion.jsx

    Groups:  Layers · Quick Actions · Flow · Camera · Shapes · Animation · Transitions · Text · UI Kit · Media · Style

    Every action is one undo step. Most actions start at the playhead.
*/

(function MotionKit(thisObj) {

    var NAME = "Ru Motion";
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
