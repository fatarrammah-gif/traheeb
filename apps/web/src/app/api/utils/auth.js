import { decode } from '@auth/core/jwt';
import sql from './sql.js';

const SALT = 'authjs.session-token';
const STAFF_SALT = 'traheeb.staff-token';

function authError(message, status = 401) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Extract and verify the JWT from the Authorization: Bearer header.
 * Returns { sub: authUserId } or throws an error with err.status = 401.
 */
export async function requireAuth(request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) throw authError('Unauthorized');

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET not set');

    const decoded = await decode({ token, secret, salt: SALT });
    if (!decoded?.sub) throw new Error('Invalid token payload');
    return { sub: decoded.sub };
  } catch (err) {
    if (err.status) throw err;
    throw authError('Unauthorized');
  }
}

/**
 * Look up the traheeb_users row by id (= JWT sub).
 * Throws 401 if not found.
 */
export async function getUserRecord(userId) {
  const rows = await sql`
    SELECT id, name, phone FROM traheeb_users WHERE id = ${userId} LIMIT 1
  `;
  if (!rows.length) throw authError('User profile not found');
  return rows[0];
}

/**
 * Combined: verify JWT then load user profile. Returns { authId, user }.
 */
export async function authenticate(request) {
  const { sub: authId } = await requireAuth(request);
  const user = await getUserRecord(authId);
  return { authId, user };
}

/**
 * Decode and validate a staff JWT scoped to a specific event.
 * Returns { userId, phone, eventId } or throws 401/403.
 */
export async function authenticateStaff(request, expectedEventId) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw authError('Unauthorized');

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET not set');

    const decoded = await decode({ token, secret, salt: STAFF_SALT });
    if (!decoded?.sub || decoded.role !== 'staff') throw new Error('Not a staff token');
    if (decoded.eventId !== expectedEventId) throw authError('رمز الدخول غير صالح لهذه الفعالية', 403);

    // Verify staff is still registered for this event
    const rows = await sql`
      SELECT 1 FROM traheeb_event_staff
      WHERE event_id = ${expectedEventId} AND phone = ${decoded.phone}
      LIMIT 1
    `;
    if (!rows.length) throw authError('غير مصرح لك بالوصول', 403);

    return { userId: decoded.sub, phone: decoded.phone, eventId: decoded.eventId };
  } catch (err) {
    if (err.status) throw err;
    throw authError('Unauthorized');
  }
}
