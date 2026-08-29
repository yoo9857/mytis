@echo off
setlocal
cd /d "%~dp0.."

set BLOG=%~1
if "%BLOG%"=="" set BLOG=happytigers
set CATEGORY=%~2
set TARGET=%~3
set TARGET_CATEGORY=%~4

set TARGET_ARGS=
if not "%TARGET%"=="" set TARGET_ARGS=--target-blog "%TARGET%"
if not "%TARGET_CATEGORY%"=="" set TARGET_ARGS=%TARGET_ARGS% --target-category "%TARGET_CATEGORY%"

if not exist logs mkdir logs
echo. >> logs\scheduler.log
echo [%date% %time%] === follow start (%BLOG%) >> logs\scheduler.log
node src\cli.js follow --headless --source-blog "%BLOG%" --source-category "%CATEGORY%" %TARGET_ARGS% >> logs\scheduler.log 2>&1
set CODE=%ERRORLEVEL%
echo [%date% %time%] === follow end (exit %CODE%) >> logs\scheduler.log
exit /b %CODE%
