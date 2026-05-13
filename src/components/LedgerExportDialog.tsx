import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Image, FileImage, FileText, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LedgerExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (type: 'single-image' | 'image-zip' | 'pdf') => Promise<void>;
  isExporting: boolean;
}

export function LedgerExportDialog({ open, onOpenChange, onExport, isExporting }: LedgerExportDialogProps) {
  const { t } = useTranslation();

  const exportOptions = [
    {
      type: 'single-image' as const,
      title: t('ledgerExport.singleImage'),
      description: t('ledgerExport.singleImageDesc'),
      icon: Image,
      features: [t('ledgerExport.feature1'), t('ledgerExport.feature2'), t('ledgerExport.feature3')],
    },
    {
      type: 'image-zip' as const,
      title: t('ledgerExport.imageZip'),
      description: t('ledgerExport.imageZipDesc'),
      icon: FileImage,
      features: [t('ledgerExport.feature4'), t('ledgerExport.feature2'), t('ledgerExport.feature5')],
    },
    {
      type: 'pdf' as const,
      title: t('ledgerExport.pdf'),
      description: t('ledgerExport.pdfDesc'),
      icon: FileText,
      features: [t('ledgerExport.feature6'), t('ledgerExport.feature2'), t('ledgerExport.feature7')],
    },
  ];

  const handleExport = async (type: 'single-image' | 'image-zip' | 'pdf') => {
    try {
      await onExport(type);
      onOpenChange(false);
    } catch (error) {
      console.error('导出失败:', error);
      // 错误处理已在父组件中处理
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl border-none">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">{t('ledgerExport.title')}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {t('ledgerExport.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.type}
                className="cursor-pointer transition-all hover:shadow-md border-2 hover:border-rose-200"
                onClick={() => !isExporting && handleExport(option.type)}
              >
                <CardHeader className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 rounded-xl">
                      <Icon className="h-6 w-6 text-rose-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{option.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {option.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {/* <CardContent className="p-3 pt-0">
                  <div className="flex flex-wrap gap-2">
                    {option.features.map((feature, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </CardContent> */}
              </Card>
            );
          })}
        </div>

        {isExporting && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-3xl flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto mb-2"></div>
              <p className="text-sm text-slate-600">{t('ledgerExport.generating')}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}