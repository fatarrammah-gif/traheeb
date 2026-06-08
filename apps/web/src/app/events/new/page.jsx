'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebAuth, authFetch } from '../../../utils/webAuth.js';

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

function FileUploadField({ label, fieldKey, uploadedUrls, setUploadedUrls, uploading, setUploading }) {
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading((prev) => ({ ...prev, [fieldKey]: true }));
    try {
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
      } else {
        alert('فشل رفع الصورة: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch {
      alert('حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }

  const isUploaded = !!uploadedUrls[fieldKey];
  const isUploading = !!uploading[fieldKey];

  return (
    <FieldGroup label={label}>
      <div
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px dashed rgba(255,255,255,0.25)',
          borderRadius: 10,
          padding: '16px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {isUploading ? (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
            جارٍ الرفع...
          </p>
        ) : isUploaded ? (
          <p style={{ margin: 0, color: '#4caf88', fontSize: 14 }}>✓ تم رفع الصورة</p>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              اختر صورة للرفع
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
            <span
              style={{
                background: 'rgba(200,0,90,0.2)',
                color: '#ff6aab',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
              }}
            >
              اختر ملف
            </span>
          </>
        )}
        {isUploaded && (
          <button
            type="button"
            onClick={() => setUploadedUrls((prev) => ({ ...prev, [fieldKey]: '' }))}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              cursor: 'pointer',
              marginTop: 6,
              display: 'block',
              margin: '6px auto 0',
            }}
          >
            تغيير الصورة
          </button>
        )}
      </div>
    </FieldGroup>
  );
}

function LocationPicker({ value, onChange }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked]     = useState(value || null); // { label, lat, lng }
  const debounceRef = useRef(null);

  async function search(q) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'ar,en' } });
      const data = await res.json();
      setResults(data);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 500);
  }

  function pick(item) {
    const loc = {
      label: item.display_name,
      lat:   parseFloat(item.lat),
      lng:   parseFloat(item.lon),
    };
    setPicked(loc);
    setResults([]);
    setQuery('');
    onChange(loc);
  }

  function reset() {
    setPicked(null);
    onChange(null);
    setQuery('');
    setResults([]);
  }

  const mapSrc = picked
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${picked.lng - 0.01},${picked.lat - 0.01},${picked.lng + 0.01},${picked.lat + 0.01}&layer=mapnik&marker=${picked.lat},${picked.lng}`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {picked ? (
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          {/* Map preview */}
          <iframe
            src={mapSrc}
            width="100%"
            height="200"
            style={{ border: 'none', display: 'block' }}
            title="موقع الفعالية"
          />
          {/* Location label + change button */}
          <div style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, flex: 1 }}>
              📍 {picked.label}
            </span>
            <button
              type="button"
              onClick={reset}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.55)',
                fontSize: 12,
                padding: '4px 10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              تغيير
            </button>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={handleInput}
              placeholder="ابحث عن الموقع أو أدخل العنوان..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => search(query)}
              disabled={searching}
              style={{
                background: '#C8005A',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '0 18px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: searching ? 0.7 : 1,
              }}
            >
              {searching ? '...' : 'بحث'}
            </button>
          </div>
          {results.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              left: 0,
              background: '#2a0018',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              zIndex: 50,
              maxHeight: 260,
              overflowY: 'auto',
              marginTop: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {results.map((item) => (
                <button
                  key={item.place_id}
                  type="button"
                  onClick={() => pick(item)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '11px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    color: '#fff',
                    fontSize: 13,
                    textAlign: 'right',
                    cursor: 'pointer',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,0,90,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  📍 {item.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewEventPage() {
  const token = useWebAuth((s) => s.token);

  const [mapLocation, setMapLocation] = useState(null); // { label, lat, lng }
  const [form, setForm] = useState({
    name: '',
    date: '',
    time: '',
    venue: '',
    capacity: '',
    invitation_text: '',
  });
  const [uploadedUrls, setUploadedUrls] = useState({
    event_logo_url: '',
    invitation_media_url: '',
    qr_background_url: '',
  });
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
    }
  }, [token]);

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
      const res = await authFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ أثناء الإنشاء');
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setSubmitting(false);
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
          style={{
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          &#8592;
        </a>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#C8005A' }}>
          إنشاء فعالية جديدة
        </h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <FieldGroup label="اسم الفعالية *">
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </FieldGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FieldGroup label="التاريخ *">
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </FieldGroup>
            <FieldGroup label="الوقت *">
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={handleChange}
                required
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="اسم القاعة / المكان *">
            <input
              type="text"
              name="venue"
              value={form.venue}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </FieldGroup>

          <FieldGroup label="موقع الفعالية على الخريطة">
            <LocationPicker value={mapLocation} onChange={setMapLocation} />
          </FieldGroup>

          <FieldGroup label="عدد المدعوين *">
            <input
              type="number"
              name="capacity"
              value={form.capacity}
              onChange={handleChange}
              required
              min={1}
              style={inputStyle}
            />
          </FieldGroup>

          <FieldGroup label="نص الدعوة *">
            <textarea
              name="invitation_text"
              value={form.invitation_text}
              onChange={handleChange}
              required
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </FieldGroup>

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              الصور
            </h3>
            <FileUploadField
              label="شعار الفعالية *"
              fieldKey="event_logo_url"
              uploadedUrls={uploadedUrls}
              setUploadedUrls={setUploadedUrls}
              uploading={uploading}
              setUploading={setUploading}
            />
            <FileUploadField
              label="صورة الدعوة *"
              fieldKey="invitation_media_url"
              uploadedUrls={uploadedUrls}
              setUploadedUrls={setUploadedUrls}
              uploading={uploading}
              setUploading={setUploading}
            />
            <FileUploadField
              label="خلفية رمز QR (اختياري)"
              fieldKey="qr_background_url"
              uploadedUrls={uploadedUrls}
              setUploadedUrls={setUploadedUrls}
              uploading={uploading}
              setUploading={setUploading}
            />
          </div>

          {error && (
            <p style={{ color: '#ff6b6b', fontSize: 14, margin: 0, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#C8005A',
              color: '#fff',
              borderRadius: 12,
              padding: '14px 28px',
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              marginTop: 8,
            }}
          >
            {submitting ? 'جارٍ الإنشاء...' : 'إنشاء الفعالية'}
          </button>
        </form>
      </div>
    </div>
  );
}
