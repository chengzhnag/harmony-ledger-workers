import * as React from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContactSelector } from "@/components/ContactSelector";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Mic2, StopCircle, RefreshCcw, Play } from "lucide-react";

interface VoiceCommandSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type VoiceActionResult = {
  action: any;
  success: boolean;
  result?: any;
  error?: string;
  ambiguous?: boolean;
  candidates?: any[];
};

type VoiceCommandResponse = {
  instruction: string;
  actions: VoiceActionResult[];
};

const CREATE_NEW_CONTACT_OPTION = "__CREATE_NEW_CONTACT__";

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      } else {
        reject(new Error('无法读取音频'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export function VoiceCommandSheet({ open, onOpenChange }: VoiceCommandSheetProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [recording, setRecording] = React.useState(false);
  const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [textCommand, setTextCommand] = React.useState('');
  const [result, setResult] = React.useState<VoiceCommandResponse | null>(null);
  const [historyActions, setHistoryActions] = React.useState<VoiceActionResult[]>([]);
  const [ambiguousSelections, setAmbiguousSelections] = React.useState<Record<string, string>>({});
  const [contactSelectorValues, setContactSelectorValues] = React.useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [stream, audioUrl]);

  const prevOpenRef = React.useRef(open);

  React.useEffect(() => {
    if (prevOpenRef.current && !open) {
      const hasLedgerOrRecordSuccess = historyActions.some(
        (item) => item.success && ['ledgers', 'records'].includes(item.action?.table),
      );
      const hasContactSuccess = historyActions.some(
        (item) => item.success && item.action?.table === 'contacts',
      );

      if (location.pathname.startsWith('/ledgers') && hasLedgerOrRecordSuccess) {
        queryClient.invalidateQueries({ queryKey: ['ledgers'] });
        queryClient.invalidateQueries({ queryKey: ['records'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
      }
      if (location.pathname.startsWith('/contacts') && hasContactSuccess) {
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }
    }
    prevOpenRef.current = open;
  }, [open, historyActions, location.pathname, queryClient]);

  React.useEffect(() => {
    if (!open) {
      setRecording(false);
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
      }
      setMediaRecorder(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
      setError(null);
      setResult(null);
      setHistoryActions([]);
      setAmbiguousSelections({});
      setContactSelectorValues({});
      setAudioBlob(null);
      setAudioUrl(null);
      setTextCommand('');
    }
  }, [open, mediaRecorder, stream]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('voiceCommand.errors.noMicrophone'));
      return;
    }

    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(mediaStream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
      };

      recorder.start();
      setStream(mediaStream);
      setMediaRecorder(recorder);
      setRecording(true);
      setResult(null);
      setError(null);
    } catch (err) {
      console.error(t('voiceCommand.errors.microphoneFail'), err);
      setError(t('voiceCommand.errors.microphoneFail'));
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;
    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error(t('voiceCommand.errors.stopFailed'), err);
      setError(t('voiceCommand.errors.stopFailed'));
    }
  };

  const resetRecording = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
    }
    setMediaRecorder(null);
    setStream(null);
    setRecording(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setResult(null);
    setError(null);
  };

  const formatActionSummary = (action: any) => {
    if (!action || !action.table || !action.operation) return JSON.stringify(action);
    const data = action.data || {};
    const formatDate = (value: unknown) => {
      if (typeof value === 'number') return new Date(value).toLocaleString();
      if (typeof value === 'string') return value;
      return '';
    };

    const getLabel = (value: unknown, defaultKey: string) => {
      if (typeof value === 'string' && value.trim()) return value;
      return t(defaultKey);
    };

    const remarks = data.remarks ? t('voiceCommand.suffix.remarks', { remarks: data.remarks }) : '';
    const newName = data.newName ? t('voiceCommand.suffix.arrow', { value: data.newName }) : '';
    const newTitle = data.newTitle ? t('voiceCommand.suffix.arrow', { value: data.newTitle }) : '';
    const dateText = data.date ? t('voiceCommand.suffix.date', { date: formatDate(data.date) }) : '';
    const descriptionText = data.description ? t('voiceCommand.suffix.description', { description: data.description }) : '';
    const ledgerText = data.ledgerTitle ? t('voiceCommand.suffix.ledger', { ledgerTitle: data.ledgerTitle }) : '';
    const noteText = data.description ? t('voiceCommand.suffix.note', { description: data.description }) : '';

    if (action.table === 'contacts') {
      if (action.operation === 'create') {
        return t('voiceCommand.summary.contacts.create', {
          name: getLabel(data.name, 'voiceCommand.unknown'),
          remarks,
        });
      }
      if (action.operation === 'update') {
        return t('voiceCommand.summary.contacts.update', {
          name: getLabel(data.name, 'voiceCommand.unknown'),
          newName,
          remarks,
        });
      }
      if (action.operation === 'delete') {
        return t('voiceCommand.summary.contacts.delete', {
          name: getLabel(data.name, 'voiceCommand.unknown'),
        });
      }
    }

    if (action.table === 'ledgers') {
      if (action.operation === 'create') {
        return t('voiceCommand.summary.ledgers.create', {
          title: getLabel(data.title, 'voiceCommand.unknown'),
          date: dateText,
          description: descriptionText,
        });
      }
      if (action.operation === 'update') {
        return t('voiceCommand.summary.ledgers.update', {
          title: getLabel(data.title, 'voiceCommand.unknown'),
          newTitle,
          date: dateText,
          description: descriptionText,
        });
      }
      if (action.operation === 'delete') {
        return t('voiceCommand.summary.ledgers.delete', {
          title: getLabel(data.title, 'voiceCommand.unknown'),
        });
      }
    }

    if (action.table === 'records' && action.operation === 'create') {
      return t('voiceCommand.summary.records.create', {
        personName: getLabel(data.personName, 'voiceCommand.unknown'),
        type: data.type || '',
        amount: data.amount ?? '',
        eventType: getLabel(data.eventType, 'voiceCommand.unknown'),
        ledgerTitle: ledgerText,
        description: noteText,
      });
    }

    return JSON.stringify(action);
  };

  const formatCandidateDetail = (candidate: any, table: string) => {
    const formatDate = (value: unknown) => {
      if (typeof value === 'number') return new Date(value).toLocaleDateString();
      if (typeof value === 'string') return value;
      return '';
    };

    if (table === 'contacts') {
      return candidate.remarks ? candidate.remarks : '';
    }

    if (table === 'ledgers') {
      const dateText = candidate.date ? formatDate(candidate.date) : '';
      const descText = candidate.description ? candidate.description : '';
      return [dateText, descText].filter(Boolean).join(' · ');
    }

    return '';
  };

  const clearPreviousRecording = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setMediaRecorder(null);
    setRecording(false);
  };

  const getActionKey = (action: any, index: number) => `${action.table}-${action.operation}-${index}`;

  const handleSelectCandidate = (key: string, candidateId: string, label?: string) => {
    setAmbiguousSelections((prev) => ({ ...prev, [key]: candidateId }));
    if (label) {
      setContactSelectorValues((prev) => ({ ...prev, [key]: label }));
    }
  };

  const handleConfirmSelected = async () => {
    if (!user?.activeFamilyId) {
      toast.error(t('voiceCommand.errors.noFamily'));
      return;
    }

    const ambiguousItems = result?.actions
      .map((item, index) => ({ item, index, key: getActionKey(item.action, index) }))
      .filter(({ item }) => item.ambiguous);

    const actionsToConfirm = ambiguousItems
      .filter(({ key }) => ambiguousSelections[key])
      .map(({ item, key }) => ({ action: item.action, confirmedId: ambiguousSelections[key] }));

    if (!actionsToConfirm.length) {
      setError(t('voiceCommand.errors.noCandidateSelected'));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await api<{ results: VoiceActionResult[] }>('/api/ai/confirm', {
        method: 'POST',
        body: JSON.stringify({
          familyId: user.activeFamilyId,
          actions: actionsToConfirm,
        }),
      });

      setResult({ instruction: t('voiceCommand.confirmedTitle'), actions: response.results });
      setHistoryActions((prev) => [...prev, ...response.results]);
      setAmbiguousSelections({});
      toast.success(t('voiceCommand.toast.confirmed'));
    } catch (err: any) {
      console.error(t('voiceCommand.errors.confirmFail'), err);
      setError(err.message || t('voiceCommand.errors.confirmFail'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!user?.activeFamilyId) {
      toast.error(t('voiceCommand.errors.noFamily'));
      return;
    }
    if (!textCommand.trim() && !audioBlob) {
      setError(t('voiceCommand.errors.noCommand'));
      return;
    }
    setIsProcessing(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        familyId: user.activeFamilyId,
        language: 'zh',
      };

      if (audioBlob && !textCommand.trim()) {
        payload.audioBase64 = await blobToBase64(audioBlob);
      } else {
        payload.text = textCommand.trim();
      }

      const response = await api<VoiceCommandResponse>('/api/ai/execute', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setResult(response);
      setHistoryActions((prev) => [...prev, ...response.actions]);
      clearPreviousRecording();
      toast.success(t('voiceCommand.toast.executed'));
    } catch (err: any) {
      console.error(t('voiceCommand.errors.executeFail'), err);
      setError(err.message || t('voiceCommand.errors.executeFail'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[32px] px-6 pb-10 pt-4 max-w-lg mx-auto border-none h-[90vh] overflow-y-auto outline-none">
        <SheetHeader>
          <SheetTitle className="text-center text-xl font-bold">{t('voiceCommand.title')}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.voiceInput')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('voiceCommand.voiceHint')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={recording ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? <StopCircle className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                  {recording ? t('voiceCommand.stop') : t('voiceCommand.start')}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetRecording}>
                  <RefreshCcw className="h-4 w-4" /> {t('voiceCommand.reRecord')}
                </Button>
              </div>
            </div>
            {audioUrl && (
              <div className="mt-4 rounded-3xl bg-white p-3 border border-slate-200">
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span>{t('voiceCommand.audioReady')}</span>
                  <span className="font-medium text-slate-900">{recording ? t('voiceCommand.recording') : t('voiceCommand.recorded')}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <audio controls src={audioUrl} className="w-full" />
                  <Play className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.manualInput')}</p>
            <Textarea
              value={textCommand}
              onChange={(event) => setTextCommand(event.target.value)}
              placeholder={t('voiceCommand.manualPlaceholder')}
              className="min-h-[120px] bg-slate-50 border border-slate-200"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.instructionsTitle')}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{t('voiceCommand.instructionsDescription')}</p>
            <p className="text-xs text-slate-400">{t('voiceCommand.instructionsNote')}</p>
          </div>

          {error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || (!textCommand.trim() && !audioBlob)}
              className="w-full h-14 rounded-2xl text-base font-bold"
            >
              {isProcessing ? t('voiceCommand.loading.execute') : t('voiceCommand.send')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('voiceCommand.close')}
            </Button>
          </div>

          {result && (
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.executedTitle')}</p>
                <p className="text-xs text-slate-500 mt-1 break-words">{result.instruction}</p>
              </div>

              {result.actions.some((item) => item.ambiguous) && (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-sm font-semibold text-amber-900">{t('voiceCommand.ambiguousTitle')}</p>
                  {result.actions.map((item, index) => {
                    if (!item.ambiguous) {
                      return null;
                    }
                    const key = getActionKey(item.action, index);
                    return (
                      <div key={index} className="rounded-2xl border border-amber-200 bg-amber-100 p-3">
                        <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.candidateAction', { index: index + 1 })}</p>
                        <p className="text-xs text-slate-600 mt-1">{formatActionSummary(item.action)}</p>
                        {item.candidates?.length === 0 && item.action.table === 'records' ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 mt-3">
                            <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.recordNoContactTitle')}</p>
                            <p className="text-xs text-slate-600">{t('voiceCommand.recordNoContactDescription', { name: item.action.data.personName || '' })}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button
                                type="button"
                                variant={ambiguousSelections[key] === CREATE_NEW_CONTACT_OPTION ? 'secondary' : 'outline'}
                                size="sm"
                                className="justify-start rounded-2xl border p-4 text-left transition-all duration-150"
                                onClick={() => handleSelectCandidate(key, CREATE_NEW_CONTACT_OPTION)}
                              >
                                <div className="text-sm font-semibold leading-snug">{t('voiceCommand.createContactAndExecute')}</div>
                                <div className="mt-1 text-xs leading-snug text-slate-500">{t('voiceCommand.createContactAndExecuteHint')}</div>
                              </Button>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.selectExistingContact')}</p>
                                <ContactSelector
                                  value={contactSelectorValues[key] || item.action.data.personName || ''}
                                  onSelect={(contact) => handleSelectCandidate(key, contact.id || contact.name, contact.name)}
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {item.candidates?.map((candidate) => {
                            const selected = ambiguousSelections[key] === candidate.id;
                            const label = candidate.name || candidate.title || candidate.id;
                            const details = formatCandidateDetail(candidate, item.action.table);
                            return (
                              <Button
                                key={candidate.id}
                                variant={selected ? 'secondary' : 'outline'}
                                size="sm"
                                className={
                                  `justify-start rounded-2xl border p-4 text-left transition-all duration-150 ${selected
                                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400'
                                  }`
                                }
                                onClick={() => handleSelectCandidate(key, candidate.id)}
                              >
                                <div className="w-full">
                                  <div className="text-sm font-semibold leading-snug">{label}</div>
                                  {details ? (
                                    <div className="mt-1 text-xs leading-snug text-slate-500">{details}</div>
                                  ) : null}
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      {t('voiceCommand.candidateHelp')}
                    </p>
                    <Button
                      type="button"
                      onClick={handleConfirmSelected}
                      disabled={isProcessing || !Object.keys(ambiguousSelections).length}
                    >
                      {isProcessing ? t('voiceCommand.loading.confirm') : t('voiceCommand.confirmSelected')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {historyActions.length > 0 && (
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.historyTitle')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('voiceCommand.historyDescription')}</p>
              </div>
              <div className="space-y-3">
                {historyActions.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl border p-3 ${item.success ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{t('voiceCommand.historyItem.title', { index: index + 1 })}</p>
                    <p className="text-xs text-slate-600 mt-1">{formatActionSummary(item.action)}</p>
                    {item.ambiguous && <p className="text-xs text-amber-700 mt-2">{t('voiceCommand.historyItem.ambiguous')}</p>}
                    {item.success ? (
                      <p className="text-xs text-emerald-700 mt-2">{t('voiceCommand.historyItem.success')}</p>
                    ) : item.error ? (
                      <p className="text-xs text-rose-700 mt-2">{t('voiceCommand.historyItem.error', { error: item.error })}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
