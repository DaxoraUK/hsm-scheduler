param([string]$Package = "")
$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$searchRoots = @(
  (Join-Path $repo ".daxora-updates"),
  (Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads")
)

if (!$Package) {
  $Package = $searchRoots | Where-Object { Test-Path -LiteralPath $_ -PathType Container } |
    ForEach-Object { Get-ChildItem -LiteralPath $_ -Filter "daxora-ground-control-v*.zip" -File } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (!$Package -or !(Test-Path -LiteralPath $Package -PathType Leaf)) { throw "No Daxora update ZIP was found." }
$Package = (Resolve-Path -LiteralPath $Package).Path
$checksumFile = "$Package.sha256"
if (!(Test-Path -LiteralPath $checksumFile -PathType Leaf)) { throw "Checksum file missing: $checksumFile" }
$expected = ((Get-Content -LiteralPath $checksumFile -Raw) -split "\s+")[0].ToLowerInvariant()
$actual = (Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw "Update ZIP checksum mismatch." }

$stagingRoot = Join-Path $repo (".daxora-updates\staging-" + [guid]::NewGuid().ToString("N"))
try {
  New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
  Expand-Archive -LiteralPath $Package -DestinationPath $stagingRoot
  $installer = Get-ChildItem -LiteralPath $stagingRoot -Filter "INSTALL-V*.ps1" -File | Select-Object -First 1
  if (!$installer) { throw "The update ZIP does not contain a release installer." }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer.FullName
  if ($LASTEXITCODE -ne 0) { throw "The Daxora release installer returned exit code $LASTEXITCODE." }
} finally {
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}
