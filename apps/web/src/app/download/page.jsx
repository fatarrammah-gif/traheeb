'use client';

const LOGO =
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/7881a02c-860c-49fb-be4b-2701f4d65e59.png';
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

const AppStoreIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.15-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.77M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const PlayStoreIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.36.6 1.24 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8zm2-13.84v11.68L16.01 12 5 6.66z" />
  </svg>
);

export default function DownloadPage() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Cairo', sans-serif" }}>

      {/* Navbar */}
      <nav style={{ background: GRAD, position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 16px rgba(138,0,79,0.18)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src={LOGO} alt="تراحيب" style={{ width: 62, height: 62, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </a>
          <a href="/" style={{ padding: '7px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.28)' }}>
            الرئيسية
          </a>
        </div>
      </nav>

      {/* Hero banner */}
      <div style={{ background: GRAD, padding: '60px 24px 80px', textAlign: 'center', position: 'relative' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ width: 90, height: 90, borderRadius: 24, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <img src={LOGO} alt="تراحيب" style={{ width: 68, height: 68, objectFit: 'contain', mixBlendMode: 'screen' }} />
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>حمّل تطبيق تراحيب</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.82)', lineHeight: 1.8, margin: 0 }}>
            أدر فعالياتك وابعث دعوات واتساب وتابع ضيوفك من هاتفك بسهولة تامة
          </p>
        </div>
        {/* Wave */}
        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0 }}>
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" style={{ width: '100%', height: 48, display: 'block' }}>
            <path d="M0,48 C360,0 1080,0 1440,48 L1440,48 L0,48 Z" fill={T.bg} />
          </svg>
        </div>
      </div>

      {/* Download buttons */}
      <div style={{ maxWidth: 540, margin: '60px auto 80px', padding: '0 24px' }}>
        <div style={{ background: T.surface, borderRadius: 28, padding: '48px 40px', border: `1px solid ${T.border}`, boxShadow: '0 8px 48px rgba(138,0,79,0.08)', textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: T.muted, marginBottom: 36, lineHeight: 1.8 }}>
            متاح على متجر آبل ومتجر جوجل بلاي — اختر المنصة المناسبة لجهازك
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* App Store */}
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 28px',
                borderRadius: 18,
                background: '#000',
                color: '#fff',
                textDecoration: 'none',
                boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.18)'; }}
            >
              <AppStoreIcon />
              <div style={{ textAlign: 'right', flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>متاح على</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>App Store</div>
              </div>
            </a>

            {/* Google Play */}
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 28px',
                borderRadius: 18,
                background: GRAD,
                color: '#fff',
                textDecoration: 'none',
                boxShadow: '0 6px 24px rgba(138,0,79,0.28)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(138,0,79,0.38)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(138,0,79,0.28)'; }}
            >
              <PlayStoreIcon />
              <div style={{ textAlign: 'right', flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>متاح على</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Google Play</div>
              </div>
            </a>
          </div>

          <div style={{ marginTop: 36, paddingTop: 28, borderTop: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 13, color: T.muted, margin: '0 0 16px' }}>هل أنت منظّم فعاليات؟</p>
            <a
              href="/login"
              style={{ color: T.primary, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
            >
              تسجيل الدخول للوحة التحكم ←
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
