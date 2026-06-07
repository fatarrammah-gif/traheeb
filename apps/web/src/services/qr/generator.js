/**
 * QR card generator — ticket-style PNG (800 × 1050 px)
 *
 * Graphics (background, QR gradient, golden border, separator lines, notch circles)
 * are rendered via node-canvas.
 *
 * Text + icons are rendered via an SVG string composited by sharp.
 * sharp → librsvg → Pango handles Arabic shaping/BiDi correctly.
 * Cairo font is embedded as base64 inside the SVG @font-face so librsvg
 * never needs to search the OS font catalog.
 */
import { createCanvas, loadImage } from 'canvas';
import QRCode             from 'qrcode';
import sharp              from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath }  from 'url';
import { join, dirname }  from 'path';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

// ── Cairo font — loaded once, embedded as base64 in every SVG overlay ─────────
let _fontB64 = null;
function getFontB64() {
  if (_fontB64) return _fontB64;
  const candidates = [
    join(process.cwd(), 'src/assets/fonts/Cairo.ttf'),
    join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts/Cairo.ttf'),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Cairo.ttf not found. Tried:\n${candidates.join('\n')}`);
  console.log(`[generator] font: ${found}`);
  _fontB64 = readFileSync(found).toString('base64');
  return _fontB64;
}

// ── Card dimensions ───────────────────────────────────────────────────────────
const CARD_W     = 800;
const CARD_H     = 1050;
const QR_SIZE    = 460;
const QR_LEFT    = Math.round((CARD_W - QR_SIZE) / 2);
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
 * @param {Buffer|null} p.bgBuffer
 * @param {Buffer|null} p.logoBuffer
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateQRCard({
  token, label, eventName, eventDate, eventTime, bgBuffer, logoBuffer,
}) {
  console.log(`[generator] building card label=${label} token=${token.slice(0, 8)}…`);

  // ── 1. Colors from logo ─────────────────────────────────────────────────────
  let darkColor = '#1A0910';
  let lightBg   = '#F5EFF5';
  let stubBg    = '#EDE4ED';

  if (logoBuffer) {
    darkColor = await extractDarkestColor(logoBuffer);
    lightBg   = await extractLightBgColor(logoBuffer);
    stubBg    = lightenHex(darkColor, 0.88);
    console.log(`[generator] colors: dark=${darkColor} light=${lightBg}`);
  }

  const { r: dR, g: dG, b: dB } = hexToRgb(darkColor);
  const mutedRgba = `rgba(${dR},${dG},${dB},0.5)`;

  // ── 2. Gradient QR code ─────────────────────────────────────────────────────
  const qrSvg = await QRCode.toString(token, {
    type: 'svg', width: QR_SIZE, margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF00' },
  });
  const qrTransparent = await sharp(Buffer.from(qrSvg))
    .resize(QR_SIZE, QR_SIZE).png().toBuffer();

  const qrCanvas = createCanvas(QR_SIZE, QR_SIZE);
  const qrCtx   = qrCanvas.getContext('2d');
  qrCtx.fillStyle = '#FFFFFF';
  qrCtx.fillRect(0, 0, QR_SIZE, QR_SIZE);
  const grad = qrCtx.createLinearGradient(0, 0, QR_SIZE, QR_SIZE);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(1, darkColor);
  qrCtx.fillStyle = grad;
  qrCtx.fillRect(0, 0, QR_SIZE, QR_SIZE);
  qrCtx.globalCompositeOperation = 'destination-in';
  qrCtx.drawImage(await loadImage(qrTransparent), 0, 0);
  qrCtx.globalCompositeOperation = 'source-over';

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

  // ── 3. Main canvas — background, QR, border, separator lines ───────────────
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx    = canvas.getContext('2d');

  ctx.fillStyle = lightBg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = stubBg;
  ctx.fillRect(0, PERF_Y, CARD_W, CARD_H - PERF_Y);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(QR_LEFT, QR_TOP, QR_SIZE, QR_SIZE);
  ctx.drawImage(qrCanvas, QR_LEFT, QR_TOP);

  // Golden border
  const bx = QR_LEFT - BORDER_PAD, by = QR_TOP - BORDER_PAD;
  const bw = QR_SIZE + BORDER_PAD * 2, bh = QR_SIZE + BORDER_PAD * 2;
  const goldGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  goldGrad.addColorStop(0,    '#FFF5A0');
  goldGrad.addColorStop(0.35, '#DAA520');
  goldGrad.addColorStop(0.7,  '#C8860A');
  goldGrad.addColorStop(1,    '#FFE070');
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth   = 2.5;
  roundedRect(ctx, bx, by, bw, bh, 16);
  ctx.stroke();

  // Dashed separator
  ctx.save();
  ctx.strokeStyle = mutedRgba; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(80, 125); ctx.lineTo(CARD_W - 80, 125); ctx.stroke();
  ctx.restore();

  // Perforated line
  ctx.save();
  ctx.strokeStyle = mutedRgba; ctx.lineWidth = 1.2; ctx.setLineDash([9, 7]);
  ctx.beginPath(); ctx.moveTo(32, PERF_Y); ctx.lineTo(CARD_W - 32, PERF_Y); ctx.stroke();
  ctx.restore();

  // Notch circles
  ctx.fillStyle = lightBg;
  ctx.beginPath(); ctx.arc(0,      PERF_Y, 16, -Math.PI / 2, Math.PI / 2);  ctx.fill();
  ctx.beginPath(); ctx.arc(CARD_W, PERF_Y, 16,  Math.PI / 2, -Math.PI / 2); ctx.fill();

  // ── 4. SVG text + icon overlay (sharp → librsvg → Pango → Arabic) ───────────
  const canvasBuf = canvas.toBuffer('image/png');

  const ticketLabel = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : 'تذكرة دخول: مرافق';

  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();

  const svgOverlay = buildTextSVG({
    ticketLabel,
    eventName:   String(eventName  ?? ''),
    eventDate:   String(eventDate  ?? ''),
    eventTime:   String(eventTime  ?? ''),
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

function buildTextSVG({ ticketLabel, eventName, eventDate, eventTime,
                         tokenDisplay, darkColor, dR, dG, dB }) {
  const muted = `rgba(${dR},${dG},${dB},0.5)`;
  const AR    = `font-family="Cairo, sans-serif"`;

  const calIcon = `
    <g stroke="${darkColor}" fill="none" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
      <rect x="740" y="155" width="22" height="20" rx="4"/>
      <line x1="740" y1="161" x2="762" y2="161"/>
      <line x1="747" y1="152" x2="747" y2="157"/>
      <line x1="755" y1="152" x2="755" y2="157"/>
    </g>`;

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

  <!-- Ticket label -->
  <text ${AR} x="${CARD_W / 2}" y="65"
        text-anchor="middle" direction="rtl" unicode-bidi="embed"
        font-size="26" font-weight="bold" fill="${darkColor}">${escXml(ticketLabel)}</text>

  <!-- Event name -->
  <text ${AR} x="${CARD_W / 2}" y="105"
        text-anchor="middle" direction="rtl" unicode-bidi="embed"
        font-size="18" fill="${muted}">${escXml(eventName)}</text>

  <!-- Calendar icon + date -->
  ${calIcon}
  <text ${AR} x="732" y="175"
        text-anchor="end" direction="rtl" unicode-bidi="embed"
        font-size="30" font-weight="bold" fill="${darkColor}">${escXml(eventDate)}</text>

  <!-- Dot -->
  <text x="${CARD_W / 2}" y="175"
        text-anchor="middle" font-size="30" font-weight="bold" fill="${muted}">·</text>

  <!-- Time + clock icon -->
  <text ${AR} x="60" y="175"
        text-anchor="start" font-size="30" font-weight="bold" fill="${darkColor}">${escXml(eventTime)}</text>
  ${clkIcon}

  <!-- Token -->
  <text font-family="monospace" x="${CARD_W / 2}" y="820"
        text-anchor="middle" font-size="22" font-weight="bold"
        fill="${darkColor}">${escXml(tokenDisplay)}</text>

  <!-- Stub -->
  <text ${AR} x="${CARD_W / 2}" y="${PERF_Y + 60}"
        text-anchor="middle" direction="rtl" unicode-bidi="embed"
        font-size="15" fill="${muted}">الرجاء إبراز البطاقة عند الدخول</text>

</svg>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
