'use client';
import { useState, useEffect } from 'react';

const LOGO =
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/7881a02c-860c-49fb-be4b-2701f4d65e59.png';
const HERO_GRAD =
  'linear-gradient(135deg, #F59E0B 0%, #EF6C00 42%, #BE185D 100%)';
const PINK_GRAD =
  'linear-gradient(135deg, #8A004F 0%, #C2185B 45%, #D81B72 100%)';
const WHATSAPP = '966538384048';

const SCREENS = [
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/0f17ea19-67fb-44ae-a422-043184b4beaf.png',
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/f894c3d3-1110-4068-9feb-c194d49b2c44.png',
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/99c93e59-e4e7-456c-82b8-42399425dc06.png',
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/14e46981-d906-4e1f-8fa9-26942430d298.png',
  'https://dtvoeevhaseb5.cloudfront.net/user-uploads/b42cfa36-4dea-4402-b2c3-8cd7e546f5c6.png',
];

const T = {
  bg: '#FFF9FB',
  surface: '#FFFFFF',
  primary: '#C2185B',
  primarySoft: '#FFF0F7',
  accent: '#EF6C00',
  text: '#1A0910',
  muted: '#7A5568',
  border: '#F2E0EB',
};

const FEATURES = [
  {
    icon: '✉️',
    title: 'إنشاء دعوة',
    desc: 'أنشئ بطاقة دعوة رقمية احترافية لمناسبتك في ثوانٍ مع تذكرة QR فريدة لكل ضيف.',
  },
  {
    icon: '📲',
    title: 'إرسال الدعوات',
    desc: 'أرسل الدعوات لجميع المدعوين عبر واتساب بنقرة واحدة مع رمز QR خاص بكل ضيف.',
  },
  {
    icon: '📊',
    title: 'عرض الإحصائيات',
    desc: 'تابع حالة كل ضيف لحظةً بلحظة — مؤكد، معتذر، أو في الانتظار — مع إحصائيات فورية.',
  },
  {
    icon: '🔗',
    title: 'رابط التحضير',
    desc: 'يُتاح رابط مسح رموز الدخول قبل المناسبة بيوم دون الحاجة لجهاز خارجي.',
  },
  {
    icon: '🔔',
    title: 'تذكير المدعوين',
    desc: 'يُرسل تذكير تلقائي عبر واتساب لمن أكد حضوره قبل المناسبة بيوم كامل.',
  },
  {
    icon: '📋',
    title: 'إحصائيات المناسبة',
    desc: 'يمكن متابعة المدعوين والحصول على إحصائيات مفصّلة عن الحاضرين والغائبين والمعتذرين.',
  },
];

const HOW_STEPS = [
  {
    num: '01',
    title: 'أنشئ مناسبتك',
    desc: 'أدخل تفاصيل المناسبة — الاسم، التاريخ، المكان، السعة — في أقل من دقيقة.',
    img: SCREENS[0],
  },
  {
    num: '02',
    title: 'أضف المدعوين',
    desc: 'أضف أسماء الضيوف وأرقام واتساب. يحصل كل ضيف على رمز QR فريد خاص به.',
    img: SCREENS[1],
  },
  {
    num: '03',
    title: 'أرسل الدعوات',
    desc: 'بنقرة واحدة تُرسل الدعوات لجميع الضيوف عبر واتساب مع تذكرتهم الرقمية.',
    img: SCREENS[2],
  },
  {
    num: '04',
    title: 'امسح رموز الدخول',
    desc: 'في يوم المناسبة افتح التطبيق وامسح رموز QR الضيوف بكاميرا هاتفك.',
    img: SCREENS[3],
  },
  {
    num: '05',
    title: 'تابع الإحصائيات',
    desc: 'راقب الحضور لحظةً بلحظة واحصل على تقرير شامل بنهاية المناسبة.',
    img: SCREENS[4],
  },
];

