# إصلاح مشاركة PDF في Tiqany Acc Solo

## المشكلة
رسالة Android: `Couldn't find meta-data for provider with authority ...fileprovider` تظهر عند مشاركة ملف PDF من التطبيق. السبب أن ملف AndroidManifest.xml في مستودع acc كان لا يعرّف FileProvider، بينما MainActivity.java يستدعيه أثناء مشاركة PDF والتقاط صور المواد.

## التعديل
- `app/src/main/AndroidManifest.xml`: إضافة FileProvider بصلاحية مشاركة مؤقتة، وربطه بـ `@xml/item_photo_paths` الموجود بالفعل في المستودع.
- `app/build.gradle`: رفع versionCode من 6 إلى 7 مع الحفاظ على applicationId والتوقيع السابق.
- **لا تغيّر ملف `app/src/main/res/xml/item_photo_paths.xml` الموجود**؛ فهو يحتوي بالفعل على `item_images/` و`shared_invoices/` و`shared_reports/`.

## التثبيت
1. احفظ نسخة احتياطية من بيانات Solo الموجودة على هاتفك.
2. افتح مستودع `moatezabofakher-hub/acc` على GitHub في الفرع main.
3. استبدل الملفين في المسارات نفسها، ولا ترفع المجلد الخارجي للحزمة.
4. نفّذ Commit changes، ثم افتح Actions وشغّل Build Tiqany Acc Solo Android APK.
5. ثبّت `Tiqany-Acc-Solo-SIGNED.apk` مع استخدام **أسرار التوقيع الأربعة نفسها** التي وقّعت بها النسخة الموجودة؛ لا تحذف التطبيق المثبّت.
6. جرّب أولاً تقرير المواد، ثم تقرير الديون، ثم فاتورة PDF، واختر تطبيقاً للمشاركة.

## حدود التحقق
تم التحقق من صحة XML ووجود تعريف المزوّد ومسارات ملفات الكاش والعزل وصلاحيات القراءة؛ لم يتم بناء APK أو اختباره على هاتف فعلي في هذه الجلسة.
