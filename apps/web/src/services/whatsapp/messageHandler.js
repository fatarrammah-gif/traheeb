/**
 * Handles incoming WhatsApp messages for the organizer's session.
 *
 * Flow:
 *   Guest replies "نعم" → status = "مؤكد", QR codes sent back
 *   Guest replies "لا"  → status = "معتذر", decline acknowledgement sent
 *   Anything else       → ignored (no status change)
 */
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

import crypto from 'crypto';
import sql from '../../app/api/utils/sql.js';
import { qrConfirmationMessage } from './templates.js';

const YES_WORDS = ['نعم', 'اوكيه', 'اوك', 'تأكيد', 'تأكد', 'ok', 'yes', '1', '👍'];
// Include both decomposed (ل+ا) and ligature (ﻻ U+FEFB, ﻼ U+FEFC) forms of "لا"
const NO_WORDS  = ['لا', '\uFEFB', '\uFEFC', 'اعتذر', 'معتذر', 'لااستطيع', 'no', '2', '👎'];

/**
 * Called for every incoming message on an organizer's WhatsApp session.
 * @param {import('whatsapp-web.js').Message} msg
 * @param {string} organizerUserId
 * @param {import('whatsapp-web.js').Client} client
 */
export async function handleIncomingMessage(msg, organizerUserId, client) {
  // Ignore broadcasts, own messages, and group messages
  if (
    msg.from === 'status@broadcast' ||
    msg.fromMe ||
    msg.from.endsWith('@g.us')
  ) return;

  // Strip invisible Unicode marks (RTL/LTR, zero-width chars) WhatsApp adds,
  // then NFC-normalize so Arabic ligatures match their decomposed equivalents.
  const body = (msg.body ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  const rawHex = [...(msg.body ?? '')].map(c => c.codePointAt(0).toString(16)).join(' ');
  console.log(`[WA handler] from=${msg.from} body="${body}" raw_hex=${rawHex}`);

  const isYes = YES_WORDS.includes(body);
  const isNo  = NO_WORDS.includes(body);

  if (!isYes && !isNo) return;

  // Extract phone number — WhatsApp may send @c.us (standard) or @lid (Linked ID).
  // For @lid we must resolve the real phone number via the contact object.
  let senderRaw;
  if (msg.from.endsWith('@c.us')) {
    senderRaw = msg.from.replace('@c.us', '');
  } else if (msg.from.endsWith('@lid')) {
    try {
      // @lid is WhatsApp's internal anonymous ID — the real phone is on the chat object
      const chat = await msg.getChat();
      senderRaw = chat.id.user; // e.g. "966538384048"
      console.log(`[WA handler] resolved @lid → chat.id.user=${senderRaw}`);
    } catch (err) {
      console.error('[WA handler] failed to resolve @lid via chat:', err.message);
      return;
    }
  } else {
    // Unknown format — strip everything after @
    senderRaw = msg.from.split('@')[0];
  }
  const last9 = senderRaw.replace(/[^0-9]/g, '').slice(-9);
  // Canonical JID to send replies to (always @c.us, not @lid)
  const replyJid = msg.from.endsWith('@c.us') ? msg.from : `${senderRaw.replace(/[^0-9]/g, '')}@c.us`;

  let guests;
  try {
    guests = await sql`
      SELECT
        g.id, g.name, g.phone, g.companions, g.status,
        e.id   AS event_id,
        e.name AS event_name,
        e.event_logo_url
      FROM traheeb_guests g
      JOIN traheeb_events e ON e.id = g.event_id
      WHERE e.user_id = ${organizerUserId}
        AND g.status  = 'invited'
        AND RIGHT(REGEXP_REPLACE(g.phone, '[^0-9]', '', 'g'), 9) = ${last9}
      ORDER BY e.date ASC
    `;
  } catch (err) {
    console.error('[WA handler] DB lookup error:', err.message);
    return;
  }

  console.log(`[WA handler] phone lookup last9=${last9} found=${guests.length}`);
  if (!guests.length) return; // no pending invitation for this sender

  const guest = guests[0]; // earliest upcoming event

  if (isNo) {
    // ── Decline ───────────────────────────────────────────────────────────────
    console.log(`[WA handler] Declining guest=${guest.id} name="${guest.name}" event="${guest.event_name}"`);
    try {
      await sql`
        UPDATE traheeb_guests
        SET status = 'declined', responded_at = now()
        WHERE id = ${guest.id}
      `;
    } catch (err) {
      console.error('[WA handler] decline update error:', err.message);
      return;
    }
    try {
      await client.sendMessage(
        replyJid,
        `تم استلام اعتذارك ${guest.name}.\nنأمل أن نراك في مناسبات قادمة 🤍`
      );
    } catch {}
    return;
  }

  // ── Confirm ────────────────────────────────────────────────────────────────
  console.log(`[WA handler] Confirming guest=${guest.id} name="${guest.name}" event="${guest.event_name}"`);
  try {
    await sql`
      UPDATE traheeb_guests
      SET status = 'confirmed', responded_at = now()
      WHERE id = ${guest.id}
    `;
  } catch (err) {
    console.error('[WA handler] confirm update error:', err.message);
    return;
  }

  // Generate QR tokens (1 for guest + 1 per companion)
  const labels = [
    'main',
    ...Array.from({ length: guest.companions || 0 }, (_, i) => `companion-${i + 1}`),
  ];

  const tokens = [];
  for (const label of labels) {
    const token = crypto.randomBytes(16).toString('hex');
    try {
      await sql`
        INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
        VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
        ON CONFLICT DO NOTHING
      `;
      tokens.push({ token, label });
    } catch (err) {
      console.error('[WA handler] QR token insert error:', err.message);
    }
  }

  // Send acknowledgement
  try {
    await client.sendMessage(
      replyJid,
      `شكراً ${guest.name} 🎉\n\nتم تأكيد حضورك في *${guest.event_name}*\nسيصلك رمز الدخول الآن 👇`
    );
  } catch (err) {
    console.error('[WA handler] ack send error:', err.message);
  }

  // Generate and send QR images
  let logoBuffer = null;
  if (guest.event_logo_url) {
    try {
      const r = await fetch(guest.event_logo_url);
      if (r.ok) logoBuffer = Buffer.from(await r.arrayBuffer());
    } catch {}
  }

  for (const { token, label } of tokens) {
    try {
      const { generateStyledQR } = await import('../qr/generator.js');
      const pngBuffer = await generateStyledQR(token, logoBuffer);
      const caption = qrConfirmationMessage({
        guestName: guest.name,
        eventName: guest.event_name,
        label,
      });
      const media = new MessageMedia('image/png', pngBuffer.toString('base64'));
      await client.sendMessage(replyJid, media, { caption });
      if (tokens.length > 1) await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[WA handler] QR send error label=${label}:`, err.message);
    }
  }
}
