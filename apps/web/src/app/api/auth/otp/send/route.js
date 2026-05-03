/**
 * POST /api/auth/otp/send
 * Body: { phone: "+966XXXXXXXXX" }
 *
 * Generates a 6-digit OTP, stores it in traheeb_otp_codes with 5-min expiry,
 * and sends it via the Traheeb system WhatsApp bot account.
 */
import sql from '../../../utils/sql.js';
import { sendText } from '../../../../../services/whatsapp/sender.js';
import { isConnected } from '../../../../../services/whatsapp/SessionManager.js';
import { otpMessage } from '../../../../../services/whatsapp/templates.js';

const SYSTEM_USER_ID = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';

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

    // Send via WhatsApp bot
    if (isConnected(SYSTEM_USER_ID)) {
      await sendText(SYSTEM_USER_ID, phone, otpMessage(code));
    } else {
      // Fallback: log to console (for dev/testing)
      console.log(`[OTP] ${phone} → ${code} (WhatsApp bot not connected)`);
    }

    return Response.json({ success: true, expiresIn: 300 });
  } catch (err) {
    console.error('[OTP send]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
