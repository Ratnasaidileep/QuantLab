@echo off
title QuantLab Terminal Launcher
echo ========================================================
echo               QUANTLAB WORKSTATION LAUNCHER             
echo ========================================================
echo.
echo [1/3] Checking environment...
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at .venv\Scripts\python.exe
    pause
    exit /b 1
)

echo [2/3] Starting FastAPI Backend on port 8000...
start "QuantLab Backend (FastAPI)" cmd /k ".venv\Scripts\python.exe -m uvicorn src.quantlab.api.main:app --reload --port 8000"

echo [3/3] Starting Vite Frontend on port 5173...
cd frontend
start "QuantLab Frontend (Vite)" cmd /k "npm run dev"

echo.
echo ========================================================
echo QuantLab is running!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo ========================================================
echo.
echo Press any key to open QuantLab in your default browser...
pause >nul
start http://localhost:5173
