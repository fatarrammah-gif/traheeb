'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router';
import { useWebAuth, authFetch } from '../../../utils/webAuth.js';

const STATUS_LABELS = {
  invited: 'مدعو',
  confirmed: 'مؤكد',
  declined: 'اعتذر',
  attended: 'حضر',
};

const STATUS_COLORS = {
  invited: { bg: 'rgba(33,150,243,0.2)', color: '#64b5f6' },
  confirmed: { bg: 'rgba(76,175,80,0.2)', color: '#81c784' },
  declined: { bg: 'rgba(244,67,54,0.2)', color: '#e57373' },
  attended: { bg: 'rgba(255,193,7,0.2)', color: '#ffd54f' },
};

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || { bg: 'rgba(255,255,255,0.1)', color: '#fff' };
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        borderRadius: 8,
        padding: '3px 10px',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
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

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background: type === 'success' ? '#1b5e20' : '#b71c1c',
        color: '#fff',
        borderRadius: 12,
        padding: '14px 24px',
        fontSize: 15,
        fontWeight: 600,
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        maxWidth: 320,
        textAlign: 'center',
      }}
    >
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
    if (parts.length >= 2) {
      result.push({
        name: parts[0],
        phone: parts[1],
        companions: parseInt(parts[2] || '0') || 0,
      });
    }
  }
  return result;
}

