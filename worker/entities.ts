/**
 * 礼尚-📝你的人情来往 数据实体层
 *
 * 本文件包含所有数据实体的 CRUD 操作，基于 Cloudflare D1 数据库。
 * 所有实体类都使用静态方法，提供对数据库的直接操作。
 *
 * 设计原则：
 * - 每个实体类对应数据库中的一张表
 * - 使用静态方法避免实例化开销
 * - 统一的参数顺序：db 数据库实例优先
 * - 错误处理通过异常抛出，由上层路由处理
 */

import type { User, Family, Ledger, RenqingRecord, Contact } from "@shared/types";

/**
 * 反馈数据接口定义
 */
export interface Feedback {
  id: string;
  userId: string;
  familyId?: string;
  message: string;
  timestamp: number;
}

/**
 * 用户实体类
 *
 * 负责用户数据的 CRUD 操作，包括用户查找、创建、更新等。
 * 用户数据包含基本信息、所属家庭、偏好设置等。
 */
export class UserEntity {

  /**
   * 根据用户ID获取完整用户信息
   * @param db D1数据库实例
   * @param id 用户ID
   * @returns 用户信息或null（如果不存在）
   */
  static async get(db: D1Database, id: string): Promise<User | null> {
    const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
    if (!row) return null;

    // 查询用户所属的所有家庭ID
    const { results: families } = await db.prepare(
      "SELECT id FROM families WHERE members LIKE ?"
    ).bind(`%${id}%`).all();
    const familyIds = families.map((f: any) => f.id);

    return {
      ...row,
      activeFamilyId: row.active_family_id,
      familyIds,
      preferences: JSON.parse(row.preferences)
    };
  }

  /**
   * 根据邮箱查找用户
   * @param db D1数据库实例
   * @param email 用户邮箱
   * @returns 用户信息或null（如果不存在）
   */
  static async findByEmail(db: D1Database, email: string): Promise<User | null> {
    const row = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<any>();
    if (!row) return null;
    return this.get(db, row.id);
  }

  /**
   * 插入或更新用户信息
   * @param db D1数据库实例
   * @param user 用户数据（包含可选的email和password字段）
   */
  static async upsert(db: D1Database, user: User & { email?: string; password?: string }): Promise<void> {
    await db.prepare(`
      INSERT INTO users (id, name, email, password, active_family_id, preferences)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        active_family_id=excluded.active_family_id,
        preferences=excluded.preferences
    `).bind(
      user.id,
      user.name,
      user.email || null,
      user.password || null,
      user.activeFamilyId || null,
      JSON.stringify(user.preferences)
    ).run();
  }

  /**
   * 更新用户的活跃家庭
   * @param db D1数据库实例
   * @param userId 用户ID
   * @param familyId 家庭ID
   */
  static async updateActiveFamily(db: D1Database, userId: string, familyId: string): Promise<void> {
    await db.prepare("UPDATE users SET active_family_id = ? WHERE id = ?").bind(familyId, userId).run();
  }
}

/**
 * 家庭实体类
 *
 * 负责家庭数据的管理，包括家庭创建、邀请码验证、成员管理等。
 * 家庭是多用户协作的核心单位。
 */
export class FamilyEntity {

  /**
   * 创建新家庭
   * @param db D1数据库实例
   * @param family 家庭数据
   */
  static async create(db: D1Database, family: Family): Promise<void> {
    await db.prepare(
      "INSERT INTO families (id, name, invite_code, members) VALUES (?, ?, ?, ?)"
    ).bind(family.id, family.name, family.inviteCode, JSON.stringify(family.members)).run();
  }

  /**
   * 根据邀请码查找家庭
   * @param db D1数据库实例
   * @param code 邀请码（自动转换为大写）
   * @returns 家庭信息或null（如果不存在）
   */
  static async getByInviteCode(db: D1Database, code: string): Promise<Family | null> {
    const row = await db.prepare("SELECT * FROM families WHERE invite_code = ?").bind(code.toUpperCase()).first<any>();
    if (!row) return null;
    return { ...row, members: JSON.parse(row.members) };
  }

  /**
   * 用户加入家庭
   * @param db D1数据库实例
   * @param familyId 家庭ID
   * @param userId 用户ID
   * @throws 当家庭不存在时抛出错误
   */
  static async join(db: D1Database, familyId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("User ID is required");

    const family = await db.prepare("SELECT * FROM families WHERE id = ?").bind(familyId).first<any>();
    if (!family) throw new Error("Family not found");

    const members = JSON.parse(family.members);
    if (!members.includes(userId)) {
      members.push(userId);
      await db.prepare("UPDATE families SET members = ? WHERE id = ?").bind(JSON.stringify(members), familyId).run();
    }

    // 自动将该家庭设为用户的活跃家庭
    await UserEntity.updateActiveFamily(db, userId, familyId);
  }

