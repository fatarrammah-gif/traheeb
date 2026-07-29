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
  sent:      { label: 'لم يستلم', bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
  failed:    { label: 'لم يستلم', bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
  invited:   { label: 'مدعو',    bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  confirmed: { label: 'مؤكد',   bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  declined:  { label: 'معتذر',  bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
  attended:  { label: 'حضر',    bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
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
  const [statusFilter, setStatusFilter] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', companions: 0 });
  const [pendingGuests, setPendingGuests] = useState([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [resendingGuests, setResendingGuests] = useState(new Set());
  const [deletingGuests, setDeletingGuests] = useState(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRelations, setExportRelations] = useState({});
  const [specificResend, setSpecificResend] = useState({});
  const [sendingExtraQR, setSendingExtraQR] = useState(new Set());
  const [adjustingGuests, setAdjustingGuests] = useState(new Set());
  const [contactsSupported, setContactsSupported] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // WhatsApp custom message
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgTargets, setMsgTargets] = useState('all');
  const [msgTargetName, setMsgTargetName] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgImage, setMsgImage] = useState(null); // { base64, mimeType, previewUrl }
  const [msgSending, setMsgSending] = useState(false);

  // Reminder tracking
  const [reminderStats, setReminderStats] = useState(null); // { sent, delivered, read, failed, pending }
  const [sendingReminder, setSendingReminder] = useState(false);

  // Staff management
  const [staff, setStaff] = useState([]);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  const csvInputRef = useRef(null);
  const vcfInputRef = useRef(null);
  const xlsxInputRef = useRef(null);
  const msgImageInputRef = useRef(null);

  useEffect(() => { if (!token) window.location.href = '/login'; }, [token]);
  useEffect(() => { setContactsSupported('contacts' in navigator); }, []);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      authFetch(`/api/events/${id}`).then(r => r.json()),
      authFetch(`/api/events/${id}/staff`).then(r => r.json()).catch(() => ({ staff: [] })),
      authFetch(`/api/events/${id}/reminders`).then(r => r.json()).catch(() => ({ stats: null })),
    ]).then(([data, staffData, rData]) => {
      if (data.event) setEvent(data.event);
      if (Array.isArray(data.guests)) setGuests(data.guests);
      if (data.error) setError(data.error);
      if (Array.isArray(staffData.staff)) setStaff(staffData.staff);
      if (rData.stats) setReminderStats(rData.stats);
    }).catch(() => setError('حدث خطأ في تحميل الفعالية'))
      .finally(() => setLoading(false));
  }, [token, id]);

  function handleAddGuest(e) {
    e.preventDefault();
    const name = newGuest.name.trim();
    const phone = newGuest.phone.trim();
    if (!name || !phone) return;
    const companions = parseInt(newGuest.companions) || 0;
    const currentPendingComp = pendingGuests.reduce((s, g) => s + (g.companions ?? 0), 0);
    const currentUsed = usedCompanions + currentPendingComp;
    const cap = event?.capacity ?? 0;
    if (cap > 0 && companions > cap - currentUsed) {
      const rem = Math.max(0, cap - currentUsed);
      setToast({ message: `تجاوزت السعة المتاحة — المتبقي ${rem} مقعد فقط`, type: 'error' });
      return;
    }
    setPendingGuests((prev) => [...prev, { name, phone, companions }]);
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

  async function handleAdjustCompanions(guestId, delta) {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    const newVal = Math.max(0, (guest.companions ?? 0) + delta);
    // Optimistic update
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, companions: newVal } : g));
    setAdjustingGuests(prev => new Set(prev).add(guestId));
    try {
      const res = await authFetch(`/api/events/${id}/guests/${guestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ companions: newVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert on error
        setGuests(prev => prev.map(g => g.id === guestId ? { ...g, companions: guest.companions } : g));
        setToast({ message: data.error || 'حدث خطأ', type: 'error' });
      }
    } catch {
      setGuests(prev => prev.map(g => g.id === guestId ? { ...g, companions: guest.companions } : g));
      setToast({ message: 'حدث خطأ في الاتصال', type: 'error' });
    } finally {
      setAdjustingGuests(prev => { const next = new Set(prev); next.delete(guestId); return next; });
    }
  }

  async function handleResendInvitation(guestId) {
    setResendingGuests(prev => new Set(prev).add(guestId));
    try {
      const res = await authFetch(`/api/events/${id}/guests/${guestId}/resend-invitation`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setToast({ message: data.error || 'حدث خطأ أثناء إعادة الإرسال', type: 'error' });
      else {
        setToast({ message: 'جارٍ إعادة الإرسال...', type: 'success' });
        setGuests(prev => prev.map(g => g.id === guestId ? { ...g, status: 'sent' } : g));
      }
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally { setResendingGuests(prev => { const next = new Set(prev); next.delete(guestId); return next; }); }
  }

  async function handleDeleteGuest(guestId) {
    if (!window.confirm('هل أنت متأكد من حذف هذا الضيف وجميع بياناته؟')) return;
    setDeletingGuests(prev => new Set(prev).add(guestId));
    try {
      const res = await authFetch(`/api/events/${id}/guests/${guestId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || 'حدث خطأ أثناء الحذف', type: 'error' });
      } else {
        setGuests(prev => prev.filter(g => g.id !== guestId));
        setToast({ message: 'تم حذف الضيف بنجاح', type: 'success' });
      }
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally { setDeletingGuests(prev => { const next = new Set(prev); next.delete(guestId); return next; }); }
  }

  function handleExportCSV() {
    // Reset relations and open modal
    const initial = {};
    guests.forEach(g => { initial[g.id] = ''; });
    setExportRelations(initial);
    setShowExportModal(true);
  }

  function doExportCSV() {
    const rows = [['الاسم', 'رقم الجوال', 'الحالة', 'مرتبط بـ']];
    guests.forEach(g => {
      const statusLabel = STATUS_CONFIG[g.status]?.label || g.status;
      rows.push([g.name || '', g.phone || '', statusLabel, exportRelations[g.id] || '']);
    });
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.name || 'guests'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    if (!newStaffPhone.trim()) return;
    setAddingStaff(true);
    try {
      const res = await authFetch(`/api/events/${id}/staff`, {
        method: 'POST',
        body: JSON.stringify({ phone: newStaffPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setToast({ message: data.error || 'حدث خطأ', type: 'error' }); return; }
      setStaff(prev => [...prev, data.staff]);
      setNewStaffPhone('');
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally { setAddingStaff(false); }
  }

  async function handleRemoveStaff(phone) {
    try {
      await authFetch(`/api/events/${id}/staff`, {
        method: 'DELETE',
        body: JSON.stringify({ phone }),
      });
      setStaff(prev => prev.filter(s => s.phone !== phone));
    } catch { setToast({ message: 'حدث خطأ في الحذف', type: 'error' }); }
  }

  async function handleSendReminder() {
    setSendingReminder(true);
    try {
      const res = await authFetch(`/api/events/${id}/reminders`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setToast({ message: data.error || 'حدث خطأ', type: 'error' }); return; }
      setToast({ message: `تم إرسال ${data.sent} تذكير`, type: 'success' });
      // Refresh stats
      const rData = await authFetch(`/api/events/${id}/reminders`).then(r => r.json());
      if (rData.stats) setReminderStats(rData.stats);
    } catch { setToast({ message: 'حدث خطأ في الاتصال', type: 'error' }); }
    finally { setSendingReminder(false); }
  }

  function openMsgModalForAll() {
    setMsgTargets('all');
    setMsgTargetName('جميع الضيوف');
    setMsgText('');
    setMsgImage(null);
    setShowMsgModal(true);
  }

  function openMsgModalForGuest(guest) {
    setMsgTargets([guest.id]);
    setMsgTargetName(guest.name);
    setMsgText('');
    setMsgImage(null);
    setShowMsgModal(true);
  }

  function handleMsgImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      setMsgImage({ base64, mimeType, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSendWhatsAppMsg() {
    if (!msgText.trim()) { setToast({ message: 'يرجى كتابة نص الرسالة', type: 'error' }); return; }
    setMsgSending(true);
    try {
      const body = { guestIds: msgTargets, text: msgText.trim() };
      if (msgImage) { body.imageBase64 = msgImage.base64; body.imageMimeType = msgImage.mimeType; }
      const res = await authFetch(`/api/events/${id}/message`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setToast({ message: data.error || 'فشل إرسال الرسالة', type: 'error' }); return; }
      const failedCount = data.failed?.length ?? 0;
      if (failedCount > 0) {
        setToast({ message: `تم الإرسال لـ ${data.sent} ضيف، فشل لـ ${failedCount} ضيف`, type: 'error' });
      } else {
        setToast({ message: `تم إرسال الرسالة لـ ${data.sent} ضيف بنجاح ✓`, type: 'success' });
      }
      setShowMsgModal(false);
      setMsgText('');
      setMsgImage(null);
    } catch { setToast({ message: 'حدث خطأ في الإرسال', type: 'error' }); }
    finally { setMsgSending(false); }
  }

  if (!token) return null;

  const confirmed = guests.filter(g => g.status === 'confirmed').length;
  const attended = guests.filter(g => g.status === 'attended').length;
  const invited = guests.filter(g => g.status === 'invited').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pct = guests.length > 0 ? Math.min(100, Math.round(confirmed / guests.length * 100)) : 0;

  // Capacity enforcement (based on companion/QR count)
  const usedCompanions = guests.reduce((s, g) => s + (g.companions ?? 0), 0);
  const pendingCompanions = pendingGuests.reduce((s, g) => s + (g.companions ?? 0), 0);
  const totalUsed = usedCompanions + pendingCompanions;
  const capacityLimit = event?.capacity ?? 0;
  const remainingCapacity = capacityLimit > 0 ? Math.max(0, capacityLimit - totalUsed) : Infinity;
  const capacityFull = capacityLimit > 0 && remainingCapacity === 0;

  const filteredGuests = guests.filter(g => {
    if (statusFilter && g.status !== statusFilter) return false;
    if (guestSearch && !g.name?.includes(guestSearch) && !g.phone?.includes(guestSearch)) return false;
    return true;
  });

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
            <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8, width: '100%', maxWidth: 420 }} className="stat-cards">
              {[
                { label: 'مدعو', value: guests.length, icon: '📨' },
                { label: 'مؤكد', value: confirmed, icon: '✅' },
                { label: 'معتذر', value: declined, icon: '❌' },
              ].map((s) => (
                <div key={s.label} className="stat-box" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 12px', backdropFilter: 'blur(8px)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <a
              href={`/events/${id}/attendance`}
              className="attendance-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 20, backdropFilter: 'blur(8px)', transition: 'background 0.2s', width: '100%', maxWidth: 420 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            >
              📋 تفاصيل الحضور
            </a>
            {guests.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>نسبة التأكيد</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{confirmed} / {guests.length}</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{pct}% أكدوا الحضور</div>
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

              {/* Staff management */}
              <div style={{ background: T.surface, borderRadius: 20, padding: 20, border: `1px solid ${T.border}` }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  👥 الفريق
                </h3>

                {/* Staff list */}
                {staff.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {staff.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.bg, borderRadius: 10, padding: '8px 12px', border: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: 13, color: T.text, direction: 'ltr', fontWeight: 500 }}>{s.phone}</span>
                        <button onClick={() => handleRemoveStaff(s.phone)}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add staff form */}
                <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newStaffPhone}
                    onChange={e => setNewStaffPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    type="tel"
                    dir="ltr"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, color: T.text, background: T.bg, outline: 'none', fontFamily: "'Cairo', sans-serif" }}
                  />
                  <button type="submit" disabled={addingStaff}
                    style={{ background: GRAD, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: addingStaff ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: "'Cairo', sans-serif", opacity: addingStaff ? 0.7 : 1 }}>
                    + إضافة
                  </button>
                </form>

                {/* Staff login link */}
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/events/${id}/staff-login`;
                    navigator.clipboard.writeText(link);
                    setToast({ message: 'تم نسخ رابط دخول الفريق', type: 'success' });
                  }}
                  style={{ marginTop: 12, width: '100%', background: T.primarySoft, color: T.primary, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontFamily: "'Cairo', sans-serif" }}>
                  📋 نسخ رابط دخول الفريق
                </button>
              </div>

              {/* Reminder card — only shown when there are confirmed guests */}
              {confirmed > 0 && (
                <div style={{ background: T.surface, borderRadius: 20, padding: 20, border: `1px solid ${T.border}` }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 14px' }}>🔔 تذكير الحضور</h3>

                  {/* Stats row */}
                  {reminderStats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                      {[
                        { label: 'وصل', value: (reminderStats.delivered || 0) + (reminderStats.read || 0), color: '#059669', bg: '#ECFDF5' },
                        { label: 'مرسل', value: reminderStats.sent || 0, color: '#D97706', bg: '#FFFBEB' },
                        { label: 'فشل', value: reminderStats.failed || 0, color: '#EF4444', bg: '#FEF2F2' },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={handleSendReminder} disabled={sendingReminder}
                    style={{ width: '100%', background: GRAD, color: '#fff', border: 'none', borderRadius: 12, padding: '10px', fontSize: 14, fontWeight: 700, cursor: sendingReminder ? 'not-allowed' : 'pointer', opacity: sendingReminder ? 0.7 : 1, fontFamily: "'Cairo', sans-serif" }}>
                    {sendingReminder ? 'جارٍ الإرسال...' : reminderStats?.sent > 0 ? 'إعادة إرسال لغير المستلمين' : 'إرسال تذكير'}
                  </button>
                  {reminderStats?.pending > 0 && (
                    <p style={{ fontSize: 12, color: T.muted, margin: '8px 0 0', textAlign: 'center' }}>
                      {reminderStats.pending} مدعو لم يُرسل لهم بعد
                    </p>
                  )}
                  <a href="/whatsapp" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: T.primary, marginTop: 10, textDecoration: 'none' }}>
                    📱 ربط واتساب للإرسال
                  </a>
                </div>
              )}
            </div>

            {/* Guest list */}
            <div>
              <div style={{ background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(138,0,79,0.05)', overflow: 'hidden' }}>
                {/* Guest list header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: '0 0 2px' }}>المدعوون ({guests.length})</h3>
                      {capacityLimit > 0 && (
                        <span style={{ fontSize: 12, color: capacityFull ? '#EF4444' : T.muted, fontWeight: 600 }}>
                          {capacityFull ? '🔴 السعة ممتلئة' : `متبقي ${remainingCapacity} مقعد من ${capacityLimit}`}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { if (!capacityFull) { setShowAddForm(v => !v); setShowBulkPaste(false); } }}
                      disabled={capacityFull}
                      style={{ background: capacityFull ? '#F9FAFB' : showAddForm ? GRAD : T.primarySoft, color: capacityFull ? T.muted : showAddForm ? '#fff' : T.primary, border: `1px solid ${capacityFull ? T.border : T.border}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, cursor: capacityFull ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: capacityFull ? 0.6 : 1 }}>
                      {capacityFull ? '🔒 السعة ممتلئة' : showAddForm ? 'إخفاء النموذج' : '+ إضافة مدعوين'}
                    </button>
                  </div>

                  {/* Search + export */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={guestSearch} onChange={e => setGuestSearch(e.target.value)} placeholder="ابحث في المدعوين..."
                      style={{ ...inp, flex: 1, marginBottom: 0 }} />
                    {guests.length > 0 && (
                      <button onClick={openMsgModalForAll} title="إرسال رسالة واتساب لجميع الضيوف"
                        style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#059669', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        💬 رسالة للكل
                      </button>
                    )}
                    <button onClick={handleExportCSV} title="تصدير Excel"
                      style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      ⬇ Excel
                    </button>
                  </div>

                  {/* Import buttons — hidden, kept for future use */}
                  <div style={{ display: 'none' }}>
                    {contactsSupported ? (
                      <button onClick={handlePickContacts}>📱 جهات الاتصال</button>
                    ) : null}
                    <button onClick={() => vcfInputRef.current?.click()}>📁 VCF</button>
                    <input ref={vcfInputRef} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={handleVCFUpload} style={{ display: 'none' }} />
                    <button onClick={() => xlsxInputRef.current?.click()}>📊 Excel</button>
                    <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} style={{ display: 'none' }} />
                    <button onClick={() => { setShowBulkPaste(v => !v); setShowAddForm(false); }}>📋 لصق قائمة</button>
                    <button onClick={() => csvInputRef.current?.click()}>CSV</button>
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

                {/* Mobile filter tags row — always visible on mobile when guests exist */}
                {guests.length > 0 && (() => {
                  const FILTERS = [
                    { status: 'sent',      label: 'لم يستلم', bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
                    { status: 'invited',   label: 'مدعو',     bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
                    { status: 'confirmed', label: 'مؤكد',    bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
                    { status: 'attended',  label: 'حاضر',    bg: '#F0FDF4', color: '#16A34A', border: '#86EFAC' },
                    { status: 'declined',  label: 'معتذر',   bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
                  ];
                  return (
                    <div className="guest-filter-bar" style={{ display: 'none', alignItems: 'center', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                      {FILTERS.map(f => {
                        const count = guests.filter(g => g.status === f.status).length;
                        const active = statusFilter === f.status;
                        return (
                          <button key={f.status} onClick={() => setStatusFilter(active ? null : f.status)}
                            style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${active ? f.color : f.border}`, background: active ? f.color : f.bg, color: active ? '#fff' : f.color, cursor: 'pointer', transition: 'all 0.15s' }}>
                            {f.label} {count}
                          </button>
                        );
                      })}
                      <span style={{ marginRight: 'auto', fontSize: 12, color: T.muted, fontWeight: 600 }}>
                        {filteredGuests.length} نتيجة
                      </span>
                    </div>
                  );
                })()}

                {/* Guest rows */}
                {filteredGuests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: T.muted, fontSize: 15 }}>
                    {guests.length === 0 ? 'لا يوجد مدعوون بعد' : 'لا توجد نتائج'}
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="guest-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 110px 110px 44px 130px', padding: '10px 24px', borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.muted }}>
                      <span>الاسم</span>
                      <span className="g-phone">رقم الجوال</span>
                      <span className="g-comp">المرافقون</span>
                      <span className="g-status-desktop">الحالة</span>
                      <span className="g-msg-col" title="إرسال رسالة">💬</span>
                      <span className="g-adjust">تعديل المرافقين</span>
                    </div>
                    {filteredGuests.map((g, i) => {
                      const isAdjusting = adjustingGuests.has(g.id);
                      const companions = g.companions ?? 0;
                      return (
                        <div key={g.id} className="guest-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 110px 110px 44px 130px', padding: '13px 24px', borderBottom: i < filteredGuests.length - 1 ? `1px solid ${T.border}` : 'none', fontSize: 14, alignItems: 'center' }}>
                          {/* Name */}
                          <div className="g-name-cell">
                            <span style={{ fontWeight: 600, color: T.text }}>{g.name}</span>
                            {/* Mobile-only tags */}
                            <div className="g-mobile-tags" style={{ display: 'none', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <StatusBadge status={g.status} />
                              {companions > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 600, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 6, padding: '2px 7px' }}>
                                  {companions} مرافق
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Phone */}
                          <span className="g-phone" style={{ color: T.muted, direction: 'ltr', textAlign: 'right', fontSize: 13 }}>{g.phone}</span>

                          {/* Companions count */}
                          <span className="g-comp" style={{ fontWeight: 600, color: T.text }}>{companions}</span>

                          {/* Status + resend button */}
                          <div className="g-status-desktop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusBadge status={g.status} />
                            {(g.status === 'sent' || g.status === 'failed') && (
                              <button
                                onClick={() => handleResendInvitation(g.id)}
                                disabled={resendingGuests.has(g.id)}
                                title="إعادة إرسال الدعوة"
                                style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.primary, fontSize: 13, cursor: resendingGuests.has(g.id) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: resendingGuests.has(g.id) ? 0.5 : 1 }}>
                                {resendingGuests.has(g.id) ? '…' : '↩'}
                              </button>
                            )}
                          </div>

                          {/* Per-guest WhatsApp message button */}
                          <div className="g-msg-col" style={{ display: 'flex', alignItems: 'center' }}>
                            <button
                              onClick={() => openMsgModalForGuest(g)}
                              title="إرسال رسالة واتساب"
                              style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#059669', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              💬
                            </button>
                          </div>

                          {/* +/- adjuster + delete */}
                          <div className="g-adjust" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => handleAdjustCompanions(g.id, -1)}
                              disabled={isAdjusting || companions === 0}
                              style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${T.border}`, background: companions === 0 ? '#F9FAFB' : T.surface, color: companions === 0 ? T.border : T.primary, fontSize: 18, fontWeight: 700, cursor: companions === 0 || isAdjusting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0, opacity: isAdjusting ? 0.5 : 1 }}>
                              −
                            </button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.text }}>
                              {isAdjusting ? '…' : companions}
                            </span>
                            <button
                              onClick={() => handleAdjustCompanions(g.id, +1)}
                              disabled={isAdjusting}
                              style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.primarySoft, color: T.primary, fontSize: 18, fontWeight: 700, cursor: isAdjusting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0, opacity: isAdjusting ? 0.5 : 1 }}>
                              +
                            </button>
                            <button
                              onClick={() => handleDeleteGuest(g.id)}
                              disabled={deletingGuests.has(g.id)}
                              title="حذف الضيف"
                              style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: deletingGuests.has(g.id) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: deletingGuests.has(g.id) ? 0.5 : 1 }}>
                              {deletingGuests.has(g.id) ? '…' : '🗑'}
                            </button>
                          </div>
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

      {/* Export modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>تصدير القائمة</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>أدخل اسم الضيف الرئيسي لكل مرافق — اتركه فارغاً للضيوف الرئيسيين</div>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.muted }}>✕</button>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 100px 1.5fr', padding: '10px 24px', fontSize: 12, fontWeight: 700, color: T.muted, borderBottom: `1px solid ${T.border}`, background: T.primarySoft, position: 'sticky', top: 0 }}>
                <span>الاسم</span>
                <span>رقم الجوال</span>
                <span>الحالة</span>
                <span>مرتبط بـ (اختياري)</span>
              </div>
              {guests.map((g, i) => (
                <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 100px 1.5fr', padding: '10px 24px', borderBottom: i < guests.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: T.text }}>{g.name}</span>
                  <span style={{ color: T.muted, direction: 'ltr', textAlign: 'right' }}>{g.phone}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px', background: STATUS_CONFIG[g.status]?.bg, color: STATUS_CONFIG[g.status]?.color, border: `1px solid ${STATUS_CONFIG[g.status]?.border}`, display: 'inline-block' }}>
                    {STATUS_CONFIG[g.status]?.label || g.status}
                  </span>
                  <input
                    value={exportRelations[g.id] || ''}
                    onChange={e => setExportRelations(prev => ({ ...prev, [g.id]: e.target.value }))}
                    placeholder="اسم الضيف الرئيسي..."
                    list="guest-names-list"
                    style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, outline: 'none', fontFamily: "'Cairo', sans-serif", width: '100%' }}
                  />
                </div>
              ))}
              <datalist id="guest-names-list">
                {guests.map(g => <option key={g.id} value={g.name} />)}
              </datalist>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowExportModal(false)} style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>إلغاء</button>
              <button onClick={doExportCSV} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: GRAD, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ تصدير Excel</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden image input for compose modal */}
      <input ref={msgImageInputRef} type="file" accept="image/*" onChange={handleMsgImageChange} style={{ display: 'none' }} />

      {/* WhatsApp Compose Message Modal */}
      {showMsgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => { if (!msgSending) { setShowMsgModal(false); setMsgImage(null); setMsgText(''); } }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.muted }}>✕</button>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, textAlign: 'right' }}>رسالة واتساب</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2, textAlign: 'right' }}>إلى: {msgTargetName}</div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Text input */}
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                rows={5}
                dir="rtl"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, color: T.text, background: T.bg, outline: 'none', resize: 'vertical', fontFamily: "'Cairo', sans-serif", boxSizing: 'border-box', lineHeight: 1.7 }}
              />

              {/* Image preview */}
              {msgImage && (
                <div style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-end' }}>
                  <img src={msgImage.previewUrl} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 12, border: `1px solid ${T.border}`, display: 'block' }} />
                  <button onClick={() => setMsgImage(null)}
                    style={{ position: 'absolute', top: -8, left: -8, width: 22, height: 22, borderRadius: '50%', background: '#EF4444', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    ✕
                  </button>
                </div>
              )}

              {/* Actions row */}
              <div style={{ display: 'flex', gap: 10 }}>
                {/* Send */}
                <button onClick={handleSendWhatsAppMsg} disabled={msgSending}
                  style={{ flex: 1, background: msgSending ? '#93C5FD' : GRAD, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: msgSending ? 'not-allowed' : 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                  {msgSending ? 'جارٍ الإرسال...' : 'إرسال ✓'}
                </button>
                {/* Attach image */}
                <button onClick={() => msgImageInputRef.current?.click()} disabled={msgSending}
                  title="إرفاق صورة"
                  style={{ width: 48, height: 48, borderRadius: 12, border: `1px solid ${msgImage ? '#A7F3D0' : T.border}`, background: msgImage ? '#ECFDF5' : T.bg, color: msgImage ? '#059669' : T.muted, fontSize: 20, cursor: msgSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  🖼
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr !important; } }
        .stat-cards { width: 100% !important; max-width: 100% !important; }
        .stat-box { min-height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .attendance-btn { max-width: 100% !important; min-height: 80px; }
        @media (max-width: 600px) {
          .stat-cards { grid-template-columns: repeat(3, 1fr) !important; }
          .stat-box { padding: 8px 6px !important; min-height: 72px; }
          .stat-box > div:first-child { font-size: 15px !important; }
          .stat-box > div:nth-child(2) { font-size: 20px !important; }
          .stat-box > div:nth-child(3) { font-size: 10px !important; }
          .attendance-btn { min-height: 72px; font-size: 13px !important; }
        }
        @media (max-width: 768px) {
          .guest-header, .guest-row { grid-template-columns: 1fr !important; }
          .g-phone, .g-comp, .g-status-desktop, .g-msg-col { display: none !important; }
          .g-adjust { justify-content: flex-end; }
          .g-name-cell { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; }
          .g-mobile-tags { display: flex !important; flex-shrink: 0; }
          .guest-filter-bar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
