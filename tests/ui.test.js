const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'RupaMotion.jsx'), 'utf8');
let drawCalls = 0, strings = [];
function gfx() {
  return {
    BrushType:{SOLID_COLOR:1}, PenType:{SOLID_COLOR:1},
    newBrush:(t,c)=>{ if(!Array.isArray(c)||c.length!==4) throw new Error('bad brush color'); return {c}; },
    newPen:(t,c,w)=>{ if(!Array.isArray(c)||c.length!==4) throw new Error('bad pen color'); return {c,w}; },
    newPath(){}, moveTo(x,y){ if(isNaN(x)||isNaN(y)) throw new Error('NaN moveTo'); }, lineTo(x,y){ if(isNaN(x)||isNaN(y)) throw new Error('NaN lineTo'); },
    closePath(){}, ellipsePath(){}, rectPath(){}, fillPath(b){ if(!b) throw new Error('no brush'); drawCalls++; }, strokePath(p){ if(!p) throw new Error('no pen'); drawCalls++; },
    drawString(s,p,x,y,f){ if(isNaN(x)||isNaN(y)) throw new Error('NaN text pos'); strings.push(s); }, measureString(s){ return [String(s).length*6.5, 14]; },
    foregroundColor:null, backgroundColor:null, font:null
  };
}
function el(type, text) {
  const o = { type, text: text||'', children: [], items: [], visible: true, size:[300,32],
    preferredSize:{width:0,height:0}, maximumSize:{width:0,height:0}, graphics: gfx(), layout:{layout(){},resize(){}},
    add(t,b,txt){ if(t==='item'){ const it={text:b,index:this.items.length}; this.items.push(it); return it; }
      const c = el(t, Array.isArray(txt)?'':txt); c.parent=this; if(t==='dropdownlist'&&Array.isArray(txt)) txt.forEach(s=>c.add('item',s)); this.children.push(c); return c; },
    remove(x){ const i = this.children.indexOf(x); if (i>=0) this.children.splice(i,1); },
    addEventListener(t,f){ (this.listeners=this.listeners||{})[t]=f; }, notify(n){ if(n==='onDraw'&&this.onDraw) this.onDraw(); },
    removeAll(){ this.items=[]; }, hide(){ this.visible=false; }, show(){ this.visible=true; }, center(){}, close(){}
  };
  Object.defineProperty(o,'selection',{get(){return this._sel||null;},set(v){const it=(typeof v==='number')?this.items[v]:v;this._sel=it||null;if(this.onChange)this.onChange();}});
  return o;
}
function FakeFile0(p) { this.path = p; this.data = ''; }
FakeFile0.written = [];
FakeFile0.prototype.open = function () { return true; }; FakeFile0.prototype.write = function (d) { this.data += d; };
FakeFile0.prototype.close = function () {}; FakeFile0.prototype.remove = function () { return true; };
const settings = {}; let scheduled = null;
const $g = { global: {}, colorPicker: ()=>-1 };
const app = { settings:{haveSetting:(s,k)=>(s+k) in settings,getSetting:(s,k)=>settings[s+k],saveSetting:(s,k,v)=>{settings[s+k]=v;}},
  project:{activeItem:null}, fonts:null, beginUndoGroup(){}, endUndoGroup(){}, scheduleTask(code){ scheduled = code; } };
function Panel(){}; let lastWin = null; function Window(){ lastWin = el('window'); return lastWin; }
const g = { File: FakeFile0, Folder: { temp: { fsName: '/tmp' } }, app, Panel, Window, $: $g, alert: ()=>{}, ScriptUI: { newFont:(f,s,z)=>({f,s,z}) },
  CompItem:function(){}, FootageItem:function(){}, AVLayer:function(){}, ShapeLayer:function(){}, TextLayer:function(){},
  CameraLayer:function(){}, LightLayer:function(){}, Shape:function(){}, KeyframeEase:function(sp,inf){ this.speed=sp; this.influence=inf; }, KeyframeInterpolationType:{LINEAR:'L',BEZIER:'B'},
  PropertyType:{PROPERTY:1}, MarkerValue:function(){}, TrackMatteType:{}, BlendingMode:{}, ParagraphJustification:{}, AutoOrientType:{} };
const run = new Function(...Object.keys(g), 'thisObj', src.replace(/\}\)\(this\);\s*$/, '})(thisObj);'));
const root = Object.assign(new Panel(), el('panel','root'));
run(...Object.values(g), root);

const walk = (n, out=[]) => { out.push(n); n.children.forEach(c=>walk(c,out)); return out; };
function drawAll() { let errs = 0; walk(root).forEach(n => { if (n.onDraw) { try { n.onDraw(); } catch(e) { errs++; console.log('DRAW ERROR', n.type, n.text, e.message); } } }); return errs; }

