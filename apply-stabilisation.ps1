$ErrorActionPreference = "Stop"

$obsoletePaths = @(
  "src/components/CombinedPrintSheet.jsx",
  "src/components/SatPrintSheet.jsx",
  "src/components/SunPrintSheet.jsx",
  "src/components/dashboard/DashboardInsightGrid.jsx",
  "src/components/Operations/SaturdayUnresolvedCard.jsx",
  "src/components/Operations/SundayUnresolvedCard.jsx",
  "src/components/ui"
)

foreach ($path in $obsoletePaths) {
  if (Test-Path $path) {
    Remove-Item $path -Recurse -Force
    Write-Host "Removed $path"
  }
}

Write-Host "Stabilisation cleanup complete. Run: npm ci; npm run check"
