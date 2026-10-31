// Concatenates src/*.jsx (in file-name order) into dist/RupaMotion.jsx.
// The source files are slices of ONE ExtendScript IIFE: 01_core opens it, 07_ui closes it.
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "src");
const out = path.join(__dirname, "dist", "RupaMotion.jsx");
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".jsx")).sort();

const code = files.map((f) => fs.readFileSync(path.join(srcDir, f), "utf8")).join("");
new Function(code); // syntax check (throws on error)
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, code);
console.log(`Built ${path.relative(__dirname, out)} from ${files.length} files (${code.split("\n").length} lines).`);
