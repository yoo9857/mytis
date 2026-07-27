<#
.SYNOPSIS
  티스토리 자동 발행을 Windows 작업 스케줄러에 등록합니다.

.EXAMPLE
  # 매일 오전 9시에 1개 발행
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 09:00

.EXAMPLE
  # 매일 07:30, 19:30 두 번, 회당 2개 발행
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 07:30,19:30 -Count 2

.EXAMPLE
  # 3시간마다 반복
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 08:00 -RepeatHours 3
#>
[CmdletBinding()]
param(
  [string[]] $Time = @('09:00'),
  [int]      $Count = 1,
  [string]   $TaskName = 'MoneytiTistoryAutoPost',
  [int]      $RepeatHours = 0,
  [switch]   $RunWhenLoggedOff,
  [switch]   $Star,
  [int]      $Find = 5
)

# -Star : 스타·연예인 모드. 최신 연예 기사를 자동 수집해서 발행한다.
#         기사 URL 이 큐에 들어가므로 원문 사진 확보·카테고리 자동 선택이 함께 동작한다.
# -Find : -Star 일 때 한 번에 수집할 기사 수 (기본 5)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
# 삼항 연산자는 PowerShell 7+ 전용이라 쓰지 않는다 (이 환경은 5.1)
if ($Star) { $runner = Join-Path $projectRoot 'scripts\run-star.cmd' }
else { $runner = Join-Path $projectRoot 'scripts\run-queue.cmd' }

if (-not (Test-Path $runner)) {
  throw "실행 스크립트를 찾을 수 없습니다: $runner"
}

Write-Host "프로젝트 경로 : $projectRoot"
Write-Host "실행 스크립트 : $runner"
Write-Host "회당 발행 수  : $Count"

# --- 트리거 구성 -------------------------------------------------------------
$triggers = @()
foreach ($t in $Time) {
  $parsed = [datetime]::ParseExact($t, 'HH:mm', $null)
  $trigger = New-ScheduledTaskTrigger -Daily -At $parsed
  if ($RepeatHours -gt 0) {
    $trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $parsed `
        -RepetitionInterval (New-TimeSpan -Hours $RepeatHours) `
        -RepetitionDuration (New-TimeSpan -Days 1)).Repetition
  }
  $triggers += $trigger
  Write-Host "트리거 추가   : 매일 $t$(if ($RepeatHours -gt 0) { " (이후 ${RepeatHours}시간마다)" })"
}

# --- 동작 --------------------------------------------------------------------
if ($Star) { $taskArgs = "$Count $Find" } else { $taskArgs = "$Count" }
$action = New-ScheduledTaskAction -Execute $runner -Argument $taskArgs -WorkingDirectory $projectRoot

# --- 설정 --------------------------------------------------------------------
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# --- 실행 주체 ---------------------------------------------------------------
# 기본값은 '로그온했을 때만 실행'. Chrome 프로필 세션을 쓰기에 가장 안정적입니다.
$userId = "$env:USERDOMAIN\$env:USERNAME"
if ($RunWhenLoggedOff) {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Limited
  Write-Host "실행 조건     : 로그오프 상태에서도 실행 (S4U)"
} else {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
  Write-Host "실행 조건     : 로그온 상태에서만 실행"
}

# --- 등록 --------------------------------------------------------------------
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "기존 작업을 덮어씁니다: $TaskName" -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Principal $principal `
  -Description '티스토리 자동 글 생성 및 발행 (codex + Playwright)' | Out-Null

Write-Host ""
Write-Host "등록 완료: $TaskName" -ForegroundColor Green
Write-Host ""
Write-Host "지금 바로 한 번 실행해 보려면:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host "실행 로그:"
Write-Host "  Get-Content '$projectRoot\logs\scheduler.log' -Tail 40"
Write-Host "등록 해제:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\unregister-task.ps1"
