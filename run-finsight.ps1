$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$backendPython = Join-Path $backendDir "venv\Scripts\python.exe"
$frontendCmd = "npm.cmd"

if (-not (Test-Path $backendPython)) {
  throw "Backend Python not found at $backendPython. Please create the backend venv first."
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "`"$backendPython`" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000" -WorkingDirectory $backendDir
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$frontendDir`" && npm run dev -- --hostname 127.0.0.1 --port 3000" -WorkingDirectory $frontendDir

Write-Host "FinSight is starting..."
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Frontend: http://127.0.0.1:3000"
Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:3000"
