# Ru Motion

Google Vids–style motion toolkit for Adobe After Effects (ScriptUI panel).

## Install the panel
1. Copy `dist/RuMotion.jsx` into the **ScriptUI Panels** folder:
   - Windows: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   - macOS: `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
2. Restart After Effects → **Window › RuMotion.jsx**.

## Develop
```bash
npm install
npm run check      # build + lint + test
npx serve preview  # browser preview of the panel UI
```
See `CLAUDE.md` for architecture, ExtendScript rules and the design system.
