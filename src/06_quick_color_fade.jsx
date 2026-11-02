
    // =====================================================================
    // QUICK ACTIONS — "Color Fade": cards appear tinted in a solid colour, then the colour fades away
    // =====================================================================
    // Read from a clip (creative / delivery / measurement / optimization "agent" cards, measured at 10 frames a second): each card
    // is revealed left to right by a very soft wipe (about 0.45 s, the soft edge is about half the card wide), washed in a
    // saturated purple-blue (its text and icon show as a darker shade). It holds that colour for about 0.5 s, then the colour
    // drains out over another 0.5 s and the card settles on its own look; about 1.0 s per card in all. The cards come in
    // one after another, top to bottom, on average 0.8 s apart (1.0, 0.6 and 0.8 s in the clip). One button on the selected
    // layers, no settings. Timings are read off the clip; every move uses a gentle cubic-bezier ease, not the Style curve.
    //   per layer (t = its start): opacity 0 -> 100 over 0.25 s; Linear Wipe completion 100 -> 0 over 0.45 s (feather = half the
    //   layer width); Tint amount 100 held until 0.5 s, then 100 -> 0 by 1.0 s.
    // Whether the wipe runs left to right or right to left depends on the Linear Wipe angle (CF.angle): flip it to 270 if needed.
    var CF = { stagger: 0.8, fadeIn: 0.25, wipe: 0.45, hold: 0.5, tintOut: 0.5, featherK: 0.5, featherMin: 40, angle: 90,
               easeOpacity: [0.2, 0, 0.4, 1], easeWipe: [0.3, 0, 0.3, 1], easeTint: [0.3, 0, 0.3, 1],
               black: [0.20, 0.14, 0.62], white: [0.40, 0.36, 0.93] };

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

    function clearColorFade(L) {
        var fx = L.property("ADBE Effect Parade"), i;
        for (i = fx.numProperties; i >= 1; i--) {
            if (fx.property(i).name === "MK Color Fade Tint" || fx.property(i).name === "MK Color Fade Wipe") { fx.property(i).remove(); }
        }
    }

    function colorFadeOne(L, t) {
        clearColorFade(L);
        var tint = fxAdd(L, "ADBE Tint");
        if (tint) {
            tint.name = "MK Color Fade Tint";
            fxSet(tint, 1, c4(CF.black));
            fxSet(tint, 2, c4(CF.white));
            smoothKeys(tint.property(3), [[t, 100], [t + CF.hold, 100], [t + CF.hold + CF.tintOut, 0]], CF.easeTint);
        }
        var wipe = fxAdd(L, "ADBE Linear Wipe");
        if (wipe) {
            wipe.name = "MK Color Fade Wipe";
            fxSet(wipe, 2, CF.angle);
            fxSet(wipe, 3, Math.max(CF.featherMin, CF.featherK * layerWidth(L, t)));
            smoothKeys(wipe.property(1), [[t, 100], [t + CF.wipe, 0]], CF.easeWipe);
        }
        var op = L.transform.opacity, to = 100;
        try { if (op.numKeys === 0) { to = op.value; } else { to = op.valueAtTime(t + CF.fadeIn, false); } } catch (e) {}
        smoothKeys(op, [[t, 0], [t + CF.fadeIn, to]], CF.easeOpacity);
        return !!(tint && wipe);
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
        for (i = 0; i < list.length; i++) { if (!colorFadeOne(list[i], t0 + i * CF.stagger)) { failed++; } }
        if (failed > 0) { alert("The Tint or Linear Wipe effect could not be added to " + failed + " layer(s).", NAME); }
    }
