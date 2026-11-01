# Rupa Motion — project guide for Claude Code

Rupa Motion (Rupa · රූප · "image, visual") is a dockable **ScriptUI panel for Adobe After Effects**
that builds Google Vids–style SaaS motion: shape morphs, pops, slides, cut transitions, kinetic text,
UI-kit elements, camera parallax and a live, toggleable bounce.

## Commands
- `npm install` — once (installs ESLint for the lint step)
- `npm run build` — concatenates `src/*.jsx` → `dist/RupaMotion.jsx` and syntax-checks it
- `npm run lint` — ESLint (ES5 parser, `no-undef`) on the built file
- `npm run test` — mock-ScriptUI smoke test: builds the panel, runs every custom draw routine,
  clicks every tab/chip/button with no comp open, checks nothing throws
- `npm run check` — all three. **Run this after every change.**

`dist/RupaMotion.jsx` is the only file the user installs. Never hand-edit it; edit `src/` and rebuild.

## Source layout (one IIFE split across files, joined in name order)
| File | Contents |
|---|---|
| `src/01_core.jsx` | Opens the IIFE. Settings (`app.settings`), style tokens + presets, colors, fonts, `run()` undo wrapper, easing (`CURVES`, `setKeys`), live bounce (`ensureBounce`, `bounceExpr`), property search |
| `src/02_builders.jsx` | Shape/text/effect/mask/matte/null builders, `makeFrosted`, `makePill`, `cameraPush`, `fxPointOffset` |
| `src/03_animation.jsx` | Shape morph, Pop, Move in/out, UI list stagger, Hold push-in |
| `src/04_transitions_text.jsx` | Zoom/swipe cuts, shape wipe; word swap, typing prompt, karaoke, title card, glow title |
| `src/05_uikit_media.jsx` | Pill button, frosted glass, AI glow button, fake cursor, avatar bubble, waveform, liquid glass; stock grid wall |
| `src/06_tools.jsx` | Layers group (pre-compose, unwrap composition, smart duplicate, null, adjustment, solid, follow path), Camera group, Shapes group, Quick Actions, Flow (`FLOW_PRESETS`, `doFlowApply`: cubic-bezier → AE temporal ease, optional `flowBounce` overshoot expression) |
| `src/07_ui.jsx` | Design system (`THEMES`, `DS`), UI helpers, every `feature(...)` panel, Style dialog, main panel; closes the IIFE |

Groups shown in the panel: Layers · Quick Actions · Flow · Camera · Shapes · Animation · Transitions · Text · UI Kit · Media · Style.
Add a feature with `feature("Group", "Name", function (p) { ... })` in `07_ui.jsx`; wrap its action in `run("Label", fn)`.

## ExtendScript rules (After Effects runs ES3!)
- No `let/const`, arrow functions, template strings, `Array.prototype.indexOf/map/forEach/filter`, `String.trim`, `JSON`.
  Use the helpers `trim`, `num`, `splitList`. ESLint runs with `ecmaVersion: 5` to catch most of this.
- **Expressions** written into AE must work in both the Legacy and JavaScript engines: use `add/sub/mul`
  for vector math, never `+`/`*` on arrays.
- After `addProperty()` on a property group, earlier references into that group can become invalid —
  re-fetch (see `addVec`, `addTextAnimator`). Add effects **before** grabbing other property references.
- Effect *point* parameters on **shape and text layers** are measured from the top-left of the comp-sized
  layer area, not the layer origin → add `fxPointOffset(L)` (half the comp size). Footage/solids need no offset.
- Locked gradients (`addLockedGradient`) feed Ramp points through `thisLayer.toComp()` on shape/text layers, so
  they move, scale and rotate with the element. Don't use a fixed half-comp offset there: it is only right while the
  layer sits at the comp center.
- Flow easing: untie keys (`setTemporalContinuousAtKey`/`AutoBezier` false) before `setTemporalEaseAtKey`, or later curves are
  rejected; read the ease back and retry. Linear is a bezier with handles on the straight line, not the Linear interpolation type.
- `layer.parent = x` keeps the layer from jumping (AE shifts the child's own position to cancel the parent's offset). So link first,
  while the parent is at rest, and only then set offsets on the parent (see `doSwipeCut`). Tests' fake layers must do the same.
- Track mattes: use `setMatte()` (new `setTrackMatte` API on AE 2023+, falls back to `trackMatteType`).
- Drop Shadow opacity is stored 0–255 (38 ≈ 15%).

## ScriptUI rendering rules (learned the hard way)
- **Never put `onDraw` on a container that holds controls.** AE then stops drawing the children
  (only native edittexts survive). Custom drawing is allowed only on leaf elements: buttons, empty groups.
- AE paints every group with a solid background, so a "card" is a group with `graphics.backgroundColor`
  plus a bold `statictext` title (`card()` in `07_ui.jsx`). Large cards can't have rounded corners;
  buttons, chips, toggles, tab tiles and the logo are custom-drawn and rounded (`rrPath`).
- Native edittext/dropdown always render dark, which is why the panel ships a single **dark** theme.
- Redraw a custom control with `redraw(ctrl)` (`notify("onDraw")`) or `repaint(ctrl)` (hide/show). Buttons made by
  `styleButton` show a pressed state on mouse down; `btn()` keeps it through the action so quick clicks are visible. Toggles expose `.value` and `.onToggle`.

## Design system (dark)
page `#1C1D20` · surface `#232428` · card `#2B2D31` · hairline `#3C3E43` · text `#F1F2F4` · label `#BEC0C4` ·
hint `#90939A` · primary `#0A6CFF` · tint `#1E3357`. Pill buttons: primary = solid blue (main action),
secondary = card fill + hairline (grids, rows). Feature chips: `chip` / `chip-on`. Type: title 15 bold,
section 13/12 bold, body 12, nav 10. Tokens live in `THEMES` at the top of the design-system block.

## Brand/motion style (applied by the tools)
Google Vids look: primary `#4285F4`, secondary `#8AB4F8`, periwinkle `#C5CAE9`, background `#F5F7FF`,
Google Sans → Inter → Manrope → DM Sans → Outfit. Expo easing by default, motion blur on, soft shadows,
live bounce via the `MK Bounce` / `MK Bounce Strength` effects + `bounceExpr`. Users edit these in Style.

## Naming / compatibility
- Created layers/effects keep the `MK ` prefix and the `"Motion Kit"` marker in expression comments on
  purpose: existing projects depend on them (`hasBounce`, Bounce Physics' "own expression" check).
- Swipe cut builds three linked `MK Swipe · Move / Out / In` nulls (anchor and position 0,0 so links don't move clips); only the
  Move null is animated. Don't turn it back into an effect on an adjustment layer. The move is short (27% of the frame, 15
  frames each side, keys at cut-16 and cut+15, ease 0.9/0/0.1/1) and the clips are trimmed to a hard cut: both numbers come from
  measuring a hand-made version, so keep them unless asked.
- Settings key is `MotionKit_v1` so saved presets carry over. Don't rename without a migration.

## Testing limits
Tests use a mock ScriptUI/AE object model — they catch syntax, ES3, undefined names, draw-routine and
navigation errors, but **not** real After Effects behaviour. Verify visual/AE changes inside After Effects.

## preview/
`preview/index.html` is a standalone browser mock-up of the panel UI (no AE). Run `npx serve preview`.
Keep it in sync when the panel layout changes.
