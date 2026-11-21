/* Import the v1 transfer file exported after review in Tiqany Reader. */
const CatalogImport = (() => {
    const captions = {items:'المواد', accounts:'الحسابات'};
    const key = value => String(value ?? '').normalize('NFC')
        .replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)))
        .replace(/[\u0640\u064b-\u065f\u061c\u200e\u200f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
    const codeKey = s => key(s).replace(/^0+(?=\d+$)/, '');
    const numeric = s => /^\d+$/.test(s);
    const padded = n => String(n).padStart(6,'0');
    function highest(items, floor) {
        let max = numeric(key(floor)) ? BigInt(key(floor)) : 0n;
        for (const item of items) {
            const n = key(item.itemNumber);
            if (numeric(n) && BigInt(n) > max) max = BigInt(n);
        }
        return max;
    }
    function suggested() { return padded(highest(State.items, State.settings.itemNumberHighWater) + 1n); }
    function safeText(value) {
        // Cards are displayed in templates inherited from earlier releases.
        return typeof value === 'string' && !/[<>"'&\u0000-\u001f]/.test(value);
    }
    function cardCode(value, id) {
        const code = String(value || '').trim();
        if (!code || !safeText(code) || code.length > 128) throw Error('أدخل رقم مادة صالحاً.');
        if (State.items.some(i => i.id !== id && codeKey(i.itemNumber) === codeKey(code)))
            throw Error('رقم المادة مستخدم في بطاقة أخرى.');
        return code;
    }
    function remember(code) {
        if (!numeric(key(code))) return;
        const max=highest([], State.settings.itemNumberHighWater);
        if(BigInt(key(code)) > max) State.settings.itemNumberHighWater=String(BigInt(key(code)));
    }
    function validate(row, kind) {
        if (!row || !safeText(row.name) || !key(row.name) || !safeText(row.code) || row.code.length > 128 ||
            !['USD','SYP'].includes(row.currency)) throw Error('راجع اسم السجل ورقمه وعملته في القارئ.');
        const item = kind === 'items';
        for (const f of item ? ['barcode','category','unit'] : ['phone','address']) {
            if (row[f] != null && !safeText(row[f])) throw Error('راجع حقل النص في بطاقة '+row.name);
        }
        if (!item && !['customer','supplier'].includes(row.type)) throw Error('نوع الحساب غير صالح.');
        for (const f of item ? ['purchase','cost','wholesale','center','consumer','stock'] : ['balanceOurs']) {
            const n=row[f];
            if(n!=null && (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER ||
                (item && f!=='stock' && n<0))) throw Error('راجع المبلغ في بطاقة '+row.name);
        }
        if(row.details!=null && (!Array.isArray(row.details) || row.details.some(x=>
            !Array.isArray(x)||x.length!==2||x.some(v=>typeof v!=='string')))) throw Error('تفاصيل غير صالحة في بطاقة '+row.name);
    }
    const id = prefix => prefix+'_'+(crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint32Array(4)), n=>n.toString(16).padStart(8,'0')).join(''));
    function plan(state, packet, kind) {
        if (!Object.hasOwn(captions,kind) || packet?.format!=='tiqany.catalog-transfer' || packet.version!==1 ||
            !Array.isArray(packet.items) || !Array.isArray(packet.accounts))
            throw Error('اختر ملف المواد والحسابات JSON الذي صدّرته من قارئ التقني.');
        const rows=packet[kind];
        if (!rows.length) throw Error('الملف لا يحتوي على '+captions[kind]+'.');
        rows.forEach(r=>validate(r,kind));
        const added=[], skipped=[], categories=[];
        if(kind==='items'){
            const names=new Set(state.items.map(i=>key(i.name)));
            const codes=new Set(state.items.map(i=>codeKey(i.itemNumber)).filter(Boolean));
            const barcodes=new Set(state.items.flatMap(i=>[i.barcode,...(i.units||[]).map(u=>u.barcode)]).filter(Boolean).map(key));
            const reserved=new Set(rows.map(r=>codeKey(r.code)).filter(Boolean));
            const groups=new Map((state.categories||[]).map(c=>[key(c),c]));
            let next=highest(state.items,state.settings.itemNumberHighWater)+1n;
            for(const r of rows){
                if(names.has(key(r.name))||(r.code && codes.has(codeKey(r.code)))||(r.barcode && barcodes.has(key(r.barcode)))){
                    skipped.push(r.name);continue;
                }
                let number=r.code.trim();
                if(!number){
                    while(reserved.has(String(next)) || codes.has(String(next)))next++;
                    number=padded(next++);
                }
                names.add(key(r.name));codes.add(codeKey(number));
                if(r.barcode)barcodes.add(key(r.barcode));
                const category=(r.category||'').trim();
                if(category&&!groups.has(key(category))){groups.set(key(category),category);categories.push(category);}
                const price=r.wholesale??0;
                added.push({id:id('itm'),name:r.name.trim(),itemNumber:number,category:groups.get(key(category))||'',
                    barcode:r.barcode||'',currency:r.currency,openingStockBase:0,minStockBase:0,isBundle:false,
                    bundlePricing:{mode:'manual',markup:0},bundleComponents:[],photoData:'',importDetails:r,
                    units:[{name:r.unit?.trim()||'وحدة',factor:1,barcode:r.barcode||'',salePrice:price,wholesalePrice:price,
                        consumerPrice:r.consumer??price,centerPrice:r.center??price,costPrice:r.cost??r.purchase??0,lastPurchasePrice:r.purchase??null}]});
            }
        } else {
            const identity=r=>r.type+'|'+key(r.name);
            const priorNames=new Set(state.accounts.map(identity));
            const codes=new Set(state.accounts.map(a=>codeKey(a.accountNumber)).filter(Boolean));
            const batch=new Map();
            for(const r of rows){
                const k=identity(r),prior=batch.get(k),code=codeKey(r.code);
                if(priorNames.has(k) || (!prior && code && codes.has(code)) ||
                    (prior && (prior.currencies.has(r.currency) || codeKey(prior.card.accountNumber)!==code))){
                    skipped.push(r.name+' ('+r.currency+')');continue;
                }
                const card=prior?.card||{id:id('acc'),name:r.name.trim(),type:r.type,accountNumber:r.code.trim(),
                    phone:r.phone||'',address:r.address||'',creditLimitUsd:0,openingUsd:0,openingSyp:0,
                    paymentTerms:'',priceTier:'wholesale',createdAt:new Date().toISOString().slice(0,10),importDetails:[]};
                card[r.currency==='USD'?'openingUsd':'openingSyp']=(r.balanceOurs??0)*(r.type==='supplier'?-1:1);
                card.importDetails.push(r);
                if(!prior){added.push(card);batch.set(k,{card,currencies:new Set()});if(code)codes.add(code);}
                batch.get(k).currencies.add(r.currency);
            }
        }
        return {added,skipped,categories};
    }
    let pending=null, busy=false, loadSerial=0;
    const escape=v=>AppEscape.text(v);
    function signature(planned){
        return JSON.stringify([planned.added.map(c=>({...c,id:'',createdAt:''})),planned.skipped,planned.categories]);
    }
    function preview(packet,kind,profile){
        const p=plan(State,packet,kind),title='استعادة '+captions[kind];
        pending={packet,kind,profile,signature:signature(p)};
        const details=p.added.map(c=>{
            const desc=kind==='items'?[c.itemNumber,c.currency,'التكلفة '+c.units[0].costPrice,'الجملة '+c.units[0].wholesalePrice,'المستهلك '+c.units[0].consumerPrice]:
                [c.type==='supplier'?'مورد':'زبون',...c.importDetails.map(r=>r.balanceOurs==null?'بلا رصيد':(r.balanceOurs<0?'علينا ':'لنا ')+Math.abs(r.balanceOurs)+' '+r.currency)];
            return '<li>'+escape(c.name)+' · '+escape(desc.join(' · '))+'</li>';
        }).join('');
        UI.openModal('<div class="space-y-3 text-right"><h3 class="font-black">'+title+'</h3><p>'+escape(ProfileManager.currentName())+
            ' · بطاقات جديدة: '+p.added.length+' · أسطر مكررة: '+p.skipped.length+'</p>'+
            (kind==='items'?'<p class="text-xs">تدخل البطاقات برصيد مخزون صفر. تبقى كمية الصورة في تفاصيل المصدر.</p>':'')+
            '<div class="max-h-48 overflow-y-auto"><ul>'+details+'</ul></div>'+
            (p.skipped.length?'<details><summary>الأسماء المتجاوزة</summary><p>'+p.skipped.map(escape).join('، ')+'</p></details>':'')+
            '<div class="grid grid-cols-2 gap-2">'+(p.added.length?'<button type="button" class="bg-emerald-700 text-white rounded-xl p-2 font-bold" onclick="CatalogImport.confirm()">تأكيد الإضافة</button>':'')+
            '<button type="button" class="bg-slate-100 text-slate-900 rounded-xl p-2 font-bold" onclick="CatalogImport.cancel()">إلغاء</button></div></div>');
    }
    function cancel(){pending=null;UI.forceCloseModal();}
    async function open(event,kind){
        const input=event.target,file=input.files?.[0];input.value='';if(!file||busy)return;
        const serial=++loadSerial,profile=ProfileManager.activeId;pending=null;
        try{
            const packet=JSON.parse((await file.text()).replace(/^\uFEFF/,''));
            if(serial===loadSerial&&profile===ProfileManager.activeId)preview(packet,kind,profile);
        }catch(e){UI.toast(e instanceof SyntaxError?'ملف JSON غير صالح.':e.message,'error');}
    }
    async function commit(req){
        if(req!==pending||busy)return;
        if(req.profile!==ProfileManager.activeId){pending=null;return UI.toast('تغيّرت الشركة المفتوحة. اختر الملف من جديد.','warn');}
        busy=true;
        try{
            if(!StorageEngine.db)throw Error('قاعدة بيانات الشركة غير جاهزة.');
            const p=plan(State,req.packet,req.kind);
            if(signature(p)!==req.signature){preview(req.packet,req.kind,req.profile);UI.toast('تغيّرت البيانات، راجع المعاينة المحدّثة.','warn');return;}
            if(!p.added.length)return;
            if(!State.license.isActivated && p.added.length>LicenseManager.getRemainingTrialOps()){
                LicenseManager.openActivationModal(true);return;
            }
            const oldCards=State[req.kind],oldGroups=State.categories,oldUsed=State.license.opsUsedCount;
            const groups=p.categories.length?[...oldGroups,...p.categories]:oldGroups;
            const cards=[...oldCards,...p.added], used=LicenseManager.getTotalOpsUsed()+p.added.length;
            State[req.kind]=cards;State.categories=groups;State.license.opsUsedCount=used;
            try {await StorageEngine.saveState();}
            catch(e){
                if(req.profile===ProfileManager.activeId){
                    if(State[req.kind]===cards)State[req.kind]=oldCards;
                    if(State.categories===groups)State.categories=oldGroups;
                    if(State.license.opsUsedCount===used)State.license.opsUsedCount=oldUsed;
                    LicenseManager.persistFallbackStorage();
                }
                throw e;
            }
            pending=null;UI.forceCloseModal();AppNav.renderCurrent();UI.toast('تمت إضافة '+p.added.length+' من '+captions[req.kind]+' إلى الشركة.','success');
        }catch(e){UI.toast('تعذّرت الإضافة: '+e.message,'error');}finally{busy=false;}
    }
    function confirm(){
        const req=pending;if(!req||busy)return;
        if(State.settings.appProtection?.pinHash)ProtectionController.requestPin('تأكيد استعادة '+captions[req.kind],()=>commit(req));
        else return commit(req);
    }
    return {open,confirm,cancel,plan,suggested,cardCode,remember};
})();
