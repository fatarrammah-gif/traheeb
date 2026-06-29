'use client';

import { useEffect, useState } from 'react';
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
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function SkeletonCard() {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '20px 24px', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ height: 20, background: '#F2E0EB', borderRadius: 6, marginBottom: 10, width: '60%' }} />
      <div style={{ height: 14, background: '#FFF0F7', borderRadius: 6, marginBottom: 8, width: '40%' }} />
      <div style={{ height: 14, background: '#FFF0F7', borderRadius: 6, width: '50%' }} />
    </div>
  );
}

function DashHeader({ user, onLogout }) {
  return (
    <div style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src={LOGO} alt="تراحيب" style={{ width: 62, height: 62, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </a>
          <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>لوحة التحكم</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { label: 'الفعاليات', href: '/dashboard', active: true },
            { label: 'إنشاء فعالية', href: '/events/new' },
          ].map((l) => (
            <a key={l.href} href={l.href}
              style={{ padding: '7px 16px', borderRadius: 10, fontSize: 14, fontWeight: l.active ? 700 : 500, color: l.active ? '#C2185B' : 'rgba(255,255,255,0.85)', background: l.active ? '#fff' : 'transparent', textDecoration: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => { if (!l.active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={e => { if (!l.active) e.currentTarget.style.background = 'transparent'; }}
            >
              {l.label}
            </a>
          ))}
        </div>
        {user && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px 6px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.28)', flexShrink: 0, cursor: 'pointer' }}
            onClick={onLogout}
            title="تسجيل الخروج"
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user.name}</span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2185B', fontWeight: 800, fontSize: 15 }}>
              {(user.name || 'م').charAt(0)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const token = useWebAuth((s) => s.token);
  const user = useWebAuth((s) => s.user);
  const logout = useWebAuth((s) => s.logout);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token) window.location.href = '/login';
  }, [token]);

  useEffect(() => {
    if (!token) return;
    authFetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.events)) setEvents(data.events);
        else if (Array.isArray(data)) setEvents(data);
        else setError('تعذر تحميل الفعاليات');
      })
      .catch(() => setError('حدث خطأ في الاتصال'))
      .finally(() => setLoading(false));
  }, [token]);

  function handleLogout() {
    logout();
    window.location.href = '/login';
  }

  if (!token) return null;

  const totalGuests = events.reduce((s, e) => s + (e.total_guests || 0), 0);
  const totalAttended = events.reduce((s, e) => s + (e.attended_count || 0), 0);

  const filtered = events.filter((e) =>
    !search ||
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.venue?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>
      <DashHeader user={user} onLogout={handleLogout} />

      {/* Stats Banner */}
      <div style={{ background: GRAD, padding: '32px 24px 60px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
            مرحباً {user?.name} 👋
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: '0 0 28px' }}>
            إجمالي إحصائيات جميع فعالياتك
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="stats-grid">
            {[
              { label: 'إجمالي الفعاليات', value: events.length, icon: '📅' },
              { label: 'إجمالي الضيوف', value: totalGuests, icon: '👥' },
              { label: 'إجمالي الحضور', value: totalAttended, icon: '✅' },
            ].map((stat) => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: '20px 24px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Wave */}
      <div style={{ background: GRAD }}>
        <svg viewBox="0 0 1440 48" preserveAspectRatio="none" style={{ width: '100%', height: 48, display: 'block' }}>
          <path d="M0,48 C360,0 1080,0 1440,48 L1440,48 L0,48 Z" fill={T.bg} />
        </svg>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Search + create */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن فعالية..."
            style={{ flex: 1, padding: '11px 16px', borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, color: T.text, background: T.surface, outline: 'none', fontFamily: "'Cairo', sans-serif" }}
          />
          <a
            href="/events/new"
            style={{ background: GRAD, color: '#fff', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(138,0,79,0.25)' }}
          >
            + إنشاء فعالية
          </a>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : error ? (
          <div style={{ background: '#FFF0F7', border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, textAlign: 'center', color: T.primary }}>
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 56 }}>📋</div>
            <p style={{ fontSize: 18, color: T.muted, margin: 0 }}>{search ? 'لا توجد نتائج' : 'لا توجد فعاليات بعد'}</p>
            {!search && (
              <a href="/events/new" style={{ background: GRAD, color: '#fff', borderRadius: 12, padding: '14px 28px', fontSize: 16, fontWeight: 700, textDecoration: 'none', marginTop: 8, boxShadow: '0 4px 16px rgba(138,0,79,0.25)' }}>
                + إنشاء فعالية
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {filtered.map((event) => {
              const pct = event.capacity ? Math.min(100, Math.round((event.total_guests || 0) / event.capacity * 100)) : 0;
              return (
                <a key={event.id} href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `5px solid ${T.primary}`, borderRadius: 20, padding: '20px 24px', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(138,0,79,0.12)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
                  >
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 10px', color: T.text }}>{event.name}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginBottom: 14 }}>
                      {event.date && <span style={{ fontSize: 13, color: T.muted }}>📅 {formatDate(event.date)}</span>}
                      {event.time && <span style={{ fontSize: 13, color: T.muted }}>🕐 {formatTime(event.time)}</span>}
                      {event.venue && <span style={{ fontSize: 13, color: T.muted }}>📍 {event.venue}</span>}
                    </div>
                    {event.capacity > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ height: 6, background: '#F2E0EB', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: GRAD, borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{pct}% ممتلئ</div>
                      </div>
                    )}
                    {event.total_guests != null && event.total_guests > 0 && (
                      <span style={{ fontSize: 13, background: T.primarySoft, color: T.primary, borderRadius: 8, padding: '3px 10px', fontWeight: 700, border: `1px solid ${T.border}` }}>
                        {event.total_guests} مسجّل
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
