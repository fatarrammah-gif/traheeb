/**
 * Reminder delivery tracking for confirmed guests.
 *
 * GET  — reminder stats for the event (sent/delivered/read/failed/pending)
 * POST — send reminder_5 template to confirmed guests who haven't been delivered yet
 */
import { authenticate } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';

const GRAPH_API_VERSION = 'v21.0';
const PHONE_NUMBER_ID   = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN      = process.env.META_ACCESS_TOKEN;

/** Normalise any phone format to E.164 digits only (no +, no spaces). */
function normalisePhone(phone) {
  let p = String(phone).replace(/[\s\-().+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '966' + p.slice(1);
  if (p.startsWith('5')  && p.length === 9)  p = '966' + p;
  return p.replace(/[^0-9]/g, '');
}

function extractCoordsFromUrl(url) {
  if (!url) return null;
  const pinMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pinMatch) return { lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]) };
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  return null;
}

function buildLocationSuffix(event) {
  const coords =
    extractCoordsFromUrl(event.location) ||
    (event.map_lat && event.map_lng ? { lat: event.map_lat, lng: event.map_lng } : null);
  return coords ? `?q=${coords.lat},${coords.lng}` : '?q=';
}

/**
 * Send the reminder_5 template via Meta Cloud API.
 * Returns the message_id string on success, or throws.
 */
async function sendReminderTemplate({ phone, time, locationSuffix }) {
  const to = normalisePhone(phone);

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'reminder_5',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(time ?? '-') }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: locationSuffix }],
        },
      ],
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error('[Reminders] Meta error:', JSON.stringify(json));
    throw new Error(`Meta API error (${res.status}): ${json?.error?.message ?? JSON.stringify(json)}`);
  }

  const messageId = json.messages?.[0]?.id ?? null;
  console.log(`[Reminders] sent to ${to} message_id=${messageId}`);
  return messageId;
}

// ── GET — reminder stats ─────────────────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const { user } = await authenticate(request);
    const { id: eventId } = await params;

    // Verify organizer owns the event
    const [event] = await sql`
      SELECT id FROM traheeb_events WHERE id = ${eventId} AND user_id = ${user.id}
    `;
    if (!event) return Response.json({ error: 'الفعالية غير موجودة' }, { status: 404 });

    // Confirmed guests count
    const [{ confirmed_count }] = await sql`
      SELECT COUNT(*) AS confirmed_count
      FROM traheeb_guests
      WHERE event_id = ${eventId} AND status = 'confirmed'
    `;

    // Reminder records
    const reminders = await sql`
      SELECT r.guest_id, r.phone, r.status, r.sent_at, r.updated_at
      FROM traheeb_reminders r
      WHERE r.event_id = ${eventId}
      ORDER BY r.sent_at DESC
    `;

    // Count by status
    const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const r of reminders) {
      if (counts[r.status] !== undefined) counts[r.status]++;
    }

    const totalReminded = reminders.length;
    const pending = Math.max(0, Number(confirmed_count) - totalReminded);

    return Response.json({
      stats: { ...counts, pending },
      reminders,
    });
  } catch (err) {
    console.error('[Reminders GET]', err.message);
    if (err.message === 'Unauthorized') return Response.json({ error: 'غير مصرح' }, { status: 401 });
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// ── POST — send reminders ────────────────────────────────────────────────────
export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);
    const { id: eventId } = await params;

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return Response.json({ error: 'Meta API غير مهيأ' }, { status: 500 });
    }

    // Verify organizer owns the event
    const events = await sql`
      SELECT id, time, location, map_lat, map_lng
      FROM traheeb_events
      WHERE id = ${eventId} AND user_id = ${user.id}
    `;
    if (!events.length) return Response.json({ error: 'الفعالية غير موجودة' }, { status: 404 });
    const event = events[0];

    // All confirmed guests
    const confirmedGuests = await sql`
      SELECT id, phone FROM traheeb_guests
      WHERE event_id = ${eventId} AND status = 'confirmed'
    `;

    if (!confirmedGuests.length) {
      return Response.json({ sent: 0, skipped: 0, message: 'لا يوجد ضيوف مؤكدون' });
    }

    // Existing reminder records for this event
    const existingReminders = await sql`
      SELECT guest_id, status FROM traheeb_reminders WHERE event_id = ${eventId}
    `;
    const reminderMap = new Map(existingReminders.map(r => [r.guest_id, r.status]));

    // Determine who to send to:
    // - no record yet (first time), OR
    // - status is 'sent' or 'failed' (not yet confirmed delivered/read)
    const toSend = confirmedGuests.filter(g => {
      const status = reminderMap.get(g.id);
      return status === undefined || status === 'sent' || status === 'failed';
    });

    const skipped = confirmedGuests.length - toSend.length;
    const locationSuffix = buildLocationSuffix(event);
    const time = event.time ? String(event.time).slice(0, 5) : '-';

    let sent = 0;
    for (const guest of toSend) {
      try {
        const messageId = await sendReminderTemplate({
          phone: guest.phone,
          time,
          locationSuffix,
        });

        // Upsert reminder record
        await sql`
          INSERT INTO traheeb_reminders (event_id, guest_id, phone, message_id, status)
          VALUES (${eventId}, ${guest.id}, ${guest.phone}, ${messageId}, 'sent')
          ON CONFLICT (event_id, guest_id)
          DO UPDATE SET message_id = ${messageId}, status = 'sent', sent_at = now(), updated_at = now()
        `;
        sent++;
      } catch (err) {
        console.error(`[Reminders] failed for guest ${guest.id}:`, err.message);

        // Record failure
        await sql`
          INSERT INTO traheeb_reminders (event_id, guest_id, phone, message_id, status)
          VALUES (${eventId}, ${guest.id}, ${guest.phone}, NULL, 'failed')
          ON CONFLICT (event_id, guest_id)
          DO UPDATE SET status = 'failed', updated_at = now()
        `.catch(() => {});
      }
    }

    return Response.json({ sent, skipped });
  } catch (err) {
    console.error('[Reminders POST]', err.message);
    if (err.message === 'Unauthorized') return Response.json({ error: 'غير مصرح' }, { status: 401 });
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
