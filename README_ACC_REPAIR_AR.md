# إصلاح مستودع acc — Tiqany Acc Solo 3.5.51-solo.5

## التشخيص
تبيّن أن مستودع acc يحتوي على مزيج من ملفات Solo وملفات التطبيق الرئيسي. بالتحديد، عُثر على `applicationId 'com.sunshine.technicalaccountant'` في `app/build.gradle` بدلاً من `com.tiqany.accounting.solo`، كما أُعيدت ملفات إعداد/واجهة من التطبيق الرئيسي ونقص ملفا اختبار خاصان بآخر نسخة Solo. هذا يسبب تعارضاً مع اختبارات العزل والتوقيع؛ لا يمكن الجزم بالخطوة التي فشلت في آخر تشغيل دون الاطلاع على سجل GitHub Actions.

## ما الذي في هذا ZIP؟
يضم 12 ملفاً تحتاج إلى الاستبدال/الإضافة بمساراتها الأصلية في مستودع `moatezabofakher-hub/acc` فقط، دون تغيير مستودع التطبيق الرئيسي:

- `.github/workflows/build-apk.yml` (بناء Solo مع اختبارات الإصدار)
- `settings.gradle`
- `app/build.gradle` (المعرّف الصحيح والتوقيع بالـ Secrets)
- `app/src/main/assets/www/index.html`
- `app/src/main/assets/www/static/glossy-ui-3549.css`
- `app/src/main/assets/www/static/i18n.js`
- `app/src/main/java/com/sunshine/accounting/MainActivity.java`
- `app/src/main/java/com/sunshine/accounting/ReportPdfRenderer.java`
- `app/src/main/java/com/sunshine/accounting/AutoBackupManager.java`
- `app/src/main/java/com/sunshine/accounting/BackupWorker.java`
- `tests/test_solo_bundle_grid.js` (جديد)
- `tests/test_solo_consumer_and_balances.js` (جديد)

## الطريقة
1. افتح المستودع `moatezabofakher-hub/acc` وخذ نسخة احتياطية من الكود إن لزم.
2. فك ضغط الحزمة وارفع **محتوياتها** إلى جذر المستودع مع الحفاظ على المجلدات والمسارات. اختر استبدال الملفات القديمة، ولا تضع ZIP أو مجلداً إضافياً يحيط بمحتوياته.
3. تأكد أن `app/build.gradle` يحتوي `applicationId 'com.tiqany.accounting.solo'` وأن `settings.gradle` يذكر `Tiqany_Acc_Solo`.
4. افتح Actions وشغّل **Build Tiqany Acc Solo Android APK**.
5. إذا نجح، ابحث عن `Tiqany-Acc-Solo-SIGNED.apk` في Artifacts (بعد إضافة **الأسرار الأربعة** الصحيحة)؛ إذا لم تُضف جميع الأسرار فستصدر نسخة DEBUG.
6. إذا أخفق، افتح خطوة الفشل وشارك نص الخطأ من السجل لتحديد سبب آخر محتمل.

**تنبيه:** لا تثبّت APK من المستودع المختلط قبل إصلاح معرّف Solo. لا تُزل التطبيقات المثبتة، وخذ نسخة احتياطية من البيانات قبل أي تجربة تحديث. بناء APK الفعلي لم يجرِ ضمن جلسة إعداد الحزمة.
