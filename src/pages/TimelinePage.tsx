import React, { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import type { PaginatedResponse, Ledger, RenqingRecord } from '@shared/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownRight, BookOpen, CalendarDays, Download, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { EVENT_TYPES } from '@/constants';
import { Link } from 'react-router-dom';
import { exportTimelineAsImage } from '@/lib/timeline-export';
import { toast } from 'sonner';

interface TimelineRecord {
  id: string;
  familyId: string;
  ledgerId?: string;
  contactId?: string;
  type: 'give' | 'receive';
  amount: number;
  personName: string;
  eventType: string;
  description?: string;
  timestamp: number;
  ledger?: Ledger;
}

interface TimelinePageResponse {
  records: TimelineRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function TimelinePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const familyId = user?.activeFamilyId;
  const currentLocale = i18n.language === 'zh' ? zhCN : enUS;
  const observerTarget = useRef<HTMLDivElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const {
    data: pageData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['records', 'timeline', familyId],
    queryFn: ({ pageParam = 1 }) =>
      api<TimelinePageResponse>(`/api/records/timeline?familyId=${familyId}&page=${pageParam}&limit=20`),
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.totalPages) return undefined;
      return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: !!familyId,
    initialPageParam: 1,
  });

  const allRecords = React.useMemo(() => {
    if (!pageData?.pages) return [];
    return pageData.pages.flatMap((page) => page.records ?? []);
  }, [pageData]);

  // 处理导出为图片
  const handleExportImage = async () => {
    if (!exportContainerRef.current) return;
    
    setIsExporting(true);
    try {
      // 先加载所有数据
      let shouldFetchMore = hasNextPage;
      while (shouldFetchMore) {
        // 调用 fetchNextPage 并等待其完成
        const result = await fetchNextPage();
        // 检查是否还有下一页
        shouldFetchMore = result.hasNextPage ?? false;
      }
      
      // 等待一小段时间确保 DOM 更新
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 所有数据加载完成后导出
      await exportTimelineAsImage('main');
      toast.success(t('timeline.exportSuccess'));
    } catch (error) {
      toast.error(t('timeline.exportFailed'));
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // 按日期分组
  const groupedRecords = React.useMemo(() => {
    const groups: Map<string, TimelineRecord[]> = new Map();
    for (const record of allRecords) {
      const dateKey = format(record.timestamp, 'yyyy-MM-dd', { locale: currentLocale });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(record);
    }
    return Array.from(groups.entries());
  }, [allRecords, currentLocale]);

  // 无限滚动
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="pt-8 md:pt-10 lg:pt-12 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('timeline.title')}</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{t('timeline.subtitle')}</p>
          </div>
          {allRecords.length > 0 && (
            <Button
              onClick={handleExportImage}
              disabled={isExporting || isLoading}
              variant="outline"
              size="sm"
              id='timeline-export-image-button'
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('timeline.exporting')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t('timeline.exportImage')}
                </>
              )}
            </Button>
          )}
        </header>

        <div id="timeline-export-container" ref={exportContainerRef}>
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="h-5 w-24 rounded-lg mb-3" />
                  {[1, 2].map((j) => (
                    <Skeleton key={j} className="h-20 w-full rounded-2xl mb-3" />
                  ))}
                </div>
              ))}
            </div>
          ) : allRecords.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
              <BookOpen className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-slate-400 font-medium">{t('timeline.noRecords')}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedRecords.map(([dateKey, records]) => (
                <div key={dateKey}>
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50/80 to-transparent backdrop-blur-sm py-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 bg-white px-3 py-1 rounded-full shadow-sm">
                      <CalendarDays className="h-3.5 w-3.5 text-rose-400" />
                      {format(new Date(dateKey), 'yyyy-MM-dd', { locale: currentLocale })}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {records.map((record) => (
                      <TimelineCard key={record.id} record={record} locale={i18n.language} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isFetchingNextPage && (
          <div className="flex justify-center pt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
          </div>
        )}
        {!hasNextPage && allRecords.length > 0 && (
          <div className="flex justify-center pt-6">
            <p className="text-sm text-slate-400 font-medium">{t('timeline.allLoaded')}</p>
          </div>
        )}
        <div ref={observerTarget} className="h-2" />
      </div>
    </div>
  );
}

function TimelineCard({ record, locale }: { record: TimelineRecord; locale: string }) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'zh' ? zhCN : enUS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-none shadow-soft rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          {/* 账本信息 */}
          {record.ledger && (
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <BookOpen className="h-3.5 w-3.5 text-rose-400" />
              <Link
                to={`/ledgers/${record.ledger.id}`}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
              >
                {record.ledger.title}
              </Link>
              <span className="text-[10px] text-slate-400">
                {format(record.ledger.date, 'yyyy-MM-dd', { locale: currentLocale })}
              </span>
              {record.ledger.description && (
                <span className="text-[10px] text-slate-400 line-clamp-1">· {record.ledger.description}</span>
              )}
            </div>
          )}

          {/* 记录信息 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0",
                  record.type === 'receive'
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                )}
              >
                {record.personName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-800">{record.personName}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    {t(EVENT_TYPES.find((et) => et.value === record.eventType)?.label || record.eventType)}
                  </span>
                  {record.description && (
                    <>
                      <span className="text-[10px] text-slate-200">·</span>
                      <span className="text-[10px] text-slate-400 line-clamp-1">{record.description}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {record.type === 'receive' ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-rose-500" />
              )}
              <span
                className={cn(
                  "text-lg font-bold whitespace-nowrap",
                  record.type === 'receive' ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {record.type === 'receive' ? '+' : '-'}¥{record.amount.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