const inputStyle = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function EventDetailPage() {
  const { id } = useParams();
  const token = useWebAuth((s) => s.token);

  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', companions: 0 });
  const [pendingGuests, setPendingGuests] = useState([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [resendingGuests, setResendingGuests] = useState(new Set());
  const [contactsSupported, setContactsSupported] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const csvInputRef = useRef(null);
  const vcfInputRef = useRef(null);
  const xlsxInputRef = useRef(null);

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
    }
  }, [token]);

  useEffect(() => {
    setContactsSupported('contacts' in navigator);
  }, []);

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
      if (parsed.length === 0) {
        setToast({ message: 'لم يتم العثور على بيانات صالحة في الملف', type: 'error' });
        return;
      }
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

      const mapped = selected
        .map((c) => ({
          name: (c.name?.[0] ?? '').trim(),
          phone: (c.tel?.[0] ?? '').trim(),
          companions: 0,
        }))
        .filter((c) => c.name && c.phone);

      if (mapped.length === 0) {
        setToast({ message: 'لم يتم العثور على أرقام جوال في جهات الاتصال المختارة', type: 'error' });
        return;
      }

      setPendingGuests((prev) => [...prev, ...mapped]);
      setToast({ message: `تم إضافة ${mapped.length} من جهات الاتصال`, type: 'success' });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setToast({ message: 'تعذر الوصول إلى جهات الاتصال', type: 'error' });
      }
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

      if (!rows.length) {
        setToast({ message: 'الملف فارغ', type: 'error' });
        return;
      }

      // Flexible column matching — works with Arabic or English headers
      const findCol = (row, patterns) => {
        const key = Object.keys(row).find(k =>
          patterns.some(p => k.toString().trim().toLowerCase().includes(p))
        );
        return key ? String(row[key]).trim() : '';
      };

      const mapped = rows.map(row => ({
        name:       findCol(row, ['اسم', 'الاسم', 'name']),
        phone:      findCol(row, ['جوال', 'هاتف', 'phone', 'mobile', 'tel']),
        companions: parseInt(findCol(row, ['مرافق', 'companions', 'accomp'])) || 0,
      })).filter(r => r.name && r.phone);

      if (!mapped.length) {
        setToast({ message: 'تأكد من أن الملف يحتوي على أعمدة: الاسم، رقم الجوال', type: 'error' });
        return;
      }

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
        // Extract full name
        const fnMatch = card.match(/^FN[^:]*:(.+)$/m);
        const name = fnMatch ? fnMatch[1].trim() : '';
        // Extract first phone number
        const telMatch = card.match(/^TEL[^:]*:(.+)$/m);
        const phone = telMatch ? telMatch[1].trim().replace(/\s/g, '') : '';
        if (name && phone) results.push({ name, phone, companions: 0 });
      }
      if (!results.length) {
        setToast({ message: 'لم يتم العثور على جهات اتصال في الملف', type: 'error' });
        return;
      }
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
      // Support: "Name, Phone" or "Name Phone" or just "Phone"
      const parts = line.split(/,|\t/).map(p => p.trim());
      if (parts.length >= 2) {
        mapped.push({ name: parts[0], phone: parts[1], companions: parseInt(parts[2] || '0') || 0 });
      } else if (parts.length === 1 && parts[0]) {
        // Just a phone number — use it as name too
        mapped.push({ name: parts[0], phone: parts[0], companions: 0 });
      }
    }
    const valid = mapped.filter(c => c.name && c.phone);
    if (!valid.length) {
      setToast({ message: 'لم يتم التعرف على بيانات صالحة', type: 'error' });
      return;
    }
    setPendingGuests(prev => [...prev, ...valid]);
    setBulkText('');
    setShowBulkPaste(false);
    setToast({ message: `تم إضافة ${valid.length} مدعو`, type: 'success' });
  }

  async function handleSendInvitations() {
    if (pendingGuests.length === 0) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/events/${id}/guests`, {
        method: 'POST',
        body: JSON.stringify({ guests: pendingGuests }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || 'حدث خطأ أثناء الإرسال', type: 'error' });
      } else {
        setToast({ message: `تم إرسال ${pendingGuests.length} دعوة بنجاح`, type: 'success' });
        setPendingGuests([]);
        // Refresh guests list
        const refreshed = await authFetch(`/api/events/${id}/guests`).then((r) => r.json());
        if (Array.isArray(refreshed.guests)) setGuests(refreshed.guests);
      }
    } catch {
      setToast({ message: 'حدث خطأ في الاتصال', type: 'error' });
    } finally {
      setSending(false);
    }
  }

  async function handleResendQR(guestId) {
    setResendingGuests((prev) => new Set(prev).add(guestId));
    try {
      const res = await authFetch(`/api/events/${id}/guests/${guestId}/resend-qr`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || 'حدث خطأ أثناء إرسال رموز QR', type: 'error' });
      } else {
        setToast({ message: data.message || 'جارٍ إرسال رموز QR المفقودة', type: 'success' });
      }
    } catch {
      setToast({ message: 'حدث خطأ في الاتصال', type: 'error' });
    } finally {
      setResendingGuests((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
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
          gap: 16,
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          background: 'rgba(30,0,14,0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        <a
          href="/dashboard"
          style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1 }}
        >
          &#8592;
        </a>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#C8005A', flex: 1 }}>
          {loading ? 'جارٍ التحميل...' : event?.name || 'الفعالية'}
        </h1>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: 40 }}>
            جارٍ التحميل...
          </div>
        ) : error ? (
          <div
            style={{
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.3)',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              color: '#ff6b6b',
            }}
          >
            {error}
          </div>
        ) : (
          <>
            {/* Event info card */}
            {event && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                  padding: '20px 24px',
                  marginBottom: 20,
                }}
              >
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 14px' }}>{event.name}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                  {event.date && (
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                      📅 {formatDate(event.date)}
                    </span>
                  )}
                  {event.time && (
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                      🕐 {event.time?.slice(0, 5)}
                    </span>
                  )}
                  {event.venue && (
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                      📍 {event.venue}{event.location ? `، ${event.location}` : ''}
                    </span>
                  )}
                  {event.capacity != null && (
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                      👥 {event.capacity} مدعو
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <a
                href={`/events/${id}/scan`}
                style={{
                  background: '#C8005A',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '12px 20px',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📷 مسح رمز QR
              </a>
              <a
                href={`/events/${id}/edit`}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  padding: '12px 20px',
                  fontSize: 14,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                ✏️ تعديل
              </a>
            </div>

            {/* Guest section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  المدعوون ({guests.length})
                </h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {contactsSupported ? (
                    <button
                      onClick={handlePickContacts}
                      style={{
                        background: 'rgba(33,150,243,0.15)',
                        color: '#64b5f6',
                        border: '1px solid rgba(33,150,243,0.3)',
                        borderRadius: 10,
                        padding: '8px 16px',
                        fontSize: 13,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      📱 من جهات الاتصال
                    </button>
                  ) : (
                    <div style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.45)',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                      maxWidth: 220,
                      lineHeight: 1.5,
                    }}>
                      💡 لفتح جهات الاتصال مباشرةً افتح الصفحة في متصفح Chrome
                    </div>
                  )}
                  <button
                    onClick={() => vcfInputRef.current?.click()}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.75)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    📁 استيراد VCF
                  </button>
                  <input
                    ref={vcfInputRef}
                    type="file"
                    accept=".vcf,text/vcard,text/x-vcard"
                    onChange={handleVCFUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => xlsxInputRef.current?.click()}
                    style={{
                      background: 'rgba(76,175,80,0.15)',
                      color: '#81c784',
                      border: '1px solid rgba(76,175,80,0.3)',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    📊 استيراد Excel
                  </button>
                  <input
                    ref={xlsxInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => { setShowBulkPaste(v => !v); setShowAddForm(false); }}
                    style={{
                      background: showBulkPaste ? 'rgba(255,193,7,0.2)' : 'rgba(255,255,255,0.08)',
                      color: showBulkPaste ? '#ffd54f' : 'rgba(255,255,255,0.75)',
                      border: `1px solid ${showBulkPaste ? 'rgba(255,193,7,0.3)' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    📋 لصق قائمة
                  </button>
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.75)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    إضافة من ملف CSV
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCSVUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => { setShowAddForm(v => !v); setShowBulkPaste(false); }}
                    style={{
                      background: showAddForm ? 'rgba(200,0,90,0.3)' : 'rgba(200,0,90,0.15)',
                      color: '#ff6aab',
                      border: '1px solid rgba(200,0,90,0.3)',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {showAddForm ? 'إخفاء النموذج' : '+ إضافة مدعوين'}
                  </button>
                </div>
              </div>

              {/* Bulk paste panel */}
              {showBulkPaste && (
                <div
                  style={{
                    background: 'rgba(255,193,7,0.06)',
                    border: '1px solid rgba(255,193,7,0.2)',
                    borderRadius: 14,
                    padding: '18px',
                    marginBottom: 16,
                  }}
                >
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 10px' }}>
                    الصق قائمة المدعوين — سطر لكل شخص بالتنسيق: <span style={{ color: '#ffd54f', direction: 'ltr', display: 'inline-block' }}>الاسم، الجوال</span>
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={'محمد علي، 0512345678\nسارة أحمد، 0598765432'}
                    rows={6}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      lineHeight: 1.6,
                      marginBottom: 12,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleBulkPaste}
                      style={{
                        background: '#C8005A',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      إضافة للقائمة
                    </button>
                    <button
                      onClick={() => { setShowBulkPaste(false); setBulkText(''); }}
                      style={{
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.5)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* Add guest inline form */}
              {showAddForm && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    padding: '18px',
                    marginBottom: 16,
                  }}
                >
                  <form onSubmit={handleAddGuest}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>الاسم</label>
                        <input
                          type="text"
                          value={newGuest.name}
                          onChange={(e) => setNewGuest((p) => ({ ...p, name: e.target.value }))}
                          placeholder="اسم المدعو"
                          required
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>رقم الجوال</label>
                        <input
                          type="tel"
                          value={newGuest.phone}
                          onChange={(e) => setNewGuest((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="05xxxxxxxx"
                          required
                          style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ minWidth: 90 }}>
                        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>المرافقون</label>
                        <input
                          type="number"
                          value={newGuest.companions}
                          onChange={(e) => setNewGuest((p) => ({ ...p, companions: e.target.value }))}
                          min={0}
                          style={inputStyle}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          background: '#C8005A',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 10,
                          padding: '10px 18px',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          marginTop: 20,
                        }}
                      >
                        إضافة
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Pending guests */}
              {pendingGuests.length > 0 && (
                <div
                  style={{
                    background: 'rgba(200,0,90,0.08)',
                    border: '1px solid rgba(200,0,90,0.2)',
                    borderRadius: 14,
                    padding: '16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#ff6aab' }}>
                      في الانتظار: {pendingGuests.length} مدعو
                    </span>
                    <button
                      onClick={handleSendInvitations}
                      disabled={sending}
                      style={{
                        background: '#C8005A',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '9px 18px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: sending ? 'not-allowed' : 'pointer',
                        opacity: sending ? 0.7 : 1,
                      }}
                    >
                      {sending ? 'جارٍ الإرسال...' : 'إرسال الدعوات'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {pendingGuests.map((g, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          padding: '5px 12px',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span>{g.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{g.phone}</span>
                        {g.companions > 0 && (
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>+{g.companions}</span>
                        )}
                        <button
                          onClick={() => removePending(i)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: '0 2px',
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guests table */}
              {guests.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 15,
                  }}
                >
                  لا يوجد مدعوون بعد
                </div>
              ) : (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {/* Table header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.5fr 70px 90px 110px',
                      padding: '12px 18px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <span>الاسم</span>
                    <span>رقم الجوال</span>
                    <span>مرافقون</span>
                    <span>رموز QR</span>
                    <span>الحالة</span>
                  </div>
                  {guests.map((g, i) => {
                    const companionQr = (g.qr_tokens ?? []).filter((q) => q.label?.startsWith('companion-')).length;
                    const expectedQr = g.companions ?? 0;
                    const missingQr = expectedQr - companionQr;
                    const isResending = resendingGuests.has(g.id);
                    return (
                    <div
                      key={g.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.5fr 70px 90px 110px',
                        padding: '13px 18px',
                        borderBottom:
                          i < guests.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        fontSize: 14,
                        alignItems: 'center',
                        background: missingQr > 0 && g.status === 'confirmed' ? 'rgba(255,152,0,0.05)' : 'transparent',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{g.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.65)', direction: 'ltr', textAlign: 'right' }}>
                        {g.phone}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{expectedQr}</span>
                      <span>
                        {expectedQr === 0 ? (
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>—</span>
                        ) : g.status !== 'confirmed' && g.status !== 'attended' ? (
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>—</span>
                        ) : missingQr > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ color: '#ffb74d', fontSize: 13, fontWeight: 600 }}>
                              {companionQr}/{expectedQr}
                            </span>
                            <button
                              onClick={() => handleResendQR(g.id)}
                              disabled={isResending}
                              style={{
                                background: 'rgba(255,152,0,0.2)',
                                color: '#ffb74d',
                                border: '1px solid rgba(255,152,0,0.4)',
                                borderRadius: 6,
                                padding: '3px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: isResending ? 'not-allowed' : 'pointer',
                                opacity: isResending ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isResending ? 'جارٍ...' : `إرسال ${missingQr} مفقود`}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#81c784', fontSize: 13, fontWeight: 600 }}>
                            ✓ {companionQr}/{expectedQr}
                          </span>
                        )}
                      </span>
                      <StatusBadge status={g.status} />
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
