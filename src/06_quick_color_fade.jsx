
    // =====================================================================
    // QUICK ACTIONS — "Color Fade": cards appear tinted in a solid colour, then the colour fades away
    // =====================================================================
    // Read from a clip (creative / delivery / measurement / optimization "agent" cards, measured at 10 frames a second): each card
    // is revealed LEFT TO RIGHT by a very soft wipe (about 0.45 s, the soft edge is about half the card wide), washed in a
    // saturated purple-blue (its text and icon show as a darker shade). It holds that colour for about 0.5 s, then the colour
    // drains out, also LEFT TO RIGHT, over another 0.5 s and the card settles on its own look; about 1.0 s per card in all.
    // The cards come in one after another, top to bottom, on average 0.8 s apart (1.0, 0.6 and 0.8 s in the clip).
    // One button on the selected layers, no settings. Every move uses a gentle cubic-bezier ease, not the Style curve.
    //
    // How: Tint has no spatial control, so the layer is DUPLICATED. The copy (above) carries the colour and two Linear Wipes:
    // one reveals it, the other later wipes it away from the left edge to the right, uncovering the untouched original below.
    //   original (t = start): opacity 0 -> 100 over 0.25 s; Linear Wipe (reveal) completion 100 -> 0 over 0.45 s;
    //   tinted copy: the same opacity and reveal, Tint at 100%, and a second Linear Wipe (drain) completion 0 -> 100
    //   from 0.5 s to 1.0 s. Feather of both wipes = half the layer width.
    // Which Linear Wipe angle runs left to right was not verifiable here: CF.angle (reveal) and CF.angleOut (drain, always 180
    // degrees from it) are the two numbers to swap if a direction is wrong.
    var CF = { stagger: 0.8, fadeIn: 0.25, wipe: 0.45, hold: 0.5, tintOut: 0.5, featherK: 0.5, featherMin: 40, angle: 270, angleOut: 90,
               easeOpacity: [0.2, 0, 0.4, 1], easeWipe: [0.3, 0, 0.3, 1], easeTint: [0.3, 0, 0.3, 1],
               black: [0.20, 0.14, 0.62], white: [0.40, 0.36, 0.93], tag: " \u00B7 Color Fade tint" };

    // keys at the given times, then a gentle ease on every segment whose value changes (flat segments stay flat)
    function smoothKeys(prop, pairs, curve) {
        var i;
        for (i = 0; i < pairs.length; i++) { prop.setValueAtTime(pairs[i][0], pairs[i][1]); }
        for (i = 0; i + 1 < pairs.length; i++) {
            if (pairs[i][1] !== pairs[i + 1][1]) { try { easeBetweenKeys(prop, pairs[i][0], pairs[i + 1][0], curve); } catch (e) {} }
        }
    }

    // on-screen width of a layer, for the soft edge of the wipe
    function layerWidth(L, t) {
        var w = 0, sc = 1;
        try { sc = L.transform.scale.value[0] / 100; } catch (e0) {}
        try { w = L.sourceRectAtTime(t, false).width * sc; } catch (e1) {}
        if (!(w > 0)) { try { w = L.width * sc; } catch (e2) {} }
        return w > 0 ? w : 0;
    }

    // removes what an earlier press added: the effects on the layer and its tinted copy
    function clearColorFade(comp, L) {
        var fx = L.property("ADBE Effect Parade"), i, nm = L.name + CF.tag;
        for (i = fx.numProperties; i >= 1; i--) {
            if (fx.property(i).name.indexOf("MK Color Fade") === 0) { fx.property(i).remove(); }
        }
        for (i = comp.numLayers; i >= 1; i--) {
            try { if (comp.layer(i).name === nm) { comp.layer(i).remove(); } } catch (e) {}
        }
    }

    function fadeInKeys(L, t) {
        var op = L.transform.opacity, to = 100;
        try { if (op.numKeys === 0) { to = op.value; } else { to = op.valueAtTime(t + CF.fadeIn, false); } } catch (e) {}
        smoothKeys(op, [[t, 0], [t + CF.fadeIn, to]], CF.easeOpacity);
    }

    function revealWipe(L, t, feather) {
        var w = fxAdd(L, "ADBE Linear Wipe");
        if (!w) { return null; }
        w.name = "MK Color Fade Wipe";
        fxSet(w, 2, CF.angle);
        fxSet(w, 3, feather);
        smoothKeys(w.property(1), [[t, 100], [t + CF.wipe, 0]], CF.easeWipe);
        return w;
    }

    function colorFadeOne(comp, L, t) {
        clearColorFade(comp, L);
        var feather = Math.max(CF.featherMin, CF.featherK * layerWidth(L, t));
        // the tinted copy goes on top of the original (duplicate it BEFORE any effect is added to the original)
        var D = null;
        try { D = L.duplicate(); } catch (eD) { D = null; }
        if (!D) { return false; }
        D.name = L.name + CF.tag;
        try { D.selected = false; } catch (eS) {}

        var ok = !!revealWipe(L, t, feather);               // the original: fades in and is revealed left to right
        fadeInKeys(L, t);

        var tint = fxAdd(D, "ADBE Tint");                    // the copy: tinted, revealed the same way, then wiped away left to right
        if (tint) {
            tint.name = "MK Color Fade Tint";
            fxSet(tint, 1, c4(CF.black));
            fxSet(tint, 2, c4(CF.white));
            fxSet(tint, 3, 100);
        }
        ok = !!revealWipe(D, t, feather) && ok;
        var drain = fxAdd(D, "ADBE Linear Wipe");
        if (drain) {
            drain.name = "MK Color Fade Drain";
            fxSet(drain, 2, CF.angleOut);
            fxSet(drain, 3, feather);
            smoothKeys(drain.property(1), [[t + CF.hold, 0], [t + CF.hold + CF.tintOut, 100]], CF.easeTint);
        }
        fadeInKeys(D, t);
        return ok && !!tint && !!drain;
    }

    function doColorFade() {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layers (cards) to fade in."); if (!sel) { return; }
        var list = [], i, j, tmp;
        for (i = 0; i < sel.length; i++) {
            if (sel[i] instanceof CameraLayer || sel[i] instanceof LightLayer) { continue; }
            list.push(sel[i]);
        }
        // top to bottom on screen (then by layer order), so the cards arrive in reading order
        function yOf(L) { try { return L.transform.position.value[1]; } catch (e) { return 0; } }
        for (i = 1; i < list.length; i++) {
            tmp = list[i];
            for (j = i - 1; j >= 0 && (yOf(list[j]) > yOf(tmp) || (yOf(list[j]) === yOf(tmp) && list[j].index > tmp.index)); j--) { list[j + 1] = list[j]; }
            list[j + 1] = tmp;
        }
        var t0 = comp.time, failed = 0;
        for (i = 0; i < list.length; i++) { if (!colorFadeOne(comp, list[i], t0 + i * CF.stagger)) { failed++; } }
        if (failed > 0) { alert("The tinted copy, the Tint or the Linear Wipe effects could not be added to " + failed + " layer(s).", NAME); }
    }
