$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = (Get-Location).Path

$files = @(
  "package.json",
  ".env.staging.example",
  "scripts/staging-preflight.mjs",
  "supabase/tests/staging_schema_audit.sql",
  "docs/STAGING_EXECUTION_CHECKLIST.md",
  "tests/regression/staging-preflight.test.js"
)

foreach ($file in $files) {
  $sourceFile = Join-Path $source $file
  $targetFile = Join-Path $target $file
  $targetDirectory = Split-Path -Parent $targetFile
  if (-not (Test-Path $targetDirectory)) {
    New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  }
  Copy-Item -Force $sourceFile $targetFile
  Write-Host "Installed $file"
}

Write-Host "Staging readiness pass installed. Run: npm run check"
