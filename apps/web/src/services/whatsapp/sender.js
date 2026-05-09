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
 * mediaSource can be:
 *   - a data URI:  "data:image/jpeg;base64,/9j/..."  (stored in DB, used directly)
 *   - a plain URL: "https://..."                     (downloaded first)
 */
export async function sendMedia(userId, phone, caption, mediaSource) {
  const client = getClient(userId);
  let media;

  if (mediaSource.startsWith('data:')) {
    // Already base64 — parse and build MessageMedia directly, no network call needed
    const [header, data] = mediaSource.split(',');
    const mimeType = header.replace('data:', '').replace(';base64', '');
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'jpg';
    media = new MessageMedia(mimeType, data, `media.${ext}`);
    console.log(`[sendMedia] using base64 data uri, mime=${mimeType} size=${data.length}`);
  } else {
    // Plain URL — download it
    console.log(`[sendMedia] downloading: ${mediaSource}`);
    media = await MessageMedia.fromUrl(mediaSource, { unsafeMime: true });
    console.log(`[sendMedia] downloaded mime=${media.mimetype}`);
  }

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
