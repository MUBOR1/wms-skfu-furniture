# run_local.ps1 - WMS Furniture Factory Local Runner
# Usage: .\run_local.ps1

Write-Host "Starting WMS Furniture Factory..." -ForegroundColor Cyan

# Check we are in project root
if (!(Test-Path "backend/main.py") -or !(Test-Path "frontend/package.json")) {
    Write-Host "Error: Run this script from wms-skfu/ root folder" -ForegroundColor Red
    exit 1
}

# Start Backend
Write-Host "Starting Backend (FastAPI) on port 8000..." -ForegroundColor Green
$backend = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\Activate.ps1; uvicorn main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

# Wait for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend (React+Vite) on port 5173..." -ForegroundColor Green
$frontend = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -PassThru

# Done
Write-Host "`nServers started!" -ForegroundColor Cyan
Write-Host "Frontend: http://127.0.0.1:5173" -ForegroundColor Yellow
Write-Host "Swagger API: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "Press Ctrl+C in each window to stop servers" -ForegroundColor Gray