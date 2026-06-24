export default function PrivacyPage() {
  return (
    <div
      dir="rtl"
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1a1a1a',
        lineHeight: 1.8,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        سياسة الخصوصية — تراحيب
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        آخر تحديث: يونيو 2026
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          نبذة عن التطبيق
        </h2>
        <p>
          تراحيب هو تطبيق لإدارة الدعوات الإلكترونية للفعاليات. يتيح للمنظمين
          إنشاء الفعاليات، وإرسال الدعوات عبر واتساب، وتوليد رموز QR لتسجيل
          الحضور.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          البيانات التي نجمعها
        </h2>
        <ul style={{ paddingRight: 20 }}>
          <li>
            <strong>رقم الهاتف:</strong> يُستخدم لتسجيل الدخول عبر رمز OTP
            وإرسال الدعوات.
          </li>
          <li>
            <strong>اسم المستخدم:</strong> يُستخدم لتخصيص الفعاليات والدعوات.
          </li>
          <li>
            <strong>بيانات الفعاليات والضيوف:</strong> يُدخلها المنظم ويتحكم
            فيها بالكامل.
          </li>
          <li>
            <strong>الكاميرا:</strong> تُستخدم فقط لمسح رموز QR عند دخول
            الضيوف إلى الفعالية.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          كيف نستخدم البيانات
        </h2>
        <ul style={{ paddingRight: 20 }}>
          <li>إرسال رمز التحقق (OTP) لتسجيل الدخول.</li>
          <li>إرسال دعوات الفعاليات ورموز QR للضيوف عبر واتساب.</li>
          <li>تسجيل حضور الضيوف في الفعاليات.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          مشاركة البيانات
        </h2>
        <p>
          لا نبيع أي بيانات شخصية لأطراف ثالثة. نستخدم خدمات خارجية محدودة
          لتشغيل التطبيق:
        </p>
        <ul style={{ paddingRight: 20 }}>
          <li>
            <strong>Twilio:</strong> لإرسال رسائل SMS لتسجيل الدخول.
          </li>
          <li>
            <strong>Meta (واتساب):</strong> لإرسال الدعوات للضيوف.
          </li>
          <li>
            <strong>Neon:</strong> لتخزين البيانات بشكل آمن.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          حذف البيانات
        </h2>
        <p>
          يمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا على البريد
          الإلكتروني أدناه.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          التواصل معنا
        </h2>
        <p>
          لأي استفسار بخصوص الخصوصية، يرجى التواصل عبر:{' '}
          <a href="mailto:fat.arrammah@gmail.com" style={{ color: '#8A004F' }}>
            fat.arrammah@gmail.com
          </a>
        </p>
      </section>
    </div>
  );
}
