# Harmony Ledger API 文档

## 概述

本 API 基于 [Hono](https://hono.dev/) 构建，运行在 Cloudflare Workers 上，使用 D1（SQLite）作为数据库。所有接口返回统一的 JSON 响应格式。

### 基础地址

```
https://你的域名.cloudflareworkers.com
```

### 响应格式

所有接口响应均遵循以下结构：

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

错误响应：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 错误码

| 状态码 | 说明 |
|---|---|
| 400 | 请求参数错误或缺失 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 目录

- [健康检查](#健康检查)
- [认证](#认证)
- [家庭管理](#家庭管理)
- [联系人](#联系人)
- [记录](#记录)
- [礼簿](#礼簿)
- [统计分析](#统计分析)
- [数据管理](#数据管理)
- [数据模型](#数据模型)

---

## 健康检查

### `GET /api/health`

检查 API 是否正常运行。

**响应：**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-04-14T12:00:00.000Z"
  }
}
```

---

## 认证

### `POST /api/auth/register`

用户注册接口。注册成功后自动创建一个默认家庭。

**请求体：**
```json
{
  "name": "张三",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid字符串",
    "name": "张三",
    "activeFamilyId": "家庭uuid",
    "familyIds": ["家庭uuid"]
  }
}
```

**错误：**
- `Email already registered` - 邮箱已被注册
- `Missing fields` - 缺少必填字段

---

### `POST /api/auth/login`

用户登录接口，验证凭据并返回会话信息。

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid字符串",
    "name": "张三",
    "activeFamilyId": "家庭uuid",
    "familyIds": ["家庭uuid", "另一个家庭uuid"]
  }
}
```

**错误：**
- `Invalid email or password` - 邮箱或密码错误

---

## 家庭管理

### `POST /api/family/switch`

切换用户的活跃家庭。

**请求体：**
```json
{
  "userId": "用户uuid",
  "familyId": "家庭uuid"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "用户uuid",
    "name": "张三",
    "activeFamilyId": "新家庭uuid",
    "familyIds": ["家庭uuid", "新家庭uuid"]
  }
}
```

**错误：**
- `Not a member of this family` - 用户不是该家庭成员

---

### `GET /api/user/families`

获取用户所属的所有家庭列表。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `userId` | 是 | 用户ID |

**响应：**
```json
{
  "success": true,
  "data": [
    { "id": "家庭uuid", "name": "张三的家" },
    { "id": "家庭uuid2", "name": "李四的家" }
  ]
}
```

---

### `GET /api/family/info`

获取家庭详细信息，包含邀请码。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "家庭uuid",
    "name": "张三的家",
    "inviteCode": "ABC123"
  }
}
```

---

### `POST /api/family/join`

通过邀请码加入一个家庭。

**请求体：**
```json
{
  "inviteCode": "ABC123",
  "userId": "用户uuid"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "用户uuid",
    "name": "张三",
    "activeFamilyId": "家庭uuid",
    "familyIds": ["家庭uuid", "新加入家庭uuid"]
  }
}
```

**错误：**
- `Invalid invite code` - 邀请码无效

---

### `POST /api/family/leave/:id`

离开指定家庭。如果这是用户唯一的家庭，请求将被拒绝。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 要离开的家庭ID |

**请求体：**
```json
{
  "userId": "用户uuid"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "用户uuid",
    "name": "张三",
    "activeFamilyId": "剩余家庭uuid",
    "familyIds": ["剩余家庭uuid"]
  }
}
```

**错误：**
- `无法离开自己所属的唯一家庭` - 用户只有一个家庭

---

## 联系人

### `GET /api/contacts/search`

在家庭内搜索联系人。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |
| `q` | 否 | 搜索关键词（匹配联系人姓名） |

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "联系人uuid",
      "familyId": "家庭uuid",
      "name": "王五",
      "remarks": "表哥",
      "updatedAt": 1712000000000
    }
  ]
}
```

---

### `GET /api/contacts/:id`

根据ID获取单个联系人信息。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 联系人ID |

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "联系人uuid",
    "familyId": "家庭uuid",
    "name": "王五",
    "remarks": "表哥",
    "updatedAt": 1712000000000
  }
}
```

---

### `POST /api/contacts`

创建新联系人。

**请求体：**
```json
{
  "familyId": "家庭uuid",
  "name": "王五",
  "remarks": "表哥"
}
```

**响应：**
```json
{
  "success": true,
  "data": { "id": "新联系人uuid" }
}
```

---

### `PUT /api/contacts/:id`

更新联系人信息。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 联系人ID |

**请求体：**
```json
{
  "name": "王五（更新）",
  "remarks": "表弟"
}
```

**响应：**
```json
{
  "success": true,
  "data": true
}
```

---

### `DELETE /api/contacts/:id`

删除联系人。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 联系人ID |

**响应：**
```json
{
  "success": true,
  "data": true
}
```

---

### `GET /api/records/by-contact/:contactId`

获取指定联系人的所有记录。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `contactId` | 是 | 联系人ID |

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "记录uuid",
      "familyId": "家庭uuid",
      "ledgerId": "礼簿uuid",
      "contactId": "联系人uuid",
      "type": "give",
      "amount": 500,
      "personName": "王五",
      "eventType": "wedding",
      "description": "婚礼礼金",
      "timestamp": 1712000000000
    }
  ]
}
```

---

## 记录

### `GET /api/records`

获取分页记录列表。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |
| `ledgerId` | 否 | 礼簿ID（空字符串表示独立记录） |
| `query` | 否 | 按姓名搜索 |
| `page` | 否 | 页码（默认：1） |
| `limit` | 否 | 每页条数（默认：30，最大：500） |

**响应：**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "记录uuid",
        "familyId": "家庭uuid",
        "ledgerId": "礼簿uuid",
        "contactId": "联系人uuid",
        "type": "receive",
        "amount": 1000,
        "personName": "李四",
        "eventType": "wedding",
        "description": "新婚贺礼",
        "timestamp": 1712000000000
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 30,
    "totalPages": 4
  }
}
```

---

### `GET /api/records/timeline`

获取时间轴格式的记录列表，附带礼簿信息。适用于时间轴页面展示。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |
| `ledgerId` | 否 | 按礼簿筛选 |
| `page` | 否 | 页码（默认：1） |
| `limit` | 否 | 每页条数（默认：30，最大：500） |

**响应：**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "记录uuid",
        "familyId": "家庭uuid",
        "ledgerId": "礼簿uuid",
        "contactId": "联系人uuid",
        "type": "receive",
        "amount": 1000,
        "personName": "李四",
        "eventType": "wedding",
        "description": "新婚贺礼",
        "timestamp": 1712000000000,
        "ledger": {
          "id": "礼簿uuid",
          "familyId": "家庭uuid",
          "title": "表哥婚礼",
          "date": 1711000000000,
          "description": "婚礼",
          "totalGiven": 5000,
          "totalReceived": 15000
        }
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 30,
    "totalPages": 4
  }
}
```

