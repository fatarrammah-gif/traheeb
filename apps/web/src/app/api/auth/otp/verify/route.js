/**
 * POST /api/auth/otp/verify
 * Body: { phone, code, name? }
 *
 * Validates the OTP via Twilio Verify, upserts traheeb_users, returns a signed JWT.
 * JWT sub = traheeb_users.id
 */
import { encode } from '@auth/core/jwt';
import twilio from 'twilio';
import sql from '../../../utils/sql.js';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const SALT = 'authjs.session-token';
const JWT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

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
    const code  = (body.code  ?? '').trim();
    const name  = (body.name  ?? '').trim() || 'مستخدم تراحيب';

    if (!phone || !code) {
      return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Validate OTP via Twilio Verify
    const check = await client.verify.v2
      .services(SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (check.status !== 'approved') {
      return Response.json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }, { status: 400 });
    }

    // Upsert traheeb_users directly (no auth_users dependency)
    const userRows = await sql`
      SELECT id, name FROM traheeb_users WHERE phone = ${phone} LIMIT 1
    `;

    let userId;
    let userName;

    if (userRows.length) {
      userId   = userRows[0].id;
      userName = userRows[0].name;
    } else {
      const inserted = await sql`
        INSERT INTO traheeb_users (name, phone)
        VALUES (${name}, ${phone})
        RETURNING id, name
      `;
      userId   = inserted[0].id;
      userName = inserted[0].name;
    }

    // Sign JWT — sub is traheeb_users.id
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET not set');

    const jwt = await encode({
      token: {
        sub:   userId,
        name:  userName,
        phone,
      },
      secret,
      salt: SALT,
      maxAge: JWT_MAX_AGE,
    });

    return Response.json({
      jwt,
      user: { id: userId, name: userName, phone },
    });
  } catch (err) {
    console.error('[OTP verify]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
