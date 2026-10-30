import type { AuthUser, Contact, Ledger, RenqingRecord } from '@shared/types';

const familyId = 'mock-family-1';
const mockUser: AuthUser = {
  id: 'mock-user-1',
  name: '测试用户',
  activeFamilyId: familyId,
  familyIds: [familyId],
  token: 'mock-token',
};

const fixedDate = new Date('2026-10-15T12:00:00.000Z').getTime();

const contactNames = [
  '王小明', '李小红', '张伟', '刘洋', '陈静', '杨帆', '赵敏', '黄磊', '周婷', '吴昊',
  '徐佳', '孙浩', '胡悦', '朱琳', '高远', '林晓', '何俊', '郭倩', '马超', '罗欣',
];
const contactRemarks = ['大学同学', '亲友', '同事', '邻居', '老朋友'];
const defaultContacts: Contact[] = contactNames.map((name, index) => ({
  id: `mock-contact-${index + 1}`,
  familyId,
  name,
  remarks: contactRemarks[index % contactRemarks.length],
  updatedAt: fixedDate - index * 3_600_000,
}));

const ledgerFixtures = [
  { id: 'mock-ledger-1', title: '小明婚礼', description: '婚礼亲友往来' },
  { id: 'mock-ledger-2', title: '新居乔迁', description: '乔迁礼金记录' },
  { id: 'mock-ledger-3', title: '生日宴会', description: '生日宴请往来' },
  { id: 'mock-ledger-4', title: '春节走亲', description: '节日礼尚往来' },
  { id: 'mock-ledger-5', title: '宝宝周岁', description: '周岁宴往来记录' },
];
const eventTypes = ['wedding', 'birthday', 'moving', 'festival', 'baby'] as const;

const defaultRecords: RenqingRecord[] = [
  {
    id: 'mock-record-1',
    familyId,
    ledgerId: 'mock-ledger-1',
    contactId: 'mock-contact-1',
    type: 'receive',
    amount: 3880,
    personName: '王小明',
    eventType: 'wedding',
    description: '婚礼礼金',
    timestamp: fixedDate,
  },
  {
    id: 'mock-record-2',
    familyId,
    ledgerId: 'mock-ledger-1',
    contactId: 'mock-contact-2',
    type: 'give',
    amount: 1200,
    personName: '李小红',
    eventType: 'birthday',
    description: '生日祝福',
    timestamp: fixedDate - 86_400_000,
  },
  ...Array.from({ length: 38 }, (_, index) => {
    const sequence = index + 3;
    const contact = defaultContacts[(sequence - 1) % defaultContacts.length];
    return {
      id: `mock-record-${sequence}`,
      familyId,
      ledgerId: `mock-ledger-${((sequence - 1) % ledgerFixtures.length) + 1}`,
      contactId: contact.id,
      type: (sequence % 2 === 0 ? 'receive' : 'give') as RenqingRecord['type'],
      amount: 500 + ((sequence * 173) % 3500),
      personName: contact.name,
      eventType: eventTypes[(sequence - 1) % eventTypes.length],
      description: `${contact.name}往来记录`,
      timestamp: fixedDate - (sequence - 1) * 86_400_000,
    };
  }),
];

const defaultLedgers: Ledger[] = ledgerFixtures.map((ledger, index) => {
  const ledgerId = ledger.id;
  const ledgerRecords = defaultRecords.filter((record) => record.ledgerId === ledgerId);
  return {
    ...ledger,
    familyId,
    date: fixedDate - index * 30 * 86_400_000,
    totalGiven: ledgerRecords.filter((record) => record.type === 'give').reduce((sum, record) => sum + record.amount, 0),
    totalReceived: ledgerRecords.filter((record) => record.type === 'receive').reduce((sum, record) => sum + record.amount, 0),
  };
});

type MockState = {
  records: RenqingRecord[];
  ledgers: Ledger[];
  contacts: Contact[];
};

let state: MockState | undefined;

function createState(): MockState {
  const isEmpty = new URLSearchParams(window.location.search).get('mock') === 'empty';
  return {
    records: isEmpty ? [] : structuredClone(defaultRecords),
    ledgers: isEmpty ? [] : structuredClone(defaultLedgers),
    contacts: isEmpty ? [] : structuredClone(defaultContacts),
  };
}

function getState(): MockState {
  state ??= createState();
  return state;
}

function readBody(init?: RequestInit): Record<string, any> {
  if (typeof init?.body !== 'string') return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.max(1, Number(url.searchParams.get('limit') || 20));
  const start = (page - 1) * limit;
  return {
    records: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
  };
}

function filterRecords(records: RenqingRecord[], url: URL): RenqingRecord[] {
  const ledgerId = url.searchParams.get('ledgerId');
  const query = url.searchParams.get('query')?.toLocaleLowerCase();
  return records.filter((record) =>
    (!ledgerId || record.ledgerId === ledgerId) &&
    (!query || `${record.personName} ${record.description || ''}`.toLocaleLowerCase().includes(query))
  );
}

export function isUrlMockEnabled(): boolean {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock');
}

export function getUrlMockUser(): AuthUser {
  return mockUser;
}

export function resetUrlMockState(): void {
  state = undefined;
}