function report(label) {
  drawCalls = 0; strings = [];
  const errs = drawAll();
  const all = walk(root);
  const tiles = all.filter(n => n.groupName);
  const chips = all.filter(n => n.variant === 'chip' || n.variant === 'chip-on');
  const toggles = all.filter(n => n.type==='button' && typeof n.value === 'boolean');
  const visible = all.filter(n => n.cardLevel === 0 && n.cardTitle && n.visible).map(n=>n.cardTitle);
  const bad = all.filter(n => n.onDraw && n.children.length > 0);
  console.log(`[${label}] containers that draw AND hold controls (must be 0): ${bad.length}`);
  console.log(`[${label}] draw routines OK (errors: ${errs}) | fills+strokes: ${drawCalls} | nav tiles: ${tiles.length} | toggles: ${toggles.length} | chips: ${chips.length} | visible card: ${visible}`);
  return {tiles, chips, toggles, all};
}

let r = report('dark');
console.log('bg color set:', JSON.stringify(root.graphics.backgroundColor && root.graphics.backgroundColor.c));
// click every nav tile, then every chip inside, verify the right card shows
let ok = 0, total = 0;
r.tiles.forEach(t => {
  t.onClick();
  const all = walk(root);
  const chips = all.filter(n => n.variant === 'chip' || n.variant === 'chip-on');
  const names = chips.length ? chips : [null];
  names.forEach(c => {
    if (c) c.onClick();
    total++;
    const vis = all.filter(n => n.cardLevel === 0 && n.cardTitle && n.visible).map(n=>n.cardTitle);
    const active = walk(root).filter(n => n.groupName && n.active).map(n=>n.groupName);
    if (vis.length === 1 && active.length === 1 && active[0] === t.groupName) ok++;
  });
});
console.log(`navigation: ${ok}/${total} feature views correct`);
const tg = r.toggles[0]; const before = tg.value; tg.onClick(); console.log('toggle flips:', before, '->', tg.value);
const cards = walk(root).filter(n => n.cardTitle !== undefined && n.type==='group');
const withBg = cards.filter(n => n.graphics.backgroundColor);
console.log('cards:', cards.length, '| cards with solid background:', withBg.length, '| page bg:', JSON.stringify(root.graphics.backgroundColor.c));
console.log('header has Classic/Designed switch:', walk(root).some(n => /Classic UI|Designed UI/.test(n.text)), '| Style has theme switch:', walk(root).some(n => n.items && n.items.length===2 && n.items[0].text==='Light'));
let threw = 0; walk(root).filter(n => n.type==='button' && n.onClick && !n.groupName && !/Colors|Pick/.test(n.text)).forEach(b => { try { b.onClick(); } catch(e){ threw++; console.log('THREW', b.text, e.message);} });
console.log('buttons clicked without errors, threw:', threw);

// color picker: open it from the Solid Layer swatch, draw it, drag in the square, press OK
const sw = walk(root).filter(n => n.isSwatch)[0];
lastWin = null; sw.onClick();
const pw = lastWin; let pickerErrs = 0;
if (!pw) { console.log('color picker: no dialog opened'); }
else {
  const pn = walk(pw);
  pn.forEach(n => { if (n.onDraw) { try { n.onDraw(); } catch (e) { pickerErrs++; console.log('PICKER DRAW ERROR', e.message); } } });
  const square = pn.filter(n => n.listeners && n.listeners.mousedown)[0];
  const hexE = pn.filter(n => n.type === 'edittext').pop();
  const before = hexE.text;
  square.listeners.mousedown({ clientX: 40, clientY: 150 });
  square.listeners.mouseup({});
  const okB = pn.filter(n => n.type === 'button' && n.text === 'OK')[0];
  okB.onClick();
  console.log(`color picker: draw errors ${pickerErrs} | controls ${pn.length} | hex ${before} -> ${hexE.text} | OK closes: ${typeof okB.onClick === 'function'}`);
}

// click feedback: mouse down shows the pressed state, mouse up clears it, draw stays valid
const pb = walk(root).filter(n => n.type === 'button' && n.variant && n.listeners && n.listeners.mousedown)[0];
let pressErrs = 0;
pb.listeners.mousedown({}); const wasPressed = pb.pressed; try { pb.onDraw(); } catch (e) { pressErrs++; }
pb.listeners.mouseup({}); const after = pb.pressed;
console.log(`click effect: pressed on mousedown ${wasPressed}, cleared on mouseup ${!after}, draw errors ${pressErrs}`);

