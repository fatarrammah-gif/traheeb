'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

export default function DeclinePage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const result = searchParams.get('result');

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invitation/${token}`)
      .then((r) => r.json())
      .then((data) => setInvitation(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // If no result yet, trigger decline
  useEffect(() => {
    if (!result) {
      window.location.href = `/api/decline/${token}`;
    }
  }, [result, token]);

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
        background: 'linear-gradient(135deg, #1E000E 0%, #55002F 50%, #8A004F 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      {loading ? (
        <div style={{ fontSize: 18, opacity: 0.8 }}>جارٍ التحميل...</div>
      ) : result === 'success' ? (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🙏</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            شكراً على ردك
          </h1>
          {invitation && !invitation.error && (
            <>
              <p style={{ fontSize: 18, opacity: 0.85, marginBottom: 16 }}>
                {invitation.guest_name}
              </p>
              <p
                style={{
                  fontSize: 15,
                  opacity: 0.7,
                  maxWidth: 300,
                  lineHeight: 1.6,
                }}
              >
                تم تسجيل اعتذارك عن حضور{' '}
                <strong>{invitation?.event_name}</strong>
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            {result === 'not_found'
              ? 'الدعوة غير موجودة'
              : 'حدث خطأ، حاول مجدداً'}
          </h1>
        </>
      )}
    </div>
  );
}
