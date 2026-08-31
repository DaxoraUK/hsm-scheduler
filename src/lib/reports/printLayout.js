export const REPORT_PRINT_STYLES = `
  @media print {
    .np { display: none !important; }
    body[data-print-target="reports"] :not(#ground-control-report-print):not(#ground-control-report-print *):not(:has(#ground-control-report-print)) {
      display: none !important;
    }
    body[data-print-target="reports"] #ground-control-report-print,
    body[data-print-target="reports"] #ground-control-report-print * {
      visibility: visible !important;
    }
    body[data-print-target="reports"] #ground-control-report-print {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    @page { size: A4 landscape; margin: 12mm; }
  }
`;
