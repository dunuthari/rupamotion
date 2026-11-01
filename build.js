// Concatenates src/*.jsx (in file-name order) into dist/RupaMotion.jsx.
// The source files are slices of ONE ExtendScript IIFE: 01_core opens it, 07_ui closes it.
// presets/text/*.ffx are embedded (base64) into TEXT_PRESETS, so the built file is still the only thing to install.
const fs = require("fs");
const path = require("path");

const baseName = (f) => f.replace(/\.ffx$/i, "").toLowerCase();
const byName = (a, b) => (baseName(a) < baseName(b) ? -1 : baseName(a) > baseName(b) ? 1 : 0);

function presetLiteral(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.ffx$/i.test(f)).sort(byName) : [];
  const items = files.map((f) => {
    let name = f.replace(/\.ffx$/i, "").replace(/[-_]+/g, " ").trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const b64 = fs.readFileSync(path.join(dir, f)).toString("base64");
    const lines = b64.match(/.{1,100}/g) || [""];
    return `{ name: ${JSON.stringify(name)}, data: ${lines.map((l) => JSON.stringify(l)).join(" +\n            ")} }`;
  });
  const names = files.map((f) => { const n = f.replace(/\.ffx$/i, "").replace(/[-_]+/g, " ").trim(); return n.charAt(0).toUpperCase() + n.slice(1); });
  return { literal: items.length ? "[\n        " + items.join(",\n        ") + "\n    ]" : "[]", count: items.length, names };
}

function build(opts) {
  opts = opts || {};
  const srcDir = opts.srcDir || path.join(__dirname, "src");
  const out = opts.out || path.join(__dirname, "dist", "RupaMotion.jsx");
  const presetsDir = opts.presetsDir || path.join(__dirname, "presets", "text");
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".jsx")).sort();
  const presets = presetLiteral(presetsDir);

  let code = files.map((f) => fs.readFileSync(path.join(srcDir, f), "utf8")).join("");
  if (!code.includes("/*__TEXT_PRESETS__*/ []")) throw new Error("TEXT_PRESETS marker not found in src");
  code = code.replace("/*__TEXT_PRESETS__*/ []", () => presets.literal);
  new Function(code); // syntax check (throws on error)
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, code);
  const synced = opts.syncPreview ? syncPreview(presets.names, opts.previewFile || path.join(__dirname, "preview", "index.html")) : false;
  return { out, files: files.length, lines: code.split("\n").length, presets: presets.count, synced };
}

// The preview page lists the same buttons; rewrite the block between the markers so it can't drift
function syncPreview(names, file) {
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, "utf8");
  const re = /\/\*TEXT_PRESET_BUTTONS\*\/[\s\S]*?\/\*END_TEXT_PRESET_BUTTONS\*\//;
  if (!re.test(html)) return false;
  const rows = names.map((n) => `ROW([[${JSON.stringify(n)}, ${JSON.stringify("Applied the " + n + " preset.")}]], "one")`);
  const next = html.replace(re, () => `/*TEXT_PRESET_BUTTONS*/ ${rows.join(", ")} /*END_TEXT_PRESET_BUTTONS*/`);
  if (next !== html) fs.writeFileSync(file, next);
  return true;
}

module.exports = { build };

if (require.main === module) {
  const r = build({ syncPreview: true });
  console.log(`Built ${path.relative(__dirname, r.out)} from ${r.files} files (${r.lines} lines, ${r.presets} text preset${r.presets === 1 ? "" : "s"}${r.synced ? ", preview synced" : ""}).`);
}
