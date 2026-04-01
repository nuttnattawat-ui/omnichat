# Facebook Integration — Debug Report
**วันที่:** 1 เมษายน 2569
**สถานะ:** ✅ แก้ไขแล้ว — Webhook ทำงาน, ข้อความเข้า inbox ได้

---

## สรุปปัญหาที่พบ + การแก้ไข

### ✅ แก้แล้ว — Webhook Endpoint 404
**ปัญหา:** Facebook ส่ง webhook มาที่ Vercel URL แต่ไม่มี route รองรับ → 404
**แก้ไข:** สร้าง Next.js API proxy routes ที่ forward ไป Render backend
- `apps/web/src/app/api/webhooks/facebook/route.ts`
- `apps/web/src/app/api/webhooks/instagram/route.ts`
- `apps/web/src/app/api/webhooks/line/route.ts`

ตอนนี้ Webhook URL ใช้ได้ทั้ง 2 แบบ:
- Vercel: `https://omnichat-web-omega.vercel.app/api/webhooks/facebook`
- Render: `https://[render-url]/api/webhooks/facebook`

### ✅ แก้แล้ว — Verify Token ไม่ตรง
**ปัญหา:** Backend เช็ค `process.env.META_VERIFY_TOKEN` อย่างเดียว แต่ token ถูกเก็บใน inbox channelConfig
**แก้ไข:** Webhook verification ตอนนี้เช็คทั้ง global env var + per-inbox `channelConfig.verifyToken`
- `apps/api/src/modules/webhooks/webhooks.controller.ts`

### ✅ แก้แล้ว — Foreign Key Violation ตอน Save Message
**ปัญหา:** `senderId` มี FK ชี้ไป User table แต่ข้อความจาก Contact ใส่ Contact ID → FK violation
```
ERROR [WebhooksService] Failed to process message: PrismaClientKnownRequestError:
Foreign key constraint violated on the constraint: 'messages_sender_id_fkey'
```
**แก้ไข:** ไม่ set `senderId` สำหรับข้อความขาเข้า (Contact identity ใช้ `conversation.contactId` แทน)
- `apps/api/src/jobs/message.processor.ts`

### ✅ แก้แล้ว — Facebook Profile Fetch
**ปัญหา:** ไม่มีการดึงชื่อ/รูปจาก Facebook Graph API → contact ขึ้น "facebook user"
**แก้ไข:** เพิ่ม `getUserProfile()` ใน FacebookAdapter ดึงชื่อ + profile pic จาก Graph API v19.0
- `apps/api/src/adapters/facebook.adapter.ts`

---

## การตั้งค่าที่ถูกต้อง

### OmniChat Settings (Channel)
| Field | ค่า |
|---|---|
| Channel Type | Facebook |
| Channel Name | ชื่อ Page |
| Page Access Token | Token จาก Meta Developer Console |
| App Secret | Meta App Secret |
| Verify Token | ตั้งเอง (ต้องตรงกับ Meta Console) |

### Meta Developer Console
| ขั้นตอน | สถานะ |
|---|---|
| App สร้างแล้ว | ✅ |
| Permissions: `pages_messaging` | ✅ Standard access, Ready to use |
| Permissions: `pages_manage_metadata` | ✅ Standard access, Ready to use |
| Webhook Callback URL ตั้งค่าแล้ว | ✅ |
| Webhook Verify Token ตรงกัน | ✅ |
| Subscribe field `messages` | ✅ |
| Facebook Page เชื่อมแล้ว | ✅ |

### Webhook URL
```
https://omnichat-web-omega.vercel.app/api/webhooks/facebook
```

---

## Checklist การแก้ไข

- [x] เพิ่ม `GET /api/webhooks/facebook` handler (verification)
- [x] เพิ่ม `POST /api/webhooks/facebook` handler (receive messages)
- [x] Webhook verify ใช้ per-inbox token (ไม่ต้องพึ่ง env var)
- [x] สร้าง Vercel proxy routes (แก้ 404)
- [x] แก้ FK violation ตอน save incoming message
- [x] เพิ่ม Facebook profile fetch (ชื่อ + รูป)
- [x] ตั้ง Webhook URL ใน Facebook Developer Console
- [x] Subscribe page กับ webhook events
- [x] ทดสอบส่งข้อความจาก Facebook → เข้า backend สำเร็จ (log ยืนยัน)
- [x] Deploy backend + frontend

---

## หมายเหตุ

- **Page Access Token** ควรเป็น Long-lived token (ไม่หมดอายุ)
- **Development Mode** รับข้อความได้เฉพาะ Admin/Tester ของ App — ต้อง switch เป็น Live Mode สำหรับ production
- Render free tier อาจ sleep → Facebook webhook timeout → แนะนำใช้ UptimeRobot ping ทุก 14 นาที
