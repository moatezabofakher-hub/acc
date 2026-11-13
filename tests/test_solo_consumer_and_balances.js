'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/www/index.html'),'utf8');
const java=fs.readFileSync(path.join(root,'app/src/main/java/com/sunshine/accounting/ReportPdfRenderer.java'),'utf8');
const snippet=(start,end)=>{
  const i=html.indexOf(start),j=html.indexOf(end,i+start.length);
  assert(i>=0&&j>i,`method not found: ${start}`);
  return html.slice(i,j).trim();
};
const items=[
  {id:'stock',currency:'USD',units:[{name:'كرتونة',factor:1,costPrice:2,salePrice:10,centerPrice:13,consumerPrice:18,wholesalePrice:10}]},
  {id:'legacy',currency:'USD',units:[{name:'كرتونة',factor:1,costPrice:3,salePrice:15,centerPrice:19}]},
  {id:'kit',currency:'USD',isBundle:true,bundleComponents:[{itemId:'stock',quantity:2},{itemId:'legacy',quantity:1}],bundlePricing:{mode:'component_sum'},units:[{name:'كرتونة',factor:1,salePrice:40,centerPrice:50,consumerPrice:60}]}
];
const accounts=[
  {id:'whole',priceTier:'wholesale',openingUsd:15,openingSyp:90000},
  {id:'center',priceTier:'center'},
  {id:'consumer',priceTier:'consumer'},
  {id:'unspecified'}
];
const state={items,accounts,invoices:[],vouchers:[],settings:{exchangeRate:10000,printerWidth:80,printFontScale:1,companyName:'مؤسسة الاختبار',footerNote:'شكرا'}};
const accMethod=snippet('itemCostPrice(item,unit) {','// Double-Entry Account Statement');
const Accounting=new Function('State',`return ({convert(v){return Number(v)},roundDerivedItemPrice(v){return Math.round(v*10000)/10000},${accMethod}});`)(state);
const sale=(item,acc,tier)=>Accounting.itemSalePrice(item,item.units[0],acc,tier);
assert.equal(sale(items[0],'consumer'),18,'new consumer tier');
assert.equal(sale(items[0],'center'),13);
assert.equal(sale(items[0],'whole'),10);
assert.equal(sale(items[0],'unspecified'),10,'wholesale remains default');
assert.equal(sale(items[0],'whole','consumer'),18,'explicit consumer tier override');
// Account overrides stay fixed when the global default price setting changes.
state.settings.defaultInvoicePriceTier='consumer';
assert.equal(sale(items[0],'unspecified'),18,'unspecified account follows default');
assert.equal(sale(items[0],null),18,'cash customer follows default');
assert.equal(sale(items[0],'whole'),10,'explicit wholesale ignores default');
assert.equal(sale(items[0],'center'),13,'explicit center ignores default');
accounts.push({id:'settings',priceTier:'settings'});
assert.equal(sale(items[0],'settings'),18,'settings-mode account follows default');
state.settings.defaultInvoicePriceTier='center';
assert.equal(sale(items[0],'settings'),13,'changing default reprices only settings-mode accounts');
assert.equal(sale(items[0],'consumer'),18,'explicit consumer ignores global center default');
state.settings.defaultInvoicePriceTier='wholesale';
assert(html.includes('id="setDefaultInvoicePriceTier"'),'default invoice pricing selector');
assert(html.includes('value="settings"'),'account pricing follows settings');
assert.equal(sale(items[1],'consumer'),15,'legacy items fall back without migration');
assert.equal(sale(items[2],'consumer'),51,'bundle consumer component sum');
assert.equal(sale(items[2],'center'),45,'bundle center component sum');
assert.equal(sale(items[2],'whole'),35,'bundle wholesale component sum');
items[2].bundlePricing={mode:'cost_markup',markup:20};
assert.equal(sale(items[2],'consumer'),8.4,'cost markup derives consumer from cost when chosen');
assert(html.includes('id="itmConsumerPrice"'),'main unit consumer field');
assert(html.includes('id="unitConsumer_${idx}"'),'derived-unit consumer field');
assert(html.includes('id="accPriceTier"')&&html.includes('value="consumer"'),'account consumer option');
assert(html.includes('consumerPrice: Accounting.parseNum(u.consumerPrice ?? u.salePrice)'),'consumer price persisted');
assert(html.includes('const newConsumer='),'unit conversion derives consumer price');

