Ru Motion - CEP panel
=====================
Windows: double-click RuMotion-Setup.exe (or install.bat).   Mac: double-click install.command (if it is blocked, right-click > Open).
Then restart After Effects and open  Window > Extensions > Ru Motion.

By hand:
 1. Copy the RuMotion folder to
      Windows: %APPDATA%\Adobe\CEP\extensions\
      Mac:     ~/Library/Application Support/Adobe/CEP/extensions/
 2. Allow unsigned extensions (PlayerDebugMode = 1) for CSXS 9 to 13:
      Windows: regedit > HKEY_CURRENT_USER\Software\Adobe\CSXS.<n> > New String Value "PlayerDebugMode" = 1
      Mac:     defaults write com.adobe.CSXS.<n> PlayerDebugMode 1
 3. Restart After Effects.
