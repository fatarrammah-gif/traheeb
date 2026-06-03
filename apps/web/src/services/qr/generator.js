/**
 * QR card generator — produces a styled PNG card per guest/companion.
 *
 * Card layout (800 × 1000 px):
 *   ┌──────────────────────────────┐
 *   │  Event name (small)          │  y ≈ 78
 *   │  Date  ·  Time (large bold)  │  y ≈ 148
 *   │  Guest label                 │  y ≈ 200
 *   │                              │
 *   │      [ QR code 480×480 ]     │  top=230
 *   │                              │
 *   │  TOKEN CODE                  │  y ≈ 765
 *   │                              │
 *   │  الرجاء إبراز البطاقة…      │  y ≈ 950
 *   └──────────────────────────────┘
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import { extractDarkestColor } from './colorExtractor.js';

const CARD_W  = 800;
const CARD_H  = 1000;
const QR_SIZE = 480;
const QR_LEFT = Math.round((CARD_W - QR_SIZE) / 2);  // 160
const QR_TOP  = 230;

/**
 * @param {object} p
 * @param {string}      p.token      32-char hex — encoded in QR
 * @param {string}      p.label      'main' | 'companion-1' | …
 * @param {string}      p.eventName
 * @param {string}      p.eventDate
 * @param {string}      p.eventTime
 * @param {Buffer|null} p.bgBuffer   qr_background_url image
 * @param {Buffer|null} p.logoBuffer event_logo_url image
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateQRCard({ token, label, eventName, eventDate, eventTime, bgBuffer, logoBuffer }) {
  console.log(`[generator] building card label=${label} token=${token.slice(0,8)}…`);

  // 1. QR foreground color (darkest color from logo, fallback dark)
  let fgColor = '#1A0910';
  if (logoBuffer) {
    fgColor = await extractDarkestColor(logoBuffer);
    console.log(`[generator] fgColor=${fgColor}`);
  }

  // 2. Generate QR directly with the desired color
  const qrBuffer = await QRCode.toBuffer(token, {
    width: QR_SIZE,
    margin: 2,
    color: { dark: fgColor, light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });

  // 3. Overlay event logo in QR center
  let qrFinal = qrBuffer;
  if (logoBuffer) {
    const logoSize = Math.round(QR_SIZE * 0.18);
    const pad = 10;
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad,
                background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    const offset = Math.round((QR_SIZE - logoSize - pad * 2) / 2);
    qrFinal = await sharp(qrBuffer)
      .composite([{ input: resizedLogo, top: offset, left: offset }])
      .png().toBuffer();
  }

  // 4. Card background
  let base;
  if (bgBuffer) {
    base = await sharp(bgBuffer)
      .resize(CARD_W, CARD_H, { fit: 'cover', position: 'centre' })
      .png().toBuffer();
    // Semi-transparent white overlay so text is readable
    const overlay = await sharp({
      create: { width: CARD_W, height: CARD_H, channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 185 } },
    }).png().toBuffer();
    base = await sharp(base)
      .composite([{ input: overlay, blend: 'over' }])
      .png().toBuffer();
  } else {
    base = await sharp({
      create: { width: CARD_W, height: CARD_H, channels: 3,
                background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();
  }

  // 5. Text values
  const tokenDisplay = token.slice(0, 12).toUpperCase().replace(/(.{4})/g, '$1 ').trim();
  const labelText    = label === 'main' ? 'الضيف الرئيسي' : `مرافق ${label.replace('companion-', '')}`;
  const tokenY       = QR_TOP + QR_SIZE + 58;
  const adviceY      = CARD_H - 50;

  // 6. SVG text overlay (librsvg handles Arabic on Railway/Linux)
  const svg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${CARD_W/2}" y="78"
        font-family="Arial,Helvetica,sans-serif" font-size="26" fill="#555555"
        text-anchor="middle">${esc(eventName)}</text>
  <text x="${CARD_W/2}" y="148"
        font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="bold" fill="#1A0910"
        text-anchor="middle">${esc(eventDate)}  ·  ${esc(eventTime)}</text>
  <text x="${CARD_W/2}" y="200"
        font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#888888"
        text-anchor="middle">${esc(labelText)}</text>
  <text x="${CARD_W/2}" y="${tokenY}"
        font-family="Courier New,Courier,monospace" font-size="26" font-weight="bold"
        letter-spacing="6" fill="#333333" text-anchor="middle">${esc(tokenDisplay)}</text>
  <text x="${CARD_W/2}" y="${adviceY}"
        font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="bold" fill="#1A0910"
        text-anchor="middle">الرجاء إبراز البطاقة عند الدخول</text>
</svg>`;

  // 7. Compose: background + QR + text
  const card = await sharp(base)
    .composite([
      { input: qrFinal,          top: QR_TOP, left: QR_LEFT },
      { input: Buffer.from(svg), top: 0,      left: 0       },
    ])
    .png()
    .toBuffer();

  console.log(`[generator] card built label=${label} size=${card.length} bytes`);
  return card;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
