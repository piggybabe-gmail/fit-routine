# Fit Routine by Beer

แอปบันทึกอาหาร การเทรนกับเทรนเนอร์ และผลวัดร่างกาย ใช้ร่วมกันระหว่างเจ้าของกับเทรนเนอร์ พร้อมแจ้งเตือนเข้ากลุ่ม LINE

- เว็บ: GitHub Pages (ฟรี)
- ข้อมูลและล็อกอิน: Firebase Authentication + Cloud Firestore (แผนฟรี Spark ไม่ต้องผูกบัตร)
- แจ้งเตือน: LINE Official Account + Google Apps Script (ฟรี)

## สิทธิ์ผู้ใช้

| บทบาท | เข้าใช้ด้วย | ทำอะไรได้ |
|---|---|---|
| เจ้าของ | บัญชี Google | ทุกอย่าง |
| อุปกรณ์อื่นของเจ้าของ | ลิงก์เชิญ + ชื่อ | เหมือนเจ้าของ (ใช้กับแอปบนหน้าจอโฮม iPad/มือถือ) |
| เทรนเนอร์ | ลิงก์เชิญ + ชื่อ (ไม่ต้องใช้รหัสผ่าน) | ดูทุกอย่าง, บันทึกการเทรน (ท่า/น้ำหนัก/ครั้ง), แก้แผนซ้อม, ส่งข้อความ, แนบรูป |
| ผู้ติดตาม | ลิงก์เชิญ + ชื่อ | ดูอย่างเดียว + ส่งข้อความ |

---

## ขั้นตอนตั้งค่า (ทำบน iPad ได้ทั้งหมด ใช้ Safari)

