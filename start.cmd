@echo off
REM Morgendrot starten. Nutzt node\node.exe falls vorhanden (portable Node im Ordner), sonst systemweites node.
setlocal
set "NODE=node"
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"
"%NODE%" "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0src\wallet-bridge.ts"
endlocal
