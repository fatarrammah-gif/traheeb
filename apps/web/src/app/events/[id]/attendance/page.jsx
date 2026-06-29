'use client';

import { useEffect, useState } from 'react';
import { useWebAuth, authFetch } from '../../../../utils/webAuth.js';

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

function useParams() {
  if (typeof window === 'undefined') return {};
  const parts = window.location.pathname.split('/');
  return { id: parts[parts.indexOf('events') + 1] };
}

export default function AttendancePage() {
  const token = useWebAuth((s) => s.token);
  const [guests, setGuests] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | attended | absent
  const [search, setSearch] = useState('');
  const [id, setId] = useState(null);

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    const parts = window.location.pathname.split('/');
    const eventId = parts[parts.indexOf('events') + 1];
    setId(eventId);

    Promise.all([
      authFetch(`/api/events/${eventId}`).then(r => r.json()),
      authFetch(`/api/events/${eventId}/guests`).then(r => r.json()),
    ]).then(([evData, gData]) => {
      setEvent(evData.event ?? evData);
      const list = gData.guests ?? gData ?? [];
      setGuests(list);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (!token) return null;

  // Flatten all QR tokens with guest info
  const rows = [];
  guests.forEach(g => {
    const tokens = g.qr_tokens ?? [];
    if (tokens.length === 0) return;
    tokens.forEach(t => {
      const isCompanion = t.label?.startsWith('companion-');
      rows.push({
        guestName: g.name,
        guestPhone: g.phone,
        ticketId: t.token ?? t.id,
        label: isCompanion ? `مرافق ${t.label?.replace('companion-', '') ?? ''}` : 'رئيسي',
        attended: !!t.used,
        isCompanion,
      });
    });
  });

  const filtered = rows.filter(r => {
    if (filter === 'attended' && !r.attended) return false;
    if (filter === 'absent' && r.attended) return false;
    if (search && !r.guestName?.includes(search) && !r.guestPhone?.includes(search)) return false;
    return true;
  });

  const attendedCount = rows.filter(r => r.attended).length;
  const absentCount = rows.filter(r => !r.attended).length;

  const FILTERS = [
    { key: 'all',      label: `الكل (${rows.length})` },
    { key: 'attended', label: `حاضر (${attendedCount})` },
    { key: 'absent',   label: `متغيب (${absentCount})` },
  ];

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>

      {/* Header */}
      <div style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src={LOGO} alt="تراحيب" style={{ width: 62, height: 62, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </a>
          <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
          <a href={id ? `/events/${id}` : '/dashboard'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            ← {event?.name ?? 'الفعالية'}
          </a>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>تفاصيل الحضور</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: GRAD, padding: '24px 24px 52px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>
            تفاصيل الحضور — {event?.name ?? ''}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 500 }}>
            {[
              { label: 'إجمالي رموز QR', value: rows.length, icon: '🎫' },
              { label: 'حاضر', value: attendedCount, icon: '✅' },
              { label: 'متغيب', value: absentCount, icon: '🔴' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '12px 16px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: GRAD }}>
        <svg viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ width: '100%', height: 40, display: 'block' }}>
          <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill={T.bg} />
        </svg>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الجوال..."
            style={{ flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, color: T.text, background: T.surface, outline: 'none', fontFamily: "'Cairo', sans-serif" }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: `1px solid ${filter === f.key ? T.primary : T.border}`, background: filter === f.key ? T.primarySoft : T.surface, color: filter === f.key ? T.primary : T.muted, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>لا توجد نتائج</div>
        ) : (
          <div style={{ background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(138,0,79,0.05)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', padding: '12px 24px', borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.muted, background: T.primarySoft }}>
              <span>المدعو</span>
              <span>النوع</span>
              <span>الحالة</span>
            </div>
            {filtered.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', padding: '13px 24px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', fontSize: 14, background: r.attended ? '#F0FDF4' : 'transparent' }}>
                <div>
                  <div style={{ fontWeight: 600, color: T.text }}>{r.guestName}</div>
                  <div style={{ fontSize: 12, color: T.muted, direction: 'ltr', textAlign: 'right' }}>{r.guestPhone}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, background: r.isCompanion ? '#EFF6FF' : T.primarySoft, color: r.isCompanion ? '#2563EB' : T.primary, borderRadius: 8, padding: '3px 10px', display: 'inline-block' }}>
                  {r.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, background: r.attended ? '#ECFDF5' : '#FEF2F2', color: r.attended ? '#059669' : '#EF4444', borderRadius: 8, padding: '3px 10px', border: `1px solid ${r.attended ? '#A7F3D0' : '#FECACA'}`, display: 'inline-block' }}>
                  {r.attended ? 'حاضر' : 'متغيب'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
