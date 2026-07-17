'use client';

import { useEffect, useState } from 'react';
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

const inp = (extra = {}) => ({
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  fontSize: 15,
  fontFamily: "'Cairo', sans-serif",
  color: T.text,
  background: T.surface,
  outline: 'none',
  textAlign: 'right',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
  ...extra,
});

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', textAlign: 'right', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 7 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function DashHeader({ onLogout, activeHref = '/events/new' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const NAV = [
    { label: 'الفعاليات', href: '/dashboard' },
    { label: 'إنشاء فعالية', href: '/events/new' },
  ];
  return (
    <div style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src={LOGO} alt="تراحيب" style={{ width: 62, height: 62, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </a>
          <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>إنشاء فعالية</span>
        </div>

        {/* Nav links (desktop) + hamburger (mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="dash-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {NAV.map((l) => {
              const active = activeHref === l.href;
              return (
                <a key={l.href} href={l.href}
                  style={{ padding: '7px 16px', borderRadius: 10, fontSize: 14, fontWeight: active ? 700 : 500, color: active ? '#C2185B' : 'rgba(255,255,255,0.85)', background: active ? '#fff' : 'transparent', textDecoration: 'none', transition: 'background 0.2s' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {l.label}
                </a>
              );
            })}
            <button
              onClick={onLogout}
              style={{ padding: '7px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              تسجيل خروج
            </button>
          </div>

          {/* Hamburger (mobile) */}
          <button
            className="dash-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'none', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 9, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 19 }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.18)', padding: '10px 20px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(l => (
            <a key={l.href} href={l.href}
              style={{ padding: '13px 18px', borderRadius: 11, fontSize: 16, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.08)', textDecoration: 'none', display: 'block', textAlign: 'right' }}
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={onLogout}
            style={{ padding: '13px 18px', borderRadius: 11, fontSize: 16, fontWeight: 700, color: '#C2185B', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'right', marginTop: 4 }}
          >
            تسجيل خروج
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .dash-nav-links { display: none !important; }
          .dash-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

async function pdfToBlob(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
}

function FileUploadField({ label, required, fieldKey, uploadedUrls, setUploadedUrls, uploading, setUploading }) {
  async function handleFileChange(e) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setUploading((prev) => ({ ...prev, [fieldKey]: true }));
    try {
      let file = raw;
      if (raw.type === 'application/pdf' || raw.name.toLowerCase().endsWith('.pdf')) {
        const blob = await pdfToBlob(raw);
        file = new File([blob], raw.name.replace(/\.pdf$/i, '.jpg'), { type: 'image/jpeg' });
      }
      const token = useWebAuth.getState().token;
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.ok && data.url) setUploadedUrls((prev) => ({ ...prev, [fieldKey]: data.url }));
      else alert('فشل رفع الصورة: ' + (data.error || 'خطأ غير معروف'));
    } catch (err) {
      alert('حدث خطأ أثناء رفع الملف: ' + err.message);
    } finally {
      setUploading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }

  const isUploaded = !!uploadedUrls[fieldKey];
  const isUploading = !!uploading[fieldKey];

  return (
    <Field label={label} required={required}>
      <div style={{ background: isUploaded ? '#ECFDF5' : T.primarySoft, border: `1px dashed ${isUploaded ? '#A7F3D0' : T.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', position: 'relative' }}>
        {isUploading ? (
          <p style={{ margin: 0, color: T.muted, fontSize: 14 }}>جارٍ الرفع...</p>
        ) : isUploaded ? (
          <div>
            <p style={{ margin: '0 0 6px', color: '#059669', fontSize: 14, fontWeight: 600 }}>✓ تم رفع الصورة</p>
            <button type="button" onClick={() => setUploadedUrls(prev => ({ ...prev, [fieldKey]: '' }))}
              style={{ background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer' }}>تغيير الصورة</button>
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', color: T.muted, fontSize: 13 }}>اختر صورة أو ملف PDF للرفع</p>
            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
            <span style={{ background: T.primary, color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600 }}>اختر ملف</span>
          </>
        )}
      </div>
    </Field>
  );
}

function extractCoordsFromGoogleUrl(url) {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const queryMatch = url.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  return null;
}

function LocationPicker({ value, onChange }) {
  const [url, setUrl] = useState('');
  const [picked, setPicked] = useState(value || null);
  const [err, setErr] = useState('');
  const [resolving, setResolving] = useState(false);

  function handlePaste(e) {
    const pasted = (e.clipboardData?.getData('text') || '').trim();
    if (pasted) apply(pasted);
  }

  async function apply(rawUrl) {
    setErr('');
    const direct = extractCoordsFromGoogleUrl(rawUrl);
    if (direct) {
      const loc = { label: rawUrl, lat: direct.lat, lng: direct.lng };
      setPicked(loc); setUrl(''); onChange(loc); return;
    }
    const decoded = (() => { try { return decodeURIComponent(rawUrl); } catch { return rawUrl; } })();
    const shortMatch = decoded.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl)\/[^\s"'<>?]+(?:\?[^\s"'<>]*)? /)?.[0]?.trim()
      ?? decoded.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl)\/[^\s"'<>]+/)?.[0];
    const urlToResolve = shortMatch || (/maps\.app\.goo\.gl|goo\.gl/.test(rawUrl) ? rawUrl : null);
    if (urlToResolve) {
      setResolving(true);
      try {
        const res = await fetch('/api/loc/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: urlToResolve }) });
        const data = await res.json();
        if (data.coords) {
          const loc = { label: data.finalUrl || rawUrl, lat: data.coords.lat, lng: data.coords.lng };
          setPicked(loc); setUrl(''); onChange(loc); return;
        }
        setErr('تعذّر استخراج الإحداثيات من الرابط');
      } catch { setErr('حدث خطأ أثناء قراءة الرابط'); }
      finally { setResolving(false); }
      return;
    }
    const loc = { label: rawUrl, lat: null, lng: null };
    setPicked(loc); setUrl(''); onChange(loc);
  }

  function reset() { setPicked(null); setUrl(''); setErr(''); onChange(null); }

  const previewSrc = picked?.lat ? `https://maps.google.com/maps?q=${picked.lat},${picked.lng}&z=15&output=embed` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, textDecoration: 'none', width: 'fit-content' }}>
        🗺️ افتح Google Maps
      </a>
      <p style={{ margin: 0, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>ابحث عن الموقع ← اضغط مشاركة ← انسخ الرابط ← الصقه هنا</p>
      {!picked && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} onPaste={handlePaste} placeholder="الصق رابط Google Maps هنا..."
            style={inp({ flex: 1, direction: 'ltr', textAlign: 'right' })} />
          <button type="button" onClick={() => apply(url)} disabled={resolving}
            style={{ background: T.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {resolving ? 'جارٍ التحقق...' : 'تأكيد'}
          </button>
        </div>
      )}
      {err && <p style={{ margin: 0, fontSize: 13, color: '#EF4444' }}>{err}</p>}
      {picked && (
        <div style={{ background: T.primarySoft, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {previewSrc && <iframe src={previewSrc} width="100%" height="180" style={{ border: 'none', display: 'block' }} title="موقع الفعالية" loading="lazy" />}
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, flex: 1, wordBreak: 'break-all', direction: 'ltr' }}>
              ✅ {picked.lat ? `${picked.lat}, ${picked.lng}` : picked.label}
            </span>
            <button type="button" onClick={reset} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 12, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>تغيير</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewEventPage() {
  const token = useWebAuth((s) => s.token);
  const user = useWebAuth((s) => s.user);
  const logout = useWebAuth((s) => s.logout);

  function handleLogout() {
    logout();
    window.location.href = '/login';
  }

  const [mapLocation, setMapLocation] = useState(null);
  const [form, setForm] = useState({ name: '', date: '', time: '', venue: '', capacity: '', invitation_text: '' });
  const [uploadedUrls, setUploadedUrls] = useState({ event_logo_url: '', invitation_media_url: '', qr_background_url: '' });
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (!token) window.location.href = '/login'; }, [token]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      name: form.name,
      date: form.date,
      time: form.time,
      venue: form.venue,
      location: mapLocation?.label || '',
      capacity: form.capacity ? parseInt(form.capacity) : undefined,
      invitation_text: form.invitation_text,
      map_lat: mapLocation?.lat || undefined,
      map_lng: mapLocation?.lng || undefined,
      event_logo_url: uploadedUrls.event_logo_url || undefined,
      invitation_media_url: uploadedUrls.invitation_media_url || undefined,
      qr_background_url: uploadedUrls.qr_background_url || undefined,
    };
    try {
      const res = await authFetch('/api/events', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'حدث خطأ أثناء الإنشاء');
      else setSuccess(true);
    } catch { setError('حدث خطأ في الاتصال'); }
    finally { setSubmitting(false); }
  }

  if (!token) return null;

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>
        <DashHeader onLogout={handleLogout} activeHref="/events/new" />
        <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ background: T.surface, borderRadius: 24, padding: 48, border: `1px solid ${T.border}`, boxShadow: '0 4px 32px rgba(138,0,79,0.07)' }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: T.text, marginBottom: 12 }}>تم إنشاء الفعالية!</h2>
            <p style={{ fontSize: 15, color: T.muted, marginBottom: 32, lineHeight: 1.8 }}>
              تم إنشاء فعالية <strong style={{ color: T.primary }}>"{form.name}"</strong> بنجاح.
              يمكنك الآن دعوة الضيوف وإرسال التذاكر عبر واتساب.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/dashboard" style={{ padding: '13px 32px', borderRadius: 12, background: GRAD, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 16px rgba(138,0,79,0.28)' }}>
                استعرض الفعاليات
              </a>
              <button onClick={() => { setSuccess(false); setForm({ name: '', date: '', time: '', venue: '', capacity: '', invitation_text: '' }); setUploadedUrls({ event_logo_url: '', invitation_media_url: '', qr_background_url: '' }); setMapLocation(null); }}
                style={{ padding: '13px 32px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                إنشاء فعالية أخرى
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>
      <DashHeader />

      {/* Page Hero */}
      <div style={{ background: GRAD, padding: '40px 24px 56px', textAlign: 'center', position: 'relative', marginBottom: 40 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 8 }}>إنشاء فعالية جديدة</h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.80)' }}>أنشئ فعاليتك وابدأ في دعوة ضيوفك</p>
        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0 }}>
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" style={{ width: '100%', height: 48, display: 'block' }}>
            <path d="M0,48 C360,0 1080,0 1440,48 L1440,48 L0,48 Z" fill={T.bg} />
          </svg>
        </div>
      </div>

      <div dir="rtl" style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 80px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }} className="form-grid">

            {/* Card 1 — Event Details */}
            <div style={{ background: T.surface, borderRadius: 20, padding: 28, border: `1px solid ${T.border}`, boxShadow: '0 2px 16px rgba(138,0,79,0.06)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, textAlign: 'right', marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                تفاصيل الفعالية
              </h2>

              <Field label="اسم الفعالية" required>
                <input style={inp()} name="name" placeholder="مثال: قمة المنتجات السنوية" value={form.name} onChange={handleChange} required />
              </Field>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Field label="التاريخ" required>
                    <input type="date" style={inp()} name="date" value={form.date} onChange={handleChange} required />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="الوقت" required>
                    <input type="time" style={inp()} name="time" value={form.time} onChange={handleChange} required />
                  </Field>
                </div>
              </div>

              <Field label="عدد المدعوين" required>
                <input type="number" style={inp()} name="capacity" placeholder="مثال: 150" value={form.capacity} onChange={handleChange} required min="1" />
              </Field>

              <Field label="نص الدعوة" required>
                <textarea style={inp({ height: 110, resize: 'vertical', lineHeight: 1.7 })} name="invitation_text" placeholder="نص رسالة الدعوة التي ستُرسل للضيوف..." value={form.invitation_text} onChange={handleChange} required />
              </Field>
            </div>

            {/* Card 2 — Venue + Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: T.surface, borderRadius: 20, padding: 28, border: `1px solid ${T.border}`, boxShadow: '0 2px 16px rgba(138,0,79,0.06)' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, textAlign: 'right', marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                  📍 المكان
                </h2>
                <Field label="اسم القاعة / المكان" required>
                  <input style={inp()} name="venue" placeholder="مثال: قاعة المؤتمرات الكبرى" value={form.venue} onChange={handleChange} required />
                </Field>
                <Field label="موقع الفعالية على الخريطة">
                  <LocationPicker value={mapLocation} onChange={setMapLocation} />
                </Field>
              </div>

              {/* Images card */}
              <div style={{ background: T.surface, borderRadius: 20, padding: 28, border: `1px solid ${T.border}`, boxShadow: '0 2px 16px rgba(138,0,79,0.06)' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, textAlign: 'right', marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                  🖼️ الصور
                </h2>
                <FileUploadField label="شعار الفعالية" required fieldKey="event_logo_url" uploadedUrls={uploadedUrls} setUploadedUrls={setUploadedUrls} uploading={uploading} setUploading={setUploading} />
                <FileUploadField label="صورة الدعوة" required fieldKey="invitation_media_url" uploadedUrls={uploadedUrls} setUploadedUrls={setUploadedUrls} uploading={uploading} setUploading={setUploading} />
                <FileUploadField label="خلفية رمز QR (اختياري)" fieldKey="qr_background_url" uploadedUrls={uploadedUrls} setUploadedUrls={setUploadedUrls} uploading={uploading} setUploading={setUploading} />
              </div>
            </div>
          </div>

          {error && (
            <p style={{ color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</p>
          )}

          <button type="submit" disabled={submitting}
            style={{ width: '100%', padding: '16px', borderRadius: 16, border: 'none', background: submitting ? '#E8A0C0' : GRAD, color: '#fff', fontWeight: 800, fontSize: 17, cursor: submitting ? 'default' : 'pointer', fontFamily: "'Cairo', sans-serif", boxShadow: '0 8px 28px rgba(138,0,79,0.3)', transition: 'all 0.2s' }}>
            {submitting ? 'جارٍ الإنشاء…' : '✓ إنشاء الفعالية'}
          </button>
        </form>
      </div>

      <style>{`
        @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr !important; } }
        input[type="date"], input[type="time"] { direction: rtl; }
      `}</style>
    </div>
  );
}
