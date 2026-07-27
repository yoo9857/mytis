<#
.SYNOPSIS
  등록된 티스토리 자동 발행 작업을 제거합니다.
#>
[CmdletBinding()]
param(
  [string] $TaskName = 'MoneytiTistoryAutoPost'
)

$ErrorActionPreference = 'Stop'

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "등록된 작업이 없습니다: $TaskName" -ForegroundColor Yellow
  return
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "삭제 완료: $TaskName" -ForegroundColor Green
