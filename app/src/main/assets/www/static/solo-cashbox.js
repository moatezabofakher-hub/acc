/* Tiqany Acc Solo — company cash movements, without field-agent cashboxes. */
const SoloCashbox = {
  summary() {
    let sypCash = 0, usdCash = 0;
    const movements = [];
    const round=(v,c)=>c==='SYP'?Math.round(v):Math.round((v+Number.EPSILON)*100)/100;
    function add(m) {
      if(!['SYP','USD'].includes(m.currency))return;
      const inflow=Number(m.inflow||0),outflow=Number(m.outflow||0);
      if(!Number.isFinite(inflow+outflow)||inflow<0||outflow<0)return;
      if(m.currency==='SYP')sypCash=round(sypCash+inflow-outflow,'SYP');
      else usdCash=round(usdCash+inflow-outflow,'USD');
      movements.push(m);
    }
    for(const inv of State.invoices||[]) {
      const paid=Number(inv?.paidAmount||0);
      if(!(paid>0))continue;
      const incoming=['sale','purchase_return'].includes(inv.type);
      add({id:inv.id,date:inv.date||'',ref:'فاتورة #'+(inv.number||''),
        party:(State.accounts||[]).find(a=>a.id===inv.accountId)?.name||'عميل نقدي',
        desc:'فاتورة',currency:inv.currency,inflow:incoming?paid:0,outflow:incoming?0:paid});
    }
    for(const v of State.vouchers||[]) {
      const amount=Number(v?.amount||0);
      if(!(amount>0))continue;
      const incoming=v.type==='receipt';
      add({id:v.id,date:v.date||'',ref:'سند #'+(v.number||''),
        party:(State.accounts||[]).find(a=>a.id===v.accountId)?.name||'حساب عام',
        desc:v.note||'سند مالي',currency:v.currency,inflow:incoming?amount:0,outflow:incoming?0:amount});
    }
    for(const e of State.expenses||[]) {
      const amount=Number(e?.amount||0);
      if(amount>0)add({id:e.id,date:e.date||'',ref:'مصروف',party:e.category||'مصاريف',
        desc:e.note||'مصروف نقدي',currency:e.currency,inflow:0,outflow:amount});
    }
    movements.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return {sypCash,usdCash,movements};
  }
};
