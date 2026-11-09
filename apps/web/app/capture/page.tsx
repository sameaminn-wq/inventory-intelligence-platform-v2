'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../components/app-shell';
import { evaluateCaptureFrame } from '../../lib/capture-guidance.cjs';
import { saveCaptureSession } from '../../lib/capture-session-store';

type Metrics = { blur: number; glare: number; clipped: number; brightness: number };
type Guidance = { action: string; message: string; reasons: string[] };
type CaptureMode = 'wide' | 'section' | 'alternate';
const MAX_SESSION_IMAGES = 8;
const MAX_SESSION_IMAGE_BYTES = 20 * 1024 * 1024;

type CapturedFrame = {
  id: string;
  viewType: CaptureMode;
  capturedAt: string;
  dataUrl: string;
  metrics: Metrics;
  overlap: 'not_applicable' | 'low' | 'adequate' | 'high';
};

function measureFrame(canvas: HTMLCanvasElement): Metrics {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('تعذر فحص إطار الكاميرا.');
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const sample = Math.max(1, Math.floor(Math.sqrt((width * height) / 12000)));
  let brightness = 0, glare = 0, clipped = 0, count = 0;
  const gray: number[] = [];
  for (let y = 0; y < height; y += sample) {
    for (let x = 0; x < width; x += sample) {
      const i = (y * width + x) * 4;
      const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray.push(value);
      brightness += value / 255;
      if (value >= 248) glare++;
      if (value <= 5 || value >= 250) clipped++;
      count++;
    }
  }
  let laplacianEnergy = 0, lapCount = 0;
  const cols = Math.ceil(width / sample);
  const rows = Math.ceil(height / sample);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const i = y * cols + x;
      const value = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - cols] - gray[i + cols];
      laplacianEnergy += value * value;
      lapCount++;
    }
  }
  const variance = lapCount ? laplacianEnergy / lapCount : 0;
  return {
    blur: Math.max(0, Math.min(1, variance / 1800)),
    glare: count ? glare / count : 0,
    clipped: count ? clipped / count : 0,
    brightness: count ? brightness / count : 0,
  };
}


