/**
 * Meta WhatsApp Cloud API — sends the `attendance_conf` template.
 *
 * Template variables (in order):
 *   {{1}} name       — guest name
 *   {{2}} text_body  — invitation text
 *   {{3}} date       — event date
 *   {{4}} time       — event time
 *   {{5}} location   — Google Maps link
 *   {{6}} people_no  — companions count
 *   {{7}} link       — confirm URL
 *
 * Header: image (event invitation media URL)
 */

const GRAPH_API_VERSION = 'v21.0';
const PHONE_NUMBER_ID   = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN      = process.env.META_ACCESS_TOKEN;
const TEMPLATE_NAME     = 'attendance_conf';
const TEMPLATE_LANGUAGE = 'en_US';

/**
 * Normalise any phone format to E.164 digits only (no +, no spaces).
 * e.g. "+966 53 838 4048" → "966538384048"
 */
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
 * @param {string} params.guestName        — {{name}}
 * @param {string} params.invitationText   — {{text_body}}
 * @param {string} params.date             — {{date}}
 * @param {string} params.time             — {{time}}
 * @param {string} params.venueName        — {{location}} e.g. "X Hotel, Riyadh"
 * @param {string} params.companionsLabel  — {{people_no}}
 * @param {string} params.confirmUrl       — {{link}}
 * @param {string} [params.imageUrl]       — header image URL (optional)
 */
export async function sendInvitationTemplate({
  phone,
  guestName,
  invitationText,
  date,
  time,
  venueName,
  companionsLabel,
  confirmUrl,
  imageUrl,
}) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN env var is missing');
  }

  const to = normalisePhone(phone);

  // Build components
  const components = [];

  // Header — image (if event has an invitation image)
  // Only send header if template has a header component with IMAGE type
  // Comment this out temporarily to isolate parameter errors:
  /*
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
  */

  // Body — 7 variables in template order
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: guestName       || '' },
      { type: 'text', text: invitationText  || '' },
      { type: 'text', text: date            || '' },
      { type: 'text', text: time            || '' },
      { type: 'text', text: venueName       || '' },
      { type: 'text', text: companionsLabel || '' },
      { type: 'text', text: confirmUrl      || '' },
    ],
  });

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANGUAGE },
      components,
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  console.log(`[Meta] sending to=${to} body=${JSON.stringify(body)}`);

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
    console.error(`[Meta] raw error response:`, JSON.stringify(json));
    const errMsg = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Meta API error (${res.status}): ${errMsg}`);
  }

  console.log(`[Meta] template sent to ${to} message_id=${json.messages?.[0]?.id}`);
  return json;
}
