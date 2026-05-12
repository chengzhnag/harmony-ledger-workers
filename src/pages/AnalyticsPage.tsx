import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, Trophy, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { EVENT_TYPES } from '@/constants';
export function AnalyticsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const familyId = user?.activeFamilyId;
  const { data: stats } = useQuery({
    queryKey: ['stats', 'detailed', familyId],
    queryFn: () => api<any>(`/api/stats/detailed?familyId=${familyId}`),
    enabled: !!familyId,
  });
  const COLORS = ['#E63946', '#F4A261', '#2B2D42', '#457B9D', '#A8DADC'];
  const categoryData = (stats?.categoryDistribution || []).map((item: any) => ({
    ...item,
    name: t(EVENT_TYPES.find(et => et.value === item.name)?.label || item.name),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">{t('analytics.title')}</h1>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-soft rounded-[32px] bg-gradient-to-br from-indigo-500 to-indigo-600 text-white overflow-hidden">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="p-4 bg-white/20 rounded-[20px] backdrop-blur-md">
                <Trophy className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm opacity-80 font-bold uppercase tracking-wider">{t('analytics.topEvent')}</p>
                <p className="text-3xl font-extrabold mt-1">{t(EVENT_TYPES.find(et => et.value === stats?.topEventType)?.label || stats?.topEventType || '---')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-soft rounded-[32px] bg-gradient-to-br from-rose-500 to-rose-600 text-white overflow-hidden">
            <CardContent className="p-8 flex items-center gap-6">
              <div className="p-4 bg-white/20 rounded-[20px] backdrop-blur-md">
                <Wallet className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm opacity-80 font-bold uppercase tracking-wider">{t('analytics.maxGift')}</p>
                <p className="text-3xl font-extrabold mt-1">¥{Number(stats?.maxAmount || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Tabs defaultValue="trends" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1.5 rounded-2xl h-14">
            <TabsTrigger value="trends" className="rounded-xl font-bold">
              <TrendingUp className="h-4 w-4 mr-2" />
              {t('analytics.trends')}
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-xl font-bold">
              <PieChartIcon className="h-4 w-4 mr-2" />
              {t('analytics.categories')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="trends" className="mt-8">
            <Card className="border-none shadow-soft rounded-[32px] overflow-hidden bg-white">
              <CardHeader className="px-8 pt-8">
                <CardTitle className="text-xl font-bold text-slate-800">{t('analytics.trends')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.monthlyTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar name={t('form.receive')} dataKey="receive" fill="#F4A261" radius={[6, 6, 0, 0]} barSize={24} />
                    <Bar name={t('form.give')} dataKey="give" fill="#E63946" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="categories" className="mt-8">
            <Card className="border-none shadow-soft rounded-[32px] overflow-hidden bg-white">
              <CardHeader className="px-8 pt-8">
                <CardTitle className="text-xl font-bold text-slate-800">{t('analytics.categories')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {(stats?.categoryDistribution || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}