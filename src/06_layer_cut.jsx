
    // =====================================================================
    // FIXED BAR — Cut Left / Cut / Cut Right (always visible at the bottom of the panel)
    // =====================================================================
    // Acts on the selected layers at the playhead (only layers the playhead is inside):
    //   Cut Left   removes everything BEFORE the playhead (the in point moves to the playhead)
    //   Cut        splits each layer at the playhead into two layers (a copy starts where the original ends)
    //   Cut Right  removes everything AFTER the playhead (the out point moves to the playhead)
    // Layers that are locked, or that the playhead is not inside, are left alone.
    function cutLayers(mode) {
        var comp = activeComp(); if (!comp) { return; }
        var sel = selLayers(comp, 1, "Select the layer(s) to cut, then put the playhead where the cut should be."); if (!sel) { return; }
        var t = comp.time, eps = comp.frameDuration / 10, done = 0, outside = 0, locked = 0, i, L, dup, made = [];
        for (i = 0; i < sel.length; i++) {
            L = sel[i];
            try { if (L.locked) { locked++; continue; } } catch (e0) {}
            if (t <= L.inPoint + eps || t >= L.outPoint - eps) { outside++; continue; }
            if (mode === "left") { L.inPoint = t; }
            else if (mode === "right") { L.outPoint = t; }
            else {
                dup = L.duplicate();
                L.outPoint = t;
                dup.inPoint = t;
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