export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState('لم يتم تشغيل الكاميرا');
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [advice, setAdvice] = useState<Guidance | null>(null);
  const [motion, setMotion] = useState('غير متاح');
  const [motionScore, setMotionScore] = useState<number | null>(null);
  const lastAccelerationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const motionHandlerRef = useRef<((event: DeviceMotionEvent) => void) | null>(null);
  const [captured, setCaptured] = useState<CapturedFrame[]>([]);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('wide');
  const [overlap, setOverlap] = useState<'low' | 'adequate' | 'high'>('adequate');
  const [sessionId, setSessionId] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (motionHandlerRef.current) window.removeEventListener('devicemotion', motionHandlerRef.current);
  }, []);

  async function startCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('المتصفح لا يدعم تشغيل الكاميرا هنا. استخدم اتصال HTTPS أو متصفحًا حديثًا.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('الكاميرا تعمل');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر الوصول إلى الكاميرا. تحقق من الإذن.');
      setCameraState('تعذر تشغيل الكاميرا');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (motionHandlerRef.current) {
      window.removeEventListener('devicemotion', motionHandlerRef.current);
      motionHandlerRef.current = null;
    }
    lastAccelerationRef.current = null;
    setMotionScore(null);
    setMotion('تم إيقاف قراءة الحركة');
    setCameraState('تم إيقاف الكاميرا');
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || busy) return;
    if (captured.length >= MAX_SESSION_IMAGES) {
      setError(`وصلت إلى الحد الحالي وهو ${MAX_SESSION_IMAGES} صور للجلسة الواحدة. صدّر الجلسة أو ابدأ جلسة جديدة.`);
      return;
    }
    if (captureMode !== 'wide' && !captured.some((frame) => frame.viewType === 'wide')) {
      setError('ابدأ بصورة واسعة للرف قبل تصوير الأجزاء أو الزوايا الإضافية.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('تعذر تجهيز الصورة.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const measured = measureFrame(canvas);
      const decision = evaluateCaptureFrame({
        blurScore: measured.blur,
        glareRatio: measured.glare,
        clippedPixelRatio: measured.clipped,
        motionScore: motionScore ?? undefined,
      }, { blurMinimum: 0.12, glareMaximum: 0.22, clippedPixelMaximum: 0.25 });
      const result: Guidance = {
        action: decision.action,
        message: decision.message,
        reasons: [...decision.reasons],
      };
      setMetrics(measured);
      setAdvice(result);
      if (result.action === 'capture' || result.action === 'complete') {
        const now = new Date();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = dataUrl.split(',')[1] ?? '';
        const estimatedBytes = Math.floor((base64.length * 3) / 4);
        const currentBytes = captured.reduce((total, item) => {
          const encoded = item.dataUrl.split(',')[1] ?? '';
          return total + Math.floor((encoded.length * 3) / 4);
        }, 0);
        if (currentBytes + estimatedBytes > MAX_SESSION_IMAGE_BYTES) {
          setError('وصلت الصور إلى حد 20 ميجابايت للجلسة. صدّر الجلسة الحالية أو ابدأ جلسة جديدة قبل إضافة صور.');
          return;
        }
        if (!sessionId) {
          setSessionId(window.crypto?.randomUUID?.() ?? `capture-${now.getTime()}`);
          setSessionStartedAt(now.toISOString());
        }
        const frame: CapturedFrame = {
          id: window.crypto?.randomUUID?.() ?? `frame-${now.getTime()}-${captured.length + 1}`,
          viewType: captureMode,
          capturedAt: now.toISOString(),
          dataUrl,
          metrics: measured,
          overlap: captureMode === 'wide' ? 'not_applicable' : overlap,
        };
        setCaptured((items) => [...items, frame]);
        if (captureMode === 'wide') setCaptureMode('section');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'فشل فحص الصورة.');
    } finally {
      setBusy(false);
    }
  }

  function startNewSession() {
    if (streamRef.current) stopCamera();
    setCaptured([]);
    setSessionId('');
    setSessionStartedAt('');
    setCaptureMode('wide');
    setOverlap('adequate');
    setMetrics(null);
    setAdvice(null);
    setError('');
  }

  async function continueToAnalysis() {
    if (!captured.length || !sessionId) return;
    const manifest = {
      schemaVersion: 'capture-session-local-1.0',
      captureSessionId: sessionId,
      startedAt: sessionStartedAt,
      savedAt: new Date().toISOString(),
      frames: captured.map((frame) => ({
        id: frame.id,
        viewType: frame.viewType,
        capturedAt: frame.capturedAt,
        dataUrl: frame.dataUrl,
        mimeType: 'image/jpeg',
        metrics: frame.metrics,
        overlap: frame.overlap,
      })),
    };
    try {
      await saveCaptureSession(manifest);
      router.push('/analysis');
    } catch {
      setError('تعذر تجهيز الجلسة للتحليل. صدّر الجلسة أولًا أو قلّل عدد الصور.');
    }
  }

  function exportSession() {
    if (!captured.length || !sessionId) return;
    const manifest = {
      schemaVersion: 'capture-session-local-1.0',
      captureSessionId: sessionId,
      startedAt: sessionStartedAt,
      exportedAt: new Date().toISOString(),
      storage: 'browser-memory-export',
      note: 'Local capture package only. No AI analysis, product count, or server persistence is included.',
      frames: captured.map(({ dataUrl, ...metadata }) => ({ ...metadata, imageDataUrl: dataUrl })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shelf-capture-${sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function observeMotion() {
    if (!('DeviceMotionEvent' in window)) {
      setMotion('المستشعر غير مدعوم؛ سنعتمد على فحص الصورة.');
      return;
    }

    const DeviceMotion = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    const startListening = () => {
      if (motionHandlerRef.current) window.removeEventListener('devicemotion', motionHandlerRef.current);
      lastAccelerationRef.current = null;
      const handleMotion = (event: DeviceMotionEvent) => {
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration || acceleration.x == null || acceleration.y == null || acceleration.z == null) {
          setMotion('بيانات الحركة غير متاحة حاليًا؛ فحص الصورة ما زال يعمل.');
          return;
        }
        const current = { x: acceleration.x, y: acceleration.y, z: acceleration.z };
        const previous = lastAccelerationRef.current;
        lastAccelerationRef.current = current;
        if (!previous) return;
        const delta = Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z);
        // Device-independent advisory score; image sharpness remains the capture authority.
        const score = Math.max(0, Math.min(1, delta / 5));
        setMotionScore(score);
        setMotion(score > 0.55 ? 'حركة ملحوظة؛ توقف لحظة قبل الالتقاط.' : score > 0.25 ? 'تحرك ببطء وحافظ على ثبات الهاتف.' : 'الحركة منخفضة؛ يمكنك متابعة التصوير.');
      };
      motionHandlerRef.current = handleMotion;
      window.addEventListener('devicemotion', handleMotion);
      setMotion('جارٍ قياس حركة الهاتف؛ انتظر لحظات لقراءة المؤشر.');
    };

    if (typeof DeviceMotion.requestPermission === 'function') {
      void DeviceMotion.requestPermission().then((permission) => {
        if (permission === 'granted') startListening();
        else setMotion('لم يُسمح بمستشعر الحركة؛ سنعتمد على فحص الصورة.');
      }).catch(() => setMotion('تعذر قراءة مستشعر الحركة؛ فحص الصورة ما زال متاحًا.'));
    } else {
      startListening();
    }
  }

  return (
    <AppShell title="تصوير الرفوف" description="التقط صورًا متداخلة للرف، وافحص وضوح الصورة والإضاءة قبل الاحتفاظ بها.">
      <div className="content-grid">
        <section className="panel">
          <div className="section-head"><div><h2>الكاميرا</h2><p className="panel-subtitle">{cameraState}</p></div><span className="environment-tag">معاينة محلية</span></div>
          <div className="camera-frame">
            <video ref={videoRef} autoPlay muted playsInline aria-label="معاينة كاميرا الرف" />
            {!streamRef.current && <div className="camera-placeholder"><span>▣</span><strong>معاينة الكاميرا ستظهر هنا</strong><small>اسمح باستخدام الكاميرا الخلفية عند الطلب.</small></div>}
          </div>
          <div className="capture-actions">
            <button className="primary-button" onClick={startCamera}>تشغيل الكاميرا</button>
            <button className="secondary-button" onClick={captureFrame} disabled={cameraState !== 'الكاميرا تعمل' || busy}>{busy ? 'جارٍ الفحص…' : 'التقاط وفحص الصورة'}</button>
            <button className="text-button" onClick={stopCamera}>إيقاف</button>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          {advice && <div className={advice.action === 'capture' || advice.action === 'complete' ? 'capture-feedback good' : 'capture-feedback warning'} role="status"><strong>{advice.action === 'capture' || advice.action === 'complete' ? 'الصورة مقبولة مبدئيًا' : 'اتبع إرشادات التصوير'}</strong><p>{advice.message}</p></div>}
          {metrics && <div className="metric-list"><span>مؤشر الوضوح: <b>{(metrics.blur * 100).toFixed(0)} / 100</b></span><span>نسبة اللمعان: <b>{(metrics.glare * 100).toFixed(1)}%</b></span><span>البكسلات شديدة السطوع/الظلام: <b>{(metrics.clipped * 100).toFixed(1)}%</b></span><span>متوسط الإضاءة: <b>{(metrics.brightness * 100).toFixed(1)}%</b></span></div>}
        </section>
        <section className="panel">
          <h2>إرشادات الموظف</h2><p className="panel-subtitle">اتبع هذه الخطوات لتقليل التكرار والمناطق غير المصورة.</p>
          <div className="capture-mode-panel">
            <strong>نوع الصورة التالية</strong>
            <div className="capture-mode-actions">
              <button type="button" className={captureMode === 'wide' ? 'mode-button selected' : 'mode-button'} onClick={() => setCaptureMode('wide')}>صورة واسعة</button>
              <button type="button" className={captureMode === 'section' ? 'mode-button selected' : 'mode-button'} onClick={() => setCaptureMode('section')} disabled={!captured.some((frame) => frame.viewType === 'wide')}>جزء من الرف</button>
              <button type="button" className={captureMode === 'alternate' ? 'mode-button selected' : 'mode-button'} onClick={() => setCaptureMode('alternate')} disabled={!captured.some((frame) => frame.viewType === 'wide')}>زاوية إضافية</button>
            </div>
            {captureMode !== 'wide' && <label className="overlap-control">التداخل مع الصورة السابقة
              <select value={overlap} onChange={(event) => setOverlap(event.target.value as 'low' | 'adequate' | 'high')}>
                <option value="low">قليل — أقل من المطلوب</option>
                <option value="adequate">مناسب — نحو 20 إلى 40%</option>
                <option value="high">كبير — أكثر من نصف المنطقة</option>
              </select>
            </label>}
            <p className="panel-subtitle">ابدأ بصورة واسعة، ثم انتقل بين أجزاء الرف مع تداخل بصري. اختيار التداخل هنا إقرار من الموظف وليس قياسًا آليًا.</p>
          </div>
          <ol className="capture-steps">
            <li>ابدأ بصورة واسعة للرف كاملًا.</li>
            <li>اقترب وصوّر كل جزء بوضوح.</li>
            <li>اجعل بين الصور المتجاورة تداخلًا تقريبيًا حتى لا تفوت منطقة.</li>
            <li>توقف لحظة قبل كل التقاط، وتجنب الحركة السريعة.</li>
            <li>صوّر من زاوية إضافية إذا كانت المنتجات محجوبة.</li>
          </ol>
          <div className="notice">حالة حركة الموظف: {motion} <button className="inline-link" onClick={observeMotion}>تشغيل قياس الحركة</button>{motionScore !== null && <strong className="motion-meter">مؤشر الحركة اللحظي: {(motionScore * 100).toFixed(0)}%</strong>}</div>
          <div className="notice">الصور المقبولة محفوظة مؤقتًا في ذاكرة الصفحة فقط. لا يوجد رفع أو حفظ دائم أو اتصال بالخادم في هذه المرحلة.</div>
        </section>
      </div>
      <section className="panel captured-panel">
        <div className="section-head"><div><h2>جلسة التصوير ({captured.length}/{MAX_SESSION_IMAGES} صور)</h2><p className="panel-subtitle">{sessionId ? `معرّف الجلسة: ${sessionId}` : 'لم تبدأ جلسة بعد'}</p></div><div className="capture-session-actions"><button type="button" className="primary-button" onClick={continueToAnalysis} disabled={!captured.length}>متابعة إلى التحليل</button><button type="button" className="secondary-button" onClick={exportSession} disabled={!captured.length}>تصدير الصور وبيانات الجلسة</button><button type="button" className="text-button" onClick={startNewSession}>جلسة جديدة</button></div></div>
        <p className="panel-subtitle">القبول فحص جودة أولي فقط. الصور محفوظة في ذاكرة الصفحة حتى التصدير أو بدء جلسة جديدة.</p>
        {captured.length === 0 ? <div className="empty-state"><h3>لم تلتقط صورًا بعد</h3><p>ابدأ بصورة واسعة للرف، ثم التقط الأجزاء المتجاورة.</p></div> : <div className="capture-thumbs">{captured.map((frame, index) => <figure key={frame.id}><img src={frame.dataUrl} alt={'صورة رف رقم ' + (index + 1)} /><figcaption>#{index + 1} · {frame.viewType === 'wide' ? 'واسعة' : frame.viewType === 'section' ? 'جزء رف' : 'زاوية إضافية'}{frame.overlap !== 'not_applicable' ? ` · التداخل: ${frame.overlap === 'low' ? 'قليل' : frame.overlap === 'high' ? 'كبير' : 'مناسب'}` : ''}</figcaption></figure>)}</div>}
        {captured.length > 0 && <div className="notice">الصور الواسعة: {captured.filter((frame) => frame.viewType === 'wide').length} · أجزاء الرف: {captured.filter((frame) => frame.viewType === 'section').length} · الزوايا الإضافية: {captured.filter((frame) => frame.viewType === 'alternate').length}. هذا سجل للصور الملتقطة فقط، وليس إثباتًا لاكتمال تغطية الرف.</div>}
      </section>
    </AppShell>
  );
}
