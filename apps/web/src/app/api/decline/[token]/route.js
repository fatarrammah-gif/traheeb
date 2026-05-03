/**
 * GET /api/decline/[token]
 * Public — marks guest as declined and redirects to decline confirmation page.
 */
import sql from '../../utils/sql.js';

const BASE_URL = process.env.BASE_URL || 'https://traheeb.com';

export async function GET(request, { params }) {
  try {
    const rows = await sql`
      SELECT id, status FROM traheeb_guests
      WHERE invitation_token = ${params.token}
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.redirect(`${BASE_URL}/decline/${params.token}?result=not_found`);
    }

    const guest = rows[0];

    if (guest.status !== 'invited') {
      // Already responded — just redirect
      return Response.redirect(`${BASE_URL}/decline/${params.token}?result=success`);
    }

    await sql`
      UPDATE traheeb_guests
      SET status = 'declined', responded_at = now()
      WHERE id = ${guest.id}
    `;

    return Response.redirect(`${BASE_URL}/decline/${params.token}?result=success`);
  } catch (err) {
    console.error('[GET decline/token]', err);
    return Response.redirect(`${BASE_URL}/decline/${params.token}?result=error`);
  }
}
