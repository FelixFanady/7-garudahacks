@echo off
echo ==========================================================
echo    Starting SIGAP JALAN Pothole Detection Dashboard...
echo ==========================================================
cd /d "%~dp0"
if not exist .venv (
    echo Python virtual environment .venv not found! Creating one...
    python -m venv .venv
)
echo Verifying/installing dependencies from requirements.txt...
.venv\Scripts\pip install -r requirements.txt
echo Activating virtual environment and starting server...
call .venv\Scripts\activate
python -u app.py
pause
