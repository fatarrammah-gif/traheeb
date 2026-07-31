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

const STATUS_CONFIG = {
  confirmed: { label: 'مؤكد',   bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  invited:   { label: 'مدعو',   bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  declined:  { label: 'معتذر',  bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
  attended:  { label: 'حضر',    bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  pending:   { label: 'معلق',   bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: T.primarySoft, color: T.primary, border: T.border };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function getEventId() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/');
  const idx = parts.indexOf('events');
  return idx >= 0 ? parts[idx + 1] : '';
}

function parseJwtPayload(token) {
  try {
    // Staff JWT is encoded by @auth/core/jwt — it's not a plain base64 JWT.
    // We rely on the server to validate it; here we just check localStorage for eventId.
    return null;
  } catch { return null; }
}

export default function StaffViewPage() {
  const [eventId, setEventId] = useState('');
  const [token, setToken] = useState(null);
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    const id = getEventId();
    setEventId(id);

    const storedToken = localStorage.getItem('traheeb_staff_token');
    const storedEventId = localStorage.getItem('traheeb_staff_event_id');

    if (!storedToken || storedEventId !== id) {
      window.location.href = `/events/${id}/staff-login`;
      return;
    }

    setToken(storedToken);

    const headers = { Authorization: `Bearer ${storedToken}` };

    Promise.all([
      fetch(`/api/events/${id}`, { headers }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json() })),
      fetch(`/api/events/${id}/guests`, { headers }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json() })),
    ]).then(([evRes, gRes]) => {
      if (!evRes.ok && (evRes.status === 401 || evRes.status === 403)) {
        localStorage.removeItem('traheeb_staff_token');
        window.location.href = `/events/${id}/staff-login`;
        return;
      }
      setEvent(evRes.data?.event ?? evRes.data);
      const gList = gRes.data?.guests;
      setGuests(Array.isArray(gList) ? gList : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem('traheeb_staff_token');
    localStorage.removeItem('traheeb_staff_event_id');
    window.location.href = `/events/${eventId}/staff-login`;
  }

  const confirmed = guests.filter(g => g.status === 'confirmed').length;
  const attended  = guests.filter(g => g.status === 'attended').length;
  const invited   = guests.filter(g => g.status === 'invited').length;
  const declined  = guests.filter(g => g.status === 'declined').length;

  const filtered = guests.filter(g => {
    if (statusFilter && g.status !== statusFilter) return false;
    if (search && !g.name?.includes(search) && !g.phone?.includes(search)) return false;
    return true;
  });

  const FILTERS = [
    { key: null,        label: `الكل (${guests.length})` },
    { key: 'confirmed', label: `مؤكد (${confirmed})` },
    { key: 'invited',   label: `مدعو (${invited})` },
    { key: 'attended',  label: `حضر (${attended})` },
    { key: 'declined',  label: `معتذر (${declined})` },
  ];

  if (!token) return null;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>

      {/* Header */}
      <div style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src={LOGO} alt="تراحيب" style={{ width: 56, height: 56, objectFit: 'contain', mixBlendMode: 'screen', flexShrink: 0 }} />
          <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event?.name ?? 'عرض الفريق'}
          </span>
          <button onClick={logout}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: "'Cairo', sans-serif" }}>
            خروج
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: GRAD, padding: '28px 24px 52px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>
            {event?.name ?? ''}
          </h1>

          {/* Stat boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 560, marginBottom: 20 }}>
            {[
              { label: 'مدعو',   value: guests.length, icon: '📨' },
              { label: 'مؤكد',   value: confirmed,     icon: '✅' },
              { label: 'حضر',    value: attended,      icon: '🎫' },
              { label: 'معتذر',  value: declined,      icon: '❌' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 12px', backdropFilter: 'blur(8px)', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`/events/${eventId}/staff-scan`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: T.primary, borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              📷 مسح رمز QR
            </a>
            <a href={`/events/${eventId}/attendance`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              📊 تفاصيل الحضور
            </a>
          </div>
        </div>
      </div>
      <div style={{ background: GRAD }}>
        <svg viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ width: '100%', height: 40, display: 'block' }}>
          <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill={T.bg} />
        </svg>
      </div>

      {/* Guest list */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>

        <div style={{ background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(138,0,79,0.05)', overflow: 'hidden' }}>

          {/* List header */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: '0 0 14px' }}>
              المدعوون ({guests.length})
            </h3>

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الجوال..."
              style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, color: T.text, background: T.bg, outline: 'none', boxSizing: 'border-box', fontFamily: "'Cairo', sans-serif", marginBottom: 12 }}
            />

            {/* Filter tags */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={String(f.key)} onClick={() => setStatusFilter(f.key)}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: `1px solid ${statusFilter === f.key ? T.primary : T.border}`, background: statusFilter === f.key ? T.primarySoft : T.surface, color: statusFilter === f.key ? T.primary : T.muted, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.muted }}>جارٍ التحميل...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.muted }}>لا توجد نتائج</div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 24px', background: T.primarySoft, fontSize: 12, fontWeight: 700, color: T.muted, borderBottom: `1px solid ${T.border}` }}>
                <span>الاسم</span>
                <span>الحالة</span>
              </div>
              {filtered.map((g, i) => (
                <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '13px 24px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: g.status === 'attended' ? '#F0FDF4' : 'transparent' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: T.text, fontSize: 14 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: T.muted, direction: 'ltr', textAlign: 'right', marginTop: 2 }}>{g.phone}</div>
                  </div>
                  <StatusBadge status={g.status} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
