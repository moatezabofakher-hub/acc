const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'../app/src/main/assets/www/static');
const code=fs.readFileSync(path.join(root,'tiqany-ux-3588.js'),'utf8');
const css=fs.readFileSync(path.join(root,'tiqany-ux-3588.css'),'utf8');
test('no ordinary screen exit X',()=>{assert.doesNotMatch(code,/function addPageExit/);assert.match(code,/function removeLegacyPageExit/);assert.match(css,/\.ta-page-exit-line\{display:none!important\}/);});
test('popup close X appears on the right',()=>{assert.match(css,/\.ta-ux-popup-frame>\.ta-close3d\{position:absolute!important;top:6px!important;right:7px!important;left:auto!important/);assert.match(code,/box\.prepend\(existing\)/);});
