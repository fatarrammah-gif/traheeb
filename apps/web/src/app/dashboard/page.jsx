'use client';

import { useEffect, useState } from 'react';
import { useWebAuth, authFetch } from '../../utils/webAuth.js';

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: '20px 24px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      <div style={{ height: 20, background: 'rgba(255,255,255,0.12)', borderRadius: 6, marginBottom: 10, width: '60%' }} />
      <div style={{ height: 14, background: 'rgba(255,255,255,0.08)', borderRadius: 6, marginBottom: 8, width: '40%' }} />
      <div style={{ height: 14, background: 'rgba(255,255,255,0.08)', borderRadius: 6, width: '50%' }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

export default function DashboardPage() {
  const token = useWebAuth((s) => s.token);
  const logout = useWebAuth((s) => s.logout);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    authFetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.events)) {
          setEvents(data.events);
        } else if (Array.isArray(data)) {
          setEvents(data);
        } else {
          setError('تعذر تحميل الفعاليات');
        }
      })
      .catch(() => setError('حدث خطأ في الاتصال'))
      .finally(() => setLoading(false));
  }, [token]);

  function handleLogout() {
    logout();
    window.location.href = '/login';
  }

  if (!token) return null;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1E000E 0%, #3D0022 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          background: 'rgba(30,0,14,0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#C8005A', margin: 0 }}>
          تراحيب
        </h1>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: '8px 18px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          تسجيل الخروج
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>فعالياتي</h2>
          <a
            href="/events/new"
            style={{
              background: '#C8005A',
              color: '#fff',
              borderRadius: 12,
              padding: '12px 22px',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            + إنشاء فعالية
          </a>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div
            style={{
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.3)',
              borderRadius: 12,
              padding: '20px',
              textAlign: 'center',
              color: '#ff6b6b',
            }}
          >
            {error}
          </div>
        ) : events.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 56 }}>📋</div>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              لا توجد فعاليات بعد
            </p>
            <a
              href="/events/new"
              style={{
                background: '#C8005A',
                color: '#fff',
                borderRadius: 12,
                padding: '14px 28px',
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: 8,
              }}
            >
              + إنشاء فعالية
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {events.map((event) => (
              <a
                key={event.id}
                href={`/events/${event.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>
                    {event.name}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                    {event.date && (
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                        📅 {formatDate(event.date)}
                      </span>
                    )}
                    {event.time && (
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                        🕐 {formatTime(event.time)}
                      </span>
                    )}
                    {event.venue && (
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                        📍 {event.venue}
                      </span>
                    )}
                    {event.capacity != null && (
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                        👥 {event.capacity} مدعو
                      </span>
                    )}
                    {event.total_guests != null && event.total_guests > 0 && (
                      <span
                        style={{
                          fontSize: 13,
                          background: 'rgba(200,0,90,0.2)',
                          color: '#ff6aab',
                          borderRadius: 8,
                          padding: '2px 10px',
                        }}
                      >
                        {event.total_guests} مسجّل
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
