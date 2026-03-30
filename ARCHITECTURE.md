# Omnichannel Chat Platform Architecture

แพลตฟอร์มรวมแชทจากหลายช่องทาง (LINE, Facebook Messenger, Instagram) เข้ามาเป็น Unified Inbox เดียว

---

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/Vue)                  │
│                     Unified Inbox UI                     │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket + REST API
┌──────────────────────▼──────────────────────────────────┐
│                   API Gateway / Backend                  │
│                  (Node.js / Go / Rails)                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │
│  │  LINE   │  │ Facebook │  │   IG    │  │  Future  │  │
│  │ Adapter │  │ Adapter  │  │ Adapter │  │ Adapter  │  │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └────┬─────┘  │
│       └─────────────┴─────────────┴─────────────┘       │
│                 Message Normalizer                       │
├─────────────────────────────────────────────────────────┤
│  Conversation Engine │ Contact Merge │ Assignment/Queue  │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL    │    Redis (Queue/PubSub)    │  S3/MinIO  │
└─────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Channel Adapter Pattern](#1-channel-adapter-pattern)
2. [Webhook Flow](#2-webhook-flow)
3. [Message Normalization](#3-message-normalization)
4. [Database Schema](#4-database-schema)
5. [Real-time Delivery](#5-real-time-delivery)
6. [Async Job Processing & Deduplication](#6-async-job-processing--deduplication)
7. [Platform-Specific Details](#7-platform-specific-details)
8. [Tech Stack Options](#8-tech-stack-options)
9. [Key Considerations](#9-key-considerations)
10. [Reference: Open Source Solutions](#10-reference-open-source-solutions)

---

## 1. Channel Adapter Pattern

หัวใจหลักของระบบคือ **Channel Adapter Pattern** — แต่ละช่องทางจะมี Adapter แยกกัน ทำหน้าที่:

- รับ Webhook จาก Platform
- Validate signature (ป้องกัน spoofing)
- แปลง message เป็น **Normalized Format** กลาง
- ส่ง message กลับผ่าน Platform API

```
┌──────────┐     ┌──────────────┐     ┌────────────────────┐
│  LINE    │────▶│ LINE Adapter │────▶│                    │
└──────────┘     └──────────────┘     │                    │
┌──────────┐     ┌──────────────┐     │    Conversation    │
│ Facebook │────▶│  FB Adapter  │────▶│      Engine        │
└──────────┘     └──────────────┘     │                    │
┌──────────┐     ┌──────────────┐     │                    │
│Instagram │────▶│  IG Adapter  │────▶│                    │
└──────────┘     └──────────────┘     └────────────────────┘
```

Adapter แต่ละตัว **decouple** จาก core business logic ทำให้เพิ่มช่องทางใหม่ได้ง่ายโดยไม่ต้องแก้ระบบหลัก

---

## 2. Webhook Flow

### General Flow

```
Customer ส่งข้อความ
       ↓
Platform (LINE/FB/IG) → HTTP POST → Webhook Endpoint
       ↓
Validate Signature → Return 200 OK ทันที (ห้าม process นาน)
       ↓
Push to Message Queue (Redis/BullMQ)
       ↓
Worker: Normalize → Dedup → Save DB → WebSocket Broadcast
       ↓
Agent เห็นข้อความบน Unified Inbox แบบ Real-time
```

> **สำคัญ:** ต้อง return 200 ให้เร็วที่สุด (ภายใน 1-3 วินาที) แล้วค่อย process async ทีหลัง ไม่งั้น platform จะ retry ส่งซ้ำ

### Detailed Flow

```
HTTP POST (Webhook)
       ↓
┌─────────────────────────┐
│  1. Validate Source     │  ← Signature / Token / IP
│  2. Parse Payload       │
│  3. Return 200 OK      │  ← ตอบกลับทันที
│  4. Queue to Worker     │  ← Async processing
└─────────────────────────┘
       ↓
┌─────────────────────────┐
│  5. Normalize Message   │  ← แปลงเป็น format กลาง
│  6. Dedup Check         │  ← ตรวจข้อความซ้ำ
│  7. Persist to DB       │  ← บันทึกลง PostgreSQL
│  8. Broadcast           │  ← WebSocket → Agent UI
└─────────────────────────┘
```

---

## 3. Message Normalization

ทุก message จากทุก platform จะถูกแปลงเป็น format เดียวกัน:

```json
{
  "id": "uuid-v4",
  "channel": "line | facebook | instagram",
  "platform_message_id": "original-platform-id",
  "sender": {
    "id": "normalized-sender-id",
    "name": "John Doe",
    "avatar_url": "https://..."
  },
  "content": "สวัสดีครับ",
  "content_type": "text | image | video | file | sticker | template",
  "content_attributes": {
    "original_payload": {},
    "media_url": null,
    "buttons": [],
    "template_type": null
  },
  "conversation_id": "unified-conversation-id",
  "inbox_id": "inbox-id",
  "timestamp": "2026-03-30T12:00:00Z"
}
```

### Channel-Specific Normalization

| Field | LINE | Facebook | Instagram |
|-------|------|----------|-----------|
| **Sender ID** | `userId` | `sender.id` (PSID) | `sender.id` |
| **Message ID** | `message.id` | `message.mid` | `message.mid` |
| **Text** | `message.text` | `message.text` | `message.text` |
| **Image** | `message.contentProvider` | `message.attachments[].payload.url` | `message.attachments[].payload.url` |
| **Sticker** | `message.stickerId` | `message.sticker_id` | N/A |
| **Signature** | `X-Line-Signature` (HMAC-SHA256) | `X-Hub-Signature-256` | `X-Hub-Signature-256` |

---

## 4. Database Schema

### ER Diagram

```
accounts
  ├── inboxes (LINE Bot, FB Page, IG Account)
  │     └── contact_inboxes ──┐
  ├── contacts ────────────────┘
  │     └── conversations
  │           └── messages
  └── users (agents/admins)
```

### Tables

```sql
-- =============================================
-- องค์กร / ทีม
-- =============================================
CREATE TABLE accounts (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50) DEFAULT 'free',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ช่องทาง (แต่ละ LINE Bot, FB Page, IG Account)
-- =============================================
CREATE TABLE inboxes (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT REFERENCES accounts(id),
    channel_type    VARCHAR(50) NOT NULL,  -- 'line', 'facebook', 'instagram'
    channel_config  JSONB NOT NULL,        -- token, secret, page_id etc.
    name            VARCHAR(255) NOT NULL,
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- channel_config examples:
-- LINE:      { "channel_access_token": "xxx", "channel_secret": "xxx" }
-- Facebook:  { "page_access_token": "xxx", "page_id": "xxx", "app_secret": "xxx" }
-- Instagram: { "access_token": "xxx", "ig_account_id": "xxx", "app_secret": "xxx" }

-- =============================================
-- ลูกค้า (รวมทุกช่องทางเป็นคนเดียว)
-- =============================================
CREATE TABLE contacts (
    id                  BIGSERIAL PRIMARY KEY,
    account_id          BIGINT REFERENCES accounts(id),
    name                VARCHAR(255),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    avatar_url          TEXT,
    custom_attributes   JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- เชื่อม contact กับแต่ละช่องทาง
-- =============================================
CREATE TABLE contact_inboxes (
    id          BIGSERIAL PRIMARY KEY,
    contact_id  BIGINT REFERENCES contacts(id),
    inbox_id    BIGINT REFERENCES inboxes(id),
    source_id   VARCHAR(255) NOT NULL,  -- LINE userId / FB PSID / IG user ID
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(inbox_id, source_id)
);

-- =============================================
-- บทสนทนา
-- =============================================
CREATE TABLE conversations (
    id                  BIGSERIAL PRIMARY KEY,
    account_id          BIGINT REFERENCES accounts(id),
    inbox_id            BIGINT REFERENCES inboxes(id),
    contact_id          BIGINT REFERENCES contacts(id),
    assignee_id         BIGINT REFERENCES users(id),
    status              VARCHAR(20) DEFAULT 'open',  -- open, resolved, pending, snoozed
    priority            VARCHAR(10),                  -- low, medium, high, urgent
    messages_count      INT DEFAULT 0,
    last_activity_at    TIMESTAMPTZ DEFAULT NOW(),
    waiting_since       TIMESTAMPTZ,                  -- เวลาที่ลูกค้าส่งข้อความล่าสุด
    first_reply_at      TIMESTAMPTZ,                  -- เวลาที่ agent ตอบครั้งแรก
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ข้อความ
-- =============================================
CREATE TABLE messages (
    id                  BIGSERIAL PRIMARY KEY,
    conversation_id     BIGINT REFERENCES conversations(id),
    account_id          BIGINT REFERENCES accounts(id),
    inbox_id            BIGINT REFERENCES inboxes(id),
    message_type        VARCHAR(20) NOT NULL,  -- incoming, outgoing, activity, note
    content             TEXT,
    content_type        VARCHAR(20) DEFAULT 'text',  -- text, image, video, file, sticker, template
    content_attributes  JSONB DEFAULT '{}',           -- platform-specific metadata
    source_id           VARCHAR(255),                  -- platform message ID (สำหรับ dedup)
    sender_id           BIGINT,
    sender_type         VARCHAR(20),  -- 'Contact', 'User' (agent), 'Bot'
    private             BOOLEAN DEFAULT FALSE,  -- internal note
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================

-- Deduplication: ป้องกันข้อความซ้ำจาก platform
CREATE UNIQUE INDEX idx_messages_dedup
    ON messages(source_id, inbox_id)
    WHERE source_id IS NOT NULL;

-- ดึงข้อความในบทสนทนาแบบเรียงเวลา
CREATE INDEX idx_messages_conversation_time
    ON messages(conversation_id, created_at DESC);

-- ค้นหา contact จาก platform ID
CREATE INDEX idx_contact_inboxes_source
    ON contact_inboxes(inbox_id, source_id);

-- ดึง conversation ตาม status
CREATE INDEX idx_conversations_status
    ON conversations(account_id, status, last_activity_at DESC);

-- =============================================
-- Users (Agents / Admins)
-- =============================================
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    account_id  BIGINT REFERENCES accounts(id),
    email       VARCHAR(255) NOT NULL UNIQUE,
    name        VARCHAR(255),
    role        VARCHAR(20) DEFAULT 'agent',  -- admin, agent
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Real-time Delivery

### WebSocket Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Agent A    │     │   Agent B    │     │   Agent C    │
│  (Browser)   │     │  (Browser)   │     │  (Browser)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │ WS                 │ WS                 │ WS
┌──────▼─────────────────────▼───────────────────▼───────┐
│                  WebSocket Server                       │
│              (Socket.IO / ws / Centrifugo)              │
├────────────────────────────────────────────────────────┤
│                  Redis Pub/Sub                          │
│          (broadcast across server instances)            │
└────────────────────────────────────────────────────────┘
```

### Message Flow

```
# ข้อความเข้า (Customer → Agent)
1. Webhook received → Queue → Worker processes
2. Worker saves to DB
3. Worker publishes to Redis channel: conversation:{id}
4. WebSocket server receives from Redis
5. Broadcasts to all agents subscribed to that conversation

# ข้อความออก (Agent → Customer)
1. Agent sends via REST API: POST /api/messages
2. Save to DB
3. Send to platform via Channel Adapter (LINE API / Graph API)
4. Broadcast to other agents via WebSocket
```

### Connection Management

```javascript
// Client-side subscription
socket.emit('subscribe', {
  conversations: [123, 456],  // conversation IDs
  account_id: 1
});

// Server-side broadcasting
redis.subscribe(`conversation:${id}`, (message) => {
  socket.to(`conversation:${id}`).emit('new_message', message);
});
```

---

## 6. Async Job Processing & Deduplication

### Queue Architecture

```
Webhook → Return 200 OK
            ↓
    Redis Job Queue (BullMQ / Asynq)
            ↓
    ┌───────────────────────┐
    │   Worker Pool         │
    │  ┌─────┐ ┌─────┐     │
    │  │ W1  │ │ W2  │ ... │
    │  └─────┘ └─────┘     │
    └───────────────────────┘
            ↓
    Normalize → Dedup → Persist → Broadcast
```

### Deduplication Strategy

```
1. สร้าง dedup key:
   key = hash(platform_message_id, inbox_id)

2. ตรวจ Redis cache (fast path):
   SETNX dedup:{key} 1 EX 86400    ← TTL 24 ชั่วโมง
   ถ้า key มีอยู่แล้ว → skip (ข้อความซ้ำ)

3. ตรวจ DB (safety net):
   SELECT 1 FROM messages
   WHERE source_id = ? AND inbox_id = ?
   ถ้าเจอ → skip

4. บันทึกข้อความใหม่ พร้อม source_id
```

### Retry Strategy

```
Job failed → Exponential backoff retry
  Attempt 1: wait 1s
  Attempt 2: wait 4s
  Attempt 3: wait 16s
  Attempt 4: wait 64s
  Max retries: 5 → Move to dead letter queue
```

---

## 7. Platform-Specific Details

### LINE Messaging API

```
Webhook URL: POST /webhooks/line

Headers:
  X-Line-Signature: HMAC-SHA256(channel_secret, body)

Event Types:
  - message (text, image, video, audio, file, location, sticker)
  - follow / unfollow
  - join / leave
  - postback

Validation:
  signature = HMAC-SHA256(channel_secret, raw_body)
  compare with X-Line-Signature header

Sending Messages:
  POST https://api.line.me/v2/bot/message/reply   (ใช้ replyToken)
  POST https://api.line.me/v2/bot/message/push    (ส่งเมื่อไหร่ก็ได้)

Rate Limit:
  - Reply: ไม่จำกัด (ต้องใช้ภายใน 1 นาที)
  - Push: ขึ้นอยู่กับ plan (free = 500/เดือน)
```

### Facebook Messenger (Graph API)

```
Webhook URL: POST /webhooks/facebook

Verification:
  GET /webhooks/facebook?hub.mode=subscribe
    &hub.verify_token=YOUR_TOKEN
    &hub.challenge=CHALLENGE
  → Return hub.challenge

Headers:
  X-Hub-Signature-256: sha256=HMAC-SHA256(app_secret, body)

Event Object:
  {
    "object": "page",
    "entry": [{
      "messaging": [{
        "sender": { "id": "PSID" },
        "recipient": { "id": "PAGE_ID" },
        "timestamp": 1234567890,
        "message": { "mid": "xxx", "text": "Hello" }
      }]
    }]
  }

Sending Messages:
  POST https://graph.facebook.com/v19.0/me/messages
  Authorization: Bearer {page_access_token}
  Body: { "recipient": { "id": "PSID" }, "message": { "text": "Hi" } }

Permissions Required:
  - pages_messaging
  - pages_read_engagement
```

### Instagram (Graph API)

```
Webhook URL: POST /webhooks/instagram  (ใช้ endpoint เดียวกับ FB ได้)

Headers:
  X-Hub-Signature-256: sha256=HMAC-SHA256(app_secret, body)

Event Object:
  {
    "object": "instagram",
    "entry": [{
      "messaging": [{
        "sender": { "id": "IG_USER_ID" },
        "recipient": { "id": "IG_BUSINESS_ID" },
        "message": { "mid": "xxx", "text": "Hello" }
      }]
    }]
  }

Sending Messages:
  POST https://graph.facebook.com/v19.0/me/messages
  Authorization: Bearer {page_access_token}

Permissions Required:
  - instagram_manage_messages
  - instagram_basic
  - pages_manage_metadata

Limitations:
  - ต้องเป็น Instagram Business/Creator Account
  - ต้องเชื่อมกับ Facebook Page
  - ไม่มี webhook สำหรับ Feed posts (มีแค่ DM + comments)
```

---

## 8. Tech Stack Options

### Option A: Node.js (TypeScript)

| Component | Technology |
|-----------|-----------|
| **Backend** | NestJS (TypeScript) |
| **Frontend** | Next.js (React) |
| **Database** | PostgreSQL + Prisma ORM |
| **Queue** | BullMQ (Redis-based) |
| **Real-time** | Socket.IO |
| **File Storage** | AWS S3 / MinIO |
| **Cache** | Redis |
| **Auth** | JWT + Refresh Token |
| **Deploy** | Docker + Docker Compose |

**Pros:** ecosystem ใหญ่, หาคนง่าย, prototype เร็ว
**Cons:** performance ต่ำกว่า Go ตอน high concurrency

### Option B: Go + React

| Component | Technology |
|-----------|-----------|
| **Backend** | Go (Fiber / Gin) |
| **Frontend** | Next.js (React) |
| **Database** | PostgreSQL + sqlc / GORM |
| **Queue** | Asynq (Redis-based) |
| **Real-time** | Centrifugo / Gorilla WebSocket |
| **File Storage** | AWS S3 / MinIO |
| **Cache** | Redis |
| **Auth** | JWT + Refresh Token |
| **Deploy** | Docker + Docker Compose |

**Pros:** performance สูง, memory ต่ำ, เหมาะกับ high traffic
**Cons:** development ช้ากว่า, ecosystem เล็กกว่า

### Option C: Fork Chatwoot (Ruby on Rails)

| Component | Technology |
|-----------|-----------|
| **Backend** | Ruby on Rails |
| **Frontend** | Vue.js |
| **Database** | PostgreSQL |
| **Queue** | Sidekiq (Redis) |
| **Real-time** | Action Cable |
| **File Storage** | Active Storage (S3/GCS) |

**Pros:** รองรับ 12+ channels อยู่แล้ว, production-proven, community ใหญ่
**Cons:** ต้องเรียนรู้ Rails, customize ยากถ้าไม่คุ้น codebase

---

## 9. Key Considerations

### 9.1 Deduplication

Platform อาจส่ง webhook ซ้ำ (network retry, timeout) → ใช้ `source_id + inbox_id` ตรวจสอบ

```
Redis SETNX (fast) + DB unique index (safety net)
```

### 9.2 Contact Merge

คนเดียวกันคุยมาจาก LINE + FB → ต้อง merge เป็น contact เดียว

```
Merge strategies:
  - Manual: Agent กดรวม contact ด้วยตัวเอง
  - Auto (email/phone match): ถ้า email/เบอร์โทรตรงกัน → auto merge
  - Suggestion: ระบบแนะนำ contact ที่น่าจะเป็นคนเดียวกัน
```

### 9.3 Media Handling

รูป/วิดีโอจาก platform มี URL ชั่วคราว → ต้อง download แล้ว store เอง

```
1. Webhook เข้า → พบ media attachment
2. Download จาก platform URL (LINE: content API, FB/IG: attachment URL)
3. Upload ไป S3/MinIO
4. เก็บ permanent URL ใน content_attributes
```

### 9.4 Rate Limiting

| Platform | Limit |
|----------|-------|
| **LINE Push** | 500/เดือน (free), unlimited (paid) |
| **LINE Reply** | ไม่จำกัด (ต้องใช้ภายใน 1 นาที) |
| **Facebook** | 250 calls/hour per user |
| **Instagram** | ใช้ Graph API rate limit ร่วมกับ FB |

### 9.5 Rich Message Support

| Type | LINE | Facebook | Instagram |
|------|------|----------|-----------|
| **Text** | ✅ | ✅ | ✅ |
| **Image** | ✅ | ✅ | ✅ |
| **Video** | ✅ | ✅ | ✅ |
| **Sticker** | ✅ (stickerId) | ✅ (sticker_id) | ❌ |
| **Template** | Flex Message | Generic/Button Template | Generic Template |
| **Quick Reply** | ✅ | ✅ | ✅ |
| **Carousel** | Flex (carousel) | Generic Template | ❌ |
| **Location** | ✅ | ✅ | ❌ |

### 9.6 Security Checklist

- [ ] Validate webhook signatures (HMAC-SHA256) ทุก request
- [ ] เก็บ tokens/secrets ใน environment variables (ห้าม hardcode)
- [ ] ใช้ HTTPS ทุก endpoint
- [ ] Rate limit API endpoints ป้องกัน abuse
- [ ] Sanitize user input ป้องกัน XSS/injection
- [ ] Encrypt sensitive data at rest (tokens, PII)
- [ ] Implement RBAC (Role-Based Access Control) สำหรับ agent/admin

---

## 10. Reference: Open Source Solutions

| Platform | Stack | Channels | Stars | License |
|----------|-------|----------|-------|---------|
| **Chatwoot** | Rails + Vue.js | 12+ (LINE, FB, IG, WhatsApp, Telegram, Email...) | 22k+ | MIT |
| **Rocket.Chat** | Meteor + React | FB, IG, WhatsApp, Telegram, SMS | 42k+ | MIT |
| **Typebot** | Next.js + Prisma | Web, WhatsApp | 8k+ | AGPL-3.0 |

### Chatwoot Architecture (สำหรับอ้างอิง)

```
Frontend (Vue.js SPA)
       ↓ WebSocket (Action Cable)
Rails Application
       ↓
┌──────────────────────────────┐
│  Channel::Line               │
│  Channel::FacebookPage       │
│  Channel::Instagram          │  ← Polymorphic Channel Models
│  Channel::TwitterProfile     │
│  Channel::WhatsappCloud      │
└──────────────────────────────┘
       ↓
PostgreSQL (data) + Redis (cache/queue) + Sidekiq (workers)
```

---

## 11. Cost Estimation (~200 แชท/วัน, ~6,000 แชท/เดือน)

### Platform API Costs — ฟรีทั้งหมด (สำหรับ use case นี้)

> **Use case:** ลูกค้าทักมา → Agent ตอบกลับ (ไม่ได้ push/broadcast ออกไปเอง)

| Platform | วิธีตอบ | ค่าใช้จ่าย | เงื่อนไข |
|----------|--------|-----------|----------|
| **LINE** | Reply (replyToken) | **฿0** | ตอบภายใน 1 นาทีหลังลูกค้าทัก |
| **Facebook Messenger** | Standard Reply | **฿0** | ตอบภายใน 24 ชม. |
| **Instagram DM** | Standard Reply | **฿0** | ตอบภายใน 24 ชม. |
| **รวม API Cost** | | **฿0/เดือน** | |

**ทำไมฟรี?**
- **LINE:** "Reply Message" ใช้ replyToken ตอบกลับ → ฟรีไม่จำกัด ไม่นับโควต้า
- **Facebook/Instagram:** Meta ไม่คิดเงินค่า messaging API ตอบภายใน 24 ชม. (รายได้มาจาก Ads)
- ทุก SaaS (Respond.io, Chatwoot, Zendesk) ก็ไม่ได้รวมค่า API ให้ — เพราะมันฟรีอยู่แล้ว

**จ่ายเมื่อไหร่?** เฉพาะเมื่อ **ธุรกิจส่งข้อความออกไปก่อน** (ลูกค้าไม่ได้ทักมา):

| กรณี | Platform | ค่าใช้จ่าย |
|------|----------|-----------|
| Broadcast โปรโมชั่น | LINE Push | ฿1,200-3,600/เดือน (ขึ้นกับ plan) |
| ส่ง LINE หลัง replyToken หมดอายุ (1 นาที) | LINE Push | นับเป็น push message |
| ส่ง FB หลัง 24 ชม. | ต้องใช้ Message Tag | ฟรี (แต่จำกัด use case) |
| ส่ง IG หลัง 24 ชม. | ไม่สามารถส่งได้ | — |

---

### Infrastructure Costs — สิ่งเดียวที่ต้องจ่าย

#### Option A: Budget VPS (Hetzner / Contabo) — ประหยัดสุด

| Component | Spec | ค่าใช้จ่าย/เดือน |
|-----------|------|-----------------|
| VPS | 4 vCPU, 8GB RAM, 80GB SSD | ~$8-10 (~฿300) |
| PostgreSQL | Self-managed บน VPS เดียวกัน | $0 |
| Redis | Self-managed บน VPS เดียวกัน | $0 |
| Object Storage | Backblaze B2 / Hetzner Storage | ~$3-5 (~฿150) |
| Domain + SSL | .com + Let's Encrypt | ~$1 (~฿35) |
| **รวม** | | **~$12-16 (~฿450-600/เดือน)** |

> ต้องดูแล server เอง (backup, security updates) / Data center อยู่ EU/US

#### Option B: DigitalOcean Managed — แนะนำ ✓

| Component | Spec | ค่าใช้จ่าย/เดือน |
|-----------|------|-----------------|
| Droplet (VPS) | 2 vCPU, 4GB RAM, 80GB SSD | $24 (~฿850) |
| Managed PostgreSQL | 1 vCPU, 1GB, 10GB storage | $15 (~฿530) |
| Managed Redis | 1 vCPU, 1GB | $15 (~฿530) |
| Spaces (S3) | 250GB storage + 1TB transfer | $5 (~฿180) |
| Domain + SSL | Let's Encrypt | ~$1 (~฿35) |
| **รวม** | | **~$60 (~฿2,100/เดือน)** |

> Managed = DigitalOcean ดูแล backup, update ให้ / มี Data center Singapore

#### Option C: AWS — Scale ได้ดีสุด

| Component | Spec | ค่าใช้จ่าย/เดือน |
|-----------|------|-----------------|
| EC2 | t3.medium (2 vCPU, 4GB) reserved | ~$30 (~฿1,050) |
| RDS PostgreSQL | db.t3.micro, 20GB | ~$20 (~฿700) |
| ElastiCache Redis | cache.t3.micro | ~$15 (~฿530) |
| S3 | 50GB storage | ~$3 (~฿105) |
| Route 53 + ACM | Domain + SSL | ~$1 (~฿35) |
| **รวม** | | **~$70 (~฿2,450/เดือน)** |

---

### Alternative: ใช้ SaaS สำเร็จรูป (ไม่ต้อง dev เอง)

> SaaS เหล่านี้ **ไม่ได้รวมค่า LINE/FB/IG API** — แต่เนื่องจาก API ฟรีอยู่แล้ว จึงไม่มีค่าใช้จ่ายเพิ่ม

| Platform | ค่าใช้จ่าย/เดือน | รายละเอียด |
|----------|-----------------|-----------|
| **Chatwoot Cloud** | $19/agent → 3 agents = **$57** (~฿2,000) | ครบทุกช่องทาง, cloud hosted |
| **Respond.io** | **$79-159** (~฿2,800-5,600) | Growth plan สำหรับ 3,000 contacts |
| **Zendesk** | **$55/agent** → 3 agents = **$165** (~฿5,800) | Enterprise-grade |

---

### สรุป Cost จริงทั้งหมด (3 agents, 200 แชท/วัน, reply only)

```
┌─────────────────────────────────────────────────────────────┐
│                   ค่า API ทุกช่องทาง = ฿0                    │
│          (LINE Reply ฟรี / FB ฟรี 24ชม. / IG ฟรี 24ชม.)     │
└─────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────┐
│                  ค่า Infrastructure เท่านั้น                  │
└─────────────────────────────────────────────────────────────┘
```

| Approach | ค่าใช้จ่ายจริง/เดือน | หมายเหตุ |
|----------|-------------------|----------|
| **Self-host + Budget VPS** | **~฿500-600** | ถูกสุด แต่ดูแลเอง |
| **Self-host + DigitalOcean** | **~฿2,100** | แนะนำ — สมดุลราคา/สะดวก |
| **Self-host + AWS** | **~฿2,450** | เหมาะถ้าจะ scale ใหญ่ |
| **Chatwoot Cloud (3 agents)** | **~฿2,000** | ไม่ต้อง dev/ดูแล server |
| **Respond.io** | **~฿2,800-5,600** | UI ดี แต่แพงสุด |

### เมื่อไหร่ถึงจะมีค่าใช้จ่ายเพิ่ม?

| สถานการณ์ | ค่าเพิ่ม/เดือน |
|-----------|--------------|
| ต้อง broadcast โปรโมชั่นทาง LINE | +฿1,200-3,600 (LINE Push plan) |
| ต้องใช้ WhatsApp Business API | +฿1.5-3/conversation |
| Agent เพิ่ม (Chatwoot Cloud) | +฿700/agent |
| Storage เกิน (รูป/วิดีโอเยอะ) | +฿100-500 |
| Traffic scale ขึ้น 10x | อาจต้อง upgrade VPS +฿500-1,000 |

### Hidden Costs ที่ควรรู้

| รายการ | ค่าใช้จ่าย |
|--------|-----------|
| **Developer time** | ถ้า build เอง ต้องคิดค่าแรง dev (cost หลักจริงๆ) |
| **Maintenance** | Server monitoring, bug fixes, security patches |
| **Backup** | Automated database backup (~฿70-180/เดือน) |
| **Email service** | สำหรับ notification (SendGrid free = 100/วัน ฟรี) |
| **Monitoring** | UptimeRobot free tier = ฿0 |
| **Log management** | Grafana Cloud free tier = ฿0 |

---

## Project Structure (แนะนำสำหรับ Option A: Node.js)

```
chatbot/
├── apps/
│   ├── api/                    # Backend API (NestJS)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── accounts/
│   │   │   │   ├── inboxes/
│   │   │   │   ├── contacts/
│   │   │   │   ├── conversations/
│   │   │   │   ├── messages/
│   │   │   │   └── webhooks/       # Webhook handlers
│   │   │   ├── adapters/
│   │   │   │   ├── line.adapter.ts
│   │   │   │   ├── facebook.adapter.ts
│   │   │   │   └── instagram.adapter.ts
│   │   │   ├── jobs/               # Queue workers
│   │   │   │   ├── message.processor.ts
│   │   │   │   └── media.processor.ts
│   │   │   ├── gateway/            # WebSocket gateway
│   │   │   │   └── chat.gateway.ts
│   │   │   └── common/
│   │   │       ├── interfaces/
│   │   │       └── utils/
│   │   └── prisma/
│   │       └── schema.prisma       # Database schema
│   │
│   └── web/                    # Frontend (Next.js)
│       ├── src/
│       │   ├── components/
│       │   │   ├── inbox/          # Unified inbox UI
│       │   │   ├── conversation/   # Chat thread view
│       │   │   ├── contacts/       # Contact management
│       │   │   └── settings/       # Inbox/channel settings
│       │   ├── hooks/
│       │   ├── stores/             # State management
│       │   └── lib/
│       │       └── socket.ts       # WebSocket client
│       └── ...
│
├── docker-compose.yml          # PostgreSQL + Redis + MinIO
├── package.json                # Monorepo root
└── turbo.json                  # Turborepo config
```
