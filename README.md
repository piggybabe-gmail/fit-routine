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

### 4. แจ้งเตือนเข้ากลุ่ม LINE
1. **สร้าง LINE OA:** https://manager.line.biz → สร้างบัญชี `Fit Routine`
   - **ตั้งค่า → บัญชี → อนุญาตให้บัญชีเข้าร่วมกลุ่มแชท** = เปิด
   - **ตั้งค่า → Messaging API → เปิดใช้งาน** (สร้าง Provider ใหม่ได้)
   - **ตั้งค่าการตอบกลับ:** ปิดข้อความตอบกลับอัตโนมัติ · เปิด Webhook
2. **เอา Token:** https://developers.line.biz → เลือก Channel → แท็บ **Messaging API** → **Channel access token (long-lived) → Issue** → คัดลอก
3. **สร้าง Apps Script:** https://script.new → ลบโค้ดเดิม วางไฟล์ `line-relay/Code.gs`
   - เฟือง **Project Settings → Script properties** → เพิ่ม `LINE_TOKEN` = token จากข้อ 2 และ `APP_SECRET` = คำลับที่ตั้งเอง (เช่น `beer-fit-2026-xyz`)
   - **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → อนุญาตสิทธิ์ → คัดลอก **Web app URL**
4. กลับไป LINE Developers → **Webhook URL** = URL จากข้อ 3 → เปิด **Use webhook** (ปุ่ม Verify อาจขึ้น error เพราะ Apps Script ตอบกลับแบบ redirect ไม่เป็นไร ใช้งานได้ปกติ)
5. สร้างกลุ่ม LINE กับเทรนเนอร์ → เชิญบัญชี `Fit Routine` เข้ากลุ่ม → บอทจะตอบ "เชื่อมกลุ่มนี้กับ Fit Routine แล้ว" (ถ้าไม่ตอบ พิมพ์ `ผูกกลุ่ม` ในกลุ่ม)
6. ในแอป: **ตั้งค่า → LINE** → วาง Web app URL + APP_SECRET → ติ๊ก **เปิดแจ้งเตือน** → **บันทึก** → **ส่งข้อความทดสอบ**

> แผนฟรีของ LINE OA ส่งได้ราว 300 ข้อความ/เดือน และข้อความเข้ากลุ่มนับตามจำนวนสมาชิก แอปจึงรวมการอัปเดตในช่วง 45 วินาทีเป็นข้อความเดียว

### 5. เชิญเทรนเนอร์
1. **ตั้งค่า → สมาชิก** → พิมพ์ชื่อเทรนเนอร์ → สิทธิ์ **เทรนเนอร์** → **เพิ่มสมาชิก**
2. **คัดลอกลิงก์** → ส่งให้เทรนเนอร์ใน LINE
3. เทรนเนอร์เปิดลิงก์ (แนะนำเปิดใน Safari/Chrome ไม่ใช่เบราว์เซอร์ใน LINE) → พิมพ์ชื่อให้ตรงกับที่ตั้ง → เข้าใช้ได้ทันที
4. ถ้าลิงก์หลุดไปถึงคนอื่น กด **สร้างลิงก์ใหม่** ลิงก์เดิมจะใช้ไม่ได้ · กด **ปิดสิทธิ์** เพื่อหยุดการเข้าถึงทั้งหมด

---

## วางจากอินัง (บันทึกจากแชต Claude)
ส่งรูปหรือบอกอาหาร/การออกกำลังกายในแชตกับอินัง อินังจะตอบกลับเป็นข้อความที่ขึ้นต้นด้วย `FIT1 {...}` → ก๊อปทั้งก้อน → ในแอปกด **วางจากอินัง** → **ตรวจสอบ** → **นำเข้า**

รองรับ: `meals`, `exercises`, `water` (มล.), `pantryAdd`, `pantryUse`, `measurement`, `recipes`

```
FIT1 {"date":"2026-09-27","meals":[{"meal":"เช้า","name":"ไข่ตุ๋นแครอท","qty":"3 ฟอง","kcal":225,"p":19,"c":3,"f":15}],"water":500}
```

## ความปลอดภัยของข้อมูล
- ข้อมูลทั้งหมดอยู่ใน Firestore ของคุณ อ่านได้เฉพาะเจ้าของและสมาชิกที่เชิญ ตามกฎใน `firestore.rules`
- ค่าใน `firebase-config.js` ไม่ใช่รหัสลับ เปิดเผยใน GitHub ได้
- ห้ามใส่ไฟล์ข้อมูลส่วนตัว (json สำรอง) ไว้ใน repo นี้ เพราะ repo เป็นสาธารณะ
- รูปอาหาร/เมนูถูกย่อเหลือไม่เกิน ~450 KB ต่อรูป เก็บใน Firestore (ไม่ต้องใช้ Firebase Storage ที่ต้องผูกบัตร)
