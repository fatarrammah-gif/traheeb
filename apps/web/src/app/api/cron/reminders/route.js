/**
 * GET /api/cron/reminders
 *
 * Called daily by Railway cron. Finds events happening in 24 hours
 * and sends the reminder_6 WhatsApp template to all confirmed guests.
 *
 * Protected by Authorization: Bearer {CRON_SECRET}
 */
import sql from '../../utils/sql.js';
import { sendTextMessage } from '../../../../services/whatsapp/metaSender.js';

const GRAPH_API_VERSION = 'v21.0';
const PHONE_NUMBER_ID   = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN      = process.env.META_ACCESS_TOKEN;
const CRON_SECRET       = process.env.CRON_SECRET;

function normalisePhone(phone) {
  let p = String(phone).replace(/[\s\-().+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '966' + p.slice(1);
  if (p.startsWith('5')  && p.length === 9)  p = '966' + p;
  return p.replace(/[^0-9]/g, '');
}

function extractCoordsFromUrl(url) {
  if (!url) return null;
  // !3d!4d = exact pin (most accurate)
  const pinMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pinMatch) return { lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]) };
  // @ = viewport center (fallback)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  // ?q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

function buildLocationSuffix(event) {
  // Try extracting pin coords from the original stored location URL first
  const fromUrl = extractCoordsFromUrl(event.location);
  if (fromUrl) return `?q=${fromUrl.lat},${fromUrl.lng}`;

  // Fall back to stored lat/lng
  if (event.map_lat && event.map_lng) return `?q=${event.map_lat},${event.map_lng}`;

  // Last resort: venue name search
  const query = [event.venue, event.location].filter(Boolean).join(' ');
  return `?q=${encodeURIComponent(query)}`;
}

async function sendReminder({ phone, time, locationSuffix }) {
  const body = {
    messaging_product: 'whatsapp',
    to: normalisePhone(phone),
    type: 'template',
    template: {
      name: 'reminder_6',
      language: { code: 'ar' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: time || '-' },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: locationSuffix },
          ],
        },
      ],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? JSON.stringify(json));
  return json.messages?.[0]?.id;
}

export async function GET(request) {
  // Auth check
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return Response.json({ error: 'Meta env vars missing' }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const filterPhone = url.searchParams.get('phone') ?? null;

    // Find events happening tomorrow in Saudi Arabia time (UTC+3)
    const nowSaudi = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const tomorrowSaudi = new Date(nowSaudi.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrowSaudi.toISOString().slice(0, 10); // YYYY-MM-DD

    const events = filterPhone
      ? await sql`
          SELECT e.*
          FROM traheeb_events e
          JOIN traheeb_users u ON u.id = e.user_id
          WHERE e.date IS NOT NULL
            AND e.date LIKE ${tomorrowStr + '%'}
            AND RIGHT(u.phone, 9) = RIGHT(${filterPhone}, 9)
        `
      : await sql`
          SELECT *
          FROM traheeb_events
          WHERE date IS NOT NULL
            AND date LIKE ${tomorrowStr + '%'}
        `;

    console.log(`[cron/reminders] found ${events.length} event(s) in 24h window`);

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const event of events) {
      const guests = await sql`
        SELECT phone, name FROM traheeb_guests
        WHERE event_id = ${event.id}
          AND status = 'confirmed'
      `;

      console.log(`[cron/reminders] event="${event.name}" confirmed=${guests.length}`);

      const locationSuffix = buildLocationSuffix(event);
      const time = event.time?.slice(0, 5) ?? '-';

      const coords = extractCoordsFromUrl(event.location)
        || (event.map_lat && event.map_lng ? { lat: event.map_lat, lng: event.map_lng } : null);
      const locationUrl = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : null;

      for (const guest of guests) {
        try {
          await sendReminder({ phone: guest.phone, time, locationSuffix });
          sent++;
          console.log(`[cron/reminders] sent to ${guest.phone}`);

          // Follow-up text with correct location link
          if (locationUrl) {
            await new Promise(r => setTimeout(r, 500));
            await sendTextMessage({ phone: guest.phone, text: `📍 موقع الفعالية:\n${locationUrl}` });
          }
        } catch (err) {
          failed++;
          errors.push({ phone: guest.phone, error: err.message });
          console.error(`[cron/reminders] failed for ${guest.phone}:`, err.message);
        }

        // Respect Meta rate limits
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return Response.json({
      ok: true,
      events: events.length,
      sent,
      failed,
      errors,
    });
  } catch (err) {
    console.error('[cron/reminders]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
