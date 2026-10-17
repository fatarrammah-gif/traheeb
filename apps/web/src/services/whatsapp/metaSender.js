/**
 * Meta WhatsApp Cloud API — sends the `attendence_conf_10` template.
 *
 * Template variables:
 *   name       — guest name
 *   text_body  — invitation text
 *   date       — event date
 *   time       — event time
 *   location   — venue name
 *   people_no  — companions count
 *   link       — confirm URL
 *
 * Header: image (event invitation media URL)
 */

const GRAPH_API_VERSION = 'v21.0';
const PHONE_NUMBER_ID   = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN      = process.env.META_ACCESS_TOKEN;
const TEMPLATE_NAME     = 'attendance_conf';
const TEMPLATE_LANGUAGE = 'en_US';

/**
 * Strip characters Meta rejects in template text parameters:
 * newlines, tabs, and runs of more than 4 consecutive spaces.
 */
function sanitizeParam(text) {
  return String(text ?? '')
    .replace(/[\r\n\t]/g, ' ')   // newlines/tabs → single space
    .replace(/ {5,}/g, '    ');  // 5+ spaces → 4 spaces (Meta's limit)
}

/** Normalise any phone format to E.164 digits only (no +, no spaces). */
function normalisePhone(phone) {
  let p = String(phone).replace(/[\s\-().+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '966' + p.slice(1);
  if (p.startsWith('5')  && p.length === 9)  p = '966' + p;
  return p.replace(/[^0-9]/g, '');
}

/**
 * Send the attendance_conf template to one guest.
 *
 * @param {object} params
 * @param {string} params.phone            — guest phone number (any format)
 * @param {string} params.guestName        — name
 * @param {string} params.invitationText   — text_body
 * @param {string} params.date             — date
 * @param {string} params.time             — time
 * @param {string} params.venueName        — location
 * @param {string} params.companionsLabel  — people_no
 * @param {string} params.confirmUrl       — link
 * @param {string} [params.imageUrl]       — header image URL
 */
export async function sendInvitationTemplate({
  phone,
  guestName,
  invitationText,
  date,
  time,
  venueName,
  companionsLabel,
  locationLink,
  imageUrl,
  invitationToken,
  templateName,
}) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN env var is missing');
  }

  const to = normalisePhone(phone);

  const components = [];

  // Header — image
  if (imageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: imageUrl },
        },
      ],
    });
  }

  // Body — named parameters
  // attendence_conf_11 does not include people_no
  const bodyParams = [
    { type: 'text', parameter_name: 'name',      text: sanitizeParam(guestName      || '-') },
    { type: 'text', parameter_name: 'text_body', text: sanitizeParam(invitationText || '-') },
    { type: 'text', parameter_name: 'date',      text: sanitizeParam(date           || '-') },
    { type: 'text', parameter_name: 'time',      text: sanitizeParam(time           || '-') },
    { type: 'text', parameter_name: 'location',  text: sanitizeParam(venueName      || '-') },
    { type: 'text', parameter_name: 'link',      text: sanitizeParam(locationLink   || '-') },
  ];
  if (templateName !== 'attendence_conf_11') {
    bodyParams.splice(5, 0, { type: 'text', parameter_name: 'people_no', text: sanitizeParam(companionsLabel || '0') });
  }
  components.push({ type: 'body', parameters: bodyParams });

  // Quick Reply buttons — payload tells webhook which button was tapped
  components.push({
    type: 'button',
    sub_type: 'quick_reply',
    index: '0', // تأكيد الحضور
    parameters: [{ type: 'payload', payload: 'confirm' }],
  });
  components.push({
    type: 'button',
    sub_type: 'quick_reply',
    index: '1', // الاعتذار
    parameters: [{ type: 'payload', payload: 'decline' }],
  });

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName || TEMPLATE_NAME,
      language: { code: templateName ? 'ar' : TEMPLATE_LANGUAGE },
      components,
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  console.log(`[Meta] sending to=${to} template=${templateName || TEMPLATE_NAME} components=${JSON.stringify(components).slice(0, 300)}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error(`[Meta] error response:`, JSON.stringify(json));
    const errMsg = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Meta API error (${res.status}): ${errMsg}`);
  }

  console.log(`[Meta] sent to ${to} message_id=${json.messages?.[0]?.id}`);
  return json;
}

/**
 * Send a plain image message within the 24-hour customer service window.
 * Valid after the guest taps any button (counts as user-initiated message).
 */
export async function sendTextMessage({ phone, text }) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN env var is missing');
  }

  const to = normalisePhone(phone);
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meta API error (${res.status}): ${json?.error?.message ?? JSON.stringify(json)}`);
  }

  console.log(`[Meta] text sent to ${to} message_id=${json.messages?.[0]?.id}`);
  return json;
}

/**
 * Send the qr_code_tm_3 template to a guest.
 * Template has an image header and fixed Arabic body text — no variables.
 */
export async function sendQRTemplate({ phone, imageUrl }) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN env var is missing');
  }

  const to = normalisePhone(phone);
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'qr_code_tm_3',
      language: { code: 'ar' },
      components: [
        {
          type: 'header',
          parameters: [
            { type: 'image', image: { link: imageUrl } },
          ],
        },
      ],
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('[Meta] qr template error:', JSON.stringify(json));
    throw new Error(`Meta API error (${res.status}): ${json?.error?.message ?? JSON.stringify(json)}`);
  }

  console.log(`[Meta] qr_code_tm_3 sent to ${to} message_id=${json.messages?.[0]?.id}`);
  return json;
}

export async function sendImageMessage({ phone, imageUrl, caption = '' }) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN env var is missing');
  }

  const to = normalisePhone(phone);
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  console.log(`[Meta] sending image to=${to}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('[Meta] image send error:', JSON.stringify(json));
    throw new Error(`Meta API error (${res.status}): ${json?.error?.message ?? JSON.stringify(json)}`);
  }

  console.log(`[Meta] image sent to ${to} message_id=${json.messages?.[0]?.id}`);
  return json;
}
