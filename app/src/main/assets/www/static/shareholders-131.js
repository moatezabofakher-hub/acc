/* Shareholders v131 - clean-start capital ledger and profit distributions.
 * Keeps ownership contributions separate from internal cash transfers and revenue.
 */
(function(root){
'use strict';
const money=(n,c)=>c==='SYP'?Math.round(n):Math.round((n+Number.EPSILON)*100)/100;
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owners=()=>Array.isArray(State.shareholders)?State.shareholders:(State.shareholders=[]);
const movements=()=>Array.isArray(State.shareholderMovements)?State.shareholderMovements:(State.shareholderMovements=[]);
const id=()=>{if(!root.crypto?.randomUUID)throw Error('تحتاج العملية إلى مولد معرفات آمن');return 'sh_'+root.crypto.randomUUID()};
const validCurrency=c=>['SYP','USD'].includes(c);
const dt=()=>new Date().toISOString();
const exchange=()=>Math.max(1,Number(State.settings?.exchangeRate)||1);
const usd=(amount,c,rate=exchange())=>c==='USD'?amount:amount/rate;
const fmt=(n,c)=>Accounting.format(money(n,c),c);
const button=(label,fn,cls='')=>'<button type="button" class="ta-sh-btn '+cls+'" onclick="'+fn+'">'+label+'</button>';
const field=(label,control)=>'<label class="ta-sh-field"><span>'+label+'</span>'+control+'</label>';
const input=(id,type='text',value='')=>'<input id="'+id+'" type="'+type+'" value="'+html(value)+'" '+(type==='number'?'min="0" step="any"':'')+' required>';
const selectCurrency=()=>'<select id="shCurrency"><option value="SYP">الليرة السورية SYP</option><option value="USD">الدولار USD</option></select>';
function init(){owners();movements()}
function save(){
 return StorageEngine.saveState().then(()=>{UI.toast('تم حفظ العملية','success')}).catch(e=>{UI.toast('فشل الحفظ: '+e.message,'error');throw e});
}
function currentOwner(ownerId){return owners().find(x=>x.id===ownerId)}
function totalContrib(ownerId,c){
 return money(movements().filter(x=>x.ownerId===ownerId&&x.currency===c&&['contribute','withdraw'].includes(x.type))
 .reduce((sum,x)=>sum+(x.type==='contribute'?1:-1)*x.amount,0),c);
}
function withdrawals(ownerId,c){
 return money(movements().filter(x=>x.ownerId===ownerId&&x.currency===c&&x.type==='profit').reduce((s,x)=>s+x.amount,0),c);
}
/* Revenue and cost logic follows invoice rows in the existing P&L report.
 * All event dates are compared as ISO date strings. Profit is an estimate based
 * on the saved item cost snapshot, just as the current report does. */
function profitSince(start){
 let p=0;
 for(const inv of (State.invoices||[])){
  if(!inv||!['sale','sale_return'].includes(inv.type)||String(inv.date||'').slice(0,10)<start)continue;
  const sign=inv.type==='sale'?1:-1;
  const rate=Number(inv.exchangeRate)>0?Number(inv.exchangeRate):exchange();
  for(const row of (inv.rows||[])){
   const item=(State.items||[]).find(i=>i.id===row.itemId);
   if(!item)continue;
   const units=item.units||[];
   const unit=units.find(u=>u.name===row.unitName)||units[0]||{};
   const qty=Number(row.qty)||0;
   const cost=(Number(row.baseCostPrice??(item.isBundle?Accounting.itemCostPrice(item,unit):unit.costPrice))||0)*qty;
   const revenue=Number(row.total)||qty*(Number(row.price)||0)-(Number(row.discount)||0);
   p+=sign*(usd(revenue,inv.currency||'SYP',rate)-usd(cost,item.currency||inv.currency||'SYP',rate));
  }
 }
 for(const exp of (State.expenses||[])){
  if(String(exp?.date||'').slice(0,10)<start)continue;
  const amount=Number(exp.amount)||0;
  p-=usd(amount,exp.currency||'SYP',Number(exp.exchangeRate)>0?Number(exp.exchangeRate):exchange());
 }
 return Math.round((p+Number.EPSILON)*100)/100;
}
function start(owner){
 return owner.period==='all'?'0000-01-01':owner.period==='added'?owner.createdAt.slice(0,10):owner.startDate;
}
function allocated(owner){return money(profitSince(start(owner))*Number(owner.percent||0)/100,'USD')}
function balance(owner){
 const used=(movements().filter(x=>x.ownerId===owner.id&&x.type==='profit')).reduce((s,x)=>s+usd(x.amount,x.currency,x.rate),0);
 return money(allocated(owner)-used,'USD');
}
function totals(){const sum={SYP:0,USD:0};for(const o of owners())for(const c of ['SYP','USD'])sum[c]+=totalContrib(o.id,c);return sum}
function ensurePercent(){
 const sum=owners().reduce((s,x)=>s+Number(x.percent||0),0);
 if(sum>100.000001)throw Error('مجموع النسب لا يجوز أن يتجاوز 100%');
}
const old=root.CapitalLedger;
const Shareholders={
 init,owners,movements,profitSince,allocated,balance,totals,
 card(){
  const s=totals();
  return '<button type="button" class="ta-capital-card" onclick="Shareholders.open()"><span class="ta-capital-icon"><i class="fas fa-users"></i></span><span class="ta-capital-card-text"><strong>رأس المال / المساهمون</strong><small>صافي مساهمات المالكين، وليس رصيد الصندوق</small><span class="ta-capital-amount">'+fmt(s.SYP,'SYP')+' | '+fmt(s.USD,'USD')+'</span></span></button>';
 },
 open(){
  init();const t=totals();
  const cards=owners().map(o=>'<button class="ta-sh-owner" onclick="Shareholders.ownerMenu(\''+o.id+'\')"><small>تاريخ البداية '+html(start(o))+'</small><strong>'+html(o.name)+'</strong><span>المساهمة: '+fmt(totalContrib(o.id,'SYP'),'SYP')+' | '+fmt(totalContrib(o.id,'USD'),'USD')+'</span><span>الأرباح المسحوبة: '+fmt(withdrawals(o.id,'USD'),'USD')+' | '+fmt(withdrawals(o.id,'SYP'),'SYP')+'</span><span>رصيد الأرباح: '+fmt(balance(o),'USD')+'</span><small>نسبة الأرباح: '+html(o.percent)+'%</small></button>').join('');
  UI.openModal('<section class="ta-sh" dir="rtl"><h2>المساهمون</h2><div class="ta-sh-total"><strong>إجمالي المساهمات</strong><div>'+fmt(t.SYP,'SYP')+' | '+fmt(t.USD,'USD')+'</div></div><div class="ta-sh-grid">'+cards+'</div><div class="ta-sh-actions">'+button('إضافة مالك','Shareholders.newOwner()')+button('النسبة المئوية لتوزيع الأرباح','Shareholders.percentForm()')+button('إضافة مبلغ إلى الصندوق','Shareholders.transferForm(\'receive\')')+button('سحب مبلغ من الصندوق','Shareholders.transferForm(\'pay\')')+'</div>'+button('إغلاق','UI.forceCloseModal()','secondary')+'</section>');
 },
 newOwner(){
  UI.openModal('<section class="ta-sh" dir="rtl"><h2>إضافة مالك</h2>'+field('اسم المالك',input('shName'))+field('رقم الهاتف',input('shPhone','tel'))+field('فترة احتساب الأرباح','<select id="shPeriod" onchange="Shareholders.toggleDate(this.value)"><option value="all">كل المدة</option><option value="added">من تاريخ الإضافة</option><option value="date">تاريخ محدد</option></select>')+'<div id="shDateWrap" hidden>'+field('تاريخ البداية',input('shStartDate','date',new Date().toISOString().slice(0,10)))+'</div>'+button('حفظ','Shareholders.saveOwner()')+button('إلغاء','Shareholders.open()','secondary')+'</section>');
 },
 toggleDate(v){const el=document.getElementById('shDateWrap');if(el)el.hidden=v!=='date'},
 async saveOwner(){
  const name=document.getElementById('shName')?.value.trim();
  const phone=document.getElementById('shPhone')?.value.trim();
  const period=document.getElementById('shPeriod')?.value;
  const startDate=document.getElementById('shStartDate')?.value;
  if(!name)return UI.toast('اسم المالك مطلوب','error');
  if(!['all','added','date'].includes(period)||period==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(startDate))return UI.toast('حدد تاريخاً صحيحاً','error');
  if(owners().some(x=>x.name===name))return UI.toast('المالك موجود بالفعل','warn');
  const o={id:id(),name,phone,period,startDate:period==='date'?startDate:null,createdAt:dt(),percent:0};
  owners().push(o);
  try{await save();this.open()}catch(e){State.shareholders=owners().filter(x=>x.id!==o.id)}
 },
 ownerMenu(ownerId){
  const o=currentOwner(ownerId);if(!o)return this.open();
  UI.openModal('<section class="ta-sh" dir="rtl"><h2>'+html(o.name)+'</h2><p>المساهمة: '+fmt(totalContrib(o.id,'USD'),'USD')+' | '+fmt(totalContrib(o.id,'SYP'),'SYP')+'</p>'+button('إضافة مبلغ إلى رأس المال','Shareholders.moneyForm(\''+o.id+'\',\'contribute\')')+button('سحب مبلغ من رأس المال','Shareholders.moneyForm(\''+o.id+'\',\'withdraw\')')+button('سحب من الأرباح','Shareholders.moneyForm(\''+o.id+'\',\'profit\')')+button('رجوع','Shareholders.open()','secondary')+'</section>');
 },
 moneyForm(ownerId,type){
  const o=currentOwner(ownerId);if(!o||!['contribute','withdraw','profit'].includes(type))return;
  const title={contribute:'إضافة مبلغ إلى رأس المال',withdraw:'سحب مبلغ من رأس المال',profit:'سحب من الأرباح'}[type];
  UI.openModal('<section class="ta-sh" dir="rtl"><h2>'+title+' — '+html(o.name)+'</h2>'+field('العملة',selectCurrency())+field('المبلغ',input('shAmount','number'))+button('حفظ','Shareholders.saveMoney(\''+o.id+'\',\''+type+'\')')+button('إلغاء','Shareholders.ownerMenu(\''+o.id+'\')','secondary')+'</section>');
 },
 async saveMoney(ownerId,type){
  const o=currentOwner(ownerId),c=document.getElementById('shCurrency')?.value,raw=Number(document.getElementById('shAmount')?.value);
  if(!o||!validCurrency(c)||!Number.isFinite(raw)||raw<=0||raw>1e12)return UI.toast('أدخل مبلغاً وعملة صحيحين','error');
  const amount=money(raw,c);
  if(amount<=0)return UI.toast('المبلغ صغير جداً','error');
  if(type==='withdraw'&&amount>totalContrib(ownerId,c))return UI.toast('المساهمة غير كافية','error');
  if(type==='profit'&&usd(amount,c)>balance(o)+0.00001)return UI.toast('رصيد الأرباح غير كافٍ','error');
  if(['withdraw','profit'].includes(type)){
   const cash=old.officeCash(),available=c==='USD'?cash.usdCash:cash.sypCash;
   if(amount>available+0.00001)return UI.toast('رصيد الصندوق غير كافٍ','error');
  }
  const entry={id:id(),ownerId,type,currency:c,amount,rate:exchange(),date:dt()};
  movements().push(entry);
  try{await save();this.open()}catch(e){State.shareholderMovements=movements().filter(x=>x.id!==entry.id)}
 },
 percentForm(){
  init();
  UI.openModal('<section class="ta-sh" dir="rtl"><h2>النسبة المئوية لتوزيع الأرباح</h2><p>الحد الأعلى لمجموع النسب 100%</p>'+owners().map(o=>field(html(o.name),' <div class="ta-sh-percent">'+input('shPct_'+o.id,'number',o.percent)+'<b>%</b></div>')).join('')+button('حفظ','Shareholders.savePercents()')+button('إلغاء','Shareholders.open()','secondary')+'</section>');
 },
 async savePercents(){
  const proposed=owners().map(o=>({o,p:Number(document.getElementById('shPct_'+o.id)?.value)}));
  if(proposed.some(x=>!Number.isFinite(x.p)||x.p<0||x.p>100)||proposed.reduce((s,x)=>s+x.p,0)>100.000001)return UI.toast('يجب أن تكون النسب بين 0 و100 ومجموعها لا يزيد عن 100','error');
  const previous=proposed.map(x=>x.o.percent);
  proposed.forEach(x=>x.o.percent=x.p);
  try{ensurePercent();await save();this.open()}catch(e){proposed.forEach((x,i)=>x.o.percent=previous[i])}
 },
 transferForm(direction){
  if(!['receive','pay'].includes(direction))return;
  UI.openModal('<section class="ta-sh" dir="rtl"><h2>'+(direction==='receive'?'إضافة مبلغ إلى الصندوق':'سحب مبلغ من الصندوق')+'</h2>'+field('العملة',selectCurrency())+field('المبلغ',input('shAmount','number'))+button('حفظ','Shareholders.saveTransfer(\''+direction+'\')')+button('إلغاء','Shareholders.open()','secondary')+'</section>');
 },
 async saveTransfer(direction){
  const c=document.getElementById('shCurrency')?.value,a=money(Number(document.getElementById('shAmount')?.value),c);
  if(!validCurrency(c)||!Number.isFinite(a)||a<=0||a>1e12)return UI.toast('المبلغ غير صالح','error');
  if(direction==='pay'){const cash=old.officeCash();if(a>(c==='USD'?cash.usdCash:cash.sypCash)+.00001)return UI.toast('رصيد الصندوق غير كافٍ','error')}
  const entry={id:id(),direction,amount:a,currency:c,date:dt(),kind:'capital-transfer'};
  State.capitalMovements=(State.capitalMovements||[]).concat(entry);
  try{await save();this.open()}catch(e){State.capitalMovements=State.capitalMovements.filter(x=>x.id!==entry.id)}
 },
 cashMovements(){
  return old.cashMovements().concat(movements().filter(x=>x.type==='profit').map(x=>({id:x.id,docType:'profit-distribution',date:x.date,ref:'سحب أرباح',party:currentOwner(x.ownerId)?.name||'مالك',desc:'توزيع أرباح على المالك',currency:x.currency,inflow:0,outflow:x.amount})));
 },
 total(){return totals()},
 officeCash(){return old.officeCash()}
};
root.Shareholders=Shareholders;
root.CapitalLedger=Shareholders;
if(typeof module==='object'&&module.exports)module.exports=Shareholders;
})(typeof globalThis==='object'?globalThis:this);
