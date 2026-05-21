import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [recording, setRecording] = React.useState(false);
  const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [textCommand, setTextCommand] = React.useState('');
  const [result, setResult] = React.useState<VoiceCommandResponse | null>(null);
  const [historyActions, setHistoryActions] = React.useState<VoiceActionResult[]>([]);
  const [ambiguousSelections, setAmbiguousSelections] = React.useState<Record<string, string>>({});
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

  React.useEffect(() => {
    if (!open) {
      setRecording(false);
      mediaRecorder?.state === 'recording' && mediaRecorder.stop();
      setMediaRecorder(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
      setError(null);
      setResult(null);
      setHistoryActions([]);
      setAmbiguousSelections({});
      setAudioBlob(null);
      setAudioUrl(null);
      setTextCommand('');
    }
  }, [open, mediaRecorder, stream]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持麦克风录音');
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
      console.error('麦克风权限失败', err);
      setError('无法获取麦克风权限');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;
    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('停止录音失败', err);
      setError('停止录音失败');
    }
  };

  const resetRecording = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    mediaRecorder?.state === 'recording' && mediaRecorder.stop();
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

    if (action.table === 'contacts') {
      if (action.operation === 'create') {
        return `新增联系人：${data.name || '未知'}${data.remarks ? `，备注：${data.remarks}` : ''}`;
      }
      if (action.operation === 'update') {
        return `编辑联系人：${data.name || '未知'}${data.newName ? ` → ${data.newName}` : ''}${data.remarks ? `，备注：${data.remarks}` : ''}`;
      }
      if (action.operation === 'delete') {
        return `删除联系人：${data.name || '未知'}`;
      }
    }

    if (action.table === 'ledgers') {
      if (action.operation === 'create') {
        return `新增账本：${data.title || '未知'}${data.date ? `，日期：${formatDate(data.date)}` : ''}${data.description ? `，描述：${data.description}` : ''}`;
      }
      if (action.operation === 'update') {
        return `编辑账本：${data.title || '未知'}${data.newTitle ? ` → ${data.newTitle}` : ''}${data.date ? `，日期：${formatDate(data.date)}` : ''}${data.description ? `，描述：${data.description}` : ''}`;
      }
      if (action.operation === 'delete') {
        return `删除账本：${data.title || '未知'}`;
      }
    }

    if (action.table === 'records' && action.operation === 'create') {
      return `新增记录：${data.personName || '未知'} ${data.type || ''} ${data.amount ?? ''}，类别：${data.eventType || '未知'}${data.ledgerTitle ? `，账本：${data.ledgerTitle}` : ''}${data.description ? `，说明：${data.description}` : ''}`;
    }

    return JSON.stringify(action);
  };

  const getActionKey = (action: any, index: number) => `${action.table}-${action.operation}-${index}`;

  const handleSelectCandidate = (key: string, candidateId: string) => {
    setAmbiguousSelections((prev) => ({ ...prev, [key]: candidateId }));
  };

  const handleConfirmSelected = async () => {
    if (!user?.activeFamilyId) {
      toast.error('请先选择家庭');
      return;
    }

    const ambiguousItems = result?.actions
      .map((item, index) => ({ item, index, key: getActionKey(item.action, index) }))
      .filter(({ item }) => item.ambiguous && item.candidates?.length > 0);

    const actionsToConfirm = ambiguousItems
      .filter(({ key }) => ambiguousSelections[key])
      .map(({ item, key }) => ({ action: item.action, confirmedId: ambiguousSelections[key] }));

    if (!actionsToConfirm.length) {
      setError('请先选择至少一个候选项进行确认');
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

      setResult({ instruction: '候选确认', actions: response.results });
      setHistoryActions((prev) => [...prev, ...response.results]);
      setAmbiguousSelections({});
      toast.success('候选项已确认');
    } catch (err: any) {
      console.error('AI 确认失败', err);
      setError(err.message || '确认失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!user?.activeFamilyId) {
      toast.error('请先选择家庭');
      return;
    }
    if (!textCommand.trim() && !audioBlob) {
      setError('请先输入指令或录音');
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
      toast.success('指令已执行');
    } catch (err: any) {
      console.error('AI 执行失败', err);
      setError(err.message || '执行失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[32px] px-6 pb-10 pt-4 max-w-lg mx-auto border-none h-[90vh] overflow-y-auto outline-none">
        <SheetHeader>
          <SheetTitle className="text-center text-xl font-bold">语音智能记账</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">语音录入</p>
                <p className="text-xs text-slate-500 mt-1">说中文，比如“帮我新增一个账目，给张三 200 元，类别 是 结婚礼金”。</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={recording ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? <StopCircle className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                  {recording ? '停止' : '开始'}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetRecording}>
                  <RefreshCcw className="h-4 w-4" /> 重录
                </Button>
              </div>
            </div>
            {audioUrl && (
              <div className="mt-4 rounded-3xl bg-white p-3 border border-slate-200">
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span>录音已生成，可试听后发送</span>
                  <span className="font-medium text-slate-900">{recording ? '录音中...' : '录音完成'}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <audio controls src={audioUrl} className="w-full" />
                  <Play className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">手动输入指令</p>
            <Textarea
              value={textCommand}
              onChange={(event) => setTextCommand(event.target.value)}
              placeholder="也可以直接输入，例如：新增一个记录，给李四 500 元，类别 是 生日礼物。"
              className="min-h-[120px] bg-slate-50 border border-slate-200"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-900">执行说明</p>
            <p className="text-xs text-slate-500 leading-relaxed">语音和文字指令会自动解析为增删改操作，并提交到当前家庭账本中。</p>
            <p className="text-xs text-slate-400">若同时提供语音和文字，则优先使用文字指令。</p>
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
              {isProcessing ? '执行中...' : '发送指令并执行'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>

          {result && (
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">已执行指令</p>
                <p className="text-xs text-slate-500 mt-1 break-words">{result.instruction}</p>
              </div>

              {result.actions.some((item) => item.ambiguous) && (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-sm font-semibold text-amber-900">需要确认的候选项</p>
                  {result.actions.map((item, index) =>
                    item.ambiguous ? (
                      <div key={index} className="rounded-2xl border border-amber-200 bg-amber-100 p-3">
                        <p className="text-sm font-semibold text-slate-900">候选操作 {index + 1}</p>
                        <p className="text-xs text-slate-600 mt-1">{formatActionSummary(item.action)}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {item.candidates?.map((candidate) => {
                            const key = getActionKey(item.action, index);
                            const selected = ambiguousSelections[key] === candidate.id;
                            const label = candidate.name || candidate.title || candidate.id;
                            return (
                              <Button
                                key={candidate.id}
                                variant={selected ? 'secondary' : 'outline'}
                                size="sm"
                                className="justify-start"
                                onClick={() => handleSelectCandidate(key, candidate.id)}
                              >
                                <span className="truncate">{label}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null,
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      选择候选项后，点击“确认所选候选”完成实际更新/删除操作。
                    </p>
                    <Button
                      type="button"
                      onClick={handleConfirmSelected}
                      disabled={isProcessing || !Object.keys(ambiguousSelections).length}
                    >
                      {isProcessing ? '确认中...' : '确认所选候选'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {historyActions.length > 0 && (
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">历史操作</p>
                <p className="text-xs text-slate-500 mt-1">显示当前会话内的所有 AI 指令结果。</p>
              </div>
              <div className="space-y-3">
                {historyActions.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl border p-3 ${item.success ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">历史操作 {index + 1}</p>
                    <p className="text-xs text-slate-600 mt-1">{formatActionSummary(item.action)}</p>
                    {item.ambiguous && <p className="text-xs text-amber-700 mt-2">需要确认：存在多个匹配项</p>}
                    {item.success ? (
                      <p className="text-xs text-emerald-700 mt-2">执行成功</p>
                    ) : item.error ? (
                      <p className="text-xs text-rose-700 mt-2">失败：{item.error}</p>
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
