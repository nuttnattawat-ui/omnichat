# OmniChat App Audit
**URL:** https://omnichat-web-omega.vercel.app
**วันที่ตรวจ:** 1 เมษายน 2569
**อัพเดทล่าสุด:** 1 เมษายน 2569
**Account:** nutt (admin) · nutt.nattawat@gmail.com
**Organization:** nutt's Team

---

## สรุปภาพรวม

App ทำงานได้และ login เข้าได้ปกติ โครงสร้างหลักถูกต้อง ระบบ LINE integration ทำงานได้ทั้งรับ-ส่งข้อความ รวมถึง sticker, รูปภาพ, และ profile ลูกค้า

---

## ปัญหาที่พบและแก้ไขแล้ว ✅

| ปัญหา | สถานะ | หมายเหตุ |
|---|---|---|
| Backend ไม่ตอบสนอง (Render sleep) | ✅ แก้แล้ว | เพิ่ม retry 3 ครั้ง + timeout 90s ฝั่ง frontend |
| Register "Failed to fetch" | ✅ แก้แล้ว | retry logic จัดการ cold start ได้ |
| CORS error | ✅ แก้แล้ว | รองรับ FRONTEND_URL หลายค่า |
| LINE webhook ไม่ทำงาน | ✅ แก้แล้ว | ลบ Bull queue, process ตรง |
| LINE 401 error | ✅ แก้แล้ว | User ใส่ token ถูกต้องแล้ว |
| ข้อความตอบกลับไม่ถึง LINE | ✅ แก้แล้ว | ใช้ Reply (free) + Push (paid) fallback |
| Unread badge ไม่หาย | ✅ แก้แล้ว | Track read conversations ฝั่ง client |
| Sticker ไม่แสดง | ✅ แก้แล้ว | แก้ contentAttributes + StickerView fallback |
| ชื่อ/รูปลูกค้าไม่แสดง | ✅ แก้แล้ว | เพิ่ม detailed logging + real-time WebSocket update |
| ชื่อ agent ไม่แสดง | ✅ แก้แล้ว | เพิ่ม senderName ใน outgoing messages |
| รูปภาพจากลูกค้าไม่แสดง | ✅ แก้แล้ว | เพิ่ม media proxy endpoint สำหรับ LINE content |

---

## ปัญหาที่อาจยังคงอยู่ ⚠️

| ปัญหา | รายละเอียด |
|---|---|
| ชื่อ/รูป LINE ยังเป็น "line user" | ต้องเช็ค Render log ว่า token ใช้งานได้จริงไหม — อาจต้องใส่ token ใหม่ในหน้า Settings |
| Render free tier sleep | อาจยังช้าในการเข้าครั้งแรก (~60 วินาที) แนะนำ UptimeRobot หรือ upgrade plan |

---

## หน้าที่มีใน App

| หน้า | URL | สถานะ |
|---|---|---|
| Login | `/auth/login` | ✅ ทำงานได้ |
| Register | `/auth/register` | ✅ ทำงานได้ (มี retry) |
| Inbox | `/inbox` | ✅ ทำงานได้ |
| Contacts | `/contacts` | ✅ ทำงานได้ |
| Settings > Profile | `/settings` | ✅ ทำงานได้ |
| Settings > Channels | `/settings` | ✅ ทำงานได้ |
| Settings > Team | `/settings` | ✅ ทำงานได้ |

---

## ฟีเจอร์ที่มีแล้ว ✅

- Inbox พร้อม filter **All / Open / Resolved**
- Chat view + ตอบข้อความได้
- Right panel แสดง Customer Info (Name, Email, Phone) + แก้ไขได้
- Conversation info (Status, Messages count, Created date)
- ปุ่ม **Resolve** conversation
- หน้า Contacts แสดง channel ที่เชื่อมต่อ
- Settings → Profile / Channels / Team
- LINE channel integration (รับ-ส่งข้อความ)
- LINE Reply API (ฟรี) + Push API (เสียเงิน) fallback
- LINE sticker แสดงในแชท
- LINE รูปภาพแสดงในแชท (media proxy)
- Real-time WebSocket update (ข้อความใหม่ + contact update)
- Unread badge + clear เมื่อเปิดอ่าน
- Search conversations
- AI Suggest Reply (ต้องตั้ง API key)
- ชื่อ agent แสดงใน outgoing messages

---

## ฟีเจอร์ที่ขาดไป ❌

| ฟีเจอร์ | ความสำคัญ | หมายเหตุ |
|---|---|---|
| Reports / Analytics | 🔴 สูง | ไม่มีหน้า dashboard สถิติเลย |
| Assign agent ให้ conversation | 🔴 สูง | มี API แต่ UI ยังไม่มี dropdown เลือก agent |
| Notification sound/popup | 🟡 กลาง | ไม่มีเสียง/แจ้งเตือนเมื่อข้อความใหม่เข้า |
| Labels / Tags | 🟡 กลาง | ไม่มีระบบ categorize conversation |
| Canned Responses | 🟡 กลาง | ไม่มีข้อความสำเร็จรูป |
| Private Notes | 🟡 กลาง | มี API รองรับแล้ว แต่ UI ยังไม่มีปุ่มกด |
| File attachment ใน chat | 🟡 กลาง | ยังส่งไฟล์/รูปจาก agent ไม่ได้ |
| Facebook/Instagram integration | 🟡 กลาง | มี adapter แล้ว แต่ยังไม่ได้ test |
| Emoji picker | 🟢 ต่ำ | ไม่มีใน message input |
| Invite team member | 🟢 ต่ำ | ดูรายการได้แต่ invite ไม่ได้ |

---

## Channel ที่เชื่อมอยู่

| ชื่อ | Platform | สถานะ |
|---|---|---|
| bunny | LINE | ✅ Active |

---

## ลำดับที่ควร implement ต่อ

1. **แก้ Render sleep issue** → UptimeRobot ping ทุก 14 นาที
2. **Assign agent UI** → dropdown เลือก agent ใน conversation header
3. **Notification sound** → เสียงแจ้งเตือนเมื่อข้อความใหม่เข้า
4. **Reports / Analytics** → dashboard สถิติ conversations, response time
5. **Labels** → จัดหมวดหมู่ conversation
6. **Canned Responses** → ข้อความสำเร็จรูป เพิ่ม productivity
7. **Private Notes** → เพิ่มปุ่ม toggle สำหรับ internal note
8. **Facebook/Instagram** → test integration + setup guide
