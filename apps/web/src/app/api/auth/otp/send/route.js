/**
 * POST /api/auth/otp/send
 * Body: { phone: "+966XXXXXXXXX" }
 *
 * Generates a 6-digit OTP, stores it in traheeb_otp_codes with 5-min expiry,
 * and sends it via Twilio WhatsApp.
 */
import sql from '../../../utils/sql.js';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = (body.phone ?? '').trim();

    if (!phone || !/^\+?[0-9]{8,15}$/.test(phone.replace(/\s/g, ''))) {
      return Response.json({ error: 'رقم الجوال غير صحيح' }, { status: 400 });
    }

    // Generate OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Invalidate previous unused OTPs for this phone
    await sql`
      UPDATE traheeb_otp_codes
      SET used = true
      WHERE phone = ${phone} AND used = false
    `;

    // Insert new OTP
    await sql`
      INSERT INTO traheeb_otp_codes (phone, code, expires_at)
      VALUES (${phone}, ${code}, ${expiresAt.toISOString()})
    `;

    // Send via Twilio WhatsApp
    if (process.env.TWILIO_ACCOUNT_SID) {
      try {
        await twilioClient.messages.create({
          from: FROM,
          to: `whatsapp:${phone}`,
          body: `رمز التحقق الخاص بك في تراحيب: *${code}*\nصالح لمدة 5 دقائق.`,
        });
      } catch (twilioErr) {
        // Log but don't fail — fallback to console so dev can still test
        console.error('[Twilio]', twilioErr.message);
        console.log(`[OTP fallback] ${phone} → ${code}`);
      }
    } else {
      console.log(`[OTP] ${phone} → ${code} (TWILIO_ACCOUNT_SID not set)`);
    }

    return Response.json({ success: true, expiresIn: 300 });
  } catch (err) {
    console.error('[OTP send]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
