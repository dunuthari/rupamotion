// Builds the CEP extension folder cep/RuMotion/ (and cep/RuMotion-CEP.zip when `zip` is available):
//   CSXS/manifest.xml · index.html (CSS + markup from preview/index.html, script from cep/app.js) · jsx/RuMotion.jsx (dist build)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { build } = require("../build.js");

const root = path.join(__dirname, "..");
const out = path.join(__dirname, "RuMotion");
build({});

const preview = fs.readFileSync(path.join(root, "preview", "index.html"), "utf8");
const style = preview.match(/<style>[\s\S]*?<\/style>/)[0];
let body = preview.slice(preview.indexOf("<body>") + 6, preview.indexOf("<script>"));
body = body.replace(/<p class="note">[\s\S]*?<\/p>/, "");
const icons = preview.match(/var ICONS = \{[\s\S]*?\n  \};/)[0];
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8").replace("/*__ICONS__*/", () => icons);
const transcribe = fs.readFileSync(path.join(__dirname, "transcribe.js"), "utf8");

const extra = `<style>
  /* CEP: the panel fills the dock, the content scrolls (mouse wheel works here) */
  html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
  .stage { max-width: none; width: 100%; height: 100vh; min-height: 0; padding: 0; margin: 0; display: block; }
  .panel { max-width: none; width: 100%; height: 100vh; max-height: 100vh; overflow: hidden; border-radius: 0; box-shadow: none; border: 0; display: flex; flex-direction: column; padding: 12px; box-sizing: border-box; gap: 10px; }
  .panel .head { flex: none; }
  .panel .body { flex: 1 1 auto; min-height: 0; grid-template-rows: minmax(0, 1fr); }
  .panel .nav { align-self: start; }
  .panel .body { align-items: stretch; }
  .panel .content.scroll { height: auto; align-self: stretch; min-height: 0; max-height: 100%; overflow-y: auto; align-content: start; scroll-behavior: smooth; padding-right: 6px; }
  .panel .cutbar { flex: none; margin-top: 0 !important; }
  .btn.busy { opacity: .6; }
  select { max-width: 100%; }
  input[type=text] { box-sizing: border-box; padding: 0 6px; }
  .flow-graph { height: 190px; }
  .ted-list { display: grid; gap: 6px; max-height: 330px; overflow-y: auto; padding-right: 4px; }
  .ted-row { display: grid; grid-template-columns: 62px minmax(0, 1fr) 28px; gap: 8px; align-items: stretch; }
  .ted-time { width: 100% !important; height: 100%; min-height: 34px; text-align: center; font-weight: 600; padding: 0 4px; }
  .ted-text { background: var(--input, #17181B); color: var(--text); border: 1px solid transparent; border-radius: 9px; padding: 8px 10px; font-size: 13px; line-height: 1.35; min-height: 34px; outline: none; word-break: break-word; }
  .ted-text:focus { border-color: var(--primary); }
  .ted-plus { align-self: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--hairline); background: transparent; color: var(--label); display: grid; place-items: center; cursor: pointer; padding: 0; }
  .ted-plus svg { width: 12px; height: 12px; }
  .cs-stage { position: sticky; top: 0; z-index: 6; box-shadow: 0 10px 18px -8px rgba(0,0,0,.6); aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; border: 1px solid var(--hairline); background: linear-gradient(135deg, #4a5a58, #2d3a3f 55%, #59482f); --hl: #E8A23A; --hl-text: #fff; --rad: 10px; --dim: .45; }
  .cs-stage::after { content: ""; position: absolute; inset: 0; background: radial-gradient(80% 60% at 50% 100%, rgba(0,0,0,.55), transparent); pointer-events: none; }
  .cs-caps { position: absolute; left: 0; right: 0; bottom: 12%; z-index: 2; display: flex; justify-content: center; padding: 0 6%; }
  .cs-line { display: flex; flex-wrap: wrap; justify-content: center; gap: .1em .28em; font-family: "Poppins", "Segoe UI", system-ui, sans-serif; font-weight: 700; font-size: 22px; color: #fff; line-height: 1.35; }
  .cs-w { position: relative; z-index: 1; padding: .02em .2em; border-radius: var(--rad); transition: color .08s, opacity .08s, transform .12s, background .08s; }
  .cs-line.dimmed .cs-w { opacity: var(--dim); }
  .cs-line.dimmed .cs-w.on { opacity: 1; }
  .cs-line.m-box .cs-w.on { background: var(--hl); color: var(--hl-text); }
  .cs-line.m-color .cs-w.on { color: var(--hl); }
  .cs-line.m-pop .cs-w.on { color: var(--hl); transform: scale(1.18); }
  .cs-line.m-under .cs-w { background-image: linear-gradient(var(--hl), var(--hl)); background-repeat: no-repeat; background-position: 0 100%; background-size: 0 3px; border-radius: 0; transition: background-size .12s; }
  .cs-line.m-fill .cs-w { background-image: linear-gradient(90deg, var(--hl), var(--hl)); background-repeat: no-repeat; background-size: 0% 100%; -webkit-background-clip: text; background-clip: text; color: rgba(255,255,255,.55); }
  .cs-line.m-fill .cs-w.done, .cs-line.m-fill .cs-w.on { color: var(--hl); }
  .cs-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .cs-tile { text-align: left; color: var(--text); background: var(--surface); border: 1px solid var(--hairline); border-radius: 10px; padding: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; min-width: 0; font: inherit; }
  .cs-tile[aria-pressed="true"] { border-color: var(--primary); background: var(--tint); }
  .cs-tile b { font-size: 12px; }
  .cs-tile .s { font-size: 11px; color: var(--hint); }
  .cs-mini { height: 30px; border-radius: 6px; background: #15161a; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 700; font-size: 11px; overflow: hidden; color: #fff; }
  .cs-mini .d { opacity: .45; }
  .cs-mini.mm-box .a { background: #E8A23A; border-radius: 4px; padding: 0 5px; }
  .cs-mini.mm-color .a, .cs-mini.mm-pop .a { color: #E8A23A; }
  .cs-mini.mm-pop .a { transform: scale(1.2); }
  .cs-mini.mm-under .a { box-shadow: inset 0 -2px #E8A23A; }
  .cs-mini.mm-fill .d:first-child { color: #E8A23A; opacity: 1; }
  .cs-mini.mm-fill .a { color: #E8A23A; }
  .cs-mini.mm-plain .d { opacity: 1; }
  .cs-val { font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: var(--hint); min-width: 40px; text-align: right; }
  .cs-seg { display: flex; gap: 6px; }
  .cs-seg button { font: inherit; font-size: 12px; font-weight: 700; color: var(--label); background: var(--surface); border: 1px solid var(--hairline); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
  .cs-seg button[aria-pressed="true"] { border-color: var(--primary); color: var(--primary); background: var(--tint); }
  .pv-stage { position: sticky; top: 0; z-index: 6; box-shadow: 0 10px 18px -8px rgba(0,0,0,.6); aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; border: 1px solid var(--hairline); background: linear-gradient(135deg, #34383f, #1d1f24); display: grid; place-items: center; }
  .pv-txt { font-family: "Poppins", "Segoe UI", system-ui, sans-serif; font-weight: 700; font-size: 20px; color: #fff; text-align: center; line-height: 1.25; padding: 0 6%; }
  .pv-ln { display: block; white-space: nowrap; }
  .pv-clip { overflow: hidden; height: 1.25em; }
  .pv-u { display: inline-block; white-space: pre; }
  .pv-caret { display: inline-block; width: 2px; height: 1em; background: #fff; vertical-align: -.12em; margin-left: 2px; }
  .pv-name { position: absolute; left: 8px; top: 6px; font-size: 11px; font-weight: 700; color: var(--hint); background: rgba(0,0,0,.4); padding: 2px 8px; border-radius: 99px; }
  .pv-note { position: absolute; right: 8px; top: 8px; font-size: 11px; color: var(--hint); }
  .pv-ti { display: flex; align-items: center; justify-content: center; font-family: "Poppins", "Segoe UI", system-ui, sans-serif; font-weight: 700; color: #BFC3C8; font-size: 18px; white-space: nowrap; }
  .pv-ti span { display: inline-block; }
  .pv-ico { width: 1.1em; height: 1.1em; }
  .btn.pv-on { border-color: var(--primary); background: var(--tint); color: var(--primary); }
  .an-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 24px 24px; }
  .an-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.08); z-index: 2; }
  .an-bar i { display: block; height: 100%; width: 0; background: var(--primary); }
  .an-lay { position: absolute; left: 50%; top: 50%; width: 96px; height: 60px; margin: -30px 0 0 -48px; border-radius: 12px; background: var(--primary); display: flex; flex-direction: column; gap: 6px; padding: 12px; will-change: transform, opacity, filter; }
  .an-lay i { display: block; height: 6px; border-radius: 3px; background: rgba(16,16,16,.55); }
  .an-lay i:nth-child(1) { width: 60%; } .an-lay i:nth-child(2) { width: 100%; } .an-lay i:nth-child(3) { width: 80%; }
  .an-lay.an-small { width: 72px; height: 44px; padding: 9px 10px; margin-top: -22px; }
  .an-lay.an-circle { width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; padding: 0; }
  .an-lay.an-square { width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 14px; background: #F1F2F4; padding: 0; }
  .an-rows { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; gap: 7px; width: 62%; }
  .an-rows .an-lay { position: static; margin: 0; width: 100%; height: 26px; padding: 0 10px; border-radius: 7px; flex-direction: row; align-items: center; background: #F1F2F4; }
  .an-rows .an-lay i { height: 6px; margin: 0; }
  .an-rows .an-lay i:nth-child(1) { width: 14px; height: 14px; border-radius: 50%; flex: none; background: var(--primary); border: 2px solid rgba(16,16,16,.5); }
  .an-rows .an-lay i:nth-child(2) { width: 45%; } .an-rows .an-lay i:nth-child(3) { width: 20%; margin-left: auto; }
  .an-photo { position: absolute; inset: 0; background: linear-gradient(160deg, #7a5cff 0%, #c158be 45%, #ff8a5c 100%); will-change: transform; }
  .an-photo::after { content: ""; position: absolute; left: 14%; bottom: 18%; width: 40%; height: 12%; border-radius: 8px; background: rgba(255,255,255,.85); }
  .an-photo::before { content: ""; position: absolute; left: 14%; bottom: 34%; width: 26%; height: 7%; border-radius: 6px; background: rgba(255,255,255,.55); }
  .ted-plus:hover { border-color: var(--primary); color: var(--primary); }
  .cap-status { display: grid; gap: 6px; }
  .cap-status .bar { height: 6px; border-radius: 999px; background: var(--hairline); overflow: hidden; }
  .cap-status .bar i { display: block; height: 100%; width: 0; background: var(--primary); transition: width .2s; }
  .cap-status .bar.ind i { width: 35%; animation: capind 1.1s ease-in-out infinite alternate; }
  @keyframes capind { from { margin-left: 0; } to { margin-left: 65%; } }
  .cap-status.err .hint { color: #FF6B6B; }
  .cap-status[hidden] { display: none; }
</style>`;

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<title>Ru Motion</title>
${style}
${extra}
</head>
<body>
${body}
<script>
${transcribe}
</script>
<script>
${app}
</script>
</body>
</html>
`;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "CSXS"), { recursive: true });
fs.mkdirSync(path.join(out, "jsx"), { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
fs.copyFileSync(path.join(root, "dist", "RuMotion.jsx"), path.join(out, "jsx", "RuMotion.jsx"));
fs.writeFileSync(path.join(out, "CSXS", "manifest.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest Version="7.0" ExtensionBundleId="com.rumotion.panel" ExtensionBundleVersion="1.0.0" ExtensionBundleName="Ru Motion"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ExtensionList>
    <Extension Id="com.rumotion.panel.main" Version="1.0.0"/>
  </ExtensionList>
  <ExecutionEnvironment>
    <HostList>
      <Host Name="AEFT" Version="[16.0,99.9]"/>
    </HostList>
    <LocaleList>
      <Locale Code="All"/>
    </LocaleList>
    <RequiredRuntimeList>
      <RequiredRuntime Name="CSXS" Version="9.0"/>
    </RequiredRuntimeList>
  </ExecutionEnvironment>
  <DispatchInfoList>
    <Extension Id="com.rumotion.panel.main">
      <DispatchInfo>
        <Resources>
          <MainPath>./index.html</MainPath>
          <CEFCommandLine>
            <Parameter>--enable-nodejs</Parameter>
            <Parameter>--mixed-context</Parameter>
          </CEFCommandLine>
        </Resources>
        <Lifecycle>
          <AutoVisible>true</AutoVisible>
          <StartOn>
            <Event>com.adobe.csxs.events.ApplicationActivate</Event>
          </StartOn>
        </Lifecycle>
        <UI>
          <Type>Panel</Type>
          <Menu>Ru Motion</Menu>
          <Geometry>
            <Size><Width>440</Width><Height>780</Height></Size>
            <MinSize><Width>360</Width><Height>420</Height></MinSize>
            <MaxSize><Width>900</Width><Height>2000</Height></MaxSize>
          </Geometry>
        </UI>
      </DispatchInfo>
    </Extension>
  </DispatchInfoList>
</ExtensionManifest>
`);

try { fs.rmSync(path.join(__dirname, "RuMotion-CEP.zip"), { force: true }); } catch (e) {}
try {
  execSync("zip -qr RuMotion-CEP.zip RuMotion install.bat install.command README.txt", { cwd: __dirname });
  console.log("zip: cep/RuMotion-CEP.zip");
} catch (e) { console.log("zip not available; copy the cep folder as is"); }
console.log("Built cep/RuMotion (" + Math.round(html.length / 1024) + " KB html, jsx " + Math.round(fs.statSync(path.join(out, "jsx", "RuMotion.jsx")).size / 1024) + " KB)");
