/* First-run restore chooser. External SAF folders are not destroyed by uninstall;
   Android revokes access on uninstall, so the user must grant the folder again. */
(function(){
'use strict';
const isAgent=typeof window.Agent!=='undefined';
const KEY='tiqany-recovery-start-v1';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=document.createElement('style');style.textContent='#ta-recovery-overlay{position:fixed;inset:0;background:rgba(8,27,45,.85);z-index:2147483645;display:flex;justify-content:center;align-items:center;padding:12px;box-sizing:border-box}#ta-recovery-card{background:white;color:#123046;width:min(100%,520px);max-height:94dvh;overflow-y:auto;border-radius:20px;padding:19px;text-align:start;box-shadow:0 13px 42px rgba(0,0,0,.36);font:600 14px/1.65 system-ui,sans-serif}#ta-recovery-card h2{margin:0 0 13px;font-size:20px;font-weight:950;color:#07476b}#ta-recovery-card .ta-recovery-warning{background:#fff9e7;border:1px solid #f8dea2;padding:11px;border-radius:12px}#ta-recovery-card button{display:block;width:100%;min-height:43px;border:0;border-radius:12px;margin-top:10px;padding:9px 12px;font-size:14px;font-weight:900;cursor:pointer;background:#0b7183;color:#fff}#ta-recovery-card button.secondary{background:#dfeaf0;color:#173b51}#ta-recovery-card button.ta-recovery-file{background:#eef8ff;color:#124666;border:1px solid #b6d9eb;text-align:start;overflow-wrap:anywhere}#ta-recovery-card button[disabled]{opacity:.65}';document.head.appendChild(style);
let screen=null,selectedFolder=false,loading=false;
function show(html){let el=document.getElementById('ta-recovery-overlay');if(!el){el=document.createElement('div');el.id='ta-recovery-overlay';el.innerHTML='<section id="ta-recovery-card" role="dialog" aria-modal="true" aria-labelledby="ta-recovery-title"></section>';document.body.appendChild(el);}const card=el.querySelector('#ta-recovery-card');card.setAttribute('dir','rtl');card.innerHTML=html;screen=el;}
function hide(){screen?.remove();screen=null;}
function heading(){return `<h2 id="ta-recovery-title">${'استعادة بيانات المحاسبة'}</h2>`;}
function footer(){return `<p class="ta-recovery-warning">${'تُحذف بيانات التطبيق الداخلية عادةً عند إلغاء تثبيته. النسخ الخارجية وحدها يمكن استعادتها بعد الحذف.'}</p>`;}
const Recovery={
  boot(){if(!window.AndroidRecovery?.chooseBackupFolder)return;
    if(localStorage.getItem(KEY))return;
    const old=isAgent?!!(Agent.state&&(Agent.ready()||(Agent.state.ops||[]).length)):
      !!(window.State&&(['invoices','vouchers','items','accounts','expenses','categories'].some(k=>(State[k]||[]).length>0)||(State.settings?.companyName&&State.settings.companyName!=='المحاسب التقني'&&State.settings.companyName!=='مؤسسة')));
    if(old){localStorage.setItem(KEY,'existing');return;}
    show(heading()+footer()+`<p>${'يمكنك البحث عن النسخ التي احتفظت بها سابقاً، أو إنشاء قاعدة بيانات جديدة.'}</p><button onclick="TiqanyRecovery.chooseFolder()">${'اختيار مجلد النسخ القديمة'}</button><button class="secondary" onclick="TiqanyRecovery.newDatabase()">${'إنشاء قاعدة بيانات جديدة'}</button>`);
  },
  chooseFolder(){if(!window.AndroidRecovery)return;window.AndroidRecovery.chooseBackupFolder();},
  newDatabase(){localStorage.setItem(KEY,'new');hide();
    if(!window.AndroidAutoBackup?.getStatus)return;
    try{const s=JSON.parse(AndroidAutoBackup.getStatus());if(s.localFolderConfigured){AndroidAutoBackup.configure('local',true,6);window.BackupController?.stageLatest?.();}
    else if(window.confirm('للحفاظ على بياناتك بعد حذف التطبيق، اختر الآن مجلداً خارجياً لنسخها الاحتياطية. فتح اختيار المجلد؟')){AndroidAutoBackup.chooseLocalFolder();}}
    catch(e){console.warn(e);}
  },
  list(items){selectedFolder=true;
    if(!Array.isArray(items)||!items.length){show(heading()+`<p>${'لم تُعثر على نسخ محاسبية صالحة في المجلد المختار. يمكنك اختيار مجلد آخر.'}</p><button onclick="TiqanyRecovery.chooseFolder()">${'مجلد آخر'}</button><button class="secondary" onclick="TiqanyRecovery.newDatabase()">${'إنشاء قاعدة جديدة'}</button>`);return;}
    show(heading()+`<p>${'اختر النسخة المراد استعادتها. الأحدث تظهر أولاً؛ لا تتم استعادة أي نسخة قبل اختيارها.'}</p>`+
    items.map((item,i)=>`<button type="button" class="ta-recovery-file" onclick="TiqanyRecovery.restore('${escape(item.id)}')"><strong>${i===0?'الأحدث · ':''}${escape(item.name)}</strong><br><small>${new Date(item.date).toLocaleString('ar-SY')} · ${Math.round((item.size||0)/1024)} KB</small></button>`).join('')+
    `<button class="secondary" onclick="TiqanyRecovery.chooseFolder()">${'مجلد آخر'}</button><button class="secondary" onclick="TiqanyRecovery.newDatabase()">${'بدء قاعدة جديدة دون استعادة'}</button>`);
  },
  restore(id){if(loading)return;loading=true;show(heading()+`<p>${'جارٍ التحقق من ملف النسخة قبل الاستعادة...'}</p>`);window.AndroidRecovery?.restoreChoice(String(id));},
  async accept(json){loading=false;try{const parsed=JSON.parse(json);
      if(isAgent){const prior=parsed.data?.agentState;
        if(!prior||!Array.isArray(prior.ops)||!Array.isArray(prior.items)||!Array.isArray(prior.accounts))throw Error('نسخة موظف البيع غير مكتملة');
        if(!window.Agent?.db||!window.Agent?.state)throw Error('مخزن بيانات الموظف غير جاهز');
        const current=Agent.state;
        if(current.ops?.length&&!window.confirm('استعادة النسخة ستستبدل العمليات الحالية على هذا الهاتف. هل توافق؟'))return this.boot();
        // Licenses are bound to each installed device. Never transplant an old license.
        const replacement=JSON.parse(JSON.stringify(prior));replacement.deviceId=current.deviceId;replacement.license='';
        Agent.state=replacement;try{await Agent.save();}catch(e){Agent.state=current;throw e;}
        await Agent.show('home');
      }else{
        if(!window.ProfileManager?.restoreParsed)throw Error('الاستعادة غير جاهزة');
        await ProfileManager.restoreParsed(parsed);
      }
      localStorage.setItem(KEY,'restored');hide();
      // After consent, automatically enable fresh backups in the chosen external folder.
      try{if(selectedFolder&&window.AndroidAutoBackup?.configure){AndroidAutoBackup.configure('local',true,6);window.BackupController?.stageLatest?.();}}catch(_){}
    }catch(e){this.error(String(e.message||e));}
  },
  error(message){loading=false;show(heading()+`<p class="ta-recovery-warning">${escape(message)}</p><button onclick="TiqanyRecovery.chooseFolder()">${'اختيار مجلد آخر'}</button><button class="secondary" onclick="TiqanyRecovery.newDatabase()">${'قاعدة جديدة'}</button>`);}
};
window.TiqanyRecovery=Recovery;
window.__tiqanyRecoveryList=items=>Recovery.list(items);
window.__tiqanyRecoveryError=msg=>Recovery.error(msg);
window.__tiqanyRecoveryData=json=>Recovery.accept(json);
window.addEventListener('load',()=>{let tries=0;const ready=()=>{tries++;if((isAgent?window.Agent?.state:(window.State&&window.ProfileManager?.registry))){Recovery.boot();return;}if(tries<45)setTimeout(ready,250);};setTimeout(ready,850);});
})();
