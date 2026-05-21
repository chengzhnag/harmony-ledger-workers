import { Hono } from 'hono';
import { Env, ok, bad } from './d1-utils';
import { ContactEntity, LedgerEntity, RecordEntity } from './entities';

/**
 * AI 路由模块：
 * - 语音转文本
 * - 自然语言解析为 CRUD 指令
 * - 执行 contacts / ledgers / records 表的增删改操作
 */
type SupportedTable = 'contacts' | 'ledgers' | 'records';
type SupportedCrudOp = 'create' | 'update' | 'delete';
interface CrudAction {
  table: SupportedTable;
  operation: SupportedCrudOp;
  id?: string;
  data: Record<string, unknown>;
}

/**
 * 将 ArrayBuffer 转成 Base64 字符串，供 AI 音频接口使用。
 */
const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

/**
 * 从外部 URL 下载音频并转换为 Base64。
 */
const fetchAudioAsBase64 = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio from ${url}: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  return arrayBufferToBase64(buffer);
};

/**
 * 语音转文本封装，优先直接使用 Base64，否则从 URL 下载音频。
 * 默认中文识别。
 */
const transcribeAudio = async (ai: any, payload: { audioUrl?: string; audioBase64?: string; language?: string }) => {
  const audioBase64 = payload.audioBase64 || (payload.audioUrl ? await fetchAudioAsBase64(payload.audioUrl) : undefined);
  if (!audioBase64) throw new Error('audioUrl or audioBase64 is required');
  return await ai.run('@cf/openai/whisper-large-v3-turbo', {
    audio: audioBase64,
    language: payload.language || 'zh',
  });
};

/**
 * 将可能的数值字符串标准化为 number。
 */
const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * 将日期字符串或数字字段标准化为时间戳。
 */
const normalizeDateValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};

/**
 * 将可能的操作类型（中文/英文）映射为 give/receive。
 */
const normalizeType = (value: unknown): 'give' | 'receive' | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('收') || normalized.includes('receive') || normalized.includes('income') || normalized.includes('in')) return 'receive';
  if (normalized.includes('送') || normalized.includes('给') || normalized.includes('pay') || normalized.includes('give') || normalized.includes('expense') || normalized.includes('out')) return 'give';
  return undefined;
};

/**
 * 从 AI 返回值中提取文本内容，兼容不同响应结构。
 */
const extractTextFromAiResponse = (response: unknown): string => {
  if (typeof response === 'string') return response;
  const anyResponse = response as any;
  if (Array.isArray(anyResponse?.output)) {
    for (const item of anyResponse.output) {
      if (typeof item === 'string') return item;
      if (item?.content) {
        if (typeof item.content === 'string') return item.content;
        if (Array.isArray(item.content)) {
          for (const sub of item.content) {
            if (typeof sub === 'string') return sub;
            if (sub?.text) return sub.text;
          }
        }
      }
    }
  }
  if (anyResponse?.output?.[0]?.content) {
    const content = anyResponse.output[0].content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'string') return item;
        if (item?.text) return item.text;
      }
    }
  }
  return JSON.stringify(response);
};

/**
 * 将自然语言指令交给 Qwen 模型解析为 CRUD 动作。
 * 支持 7 个操作：
 *   contacts: create, update, delete
 *   ledgers: create, update, delete
 *   records: create
 */
