/**
 * POST /api/events/[id]/guests/[guestId]/resend-qr
 *
 * Body (all optional):
 *   { companionNumber: 7 }  → resend that specific companion only (creates new token if missing)
 *   {}                      → resend ALL missing companion tokens
 *
 * Safe to call multiple times — never duplicates tokens for the missing-all path.
 * For specific companion: always regenerates and resends (even if token already exists).
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

    // Parse optional body
    let body = {};
    try { body = await request.json(); } catch { /* no body */ }
    const { companionNumber } = body;

    // ── Mode 1: resend a specific companion number ────────────────────────────
    if (companionNumber != null) {
      const num = parseInt(companionNumber, 10);
      if (!Number.isInteger(num) || num < 1 || num > companions) {
        return Response.json(
          { error: `رقم المرافق يجب أن يكون بين 1 و ${companions}` },
          { status: 400 }
        );
      }

      const label = `companion-${num}`;

      // Check if a token already exists for this label
      const existingRows = await sql`
        SELECT id, token FROM traheeb_qr_tokens
        WHERE guest_id = ${guest.id} AND label = ${label}
        LIMIT 1
      `;

      if (!existingRows.length) {
        return Response.json(
          { error: `رمز QR للمرافق رقم ${num} غير موجود في النظام` },
          { status: 404 }
        );
      }

      const tokenValue = existingRows[0].token;
      const tokenRowId = existingRows[0].id;
      console.log(`[resend-qr] reusing existing token id=${tokenRowId} label=${label}`);

      // Fire in background
      resendSpecific(guest, { id: tokenRowId, token: tokenValue, label }).catch((err) =>
        console.error('[resend-qr] background error:', err.message)
      );

      return Response.json({
        success: true,
        message: `جارٍ إعادة إرسال رمز QR للمرافق رقم ${num}`,
        label,
      });
    }

    // ── Mode 2: resend all missing companions ─────────────────────────────────
    const existing = await sql`
      SELECT label FROM traheeb_qr_tokens
      WHERE guest_id = ${guest.id}
        AND label LIKE 'companion-%'
    `;
    const existingLabels = new Set(existing.map((r) => r.label));

    const missingLabels = [];
    for (let i = 1; i <= companions; i++) {
      const label = `companion-${i}`;
      if (!existingLabels.has(label)) missingLabels.push(label);
    }

    if (missingLabels.length === 0) {
      return Response.json({ message: 'جميع رموز QR مُصدَرة بالفعل', issued: 0 });
    }

    console.log(`[resend-qr] guest=${guest.id} missing=${missingLabels.join(', ')}`);

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

// ── Resend a single specific companion ───────────────────────────────────────

async function resendSpecific(guest, qt) {
  const [logoBuffer, bgBuffer] = await Promise.all([
    fetchBuffer(guest.event_logo_url),
    fetchBuffer(guest.qr_background_url),
  ]);

  const cardBuffer = await generateQRCard({
    token:     qt.token,
    label:     qt.label,
    guestName: guest.name,
    eventName: guest.event_name,
    eventDate: guest.event_date,
    eventTime: guest.event_time,
    bgBuffer,
    logoBuffer,
  });

  await sendViaMeta(guest, qt.id, cardBuffer, qt.label);

  // Also send via personal WhatsApp session if connected
  if (isConnected(guest.organizer_user_id)) {
    try {
      const caption = qrConfirmationMessage({
        guestName: guest.name,
        eventName: guest.event_name,
        label: qt.label,
      });
      await sendImages(guest.organizer_user_id, guest.phone, [cardBuffer], caption);
    } catch (err) {
      console.error('[resend-qr] personal WA send error:', err.message);
    }
  }
}

// ── Resend all missing companions ─────────────────────────────────────────────

async function resendMissing(guest, labels) {
  const [logoBuffer, bgBuffer] = await Promise.all([
    fetchBuffer(guest.event_logo_url),
    fetchBuffer(guest.qr_background_url),
  ]);

  const qrBuffers = [];
  const captions  = [];

  for (const label of labels) {
    try {
      const token = crypto.randomBytes(16).toString('hex');
      const [qt] = await sql`
        INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
        VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
        RETURNING id
      `;
      console.log(`[resend-qr] token saved id=${qt.id} label=${label}`);

      const cardBuffer = await generateQRCard({
        token, label,
        guestName: guest.name,
        eventName: guest.event_name,
        eventDate: guest.event_date,
        eventTime: guest.event_time,
        bgBuffer, logoBuffer,
      });

      qrBuffers.push(cardBuffer);
      captions.push(qrConfirmationMessage({ guestName: guest.name, eventName: guest.event_name, label }));

      await sendViaMeta(guest, qt.id, cardBuffer, label);
      await sleep(1500);
    } catch (err) {
      console.error(`[resend-qr] FAILED label=${label}:`, err.message);
    }
  }

  if (qrBuffers.length > 0 && isConnected(guest.organizer_user_id)) {
    try {
      await sendImages(guest.organizer_user_id, guest.phone, qrBuffers, captions[0]);
    } catch (err) {
      console.error('[resend-qr] personal WA send error:', err.message);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendViaMeta(guest, tokenRowId, cardBuffer, label) {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) { console.warn('[resend-qr] IMGBB_API_KEY not set'); return; }

  try {
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', cardBuffer.toString('base64'));
    const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error('ImgBB upload failed: ' + JSON.stringify(json.error ?? json));
    const imageUrl = json.data.url;

    await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${tokenRowId}`;
    await waitForUrl(imageUrl);
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
