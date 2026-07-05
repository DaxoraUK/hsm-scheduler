$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
  throw "Run this script from the Ground Control project root."
}

$pathsToRemove = @(
  "src/components/ui",
  "src/components/Operations/match-control/MatchControlDrawer.jsx",
  "src/components/Operations/match-control/tabs/FixtureTab.jsx",
  "src/components/Operations/match-control/tabs/HistoryTab.jsx",
  "src/components/Operations/match-control/tabs/MessagesTab.jsx",
  "src/components/Operations/match-control/tabs/OperationsTab.jsx",
  "src/components/Operations/shared/FixtureRow.jsx",
  "src/hooks/usePersistence.js",
  "src/hooks/useSupabaseSync.js"
)

foreach ($path in $pathsToRemove) {
  if (Test-Path $path) {
    Remove-Item $path -Recurse -Force
    Write-Host "Removed $path"
  }
}

Write-Host "UI consolidation cleanup complete."
Write-Host "Now run: npm run check"
