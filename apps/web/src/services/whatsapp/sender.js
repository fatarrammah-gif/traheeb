/**
 * WhatsApp message sending helpers.
 * All functions take a userId whose session must already be connected.
 */
import { getSocket } from './SessionManager.js';

/** Normalize a phone number to a WhatsApp JID. */
function toJid(phone) {
  const digits = phone.replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

/**
 * Send a plain text message.
 * @param {string} userId  - organizer's userId (or 'SYSTEM' for bot)
 * @param {string} phone   - recipient phone in any format
 * @param {string} text    - message text
 */
export async function sendText(userId, phone, text) {
  const socket = getSocket(userId);
  const jid = toJid(phone);
  await socket.sendMessage(jid, { text });
}

/**
 * Send a media message (image or video) with an optional caption.
 * mediaUrl is fetched and sent as a buffer.
 * @param {string} userId
 * @param {string} phone
 * @param {string} caption
 * @param {string} mediaUrl    - publicly accessible URL
 * @param {string} mimeType    - e.g. 'image/jpeg', 'video/mp4'
 */
export async function sendMedia(userId, phone, caption, mediaUrl, mimeType) {
  const socket = getSocket(userId);
  const jid = toJid(phone);

  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Failed to fetch media: ${mediaUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const isVideo = mimeType?.startsWith('video');

  if (isVideo) {
    await socket.sendMessage(jid, {
      video: buffer,
      caption,
      mimetype: mimeType,
    });
  } else {
    await socket.sendMessage(jid, {
      image: buffer,
      caption,
      mimetype: mimeType || 'image/jpeg',
    });
  }
}

/**
 * Send one or more image buffers (e.g. QR code images).
 * @param {string} userId
 * @param {string} phone
 * @param {Buffer[]} imageBuffers
 * @param {string} caption   - caption on the first image
 */
export async function sendImages(userId, phone, imageBuffers, caption = '') {
  const socket = getSocket(userId);
  const jid = toJid(phone);

  for (let i = 0; i < imageBuffers.length; i++) {
    await socket.sendMessage(jid, {
      image: imageBuffers[i],
      caption: i === 0 ? caption : '',
      mimetype: 'image/png',
    });
    // Brief delay between consecutive messages to avoid rate-limiting
    if (i < imageBuffers.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}
