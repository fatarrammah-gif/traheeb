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
import { generateQRCard } from './generator.js';
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
      SELECT id, name, date, time, event_logo_url, qr_background_url
      FROM traheeb_events WHERE id = ${guest.event_id} LIMIT 1
    `;
    if (!event) { console.error(`[QR] event not found: ${guest.event_id}`); return; }
    console.log(`[QR] event="${event.name}" logo=${!!event.event_logo_url} bg=${!!event.qr_background_url}`);

    // Fetch image buffers in parallel
    const [logoBuffer, bgBuffer] = await Promise.all([
      fetchBuffer(event.event_logo_url),
      fetchBuffer(event.qr_background_url),
    ]);
    console.log(`[QR] images fetched logo=${logoBuffer?.length ?? 0}B bg=${bgBuffer?.length ?? 0}B`);

    const companions = Math.max(0, guest.companions ?? 0);

    // Create main token in DB (for door-scan tracking) but do NOT send an image
    const mainToken = crypto.randomBytes(16).toString('hex');
    await sql`
      INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
      VALUES (${guest.id}, ${guest.event_id}, ${mainToken}, 'main')
    `;
    console.log(`[QR] main token saved (no image sent)`);

    // Send QR images only for companions
    const labels = Array.from({ length: companions }, (_, i) => `companion-${i + 1}`);
    console.log(`[QR] will send ${labels.length} companion card(s): ${labels.join(', ') || '(none)'}`);

    for (const label of labels) {
      try {
        const token = crypto.randomBytes(16).toString('hex'); // 32-char hex

        // Save token to DB
        const [qt] = await sql`
          INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
          VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
          RETURNING id
        `;
        console.log(`[QR] token saved id=${qt.id} label=${label}`);

        // Generate card image
        const cardBuffer = await generateQRCard({
          token, label,
          eventName: event.name,
          eventDate: event.date,
          eventTime: event.time,
          bgBuffer,
          logoBuffer,
        });

        // Upload to ImgBB
        const imageUrl = await uploadToImgBB(cardBuffer);
        console.log(`[QR] uploaded label=${label} url=${imageUrl}`);

        // Save URL to DB
        await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${qt.id}`;

        // Wait for ImgBB CDN to propagate before Meta fetches it
        await waitForUrl(imageUrl);

        // Send image via Meta
        await sendQRTemplate({ phone: guest.phone, imageUrl });
        console.log(`[QR] sent label=${label} to ${guest.phone}`);

        await sleep(1500); // stay within Meta rate limits
      } catch (err) {
        console.error(`[QR] FAILED label=${label}:`, err.message);
      }
    }

    console.log(`[QR] ── done guest=${guest.id} cards=${labels.length}`);
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