  /**
   * 用户离开家庭
   * @param db D1数据库实例
   * @param familyId 家庭ID
   * @param userId 用户ID
   */
  static async leave(db: D1Database, familyId: string, userId: string): Promise<void> {
    const family = await db.prepare("SELECT * FROM families WHERE id = ?").bind(familyId).first<any>();
    if (!family) return;

    let members = JSON.parse(family.members);
    members = members.filter((m: string) => m !== userId);

    if (members.length === 0) {
      await db.prepare("UPDATE families SET members = ? WHERE id = ?").bind(JSON.stringify([]), familyId).run();
    } else {
      await db.prepare("UPDATE families SET members = ? WHERE id = ?").bind(JSON.stringify(members), familyId).run();
    }

    // 如果离开的是活跃家庭，自动切换到其他家庭
    const user = await UserEntity.get(db, userId);
    if (user && user.activeFamilyId === familyId) {
      const remaining = user.familyIds.filter(id => id !== familyId);
      const nextActive = remaining.length > 0 ? remaining[0] : null;
      await UserEntity.updateActiveFamily(db, userId, nextActive || "");
    }
  }
}

/**
 * 联系人实体类
 *
 * 负责家庭联系人数据的管理，包括创建、更新、删除、搜索等操作。
 * 联系人是人情记录中涉及的人员信息。
 */
export class ContactEntity {

  /**
   * 创建新联系人
   * @param db D1数据库实例
   * @param contact 联系人数据
   */
  static async create(db: D1Database, contact: Contact): Promise<void> {
    await db.prepare(
      "INSERT INTO contacts (id, family_id, name, remarks, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(contact.id, contact.familyId, contact.name, contact.remarks || null, contact.updatedAt).run();
  }

  /**
   * 更新联系人信息
   * @param db D1数据库实例
   * @param id 联系人ID
   * @param contact 部分联系人数据
   */
  static async update(db: D1Database, id: string, contact: Partial<Contact>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (contact.name) { fields.push("name = ?"); values.push(contact.name); }
    if (contact.remarks !== undefined) { fields.push("remarks = ?"); values.push(contact.remarks); }

    fields.push("updated_at = ?"); values.push(Date.now());
    values.push(id);

    await db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  }

  /**
   * 删除联系人
   * @param db D1数据库实例
   * @param id 联系人ID
   */
  static async delete(db: D1Database, id: string): Promise<void> {
    await db.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();
  }

  /**
   * 获取家庭的所有联系人
   * @param db D1数据库实例
   * @param familyId 家庭ID
   * @returns 联系人列表（按姓名排序）
   */
  static async list(db: D1Database, familyId: string): Promise<Contact[]> {
    const { results } = await db.prepare("SELECT id, family_id as familyId, name, remarks, updated_at as updatedAt FROM contacts WHERE family_id = ? ORDER BY name ASC").bind(familyId).all();
    return (results as any[]) || [];
  }

  /**
   * 搜索家庭联系人
   * @param db D1数据库实例
   * @param familyId 家庭ID
   * @param q 搜索关键词（姓名模糊匹配）
   * @returns 匹配的联系人列表（按姓名排序）
   */
  static async search(db: D1Database, familyId: string, q: string): Promise<Contact[]> {
    const { results } = await db.prepare("SELECT id, family_id as familyId, name, remarks, updated_at as updatedAt FROM contacts WHERE family_id = ? AND name LIKE ? ORDER BY name ASC").bind(familyId, `%${q}%`).all();
    return (results as any[]) || [];
  }

  /**
   * 根据ID获取单个联系人详情
   * @param db D1数据库实例
   * @param id 联系人ID
   * @returns 联系人详情或null
   */
  static async getById(db: D1Database, id: string): Promise<Contact | null> {
    const result = await db.prepare("SELECT id, family_id as familyId, name, remarks, updated_at as updatedAt FROM contacts WHERE id = ?").bind(id).first();
    return result as Contact | null;
  }
}

/**
 * 账本实体类
 *
 * 负责账本数据的管理，包括创建、更新、删除和统计更新等操作。
 * 账本是人情记录的集合单位，用于组织和统计相关记录。
 */
export class LedgerEntity {