const parseCrudActions = async (ai: Ai, instruction: string): Promise<CrudAction[]> => {
  const systemPrompt = `你是一个严格的解析器。将用户自然语言指令转成 JSON 数组，仅支持以下操作：

【支持的操作】
1. contacts create: 新增联系人
2. contacts update: 编辑联系人（通过 name 标识现有联系人）
3. contacts delete: 删除联系人（通过 name 标识）
4. ledgers create: 新增账本
5. ledgers update: 编辑账本（通过 title 标识现有账本）
6. ledgers delete: 删除账本（通过 title 标识）
7. records create: 新增记录（可指定账本标题或创建不关联账本的记录）

【输出格式】
只输出合法的 JSON 数组，不要附带任何额外说明。格式如下：
[
  {
    "table": "contacts" | "ledgers" | "records",
    "operation": "create" | "update" | "delete",
    "data": { ... }
  }
]

【字段规范】
contacts create: { name, remarks? }
contacts update: { name, newName?, remarks? }（name 用来匹配要编辑的联系人，newName 用来更新联系人名称）
contacts delete: { name }（name 用来匹配要删除的联系人）

ledgers create: { title, date?, description? }
ledgers update: { title, newTitle?, date?, description? }（title 用来匹配要编辑的账本，newTitle 用来更新账本标题，支持编辑 date 和 description）
ledgers delete: { title }（title 用来匹配要删除的账本）

records create: { type, amount, personName, eventType, ledgerTitle?, description?, timestamp? }
- type: "give" 或 "receive"
- amount: 数字
- personName: 人名
- eventType: 类别（如 "wedding", "birthday" 等）
- ledgerTitle: 可选，指定账本标题；不提供则创建不关联账本的记录
- timestamp: 可选，日期字符串或时间戳

【重点】
- 不要生成 id 字段，后端会自动处理名称匹配
- 不支持 records update/delete，也不支持其他表操作
- 如果无法映射，输出空数组 []
`;

  const response = await ai.run('@cf/qwen/qwen3-30b-a3b-fp8', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: instruction },
    ],
    max_tokens: 12048,
  });

  // 优先从 `response.choices[0].message.content` 提取模型返回的文本（Qwen 风格），
  // 该字段可能是字符串或一个包含文本字段的对象；若不存在则退回到通用提取器。
  let contentStr: string | undefined;
  const maybeContent = (response as any)?.choices?.[0]?.message?.content;
  if (typeof maybeContent === 'string') {
    contentStr = maybeContent;
  } else if (maybeContent && typeof maybeContent === 'object') {
    if (typeof maybeContent.text === 'string') contentStr = maybeContent.text;
    else contentStr = JSON.stringify(maybeContent);
  }

  if (!contentStr) {
    contentStr = extractTextFromAiResponse(response);
  }

  const jsonMatch = contentStr.match(/\[.*\]/s);
  if (!jsonMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const normalizeString = (value: unknown) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const rawActions = parsed as any[];
  const normalizedActions: CrudAction[] = [];
  for (const rawAction of rawActions) {
    if (!rawAction || typeof rawAction !== 'object') continue;
    const table = normalizeString(rawAction.table)?.toLowerCase();
    const operation = normalizeString(rawAction.operation)?.toLowerCase();
    if (!table || !operation) continue;

    // 只允许这 7 个操作
    const isValid =
      (table === 'contacts' && ['create', 'update', 'delete'].includes(operation)) ||
      (table === 'ledgers' && ['create', 'update', 'delete'].includes(operation)) ||
      (table === 'records' && operation === 'create');

    if (!isValid) continue;

    const dataSource = rawAction.data && typeof rawAction.data === 'object' ? rawAction.data : rawAction;
    const data: Record<string, unknown> = {};

    const setField = (key: string, value: unknown) => {
      if (value === undefined || value === null) return;
      data[key] = value;
    };

    const safeString = (key: string, sourceKey?: string) => {
      const value = dataSource[sourceKey ?? key];
      const text = normalizeString(value);
      if (text) setField(key, text);
    };

    const safeNumber = (key: string, sourceKey?: string) => {
      const numeric = normalizeNumber(dataSource[sourceKey ?? key]);
      if (numeric !== undefined) setField(key, numeric);
    };

    if (table === 'contacts') {
      if (operation === 'create') {
        safeString('name');
        safeString('remarks');
      } else if (operation === 'update') {
        // 必须有 name 来标识要更新的联系人，newName 用于更新名称
        safeString('name');
        safeString('newName');
        safeString('remarks');
      } else if (operation === 'delete') {
        // 必须有 name 来标识要删除的联系人
        safeString('name');
      }
    }

    if (table === 'ledgers') {
      if (operation === 'create') {
        safeString('title');
        const dateValue = normalizeDateValue(dataSource.date ?? dataSource.createdAt ?? dataSource.time);
        if (dateValue !== undefined) setField('date', dateValue);
        safeString('description');
      } else if (operation === 'update') {
        // 必须有 title 来标识要更新的账本，newTitle 用于更新账本标题
        safeString('title');
        safeString('newTitle');
        const dateValue = normalizeDateValue(dataSource.date ?? dataSource.createdAt ?? dataSource.time);
        if (dateValue !== undefined) setField('date', dateValue);
        safeString('description');
      } else if (operation === 'delete') {
        // 必须有 title 来标识要删除的账本
        safeString('title');
      }
    }

    if (table === 'records' && operation === 'create') {
      const type = normalizeType(dataSource.type ?? dataSource.recordType ?? dataSource.action);
      if (type) setField('type', type);
      safeNumber('amount');
      safeString('personName');
      safeString('eventType');
      safeString('ledgerTitle'); // 可选，不提供则创建不关联账本的记录
      safeString('description');
      const timestampValue = normalizeDateValue(dataSource.timestamp ?? dataSource.date ?? dataSource.time);
      if (timestampValue !== undefined) setField('timestamp', timestampValue);
    }

    normalizedActions.push({
      table: table as SupportedTable,
      operation: operation as SupportedCrudOp,
      data,
    });
  }

  return normalizedActions;
};

