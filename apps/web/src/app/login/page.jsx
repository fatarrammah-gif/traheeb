'use client';

import { useEffect, useState } from 'react';
import { useWebAuth } from '../../utils/webAuth.js';

export default function LoginPage() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = useWebAuth((s) => s.token);
  const setAuth = useWebAuth((s) => s.setAuth);

  useEffect(() => {
    if (token) {
      window.location.href = '/dashboard';
    }
  }, [token]);

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ، حاول مجدداً');
      } else {
        setStep(2);
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'رمز التحقق غير صحيح');
      } else {
        setAuth(data.token, data.user);
        window.location.href = '/dashboard';
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg, #1E000E 0%, #3D0022 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 48, fontWeight: 800, color: '#C8005A', margin: 0 }}>
          تراحيب
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
          منصة إدارة الفعاليات
        </p>

        <div
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '32px 28px',
          }}
        >
          {step === 1 ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
                تسجيل الدخول
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>رقم الجوال</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  required
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    color: '#fff',
                    fontSize: 15,
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    direction: 'ltr',
                    textAlign: 'right',
                  }}
                />
              </div>

              {error && (
                <p style={{ color: '#ff6b6b', fontSize: 14, margin: 0, textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#C8005A',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '14px 28px',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginTop: 8,
                }}
              >
                {loading ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', textAlign: 'center' }}>
                أدخل رمز التحقق
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px', textAlign: 'center' }}>
                تم إرسال رمز إلى {phone}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>رمز التحقق</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="------"
                  maxLength={6}
                  required
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    color: '#fff',
                    fontSize: 22,
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    letterSpacing: 8,
                    textAlign: 'center',
                    direction: 'ltr',
                  }}
                />
              </div>

              {error && (
                <p style={{ color: '#ff6b6b', fontSize: 14, margin: 0, textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#C8005A',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '14px 28px',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginTop: 8,
                }}
              >
                {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setOtp(''); }}
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  border: 'none',
                  fontSize: 14,
                  cursor: 'pointer',
                  padding: '8px',
                }}
              >
                رجوع
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
