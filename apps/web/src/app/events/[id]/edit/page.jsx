'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useWebAuth, authFetch } from '../../../../utils/webAuth.js';

const inputStyle = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '12px 16px',
  color: '#fff',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.7)',
  marginBottom: 6,
  display: 'block',
};

function FieldGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
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

/** Shows current image URL + lets user replace it. New upload is optional. */
function FileUploadField({ label, fieldKey, uploadedUrls, setUploadedUrls, uploading, setUploading, currentUrl }) {
  const [replaced, setReplaced] = useState(false);

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
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setUploadedUrls((prev) => ({ ...prev, [fieldKey]: data.url }));
        setReplaced(true);
      } else {
        alert('فشل رفع الصورة: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      alert('حدث خطأ أثناء رفع الملف: ' + err.message);
    } finally {
      setUploading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }

  const newUrl     = uploadedUrls[fieldKey];
  const isUploading = !!uploading[fieldKey];
  const displayUrl = newUrl || currentUrl;

  return (
    <FieldGroup label={label}>
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px dashed rgba(255,255,255,0.25)',
        borderRadius: 10,
        padding: '16px',
        textAlign: 'center',
        position: 'relative',
      }}>
        {isUploading ? (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>جارٍ الرفع...</p>
        ) : displayUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <img
              src={displayUrl}
              alt=""
              style={{ maxHeight: 80, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }}
            />
            <p style={{ margin: 0, fontSize: 13, color: replaced ? '#4caf88' : 'rgba(255,255,255,0.5)' }}>
              {replaced ? '✓ تم رفع صورة جديدة' : 'الصورة الحالية — يمكنك تغييرها'}
            </p>
            <label style={{
              background: 'rgba(200,0,90,0.2)',
              color: '#ff6aab',
              borderRadius: 8,
              padding: '5px 14px',
              fontSize: 13,
              cursor: 'pointer',
            }}>
              تغيير الصورة
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              اختر صورة للرفع
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
            <span style={{
              background: 'rgba(200,0,90,0.2)',
              color: '#ff6aab',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
            }}>
              اختر ملف
            </span>
          </>
        )}
      </div>
    </FieldGroup>
  );
}

// ── Location picker (same as new event page) ─────────────────────────────────

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
  const [url, setUrl]             = useState('');
  const [picked, setPicked]       = useState(value || null);
  const [err, setErr]             = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => { if (value) setPicked(value); }, [value]);

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
    const shortMatch = decoded.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl)\/[^\s"'<>]+/)?.[0];
    const urlToResolve = shortMatch || (/maps\.app\.goo\.gl|goo\.gl/.test(rawUrl) ? rawUrl : null);
    if (urlToResolve) {
      setResolving(true);
      try {
        const res  = await fetch('/api/loc/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlToResolve }),
        });
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

  const previewSrc = picked?.lat
    ? `https://maps.google.com/maps?q=${picked.lat},${picked.lng}&z=15&output=embed`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(66,133,244,0.15)', color: '#7ab3ff',
        border: '1px solid rgba(66,133,244,0.3)', borderRadius: 10,
        padding: '10px 16px', fontSize: 14, fontWeight: 600, textDecoration: 'none', width: 'fit-content',
      }}>
        🗺️ افتح Google Maps
      </a>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
        ابحث عن الموقع ← اضغط مشاركة ← انسخ الرابط ← الصقه هنا
      </p>
      {!picked && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} onPaste={handlePaste}
            placeholder="الصق رابط Google Maps هنا..."
            style={{ ...inputStyle, flex: 1, direction: 'ltr', textAlign: 'right' }} />
          <button type="button" onClick={() => apply(url)} disabled={resolving} style={{
            background: '#C8005A', color: '#fff', border: 'none', borderRadius: 10,
            padding: '0 16px', fontSize: 14, fontWeight: 600,
            cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.7 : 1, whiteSpace: 'nowrap',
          }}>
            {resolving ? 'جارٍ التحقق...' : 'تأكيد'}
          </button>
        </div>
      )}
      {err && <p style={{ margin: 0, fontSize: 13, color: '#ff6b6b' }}>{err}</p>}
      {picked && (
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, overflow: 'hidden' }}>
          {previewSrc && <iframe src={previewSrc} width="100%" height="200" style={{ border: 'none', display: 'block' }} title="موقع الفعالية" loading="lazy" />}
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, flex: 1, wordBreak: 'break-all', direction: 'ltr' }}>
              ✅ {picked.lat ? `${picked.lat}, ${picked.lng}` : picked.label}
            </span>
            <button type="button" onClick={reset} style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 12,
              padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              تغيير
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main edit page ────────────────────────────────────────────────────────────