---

### `POST /api/records`

创建一条新的人情记录。

**请求体：**
```json
{
  "familyId": "家庭uuid",
  "ledgerId": "礼簿uuid",
  "contactId": "联系人uuid",
  "type": "give",
  "amount": 500,
  "personName": "王五",
  "eventType": "wedding",
  "description": "婚礼礼金",
  "timestamp": 1712000000000
}
```

**响应：**
```json
{
  "success": true,
  "data": { "id": "新记录uuid" }
}
```

> [!NOTE]
> 如果记录关联了礼簿，礼簿的统计金额会自动重新计算。

---

### `PATCH /api/records/:id`

更新记录信息。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 记录ID |

**请求体：**
```json
{
  "amount": 600,
  "type": "receive",
  "description": "更新后的备注"
}
```

**响应：**
```json
{
  "success": true,
  "data": true
}
```

---

### `DELETE /api/records/:id`

删除一条记录。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 记录ID |

**响应：**
```json
{
  "success": true,
  "data": true
}
```

---

## 礼簿

### `GET /api/ledgers`

获取家庭的所有礼簿，按日期倒序排列。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "礼簿uuid",
      "familyId": "家庭uuid",
      "title": "表哥婚礼",
      "date": 1711000000000,
      "description": "婚礼",
      "totalGiven": 5000,
      "totalReceived": 15000
    }
  ]
}
```

---

### `POST /api/ledgers`

创建新礼簿。

**请求体：**
```json
{
  "familyId": "家庭uuid",
  "title": "表哥婚礼",
  "date": 1711000000000,
  "description": "婚礼"
}
```

**响应：**
```json
{
  "success": true,
  "data": { "id": "新礼簿uuid" }
}
```

---

### `PATCH /api/ledgers/:id`

更新礼簿信息。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 礼簿ID |

**请求体：**
```json
{
  "title": "更新后的标题",
  "description": "更新后的描述"
}
```

**响应：**
```json
{
  "success": true,
  "data": true
}
```

---

### `DELETE /api/ledgers/:id`

删除礼簿及其所有关联记录。

**路径参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 礼簿ID |

**响应：**
```json
{
  "success": true,
  "data": true
}
```

> [!WARNING]
> 此操作是原子性的 —— 礼簿和其下所有记录会同时被删除，如果中途出错则全部回滚。

---

## 统计分析

### `GET /api/stats/summary`

获取家庭级别的收支概览。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": {
    "totalGiven": 10000,
    "totalReceived": 25000,
    "netBalance": 15000
  }
}
```