### 1. เปิดเว็บบน GitHub Pages
1. เปิด repo นี้บน github.com (ใน Safari) → **Settings** → **Pages**
2. Source: **Deploy from a branch** · Branch: **main** · โฟลเดอร์ **/ (root)** → **Save**
3. รอ 1–2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/fit-routine/`

### 2. สร้าง Firebase
1. เข้า https://console.firebase.google.com → **Add project** → ตั้งชื่อ `fit-routine-beer` → ปิด Google Analytics → Create
2. เมนู **Build → Authentication → Get started** → แท็บ **Sign-in method**
   - เปิด **Google** (เลือกอีเมลสนับสนุน) → Save
   - เปิด **Anonymous** → Save
   - แท็บ **Settings → Authorized domains → Add domain** → ใส่ `<ชื่อผู้ใช้>.github.io`
3. เมนู **Build → Firestore Database → Create database** → Location **asia-southeast1 (Singapore)** → **Start in production mode**
4. แท็บ **Rules** → ลบของเดิม วางเนื้อหาไฟล์ `firestore.rules` → เปลี่ยน `YOUR_GOOGLE_EMAIL` เป็นอีเมล Google ของคุณ → **Publish**
5. กดรูปเฟือง **Project settings → General → Your apps → ไอคอน `</>`** → ตั้งชื่อ `fit-routine` → Register app → จะเห็นกล่อง `firebaseConfig`
6. กลับไป GitHub เปิดไฟล์ `firebase-config.js` → กดไอคอนดินสอ → แทนค่า `PASTE_...` ทั้ง 6 บรรทัดด้วยค่าจากข้อ 5 → **Commit changes**

### 3. เข้าใช้งานครั้งแรก
1. เปิดลิงก์เว็บ → **เข้าสู่ระบบด้วย Google (เจ้าของ)**
2. กด **นำเข้าไฟล์ข้อมูลเดิม** แล้วเลือกไฟล์ `fit-routine-data-….json` (ข้อมูลจากแอปเดิมใน Claude)
3. เพิ่มลงหน้าจอโฮม: ปุ่มแชร์ของ Safari → **เพิ่มไปยังหน้าจอโฮม**
   - แอปบนหน้าจอโฮมแยกการล็อกอินจาก Safari ให้ไปที่ **ตั้งค่า → สมาชิก** เพิ่มสิทธิ์ **อุปกรณ์อื่นของฉัน** → คัดลอกลิงก์ → เปิดแอปบนหน้าจอโฮม → วางลิงก์ในช่อง **มีลิงก์เชิญ?** → พิมพ์ชื่อ

### 4. แจ้งเตือน LINE (แชต 1:1 ไม่ต้องมีกลุ่ม)
แต่ละคนเชื่อม LINE ของตัวเองด้วย LINE Login แล้วเจ้าของเลือกว่าใครได้รับแจ้งเตือนเรื่องอะไร
ข้อความส่งผ่าน LINE OA "Fit Routine" เป็นแชต 1:1 (LINE ปิด LINE Notify แล้ว จึงต้องมี OA เป็นผู้ส่ง)

1. **LINE OA + Messaging API:** https://manager.line.biz → สร้างบัญชี `Fit Routine` → ตั้งค่า → Messaging API → เปิดใช้งาน (สร้าง Provider ชื่อ `Fit Routine`)
   - ตั้งค่าการตอบกลับ: ปิดข้อความตอบกลับอัตโนมัติ · เปิด Webhook
2. **Channel access token:** https://developers.line.biz/console → Provider `Fit Routine` → channel ของ OA → แท็บ Messaging API → Channel access token (long-lived) → Issue
3. **Apps Script:** https://script.new → วางไฟล์ `line-relay/Code.gs` → Deploy → New deployment → Web app · Execute as **Me** · Who has access **Anyone** → คัดลอก Web app URL
4. **LINE Login channel:** ใน Provider เดียวกัน → Create a new channel → **LINE Login** → App types: **Web app**
   - แท็บ LINE Login → Callback URL = Web app URL จากข้อ 3
   - แท็บ Basic settings → Linked LINE Official Account = Fit Routine
   - เปลี่ยนสถานะจาก Developing เป็น **Published**
5. **Script properties** (Apps Script → รูปเฟือง): `LINE_TOKEN`, `APP_SECRET`, `LOGIN_CHANNEL_ID`, `LOGIN_CHANNEL_SECRET`
6. Messaging API → Webhook URL = Web app URL → เปิด Use webhook
7. แอป: ตั้งค่า → LINE → วาง URL + APP_SECRET → เปิดระบบแจ้งเตือน → บันทึก → ตั้งค่า → บัญชี → เชื่อม LINE
8. ตั้งค่า → LINE → เลือกว่าใครรับเรื่องอะไร (ค่าเริ่มต้น: เจ้าของรับเรื่องการเทรน/ข้อความ · เทรนเนอร์รับอาหาร/ออกกำลังกาย/ผลวัด/ข้อความ)

> แผนฟรีของ LINE OA ส่งได้ราว 300 ข้อความ/เดือน แอปรวมการอัปเดตภายใน 45 วินาทีเป็นข้อความเดียวต่อผู้รับ

### 5. เชิญเทรนเนอร์
1. **ตั้งค่า → สมาชิก** → พิมพ์ชื่อเทรนเนอร์ → สิทธิ์ **เทรนเนอร์** → **เพิ่มสมาชิก**
2. **คัดลอกลิงก์** → ส่งให้เทรนเนอร์ใน LINE
3. เทรนเนอร์เปิดลิงก์ (แนะนำเปิดใน Safari/Chrome ไม่ใช่เบราว์เซอร์ใน LINE) → พิมพ์ชื่อให้ตรงกับที่ตั้ง → เข้าใช้ได้ทันที → ตั้งค่า → บัญชี → เชื่อม LINE
4. ถ้าลิงก์หลุดไปถึงคนอื่น กด **สร้างลิงก์ใหม่** ลิงก์เดิมจะใช้ไม่ได้ · กด **ปิดสิทธิ์** เพื่อหยุดการเข้าถึงทั้งหมด

---

## วางจากอินัง (บันทึกจากแชต Claude)
ส่งรูปหรือบอกอาหาร/การออกกำลังกายในแชตกับอินัง อินังจะตอบกลับเป็นข้อความที่ขึ้นต้นด้วย `FIT1 {...}` → ก๊อปทั้งก้อน → ในแอปกด **วางจากอินัง** → **ตรวจสอบ** → **นำเข้า**

รองรับ: `meals`, `exercises`, `water` (มล.), `pantryAdd`, `pantryUse`, `measurement`, `recipes`

```
FIT1 {"date":"2026-09-27","meals":[{"meal":"เช้า","name":"ไข่ตุ๋นแครอท","qty":"3 ฟอง","kcal":225,"p":19,"c":3,"f":15}],"water":500}
```

## หลักฐานแนบ (ไฟล์อ้างอิง)
ทุกจุดที่บันทึกข้อมูลแนบไฟล์ได้ เพื่อยืนยันว่าทำจริง แอปไม่อ่านไฟล์ เก็บไว้อ้างอิงเท่านั้น
- อาหาร: แนบรูปทั้งมื้อ หรือแนบรายรายการ (รูปอาหาร ฉลาก ใบเสร็จ)
- ออกกำลังกาย: หน้าจอนาฬิกา/แอปว่ายน้ำ
- การเทรน: เทรนเนอร์แนบรูปหรือไฟล์ของแต่ละ session
- ผลวัด: ใบ InBody (รูปหรือ PDF), รูปสายวัด
- น้ำดื่ม, ของในครัว (ใบเสร็จ), เมนู (รูปผลงาน), ข้อความในทีม
รายการที่ไม่มีไฟล์จะขึ้นป้าย "ไม่มีหลักฐาน" และหน้าวันนี้/ภาพรวม/สรุปส่งเทรนเนอร์แสดงสัดส่วนรายการที่มีหลักฐาน
รูปจะถูกย่ออัตโนมัติ ไฟล์อื่น (เช่น PDF) ต้องไม่เกิน 700 KB

## ความปลอดภัยของข้อมูล
- ข้อมูลทั้งหมดอยู่ใน Firestore ของคุณ อ่านได้เฉพาะเจ้าของและสมาชิกที่เชิญ ตามกฎใน `firestore.rules`
- ค่าใน `firebase-config.js` ไม่ใช่รหัสลับ เปิดเผยใน GitHub ได้
- ห้ามใส่ไฟล์ข้อมูลส่วนตัว (json สำรอง) ไว้ใน repo นี้ เพราะ repo เป็นสาธารณะ
- รูปอาหาร/เมนูถูกย่อเหลือไม่เกิน ~450 KB ต่อรูป เก็บใน Firestore (ไม่ต้องใช้ Firebase Storage ที่ต้องผูกบัตร)
