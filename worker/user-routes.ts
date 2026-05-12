import { Hono } from "hono";
import { sign } from "hono/jwt";
import { type Env, ok, bad, notFound } from './d1-utils';
import { UserEntity, LedgerEntity, RecordEntity, FamilyEntity, ContactEntity } from "./entities";

/**
 * 礼尚-📝你的人情来往 API 路由定义
 *
 * 所有 API 响应格式统一为：
 * { success: boolean; data?: T; error?: string }
 *
 * 认证说明：
 * - 大部分接口需要通过 familyId 参数验证用户权限
 * - 敏感操作会验证用户是否属于指定家庭
 */

// 哈希密码函数，使用 SHA-256 和随机盐值
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 数据库变更后重新计算账本的总金额
async function recalculateLedgerTotals(db: D1Database, ledgerId: string) {
  const totals = await db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'give' THEN amount ELSE 0 END) as totalGiven,
      SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END) as totalReceived
    FROM records
    WHERE ledger_id = ?
  `).bind(ledgerId).first<any>();
  await db.prepare(`
    UPDATE ledgers
    SET total_given = ?, total_received = ?, updated_at = ?
    WHERE id = ?
  `).bind(totals?.totalGiven || 0, totals?.totalReceived || 0, Date.now(), ledgerId).run();
}

/**
 * 注册所有用户相关的 API 路由
 * @param app Hono 应用实例
 */
export function userRoutes(app: Hono<{ Bindings: Env }>) {

  // 生成 JWT token（包含用户完整信息，7天过期）
  async function generateToken(user: { id: string; name: string; email: string; activeFamilyId: string; familyIds: string[] }, secret: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return await sign({
      id: user.id,
      name: user.name,
      email: user.email,
      activeFamilyId: user.activeFamilyId,
      familyIds: user.familyIds,
      iat: now,
      exp: now + 2 * 60 * 60, // 7天后过期
    }, secret);
  }

  // ==========================================
  // 认证相关 API
  // ==========================================

  /**
   * POST /api/auth/register
   * 用户注册接口
   *
   * 请求体: { name: string, email: string, password: string }
   * 响应: { id: string, name: string, activeFamilyId: string, familyIds: string[], token: string }
   *
   * 功能: 创建新用户并自动创建一个默认家庭
   * 错误: 邮箱已存在、缺少必填字段
   */
  app.post('/api/auth/register', async (c) => {
    const { name, email, password } = await c.req.json();
    if (!name || !email || !password) return bad(c, 'Missing fields', 'MISSING_FIELDS');
    const existing = await UserEntity.findByEmail(c.env.DB, email);
    if (existing) return bad(c, 'Email already registered', 'EMAIL_ALREADY_REGISTERED');
    const userId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const salt = crypto.randomUUID();
    const hashedPassword = await hashPassword(password, salt);
    await FamilyEntity.create(c.env.DB, {
      id: familyId,
      name: `${name}的家`,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      members: [userId]
    });
    const user = {
      id: userId,
      name,
      email,
      password: `${salt}:${hashedPassword}`,
      activeFamilyId: familyId,
      preferences: { language: 'zh', currency: 'CNY', reminders: { enabled: false, email: '', frequency: 'weekly' } }
    };
    await UserEntity.upsert(c.env.DB, user as any);
    const fullUser = await UserEntity.get(c.env.DB, userId);
    if (!fullUser) return bad(c, 'Failed to create user session', 'CREATE_USER_FAILED');
    const token = await generateToken({ id: fullUser.id, name: fullUser.name, email: fullUser.email, activeFamilyId: fullUser.activeFamilyId, familyIds: fullUser.familyIds }, c.env.JWT_SECRET || 'harmony-ledger-workers-secret');
    return ok(c, { id: fullUser.id, name: fullUser.name, email: fullUser.email, activeFamilyId: fullUser.activeFamilyId, familyIds: fullUser.familyIds, token });
  });

  /**
   * POST /api/auth/login
   * 用户登录接口
   *
   * 请求体: { email: string, password: string }
   * 响应: { id: string, name: string, email: string, activeFamilyId: string, familyIds: string[], token: string }
   *
   * 功能: 验证用户凭据并返回用户信息
   * 错误: 邮箱或密码错误
   */
  app.post('/api/auth/login', async (c) => {
    const { email, password } = await c.req.json();
    const user = await UserEntity.findByEmail(c.env.DB, email);
    if (!user) return bad(c, 'Invalid email or password', 'INVALID_CREDENTIALS');
    const [salt, storedHash] = (user as any).password.split(':');
    const incomingHash = await hashPassword(password, salt);
    if (incomingHash !== storedHash) return bad(c, 'Invalid email or password', 'INVALID_CREDENTIALS');
    const token = await generateToken({ id: user.id, name: user.name, email: user.email, activeFamilyId: user.activeFamilyId, familyIds: user.familyIds }, c.env.JWT_SECRET || 'harmony-ledger-workers-secret');
    return ok(c, { id: user.id, name: user.name, email: user.email, activeFamilyId: user.activeFamilyId, familyIds: user.familyIds, token });
  });

  // ==========================================
  // 家庭管理 API
  // ==========================================

  /**
   * POST /api/family/switch
   * 切换用户活跃家庭
   *
   * 请求体: { userId: string, familyId: string }
   * 响应: { id: string, name: string, activeFamilyId: string, familyIds: string[] }
   *
   * 功能: 将指定家庭设为用户的活跃家庭
   * 权限: 用户必须是该家庭成员
   */
  app.post('/api/family/switch', async (c) => {
    try {
      const user = c.get('user');
      const { familyId } = await c.req.json();
      if (!user || !user.familyIds.includes(familyId)) return bad(c, 'Access denied');
      await UserEntity.updateActiveFamily(c.env.DB, user.id, familyId);
      const updatedUser = await UserEntity.get(c.env.DB, user.id);
      return ok(c, { id: updatedUser?.id, name: updatedUser?.name, email: updatedUser?.email, activeFamilyId: updatedUser?.activeFamilyId, familyIds: updatedUser?.familyIds });
    } catch (error) {
      console.error('Error in /api/family/switch:', error);
      return c.json({ success: false, error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/user/families
   * 获取用户所属的家庭列表
   *
   * 查询参数: userId (必需)
   * 响应: Array<{ id: string, name: string }>
   *
   * 功能: 返回用户作为成员的所有家庭
   */
  app.get('/api/user/families', async (c) => {
    const user = c.get('user');
    const userId = c.req.query('userId');
    if (!userId) return bad(c, 'userId required');
    // 用户只能查看自己的家庭
    if (user.id !== userId) return bad(c, 'Access denied');
    const { results } = await c.env.DB.prepare("SELECT id, name FROM families WHERE members LIKE ?").bind(`%${userId}%`).all();
    return ok(c, results || []);
  });

  /**
   * GET /api/family/info
   * 获取家庭详细信息
   *
   * 查询参数: familyId (必需)
   * 响应: { id: string, name: string, inviteCode: string }
   *
   * 功能: 返回家庭基本信息和邀请码
   */
  app.get('/api/family/info', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const row = await c.env.DB.prepare("SELECT id, name, invite_code FROM families WHERE id = ?").bind(familyId).first<any>();
    if (!row) return notFound(c);
    return ok(c, { ...row, inviteCode: row.invite_code });
  });

  /**
   * POST /api/family/join
   * 通过邀请码加入家庭
   *
   * 请求体: { inviteCode: string, userId: string }
   * 响应: { id: string, name: string, activeFamilyId: string, familyIds: string[] }
   *
   * 功能: 验证邀请码并将用户加入家庭
   * 错误: 邀请码无效
   */
  app.post('/api/family/join', async (c) => {
    const user = c.get('user');
    const { inviteCode } = await c.req.json();
    if (!inviteCode) return bad(c, 'inviteCode is required');

    const family = await FamilyEntity.getByInviteCode(c.env.DB, inviteCode);
    if (!family) return notFound(c, 'Invalid invite code');

    await FamilyEntity.join(c.env.DB, family.id, user.id);

    const updatedUser = await UserEntity.get(c.env.DB, user.id);
    if (!updatedUser) return notFound(c, 'User not found');

    return ok(c, {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      activeFamilyId: updatedUser.activeFamilyId,
      familyIds: updatedUser.familyIds,
      familyName: family.name,
    });
  });

  /**
   * POST /api/family/leave/:id
   * 离开指定家庭
   *
   * 路径参数: id (家庭ID)
   * 响应: { id: string, name: string, email: string, activeFamilyId: string | null, familyIds: string[] }
   *
   * 功能: 将用户从家庭成员列表中移除，如果是活跃家庭则自动切换到其他家庭
   * 限制: 用户不能离开自己所属的唯一家庭
   */
  app.post('/api/family/leave/:id', async (c) => {
    const user = c.get('user');
    const familyId = c.req.param('id');
    // 验证用户确实属于该家庭
    if (!user.familyIds.includes(familyId)) return bad(c, '不是该家庭成员');
    if (user.familyIds.length <= 1) return bad(c, '无法离开自己所属的唯一家庭');
    await FamilyEntity.leave(c.env.DB, familyId, user.id);
    const updatedUser = await UserEntity.get(c.env.DB, user.id);
    return ok(c, { id: updatedUser?.id, name: updatedUser?.name, email: updatedUser?.email, activeFamilyId: updatedUser?.activeFamilyId || null, familyIds: updatedUser?.familyIds || [] });
  });

  // ==========================================
  // 联系人管理 API
  // ==========================================

  /**
   * GET /api/contacts/search
   * 搜索家庭联系人
   *
   * 查询参数: familyId (必需), q (可选，搜索关键词)
   * 响应: Array<Contact>
   *
   * 功能: 根据姓名模糊搜索联系人，按姓名排序
   */
  app.get('/api/contacts/search', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const q = c.req.query('q') || '';
    const list = await ContactEntity.search(c.env.DB, familyId, q);
    return ok(c, list);
  });

  /**
   * GET /api/contacts/:id
   * 获取单个联系人详情
   */
  app.get('/api/contacts/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const contact = await ContactEntity.getById(c.env.DB, id);
    if (!contact) return notFound(c, 'Contact not found');
    if (!user.familyIds.includes(contact.familyId)) return bad(c, '无权访问');
    return ok(c, contact);
  });

  /**
   * POST /api/contacts
   * 创建新联系人
   *
   * 请求体: { familyId: string, name: string, remarks?: string }
   * 响应: { id: string }
   *
   * 功能: 在指定家庭创建联系人记录
   */
  app.post('/api/contacts', async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    if (!user.familyIds.includes(data.familyId)) return bad(c, '无权操作该家庭');
    const id = crypto.randomUUID();
    await ContactEntity.create(c.env.DB, { ...data, id, updatedAt: Date.now() });
    return ok(c, { id });
  });

  /**
   * PUT /api/contacts/:id
   * 更新联系人信息
   *
   * 路径参数: id (联系人ID)
   * 请求体: { name?: string, remarks?: string }
   * 响应: boolean
   *
   * 功能: 更新联系人的姓名或备注
   */
  app.put('/api/contacts/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const contact = await ContactEntity.getById(c.env.DB, id);
    if (!contact) return notFound(c, 'Contact not found');
    if (!user.familyIds.includes(contact.familyId)) return bad(c, '无权操作');
    const data = await c.req.json();
    await ContactEntity.update(c.env.DB, id, data);
    return ok(c, true);
  });

  /**
   * DELETE /api/contacts/:id
   * 删除联系人
   */
  app.delete('/api/contacts/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const contact = await ContactEntity.getById(c.env.DB, id);
    if (!contact) return notFound(c, 'Contact not found');
    if (!user.familyIds.includes(contact.familyId)) return bad(c, '无权操作');
    await ContactEntity.delete(c.env.DB, id);
    return ok(c, true);
  });

  // ==========================================
  // 人情记录管理 API
  // ==========================================

  /**
   * GET /api/records
   * 获取人情记录列表
   *
   * 查询参数: familyId (必需), ledgerId (可选), query (可选，姓名搜索), page (可选，分页页码), limit (可选，每页记录数)
   * 响应: { records: Array, total: number, page: number, limit: number, totalPages: number } | Array (向后兼容)
   *
   * 功能: 获取家庭的人情记录，支持按账本过滤、姓名搜索和分页，按时间倒序排列
   */
  app.get('/api/records', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const ledgerId = c.req.query('ledgerId');
    const query = c.req.query('query');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '30');
    if (!familyId) return bad(c, 'familyId required');
    if (page < 1 || limit < 1 || limit > 500) return bad(c, 'Invalid pagination parameters');

    // 构建基础查询
    let sql = `SELECT id, family_id AS familyId, ledger_id AS ledgerId, contact_id AS contactId, type, amount, person_name AS personName, event_type AS eventType, description, timestamp FROM records WHERE family_id = ?`;
    const params: any[] = [familyId];
    if (ledgerId !== undefined) {
      if (ledgerId === '') {
        sql += ` AND ledger_id IS NULL`;
      } else {
        sql += ` AND ledger_id = ?`;
        params.push(ledgerId);
      }
    }
    if (query) { sql += ` AND person_name LIKE ?`; params.push(`%${query}%`); }

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const { total } = await c.env.DB.prepare(countSql).bind(...params).first<any>();

    // 添加排序和分页
    sql += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);

    const { results } = await c.env.DB.prepare(sql).bind(...params).all();

    // 返回分页格式
    const totalPages = Math.ceil(total / limit);
    return ok(c, {
      records: results || [],
      total,
      page,
      limit,
      totalPages
    });
  });

  /**
   * GET /api/records/by-contact/:contactId
   * 获取指定联系人的所有记录
   *
   * 路径参数: contactId (联系人ID)
   * 查询参数: familyId (必需)
   * 响应: Array<RenqingRecord>
   *
   * 功能: 返回指定联系人的所有人情记录，按时间倒序排列，无需分页
   */
  app.get('/api/records/by-contact/:contactId', async (c) => {
    const user = c.get('user');
    const contactId = c.req.param('contactId');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const { results } = await c.env.DB.prepare(
      `SELECT id, family_id AS familyId, ledger_id AS ledgerId, contact_id AS contactId, type, amount, person_name AS personName, event_type AS eventType, description, timestamp FROM records WHERE family_id = ? AND contact_id = ? ORDER BY timestamp DESC`
    ).bind(familyId, contactId).all();
    return ok(c, results || []);
  });

  /**
   * GET /api/records/timeline
   * 获取用于时间轴展示的记录列表（带分页和账本信息）
   *
   * 查询参数: familyId (必需), ledgerId (可选), page (可选，默认1), limit (可选，默认30)
   * 响应: { records: Array<RenqingRecord & { ledger?: Ledger }>, total: number, page: number, limit: number, totalPages: number }
   *
   * 功能: 获取家庭记录列表，每条记录平铺基础字段并关联其账本信息（如有），按时间倒序排列
   */
  app.get('/api/records/timeline', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const ledgerId = c.req.query('ledgerId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '30');
    if (!familyId) return bad(c, 'familyId required');
    if (page < 1 || limit < 1 || limit > 500) return bad(c, 'Invalid pagination parameters');

    // 构建基础查询
    let sql = `SELECT r.id, r.family_id AS familyId, r.ledger_id AS ledgerId, r.contact_id AS contactId, r.type, r.amount, r.person_name AS personName, r.event_type AS eventType, r.description, r.timestamp FROM records r WHERE r.family_id = ?`;
    const params: any[] = [familyId];
    if (ledgerId !== undefined) {
      if (ledgerId === '') {
        sql += ` AND r.ledger_id IS NULL`;
      } else {
        sql += ` AND r.ledger_id = ?`;
        params.push(ledgerId);
      }
    }

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const { total } = await c.env.DB.prepare(countSql).bind(...params).first<any>();

    // 添加排序和分页
    sql += ` ORDER BY r.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);

    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    const records = results || [];

    // 收集所有非空的 ledgerId
    const ledgerIds = [...new Set(records.filter((r: any) => r.ledgerId).map((r: any) => r.ledgerId))];

    // 批量获取账本信息
    let ledgers: any[] = [];
    if (ledgerIds.length > 0) {
      const placeholders = ledgerIds.map(() => '?').join(',');
      const { results: ledgerResults } = await c.env.DB.prepare(
        `SELECT id, family_id AS familyId, title, date, description, total_given AS totalGiven, total_received AS totalReceived FROM ledgers WHERE id IN (${placeholders})`
      ).bind(...ledgerIds).all();
      ledgers = ledgerResults || [];
    }
    const ledgerMap = new Map(ledgers.map((l: any) => [l.id, l]));

    // 将账本信息附加到记录上
    const enrichedRecords = records.map((r: any) => ({
      id: r.id,
      familyId: r.familyId,
      ledgerId: r.ledgerId,
      contactId: r.contactId,
      type: r.type,
      amount: r.amount,
      personName: r.personName,
      eventType: r.eventType,
      description: r.description,
      timestamp: r.timestamp,
      ledger: r.ledgerId ? ledgerMap.get(r.ledgerId) : undefined,
    }));

    const totalPages = Math.ceil(total / limit);
    return ok(c, {
      records: enrichedRecords,
      total,
      page,
      limit,
      totalPages,
    });
  });

  /**
   * POST /api/records
   * 创建人情记录
   *
   * 请求体: { familyId: string, ledgerId?: string, contactId?: string, type: 'give'|'receive', amount: number, personName: string, eventType: string, description?: string, timestamp?: number }
   * 响应: { id: string }
   *
   * 功能: 创建新的人情记录，如果关联到账本则自动更新账本统计
   */
  app.post('/api/records', async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    if (data.familyId && !user.familyIds.includes(data.familyId)) return bad(c, '无权操作该家庭');
    const id = crypto.randomUUID();
    const record = { ...data, id, timestamp: data.timestamp || Date.now(), updatedAt: Date.now() };
    await RecordEntity.create(c.env.DB, record);
    if (data.ledgerId) await recalculateLedgerTotals(c.env.DB, data.ledgerId);
    return ok(c, { id });
  });

  /**
   * PATCH /api/records/:id
   * 更新人情记录
   */
  app.patch('/api/records/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const oldRecord = await RecordEntity.get(c.env.DB, id);
    if (!oldRecord) return notFound(c, 'Record not found');
    if (!user.familyIds.includes(oldRecord.familyId)) return bad(c, '无权操作');
    const data = await c.req.json();
    await RecordEntity.update(c.env.DB, id, data);
    if (oldRecord?.ledgerId) await recalculateLedgerTotals(c.env.DB, oldRecord.ledgerId);
    if (data.ledgerId && data.ledgerId !== oldRecord?.ledgerId) await recalculateLedgerTotals(c.env.DB, data.ledgerId);
    return ok(c, true);
  });

  /**
   * DELETE /api/records/:id
   * 删除人情记录
   */
  app.delete('/api/records/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const record = await RecordEntity.get(c.env.DB, id);
    if (!record) return notFound(c, 'Record not found');
    if (!user.familyIds.includes(record.familyId)) return bad(c, '无权操作');
    await RecordEntity.delete(c.env.DB, id);
    if (record?.ledgerId) await recalculateLedgerTotals(c.env.DB, record.ledgerId);
    return ok(c, true);
  });

  // ==========================================
  // 账本管理 API
  // ==========================================

  /**
   * GET /api/ledgers
   * 获取家庭账本列表
   *
   * 查询参数: familyId (必需)
   * 响应: Array<Ledger>
   *
   * 功能: 返回家庭的所有账本，按日期倒序排列
   */
  app.get('/api/ledgers', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const { results } = await c.env.DB.prepare(`SELECT id, family_id AS familyId, title, date, description, total_given AS totalGiven, total_received AS totalReceived FROM ledgers WHERE family_id = ? ORDER BY date DESC`).bind(familyId).all();
    return ok(c, results || []);
  });

  /**
   * POST /api/ledgers
   * 创建新账本
   *
   * 请求体: { familyId: string, title: string, date: number, description?: string }
   * 响应: { id: string }
   *
   * 功能: 创建新账本，初始统计值为0
   */
  app.post('/api/ledgers', async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    if (!user.familyIds.includes(data.familyId)) return bad(c, '无权操作该家庭');
    const id = crypto.randomUUID();
    await LedgerEntity.create(c.env.DB, { ...data, id, totalGiven: 0, totalReceived: 0, updatedAt: Date.now() });
    return ok(c, { id });
  });

  /**
   * PATCH /api/ledgers/:id
   * 更新账本信息
   */
  app.patch('/api/ledgers/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    // 验证账本属于用户有权限的家庭
    const ledger = await c.env.DB.prepare("SELECT family_id FROM ledgers WHERE id = ?").bind(id).first<any>();
    if (!ledger) return notFound(c, 'Ledger not found');
    if (!user.familyIds.includes(ledger.family_id)) return bad(c, '无权操作');
    const data = await c.req.json();
    await LedgerEntity.update(c.env.DB, id, data);
    return ok(c, true);
  });

  /**
   * DELETE /api/ledgers/:id
   * 删除账本
   */
  app.delete('/api/ledgers/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    // 验证账本属于用户有权限的家庭
    const ledger = await c.env.DB.prepare("SELECT family_id FROM ledgers WHERE id = ?").bind(id).first<any>();
    if (!ledger) return notFound(c, 'Ledger not found');
    if (!user.familyIds.includes(ledger.family_id)) return bad(c, '无权操作');
    // 使用 batch 确保删除操作原子性
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM records WHERE ledger_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM ledgers WHERE id = ?").bind(id),
    ]);
    return ok(c, true);
  });

  // ==========================================
  // 统计分析 API
  // ==========================================

  /**
   * GET /api/stats/summary
   * 获取统计摘要
   *
   * 查询参数: familyId (必需)
   * 响应: { totalGiven: number, totalReceived: number, netBalance: number }
   *
   * 功能: 返回家庭的总支出、总收入和净余额
   */
  app.get('/api/stats/summary', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const result = await c.env.DB.prepare(`SELECT SUM(CASE WHEN type = 'give' THEN amount ELSE 0 END) as totalGiven, SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END) as totalReceived FROM records WHERE family_id = ?`).bind(familyId).first<any>();
    const given = result?.totalGiven || 0;
    const received = result?.totalReceived || 0;
    return ok(c, { totalGiven: given, totalReceived: received, netBalance: received - given });
  });

  /**
   * GET /api/stats/detailed
   * 获取详细统计数据
   *
   * 查询参数: familyId (必需)
   * 响应: { monthlyTrends: Array, categoryDistribution: Array, topEventType: string, maxAmount: number, netBalance: number }
   *
   * 功能: 返回月度趋势、分类分布、最热门事件类型、最大金额和净余额
   */
  app.get('/api/stats/detailed', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const trends = await c.env.DB.prepare(`SELECT strftime('%Y-%m', timestamp/1000, 'unixepoch') as month, SUM(CASE WHEN type = 'give' THEN amount ELSE 0 END) as give, SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END) as receive FROM records WHERE family_id = ? GROUP BY month ORDER BY month DESC LIMIT 6`).bind(familyId).all();
    const categories = await c.env.DB.prepare(`SELECT event_type as name, SUM(amount) as value FROM records WHERE family_id = ? GROUP BY event_type`).bind(familyId).all();
    const topEvent = await c.env.DB.prepare(`SELECT event_type as name, COUNT(*) as count FROM records WHERE family_id = ? GROUP BY event_type ORDER BY count DESC LIMIT 1`).bind(familyId).first<any>();
    const maxGift = await c.env.DB.prepare(`SELECT MAX(amount) as maxAmount FROM records WHERE family_id = ?`).bind(familyId).first<any>();
    const summary = await c.env.DB.prepare(`SELECT SUM(CASE WHEN type = 'give' THEN amount ELSE 0 END) as totalGiven, SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END) as totalReceived FROM records WHERE family_id = ?`).bind(familyId).first<any>();
    return ok(c, {
      monthlyTrends: (trends.results || []).reverse(),
      categoryDistribution: categories.results || [],
      topEventType: topEvent?.name || '无记录',
      maxAmount: maxGift?.maxAmount || 0,
      totalGiven: summary?.totalGiven || 0,
      totalReceived: summary?.totalReceived || 0,
      netBalance: (summary?.totalReceived || 0) - (summary?.totalGiven || 0)
    });
  });

  /**
   * GET /api/stats/reminders
   * 获取即将到来的提醒事项
   *
   * 查询参数: familyId (必需)
   * 响应: Array<{ id: string, title: string, date: number }>
   *
   * 功能: 返回未来5个即将到期的账本，按日期升序排列
   */
  app.get('/api/stats/reminders', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const now = Date.now();
    const { results } = await c.env.DB.prepare("SELECT id, title, date FROM ledgers WHERE family_id = ? AND date >= ? ORDER BY date ASC LIMIT 5").bind(familyId, now).all<any>();
    return ok(c, results || []);
  });

  // ==========================================
  // 数据管理 API
  // ==========================================

  /**
   * GET /api/data/export
   * 导出家庭数据
   *
   * 查询参数: familyId (必需)
   * 响应: { records: Array, ledgers: Array, contacts: Array }
   *
   * 功能: 导出家庭的所有记录、账本和联系人数据用于备份
   */
  app.get('/api/data/export', async (c) => {
    const user = c.get('user');
    const familyId = c.req.query('familyId');
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权访问该家庭');
    const records = await c.env.DB.prepare("SELECT * FROM records WHERE family_id = ?").bind(familyId).all();
    const ledgers = await c.env.DB.prepare("SELECT * FROM ledgers WHERE family_id = ?").bind(familyId).all();
    const contacts = await c.env.DB.prepare("SELECT * FROM contacts WHERE family_id = ?").bind(familyId).all();
    return ok(c, { records: records.results, ledgers: ledgers.results, contacts: contacts.results });
  });

  /**
   * POST /api/data/restore
   * 恢复家庭数据
   *
   * 请求体: { familyId: string, records?: Array, ledgers?: Array, contacts?: Array }
   * 响应: boolean
   *
   * 功能: 从导出的数据恢复记录、账本和联系人，自动重新计算账本统计
   */
  app.post('/api/data/restore', async (c) => {
    const user = c.get('user');
    const { familyId, records, ledgers, contacts } = await c.req.json();
    // 验证用户属于该家庭
    if (!user.familyIds.includes(familyId)) return bad(c, '无权操作该家庭');
    const oldToNewLedgerId = new Map<string, string>();
    const oldToNewContactId = new Map<string, string>();

    // 先处理账本（重新生成 ID）
    if (ledgers?.length) {
      for (const l of ledgers) {
        const newId = crypto.randomUUID();
        oldToNewLedgerId.set(l.id, newId);
        await c.env.DB.prepare(`INSERT OR REPLACE INTO ledgers (id, family_id, title, date, description, total_given, total_received, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId, familyId, l.title, l.date, l.description || null, l.total_given || 0, l.total_received || 0, Date.now()).run();
      }
    }
    // 再处理联系人（重新生成 ID）
    if (contacts?.length) {
      for (const ct of contacts) {
        const newId = crypto.randomUUID();
        oldToNewContactId.set(ct.id, newId);
        await c.env.DB.prepare(`INSERT OR REPLACE INTO contacts (id, family_id, name, remarks, updated_at) VALUES (?, ?, ?, ?, ?)`).bind(newId, familyId, ct.name, ct.remarks || null, Date.now()).run();
      }
    }
    // 最后处理记录（重新生成 ID，关联新的账本/联系人 ID）
    if (records?.length) {
      for (const r of records) {
        const newRecordId = crypto.randomUUID();
        // 如果记录关联的账本不在备份中，设为 null（变为独立记录）
        const newLedgerId = r.ledger_id ? (oldToNewLedgerId.get(r.ledger_id) || null) : null;
        // 联系人同理
        const newContactId = r.contact_id ? (oldToNewContactId.get(r.contact_id) || null) : null;
        await c.env.DB.prepare(`INSERT OR REPLACE INTO records (id, family_id, ledger_id, contact_id, type, amount, person_name, event_type, description, timestamp, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newRecordId, familyId, newLedgerId, newContactId, r.type, r.amount, r.person_name, r.event_type, r.description || null, r.timestamp, Date.now()).run();
      }
    }
    // Refresh ledger totals if records were imported
    if (records?.length && ledgers?.length) {
      for (const l of ledgers) {
        const newId = oldToNewLedgerId.get(l.id);
        if (newId) await recalculateLedgerTotals(c.env.DB, newId);
      }
    }
    return ok(c, true);
  });

  /**
   * POST /api/data/migrate-contacts
   * 从记录中迁移联系人数据
   *
   * 请求体: { familyId: string }
   * 响应: { createdCount: number }
   *
   * 功能: 将记录中的人名自动创建为联系人，并关联相关记录
   */
  app.post('/api/data/migrate-contacts', async (c) => {
    const user = c.get('user');
    const { familyId } = await c.req.json();
    if (!familyId) return bad(c, 'familyId required');
    // 验证用户属于该家庭
    if (!user.familyIds.includes(familyId)) return bad(c, '无权操作该家庭');
    // Find unique names in records that aren't linked to a contact
    const { results: names } = await c.env.DB.prepare(`
      SELECT DISTINCT person_name as name
      FROM records
      WHERE family_id = ? AND contact_id IS NULL
    `).bind(familyId).all<any>();
    if (!names || names.length === 0) return ok(c, { createdCount: 0 });
    let createdCount = 0;
    for (const item of names) {
      // Check if contact already exists by name
      const existing = await c.env.DB.prepare("SELECT id FROM contacts WHERE family_id = ? AND name = ?").bind(familyId, item.name).first();
      if (!existing) {
        const contactId = crypto.randomUUID();
        await ContactEntity.create(c.env.DB, {
          id: contactId,
          familyId,
          name: item.name,
          updatedAt: Date.now()
        });
        // Link all records for this name to the new contact
        await c.env.DB.prepare("UPDATE records SET contact_id = ? WHERE family_id = ? AND person_name = ?").bind(contactId, familyId, item.name).run();
        createdCount++;
      }
    }
    return ok(c, { createdCount });
  });
}