export default function EditEventPage() {
  const { id: eventId } = useParams();
  const token = useWebAuth((s) => s.token);

  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');
  const [mapLocation, setMapLocation] = useState(null);
  const [currentUrls, setCurrentUrls] = useState({});   // URLs from DB
  const [form, setForm] = useState({
    name: '', date: '', time: '', venue: '', capacity: '', invitation_text: '',
  });
  const [uploadedUrls, setUploadedUrls] = useState({
    event_logo_url: '', invitation_media_url: '', qr_background_url: '',
  });
  const [uploading, setUploading]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    loadEvent();
  }, [token]);

  async function loadEvent() {
    try {
      const res  = await authFetch(`/api/events/${eventId}?full=1`);
      const data = await res.json();
      if (!res.ok) { setLoadError(data.error || 'تعذّر تحميل بيانات الفعالية'); return; }

      const e = data.event;
      setForm({
        name:            e.name            || '',
        date:            e.date            || '',
        time:            e.time            || '',
        venue:           e.venue           || '',
        capacity:        e.capacity        != null ? String(e.capacity) : '',
        invitation_text: e.invitation_text || '',
      });
      setCurrentUrls({
        event_logo_url:       e.event_logo_url       || '',
        invitation_media_url: e.invitation_media_url || '',
        qr_background_url:    e.qr_background_url    || '',
      });
      if (e.map_lat && e.map_lng) {
        setMapLocation({ label: e.location || `${e.map_lat},${e.map_lng}`, lat: e.map_lat, lng: e.map_lng });
      }
    } catch {
      setLoadError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Only send image URLs if user uploaded a new one; otherwise omit (DB keeps old value via COALESCE)
    const payload = {
      name:            form.name,
      date:            form.date,
      time:            form.time,
      venue:           form.venue,
      location:        mapLocation?.label || undefined,
      capacity:        form.capacity ? parseInt(form.capacity) : undefined,
      invitation_text: form.invitation_text,
      map_lat:         mapLocation?.lat   || undefined,
      map_lng:         mapLocation?.lng   || undefined,
      ...(uploadedUrls.event_logo_url       ? { event_logo_url:       uploadedUrls.event_logo_url       } : {}),
      ...(uploadedUrls.invitation_media_url ? { invitation_media_url: uploadedUrls.invitation_media_url } : {}),
      ...(uploadedUrls.qr_background_url    ? { qr_background_url:    uploadedUrls.qr_background_url    } : {}),
    };

    try {
      const res  = await authFetch(`/api/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ أثناء الحفظ');
      } else {
        window.location.href = `/events/${eventId}`;
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;

  if (loading) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1E000E 0%, #3D0022 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>جارٍ التحميل...</p>
    </div>
  );

  if (loadError) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1E000E 0%, #3D0022 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui' }}>
      <p style={{ color: '#ff6b6b' }}>{loadError}</p>
    </div>
  );

  return (
    <div dir="rtl" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1E000E 0%, #3D0022 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0,
        background: 'rgba(30,0,14,0.9)', backdropFilter: 'blur(8px)', zIndex: 10,
      }}>
        <a href={`/events/${eventId}`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1 }}>
          &#8592;
        </a>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#C8005A' }}>
          تعديل الفعالية
        </h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <FieldGroup label="اسم الفعالية *">
            <input type="text" name="name" value={form.name} onChange={handleChange} required style={inputStyle} />
          </FieldGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FieldGroup label="التاريخ *">
              <input type="date" name="date" value={form.date} onChange={handleChange} required style={{ ...inputStyle, colorScheme: 'dark' }} />
            </FieldGroup>
            <FieldGroup label="الوقت *">
              <input type="time" name="time" value={form.time} onChange={handleChange} required style={{ ...inputStyle, colorScheme: 'dark' }} />
            </FieldGroup>
          </div>

          <FieldGroup label="اسم القاعة / المكان *">
            <input type="text" name="venue" value={form.venue} onChange={handleChange} required style={inputStyle} />
          </FieldGroup>

          <FieldGroup label="موقع الفعالية على الخريطة">
            <LocationPicker value={mapLocation} onChange={setMapLocation} />
          </FieldGroup>

          <FieldGroup label="عدد المدعوين *">
            <input type="number" name="capacity" value={form.capacity} onChange={handleChange} required min={1} style={inputStyle} />
          </FieldGroup>

          <FieldGroup label="نص الدعوة *">
            <textarea name="invitation_text" value={form.invitation_text} onChange={handleChange} required rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </FieldGroup>

          {/* Images — all optional on edit */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              الصور <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>(اتركها كما هي أو ارفع صورة جديدة)</span>
            </h3>
            <FileUploadField label="شعار الفعالية" fieldKey="event_logo_url"
              uploadedUrls={uploadedUrls} setUploadedUrls={setUploadedUrls}
              uploading={uploading} setUploading={setUploading}
              currentUrl={currentUrls.event_logo_url} />
            <FileUploadField label="صورة الدعوة" fieldKey="invitation_media_url"
              uploadedUrls={uploadedUrls} setUploadedUrls={setUploadedUrls}
              uploading={uploading} setUploading={setUploading}
              currentUrl={currentUrls.invitation_media_url} />
            <FileUploadField label="خلفية رمز QR (اختياري)" fieldKey="qr_background_url"
              uploadedUrls={uploadedUrls} setUploadedUrls={setUploadedUrls}
              uploading={uploading} setUploading={setUploading}
              currentUrl={currentUrls.qr_background_url} />
          </div>

          {error && <p style={{ color: '#ff6b6b', fontSize: 14, margin: 0, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{
            background: '#C8005A', color: '#fff', borderRadius: 12,
            padding: '14px 28px', border: 'none', fontSize: 16, fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>

        </form>
      </div>
    </div>
  );
}
