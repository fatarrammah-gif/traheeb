/**
 * POST /api/auth/staff-verify
 * Body: { phone, code, eventId }
 *
 * Verifies OTP via Twilio, checks staff is registered for event,
 * returns a staff-scoped JWT with { sub, phone, role: 'staff', eventId }.
 */
import { encode } from '@auth/core/jwt';
import twilio from 'twilio';
import sql from '../../utils/sql.js';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const STAFF_SALT = 'traheeb.staff-token';
const JWT_MAX_AGE = 12 * 60 * 60; // 12 hours

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
    const code = (body.code ?? '').trim();
    const eventId = (body.eventId ?? '').trim();

    if (!phone || !code || !eventId) {
      return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Verify OTP via Twilio
    const check = await client.verify.v2
      .services(SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (check.status !== 'approved') {
      return Response.json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }, { status: 400 });
    }

    // Check staff is registered for this event
    const staffRows = await sql`
      SELECT es.id, es.name, es.phone, es.event_id
      FROM traheeb_event_staff es
      WHERE es.event_id = ${eventId}
        AND (
          es.phone = ${phone}
          OR RIGHT(es.phone, 9) = RIGHT(${phone}, 9)
        )
      LIMIT 1
    `;

    if (!staffRows.length) {
      return Response.json({ error: 'غير مصرح لك بالدخول لهذه الفعالية' }, { status: 403 });
    }

    // Get or create a traheeb_users row for this phone
    let userId;
    const userRows = await sql`
      SELECT id FROM traheeb_users WHERE phone = ${phone} LIMIT 1
    `;
    if (userRows.length) {
      userId = userRows[0].id;
    } else {
      const inserted = await sql`
        INSERT INTO traheeb_users (name, phone)
        VALUES (${staffRows[0].name ?? 'فريق تراحيب'}, ${phone})
        RETURNING id
      `;
      userId = inserted[0].id;
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET not set');

    const jwt = await encode({
      token: {
        sub: userId,
        phone,
        role: 'staff',
        eventId,
      },
      secret,
      salt: STAFF_SALT,
      maxAge: JWT_MAX_AGE,
    });

    return Response.json({ jwt });
  } catch (err) {
    console.error('[staff-verify]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
