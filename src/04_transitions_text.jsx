
    // =====================================================================
    // TRANSITION GROUP
    // =====================================================================

    function isContentLayer(L) {
        if (!(L instanceof AVLayer)) { return false; }
        if (L.adjustmentLayer || L.guideLayer || !L.enabled) { return false; }
        if (/^(Ru|MK) /.test(L.name)) { return false; }
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
        var adj = cutAdjustment(comp, "Ru Zoom " + (zoomIn ? "In" : "Out") + " Cut", cut, d, o.blur);
        var sc = transformFx(adj).property(4);
        var a = zoomIn ? 100 * k : 100 / k, b = zoomIn ? 100 / k : 100 * k;
        setKeys(sc, [[cut - d, 100], [cut - fr, a], [cut, b], [cut + d, 100]], { eases: CUT_EASES });
    }

    // Swipe cut = a small rig of three linked nulls (the same set-up you would build by hand):
    //   Ru Swipe · Move  a short null around the cut; its Position is the only thing animated (0.9 / 0.1 ease, one key each end)
    //   Ru Swipe · Out   child of Move, holds the outgoing clip (runs up to the cut)
    //   Ru Swipe · In    child of Move, offset by the swipe distance, holds the incoming clip (runs from the cut)
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

        var move = swipeNull(comp, "Ru Swipe · Move", t0, t1);
        var outN = swipeNull(comp, "Ru Swipe · Out", outL.inPoint, cut);
        var inN = swipeNull(comp, "Ru Swipe · In", cut, inL.outPoint);
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
            var acc = buildShape("Ru Wipe Accent", col("primary"));
            animateShape(acc, cut);
            acc.inPoint = Math.max(0, cut);
            acc.outPoint = Math.min(comp.duration, cut + d + lead + fr);
            acc.moveAfter(inL);
        }
        var matte = buildShape("Ru Wipe Matte", [1, 1, 1]);
        animateShape(matte, cut + lead);
        matte.inPoint = Math.max(0, cut);
        matte.outPoint = inL.outPoint;
        matte.moveBefore(inL);
        setMatte(inL, matte, "alpha");
        try { if (outL.outPoint < cut + d + lead) { outL.outPoint = cut + d + lead; } } catch (e) {}
    }
