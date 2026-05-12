import React from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Ledger, RenqingRecord } from '@shared/types';
import { BookOpen, List, Calendar, Search, PlusCircle, Inbox, Trash2, MoreVertical, Edit2, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { CreateLedgerSheet } from '@/components/CreateLedgerSheet';
import { EditLedgerSheet } from '@/components/EditLedgerSheet';
import { AddRecordSheet } from '@/components/AddRecordSheet';
import { RecordDetailDialog } from '@/components/RecordDetailDialog';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { EVENT_TYPES } from '@/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { PaginatedResponse } from '@shared/types';

export function LedgersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const familyId = user?.activeFamilyId;
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [ledgerToEdit, setLedgerToEdit] = React.useState<Ledger | null>(null);
  const [ledgerToDelete, setLedgerToDelete] = React.useState<string | null>(null);
  const [recordToEdit, setRecordToEdit] = React.useState<RenqingRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = React.useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = React.useState<RenqingRecord | null>(null);
  const [activeTab, setActiveTab] = React.useState("ledgers");
  const observerTarget = useRef<HTMLDivElement>(null);
  const currentLocale = i18n.language === 'zh' ? zhCN : enUS;

  const { data: ledgers, isLoading: ledgersLoading } = useQuery({
    queryKey: ['ledgers', familyId],
    queryFn: () => api<Ledger[]>(`/api/ledgers?familyId=${familyId}`),
    enabled: !!familyId,
  });

  const { data: recordData, isLoading: recordsLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['records', 'independent', familyId, searchTerm],
    queryFn: ({ pageParam = 1 }) => api<PaginatedResponse<RenqingRecord> | RenqingRecord[]>(`/api/records?familyId=${familyId}&ledgerId=&query=${encodeURIComponent(searchTerm)}&page=${pageParam}&limit=20`),
    getNextPageParam: (lastPage) => {
      if (Array.isArray(lastPage)) return undefined;
      const paginatedResponse = lastPage as PaginatedResponse<RenqingRecord>;
      return paginatedResponse.page < paginatedResponse.totalPages ? paginatedResponse.page + 1 : undefined;
    },
    enabled: !!familyId,
    initialPageParam: 1,
  });

  // 合并所有页面的记录
  const allRecords = React.useMemo(() => {
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

  // 删除账本时同时删除相关记录
  const deleteLedgerMutation = useMutation({
    mutationFn: (id: string) => api(`/api/ledgers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success(t('common.success'));
      setLedgerToDelete(null);
    },
  });

  // 无限滚动逻辑
  useEffect(() => {
    if (activeTab !== 'records') return; // 仅在记录列表页启用滚动加载

    let attempts = 0;
    let observer;
    const maxAttempts = 5;
    const interval = setInterval(() => {
      if (observerTarget.current) {
        // 初始化IntersectionObserver
        clearInterval(interval);
        const target = observerTarget.current;
        console.log('无限滚动逻辑 Observer target element:', target);
        if (!target) return;

        observer = new IntersectionObserver(
          entries => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          },
          { threshold: 0.1 }
        );

        observer.observe(target);
        return;
      }

      // ...其他逻辑
      attempts++;
      if (attempts >= maxAttempts) {
        console.error('无法获取observerTarget，已尝试5次');
        clearInterval(interval);
      }
    }, 200);


    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('nav.ledgers')}</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{t('ledgers.subtitle')}</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="rounded-full bg-[#E63946] hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all active:scale-95">
            <PlusCircle className="h-4 w-4 mr-2" />
            {t('ledgers.addLedger')}
          </Button>
        </header>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1.5 rounded-2xl h-14">
            <TabsTrigger value="ledgers" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm transition-all">
              <BookOpen className="h-4 w-4 mr-2" />
              {t('ledgers.eventTabs')}
            </TabsTrigger>
            <TabsTrigger value="records" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm transition-all">
              <List className="h-4 w-4 mr-2" />
              {t('ledgers.detailTabs')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ledgers" className="mt-8">
            <div className="grid grid-cols-1 gap-4">
              {ledgersLoading ? (
                [1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
              ) : ledgers?.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    <Inbox className="h-8 w-8 text-slate-200" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{t('ledgers.noLedgers')}</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-[200px]">{t('ledgers.noLedgersHelp')}</p>
                  <Button variant="outline" className="mt-6 rounded-xl border-slate-200" onClick={() => setIsCreateOpen(true)}>
                    {t('ledgers.createNow')}
                  </Button>
                </div>
              ) : (
                ledgers?.map((ledger) => (
                  <div key={ledger.id} className="relative">
                    <Link to={`/ledgers/${ledger.id}`} className="block no-underline group">
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Card className="border-none shadow-soft rounded-2xl overflow-hidden group-hover:shadow-lg transition-all border-l-4 border-l-rose-500">
                          <CardContent className="p-6 flex justify-between items-center pr-12">
                            <div className="space-y-1.5">
                              <h3 className="font-bold text-xl text-slate-800 group-hover:text-rose-600 transition-colors">{ledger.title}</h3>
                              <div className="flex items-center text-xs text-slate-500 gap-4 font-medium">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-rose-400" />
                                  {format(ledger.date, 'yyyy-MM-dd', { locale: currentLocale })}
                                </span>
                                {ledger.description && <span className="bg-slate-50 px-2 py-0.5 rounded text-slate-400 line-clamp-1">{ledger.description}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('ledgers.totalAmount')}</p>
                              <div className="font-bold text-xl text-slate-900 mt-1">
                                {ledger.totalReceived > 0 && <span className="text-emerald-600">+¥{ledger.totalReceived.toLocaleString()}</span>}
                                {ledger.totalGiven > 0 && <span className="text-rose-600 ml-2">-¥{ledger.totalGiven.toLocaleString()}</span>}
                                {ledger.totalReceived === 0 && ledger.totalGiven === 0 && <span className="text-slate-300">¥0</span>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </Link>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-slate-400 hover:text-slate-600">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-32">
                          <DropdownMenuItem onClick={() => setLedgerToEdit(ledger)}>
                            <Edit2 className="h-4 w-4 mr-2" /> {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-500" onClick={() => setLedgerToDelete(ledger.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
          <TabsContent value="records" className="mt-8">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-12 bg-white border-none shadow-soft rounded-2xl h-14 focus-visible:ring-2 focus-visible:ring-rose-500/20 text-base"
                placeholder={t('ledgers.searchPlaceholder')}
              />
              {recordsLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-500"></div>
                </div>
              )}
            </div>
            <div className="grid gap-3 mt-6">
              {recordsLoading ? (
                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
              ) : allRecords.length === 0 ? (
                searchTerm ? (
                  <div className="text-center py-20 bg-slate-50 rounded-[40px] text-slate-400 font-medium">
                    {t('ledgers.noResults')}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                    <History className="h-10 w-10 text-slate-200 mb-3" />
                    <p className="text-slate-400 font-medium">{t('dashboard.noRecords')}</p>
                  </div>
                )
              ) : (
                <>
                  {allRecords.map((record) => (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="bg-white p-4 rounded-2xl shadow-soft flex items-center justify-between border border-transparent hover:border-slate-100 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg",
                          record.type === 'receive' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {record.personName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{record.personName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t(EVENT_TYPES.find(et => et.value === record.eventType)?.label || record.eventType)}</span>
                            <span className="text-[10px] font-medium text-slate-300">|</span>
                            <span className="text-[10px] font-medium text-slate-400">{format(record.timestamp, 'yyyy-MM-dd', { locale: currentLocale })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={cn(
                          "text-lg font-bold",
                          record.type === 'receive' ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {record.type === 'receive' ? '+' : '-'}¥{record.amount.toLocaleString()}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-32">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRecordToEdit(record); }} className="cursor-pointer">
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
              <div className="flex justify-center mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            )}
            {!hasNextPage && allRecords.length > 0 && (
              <div className="flex justify-center mt-6">
                <p className="text-sm text-slate-400 font-medium">{t('ledgers.allLoaded')}</p>
              </div>
            )}
            <div ref={observerTarget} className="h-2" />
          </TabsContent>
        </Tabs>
      </div>
      <CreateLedgerSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      {ledgerToEdit && (
        <EditLedgerSheet
          ledger={ledgerToEdit}
          open={!!ledgerToEdit}
          onOpenChange={(open) => !open && setLedgerToEdit(null)}
        />
      )}
      {recordToEdit && (
        <AddRecordSheet
          recordToEdit={recordToEdit}
          open={!!recordToEdit}
          onOpenChange={(open) => !open && setRecordToEdit(null)}
        />
      )}
      <RecordDetailDialog
        open={!!selectedRecord}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}
        record={selectedRecord}
        locale={i18n.language === 'zh' ? 'zh' : 'en'}
        onEdit={(record) => {
          setSelectedRecord(null);
          setRecordToEdit(record);
        }}
        onDelete={(record) => {
          setSelectedRecord(null);
          setRecordToDelete(record.id);
        }}
      />
      <AlertDialog open={!!ledgerToDelete} onOpenChange={(open) => !open && setLedgerToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('ledgers.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={() => ledgerToDelete && deleteLedgerMutation.mutate(ledgerToDelete)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    </div>
  );
}