// Flow: apply every preset, repeatedly and in different orders, to a fake 3-key property and check that
// the ease After Effects stores reproduces each curve. The fake enforces the AE rule that keys with
// "continuous" or "auto bezier" on cannot have different in/out speeds (it throws, like the real API can).
function fakeKeyProp(times, values) {
  const keys = times.map((t, i) => ({ t, v: values[i], in: [new g.KeyframeEase(0, 16.67)], out: [new g.KeyframeEase(0, 16.67)],
    inT: 'L', outT: 'L', cont: true, auto: false }));
  const P = { propertyType: 1, numKeys: keys.length, keys, expression: '', selectedKeys: keys.map((k, i) => i + 1),
    keyTime: i => keys[i - 1].t, keyValue: i => keys[i - 1].v,
    keyInTemporalEase: i => keys[i - 1].in, keyOutTemporalEase: i => keys[i - 1].out,
    keyInInterpolationType: i => keys[i - 1].inT, keyOutInterpolationType: i => keys[i - 1].outT,
    setInterpolationTypeAtKey(i, a, b) { keys[i - 1].inT = a; keys[i - 1].outT = b; },
    setTemporalContinuousAtKey(i, v) { keys[i - 1].cont = v; }, setTemporalAutoBezierAtKey(i, v) { keys[i - 1].auto = v; },
    setTemporalEaseAtKey(i, inn, out) {
      const k = keys[i - 1];
      if ((k.cont || k.auto) && Math.abs(inn[0].speed - out[0].speed) > 1e-9) throw new Error('speeds must match while continuous/auto bezier is on');
      k.in = inn; k.out = out;
    } };
  return P;
}
function applyOn(prop, name) {
  const comp = new g.CompItem(); comp.selectedLayers = [{ selectedProperties: [prop], property() {} }];
  app.project.activeItem = comp;
  walk(root).filter(n => n.modeId === 'both')[0].onClick();
  walk(root).filter(n => n.presetIndex !== undefined && n.text === name)[0].onClick();
  walk(root).filter(n => n.type === 'button' && n.text === 'Apply')[0].onClick();
  app.project.activeItem = null;
}
function segCurve(P, a, b) {
  const dv = P.keys[b - 1].v - P.keys[a - 1].v, dt = P.keys[b - 1].t - P.keys[a - 1].t, o = P.keys[a - 1].out[0], n = P.keys[b - 1].in[0];
  const x1 = o.influence / 100, x2 = 1 - n.influence / 100;
  return [x1, o.speed * x1 * dt / dv, x2, 1 - n.speed * (n.influence / 100) * dt / dv];
}
const presetData = {}; walk(root).filter(n => n.presetIndex !== undefined).forEach(n => { presetData[n.text] = n.curve; });
const names = Object.keys(presetData);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const order = names.concat(names.slice().reverse(), names.slice().sort(() => rnd() - 0.5));
const FP = fakeKeyProp([0, 1, 3], [0, 100, 40]);
let applied = 0, wrong = 0;
order.forEach(nm => {
  applyOn(FP, nm); applied++;
  const want = nm === 'linear' ? [1 / 3, 1 / 3, 2 / 3, 2 / 3] : presetData[nm];   // linear = bezier handles on the straight line
  [[1, 2], [2, 3]].forEach(([a, b]) => {
    const got = segCurve(FP, a, b), w = [Math.max(want[0], 0.001), want[1], Math.min(want[2], 0.999), want[3]];
    if (!got.every((v, i) => Math.abs(v - w[i]) < 1e-6 * Math.max(1, Math.abs(w[i])))) { wrong++; console.log('FLOW MISMATCH', nm, 'seg', a + '-' + b, got.map(v => +v.toFixed(4)), 'want', w); }
  });
});
console.log(`flow easing: ${applied} applies in a row on one property (${names.length} curves x3), ${wrong} wrong`);

// Flow side modes: "out" touches only the outgoing side at the first key, "in" only the incoming side at the last key
function applyMode(prop, name, mode) {
  const comp = new g.CompItem(); comp.selectedLayers = [{ selectedProperties: [prop], property() {} }];
  app.project.activeItem = comp;
  walk(root).filter(n => n.modeId === mode)[0].onClick();
  walk(root).filter(n => n.presetIndex !== undefined && n.text === name)[0].onClick();
  walk(root).filter(n => n.type === 'button' && n.text === 'Apply')[0].onClick();
  app.project.activeItem = null;
}
const MP = fakeKeyProp([0, 2], [0, 100]);
applyMode(MP, 'cubic', 'both');
applyMode(MP, 'expoOut', 'out');
const outOk = Math.abs(MP.keys[0].out[0].influence - 16) < 1e-6 && Math.abs(MP.keys[1].in[0].influence - 66) < 1e-6; // out from expoOut, in still cubic (1-0.34)
applyMode(MP, 'backIn', 'in');
const inOk = Math.abs(MP.keys[1].in[0].influence - 34) < 1e-6 && Math.abs(MP.keys[0].out[0].influence - 16) < 1e-6; // in from backIn (1-0.66), out untouched
console.log(`flow modes: out-only ${outOk}, in-only ${inOk}`);

