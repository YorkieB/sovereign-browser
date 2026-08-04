@echo off
setlocal
cd /d "%~dp0"

set "BACKEND=%USERPROFILE%\Projects\sovereign-browser\privacy-search-engine\backend"

echo Checking search backend...
curl -s -o nul -m 3 http://localhost:3001/health
if errorlevel 1 (
  if exist "%BACKEND%\server.js" (
    echo   starting Brave search backend...
    start "SovereignBrowser backend" /min cmd /c "cd /d "%BACKEND%" && node server.js"
    timeout /t 5 /nobreak >nul
  ) else (
    echo   backend not found - news panel will be hidden
  )
) else (
  echo   already running
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo ERROR: Electron not installed. Run: npm install
  pause
  exit /b 1
)

echo Starting Sovereign Browser...
start "" "%CD%\node_modules\electron\dist\electron.exe" "%CD%"
endlocal