  /**
   * 创建新账本
   * @param db D1数据库实例
   * @param ledger 账本数据（包含updatedAt字段）
   */
  static async create(db: D1Database, ledger: Ledger & { updatedAt: number }): Promise<void> {
    await db.prepare(
      "INSERT INTO ledgers (id, family_id, title, date, description, total_given, total_received, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(ledger.id, ledger.familyId, ledger.title, ledger.date, ledger.description || null, ledger.totalGiven, ledger.totalReceived, ledger.updatedAt).run();
  }

  /**
   * 更新账本信息
   * @param db D1数据库实例
   * @param id 账本ID
   * @param data 部分账本数据
   */
  static async update(db: D1Database, id: string, data: Partial<Ledger>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title) { fields.push("title = ?"); values.push(data.title); }
    if (data.date) { fields.push("date = ?"); values.push(data.date); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }

    fields.push("updated_at = ?"); values.push(Date.now());
    values.push(id);

    await db.prepare(`UPDATE ledgers SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  }

  /**
   * 删除账本
   * @param db D1数据库实例
   * @param id 账本ID
   */
  static async delete(db: D1Database, id: string): Promise<void> {
    await db.prepare("DELETE FROM ledgers WHERE id = ?").bind(id).run();
  }

  /**
   * 更新账本统计金额
   * @param db D1数据库实例
   * @param id 账本ID
   * @param amount 金额变化值
   * @param type 金额类型（'give'支出或'receive'收入）
   */
  static async updateTotals(db: D1Database, id: string, amount: number, type: 'give' | 'receive'): Promise<void> {
    const field = type === 'give' ? 'total_given' : 'total_received';
    await db.prepare(`UPDATE ledgers SET ${field} = ${field} + ?, updated_at = ? WHERE id = ?`).bind(amount, Date.now(), id).run();
  }
}

/**
 * 人情记录实体类
 *
 * 负责人情记录数据的管理，这是系统的核心数据实体。
 * 记录包含人情往来的详细信息，如金额、人员、事件类型等。
 */
export class RecordEntity {

  /**
   * 根据ID获取单条记录
   * @param db D1数据库实例
   * @param id 记录ID
   * @returns 记录数据或null（如果不存在）
   */
  static async get(db: D1Database, id: string): Promise<RenqingRecord | null> {
    const row = await db.prepare(`SELECT id, family_id as familyId, ledger_id as ledgerId, contact_id as contactId, type, amount, person_name as personName, event_type as eventType, description, timestamp FROM records WHERE id = ?`).bind(id).first<any>();
    return row || null;
  }

  /**
   * 创建新记录
   * @param db D1数据库实例
   * @param record 记录数据（包含updatedAt字段）
   */
  static async create(db: D1Database, record: RenqingRecord & { updatedAt: number }): Promise<void> {
    await db.prepare(
      "INSERT INTO records (id, family_id, ledger_id, contact_id, type, amount, person_name, event_type, description, timestamp, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      record.id,
      record.familyId,
      record.ledgerId || null,
      record.contactId || null,
      record.type,
      record.amount,
      record.personName,
      record.eventType,
      record.description || null,
      record.timestamp,
      record.updatedAt
    ).run();
  }

  /**
   * 更新记录信息
   * @param db D1数据库实例
   * @param id 记录ID
   * @param data 部分记录数据
   */
  static async update(db: D1Database, id: string, data: Partial<RenqingRecord>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.type) { fields.push("type = ?"); values.push(data.type); }
    if (data.amount !== undefined) { fields.push("amount = ?"); values.push(data.amount); }
    if (data.personName) { fields.push("person_name = ?"); values.push(data.personName); }
    if (data.eventType) { fields.push("event_type = ?"); values.push(data.eventType); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
    if (data.ledgerId !== undefined) { fields.push("ledger_id = ?"); values.push(data.ledgerId); }
    if (data.contactId !== undefined) { fields.push("contact_id = ?"); values.push(data.contactId); }

    fields.push("updated_at = ?"); values.push(Date.now());
    values.push(id);

    await db.prepare(`UPDATE records SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  }

  /**
   * 删除记录
   * @param db D1数据库实例
   * @param id 记录ID
   */
  static async delete(db: D1Database, id: string): Promise<void> {
    await db.prepare("DELETE FROM records WHERE id = ?").bind(id).run();
  }
}

/**
 * 反馈实体类
 *
 * 负责用户反馈数据的创建，用于收集用户意见和建议。
 */
export class FeedbackEntity {

  /**
   * 创建反馈记录
   * @param db D1数据库实例
   * @param feedback 反馈数据
   */
  static async create(db: D1Database, feedback: Feedback): Promise<void> {
    await db.prepare(
      "INSERT INTO feedback (id, user_id, family_id, message, timestamp) VALUES (?, ?, ?, ?, ?)"
    ).bind(feedback.id, feedback.userId, feedback.familyId || null, feedback.message, feedback.timestamp).run();
  }
}