@echo off
REM ============================================================================
REM  스타·연예인 자동 발행
REM
REM  최신 연예 기사를 화제도 순으로 수집해 큐에 넣고, 그중 N개를 발행한다.
REM  기사 URL 이 큐에 들어가므로 파이프라인이 자동으로 '기사 기반' 모드로 돈다:
REM    원문 사진 확보 → 관련 기사에서 추가 수집 → 얼굴 기준 대표 선별
REM    → 카테고리 자동 선택 → 공식 유튜브 임베드
REM
REM  사용:  run-star.cmd [발행개수] [수집개수]
REM  예:    run-star.cmd 2 6      (6건 수집해 2건 발행)
REM ============================================================================

setlocal
cd /d "%~dp0.."

set POST=%1
if "%POST%"=="" set POST=1
set FIND=%2
if "%FIND%"=="" set FIND=5

if not exist logs mkdir logs

echo. >> logs\scheduler.log
echo [%date% %time%] === 스타/연예 자동 발행 시작 (수집 %FIND% / 발행 %POST%) >> logs\scheduler.log

REM 1) 최신 연예 기사 수집 → topics.txt 에 추가
node src\cli.js news --add --count %FIND% >> logs\scheduler.log 2>&1
if errorlevel 1 (
  echo [%date% %time%] 기사 수집 실패 - 기존 큐로 진행합니다 >> logs\scheduler.log
)

REM 2) 큐에서 꺼내 발행
node src\cli.js queue --headless --count %POST% >> logs\scheduler.log 2>&1
set CODE=%ERRORLEVEL%

echo [%date% %time%] === 종료 (exit %CODE%) >> logs\scheduler.log
exit /b %CODE%
