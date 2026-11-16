'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const web=path.join(root,'app/src/main/assets/www');
const html=fs.readFileSync(path.join(web,'index.html'),'utf8');
test('Standalone independent profile activation honors selected company name',()=>{
 assert.match(html,/newState\.settings\.companyName=String\(selected\.name\)\.trim\(\)/);
});
