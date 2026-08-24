@echo off
setlocal
cd /d "%~dp0.."

set BLOG=%~1
if "%BLOG%"=="" set BLOG=happytigers
set CATEGORY=%~2

if not exist logs mkdir logs
echo. >> logs\scheduler.log
echo [%date% %time%] === follow start (%BLOG%) >> logs\scheduler.log
node src\cli.js follow --show --source-blog "%BLOG%" --source-category "%CATEGORY%" >> logs\scheduler.log 2>&1
set CODE=%ERRORLEVEL%
echo [%date% %time%] === follow end (exit %CODE%) >> logs\scheduler.log
exit /b %CODE%
