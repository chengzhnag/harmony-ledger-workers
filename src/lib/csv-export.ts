import Papa from 'papaparse';
import { format } from 'date-fns';
import { RenqingRecord } from '@shared/types';
import i18n from '@/i18n/config';
export function exportToCsv(records: RenqingRecord[]) {
  const isZh = i18n.language === 'zh';
  const data = records.map(r => ({
    [isZh ? '日期' : 'Date']: format(r.timestamp, 'yyyy-MM-dd HH:mm'),
    [isZh ? '往来对象' : 'Contact']: r.personName,
    [isZh ? '金额' : 'Amount']: r.amount,
    [isZh ? '类型' : 'Type']: r.type === 'give' ? (isZh ? '送出' : 'Give') : (isZh ? '收到' : 'Receive'),
    [isZh ? '事项类别' : 'Event Type']: r.eventType,
    [isZh ? '关联礼簿' : 'Ledger']: r.ledgerId ? 'Linked' : '-',
    [isZh ? '详细备注' : 'Remarks']: r.description || ''
  }));
  const csv = Papa.unparse(data);
  // Add UTF-8 BOM for Excel Chinese support
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${isZh ? '和谐账本人情记录' : 'Harmony_Ledger_Export'}_${format(new Date(), 'yyyyMMdd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}