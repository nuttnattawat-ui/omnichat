# OmniChat — Full Program Review
**วันที่:** 1 เมษายน 2569 (updated)
**ผู้ทบทวน:** Claude (agent walk-through)
**URL:** https://omnichat-web-omega.vercel.app
**Account:** nutt (admin) · nutt.nattawat@gmail.com

---

## สรุปภาพรวม

OmniChat ตอนนี้ใช้งานได้จริงในระดับ **production-ready MVP** — มีช่องทางหลักครบ (LINE + Facebook), ฟีเจอร์ team management ครบชุด, analytics dashboard, quick replies, labels, private notes ทำงานทั้งหมด เทียบกับ OmniChat เชิงพาณิชย์ (เช่น Chatwoot, Freshdesk) สิ่งที่ยังขาดอยู่เหลือน้อยมาก

**คะแนนรวม: 9/10** (ขึ้นจาก 8.5 หลังเพิ่ม Emoji Picker, FB CAPI, File Attachment, Invite Team)
- Core Messaging: 9.5/10
- Channel Integration: 8.5/10
- Team Workflow: 9/10
- Analytics & Reporting: 8/10
- UX / Ease of Use: 9/10

---

## ✅ สิ่งที่ทำงานได้ดีแล้ว (ณ วันนี้)

### Channel Integration

| Channel | สถานะ | รายละเอียด |
|---|---|---|
| LINE | ✅ ทำงานเต็ม | รับ-ส่งข้อความ, sticker (รับ+ส่ง), รูปภาพ, ชื่อ+รูป profile |
| Facebook Messenger | ✅ ทำงานเต็ม | รับ-ส่งข้อความ, รูปภาพ, ชื่อ+รูป profile จาก Graph API |
| Instagram | ⏳ Adapter มีแต่ยังไม่ test | ใช้ code เดียวกับ Facebook |

### Inbox & Messaging

- **Unified inbox** — LINE และ Facebook อยู่ใน inbox เดียวกัน พร้อม badge แยกสี (L เขียว, F น้ำเงิน)
- **Filter All / Open / Resolved** — ใช้ได้ดี จัดการ workflow ได้
- **Resolve conversation** — ปุ่มชัดเจน ใช้ง่าย
- **Real-time WebSocket** — ข้อความใหม่ขึ้นทันที ไม่ต้องรีเฟรช
- **Unread badge** — persist ผ่าน localStorage ไม่หายเมื่อ refresh
- **Agent bubble สี indigo** — แยกจากสีลูกค้าชัดเจน ✅ แก้แล้ว
- **AI Suggest Reply** — มีปุ่ม "✦ AI" พร้อม label ชัดเจน ✅ แก้แล้ว
- **LINE Sticker Picker** — ส่งสติ้กเกอร์จาก OmniChat ได้ (เฉพาะ LINE) ✅ ใหม่
- **Image lightbox** — กดรูปดูเต็มจอได้ ✅ ใหม่
- **Media rendering** — sticker, รูปภาพ (base64), friendly labels ใน sidebar
- **Instant scroll** — เปิดแชทแล้วเห็นข้อความล่าสุดทันที ✅ แก้แล้ว
- **Private Notes** — agent ฝากหมายเหตุภายในได้ ✅ ใหม่

### Team & Productivity
- **Assign Agent** — dropdown เลือก agent ให้ conversation, unassign ได้ ✅ ใหม่
- **Canned Responses / Quick Replies** — สร้าง/ลบ shortcuts ใน Settings, พิมพ์ "/" ใน chat เพื่อใช้งาน ✅ ใหม่
- **Notification Sound** — เสียงเตือน + Browser notification เมื่อข้อความเข้า ✅ ใหม่
- **Reports Dashboard** — overview cards, conversation/message charts, by channel, agent performance ✅ ใหม่
- **Contacts Drill-down** — คลิกดู detail + ประวัติสนทนา + แก้ไขข้อมูล ✅ ใหม่

### UX ที่แก้ไขแล้ว

- ✅ Sticker panel ปิดได้ (click outside handler)
- ✅ Search มีปุ่ม clear (X)
- ✅ Sidebar tooltips ทุก icon
- ✅ Customer info placeholder → "Not provided"
- ✅ Sticker button ซ่อนเมื่อเป็น Facebook/Instagram
- ✅ Webhook proxy routes (Vercel → Render)

---

## ❌ สิ่งที่ขาดไป เทียบกับ OmniChat มาตรฐาน

### 🔴 Critical (ต้องมีเพื่อใช้งานจริงในทีม)

**1. ~~Assign Agent ให้ Conversation~~ ✅ แก้แล้ว**
- มี dropdown เลือก agent ใน conversation header แล้ว

**2. ~~Reports / Analytics Dashboard~~ ✅ แก้แล้ว**
- มีหน้า Reports ครบ: overview cards, conversations/messages chart, by channel, agent performance

**3. ~~Notification Sound / Push Notification~~ ✅ แก้แล้ว**
- มีเสียงเตือน (Web Audio API) + Browser notification เมื่อข้อความใหม่เข้า

