import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EVENT_TYPES } from '@/constants';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { ContactSelector } from "@/components/ContactSelector";
import type { Ledger, RenqingRecord } from "@shared/types";
const recordSchema = z.object({
  type: z.enum(["give", "receive"]),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  personName: z.string().min(1, "Name required"),
  contactId: z.string().optional(),
  eventType: z.string().min(1, "Event type required"),
  description: z.string().optional(),
  ledgerId: z.string().optional(),
});
type FormValues = z.infer<typeof recordSchema>;
interface AddRecordSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinnedLedgerId?: string;
  recordToEdit?: RenqingRecord;
}
export function AddRecordSheet({ open, onOpenChange, pinnedLedgerId, recordToEdit }: AddRecordSheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const { data: ledgers } = useQuery({
    queryKey: ["ledgers", user?.activeFamilyId],
    queryFn: () => api<Ledger[]>(`/api/ledgers?familyId=${user?.activeFamilyId}`),
    enabled: !!user?.activeFamilyId && open && !pinnedLedgerId,
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      type: "give",
      amount: 0,
      personName: "",
      contactId: "",
      eventType: "wedding",
      description: "",
      ledgerId: pinnedLedgerId || ""
    },
  });
  React.useEffect(() => {
    if (open) {
      if (recordToEdit) {
        form.reset({
          type: recordToEdit.type,
          amount: recordToEdit.amount,
          personName: recordToEdit.personName,
          contactId: recordToEdit.contactId || "",
          eventType: recordToEdit.eventType,
          description: recordToEdit.description || "",
          ledgerId: recordToEdit.ledgerId || (pinnedLedgerId || ""),
        });
      } else {
        form.reset({
          type: "give",
          amount: 0,
          personName: "",
          contactId: "",
          eventType: "wedding",
          description: "",
          ledgerId: pinnedLedgerId || ""
        });
      }
      setTimeout(() => amountInputRef.current?.focus(), 300);
    }
  }, [open, pinnedLedgerId, recordToEdit, form]);
  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const url = recordToEdit ? `/api/records/${recordToEdit.id}` : "/api/records";
      const method = recordToEdit ? "PATCH" : "POST";
      return api(url, {
        method,
        body: JSON.stringify({ ...data, familyId: user?.activeFamilyId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      toast.success(t('form.saveSuccess'));
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => toast.error(e.message || t('form.saveError')),
  });
  const onSubmit: SubmitHandler<FormValues> = (values) => {
    if (!user?.activeFamilyId) {
      toast.error(t('form.noFamily'));
      return;
    }
    const payload = { ...values };
    if (!payload.ledgerId || payload.ledgerId === "none") payload.ledgerId = undefined;
    if (!payload.contactId) payload.contactId = undefined;
    mutation.mutate(payload);
  };
  const watchType = form.watch("type");
  const watchPerson = form.watch("personName");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[32px] px-6 pb-10 pt-4 max-w-lg mx-auto border-none h-[90vh] overflow-y-auto outline-none">
        {/* <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 mb-6" /> */}
        <SheetHeader>
          <SheetTitle className="text-center text-xl font-bold">
            {recordToEdit ? t('form.editTitle') : t('form.title')}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            {(['give', 'receive'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => form.setValue("type", type)}
                className={cn(
                  "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                  watchType === type ? "bg-white shadow-sm " + (type === 'give' ? "text-rose-600" : "text-emerald-600") : "text-slate-500"
                )}
              >
                {type === 'give' ? t('form.give') : t('form.receive')}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {!pinnedLedgerId && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('form.ledger')}</Label>
                <Select onValueChange={(v) => form.setValue("ledgerId", v)} value={form.watch("ledgerId")}>
                  <SelectTrigger className="bg-slate-50 border-none rounded-xl h-12">
                    <SelectValue placeholder={t('form.ledger_none')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('form.ledger_none')}</SelectItem>
                    {ledgers?.map(ledger => (
                      <SelectItem key={ledger.id} value={ledger.id}>{ledger.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 text-center py-4">
              <span className="text-sm font-medium text-slate-500">{t('form.amount')} (CNY)</span>
              <input
                {...form.register("amount", { valueAsNumber: true })}
                ref={(e) => {
                  form.register("amount").ref(e);
                  (amountInputRef as any).current = e;
                }}
                type="number"
                step="0.01"
                className="w-full h-16 text-4xl font-bold text-center border-none shadow-none focus-visible:outline-none bg-transparent p-0"
                placeholder={t('form.amountPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('form.person')}</Label>
                <ContactSelector
                  value={watchPerson}
                  onSelect={(contact) => {
                    form.setValue("personName", contact.name);
                    form.setValue("contactId", contact.id || "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('form.category')}</Label>
                <Select onValueChange={(v) => form.setValue("eventType", v)} value={form.watch("eventType")}>
                  <SelectTrigger className="bg-slate-50 border-none rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('form.description')} {t('form.optional')}</Label>
              <Textarea
                {...form.register("description")}
                className="bg-slate-50 border-none rounded-xl min-h-[100px] resize-none focus-visible:ring-1 focus-visible:ring-slate-200"
                placeholder={t('form.note')}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              "w-full h-14 rounded-2xl text-lg font-bold shadow-lg mt-4 transition-all active:scale-95",
              watchType === 'give' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
            )}
          >
            {mutation.isPending ? t('form.saving') : (recordToEdit ? t('form.update') : t('form.submit'))}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}