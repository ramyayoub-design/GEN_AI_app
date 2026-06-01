@echo off
echo Starting FlatDream...
cd /d "%~dp0"
start "" "http://localhost:3000"
python -m http.server 3000
pause