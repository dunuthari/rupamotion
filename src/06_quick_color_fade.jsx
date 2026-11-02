
    // =====================================================================
    // QUICK ACTIONS — "Color Fade": cards appear tinted in a solid colour, then the colour fades away
    // =====================================================================
    // Read from a clip (creative / delivery / measurement / optimization "agent" cards): each card is revealed left to right by a
    // soft wipe, already washed in a saturated purple-blue (its text and icon show as a darker shade), holds that colour for a
    // moment, then the colour drains out and the card settles on its own look. The cards come in one after another, top to bottom.
    // One button on the selected layers, no settings. Timings are read off the clip, not frame-measured.
    //   per layer (t = its start): opacity 0 -> 100 over 0.1 s; Linear Wipe completion 100 -> 0 over 0.3 s;
    //   Tint amount 100 held until 0.3 s, then 100 -> 0 by 0.7 s. Layers start 1.0 s apart (CF.stagger), top to bottom on screen.
    // Whether the wipe runs left to right or right to left depends on the Linear Wipe angle (CF.angle): flip it to 270 if needed.
    var CF = { stagger: 1.0, fadeIn: 0.1, wipe: 0.3, hold: 0.3, tintOut: 0.4, feather: 40, angle: 90,
               black: [0.20, 0.14, 0.62], white: [0.40, 0.36, 0.93] };

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
            setKeys(tint.property(3), [[t, 100], [t + CF.hold, 100], [t + CF.hold + CF.tintOut, 0]]);
        }
        var wipe = fxAdd(L, "ADBE Linear Wipe");
        if (wipe) {
            wipe.name = "MK Color Fade Wipe";
            fxSet(wipe, 2, CF.angle);
            fxSet(wipe, 3, CF.feather);
            setKeys(wipe.property(1), [[t, 100], [t + CF.wipe, 0]]);
        }
        var op = L.transform.opacity, to = 100;
        try { if (op.numKeys === 0) { to = op.value; } else { to = op.valueAtTime(t + CF.fadeIn, false); } } catch (e) {}
        setKeys(op, [[t, 0], [t + CF.fadeIn, to]]);
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