const balanceScript=fs.readFileSync(path.join(root,'app/src/main/assets/www/static/invoice-dual-balances.js'),'utf8');
const bc=vm.runInNewContext(balanceScript+';InvoiceDualBalances;',{});
const customer=accounts[0];
const invUSD={id:'invoice-USD',number:1,type:'sale',accountId:'whole',currency:'USD',date:'2026-11-13T10:00:00',subTotal:12,netTotal:12,paidAmount:2,remainingAmount:10,discountAmount:0,taxAmount:0,rows:[]};
const invSYP={...invUSD,id:'invoice-SYP',number:2,currency:'SYP',netTotal:12000,paidAmount:2000,subTotal:12000,remainingAmount:10000};
state.invoices=[invUSD,invSYP];
function dual(inv){return bc.managerBalance(inv,state.accounts,state.invoices,[]);}
assert.equal(dual(invUSD).before.USD,15);
assert.equal(dual(invUSD).after.USD,25);
assert.equal(dual(invUSD).after.SYP,90000);
assert.equal(dual(invSYP).before.SYP,90000);
assert.equal(dual(invSYP).after.SYP,100000);
assert.equal(dual(invSYP).after.USD,25);
const mocks={
    State:state,
    Accounting:{...Accounting,format:(v,c)=>`${v} ${c}`,getInvoiceTypeAr:()=> 'مبيعات',formatNumberOnly:(v)=>String(v),formatItemQuantity:(v)=>String(v),formatItemPriceNumber:(v)=>String(v),round:(v)=>v},
    InvoiceDualBalances:bc,
    ThermalPrinter:{formatPartyBalance:(v,c)=>`${v} ${c}`,formatReceiptDate:()=> '2026-11-13'}
};
const printPreview=snippet('renderInvoicePrint(main, params = {}) {','// ==================== 6.5 ACCOUNTS (CUSTOMERS & SUPPLIERS)');
const view=new Function('State','Accounting','InvoiceDualBalances','ThermalPrinter','UI',`return ({${printPreview}}).renderInvoicePrint;`)(mocks.State,mocks.Accounting,bc,mocks.ThermalPrinter,{setHeader:()=>{}});
for(const [inv,expected,hidden] of [[invUSD,'25 USD','90000 SYP'],[invSYP,'100000 SYP','25 USD']]){
  const main={innerHTML:''};view(main,{id:inv.id});
  assert(main.innerHTML.includes('الرصيد قبل الفاتورة'));
  assert(main.innerHTML.includes('الرصيد الحالي'));
  assert(main.innerHTML.includes(expected),`preview balance ${expected} missing`);
  assert(!main.innerHTML.includes(hidden),`preview must not show unrelated currency: ${hidden}`);
  assert.equal((main.innerHTML.match(/الرصيد الحالي/g)||[]).length,1);
}
const thermal=snippet('async renderInvoiceToCanvas(inv, widthDots) {','canvasToEscPosRaster(canvas) {');
const draw=[];
const context=()=>({fillText:(s)=>draw.push(String(s)),fillRect:()=>{},drawImage:()=>{},beginPath:()=>{},stroke:()=>{},moveTo:()=>{},lineTo:()=>{},setLineDash:()=>{},measureText:(s)=>({width:String(s).length*7})});
const fakeDoc={fonts:{ready:Promise.resolve()},getElementById:()=>({getContext:()=>context()}),createElement:()=>({width:0,height:0,getContext:()=>context()})};
const renderCanvas=new Function('State','Accounting','InvoiceDualBalances','document',`return ({${thermal}}).renderInvoiceToCanvas;`)(state,mocks.Accounting,bc,fakeDoc);
(async()=>{
  for(const inv of [invUSD,invSYP]){
    draw.length=0;
    await renderCanvas.call({formatReceiptDate:()=> 'date',formatPartyBalance:(v,c)=>`${v} ${c}`},inv,576);
    assert.equal(draw.filter(x=>x==='الرصيد قبل الفاتورة').length,1);
    assert.equal(draw.filter(x=>x==='الرصيد الحالي').length,1);
    assert(draw.includes(inv.currency==='USD'?'25 USD':'100000 SYP'));
    assert(!draw.includes(inv.currency==='USD'?'90000 SYP':'25 USD'));
  }
  // PDF intentionally receives only the selected currency and Java guards even legacy dual fields.
  assert(!html.includes('previousBalances:dual.before'));
  assert(!java.includes('for (String balanceCurrency : new String[]{"USD", "SYP"})'));
  assert(java.includes('beforeBalances.has(currency)'));
  assert(java.includes('الرصيد الحالي: '));
  console.log('PASS: consumer/wholesale/center (legacy, bundles), invoice preview, thermal print and PDF all restrict balances to invoice currency.');
})().catch(e=>{console.error(e);process.exitCode=1});
