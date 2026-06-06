/**
 * POST /api/auth/otp/send
 * Body: { phone: "+966XXXXXXXXX" }
 *
 * Sends a 6-digit OTP via Twilio Verify (SMS).
 * Twilio handles code generation, storage, expiry, and delivery.
 */
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

/** Normalize to E.164: strip spaces/dashes, add +966 for Saudi local numbers */
function normalizePhone(raw) {
  let p = (raw ?? '').trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '+966' + p.slice(1);
  if (p.startsWith('5')  && p.length === 9)  p = '+966' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);

    if (!phone || !/^\+[0-9]{8,15}$/.test(phone)) {
      return Response.json({ error: 'رقم الجوال غير صحيح' }, { status: 400 });
    }

    console.log(`[OTP send] to=${phone} sid=${SERVICE_SID?.slice(0,10)}…`);

    const verification = await client.verify.v2.services(SERVICE_SID).verifications.create({
      to: phone,
      channel: 'sms',
    });

    console.log(`[OTP send] status=${verification.status} to=${phone}`);
    return Response.json({ success: true, expiresIn: 300 });
  } catch (err) {
    console.error('[OTP send]', err.message);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