const PACKAGES = [
  {
    name: 'المجاني',
    price: '0',
    period: 'دائماً',
    color: T.muted,
    bg: '#F9FAFB',
    border: '#E5E7EB',
    features: ['5 فعاليات شهرياً', '50 ضيفاً لكل فعالية', 'رموز QR', 'دعوات واتساب'],
    cta: 'ابدأ مجاناً',
    ctaBg: '#1A0910',
  },
  {
    name: 'الاحترافي',
    price: '49',
    period: 'شهرياً',
    color: T.primary,
    bg: T.primarySoft,
    border: T.primary,
    badge: 'الأكثر شعبية',
    features: [
      'فعاليات غير محدودة',
      '500 ضيف لكل فعالية',
      'رموز QR',
      'دعوات واتساب',
      'تذكير تلقائي',
      'إحصائيات متقدمة',
    ],
    cta: 'ابدأ الآن',
    ctaBg: PINK_GRAD,
  },
  {
    name: 'المؤسسي',
    price: '199',
    period: 'شهرياً',
    color: '#EF6C00',
    bg: '#FFF3E0',
    border: '#EF6C00',
    features: [
      'فعاليات غير محدودة',
      'ضيوف غير محدودين',
      'رموز QR',
      'دعوات واتساب',
      'تذكير تلقائي',
      'إحصائيات متقدمة',
      'دعم مخصص 24/7',
      'تقارير مفصّلة',
    ],
    cta: 'تواصل معنا',
    ctaBg: 'linear-gradient(135deg,#EF6C00,#BE185D)',
  },
];

const NAV_ITEMS = [
  { id: 'hero', label: 'الرئيسية' },
  { id: 'features', label: 'المميزات' },
  { id: 'how', label: 'التطبيق' },
  { id: 'packages', label: 'الباقات' },
  { id: 'contact', label: 'تواصل معنا' },
];

