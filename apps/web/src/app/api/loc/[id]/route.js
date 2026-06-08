/**
 * GET /api/loc/[id] — public redirect to Google Maps for an event location.
 *
 * Used as a clean short link inside WhatsApp invitation messages instead of
 * exposing a raw long Google Maps URL.  The guest taps the link → their browser
 * opens for a moment → immediately jumps into Google Maps / the Maps app.
 */
import sql from '../../utils/sql.js';

export async function GET(_request, { params }) {
  try {
    const rows = await sql`
      SELECT map_lat, map_lng, venue, location
      FROM traheeb_events
      WHERE id = ${params.id}
      LIMIT 1
    `;

    if (!rows.length) {
      return new Response('الفعالية غير موجودة', { status: 404 });
    }

    const event = rows[0];
    let mapsUrl;

    if (event.map_lat && event.map_lng) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${event.map_lat},${event.map_lng}`;
    } else {
      const query = [event.venue, event.location].filter(Boolean).join(' ');
      mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    }

    console.log(`[loc] redirect event=${params.id} → ${mapsUrl}`);
    return Response.redirect(mapsUrl, 302);
  } catch (err) {
    console.error('[loc redirect]', err);
    return new Response('حدث خطأ', { status: 500 });
  }
}
