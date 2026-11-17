'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/www/index.html'),'utf8');
test('Solo bottom tabs appear on dashboard, hide on all other screens, and keep Back',()=>{
 assert.match(app,/id="ta-home-only-dock-137"/);
 assert.match(app,/html body\.ta-3d-v3524:not\(\.ta-dashboard-screen\) nav\.ta-bottom-nav\{display:none!important\}/);
 assert.match(app,/classList\.toggle\('ta-dashboard-screen',screen==='dashboard'\)/);
 for(const route of ['dashboard','invoices_list','items','accounts','reports'])
  assert.ok(app.includes("AppNav.navigate('"+route+"')"));
 assert.match(app,/backBtn\.onclick = \(\) => AppNav\.handleBackButton\(\)/);
});
