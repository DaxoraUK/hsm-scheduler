param(
  [string]$OutputDirectory = ".release-packages"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$stage = Join-Path ([System.IO.Path]::GetTempPath()) "daxora-ground-control-$timestamp"
$output = Join-Path $repo $OutputDirectory
$archive = Join-Path $output "daxora-ground-control-$timestamp.zip"

$blockedPrefixes = @(
  ".git/", "node_modules/", "dist/", "coverage/", ".release-evidence/",
  ".release-packages/", ".daxora-backups/"
)
$blockedNames = @(".env", ".env.local", ".env.production", ".env.staging")
$blockedExtensions = @(".zip", ".patch", ".log")

try {
  New-Item -ItemType Directory -Force -Path $stage, $output | Out-Null
  $files = git ls-files --cached --others --exclude-standard
  if ($LASTEXITCODE -ne 0) { throw "Could not enumerate the release files." }

  foreach ($relative in $files) {
    $normalised = $relative.Replace("\", "/")
    if ($blockedPrefixes | Where-Object { $normalised.StartsWith($_) }) { continue }
    if ($blockedNames -contains [System.IO.Path]::GetFileName($normalised)) { continue }
    if ($blockedExtensions -contains [System.IO.Path]::GetExtension($normalised).ToLowerInvariant()) { continue }

    $source = Join-Path $repo $relative
    if (-not (Test-Path $source -PathType Leaf)) { continue }
    $destination = Join-Path $stage $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    Copy-Item $source $destination -Force
  }

  if (Test-Path $archive) { Remove-Item $archive -Force }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $archive -CompressionLevel Optimal
  Write-Host "Release package created: $archive"
} finally {
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
}
