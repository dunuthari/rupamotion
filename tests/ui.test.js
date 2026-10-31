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
const settings = {}; let scheduled = null;
const $g = { global: {}, colorPicker: ()=>-1 };
const app = { settings:{haveSetting:(s,k)=>(s+k) in settings,getSetting:(s,k)=>settings[s+k],saveSetting:(s,k,v)=>{settings[s+k]=v;}},
  project:{activeItem:null}, fonts:null, beginUndoGroup(){}, endUndoGroup(){}, scheduleTask(code){ scheduled = code; } };
function Panel(){}; let lastWin = null; function Window(){ lastWin = el('window'); return lastWin; }
const g = { app, Panel, Window, $: $g, alert: ()=>{}, ScriptUI: { newFont:(f,s,z)=>({f,s,z}) },
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
  const P = { propertyType: 1, numKeys: keys.length, keys, selectedKeys: keys.map((k, i) => i + 1),
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
  const want = presetData[nm];
  if (nm === 'linear') {
    const ok = FP.keys[0].outT === 'L' && FP.keys[1].inT === 'L' && FP.keys[1].outT === 'L' && FP.keys[2].inT === 'L';
    if (!ok) { wrong++; console.log('FLOW linear types wrong'); }
    return;
  }
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
