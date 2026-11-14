'use strict';
const fs=require('node:fs'); const assert=require('node:assert/strict');
const s=fs.readFileSync('app/src/main/assets/www/index.html','utf8');
assert(s.includes('changeInvoiceDatePart('));
assert(s.includes('visibleInvoiceDate(d.date).day'));
assert(s.includes('changeInvoicePricingTier(tier)'));
assert(s.includes('row.priceManuallySet) continue'));
assert(s.includes('ta-invoice-pricing-choice'));
console.log('PASS solo invoice date and per-invoice pricing tier');
