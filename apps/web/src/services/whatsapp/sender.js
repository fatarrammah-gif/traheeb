/**
 * WhatsApp message sending helpers (whatsapp-web.js).
 */
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

import { getClient, toWhatsAppJid, markSessionDead } from './SessionManager.js';

/**
 * Returns true when the error indicates the Puppeteer frame/session has died.
 * In this case the session must be destroyed and re-created.
 */
function isDeadSessionError(err) {
  const msg = err?.message ?? '';
  return (
    msg.includes('detached Frame') ||
    msg.includes('Execution context was destroyed') ||
    msg.includes('Session closed') ||
    msg.includes('Target closed') ||
    msg.includes('Protocol error')
  );
}

/** Send a plain text message. */
export async function sendText(userId, phone, text) {
  const client = getClient(userId);
  try {
    await client.sendMessage(toWhatsAppJid(phone), text);
  } catch (err) {
    if (isDeadSessionError(err)) {
      console.error(`[WhatsApp] Dead session detected on sendText userId=${userId}: ${err.message}`);
      markSessionDead(userId);
    }
    throw err;
  }
}

/**
 * Send a media message (image or video) with caption.
 * mediaSource can be a data URI ("data:image/jpeg;base64,...") or a URL.
 */
export async function sendMedia(userId, phone, caption, mediaSource) {
  const client = getClient(userId);
  const jid = toWhatsAppJid(phone);

  let base64data;
  let mimetype;

  if (mediaSource.startsWith('data:')) {
    const [header, b64] = mediaSource.split(',');
    mimetype = header.replace('data:', '').replace(';base64', '');
    base64data = b64;
    console.log(`[sendMedia] using base64 data uri mime=${mimetype}`);
  } else {
    console.log(`[sendMedia] downloading: ${mediaSource}`);
    const res = await fetch(mediaSource);
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading media`);
    const buffer = Buffer.from(await res.arrayBuffer());
    mimetype = res.headers.get('content-type') || 'image/jpeg';
    base64data = buffer.toString('base64');
    console.log(`[sendMedia] downloaded mime=${mimetype} size=${buffer.length}`);
  }

  try {
    const media = new MessageMedia(mimetype, base64data);
    await client.sendMessage(jid, media, { caption });
  } catch (err) {
    if (isDeadSessionError(err)) {
      console.error(`[WhatsApp] Dead session detected on sendMedia userId=${userId}: ${err.message}`);
      markSessionDead(userId);
    }
    throw err;
  }
}

/**
 * Send one or more PNG image buffers (e.g. styled QR codes).
 */
export async function sendImages(userId, phone, imageBuffers, caption = '') {
  const client = getClient(userId);
  const jid = toWhatsAppJid(phone);
  for (let i = 0; i < imageBuffers.length; i++) {
    try {
      const media = new MessageMedia('image/png', imageBuffers[i].toString('base64'));
      await client.sendMessage(jid, media, { caption: i === 0 ? caption : '' });
    } catch (err) {
      if (isDeadSessionError(err)) {
        console.error(`[WhatsApp] Dead session detected on sendImages userId=${userId}: ${err.message}`);
        markSessionDead(userId);
      }
      throw err;
    }
    if (i < imageBuffers.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}
