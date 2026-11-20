// Render only the current page of notices. Keep the native page scrollbar and deep links.
const noticePages = (() => {
  const pageSize = 10;
  let rows = [], card, shown = 0, lastTop = 0, touchY = null;
  function panel() { return document.querySelector?.('[data-notice-list]'); }
  function render(history, draw) {
    const continuing = panel();
    rows = history.slice().sort((a,b) => (Date.parse(b.at)||0) - (Date.parse(a.at)||0));
    card = draw;
    shown = Math.min(rows.length, continuing ? Math.max(shown,pageSize) : pageSize);
    if (!continuing) lastTop = 0;
    return '<div data-notice-list>' + rows.slice(0,shown).map(card).join('') + '</div>';
  }
  function scrollParent(list) {
    for (let p=list.parentElement; p && p!==document.body; p=p.parentElement) {
      if (/^(auto|scroll|overlay)$/.test(getComputedStyle(p).overflowY) && p.scrollHeight>p.clientHeight+1) return p;
    }
    return document.scrollingElement;
  }
  function next(event, scrolling) {
    if (shown >= rows.length) return;
    const list=panel();
    if (!list) return;
    const scroller=scrollParent(list);
    if (!scroller) return;
    const root=scroller===document.scrollingElement;
    if (scrolling && event.target!==scroller && !(root && event.target===document)) return;
    if (!scrolling && event.target?.nodeType===1 && event.target!==document.body &&
        event.target!==document.documentElement && !list.closest('main')?.contains(event.target)) return;
    const top=scroller.scrollTop;
    if (scrolling) { const down=top>lastTop; lastTop=top; if(!down)return; }
    const bottom=root?window.innerHeight:scroller.getBoundingClientRect().top+scroller.clientHeight;
    if (list.getBoundingClientRect().bottom > bottom+2) return;
    const end=Math.min(shown+pageSize, rows.length);
    list.insertAdjacentHTML('beforeend',rows.slice(shown,end).map(card).join(''));
    shown=end;
  }
  if (typeof document!=='undefined') {
    document.addEventListener?.('scroll',e=>next(e,true),{capture:true,passive:true});
    document.addEventListener?.('wheel',e=>{if(e.deltaY>0)next(e,false);},{passive:true});
    document.addEventListener?.('touchstart',e=>{touchY=e.touches[0]?.clientY;},{passive:true});
    document.addEventListener?.('touchmove',e=>{
      const y=e.touches[0]?.clientY;
      if(touchY!=null && y<touchY)next(e,false);
      touchY=y;
    },{passive:true});
    document.addEventListener?.('keydown',e=>{if(['End','PageDown','ArrowDown'].includes(e.key)) next(e,false);});
  }
  return {render};
})();

