/**
 * Meta WhatsApp Cloud API — sends the `attendance_conf` template.
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
  confirmUrl,
  imageUrl,
  invitationToken,
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
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', parameter_name: 'name',      text: guestName      || '-' },
      { type: 'text', parameter_name: 'text_body', text: invitationText || '-' },
      { type: 'text', parameter_name: 'date',      text: date           || '-' },
      { type: 'text', parameter_name: 'time',      text: time           || '-' },
      { type: 'text', parameter_name: 'location',  text: venueName      || '-' },
      { type: 'text', parameter_name: 'people_no', text: companionsLabel || '0' },
      { type: 'text', parameter_name: 'link',      text: confirmUrl     || '-' },
    ],
  });

  // CTA URL buttons — dynamic suffix is the invitation token
  // Only added if invitationToken is provided (template must have buttons configured in Meta)
  if (invitationToken) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0', // تأكيد الحضور button
      parameters: [{ type: 'text', text: invitationToken }],
    });
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '1', // الاعتذار button
      parameters: [{ type: 'text', text: invitationToken }],
    });
  }

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

  console.log(`[Meta] sending to=${to} template=${TEMPLATE_NAME}`);

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