**4. ~~Facebook Conversion Tracking (CAPI)~~ ✅ แก้แล้ว**
- มีปุ่ม "Mark Sold" ใน conversation header (เฉพาะ Facebook/Instagram)
- กดแล้วใส่จำนวนเงิน + สกุลเงิน → ส่ง Purchase event ผ่าน Conversions API
- ต้องตั้ง env: META_PIXEL_ID, META_CAPI_TOKEN

### 🟡 Medium (ควรมีเพื่อ productivity)

**5. ~~Canned Responses (ข้อความสำเร็จรูป)~~ ✅ แก้แล้ว**
- มีระบบ Quick Replies: สร้าง/ลบใน Settings, พิมพ์ "/" ใน chat เพื่อเลือก, แสดงใน right panel

**6. ~~Labels / Tags~~ ✅ แก้แล้ว**
- มีระบบ Labels ครบ: สร้าง/ลบใน Settings (พร้อม color picker), กด 🏷 icon ใน conversation header เพื่อ apply label ได้ทันที

**7. ~~File Attachment จาก Agent~~ ✅ แก้แล้ว**
- มีปุ่ม 📎 ส่งรูปจาก agent ไปหาลูกค้าได้ (แปลงเป็น base64)

**8. ~~Contacts Page — Drill-down~~ ✅ แก้แล้ว**
- คลิก contact แล้วเห็น detail view + ประวัติสนทนา + แก้ไขข้อมูลได้

**9. ~~Invite Team Member~~ ✅ แก้แล้ว**
- มีฟอร์ม invite ใน Settings > Team: ใส่ชื่อ, email, role → สร้าง account + แสดง temp password

### 🔴 Bug ที่ยังค้างอยู่

**10. "facebook user" แสดงแทนชื่อจริงในบาง conversation**
- บาง Facebook conversation ที่สร้างก่อน Graph API fix ยังแสดงชื่อว่า "facebook user" + ไม่มีรูป profile
- conversation ใหม่หลังจากแก้แล้วจะดึงชื่อจริงได้ถูกต้อง
- แก้ได้โดย re-fetch profile ของ existing contact หรือลบ contact นั้นแล้วให้ลูกค้าส่งข้อความใหม่

### 🟢 Low (ดีถ้ามี แต่ไม่เร่งด่วน)

- ~~**Emoji picker**~~ ✅ มีแล้ว — ปุ่ม 😊 ใน message input, มี 4 หมวด: Smileys, Gestures, Hearts, Objects
- **Conversation transfer** — โยนเคสระหว่าง agent ไม่ได้
- **SLA / Auto-assign rules** — กำหนดเวลาตอบอัตโนมัติ
- **Multi-language UI** — ปัจจุบันเป็น EN
- **Instagram** — Adapter มีแล้ว แต่ยังไม่ได้ test end-to-end

---

## 📋 ลำดับความสำคัญ: ทำอะไรก่อน

| ลำดับ | ฟีเจอร์ | เหตุผล | ความยาก | สถานะ |
|---|---|---|---|---|
| 1 | ~~แก้ Search~~ | ~~Bug ที่รบกวนทุก session~~ | ปานกลาง | ✅ แก้แล้ว |
| 2 | ~~แก้ Sticker panel~~ | ~~Blocker ที่ต้องรีเฟรช~~ | ง่าย | ✅ แก้แล้ว |
| 3 | ~~Sidebar tooltips~~ | ~~UX quick win~~ | ง่ายมาก | ✅ แก้แล้ว |
| 4 | ~~Private Notes UI~~ | ~~API มีแล้ว แค่ขาด UI~~ | ง่าย | ✅ แก้แล้ว |
| 5 | ~~Notification sound~~ | ~~Agent พลาดข้อความถ้าไม่มี~~ | ง่าย-ปานกลาง | ✅ แก้แล้ว |
| 6 | ~~Assign Agent UI~~ | ~~จำเป็นถ้าใช้หลายคน~~ | ปานกลาง | ✅ แก้แล้ว |
| 7 | ~~FB Conversion Tracking~~ | ~~track ยอดขายกลับ Ads~~ | ปานกลาง | ✅ แก้แล้ว |
| 8 | ~~Canned Responses~~ | ~~เพิ่ม productivity มาก~~ | ปานกลาง | ✅ แก้แล้ว |
| 9 | ~~Contacts drill-down~~ | ~~ตอนนี้ไม่มีประโยชน์เลย~~ | ปานกลาง | ✅ แก้แล้ว |
| 10 | ~~Reports / Analytics~~ | ~~Manager ต้องการ~~ | ยาก | ✅ แก้แล้ว |

---

## สรุป

OmniChat พร้อมใช้งานจริงในระดับ **production-ready MVP** — ฟีเจอร์หลักครบหมดแล้ว ทั้ง messaging, labels, assign agent, quick replies, private notes, reports, notifications

สิ่งที่เหลือ (ทั้งหมด low priority):

1. **"facebook user" bug** — contact เก่าบางคนที่ PSID invalid แก้ชื่อ manual ได้จาก Customer Info
2. **Conversation transfer** — โยนเคสระหว่าง agent
3. **SLA / Auto-assign rules** — กำหนดเวลาตอบอัตโนมัติ
4. **Multi-language UI** — ปัจจุบันเป็น EN
5. **Instagram** — Adapter มีแล้ว ต้อง test end-to-end
