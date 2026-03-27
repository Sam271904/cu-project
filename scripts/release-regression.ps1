#Requires -Version 5.1
<#
.SYNOPSIS
  发布前回归：构建 + 单元测试（+ 可选 E2E）。
.EXAMPLE
  .\scripts\release-regression.ps1
  .\scripts\release-regression.ps1 -SkipE2e
  .\scripts\release-regression.ps1 -E2eOnly
#>
param(
  [switch]$SkipE2e,
  [switch]$E2eOnly
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

function Invoke-Step {
  param([string]$Label, [scriptblock]$Script)
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $Script
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Label (exit $LASTEXITCODE)"
  }
}

try {
  if (-not $E2eOnly) {
    Invoke-Step "npm run build" { npm run build }
    Invoke-Step "npm run test" { npm run test }
  }

  if (-not $SkipE2e) {
    Invoke-Step "npm run test:e2e" { npm run test:e2e }
  }

  Write-Host "`nOK: release regression passed." -ForegroundColor Green
  exit 0
}
catch {
  Write-Host "`nFAILED: $_" -ForegroundColor Red
  exit 1
}