---

### `GET /api/stats/detailed`

获取详细统计数据，包括月度趋势、分类分布等。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": {
    "monthlyTrends": [
      { "month": "2025-01", "give": 3000, "receive": 8000 },
      { "month": "2025-02", "give": 2000, "receive": 5000 },
      { "month": "2025-03", "give": 5000, "receive": 12000 }
    ],
    "categoryDistribution": [
      { "name": "wedding", "value": 15000 },
      { "name": "birthday", "value": 8000 },
      { "name": "festival", "value": 2000 }
    ],
    "topEventType": "wedding",
    "maxAmount": 5000,
    "netBalance": 15000
  }
}
```

---

### `GET /api/stats/reminders`

获取即将到期的礼簿提醒（最近的5个礼簿）。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "礼簿uuid",
      "title": "表哥婚礼",
      "date": 1711000000000
    }
  ]
}
```

---

## 数据管理

### `GET /api/data/export`

导出家庭所有数据为 JSON 格式，用于备份。

**查询参数：**
| 参数 | 必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭ID |

**响应：**
```json
{
  "success": true,
  "data": {
    "records": [ ... ],
    "ledgers": [ ... ],
    "contacts": [ ... ]
  }
}
```

---

### `POST /api/data/restore`

从备份中恢复家庭数据。导入时所有实体的 ID 会重新生成，确保不同家庭之间数据隔离。

**请求体：**
```json
{
  "familyId": "家庭uuid",
  "records": [ ... ],
  "ledgers": [ ... ],
  "contacts": [ ... ]
}
```

**响应：**
```json
{
  "success": true,
  "data": true
}
```

> [!NOTE]
> 恢复过程中，所有实体（礼簿、联系人、记录）都会获得新的 UUID。内部关联关系（记录 → 礼簿、记录 → 联系人）会自动映射到新的 ID。

---

### `POST /api/data/migrate-contacts`

从已有记录中自动提取不重复的姓名，创建为联系人。

**请求体：**
```json
{
  "familyId": "家庭uuid"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "createdCount": 15
  }
}
```

---

## 数据模型

### 用户（User）

```typescript
interface User {
  id: string;
  name: string;
  activeFamilyId?: string;
  familyIds: string[];
  preferences: {
    language: 'zh' | 'en';
    currency: string;
    reminders: {
      enabled: boolean;
      email: string;
      frequency: 'weekly' | 'monthly';
    };
  };
}
```

### 家庭（Family）

```typescript
interface Family {
  id: string;
  name: string;
  inviteCode: string;
  members: string[]; // 用户ID数组
}
```

### 联系人（Contact）

```typescript
interface Contact {
  id: string;
  familyId: string;
  name: string;
  remarks?: string;
  updatedAt: number;
}
```

### 礼簿（Ledger）

```typescript
interface Ledger {
  id: string;
  familyId: string;
  title: string;
  date: number;          // Unix 时间戳
  description?: string;
  totalGiven: number;
  totalReceived: number;
}
```

### 记录（Record）

```typescript
interface RenqingRecord {
  id: string;
  familyId: string;
  ledgerId?: string;
  contactId?: string;
  type: 'give' | 'receive';
  amount: number;
  personName: string;
  eventType: string;     // wedding, birthday, graduation, baby, first_birthday, festival, moving, visit, funeral, other
  description?: string;
  timestamp: number;     // Unix 时间戳
}
```

### 分页响应（PaginatedResponse）

```typescript
interface PaginatedResponse<T> {
  records: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## 事项类型

| 值 | 说明 |
|---|---|
| `wedding` | 结婚 |
| `birthday` | 生日 |
| `graduation` | 升学 |
| `baby` | 宝宝 |
| `first_birthday` | 周岁 |
| `festival` | 节日 |
| `moving` | 乔迁 |
| `visit` | 探望 |
| `funeral` | 白事 |
| `other` | 其它 |

---

## 安全说明

- 所有涉及家庭数据的接口都需要提供有效的 `familyId`
- 用户只能访问自己所属家庭的数据
- 密码使用 SHA-256 + 盐值进行哈希存储
