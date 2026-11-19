'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const root=path.resolve(__dirname,'..');
const manager=path.join(root,'app/src/main/assets/www/static/ta-settings-pages-152.js');
const agent=null;
const agentHtml=null;
test('v152 standalone manager settings page JavaScript parses safely',()=>{
 const s=fs.readFileSync(manager,'utf8');
 new vm.Script(s,{filename:manager});
 assert.match(s,/function discard\(\)/);
 assert.match(s,/draft\.cancel\(key\)/);
 assert.match(s,/draft\.discardSilently/);
 assert.match(s,/confirmExit/);
 assert.match(s,/if\(!hasChanges\(\)\)/);
});
test('v152 Back and dock navigation require Save, Continue Editing or Discard',()=>{
 const s=fs.readFileSync(manager,'utf8');
 for(const mark of ['UI.showUnsavedDialog','AppNav.handleBackButton=function','AppNav.navigate=function','draft.save(key)','modal','data'])assert.ok(s.includes(mark),mark);
 assert.ok(s.includes('isActive()'),'saved guard should not silently close after failed save');
});
