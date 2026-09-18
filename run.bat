@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo          RADAR AI
echo   DISASTER RESPONSE SYSTEM
echo ========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found.
    echo.
    echo Please run setup.bat first.
    pause
    exit /b 1
)

if not exist "frontend\index.html" (
    echo ERROR: frontend\index.html not found.
    pause
    exit /b 1
)

echo Starting RADAR AI backend...
start "RADAR AI - Backend" cmd /k "cd /d ""%~dp0"" && call .venv\Scripts\activate.bat && uvicorn backend.app.main:app --reload"

timeout /t 2 /nobreak >nul

echo Starting RADAR AI frontend...
start "RADAR AI - Frontend" cmd /k "cd /d ""%~dp0"" && call .venv\Scripts\activate.bat && python -m http.server 5500 --directory frontend"

timeout /t 2 /nobreak >nul

echo Opening RADAR AI dashboard...
start "" "http://localhost:5500"

echo.
echo ========================================
echo          RADAR AI IS RUNNING
echo ========================================
echo.
echo Frontend : http://localhost:5500
echo Backend  : http://127.0.0.1:8000
echo.
echo Keep the Backend and Frontend windows open.
echo Close them when the demo is finished.
echo.
pause