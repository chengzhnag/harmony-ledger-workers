import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, UserPlus, MoreVertical, Edit2, Trash2, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import type { Contact } from '@shared/types';

export function ContactsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", remarks: "" });
  const activeFamilyId = user?.activeFamilyId;
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', activeFamilyId, search],
    queryFn: () => api<Contact[]>(`/api/contacts/search?familyId=${activeFamilyId}&q=${search}`),
    enabled: !!activeFamilyId,
  });
  const saveMutation = useMutation({
    mutationFn: (data: any) => editingContact
      ? api(`/api/contacts/${editingContact.id}`, { method: 'PUT', body: JSON.stringify(data) })
      : api('/api/contacts', { method: 'POST', body: JSON.stringify({ ...data, familyId: activeFamilyId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(t('contacts.saveSuccess'));
      setIsDialogOpen(false);
      setEditingContact(null);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(t('contacts.deleteSuccess'));
      setContactToDelete(null);
    }
  });
  const handleOpenDialog = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({ name: contact.name, remarks: contact.remarks || "" });
    } else {
      setEditingContact(null);
      setFormData({ name: "", remarks: "" });
    }
    setIsDialogOpen(true);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    saveMutation.mutate(formData);
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('contacts.title')}</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{t('contacts.subtitle')}</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="rounded-full bg-[#E63946] hover:bg-rose-700 shadow-lg shadow-rose-100">
            <UserPlus className="h-4 w-4 mr-2" />
            {t('contacts.add')}
          </Button>
        </header>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('contacts.search')}
            className="pl-12 pr-12 h-14 bg-white border-none shadow-soft rounded-2xl focus-visible:ring-2 focus-visible:ring-rose-500/20"
          />
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-500"></div>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl" />)
          ) : !contacts?.length ? (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
              <User className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-slate-400 font-medium">{t('contacts.noContacts')}</p>
            </div>
          ) : (
            contacts.map(contact => (
              <Card key={contact.id} className="border-none shadow-soft rounded-2xl group hover:shadow-lg transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-lg flex-shrink-0">
                      {contact.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800">{contact.name}</h3>
                      {contact.remarks && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{contact.remarks}</p>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full"><MoreVertical className="h-4 w-4 text-slate-400" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl w-32">
                      <DropdownMenuItem onClick={() => handleOpenDialog(contact)} className="cursor-pointer">
                        <Edit2 className="h-4 w-4 mr-2" /> {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-rose-500 cursor-pointer"
                        onClick={() => setContactToDelete(contact.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{editingContact ? t('contacts.edit') : t('contacts.add')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('contacts.name')}</label>
              <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder={t('contacts.namePlaceholder')} className="rounded-xl bg-slate-50 border-none h-12" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('contacts.remarks')}</label>
              <Textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} placeholder={t('contacts.remarksPlaceholder')} className="rounded-xl bg-slate-50 border-none min-h-[100px] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="w-full h-12 rounded-xl bg-[#E63946] hover:bg-rose-700 font-bold">
              {saveMutation.isPending ? t('common.loading') : t('form.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('contacts.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={() => contactToDelete && deleteMutation.mutate(contactToDelete)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}