export async function mockApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, window.location.origin);
  const method = (init?.method || 'GET').toUpperCase();
  const body = readBody(init);
  const mockState = getState();
  const { records, ledgers, contacts } = mockState;
  let result: unknown;

  if (url.pathname === '/api/stats/summary') {
    const totalReceived = records.filter((record) => record.type === 'receive').reduce((sum, record) => sum + record.amount, 0);
    const totalGiven = records.filter((record) => record.type === 'give').reduce((sum, record) => sum + record.amount, 0);
    result = { totalGiven, totalReceived, netBalance: totalReceived - totalGiven };
  } else if (url.pathname === '/api/stats/detailed') {
    const totalReceived = records.filter((record) => record.type === 'receive').reduce((sum, record) => sum + record.amount, 0);
    const totalGiven = records.filter((record) => record.type === 'give').reduce((sum, record) => sum + record.amount, 0);
    const monthlyTotals = records.reduce<Record<string, { receive: number; give: number }>>((totals, record) => {
      const month = new Date(record.timestamp).toISOString().slice(0, 7);
      totals[month] ??= { receive: 0, give: 0 };
      totals[month][record.type] += record.amount;
      return totals;
    }, {});
    const categoryTotals = records.reduce<Record<string, number>>((totals, record) => {
      totals[record.eventType] = (totals[record.eventType] || 0) + record.amount;
      return totals;
    }, {});
    result = {
      totalGiven,
      totalReceived,
      netBalance: totalReceived - totalGiven,
      maxAmount: Math.max(0, ...records.map((record) => record.amount)),
      topEventType: Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0],
      monthlyTrends: Object.entries(monthlyTotals).sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, ...values })),
      categoryDistribution: Object.entries(categoryTotals).map(([name, value]) => ({ name, value })),
    };
  } else if (url.pathname === '/api/records/timeline') {
    result = { ...paginate(filterRecords(records, url), url), records: filterRecords(records, url).map((record) => ({
      ...record,
      ledger: ledgers.find((ledger) => ledger.id === record.ledgerId),
    })) };
  } else if (url.pathname.startsWith('/api/records/by-contact/')) {
    const contactId = url.pathname.split('/').pop();
    result = records.filter((record) => record.contactId === contactId);
  } else if (url.pathname === '/api/records' && method === 'GET') {
    const filteredRecords = filterRecords(records, url);
    result = url.searchParams.has('page') ? paginate(filteredRecords, url) : filteredRecords.slice(0, Number(url.searchParams.get('limit') || filteredRecords.length));
  } else if (url.pathname === '/api/records' && method === 'POST') {
    const record = { ...body, id: `mock-record-${Date.now()}`, familyId: body.familyId || familyId, timestamp: body.timestamp || Date.now() } as RenqingRecord;
    records.unshift(record);
    result = record;
  } else if (url.pathname.startsWith('/api/records/')) {
    const id = url.pathname.split('/').pop();
    const index = records.findIndex((record) => record.id === id);
    if (method === 'DELETE') {
      if (index >= 0) records.splice(index, 1);
      result = { success: true };
    } else if (method === 'PATCH' && index >= 0) {
      records[index] = { ...records[index], ...body };
      result = records[index];
    }
  } else if (url.pathname === '/api/ledgers' && method === 'GET') {
    result = ledgers;
  } else if (url.pathname === '/api/ledgers' && method === 'POST') {
    const ledger = { ...body, id: `mock-ledger-${Date.now()}`, totalGiven: 0, totalReceived: 0 } as Ledger;
    ledgers.push(ledger);
    result = ledger;
  } else if (url.pathname.startsWith('/api/ledgers/')) {
    const id = url.pathname.split('/').pop();
    const index = ledgers.findIndex((ledger) => ledger.id === id);
    if (method === 'DELETE') {
      if (index >= 0) ledgers.splice(index, 1);
      result = { success: true };
    } else if ((method === 'PUT' || method === 'PATCH') && index >= 0) {
      ledgers[index] = { ...ledgers[index], ...body };
      result = ledgers[index];
    }
  } else if (url.pathname === '/api/contacts/search') {
    const query = (url.searchParams.get('q') || '').toLocaleLowerCase();
    result = contacts.filter((contact) => contact.name.toLocaleLowerCase().includes(query));
  } else if (url.pathname === '/api/contacts' && method === 'POST') {
    const contact = { ...body, id: `mock-contact-${Date.now()}`, familyId: body.familyId || familyId, updatedAt: Date.now() } as Contact;
    contacts.push(contact);
    result = contact;
  } else if (url.pathname.startsWith('/api/contacts/')) {
    const id = url.pathname.split('/').pop();
    const index = contacts.findIndex((contact) => contact.id === id);
    if (method === 'DELETE') {
      if (index >= 0) contacts.splice(index, 1);
      result = { success: true };
    } else if (method === 'PUT' && index >= 0) {
      contacts[index] = { ...contacts[index], ...body, updatedAt: Date.now() };
      result = contacts[index];
    } else if (method === 'GET') {
      result = contacts[index];
    }
  } else if (url.pathname === '/api/user/families') {
    result = [{ id: familyId, name: '测试家庭', inviteCode: 'MOCK2026', members: [mockUser.id] }];
  } else if (url.pathname === '/api/family/info') {
    result = { id: familyId, name: '测试家庭', inviteCode: 'MOCK2026', members: [{ id: mockUser.id, name: mockUser.name, isOwner: true }] };
  } else if (url.pathname.startsWith('/api/family/')) {
    result = mockUser;
  } else if (url.pathname === '/api/data/export') {
    result = { ledgers, records, contacts };
  } else if (url.pathname.startsWith('/api/data/')) {
    result = { createdCount: 0, success: true };
  } else if (url.pathname === '/api/user/login' || url.pathname === '/api/login') {
    result = mockUser;
  }

  if (result === undefined) {
    throw new Error(`[URL Mock] No fixture for ${method} ${url.pathname}`);
  }
  return result as T;
}