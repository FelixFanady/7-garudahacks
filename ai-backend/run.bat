@echo off
echo ==========================================================
echo    Starting PyResearch Pothole Detection Dashboard...
echo ==========================================================
cd /d "%~dp0"
if not exist .venv (
    echo Python virtual environment .venv not found! Creating one...
    python -m venv .venv
    echo Installing dependencies...
    .venv\Scripts\pip install flask opencv-python supervision ultralytics torch
)
echo Activating virtual environment and starting server...
call .venv\Scripts\activate
python app.py
pause
