import * as React from 'react';

const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

const getSupportedMimeType = () => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }
  return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
};

export interface AudioRecorderState {
  recording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): AudioRecorderState {
  const [recording, setRecording] = React.useState(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  const supportedMimeType = React.useMemo(() => getSupportedMimeType(), []);
  const isSupported = Boolean(
    supportedMimeType && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia,
  );

  const cleanupMedia = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  const resetRecording = React.useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanupMedia();
    setRecording(false);
    setAudioBlob(null);
    setAudioUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
  }, [cleanupMedia]);

  const startRecording = React.useCallback(async () => {
    if (!isSupported || !supportedMimeType) {
      throw new Error('Audio recording is not supported');
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(mediaStream, { mimeType: supportedMimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: supportedMimeType });
      setAudioBlob(blob);
      setAudioUrl((prevUrl) => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return URL.createObjectURL(blob);
      });
      setRecording(false);
      cleanupMedia();
    };

    recorder.start();
    streamRef.current = mediaStream;
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setAudioBlob(null);
    setAudioUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
  }, [cleanupMedia, isSupported, supportedMimeType]);

  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  React.useEffect(() => {
    return () => {
      resetRecording();
    };
  }, [resetRecording]);

  return {
    recording,
    audioBlob,
    audioUrl,
    isSupported,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
