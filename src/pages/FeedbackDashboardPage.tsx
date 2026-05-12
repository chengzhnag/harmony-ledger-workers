import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { MessageSquare, User, Clock, CheckCircle2 } from 'lucide-react';
import type { Feedback } from '@shared/types';
export function FeedbackDashboardPage() {
  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: () => api<Feedback[]>('/api/admin/feedback'),
  });
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">产品反馈中心</h1>
          <p className="text-muted-foreground mt-2">开发者专属后台：查看并分析用户提交的改进建议。</p>
        </header>
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : feedbacks?.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent text-center py-20">
            <CardContent>
              <MessageSquare className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">暂无用户反馈</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {feedbacks?.map((f) => (
              <Card key={f.id} className="border-none shadow-soft rounded-2xl overflow-hidden hover:ring-2 hover:ring-rose-500/10 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-50 text-rose-600 p-2 rounded-xl">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">用户 ID: {f.userId.substring(0, 8)}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(f.timestamp, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </p>
                      </div>
                    </div>
                    {f.status === 'reviewed' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> 已查阅
                      </span>
                    )}
                  </div>
                  <div className="mt-4 bg-slate-50 p-4 rounded-xl">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{f.message}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}