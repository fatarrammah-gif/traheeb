'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { useWebAuth, authFetch } from '../../../../utils/webAuth.js';

export default function ScanPage() {
  const { id: eventId } = useParams();
  const token = useWebAuth((s) => s.token);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const animFrameRef = useRef(null);
  const scanningRef = useRef(true);

  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  // phase: 'scanning' | 'confirming' | 'result'
  const [phase,   setPhase]   = useState('scanning');
  const [preview, setPreview] = useState(null); // guest info before confirming
  const [result,  setResult]  = useState(null); // final result
  const [pending, setPending] = useState(null); // token held during confirm
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) window.location.href = '/login';
  }, [token]);

  function resetScanner() {
    setPhase('scanning');
    setPreview(null);
    setResult(null);
    setPending(null);
    scanningRef.current = true;
  }

  // ── Step 1: QR detected → preview (no mark-used) ────────────────────────────
  const handleScan = useCallback(async (qrToken) => {
    if (!scanningRef.current) return;
    scanningRef.current = false;

    try {
      const res = await authFetch('/api/qr/preview', {
        method: 'POST',
        body: JSON.stringify({ token: qrToken, eventId }),
      });
      const data = await res.json();

      if (data.status === 'valid') {
        setPending(qrToken);
        setPreview(data);
        setPhase('confirming');
      } else {
        // already_used or invalid — skip confirmation
        setResult(data);
        setPhase('result');
        setTimeout(resetScanner, 3000);
      }
    } catch {
      setResult({ status: 'error' });
      setPhase('result');
      setTimeout(resetScanner, 3000);
    }
  }, [eventId]);

  // ── Step 2a: Confirmed → actual scan ────────────────────────────────────────
  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/qr/scan', {
        method: 'POST',
        body: JSON.stringify({ token: pending, eventId }),
      });
      const data = await res.json();
      setResult(data);
      setPhase('result');
      setTimeout(resetScanner, 3000);
    } catch {
      setResult({ status: 'error' });
      setPhase('result');
      setTimeout(resetScanner, 3000);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2b: Cancelled → resume immediately ──────────────────────────────────
  function handleCancel() {
    resetScanner();
  }

  // ── Camera setup ─────────────────────────────────────────────────────────────
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
        canvasRef.current.width  = SCAN_W;
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

  // Result config
  const resultBg =
    result?.status === 'valid'        ? 'linear-gradient(135deg,#1b5e20,#2e7d32)' :
    result?.status === 'already_used' ? 'linear-gradient(135deg,#e65100,#ef6c00)' :
                                        'linear-gradient(135deg,#b71c1c,#c62828)';
  const resultIcon =
    result?.status === 'valid' ? '✅' : result?.status === 'already_used' ? '⚠️' : '❌';
  const resultTitle =
    result?.status === 'valid' ? 'دخول مسموح' :
    result?.status === 'already_used' ? 'تم الاستخدام مسبقاً' : 'دخول مرفوض';
  const resultMsg =
    result?.status === 'valid'
      ? result.guest?.maxScans > 1
        ? `${result.guest?.name ?? ''} — دخول ${result.guest.scanCount} من ${result.guest.maxScans}`
        : `مرحباً ${result.guest?.name ?? ''}${result.guest?.companions > 0 ? ` (${result.guest.companions} مرافق)` : ''}`
      : result?.status === 'already_used'
        ? result.guest?.name ?? ''
        : 'رمز QR غير صالح';

  return (
    <div dir="rtl" style={{ position: 'fixed', inset: 0, background: '#0d0008', fontFamily: 'system-ui,-apple-system,sans-serif', color: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 10, flexShrink: 0 }}>
        <a href={`/events/${eventId}`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1 }}>&#8592;</a>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>مسح رمز QR</h1>
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

            {/* Scan frame */}
            {cameraReady && phase === 'scanning' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 220, height: 220, border: '2px solid rgba(200,0,90,0.8)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
              </div>
            )}

            {/* Hint */}
            {cameraReady && phase === 'scanning' && (
              <div style={{ position: 'absolute', top: 'calc(50% + 140px)', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '8px 20px', fontSize: 14, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                وجّه الكاميرا نحو رمز QR
              </div>
            )}
          </>
        )}

        {/* ── Confirmation card ── */}
        {phase === 'confirming' && preview && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, textAlign: 'center', color: '#1A0910' }}>

              <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>
                👤
              </div>

              <p style={{ fontSize: 14, color: '#7A5568', margin: '0 0 6px' }}>تأكيد الدخول</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#C8005A', margin: '0 0 6px' }}>{preview.guest?.name}</p>

              {preview.guest?.maxScans > 1 ? (
                <p style={{ fontSize: 14, color: '#7A5568', margin: '0 0 4px' }}>
                  دخول {preview.guest.scanCount + 1} من {preview.guest.maxScans}
                  {preview.guest.companions > 0 ? ` (${preview.guest.companions} مرافق)` : ''}
                </p>
              ) : preview.guest?.companions > 0 && (
                <p style={{ fontSize: 14, color: '#7A5568', margin: '0 0 4px' }}>+ {preview.guest.companions} مرافق</p>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                {/* Cancel */}
                <button onClick={handleCancel} disabled={loading}
                  style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#EF4444', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ❌ إلغاء
                </button>
                {/* Confirm */}
                <button onClick={handleConfirm} disabled={loading}
                  style={{ flex: 1, padding: '13px', borderRadius: 14, border: 'none', background: loading ? '#e0a0b8' : '#C8005A', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? '...' : '✅ تأكيد'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Final result ── */}
        {phase === 'result' && result && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: resultBg, padding: '24px 28px', borderRadius: '20px 20px 0 0', textAlign: 'center', boxShadow: '0 -4px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{resultIcon}</div>
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{resultTitle}</p>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>{resultMsg}</p>
          </div>
        )}

        {/* Loading state */}
        {!cameraReady && !cameraError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>جارٍ تشغيل الكاميرا...</p>
          </div>
        )}
      </div>
    </div>
  );
}
