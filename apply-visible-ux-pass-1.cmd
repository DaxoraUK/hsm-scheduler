@echo off
setlocal
set "TARGET=src\components\dashboard\DashboardInsightGrid.jsx"
if exist "%TARGET%" (
  del /q "%TARGET%"
  echo Removed obsolete DashboardInsightGrid.jsx
) else (
  echo DashboardInsightGrid.jsx is already removed.
)
echo Visible UX pass 1 cleanup complete.
endlocal
