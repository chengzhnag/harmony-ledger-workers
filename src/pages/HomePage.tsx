import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight, Wallet, History, Calendar, Share2, Clock } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import type { RenqingRecord, PaginatedResponse } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { EVENT_TYPES } from '@/constants';
import { Link } from 'react-router-dom';
export function HomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const familyId = user?.activeFamilyId;
  const currentLocale = i18n.language === 'zh' ? zhCN : enUS;
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', familyId],
    queryFn: () => api<{ totalGiven: number; totalReceived: number; netBalance: number }>(`/api/stats/summary?familyId=${familyId}`),
    enabled: !!familyId,
  });
  const { data: recordData, isLoading: recordsLoading } = useQuery({
    queryKey: ['records', 'recent', familyId],
    queryFn: () => api<RenqingRecord[] | PaginatedResponse<RenqingRecord>>(`/api/records?familyId=${familyId}&limit=5`),
    enabled: !!familyId,
  });

  // 处理两种可能的返回格式
  const records = React.useMemo(() => {
    if (!recordData) return [];
    if (Array.isArray(recordData)) return recordData;
    return (recordData as PaginatedResponse<RenqingRecord>).records;
  }, [recordData]);
  // const { data: reminders } = useQuery({
  //   queryKey: ['reminders', familyId],
  //   queryFn: () => api<{ id: string; title: string; date: number }[]>(`/api/stats/reminders?familyId=${familyId}`),
  //   enabled: !!familyId,
  // });
  const handleShare = async () => {
    const name = user?.name ?? 'User';
    const domain = window.location.origin;
    const balance = stats?.netBalance ?? 0;
    const totalReceived = stats?.totalReceived ?? 0;
    const totalGiven = stats?.totalGiven ?? 0;
    const text = t('dashboard.shareText', {
      name,
      balance: balance.toLocaleString(),
      totalReceived: totalReceived.toLocaleString(),
      totalGiven: totalGiven.toLocaleString(),
      domain
    });
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('dashboard.shareTitle'),
          text: text,
          url: window.location.origin
        });
      } catch (err) {
        console.debug('Share cancelled or failed', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t('dashboard.copied'));
      } catch (err) {
        toast.error(t('dashboard.copyFailed'));
      }
    }
  };
  const netBalance = stats?.netBalance ?? 0;
  const receivedTotal = stats?.totalReceived ?? 0;
  const givenTotal = stats?.totalGiven ?? 0;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {t('nav.home')}, {user?.name ?? 'User'}
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{t('dashboard.activity')}</p>
          </div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button variant="outline" size="icon" className="rounded-full bg-white shadow-soft border-none h-10 w-10" onClick={handleShare}>
              <Share2 className="h-4 w-4 text-slate-600" />
            </Button>
          </motion.div>
        </header>
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#E63946] to-[#b91c1c] p-6 text-white shadow-2xl shadow-rose-500/20">
          <div className="relative z-10">
            <p className="text-sm opacity-80 font-bold uppercase tracking-widest">{t('dashboard.balance')}</p>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className={cn(
                "text-5xl font-extrabold tracking-tighter transition-all",
                statsLoading && "animate-pulse opacity-50"
              )}>
                {statsLoading ? '...' : netBalance.toLocaleString()}
              </span>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-6">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10">
                <div className="flex items-center space-x-2 opacity-80 text-xs font-bold uppercase tracking-wider">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>{t('dashboard.received')}</span>
                </div>
                <p className="mt-1 text-lg font-bold">
                  ¥{statsLoading ? '...' : receivedTotal.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10">
                <div className="flex items-center space-x-2 opacity-80 text-xs font-bold uppercase tracking-wider">
                  <ArrowDownRight className="h-3 w-3" />
                  <span>{t('dashboard.given')}</span>
                </div>
                <p className="mt-1 text-lg font-bold">
                  ¥{statsLoading ? '...' : givenTotal.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <Wallet className="absolute -bottom-6 -right-6 h-48 w-48 opacity-10 rotate-12" />
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-rose-500" />
              {t('dashboard.activity')}
            </h2>
            <Link to="/timeline" className="text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1">
              {/* <Clock className="h-3.5 w-3.5" /> */}
              {t('dashboard.viewTimeline')}
            </Link>
          </div>
          <div className="grid gap-3">
            {recordsLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />)
            ) : !records || records.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                <History className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-slate-400 font-medium">{t('dashboard.noRecords')}</p>
              </div>
            ) : (
              records.map((record) => (
                <Card key={record.id} className="border-none shadow-soft rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "p-3 rounded-xl",
                        record.type === 'receive' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {record.type === 'receive' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{record.personName}</h3>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-tight">{t(EVENT_TYPES.find(et => et.value === record.eventType)?.label || record.eventType)}</p>
                        {record.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{record.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-bold", record.type === 'receive' ? "text-emerald-600" : "text-rose-600")}>
                        {record.type === 'receive' ? '+' : '-'}¥{record.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        {format(record.timestamp, 'yyyy-MM-dd', { locale: currentLocale })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
        {/* <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            {t('dashboard.reminders')}
          </h2>
          {!reminders || reminders.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-[32px] border border-slate-100 text-xs text-slate-400 font-medium">
              {t('dashboard.noReminders')}
            </div>
          ) : (
            <div className="grid gap-4">
              {reminders.map(reminder => (
                <Card key={reminder.id} className="border-none shadow-soft rounded-2xl bg-amber-50/30 border border-amber-100/50">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">{reminder.title}</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {format(reminder.date, 'yyyy-MM-dd', { locale: currentLocale })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section> */}
      </div>
    </div>
  );
}