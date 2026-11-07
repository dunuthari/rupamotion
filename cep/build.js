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
