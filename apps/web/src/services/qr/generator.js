/**
 * QR card generator — ticket-style PNG (800 × 1050 px)
 * Uses node-canvas for rendering so Arabic text is shaped and joined correctly.
 *
 * Layout (RTL, top → bottom):
 *   تذكرة دخول: المستضيف الرئيسي   (medium, dark)
 *   [event name]                     (small, muted)
 *   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   (dashed separator)
 *   [date] 🗓   ·   🕐 [time]       (large, icons on the RIGHT of each text)
 *   ┌─────── golden border ────────┐
 *   │   QR code (black→logo grad)  │
 *   └──────────────────────────────┘
 *   TOKEN CODE
 *   - - - - - - - - (perforation) -
 *   الرجاء إبراز البطاقة عند الدخول
 */
import { createCanvas, registerFont, loadImage } from 'canvas';
import QRCode            from 'qrcode';
import sharp             from 'sharp';
import { execSync }      from 'child_process';
import { existsSync }    from 'fs';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

// ── Arabic text ───────────────────────────────────────────────────────────────
// Pango (used by node-canvas via Cairo on Linux) handles Arabic shaping and
// BiDi automatically. Pass raw Unicode text + set ctx.direction = 'rtl'.
const ar = (text) => String(text ?? '');

// ── Font: find Noto Sans Arabic via fontconfig at runtime ─────────────────────
let _fontsReady = false;
function ensureFonts() {
  if (_fontsReady) return;
  _fontsReady = true;
  try {
    // fc-match finds the best Arabic font installed on the system
    const reg  = execSync('fc-match "Noto Sans Arabic:lang=ar" --format="%{file}"',  { encoding: 'utf8' }).trim();
    const bold = execSync('fc-match "Noto Sans Arabic:lang=ar:weight=bold" --format="%{file}"', { encoding: 'utf8' }).trim();
    if (reg  && existsSync(reg))  registerFont(reg,  { family: 'NotoArabic', weight: 'normal' });
    if (bold && existsSync(bold)) registerFont(bold, { family: 'NotoArabic', weight: 'bold' });
    console.log(`[generator] font: ${reg}`);
  } catch (err) {
    console.warn('[generator] fc-match failed, using system fallback:', err.message);
  }
}

// ── Card dimensions ───────────────────────────────────────────────────────────
const CARD_W     = 800;
const CARD_H     = 1050;
const QR_SIZE    = 460;
const QR_LEFT    = Math.round((CARD_W - QR_SIZE) / 2);   // 170
const QR_TOP     = 270;
const BORDER_PAD = 22;
const PERF_Y     = 870;

