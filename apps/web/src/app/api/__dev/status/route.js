/**
 * GET /api/__dev/status
 * Local development dashboard data — shows OTPs, users, events, WhatsApp status.
 */
import sql from '../../utils/sql.js';
import { isConnected } from '../../../../services/whatsapp/SessionManager.js';

export async function GET() {
  try {
    const [otps, users, events, userCount, eventCount, sessions] = await Promise.all([
      sql`SELECT phone, code, expires_at, used FROM traheeb_otp_codes ORDER BY created_at DESC LIMIT 10`,
      sql`SELECT name, phone FROM traheeb_users ORDER BY created_at DESC LIMIT 10`,
      sql`SELECT name, date FROM traheeb_events ORDER BY created_at DESC LIMIT 10`,
      sql`SELECT COUNT(*)::int AS count FROM traheeb_users`,
      sql`SELECT COUNT(*)::int AS count FROM traheeb_events`,
      sql`SELECT user_id, connected FROM traheeb_whatsapp_sessions`,
    ]);

    const botUserId = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';

    return Response.json({
      dbOk: true,
      botConnected: isConnected(botUserId),
      userCount: userCount[0]?.count ?? 0,
      eventCount: eventCount[0]?.count ?? 0,
      otps,
      users,
      events,
      sessions,
    });
  } catch (err) {
    console.error('[dev status]', err);
    return Response.json({ dbOk: false, error: err.message }, { status: 500 });
  }
}
