/**
 * POST /api/auth/otp/verify
 * Body: { phone, code, name? }
 *
 * Validates the OTP, upserts auth_users + traheeb_users, returns a signed JWT.
 */
import { encode } from '@auth/core/jwt';
import sql from '../../../utils/sql.js';

const SALT = 'authjs.session-token';
const JWT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function phoneToEmail(phone) {
  // Use a synthetic email so Auth.js adapter is happy
  return `${phone.replace(/[^0-9]/g, '')}@phone.traheeb`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = (body.phone ?? '').trim();
    const code  = (body.code  ?? '').trim();
    const name  = (body.name  ?? '').trim() || 'مستخدم تراحيب';

    if (!phone || !code) {
      return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Validate OTP
    const otpRows = await sql`
      SELECT id FROM traheeb_otp_codes
      WHERE phone = ${phone}
        AND code  = ${code}
        AND used  = false
        AND expires_at > now()
      LIMIT 1
    `;

    if (!otpRows.length) {
      return Response.json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }, { status: 400 });
    }

    // Mark OTP as used
    await sql`UPDATE traheeb_otp_codes SET used = true WHERE id = ${otpRows[0].id}`;

    const email = phoneToEmail(phone);

    // Upsert auth_users (using Auth.js table directly)
    const authRows = await sql`
      SELECT id, name FROM auth_users WHERE email = ${email} LIMIT 1
    `;

    let authId;
    let userName;

    if (authRows.length) {
      authId   = authRows[0].id;
      userName = authRows[0].name ?? name;
    } else {
      const inserted = await sql`
        INSERT INTO auth_users (email, name, "emailVerified")
        VALUES (${email}, ${name}, now())
        RETURNING id, name
      `;
      authId   = inserted[0].id;
      userName = inserted[0].name;
    }

    // Upsert traheeb_users
    const userRows = await sql`
      SELECT id FROM traheeb_users WHERE auth_id = ${authId} LIMIT 1
    `;

    let userId;
    if (userRows.length) {
      userId = userRows[0].id;
    } else {
      const inserted = await sql`
        INSERT INTO traheeb_users (auth_id, name, phone)
        VALUES (${authId}, ${userName}, ${phone})
        RETURNING id
      `;
      userId = inserted[0].id;
    }

    // Sign JWT (same mechanism as Auth.js so mobile fetch.ts works)
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET not set');

    const jwt = await encode({
      token: {
        sub:   authId,
        email,
        name:  userName,
        phone,
        traheebUserId: userId,
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
