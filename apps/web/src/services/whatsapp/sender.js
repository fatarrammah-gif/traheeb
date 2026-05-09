/**
 * WhatsApp message sending helpers (whatsapp-web.js).
 */
import { getClient } from './SessionManager.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

const MIME_MAP = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  mp4:  'video/mp4',
  mov:  'video/quicktime',
  avi:  'video/x-msvideo',
  mp3:  'audio/mpeg',
  ogg:  'audio/ogg',
  pdf:  'application/pdf',
};

function toJid(phone) {
  return `${phone.replace(/[^0-9]/g, '')}@c.us`;
}

/** Send a plain text message. */
export async function sendText(userId, phone, text) {
  const client = getClient(userId);
  await client.sendMessage(toJid(phone), text);
}

/**
 * Send a media message (image or video) with caption.
 * Fetches the file directly so we get the real Content-Type from response
 * headers — Uploadcare URLs have no extension so we can't guess the type.
 */
export async function sendMedia(userId, phone, caption, mediaUrl) {
  const client = getClient(userId);
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Could not download media: HTTP ${res.status} — ${mediaUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // Strip charset/boundary params — WhatsApp only accepts the bare mime type.
  // e.g. "image/jpeg; charset=utf-8"  →  "image/jpeg"
  let mimeType = (res.headers.get('content-type') || '').split(';')[0].trim();

  // If response gives a generic type, fall back to extension-based detection.
  if (!mimeType || mimeType === 'application/octet-stream') {
    const urlExt = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    mimeType = MIME_MAP[urlExt] ?? 'image/jpeg';
  }

  // Derive a sensible filename extension from the mime type.
  const extFromMime =
    Object.entries(MIME_MAP).find(([, v]) => v === mimeType)?.[0] ?? 'jpg';

  const media = new MessageMedia(
    mimeType,
    buf.toString('base64'),
    `media.${extFromMime}`,
  );
  await client.sendMessage(toJid(phone), media, { caption });
}

/**
 * Send one or more PNG image buffers (e.g. styled QR codes).
 */
export async function sendImages(userId, phone, imageBuffers, caption = '') {
  const client = getClient(userId);
  const jid = toJid(phone);
  for (let i = 0; i < imageBuffers.length; i++) {
    const b64 = imageBuffers[i].toString('base64');
    const media = new MessageMedia('image/png', b64, `qr-${i + 1}.png`);
    await client.sendMessage(jid, media, { caption: i === 0 ? caption : '' });
    if (i < imageBuffers.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}
