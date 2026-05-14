import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
export function CreateLedgerSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const schema = z.object({
    title: z.string().min(1, t('ledgerForm.titleRequired')),
    date: z.string().min(1, t('ledgerForm.dateRequired')),
    description: z.string().optional(),
  });
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", date: new Date().toISOString().split('T')[0], description: "" },
  });
  const mutation = useMutation({
    mutationFn: (data: FormValues) => api("/api/ledgers", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        date: new Date(data.date).getTime(),
        familyId: user?.activeFamilyId
      })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      toast.success(t('ledgerForm.success'));
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => toast.error(e.message || t('ledgerForm.error')),
  });
  const onSubmit = (values: FormValues) => {
    if (!user?.activeFamilyId) {
      toast.error(t('form.noFamily'));
      return;
    }
    mutation.mutate(values);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[32px] px-6 pb-10 pt-4 max-w-lg mx-auto border-none">
        {/* <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 mb-6" /> */}
        <SheetHeader>
          <SheetTitle className="text-center text-xl font-bold">{t('ledgerForm.title')}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('ledgerForm.name')}</Label>
            <Input {...form.register("title")} placeholder={t('ledgerForm.namePlaceholder')} className="bg-slate-50 border-none rounded-xl h-12" />
            {form.formState.errors.title && <p className="text-xs text-rose-500">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('ledgerForm.date')}</Label>
            <Input type="date" {...form.register("date")} className="bg-slate-50 border-none rounded-xl h-12" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('ledgerForm.note')}</Label>
            <Input {...form.register("description")} placeholder={t('ledgerForm.notePlaceholder')} className="bg-slate-50 border-none rounded-xl h-12" />
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg bg-[#E63946] hover:bg-rose-700 transition-all active:scale-95"
          >
            {mutation.isPending ? t('ledgerForm.submitting') : t('ledgerForm.submit')}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}