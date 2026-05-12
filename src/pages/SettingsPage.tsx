import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Languages, Download, LogOut, ChevronRight,
  Upload, Share2, Copy, Check, Users, RefreshCw, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { JoinFamilyDialog } from '@/components/JoinFamilyDialog';
import { SocialShareCard } from '@/components/SocialShareCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, logout, switchFamily } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: families } = useQuery({
    queryKey: ['user', 'families', user?.id],
    queryFn: () => api<any[]>(`/api/user/families?userId=${user?.id}`),
    enabled: !!user?.id && !!user?.token,
  });
  const { data: familyInfo } = useQuery({
    queryKey: ['family', 'info', user?.activeFamilyId],
    queryFn: () => api<any>(`/api/family/info?familyId=${user?.activeFamilyId}`),
    enabled: !!user?.activeFamilyId,
  });
  const { data: stats } = useQuery({
    queryKey: ['stats', 'detailed', user?.activeFamilyId],
    queryFn: () => api<any>(`/api/stats/detailed?familyId=${user?.activeFamilyId}`),
    enabled: !!user?.activeFamilyId,
  });
  const leaveMutation = useMutation({
    mutationFn: () => api(`/api/family/leave/${user?.activeFamilyId}`, {
      method: 'POST'
    }),
    onSuccess: (res: any) => {
      toast.success(t('settings.leaveSuccess'));
      if (res && res.activeFamilyId) {
        localStorage.setItem('harmony_user', JSON.stringify(res));
        window.location.reload();
      } else {
        logout();
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const migrateMutation = useMutation({
    mutationFn: () => api<any>('/api/data/migrate-contacts', {
      method: 'POST',
      body: JSON.stringify({ familyId: user?.activeFamilyId })
    }),
    onSuccess: (res) => {
      toast.success(t('contacts.syncSuccess', { count: res.createdCount }));
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (e: any) => toast.error(e.message || t('common.error')),
  });
  const handleExportJSON = async () => {
    try {
      const data = await api<any>(`/api/data/export?familyId=${user?.activeFamilyId}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `harmony_ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      // toast.success(t('settings.exportSuccess'));
    } catch (e) {
      toast.error(t('settings.exportError'));
    }
  };
  const copyInviteCode = () => {
    if (!familyInfo?.inviteCode) return;
    navigator.clipboard.writeText(familyInfo.inviteCode).then(() => {
      setCopied(true);
      toast.success(t('settings.copySuccess'));
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error(t('settings.copyError'));
    });
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12 space-y-8">
      <div className="flex flex-col items-center py-6 text-center">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#E63946] to-[#F4A261] p-1 shadow-lg">
          <div className="h-full w-full rounded-full bg-white flex items-center justify-center font-bold text-3xl">
            {user?.name?.charAt(0)}
          </div>
        </div>
        <h2 className="mt-4 text-xl font-bold">{user?.name}</h2>
        {familyInfo?.name && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 rounded-full">
            <p className="text-sm font-medium text-rose-600">目前家庭👪：{familyInfo?.name}</p>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4">{t('settings.myFamilies')}</h3>
          <Card className="border-none shadow-soft rounded-2xl overflow-hidden p-4">
            <Select value={user?.activeFamilyId} onValueChange={(val) => switchFamily(val)}>
              <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50">
                <SelectValue placeholder={t('settings.switchFamily')} />
              </SelectTrigger>
              <SelectContent>
                {families?.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsJoinOpen(true)}>
                <Shield className="h-4 w-4 mr-2 text-rose-500" /> {t('familyDialog.title')}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="flex-1 rounded-xl text-slate-400 hover:text-rose-500">
                    <LogOut className="h-4 w-4 mr-2" /> {t('settings.leaveFamily')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings.leaveFamily')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('settings.leaveConfirm')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction className="rounded-xl bg-rose-500 hover:bg-rose-600" onClick={() => leaveMutation.mutate()}>
                      {t('common.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </section>
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4">{t('settings.social')}</h3>
          <Card className="border-none shadow-soft rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsShareOpen(true)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-rose-50 text-rose-500 p-2.5 rounded-xl"><Share2 className="h-5 w-5" /></div>
                <span className="font-medium text-slate-700">{t('settings.shareCard')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </CardContent>
          </Card>
        </section>
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4">{t('settings.family')}</h3>
          <Card className="border-none shadow-soft rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 mb-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('settings.inviteCode')}</p>
                  <p className="text-2xl font-mono font-bold text-slate-800 mt-1">{familyInfo?.inviteCode || '------'}</p>
                </div>
                <Button size="icon" variant="outline" className="rounded-xl border-slate-200" onClick={copyInviteCode}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-soft rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => navigate('/contacts')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-xl"><Users className="h-5 w-5" /></div>
                <span className="font-medium text-slate-700">{t('contacts.title')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </CardContent>
          </Card>
        </section>
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4">{t('settings.data')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-none shadow-soft rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors" onClick={handleExportJSON}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="bg-blue-50 text-blue-500 p-2.5 rounded-xl w-fit"><Download className="h-5 w-5" /></div>
                <span className="font-bold text-sm text-slate-700">{t('settings.export')}</span>
              </CardContent>
            </Card>
            <Card className={cn("border-none shadow-soft rounded-2xl overflow-hidden transition-colors", isImporting ? "opacity-60 pointer-events-none" : "cursor-pointer hover:bg-slate-50")} onClick={() => !isImporting && fileInputRef.current?.click()}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-xl w-fit">
                  <Upload className={cn("h-5 w-5", isImporting && "animate-spin")} />
                </div>
                <span className="font-bold text-sm text-slate-700">{t('settings.import')}</span>
                <input type="file" ref={fileInputRef} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsImporting(true);
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    try {
                      const payload = JSON.parse(ev.target?.result as string);
                      await api('/api/data/restore', {
                        method: 'POST',
                        body: JSON.stringify({ ...payload, familyId: user?.activeFamilyId })
                      });
                      toast.success(t('settings.importSuccess'));
                      queryClient.invalidateQueries();
                    } catch (err) {
                      toast.error(t('settings.importError'));
                    } finally {
                      setIsImporting(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  };
                  reader.readAsText(file);
                }} className="hidden" accept=".json" />
              </CardContent>
            </Card>
          </div>
          {/* <Card
            className="border-none shadow-soft rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => migrateMutation.mutate()}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-amber-50 text-amber-500 p-2.5 rounded-xl">
                  <RefreshCw className={cn("h-5 w-5", migrateMutation.isPending && "animate-spin")} />
                </div>
                <div>
                  <span className="font-medium text-slate-700 block">{t('settings.migrateData')}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{t('contacts.syncPrompt')}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </CardContent>
          </Card> */}
        </section>
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4">{t('settings.preferences')}</h3>
          <Card className="border-none shadow-soft rounded-2xl overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => {
            const newLang = i18n.language === 'zh' ? 'en' : 'zh';
            i18n.changeLanguage(newLang);
            localStorage.setItem('lng', newLang);
          }}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-xl"><Languages className="h-5 w-5" /></div>
                <span className="font-medium text-slate-700">{t('settings.language')}</span>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase">{i18n.language}</span>
            </CardContent>
          </Card>
        </section>
      </div>
      <div className="pt-4">
        <Button variant="ghost" onClick={logout} className="w-full h-14 rounded-2xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold">
          <LogOut className="h-5 w-5 mr-2" /> {t('settings.logout')}
        </Button>
      </div>
      <JoinFamilyDialog
        open={isJoinOpen}
        onOpenChange={setIsJoinOpen}
        onSuccess={(family: any) => {
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }}
      />
      <SocialShareCard
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        userName={user?.name || ''}
        stats={{
          netBalance: stats?.netBalance || 0,
          topEventType: stats?.topEventType || '---',
          totalGiven: stats?.totalGiven,
          totalReceived: stats?.totalReceived,
          maxAmount: stats?.maxAmount,
          monthlyTrends: stats?.monthlyTrends,
          categoryDistribution: stats?.categoryDistribution,
        }}
      />
      {/* 全屏幕导入 Loading */}
      {isImporting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-rose-500 border-t-transparent" />
            <p className="text-sm font-bold text-slate-700">{t('settings.import')}...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}