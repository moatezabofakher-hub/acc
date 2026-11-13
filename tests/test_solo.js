'use strict';
// Standalone edition smoke/regression tests with no user records.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/www/index.html'),'utf8');
const readFile=x=>fs.readFileSync(path.join(root,'app/src/main/assets/www/static',x),'utf8');
// Every shipped script reference must resolve inside the same Android asset bundle.
for(const match of html.matchAll(/<script[^>]*src="static\/([^"]+)"/g)){
  assert(fs.existsSync(path.join(root,'app/src/main/assets/www/static',match[1])),`Missing JS: ${match[1]}`);
}
// No field sales application, pairing, reps, routing, or native LAN bridge.
for(const forbidden of ["agent_hub",'FieldSync.', 'AgentHub.', 'FieldCash.', 'ReportAgentFilter', 'AndroidLocalSync', 'تقرير مبيعات المندوب', 'المندوبون والمزامنة المحلية'])
  assert(!html.includes(forbidden),`Forbidden legacy control: ${forbidden}`);
assert(!fs.existsSync(path.join(root,'field_agent')));
assert(!fs.existsSync(path.join(root,'app/src/main/java/com/sunshine/accounting/NativeLocalSync.java')));
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
assert.match(gradle,/applicationId 'com.tiqany.accounting.solo'/);
assert(!fs.readFileSync(path.join(root,'settings.gradle'),'utf8').includes("':field_agent'"));
const State={
  invoices:[{id:'i1',type:'sale',number:5,currency:'USD',paidAmount:10,date:'2026-11-13',accountId:'c'},
    {id:'i2',type:'purchase',number:8,currency:'SYP',paidAmount:2000,date:'2026-11-13'}],
  vouchers:[{id:'v1',type:'receipt',number:2,currency:'USD',amount:5,date:'2026-11-13'}],
  expenses:[{id:'e1',currency:'USD',amount:2,date:'2026-11-13',category:'مصاريف'}],
  accounts:[{id:'c',name:'عميل'}]
};
const ctx={State,console,Date,Map};vm.createContext(ctx);
vm.runInContext(readFile('solo-cashbox.js')+'\n globalThis.Box=SoloCashbox;',ctx);
const cash=ctx.Box.summary();
assert.equal(cash.usdCash,13);
assert.equal(cash.sypCash,-2000);
assert.equal(cash.movements.length,4);
// The stock-only alert system must ignore old imported field-agent alerts.
State.alertCenter={entries:[{id:'agent:1',type:'agent',read:false}],stockLevels:{'wh_main::itm':3}};
State.warehouses=[{id:'wh_main',name:'المستودع الرئيسي'}];
State.items=[{id:'itm',name:'صنف'}];
let currentQty=0;
ctx.Accounting={getItemBaseStock:()=>currentQty};
ctx.StorageEngine={saveState:async()=>{}};
ctx.document={getElementById:id=>id==='headerNotificationsCount'?{hidden:true,textContent:''}:null};
ctx.AppNav={current:()=>({screen:'dashboard'}),renderCurrent:()=>{},navigate:()=>{}};
ctx.UI={toast:()=>{},setHeader:()=>{}};
ctx.window={};
vm.runInContext(readFile('stock-notifications.js')+'\n globalThis.Notifications=StockNotifications;',ctx);
assert.equal(ctx.Notifications.unread(),0,'legacy rep notifications removed');
const created=ctx.Notifications.prepareForSave();
assert.equal(created.length,1,'stock-depletion alert generated');
assert.equal(ctx.Notifications.unread(),1);
assert.equal(created[0].type,'stock');
// Imported full backups keep financial transactions while removing rep linkage metadata.
const begin=html.indexOf('const SoloSanitize = {'),end=html.indexOf('const State = {',begin);
assert(begin>=0 && end>begin);
vm.runInContext(html.slice(begin,end)+'\n globalThis.Sanitize=SoloSanitize;',ctx);
const backup={settings:{companyName:'شركة'},fieldSync:{agents:[{name:'test'}]},
  invoices:[{id:'sale',netTotal:100,paidAmount:20,fieldOrigin:{agentId:'a'},fieldRevision:2}],
  vouchers:[{id:'v',amount:80,fieldOrigin:{agentId:'a'}}],expenses:[{id:'e',amount:5,agentId:'a'}],
  alertCenter:{entries:[{id:'x',type:'agent'},{id:'y',type:'stock'}],seenImportIds:['agent1']}};
const result=ctx.Sanitize.ledger(backup);
assert.equal(result.invoices[0].netTotal,100);
assert.equal(result.vouchers[0].amount,80);
assert.equal(result.expenses[0].amount,5);
assert.equal(result.invoices[0].fieldOrigin,undefined);
assert.equal(result.vouchers[0].fieldOrigin,undefined);
assert.equal(result.expenses[0].agentId,undefined);
assert.equal(result.fieldSync,undefined);
assert.equal(result.alertCenter.entries.length,1);
assert.equal(result.alertCenter.seenImportIds,undefined);
console.log('PASS: Solo isolation, offline cashbox, stock-only alerts, financial data preservation and backup sanitation.');
