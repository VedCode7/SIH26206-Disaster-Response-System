@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo        RADAR AI - OFFLINE SETUP
echo ========================================
echo.

if not exist "requirements.txt" (
    echo ERROR: requirements.txt not found.
    pause
    exit /b 1
)

if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv

    if errorlevel 1 (
        echo ERROR: Could not create virtual environment.
        pause
        exit /b 1
    )
) else (
    echo Virtual environment already exists.
)

call ".venv\Scripts\activate.bat"

echo.
echo Installing dependencies from offline_packages...
pip install --no-index --find-links="offline_packages" -r requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Dependency installation failed.
    echo Make sure offline_packages contains all required packages.
    pause
    exit /b 1
)

echo.
echo ========================================
echo        SETUP COMPLETE
echo ========================================
echo.
echo You can now run run.bat
echo.
pause