'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebAuth, authFetch } from '../../utils/webAuth.js';


const LOGO = 'https://dtvoeevhaseb5.cloudfront.net/user-uploads/7881a02c-860c-49fb-be4b-2701f4d65e59.png';
const GRAD = 'linear-gradient(135deg, #8A004F 0%, #C2185B 45%, #D81B72 100%)';

const T = {
  bg: '#FFF9FB',
  surface: '#FFFFFF',
  primary: '#C2185B',
  primarySoft: '#FFF0F7',
  text: '#1A0910',
  muted: '#7A5568',
  border: '#F2E0EB',
  green: '#059669',
  greenSoft: '#ECFDF5',
};

export default function WhatsAppConnectPage() {
  const token = useWebAuth((s) => s.token);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | qr_ready | connected | error
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) { window.location.href = '/login'; return; }
    checkStatus();
    return () => clearInterval(pollRef.current);
  }, [mounted, token]);

  async function checkStatus() {
    try {
      const res = await authFetch('/api/whatsapp/status');
      const data = await res.json();
      if (data.connected) {
        setStatus('connected');
      } else if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setStatus('qr_ready');
        startPolling();
      }
    } catch {}
  }

  async function startConnect() {
    setStatus('loading');
    setQrDataUrl(null);
    clearInterval(pollRef.current);
    try {
      const res = await authFetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (data.connected) { setStatus('connected'); return; }
      startPolling();
    } catch {
      setStatus('error');
    }
  }

  async function handleDisconnect() {
    try {
      await authFetch('/api/whatsapp/disconnect', { method: 'POST' });
      setStatus('idle');
      setQrDataUrl(null);
      clearInterval(pollRef.current);
    } catch {}
  }

  function startPolling() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await authFetch('/api/whatsapp/status');
        const data = await res.json();
        if (data.connected) {
          setStatus('connected');
          setQrDataUrl(null);
          clearInterval(pollRef.current);
        } else if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
          setStatus('qr_ready');
        }
      } catch {}
    }, 3000);
  }

  if (!mounted || !token) return null;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: GRAD, padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/dashboard">
            <img src={LOGO} alt="تراحيب" style={{ width: 56, height: 56, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </a>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>ربط واتساب</span>
        </div>
        <a href="/dashboard" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>← لوحة التحكم</a>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ background: T.surface, borderRadius: 24, padding: 32, border: `1px solid ${T.border}`, boxShadow: '0 4px 24px rgba(138,0,79,0.08)' }}>

            {/* Connected */}
            {status === 'connected' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: T.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px' }}>✅</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: T.green, margin: '0 0 8px' }}>واتساب مرتبط</h2>
                <p style={{ fontSize: 14, color: T.muted, margin: '0 0 24px', lineHeight: 1.7 }}>
                  سيتم إرسال التذكيرات من رقمك الشخصي تلقائياً
                </p>
                <a href="/dashboard" style={{ display: 'block', background: GRAD, color: '#fff', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 700, textDecoration: 'none', marginBottom: 12, textAlign: 'center' }}>
                  الرئيسية
                </a>
                <button onClick={handleDisconnect}
                  style={{ width: '100%', background: 'none', border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '11px', fontSize: 14, color: T.muted, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                  قطع الاتصال
                </button>
              </div>
            )}

            {/* Idle */}
            {status === 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: T.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px', border: `1px solid ${T.border}` }}>📱</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, margin: '0 0 8px' }}>ربط حساب واتساب</h2>
                <p style={{ fontSize: 14, color: T.muted, margin: '0 0 24px', lineHeight: 1.7 }}>
                  اربط رقمك الشخصي لإرسال التذكيرات من حسابك في واتساب
                </p>
                <button onClick={startConnect}
                  style={{ width: '100%', background: GRAD, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                  ابدأ الربط
                </button>
              </div>
            )}

            {/* Loading */}
            {status === 'loading' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
                <p style={{ fontSize: 15, color: T.muted, margin: 0 }}>جاري تحضير رمز QR...</p>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>قد يستغرق هذا بضع ثوانٍ</p>
              </div>
            )}

            {/* QR Ready */}
            {status === 'qr_ready' && qrDataUrl && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: '0 0 16px' }}>امسح الرمز بواتساب</h2>

                <div style={{ border: `2px solid ${T.border}`, borderRadius: 16, padding: 12, background: '#fff', display: 'inline-block', marginBottom: 20 }}>
                  <img src={qrDataUrl} alt="QR Code" style={{ width: 240, height: 240, display: 'block' }} />
                </div>

                {/* Steps */}
                <div style={{ background: T.primarySoft, borderRadius: 14, padding: 16, textAlign: 'right', marginBottom: 16 }}>
                  {[
                    'افتح واتساب على هاتفك',
                    'اضغط على ⋮ ثم "الأجهزة المرتبطة"',
                    'اضغط "ربط جهاز"',
                    'وجّه الكاميرا نحو الرمز أعلاه',
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 3 ? 10 : 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.primary, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{step}</span>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: T.muted, margin: '0 0 12px' }}>⏳ في انتظار المسح... يتجدد الرمز تلقائياً</p>

                <button onClick={startConnect}
                  style={{ background: 'none', border: `1.5px solid ${T.primary}`, borderRadius: 12, padding: '10px 24px', fontSize: 14, color: T.primary, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>
                  🔄 تحديث الرمز
                </button>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>❌</div>
                <p style={{ fontSize: 15, color: '#EF4444', fontWeight: 600, margin: '0 0 8px' }}>حدث خطأ في الاتصال</p>
                <p style={{ fontSize: 13, color: T.muted, margin: '0 0 20px' }}>تحقق من اتصالك بالإنترنت ثم حاول مجدداً</p>
                <button onClick={startConnect}
                  style={{ width: '100%', background: GRAD, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                  حاول مجدداً
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
