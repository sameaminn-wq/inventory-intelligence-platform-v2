'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/app-shell';

type Metrics = { blur: number; glare: number; brightness: number };
type Guidance = { action: string; message: string; reasons: string[] };

function measureFrame(canvas: HTMLCanvasElement): Metrics {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('تعذر فحص إطار الكاميرا.');
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const sample = Math.max(1, Math.floor(Math.sqrt((width * height) / 12000)));
  let brightness = 0, glare = 0, count = 0;
  const gray: number[] = [];
  for (let y = 0; y < height; y += sample) {
    for (let x = 0; x < width; x += sample) {
      const i = (y * width + x) * 4;
      const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray.push(value);
      brightness += value / 255;
      if (value >= 248) glare++;
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
    brightness: count ? brightness / count : 0,
  };
}

function guidance(metrics: Metrics): Guidance {
  if (metrics.blur < 0.12) return { action: 'retake', message: 'الصورة غير واضحة. ثبّت الهاتف وانتظر حتى يثبت التركيز ثم أعد الالتقاط.', reasons: ['BLUR_SUSPECTED'] };
  if (metrics.glare > 0.22) return { action: 'retake', message: 'يوجد لمعان قوي. غيّر زاوية الهاتف أو ابتعد عن مصدر الضوء المباشر.', reasons: ['GLARE_SUSPECTED'] };
  if (metrics.brightness < 0.16 || metrics.brightness > 0.91) return { action: 'retake', message: 'الإضاءة غير مناسبة. حسّن الإضاءة دون توجيه ضوء مباشر إلى العبوات.', reasons: ['EXPOSURE_OUT_OF_RANGE'] };
  return { action: 'accepted_for_review', message: 'جودة الصورة الأولية مناسبة. هذا لا يؤكد اكتمال الرف أو دقة عدّ المنتجات.', reasons: [] };
}

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState('لم يتم تشغيل الكاميرا');
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [advice, setAdvice] = useState<Guidance | null>(null);
  const [motion, setMotion] = useState('غير متاح');
  const [captured, setCaptured] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

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
    setCameraState('تم إيقاف الكاميرا');
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || busy) return;
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
      const result = guidance(measured);
      setMetrics(measured);
      setAdvice(result);
      if (result.action === 'accepted_for_review') {
        setCaptured((items) => [...items, canvas.toDataURL('image/jpeg', 0.86)]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'فشل فحص الصورة.');
    } finally {
      setBusy(false);
    }
  }

  function observeMotion() {
    if (!('DeviceMotionEvent' in window)) {
      setMotion('المستشعر غير مدعوم؛ سنعتمد على تحليل الصورة.');
      return;
    }
    const DeviceMotion = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DeviceMotion.requestPermission === 'function') {
      void DeviceMotion.requestPermission().then((permission) => {
        setMotion(permission === 'granted' ? 'تم السماح بقراءة الحركة' : 'لم يُسمح بمستشعر الحركة');
      }).catch(() => setMotion('تعذر قراءة مستشعر الحركة'));
    } else {
      setMotion('المتصفح يدعم مستشعر الحركة عند توفر البيانات');
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
          {advice && <div className={advice.action === 'accepted_for_review' ? 'capture-feedback good' : 'capture-feedback warning'} role="status"><strong>{advice.action === 'accepted_for_review' ? 'الصورة مقبولة مبدئيًا' : 'نحتاج صورة أفضل'}</strong><p>{advice.message}</p></div>}
          {metrics && <div className="metric-list"><span>مؤشر الوضوح: <b>{(metrics.blur * 100).toFixed(0)} / 100</b></span><span>نسبة اللمعان: <b>{(metrics.glare * 100).toFixed(1)}%</b></span><span>متوسط الإضاءة: <b>{(metrics.brightness * 100).toFixed(1)}%</b></span></div>}
        </section>
        <section className="panel">
          <h2>إرشادات الموظف</h2><p className="panel-subtitle">اتبع هذه الخطوات لتقليل التكرار والمناطق غير المصورة.</p>
          <ol className="capture-steps">
            <li>ابدأ بصورة واسعة للرف كاملًا.</li>
            <li>اقترب وصوّر كل جزء بوضوح.</li>
            <li>اجعل بين الصور المتجاورة تداخلًا تقريبيًا حتى لا تفوت منطقة.</li>
            <li>توقف لحظة قبل كل التقاط، وتجنب الحركة السريعة.</li>
            <li>صوّر من زاوية إضافية إذا كانت المنتجات محجوبة.</li>
          </ol>
          <div className="notice">حالة مستشعر الحركة: {motion}. <button className="inline-link" onClick={observeMotion}>فحص الإتاحة</button></div>
          <div className="notice">الصور المقبولة محفوظة مؤقتًا في ذاكرة الصفحة فقط. لا يوجد رفع أو حفظ دائم أو اتصال بالخادم في هذه المرحلة.</div>
        </section>
      </div>
      <section className="panel captured-panel"><h2>الصور المقبولة مبدئيًا ({captured.length})</h2><p className="panel-subtitle">القبول هنا فحص جودة أولي فقط، وليس اعتمادًا لصحة تحليل المنتجات.</p>{captured.length === 0 ? <div className="empty-state"><h3>لم تلتقط صورًا بعد</h3><p>شغّل الكاميرا والتقط صورة لتظهر هنا.</p></div> : <div className="capture-thumbs">{captured.map((src, index) => <figure key={index}><img src={src} alt={'صورة رف رقم ' + (index + 1)} /><figcaption>الصورة {index + 1}</figcaption></figure>)}</div>}</section>
    </AppShell>
  );
}
