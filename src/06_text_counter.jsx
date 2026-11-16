
    // =====================================================================
    // Text > Effects > Number counter: the layer's text becomes a formatted number read from a "Ru Counter" slider.
    // The slider gets two keyframes at the playhead (From -> To over NC.dur seconds): drag the second key to retime.
    // =====================================================================

    var NC = { dur: 1.0, name: "Ru Counter" };
    var NC_CURVES = [[0.16, 1, 0.3, 1], [0, 0, 1, 1], [0.65, 0, 0.35, 1]];   // Ease out, Linear, Ease in-out

    function jsStr(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, " ") + '"'; }

    // Formatting runs inside the expression (both engines, no toLocaleString): decimals, thousands separator, k / M short form.
    // The easing also runs here: the slider keys are LINEAR and the expression maps the time between the first and the last
    // key through the chosen cubic-bezier (solved by Newton steps), clamped to 0..1. So dragging a key only retimes the count
    // and can never push it past To. (Eased keys carry a fixed speed in After Effects, which overshot when the gap changed.)
    function counterExpr(o) {
        var c = NC_CURVES[o.curve] || NC_CURVES[0];
        return "// Ru Counter\n" +
            "function bz(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; }\n" +
            "var v = 0; try { var sl = effect(" + jsStr(NC.name) + ")(1); v = sl.value;\n" +
            "  if (sl.numKeys >= 2) { var k1 = sl.key(1), k2 = sl.key(sl.numKeys), d = k2.time - k1.time;\n" +
            "    var u = d > 0 ? (time - k1.time) / d : 1; u = Math.max(0, Math.min(1, u));\n" +
            "    var x1 = " + c[0] + ", y1 = " + c[1] + ", x2 = " + c[2] + ", y2 = " + c[3] + ";\n" +
            "    var t = u, i;\n" +
            "    for (i = 0; i < 8; i++) { var dx = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t; if (Math.abs(dx) < 1e-6) { break; } t = Math.max(0, Math.min(1, t - (bz(t, x1, x2) - u) / dx)); }\n" +
            "    v = k1.value + (k2.value - k1.value) * Math.max(0, Math.min(1, bz(t, y1, y2))); } } catch (e) { v = 0; }\n" +
            "var dec = " + o.dec + ", sep = " + (o.sep ? "true" : "false") + ", kk = " + (o.k ? "true" : "false") + ";\n" +
            "function grp(a) { var out = ''; while (a.length > 3) { out = ',' + a.slice(-3) + out; a = a.slice(0, -3); } return a + out; }\n" +
            "function fmt(n) { var neg = n < 0, s; n = Math.abs(n);\n" +
            "  if (kk && n >= 1000) { var m = n >= 1000000; s = (n / (m ? 1000000 : 1000)).toFixed(dec > 0 ? dec : 1) + (m ? 'M' : 'k'); }\n" +
            "  else { s = n.toFixed(dec); if (sep) { var p = s.split('.'); p[0] = grp(p[0]); s = p.join('.'); } }\n" +
            "  return (neg ? '-' : '') + s; }\n" +
            jsStr(o.prefix || "") + " + fmt(v) + " + jsStr(o.suffix || "");
    }

    function doCounter(o) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select at least one text layer."); if (!sel) { return; }
        var t = comp.time, n = 0, i;
        for (i = 0; i < sel.length; i++) {
            var L = sel[i];
            if (!(L instanceof TextLayer)) { continue; }
            var e = null;
            try { e = L.property("ADBE Effect Parade").property(NC.name); } catch (e0) { e = null; }
            if (!e) { e = fxAdd(L, "ADBE Slider Control"); if (!e) { continue; } e.name = NC.name; }
            var s = e.property(1);
            while (s.numKeys > 0) { s.removeKey(1); }
            s.setValueAtTime(t, o.from); s.setValueAtTime(t + NC.dur, o.to);
            // linear keys: the curve lives in the expression, so moving a key never overshoots
            for (var k = 1; k <= s.numKeys; k++) { try { s.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e1) {} }
            L.property("ADBE Text Properties").property("ADBE Text Document").expression = counterExpr(o);
            n++;
        }
        if (n === 0) { alert("Select a text layer: its text becomes the counting number.", NAME); }
    }
