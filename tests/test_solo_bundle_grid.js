'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/www/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/www/static/glossy-ui-3549.css'),'utf8');
const start=html.indexOf('            addBundleLine() {');
const end=html.indexOf('            updateBundlePricing(markDirty=true){',start);
assert(start>0 && end>start,'bundle selector methods not found');
const code=html.slice(start,end);
assert(html.includes('id="itmBundleGrid"')&&html.includes('id="itmBundleGroup"')&&html.includes('id="itmBundleSearch"'),'grid search and category controls');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'grid tiles 2 cols on phone');
assert(css.includes('.ta-bundle-grid-item.is-selected'),'selected style');
assert(!/this\.tempBundle\.push\(\{itemId:available\[0\]/.test(code),'never add the first item without user selection');
const items=[
  {id:'one',name:'مادة أولى',category:'سوائل',units:[{costPrice:2}]},
  {id:'two',name:'مادة ثانية',category:'مساحيق',units:[{costPrice:4}]},
  {id:'three',name:'مادة ثالثة',category:'سوائل',units:[{costPrice:1}]},
  {id:'kit',name:'تجميعة',isBundle:true,category:'أخرى'},
  {id:'escape',name:'<script>evil</script>',category:'أخرى'}
];
const classes=()=>({hidden:true,toggle(className,hidden){if(className==='hidden')this.hidden=hidden;}});
const els={
 itmBundleGrid:{innerHTML:'',scrollTop:0},
 itmBundleLines:{innerHTML:''},
 itmBundlePicker:{classList:classes()},
 itmBundlePickerToggle:{attrs:{},setAttribute(k,v){this.attrs[k]=v;}},
 itmBundleSearch:{value:''},
 itmBundleGroup:{value:'all'}
};
const ctx={State:{items},document:{getElementById:id=>els[id]||null},AppEscape:{text:v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))},Accounting:{parseNum:Number},UI:{toast:(v)=>{ctx.lastToast=String(v)}}};
const controller=vm.runInNewContext(`({tempBundle:[],activeEditId:'kit',bundlePickerOpen:false,markItemDirty(){this.dirty=(this.dirty||0)+1},updateBundlePricing(){},safePhotoData(){return ''},${code}})`,ctx);
ctx.ItemController=controller;
assert.equal(controller.tempBundle.length,0);
controller.addBundleLine();
assert.equal(controller.tempBundle.length,0,'opening picker must not add item');
assert.equal(els.itmBundlePickerToggle.attrs['aria-expanded'],'true');
assert.equal(els.itmBundlePicker.classList.hidden,false);
assert(els.itmBundleGrid.innerHTML.includes('مادة أولى'));
assert(els.itmBundleGrid.innerHTML.includes('مادة ثانية'));
assert(!els.itmBundleGrid.innerHTML.includes('data-item-id="kit"'),'nested bundles excluded');
assert(!els.itmBundleGrid.innerHTML.includes('<script>evil</script>'),'XSS-safe item labels');
controller.chooseBundleItem('one');
controller.chooseBundleItem('two');
controller.chooseBundleItem('one');
assert.equal(controller.tempBundle.length,2,'multi-select without duplicates');
assert.equal(controller.tempBundle[0].quantity,2,'second click increments quantity');
assert.equal(controller.tempBundle[1].quantity,1);
assert(els.itmBundleLines.innerHTML.includes('كمية مادة أولى'));
assert(els.itmBundleGrid.innerHTML.includes('الكمية: 2'));
controller.bundleLineUpdate(1,'quantity','3.5');
assert.equal(controller.tempBundle[1].quantity,3.5,'fractional quantities supported');
controller.bundleLineRemove(0);
assert.equal(controller.tempBundle.length,1);
assert(!els.itmBundleGrid.innerHTML.includes('الكمية: 2'));
els.itmBundleSearch.value='ثالثة';controller.renderBundleGrid();
assert(els.itmBundleGrid.innerHTML.includes('مادة ثالثة'));
assert(!els.itmBundleGrid.innerHTML.includes('مادة ثانية'));
els.itmBundleSearch.value='';els.itmBundleGroup.value='مساحيق';controller.renderBundleGrid();
assert(els.itmBundleGrid.innerHTML.includes('مادة ثانية'));
assert(!els.itmBundleGrid.innerHTML.includes('مادة أولى'));
controller.chooseBundleItem('kit');
assert.equal(controller.tempBundle.length,1,'nested kit rejected');
controller.toggleBundlePicker(false);
assert.equal(els.itmBundlePicker.classList.hidden,true);
console.log('PASS: assembly grid, search, groups, selected badges, multiple products, fractional quantities and safe labels.');
