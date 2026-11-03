
    // =====================================================================
    // FIXED BAR — Cut Before / Split / Cut After (always visible at the bottom of the panel)
    // =====================================================================
    // Acts on the selected layers at the playhead (only layers the playhead is inside):
    //   Cut Before removes everything BEFORE the playhead (the in point moves to the playhead)
    //   Split      splits each layer at the playhead into two layers (a copy starts where the original ends)
    //   Cut After  removes everything AFTER the playhead (the out point moves to the playhead)
    // Whatever AE does to the other end when one end is moved (a layer's in/out points can pull each other), the end that should
    // NOT change is written back and read back, so the right-hand piece of a Split ends exactly where the original ended.
    // Layers that are locked, or that the playhead is not inside, are left alone.
    function cutLayers(mode) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layer(s) to cut, then put the playhead where the cut should be."); if (!sel) { return; }
        var t = comp.time, eps = comp.frameDuration / 10, done = 0, outside = 0, locked = 0, i, L, dup, made = [], oldIn, oldOut;
        // sets a layer's in/out point back to what it was if AE moved it, and checks by reading it again
        function pin(layer, prop, value) {
            var k;
            for (k = 0; k < 3; k++) {
                try { if (Math.abs(layer[prop] - value) <= eps) { return; } layer[prop] = value; } catch (e) { return; }
            }
        }
        for (i = 0; i < sel.length; i++) {
            L = sel[i];
            try { if (L.locked) { locked++; continue; } } catch (e0) {}
            if (t <= L.inPoint + eps || t >= L.outPoint - eps) { outside++; continue; }
            oldIn = L.inPoint; oldOut = L.outPoint;
            if (mode === "left") { L.inPoint = t; pin(L, "outPoint", oldOut); }
            else if (mode === "right") { L.outPoint = t; pin(L, "inPoint", oldIn); }
            else {
                dup = L.duplicate();
                dup.inPoint = t;
                pin(dup, "outPoint", oldOut);                       // the right-hand piece keeps the original end
                L.outPoint = t;
                pin(L, "inPoint", oldIn);                           // the left-hand piece keeps the original start
                made.push(dup);
            }
            done++;
        }
        for (i = 0; i < made.length; i++) { try { made[i].selected = true; } catch (e1) {} }
        if (done === 0) {
            alert(outside > 0 ? "The playhead is not inside the selected layer(s), so there is nothing to cut. Move it into the layer first." : (locked > 0 ? "The selected layer(s) are locked." : "Nothing was cut."), NAME);
        }
    }
    function doCutLeft() { cutLayers("left"); }
    function doCutSplit() { cutLayers("split"); }
    function doCutRight() { cutLayers("right"); }
