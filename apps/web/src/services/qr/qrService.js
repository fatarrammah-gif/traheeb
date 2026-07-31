/**
 * QR Service — QR token generation and delivery.
 *
 * Two modes:
 *
 * overlay — called at INVITATION time (before confirmation):
 *   generateOverlayQRForGuest(guest, event)
 *   → one token, max_scans = companions+1, QR overlaid on invitation image
 *   → returns ImgBB URL used as header image in the Meta invitation template
 *
 * card — called after guest CONFIRMS attendance:
 *   generateAndSendQRCards(guest)
 *   → main token (no image) + one card per companion, sent via qr_code_tm_3
 */
import crypto from 'crypto';
import sql from '../../app/api/utils/sql.js';
import { generateQRCard, generateQROnInvitation } from './generator.js';
import { sendQRTemplate } from '../whatsapp/metaSender.js';

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

/**
 * Generate a QR token at INVITATION time for overlay mode.
 * One token per guest, scannable companions+1 times.
 * Returns the ImgBB URL of the invitation image with QR overlaid,
 * or null if the invitation image is missing or generation fails.
 *
 * @param {{ id, companions }} guest  — already inserted guest row
 * @param {{ id, event_logo_url, invitation_media_url }} event
 */
export async function generateOverlayQRForGuest(guest, event) {
  console.log(`[QR] overlay generation guest=${guest.id}`);
  try {
    const [logoBuffer, invitationBuffer] = await Promise.all([
      fetchBuffer(event.event_logo_url),
      fetchBuffer(event.invitation_media_url),
    ]);

    const token    = crypto.randomBytes(16).toString('hex');
    const maxScans = Math.max(1, (guest.companions ?? 0) + 1);

    const [qt] = await sql`
      INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label, max_scans)
      VALUES (${guest.id}, ${event.id}, ${token}, 'main', ${maxScans})
      RETURNING id
    `;

    let cardBuffer;
    if (invitationBuffer) {
      // Overlay QR on invitation image
      cardBuffer = await generateQROnInvitation({
        token, label: 'main', invitationBuffer, logoBuffer,
      });
    } else {
      // No invitation image — generate a plain QR card so the template header is satisfied
      console.warn(`[QR] overlay: no invitation image — generating plain QR card`);
      cardBuffer = await generateQRCard({
        token, label: 'main',
        guestName: guest.name || '',
        eventName: event.name || '',
        eventDate: event.date || '',
        eventTime: event.time || '',
        bgBuffer: null,
        logoBuffer,
      });
    }

    const imageUrl = await uploadToImgBB(cardBuffer);
    await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${qt.id}`;

    console.log(`[QR] overlay done guest=${guest.id} max_scans=${maxScans} url=${imageUrl}`);
    return imageUrl;
  } catch (err) {
    console.error(`[QR] overlay failed guest=${guest.id}:`, err.message);
    return null;
  }
}

/**
 * Entry point — fire-and-forget from the webhook handler (card mode only).
 * Skipped automatically when the event uses overlay mode (QR already issued).
 * @param {{ id, phone, event_id, companions }} guest
 */
export async function generateAndSendQRCards(guest) {
  console.log(`[QR] ── start guest=${guest.id} phone=${guest.phone} companions=${guest.companions}`);

  try {
    // Load event
    const [event] = await sql`
      SELECT id, name, date, time, event_logo_url, qr_background_url,
             invitation_media_url, qr_placement
      FROM traheeb_events WHERE id = ${guest.event_id} LIMIT 1
    `;
    if (!event) { console.error(`[QR] event not found: ${guest.event_id}`); return; }
    console.log(`[QR] event="${event.name}" logo=${!!event.event_logo_url} bg=${!!event.qr_background_url} placement=${event.qr_placement}`);

    // Overlay mode: QR was already issued at invitation time — nothing to do here
    if (event.qr_placement === 'overlay') {
      console.log(`[QR] overlay mode — QR already sent with invitation, skipping post-confirm generation`);
      return;
    }

    // ── Card mode: main token (no image) + one card per companion ────────────
    // Fetch image buffers in parallel
    const [logoBuffer, bgBuffer] = await Promise.all([
      fetchBuffer(event.event_logo_url),
      fetchBuffer(event.qr_background_url),
    ]);
    console.log(`[QR] images fetched logo=${logoBuffer?.length ?? 0}B bg=${bgBuffer?.length ?? 0}B`);

    const companions = Math.max(0, guest.companions ?? 0);
    const mainToken = crypto.randomBytes(16).toString('hex');
    await sql`
      INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
      VALUES (${guest.id}, ${guest.event_id}, ${mainToken}, 'main')
    `;
    console.log(`[QR] main token saved (no image sent)`);

    const labels = Array.from({ length: companions }, (_, i) => `companion-${i + 1}`);
    console.log(`[QR] will send ${labels.length} companion card(s): ${labels.join(', ') || '(none)'}`);

    for (const label of labels) {
      try {
        const token = crypto.randomBytes(16).toString('hex');

        const [qt] = await sql`
          INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
          VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
          RETURNING id
        `;
        console.log(`[QR] token saved id=${qt.id} label=${label}`);

        const cardBuffer = await generateQRCard({
          token, label,
          guestName: guest.name || '',
          eventName: event.name,
          eventDate: event.date,
          eventTime: event.time,
          bgBuffer,
          logoBuffer,
        });

        const imageUrl = await uploadToImgBB(cardBuffer);
        console.log(`[QR] uploaded label=${label} url=${imageUrl}`);

        await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${qt.id}`;
        await waitForUrl(imageUrl);
        await sendQRTemplate({ phone: guest.phone, imageUrl });
        console.log(`[QR] sent label=${label} to ${guest.phone}`);

        await sleep(1500);
      } catch (err) {
        console.error(`[QR] FAILED label=${label}:`, err.message);
      }
    }

    console.log(`[QR] ── done guest=${guest.id}`);
  } catch (err) {
    console.error('[QR] fatal error:', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) { console.warn(`[QR] fetchBuffer ${url} → ${res.status}`); return null; }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(`[QR] fetchBuffer failed for ${url}:`, err.message);
    return null;
  }
}

async function uploadToImgBB(buffer) {
  if (!IMGBB_API_KEY) throw new Error('IMGBB_API_KEY env var not set');
  const form = new FormData();
  form.append('key', IMGBB_API_KEY);
  form.append('image', buffer.toString('base64'));
  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const json = await res.json();
  if (!json.success) throw new Error('ImgBB upload failed: ' + JSON.stringify(json.error ?? json));
  return json.data.url;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll URL until it returns 200 (max 10 attempts, 1s apart). */
async function waitForUrl(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        console.log(`[QR] url ready after ${i + 1} attempt(s): ${url}`);
        return;
      }
    } catch {
      // ignore, retry
    }
    await sleep(1000);
  }
  console.warn(`[QR] url not confirmed ready after ${maxAttempts} attempts: ${url}`);
}
