@echo off
REM Ru Motion (CEP) installer for Windows: copies the panel and allows unsigned extensions.
set "DEST=%APPDATA%\Adobe\CEP\extensions\RuMotion"
echo Installing Ru Motion to %DEST%
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy /e /i /y "%~dp0RuMotion" "%DEST%" >nul
for %%V in (9 10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo.
echo Done. Restart After Effects, then open Window ^> Extensions ^> Ru Motion.
pause
