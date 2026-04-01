# OmniChat — Full Program Review
**วันที่:** 1 เมษายน 2569 (updated)
**ผู้ทบทวน:** Claude (agent walk-through)
**URL:** https://omnichat-web-omega.vercel.app
**Account:** nutt (admin) · nutt.nattawat@gmail.com

---

## สรุปภาพรวม

OmniChat ตอนนี้ใช้งานได้จริงในระดับ **MVP ที่ใช้งานในชีวิตจริงได้** — มีช่องทางหลักครบ (LINE + Facebook), แชทรับ-ส่งได้จริง, หน้าตาสะอาด แต่ยังห่างจาก OmniChat เชิงพาณิชย์ (เช่น Chatwoot, Freshdesk, Zendesk) ที่ฟีเจอร์สำหรับ **team management และ analytics** ยังขาดอยู่มาก

**คะแนนรวม: 8.5/10** (ขึ้นจาก 7 หลังเพิ่ม features ครบ)
- Core Messaging: 9/10
- Channel Integration: 8/10
- Team Workflow: 7.5/10
- Analytics & Reporting: 7/10
- UX / Ease of Use: 8.5/10

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

**4. Facebook Conversion Tracking (CAPI)**
- ยังไม่มีระบบ track conversion กลับไป Facebook Ads
- ต้องเพิ่มปุ่ม "Mark as Sold" + ส่ง Purchase event ผ่าน Conversions API

### 🟡 Medium (ควรมีเพื่อ productivity)

**5. ~~Canned Responses (ข้อความสำเร็จรูป)~~ ✅ แก้แล้ว**
- มีระบบ Quick Replies: สร้าง/ลบใน Settings, พิมพ์ "/" ใน chat เพื่อเลือก, แสดงใน right panel

**6. Labels / Tags**
- ไม่มีระบบ categorize conversation

**7. File Attachment จาก Agent**
- ส่งรูปหรือไฟล์จาก agent ไปหาลูกค้าไม่ได้

**8. ~~Contacts Page — Drill-down~~ ✅ แก้แล้ว**
- คลิก contact แล้วเห็น detail view + ประวัติสนทนา + แก้ไขข้อมูลได้

**9. Invite Team Member**
- ดูรายชื่อ team ได้ แต่ invite คนใหม่จาก UI ไม่ได้

### 🟢 Low (ดีถ้ามี แต่ไม่เร่งด่วน)

- **Emoji picker** — ไม่มีใน message input
- **Conversation transfer** — โยนเคสระหว่าง agent ไม่ได้
- **SLA / Auto-assign rules**
- **Multi-language UI**

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
| 7 | FB Conversion Tracking | track ยอดขายกลับ Ads | ปานกลาง | ❌ |
| 8 | ~~Canned Responses~~ | ~~เพิ่ม productivity มาก~~ | ปานกลาง | ✅ แก้แล้ว |
| 9 | ~~Contacts drill-down~~ | ~~ตอนนี้ไม่มีประโยชน์เลย~~ | ปานกลาง | ✅ แก้แล้ว |
| 10 | ~~Reports / Analytics~~ | ~~Manager ต้องการ~~ | ยาก | ✅ แก้แล้ว |

---

## สรุป

OmniChat พร้อมใช้งานจริงในระดับ **production-ready MVP** — มีครบ: multi-channel messaging, team management, analytics, quick replies, private notes, notification sound สิ่งที่เหลือคือ:

1. **FB Conversion Tracking (CAPI)** — track ยอดขายกลับ Facebook Ads
2. **Labels / Tags** — categorize conversations
3. **File Attachment** — ส่งรูป/ไฟล์จาก agent
4. **Invite Team Member** — เพิ่มคนใน team จาก UI
