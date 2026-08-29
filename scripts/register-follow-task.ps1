[CmdletBinding()]
param(
  [string] $BlogId = 'happytigers',
  [string] $Category = '',
  [string] $TargetBlog = '',
  [string] $TargetCategory = 'auto',
  [string] $StartAt = '01:00',
  [int] $EveryHours = 5,
  [string] $TaskName = 'MoneytiFollowHappytigers',
  [switch] $RunWhenLoggedOff = $true
)

$ErrorActionPreference = 'Stop'
if ($EveryHours -lt 1) { throw 'EveryHours must be at least 1.' }
if ($BlogId -notmatch '^[A-Za-z0-9_-]+$') { throw "Invalid blog id: $BlogId" }

$projectRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $projectRoot 'scripts\run-follow.cmd'
if (-not (Test-Path $runner)) { throw "Runner not found: $runner" }

$clock = [datetime]::ParseExact($StartAt, 'HH:mm', $null)
$first = Get-Date -Hour $clock.Hour -Minute $clock.Minute -Second 0
if ($first -le (Get-Date)) { $first = $first.AddDays(1) }

# Use one long-running trigger. A daily trigger would create a four-hour gap at
# midnight because 24 is not divisible by five.
$trigger = New-ScheduledTaskTrigger -Once -At $first `
  -RepetitionInterval (New-TimeSpan -Hours $EveryHours) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$taskArgs = '"{0}" "{1}" "{2}" "{3}"' -f $BlogId, $Category, $TargetBlog, $TargetCategory
$action = New-ScheduledTaskAction -Execute $runner -Argument $taskArgs -WorkingDirectory $projectRoot
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 10) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$userId = "$env:USERDOMAIN\$env:USERNAME"
if ($RunWhenLoggedOff) {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Limited
} else {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
}

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Follow Naver blog $BlogId and publish an original Tistory commentary" | Out-Null

Write-Host "Registered: $TaskName"
Write-Host "First run: $first; repeats every $EveryHours hours"
Write-Host "Source: https://blog.naver.com/$BlogId"
if ($TargetBlog) { Write-Host "Target: https://$TargetBlog.tistory.com" }
else { Write-Host 'Target: (default TISTORY_BLOG)' }
