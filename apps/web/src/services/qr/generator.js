/**
 * QR card generator — ticket-style PNG (800 × 1050 px)
 *
 * Graphics (background, QR gradient, golden border, separator lines, notch circles)
 * are rendered via node-canvas.
 *
 * Text + icons are rendered via an SVG overlay composited by sharp.
 * sharp → librsvg → Pango handles Arabic shaping/BiDi correctly.
 *
 * Layout (RTL, top → bottom):
 *   تذكرة دخول: المستضيف الرئيسي   (bold 26px, dark)
 *   [event name]                     (18px, muted)
 *   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   (dashed separator — canvas)
 *   🗓 [date]  ·  [time] 🕐         (bold 30px with SVG icons)
 *   ┌─────── golden border ────────┐
 *   │   QR code (black→logo grad)  │
 *   └──────────────────────────────┘
 *   TOKEN CODE
 *   - - - - - - - - (perforation) -
 *   الرجاء إبراز البطاقة عند الدخول
 */
import { createCanvas, loadImage } from 'canvas';
import QRCode      from 'qrcode';
import sharp       from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

// ── Embed Arabic font as base64 so librsvg never needs to search OS fonts ─────
// Read lazily on first use to avoid module-load-time path errors.
let _fontB64 = null;
function getFontB64() {
  if (_fontB64) return _fontB64;
  // Candidate paths in priority order:
  //   1. process.cwd()-relative: works on Railway (cwd = /app/apps/web)
  //   2. import.meta.url-relative: works in local dev (src/services/qr/ → src/assets/fonts/)
  const candidates = [
    join(process.cwd(), 'src/assets/fonts/Cairo.ttf'),
    join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts/Cairo.ttf'),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Cairo.ttf not found. Tried:\n${candidates.join('\n')}`);
  console.log(`[generator] loading font from: ${found}`);
  _fontB64 = readFileSync(found).toString('base64');
  return _fontB64;
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
  qrCtx.fillStyle = '#FFFFFF';
  qrCtx.fillRect(0, 0, QR_SIZE, QR_SIZE);
  const qrGrad = qrCtx.createLinearGradient(0, 0, QR_SIZE, QR_SIZE);
  qrGrad.addColorStop(0, '#000000');
  qrGrad.addColorStop(1, darkColor);
  qrCtx.fillStyle = qrGrad;
  qrCtx.fillRect(0, 0, QR_SIZE, QR_SIZE);
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

  // ── 3. Main canvas — background, QR, border, separator, perforation ─────────
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = lightBg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Stub (below perforation)
  ctx.fillStyle = stubBg;
  ctx.fillRect(0, PERF_Y, CARD_W, CARD_H - PERF_Y);

  // Draw QR on white background
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

  // ── 5. Dashed separator line ─────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = mutedRgba;
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(80, 125);
  ctx.lineTo(CARD_W - 80, 125);
  ctx.stroke();
  ctx.restore();

  // ── 6. Perforated line ───────────────────────────────────────────────────────
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

  // ── 7. Export canvas, then overlay text via SVG (librsvg → Pango → Arabic) ───
  const canvasBuf = canvas.toBuffer('image/png');

  const ticketLabel = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : 'تذكرة دخول: مرافق';

  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();

  const svgOverlay = buildTextSVG({
    ticketLabel,
    eventName:  String(eventName  ?? ''),
    eventDate:  String(eventDate  ?? ''),
    eventTime:  String(eventTime  ?? ''),
    tokenDisplay,
    darkColor,
    dR, dG, dB,
  });

  const card = await sharp(canvasBuf)
    .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
    .png()
    .toBuffer();

  console.log(`[generator] card built label=${label} size=${card.length} bytes`);
  return card;
}

// ── SVG text + icon overlay ────────────────────────────────────────────────────
// Rendered by sharp → librsvg → Pango, which handles Arabic shaping/BiDi correctly.

function buildTextSVG({ ticketLabel, eventName, eventDate, eventTime, tokenDisplay, darkColor, dR, dG, dB }) {
  const muted = `rgba(${dR},${dG},${dB},0.5)`;
  const AR = 'font-family="Cairo, sans-serif"';

  // Calendar icon (SVG paths, mirroring the canvas drawCalendarIcon at x=740,y=152)
  const calIcon = `
    <g stroke="${darkColor}" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="740" y="155" width="22" height="20" rx="4"/>
      <line x1="740" y1="161" x2="762" y2="161"/>
      <line x1="747" y1="152" x2="747" y2="157"/>
      <line x1="755" y1="152" x2="755" y2="157"/>
    </g>`;

  // Clock icon (fixed at x=200,y=152 — time text occupies x=60..~185)
  const clkIcon = `
    <g stroke="${darkColor}" fill="none" stroke-width="1.8" stroke-linecap="round">
      <circle cx="211" cy="163" r="11"/>
      <line x1="211" y1="163" x2="211" y2="157"/>
      <line x1="211" y1="163" x2="216" y2="163"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
  <defs>
    <style>
      @font-face {
        font-family: 'Cairo';
        src: url('data:font/truetype;base64,${getFontB64()}') format('truetype');
        font-weight: 100 900;
      }
    </style>
  </defs>

  <!-- Ticket type label -->
  <text ${AR} x="${CARD_W / 2}" y="65"
        text-anchor="middle" direction="rtl" unicode-bidi="embed"
        font-size="26" font-weight="bold" fill="${darkColor}">${escXml(ticketLabel)}</text>

  <!-- Event name -->
  <text ${AR} x="${CARD_W / 2}" y="105"
        text-anchor="middle" direction="rtl" unicode-bidi="embed"
        font-size="18" fill="${muted}">${escXml(eventName)}</text>

  <!-- Calendar icon -->
  ${calIcon}

  <!-- Date (right of calendar icon, right-aligned) -->
  <text ${AR} x="732" y="175"
        text-anchor="end" direction="rtl" unicode-bidi="embed"
        font-size="30" font-weight="bold" fill="${darkColor}">${escXml(eventDate)}</text>

  <!-- Dot separator -->
  <text x="${CARD_W / 2}" y="175"
        text-anchor="middle" font-size="30" font-weight="bold" fill="${muted}">·</text>

  <!-- Time (left-aligned, before clock icon) -->
  <text ${AR} x="60" y="175"
        text-anchor="start" font-size="30" font-weight="bold" fill="${darkColor}">${escXml(eventTime)}</text>

  <!-- Clock icon -->
  ${clkIcon}

  <!-- Token code -->
  <text font-family="monospace" x="${CARD_W / 2}" y="820"
        text-anchor="middle" font-size="22" font-weight="bold" fill="${darkColor}">${escXml(tokenDisplay)}</text>

  <!-- Stub text -->
  <text ${AR} x="${CARD_W / 2}" y="${PERF_Y + 60}"
        text-anchor="middle" direction="rtl" unicode-bidi="embed"
        font-size="15" fill="${muted}">الرجاء إبراز البطاقة عند الدخول</text>

</svg>`;
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

/** Escape text for safe embedding in SVG. */
function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Color helpers ──────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