// Flow bounce: toggle on/off with a %, never touches a user's own expression
function applyFlow(prop, name, opts) {
  const comp = new g.CompItem(); comp.selectedLayers = [{ selectedProperties: [prop], property() {} }];
  app.project.activeItem = comp;
  const tog = walk(root).filter(n => n.type === 'button' && n.text === 'Bounce effect' && typeof n.value === 'boolean').pop();
  const pct = walk(root).filter(n => n.type === 'edittext' && n.helpTip && /overshoots/.test(n.helpTip))[0];
  walk(root).filter(n => n.modeId === 'both')[0].onClick();
  if (tog.value !== opts.bounce) tog.onClick();
  pct.text = String(opts.pct); pct.onChange();
  walk(root).filter(n => n.presetIndex !== undefined && n.text === name)[0].onClick();
  walk(root).filter(n => n.type === 'button' && n.text === 'Apply')[0].onClick();
  app.project.activeItem = null;
}
const BP = fakeKeyProp([0, 1, 3], [0, 100, 40]);
applyFlow(BP, 'cubic', { bounce: true, pct: 25 });
const onOk = /Motion Kit flow bounce/.test(BP.expression) && /pct = 0\.250/.test(BP.expression);
applyFlow(BP, 'expo', { bounce: true, pct: 40 });
const changeOk = /pct = 0\.400/.test(BP.expression) && Math.abs(BP.keys[0].out[0].influence - 87) < 1e-6;
applyFlow(BP, 'quad', { bounce: false, pct: 40 });
const offOk = BP.expression === '';
const UP = fakeKeyProp([0, 1], [0, 100]); UP.expression = 'wiggle(2, 10)';
applyFlow(UP, 'cubic', { bounce: true, pct: 10 });
const userOk = UP.expression === 'wiggle(2, 10)';
applyFlow(UP, 'cubic', { bounce: false, pct: 10 });
const userOffOk = UP.expression === 'wiggle(2, 10)';
// the expression must at least be valid JS once the AE helpers exist, and overshoot in the travel direction
let exprOk = false;
try {
  applyFlow(BP, 'cubic', { bounce: true, pct: 20 });
  const sub = (a, b) => a - b, add = (a, b) => a + b, mul = (a, b) => a * b;
  const kv = [0, 100, 40], kt = [0, 1, 3];
  const run = (time, value) => {
    const nearestKey = t => ({ index: kt.reduce((best, x, i) => (Math.abs(x - t) < Math.abs(kt[best] - t) ? i : best), 0) + 1 });
    const key = i => ({ time: kt[i - 1], value: kv[i - 1] });
    return new Function('value', 'numKeys', 'time', 'nearestKey', 'key', 'sub', 'add', 'mul', 'expr', 'return eval(expr);')(value, 3, time, nearestKey, key, sub, add, mul, BP.expression);
  };
  // a quarter cycle after key 2 the overshoot equals 20% of the 0 -> 100 travel, in the direction of travel
  const peak = run(1 + 1 / 12, 100), before = run(0.5, 50), late = run(3.9, 40);
  const done = run(5.5, 40);   // 2.5 s after the last key the bounce has ended
  exprOk = Math.abs(peak - 120) < 0.01 && before === 50 && Math.abs(late - 40) < 0.2 && done === 40;
  if (!exprOk) console.log('FLOW bounce numbers', peak, before, late, done);
} catch (e) { console.log('FLOW bounce expression failed', e.message); }
console.log(`flow bounce: on ${onOk}, change % ${changeOk}, off ${offOk}, user expression kept ${userOk && userOffOk}, parses ${exprOk}`);

// Animation > Pop: real buttons against a fake layer; checks keys, ease and the smooth bounce expression
function fakeAnimProp(dims, base) {
  const keys = [], E = () => Array.from({ length: dims }, () => new g.KeyframeEase(0, 16.67));
  return { propertyType: 1, keys, value: base, isSpatial: false, expression: '', dimensionsSeparated: false,
    get numKeys() { return keys.length; },
    setValueAtTime(t, v) { const i = keys.findIndex(k => Math.abs(k.t - t) < 1e-9); const k = { t, v, in: E(), out: E(), inT: 'B', outT: 'B' }; if (i >= 0) keys[i] = k; else { keys.push(k); keys.sort((a, b) => a.t - b.t); } },
    nearestKeyIndex(t) { let best = 0; keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(keys[best].t - t)) best = i; }); return best + 1; },
    valueAtTime() { return base; }, keyTime: i => keys[i - 1].t, keyValue: i => keys[i - 1].v,
    keyInTemporalEase: i => keys[i - 1].in, keyOutTemporalEase: i => keys[i - 1].out,
    keyInInterpolationType: i => keys[i - 1].inT, keyOutInterpolationType: i => keys[i - 1].outT,
    setInterpolationTypeAtKey(i, a, b) { keys[i - 1].inT = a; keys[i - 1].outT = b; },
    setTemporalContinuousAtKey() {}, setTemporalAutoBezierAtKey() {}, setValue(v) { this.value = v; },
    setTemporalEaseAtKey(i, inn, out) { keys[i - 1].in = inn; keys[i - 1].out = out; } };
}
function runPop(label) {
  const sc = fakeAnimProp(2, [100, 100]), op = fakeAnimProp(1, 100);
  const layer = { transform: { scale: sc, opacity: op }, motionBlur: false, containingComp: {} };
  const comp = new g.CompItem(); comp.selectedLayers = [layer]; comp.time = 1; comp.frameDuration = 1 / 24;
  app.project.activeItem = comp;
  const btn = walk(root).filter(n => n.type === 'button' && n.text === label)[0];
  const centerT = walk(root).filter(n => n.type === 'button' && n.text === 'Scale from layer center' && typeof n.value === 'boolean')[0];
  if (centerT.value) centerT.onClick();
  btn.onClick();
  app.project.activeItem = null;
  return { sc, op };
}
const near2 = (a, b) => Math.abs(a - b) < 1e-6;
{
  const { sc } = runPop('Pop Out'), k = sc.keys, dt = k.length === 2 ? k[1].t - k[0].t : 0;
  const ok = k.length === 2 && near2(dt, 0.75) && near2(k[0].out[0].influence, 30) && near2(k[0].out[0].speed, 0.36 * -100 / (0.3 * dt))
    && near2(k[1].in[0].influence, 40) && near2(k[1].in[0].speed, 0) && /Motion Kit smooth bounce/.test(sc.expression) && /clampZero = true/.test(sc.expression);
  console.log(`pop out: ${ok ? 'OK' : 'WRONG'} (2 keys, speed at start ${k[0] && Math.round(k[0].out[0].speed)}, lands at speed ${k[1] && k[1].in[0].speed}, smooth bounce on scale)`);
}
{
  const { sc } = runPop('Pop Up'), k = sc.keys, dt = k.length === 2 ? k[1].t - k[0].t : 0;
  const ok = k.length === 2 && near2(k[0].out[0].influence, 40) && near2(k[1].in[0].influence, 25)
    && near2(k[1].in[0].speed, (1 - 0.55) * 100 / (0.25 * dt)) && /Motion Kit smooth bounce/.test(sc.expression);
  console.log(`pop up: ${ok ? 'OK' : 'WRONG'} (arrives at speed ${k[1] && Math.round(k[1].in[0].speed)}/s, smooth bounce on scale)`);
}
console.log(`pop group: stagger field removed ${!walk(root).some(n => n.type === 'statictext' && n.text === 'Stagger (frames):' && n.parent && n.parent.parent && n.parent.parent.cardTitle === 'Pop')}`);

