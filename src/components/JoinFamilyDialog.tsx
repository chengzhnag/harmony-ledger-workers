import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";

export function JoinFamilyDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess?: (family: any) => void }) {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [code, setCode] = React.useState("");
  const queryClient = useQueryClient();
  const descriptionId = React.useId();
  const mutation = useMutation({
    mutationFn: (inviteCode: string) => api("/api/family/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode, userId: user?.id })
    }),
    onSuccess: (family: any) => {
      if (family?.id && family?.activeFamilyId && family?.familyIds) {
        login({
          id: family.id,
          name: family.name,
          activeFamilyId: family.activeFamilyId,
          familyIds: family.familyIds,
        });
      }
      toast.success(t('familyDialog.success', { name: family.name }));
      onSuccess?.(family);
      onOpenChange(false);
      setCode("");
    },
    onError: (err: any) => toast.error(err.message || t('familyDialog.error')),
  });
  const handleJoin = () => {
    if (!code.trim()) {
      toast.error(t('familyDialog.emptyCode'));
      return;
    }
    mutation.mutate(code.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl" aria-describedby={descriptionId}>
        <DialogHeader>
          <DialogTitle>{t('familyDialog.title')}</DialogTitle>
          <DialogDescription id={descriptionId}>
            {t('familyDialog.desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code" className="text-xs font-bold text-slate-500 uppercase">{t('familyDialog.label')}</Label>
            <Input
              id="invite-code"
              placeholder={t('familyDialog.placeholder')}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-12 border-slate-200 rounded-xl focus-visible:ring-[#E63946]"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            className="w-full h-12 rounded-xl bg-[#E63946] hover:bg-rose-700 font-bold"
            disabled={mutation.isPending}
            onClick={handleJoin}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('familyDialog.submitting')}
              </>
            ) : (
              t('familyDialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}