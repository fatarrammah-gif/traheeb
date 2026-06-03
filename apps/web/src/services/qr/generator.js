/**
 * QR card generator.
 *
 * Card layout (800 × 1000 px):
 *   top    — event name (small), date · time (large), label (companion N)
 *   center — styled QR code with logo overlay
 *   bottom — token code in monospace, then Arabic entrance advice
 *
 * Returns a PNG Buffer.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import { extractDarkestColor } from './colorExtractor.js';

const CARD_W  = 800;
const CARD_H  = 1000;
const QR_SIZE = 480;
const QR_LEFT = (CARD_W - QR_SIZE) / 2;  // 160
const QR_TOP  = 230;

/**
 * @param {object} params
 * @param {string} params.token       - 32-char hex token (encoded in QR)
 * @param {string} params.label       - 'main' | 'companion-1' | 'companion-2' …
 * @param {string} params.eventName
 * @param {string} params.eventDate
 * @param {string} params.eventTime
 * @param {Buffer|null} params.bgBuffer    - qr_background_url image
 * @param {Buffer|null} params.logoBuffer  - event_logo_url image
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateQRCard({ token, label, eventName, eventDate, eventTime, bgBuffer, logoBuffer }) {
  // 1. Determine QR foreground color (darkest color from logo)
  let fgColor = '#1A0910';
  if (logoBuffer) {
    fgColor = await extractDarkestColor(logoBuffer);
  }

  // 2. Generate QR with the exact desired color
  const qrBuffer = await QRCode.toBuffer(token, {
    width: QR_SIZE,
    margin: 2,
    color: { dark: fgColor, light: '#FFFFFF' },
    errorCorrectionLevel: 'H', // allows logo overlay (up to 30% occlusion)
  });

  // 3. Overlay event logo in the center of the QR
  let qrFinal = qrBuffer;
  if (logoBuffer) {
    const logoSize = Math.round(QR_SIZE * 0.18);
    const pad = 10;
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad,
                background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    const logoOffset = Math.round((QR_SIZE - logoSize - pad * 2) / 2);
    qrFinal = await sharp(qrBuffer)
      .composite([{ input: resizedLogo, top: logoOffset, left: logoOffset }])
      .png()
      .toBuffer();
  }

  // 4. Build card background
  let base;
  if (bgBuffer) {
    // Use provided background image, fill-crop to card size
    base = await sharp(bgBuffer)
      .resize(CARD_W, CARD_H, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();
    // Semi-transparent white overlay for text readability
    const overlay = await sharp({
      create: { width: CARD_W, height: CARD_H, channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 185 } },
    }).png().toBuffer();
    base = await sharp(base)
      .composite([{ input: overlay, blend: 'over' }])
      .png()
      .toBuffer();
  } else {
    base = await sharp({
      create: { width: CARD_W, height: CARD_H, channels: 3,
                background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();
  }

  // 5. Prepare text values
  const tokenDisplay = token.substring(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();

  const labelText = label === 'main'
    ? 'الضيف الرئيسي'
    : `مرافق ${label.replace('companion-', '')}`;

  const tokenY  = QR_TOP + QR_SIZE + 58;   // just below QR
  const adviceY = CARD_H - 50;             // near bottom

  // 6. SVG text overlay
  const svg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Event name (small) -->
  <text x="${CARD_W / 2}" y="78"
        font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#555555"
        text-anchor="middle">${escXml(eventName)}</text>

  <!-- Date · Time (large, bold) -->
  <text x="${CARD_W / 2}" y="148"
        font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold" fill="#1A0910"
        text-anchor="middle">${escXml(eventDate)}  ·  ${escXml(eventTime)}</text>

  <!-- Guest label -->
  <text x="${CARD_W / 2}" y="200"
        font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#888888"
        text-anchor="middle">${escXml(labelText)}</text>

  <!-- Token code (monospace, below QR) -->
  <text x="${CARD_W / 2}" y="${tokenY}"
        font-family="Courier New, Courier, monospace" font-size="26" font-weight="bold"
        letter-spacing="6" fill="#333333" text-anchor="middle">${escXml(tokenDisplay)}</text>

  <!-- Arabic entrance advice -->
  <text x="${CARD_W / 2}" y="${adviceY}"
        font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#1A0910"
        text-anchor="middle">الرجاء إبراز البطاقة عند الدخول</text>
</svg>`;

  // 7. Compose: background + QR + text
  const card = await sharp(base)
    .composite([
      { input: qrFinal,             top: QR_TOP,  left: QR_LEFT },
      { input: Buffer.from(svg),    top: 0,        left: 0       },
    ])
    .png()
    .toBuffer();

  return card;
}

function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
