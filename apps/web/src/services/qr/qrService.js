/**
 * QR Service — full pipeline triggered after a guest confirms attendance.
 *
 * For each card (main + one per companion):
 *   1. Generate a unique 32-char hex token
 *   2. Insert into traheeb_qr_tokens
 *   3. Build styled PNG card via generator
 *   4. Upload PNG to ImgBB → get public URL
 *   5. Save URL to traheeb_qr_tokens.qr_url
 *   6. Send image to guest via Meta WhatsApp Cloud API
 */
import crypto from 'crypto';
import sql from '../../app/api/utils/sql.js';
import { generateQRCard, generateQROnInvitation } from './generator.js';
import { sendQRTemplate } from '../whatsapp/metaSender.js';

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

/**
 * Entry point — fire-and-forget from the webhook handler.
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

    const isOverlay = event.qr_placement === 'overlay';

    // Fetch image buffers in parallel
    const [logoBuffer, bgBuffer, invitationBuffer] = await Promise.all([
      fetchBuffer(event.event_logo_url),
      isOverlay ? Promise.resolve(null) : fetchBuffer(event.qr_background_url),
      isOverlay ? fetchBuffer(event.invitation_media_url) : Promise.resolve(null),
    ]);
    console.log(`[QR] images fetched logo=${logoBuffer?.length ?? 0}B bg=${bgBuffer?.length ?? 0}B invitation=${invitationBuffer?.length ?? 0}B`);

    const companions = Math.max(0, guest.companions ?? 0);

    if (isOverlay && invitationBuffer) {
      // ── Overlay mode: ONE token per guest, scannable companions+1 times ──────
      const maxScans = companions + 1;
      const token = crypto.randomBytes(16).toString('hex');

      const [qt] = await sql`
        INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label, max_scans)
        VALUES (${guest.id}, ${guest.event_id}, ${token}, 'main', ${maxScans})
        RETURNING id
      `;
      console.log(`[QR] overlay token saved id=${qt.id} max_scans=${maxScans}`);

      const cardBuffer = await generateQROnInvitation({ token, label: 'main', invitationBuffer, logoBuffer });
      const imageUrl = await uploadToImgBB(cardBuffer);
      console.log(`[QR] overlay uploaded url=${imageUrl}`);

      await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${qt.id}`;
      await waitForUrl(imageUrl);
      await sendQRTemplate({ phone: guest.phone, imageUrl });
      console.log(`[QR] overlay sent to ${guest.phone} max_scans=${maxScans}`);

    } else {
      // ── Card mode: main token (no image) + one card per companion ────────────
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