/**
 * 根据家庭 ID 与联系人名称查找联系人 ID。
 */
const resolveContactIdByName = async (c: any, familyId: string, name: string): Promise<string | null> => {
  const row = await c.env.DB.prepare('SELECT id FROM contacts WHERE family_id = ? AND name = ?').bind(familyId, name).first() as any;
  return row?.id || null;
};

/**
 * 根据家庭 ID 与联系人名称查找所有匹配的联系人。
 */
const resolveContactCandidatesByName = async (c: any, familyId: string, name: string) => {
  const rows = await c.env.DB.prepare('SELECT id, name, remarks FROM contacts WHERE family_id = ? AND name = ?').bind(familyId, name).all() as any;
  return rows.results || [];
};

/**
 * 根据家庭 ID 与账本标题查找账本 ID。
 */
const resolveLedgerIdByTitle = async (c: any, familyId: string, title: string): Promise<string | null> => {
  const row = await c.env.DB.prepare('SELECT id FROM ledgers WHERE family_id = ? AND title = ?').bind(familyId, title).first() as any;
  return row?.id || null;
};

/**
 * 根据家庭 ID 与账本标题查找所有匹配的账本。
 */
const resolveLedgerCandidatesByTitle = async (c: any, familyId: string, title: string) => {
  const rows = await c.env.DB.prepare('SELECT id, title, date, description FROM ledgers WHERE family_id = ? AND title = ?').bind(familyId, title).all() as any;
  return rows.results || [];
};

/**
 * 执行单个 CRUD 动作，仅支持 7 个操作：
 * - contacts: create, update, delete
 * - ledgers: create, update, delete
 * - records: create
 */
