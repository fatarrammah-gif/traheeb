'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { useWebAuth, authFetch } from '../../../../utils/webAuth.js';

export default function ScanPage() {
  const { id: eventId } = useParams();
  const token = useWebAuth((s) => s.token);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const scanningRef = useRef(true);

  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null); // { type: 'success'|'error', message, guestName? }
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
    }
  }, [token]);

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
      if (!scanningRef.current) return;
      scanningRef.current = false;
      try {
        const res = await authFetch('/api/qr/scan', {
          method: 'POST',
          body: JSON.stringify({ token: qrToken, eventId }),
        });
        const data = await res.json();

        if (!res.ok) {
          showResult({ type: 'error', message: data.error || 'حدث خطأ' });
          return;
        }

        if (data.status === 'valid') {
          const guestName = data.guest?.name || data.guest_name || '';
          showResult({
            type: 'success',
            message: `مرحباً ${guestName}`,
            guestName,
          });
        } else if (data.status === 'already_used') {
          showResult({ type: 'error', message: 'تم استخدام هذا الرمز مسبقاً' });
        } else {
          showResult({ type: 'error', message: 'رمز QR غير صالح' });
        }
      } catch {
        showResult({ type: 'error', message: 'حدث خطأ في الاتصال' });
      }
    },
    [eventId, showResult]
  );

  useEffect(() => {
    if (!token) return;

    let jsQR;

    async function startCamera() {
      try {
        // Dynamically import jsQR
        const mod = await import('jsqr');
        jsQR = mod.default;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }

        function tick() {
          if (!videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (scanningRef.current) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (code && code.data) {
                handleScan(code.data);
              }
            }
          }

          animFrameRef.current = requestAnimationFrame(tick);
        }

        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setCameraError('لم يتم منح إذن الوصول إلى الكاميرا');
        } else if (err.name === 'NotFoundError') {
          setCameraError('لا توجد كاميرا متاحة');
        } else {
          setCameraError('تعذر تشغيل الكاميرا: ' + err.message);
        }
      }
    }

    startCamera();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [token, handleScan]);

  if (!token) return null;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#0d0008',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <a
          href={`/events/${eventId}`}
          style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1 }}
        >
          &#8592;
        </a>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>مسح رمز QR</h1>
      </div>

      {/* Camera area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
        {cameraError ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              gap: 16,
            }}
          >
            <div style={{ fontSize: 48 }}>📷</div>
            <p style={{ textAlign: 'center', color: '#ff6b6b', fontSize: 16 }}>{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Scan frame overlay */}
            {cameraReady && !result && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 220,
                    height: 220,
                    border: '2px solid rgba(200,0,90,0.8)',
                    borderRadius: 12,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }}
                />
              </div>
            )}

            {/* Status hint */}
            {cameraReady && !result && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 100,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: 20,
                  padding: '8px 20px',
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.7)',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(4px)',
                }}
              >
                وجّه الكاميرا نحو رمز QR
              </div>
            )}
          </>
        )}

        {/* Result overlay */}
        {result && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background:
                result.type === 'success'
                  ? 'linear-gradient(135deg, #1b5e20, #2e7d32)'
                  : 'linear-gradient(135deg, #b71c1c, #c62828)',
              padding: '24px 28px',
              borderRadius: '20px 20px 0 0',
              textAlign: 'center',
              boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {result.type === 'success' ? '✅' : '❌'}
            </div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {result.type === 'success' ? 'دخول مسموح' : 'دخول مرفوض'}
            </p>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>{result.message}</p>
          </div>
        )}

        {/* Loading state */}
        {!cameraReady && !cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>جارٍ تشغيل الكاميرا...</p>
          </div>
        )}
      </div>
    </div>
  );
}
