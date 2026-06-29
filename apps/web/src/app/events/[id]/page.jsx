'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router';
import { useWebAuth, authFetch } from '../../../utils/webAuth.js';

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
  confirmed: { label: 'مؤكد', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  invited:   { label: 'مدعو', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  pending:   { label: 'معلق', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  declined:  { label: 'معتذر', bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
  attended:  { label: 'حضر',  bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: T.primarySoft, color: T.primary, border: T.border };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return dateStr; }
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: type === 'success' ? '#059669' : '#EF4444', color: '#fff', borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', maxWidth: 320, textAlign: 'center' }}>
      {message}
    </div>
  );
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2) result.push({ name: parts[0], phone: parts[1], companions: parseInt(parts[2] || '0') || 0 });
  }
  return result;
}

function DashHeader({ eventName }) {
  return (
    <div style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src={LOGO} alt="تراحيب" style={{ width: 62, height: 62, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </a>
          <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {eventName || 'تفاصيل الفعالية'}
          </span>
        </div>
        <a href="/dashboard" style={{ padding: '7px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          ← الفعاليات
        </a>
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const token = useWebAuth((s) => s.token);

  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestSearch, setGuestSearch] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', companions: 0 });
  const [pendingGuests, setPendingGuests] = useState([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [resendingGuests, setResendingGuests] = useState(new Set());
  const [specificResend, setSpecificResend] = useState({});
  const [sendingExtraQR, setSendingExtraQR] = useState(new Set());
  const [contactsSupported, setContactsSupported] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const csvInputRef = useRef(null);
  const vcfInputRef = useRef(null);
  const xlsxInputRef = useRef(null);

  useEffect(() => { if (!token) window.location.href = '/login'; }, [token]);
  useEffect(() => { setContactsSupported('contacts' in navigator); }, []);

  useEffect(() => {
    if (!token || !id) return;
    authFetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.event) setEvent(data.event);
        if (Array.isArray(data.guests)) setGuests(data.guests);
        if (data.error) setError(data.error);
      })
      .catch(() => setError('حدث خطأ في تحميل الفعالية'))
      .finally(() => setLoading(false));
  }, [token, id]);

  function handleAddGuest(e) {
    e.preventDefault();
    const name = newGuest.name.trim();
    const phone = newGuest.phone.trim();
    if (!name || !phone) return;
    setPendingGuests((prev) => [...prev, { name, phone, companions: parseInt(newGuest.companions) || 0 }]);
    setNewGuest({ name: '', phone: '', companions: 0 });
  }

  function removePending(index) {
    setPendingGuests((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCSVUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length === 0) { setToast({ message: 'لم يتم العثور على بيانات صالحة في الملف', type: 'error' }); return; }
      setPendingGuests((prev) => [...prev, ...parsed]);
      setToast({ message: `تم إضافة ${parsed.length} مدعو من الملف`, type: 'success' });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handlePickContacts() {
    try {
      const selected = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      if (!selected || selected.length === 0) return;
      const mapped = selected.map((c) => ({ name: (c.name?.[0] ?? '').trim(), phone: (c.tel?.[0] ?? '').trim(), companions: 0 })).filter((c) => c.name && c.phone);
      if (mapped.length === 0) { setToast({ message: 'لم يتم العثور على أرقام جوال في جهات الاتصال المختارة', type: 'error' }); return; }
      setPendingGuests((prev) => [...prev, ...mapped]);
      setToast({ message: `تم إضافة ${mapped.length} من جهات الاتصال`, type: 'success' });
    } catch (err) {
      if (err.name !== 'AbortError') setToast({ message: 'تعذر الوصول إلى جهات الاتصال', type: 'error' });
    }
  }

  async function handleExcelUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) { setToast({ message: 'الملف فارغ', type: 'error' }); return; }
      const findCol = (row, patterns) => {
        const key = Object.keys(row).find(k => patterns.some(p => k.toString().trim().toLowerCase().includes(p)));
        return key ? String(row[key]).trim() : '';
      };
      const mapped = rows.map(row => ({
        name: findCol(row, ['اسم', 'الاسم', 'name']),
        phone: findCol(row, ['جوال', 'هاتف', 'phone', 'mobile', 'tel']),
        companions: parseInt(findCol(row, ['مرافق', 'companions', 'accomp'])) || 0,
      })).filter(r => r.name && r.phone);
      if (!mapped.length) { setToast({ message: 'تأكد من أن الملف يحتوي على أعمدة: الاسم، رقم الجوال', type: 'error' }); return; }
      setPendingGuests(prev => [...prev, ...mapped]);
      setToast({ message: `تم إضافة ${mapped.length} مدعو من الملف`, type: 'success' });
    } catch {
      setToast({ message: 'تعذر قراءة الملف، تأكد من صيغة Excel', type: 'error' });
    }
    e.target.value = '';
  }

  function handleVCFUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const cards = text.split(/BEGIN:VCARD/i).slice(1);
      const results = [];
      for (const card of cards) {
        const fnMatch = card.match(/^FN[^:]*:(.+)$/m);
        const name = fnMatch ? fnMatch[1].trim() : '';
        const telMatch = card.match(/^TEL[^:]*:(.+)$/m);
        const phone = telMatch ? telMatch[1].trim().replace(/\s/g, '') : '';
        if (name && phone) results.push({ name, phone, companions: 0 });
      }
      if (!results.length) { setToast({ message: 'لم يتم العثور على جهات اتصال في الملف', type: 'error' }); return; }
      setPendingGuests(prev => [...prev, ...results]);
      setToast({ message: `تم إضافة ${results.length} من جهات الاتصال`, type: 'success' });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleBulkPaste() {
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const mapped = [];
    for (const line of lines) {
      const parts = line.split(/,|\t/).map(p => p.trim());
      if (parts.length >= 2) mapped.push({ name: parts[0], phone: parts[1], companions: parseInt(parts[2] || '0') || 0 });
      else if (parts.length === 1 && parts[0]) mapped.push({ name: parts[0], phone: parts[0], companions: 0 });
    }
    const valid = mapped.filter(c => c.name && c.phone);
    if (!valid.length) { setToast({ message: 'لم يتم التعرف على بيانات صالحة', type: 'error' }); return; }
    setPendingGuests(prev => [...prev, ...valid]);
    setBulkText('');
    setShowBulkPaste(false);
    setToast({ message: `تم إضافة ${valid.length} مدعو`, type: 'success' });
  }

  async function handleSendInvitations() {
    if (pendingGuests.length === 0) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/events/${id}/guests`, { method: 'POST', body: JSON.stringify({ guests: pendingGuests }) });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || 'حدث خطأ أثناء الإرسال', type: 'error' });
      } else {
        setToast({ message: `تم إرسال ${pendingGuests.length} دعوة بنجاح`, type: 'success' });
        setPendingGuests([]);
        const refreshed = await authFetch(`/api/events/${id}/guests`).then((r) => r.json());
        if (Array.isArray(refreshed.guests)) setGuests(refreshed.guests);
      }
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally { setSending(false); }
  }

  async function handleResendQR(guestId, companionNumber) {
    setResendingGuests((prev) => new Set(prev).add(guestId));
    try {
      const body = companionNumber != null ? { companionNumber } : {};
      const res = await authFetch(`/api/events/${id}/guests/${guestId}/resend-qr`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) setToast({ message: data.error || 'حدث خطأ أثناء إرسال رموز QR', type: 'error' });
      else {
        setToast({ message: data.message || 'جارٍ إرسال رمز QR', type: 'success' });
        if (companionNumber != null) setSpecificResend((prev) => ({ ...prev, [guestId]: '' }));
      }
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally {
      setResendingGuests((prev) => { const next = new Set(prev); next.delete(guestId); return next; });
    }
  }

  async function handleExtraQR(guestId) {
    setSendingExtraQR((prev) => new Set(prev).add(guestId));
    try {
      const res = await authFetch(`/api/events/${id}/guests/${guestId}/extra-qr`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setToast({ message: data.error || 'حدث خطأ أثناء إرسال رمز QR الإضافي', type: 'error' });
      else {
        setToast({ message: data.message || 'جارٍ إرسال رمز QR الإضافي', type: 'success' });
        setGuests((prev) => prev.map((g) => g.id === guestId ? { ...g, extra_qr_sent: true, companions: (g.companions ?? 0) + 1 } : g));
      }
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally {
      setSendingExtraQR((prev) => { const next = new Set(prev); next.delete(guestId); return next; });
    }
  }

  if (!token) return null;

  const confirmed = guests.filter(g => g.status === 'confirmed').length;
  const attended = guests.filter(g => g.status === 'attended').length;
  const invited = guests.filter(g => g.status === 'invited').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pct = event?.capacity ? Math.min(100, Math.round(guests.length / event.capacity * 100)) : 0;

  const filteredGuests = guests.filter(g =>
    !guestSearch || g.name?.includes(guestSearch) || g.phone?.includes(guestSearch)
  );

  const inp = { width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 14, color: T.text, background: T.surface, outline: 'none', boxSizing: 'border-box', fontFamily: "'Cairo', sans-serif" };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>
      <DashHeader eventName={event?.name} />

      {/* Event Hero Banner */}
      {!loading && event && (
        <div style={{ background: GRAD, padding: '32px 24px 56px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>{event.name}</h1>
            {event.capacity && (
              <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                سعة {event.capacity}
              </span>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }} className="stat-cards">
              {[
                { label: 'إجمالي الضيوف', value: guests.length, icon: '👥' },
                { label: 'مؤكد', value: confirmed, icon: '✅' },
                { label: 'مدعو', value: invited, icon: '📨' },
                { label: 'اعتذر', value: declined, icon: '❌' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '14px 18px', backdropFilter: 'blur(8px)' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {event.capacity > 0 && (
              <div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{pct}% ممتلئ</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SVG Wave */}
      {!loading && event && (
        <div style={{ background: GRAD }}>
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" style={{ width: '100%', height: 48, display: 'block' }}>
            <path d="M0,48 C360,0 1080,0 1440,48 L1440,48 L0,48 Z" fill={T.bg} />
          </svg>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60, fontSize: 16 }}>جارٍ التحميل...</div>
        ) : error ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, padding: 20, textAlign: 'center', color: '#EF4444' }}>{error}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }} className="detail-grid">

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Event details card */}
              <div style={{ background: T.surface, borderRadius: 20, padding: 24, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(138,0,79,0.05)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 16px', paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>تفاصيل الفعالية</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {event?.date && <div style={{ fontSize: 14, color: T.muted }}>📅 {formatDate(event.date)}</div>}
                  {event?.time && <div style={{ fontSize: 14, color: T.muted }}>🕐 {event.time?.slice(0, 5)}</div>}
                  {event?.venue && (
                    <div style={{ fontSize: 14, color: T.muted }}>
                      📍 {event.venue}
                      {event?.location && (() => {
                        const isUrl = /^https?:\/\//i.test(event.location);
                        return isUrl ? (
                          <a
                            href={event.location}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, fontSize: 12, color: T.primary, fontWeight: 600, textDecoration: 'none', background: T.primarySoft, border: `1px solid ${T.border}`, borderRadius: 6, padding: '2px 8px' }}
                          >
                            🗺️ عرض الخريطة
                          </a>
                        ) : (
                          <span>، {event.location}</span>
                        );
                      })()}
                    </div>
                  )}
                  {event?.capacity != null && <div style={{ fontSize: 14, color: T.muted }}>👥 {event.capacity} مدعو</div>}
                  {event?.description && <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, marginTop: 4 }}>{event.description}</div>}
                </div>
              </div>

              {/* Invitations CTA */}
              {pendingGuests.length > 0 && (
                <div style={{ background: T.primarySoft, borderRadius: 20, padding: 20, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.primary }}>في الانتظار: {pendingGuests.length} مدعو</span>
                    <button onClick={handleSendInvitations} disabled={sending}
                      style={{ background: GRAD, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
                      {sending ? 'جارٍ الإرسال...' : 'إرسال الدعوات'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pendingGuests.map((g, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${T.border}` }}>
                        <span style={{ color: T.text }}>{g.name}</span>
                        <button onClick={() => removePending(i)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div style={{ background: T.surface, borderRadius: 20, padding: 20, border: `1px solid ${T.border}` }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 14px' }}>إجراءات سريعة</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <a href={`/events/${id}/scan`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: GRAD, color: '#fff', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 12px rgba(138,0,79,0.2)' }}>
                    📷 مسح رمز QR
                  </a>
                  <a href={`/events/${id}/edit`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: T.primarySoft, color: T.primary, borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 600, border: `1px solid ${T.border}` }}>
                    ✏️ تعديل الفعالية
                  </a>
                </div>
              </div>
            </div>

            {/* Guest list */}
            <div>
              <div style={{ background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(138,0,79,0.05)', overflow: 'hidden' }}>
                {/* Guest list header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>المدعوون ({guests.length})</h3>
                    <button onClick={() => { setShowAddForm(v => !v); setShowBulkPaste(false); }}
                      style={{ background: showAddForm ? GRAD : T.primarySoft, color: showAddForm ? '#fff' : T.primary, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      {showAddForm ? 'إخفاء النموذج' : '+ إضافة مدعوين'}
                    </button>
                  </div>

                  {/* Search */}
                  <input value={guestSearch} onChange={e => setGuestSearch(e.target.value)} placeholder="ابحث في المدعوين..."
                    style={{ ...inp, marginBottom: 12 }} />

                  {/* Import buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {contactsSupported ? (
                      <button onClick={handlePickContacts} style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>📱 جهات الاتصال</button>
                    ) : (
                      <span style={{ fontSize: 11, color: T.muted, padding: '6px 12px', background: '#F9FAFB', borderRadius: 8, border: `1px solid ${T.border}` }}>💡 افتح في Chrome لجهات الاتصال</span>
                    )}
                    <button onClick={() => vcfInputRef.current?.click()} style={{ background: '#F9FAFB', color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📁 VCF</button>
                    <input ref={vcfInputRef} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={handleVCFUpload} style={{ display: 'none' }} />
                    <button onClick={() => xlsxInputRef.current?.click()} style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>📊 Excel</button>
                    <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} style={{ display: 'none' }} />
                    <button onClick={() => { setShowBulkPaste(v => !v); setShowAddForm(false); }} style={{ background: showBulkPaste ? '#FFFBEB' : '#F9FAFB', color: showBulkPaste ? '#D97706' : T.muted, border: `1px solid ${showBulkPaste ? '#FDE68A' : T.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>📋 لصق قائمة</button>
                    <button onClick={() => csvInputRef.current?.click()} style={{ background: '#F9FAFB', color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>CSV</button>
                    <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                  </div>
                </div>

                {/* Bulk paste panel */}
                {showBulkPaste && (
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, background: '#FFFBEB' }}>
                    <p style={{ fontSize: 13, color: T.muted, margin: '0 0 10px' }}>
                      الصق قائمة المدعوين — سطر لكل شخص: <span style={{ color: '#D97706', direction: 'ltr', display: 'inline-block' }}>الاسم، الجوال</span>
                    </p>
                    <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={'محمد علي، 0512345678\nسارة أحمد، 0598765432'} rows={5}
                      style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleBulkPaste} style={{ background: GRAD, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>إضافة للقائمة</button>
                      <button onClick={() => { setShowBulkPaste(false); setBulkText(''); }} style={{ background: 'transparent', color: T.muted, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>إلغاء</button>
                    </div>
                  </div>
                )}

                {/* Add guest form */}
                {showAddForm && (
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, background: T.primarySoft }}>
                    <form onSubmit={handleAddGuest}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: 'block', marginBottom: 4 }}>الاسم</label>
                          <input type="text" value={newGuest.name} onChange={e => setNewGuest(p => ({ ...p, name: e.target.value }))} placeholder="اسم المدعو" required style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: 'block', marginBottom: 4 }}>رقم الجوال</label>
                          <input type="tel" value={newGuest.phone} onChange={e => setNewGuest(p => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" required style={{ ...inp, direction: 'ltr', textAlign: 'right' }} />
                        </div>
                        <div style={{ minWidth: 80 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: 'block', marginBottom: 4 }}>المرافقون</label>
                          <input type="number" value={newGuest.companions} onChange={e => setNewGuest(p => ({ ...p, companions: e.target.value }))} min={0} style={inp} />
                        </div>
                        <button type="submit" style={{ background: GRAD, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', marginTop: 20 }}>إضافة</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Guest rows */}
                {filteredGuests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: T.muted, fontSize: 15 }}>
                    {guests.length === 0 ? 'لا يوجد مدعوون بعد' : 'لا توجد نتائج'}
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 70px 90px 100px 60px', padding: '10px 24px', borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.muted }}>
                      <span>الاسم</span>
                      <span>رقم الجوال</span>
                      <span>مرافقون</span>
                      <span>رموز QR</span>
                      <span>الحالة</span>
                      <span>إضافي</span>
                    </div>
                    {filteredGuests.map((g, i) => {
                      const companionQr = (g.qr_tokens ?? []).filter((q) => q.label?.startsWith('companion-')).length;
                      const expectedQr = g.companions ?? 0;
                      const missingQr = expectedQr - companionQr;
                      const isResending = resendingGuests.has(g.id);
                      const isSendingExtra = sendingExtraQR.has(g.id);
                      return (
                        <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 70px 90px 100px 60px', padding: '12px 24px', borderBottom: i < filteredGuests.length - 1 ? `1px solid ${T.border}` : 'none', fontSize: 14, alignItems: 'center', background: missingQr > 0 && g.status === 'confirmed' ? '#FFFBEB' : 'transparent' }}>
                          <span style={{ fontWeight: 600, color: T.text }}>{g.name}</span>
                          <span style={{ color: T.muted, direction: 'ltr', textAlign: 'right', fontSize: 13 }}>{g.phone}</span>
                          <span style={{ color: T.muted }}>{expectedQr}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {expectedQr === 0 || (g.status !== 'confirmed' && g.status !== 'attended') ? (
                              <span style={{ color: T.border, fontSize: 13 }}>—</span>
                            ) : missingQr > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={{ color: '#D97706', fontSize: 13, fontWeight: 600 }}>{companionQr}/{expectedQr}</span>
                                <button onClick={() => handleResendQR(g.id, undefined)} disabled={isResending}
                                  style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: isResending ? 'not-allowed' : 'pointer', opacity: isResending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                  {isResending ? 'جارٍ...' : `إرسال ${missingQr} مفقود`}
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#059669', fontSize: 13, fontWeight: 600 }}>✓ {companionQr}/{expectedQr}</span>
                            )}
                            {expectedQr > 0 && (g.status === 'confirmed' || g.status === 'attended') && (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                                <input type="number" min={1} max={expectedQr} placeholder="#" value={specificResend[g.id] ?? ''} onChange={e => setSpecificResend(prev => ({ ...prev, [g.id]: e.target.value }))}
                                  style={{ width: 40, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 6px', color: T.text, fontSize: 12, outline: 'none', textAlign: 'center' }} />
                                <button onClick={() => { const num = parseInt(specificResend[g.id], 10); if (!num) return; handleResendQR(g.id, num); }} disabled={isResending || !specificResend[g.id]}
                                  style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: isResending || !specificResend[g.id] ? 'not-allowed' : 'pointer', opacity: isResending || !specificResend[g.id] ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                                  {isResending ? 'جارٍ...' : 'إرسال'}
                                </button>
                              </div>
                            )}
                          </div>
                          <StatusBadge status={g.status} />
                          <button onClick={() => handleExtraQR(g.id)} disabled={g.extra_qr_sent || isSendingExtra}
                            title={g.extra_qr_sent ? 'تم إرسال رمز QR الإضافي مسبقاً' : 'إرسال رمز QR إضافي'}
                            style={{ background: g.extra_qr_sent ? '#F9FAFB' : T.primarySoft, color: g.extra_qr_sent ? T.muted : T.primary, border: `1px solid ${g.extra_qr_sent ? T.border : T.border}`, borderRadius: 8, padding: '5px 10px', fontSize: 16, cursor: g.extra_qr_sent || isSendingExtra ? 'not-allowed' : 'pointer', opacity: isSendingExtra ? 0.6 : 1, lineHeight: 1 }}>
                            {isSendingExtra ? '...' : g.extra_qr_sent ? '✓' : '+'}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 600px) { .stat-cards { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </div>
  );
}
