@echo off
REM Runs one (or N) queued topics end-to-end. Used by Windows Task Scheduler.
REM Usage: run-queue.cmd [count]

setlocal
cd /d "%~dp0.."

set COUNT=%1
if "%COUNT%"=="" set COUNT=1

if not exist logs mkdir logs

echo [%date% %time%] starting queue run (count=%COUNT%) >> logs\scheduler.log
node src\cli.js queue --headless --count %COUNT% >> logs\scheduler.log 2>&1
set CODE=%ERRORLEVEL%
echo [%date% %time%] finished with exit code %CODE% >> logs\scheduler.log

exit /b %CODE%
