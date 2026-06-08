/**
 * Arabic WhatsApp message templates.
 */

/** OTP verification code sent from the Traheeb bot account. */
export function otpMessage(code) {
  return (
    `🔐 *تراحيب — رمز التحقق*\n\n` +
    `رمز التحقق الخاص بك هو:\n\n` +
    `*${code}*\n\n` +
    `صالح لمدة ٥ دقائق. لا تشاركه مع أحد.`
  );
}

/** Sent to the organizer when their event is created. */
export function eventCreatedMessage(event) {
  return (
    `✅ *تم إنشاء الفعالية بنجاح!*\n\n` +
    `📋 *${event.name}*\n` +
    `📅 ${event.date}  |  🕐 ${event.time}\n` +
    `📍 ${event.venue}${event.location ? `، ${event.location}` : ''}\n` +
    `👥 السعة: ${event.capacity} مقعد\n\n` +
    `يمكنك الآن إرسال الدعوات من تطبيق تراحيب 🎉`
  );
}

/** Sent to each invitee when they are invited. */
export function invitationMessage({ guestName, invitationText, event, companions, locationLink, invitationToken, baseUrl }) {
  const companionsLine = companions > 0
    ? `👥 المرافقون: ${companions} ${companions === 1 ? 'شخص' : 'أشخاص'}\n`
    : '';

  const base = (baseUrl || process.env.BASE_URL || 'https://traheeb-production.up.railway.app').replace(/\/$/, '');
  const confirmUrl = `${base}/api/confirm/${invitationToken}`;
  const declineUrl = `${base}/api/decline/${invitationToken}`;

  return (
    `المكرم ${guestName}\n\n` +
    `${invitationText || ''}\n\n` +
    `📅 التاريخ: ${event.date}\n` +
    `🕐 الوقت: ${event.time}\n` +
    `📍 المكان: ${event.venue}\n` +
    companionsLine +
    `\n🗺 رجاء اضغط هنا للحصول على الموقع:\n${locationLink}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✅ تأكيد الحضور:\n${confirmUrl}\n\n` +
    `❌ الاعتذار:\n${declineUrl}\n\n` +
    `أو أرسل *نعم* 👍 للتأكيد، *لا* 👎 للاعتذار`
  );
}

/** Sent to the guest after they confirm attendance, with their QR info. */
export function qrConfirmationMessage({ guestName, eventName, label }) {
  const isMain = label === 'main';
  const labelText = isMain ? 'تذكرتك الشخصية' : `تذكرة ${label.replace('companion-', 'المرافق ')}`;
  return (
    `🎟 *${labelText}*\n` +
    `${guestName} — ${eventName}\n\n` +
    `يُرجى تقديم هذا الرمز عند الدخول.\n` +
    `⚠️ الرمز صالح للاستخدام مرة واحدة فقط.`
  );
}

/** Shown by the QR scanner on valid scan. */
export function scanValidMessage({ guestName, label, companions }) {
  const labelText = label === 'main'
    ? 'الضيف الرئيسي'
    : `مرافق رقم ${label.replace('companion-', '')}`;
  const compLine = companions > 0 && label === 'main'
    ? ` (${companions} مرافق)`
    : '';
  return `✅ مسموح بالدخول\n${guestName}${compLine}\n${labelText}`;
}
