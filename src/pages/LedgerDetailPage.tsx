import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronLeft, Plus, ArrowUpRight, ArrowDownRight, Trash2, Calendar, FileText, Edit2, MoreVertical, Download } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import type { Ledger, RenqingRecord } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddRecordSheet } from '@/components/AddRecordSheet';
import { RecordDetailDialog } from '@/components/RecordDetailDialog';
import { LedgerExportDialog } from '@/components/LedgerExportDialog';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { EVENT_TYPES } from '@/constants';
import { useEffect, useRef } from 'react';
import type { PaginatedResponse } from '@shared/types';
import { exportLedgerAsSingleImage, exportLedgerAsImageZip, exportLedgerAsPDF } from '@/lib/ledger-export';
export function LedgerDetailPage() {
  const { ledgerId } = useParams<{ ledgerId: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<RenqingRecord | undefined>(undefined);
  const [recordToDelete, setRecordToDelete] = React.useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = React.useState<RenqingRecord | null>(null);
  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const familyId = user?.activeFamilyId;
  const currentLocale = i18n.language === 'zh' ? zhCN : enUS;
  const { data: ledgers, isLoading: ledgersLoading } = useQuery({
    queryKey: ['ledgers', familyId],
    queryFn: () => api<Ledger[]>(`/api/ledgers?familyId=${familyId}`),
    enabled: !!familyId,
  });
  const ledger = ledgers?.find(l => l.id === ledgerId);
  const { data: recordData, isLoading: recordsLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['records', 'ledger', ledgerId],
    queryFn: ({ pageParam = 1 }) => api<PaginatedResponse<RenqingRecord> | RenqingRecord[]>(`/api/records?familyId=${familyId}&ledgerId=${ledgerId}&page=${pageParam}&limit=20`),
    getNextPageParam: (lastPage) => {
      if (Array.isArray(lastPage)) return undefined;
      const paginatedResponse = lastPage as PaginatedResponse<RenqingRecord>;
      return paginatedResponse.page < paginatedResponse.totalPages ? paginatedResponse.page + 1 : undefined;
    },
    enabled: !!familyId && !!ledgerId,
    initialPageParam: 1,
  });

  // 合并所有页面的记录
  const records = React.useMemo(() => {
    if (!recordData?.pages) return [];
    return recordData.pages.flatMap(page => Array.isArray(page) ? page : page.records);
  }, [recordData]);

  // 删除记录
  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => api(`/api/records/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      toast.success(t('common.success'));
      setRecordToDelete(null);
    },
  });

  // 点击编辑
  const handleEdit = (record: RenqingRecord) => {
    setEditingRecord(record);
    setIsAddOpen(true);
  };

  // 处理导出
  const handleExport = async (type: 'single-image' | 'image-zip' | 'pdf') => {
    if (!ledger) return;

    setIsExporting(true);

    // 先加载所有数据并收集最终完整记录
    let shouldFetchMore = hasNextPage;
    let allPages = recordData?.pages ?? [];

    while (shouldFetchMore) {
      const result = await fetchNextPage();
      if (result.data?.pages) {
        allPages = result.data.pages;
      }
      shouldFetchMore = result.hasNextPage ?? false;
    }

    const allRecords = allPages.flatMap(page => Array.isArray(page) ? page : page.records);

    try {
      switch (type) {
        case 'single-image':
          await exportLedgerAsSingleImage(ledger, allRecords);
          toast.success(t('ledgerExport.successSingle'));
          break;
        case 'image-zip':
          await exportLedgerAsImageZip(ledger, allRecords);
          toast.success(t('ledgerExport.successZip'));
          break;
        case 'pdf':
          await exportLedgerAsPDF(ledger, allRecords);
          toast.success(t('ledgerExport.successPDF'));
          break;
      }
    } catch (error) {
      console.error('导出失败:', error);
      toast.error(t('ledgerExport.failed'));
    } finally {
      setIsExporting(false);
    }
  };

  // 无限滚动逻辑
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!ledger && !ledgersLoading && !recordsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
          <FileText className="h-12 w-12 opacity-20" />
        </div>
        <p className="font-medium">{t('ledgers.noResults')}</p>
        <Button variant="link" onClick={() => navigate('/ledgers')} className="mt-2 text-rose-500">
          {t('ledgerDetail.back')}
        </Button>
      </div>
    );
  }

  const totals = {
    received: ledger?.totalReceived ?? 0,
    given: ledger?.totalGiven ?? 0
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header className="flex items-center gap-4">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white shadow-soft hover:bg-slate-50 transition-colors h-10 w-10 flex-shrink-0"
              onClick={() => navigate('/ledgers')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </motion.div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 line-clamp-1">
              {ledgersLoading ? <Skeleton className="h-8 w-48" /> : (ledger?.title || t('common.loading'))}
            </h1>
            <div className="flex items-center text-xs text-slate-500 font-medium gap-2 mt-1">
              <Calendar className="h-3 w-3 text-rose-400" />
              {ledger ? format(ledger.date, 'yyyy-MM-dd', { locale: currentLocale }) : <Skeleton className="h-3 w-24" />}
            </div>
          </div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
              onClick={() => setIsExportOpen(true)}
              disabled={!ledger || recordsLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('ledgerDetail.exportLedger')}
            </Button>
          </motion.div>
        </header>
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-none shadow-soft rounded-[24px] bg-emerald-50/40 overflow-hidden relative border border-emerald-100/30">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-1">{t('dashboard.received')}</p>
              <p className="text-3xl font-extrabold text-emerald-600">
                {ledgersLoading ? '...' : `¥${totals.received.toLocaleString()}`}
              </p>
              <ArrowUpRight className="absolute -bottom-2 -right-2 h-16 w-16 text-emerald-600/5 rotate-12" />
            </CardContent>
          </Card>
          <Card className="border-none shadow-soft rounded-[24px] bg-rose-50/40 overflow-hidden relative border border-rose-100/30">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-600/60 mb-1">{t('dashboard.given')}</p>
              <p className="text-3xl font-extrabold text-rose-600">
                {ledgersLoading ? '...' : `¥${totals.given.toLocaleString()}`}
              </p>
              <ArrowDownRight className="absolute -bottom-2 -right-2 h-16 w-16 text-rose-600/5 rotate-12" />
            </CardContent>
          </Card>
        </section>
        <section className="">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" />
              {t('ledgerDetail.records')}
            </h2>
            <Button
              size="sm"
              className="rounded-full bg-[#E63946] hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all active:scale-95 px-5"
              onClick={() => { setEditingRecord(undefined); setIsAddOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> {t('form.title')}
            </Button>
          </div>
          <div className="grid gap-3 mt-4">
            {recordsLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
            ) : !records || records.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                <FileText className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-slate-400 font-medium">{t('ledgerDetail.noRecords')}</p>
              </div>
            ) : (
              <>
                {records.map((record) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="bg-white p-4 rounded-2xl shadow-soft flex items-center justify-between hover:shadow-md transition-all border border-transparent hover:border-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                        record.type === 'receive' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {record.personName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{record.personName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t(EVENT_TYPES.find(et => et.value === record.eventType)?.label || record.eventType)}</span>
                          {record.description && (
                            <>
                              <span className="text-[10px] text-slate-200">•</span>
                              <span className="text-[10px] font-medium text-slate-400 line-clamp-1">{record.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "font-bold text-lg mr-2",
                        record.type === 'receive' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {record.type === 'receive' ? '+' : '-'}¥{record.amount.toLocaleString()}
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600 rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-32">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(record); }} className="cursor-pointer">
                            <Edit2 className="h-4 w-4 mr-2" /> {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-rose-500 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setRecordToDelete(record.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>

          {isFetchingNextPage && (
            <div className="flex justify-center pt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
            </div>
          )}
          {!hasNextPage && records.length > 0 && (
            <div className="flex justify-center pt-6">
              <p className="text-sm text-slate-400 font-medium">{t('ledgerDetail.allLoaded')}</p>
            </div>
          )}
          <div ref={observerTarget} className="h-2" />
        </section>
      </div>
      <AddRecordSheet
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setEditingRecord(undefined);
        }}
        pinnedLedgerId={ledgerId}
        recordToEdit={editingRecord}
      />
      <RecordDetailDialog
        open={!!selectedRecord}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}
        record={selectedRecord}
        locale={i18n.language === 'zh' ? 'zh' : 'en'}
        onEdit={(record) => {
          setSelectedRecord(null);
          setEditingRecord(record);
          setIsAddOpen(true);
        }}
        onDelete={(record) => {
          setSelectedRecord(null);
          setRecordToDelete(record.id);
        }}
      />
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.deleteRecordConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={() => recordToDelete && deleteRecordMutation.mutate(recordToDelete)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <LedgerExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}