/**
 * @param {object} p
 * @param {string}      p.token
 * @param {string}      p.label        'main' | 'companion-1' | …
 * @param {string}      p.eventName
 * @param {string}      p.eventDate
 * @param {string}      p.eventTime
 * @param {Buffer|null} p.bgBuffer     (ignored — bg derived from logo color)
 * @param {Buffer|null} p.logoBuffer
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateQRCard({
  token, label, eventName, eventDate, eventTime, bgBuffer, logoBuffer,
}) {
  console.log(`[generator] building card label=${label} token=${token.slice(0, 8)}…`);
  ensureFonts();

  // ── 1. Colors ───────────────────────────────────────────────────────────────
  let darkColor = '#1A0910';
  let lightBg   = '#F5EFF5';
  let stubBg    = '#EDE4ED';

  if (logoBuffer) {
    darkColor = await extractDarkestColor(logoBuffer);
    lightBg   = await extractLightBgColor(logoBuffer);
    stubBg    = lightenHex(darkColor, 0.88);
    console.log(`[generator] darkColor=${darkColor} lightBg=${lightBg}`);
  }

  const { r: dR, g: dG, b: dB } = hexToRgb(darkColor);
  const mutedRgba = `rgba(${dR},${dG},${dB},0.5)`;

  // ── 2. QR code (gradient: black → darkColor, transparent bg) ───────────────
  const qrSvg = await QRCode.toString(token, {
    type: 'svg',
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF00' },
  });
  const qrTransparentBuf = await sharp(Buffer.from(qrSvg))
    .resize(QR_SIZE, QR_SIZE)
    .png()
    .toBuffer();

  // Build gradient QR on its own canvas
  const qrCanvas = createCanvas(QR_SIZE, QR_SIZE);
  const qrCtx   = qrCanvas.getContext('2d');
  // White base
  qrCtx.fillStyle = '#FFFFFF';
  qrCtx.fillRect(0, 0, QR_SIZE, QR_SIZE);
  // Draw gradient
  const qrGrad = qrCtx.createLinearGradient(0, 0, QR_SIZE, QR_SIZE);
  qrGrad.addColorStop(0, '#000000');
  qrGrad.addColorStop(1, darkColor);
  qrCtx.fillStyle = qrGrad;
  qrCtx.fillRect(0, 0, QR_SIZE, QR_SIZE);
  // Mask to QR shape
  qrCtx.globalCompositeOperation = 'destination-in';
  qrCtx.drawImage(await loadImage(qrTransparentBuf), 0, 0);
  qrCtx.globalCompositeOperation = 'source-over';

  // Overlay logo in QR center
  if (logoBuffer) {
    const logoSize = Math.round(QR_SIZE * 0.18);
    const pad = 8;
    const logoBuf = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad,
                background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    const offset = Math.round((QR_SIZE - logoSize - pad * 2) / 2);
    qrCtx.drawImage(await loadImage(logoBuf), offset, offset);
  }

  // ── 3. Main canvas ──────────────────────────────────────────────────────────
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = lightBg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Stub (below perforation)
  ctx.fillStyle = stubBg;
  ctx.fillRect(0, PERF_Y, CARD_W, CARD_H - PERF_Y);

  // Draw QR on white background (avoids transparency bleed)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(QR_LEFT, QR_TOP, QR_SIZE, QR_SIZE);
  ctx.drawImage(qrCanvas, QR_LEFT, QR_TOP);

  // ── 4. Golden border around QR ──────────────────────────────────────────────
  const bx = QR_LEFT  - BORDER_PAD;
  const by = QR_TOP   - BORDER_PAD;
  const bw = QR_SIZE  + BORDER_PAD * 2;
  const bh = QR_SIZE  + BORDER_PAD * 2;

  const goldGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  goldGrad.addColorStop(0,    '#FFF5A0');
  goldGrad.addColorStop(0.35, '#DAA520');
  goldGrad.addColorStop(0.7,  '#C8860A');
  goldGrad.addColorStop(1,    '#FFE070');
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth   = 2.5;
  roundedRect(ctx, bx, by, bw, bh, 16);
  ctx.stroke();

  // ── 5. Text: ticket type label ──────────────────────────────────────────────
  const ticketLabel = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : 'تذكرة دخول: مرافق';

  const AR_FONT = '"NotoArabic", "Noto Sans Arabic", "Noto Naskh Arabic", sans-serif';

  ctx.font      = `bold 26px ${AR_FONT}`;
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText(ar(ticketLabel), CARD_W / 2, 65);

  // ── 6. Text: event name ─────────────────────────────────────────────────────
  ctx.font      = `18px ${AR_FONT}`;
  ctx.fillStyle = mutedRgba;
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText(ar(String(eventName ?? '')), CARD_W / 2, 105);

  // ── 7. Dashed separator line ─────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = mutedRgba;
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(80, 125);
  ctx.lineTo(CARD_W - 80, 125);
  ctx.stroke();
  ctx.restore();

  // ── 8. Date block (right side): [date text] [calendar icon] ─────────────────
  const calIconX = 740, calIconY = 152;
  drawCalendarIcon(ctx, calIconX, calIconY, darkColor);

  ctx.font      = `bold 30px ${AR_FONT}`;
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillText(ar(String(eventDate ?? '')), calIconX - 8, 175);

  // ── 9. Dot separator (center) ────────────────────────────────────────────────
  ctx.font      = 'bold 30px sans-serif';
  ctx.fillStyle = mutedRgba;
  ctx.textAlign = 'center';
  ctx.fillText('·', CARD_W / 2, 175);

  // ── 10. Time block (left side): [time text] [clock icon] ────────────────────
  const timeText    = ar(String(eventTime ?? ''));
  ctx.font          = `bold 30px ${AR_FONT}`;
  ctx.direction     = 'ltr';
  const timeMetrics = ctx.measureText(timeText);
  const timeStartX  = 60;
  ctx.fillStyle     = darkColor;
  ctx.textAlign     = 'left';
  ctx.fillText(timeText, timeStartX, 175);

  const clkIconX = timeStartX + timeMetrics.width + 10;
  const clkIconY = 152;
  drawClockIcon(ctx, clkIconX, clkIconY, darkColor);

  // ── 11. Token code ───────────────────────────────────────────────────────────
  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();

  ctx.font      = 'bold 22px monospace';
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText(tokenDisplay, CARD_W / 2, 820);

  // ── 12. Perforated line ──────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = mutedRgba;
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(32, PERF_Y);
  ctx.lineTo(CARD_W - 32, PERF_Y);
  ctx.stroke();
  ctx.restore();

  // Side notch circles
  ctx.fillStyle = lightBg;
  ctx.beginPath();
  ctx.arc(0, PERF_Y, 16, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CARD_W, PERF_Y, 16, Math.PI / 2, -Math.PI / 2);
  ctx.fill();

  // ── 13. Stub text ─────────────────────────────────────────────────────────────
  ctx.font      = `15px ${AR_FONT}`;
  ctx.fillStyle = mutedRgba;
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText(ar('الرجاء إبراز البطاقة عند الدخول'), CARD_W / 2, PERF_Y + 60);

  const card = canvas.toBuffer('image/png');
  console.log(`[generator] card built label=${label} size=${card.length} bytes`);
  return card;
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/** Calendar icon (22×23 px) at top-left corner (x, y) */
function drawCalendarIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  // Outer box
  roundedRect(ctx, x, y + 3, 22, 20, 4);
  ctx.stroke();
  // Header line
  ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x + 22, y + 9); ctx.stroke();
  // Ring left
  ctx.beginPath(); ctx.moveTo(x + 7,  y); ctx.lineTo(x + 7,  y + 5); ctx.stroke();
  // Ring right
  ctx.beginPath(); ctx.moveTo(x + 15, y); ctx.lineTo(x + 15, y + 5); ctx.stroke();
  ctx.restore();
}

/** Clock icon (22×22 px) centered at (x+11, y+11) */
function drawClockIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.beginPath(); ctx.arc(x + 11, y + 11, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 11, y + 11); ctx.lineTo(x + 11, y + 5);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 11, y + 11); ctx.lineTo(x + 16, y + 11); ctx.stroke();
  ctx.restore();
}

// ── Color helpers ──────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
