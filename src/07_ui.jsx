

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
            press:   [0.890, 0.898, 0.914, 1],
            pressPrimary: [0.020, 0.300, 0.780, 1],
            pressTint: [0.800, 0.890, 1.000, 1],
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
            press:   [0.250, 0.262, 0.290, 1],
            pressPrimary: [0.020, 0.300, 0.780, 1],
            pressTint: [0.070, 0.140, 0.260, 1],
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
        var g = this.graphics, w = this.size[0], h = this.size[1], v = this.variant || "primary", pr = !!this.pressed;
        var fill, stroke = null, tc, bold = false;
        if (v === "primary") { fill = pr ? DS.pressPrimary : DS.primary; tc = DS.onPrimary; bold = true; }
        else if (v === "chip-on") { fill = pr ? DS.pressTint : DS.tint; tc = DS.primary; bold = true; }
        else if (v === "chip") { fill = pr ? DS.press : DS.card; tc = DS.label; stroke = DS.border; }
        else { fill = pr ? DS.press : DS.card; tc = DS.text; stroke = DS.border; }
        if (pr && v !== "primary") { stroke = DS.primary; }
        rrPath(g, 0.5, 0.5, w - 1, h - 1, (h - 1) / 2);
        g.fillPath(brush(g, fill));
        if (stroke) { g.strokePath(pen(g, stroke, pr ? 2 : 1)); }
        var f = font(bold ? "BOLD" : "REGULAR", 12), m = measure(g, this.text, f);
        textAt(g, this.text, tc, Math.round((w - m[0]) / 2), Math.round((h - m[1]) / 2) + (pr ? 1 : 0), f);
    }

    // Click feedback: the button shows a pressed state while the mouse is down.
    function styleButton(b, variant, height) {
        b.variant = variant || "secondary";
        b.preferredSize.height = height || 32;
        if (!CLASSIC) {
            b.onDraw = drawButton;
            b.addEventListener("mousedown", function () { b.pressed = true; redraw(b); });
            b.addEventListener("mouseup", function () { b.pressed = false; redraw(b); });
            b.addEventListener("mouseout", function () { if (b.pressed) { b.pressed = false; redraw(b); } });
        }
        return b;
    }

    // ---- form rows ----

    var LABEL_W = 116;

    var STAGGER_TIP = "Delay between layers, in frames.\n0 = every selected layer starts together.\n3 = each next layer starts 3 frames after the one before it, so they animate one after another.";

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
        b.onClick = function () {
            b.pressed = true;
            redraw(b);
            try { fn.call(b); }
            finally {
                try { $.sleep(80); } catch (e) {}
                b.pressed = false;
                redraw(b);
            }
        };
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
        "Layers": "Layers", "Quick Actions": "Quick", "Flow": "Flow", "Camera": "Camera", "Shapes": "Shapes",
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
        "Flow": function (g, x, y, p) {
            var pts = [], i, q;
            for (i = 0; i <= 16; i++) { q = bezierAt([0.66, 0, 0.34, 1], i / 16); pts.push([x - 9 + q[0] * 18, y + 8 - q[1] * 16]); }
            poly(g, pts, false); g.strokePath(p);
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
    var SUBGROUP_CHIPS = { "Text": true };
    // parent (optional): the name of another feature in the same group; this feature then lives under that chip as a second-level chip
    function feature(group, name, build, parent) { FEATURES.push({ group: group, name: name, build: build, parent: parent || "" }); }

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

    // ---- color picker (dark, After Effects style: saturation/brightness square + hue strip) ----

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function hsvToRgb(h, s, v) {
        h = ((h % 360) + 360) % 360;
        var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0, i = Math.floor(h / 60);
        if (i === 0) { r = c; g = x; }
        else if (i === 1) { r = x; g = c; }
        else if (i === 2) { g = c; b = x; }
        else if (i === 3) { g = x; b = c; }
        else if (i === 4) { r = x; b = c; }
        else { r = c; b = x; }
        return [r + m, g + m, b + m];
    }

    function rgbToHsv(c) {
        var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
        if (d > 0) {
            if (mx === r) { h = 60 * (((g - b) / d) % 6); }
            else if (mx === g) { h = 60 * ((b - r) / d + 2); }
            else { h = 60 * ((r - g) / d + 4); }
        }
        if (h < 0) { h += 360; }
        return { h: h, s: (mx === 0) ? 0 : d / mx, v: mx };
    }

    function redraw(c) { try { c.notify("onDraw"); } catch (e) { repaint(c); } }

    // Returns an rgb array [0..1], or null when cancelled.
    function pickColor(title, startRgb) {
        var hsv = rgbToHsv(startRgb), oldRgb = startRgb, result = null, fields = [];
        var SQ = 200, HW = 22, CELL = 10;

        function cur() { return hsvToRgb(hsv.h, hsv.s, hsv.v); }

        var dlg = new Window("dialog", title);
        dlg.orientation = "row";
        dlg.alignChildren = ["left", "top"];
        dlg.spacing = 12;
        dlg.margins = 14;
        try { dlg.graphics.backgroundColor = brush(dlg.graphics, DS.bg); } catch (e0) {}

        var sq = dlg.add("group");
        sq.preferredSize = [SQ, SQ];
        var hb = dlg.add("group");
        hb.preferredSize = [HW, SQ];
        var side = dlg.add("group");
        side.orientation = "column";
        side.alignChildren = ["fill", "top"];
        side.spacing = 6;
        var cmp = side.add("group");
        cmp.preferredSize = [96, 44];

        sq.onDraw = function () {
            var g = this.graphics, n = SQ / CELL, x, y, c;
            for (y = 0; y < n; y++) {
                for (x = 0; x < n; x++) {
                    c = hsvToRgb(hsv.h, (x + 0.5) / n, 1 - (y + 0.5) / n);
                    g.newPath();
                    g.rectPath(x * CELL, y * CELL, CELL, CELL);
                    g.fillPath(brush(g, [c[0], c[1], c[2], 1]));
                }
            }
            var cx = hsv.s * SQ, cy = (1 - hsv.v) * SQ;
            g.newPath(); g.ellipsePath(cx - 6, cy - 6, 12, 12); g.strokePath(pen(g, [0, 0, 0, 1], 3));
            g.newPath(); g.ellipsePath(cx - 6, cy - 6, 12, 12); g.strokePath(pen(g, [1, 1, 1, 1], 1.5));
        };

        hb.onDraw = function () {
            var g = this.graphics, n = SQ / 5, y, c;
            for (y = 0; y < n; y++) {
                c = hsvToRgb((y + 0.5) / n * 360, 1, 1);
                g.newPath();
                g.rectPath(0, y * 5, HW, 5);
                g.fillPath(brush(g, [c[0], c[1], c[2], 1]));
            }
            var my = Math.round(hsv.h / 360 * SQ);
            g.newPath(); g.rectPath(0, my - 2, HW, 4); g.strokePath(pen(g, [0, 0, 0, 1], 3));
            g.newPath(); g.rectPath(0, my - 2, HW, 4); g.strokePath(pen(g, [1, 1, 1, 1], 1.5));
        };

        cmp.onDraw = function () {
            var g = this.graphics, a = cur(), o = oldRgb;
            g.newPath(); g.rectPath(0, 0, 96, 22); g.fillPath(brush(g, [a[0], a[1], a[2], 1]));
            g.newPath(); g.rectPath(0, 22, 96, 22); g.fillPath(brush(g, [o[0], o[1], o[2], 1]));
            rrPath(g, 0.5, 0.5, 95, 43, 2); g.strokePath(pen(g, DS.border, 1));
        };

        var down = null;
        function mouseMove(e) {
            if (!down) { return; }
            if (down === "sq") { hsv.s = clamp01(e.clientX / SQ); hsv.v = 1 - clamp01(e.clientY / SQ); }
            else { hsv.h = clamp01(e.clientY / SQ) * 360; }
            refresh();
        }
        function bindMouse(ctrl, which) {
            ctrl.addEventListener("mousedown", function (e) { down = which; mouseMove(e); });
            ctrl.addEventListener("mousemove", mouseMove);
            ctrl.addEventListener("mouseup", function () { down = null; });
        }
        bindMouse(sq, "sq");
        bindMouse(hb, "hue");

        function addNum(name, get, set) {
            var r = side.add("group");
            r.orientation = "row";
            r.alignChildren = ["left", "center"];
            var l = r.add("statictext", undefined, name);
            l.preferredSize.width = 14;
            setFg(l, DS.label);
            var e = r.add("edittext", undefined, "");
            e.characters = 5;
            e.onChange = function () { set(num(e.text, get())); refresh(); };
            fields.push({ edit: e, get: get });
        }
        function setChannel(i, v) {
            var c = cur(), n;
            c[i] = Math.max(0, Math.min(255, v)) / 255;
            n = rgbToHsv(c);
            if (n.s === 0) { n.h = hsv.h; }
            hsv = n;
        }
        addNum("H", function () { return Math.round(hsv.h); }, function (v) { hsv.h = Math.max(0, Math.min(360, v)); });
        addNum("S", function () { return Math.round(hsv.s * 100); }, function (v) { hsv.s = Math.max(0, Math.min(100, v)) / 100; });
        addNum("B", function () { return Math.round(hsv.v * 100); }, function (v) { hsv.v = Math.max(0, Math.min(100, v)) / 100; });
        addNum("R", function () { return Math.round(cur()[0] * 255); }, function (v) { setChannel(0, v); });
        addNum("G", function () { return Math.round(cur()[1] * 255); }, function (v) { setChannel(1, v); });
        addNum("B", function () { return Math.round(cur()[2] * 255); }, function (v) { setChannel(2, v); });

        var hr = side.add("group");
        hr.orientation = "row";
        hr.alignChildren = ["left", "center"];
        var hl = hr.add("statictext", undefined, "#");
        hl.preferredSize.width = 14;
        setFg(hl, DS.label);
        var hexE = hr.add("edittext", undefined, "");
        hexE.characters = 7;
        hexE.onChange = function () {
            var n = rgbToHsv(hexToRgb(hexE.text));
            if (n.s === 0) { n.h = hsv.h; }
            hsv = n;
            refresh();
        };

        function refresh() {
            for (var i = 0; i < fields.length; i++) { fields[i].edit.text = String(fields[i].get()); }
            hexE.text = rgbToHex(cur()).replace("#", "");
            redraw(sq); redraw(hb); redraw(cmp);
        }

        var br = side.add("group");
        br.orientation = "row";
        br.alignChildren = ["fill", "center"];
        br.spacing = 6;
        var okB = styleButton(br.add("button", undefined, "OK", { name: "ok" }), "primary", 30);
        var noB = styleButton(br.add("button", undefined, "Cancel", { name: "cancel" }), "secondary", 30);
        okB.preferredSize.width = 60;
        noB.preferredSize.width = 60;
        okB.onClick = function () { result = cur(); dlg.close(1); };
        noB.onClick = function () { dlg.close(0); };

        refresh();
        dlg.show();
        return result;
    }

    // Opens the dark picker; falls back to the system picker if it can't be built.
    function colorTitle(label) {
        var n = trim(String(label).replace(/:/g, ""));
        return /color/i.test(n) ? n : n + " color";
    }

    function chooseColor(title, rgb) {
        try { return pickColor(title, rgb); } catch (e) {}
        var res = $.colorPicker((Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255));
        return (res >= 0) ? [((res >> 16) & 255) / 255, ((res >> 8) & 255) / 255, (res & 255) / 255] : null;
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
        var api = { onChange: null, get: function () { return hexToRgb(hex.text); } };
        var hex = r.add("edittext", undefined, start);
        hex.characters = 8;
        hex.helpTip = "Hex color, e.g. #4285F4";
        function update() {
            hex.text = rgbToHex(hexToRgb(hex.text));
            paintSwatch(sw, hex.text);
            if (key) { putS(key, hex.text); }
            if (api.onChange) { api.onChange(); }
        }
        function choose() {
            var c = chooseColor(colorTitle(label), hexToRgb(hex.text));
            if (c) {
                hex.text = rgbToHex(c);
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
        return api;
    }

    // ---------------- Layers ----------------

    feature("Layers", "Layer operations", function (p) {
        grid(p, [
            ["Pre-comp", function () { run("Pre-comp", doPrecomposeSafe); }, "Group layers safely — keeps their in/out range"],
            ["Unwrap Comp", function () {
                run("Unwrap Comp", function () { doUnwrapComp({ keepTransform: true, removeLayer: true }); });
            }, "Moves the layers of the selected pre-comp into this comp, with timing and parenting. A null keeps the pre-comp layer's transform."],
            ["Adjustment Layer", function () { run("Adjustment Layer", doAdjustmentLayer); }, "Full comp bounds, above the selection"],
            ["Smart Null", function () { run("Smart Null", doSmartNull); }, "50×50 null at the comp center (or the selection's center), parents selected layers"]
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
        var bT = check(p, "Bounce effect", qb, "ON: every animation below bounces (slides, pops and fades overshoot and settle).\nOFF: clean eased motion with no bounce.\nSet how much with Bounce (%) below.");
        bT.onToggle = function () {
            qb = bT.value;
            putS("quick_bounce", qb ? "1" : "0");
        };

        var bPct = field(p, "Bounce (%):", getS("quick_bounce_pct", style.bounceAmt), 4,
            "How far animations overshoot before settling.\n5 = subtle, 10 = default, 30 = very springy.");
        bPct.onChange = function () { bPct.text = String(num(bPct.text, 10, 1, 60)); putS("quick_bounce_pct", bPct.text); };
        var dist = field(p, "Slide distance (px):", "200", 5);
        var gdir = drop(p, "Gradient direction:", ["Horizontal", "Vertical", "Diagonal"], 0);

        // Runs an animation action with the Quick Actions bounce state
        function anim(label, fn) {
            return function () { run(label, function () { withBounce(qb, fn, num(bPct.text, 10, 1, 60)); }); };
        }
        function slide(dir, label) {
            return anim(label, function () {
                doMove(dir, { mode: "in", offscreen: false, distance: num(dist.text, 200, 1, 20000), fade: true, stagger: 0 });
            });
        }
        grid(p, [
            ["Fade In", anim("Fade In", function () { doFade(true, 0, qb); })],
            ["Fade Out", anim("Fade Out", function () { doFade(false, 0, qb); })],
            ["Slide Left", slide([-1, 0], "Slide Left"), "Slides in, travelling left"],
            ["Slide Right", slide([1, 0], "Slide Right"), "Slides in, travelling right"],
            ["Slide Up", slide([0, -1], "Slide Up"), "Slides in, travelling up"],
            ["Slide Down", slide([0, 1], "Slide Down"), "Slides in, travelling down"],
            ["Scale Pop", anim("Scale Pop", function () { doPop("up", { fade: true, center: "auto", stagger: 0 }); })],
            ["Blur Fade", anim("Blur Fade", function () { doBlurFade(0, qb); })],
            ["Reverse Keys", function () { run("Reverse Keys", doReverseKeys); }, "Reverses selected keyframed properties (or all on the selected layers)"],
            ["Lock Gradient", function () { run("Lock Gradient", function () { doLockGradient(gdir.selection.index); }); }, "Gradient that stays locked to the layer: it moves, scales and rotates with it"]
        ]);
        hint(p, "Bounce applies to Fade, Slide, Scale Pop and Blur Fade.");
        hint(p, "Uses Duration and Curve from the Style group. Anchor points are kept as you set them.");

        var ball = subPanel(p, "Bounce the ball effect");
        hint(ball, "Keyframed layers bounce like a ball after each key.");
        var ballAmt = field(ball, "Amount (%):", getS("quick_ball", "10"), 4,
            "How far it bounces after each keyframe.\n5 = small settle, 10 = default, 30+ = big rubber-ball bounce.");
        ballAmt.onChange = function () { ballAmt.text = String(num(ballAmt.text, 10, 1, 100)); putS("quick_ball", ballAmt.text); };
        btn(ball, "Bounce the ball effect", function () {
            run("Bounce the ball effect", function () { doBouncePhysics(num(ballAmt.text, 10, 1, 100)); });
        }, "Adds a ball-like bounce after every keyframe of the selected layers (position, scale, rotation) or selected keyframed properties.");
    });

    // ---------------- Flow ----------------

    var FLOW_ORANGE = [0.96, 0.65, 0.14, 1];

    // Draws a bezier curve as a smooth polyline into box (bx, by, bw, bh); yOf maps a value to y
    function flowCurvePath(g, c, xOf, yOf) {
        var i, q;
        g.newPath();
        for (i = 0; i <= 64; i++) {
            q = bezierAt(c, i / 64);
            if (i === 0) { g.moveTo(xOf(q[0]), yOf(q[1])); } else { g.lineTo(xOf(q[0]), yOf(q[1])); }
        }
    }

    feature("Flow", "Easing curves", function (p) {
        var GW = 204, GH = 190, X0 = 14, XW = 176, Y0 = 134, YS = 80;     // plot: u 0..1 -> X0..X0+XW, v 0..1 -> Y0..Y0-YS
        var cur = [0.66, 0, 0.34, 1], mode = "both", picked = -1, drag = -1, i;
        var saved = splitList(getS("flow_curve", ""));
        if (saved.length === 4) { for (i = 0; i < 4; i++) { cur[i] = num(saved[i], cur[i], -1, 2); } }
        for (i = 0; i < FLOW_PRESETS.length; i++) {
            if (FLOW_PRESETS[i][1] === cur[0] && FLOW_PRESETS[i][2] === cur[1] && FLOW_PRESETS[i][3] === cur[2] && FLOW_PRESETS[i][4] === cur[3]) { picked = i; }
        }
        function xOf(u) { return X0 + u * XW; }
        function yOf(v) { return Y0 - v * YS; }

        hint(p, "Select keyframes, pick a curve, edit it if you like, then Apply.");

        var gr = p.add("group");
        gr.preferredSize = [GW, GH];
        gr.alignment = ["center", "top"];
        gr.helpTip = "Drag the orange handles to shape the curve.";
        gr.onDraw = function () {
            var g = this.graphics, k;
            rrPath(g, 0.5, 0.5, GW - 1, GH - 1, 10);
            g.fillPath(brush(g, DS.card));
            for (k = 0; k <= 4; k++) {
                poly(g, [[xOf(k / 4), yOf(-0.6)], [xOf(k / 4), yOf(1.6)]], false); g.strokePath(pen(g, DS.border, 1));
            }
            for (k = -2; k <= 6; k++) {
                poly(g, [[X0 - 8, yOf(k / 4)], [X0 + XW + 8, yOf(k / 4)]], false); g.strokePath(pen(g, DS.border, 1));
            }
            g.newPath(); g.rectPath(X0, yOf(1), XW, YS); g.strokePath(pen(g, DS.primary, 1));
            poly(g, [[xOf(0), yOf(0)], [xOf(1), yOf(1)]], false); g.strokePath(pen(g, DS.muted, 1));
            poly(g, [[xOf(0), yOf(0)], [xOf(cur[0]), yOf(cur[1])]], false); g.strokePath(pen(g, FLOW_ORANGE, 2));
            poly(g, [[xOf(1), yOf(1)], [xOf(cur[2]), yOf(cur[3])]], false); g.strokePath(pen(g, FLOW_ORANGE, 2));
            flowCurvePath(g, cur, xOf, yOf); g.strokePath(pen(g, DS.text, 3));
            var pts = [[0, 0, DS.text], [1, 1, DS.text], [cur[0], cur[1], FLOW_ORANGE], [cur[2], cur[3], FLOW_ORANGE]];
            for (k = 0; k < 4; k++) {
                g.newPath(); g.ellipsePath(xOf(pts[k][0]) - 5, yOf(pts[k][1]) - 5, 10, 10); g.fillPath(brush(g, pts[k][2]));
            }
        };

        var vals = row(p, "Curve:");
        var ef = [], names = ["x1", "y1", "x2", "y2"];
        function two(v) { return String(Math.round(v * 100) / 100); }
        var tiles = [];

        function refresh(fromPreset) {
            for (var k = 0; k < 4; k++) { ef[k].text = two(cur[k]); }
            if (!fromPreset) { picked = -1; }
            putS("flow_curve", cur.join(","));
            redraw(gr);
            for (k = 0; k < tiles.length; k++) { redraw(tiles[k]); }
        }
        for (i = 0; i < 4; i++) {
            (function (k) {
                var e = vals.add("edittext", undefined, two(cur[k]));
                e.characters = 4;
                e.helpTip = names[k] + (k % 2 === 0 ? " (time, 0–1)" : " (value)");
                e.onChange = function () {
                    cur[k] = (k % 2 === 0) ? num(e.text, cur[k], 0, 1) : num(e.text, cur[k], -1, 2);
                    refresh(false);
                };
                ef.push(e);
            })(i);
        }

        function moveHandle(e) {
            if (drag < 0) { return; }
            var u = Math.max(0, Math.min(1, (e.clientX - X0) / XW)), v = Math.max(-0.6, Math.min(1.6, (Y0 - e.clientY) / YS));
            cur[drag * 2] = Math.round(u * 100) / 100;
            cur[drag * 2 + 1] = Math.round(v * 100) / 100;
            refresh(false);
        }
        gr.addEventListener("mousedown", function (e) {
            var d0 = Math.abs(e.clientX - xOf(cur[0])) + Math.abs(e.clientY - yOf(cur[1]));
            var d1 = Math.abs(e.clientX - xOf(cur[2])) + Math.abs(e.clientY - yOf(cur[3]));
            drag = (d0 <= d1) ? 0 : 1;
            moveHandle(e);
        });
        gr.addEventListener("mousemove", moveHandle);
        gr.addEventListener("mouseup", function () { drag = -1; });
        gr.addEventListener("mouseout", function () { drag = -1; });

        // Which keyframe side the curve is applied to
        var mr = btnRow(p);
        var modeBtns = [];
        var modeDefs = [["◂ In", "in"], ["Both", "both"], ["Out ▸", "out"]];
        function paintModes() {
            for (var k = 0; k < modeBtns.length; k++) {
                modeBtns[k].variant = (modeBtns[k].modeId === mode) ? "primary" : "secondary";
                redraw(modeBtns[k]);
            }
        }
        for (i = 0; i < modeDefs.length; i++) {
            (function (d) {
                var b = styleButton(mr.add("button", undefined, d[0]), d[1] === mode ? "primary" : "secondary", 28);
                b.modeId = d[1];
                b.helpTip = (d[1] === "both") ? "Ease into and out of the keyframes."
                    : (d[1] === "in") ? "Only the incoming side of each segment (slow arrival)."
                    : "Only the outgoing side of each segment (slow departure).";
                b.onClick = function () { mode = d[1]; paintModes(); };
                modeBtns.push(b);
            })(modeDefs[i]);
        }

        var bounceT = check(p, "Bounce effect", getS("flow_bounce", "0") === "1",
            "ON: after each keyframe the layer springs a little past its end value and settles.\nOFF: no bounce (also removes a Flow bounce added earlier).");
        bounceT.onToggle = function () { putS("flow_bounce", bounceT.value ? "1" : "0"); };
        var bounceP = field(p, "Bounce (%):", getS("flow_bounce_pct", "10"), 4,
            "How far it overshoots, as a % of the move. 5 = subtle, 10 = default, 30 = very springy.");
        bounceP.onChange = function () { bounceP.text = String(num(bounceP.text, 10, 1, 100)); putS("flow_bounce_pct", bounceP.text); };

        btn(p, "Apply", function () {
            run("Flow easing", function () {
                doFlowApply(cur, mode, { bounce: bounceT.value, pct: num(bounceP.text, 10, 1, 100) });
            });
        }, "Applies this curve (and the bounce, if on) to the selected keyframes, or to every key of the selected properties.");

        // Preset tiles, 7 per row: click one to load it into the graph above
        var pr = null;
        function drawTile() {
            var g = this.graphics, w = this.size[0], h = this.size[1], c = this.curve, on = (this.presetIndex === picked);
            rrPath(g, 0.5, 0.5, w - 1, h - 1, 8);
            g.fillPath(brush(g, on ? DS.primary : DS.card));
            if (!on) { g.strokePath(pen(g, DS.border, 1)); }
            var ink = on ? DS.onPrimary : DS.text, soft = on ? [1, 1, 1, 0.55] : DS.muted;
            var lo = Math.min(0, c[1], c[3]), hi = Math.max(1, c[1], c[3]), k, q;
            for (k = 0; k <= 16; k++) { q = bezierAt(c, k / 16); lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
            var bx = 8, bw = w - 16, by = 6, bh = h - 24, span = hi - lo;
            function tx(u) { return bx + u * bw; }
            function ty(v) { return by + bh - (v - lo) / span * bh; }
            poly(g, [[tx(0), ty(0)], [tx(c[0]), ty(c[1])]], false); g.strokePath(pen(g, soft, 1));
            poly(g, [[tx(1), ty(1)], [tx(c[2]), ty(c[3])]], false); g.strokePath(pen(g, soft, 1));
            flowCurvePath(g, c, tx, ty); g.strokePath(pen(g, ink, 2));
            var dots = [[0, 0], [1, 1], [c[0], c[1]], [c[2], c[3]]];
            for (k = 0; k < 4; k++) {
                g.newPath(); g.ellipsePath(tx(dots[k][0]) - 2, ty(dots[k][1]) - 2, 4, 4);
                g.fillPath(brush(g, k < 2 ? ink : soft));
            }
            var f = font(on ? "BOLD" : "REGULAR", 9), m = measure(g, this.text, f);
            textAt(g, this.text, on ? DS.onPrimary : DS.muted, Math.round((w - m[0]) / 2), h - m[1] - 4, f);
        }
        for (i = 0; i < FLOW_PRESETS.length; i++) {
            if (i % 7 === 0) {
                pr = p.add("group");
                pr.orientation = "row";
                pr.alignChildren = ["fill", "center"];
                pr.spacing = 4;
            }
            (function (idx) {
                var d = FLOW_PRESETS[idx];
                var t = pr.add("button", undefined, d[0]);
                t.preferredSize = [44, 60];
                t.presetIndex = idx;
                t.curve = [d[1], d[2], d[3], d[4]];
                t.helpTip = d[0] + "  (" + d[1] + ", " + d[2] + ", " + d[3] + ", " + d[4] + ")\nClick to load it into the graph, then Apply.";
                t.onDraw = drawTile;
                t.onClick = function () {
                    cur = [d[1], d[2], d[3], d[4]];
                    picked = idx;
                    refresh(true);
                };
                tiles.push(t);
            })(i);
        }
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
        hint(p, "Springs past the end size and settles. Edit freq / decay / amp in the scale expression to tune.");
        var r = btnRow(p);
        function go(mode) {
            run("Pop " + mode, function () { doPop(mode, { fade: fade.value, center: center.value, stagger: 0, smooth: true }); });
        }
        btn(r, "Pop Up", function () { go("up"); });
        btn(r, "Pop Out", function () { go("out"); });
    });

    feature("Animation", "Move in / out", function (p) {
        var mode = drop(p, "Mode:", ["In", "Out"], 0);
        var dist = drop(p, "Distance:", ["Off screen", "Custom"], 0);
        var px = field(p, "Custom (px):", "300", 5, "Used when Distance is Custom.");
        // The custom distance only applies when Distance is "Custom": grey it out otherwise
        function syncCustom() {
            var on = !!dist.selection && dist.selection.index === 1;
            px.enabled = on;
            try { px.parent.children[0].enabled = on; } catch (e) {}
        }
        dist.onChange = syncCustom;
        syncCustom();
        var fade = check(p, "Fade opacity too", false);
        var stag = field(p, "Stagger (frames):", "0", 4, STAGGER_TIP);
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
        var stag = field(p, "Stagger (frames):", "2", 4, STAGGER_TIP);
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
        hint(p, "Select the outgoing + incoming clips, or put the playhead on the cut.");
        hint(p, "Adds 3 linked nulls: Out, In and a Move null at the cut.");
        var fr = field(p, "Frames each side:", "15", 4, "How long the whoosh lasts on each side of the cut.");
        var dist = field(p, "Distance (%):", "27", 4, "How far the clips slide. 27% is about 520 px on a 1920 frame, so both stay on screen. 100% = a full screen.");
        var blur = field(p, "Blur (shutter °):", "300", 4, "Raises the comp's shutter angle to at least this, for motion blur.");
        var r = btnRow(p);
        function go(dir) {
            run("Swipe cut", function () { doSwipeCut(dir, { frames: Math.round(num(fr.text, 15, 1, 60)), distance: num(dist.text, 27, 1, 300), blur: num(blur.text, 300, 0, 720) }); });
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

    feature("Text", "Motion", function (p) {
        var items = [], i;
        for (i = 0; i < TEXT_PRESETS.length; i++) {
            (function (idx) {
                items.push({ name: TEXT_PRESETS[idx].name, tip: "Applies the \"" + TEXT_PRESETS[idx].name + "\" animation preset to the selected layers, starting at the playhead.",
                    go: function () { run("Text preset: " + TEXT_PRESETS[idx].name, function () { doTextPreset(idx); }); } });
            })(i);
        }
        // built-in, no settings: a two-line text rolls up through a one-line window, word by word
        items.push({ name: "SaaS Text Preset 1", tip: "Put the two sentences on two lines of one text layer and select it. The first line rolls up and out through a one-line window while the second rises into its place, word by word.",
            go: function () { run("SaaS Text Preset 1", doSaasRoll); } });
        // built-in, no settings: types the selected text layer out letter by letter, with a caret
        items.push({ name: "Typewriter", tip: "Types the selected text layer out letter by letter at the playhead, with a caret that follows.",
            go: function () { run("Typewriter", doTypewriter); } });
        items.push({ name: "Typewriter Block", tip: "Types the selected text out word by word: a gradient block sits over the next word and the newest words glow blue, then settle back to the text colour.",
            go: function () { run("Typewriter Block", doTypewriterBlock); } });
        hint(p, "Select text layer(s), put the playhead where it should start, click an effect.");
        // two columns; every button gets the same preferred width so the pair splits the row evenly
        var row2 = null;
        for (i = 0; i < items.length; i++) {
            if (i % 2 === 0) { row2 = btnRow(p); }
            var tb = btn(row2, items[i].name, items[i].go, items[i].tip);
            tb.preferredSize.width = 120;
        }
        if (items.length % 2 === 1) {
            // keep the last button the same width as the others
            var pad = row2.add("group");
            pad.preferredSize = [120, 32];
        }
    });

    // Text size for the preview stage. measureString can fail or return nothing useful on some systems, and then the words
    // pile up on each other, so fall back to a per-character width table (sans-serif bold, in em) that is close enough
    // for a preview. The result is always a usable [width, height].
    var EM_NARROW = "iljI.,:;!|'`", EM_MID = "tfrJ()[] -", EM_WIDE = "mwMW@%";
    function approxWidth(str, fs) {
        var w = 0, i, c;
        for (i = 0; i < str.length; i++) {
            c = str.charAt(i);
            if (EM_NARROW.indexOf(c) >= 0) { w += 0.30; }
            else if (EM_MID.indexOf(c) >= 0) { w += 0.38; }
            else if (EM_WIDE.indexOf(c) >= 0) { w += 0.92; }
            else if (c >= "A" && c <= "Z") { w += 0.70; }
            else { w += 0.58; }
        }
        return w * fs;
    }
    function textSize(g, str, f, fs) {
        var est = approxWidth(str, fs), w = est, m;
        try {
            m = f ? g.measureString(str, f) : g.measureString(str);
            var mw = (m && m.width !== undefined) ? m.width : (m ? m[0] : 0);
            if (typeof mw === "number" && mw > 0 && mw > est * 0.6 && mw < est * 1.6) { w = mw; }
        } catch (e) {}
        return [w, fs * 1.25];
    }

    // Outline of the built-in sparkle as a polyline (ScriptUI paths have no curves). Same bezier as sparkleShape(R).
    function sparkPoints(R, steps) {
        var o = [0.07 * R, 0.55 * R], inn = [-0.55 * R, -0.07 * R], tips = [[0, -R], [R, 0], [0, R], [-R, 0]], pts = [], k, j, t;
        function rot(pt, q) { for (var m = 0; m < q; m++) { pt = [-pt[1], pt[0]]; } return pt; }
        for (k = 0; k < 4; k++) {
            var a = tips[k], b = tips[(k + 1) % 4], ot = rot(o, k), it = rot(inn, (k + 1) % 4 + 3);
            var p1 = [a[0] + ot[0], a[1] + ot[1]], p2 = [b[0] + it[0], b[1] + it[1]];
            for (j = 0; j < steps; j++) {
                t = j / steps;
                var u = 1 - t;
                pts.push([u * u * u * a[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * b[0],
                          u * u * u * a[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * b[1]]);
            }
        }
        return pts;
    }

    // Static preview of the finished Text + Icon line: the words, the icon slot and the sparkle, laid out with the same
    // maths (tiLayout, TI) as the real build. o: words, at (icon slot index), size, gap, pct, textColor, iconColor
    function drawTiStage(ctrl, o) {
        var g = ctrl.graphics, w = ctrl.size ? (ctrl.size.width || ctrl.size[0]) : 240, h = ctrl.size ? (ctrl.size.height || ctrl.size[1]) : 96, i;
        rrPath(g, 0.5, 0.5, w - 1, h - 1, 12);
        g.fillPath(brush(g, [0.055, 0.067, 0.110, 1]));
        g.strokePath(pen(g, DS.border, 1));
        var n = o.words.length;
        if (n < 1) {
            var hf = font("REGULAR", 12), hm = textSize(g, "Type a sentence", hf, 12);
            textAt(g, "Type a sentence", DS.muted, Math.round((w - hm[0]) / 2), Math.round((h - hm[1]) / 2), hf);
            return;
        }
        var fs0 = 30, f0 = font("BOLD", fs0), th = fs0 * 0.75, widths = [];
        for (i = 0; i < n; i++) { widths.push(textSize(g, o.words[i], f0, fs0)[0]); }
        var k = fs0 / Math.max(1, o.size);                                   // build pixels -> stage pixels
        var slot = Math.max(0.3 * th, TI.slotH * th + o.gap * k), icon = TI.iconH * th * o.pct / 100, endGap = (slot + icon) / 2;
        var L = tiLayout(widths, o.at, 1, slot, fs0 * TI.spaceK, 0, endGap);
        // extent of the whole line, so it can be scaled to fit
        var lo = L.iconX - ((o.at === 0 || o.at === n) ? endGap : slot) / 2, hi = L.iconX + ((o.at === 0 || o.at === n) ? endGap : slot) / 2;
        for (i = 0; i < n; i++) { lo = Math.min(lo, L.centers[i] - widths[i] / 2); hi = Math.max(hi, L.centers[i] + widths[i] / 2); }
        var fit = Math.min(1, (w - 28) / Math.max(1, hi - lo)), fs = fs0 * fit, f = font("BOLD", fs), mid = (lo + hi) / 2;
        var tc = o.textColor, ic = o.iconColor;
        for (i = 0; i < n; i++) {
            var m = textSize(g, o.words[i], f, fs);
            textAt(g, o.words[i], [tc[0], tc[1], tc[2], 1], Math.round(w / 2 + (L.centers[i] - mid) * fit - m[0] / 2), Math.round((h - m[1]) / 2), f);
        }
        var pts = sparkPoints(icon * fit / 2, 7), cx = w / 2 + (L.iconX - mid) * fit, cy = h / 2;
        g.newPath();
        for (i = 0; i < pts.length; i++) { if (i === 0) { g.moveTo(cx + pts[i][0], cy + pts[i][1]); } else { g.lineTo(cx + pts[i][0], cy + pts[i][1]); } }
        g.closePath();
        g.fillPath(brush(g, [ic[0], ic[1], ic[2], 1]));
    }

    // Static picture of the Star Swipe halfway through the sweep: sentence 2 behind the star, sentence 1 ahead of it, the star on
    // the wipe edge and a fading glow behind it. Letters are drawn one by one (there is no clipping in ScriptUI), using the same
    // width estimate as the Text + Icon stage. o: first, second, size, pct, soft, textColor, iconColor, trail (bool), trailColor
    function drawSsStage(ctrl, o) {
        var g = ctrl.graphics, w = ctrl.size ? (ctrl.size.width || ctrl.size[0]) : 240, h = ctrl.size ? (ctrl.size.height || ctrl.size[1]) : 96, i, j;
        rrPath(g, 0.5, 0.5, w - 1, h - 1, 12);
        g.fillPath(brush(g, [0.055, 0.067, 0.110, 1]));
        g.strokePath(pen(g, DS.border, 1));
        var s1 = trim(o.first), s2 = trim(o.second);
        if (s1 === "" || s2 === "") {
            var hf = font("REGULAR", 12), hm = textSize(g, "Type both sentences", hf, 12);
            textAt(g, "Type both sentences", DS.muted, Math.round((w - hm[0]) / 2), Math.round((h - hm[1]) / 2), hf);
            return;
        }
        var fs0 = 26, w1 = approxWidth(s1, fs0), w2 = approxWidth(s2, fs0), iconS = TI.iconH * fs0 * 0.75 * o.pct / 100;
        var gapX = Math.max(iconS * 0.7, o.soft * fs0 / Math.max(1, o.size) * 1.5), half = Math.max(w1, w2) / 2;
        var fit = Math.min(1, (w - 24) / Math.max(1, 2 * (half + gapX))), fs = fs0 * fit, f = font("BOLD", fs);
        var cx = w / 2, cy = h / 2, tc = o.textColor, ic = o.iconColor, tr = o.trailColor;
        var xs = cx + (-half - gapX + 0.5 * 2 * (half + gapX)) * fit;                 // star at 50% of its sweep
        var edge = o.soft * fs0 / Math.max(1, o.size) * fit * 0.5;
        // glow: slices rising from nothing at the tail to full at the star
        if (o.trail) {
            var len = w * 0.28, N = 14, sw = len / N, th = fs * 0.75 * 1.3;
            for (i = 0; i < N; i++) {
                var al = Math.pow((i + 0.5) / N, 1.6) * 0.9;
                g.newPath(); g.rectPath(xs - len + i * sw, cy - th / 2, sw + 1, th);
                g.fillPath(brush(g, [tr[0], tr[1], tr[2], al]));
            }
        }
        // letters: sentence 2 where it is behind the star, sentence 1 where it is still ahead
        var str = [s1, s2], ws = [w1 * fit, w2 * fit], k, x, cw, mid, ty = Math.round(cy - fs * 0.62);
        for (k = 1; k >= 0; k--) {
            x = cx - ws[k] / 2;
            for (j = 0; j < str[k].length; j++) {
                cw = approxWidth(str[k].charAt(j), fs0) * fit;
                mid = x + cw / 2;
                if ((k === 1 && mid < xs - edge) || (k === 0 && mid > xs + edge)) { textAt(g, str[k].charAt(j), [tc[0], tc[1], tc[2], 1], Math.round(x), ty, f); }
                x += cw;
            }
        }
        var pts = sparkPoints(iconS * fit / 2, 7);
        g.newPath();
        for (i = 0; i < pts.length; i++) { if (i === 0) { g.moveTo(xs + pts[i][0], cy + pts[i][1]); } else { g.lineTo(xs + pts[i][0], cy + pts[i][1]); } }
        g.closePath();
        g.fillPath(brush(g, [ic[0], ic[1], ic[2], 1]));
    }

    feature("Text", "Text + Icon", function (p) {
        hint(p, "Type 2–6 words, choose where the icon goes, browse for your icon.");
        var sent = field(p, "Sentence:", getS("ti_sentence", "feature requests"), 24, "Your words. The icon is placed in the gap you choose below.");
        var where = drop(p, "Icon position:", ["…"], 0, "Where the icon sits in the sentence.");
        var look = hint(p, "");
        look.alignment = ["fill", "top"];

        // live picture of the finished line (words, icon slot, sparkle); it follows every field below
        var stage = p.add("group");
        stage.alignment = ["fill", "top"];
        stage.preferredSize = [200, 92];
        stage.onDraw = function () {
            if (!tcol || !icol) { return; }
            var ws = tiWords(sent.text), at = where.selection ? where.selection.index : 1;
            drawTiStage(this, { words: ws, at: Math.max(0, Math.min(ws.length, at)), size: num(size.text, 90, 12, 600), gap: num(gap.text, 0, -600, 1200),
                pct: num(pct.text, 100, 10, 500), textColor: tcol.get(), iconColor: icol.get() });
        };

        // icon file (browse) or the built-in sparkle
        var iconFile = null;
        var iconRow = row(p, "Icon:");
        var iconName = iconRow.add("statictext", undefined, "Built-in sparkle");
        iconName.preferredSize.width = 112;
        setFg(iconName, DS.label);
        var browseB = styleButton(iconRow.add("button", undefined, "Browse…"), "secondary", 26);
        browseB.preferredSize.width = 74;
        browseB.helpTip = "Choose your own icon: PNG, SVG, AI, PSD or JPG.";
        var sparkB = styleButton(iconRow.add("button", undefined, "Sparkle"), "secondary", 26);
        sparkB.preferredSize.width = 66;
        sparkB.helpTip = "Go back to the built-in sparkle.";

        function iconFilter() {
            try { if ($.os.indexOf("Windows") >= 0) { return "Images:*.png;*.svg;*.ai;*.psd;*.jpg;*.jpeg;*.gif;*.tif;*.tiff,All files:*.*"; } } catch (e) {}
            return function (f) { return (f instanceof Folder) || /\.(png|svg|ai|psd|jpe?g|gif|tiff?|eps)$/i.test(f.name); };
        }
        browseB.onClick = function () {
            var f = null;
            try { f = File.openDialog("Choose an icon (PNG, SVG, AI, PSD, JPG)", iconFilter()); } catch (e) {}
            if (f) { iconFile = f; iconName.text = f.name; putS("ti_icon", f.fsName); }
        };
        sparkB.onClick = function () { iconFile = null; iconName.text = "Built-in sparkle"; putS("ti_icon", ""); };
        var savedIcon = getS("ti_icon", "");
        if (savedIcon !== "") {
            try { var sf = new File(savedIcon); if (sf.exists) { iconFile = sf; iconName.text = sf.name; } } catch (e2) {}
        }

        // the position list follows the words you type
        function updateLine() {
            var words = tiWords(sent.text), at = where.selection ? where.selection.index : 1, out = [], i;
            for (i = 0; i <= words.length; i++) {
                if (i === at) { out.push("(icon)"); }
                if (i < words.length) { out.push(words[i]); }
            }
            look.text = "Preview:  " + out.join(" ");
            redraw(stage);
        }
        function refresh() {
            var labels = tiSlotLabels(tiWords(sent.text)), keep = where.selection ? where.selection.index : 1, i;
            where.removeAll();
            for (i = 0; i < labels.length; i++) { where.add("item", labels[i]); }
            if (labels.length > 0) { where.selection = Math.max(0, Math.min(keep, labels.length - 1)); }
            updateLine();
        }
        where.onChange = updateLine;
        sent.onChanging = refresh;
        sent.onChange = function () { putS("ti_sentence", sent.text); refresh(); };
        refresh();

        var tcol = colorChooser(p, "Text color:", style.textGray, "ti_text_color");
        var icol = colorChooser(p, "Icon color:", style.textGray, "ti_icon_color");
        var size = field(p, "Font size:", getS("ti_size", "90"), 4, "Text size in pixels.");
        size.onChange = function () { size.text = String(num(size.text, 90, 12, 600)); putS("ti_size", size.text); redraw(stage); };
        var pct = field(p, "Icon size (%):", "100", 4, "100% = the icon at its natural size for this text. Scale it freely afterwards.");
        pct.onChange = function () { redraw(stage); };
        tcol.onChange = function () { redraw(stage); };
        icol.onChange = function () { redraw(stage); };
        var gap = field(p, "Icon gap (px):", getS("ti_gap", "0"), 5, "Extra space between the two words around the icon. Positive = wider, negative = tighter. 0 = the natural gap. Undo and rebuild to change it.");
        gap.onChange = function () { gap.text = String(num(gap.text, 0, -600, 1200)); putS("ti_gap", gap.text); redraw(stage); };
        var len = field(p, "Length (s):", "4", 4, "How long the layers last from the playhead.");
        var hi = check(p, "Highlight words", false, "Optional colour sweep: each word goes lavender, then magenta, then back to its normal colour. Off keeps everything gray.");
        var step = field(p, "Highlight (s/word):", "1", 4, "How long each word keeps the highlight.");
        hint(p, "The icon is left still, so you can animate it yourself.");

        btn(p, "Build text + icon", function () {
            run("Text + icon", function () {
                doTextIcon({
                    sentence: sent.text, iconIndex: where.selection ? where.selection.index : 1, iconFile: iconFile,
                    size: num(size.text, 90, 12, 600), iconPct: num(pct.text, 100, 10, 500), gap: num(gap.text, 0, -600, 1200), length: num(len.text, 4, 0.5, 120),
                    textColor: tcol.get(), iconColor: icol.get(),
                    highlight: hi.value, step: num(step.text, 1, 0.3, 10)
                });
            });
        }, "Builds the words (sliding apart and growing), the icon slot and the highlight at the playhead.");
    });

    feature("Text", "Star Swipe", function (p) {
        hint(p, "An icon sweeps across sentence 1; sentence 2 appears in its wake.");
        var a = field(p, "First sentence:", getS("ss_first", "Give your users a place"), 24, "Shown at the start; the icon wipes it away.");
        var b = field(p, "Second sentence:", getS("ss_second", "to give feedback,"), 24, "Revealed behind the icon.");
        a.onChange = function () { putS("ss_first", a.text); redraw(stage); };
        b.onChange = function () { putS("ss_second", b.text); redraw(stage); };
        a.onChanging = function () { redraw(stage); };
        b.onChanging = function () { redraw(stage); };

        // picture of the sweep halfway through (second sentence behind the star, first ahead of it)
        var stage = p.add("group");
        stage.alignment = ["fill", "top"];
        stage.preferredSize = [200, 92];
        stage.onDraw = function () {
            if (!tcol || !icol || !trc || !size || !pct || !soft || !tr) { return; }
            drawSsStage(this, { first: a.text, second: b.text, size: num(size.text, 90, 12, 600), pct: num(pct.text, 100, 10, 500), soft: num(soft.text, 30, 0, 300),
                textColor: tcol.get(), iconColor: icol.get(), trail: tr.value, trailColor: trc.get() });
        };

        var iconFile = null;
        var iconRow = row(p, "Icon:");
        var iconName = iconRow.add("statictext", undefined, "Built-in sparkle");
        iconName.preferredSize.width = 112;
        setFg(iconName, DS.label);
        var browseB = styleButton(iconRow.add("button", undefined, "Choose…"), "secondary", 26);
        browseB.preferredSize.width = 74;
        browseB.helpTip = "Choose your own icon: PNG, SVG, AI, PSD or JPG.";
        var sparkB = styleButton(iconRow.add("button", undefined, "Star"), "secondary", 26);
        sparkB.preferredSize.width = 66;
        sparkB.helpTip = "Go back to the built-in star.";
        browseB.onClick = function () {
            var f = null;
            try {
                var flt = (function () {
                    try { if ($.os.indexOf("Windows") >= 0) { return "Images:*.png;*.svg;*.ai;*.psd;*.jpg;*.jpeg;*.gif;*.tif;*.tiff,All files:*.*"; } } catch (e) {}
                    return function (ff) { return (ff instanceof Folder) || /\.(png|svg|ai|psd|jpe?g|gif|tiff?|eps)$/i.test(ff.name); };
                })();
                f = File.openDialog("Choose an icon (PNG, SVG, AI, PSD, JPG)", flt);
            } catch (e2) {}
            if (f) { iconFile = f; iconName.text = f.name; }
        };
        sparkB.onClick = function () { iconFile = null; iconName.text = "Built-in sparkle"; };

        var tcol = colorChooser(p, "Sentence color:", style.textGray, "ss_text_color");
        var icol = colorChooser(p, "Star color:", style.textGray, "ss_icon_color");
        var tr = check(p, "Glow trail", true, "A soft glow that follows the icon and fades out.");
        var trc = colorChooser(p, "Trail color:", "#C158BE", "ss_trail_color");
        var size = field(p, "Font size:", getS("ss_size", "90"), 4, "Text size in pixels.");
        size.onChange = function () { size.text = String(num(size.text, 90, 12, 600)); putS("ss_size", size.text); redraw(stage); };
        var pct = field(p, "Star size (%):", "100", 4, "100% = the icon at its natural size for this text.");
        var hold = field(p, "Wait (s):", "0.4", 4, "How long the icon waits in front of sentence 1 before it moves.");
        var dur = field(p, "Sweep (s):", "0.8", 4, "How long the icon takes to cross the frame.");
        var soft = field(p, "Edge softness (px):", "30", 4, "Softness of the wipe edge.");
        soft.onChange = function () { redraw(stage); };
        pct.onChange = function () { redraw(stage); };
        tcol.onChange = function () { redraw(stage); };
        icol.onChange = function () { redraw(stage); };
        trc.onChange = function () { redraw(stage); };
        tr.onToggle = function () { redraw(stage); };
        var spin = check(p, "Spin the icon", true, "Half a turn while it sweeps.");
        var len = field(p, "Length (s):", "5", 4, "How long the layers last from the playhead.");

        btn(p, "Build star swipe", function () {
            run("Star swipe", function () {
                doStarSwipe({
                    first: a.text, second: b.text, iconFile: iconFile, size: num(size.text, 90, 12, 600), iconPct: num(pct.text, 100, 10, 500),
                    textColor: tcol.get(), iconColor: icol.get(), trail: tr.value, trailColor: trc.get(),
                    hold: num(hold.text, 0.4, 0, 20), dur: num(dur.text, 0.8, 0.2, 10), softness: num(soft.text, 30, 0, 300),
                    spin: spin.value, length: num(len.text, 5, 0.5, 120)
                });
            });
        }, "Builds both sentences, the wipe, the glow trail and the icon at the playhead. Everything follows one Move null.");
    }, "Text + Icon");

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
                    var c = chooseColor(colorTitle(label), hexToRgb(e.text));
                    if (c) {
                        e.text = rgbToHex(c);
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

        // ---- layout: icon rail on the left, chips + feature card on the right ----
        var body = win.add("group");
        body.orientation = "row";
        body.alignChildren = ["left", "top"];
        body.alignment = ["fill", "top"];
        body.spacing = 10;

        var nav = card(body, "", 0);
        nav.alignment = ["left", "top"];
        nav.alignChildren = ["center", "top"];
        nav.margins = [6, 6, 6, 6];
        nav.spacing = 2;
        var tiles = [];
        for (i = 0; i < groups.length; i++) {
            tiles.push(navTile(nav, groups[i], function (gName) { pickGroup(gName, null); }));
        }

        var main = body.add("group");
        main.orientation = "column";
        main.alignChildren = ["fill", "top"];
        main.alignment = ["fill", "top"];
        main.spacing = 10;

        // ---- feature chips (only for groups with several features) ----
        var chips = main.add("group");
        chips.orientation = "column";
        chips.alignChildren = ["fill", "top"];
        chips.spacing = 6;

        // ---- feature cards (stacked, one visible) ----
        var stack = main.add("group");
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
            var names = [], kids = {}, k, parentOf = "";
            for (k = 0; k < FEATURES.length; k++) {
                if (FEATURES[k].group !== groupName) { continue; }
                if (FEATURES[k].parent !== "") {
                    kids[FEATURES[k].parent] = kids[FEATURES[k].parent] || [];
                    kids[FEATURES[k].parent].push(FEATURES[k].name);
                    if (FEATURES[k].name === featName) { parentOf = FEATURES[k].parent; }
                } else { names.push(FEATURES[k].name); }
            }
            var activeTop = parentOf !== "" ? parentOf : featName;
            // groups with named sub-groups (Text > Motion) always show their chip row, even with one sub-group
            var single = names.length <= 1 && !SUBGROUP_CHIPS[groupName];
            chips.visible = !single;
            chips.maximumSize.height = single ? 0 : 1000;
            if (single) { return; }
            var subRows = {};
            function chipRow(list, active, onPick, store) {
                var rr = null, mine = [], n;
                for (n = 0; n < list.length; n++) {
                    if (n % 3 === 0) {
                        rr = (store || chips).add("group");
                        rr.orientation = "row";
                        rr.alignChildren = ["fill", "center"];
                        rr.spacing = 6;
                    }
                    (function (nm) {
                        var c = styleButton(rr.add("button", undefined, nm), nm === active ? "chip-on" : "chip", 28);
                        c.preferredSize.width = 80;
                        c.baseText = nm;
                        if (CLASSIC && nm === active) { c.text = "● " + nm; }
                        c.onClick = function () {
                            for (var q = 0; q < mine.length; q++) {
                                mine[q].variant = (mine[q] === c) ? "chip-on" : "chip";
                                if (CLASSIC) { mine[q].text = (mine[q] === c ? "● " : "") + mine[q].baseText; }
                                else { repaint(mine[q]); }
                            }
                            onPick(nm);
                        };
                        mine.push(c);
                    })(list[n]);
                }
                return mine;
            }
            // top row: features without a parent; a chip that has children opens a second row under it
            chipRow(names, activeTop, function (nm) {
                for (var pn in subRows) { if (subRows.hasOwnProperty(pn)) { subRows[pn].visible = (pn === nm); subRows[pn].maximumSize.height = (pn === nm) ? 1000 : 0; } }
                showFeature(groupName, nm);
            });
            for (var pn2 in kids) {
                if (!kids.hasOwnProperty(pn2)) { continue; }
                var holder = chips.add("group");
                holder.orientation = "column";
                holder.alignChildren = ["fill", "center"];
                holder.spacing = 6;
                // a thin divider (empty leaf group, so custom drawing is safe) between the main chips and the sub chips
                var rule = holder.add("group");
                rule.alignment = ["fill", "top"];
                rule.preferredSize = [100, 9];
                rule.onDraw = function () {
                    var g = this.graphics, w = this.size ? this.size.width : 100;
                    rrPath(g, 2, 3, Math.max(4, w - 4), 2, 1);
                    g.fillPath(brush(g, DS.border));
                };
                chipRow([pn2].concat(kids[pn2]), featName, function (nm) { showFeature(groupName, nm); }, holder);
                holder.visible = (pn2 === activeTop);
                holder.maximumSize.height = (pn2 === activeTop) ? 1000 : 0;
                subRows[pn2] = holder;
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
