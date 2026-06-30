'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

function getEventId() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/');
  const idx = parts.indexOf('events');
  return idx >= 0 ? parts[idx + 1] : '';
}

export default function StaffScanPage() {
  const [eventId, setEventId] = useState('');
  const [token, setToken] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const scanningRef = useRef(true);

  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    const id = getEventId();
    setEventId(id);

    const storedToken = localStorage.getItem('traheeb_staff_token');
    const storedEventId = localStorage.getItem('traheeb_staff_event_id');

    if (!storedToken || storedEventId !== id) {
      window.location.href = `/events/${id}/staff-login`;
      return;
    }
    setToken(storedToken);
  }, []);

  const showResult = useCallback((res) => {
    scanningRef.current = false;
    setResult(res);
    setTimeout(() => {
      setResult(null);
      scanningRef.current = true;
    }, 3000);
  }, []);

  const handleScan = useCallback(
    async (qrToken) => {
      if (!scanningRef.current || !token || !eventId) return;
      scanningRef.current = false;
      try {
        const res = await fetch('/api/qr/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: qrToken, eventId }),
        });
        const data = await res.json();

        if (!res.ok) {
          showResult({ type: 'error', message: data.error || 'حدث خطأ' });
          return;
        }

        if (data.status === 'valid') {
          showResult({ type: 'success', message: `مرحباً ${data.guest?.name || ''}` });
        } else if (data.status === 'already_used') {
          showResult({ type: 'error', message: 'تم استخدام هذا الرمز مسبقاً' });
        } else {
          showResult({ type: 'error', message: 'رمز QR غير صالح' });
        }
      } catch {
        showResult({ type: 'error', message: 'حدث خطأ في الاتصال' });
      }
    },
    [eventId, token, showResult]
  );

  useEffect(() => {
    if (!token) return;

    let jsQR;

    async function startCamera() {
      try {
        const mod = await import('jsqr');
        jsQR = mod.default;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          if (playErr.name === 'AbortError') return;
          throw playErr;
        }

        await new Promise((resolve) => {
          if (videoRef.current.readyState >= 1) { resolve(); return; }
          videoRef.current.addEventListener('loadedmetadata', resolve, { once: true });
        });

        const SCAN_W = 640;
        const SCAN_H = Math.round((videoRef.current.videoHeight / videoRef.current.videoWidth) * SCAN_W);
        canvasRef.current.width = SCAN_W;
        canvasRef.current.height = SCAN_H;
        setCameraReady(true);

        let lastScan = 0;
        const SCAN_INTERVAL = 120;

        function tick(now) {
          animFrameRef.current = requestAnimationFrame(tick);
          if (!videoRef.current || !canvasRef.current) return;
          if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return;
          if (!scanningRef.current) return;
          if (now - lastScan < SCAN_INTERVAL) return;
          lastScan = now;

          const ctx = canvasRef.current.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, SCAN_W, SCAN_H);
          const imageData = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
          if (code?.data) handleScan(code.data);
        }

        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (err.name === 'NotAllowedError') setCameraError('لم يتم منح إذن الوصول إلى الكاميرا');
        else if (err.name === 'NotFoundError') setCameraError('لا توجد كاميرا متاحة');
        else setCameraError('تعذر تشغيل الكاميرا: ' + err.message);
      }
    }

    startCamera();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, [token, handleScan]);

  if (!token) return null;

  return (
    <div dir="rtl" style={{ position: 'fixed', inset: 0, background: '#0d0008', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 10, flexShrink: 0 }}>
        <a href={`/events/${eventId}/staff-view`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1 }}>
          &#8592;
        </a>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>مسح رمز QR — الفريق</h1>
      </div>

      {/* Camera area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
        {cameraError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <div style={{ fontSize: 48 }}>📷</div>
            <p style={{ textAlign: 'center', color: '#ff6b6b', fontSize: 16 }}>{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {cameraReady && !result && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 220, height: 220, border: '2px solid rgba(200,0,90,0.8)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
              </div>
            )}

            {cameraReady && !result && (
              <div style={{ position: 'absolute', top: 'calc(50% + 140px)', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '8px 20px', fontSize: 14, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                وجّه الكاميرا نحو رمز QR
              </div>
            )}
          </>
        )}

        {result && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: result.type === 'success' ? 'linear-gradient(135deg, #1b5e20, #2e7d32)' : 'linear-gradient(135deg, #b71c1c, #c62828)', padding: '24px 28px', borderRadius: '20px 20px 0 0', textAlign: 'center', boxShadow: '0 -4px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{result.type === 'success' ? '✅' : '❌'}</div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{result.type === 'success' ? 'دخول مسموح' : 'دخول مرفوض'}</p>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>{result.message}</p>
          </div>
        )}

        {!cameraReady && !cameraError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>جارٍ تشغيل الكاميرا...</p>
          </div>
        )}
      </div>
    </div>
  );
}