// Play the generated expression frame by frame (a small AE shim) and check what the motion actually does
function playExpr(expr, keys, curve) {
  const prog = x => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, u = 1 - m; (3*u*u*m*curve[0] + 3*u*m*m*curve[2] + m*m*m < x) ? lo = m : hi = m; } const m = (lo + hi) / 2, u = 1 - m; return 3*u*u*m*curve[1] + 3*u*m*m*curve[3] + m*m*m; };
  const base = t => { const [k0, k1] = keys; if (t <= k0.t) return k0.v; if (t >= k1.t) return k1.v; return k0.v + (k1.v - k0.v) * prog((t - k0.t) / (k1.t - k0.t)); };
  const vel = t => (base(t + 1e-5) - base(t - 1e-5)) / 2e-5;
  const len = v => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  const arr = (a, b, f) => (Array.isArray(a) || Array.isArray(b)) ? [].concat(a).map((x, i) => f(x, Array.isArray(b) ? b[i] : b)) : f(a, b);
  const nearestKey = t => ({ index: keys.reduce((b, k, i) => Math.abs(k.t - t) < Math.abs(keys[b].t - t) ? i : b, 0) + 1 });
  const ease = (t, t1, t2, v1, v2) => { const x = Math.min(1, Math.max(0, (t - t1) / (t2 - t1))); return v1 + (v2 - v1) * x * x * (3 - 2 * x); };
  return time => {
    const v = [base(time), base(time)];
    return new Function('value', 'numKeys', 'time', 'nearestKey', 'key', 'velocityAtTime', 'ease', 'length', 'add', 'sub', 'mul', 'thisComp', 'expr', 'return eval(expr);')(
      v, 2, time, nearestKey, i => ({ time: keys[i - 1].t, value: [keys[i - 1].v, keys[i - 1].v] }), t => [vel(t), vel(t)], ease, len,
      (a, b) => arr(a, b, (x, y) => x + y), (a, b) => arr(a, b, (x, y) => x - y), (a, b) => arr(a, b, (x, y) => x * y), { frameDuration: 1 / 24 }, expr)[0];
  };
}
{
  const up = runPop('Pop Up').sc, out = runPop('Pop Out').sc;
  const UPC = [0.4, 0.2, 0.75, 0.55], OUTC = [0.3, 0.36, 0.6, 1], T = 0.75, t0 = 1;
  const U = playExpr(up.expression, [{ t: t0, v: 0 }, { t: t0 + T, v: 100 }], UPC);
  let peak = 0, minV = 1e9; for (let t = t0; t < t0 + T + 2; t += 0.004) { peak = Math.max(peak, U(t)); minV = Math.min(minV, U(t)); }
  const settled = Math.abs(U(t0 + T + 1.9) - 100) < 0.05;
  const e = 1e-3, vL = (U(t0 + T - e) - U(t0 + T - 2 * e)) / e, vR = (U(t0 + T + 2 * e) - U(t0 + T + e)) / e;   // slope just before / after the key
  console.log(`pop up motion: overshoots to ${peak.toFixed(1)}, never below ${minV.toFixed(1)}, settles on 100 ${settled}, speed before/after the key ${vL.toFixed(0)} / ${vR.toFixed(0)}`);
  const O = playExpr(out.expression, [{ t: t0, v: 100 }, { t: t0 + T, v: 0 }], OUTC);
  let maxBefore = 0; for (let t = t0 - 0.5; t < t0; t += 0.004) maxBefore = Math.max(maxBefore, O(t));
  let afterMax = 0; for (let t = t0 + T; t < t0 + T + 1; t += 0.004) afterMax = Math.max(afterMax, Math.abs(O(t)));
  const sL = (O(t0 - 2 * e) - O(t0 - 3 * e)) / e, sR = (O(t0 + 3 * e) - O(t0 + 2 * e)) / e;
  console.log(`pop out motion: winds up to ${maxBefore.toFixed(1)} before leaving 100, ends and stays at 0 (max after ${afterMax.toFixed(3)}), speed before/after start ${sL.toFixed(0)} / ${sR.toFixed(0)}`);
}

