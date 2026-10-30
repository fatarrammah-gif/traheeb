'use client';

/**
 * Import externally-created QR tokens (web).
 *
 * Flow:
 *   1. Pick an Excel/CSV file → POST /api/events/[id]/imported-qr/preview
 *      (parses, classifies against existing tokens, writes nothing)
 *   2. Review: N new codes + a toggleable list of duplicates (tokens that
 *      already belong to a guest or a previous import) — each toggle grants
 *      one extra admission chance on that code.
 *   3. Apply → POST /api/events/[id]/imported-qr with the selection.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWebAuth, authFetch } from '../../../../utils/webAuth.js';

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImportQRPage() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const token = useWebAuth((s) => s.token);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null); // { newTokens, duplicates, skipped }
  const [extendMap, setExtendMap] = useState({}); // token -> boolean
  const [toast, setToast] = useState(null);

  useEffect(() => { if (!token) window.location.href = '/login'; }, [token]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setLoading(true);
    setPreview(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await authFetch(`/api/events/${eventId}/imported-qr/preview`, {
        method: 'POST',
        body: JSON.stringify({ fileBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || 'تعذر معالجة الملف', type: 'error' });
        return;
      }
      setPreview(data);
      const defaults = {};
      for (const d of data.duplicates) defaults[d.token] = true;
      setExtendMap(defaults);
    } catch {
      setToast({ message: 'تعذر قراءة الملف', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function toggleExtend(tok) {
    setExtendMap((prev) => ({ ...prev, [tok]: !prev[tok] }));
  }

  async function applyImport() {
    if (!preview) return;
    setApplying(true);
    try {
      const extendTokens = preview.duplicates.filter((d) => extendMap[d.token]).map((d) => d.token);
      const res = await authFetch(`/api/events/${eventId}/imported-qr`, {
        method: 'POST',
        body: JSON.stringify({ newTokens: preview.newTokens, extendTokens }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || 'تعذر تطبيق الاستيراد', type: 'error' });
        return;
      }
      navigate(`/events/${eventId}`, {
        state: {
          toast: {
            message: `تمت إضافة ${data.added} رمز جديد، ومنح فرصة دخول إضافية لـ ${data.extended} رمز.`,
            type: 'success',
          },
        },
      });
    } catch {
      setToast({ message: 'تعذر تطبيق الاستيراد', type: 'error' });
    } finally {
      setApplying(false);
    }
  }

  if (!token) return null;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>
      <div style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={`/events/${eventId}`} style={{ color: '#fff', textDecoration: 'none', fontSize: 20 }}>→</a>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>استيراد رموز QR</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 80px' }}>
        <div style={{ background: T.surface, borderRadius: 20, padding: 24, border: `1px solid ${T.border}`, boxShadow: '0 2px 12px rgba(138,0,79,0.05)' }}>
          <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.8, margin: '0 0 20px' }}>
            اختر ملف Excel أو CSV يحتوي على عمود واحد من رموز QR الصادرة مسبقاً خارج
            النظام. الرموز الجديدة تُضاف كبطاقات قابلة للمسح مرة واحدة. أما الرموز
            الموجودة بالفعل، فيمكنك منحها فرصة دخول إضافية.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              width: '100%',
              background: GRAD,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            {loading ? 'جارٍ المعالجة...' : '📊 اختيار ملف'}
          </button>

          {preview && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: T.primarySoft, borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{preview.newTokens.length} رمز جديد</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{preview.duplicates.length} موجود مسبقاً</span>
              </div>

              {preview.duplicates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>منح فرصة دخول إضافية</h4>
                  {preview.duplicates.map((d) => (
                    <label
                      key={d.token}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: T.bg,
                        borderRadius: 10,
                        padding: '10px 14px',
                        border: `1px solid ${T.border}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                          {d.source === 'guest' ? d.guestName : 'بطاقة مستوردة'}
                        </span>
                        <span style={{ fontSize: 12, color: T.muted }}>
                          {d.maxScans} دخولات، مستخدم {d.scanCount}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!extendMap[d.token]}
                        onChange={() => toggleExtend(d.token)}
                        style={{ width: 20, height: 20, accentColor: T.primary, cursor: 'pointer' }}
                      />
                    </label>
                  ))}
                </div>
              )}

              <button
                onClick={applyImport}
                disabled={applying}
                style={{
                  background: '#1A0910',
                  color: '#E6D06A',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: applying ? 'not-allowed' : 'pointer',
                  opacity: applying ? 0.7 : 1,
                  fontFamily: "'Cairo', sans-serif",
                }}
              >
                {applying ? 'جارٍ التطبيق...' : 'تطبيق الاستيراد'}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'success' ? '#059669' : '#EF4444',
            color: '#fff',
            borderRadius: 12,
            padding: '14px 24px',
            fontSize: 14,
            fontWeight: 600,
            zIndex: 1000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