const executeCrudAction = async (c: any, action: CrudAction, familyId: string) => {
  const table = action.table;
  const op = action.operation;
  const data = { ...action.data };

  if (table === 'contacts') {
    if (op === 'create') {
      const name = typeof data.name === 'string' ? data.name : undefined;
      if (!name) throw new Error('Contact name is required for create');
      const id = crypto.randomUUID();
      await ContactEntity.create(c.env.DB, {
        id,
        familyId,
        name,
        remarks: typeof data.remarks === 'string' ? data.remarks : undefined,
        updatedAt: Date.now(),
      } as any);
      return { id, table, operation: op };
    }

    if (op === 'update') {
      const name = typeof data.name === 'string' ? data.name : undefined;
      if (!name) throw new Error('Contact name is required to identify which contact to update');
      // 通过 name 查询联系人 ID
      const id = await resolveContactIdByName(c, familyId, name);
      if (!id) throw new Error(`Contact with name "${name}" not found`);

      const newName = typeof data.newName === 'string' ? data.newName : undefined;
      await ContactEntity.update(c.env.DB, id, {
        name: newName ?? name,
        remarks: typeof data.remarks === 'string' ? data.remarks : undefined,
      });
      return { id, table, operation: op };
    }

    if (op === 'delete') {
      const name = typeof data.name === 'string' ? data.name : undefined;
      if (!name) throw new Error('Contact name is required to identify which contact to delete');
      // 通过 name 查询联系人 ID
      const id = await resolveContactIdByName(c, familyId, name);
      if (!id) throw new Error(`Contact with name "${name}" not found`);
      
      const contact = await ContactEntity.getById(c.env.DB, id);
      if (!contact || contact.familyId !== familyId) throw new Error('Contact not found or family mismatch');
      await ContactEntity.delete(c.env.DB, id);
      return { id, table, operation: op };
    }
  }

  if (table === 'ledgers') {
    if (op === 'create') {
      const title = typeof data.title === 'string' ? data.title : undefined;
      if (!title) throw new Error('Ledger title is required for create');
      const id = crypto.randomUUID();
      await LedgerEntity.create(c.env.DB, {
        id,
        familyId,
        title,
        date: normalizeDateValue(data.date) ?? Date.now(),
        description: typeof data.description === 'string' ? data.description : undefined,
        totalGiven: 0,
        totalReceived: 0,
        updatedAt: Date.now(),
      } as any);
      return { id, table, operation: op };
    }

    if (op === 'update') {
      const title = typeof data.title === 'string' ? data.title : undefined;
      if (!title) throw new Error('Ledger title is required to identify which ledger to update');
      // 通过 title 查询账本 ID
      const id = await resolveLedgerIdByTitle(c, familyId, title);
      if (!id) throw new Error(`Ledger with title "${title}" not found`);

      const newTitle = typeof data.newTitle === 'string' ? data.newTitle : undefined;
      await LedgerEntity.update(c.env.DB, id, {
        title: newTitle ?? title,
        date: normalizeDateValue(data.date),
        description: typeof data.description === 'string' ? data.description : undefined,
      });
      return { id, table, operation: op };
    }

    if (op === 'delete') {
      const title = typeof data.title === 'string' ? data.title : undefined;
      if (!title) throw new Error('Ledger title is required to identify which ledger to delete');
      // 通过 title 查询账本 ID
      const id = await resolveLedgerIdByTitle(c, familyId, title);
      if (!id) throw new Error(`Ledger with title "${title}" not found`);

      const row = await c.env.DB.prepare('SELECT family_id FROM ledgers WHERE id = ?').bind(id).first() as any;
      if (!row || row.family_id !== familyId) throw new Error('Ledger not found or family mismatch');
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM records WHERE ledger_id = ?').bind(id),
        c.env.DB.prepare('DELETE FROM ledgers WHERE id = ?').bind(id),
      ]);
      return { id, table, operation: op };
    }
  }

  if (table === 'records') {
    if (op === 'create') {
      const type = normalizeType(data.type);
      const amount = normalizeNumber(data.amount);
      const personName = typeof data.personName === 'string' ? data.personName : undefined;
      const eventType = typeof data.eventType === 'string' ? data.eventType : undefined;
      if (!type || amount === undefined || !personName || !eventType) {
        throw new Error('Record create requires: type, amount, personName, eventType');
      }

      // ledgerTitle 是可选的；如果提供，需要查询对应的 ledger_id
      let ledgerId: string | null = null;
      if (typeof data.ledgerTitle === 'string') {
        ledgerId = await resolveLedgerIdByTitle(c, familyId, data.ledgerTitle);
        if (!ledgerId) throw new Error(`Ledger with title "${data.ledgerTitle}" not found`);
      }

      const id = crypto.randomUUID();
      await RecordEntity.create(c.env.DB, {
        id,
        familyId,
        ledgerId,
        contactId: null, // records create 不支持通过 contactName 创建
        type,
        amount,
        personName,
        eventType,
        description: typeof data.description === 'string' ? data.description : undefined,
        timestamp: normalizeDateValue(data.timestamp) ?? Date.now(),
        updatedAt: Date.now(),
      } as any);

      if (ledgerId) await recalculateLedgerTotals(c.env.DB, ledgerId);
      return { id, table, operation: op };
    }

    // records 不支持 update/delete
    throw new Error(`Operation "${op}" is not supported for records`);
  }

  throw new Error('Unsupported action');
};

/**
 * 解析自然语言指令为动作，并对结果做一次白名单过滤。
 */
const parseTextToActions = async (ai: any, text: string) => {
  const actions = await parseCrudActions(ai, text);
  return actions.filter((action) => action.table === 'contacts' || action.table === 'ledgers' || action.table === 'records');
};

/**
 * 重新计算指定账本的收支统计，并更新 ledgers 表。
 */
