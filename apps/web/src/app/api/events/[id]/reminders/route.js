/**
 * Reminder delivery tracking for confirmed guests.
 *
 * GET  — reminder stats for the event (sent/failed/pending)
 * POST — send Arabic reminder via organizer's WhatsApp session (whatsapp-web.js)
 */
import { authenticate } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';
import { sendText } from '../../../../../services/whatsapp/sender.js';

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function extractCoordsFromUrl(url) {
  if (!url) return null;
  const pinMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pinMatch) return { lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]) };
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

function buildLocationUrl(event) {
  const coords =
    extractCoordsFromUrl(event.location) ||
    (event.map_lat && event.map_lng ? { lat: event.map_lat, lng: event.map_lng } : null);
  if (coords) return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  const query = [event.venue, event.location].filter(Boolean).join(' ');
  return query ? `https://www.google.com/maps/search/${encodeURIComponent(query)}` : null;
}

function formatTimeArabic(timeStr) {
  if (!timeStr) return '-';
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number);
  const period = h >= 12 ? 'مساءً' : 'صباحاً';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function buildReminderText(event) {
  const time = formatTimeArabic(event.time);

  let dayName = '';
  if (event.date) {
    const d = new Date(event.date);
    dayName = ARABIC_DAYS[d.getUTCDay()];
  }

  const locationUrl = buildLocationUrl(event);

  let text =
    `نذكركم بموعد ${event.name} اليوم ${dayName} عند الساعة ${time}، ` +
    `ويسعدنا حضوركم ومشاركتكم هذه المناسبة المميزة.`;

  if (locationUrl) {
    text += `\n\n📍 *موقع الفعالية:*\n${locationUrl}`;
  }

  return text;
}

// ── GET — reminder stats ─────────────────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const { user } = await authenticate(request);
    const { id: eventId } = await params;

    const [event] = await sql`
      SELECT id FROM traheeb_events WHERE id = ${eventId} AND user_id = ${user.id}
    `;
    if (!event) return Response.json({ error: 'الفعالية غير موجودة' }, { status: 404 });

    const [{ confirmed_count }] = await sql`
      SELECT COUNT(*) AS confirmed_count
      FROM traheeb_guests
      WHERE event_id = ${eventId} AND status = 'confirmed'
    `;

    const reminders = await sql`
      SELECT r.guest_id, r.phone, r.status, r.sent_at, r.updated_at
      FROM traheeb_reminders r
      WHERE r.event_id = ${eventId}
      ORDER BY r.sent_at DESC
    `;

    const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const r of reminders) {
      if (counts[r.status] !== undefined) counts[r.status]++;
    }

    const pending = Math.max(0, Number(confirmed_count) - reminders.length);

    return Response.json({ stats: { ...counts, pending }, reminders });
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

    const events = await sql`
      SELECT id, name, date, time, location, venue, map_lat, map_lng
      FROM traheeb_events
      WHERE id = ${eventId} AND user_id = ${user.id}
    `;
    if (!events.length) return Response.json({ error: 'الفعالية غير موجودة' }, { status: 404 });
    const event = events[0];

    const confirmedGuests = await sql`
      SELECT id, phone FROM traheeb_guests
      WHERE event_id = ${eventId} AND status = 'confirmed'
    `;

    if (!confirmedGuests.length) {
      return Response.json({ sent: 0, skipped: 0, message: 'لا يوجد ضيوف مؤكدون' });
    }

    const existingReminders = await sql`
      SELECT guest_id, status FROM traheeb_reminders WHERE event_id = ${eventId}
    `;
    const reminderMap = new Map(existingReminders.map(r => [r.guest_id, r.status]));

    // Skip guests already delivered or read; resend to sent/failed
    const toSend = confirmedGuests.filter(g => {
      const status = reminderMap.get(g.id);
      return status === undefined || status === 'sent' || status === 'failed';
    });

    const skipped = confirmedGuests.length - toSend.length;
    const messageText = buildReminderText(event);

    let sent = 0;
    for (const guest of toSend) {
      try {
        await sendText(user.id, guest.phone, messageText);

        await sql`
          INSERT INTO traheeb_reminders (event_id, guest_id, phone, message_id, status)
          VALUES (${eventId}, ${guest.id}, ${guest.phone}, NULL, 'sent')
          ON CONFLICT (event_id, guest_id)
          DO UPDATE SET message_id = NULL, status = 'sent', sent_at = now(), updated_at = now()
        `;
        sent++;
      } catch (err) {
        console.error(`[Reminders] failed for guest ${guest.id}:`, err.message);

        await sql`
          INSERT INTO traheeb_reminders (event_id, guest_id, phone, message_id, status)
          VALUES (${eventId}, ${guest.id}, ${guest.phone}, NULL, 'failed')
          ON CONFLICT (event_id, guest_id)
          DO UPDATE SET status = 'failed', updated_at = now()
        `.catch(() => {});
      }

      // Small delay to avoid WhatsApp rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    return Response.json({ sent, skipped });
  } catch (err) {
    console.error('[Reminders POST]', err.message);
    if (err.message === 'Unauthorized') return Response.json({ error: 'غير مصرح' }, { status: 401 });
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
