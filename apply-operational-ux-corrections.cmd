@echo off
setlocal

echo Removing obsolete Ground Control components...

for %%F in (
  "src\components\dashboard\DashboardInsightGrid.jsx"
  "src\components\SatPrintSheet.jsx"
  "src\components\SunPrintSheet.jsx"
  "src\components\CombinedPrintSheet.jsx"
  "src\components\Operations\SaturdayUnresolvedCard.jsx"
  "src\components\Operations\SundayUnresolvedCard.jsx"
) do (
  if exist "%%~F" del /Q "%%~F"
)

echo Obsolete components removed.
echo Run: npm run check
endlocal
