/**
 * WhatsApp message sending helpers (whatsapp-web.js).
 */
import { getClient } from './SessionManager.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

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
  if (!res.ok) throw new Error(`Could not download media: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.split('/')[1]?.split(';')[0]?.trim() || 'jpg';
  const media = new MessageMedia(contentType, buf.toString('base64'), `media.${ext}`);
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
