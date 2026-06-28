'use client';

import { useEffect, useState } from 'react';
import { useWebAuth } from '../../utils/webAuth.js';

const LOGO =
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/7881a02c-860c-49fb-be4b-2701f4d65e59.png';
const PINK_GRAD = 'linear-gradient(135deg, #8A004F 0%, #C2185B 45%, #D81B72 100%)';

const T = {
  bg: '#FFF9FB',
  surface: '#FFFFFF',
  primary: '#C2185B',
  primarySoft: '#FFF0F7',
  text: '#1A0910',
  muted: '#7A5568',
  border: '#F2E0EB',
};

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
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'رمز التحقق غير صحيح');
      } else {
        setAuth(data.jwt, data.user);
        window.location.href = '/dashboard';
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: `1px solid ${T.border}`,
    fontSize: 15,
    color: T.text,
    background: T.surface,
    outline: 'none',
    textAlign: 'right',
    boxSizing: 'border-box',
  };

  const btnStyle = (disabled) => ({
    width: '100%',
    padding: '13px',
    borderRadius: 12,
    border: 'none',
    background: disabled ? '#E8A0C0' : PINK_GRAD,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'opacity 0.2s',
    boxShadow: disabled ? 'none' : '0 6px 20px rgba(138,0,79,0.3)',
    marginTop: 8,
  });

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav
        style={{
          background: PINK_GRAD,
          height: 68,
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src={LOGO} alt="تراحيب" style={{ width: 56, height: 56, objectFit: 'contain', mixBlendMode: 'screen' }} />
        </a>
        <a
          href="/login"
          style={{
            padding: '7px 18px',
            borderRadius: 10,
            background: '#fff',
            color: '#C2185B',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          تسجيل الدخول
        </a>
      </nav>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 24,
              background: T.primarySoft,
              border: `1px solid ${T.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <img src={LOGO} alt="تراحيب" style={{ width: 66, height: 66, objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontSize: 28, fontWeight: 800, color: T.primary }}>تراحيب</span>
          </div>
          <p style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>منصة إدارة الفعاليات</p>
        </div>

        {/* Card */}
        <div
          style={{
            background: T.surface,
            borderRadius: 20,
            padding: 32,
            border: `1px solid ${T.border}`,
            boxShadow: '0 4px 32px rgba(138,0,79,0.07)',
          }}
        >
          {step === 1 ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 4px', textAlign: 'right' }}>
                مرحباً بك
              </h2>
              <p style={{ fontSize: 13, color: T.muted, margin: '0 0 8px', lineHeight: 1.8 }}>
                سيتم إرسال رمز التحقق إلى رقمك عبر SMS.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  رقم الجوال <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  required
                  style={{ ...inp, direction: 'ltr', textAlign: 'right' }}
                />
              </div>

              {error && (
                <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
              )}

              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 4px', textAlign: 'right' }}>
                أدخل رمز التحقق
              </h2>
              <p style={{ fontSize: 13, color: T.muted, margin: '0 0 4px', lineHeight: 1.8 }}>
                تم إرسال رمز مكون من 6 أرقام إلى:
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.primary, margin: '0 0 8px' }}>{phone}</p>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  رمز التحقق
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="------"
                  maxLength={6}
                  required
                  style={{
                    ...inp,
                    fontSize: 26,
                    letterSpacing: 10,
                    textAlign: 'center',
                    fontWeight: 800,
                    direction: 'ltr',
                  }}
                />
              </div>

              {error && (
                <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
              )}

              <button type="submit" disabled={loading} style={{ ...btnStyle(loading), marginBottom: 4 }}>
                {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setOtp(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.muted,
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: '4px 0',
                  textAlign: 'center',
                }}
              >
                تعديل الرقم
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: T.muted, marginTop: 20, lineHeight: 1.8 }}>
          بالمتابعة فإنك توافق على{' '}
          <a href="/privacy" style={{ color: T.primary, textDecoration: 'none' }}>سياسة الخصوصية</a>
          {' '}لتراحيب
        </p>
      </div>
      </div>
    </div>
  );
}
