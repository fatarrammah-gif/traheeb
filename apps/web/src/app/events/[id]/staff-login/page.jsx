'use client';

import { useEffect, useState } from 'react';

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
};

function getEventId() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/');
  const idx = parts.indexOf('events');
  return idx >= 0 ? parts[idx + 1] : '';
}

export default function StaffLoginPage() {
  const [eventId, setEventId] = useState('');
  const [eventName, setEventName] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const id = getEventId();
    setEventId(id);
    if (!id) return;

    // Fetch event name (public — no auth needed for the event name)
    fetch(`/api/events/${id}/public`)
      .then(r => r.json())
      .then(d => { if (d.name) setEventName(d.name); })
      .catch(() => {});
  }, []);

  async function handleSendOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, eventId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'حدث خطأ'); return; }
      setStep('otp');
      setInfo('تم إرسال رمز التحقق إلى هاتفك');
    } catch { setError('حدث خطأ في الاتصال'); }
    finally { setLoading(false); }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp, eventId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'رمز التحقق غير صحيح'); return; }

      localStorage.setItem('traheeb_staff_token', data.jwt);
      localStorage.setItem('traheeb_staff_event_id', eventId);
      window.location.href = `/events/${eventId}/staff-view`;
    } catch { setError('حدث خطأ في الاتصال'); }
    finally { setLoading(false); }
  }

  const inp = {
    width: '100%', padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`,
    fontSize: 16, color: T.text, background: T.surface, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Cairo', sans-serif", textAlign: 'right',
  };

  const btn = {
    width: '100%', padding: '13px', borderRadius: 12, border: 'none', fontSize: 16,
    fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Cairo', sans-serif",
    background: GRAD, color: '#fff', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: GRAD, padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={LOGO} alt="تراحيب" style={{ width: 56, height: 56, objectFit: 'contain', mixBlendMode: 'screen' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Card */}
          <div style={{ background: T.surface, borderRadius: 24, padding: 32, border: `1px solid ${T.border}`, boxShadow: '0 4px 24px rgba(138,0,79,0.08)' }}>

            {/* Icon */}
            <div style={{ width: 56, height: 56, borderRadius: 16, background: T.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 20, border: `1px solid ${T.border}` }}>
              👥
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 6px' }}>
              دخول الفريق
            </h1>
            {eventName && (
              <p style={{ fontSize: 14, color: T.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                {eventName}
              </p>
            )}
            {!eventName && (
              <p style={{ fontSize: 14, color: T.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                أدخل رقم جوالك للوصول إلى صفحة الفريق
              </p>
            )}

            {step === 'phone' ? (
              <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    رقم الجوال
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    required
                    style={inp}
                    dir="ltr"
                  />
                </div>
                {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0, fontWeight: 600 }}>{error}</p>}
                <button type="submit" disabled={loading} style={btn}>
                  {loading ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {info && <p style={{ color: '#059669', fontSize: 13, margin: 0, fontWeight: 600, background: '#ECFDF5', padding: '10px 14px', borderRadius: 10, border: '1px solid #A7F3D0' }}>{info}</p>}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    رمز التحقق
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    style={{ ...inp, textAlign: 'center', letterSpacing: 6, fontSize: 22, fontWeight: 700 }}
                    dir="ltr"
                  />
                </div>
                {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0, fontWeight: 600 }}>{error}</p>}
                <button type="submit" disabled={loading} style={btn}>
                  {loading ? 'جارٍ التحقق...' : 'تحقق والدخول'}
                </button>
                <button type="button" onClick={() => { setStep('phone'); setError(''); setOtp(''); }}
                  style={{ background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Cairo', sans-serif" }}>
                  تغيير رقم الجوال
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
