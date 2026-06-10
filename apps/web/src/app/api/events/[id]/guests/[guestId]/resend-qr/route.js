/**
 * POST /api/events/[id]/guests/[guestId]/resend-qr
 *
 * Re-issues and re-sends QR cards for any companion slots that are missing.
 * Safe to call multiple times — never duplicates existing tokens.
 */
import crypto from 'crypto';
import { authenticate } from '../../../../../utils/auth.js';
import sql from '../../../../../utils/sql.js';
import { generateQRCard } from '../../../../../../../services/qr/generator.js';
import { isConnected } from '../../../../../../../services/whatsapp/SessionManager.js';
import { sendImages } from '../../../../../../../services/whatsapp/sender.js';
import { sendQRTemplate } from '../../../../../../../services/whatsapp/metaSender.js';
import { qrConfirmationMessage } from '../../../../../../../services/whatsapp/templates.js';

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);

    // Load guest + event (verify ownership)
    const rows = await sql`
      SELECT
        g.*,
        e.name  AS event_name,
        e.date  AS event_date,
        e.time  AS event_time,
        e.event_logo_url,
        e.qr_background_url,
        e.user_id AS organizer_user_id
      FROM traheeb_guests g
      JOIN traheeb_events e ON e.id = g.event_id
      WHERE g.id       = ${params.guestId}
        AND g.event_id = ${params.id}
        AND e.user_id  = ${user.id}
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.json({ error: 'الضيف غير موجود' }, { status: 404 });
    }

    const guest = rows[0];
    const companions = Math.max(0, guest.companions ?? 0);

    if (companions === 0) {
      return Response.json({ message: 'لا يوجد مرافقون لهذا الضيف', issued: 0 });
    }

    // Find which companion labels already have tokens
    const existing = await sql`
      SELECT label FROM traheeb_qr_tokens
      WHERE guest_id = ${guest.id}
        AND label LIKE 'companion-%'
    `;
    const existingLabels = new Set(existing.map((r) => r.label));

    // Determine which are missing
    const missingLabels = [];
    for (let i = 1; i <= companions; i++) {
      const label = `companion-${i}`;
      if (!existingLabels.has(label)) missingLabels.push(label);
    }

    if (missingLabels.length === 0) {
      return Response.json({ message: 'جميع رموز QR مُصدَرة بالفعل', issued: 0 });
    }

    console.log(`[resend-qr] guest=${guest.id} missing=${missingLabels.join(', ')}`);

    // Fire generation + sending in background so request returns fast
    resendMissing(guest, missingLabels).catch((err) =>
      console.error('[resend-qr] background error:', err.message)
    );

    return Response.json({
      success: true,
      message: `جارٍ إرسال ${missingLabels.length} رمز QR مفقود`,
      missing: missingLabels,
    });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST resend-qr]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

async function resendMissing(guest, labels) {
  const [logoBuffer, bgBuffer] = await Promise.all([
    fetchBuffer(guest.event_logo_url),
    fetchBuffer(guest.qr_background_url),
  ]);

  const qrBuffers = [];
  const captions = [];

  for (const label of labels) {
    try {
      const token = crypto.randomBytes(16).toString('hex');

      // Save token
      const [qt] = await sql`
        INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
        VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
        RETURNING id
      `;
      console.log(`[resend-qr] token saved id=${qt.id} label=${label}`);

      // Generate card
      const cardBuffer = await generateQRCard({
        token,
        label,
        eventName: guest.event_name,
        eventDate: guest.event_date,
        eventTime: guest.event_time,
        bgBuffer,
        logoBuffer,
      });

      qrBuffers.push(cardBuffer);
      captions.push(
        qrConfirmationMessage({
          guestName: guest.name,
          eventName: guest.event_name,
          label,
        })
      );

      // Also upload to ImgBB + send via Meta (same as qrService path)
      await sendViaMeta(guest, qt.id, cardBuffer, label);

      await sleep(1500);
    } catch (err) {
      console.error(`[resend-qr] FAILED label=${label}:`, err.message);
    }
  }

  // Also send via organizer's personal WhatsApp session if connected
  if (qrBuffers.length > 0 && isConnected(guest.organizer_user_id)) {
    try {
      await sendImages(guest.organizer_user_id, guest.phone, qrBuffers, captions[0]);
      console.log(`[resend-qr] sent ${qrBuffers.length} image(s) via personal WhatsApp`);
    } catch (err) {
      console.error('[resend-qr] personal WA send error:', err.message);
    }
  }
}

async function sendViaMeta(guest, tokenRowId, cardBuffer, label) {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) { console.warn('[resend-qr] IMGBB_API_KEY not set, skipping Meta send'); return; }

  try {
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', cardBuffer.toString('base64'));
    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error('ImgBB upload failed: ' + JSON.stringify(json.error ?? json));
    const imageUrl = json.data.url;

    // Save URL
    await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${tokenRowId}`;

    // Wait for CDN
    await waitForUrl(imageUrl);

    // Send via Meta
    await sendQRTemplate({ phone: guest.phone, imageUrl });
    console.log(`[resend-qr] Meta send ok label=${label} url=${imageUrl}`);
  } catch (err) {
    console.error(`[resend-qr] Meta send failed label=${label}:`, err.message);
  }
}

async function fetchBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

async function waitForUrl(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch { /* retry */ }
    await sleep(1000);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
