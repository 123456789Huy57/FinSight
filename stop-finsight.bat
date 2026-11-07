@echo off
setlocal

echo Stopping FinSight local dev processes...
for %%P in (8000 3000) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo Done.
endlocal
