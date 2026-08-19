[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $env:USERPROFILE "Documents\Daxora-TeamFeePay")
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

Write-Host "Running TeamFeePay acquisition readiness gate..." -ForegroundColor Cyan
Push-Location $repo
try {
    npm.cmd run acquisition:teamfeepay
    if ($LASTEXITCODE -ne 0) { throw "Acquisition readiness gate failed." }

    $firstContactRoot = Join-Path $env:TEMP "Daxora-TeamFeePay-First-Contact-$timestamp"
    New-Item -ItemType Directory -Force -Path $firstContactRoot | Out-Null
    Copy-Item (Join-Path $repo "docs\acquisition\teamfeepay\01_NON_CONFIDENTIAL_TEASER.md") $firstContactRoot
    Copy-Item (Join-Path $repo "docs\acquisition\teamfeepay\02_STRATEGIC_FIT.md") $firstContactRoot
    Copy-Item (Join-Path $repo "docs\acquisition\teamfeepay\03_DEMO_SCRIPT.md") $firstContactRoot
    @"
Daxora Ground Control - TeamFeePay first-contact pack

Private demo route: /teamfeepay-demo
No source code or live personal data is included in this pack.
"@ | Set-Content -Encoding UTF8 (Join-Path $firstContactRoot "README.txt")

    $firstContactZip = Join-Path $OutputDirectory "Daxora-TeamFeePay-First-Contact-$timestamp.zip"
    Compress-Archive -Path (Join-Path $firstContactRoot "*") -DestinationPath $firstContactZip -Force

    $sourceZip = Join-Path $OutputDirectory "Daxora-TeamFeePay-Diligence-Source-NDA-ONLY-$timestamp.zip"
    git archive --format=zip --output="$sourceZip" HEAD
    if ($LASTEXITCODE -ne 0) { throw "git archive failed." }

    $sourceHash = Get-FileHash $sourceZip -Algorithm SHA256
    $firstHash = Get-FileHash $firstContactZip -Algorithm SHA256
    [PSCustomObject]@{
        CreatedAt = (Get-Date).ToString("o")
        FirstContactPackage = $firstContactZip
        FirstContactSHA256 = $firstHash.Hash
        DiligenceSourcePackage = $sourceZip
        DiligenceSourceSHA256 = $sourceHash.Hash
        Warning = "The diligence source package is NDA-only and must not be sent with the initial approach."
    } | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 (Join-Path $OutputDirectory "Daxora-TeamFeePay-Package-Manifest-$timestamp.json")

    Write-Host ""
    Write-Host "Created first-contact package:" -ForegroundColor Green
    Write-Host $firstContactZip
    Write-Host "Created NDA-only clean Git source archive:" -ForegroundColor Yellow
    Write-Host $sourceZip
}
finally {
    Pop-Location
}
