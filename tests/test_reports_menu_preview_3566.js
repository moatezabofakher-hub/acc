const fs=require('node:fs'),assert=require('node:assert/strict');const html=fs.readFileSync('app/src/main/assets/www/index.html','utf8');
assert(html.includes('LedgerReports.openPrintChooser()'));
for(const id of ['sales_summary','debts_summary'])assert(html.includes("LedgerReports.openPreview('"+id+"')"));
assert(html.includes('data-report-preview-actions'));
assert(html.includes('onclick="LedgerReports.print()"'));
assert(html.includes('onclick="LedgerReports.sharePdf()"'));
assert(!html.includes('data-feature="print-reports-3523"'));
assert(html.includes('AndroidReports.shareReport'));
console.log('PASS: report chooser, material/debts previews, print and PDF actions');
