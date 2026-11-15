const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'../app/src/main');
const html=fs.readFileSync(path.join(base,'assets/www/index.html'),'utf8');
const recovery=fs.readFileSync(path.join(base,'assets/www/static/tiqany-recovery.js'),'utf8');
const native=fs.readFileSync(path.join(base,'java/com/sunshine/accounting/MainActivity.java'),'utf8');
const androidRes=fs.readFileSync(path.join(base,'res/values/strings.xml'),'utf8');
test('Arabic-only UI has no bilingual recovery or language selection',()=>{
  assert.doesNotMatch(html,/id="appLanguage"|data-settings-section="language"|static\/i18n\.js|I18n\./);
  assert.doesNotMatch(recovery,/settings\.language|Restore accounting data|Choose previous backup folder|Newest ·|en-US|const t=/);
  assert.match(recovery,/toLocaleString\('ar-SY'\)/);
  assert.match(html,/<html lang="ar" dir="rtl">/);
  assert.match(androidRes,/المحاسب التقني - مستقل/);
  assert.doesNotMatch(native,/String language/);
});
test('scroll viewport has an in-flow lower buffer above system dock',()=>{
  assert.match(html,/id="ta-scroll-reach-3581"/);
  assert.match(html,/touch-action:pan-y!important/);
  assert.match(html,/padding-bottom:calc\(var\(--ta-dock-height, 110px\) \+ var\(--ta-native-bottom-inset, 0px\) \+ max\(64px, 15dvh\)\)!important/);
  assert.match(html,/overflow-y:scroll!important/);
  assert.match(html,/إضافة مستودع/);
  assert.match(html,/إضافة مصروف/);
});
