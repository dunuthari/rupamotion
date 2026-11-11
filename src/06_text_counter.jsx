
    // =====================================================================
    // Text > Effects > Number counter: the layer's text becomes a formatted number read from a "Ru Counter" slider.
    // The slider gets two keyframes at the playhead (From -> To over NC.dur seconds): drag the second key to retime.
    // =====================================================================

    var NC = { dur: 1.0, name: "Ru Counter" };
    var NC_CURVES = [[0.16, 1, 0.3, 1], [0, 0, 1, 1], [0.65, 0, 0.35, 1]];   // Ease out, Linear, Ease in-out

    function jsStr(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, " ") + '"'; }

    // Formatting runs inside the expression (both engines, no toLocaleString): decimals, thousands separator, k / M short form
    function counterExpr(o) {
        return "// Ru Counter\n" +
            "var v = 0; try { v = effect(" + jsStr(NC.name) + ")(1).value; } catch (e) { v = 0; }\n" +
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
            setKeys(s, [[t, o.from], [t + NC.dur, o.to]]);
            try { easeBetweenKeys(s, t, t + NC.dur, NC_CURVES[o.curve] || NC_CURVES[0]); } catch (e1) {}
            L.property("ADBE Text Properties").property("ADBE Text Document").expression = counterExpr(o);
            n++;
        }
        if (n === 0) { alert("Select a text layer: its text becomes the counting number.", NAME); }
    }