function scrollTo(id) {
  if (typeof document !== 'undefined') {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

const WaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.523 5.855L.054 23.455a.5.5 0 00.609.61l5.7-1.493A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.868 0-3.607-.506-5.099-1.387l-.37-.218-3.763.986.999-3.681-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
);

function PhoneMockup({ src }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: 220,
          height: 440,
          borderRadius: 38,
          overflow: 'hidden',
          border: '3px solid #F2E0EB',
          boxShadow: '0 24px 64px rgba(138,0,79,0.16), 0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

function StepText({ step }) {
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 54,
          height: 54,
          borderRadius: 16,
          background: PINK_GRAD,
          marginBottom: 20,
          marginLeft: 'auto',
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{step.num}</span>
      </div>
      <h3 style={{ fontSize: 28, fontWeight: 800, color: T.text, marginBottom: 14 }}>
        {step.title}
      </h3>
      <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.9, maxWidth: 400 }}>
        {step.desc}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('hero');
  const [visible, setVisible] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', msg: '' });

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      const ids = NAV_ITEMS.map((n) => n.id);
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && window.scrollY >= el.offsetTop - 130) {
          setActiveNav(ids[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleContact = (e) => {
    e.preventDefault();
    const msg = encodeURIComponent(
      `مرحباً، أنا ${contactForm.name}\n${contactForm.msg}\nرقمي: ${contactForm.phone}`,
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  const inp = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid ${T.border}`,
    fontSize: 15,
    color: T.text,
    background: '#fff',
    outline: 'none',
    textAlign: 'right',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, direction: 'rtl' }}>

      {/* ══ NAVBAR ══ */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 300,
          direction: 'rtl',
          background: scrolled
            ? 'linear-gradient(135deg,#6B003D 0%,#A01248 45%,#B8145E 100%)'
            : PINK_GRAD,
          boxShadow: scrolled
            ? '0 4px 28px rgba(138,0,79,0.35)'
            : '0 2px 16px rgba(138,0,79,0.18)',
          transition: 'background 0.3s, box-shadow 0.3s',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 28px',
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* Logo */}
          <button
            onClick={() => scrollTo('hero')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            <img
              src={LOGO}
              alt="تراحيب"
              style={{ width: 62, height: 62, objectFit: 'contain', mixBlendMode: 'screen' }}
            />
          </button>

          {/* Desktop nav */}
          <div
            className="nav-links"
            style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}
          >
            {NAV_ITEMS.map((n) => {
              const active = activeNav === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => scrollTo(n.id)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 10,
                    border: 'none',
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    color: active ? '#C2185B' : 'rgba(255,255,255,0.88)',
                    background: active ? '#fff' : 'transparent',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.88)';
                    }
                  }}
                >
                  {n.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <a
              href="/login"
              style={{
                padding: '9px 22px',
                borderRadius: 10,
                background: '#fff',
                color: '#C2185B',
                fontWeight: 800,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                boxShadow: '0 3px 14px rgba(0,0,0,0.18)',
                display: 'inline-block',
              }}
            >
              تسجيل الدخول
            </a>
            <button
              className="hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                display: 'none',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 9,
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 19,
                color: '#fff',
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.18)',
              padding: '10px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {NAV_ITEMS.map((n) => (
              <button
                key={n.id}
                onClick={() => { scrollTo(n.id); setMenuOpen(false); }}
                style={{
                  padding: '13px 18px',
                  borderRadius: 11,
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'right',
                }}
              >
                {n.label}
              </button>
            ))}
            <a
              href="/login"
              style={{
                padding: '13px 18px',
                borderRadius: 11,
                fontSize: 16,
                fontWeight: 700,
                color: '#C2185B',
                background: '#fff',
                textDecoration: 'none',
                textAlign: 'right',
                display: 'block',
                marginTop: 4,
              }}
            >
              تسجيل الدخول
            </a>
          </div>
        )}
      </nav>

      {/* ══ HERO ══ */}
      <section id="hero" style={{ position: 'relative', background: HERO_GRAD, overflow: 'hidden' }}>
        {/* Background circles */}
        <div style={{ position: 'absolute', top: -110, right: -110, width: 440, height: 440, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '35%', left: '25%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '88px 40px 0',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 48,
            flexWrap: 'wrap',
            direction: 'rtl',
          }}
        >
          {/* Text */}
          <div
            style={{
              flex: 1,
              minWidth: 300,
              paddingBottom: 88,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(24px)',
              transition: 'all 0.85s ease',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                marginBottom: 22,
              }}
            >
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>🎉 إدارة الفعاليات بذكاء</span>
            </div>
            <h1
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.2,
                marginBottom: 22,
                textShadow: '0 2px 16px rgba(0,0,0,0.18)',
              }}
            >
              ادعُ ضيوفك
              <br />
              بأسلوب{' '}
              <em style={{ fontStyle: 'normal', borderBottom: '3px solid rgba(255,255,255,0.5)' }}>
                احترافي
              </em>
            </h1>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,0.88)',
                lineHeight: 1.9,
                marginBottom: 40,
                maxWidth: 460,
              }}
            >
              تراحيب هو تطبيقك الذكي لإنشاء الدعوات الرقمية، إرسالها عبر واتساب،
              ومتابعة حضور ضيوفك لحظةً بلحظة برموز QR فريدة.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <a
                href="/login"
                style={{
                  padding: '15px 36px',
                  borderRadius: 14,
                  background: '#fff',
                  color: '#BE185D',
                  fontWeight: 800,
                  fontSize: 16,
                  textDecoration: 'none',
                  boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
              >
                تسجيل الدخول
              </a>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '15px 36px',
                  borderRadius: 14,
                  background: '#25D366',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  textDecoration: 'none',
                  boxShadow: '0 6px 28px rgba(37,211,102,0.38)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
              >
                <WaIcon /> تواصل واتساب
              </a>
            </div>
          </div>

          {/* Phone mockup */}
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              opacity: visible ? 1 : 0,
              transition: 'opacity 1.1s ease 0.4s, transform 1s ease 0.4s',
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
            }}
          >
            <div style={{ position: 'relative', width: 230 }}>
              {/* Phone frame */}
              <div
                style={{
                  width: 230,
                  height: 466,
                  borderRadius: 42,
                  background: 'rgba(255,255,255,0.15)',
                  border: '2.5px solid rgba(0,0,0,0.75)',
                  overflow: 'hidden',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(0,0,0,0.10)',
                }}
              >
                <img src="/screen_1.jpeg" alt="تراحيب" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
              </div>
              {/* Floating logo badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -22,
                  right: -22,
                  width: 82,
                  height: 82,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 28px rgba(138,0,79,0.22)',
                  border: '3px solid #FFF0F7',
                  overflow: 'hidden',
                }}
              >
                <img src="/icon_2.png" alt="" style={{ width: '130%', height: '130%', objectFit: 'cover', marginTop: '12%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" style={{ width: '100%', height: 70, display: 'block', marginTop: 40 }}>
          <path d="M0,70 C360,0 1080,0 1440,70 L1440,70 L0,70 Z" fill={T.bg} />
        </svg>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" style={{ padding: '80px 28px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 20px',
              borderRadius: 999,
              background: T.primarySoft,
              border: `1px solid ${T.border}`,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>✨ مميزاتنا</span>
          </div>
          <h2 style={{ fontSize: 44, fontWeight: 800, color: T.text, marginBottom: 14 }}>لماذا تراحيب ؟</h2>
          <p style={{ fontSize: 17, color: T.muted, maxWidth: 500, margin: '0 auto', lineHeight: 1.85 }}>
            كل ما تحتاجه لإدارة مناسبتك من الدعوة حتى الإحصائيات — في مكان واحد.
          </p>
        </div>
        <div
          className="feat-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                background: T.surface,
                borderRadius: 24,
                padding: 32,
                border: `1px solid ${T.border}`,
                boxShadow: '0 2px 16px rgba(138,0,79,0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 20px 52px rgba(138,0,79,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 2px 16px rgba(138,0,79,0.05)';
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 16,
                  background: i % 2 === 0 ? T.primarySoft : '#FFF3E0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  marginBottom: 20,
                  marginLeft: 'auto',
                }}
              >
                {f.icon}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.85 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" style={{ background: T.surface, padding: '80px 0' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 20px',
                borderRadius: 999,
                background: T.primarySoft,
                border: `1px solid ${T.border}`,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>📱 خطوات بسيطة</span>
            </div>
            <h2 style={{ fontSize: 44, fontWeight: 800, color: T.text, marginBottom: 14 }}>كيف يعمل تراحيب ؟</h2>
            <p style={{ fontSize: 17, color: T.muted, maxWidth: 460, margin: '0 auto', lineHeight: 1.85 }}>
              خمس خطوات بسيطة تفصلك عن مناسبة مثالية ومنظّمة باحترافية.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 88 }}>
            {HOW_STEPS.map((step, i) => {
              const phoneFirst = i % 2 === 0;
              return (
                <div
                  key={i}
                  className="step-row"
                  style={{ display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap', direction: 'rtl' }}
                >
                  {phoneFirst ? (
                    <>
                      <PhoneMockup src={step.img} />
                      <StepText step={step} />
                    </>
                  ) : (
                    <>
                      <StepText step={step} />
                      <PhoneMockup src={step.img} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ PACKAGES ══ */}
      <section id="packages" style={{ padding: '80px 28px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 20px',
              borderRadius: 999,
              background: T.primarySoft,
              border: `1px solid ${T.border}`,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>💎 الأسعار</span>
          </div>
          <h2 style={{ fontSize: 44, fontWeight: 800, color: T.text, marginBottom: 14 }}>الباقات</h2>
          <p style={{ fontSize: 17, color: T.muted, maxWidth: 420, margin: '0 auto', lineHeight: 1.85 }}>
            اختر الباقة المناسبة لاحتياجاتك — وابدأ مجاناً.
          </p>
        </div>
        <div
          className="pkg-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, alignItems: 'start' }}
        >
          {PACKAGES.map((pkg, i) => (
            <div
              key={i}
              style={{
                background: pkg.bg,
                borderRadius: 28,
                padding: 36,
                border: `2px solid ${pkg.border}`,
                boxShadow: i === 1 ? '0 20px 64px rgba(138,0,79,0.18)' : '0 4px 20px rgba(0,0,0,0.06)',
                position: 'relative',
                transform: i === 1 ? 'translateY(-14px)' : 'none',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow =
                  i === 1 ? '0 28px 72px rgba(138,0,79,0.25)' : '0 12px 40px rgba(0,0,0,0.12)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow =
                  i === 1 ? '0 20px 64px rgba(138,0,79,0.18)' : '0 4px 20px rgba(0,0,0,0.06)')
              }
            >
              {pkg.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: PINK_GRAD,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '5px 18px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 14px rgba(138,0,79,0.3)',
                  }}
                >
                  {pkg.badge}
                </div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, color: pkg.color, marginBottom: 12 }}>{pkg.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 50, fontWeight: 800, color: T.text }}>{pkg.price}</span>
                <span style={{ fontSize: 15, color: T.muted }}>ر.س / {pkg.period}</span>
              </div>
              <div style={{ height: 1, background: T.border, margin: '20px 0' }} />
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pkg.features.map((feat, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: T.text }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: pkg.color,
                        fontWeight: 800,
                        flexShrink: 0,
                        border: `1.5px solid ${pkg.border}`,
                      }}
                    >
                      ✓
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => scrollTo('contact')}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: 14,
                  border: 'none',
                  background: pkg.ctaBg,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
              >
                {pkg.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section id="contact" style={{ background: T.surface, padding: '80px 28px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 20px',
                borderRadius: 999,
                background: T.primarySoft,
                border: `1px solid ${T.border}`,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>💬 نحن هنا</span>
            </div>
            <h2 style={{ fontSize: 44, fontWeight: 800, color: T.text, marginBottom: 12 }}>تواصل معنا</h2>
            <p style={{ fontSize: 17, color: T.muted, lineHeight: 1.85 }}>
              أرسل لنا رسالتك وسنرد عليك عبر واتساب في أقرب وقت.
            </p>
          </div>
          <form
            onSubmit={handleContact}
            style={{
              background: T.bg,
              borderRadius: 28,
              padding: 36,
              border: `1px solid ${T.border}`,
              boxShadow: '0 8px 40px rgba(138,0,79,0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {[
              { key: 'name', label: 'الاسم', ph: 'اسمك الكريم', type: 'text' },
              { key: 'phone', label: 'رقم الواتساب', ph: '+966 5X XXX XXXX', type: 'tel' },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 7 }}>
                  {f.label} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  style={inp}
                  placeholder={f.ph}
                  type={f.type}
                  value={contactForm[f.key]}
                  onChange={(e) => setContactForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 7 }}>
                رسالتك
              </label>
              <textarea
                style={{ ...inp, height: 120, resize: 'vertical', lineHeight: 1.7 }}
                placeholder="كيف يمكننا مساعدتك؟"
                value={contactForm.msg}
                onChange={(e) => setContactForm((p) => ({ ...p, msg: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '15px',
                borderRadius: 14,
                border: 'none',
                background: '#25D366',
                color: '#fff',
                fontWeight: 800,
                fontSize: 17,
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(37,211,102,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              <WaIcon /> إرسال عبر واتساب
            </button>
          </form>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: '#1A0910', padding: '52px 28px 32px', direction: 'rtl' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 40,
              marginBottom: 44,
            }}
          >
            <div>
              <img
                src={LOGO}
                alt="تراحيب"
                style={{ width: 64, height: 64, objectFit: 'contain', mixBlendMode: 'screen', marginBottom: 14 }}
              />
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', maxWidth: 260, lineHeight: 1.8 }}>
                تطبيقك الذكي لإدارة الدعوات ومتابعة الحضور عبر واتساب ورموز QR.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 52, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 18, letterSpacing: 1, textTransform: 'uppercase' }}>
                  روابط سريعة
                </div>
                {NAV_ITEMS.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => scrollTo(n.id)}
                    style={{
                      display: 'block',
                      fontSize: 14,
                      color: 'rgba(255,255,255,0.62)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'right',
                      padding: '5px 0',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.62)')}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 18, letterSpacing: 1, textTransform: 'uppercase' }}>
                  الحساب
                </div>
                <a href="/login" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.62)', textDecoration: 'none', padding: '5px 0', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.62)')}
                >
                  تسجيل الدخول
                </a>
                <a href="/dashboard" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.62)', textDecoration: 'none', padding: '5px 0', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.62)')}
                >
                  لوحة التحكم
                </a>
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.10)',
              paddingTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              © 2025 تراحيب. جميع الحقوق محفوظة.
            </p>
            <div style={{ display: 'flex', gap: 24 }}>
              <a href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                سياسة الخصوصية
              </a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .nav-links  { display: none !important; }
          .hamburger  { display: flex !important; }
          .feat-grid  { grid-template-columns: 1fr !important; }
          .pkg-grid   { grid-template-columns: 1fr !important; }
          .step-row   { flex-direction: column !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .feat-grid { grid-template-columns: 1fr 1fr !important; }
          .pkg-grid  { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