// Swipe cut: three linked nulls (Move at the cut, Out / In as its children) like the hand-built rig
function fakeRigLayer(name, inP, outP) {
  // Like After Effects: assigning .parent keeps the layer from jumping, by shifting its own position to cancel the parent's offset
  const L = { name, inPoint: inP, outPoint: outP, _parent: null, index: 1, source: {}, motionBlur: false, containingComp: {},
    transform: { anchorPoint: fakeAnimProp(2, [0, 0]), position: fakeAnimProp(2, [0, 0]) }, moveBefore() {} };
  const off = l => { let x = 0, y = 0; for (; l; l = l._parent) { x += l.transform.position.value[0]; y += l.transform.position.value[1]; } return [x, y]; };
  Object.defineProperty(L, 'parent', { get() { return this._parent; },
    set(p) { const o = off(this._parent), n = off(p), v = this.transform.position.value; this.transform.position.value = [v[0] + o[0] - n[0], v[1] + o[1] - n[1]]; this._parent = p; } });
  return L;
}
// where a layer actually lands (position offset from its natural spot) with the Move null at a given position
function landing(L, movePos, move) {
  let x = 0, y = 0;
  for (let l = L; l; l = l._parent) { const v = (l === move) ? movePos : l.transform.position.value; x += v[0]; y += v[1]; }
  return [x, y];
}
function runSwipe(arrow, mutate) {
  const mbT = walk(root).filter(n => n.type === 'button' && n.text === 'Motion blur on animated layers' && typeof n.value === 'boolean')[0];
  if (!mbT.value) mbT.onClick();   // earlier steps click every toggle; motion blur must be on for this check
  const outL = fakeRigLayer('Clip A', 0, 5), inL = fakeRigLayer('Clip B', 5, 12), made = [];
  if (mutate) mutate(outL, inL);
  const comp = new g.CompItem(); Object.assign(comp, { selectedLayers: [outL, inL], time: 5, frameDuration: 0.04, width: 1920, height: 1080, duration: 12, shutterAngle: 180,
    layers: { addNull() { const n = fakeRigLayer('Null', 0, 12); made.push(n); return n; } } });
  app.project.activeItem = comp;
  walk(root).filter(n => n.type === 'button' && n.text === arrow && n.parent && n.parent.parent && n.parent.parent.cardTitle === 'Swipe cut')[0].onClick();
  app.project.activeItem = null;
  return { outL, inL, made, comp };
}
{
  const { outL, inL, made, comp } = runSwipe('←');
  const [mv, on, inn] = made, k = mv ? mv.transform.position.keys : [];
  const eq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const D = 1920 * 27 / 100, fr = 0.04, cut = 5;                 // default: 27% of the frame, 15 frames each side
  // rebuild the curve After Effects stored on the Move keys, then sample the move where it matters
  const dt = k.length === 2 ? k[1].t - k[0].t : 1;
  const c = k.length === 2 ? [k[0].out[0].influence / 100, k[0].out[0].speed * (k[0].out[0].influence / 100) * dt / -D, 1 - k[1].in[0].influence / 100, 1 - k[1].in[0].speed * (k[1].in[0].influence / 100) * dt / -D] : [0, 0, 1, 1];
  const prog = x => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, u = 1 - m; (3*u*u*m*c[0] + 3*u*m*m*c[2] + m*m*m < x) ? lo = m : hi = m; } const m = (lo + hi) / 2, u = 1 - m; return 3*u*u*m*c[1] + 3*u*m*m*c[3] + m*m*m; };
  const movePos = t => -D * prog(Math.min(1, Math.max(0, (t - k[0].t) / dt)));
  const outLast = movePos(cut - fr), inFirst = movePos(cut) + D;   // last outgoing frame, first incoming frame (offsets from the centre)
  const checks = {
    'three nulls named Move / Out / In': made.length === 3 && mv.name === 'MK Swipe · Move' && on.name === 'MK Swipe · Out' && inn.name === 'MK Swipe · In',
    'Out and In are linked to Move': on.parent === mv && inn.parent === mv,
    'clips linked to their nulls': outL.parent === on && inL.parent === inn,
    'In offset: the swipe distance (27% = 518 px), not a full screen': eq(inn.transform.position.value, [D, 0]) && eq(on.transform.position.value, [0, 0]),
    'Move keys: 16 frames before the cut, 15 after, rest -> -518 px': k.length === 2 && Math.abs(k[0].t - (cut - 16 * fr)) < 1e-9 && Math.abs(k[1].t - (cut + 15 * fr)) < 1e-9 && eq(k[0].v, [0, 0]) && eq(k[1].v, [-D, 0]),
    'ease (0.9, 0, 0.1, 1) on both keys, as in the hand-made version': eq(c, [0.9, 0, 0.1, 1]),
    'timing: Out to the cut, In from the cut, Move around it': on.inPoint === 0 && on.outPoint === 5 && inn.inPoint === 5 && inn.outPoint === 12 && Math.abs(mv.inPoint - (cut - 16 * fr)) < 1e-9 && Math.abs(mv.outPoint - (cut + 15 * fr)) < 1e-9,
    'anchor and position of the nulls start at 0,0 (links do not move the clips)': eq(mv.transform.anchorPoint.value, [0, 0]) && eq(on.transform.anchorPoint.value, [0, 0]),
    'incoming clip: starts 518 px to the right, ends on its natural spot': eq(landing(inL, k[0].v, mv), [D, 0]) && eq(landing(inL, k[1].v, mv), [0, 0]),
    'outgoing clip: starts natural, ends 518 px to the left': eq(landing(outL, k[0].v, mv), [0, 0]) && eq(landing(outL, k[1].v, mv), [-D, 0]),
    'the swap is a mirror image: last outgoing frame and first incoming frame are the same distance from the centre': Math.abs(Math.abs(outLast) - Math.abs(inFirst)) < 1e-6 && Math.abs(outLast) < D / 2,
    'motion blur on both clips and a wide shutter': outL.motionBlur && inL.motionBlur && comp.shutterAngle === 300
  };
  const bad = Object.keys(checks).filter(c => !checks[c]);
  console.log(`swipe cut: ${bad.length === 0 ? 'rig OK' : 'WRONG: ' + bad.join('; ')} (${Object.keys(checks).length} checks)`);
  const mid = [Math.abs(movePos(cut - fr)) / D, (Math.abs(movePos(cut)) / D)];
  console.log(`swipe cut feel vs your example: moved ${(mid[0] * 100).toFixed(1)}% one frame before the cut, ${(mid[1] * 100).toFixed(1)}% on it (yours: 36.6% / 63.4%)`);
  console.log(`swipe cut feel: last outgoing frame ${outLast.toFixed(0)} px, first incoming frame ${inFirst.toFixed(0)} px from the centre; both clips stay within +/-${D.toFixed(0)} px of it`);
  const overlap = runSwipe('←', (a, b) => { a.outPoint = 8; b.inPoint = 3; });
  console.log(`swipe cut hard cut: outgoing clip trimmed to the cut ${overlap.outL.outPoint === 3}, incoming clip starts at it ${overlap.inL.inPoint === 3}`);
  const down = runSwipe('↓'), dk = down.made[0].transform.position.keys;
  console.log(`swipe cut down: In offset ${JSON.stringify(down.made[2].transform.position.value)} (27% of 1080 = 291.6), Move ends at ${JSON.stringify(dk[1].v)}`);
  const hier = runSwipe('→', (a, b) => { const base = fakeRigLayer('Base', 0, 12); a.parent = base; });
  console.log(`swipe cut with an already-parented clip: root of the chain is linked ${hier.outL.parent.name === 'Base' && hier.made[1] && hier.outL.parent.parent === hier.made[1]}`);
  const shared = runSwipe('←', (a, b) => { const base = fakeRigLayer('Base', 0, 12); a.parent = base; b.parent = base; });
  console.log(`swipe cut with a shared parent: refused, no nulls added ${shared.made.length === 0}`);
}

