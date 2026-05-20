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
 * 仅允许 contacts / ledgers / records 三个表。
 */
const parseCrudActions = async (ai: Ai, instruction: string): Promise<CrudAction[]> => {
  const systemPrompt = `你是一个严格的解析器。请将用户自然语言指令转成一个仅包含 CRUD 操作的 JSON 数组。
只允许操作这三个表：contacts、ledgers、records。
只允许使用这三种操作：create、update、delete。
只能输出合法的 JSON 数组文本，不要附带任何额外说明。
动作格式如下：
[
  {
    "table": "contacts" | "ledgers" | "records",
    "operation": "create" | "update" | "delete",
    "id": "...",          // update/delete 必需
    "data": { ... }        // create 必需，update 可选
  }
]
允许字段：
- contacts: familyId, name, remarks
- ledgers: familyId, title, date, description
- records: familyId, ledgerId, contactId, contactName, ledgerTitle, type, amount, personName, eventType, description, timestamp
如果指令中提到已存在的联系人或账本名称，可以使用 contactName 或 ledgerTitle 来匹配。
如果无法映射到这三个表或这些操作，输出一个空数组。
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
    if (!['contacts', 'ledgers', 'records'].includes(table)) continue;
    if (!['create', 'update', 'delete'].includes(operation)) continue;

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
      safeString('familyId');
      safeString('name');
      safeString('remarks');
    }
    if (table === 'ledgers') {
      safeString('familyId');
      safeString('title');
      const dateValue = normalizeDateValue(dataSource.date ?? dataSource.createdAt ?? dataSource.time);
      if (dateValue !== undefined) setField('date', dateValue);
      safeString('description');
    }
    if (table === 'records') {
      safeString('familyId');
      safeString('ledgerId');
      safeString('contactId');
      safeString('contactName');
      safeString('ledgerTitle');
      const type = normalizeType(dataSource.type ?? dataSource.recordType ?? dataSource.action);
      if (type) setField('type', type);
      safeNumber('amount');
      safeString('personName');
      safeString('eventType');
      safeString('description');
      const timestampValue = normalizeDateValue(dataSource.timestamp ?? dataSource.date ?? dataSource.time);
      if (timestampValue !== undefined) setField('timestamp', timestampValue);
    }

    normalizedActions.push({
      table: table as SupportedTable,
      operation: operation as SupportedCrudOp,
      id: rawAction.id !== undefined ? String(rawAction.id) : undefined,
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
 * 根据家庭 ID 与账本标题查找账本 ID。
 */
const resolveLedgerIdByTitle = async (c: any, familyId: string, title: string): Promise<string | null> => {
  const row = await c.env.DB.prepare('SELECT id FROM ledgers WHERE family_id = ? AND title = ?').bind(familyId, title).first() as any;
  return row?.id || null;
};

/**
 * 执行单个 CRUD 动作，支持 contacts / ledgers / records。
 */
const executeCrudAction = async (c: any, action: CrudAction, familyId: string) => {
  const table = action.table;
  const op = action.operation;
  const data = { ...action.data };
  if (op === 'create') {
    data.familyId = familyId;
  }

  const ensureIdForUpdateDelete = async () => {
    if (action.id) return action.id;
    if (table === 'contacts' && typeof data.name === 'string') {
      const id = await resolveContactIdByName(c, familyId, data.name);
      if (!id) throw new Error('Unable to resolve contact id by name');
      return id;
    }
    if (table === 'ledgers' && typeof data.title === 'string') {
      const id = await resolveLedgerIdByTitle(c, familyId, data.title);
      if (!id) throw new Error('Unable to resolve ledger id by title');
      return id;
    }
    throw new Error('Missing id for update/delete action');
  };

  if (table === 'contacts') {
    if (op === 'create') {
      const name = typeof data.name === 'string' ? data.name : undefined;
      if (!name) throw new Error('Contact name is required');
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
      const id = await ensureIdForUpdateDelete();
      const contact = await ContactEntity.getById(c.env.DB, id);
      if (!contact || contact.familyId !== familyId) throw new Error('Contact not found or family mismatch');
      await ContactEntity.update(c.env.DB, id, {
        name: typeof data.name === 'string' ? data.name : undefined,
        remarks: data.remarks !== undefined ? String(data.remarks) : undefined,
      });
      return { id, table, operation: op };
    }
    if (op === 'delete') {
      const id = await ensureIdForUpdateDelete();
      const contact = await ContactEntity.getById(c.env.DB, id);
      if (!contact || contact.familyId !== familyId) throw new Error('Contact not found or family mismatch');
      await ContactEntity.delete(c.env.DB, id);
      return { id, table, operation: op };
    }
  }

  if (table === 'ledgers') {
    if (op === 'create') {
      const title = typeof data.title === 'string' ? data.title : undefined;
      if (!title) throw new Error('Ledger title is required');
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
      const id = await ensureIdForUpdateDelete();
      const row = await c.env.DB.prepare('SELECT family_id FROM ledgers WHERE id = ?').bind(id).first() as any;
      if (!row || row.family_id !== familyId) throw new Error('Ledger not found or family mismatch');
      await LedgerEntity.update(c.env.DB, id, {
        title: typeof data.title === 'string' ? data.title : undefined,
        date: normalizeDateValue(data.date),
        description: typeof data.description === 'string' ? data.description : undefined,
      });
      return { id, table, operation: op };
    }
    if (op === 'delete') {
      const id = await ensureIdForUpdateDelete();
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
        throw new Error('Record create requires type, amount, personName and eventType');
      }
      const ledgerId = typeof data.ledgerId === 'string' ? data.ledgerId : undefined;
      const contactId = typeof data.contactId === 'string'
        ? data.contactId
        : (typeof data.contactName === 'string' ? await resolveContactIdByName(c, familyId, data.contactName) : undefined);
      const id = crypto.randomUUID();
      await RecordEntity.create(c.env.DB, {
        id,
        familyId,
        ledgerId: ledgerId || null,
        contactId: contactId || null,
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
    if (op === 'update') {
      const id = action.id ?? await ensureIdForUpdateDelete();
      const existing = await RecordEntity.get(c.env.DB, id);
      if (!existing || existing.familyId !== familyId) throw new Error('Record not found or family mismatch');
      const ledgerId = typeof data.ledgerId === 'string' ? data.ledgerId : existing.ledgerId;
      const contactId = typeof data.contactId === 'string'
        ? data.contactId
        : (typeof data.contactName === 'string' ? await resolveContactIdByName(c, familyId, data.contactName) : existing.contactId);
      await RecordEntity.update(c.env.DB, id, {
        type: normalizeType(data.type) ?? existing.type,
        amount: normalizeNumber(data.amount) ?? existing.amount,
        personName: typeof data.personName === 'string' ? data.personName : existing.personName,
        eventType: typeof data.eventType === 'string' ? data.eventType : existing.eventType,
        description: data.description !== undefined ? String(data.description) : existing.description,
        ledgerId,
        contactId: contactId ?? undefined,
      });
      if (existing.ledgerId) await recalculateLedgerTotals(c.env.DB, existing.ledgerId);
      if (ledgerId && ledgerId !== existing.ledgerId) await recalculateLedgerTotals(c.env.DB, ledgerId);
      return { id, table, operation: op };
    }
    if (op === 'delete') {
      const id = action.id ?? await ensureIdForUpdateDelete();
      const existing = await RecordEntity.get(c.env.DB, id);
      if (!existing || existing.familyId !== familyId) throw new Error('Record not found or family mismatch');
      await RecordEntity.delete(c.env.DB, id);
      if (existing.ledgerId) await recalculateLedgerTotals(c.env.DB, existing.ledgerId);
      return { id, table, operation: op };
    }
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
}
