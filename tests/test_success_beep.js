'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../app/src/main/assets/www');
assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/barcode-feedback\.js/);
assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/if\(quantityAfter > quantityBefore\)/);
assert.doesNotMatch(fs.readFileSync(path.join(root,'static/windows-pos.js'),'utf8'),/BarcodeFeedback\?\.success\(\)/);
assert.match(fs.readFileSync(path.join(root,'static/mobile-barcode-hid.js'),'utf8'),/BarcodeFeedback\?\.read\(/);
assert.match(fs.readFileSync(path.resolve(__dirname,'../app/src/main/java/com/sunshine/accounting/MainActivity.java'),'utf8'),/ToneGenerator\.TONE_PROP_BEEP/);
console.log('Solo barcode sound plays on read, not on item insertion');