// Text presets: .ffx files in a presets folder are embedded by build.js, show up as buttons, and are written back byte for byte
{
  const os = require('os'), path = require('path'), { build } = require('../build.js');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rupa-ffx-'));
  fs.mkdirSync(path.join(tmp, 'presets'));
  const bytes = n => Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + (i >> 3) + 11) & 255));   // every byte value, incl. 0 and 255
  const samples = { 'Fade-Up.ffx': bytes(3000), 'slide_in.ffx': bytes(1001), 'pop.ffx': bytes(1002), 'tiny.ffx': bytes(1) };
  Object.keys(samples).forEach(f => fs.writeFileSync(path.join(tmp, 'presets', f), samples[f]));
  fs.writeFileSync(path.join(tmp, 'presets', 'notes.txt'), 'ignored');
  const r = build({ presetsDir: path.join(tmp, 'presets'), out: path.join(tmp, 'out.jsx') });

  const applied = [], removed = [];
  function FakeFile(p) { this.path = p; this.data = ''; this.encoding = ''; }
  FakeFile.prototype.open = function () { return true; };
  FakeFile.prototype.write = function (s) { this.data += s; };
  FakeFile.prototype.close = function () {};
  FakeFile.prototype.remove = function () { removed.push(this.path); return true; };
  const g2 = Object.assign({}, g, { File: FakeFile, Folder: { temp: { fsName: '/tmp' } } });
  const src2 = fs.readFileSync(path.join(tmp, 'out.jsx'), 'utf8');
  const run2 = new Function(...Object.keys(g2), 'thisObj', src2.replace(/\}\)\(this\);\s*$/, '})(thisObj);'));
  const root2 = Object.assign(new Panel(), el('panel', 'root2'));
  run2(...Object.values(g2), root2);

  const btns = walk(root2).filter(n => n.type === 'button' && n.parent && n.parent.isBtnRow && ['Fade Up', 'Pop', 'Slide in', 'Tiny'].indexOf(n.text) >= 0);
  const names = btns.map(b => b.text).sort().join('|');
  const layer = { applyPreset(f) { applied.push({ path: f.path, data: f.data, encoding: f.encoding }); } };
  const comp = new g.CompItem(); comp.selectedLayers = [layer, { applyPreset: layer.applyPreset }]; app.project.activeItem = comp;
  const exact = {};
  ['Fade Up', 'Pop', 'Slide in', 'Tiny'].forEach(nm => {
    applied.length = 0;
    btns.filter(b => b.text === nm)[0].onClick();
    const want = samples[{ 'Fade Up': 'Fade-Up.ffx', 'Slide in': 'slide_in.ffx', Pop: 'pop.ffx', Tiny: 'tiny.ffx' }[nm]];
    const got = Buffer.from(applied[0] ? applied[0].data : '', 'latin1');
    exact[nm] = applied.length === 2 && Buffer.compare(got, want) === 0 && applied[0].encoding === 'BINARY';
  });
  comp.selectedLayers = []; applied.length = 0;
  btns[0].onClick();            // nothing selected: asks for a layer, applies nothing
  app.project.activeItem = null;
  console.log(`text presets: ${r.presets} embedded (non-.ffx ignored: ${r.presets === 4}), buttons ${names === 'Fade Up|Pop|Slide in|Tiny'}, bytes round-trip ${JSON.stringify(exact)}, temp files removed ${removed.length === 4}, nothing applied without a selection ${applied.length === 0}`);
  // a build with no .ffx files shows the empty state
  fs.mkdirSync(path.join(tmp, 'none'));
  build({ presetsDir: path.join(tmp, 'none'), out: path.join(tmp, 'empty.jsx') });
  const srcE = fs.readFileSync(path.join(tmp, 'empty.jsx'), 'utf8');
  const runE = new Function(...Object.keys(g2), 'thisObj', srcE.replace(/\}\)\(this\);\s*$/, '})(thisObj);'));
  const rootE = Object.assign(new Panel(), el('panel', 'rootE'));
  runE(...Object.values(g2), rootE);
  const empty = walk(rootE).filter(n => n.type === 'statictext' && /No text presets yet/.test(n.text)).length;
  console.log(`text group with no presets: empty-state hint shown ${empty === 1}`);
}

