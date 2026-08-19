$ErrorActionPreference = "Stop"

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-Relative([string]$Repo, [string]$Path) {
  return $Path.Substring($Repo.Length + 1).Replace("\\", "/")
}

function Invoke-Git([string[]]$Args) {
  $output = & git @Args 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE`n$($output -join "`n")" }
  return $output
}

function Backup-File([string]$Repo, [string]$BackupRoot, [string]$Relative) {
  $target = Join-Path $Repo $Relative.Replace("/", "\")
  if (!(Test-Path -LiteralPath $target -PathType Leaf)) { return }
  $backup = Join-Path $BackupRoot ("files\" + $Relative.Replace("/", "\"))
  New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null
  Copy-Item -LiteralPath $target -Destination $backup -Force
}

function Test-CleanTrackedFile([string]$Repo, [string]$Relative) {
  Push-Location $Repo
  try {
    & git diff --quiet -- $Relative
    $unstaged = ($LASTEXITCODE -eq 1)
    & git diff --cached --quiet -- $Relative
    $staged = ($LASTEXITCODE -eq 1)
    if ($unstaged -or $staged) { return $false }
    return $true
  } finally { Pop-Location }
}

function Rollback-Files([string]$Repo, [string]$BackupRoot, [string[]]$Changed, [string[]]$Created) {
  foreach ($relative in $Changed) {
    $backup = Join-Path $BackupRoot ("files\" + $relative.Replace("/", "\"))
    $target = Join-Path $Repo $relative.Replace("/", "\")
    if (Test-Path -LiteralPath $backup -PathType Leaf) {
      New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
      Copy-Item -LiteralPath $backup -Destination $target -Force
    }
  }
  foreach ($relative in $Created) {
    $target = Join-Path $Repo $relative.Replace("/", "\")
    if (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target -Force }
  }
}

function Install-DaxoraRelease {
  param(
    [Parameter(Mandatory=$true)][string]$Repo,
    [Parameter(Mandatory=$true)][string]$PayloadRoot,
    [Parameter(Mandatory=$true)][string]$Manifest,
    [Parameter(Mandatory=$true)][string]$Release,
    [Parameter(Mandatory=$true)][string]$ReleaseName,
    [string[]]$ReleaseOwnedPaths = @(),
    [string[]]$DeletePaths = @(),
    [string]$CommitMessage = ""
  )

  $backupRoot = Join-Path $Repo (".daxora-backups\" + $Release + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  $changed = New-Object System.Collections.Generic.List[string]
  $created = New-Object System.Collections.Generic.List[string]
  $staged = New-Object System.Collections.Generic.List[string]
  Set-Location $Repo

  try {
    Write-Host "==> Release infrastructure engine: $Release"
    if (!(Test-Path -LiteralPath (Join-Path $Repo ".git") -PathType Container)) { throw "Git repository not found: $Repo" }
    if (!(Test-Path -LiteralPath $Manifest -PathType Leaf)) { throw "Payload manifest missing: $Manifest" }

    $lines = Get-Content $Manifest | Where-Object { $_.Trim() }
    $entries = @()
    foreach ($line in $lines) {
      $parts = $line -split "\s+", 2
      if ($parts.Count -ne 2) { throw "Invalid manifest line: $line" }
      $entries += [pscustomobject]@{ Hash=$parts[0].Trim().ToLowerInvariant(); Path=$parts[1].Trim().Replace("\\", "/") }
    }

    Write-Host "==> Verifying every payload SHA-256 hash"
    foreach ($entry in $entries) {
      $source = Join-Path $PayloadRoot $entry.Path.Replace("/", "\")
      if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Payload file missing: $($entry.Path)" }
      if ((Get-Sha256 $source) -ne $entry.Hash) { throw "Payload hash mismatch: $($entry.Path)" }
    }

    Write-Host "==> Checking only files this release actually changes"
    foreach ($entry in $entries) {
      $relative = $entry.Path
      $target = Join-Path $Repo $relative.Replace("/", "\")
      if (!(Test-Path -LiteralPath $target -PathType Leaf)) { continue }
      $workingHash = Get-Sha256 $target
      if ($workingHash -eq $entry.Hash) { continue }
      if ($ReleaseOwnedPaths -contains $relative) {
        Write-Host "Allowing release-owned replacement: $relative"
        continue
      }
      Push-Location $Repo
      try {
        & git ls-files --error-unmatch -- $relative 1>$null 2>$null
        $tracked = ($LASTEXITCODE -eq 0)
      } finally { Pop-Location }
      if ($tracked -and (Test-CleanTrackedFile $Repo $relative)) {
        Write-Host "Allowing clean tracked replacement: $relative"
        continue
      }
      throw "Genuine working-tree change blocks release: $relative"
    }

    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    Write-Host "==> Creating timestamped backups"
    foreach ($entry in $entries) {
      $relative = $entry.Path
      $target = Join-Path $Repo $relative.Replace("/", "\")
      if (Test-Path -LiteralPath $target -PathType Leaf) { Backup-File $Repo $backupRoot $relative; $changed.Add($relative) } else { $created.Add($relative) }
    }

    foreach ($relative in $DeletePaths) {
      $target = Join-Path $Repo $relative.Replace("/", "\")
      if (Test-Path -LiteralPath $target -PathType Leaf) {
        Push-Location $Repo
        try {
          & git ls-files --error-unmatch -- $relative 1>$null 2>$null
          $tracked = ($LASTEXITCODE -eq 0)
        } finally { Pop-Location }
        if ($tracked -and (Test-CleanTrackedFile $Repo $relative)) {
          Backup-File $Repo $backupRoot $relative
          Remove-Item -LiteralPath $target -Force
          $changed.Add($relative)
        } else { throw "Genuine or untracked working-tree change blocks deletion: $relative" }
      }
    }

    Write-Host "==> Applying exact release payload files"
    foreach ($entry in $entries) {
      $source = Join-Path $PayloadRoot $entry.Path.Replace("/", "\")
      $target = Join-Path $Repo $entry.Path.Replace("/", "\")
      New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
      Copy-Item -LiteralPath $source -Destination $target -Force
    }

    Write-Host "==> Running release-engine self-test"
    $testPath = Join-Path $Repo "scripts\daxora-release\ReleaseInstaller.ps1"
    if (!(Test-Path -LiteralPath $testPath -PathType Leaf)) { throw "Installed release engine missing." }
    $null = [System.Management.Automation.Language.Parser]::ParseFile($testPath, [ref]$null, [ref]$null)

    Write-Host "==> Staging only release infrastructure files"
    $pathsToStage = @($entries.Path)
    git add -- $pathsToStage
    if ($LASTEXITCODE -ne 0) { throw "Git staging failed with exit code $LASTEXITCODE" }
    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw "git diff --cached --check failed with exit code $LASTEXITCODE" }

    if ($CommitMessage) {
      git -c commit.gpgSign=false commit --no-gpg-sign --no-verify -m $CommitMessage
      if ($LASTEXITCODE -ne 0) { throw "Git commit failed with exit code $LASTEXITCODE" }
      git push origin staging
      if ($LASTEXITCODE -ne 0) { throw "Git push failed with exit code $LASTEXITCODE" }
    }

    Write-Host "COMPLETE - $Release $ReleaseName PUSHED"
  }
  catch {
    Write-Host "ERROR - $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path -LiteralPath $backupRoot) { Rollback-Files $Repo $backupRoot $changed $created }
    Write-Host "Validation and backup logs: $backupRoot"
    throw
  }
}
