'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
assert.match(read('app/src/main/java/com/sunshine/accounting/ContinuousBarcodeActivity.java'),/الباركود غير معرّف/);
assert.match(read('app/src/main/java/com/sunshine/accounting/MainActivity.java'),/setKnownBarcodes\(String json\)/);
assert.match(read('app/src/main/assets/www/index.html'),/posAutoNextSetting/);
assert.match(read('app/src/main/assets/www/static/windows-pos.js'),/posAutoNextOnFinish/);
assert.match(read('app/src/main/assets/www/static/mobile-barcode-hid.js'),/الباركود غير معرّف/);
console.log('PASS solo: unknown barcode alert and POS automatic continuation');
