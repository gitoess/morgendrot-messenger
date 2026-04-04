@echo off
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo Einmalig: npm install in diesem Ordner ausfuehren.
  pause
  exit /b 1
)
call npm start