// The real presets shipped in presets/text: every button writes back exactly the bytes of its .ffx file
{
  const path = require('path'), dir = path.join(__dirname, '..', 'presets', 'text');
  const files = fs.readdirSync(dir).filter(f => /\.ffx$/i.test(f)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const label = f => { const n = f.replace(/\.ffx$/i, '').replace(/[-_]+/g, ' ').trim(); return n.charAt(0).toUpperCase() + n.slice(1); };
  const written = [];
  function RealFile(p) { this.path = p; this.data = ''; }
  RealFile.prototype.open = function () { return true; }; RealFile.prototype.write = function (d) { this.data += d; };
  RealFile.prototype.close = function () {}; RealFile.prototype.remove = function () { return true; };
  const g3 = Object.assign({}, g, { File: RealFile });
  const run3 = new Function(...Object.keys(g3), 'thisObj', src.replace(/\}\)\(this\);\s*$/, '})(thisObj);'));
  const root3 = Object.assign(new Panel(), el('panel', 'root3'));
  run3(...Object.values(g3), root3);
  const layer = { applyPreset(f) { written.push(f.data); } };
  const comp = new g.CompItem(); comp.selectedLayers = [layer]; app.project.activeItem = comp;
  const results = files.map(f => {
    const b = walk(root3).filter(n => n.type === 'button' && n.text === label(f) && n.parent && n.parent.isBtnRow)[0];
    written.length = 0;
    if (b) b.onClick();
    return { f, ok: !!b && written.length === 1 && Buffer.compare(Buffer.from(written[0], 'latin1'), fs.readFileSync(path.join(dir, f))) === 0 };
  });
  app.project.activeItem = null;
  const bad = results.filter(r => !r.ok).map(r => r.f);
  console.log(`shipped text presets: ${files.length} files, ${bad.length === 0 ? 'every button writes back its .ffx byte for byte' : 'MISMATCH ' + bad.join(', ')}`);
  console.log(`shipped text preset buttons: ${files.map(label).join(' | ')}`);
}
