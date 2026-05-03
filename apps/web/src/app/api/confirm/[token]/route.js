/**
 * GET /api/confirm/[token]
 * Public — confirms attendance, generates styled QR tokens, sends QR images via WhatsApp,
 * then redirects to /confirm/[token]?result=success.
 */
import sql from '../../utils/sql.js';
import crypto from 'crypto';
import { generateStyledQR } from '../../../../services/qr/generator.js';
import { isConnected } from '../../../../services/whatsapp/SessionManager.js';
import { sendImages } from '../../../../services/whatsapp/sender.js';
import { qrConfirmationMessage } from '../../../../services/whatsapp/templates.js';

const BASE_URL = process.env.BASE_URL || 'https://traheeb.com';

export async function GET(request, { params }) {
  try {
    // Load guest + event
    const rows = await sql`
      SELECT
        g.*, e.name AS event_name, e.event_logo_url,
        e.user_id AS organizer_user_id
      FROM traheeb_guests g
      JOIN traheeb_events e ON e.id = g.event_id
      WHERE g.invitation_token = ${params.token}
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.redirect(`${BASE_URL}/confirm/${params.token}?result=not_found`);
    }

    const guest = rows[0];

    if (guest.status === 'attended') {
      return Response.redirect(`${BASE_URL}/confirm/${params.token}?result=already_attended`);
    }

    if (guest.status === 'confirmed') {
      return Response.redirect(`${BASE_URL}/confirm/${params.token}?result=success`);
    }

    // Mark as confirmed
    await sql`
      UPDATE traheeb_guests
      SET status = 'confirmed', responded_at = now()
      WHERE id = ${guest.id}
    `;

    // Generate QR tokens: 1 for guest + 1 per companion
    const labels = ['main', ...Array.from({ length: guest.companions }, (_, i) => `companion-${i + 1}`)];
    const qrTokens = [];

    for (const label of labels) {
      const token = crypto.randomBytes(16).toString('hex');
      const [qt] = await sql`
        INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
        VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
        RETURNING *
      `;
      qrTokens.push(qt);
    }

    // Generate styled QR PNGs and send to guest via organizer's WhatsApp session (non-blocking)
    generateAndSendQRs(guest, qrTokens).catch(err =>
      console.error('[QR generation/send]', err)
    );

    return Response.redirect(`${BASE_URL}/confirm/${params.token}?result=success`);
  } catch (err) {
    console.error('[GET confirm/token]', err);
    return Response.redirect(`${BASE_URL}/confirm/${params.token}?result=error`);
  }
}

async function generateAndSendQRs(guest, qrTokens) {
  // Fetch logo buffer if available
  let logoBuffer = null;
  if (guest.event_logo_url) {
    try {
      const res = await fetch(guest.event_logo_url);
      if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      // no logo — proceed without
    }
  }

  const qrBuffers = [];
  const captions = [];

  for (const qt of qrTokens) {
    const pngBuffer = await generateStyledQR(qt.token, logoBuffer);
    qrBuffers.push(pngBuffer);
    captions.push(qrConfirmationMessage({
      guestName: guest.name,
      eventName: guest.event_name,
      label: qt.label,
    }));
  }

  // Send to guest via organizer's WhatsApp session
  if (isConnected(guest.organizer_user_id)) {
    await sendImages(guest.organizer_user_id, guest.phone, qrBuffers, captions[0]);
  }
}
