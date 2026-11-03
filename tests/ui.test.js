const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'RuMotion.jsx'), 'utf8');
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
function FakeFile0(p) { this.path = p; this.fsName = p; this.name = String(p).split('/').pop(); this.data = ''; }
FakeFile0.openDialog = function () { return FakeFile0.nextDialog || null; };
FakeFile0.written = [];
FakeFile0.prototype.open = function () { return true; }; FakeFile0.prototype.write = function (d) { this.data += d; };
FakeFile0.prototype.close = function () {}; FakeFile0.prototype.remove = function () { return true; };
const settings = {}; let scheduled = null;
const $g = { global: { RuMotionEager: true }, colorPicker: ()=>-1 };
const app = { settings:{haveSetting:(s,k)=>(s+k) in settings,getSetting:(s,k)=>settings[s+k],saveSetting:(s,k,v)=>{settings[s+k]=v;}},
  project:{activeItem:null, importFile(io) { return { width: 200, height: 100, file: io.file, name: 'icon' }; }}, fonts:null, beginUndoGroup(){}, endUndoGroup(){}, scheduleTask(code){ scheduled = code; } };
function Panel(){}; let lastWin = null, windowsMade = 0; function Window(){ windowsMade++; lastWin = el('window'); lastWin.windowArgs = Array.prototype.slice.call(arguments); return lastWin; }
const g = { ImportOptions: function (f) { this.file = f; }, ImportAsType: { FOOTAGE: 1 }, File: FakeFile0, Folder: { temp: { fsName: '/tmp' } }, app, Panel, Window, $: $g, alert: ()=>{}, ScriptUI: { newFont:(f,s,z)=>({f,s,z}) },
  CompItem:function(){}, FootageItem:function(){}, AVLayer:function(){}, ShapeLayer:function(){}, TextLayer:function(){},
  CameraLayer:function(){}, LightLayer:function(){}, Shape:function(){}, KeyframeEase:function(sp,inf){ this.speed=sp; this.influence=inf; }, KeyframeInterpolationType:{LINEAR:'L',BEZIER:'B',HOLD:'H'},
  PropertyType:{PROPERTY:1}, MarkerValue:function(){}, TrackMatteType:{}, BlendingMode:{}, ParagraphJustification:{}, AutoOrientType:{} };
const run = new Function(...Object.keys(g), 'thisObj', src.replace(/\}\)\(this\);\s*$/, '})(thisObj);'));
const root = Object.assign(new Panel(), el('panel','root'));
run(...Object.values(g), root);
const windowsAtFirstRun = windowsMade, firstRunWin = lastWin;

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
    'three nulls named Move / Out / In': made.length === 3 && mv.name === 'Ru Swipe · Move' && on.name === 'Ru Swipe · Out' && inn.name === 'Ru Swipe · In',
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ru-ffx-'));
  fs.mkdirSync(path.join(tmp, 'presets'));
  const bytes = n => Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + (i >> 3) + 11) & 255));   // every byte value, incl. 0 and 255
  const samples = { 'Fade-Up.ffx': bytes(3000), 'slide_in.ffx': bytes(1001), 'pop.ffx': bytes(1002), 'tiny.ffx': bytes(1) };
  Object.keys(samples).forEach(f => fs.writeFileSync(path.join(tmp, 'presets', f), samples[f]));
  fs.writeFileSync(path.join(tmp, 'presets', 'notes.txt'), 'ignored');
  const r = build({ presetsDir: path.join(tmp, 'presets'), out: path.join(tmp, 'out.jsx') });

  const applied = [], removed = [], written = [];
  function FakeFile(p) { this.path = p; this.data = ''; this.encoding = ''; }
  FakeFile.prototype.open = function () { return true; };
  FakeFile.prototype.write = function (s) { this.data += s; };
  FakeFile.prototype.close = function () { written.push(this.path); };
  Object.defineProperty(FakeFile.prototype, 'exists', { get() { return written.indexOf(this.path) >= 0; } });
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
  comp.selectedLayers = [layer]; applied.length = 0; const w1 = written.length; btns.filter(b => b.text === 'Pop')[0].onClick();
  const reuse = written.length === w1 && applied.length === 1;       // second click: file already decoded, only applied
  comp.selectedLayers = []; applied.length = 0;
  btns[0].onClick();            // nothing selected: asks for a layer, applies nothing
  app.project.activeItem = null;
  console.log(`text presets: ${r.presets} embedded (non-.ffx ignored: ${r.presets === 4}), buttons ${names === 'Fade Up|Pop|Slide in|Tiny'}, bytes round-trip ${JSON.stringify(exact)}, decoded once and reused on later clicks ${reuse && written.length === 4}, nothing applied without a selection ${applied.length === 0}`);
  // a build with no .ffx files shows the empty state
  fs.mkdirSync(path.join(tmp, 'none'));
  build({ presetsDir: path.join(tmp, 'none'), out: path.join(tmp, 'empty.jsx') });
  const srcE = fs.readFileSync(path.join(tmp, 'empty.jsx'), 'utf8');
  const runE = new Function(...Object.keys(g2), 'thisObj', srcE.replace(/\}\)\(this\);\s*$/, '})(thisObj);'));
  const rootE = Object.assign(new Panel(), el('panel', 'rootE'));
  runE(...Object.values(g2), rootE);
  const onlyTw = walk(rootE).filter(n => n.type === 'button' && n.parent && n.parent.isBtnRow && n.text === 'Typewriter').length;
  console.log(`text group with no presets: the Typewriter button is still there ${onlyTw === 1}`);
}

