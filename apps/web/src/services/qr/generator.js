/**
 * Stylized QR code generator.
 * Pipeline:
 *   1. Generate base QR PNG (black on white, 800×800)
 *   2. Colorize dark modules with the dominant logo color
 *   3. Overlay the event logo centered (with white padding)
 * Returns a PNG Buffer.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import { extractDominantColor } from './colorExtractor.js';

const QR_SIZE = 800;
const LOGO_RATIO = 0.20;   // logo takes ~20% of QR width
const LOGO_PADDING = 12;   // white padding around logo

/**
 * @param {string}  token          - data to encode in the QR
 * @param {Buffer|null} logoBuffer - event logo image buffer (optional)
 * @returns {Promise<Buffer>}      - PNG buffer
 */
export async function generateStyledQR(token, logoBuffer = null) {
  // 1. Base QR — black modules on white
  const baseQR = await QRCode.toBuffer(token, {
    width: QR_SIZE,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H', // high: allows up to 30% damage → room for logo
  });

  // 2. Determine foreground color
  let fgColor = '#1A0910';
  if (logoBuffer) {
    fgColor = await extractDominantColor(logoBuffer);
  }

  // 3. Colorize: replace black modules with fgColor
  //    Technique: create a solid-color layer same size, then use 'multiply'
  //    blend to apply it only where the QR is dark.
  const [r, g, b] = hexToRgb(fgColor);

  const colorLayer = await sharp({
    create: { width: QR_SIZE, height: QR_SIZE, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();

  // Convert base QR to raw RGBA so we can use it as a mask
  const colorized = await sharp(baseQR)
    .ensureAlpha()
    // Make white pixels transparent, keep dark pixels opaque
    .toColorspace('srgb')
    .composite([
      {
        input: colorLayer,
        blend: 'multiply',
      },
    ])
    .png()
    .toBuffer();

  // 4. Compose QR on white background (in case of transparent edges)
  let finalQR = await sharp({
    create: { width: QR_SIZE, height: QR_SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: colorized, blend: 'over' }])
    .png()
    .toBuffer();

  // 5. Overlay logo if provided
  if (logoBuffer) {
    const logoSize = Math.round(QR_SIZE * LOGO_RATIO);
    const totalSize = logoSize + LOGO_PADDING * 2;

    // Resize logo with white padding
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .extend({
        top: LOGO_PADDING, bottom: LOGO_PADDING,
        left: LOGO_PADDING, right: LOGO_PADDING,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    const offset = Math.round((QR_SIZE - totalSize) / 2);

    finalQR = await sharp(finalQR)
      .composite([{ input: resizedLogo, top: offset, left: offset }])
      .png()
      .toBuffer();
  }

  return finalQR;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}
