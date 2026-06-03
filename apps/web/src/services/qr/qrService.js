/**
 * QR Service
 *
 * Orchestrates the full QR card flow triggered after a guest confirms:
 *  1. Generate 1 + companions QR tokens
 *  2. Build card images (styled PNG)
 *  3. Upload each card to ImgBB
 *  4. Store token + qr_url in traheeb_qr_tokens
 *  5. Send each image to the guest via Meta WhatsApp Cloud API
 */
import crypto from 'crypto';
import sql from '../../app/api/utils/sql.js';
import { generateQRCard } from './generator.js';
import { sendImageMessage } from '../whatsapp/metaSender.js';

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const IMGBB_UPLOAD  = 'https://api.imgbb.com/1/upload';

/**
 * Call this after a guest's status is set to 'confirmed'.
 * Runs entirely asynchronously — caller should fire-and-forget.
 *
 * @param {{ id, phone, event_id, companions }} guest
 */
export async function generateAndSendQRCards(guest) {
  try {
    console.log(`[QR] starting for guest=${guest.id} companions=${guest.companions}`);

    // 1. Load event details
    const [event] = await sql`
      SELECT id, name, date, time, event_logo_url, qr_background_url
      FROM traheeb_events
      WHERE id = ${guest.event_id}
      LIMIT 1
    `;
    if (!event) {
      console.error('[QR] event not found:', guest.event_id);
      return;
    }

    // 2. Fetch image buffers (logo + QR background)
    const [logoBuffer, bgBuffer] = await Promise.all([
      fetchBuffer(event.event_logo_url),
      fetchBuffer(event.qr_background_url),
    ]);

    // 3. Build label list: main + one per companion
    const companions = Math.max(0, guest.companions ?? 0);
    const labels = [
      'main',
      ...Array.from({ length: companions }, (_, i) => `companion-${i + 1}`),
    ];

    // 4. Generate, upload and send each card
    for (const label of labels) {
      try {
        const token = crypto.randomBytes(16).toString('hex'); // 32-char hex

        // Insert QR token record first (so we have an id)
        const [qt] = await sql`
          INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
          VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
          RETURNING id
        `;

        // Generate card image
        const cardBuffer = await generateQRCard({
          token,
          label,
          eventName: event.name,
          eventDate: event.date,
          eventTime: event.time,
          bgBuffer,
          logoBuffer,
        });

        // Upload to ImgBB
        const imageUrl = await uploadToImgBB(cardBuffer);
        console.log(`[QR] uploaded label=${label} url=${imageUrl}`);

        // Save URL back to DB
        await sql`
          UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${qt.id}
        `;

        // Caption for the WhatsApp image message
        const caption = label === 'main'
          ? 'بطاقة الضيف الرئيسي 🎫'
          : `بطاقة المرافق ${label.replace('companion-', '')} 🎫`;

        // Send the card image via Meta
        await sendImageMessage({ phone: guest.phone, imageUrl, caption });
        console.log(`[QR] sent label=${label} to ${guest.phone}`);

        // Small delay between messages to stay within Meta rate limits
        await delay(600);
      } catch (cardErr) {
        console.error(`[QR] failed for label=${label}:`, cardErr.message);
      }
    }

    console.log(`[QR] done — sent ${labels.length} card(s) to guest=${guest.id}`);
  } catch (err) {
    console.error('[QR] generateAndSendQRCards error:', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function uploadToImgBB(buffer) {
  if (!IMGBB_API_KEY) throw new Error('IMGBB_API_KEY env var not set');
  const form = new FormData();
  form.append('key', IMGBB_API_KEY);
  form.append('image', buffer.toString('base64'));
  const res = await fetch(IMGBB_UPLOAD, { method: 'POST', body: form });
  const json = await res.json();
  if (!json.success) throw new Error('ImgBB upload failed: ' + JSON.stringify(json.error));
  return json.data.url;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