// The real presets shipped in presets/text: every button writes back exactly the bytes of its .ffx file
{
  const path = require('path'), dir = path.join(__dirname, '..', 'presets', 'text');
  const files = fs.readdirSync(dir).filter(f => /\.ffx$/i.test(f)).sort((a, b) => { const x = a.replace(/\.ffx$/i, '').toLowerCase(), y = b.replace(/\.ffx$/i, '').toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
  const label = require('../build.js').labelOf;
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

// Text > Motion: the Text tab shows its sub-group chip row, with "Motion" selected, and the presets sit under it
{
  const textTile = walk(root).filter(n => n.groupName === 'Text')[0];
  textTile.onClick();
  const chip = walk(root).filter(n => n.variant === 'chip-on' && n.text === 'Effects')[0];
  const cards = walk(root).filter(n => n.cardLevel === 0 && n.cardTitle === 'Effects' && n.visible);
  console.log(`text sub-group: chip "Effects" shown ${!!chip}, card "Effects" visible ${cards.length === 1}`);
}

// ---------------------------------------------------------------------------------------------
// Text + Icon: type a sentence, pick where the icon goes. A fake AE with text/shape layers,
// text animators and file import checks the real numbers (layout, keys, highlight, icon slot).
// ---------------------------------------------------------------------------------------------
function fakeNode(matchName, dims, base) {
  const n = fakeAnimProp(dims || 2, base === undefined ? [0, 0] : base);
  n.matchName = matchName; n.children = []; n._name = matchName;
  Object.defineProperty(n, 'name', { get() { return this._name; }, set(v) { this._name = v; } });
  Object.defineProperty(n, 'numProperties', { get() { return this.children.length; } });
  n.remove = function () { const p = this._parent; if (p) { const i = p.children.indexOf(this); if (i >= 0) p.children.splice(i, 1); } };
  n.addProperty = function (mn) { const c = fakeNode(mn); c._parent = this; this.children.push(c); return c; };
  n.canAddProperty = () => true;
  n.property = function (x) {
    if (typeof x === 'number') { while (this.children.length < x) { const nc = fakeNode('param' + (this.children.length + 1)); nc._parent = this; this.children.push(nc); } return this.children[x - 1]; }
    let c = this.children.find(k => k.matchName === x || k._name === x);
    if (!c) { c = fakeNode(x); c._parent = this; this.children.push(c); }
    return c;
  };
  return n;
}
function baseLayer(kind) {
  const L = { kind, name: '', inPoint: 0, outPoint: 100, selected: false, parent: null,
    transform: { anchorPoint: fakeAnimProp(2, [0, 0]), position: fakeAnimProp(2, [0, 0]), scale: fakeAnimProp(2, [100, 100]), opacity: fakeAnimProp(1, 100), rotation: fakeAnimProp(1, 0) } };
  L.nodes = {};
  L.moveToBeginning = function () { this.onTop = true; };
  L.remove = function () { this.removed = true; };
  L.setTrackMatte = function (m, type) { this.matte = m; this.matteType = type; };
  L.property = function (x) { return (this.nodes[x] = this.nodes[x] || fakeNode(x)); };
  return L;
}
// the Move null is 100x100 at the comp centre (960,540) with its anchor at its centre (50,50): children are stored relative to it
const OX = 910, OY = 490;
function fakeBuild() {
  const made = [];
  const comp = new g.CompItem();
  const push = L => { made.push(L); return L; };
  Object.defineProperty(comp, 'numLayers', { get() { return made.filter(L => !L.removed).length; }, configurable: true });
  Object.assign(comp, { time: 2, width: 1920, height: 1080, duration: 20, frameDuration: 0.04, selectedLayers: [], shutterAngle: 180,
    layer(i) { return made.filter(L => !L.removed)[i - 1]; },
    layers: {
      addNull() { return push(baseLayer('null')); },
      addShape() { return push(baseLayer('shape')); },
      add(item) { const L = baseLayer('footage'); L.item = item; return push(L); },
      addText(str) {
        const L = baseLayer('text'), doc = { text: str, fontSize: 50, resetCharStyle() {} };
        const props = fakeNode('ADBE Text Properties'), docNode = fakeNode('ADBE Text Document');
        Object.defineProperty(docNode, 'value', { get() { return Object.assign({}, doc); } }); docNode.setValue = v => { Object.assign(doc, v); };
        props.children.push(docNode);
        L.nodes['ADBE Text Properties'] = props; L.doc = doc;
        L.sourceRectAtTime = () => { const f = doc.fontSize, desc = /[gjpqy]/.test(doc.text) ? 0.25 * f : 0, bp = doc.boxTextPos || [0, 0]; return { left: bp[0], top: bp[1] - f * 0.75, width: doc.text.length * f * 0.5, height: 0.75 * f + desc }; };
        return push(L);
      }
    } });
  return { comp, made };
}
function setField(label, text) {
  const e = walk(root).filter(n => n.type === 'edittext' && n.parent && n.parent.children[0] && n.parent.children[0].text === label)[0];
  e.text = text; if (e.onChanging) e.onChanging(); if (e.onChange) e.onChange(); return e;
}
function buildTextIcon(sentence, atIndex, opts) {
  opts = opts || {};
  const { comp, made } = fakeBuild(); app.project.activeItem = comp;
  setField('Sentence:', sentence);
  const where = walk(root).filter(n => n.type === 'dropdownlist' && n.items.length && /Before|Between|After/.test(n.items[0].text))[0];
  if (atIndex !== undefined) where.selection = atIndex;
  const hl = walk(root).filter(n => n.type === 'button' && n.text === 'Highlight words' && typeof n.value === 'boolean')[0];
  if (hl.value !== (opts.highlight !== false)) hl.onClick();
  walk(root).filter(n => n.type === 'button' && n.text === 'Build text + icon')[0].onClick();
  app.project.activeItem = null;
  return { made, where };
}
{
  const near = (a, b, tol) => Math.abs(a - b) < (tol || 1e-6);
  const R = {};
  // --- "my name is": icon between the first two words
  const { made, where } = buildTextIcon('my name is', 1);
  const nul = made[0], words = made.filter(L => L.kind === 'text'), icon = made.find(L => L.kind === 'shape');
  R['dropdown follows the words (4 slots for 3 words)'] = where.items.length === 4 && where.items[0].text === 'Before "my"' && where.items[1].text === 'Between "my" and "name"' && where.items[3].text === 'After "is"';
  R['3 word layers + icon + move null'] = words.length === 3 && !!icon && nul.kind === 'null' && made.length === 5;
  // independent arithmetic: font 90 -> text height 67.5, widths chars*45, space 27
  const h = 67.5, cx = 960, cy = 540, slot1 = 3.03 * h, slot0 = 0.56 * slot1;
  const wd = [90, 180, 90];
  let x = cx - (wd[0] + slot1 + wd[1] + 27 + wd[2]) / 2;
  const fin = [x + 45]; const iconX = x + wd[0] + slot1 / 2; x += wd[0] + slot1; fin.push(x + 90); x += wd[1] + 27; fin.push(x + 45);
  const s0 = 0.95, wd0 = wd.map(w => w * s0);
  let x0 = cx - (wd0[0] + slot0 + wd0[1] + 27 * s0 + wd0[2]) / 2;
  const ini = [x0 + wd0[0] / 2]; x0 += wd0[0] + slot0; ini.push(x0 + wd0[1] / 2); x0 += wd0[1] + 27 * s0; ini.push(x0 + wd0[2] / 2);
  R['words end centred around the 3.03x-height gap'] = words.every((W, i) => { const k = W.transform.position.keys; return k.length === 2 && near(k[1].v[0] + OX, fin[i]) && near(k[1].v[1] + OY, cy); });
  R['words start closer together (slot at 56%) and 5% smaller'] = words.every((W, i) => { const k = W.transform.position.keys, sc = W.transform.scale.keys; return near(k[0].v[0] + OX, ini[i]) && sc[0].v[0] === 95 && sc[1].v[0] === 100; });
  R['position keys: 2.0 -> 2.8 s, scale keys: 2.0 -> 3.3 s'] = words.every(W => { const k = W.transform.position.keys, sc = W.transform.scale.keys; return near(k[0].t, 2) && near(k[1].t, 2.8) && near(sc[0].t, 2) && near(sc[1].t, 3.3); });
  R['measured ease on position (5% / 5% influence) and scale'] = words.every(W => { const k = W.transform.position.keys, sc = W.transform.scale.keys; return near(k[0].out[0].influence, 5) && near(k[1].in[0].influence, 5) && near(sc[0].out[0].influence, 5) && near(sc[1].in[0].influence, 5); });
  R['icon sits centred in its slot, not animated'] = !!icon && near(icon.transform.position.value[0] + OX, iconX) && near(icon.transform.position.value[1] + OY, cy) && icon.transform.position.numKeys === 0 && icon.transform.scale.numKeys === 0;
  const vg = icon && icon.property('ADBE Root Vectors Group').children[0];
  R['built-in sparkle is a 4-point path'] = !!vg && vg.property('ADBE Vectors Group').children.some(c => c.matchName === 'ADBE Vector Shape - Group' && c.property('ADBE Vector Shape').value.vertices.length === 4);
  R['everything is linked to the Move null, which sits on top, centred on the comp with its anchor at its own centre'] = words.concat([icon]).every(L => L.parent === nul) && nul.onTop === true && nul.transform.position.value[0] === 960 && nul.transform.position.value[1] === 540 && nul.transform.anchorPoint.value[0] === 50 && nul.transform.anchorPoint.value[1] === 50;
  R['layers last 4 s from the playhead'] = made.every(L => near(L.inPoint, 2) && near(L.outPoint, 6));
  R['icon is the selected layer (ready to animate)'] = icon.selected === true && words.every(W => !W.selected);
  // highlight sweep
  const amt = W => W.property('ADBE Text Properties').property('ADBE Text Animators').children[0].property('ADBE Text Selectors').children[0].property('ADBE Text Range Advanced').property('ADBE Text Selector Max Amount');
  const fillC = W => W.property('ADBE Text Properties').property('ADBE Text Animators').children[0].property('ADBE Text Animator Properties').property('ADBE Text Fill Color');
  R['highlight: 4 amount keys on the first word, from 2.0 s'] = near(amt(words[0]).keys[0].t, 2) && amt(words[0]).keys.length === 4 && amt(words[0]).keys[1].v === 100 && near(amt(words[0]).keys[3].t, 3);
  R['highlight: second word starts one step (1 s) later'] = near(amt(words[1]).keys[0].t, 3);
  R['highlight: last word keeps it (2 keys)'] = amt(words[2]).keys.length === 2 && near(amt(words[2]).keys[0].t, 4);
  R['highlight colour goes lavender -> magenta'] = fillC(words[1]).keys.length === 2 && near(fillC(words[1]).keys[0].v[0], 178 / 255) && near(fillC(words[1]).keys[1].v[0], 193 / 255) && near(fillC(words[1]).keys[0].t, 3.1) && near(fillC(words[1]).keys[1].t, 3.6);
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`text + icon (my name is): ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}
{
  const near = (a, b) => Math.abs(a - b) < 1e-6, R = {};
  const h = 67.5, slot1 = 3.03 * h, end = (slot1 + 1.85 * h) / 2;     // "hello world": two words of 225
  // icon at the very start / very end / middle
  const a = buildTextIcon('hello world', 0).made, b = buildTextIcon('hello world', 2).made, c = buildTextIcon('hello world', 1).made;
  const ix = m => m.find(L => L.kind === 'shape').transform.position.value[0] + OX;
  const wx = m => m.filter(L => L.kind === 'text').map(L => L.transform.position.keys[1].v[0] + OX);
  let st = 960 - (end + 225 + 27 + 225) / 2;
  R['icon before the first word'] = near(ix(a), st + end / 2) && near(wx(a)[0], st + end + 112.5);
  st = 960 - (225 + 27 + 225 + end) / 2;
  R['icon after the last word'] = near(ix(b), st + 225 + 27 + 225 + end / 2) && near(wx(b)[1], st + 225 + 27 + 112.5);
  st = 960 - (225 + slot1 + 225) / 2;
  R['icon between two words: no extra word space'] = near(ix(c), st + 225 + slot1 / 2) && near(wx(c)[1], st + 225 + slot1 + 112.5);
  // highlight can be switched off
  const off = buildTextIcon('hello world', 1, { highlight: false }).made.filter(L => L.kind === 'text');
  R['highlight off: no animators'] = off.every(W => W.property('ADBE Text Properties').property('ADBE Text Animators').numProperties === 0);
  // one word is not a sentence: nothing is built
  const one = buildTextIcon('hello', 1).made;
  R['one word: nothing built'] = one.length === 0;
  // browse for an icon file: used instead of the sparkle, fitted to the icon size
  const browse = walk(root).filter(n => n.type === 'button' && n.text === 'Browse…')[0];
  FakeFile0.nextDialog = new FakeFile0('/icons/star.png'); browse.onClick();
  const shown = walk(root).filter(n => n.type === 'statictext' && n.text === 'star.png').length === 1;
  const withFile = buildTextIcon('hello world', 1).made;
  const fl = withFile.find(L => L.kind === 'footage');
  R['browse shows the file name'] = shown;
  R['icon file replaces the sparkle, scaled to 1.85x text height'] = !!fl && !withFile.some(L => L.kind === 'shape') && fl.name === 'Ru Text+Icon · Icon' && near(fl.transform.scale.value[0], 1.85 * 67.5 / 200 * 100) && fl.item.file.name === 'star.png';
  walk(root).filter(n => n.type === 'button' && n.text === 'Sparkle')[0].onClick();
  R['"Sparkle" goes back to the built-in icon'] = buildTextIcon('hello world', 1).made.some(L => L.kind === 'shape');
  // the position list follows the typing
  const fresh = buildTextIcon('one two three four', 1).where;
  R['4 words give 5 slots'] = fresh.items.length === 5 && fresh.items[4].text === 'After "four"';
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`text + icon (positions, file, highlight off): ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// Text + Icon, round 2: shared baseline, manual icon gap, gray defaults
{
  const near = (a, b) => Math.abs(a - b) < 1e-6, R = {};
  const m = buildTextIcon('Hello world beauty', 1, { highlight: false }).made;
  const words = m.filter(L => L.kind === 'text'), byName = n => words.find(L => L.name === 'Ru Text+Icon · ' + n);
  const anchors = words.map(L => L.transform.anchorPoint.value[1]), posY = words.map(L => L.transform.position.keys[1].v[1]);
  R['"beauty" has a descender in the fake font'] = byName('beauty').sourceRectAtTime().height > byName('Hello').sourceRectAtTime().height;
  R['all words share one anchor height (one baseline)'] = anchors.every(a => near(a, anchors[0])) && near(anchors[0], -67.5 / 2);
  R['all words share one position height at both keys'] = posY.every(y => near(y, 540 - OY)) && words.every(L => near(L.transform.position.keys[0].v[1], 540 - OY));
  R['anchor x is the word centre'] = words.every(L => near(L.transform.anchorPoint.value[0], L.sourceRectAtTime().width / 2));
  // default colours: words and icon use the Style gray (#9AA0A6); the sparkle has no coloured stroke
  const gray = [154 / 255, 160 / 255, 166 / 255];
  R['words are gray by default'] = words.every(L => gray.every((c, i) => near(L.doc.fillColor[i], c)));
  const icon = m.find(L => L.kind === 'shape'), vg = icon.property('ADBE Root Vectors Group').children[0].property('ADBE Vectors Group');
  const fill = vg.children.find(c => c.matchName === 'ADBE Vector Graphic - Fill');
  R['icon is gray by default'] = gray.every((c, i) => near(fill.property('ADBE Vector Fill Color').value[i], c));
  R['sparkle has no stroke'] = !vg.children.some(c => c.matchName === 'ADBE Vector Graphic - Stroke');
  // manual icon gap
  const diff = mm => { const w = mm.filter(L => L.kind === 'text').map(L => L.transform.position.keys[1].v[0]); return w[1] - w[0]; };
  const slot = 3.03 * 67.5;
  setField('Icon gap (px):', '0');   const g0 = diff(buildTextIcon('hello world', 1, { highlight: false }).made);
  setField('Icon gap (px):', '60');  const g60 = diff(buildTextIcon('hello world', 1, { highlight: false }).made);
  setField('Icon gap (px):', '-50'); const gm50 = diff(buildTextIcon('hello world', 1, { highlight: false }).made);
  setField('Icon gap (px):', '-600'); const gtight = diff(buildTextIcon('hello world', 1, { highlight: false }).made);
  setField('Icon gap (px):', '0');
  R['gap 0 = the natural gap'] = near(g0, 225 + slot);
  R['gap +60 adds 60 px between the two words'] = near(g60, 225 + slot + 60);
  R['gap -50 takes 50 px off'] = near(gm50, 225 + slot - 50);
  R['a very negative gap stops at 0.3x text height (words never collide)'] = near(gtight, 225 + 0.3 * 67.5);
  // the gap only widens the icon slot: words on the same side of the icon keep their normal spacing
  const m3 = a => buildTextIcon('one two three', 1, { highlight: false }).made.filter(L => L.kind === 'text').map(L => L.transform.position.keys[1].v[0]);
  setField('Icon gap (px):', '0');  const a3 = m3(); setField('Icon gap (px):', '80'); const b3 = m3(); setField('Icon gap (px):', '0');
  R['words after the icon keep their spacing when the gap changes'] = near(b3[2] - b3[1], a3[2] - a3[1]);
  // custom colours
  setField('Text color:', '#112233'); setField('Icon color:', '#445566');
  const c = buildTextIcon('hello world', 1, { highlight: false }).made;
  const tw = c.find(L => L.kind === 'text'), ic = c.find(L => L.kind === 'shape');
  const f2 = ic.property('ADBE Root Vectors Group').children[0].property('ADBE Vectors Group').children.find(x => x.matchName === 'ADBE Vector Graphic - Fill');
  R['custom text colour is used'] = near(tw.doc.fillColor[0], 0x11 / 255) && near(tw.doc.fillColor[2], 0x33 / 255);
  R['custom icon colour is used'] = near(f2.property('ADBE Vector Fill Color').value[0], 0x44 / 255) && near(f2.property('ADBE Vector Fill Color').value[2], 0x66 / 255);
  setField('Text color:', '#9AA0A6'); setField('Icon color:', '#9AA0A6');
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`text + icon (baseline, gap, gray): ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// Star Swipe: an icon sweeps across sentence 1; sentence 2 appears in its wake
{
  const near = (a, b) => Math.abs(a - b) < 1e-6, R = {};
  const { comp, made } = fakeBuild(); app.project.activeItem = comp;
  // earlier smoke clicks may have flipped the toggles: set them to their documented defaults first
  ['Glow trail', 'Spin the icon'].forEach(lbl => { const tg = walk(root).filter(n => n.type === 'button' && n.text === lbl && typeof n.value === 'boolean')[0]; if (tg.value !== true) { tg.onClick(); } });
  walk(root).filter(n => n.type === 'button' && n.text === 'Build star swipe')[0].onClick();
  app.project.activeItem = null;
  const texts = made.filter(L => L.kind === 'text'), shapes = made.filter(L => L.kind === 'shape'), nul = made.find(L => L.kind === 'null');
  const byName = n => made.find(L => L.name === n);
  const s1 = byName('Ru Star Swipe · Sentence 1'), s2 = byName('Ru Star Swipe · Sentence 2'), star = byName('Ru Star Swipe · Star');
  const rA = byName('Ru Star Swipe · Reveal 2'), rB = byName('Ru Star Swipe · Reveal 1'), trail = byName('Ru Star Swipe · Trail');
  R['2 sentences, reveal mattes, trail, star and one Move null'] = texts.length === 2 && !!rA && !!rB && !!trail && !!star && !!nul && shapes.length === 4 && nul.name === 'Ru Star Swipe · Move';
  R['Move null is on top, centred on the star (anchor 50,50)'] = nul.onTop === true && nul.transform.anchorPoint.value[0] === 50 && nul.transform.anchorPoint.value[1] === 50;
  // independent arithmetic: font 90 -> text height 67.5, "Give your users a place" is 23 chars * 45 = 1035 wide, star 1.85 x 67.5
  const w1 = 23 * 45, icon = 1.85 * 67.5, gapX = Math.max(icon * 0.7, 30 * 1.5), x0 = 960 - w1 / 2 - gapX, x1 = 960 + w1 / 2 + gapX;
  const k = nul.transform.position.keys;
  R['star waits 0.4 s, then sweeps 0.8 s from just before the wider sentence to just after it (stays in frame)'] = k.length === 2 && near(k[0].t, 2.4) && near(k[1].t, 3.2) && near(k[0].v[0], x0) && near(k[1].v[0], x1) && near(k[0].v[1], 540) && near(k[1].v[1], 540);
  R['the sweep is eased'] = k[0].out[0].influence > 40 && k[1].in[0].influence > 25;
  R['sentences are centred on one shared baseline'] = [s1, s2].every(L => near(L.transform.position.value[0], 960) && near(L.transform.position.value[1], 540) && near(L.transform.anchorPoint.value[1], -33.75));
  R['sentence 2 is matted by the left-of-star reveal, sentence 1 by the right-of-star one'] = s2.matte === rA && s1.matte === rB && rA.enabled === false && rB.enabled === false;
  R['reveal edges sit on the star centre (left / right half planes)'] = [rA, rB, trail, star].every(L => L.parent === nul && L.transform.position.value[0] === 50 && L.transform.position.value[1] === 50);
  const rectPos = L => L.property('ADBE Root Vectors Group').children[0].property('ADBE Vectors Group').children.find(c => c.matchName === 'ADBE Vector Shape - Rect').property('ADBE Vector Rect Position').value[0];
  R['left reveal extends left, right reveal extends right'] = rectPos(rA) < 0 && rectPos(rB) > 0 && near(rectPos(rA), -rectPos(rB));
  const tg = trail.property('ADBE Root Vectors Group').children, fo = g => g.property('ADBE Vectors Group').children.find(c => c.matchName === 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Opacity').value;
  const ops = tg.map(fo), rx = g => g.property('ADBE Vectors Group').children.find(c => c.matchName === 'ADBE Vector Shape - Rect').property('ADBE Vector Rect Position').value[0];
  R['trail tail is 0% and rises to 100% at the star (16 slices, increasing, tail first)'] = tg.length === 16 && ops.every((v, i) => i === 0 || v > ops[i - 1]) && ops[0] < 2 && ops[15] > 95 && ops[15] <= 100;
  R['trail slices run from the far tail up to the star centre'] = rx(tg[0]) < rx(tg[15]) && rx(tg[15]) <= 0 && tg.every((g, i) => i === 0 || rx(g) > rx(tg[i - 1]));
  R['trail fades in and out (0 -> 100 -> 0)'] = trail.transform.opacity.keys.length === 4 && trail.transform.opacity.keys[2].v === 100 && trail.transform.opacity.keys[3].v === 0;
  R['star spins half a turn while it sweeps'] = star.transform.rotation.keys.length === 2 && star.transform.rotation.keys[1].v === 180 && near(star.transform.rotation.keys[1].t, 3.2);
  R['layers last 5 s from the playhead'] = made.every(L => near(L.inPoint, 2) && near(L.outPoint, 7));
  R['star is selected (ready to restyle)'] = star.selected === true;
  R['the star stays inside the frame at the end'] = k[1].v[0] + icon / 2 < 1920;
  // a wider second sentence sets the start and end instead
  setField('First sentence:', 'Hi there'); setField('Second sentence:', 'a much longer second sentence');
  const m2 = (() => { const f = fakeBuild(); app.project.activeItem = f.comp; walk(root).filter(n => n.type === 'button' && n.text === 'Build star swipe')[0].onClick(); app.project.activeItem = null; return f.made; })();
  const k2 = m2.find(L => L.kind === 'null').transform.position.keys, w2 = 29 * 45;
  R['second sentence wider: the star starts and ends around the second sentence'] = near(k2[0].v[0], 960 - w2 / 2 - gapX) && near(k2[1].v[0], 960 + w2 / 2 + gapX);
  setField('First sentence:', 'Give your users a place'); setField('Second sentence:', 'to give feedback,');
  const bad = Object.keys(R).filter(kk => !R[kk]);
  console.log(`star swipe: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// ---------------------------------------------------------------------------------------------
// Typewriter + Typewriter Block: TWO keyframes (a "Typed" slider 0 -> total); everything else is an expression that reads it
{
  const near = (a, b) => Math.abs(a - b) < 0.011, R = {};   // expressions carry 2 decimals
  // run an expression the way AE would: effect("Typed")("Slider") (or through thisComp.layer(...)) returns a property that behaves like a number
  function ev(expr, slider, time, value, keyTime) {
    const prop = { valueOf() { return slider; }, key() { return { time: keyTime }; } };
    const effect = () => () => prop, thisComp = { layer: () => ({ effect }) };
    return eval(expr);                       // eslint-disable-line no-eval
  }
  function press(label, text, props, pos) {
    const { comp, made } = fakeBuild(); app.project.activeItem = comp;
    const L0 = comp.layers.addText(text); L0.doc.fontSize = 90; Object.assign(L0.doc, props || {});
    L0.transform.position.setValue([960, 540]); L0.transform.anchorPoint.setValue(pos || [0, -33.75]);
    comp.selectedLayers = [L0];
    const b = walk(root).filter(n => n.type === 'button' && n.text === label && n.parent && n.parent.isBtnRow)[0];
    b.onClick(); app.project.activeItem = null;
    const live = () => made.filter(L => !L.removed);
    return { b, L0, made, live, find: pre => live().find(L => L.name.indexOf(pre) === 0) };
  }
  const anim = (L, i) => L.property('ADBE Text Properties').property('ADBE Text Animators').children[i];
  const sel = a => a.property('ADBE Text Selectors').children[0], adv = a => sel(a).property('ADBE Text Range Advanced');
  const slider = h => h.property('ADBE Effect Parade').children[0].children[0];
  const cw = Math.max(2, 90 * 0.045), gap = 90 * 0.06, y0 = 540 + 33.75 - 90 * 0.3;

  // ---- Typewriter, single line "Hi there" (45 px per letter, 8 letters)
  const a = press('Typewriter', 'Hi there');
  const caret = a.find('Ru Typewriter · Caret '), sk = slider(caret).keys, dt = 1 / 14;
  R['"Typewriter" is a plain button in the Motion card'] = !!a.b && !walk(root).some(n => n.cardTitle === 'Typewriter');
  R['exactly TWO keyframes, on one slider: 0 -> 8 letters, linear'] = sk.length === 2 && sk[0].v === 0 && sk[1].v === 8 && sk.every(k => k.inT === 'L' && k.outT === 'L') && caret.transform.position.numKeys === 0 && a.L0.transform.position.numKeys === 0;
  R['first letter lands 0.3 s after the playhead, then 14 letters/s'] = near(sk[0].t, 2 + 0.3 - dt) && near(sk[1].t, 2 + 0.3 + 7 * dt) && near(((2.3) - sk[0].t) / (sk[1].t - sk[0].t) * 8, 1);
  const an = anim(a.L0, 0), refName = caret.name;
  R['one animator hides everything (opacity 0), Index units, Based On Characters; its Start is the floored slider'] = an.name.indexOf('Ru Typewriter ') === 0 && an.property('ADBE Text Animator Properties').property('ADBE Text Opacity').value === 0 && adv(an).property('ADBE Text Range Units').value === 2 && ev(sel(an).property('ADBE Text Index Start').expression, 3.7, 0, 0, 0) === 3 && sel(an).property('ADBE Text Index Start').expression.indexOf(refName) >= 0;
  const cpos = s => ev(caret.transform.position.expression, s, 0, 0, 0);
  R['caret follows the letters (centred line): 22.5 px further right per letter, ends 180 px right of the layer position'] = near(cpos(0)[0], 960 + 180 + gap + cw / 2) && near(cpos(1)[0] - cpos(0)[0], 22.5) && near(cpos(8)[0], 960 + 360 + gap + cw / 2) && near(cpos(4)[1], y0) && near(cpos(3.9)[0], cpos(3)[0]);
  const lpos = s => ev(a.L0.transform.position.expression, s, 0, [960, 540], 0);
  R['the line stays centred: it starts 180 px right and settles on its own position'] = near(lpos(0)[0], 960 + 180) && near(lpos(8)[0], 960) && near(lpos(2)[1], 540);
  const tB = sk[1].t, op = (s, tm) => ev(caret.transform.opacity.expression, s, tm, 0, tB);
  R['caret is on while typing, blinks twice after the last letter, then goes away'] = op(3, 2.5) === 100 && op(8, tB + 0.2) === 100 && op(8, tB + 0.5) === 0 && op(8, tB + 0.9) === 100 && op(8, tB + 1.3) === 0 && op(8, tB + 1.7) === 100 && op(8, tB + 2.2) === 0;
  R['the helper caret is a thin bar'] = near(caret.property('ADBE Root Vectors Group').children[0].property('ADBE Vectors Group').children.find(c => c.matchName === 'ADBE Vector Shape - Rect').property('ADBE Vector Rect Size').value[1], 99);
  // pressing again replaces everything (one animator, one helper layer, expression back to the new one)
  app.project.activeItem = null; { const comp = a.made[0] && null; }
  const a2 = (() => { const { comp, made } = fakeBuild(); app.project.activeItem = comp; const L0 = comp.layers.addText('Hi there'); L0.doc.fontSize = 90; comp.selectedLayers = [L0];
    const b = walk(root).filter(n => n.type === 'button' && n.text === 'Typewriter' && n.parent && n.parent.isBtnRow)[0]; b.onClick(); b.onClick(); app.project.activeItem = null; return { L0, made }; })();
  R['a second press replaces the first: one animator, one live helper layer'] = a2.L0.property('ADBE Text Properties').property('ADBE Text Animators').children.filter(c => c.name.indexOf('Ru Typewriter') === 0).length === 1 && a2.made.filter(L => !L.removed && L.name.indexOf('Ru Typewriter · Caret ') === 0).length === 1;

  // ---- Typewriter on lines: explicit break ("Hi" / "there") and wrapped paragraph text (box 500 px)
  const m = press('Typewriter', 'Hi\rthere'), mc = m.find('Ru Typewriter · Caret '), mp = s => ev(mc.transform.position.expression, s, 0, 0, 0);
  R['line break: 9 steps; the break moves the caret to the start of the next line (+108 px), text is not shifted'] = slider(mc).keys[1].v === 8 && near(mp(2)[0], 960 + 90 + gap + cw / 2) && near(mp(2)[1], y0) && near(mp(3)[0], 960 + gap + cw / 2) && near(mp(3)[1], y0 + 108) && near(mp(8)[0], 960 + 225 + gap + cw / 2) && m.L0.transform.position.expression === '';
  const w = press('Typewriter', 'Hi there you', { boxText: true, boxTextSize: [500, 300] }), wc = w.find('Ru Typewriter · Caret '), wp = s => ev(wc.transform.position.expression, s, 0, 0, 0);
  R['wrapped paragraph: the word that does not fit starts line 2 at the left edge; no centring shift'] = near(wp(9)[0], 960 + 405 + gap + cw / 2) && near(wp(9)[1], y0) && near(wp(10)[0], 960 + 45 + gap + cw / 2) && near(wp(10)[1], y0 + 108) && w.L0.transform.position.expression === '';

  // ---- Typewriter Block on "Hi there you" (words 90 / 225 / 135 px wide, starting at 0 / 135 / 405)
  const b = press('Typewriter Block', 'Hi there you'), blk = b.find('Ru Typewriter · Block '), bk = slider(blk).keys;
  R['block: TWO keyframes, slider 0 -> 3 words, first word 0.3 s after the playhead, 6 words/s'] = bk.length === 2 && bk[0].v === 0 && bk[1].v === 3 && near(bk[0].t, 2 + 0.3 - 1 / 6) && near(bk[1].t, 2 + 0.3 + 2 / 6) && blk.transform.position.numKeys === 0 && blk.transform.scale.numKeys === 0;
  const bp = s => ev(blk.transform.position.expression, s, 0, 0, 0), bs = s => ev(blk.transform.scale.expression, s, 0, 0, 0);
  R['block sits on the next word and is as wide as it is'] = near(bp(0)[0], 960) && near(bp(1)[0], 960 + 135) && near(bp(2)[0], 960 + 405) && near(bp(2)[1], 540) && near(bs(0)[0], 90) && near(bs(1)[0], 225) && near(bs(2)[0], 135) && bs(1)[1] === 100;
  R['block goes away when the last word lands'] = ev(blk.transform.opacity.expression, 2.9, 0, 0, 0) === 100 && ev(blk.transform.opacity.expression, 3, 0, 0, 0) === 0;
  const an1 = anim(b.L0, 0), an2 = anim(b.L0, 1);
  R['two animators on Words / Index units: reveal (hides) + wave (blue, Ramp Up)'] = an1.name.indexOf('Ru Typewriter ') === 0 && an2.name.indexOf('Ru Typewriter Wave ') === 0 && [an1, an2].every(x => adv(x).property('ADBE Text Range Units').value === 2 && adv(x).property('ADBE Text Range Type2').value === 3) && adv(an2).property('ADBE Text Range Shape').value === 2 && an1.property('ADBE Text Animator Properties').property('ADBE Text Opacity').value === 0 && Math.abs(an2.property('ADBE Text Animator Properties').property('ADBE Text Fill Color').value[2] - 0.965) < 1e-6;
  R['wave window: the last 7 words, newest strongest (Start = typed - 7, End = typed)'] = ev(sel(an2).property('ADBE Text Index Start').expression, 12, 0, 0, 0) === 5 && ev(sel(an2).property('ADBE Text Index Start').expression, 3, 0, 0, 0) === 0 && ev(sel(an2).property('ADBE Text Index End').expression, 12.9, 0, 0, 0) === 12 && ev(sel(an1).property('ADBE Text Index Start').expression, 2.5, 0, 0, 0) === 2;
  const fillOf = i => blk.property('ADBE Root Vectors Group').children[i].property('ADBE Vectors Group').children.find(c => c.matchName === 'ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').value;
  R['block is a gradient of 10 slices (cyan-blue to periwinkle)'] = blk.property('ADBE Root Vectors Group').children.length === 10 && fillOf(0)[0] < fillOf(9)[0];
  const bl = press('Typewriter Block', 'Hi\rthere you'), blb = bl.find('Ru Typewriter · Block '), blp = s => ev(blb.transform.position.expression, s, 0, 0, 0);
  R['block on lines: x restarts at the left edge and y drops 108 px after a break'] = near(blp(0)[1], 540) && near(blp(1)[0], 960) && near(blp(1)[1], 540 + 108) && near(blp(2)[0], 960 + 270) && near(blp(2)[1], 540 + 108);

  // ---- Paragraph boxes sit at boxTextPos, not at the layer origin
  const box = { boxText: true, boxTextSize: [900, 300], boxTextPos: [-732, -384] };
  const pc = press('Typewriter', 'Hi there you', box, [0, 0]), pcc = pc.find('Ru Typewriter · Caret ');
  R['paragraph box: the caret starts at the top-left of the box, not at the layer position'] = near(ev(pcc.transform.position.expression, 0, 0, 0, 0)[0], 960 - 732 + gap + cw / 2) && near(ev(pcc.transform.position.expression, 0, 0, 0, 0)[1], 540 - 384 - 90 * 0.3) && near(ev(pcc.transform.position.expression, 2, 0, 0, 0)[0], 960 - 732 + 90 + gap + cw / 2);
  const pb = press('Typewriter Block', 'Hi there you', box, [0, 0]), pbb = pb.find('Ru Typewriter · Block ');
  R['paragraph box: the block starts on the first word of the box'] = near(ev(pbb.transform.position.expression, 0, 0, 0, 0)[0], 960 - 732) && near(ev(pbb.transform.position.expression, 1, 0, 0, 0)[0], 960 - 732 + 135) && near(ev(pbb.transform.position.expression, 0, 0, 0, 0)[1], 540 - 384 - 90 * 0.375);
  g.ParagraphJustification.CENTER_JUSTIFY = 'C';
  const pj = press('Typewriter Block', 'Hi there you', Object.assign({ justification: 'C' }, box), [0, 0]), pjb = pj.find('Ru Typewriter · Block ');
  delete g.ParagraphJustification.CENTER_JUSTIFY;
  R['centred paragraph: the first word starts (900 - 540) / 2 = 180 px into the box'] = near(ev(pjb.transform.position.expression, 0, 0, 0, 0)[0], 960 - 732 + 180);
  // nothing selected / empty text
  const e = press('Typewriter', '   ');
  R['empty text: nothing built'] = !e.find('Ru Typewriter · Caret ');
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`typewriters (two keyframes): ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// SaaS Text Preset 1: a two-line text rolls up through a one-line window, word by word, on a two-key slider
{
  const near = (a, b) => Math.abs(a - b) < 0.011, R = {};
  function ev(expr, val, idx, tot) { const prop = { valueOf() { return val; } }; const effect = () => () => prop; const textIndex = idx, textTotal = tot; return eval(expr); }   // eslint-disable-line no-eval
  function press(text, props) {
    const { comp, made } = fakeBuild(); app.project.activeItem = comp;
    const L0 = comp.layers.addText(text); L0.doc.fontSize = 90; Object.assign(L0.doc, props || {});
    L0.transform.position.setValue([960, 540]); L0.transform.anchorPoint.setValue([0, -33.75]);
    comp.selectedLayers = [L0];
    const b = walk(root).filter(n => n.type === 'button' && n.text === 'SaaS Text Preset 1' && n.parent && n.parent.isBtnRow)[0];
    b.onClick(); app.project.activeItem = null;
    return { b, L0, made };
  }
  const a = press('Hi there\ryou now');
  const L0 = a.L0, anims = L0.property('ADBE Text Properties').property('ADBE Text Animators').children;
  const an = anims.find(x => x.name === 'Ru SaaS Roll');
  R['"SaaS Text Preset 1" is a plain button in the Motion card'] = !!a.b && !walk(root).some(n => n.cardTitle === 'SaaS Text Preset 1');
  const e = L0.property('ADBE Effect Parade').children.find(c => c.name === 'Roll'), sk = e && e.children[0].keys;
  R['exactly TWO keyframes: a "Roll" slider 0 -> 0.28 s (stagger 0.08 + 0.2 per word), linear'] = !!sk && sk.length === 2 && sk[0].v === 0 && near(sk[1].v, 0.28) && near(sk[0].t, 2) && near(sk[1].t, 2.28) && sk.every(k => k.inT === 'L');
  const pos = an.property('ADBE Text Animator Properties').property('ADBE Text Position 3D');
  R['animator moves everything up by one line (1.2 x 90 = 108 px)'] = !!an && pos.value[1] === -108 && pos.value[0] === 0;
  const sel = an.property('ADBE Text Selectors').children[0], amt = sel.property('ADBE Text Expressible Amount');
  R['an Expression Selector (not a Range Selector) drives it'] = sel.matchName === 'ADBE Text Expressible Selector' && an.property('ADBE Text Selectors').children.length === 1 && typeof amt.expression === 'string' && amt.expression.indexOf('Roll') >= 0;
  // words: Hi(line 1, 0) there(line 1, 1) you(line 2, 0) now(line 2, 1): each line staggers on its own, so Hi and you move together
  const A = (v, i) => ev(amt.expression, v, i, 4);
  R['at the start nothing has moved; at the end every word has'] = [1, 2, 3, 4].every(i => A(0, i) === 0) && [1, 2, 3, 4].every(i => near(A(0.28, i), 100));
  R['each line staggers on its own: the first word of BOTH lines moves first, together'] = near(A(0.1, 1), A(0.1, 3)) && near(A(0.1, 2), A(0.1, 4)) && A(0.1, 1) > A(0.1, 2) && near(A(0.1, 1), 87.5) && A(0.05, 2) === 0;
  R['ease-out: most of the move happens early'] = A(0.05, 1) > 25 * 1.5 && A(0.2, 1) === 100;
  // character-based fallback: with 16 characters the same words get the same amounts
  const AC = (v, c) => ev(amt.expression, v, c, 16);
  R['if "Based On" stays on characters: every letter takes its word\'s timing (spaces and the break take the word before)'] = near(AC(0.1, 1), A(0.1, 1)) && near(AC(0.1, 2), A(0.1, 1)) && near(AC(0.1, 4), A(0.1, 2)) && near(AC(0.1, 9), A(0.1, 2)) && near(AC(0.1, 10), A(0.1, 3)) && near(AC(0.1, 16), A(0.1, 4));
  const mk = L0.property('ADBE Mask Parade').children[0], shp = mk.property('ADBE Mask Shape').value;
  R['a one-line window (mask) clips it: from 0.95 em above the first baseline to 0.3 em below'] = !!mk && mk.name === 'Ru Roll Window' && near(shp.vertices[0][1], 0 - 0.95 * 90) && near(shp.vertices[2][1], 0 + 0.30 * 90) && shp.vertices[0][0] < -1000 && shp.vertices[1][0] > 1000 && shp.closed === true;
  // pressing again replaces everything; one line only is refused
  const b2 = (() => { const { comp, made } = fakeBuild(); app.project.activeItem = comp; const L = comp.layers.addText('Hi there\ryou now'); L.doc.fontSize = 90; comp.selectedLayers = [L];
    const b = walk(root).filter(n => n.type === 'button' && n.text === 'SaaS Text Preset 1' && n.parent && n.parent.isBtnRow)[0]; b.onClick(); b.onClick(); app.project.activeItem = null; return L; })();
  R['a second press replaces the first (one animator, one slider, one window)'] = b2.property('ADBE Text Properties').property('ADBE Text Animators').children.filter(x => x.name === 'Ru SaaS Roll').length === 1 && b2.property('ADBE Effect Parade').children.filter(x => x.name === 'Roll').length === 1 && b2.property('ADBE Mask Parade').children.filter(x => x.name === 'Ru Roll Window').length === 1;
  const one = press('Just one line');
  R['a single line is refused (nothing added)'] = one.L0.property('ADBE Text Properties').property('ADBE Text Animators').children.filter(x => x.name === 'Ru SaaS Roll').length === 0;
  // wrapped paragraph text counts as two lines too
  const w = press('Hi there you', { boxText: true, boxTextSize: [500, 300] }), wan = w.L0.property('ADBE Text Properties').property('ADBE Text Animators').children.find(x => x.name === 'Ru SaaS Roll');
  R['paragraph text that wraps onto a second line works too'] = !!wan;
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`saas text preset 1: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// SaaS Text Preset 1 with TWO text layers: the upper one leaves, the lower one arrives
{
  const near = (a, b) => Math.abs(a - b) < 0.011, R = {};
  function ev(expr, val, idx, tot) { const prop = { valueOf() { return val; } }; const effect = () => () => prop; const textIndex = idx, textTotal = tot; return eval(expr); }   // eslint-disable-line no-eval
  const { comp, made } = fakeBuild(); app.project.activeItem = comp;
  const mk = (txt, idx) => { const L = comp.layers.addText(txt); L.index = idx; L.doc.fontSize = 90; L.transform.position.setValue([960, 540]); L.transform.anchorPoint.setValue([0, -33.75]); return L; };
  const up = mk('you now', 1), low = mk('Hi there', 2);       // the LOWER layer is the first sentence (visible first), the UPPER one arrives
  comp.selectedLayers = [low, up];                 // selection order must not matter: the layer index decides
  walk(root).filter(n => n.type === 'button' && n.text === 'SaaS Text Preset 1' && n.parent && n.parent.isBtnRow)[0].onClick();
  app.project.activeItem = null;
  const roll = L => L.property('ADBE Text Properties').property('ADBE Text Animators').children.find(x => x.name === 'Ru SaaS Roll');
  const pos = L => roll(L).property('ADBE Text Animator Properties').property('ADBE Text Position 3D').value;
  const amt = L => roll(L).property('ADBE Text Selectors').children[0].property('ADBE Text Expressible Amount').expression;
  R['both layers get the animator, a Roll slider with two keys, and the one-line window'] = [up, low].every(L => !!roll(L) && L.property('ADBE Effect Parade').children.find(c => c.name === 'Roll').children[0].keys.length === 2 && L.property('ADBE Mask Parade').children.length === 1);
  R['the LOWER layer moves UP and out (-108); the UPPER layer starts one line lower (+108) and rises in'] = pos(low)[1] === -108 && pos(up)[1] === 108;
  const A = (L, v, i) => ev(amt(L), v, i, 2);
  R['the lower layer\'s words leave (0 -> 100%), the upper layer\'s words arrive (100 -> 0%)'] = A(low, 0, 1) === 0 && near(A(low, 0.28, 1), 100) && A(up, 0, 1) === 100 && near(A(up, 0.28, 1), 0);
  R['words of each layer stagger 0.08 s apart; both layers start together at the playhead'] = A(low, 0.1, 1) > A(low, 0.1, 2) && A(up, 0.1, 1) < A(up, 0.1, 2) && near(A(low, 0.1, 1), 87.5) && near(A(up, 0.1, 1), 12.5);
  const keysOf = L => L.property('ADBE Effect Parade').children.find(c => c.name === 'Roll').children[0].keys;
  R['both sliders start at the playhead (2 s)'] = near(keysOf(up)[0].t, 2) && near(keysOf(low)[0].t, 2) && near(keysOf(up)[1].t, 2.28);
  // one layer with one line, selected alone: asks for two layers / two lines and builds nothing
  const c2 = fakeBuild(); app.project.activeItem = c2.comp; const solo = c2.comp.layers.addText('one line'); solo.doc.fontSize = 90; c2.comp.selectedLayers = [solo];
  walk(root).filter(n => n.type === 'button' && n.text === 'SaaS Text Preset 1' && n.parent && n.parent.isBtnRow)[0].onClick(); app.project.activeItem = null;
  R['a single one-line layer is refused'] = !solo.property('ADBE Text Properties').property('ADBE Text Animators').children.some(x => x.name === 'Ru SaaS Roll');
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`saas text preset 1 (two layers): ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// The seven showreel styles in Text > Motion: Hero Zoom, Hero Blur, Letter Blur, Two-Line Stack, Word Highlight, Blur Out, Delete Out
{
  const near = (a, b) => Math.abs(a - b) < 0.011, R = {};
  function ev(expr, val, idx, tot, value) { const prop = { valueOf() { return val; } }; const effect = () => () => prop; const textIndex = idx, textTotal = tot; return eval(expr); }   // eslint-disable-line no-eval
  const names = ['Hero Zoom', 'Hero Blur', 'Letter Blur', 'Two-Line Stack', 'Word Highlight', 'Blur Out', 'Delete Out'];
  R['all seven are plain buttons in the Motion card (no cards, no fields), and Marker Morph is gone'] = names.every(n => walk(root).filter(b => b.type === 'button' && b.text === n && b.parent && b.parent.isBtnRow).length === 1) && !names.some(n => walk(root).some(c => c.cardTitle === n)) && walk(root).filter(b => b.type === 'button' && b.text === 'Marker Morph').length === 0;
  function press(label, mkLayer) {
    const { comp, made } = fakeBuild(); app.project.activeItem = comp;
    const L = mkLayer(comp, made); comp.selectedLayers = [L];
    walk(root).filter(b => b.type === 'button' && b.text === label && b.parent && b.parent.isBtnRow)[0].onClick();
    app.project.activeItem = null;
    return { L, made };
  }
  const shape = (comp, made) => { const L = baseLayer('shape'); L.name = 'Card'; made.push(L); return L; };
  const text = (str, props) => (comp) => { const L = comp.layers.addText(str); L.name = 'T'; L.doc.fontSize = 90; Object.assign(L.doc, props || {}); L.transform.position.setValue([960, 540]); L.transform.anchorPoint.setValue([0, -33.75]); return L; };
  const fx = (L, n) => L.property('ADBE Effect Parade').children.find(c => c.name === n);
  const anim = (L, n) => L.property('ADBE Text Properties').property('ADBE Text Animators').children.find(c => c.name === n);
  const amt = a => a.property('ADBE Text Selectors').children[0].property('ADBE Text Expressible Amount').expression;
  const pv = (a, m) => a.property('ADBE Text Animator Properties').property(m).value;

  // Hero Zoom / Hero Blur / Blur Out: whole layer
  const hz = press('Hero Zoom', shape).L, sk = hz.transform.scale.keys, bk = fx(hz, 'Ru Hero Blur').children[0].keys, ok = hz.transform.opacity.keys;
  R['Hero Zoom: scale 320% -> 100% over 1.0 s, blur 80 -> 0, fade in 0.35 s'] = sk.length === 2 && sk[0].v[0] === 320 && sk[1].v[0] === 100 && near(sk[1].t - sk[0].t, 1.0) && bk.length === 2 && bk[0].v === 80 && bk[1].v === 0 && ok.length === 2 && ok[0].v === 0 && ok[1].v === 100 && near(ok[1].t - ok[0].t, 0.35);
  const hb = press('Hero Blur', shape).L;
  R['Hero Blur: scale 94% -> 100%, blur 36 -> 0, fade in 0.5 s'] = hb.transform.scale.keys[0].v[0] === 94 && hb.transform.scale.keys[1].v[0] === 100 && fx(hb, 'Ru Hero Blur').children[0].keys[0].v === 36 && near(hb.transform.opacity.keys[1].t - hb.transform.opacity.keys[0].t, 0.5);
  const bo = press('Blur Out', shape).L, ob = bo.transform.opacity.keys;
  R['Blur Out: scale 100% -> 92%, blur 0 -> 30, opacity 100 -> 100 -> 0 over 0.55 s'] = bo.transform.scale.keys[1].v[0] === 92 && fx(bo, 'Ru Blur Out').children[0].keys[1].v === 30 && ob.map(k => k.v).join() === '100,100,0' && near(ob[2].t - ob[0].t, 0.55);
  R['pressing Hero Blur again replaces the blur effect (one left)'] = (() => { const { comp, made } = fakeBuild(); app.project.activeItem = comp; const L = shape(comp, made); comp.selectedLayers = [L]; const b = walk(root).filter(x => x.type === 'button' && x.text === 'Hero Blur' && x.parent && x.parent.isBtnRow)[0]; b.onClick(); b.onClick(); app.project.activeItem = null; return L.property('ADBE Effect Parade').children.filter(c => c.name === 'Ru Hero Blur').length === 1; })();

  // Letter Blur
  const lb = press('Letter Blur', text('Hi there')).L, lsk = fx(lb, 'Ru Reveal').children[0].keys, la = anim(lb, 'Ru Letter Blur');
  R['Letter Blur: two keys 0 -> 0.525 s (7 x 0.035 + 0.28), opacity 0 + blur 16 + drop 10 on an expression selector'] = lsk.length === 2 && lsk[0].v === 0 && near(lsk[1].v, 0.525) && pv(la, 'ADBE Text Opacity') === 0 && pv(la, 'ADBE Text Blur')[0] === 16 && pv(la, 'ADBE Text Position 3D')[1] === 10 && la.property('ADBE Text Selectors').children[0].matchName === 'ADBE Text Expressible Selector';
  const L1 = (v, i) => ev(amt(la), v, i, 8);
  R['Letter Blur: each letter starts 0.035 s after the one before and eases out (hidden 100 -> 0)'] = L1(0, 1) === 100 && near(L1(0.525, 8), 0) && L1(0.1, 1) < L1(0.1, 2) && L1(0.1, 2) < L1(0.1, 3);

  // Delete Out: from the right
  const dl = press('Delete Out', text('Hi there')).L, da = anim(dl, 'Ru Delete Out'), D1 = (v, i) => ev(amt(da), v, i, 8);
  R['Delete Out: the last letter starts first (0.03 s apart), the first letter last; blur 14'] = near(fx(dl, 'Ru Delete').children[0].keys[1].v, 0.41) && D1(0.1, 8) > 0 && D1(0.1, 1) === 0 && D1(0.1, 8) > D1(0.1, 7) && near(D1(0.41, 1), 100) && pv(da, 'ADBE Text Blur')[0] === 14;

  // Word Highlight
  const wh = press('Word Highlight', text('Hi there you')).L, wa = anim(wh, 'Ru Word Highlight'), W1 = (v, i) => ev(amt(wa), v, i, 3);
  R['Word Highlight: teal fill; word 1 is teal while the highlight sits on it, then it moves on to word 2 (0.4 s per word)'] = pv(wa, 'ADBE Text Fill Color')[1] > 0.9 && W1(0.2, 1) === 100 && W1(0.2, 2) === 0 && W1(0.5, 1) < 30 && W1(0.5, 2) > 70 && W1(0.9, 3) > 70;
  R['Word Highlight: works when Based On stays on characters (letter 4 is the first letter of word 2)'] = near(ev(amt(wa), 0.5, 4, 12), W1(0.5, 2)) && near(ev(amt(wa), 0.5, 1, 12), W1(0.5, 1));

  // Two-Line Stack
  const ts = press('Two-Line Stack', text('Hi there\ryou now')).L, sa = anim(ts, 'Ru Stack'), S1 = (v, i) => ev(amt(sa), v, i, 4);
  R['Two-Line Stack: words of line 1 are never hidden; words of line 2 appear after 0.5 s, 0.08 s apart'] = S1(0, 1) === 0 && S1(0, 2) === 0 && S1(0.4, 3) === 100 && S1(0.98, 3) < 5 && S1(0.7, 3) < S1(0.7, 4) && fx(ts, 'Ru Stack').children[0].keys.length === 2;
  const pe = (v) => ev(ts.transform.position.expression, v, 0, 0, [960, 540]);
  R['Two-Line Stack: line 1 starts centred (block 54 px lower) and the block glides up to its own place'] = near(pe(0)[1], 594) && pe(0.98)[1] < 540.1 && pe(0.75)[1] > 540 && pe(0.75)[1] < 594;
  const one = press('Two-Line Stack', text('just one line')).L;
  R['Two-Line Stack: a single line is refused'] = !anim(one, 'Ru Stack');

  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`showreel styles: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// Quick Actions: Blur Fade In / Blur Fade Out replace the single Blur Fade button
{
  const R = {};
  const names = walk(root).filter(b => b.type === 'button').map(b => b.text);
  R['"Blur Fade" is gone, "Blur Fade In" and "Blur Fade Out" are there'] = names.indexOf('Blur Fade') < 0 && names.indexOf('Blur Fade In') >= 0 && names.indexOf('Blur Fade Out') >= 0;
  function press(label) {
    const { comp, made } = fakeBuild(); app.project.activeItem = comp; comp.time = 2;
    const L = baseLayer('shape'); L.name = 'Card'; made.push(L); comp.selectedLayers = [L];
    const bb = walk(root).filter(b => b.type === 'button' && b.text === label)[0]; bb.onClick(); app.project.activeItem = null;
    const e = L.property('ADBE Effect Parade').children.find(c => c.name === 'Ru Blur Fade');
    return { L, blur: e && e.children[0].keys, op: L.transform.opacity.keys };
  }
  const i = press('Blur Fade In'), o = press('Blur Fade Out');
  R['In: blur 40 -> 0 and opacity 0 -> 100'] = i.blur && i.blur[0].v === 40 && i.blur[1].v === 0 && i.op[0].v === 0 && i.op[i.op.length - 1].v === 100;
  R['Out: blur 0 -> 40 and opacity 100 -> 0'] = o.blur && o.blur[0].v === 0 && o.blur[1].v === 40 && o.op[0].v === 100 && o.op[o.op.length - 1].v === 0;
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`blur fade in/out: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// Fixed bar: Cut Before / Split / Cut After
{
  const R = {};
  const bt = n => walk(root).filter(b => b.type === 'button' && b.text === n && b.parent && b.parent.isBtnRow);
  R['three outline buttons Cut Before, Split, Cut After sit in one row directly in the window (not inside a card); the old names are gone'] = ['Cut Before', 'Split', 'Cut After'].every(n => bt(n).length === 1) && bt('Split')[0].parent === bt('Cut Before')[0].parent && bt('Split')[0].parent.parent === root && bt('Split')[0].variant === 'secondary' && ['Cut Left', 'Cut Right'].every(n => bt(n).length === 0);
  // quirk = true makes a layer behave like AE can: moving one end drags the other end along (the "right area gets longer" report)
  function run(label, quirk) {
    const { comp, made } = fakeBuild(); app.project.activeItem = comp; comp.time = 6;
    const mk = (a, b, name, locked) => {
      const L = baseLayer('shape'); L.name = name; L.locked = !!locked; made.push(L);
      let i = a, o = b;
      Object.defineProperty(L, 'inPoint', { get() { return i; }, set(v) { if (quirk) { o += (v - i) * 0.5; } i = v; }, configurable: true });
      Object.defineProperty(L, 'outPoint', { get() { return o; }, set(v) { o = v; }, configurable: true });
      L.duplicate = () => { const d = mk(L.inPoint, L.outPoint, L.name, false); return d; };
      return L;
    };
    const A = mk(0, 10, 'A'), B = mk(5, 15, 'B'), C = mk(8, 20, 'C'), D = mk(0, 10, 'D', true);       // C starts after the playhead, D is locked
    comp.selectedLayers = [A, B, C, D];
    bt(label)[0].onClick(); app.project.activeItem = null;
    return { A, B, C, D, made };
  }
  for (const quirk of [false, true]) {
    const tag = quirk ? ' (even when moving one end drags the other)' : '';
    const l = run('Cut Before', quirk), r = run('Cut After', quirk), c = run('Split', quirk);
    R['Cut Before: in point moves to the playhead (6 s), the out point stays' + tag] = l.A.inPoint === 6 && l.A.outPoint === 10 && l.B.inPoint === 6 && l.B.outPoint === 15;
    R['Cut After: out point moves to the playhead, the in point stays' + tag] = r.A.outPoint === 6 && r.A.inPoint === 0 && r.B.outPoint === 6 && r.B.inPoint === 5;
    R['layers the playhead is not inside, and locked layers, are left alone' + tag] = [l, r, c].every(x => x.C.inPoint === 8 && x.C.outPoint === 20 && x.D.inPoint === 0 && x.D.outPoint === 10);
    const copies = c.made.filter(x => x.name === 'A' && x !== c.A);
    R['Split: the original ends at the playhead, the copy starts there and ends EXACTLY where the original ended' + tag] = c.A.outPoint === 6 && c.A.inPoint === 0 && copies.length === 1 && copies[0].inPoint === 6 && copies[0].outPoint === 10 && c.B.outPoint === 6 && c.B.inPoint === 5 && c.made.filter(x => x.name === 'B').length === 2 && c.made.filter(x => x.name === 'B').every(x => x === c.B || (x.inPoint === 6 && x.outPoint === 15));
  }
  R['nothing is deleted: the layer count only grows with Split'] = run('Cut Before').made.length === 4 && run('Cut After').made.length === 4 && run('Split').made.length === 6;
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`cut bar: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// Header logo: the traced glyph (two white shapes on the blue rounded square), same curve as the artwork
{
  const R = {};
  const logo = walk(root).filter(n => n.type === 'group' && typeof n.onDraw === 'function' && n.preferredSize && (n.preferredSize[0] === 26 || n.preferredSize.width === 26) && (n.preferredSize[1] === 26 || n.preferredSize.height === 26))[0];
  R['the header logo exists'] = !!logo;
  const rec = gfx(), mv = rec.moveTo, ln = rec.lineTo, pts = [], fills = [];
  rec.moveTo = (x, y) => { mv(x, y); pts.push(['m', x, y]); }; rec.lineTo = (x, y) => { ln(x, y); pts.push(['l', x, y]); };
  const nb = rec.newBrush; rec.newBrush = (t, c) => { fills.push(c.join()); return nb(t, c); };
  logo.graphics = rec; logo.size = [26, 26]; logo.onDraw();
  const moves = pts.filter(p => p[0] === 'm').length, lines = pts.filter(p => p[0] === 'l').length;
  R['draws the two traced shapes (82 + 48 points) on top of the rounded square'] = moves >= 2 && lines >= 82 + 48 - 2;
  R['all glyph points stay inside the 26 px icon, and the glyph is white on the primary blue'] = pts.every(p => p[1] >= 0 && p[1] <= 26 && p[2] >= 0 && p[2] <= 26) && fills[0] !== fills[fills.length - 1];
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`logo: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// About window: opens once on the first run, then only from the About button in the header
{
  const R = {};
  R['first run: exactly one About dialog opened while the panel was built, and the flag is saved'] = windowsAtFirstRun === 1 && firstRunWin.windowArgs[0] === 'dialog' && settings['MotionKit_v1about_seen'] === '1';
  const w0 = windowsMade;
  const root3 = Object.assign(new Panel(), el('panel', 'root3'));
  run(...Object.values(g), root3);                                  // a second start with the flag already saved
  R['second start: no dialog'] = windowsMade === w0;
  const aboutB = walk(root).filter(n => n.type === 'button' && n.text === 'About' && n.parent && n.parent.parent === root)[0];
  R['the header has an About button (it replaced the "Toolkit" label)'] = !!aboutB && !walk(root).some(n => n.type === 'statictext' && n.text === 'Toolkit');
  aboutB.onClick();
  const dlg = lastWin, all = walk(dlg), texts = all.filter(n => n.type === 'statictext').map(n => n.text).join(' | ');
  R['clicking About opens a dialog with the name, version, how-to, credit and a Get started button'] = windowsMade === w0 + 1 && dlg.windowArgs[0] === 'dialog' && /About Ru Motion/.test(dlg.windowArgs[1]) && /Ru Motion/.test(texts) && /Version 1\.0/.test(texts) && /Select a layer/.test(texts) && /Click an effect/.test(texts) && /Retime/.test(texts) && /Made by Tharindu Lakshan/.test(texts) && /tlakshan10106@gmail\.com/.test(texts) && all.some(n => n.type === 'button' && n.text === 'Get started');
  R['the dialog says layers are named "Ru …" (not MK)'] = /Layers are named \u201CRu \u2026\u201D/.test(texts) && !/MK /.test(texts);
  let closed = false; dlg.close = () => { closed = true; };
  all.filter(n => n.type === 'button' && n.text === 'Get started')[0].onClick();
  R['Get started closes it'] = closed;
  const lg = all.filter(n => n.type === 'group' && typeof n.onDraw === 'function' && (n.preferredSize[0] === 64 || n.preferredSize.width === 64))[0];
  R['the dialog shows the logo at 64 px'] = !!lg && (() => { lg.size = [64, 64]; try { lg.onDraw(); return true; } catch (e) { return false; } })();
  // renamed prefix: nothing the tool creates is called MK any more; the old Bounce effect names are still recognised
  R['Ru Bounce is the new live-bounce effect name; old "MK Bounce" layers are still recognised'] = /"Ru Bounce"/.test(src) && /MK Bounce/.test(src) && !/"MK (Swipe|Star|Typewriter|Text)/.test(src);
  const bad = Object.keys(R).filter(k => !R[k]);
  console.log(`about window: ${bad.length === 0 ? 'all ' + Object.keys(R).length + ' checks OK' : 'WRONG: ' + bad.join('; ')}`);
}

// Lazy cards: with no eager flag only the visible feature is built, others appear when their tab is opened
{
  const prev = $g.global.RuMotionEager; $g.global.RuMotionEager = false;
  const rootL = Object.assign(new Panel(), el('panel', 'rootL'));
  run(...Object.values(g), rootL);
  const cardsAt = () => walk(rootL).filter(n => n.cardLevel === 0 && n.cardTitle).length;
  const first = cardsAt();
  const tile = walk(rootL).filter(n => n.type === 'button' && n.groupName === 'Camera')[0];
  if (tile) tile.onClick();
  const after = cardsAt();
  $g.global.RuMotionEager = prev;
  console.log(`lazy cards: ${first} built at start, ${after} after opening Camera -> ${first <= 2 && after === first + 1 ? 'OK' : 'WRONG'}`);
}
