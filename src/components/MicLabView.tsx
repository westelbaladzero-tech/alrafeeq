"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, Volume2 } from "lucide-react";

type UploadResult = {
  ok: boolean;
  bytes?: number;
  mimeType?: string;
  message?: string;
  transcript?: string;
  error?: string;
};

export default function MicLabView() {
  const [supported, setSupported] = useState(() => typeof window !== "undefined" && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("جاهز لاختبار الميكروفون بشكل مستقل.");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const canStart = useMemo(() => supported && !recording && !uploading, [supported, recording, uploading]);
  const canStop = useMemo(() => recording && !uploading, [recording, uploading]);
  const canUpload = useMemo(() => !!audioBlob && !recording && !uploading, [audioBlob, recording, uploading]);

  async function startRecording() {
    if (!canStart) return;

    try {
      setResult(null);
      setAudioBlob(null);
      setStatus("نطلب إذن الميكروفون الآن...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const nextUrl = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setStatus("تم حفظ التسجيل. استمع له أولًا، ثم اضغط زر الإرسال للتفريغ.");
        cleanupStream();
      };

      recorder.start();
      setRecording(true);
      setStatus("جاري التسجيل... تكلم الآن ثم أوقف الاختبار.");
    } catch {
      setSupported(!!window.MediaRecorder);
      setStatus("تعذر الوصول إلى الميكروفون. تأكد من الإذن ثم جرّب مرة ثانية.");
      cleanupStream();
    }
  }

  function stopRecording() {
    if (!canStop || !mediaRecorderRef.current) return;
    setRecording(false);
    setStatus("أوقفنا التسجيل ونجهز المعاينة الآن...");
    mediaRecorderRef.current.stop();
  }

  async function uploadRecording(blob: Blob) {
    setUploading(true);
    setResult(null);
    setStatus("نرسل التسجيل الآن إلى مسار التفريغ...");

    try {
      const formData = new FormData();
      formData.append("audio", blob, `mic-test-${Date.now()}.webm`);

      const res = await fetch("/api/mic-test", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل اختبار الميكروفون");

      setResult(data);
      setStatus(data.message || "وصل التسجيل للمسار التجريبي بنجاح.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل اختبار الميكروفون";
      setResult({ ok: false, error: message });
      setStatus(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleUpload() {
    if (!audioBlob || uploading || recording) return;
    await uploadRecording(audioBlob);
  }

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }

  return (
    <div className="h-full overflow-auto p-4 bg-[var(--bg)]">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-white rounded-3xl border border-[var(--soft)] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--soft)] text-[var(--accent)] flex items-center justify-center">
              <Mic size={20} />
            </div>
            <div>
              <h2 className="font-bold text-[var(--accent-dark)]">اختبار الميكروفون</h2>
              <p className="text-xs text-[var(--muted)]">مسار منفصل عن المحادثة والردود، فقط لالتقاط التسجيل ورفعه واختبار الجاهزية.</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-warm)] px-4 py-3 text-sm text-[var(--text)] leading-7">
            {status}
          </div>

          {!supported && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              هذا المتصفح لا يدعم تسجيل الميكروفون بالطريقة المطلوبة حاليًا.
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={startRecording}
              disabled={!canStart}
              className="rounded-2xl bg-[var(--accent)] text-white py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Mic size={18} />
              ابدأ التسجيل
            </button>
            <button
              onClick={stopRecording}
              disabled={!canStop}
              className="rounded-2xl bg-red-500 text-white py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Square size={18} />
              أوقف التسجيل
            </button>
            <button
              onClick={handleUpload}
              disabled={!canUpload}
              className="rounded-2xl bg-emerald-600 text-white py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={18} />
              أرسل للتفريغ
            </button>
          </div>
        </div>

        {audioUrl && (
          <div className="bg-white rounded-3xl border border-[var(--soft)] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-[var(--accent-dark)] font-bold">
              <Volume2 size={18} />
              معاينة التسجيل
            </div>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}

        <div className="bg-white rounded-3xl border border-[var(--soft)] p-5 shadow-sm">
          <div className="font-bold text-[var(--accent-dark)] mb-3">نتيجة المسار التجريبي</div>

          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 size={16} className="animate-spin" />
              نرفع التسجيل الآن وننتظر الرد...
            </div>
          ) : result ? (
            <div className="space-y-2 text-sm">
              <div>الحالة: <span className={result.ok ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{result.ok ? "نجح" : "فشل"}</span></div>
              {typeof result.bytes === "number" && <div>الحجم: {result.bytes} بايت</div>}
              {result.mimeType && <div>النوع: {result.mimeType}</div>}
              {result.message && <div>الرسالة: {result.message}</div>}
              {result.transcript && (
                <div className="mt-3 rounded-2xl bg-[var(--bg-warm)] px-4 py-3 leading-7 text-[var(--text)]">
                  <div className="font-bold text-[var(--accent-dark)] mb-1">النص المفرغ</div>
                  <div>{result.transcript}</div>
                </div>
              )}
              {result.error && <div className="text-red-600">{result.error}</div>}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">بعد أول تسجيل سترى هنا هل وصل الملف للمسار المنفصل وهل تم تفريغه إلى نص.</div>
          )}
        </div>
      </div>
    </div>
  );
}
