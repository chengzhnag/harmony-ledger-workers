import React, { useRef, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EVENT_TYPES } from '@/constants';
interface SocialShareCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: { netBalance: number; topEventType: string; totalGiven?: number; totalReceived?: number; maxAmount?: number; monthlyTrends?: any[]; categoryDistribution?: any[] };
  userName: string;
}
export function SocialShareCard({ open, onOpenChange, stats, userName }: SocialShareCardProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const margin = 24;
    const width = canvas.width;
    const contentWidth = width - margin * 2;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, width, 600);
    grad.addColorStop(0, "#E63946");
    grad.addColorStop(1, "#b91c1c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 600);

    // Header
    ctx.fillStyle = "white";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(t('shareCard.title'), margin, 50);

    // User Name
    ctx.font = "16px sans-serif";
    ctx.globalAlpha = 0.8;
    ctx.fillText(t('shareCard.report', { name: userName }), margin, 85);
    ctx.globalAlpha = 1;

    // Balance Area
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(margin, 115, contentWidth, 140, 16);
    } else {
      ctx.rect(margin, 115, contentWidth, 140);
    }
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(t('shareCard.balanceLabel'), margin + 20, 145);

    ctx.font = "bold 44px sans-serif";
    ctx.fillText(`¥${stats.netBalance.toLocaleString()}`, margin + 20, 205);

    // Stats Row: Total Given & Received
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(margin, 270, contentWidth / 2 - 8, 90, 12);
    } else {
      ctx.rect(margin, 270, contentWidth / 2 - 8, 90);
    }
    ctx.fill();

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(margin + contentWidth / 2 + 8, 270, contentWidth / 2 - 8, 90, 12);
    } else {
      ctx.rect(margin + contentWidth / 2 + 8, 270, contentWidth / 2 - 8, 90);
    }
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(t('contactDetail.totalGiven'), margin + 16, 295);
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`¥${(stats.totalGiven || 0).toLocaleString()}`, margin + 16, 335);

    ctx.font = "bold 12px sans-serif";
    ctx.fillText(t('contactDetail.totalReceived'), margin + contentWidth / 2 + 24, 295);
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`¥${(stats.totalReceived || 0).toLocaleString()}`, margin + contentWidth / 2 + 24, 335);

    // Top Category & Max Amount
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(margin, 375, contentWidth, 90, 12);
    } else {
      ctx.rect(margin, 375, contentWidth, 90);
    }
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(t('shareCard.topEventLabel'), margin + 16, 400);
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(t(EVENT_TYPES.find(et => et.value === stats.topEventType)?.label || stats.topEventType), margin + 16, 430);

    ctx.font = "bold 12px sans-serif";
    ctx.fillText(t('analytics.maxGift'), margin + contentWidth / 2 + 24, 400);
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`¥${(stats.maxAmount || 0).toLocaleString()}`, margin + contentWidth / 2 + 24, 430);

    // QR Code at bottom right
    try {
      const domain = window.location.origin;
      const qrDataUrl = await QRCode.toDataURL(domain, {
        width: 64,
        margin: 1,
        color: { dark: '#E63946', light: '#FFFFFF' },
      });
      const qrImg = new Image();
      qrImg.onload = () => {
        const qrWidth = 64;
        const qrHeight = 64;
        const qrX = width - margin - qrWidth;
        const qrY = 575 - qrHeight;

        // White background for QR
        ctx.fillStyle = "white";
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(qrX - 4, qrY - 4, qrWidth + 8, qrHeight + 8, 4);
        } else {
          ctx.rect(qrX - 4, qrY - 4, qrWidth + 8, qrHeight + 8);
        }
        ctx.fill();

        ctx.drawImage(qrImg, qrX, qrY, qrWidth, qrHeight);

        // Brand Footer
        ctx.font = "13px sans-serif";
        ctx.globalAlpha = 0.6;
        ctx.fillText(t('shareCard.footer'), margin, 575);
      };
      qrImg.src = qrDataUrl;
    } catch (e) {
      console.warn('QR code generation failed', e);
      // Brand Footer fallback
      ctx.font = "13px sans-serif";
      ctx.globalAlpha = 0.6;
      ctx.fillText(t('shareCard.footer'), margin, 575);
    }
  }, [userName, stats, t]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(async () => { await drawCard(); }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, drawCard]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `Harmony_Ledger_Report_${Date.now()}.png`;
    link.click();
    toast.success(t('shareCard.saveSuccess'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden border-none rounded-[32px]">
        <div className="flex flex-col items-center bg-slate-50 p-4 pt-10">
          <canvas ref={canvasRef} width={400} height={600} className="w-full h-auto rounded-2xl shadow-2xl" />
          <div className="mt-6 flex gap-4 w-full">
            <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => onOpenChange(false)}>
              {t('shareCard.close')}
            </Button>
            <Button className="flex-1 rounded-xl h-12 bg-[#E63946] hover:bg-rose-700 font-bold" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              {t('shareCard.download')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}