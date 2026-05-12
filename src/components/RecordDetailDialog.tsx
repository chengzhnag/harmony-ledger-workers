import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { EVENT_TYPES } from '@/constants';
import type { RenqingRecord } from '@shared/types';

interface RecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: RenqingRecord | null;
  locale: 'zh' | 'en';
  onEdit?: (record: RenqingRecord) => void;
  onDelete?: (record: RenqingRecord) => void;
}

export function RecordDetailDialog({ open, onOpenChange, record, locale, onEdit, onDelete }: RecordDetailDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!record) return null;
  const currentLocale = locale === 'zh' ? zhCN : enUS;

  const categoryLabel = t(EVENT_TYPES.find(et => et.value === record.eventType)?.label || record.eventType);
  const typeLabel = record.type === 'receive' ? (
    <span className='text-emerald-600'>{t('form.receive')}</span>
  ) : (
    <span className='text-rose-600'>{t('form.give')}</span>
  );

  const handleDelete = async () => {
    onDelete?.(record);
    onOpenChange(false);
  };

  const handleEdit = () => {
    onOpenChange(false);
    onEdit?.(record);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('recordDetail.title')}</DialogTitle>
          <DialogDescription>{record.personName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p>
            <span className="font-semibold">{t('form.person')}:</span>{' '}
            {record.contactId ? (
              <button
                type="button"
                className="text-rose-500 hover:text-rose-600 underline transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/contacts/${record.contactId}`);
                }}
              >
                {record.personName}
              </button>
            ) : (
              record.personName
            )}
          </p>
          <p><span className="font-semibold">{t('form.category')}:</span> {categoryLabel}</p>
          <p><span className="font-semibold">{t('form.type')}:</span> {typeLabel}</p>
          <p><span className="font-semibold">{t('form.amount')}:</span> ¥{record.amount.toLocaleString()}</p>
          <p><span className="font-semibold">{t('form.note')}:</span> {record.description || '-'}</p>
          <p><span className="font-semibold">{t('form.date')}:</span> {format(record.timestamp, 'yyyy-MM-dd HH:mm', { locale: currentLocale })}</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleEdit}>
            {t('common.edit')}
          </Button>
          <Button variant="destructive" className="flex-1" onClick={handleDelete}>
            {t('common.delete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}