/* Tiqany Acc Solo — stock depletion notifications, no external agent events. */
const StockNotifications = {
  maxEntries: 3000,
  ensure() {
    if(!State.alertCenter || typeof State.alertCenter!=='object')
      State.alertCenter={entries:[],stockLevels:null};
    const n=State.alertCenter;
    if(!Array.isArray(n.entries)) n.entries=[];
    n.entries=n.entries.filter(x=>x && (x.type==='stock'||x.type==='payroll'));
    delete n.seenImportIds;
    return n;
  },
  stockSnapshot() {
    const values={};
    if(typeof Accounting==='undefined'||!Accounting.getItemBaseStock)return values;
    for(const wh of State.warehouses||[]) {
      if(!wh?.id)continue;
      for(const item of State.items||[]) {
        if(!item?.id)continue;
        const qty=Number(Accounting.getItemBaseStock(item.id,null,wh.id));
        if(Number.isFinite(qty))values[wh.id+'::'+item.id]=qty;
      }
    }
    return values;
  },
  bootstrap() {
    const n=this.ensure();
    if(!n.stockLevels||typeof n.stockLevels!=='object')n.stockLevels=this.stockSnapshot();
    this.updateBadge();this.openNativePending();
  },
  prepareForSave() {
    if(typeof PayReminders!=='undefined')PayReminders.recordDue();
    const n=this.ensure(),created=[];
    if(!n.stockLevels||typeof n.stockLevels!=='object') {
      n.stockLevels=this.stockSnapshot();return created;
    }
    const current=this.stockSnapshot(),previous=n.stockLevels;
    for(const [key,qty] of Object.entries(current)) {
      if(!(key in previous))continue;
      const was=Number(previous[key]);
      if(!(Number.isFinite(was)&&was>0.000001&&qty<=0.000001))continue;
      const sep=key.indexOf('::');if(sep<0)continue;
      const warehouseId=key.slice(0,sep),itemId=key.slice(sep+2);
      const warehouse=(State.warehouses||[]).find(w=>w.id===warehouseId);
      const item=(State.items||[]).find(i=>i.id===itemId);
      if(!item||!warehouse)continue;
      const entry={id:'stock:'+Date.now()+':'+created.length+':'+encodeURIComponent(key),type:'stock',
        title:'نفدت كمية «'+item.name+'»',detail:'المستودع: '+warehouse.name+' · الرصيد الحالي: '+qty,
        itemId,warehouseId,at:new Date().toISOString(),read:false};
      n.entries.unshift(entry);created.push(entry);
    }
    n.stockLevels=current;
    if(n.entries.length>this.maxEntries)n.entries.length=this.maxEntries;
    return created;
  },
  unread(){return this.ensure().entries.reduce((sum,x)=>sum+(x.read?0:1),0);},
  updateBadge(){
    const badge=document.getElementById('headerNotificationsCount');if(!badge)return;
    const count=this.unread();badge.hidden=!count;
    badge.textContent=count>99?'99+':String(count);
    const button=document.getElementById('headerNotificationsBtn');
    if(button)button.setAttribute('aria-label',count?'الإشعارات: '+count+' غير مقروء':'الإشعارات');
  },
  render(main){
    UI.setHeader('<i class="fas fa-bell text-emerald-400"></i> <span>الإشعارات</span>','تنبيهات نفاد المواد من المستودعات');
    const list=this.ensure().entries,escape=v=>AppEscape.text(String(v??''));
    main.innerHTML=`<div class="space-y-3" dir="rtl">
      <div class="rounded-2xl bg-white border p-4 flex items-center justify-between gap-2">
        <div><h2 class="font-black">مركز الإشعارات</h2><p class="text-xs text-slate-500">${list.length} إشعار · ${this.unread()} غير مقروء</p></div>
        <button type="button" class="bg-slate-100 border rounded-xl px-3 py-2 text-xs font-bold" onclick="StockNotifications.readAll()">تحديد الكل كمقروء</button>
      </div>
      ${list.length?noticePages.render(list,entry=>`<button type="button" class="ta-alert-item stock-alert ${entry.read?'':'unread'}" onclick="StockNotifications.open(${JSON.stringify(entry.id).replace(/"/g,'&quot;')})">
        <div class="flex items-center gap-2 justify-between"><strong class="ta-alert-title text-sm text-slate-800">⚠️ ${escape(entry.title)}</strong>${entry.read?'':'<span class="ta-alert-badge rounded-full bg-rose-500 text-white text-[10px] px-2 py-0.5">جديد</span>'}</div>
        <p class="ta-alert-detail text-xs text-slate-600 mt-1">${escape(entry.detail)}</p>
        <p class="ta-alert-meta text-[10px] text-slate-400 mt-2">${escape(String(entry.at||'').slice(0,19).replace('T',' '))}</p>
      </button>`):'<div class="rounded-2xl bg-white border p-8 text-center text-sm text-slate-500">لا توجد إشعارات حالياً. ستظهر هنا تنبيهات المخزون ومواعيد الأجور.</div>'}
    </div>`;
  },
  async readAll(){
    const n=this.ensure(),before=n.entries.map(x=>x.read);
    n.entries.forEach(x=>x.read=true);this.updateBadge();
    try{await StorageEngine.saveState();if(AppNav.current().screen==='notifications')AppNav.renderCurrent();}
    catch(e){n.entries.forEach((x,i)=>x.read=before[i]);this.updateBadge();UI.toast('تعذر حفظ حالة الإشعارات','error');}
  },
  async open(id){
    if(typeof id==='string' && id.startsWith('paydue:')){
      const row=this.ensure().entries.find(e=>e.id===id);
      if(row&&!row.read){row.read=true;this.updateBadge();try{await StorageEngine.saveState();}catch{row.read=false;this.updateBadge();}}
      return PayReminders.open(id);
    }
    const entry=this.ensure().entries.find(x=>x.id===id);
    if(!entry)return UI.toast('هذا الإشعار غير متوفر','warn');
    if(!entry.read){entry.read=true;this.updateBadge();try{await StorageEngine.saveState();}catch(e){entry.read=false;this.updateBadge();}}
    AppNav.navigate('reports',{tab:'inventory',warehouseId:entry.warehouseId});
    UI.toast('المادة: '+((State.items||[]).find(x=>x.id===entry.itemId)?.name||entry.itemId),'warn');
  },
  openNativePending(){
    try{const id=window.AndroidAlerts?.consumePending?.();if(id)setTimeout(()=>this.open(id),0);}catch(_){}
  },
  saved(created){
    this.updateBadge();
    if(created.length&&AppNav.current().screen==='notifications')AppNav.renderCurrent();
    for(const entry of created){try{window.AndroidAlerts?.show?.(entry.id,entry.title,entry.detail);}catch(_){}}
  }
};
window.__nativeAlertTap=function(id){try{window.AndroidAlerts?.consumePending?.();}catch(_){}StockNotifications.open(String(id));};
(function(){
  const original=StorageEngine.saveState;
  StorageEngine.saveState=async function(...args){
    const before=JSON.parse(JSON.stringify(StockNotifications.ensure()));
    const created=StockNotifications.prepareForSave();
    try{const value=await original.apply(this,args);StockNotifications.saved(created);return value;}
    catch(e){State.alertCenter=before;StockNotifications.updateBadge();throw e;}
  };
})();
