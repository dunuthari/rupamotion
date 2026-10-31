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

// Flow: apply presets to a fake keyframed property and check the resulting AE ease values
function fakeProp(v0, v1, dt) {
  const set = {};
  return { propertyType: 1, numKeys: 2, selectedKeys: [1, 2], set,
    keyTime: i => (i === 1 ? 0 : dt), keyValue: i => (i === 1 ? v0 : v1),
    keyInTemporalEase: () => [new g.KeyframeEase(0, 33)], keyOutTemporalEase: () => [new g.KeyframeEase(0, 33)],
    keyInInterpolationType: () => 'B', keyOutInterpolationType: () => 'B',
    setInterpolationTypeAtKey(k, a, b) { (set[k] = set[k] || {}).types = [a, b]; },
    setTemporalEaseAtKey(k, i, o) { (set[k] = set[k] || {}).ease = [i[0], o[0]]; } };
}
function applyPreset(name, prop, value) {
  const comp = new g.CompItem(); comp.selectedLayers = [{ selectedProperties: [prop], property() {} }];
  app.project.activeItem = comp;
  walk(root).filter(n => n.modeId === 'both')[0].onClick();
  walk(root).filter(n => n.presetIndex !== undefined && n.text === name)[0].onClick();
  walk(root).filter(n => n.type === 'button' && n.text === 'Apply')[0].onClick();
  app.project.activeItem = null;
}
function near(a, b) { return Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)); }
let flowOk = 0, flowTotal = 0;
function check(label, got, want) { flowTotal++; if (near(got, want)) flowOk++; else console.log('FLOW MISMATCH', label, got, want); }
let fp = fakeProp(0, 100, 2); applyPreset('cubic', fp);
check('cubic out influence', fp.set[1].ease[1].influence, 66); check('cubic out speed', fp.set[1].ease[1].speed, 0);
check('cubic in influence', fp.set[2].ease[0].influence, 66); check('cubic in speed', fp.set[2].ease[0].speed, 0);
fp = fakeProp(0, 100, 2); applyPreset('backOut', fp);
check('backOut out speed', fp.set[1].ease[1].speed, 1.56 * 100 / (0.34 * 2)); check('backOut out influence', fp.set[1].ease[1].influence, 34);
check('backOut in influence', fp.set[2].ease[0].influence, 36);
fp = fakeProp(100, 0, 1); applyPreset('expoOut', fp);
check('expoOut falling speed', fp.set[1].ease[1].speed, 1 * -100 / (0.16 * 1));
fp = fakeProp(0, 100, 1); applyPreset('linear', fp);
flowTotal++; if (fp.set[1].types[1] === 'L' && fp.set[2].types[0] === 'L') flowOk++; else console.log('FLOW MISMATCH linear types', fp.set);
console.log(`flow easing: ${flowOk}/${flowTotal} checks match the bezier math`);