const recalculateLedgerTotals = async (db: any, ledgerId: string) => {
  const totals = await db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'give' THEN amount ELSE 0 END) as totalGiven,
      SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END) as totalReceived
    FROM records
    WHERE ledger_id = ?
  `).bind(ledgerId).first() as any;
  await db.prepare(`
    UPDATE ledgers
    SET total_given = ?, total_received = ?, updated_at = ?
    WHERE id = ?
  `).bind(totals?.totalGiven || 0, totals?.totalReceived || 0, Date.now(), ledgerId).run();
};

/**
 * 注册 AI 相关 API 路由。
 */
export function aiRoutes(app: Hono<{ Bindings: Env }>) {
  app.post('/api/ai/transcribe', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const { audioUrl, audioBase64, language } = await c.req.json<{
      audioUrl?: string;
      audioBase64?: string;
      language?: string;
    }>();

    if (!audioUrl && !audioBase64) return bad(c, 'audioUrl or audioBase64 is required');

    try {
      const aiResponse = await transcribeAudio(c.env.AI, { audioUrl, audioBase64, language });
      return ok(c, aiResponse);
    } catch (error) {
      console.error('[AI Transcribe] Failed:', error);
      return bad(c, 'AI transcription failed');
    }
  });

  /**
   * POST /api/ai/execute
   * 将语音或文本指令解析成 CRUD 动作并执行。
   */
  app.post('/api/ai/execute', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      text?: string;
      audioUrl?: string;
      audioBase64?: string;
      language?: string;
      familyId?: string;
    }>();

    const familyId = body.familyId;
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权操作该家庭');

    let instruction = body.text?.trim();
    if (!instruction && (body.audioUrl || body.audioBase64)) {
      try {
        const transcribeResult = await transcribeAudio(c.env.AI, {
          audioUrl: body.audioUrl,
          audioBase64: body.audioBase64,
          language: body.language || 'zh',
        });
        instruction = transcribeResult.text;
      } catch (error) {
        console.error('[AI Execute] Transcription failed:', error);
        return bad(c, 'Failed to transcribe audio');
      }
    }

    if (!instruction) return bad(c, 'text or audio is required');

    try {
      const actions = await parseTextToActions(c.env.AI, instruction);
      const results: any[] = [];
      for (const action of actions) {
        try {
          // 对于名字或标题匹配的 update/delete 操作，先检查是否存在多条匹配结果
          if ((action.table === 'contacts' || action.table === 'ledgers') && (action.operation === 'update' || action.operation === 'delete') && !action.id) {
            if (action.table === 'contacts' && typeof action.data.name === 'string') {
              const candidates = await resolveContactCandidatesByName(c, familyId, action.data.name);
              if (candidates.length === 0) {
                throw new Error(`Contact with name "${action.data.name}" not found`);
              }
              if (candidates.length > 1) {
                results.push({
                  action,
                  success: false,
                  ambiguous: true,
                  candidates,
                });
                continue;
              }
              action.id = candidates[0].id;
            }
            if (action.table === 'ledgers' && typeof action.data.title === 'string') {
              const candidates = await resolveLedgerCandidatesByTitle(c, familyId, action.data.title);
              if (candidates.length === 0) {
                throw new Error(`Ledger with title "${action.data.title}" not found`);
              }
              if (candidates.length > 1) {
                results.push({
                  action,
                  success: false,
                  ambiguous: true,
                  candidates,
                });
                continue;
              }
              action.id = candidates[0].id;
            }
          }

          const executed = await executeCrudAction(c, action, familyId);
          results.push({ action, success: true, result: executed });
        } catch (error) {
          results.push({ action, success: false, error: String(error) });
        }
      }
      return ok(c, {
        baseActions: actions,
        instruction,
        actions: results,
      });
    } catch (error) {
      console.error('[AI Execute] Failed:', error);
      return bad(c, `Failed to parse or execute CRUD actions: ${String(error)}`);
    }
  });

  app.post('/api/ai/confirm', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      familyId?: string;
      action?: CrudAction;
      confirmedId?: string;
      actions?: Array<{ action: CrudAction; confirmedId: string }>;
    }>();

    const familyId = body.familyId;
    if (!familyId) return bad(c, 'familyId required');
    if (!user.familyIds.includes(familyId)) return bad(c, '无权操作该家庭');

    const pendingActions = body.actions?.length
      ? body.actions
      : body.action && body.confirmedId
      ? [{ action: body.action, confirmedId: body.confirmedId }]
      : [];

    if (!pendingActions.length) return bad(c, 'action(s) and confirmedId(s) required');

    const results = [];
    for (const item of pendingActions) {
      const action = { ...item.action };
      const confirmedId = item.confirmedId;
      if (!confirmedId) {
        results.push({ action, success: false, error: 'confirmedId required' });
        continue;
      }
      action.id = confirmedId;

      try {
        const executed = await executeCrudAction(c, action, familyId);
        results.push({ action, success: true, result: executed });
      } catch (error) {
        results.push({ action, success: false, error: String(error) });
      }
    }

    return ok(c, {
      success: true,
      results,
    });
  });
}
