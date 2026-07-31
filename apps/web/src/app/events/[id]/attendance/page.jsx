'use client';

import { useEffect, useState } from 'react';
import { useWebAuth } from '../../../../utils/webAuth.js';

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

function formatDateTime(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString('ar-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
}

/**
 * Build flat attendance rows from the guests list.
 *
 * Overlay mode (main token with max_scans > 1):
 *   Expand into max_scans rows — one for the main invitee, one per companion.
 *   Attended = scan_count > rowIndex.
 *   Timestamp: only available on the last scan (used_at when token is exhausted).
 *
 * Card mode (companion-N tokens):
 *   One row for the main invitee (status === 'attended').
 *   One row per companion token.
 */
function buildRows(guests) {
  const rows = [];

  guests.forEach(g => {
    const mainToken = (g.qr_tokens ?? []).find(t => t.label === 'main');
    const isOverlay = mainToken && (mainToken.max_scans ?? 1) > 1;

    if (isOverlay) {
      const scanCount = mainToken.scan_count ?? 0;
      const maxScans  = mainToken.max_scans;

      for (let i = 0; i < maxScans; i++) {
        const attended = scanCount > i;
        // Timestamp is only stored for the final scan (used_at set when token exhausted)
        const isLastScan = i === maxScans - 1;
        const attendedAt = attended && isLastScan && mainToken.used_at
          ? formatDateTime(mainToken.used_at)
          : null;

        rows.push({
          guestId:    g.id,
          guestName:  g.name,
          guestPhone: g.phone,
          type:       i === 0 ? 'الضيف الرئيسي' : `مرافق ${i}`,
          isMain:     i === 0,
          attended,
          attendedAt,
        });
      }
    } else {
      // Card mode — main guest row (from status field)
      rows.push({
        guestId:    g.id,
        guestName:  g.name,
        guestPhone: g.phone,
        type:       'الضيف الرئيسي',
        isMain:     true,
        attended:   g.status === 'attended',
        attendedAt: null,
      });

      // Companion QR token rows
      const companionTokens = (g.qr_tokens ?? [])
        .filter(t => t.label?.startsWith('companion-'))
        .sort((a, b) => {
          const n = s => parseInt(s.label?.replace('companion-', '') ?? '0');
          return n(a) - n(b);
        });

      companionTokens.forEach(t => {
        const num = t.label?.replace('companion-', '') ?? '';
        rows.push({
          guestId:    g.id,
          guestName:  g.name,
          guestPhone: g.phone,
          type:       `مرافق ${num}`,
          isMain:     false,
          attended:   !!t.used,
          attendedAt: t.used && t.used_at ? formatDateTime(t.used_at) : null,
        });
      });
    }
  });

  return rows;
}

export default function AttendancePage() {
  const organizerToken = useWebAuth((s) => s.token);
  const [guests, setGuests] = useState([]);
  const [event, setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // all | attended | absent
  const [search, setSearch]   = useState('');
  const [id, setId]           = useState(null);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    const parts = window.location.pathname.split('/');
    const eventId = parts[parts.indexOf('events') + 1];
    setId(eventId);

    // Accept organizer JWT or staff token
    const staffToken = localStorage.getItem('traheeb_staff_token');
    const staffEventId = localStorage.getItem('traheeb_staff_event_id');
    const token = organizerToken || (staffEventId === eventId ? staffToken : null);

    if (!token) {
      window.location.href = `/events/${eventId}/staff-login`;
      return;
    }

    if (!organizerToken && staffToken) setIsStaff(true);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/events/${eventId}`, { headers }).then(r => r.json()),
      fetch(`/api/events/${eventId}/guests`, { headers }).then(r => r.json()),
    ]).then(([evData, gData]) => {
      setEvent(evData.event ?? evData);
      setGuests(gData.guests ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [organizerToken]);

  if (!organizerToken && !isStaff) return null;

  const rows         = buildRows(guests.filter(g => g.status !== 'declined'));
  const attendedRows = rows.filter(r => r.attended);
  const absentRows   = rows.filter(r => !r.attended);

  const filtered = rows.filter(r => {
    if (filter === 'attended' && !r.attended) return false;
    if (filter === 'absent'   &&  r.attended) return false;
    if (search && !r.guestName?.includes(search) && !r.guestPhone?.includes(search)) return false;
    return true;
  });

  const FILTERS = [
    { key: 'all',      label: `الكل (${rows.length})` },
    { key: 'attended', label: `حاضر (${attendedRows.length})` },
    { key: 'absent',   label: `لم يحضر (${absentRows.length})` },
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
          <a href={id ? (isStaff ? `/events/${id}/staff-view` : `/events/${id}`) : '/dashboard'}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 500, marginBottom: 20 }}>
            {[
              { label: 'إجمالي المتوقعين', value: rows.length,         icon: '🎫' },
              { label: 'حاضر',              value: attendedRows.length, icon: '✅' },
              { label: 'لم يحضر بعد',       value: absentRows.length,  icon: '🔴' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '12px 16px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {rows.length > 0 && (() => {
            const pct = Math.min(100, Math.round((attendedRows.length / rows.length) * 100));
            return (
              <div style={{ maxWidth: 500 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>نسبة الحضور</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{attendedRows.length} / {rows.length}</span>
                </div>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 6, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{pct}% حضروا</div>
              </div>
            );
          })()}
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 140px 1fr', padding: '12px 24px', borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.muted, background: T.primarySoft }}>
              <span>الاسم</span>
              <span>النوع</span>
              <span>وقت الحضور</span>
            </div>

            {filtered.map((r, i) => {
              const isLast = i === filtered.length - 1;
              return (
                <div key={`${r.guestId}-${r.type}`}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 140px 1fr', padding: '13px 24px', borderBottom: isLast ? 'none' : `1px solid ${T.border}`, alignItems: 'center', fontSize: 14, background: r.attended ? '#F0FDF4' : 'transparent' }}>

                  {/* Name */}
                  <div>
                    <div style={{ fontWeight: 600, color: T.text }}>{r.guestName}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 1, direction: 'ltr', textAlign: 'right' }}>{r.guestPhone}</div>
                  </div>

                  {/* Type badge */}
                  <span style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '3px 10px', display: 'inline-block',
                    background: r.isMain ? T.primarySoft : '#EFF6FF',
                    color:      r.isMain ? T.primary    : '#2563EB',
                    border:     `1px solid ${r.isMain ? T.border : '#BFDBFE'}`,
                  }}>
                    {r.type}
                  </span>

                  {/* Attendance time */}
                  {r.attended ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>✓ حضر</span>
                      {r.attendedAt && (
                        <span style={{ fontSize: 12, color: T.muted }}>{r.attendedAt}</span>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: T.muted }}>—</span>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
