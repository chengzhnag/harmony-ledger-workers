import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, PieChart as PieChartIcon, Calendar, ArrowUpCircle, ArrowDownCircle, Hash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { RenqingRecord, Contact } from '@shared/types';
import { EVENT_TYPES } from '@/constants';

export function ContactDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId: string }>();
  const activeFamilyId = user?.activeFamilyId;

  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api<Contact>(`/api/contacts/${contactId}`),
    enabled: !!contactId,
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ['contact-records', contactId],
    queryFn: () => api<RenqingRecord[]>(`/api/records/by-contact/${contactId}?familyId=${activeFamilyId}`),
    enabled: !!activeFamilyId && !!contactId,
  });

  const stats = React.useMemo(() => {
    if (!records) return { totalGiven: 0, totalReceived: 0, netBalance: 0, count: 0 };
    const totalGiven = records.filter(r => r.type === 'give').reduce((sum, r) => sum + r.amount, 0);
    const totalReceived = records.filter(r => r.type === 'receive').reduce((sum, r) => sum + r.amount, 0);
    return {
      totalGiven,
      totalReceived,
      netBalance: totalReceived - totalGiven,
      count: records.length
    };
  }, [records]);

  const monthlyData = React.useMemo(() => {
    if (!records) return [];
    const monthlyMap = new Map<string, { give: number; receive: number }>();
    records.forEach(record => {
      const month = new Date(record.timestamp).toISOString().slice(0, 7);
      const existing = monthlyMap.get(month) || { give: 0, receive: 0 };
      if (record.type === 'give') {
        existing.give += record.amount;
      } else {
        existing.receive += record.amount;
      }
      monthlyMap.set(month, existing);
    });
    return Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }));
  }, [records]);

  const categoryData = React.useMemo(() => {
    if (!records) return [];
    const categoryMap = new Map<string, number>();
    records.forEach(record => {
      const existing = categoryMap.get(record.eventType) || 0;
      categoryMap.set(record.eventType, existing + record.amount);
    });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const COLORS = ['#E63946', '#F4A261', '#2B2D42', '#457B9D', '#A8DADC', '#1D3557', '#E76F51'];

  const formatEventType = (eventType: string) => {
    const eventTypeConfig = EVENT_TYPES.find(et => et.value === eventType);
    return eventTypeConfig ? t(eventTypeConfig.label) : eventType;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (!contact) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-10 lg:py-12">
          <div className="text-center py-20">
            <p className="text-slate-400">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('contactDetail.title')}</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{contact.name}</p>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-soft rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <ArrowUpCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs opacity-80 font-bold uppercase tracking-wider">{t('contactDetail.totalGiven')}</p>
                <p className="text-2xl font-extrabold mt-1">¥{stats.totalGiven.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <ArrowDownCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs opacity-80 font-bold uppercase tracking-wider">{t('contactDetail.totalReceived')}</p>
                <p className="text-2xl font-extrabold mt-1">¥{stats.totalReceived.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs opacity-80 font-bold uppercase tracking-wider">{t('contactDetail.netBalance')}</p>
                <p className="text-2xl font-extrabold mt-1">¥{stats.netBalance.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 text-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <Hash className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs opacity-80 font-bold uppercase tracking-wider">{t('contactDetail.recordCount')}</p>
                <p className="text-2xl font-extrabold mt-1">{stats.count}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {monthlyData.length > 0 && categoryData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-soft rounded-2xl">
              <CardHeader className="px-6 pt-6">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-rose-500" />
                  {t('contactDetail.monthlyTrend')}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar name={t('contactDetail.receive')} dataKey="receive" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                    <Bar name={t('contactDetail.give')} dataKey="give" fill="#E63946" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-soft rounded-2xl">
              <CardHeader className="px-6 pt-6">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-amber-500" />
                  {t('contactDetail.categoryDistribution')}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                      formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, formatEventType(name)]}
                    />
                    <Legend
                      iconType="circle"
                      formatter={(value: string) => formatEventType(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Records List */}
        <Card className="border-none shadow-soft rounded-2xl">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              {t('contactDetail.records')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : !records?.length ? (
              <div className="text-center py-12">
                <p className="text-slate-400">{t('contactDetail.noRecords')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-xl ${record.type === 'give' ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                        {record.type === 'give' ? (
                          <ArrowUpCircle className="h-5 w-5 text-rose-600" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{formatEventType(record.eventType)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            record.type === 'give'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {record.type === 'give' ? t('contactDetail.give') : t('contactDetail.receive')}
                          </span>
                        </div>
                        {record.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{record.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${record.type === 'give' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {record.type === 'give' ? '-' : '+'}¥{record.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(record.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
