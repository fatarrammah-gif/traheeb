/**
 * POST /api/auth/staff-otp-send
 * Body: { phone, eventId }
 *
 * Checks that the phone is registered as staff for the event BEFORE
 * sending an OTP. Unregistered numbers get a 403 and no SMS is sent.
 */
import twilio from 'twilio';
import sql from '../../utils/sql.js';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

function normalizePhone(raw) {
  let p = (raw ?? '').trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '+966' + p.slice(1);
  if (p.startsWith('5') && p.length === 9) p = '+966' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const eventId = (body.eventId ?? '').trim();

    if (!phone || !eventId) {
      return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    if (!/^\+[0-9]{8,15}$/.test(phone)) {
      return Response.json({ error: 'رقم الجوال غير صحيح' }, { status: 400 });
    }

    // Check staff membership BEFORE sending OTP
    const rows = await sql`
      SELECT 1 FROM traheeb_event_staff
      WHERE event_id = ${eventId}
        AND (
          phone = ${phone}
          OR RIGHT(phone, 9) = RIGHT(${phone}, 9)
        )
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.json({ error: 'رقم الجوال غير مسجل في فريق هذه الفعالية' }, { status: 403 });
    }

    // Staff verified — now send OTP
    await client.verify.v2.services(SERVICE_SID).verifications.create({
      to: phone,
      channel: 'sms',
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('[staff-otp-send]', err.message);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
