/* Ru Motion — CEP panel front end.
   The ExtendScript side (jsx/RuMotion.jsx, loaded in "bridge mode") builds the real panel controls on a window that is never shown
   and describes every card as JSON. This file draws those cards as HTML and sends edits and clicks back, so every effect is the same
   code as the ScriptUI panel. */
(function () {
  "use strict";

  /*__ICONS__*/

  var GROUP_ORDER = ["Layers & Timing", "Animate", "Text", "Transitions", "Build", "Camera", "Flow", "Style"];
  var FLOW_PRESETS = {
    linear: [0, 0, 1, 1], easeIn: [.42, 0, 1, 1], easeOut: [0, 0, .58, 1], ease: [.25, .1, .25, 1],
    sineIn: [.12, 0, .39, 0], sineOut: [.61, 1, .88, 1], sine: [.37, 0, .63, 1],
    quadIn: [.11, 0, .5, 0], quadOut: [.5, 1, .89, 1], quad: [.45, 0, .55, 1],
    cubicIn: [.32, 0, .67, 0], cubicOut: [.33, 1, .68, 1], cubic: [.66, 0, .34, 1],
    quartIn: [.5, 0, .75, 0], quartOut: [.25, 1, .5, 1], quart: [.76, 0, .24, 1],
    quintIn: [.64, 0, .78, 0], quintOut: [.22, 1, .36, 1], quint: [.83, 0, .17, 1],
    expoIn: [.7, 0, .84, 0], expoOut: [.16, 1, .3, 1], expo: [.87, 0, .13, 1],
    circIn: [.55, 0, 1, .45], circOut: [0, .55, .45, 1], circ: [.85, 0, .15, 1],
    backIn: [.36, 0, .66, -.56], backOut: [.34, 1.56, .64, 1], back: [.68, -.6, .32, 1.6]
  };

  var root = document.documentElement;
  root.setAttribute("data-theme", "dark");

  // ---------- helpers ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var toastEl = document.getElementById("toast"), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }
  function store(k, d) { try { var v = localStorage.getItem("ru:" + k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem("ru:" + k, v); } catch (e) {} }

  // ---------- talking to After Effects ----------
  var cep = window.__adobe_cep__;
  function esc(s) {   // a JS string literal that survives evalScript (ASCII only)
    return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")
      .replace(/[\u0080-￿]/g, function (c) { return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4); }) + '"';
  }
  function ev(script, cb) {
    if (!cep) { cb("EvalScript error: not running inside After Effects"); return; }
    try { cep.evalScript(script, function (r) { cb(r); }); } catch (e) { cb("EvalScript error: " + e); }
  }
  function extFolder() {
    var u = decodeURI(cep.getSystemPath("extension")).replace(/^file:\/\//, "");
    if (/^\/[A-Za-z]:/.test(u)) u = u.slice(1);
    return u;
  }
  function loadHost(done) {
    if (!cep) { done(false, "This panel only runs inside After Effects."); return; }
    var code = "(function(){ try { if ($.global.RuBridge) { return 'ok'; } $.global.RuMotionBridge = true;" +
      " $.evalFile(new File(" + esc(extFolder() + "/jsx/RuMotion.jsx") + ")); $.global.RuMotionBridge = false;" +
      " return $.global.RuBridge ? 'ok' : 'The script loaded but did not start.'; } catch (e) { $.global.RuMotionBridge = false; return 'Error: ' + e + (e.line ? ' (line ' + e.line + ')' : ''); } })()";
    ev(code, function (r) { done(r === "ok", r); });
  }
  function bridge(call, cb) { ev("$.global.RuBridge." + call, function (r) { cb(r); }); }

  // ---------- rendering the described cards ----------
  var ctlMap = {};   // control id -> { item, node }
  var curFeature = -1;

  function isHex(v) { return /^#[0-9a-fA-F]{6}$/.test(String(v)); }

  function sendSet(item, value, after) {
    bridge("set(" + item.id + "," + esc(value) + ")", function (r) {
      if (r !== "ok") { toast(String(r).slice(0, 120)); }
      refresh(); if (after) after();
    });
  }

  function makeItem(item, ctx) {
    var n, k;
    if (item.k === "f") {
      n = el("input", { type: /\bkey\b/i.test(item.label || "") ? "password" : "text", value: item.v, title: item.tip || "", "aria-label": item.label || "value" });
      n.style.width = (String(item.v).length > 12 || /\bkey\b/i.test(item.label || "") ? "100%" : String(item.v).length <= 5 && ctx.small ? "60px" : "72px");
      if (isHex(item.v)) { n.style.width = "84px"; }
      n.addEventListener("change", function () { sendSet(item, n.value); });
      n.addEventListener("keydown", function (e) { if (e.key === "Enter") { n.blur(); } });
      ctlMap[item.id] = { item: item, node: n };
      if (isHex(item.v)) {
        var sw = el("input", { type: "color", value: item.v, class: "swatch", title: "Choose a color", style: "position:static;opacity:1;pointer-events:auto;padding:0;border:1px solid var(--hairline);border-radius:6px;background:none;width:32px;height:26px;cursor:pointer;flex:none" });
        sw.addEventListener("change", function () { n.value = sw.value.toUpperCase(); sendSet(item, n.value); });
        ctx.hex = true;
        ctlMap[item.id].swatch = sw;
        return [sw, n];
      }
      return [n];
    }
    if (item.k === "d") {
      n = el("select", { title: item.tip || "", "aria-label": item.label || "choice" });
      item.items.forEach(function (t, i) { var o = el("option", { value: String(i), text: t }); if (i === item.sel) o.selected = true; n.appendChild(o); });
      n.addEventListener("change", function () { sendSet(item, n.value); });
      ctlMap[item.id] = { item: item, node: n };
      return [n];
    }
    if (item.k === "t") {
      n = el("button", { class: "toggle", type: "button", role: "switch", "aria-checked": String(!!item.v), title: item.tip || "" },
        [el("span", { class: "track", "aria-hidden": "true" }), el("span", { text: item.text })]);
      n.addEventListener("click", function () { sendSet(item, n.getAttribute("aria-checked") !== "true"); });
      ctlMap[item.id] = { item: item, node: n };
      return [n];
    }
    // button
    if (item.a) {   // an action the panel runs itself (transcription), with a status line under the button
      n = el("button", { class: "btn primary", type: "button", text: item.text, title: item.tip || "" });
      n._status = el("div", { class: "cap-status", hidden: "" }, [el("div", { class: "bar" }, [el("i")]), el("p", { class: "hint", text: "" })]);
      n._label = item.text;
      n.addEventListener("click", function () { runAction(item, n); });
      actionNodes.push(n);
      ctlMap[item.id] = { item: item, node: n };
      return [n];
    }
    k = item.text;
    if (ctx.flow && FLOW_PRESETS[k]) {
      var cv = el("canvas", { width: 80, height: 76 });
      n = el("button", { class: "flow-tile", type: "button", "aria-pressed": String(item.v === "primary"), title: k }, [cv, el("span", { text: k })]);
      drawCurve(cv, FLOW_PRESETS[k], false);
      n.addEventListener("click", function () { press(item, n); });
      ctlMap[item.id] = { item: item, node: n };
      return [n];
    }
    if (ctx.hexRow && /^Pick/.test(k)) { return []; }   // the colour swatch replaces the Pick… button
    n = el("button", { class: "btn" + (item.v === "primary" ? " primary" : ""), type: "button", text: item.text, title: item.tip || "" });
    n.addEventListener("click", function () { press(item, n); });
    ctlMap[item.id] = { item: item, node: n };
    return [n];
  }

  function press(item, node) {
    node.classList.add("busy");
    bridge("click(" + item.id + ")", function (r) {
      node.classList.remove("busy");
      toast(r === "ok" ? (item.text + " — done.") : String(r).slice(0, 140));
      refresh();
    });
  }

  // ---------- transcription (runs in this panel; After Effects only supplies the layer and receives the captions) ----------
  var running = null, actionNodes = [];
  function setStatus(node, msg, frac, kind) {
    var st = node._status, bar;
    if (!st) { return; }
    bar = st.firstChild;
    st.hidden = false;
    bar.classList.toggle("ind", frac === null);
    bar.firstChild.style.width = (frac === null || frac === undefined) ? "" : Math.round(frac * 100) + "%";
    st.lastChild.textContent = msg;
    st.classList.toggle("err", kind === "err");
  }
  function lockOthers(except, on) {   // only one transcript at a time: the other transcript buttons wait
    actionNodes.forEach(function (n) { if (n !== except && n.isConnected !== false) { n.disabled = on; n.style.opacity = on ? ".45" : ""; } });
  }
  function finish(node, msg, isErr) {
    running = null;
    node.textContent = node._label;
    node.classList.add("primary");
    lockOthers(node, false);
    setStatus(node, msg, isErr ? 0 : 1, isErr ? "err" : "");
    toast(isErr ? "Transcript: " + msg.slice(0, 80) : msg);
  }
  function runAction(item, node) {
    var m = /^transcribe-(en|si)$/.exec(item.a || "");
    if (!m) { return; }
    var lang = m[1];
    if (running) { running.cancel(); return; }   // while it works, the button is Cancel
    var T = window.RuTranscribe;
    if (!T || !T.available()) { setStatus(node, "This panel cannot use Node.js yet. Run the latest installer and restart After Effects.", 0, "err"); return; }
    node._label = item.text;
    node.textContent = "Cancel";
    node.classList.remove("primary");
    lockOthers(node, true);
    setStatus(node, "Looking at the selected layer…", null);
    bridge("captionSource()", function (r) {
      var src;
      try { src = JSON.parse(r); } catch (e) { src = { error: "Could not read the selected layer: " + String(r).slice(0, 120) }; }
      if (src.error) { finish(node, src.error, true); return; }
      function done(segs) {
        if (!segs.length) { finish(node, "No speech was found in that layer.", true); return; }
        setStatus(node, "Adding " + segs.length + " captions…", null);
        bridge("captionBuild(" + esc(JSON.stringify({ layerIndex: src.index, layerName: src.name, lang: lang, segments: segs })) + ")", function (res) {
          var d;
          try { d = JSON.parse(res); } catch (e2) { d = { error: String(res).slice(0, 120) }; }
          if (d.error) { finish(node, d.error, true); return; }
          var base = "Added " + d.made + " captions" + (d.skipped ? " (" + d.skipped + " fell outside the layer)" : "") + ".";
          if (lang === "si" && !(T.hasSinhala && T.hasSinhala(segs))) { finish(node, base + " None of the lines contains Sinhala letters. Check that the layer really has Sinhala speech.", true); }
          else { finish(node, base + (lang === "si" ? " Check every line: speech recognition makes mistakes." : " Look for layers named Ru Caption."), false); }
        });
      }
      function fail(e3) { finish(node, e3.cancelled ? "Cancelled." : (e3.message || String(e3)), !e3.cancelled); }
      if (lang === "si") {   // Sinhala: Google Speech-to-Text with the user's key
        bridge("captionGoogleKey()", function (kr) {
          var key = String(kr || "").replace(/\s+/g, "");
          if (!key || /^EvalScript/.test(key)) { finish(node, "Enter your Google API key in the Sinhala (Google) section first.", true); return; }
          try { running = T.transcribeGoogle({ file: src.path, lang: "si", apiKey: key, onStatus: function (msg, f) { setStatus(node, msg, f); } }); } catch (e4) { fail(e4); return; }
          running.promise.then(done, fail);
        });
        return;
      }
      bridge("captionModel(" + esc(lang) + ")", function (mr) {
        var model = String(mr).replace(/[^a-z.]/g, "") || "base.en";
        try {
          running = T.transcribe({ file: src.path, model: model, lang: lang, enginePath: store("whisper_path", ""), onStatus: function (msg, f) { setStatus(node, msg, f); } });
        } catch (e1) { fail(e1); return; }
        running.promise.then(done, fail);
      });
    });
  }

  function drawCurve(canvas, c, big) {
    var d = window.devicePixelRatio || 1, w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (big) { canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); }
    var g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    var pad = W * 0.14, x0 = pad, x1 = W - pad, y0 = H * 0.78, y1 = H * 0.18, i, t, u, px, py;
    var color = getComputedStyle(root).getPropertyValue("--text").trim() || "#fff";
    g.strokeStyle = "rgba(150,150,160,.5)"; g.lineWidth = Math.max(1, W / 80);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = color; g.lineWidth = Math.max(2, W / 40); g.lineCap = "round"; g.beginPath();
    for (i = 0; i <= 28; i++) {
      t = i / 28; u = 1 - t;
      px = 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t;
      py = 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t;
      if (i === 0) g.moveTo(x0 + px * (x1 - x0), y0 + py * (y1 - y0)); else g.lineTo(x0 + px * (x1 - x0), y0 + py * (y1 - y0));
    }
    g.stroke();
  }

  function renderKids(card, parent, ctx) {
    card.kids.forEach(function (k) {
      if (k.t === "hint") { parent.appendChild(el("p", { class: "hint", text: k.text })); return; }
      if (k.t === "card") {
        var sub = el("div", { class: "card" }, [el("h3", { text: k.card.title })]);
        var c2 = { flow: ctx.flow };
        renderKids(k.card, sub, c2);
        parent.appendChild(sub);
        return;
      }
      if (k.t === "btns") {
        var g = el("div", { class: "btns" + (k.items.length === 1 ? " one" : "") });
        if (k.items.length > 2 && k.items.length <= 4) { g.style.gridTemplateColumns = "repeat(" + k.items.length + ", 1fr)"; }
        k.items.forEach(function (it) { makeItem(it, ctx).forEach(function (n) { g.appendChild(n); }); });
        parent.appendChild(g);
        return;
      }
      // row
      var items = k.items, first = items[0];
      if (items.length === 1 && first.k === "t") { parent.appendChild(makeItem(first, ctx)[0]); return; }
      if (items.length === 1 && first.k === "b") {
        var one = makeItem(first, ctx);
        parent.appendChild(el("div", { class: "btns one" }, one));
        if (one[0] && one[0]._status) { parent.appendChild(one[0]._status); }
        return;
      }
      var flowGrid = ctx.flow && items.length > 1 && items.every(function (it) { return it.k === "b" && FLOW_PRESETS[it.text]; });
      if (flowGrid) {
        var gr = el("div", { class: "flow-grid" });
        items.forEach(function (it) { makeItem(it, ctx).forEach(function (n) { gr.appendChild(n); }); });
        parent.appendChild(gr);
        return;
      }
      var fields = items.filter(function (it) { return it.k === "f"; });
      if (ctx.flow && fields.length === 4 && /Curve/.test(first.label || "")) {
        var cv = el("canvas", { class: "flow-graph", "aria-label": "Easing curve" });
        parent.appendChild(cv);
        ctx.graph = { canvas: cv, ids: fields.map(function (f) { return f.id; }) };
      }
      if (items.length > 1 && items.every(function (it) { return it.k === "b"; }) && !first.label) {
        var bg = el("div", { class: "btns" });
        bg.style.gridTemplateColumns = "repeat(" + items.length + ", 1fr)";
        items.forEach(function (it) { makeItem(it, ctx).forEach(function (n) { bg.appendChild(n); }); });
        parent.appendChild(bg);
        return;
      }
      var hexRow = items.some(function (it) { return it.k === "f" && isHex(it.v); });
      var ctl = el("div", { class: "ctl" });
      var rctx = { flow: ctx.flow, hexRow: hexRow, small: fields.length >= 3 };
      items.forEach(function (it, i) {
        if (i > 0 && it.label) { ctl.appendChild(el("span", { class: "lbl", text: it.label, style: "color:var(--label);font-size:12px" })); }
        makeItem(it, rctx).forEach(function (n) { ctl.appendChild(n); });
      });
      if (!ctl.childNodes.length) { return; }
      if (!first.label) {
        [].forEach.call(ctl.querySelectorAll(".btn"), function (b) { b.style.width = "auto"; b.style.padding = "0 14px"; b.style.whiteSpace = "nowrap"; });
        [].forEach.call(ctl.querySelectorAll("input[type=text]"), function (n) { n.style.flex = "none"; });
        var wide = el("div", { class: "row" }, [ctl]);
        wide.style.gridTemplateColumns = "1fr";
        parent.appendChild(wide);
        return;
      }
      parent.appendChild(el("div", { class: "row" }, [el("span", { class: "lbl", text: first.label || "" }), ctl]));
    });
  }

  var view = document.getElementById("view"), chips = document.getElementById("chips"), nav = document.getElementById("nav");
  var graphRef = null;

  function showFeature(i) {
    curFeature = i;
    bridge("feature(" + i + ")", function (r) {
      var data;
      try { data = JSON.parse(r); } catch (e) { data = null; }
      view.innerHTML = ""; ctlMap = {}; graphRef = null; actionNodes = [];
      if (!data) { view.appendChild(el("p", { class: "hint", text: "Could not read this card from After Effects: " + String(r).slice(0, 160) })); return; }
      view.appendChild(el("h2", { text: data.title }));
      var ctx = { flow: data.title === "Easing curves" };
      renderKids(data, view, ctx);
      if (ctx.graph) { graphRef = ctx.graph; drawGraph(); }
      put("feature", META.features[i].name);
    });
  }

  function drawGraph() {
    if (!graphRef) return;
    var v = graphRef.ids.map(function (id) { var m = ctlMap[id]; return m ? parseFloat(m.node.value) : 0; });
    if (v.some(isNaN)) return;
    drawCurve(graphRef.canvas, v, true);
  }

  // after a click or an edit, pull the current values back so clamped numbers, flipped toggles and new button states show
  var refreshing = false, again = false;
  function refresh() {
    if (curFeature < 0) return;
    if (refreshing) { again = true; return; }
    refreshing = true;
    bridge("feature(" + curFeature + ")", function (r) {
      refreshing = false;
      var data; try { data = JSON.parse(r); } catch (e) { return; }
      (function walk(card) {
        card.kids.forEach(function (k) {
          if (k.t === "card") { walk(k.card); return; }
          (k.items || []).forEach(function (it) {
            var m = ctlMap[it.id]; if (!m) return;
            if (it.k === "f") { if (document.activeElement !== m.node) { m.node.value = it.v; } if (m.swatch && isHex(it.v)) m.swatch.value = it.v; }
            else if (it.k === "d") { m.node.value = String(it.sel); }
            else if (it.k === "t") { m.node.setAttribute("aria-checked", String(!!it.v)); }
            else if (it.k === "b") {
              if (m.node.classList.contains("flow-tile")) { m.node.setAttribute("aria-pressed", String(it.v === "primary")); }
              else { m.node.classList.toggle("primary", it.v === "primary"); if (m.node.textContent !== it.text) m.node.textContent = it.text; }
            }
          });
        });
      })(data);
      drawGraph();
      if (again) { again = false; refresh(); }
    });
  }

  // ---------- tabs and chips ----------
  var META = null, groups = [], curGroup = "";
  function rank(list, n) { var i = list.indexOf(n); return i < 0 ? list.length : i; }
  function featuresOf(g) { return META.features.filter(function (f) { return f.group === g; }); }

  function pick(g, featName) {
    curGroup = g;
    var all = featuresOf(g), list = all.filter(function (x) { return !x.parent; });
    var f = all.filter(function (x) { return x.name === featName; })[0] || list[0];
    var top = f.parent || f.name, kids = all.filter(function (x) { return x.parent === top; });
    [].forEach.call(nav.children, function (t) { t.setAttribute("aria-selected", String(t.dataset.group === g)); });
    chips.innerHTML = "";
    chips.hidden = list.length <= 1 && g !== "Text";
    if (!chips.hidden) {
      list.forEach(function (x) {
        chips.appendChild(el("button", { class: "chip", type: "button", role: "tab", text: x.name, title: x.name, "aria-selected": String(x.name === top), onclick: function () { pick(g, x.name); } }));
      });
      if (kids.length) {
        var sub = el("div", { class: "chips", style: "grid-column:1/-1;margin-top:4px;padding-top:10px;border-top:1px solid var(--hairline)" });
        [top].concat(kids.map(function (k) { return k.name; })).forEach(function (nm) {
          sub.appendChild(el("button", { class: "chip", type: "button", role: "tab", text: nm, title: nm, "aria-selected": String(nm === f.name), onclick: function () { pick(g, nm); } }));
        });
        chips.appendChild(sub);
      }
    }
    showFeature(f.i);
  }

  function start() {
    var labels = { "Layers & Timing": "Layers" };
    META.features.forEach(function (f) { if (groups.indexOf(f.group) < 0) groups.push(f.group); });
    groups.sort(function (a, b) { return rank(GROUP_ORDER, a) - rank(GROUP_ORDER, b); });
    groups.forEach(function (g) {
      nav.appendChild(el("button", {
        class: "tab", type: "button", role: "tab", "aria-selected": "false", title: g,
        onclick: function () { pick(g, ""); }
      }));
      var t = nav.lastChild;
      t.dataset.group = g;
      t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[g] || "") + "</svg><span>" + (labels[g] || g) + "</span>";
    });
    pick(groups[0], "");
  }

  [].forEach.call(document.querySelectorAll("#cutbar .btn"), function (b, n) {
    b.addEventListener("click", function () {
      bridge("cut(" + n + ")", function (r) { toast(r === "ok" ? b.getAttribute("data-cut") + " applied at the playhead." : String(r).slice(0, 140)); });
    });
  });

  // ---------- About: once on the first run, then from the About button ----------
  (function () {
    var ov = document.getElementById("aboutOv");
    function show() { ov.classList.add("show"); }
    function hide() { ov.classList.remove("show"); }
    document.getElementById("aboutBtn").addEventListener("click", show);
    document.getElementById("aboutGo").addEventListener("click", hide);
    ov.addEventListener("click", function (e) { if (e.target === ov) { hide(); } });
    if (store("about_seen", "") !== "1") { put("about_seen", "1"); show(); }
  })();

  // ---------- go ----------
  view.appendChild(el("p", { class: "hint", text: "Starting Ru Motion…" }));
  loadHost(function (ok, msg) {
    if (!ok) { view.innerHTML = ""; view.appendChild(el("p", { class: "hint", text: String(msg) })); return; }
    bridge("meta()", function (r) {
      try { META = JSON.parse(r); } catch (e) { view.innerHTML = ""; view.appendChild(el("p", { class: "hint", text: "Could not start: " + String(r).slice(0, 200) })); return; }
      start();
    });
  });
  window.addEventListener("resize", drawGraph);
})();
