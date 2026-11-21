const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const root = path.resolve(__dirname,'..');
const web = ['app/src/main/assets/www','web'].map(p=>path.join(root,p)).find(p=>fs.existsSync(path.join(p,'index.html')));
const script = fs.readFileSync(path.join(web,'static/catalog-import.js'),'utf8');
const page = fs.readFileSync(path.join(web,'index.html'),'utf8');
const packet={format:'tiqany.catalog-transfer',version:1,items:[
    {name:'سائل جلي',code:'000001',currency:'USD',cost:0.33545,wholesale:0.51,consumer:0.636,category:'منظفات',stock:25},
    {name:'زيت بلسم',code:'',currency:'USD',purchase:1.9,cost:1.99509,wholesale:0,consumer:0}
], accounts:[
    {name:'حساب المورد',type:'supplier',code:'002',currency:'USD',balanceOurs:-5.25},
    {name:'حساب المورد',type:'supplier',code:'002',currency:'SYP',balanceOurs:120000},
    {name:'العميل',type:'customer',code:'0003',currency:'USD',balanceOurs:20}
]};
function setup(){
    const state={items:[],accounts:[],settings:{},categories:[],invoices:[{id:'inv1'}],vouchers:[{id:'v1'}],license:{isActivated:true,opsUsedCount:2}};
    const env={State:state,crypto:webcrypto,ProfileManager:{activeId:'p',currentName:()=>'شركة'},
      AppEscape:{text:String},StorageEngine:{db:{},saveState:async()=>{}},UI:{toast(){},openModal(){},forceCloseModal(){}},
      AppNav:{renderCurrent(){}},LicenseManager:{getTotalOpsUsed:()=>state.license.opsUsedCount,getRemainingTrialOps:()=>0,
        openActivationModal(){},persistFallbackStorage(){}},ProtectionController:{requestPin(m,fn){env.approve=fn;}}};
    vm.runInNewContext(script+';globalThis.api=CatalogImport;',env);
    return env;
}
async function preview(e,kind,p=packet){
    return e.api.open({target:{files:[{text:async()=>JSON.stringify(p)}]}},kind);
}
test('normal settings and card entry points load and use the importer',()=>{
    for(const kind of ['items','accounts']) assert.ok(page.includes("CatalogImport.open(event,'"+kind+"')"));
    assert.ok(page.includes('static/catalog-import.js'));assert.ok(page.includes('id="itmNumber"'));
    assert.match(page,/CatalogImport.cardCode\(/);assert.match(page,/itemNumber, name, category/);
});
test('materials only, five decimal places, zero prices and stock policy, replay',async()=>{
    const e=setup(),s=e.State;const accounts=s.accounts,invoices=s.invoices,vouchers=s.vouchers;
    await preview(e,'items');assert.equal(s.items.length,0);await e.api.confirm();
    assert.equal(s.items.length,2);assert.equal(s.items[0].itemNumber,'000001');assert.equal(s.items[1].itemNumber,'000002');
    assert.equal(s.items[0].units[0].costPrice,0.33545);assert.equal(s.items[1].units[0].lastPurchasePrice,1.9);
    assert.equal(s.items[1].units[0].costPrice,1.99509);assert.equal(s.items[1].units[0].consumerPrice,0);
    assert.equal(s.items[0].openingStockBase,0);assert.equal(s.items[0].importDetails.stock,25);
    assert.equal(s.categories[0],'منظفات');assert.equal(s.accounts,accounts);assert.equal(s.invoices,invoices);assert.equal(s.vouchers,vouchers);
    assert.equal(e.api.suggested(),'000003');assert.throws(()=>e.api.cardCode('١',''));
    e.api.remember('000025');assert.equal(e.api.suggested(),'000026');
    await preview(e,'items');await e.api.confirm();assert.equal(s.items.length,2);assert.equal(s.license.opsUsedCount,4);
});
test('accounts only, separate currencies, debit and credit direction, existing parties untouched',async()=>{
    const e=setup(),s=e.State,items=s.items;s.settings.appProtection={pinHash:'configured'};
    await preview(e,'accounts');await e.api.confirm();assert.equal(s.accounts.length,0);await e.approve();
    assert.equal(s.accounts.length,2);assert.equal(s.accounts[0].openingUsd,5.25);assert.equal(s.accounts[0].openingSyp,-120000);
    assert.equal(s.accounts[1].openingUsd,20);assert.equal(s.items,items);
    assert.equal(e.api.plan(s,packet,'accounts').added.length,0);
});
test('failed disk commits roll back, trial limit and profile changes prevent writes',async()=>{
    const e=setup(),s=e.State,old=JSON.stringify(s);e.StorageEngine.saveState=async()=>{throw Error('disk');};
    await preview(e,'items');await e.api.confirm();assert.equal(JSON.stringify(s),old);
    e.StorageEngine.saveState=async()=>{};s.license.isActivated=false;await preview(e,'items');await e.api.confirm();
    assert.equal(s.items.length,0);s.license.isActivated=true;await preview(e,'accounts');e.ProfileManager.activeId='elsewhere';
    await e.api.confirm();assert.equal(s.accounts.length,0);
});
test('a changed catalog must be previewed again and invalid inputs cannot partially post',async()=>{
    const e=setup(),s=e.State;await preview(e,'items');s.items.push({id:'prior',name:'سائل جلي',units:[]});
    await e.api.confirm();assert.equal(s.items.length,1);await e.api.confirm();assert.equal(s.items.length,2);
    assert.throws(()=>e.api.plan(s,{...packet,items:[packet.items[0],{...packet.items[1],cost:-10}]},'items'));
    assert.throws(()=>e.api.plan(s,{...packet,format:'backup'},'accounts'));
});
