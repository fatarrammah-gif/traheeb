/**
 * QR card generator — ticket-style PNG (800 × 1050 px)
 *
 * Layout (top → bottom):
 *   ┌───────────────────────────────────────┐
 *   │  تذكرة دخول: المستضيف الرئيسي  (med) │
 *   │  [event name]              (small)    │
 *   │  ─────────────── (thin line) ───────  │
 *   │  🗓 date       ·       time 🕐 (lg)   │
 *   │  ┌─────────────────────────────────┐  │
 *   │  │  [golden rounded border]        │  │
 *   │  │  [QR code  — black→logo grad]   │  │
 *   │  └─────────────────────────────────┘  │
 *   │  TOKEN CODE                (mono)     │
 *   │  - - - - - - - - - - - - - - - - -   │  ← perforation
 *   │  [stub area — slightly darker]        │
 *   └───────────────────────────────────────┘
 */
import QRCode  from 'qrcode';
import sharp   from 'sharp';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

const CARD_W   = 800;
const CARD_H   = 1050;
const QR_SIZE  = 460;
const QR_LEFT  = Math.round((CARD_W - QR_SIZE) / 2);   // 170
const QR_TOP   = 265;

const BORDER_PAD = 22;  // golden border inset around QR
const PERF_Y     = 870; // y of perforated line

/**
 * @param {object} p
 * @param {string}      p.token
 * @param {string}      p.label       'main' | 'companion-1' | …
 * @param {string}      p.eventName
 * @param {string}      p.eventDate
 * @param {string}      p.eventTime
 * @param {Buffer|null} p.bgBuffer    (ignored — background derived from logo color)
 * @param {Buffer|null} p.logoBuffer
 * @returns {Promise<Buffer>} PNG
 */
export async function generateQRCard({ token, label, eventName, eventDate, eventTime, bgBuffer, logoBuffer }) {
  console.log(`[generator] building card label=${label} token=${token.slice(0, 8)}…`);

  // ── 1. Colors ──────────────────────────────────────────────────────────────
  let darkColor  = '#1A0910';
  let lightBg    = '#F5EFF5';
  let stubBg     = '#EDE4ED';

  if (logoBuffer) {
    darkColor = await extractDarkestColor(logoBuffer);
    lightBg   = await extractLightBgColor(logoBuffer);
    stubBg    = lightenHex(darkColor, 0.88);
    console.log(`[generator] darkColor=${darkColor} lightBg=${lightBg}`);
  }

  // ── 2. QR code with black→darkColor gradient ───────────────────────────────
  const qrSvgRaw = await QRCode.toString(token, {
    type: 'svg',
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const gradDefs = `<defs>
    <linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#000000"/>
      <stop offset="100%" stop-color="${darkColor}"/>
    </linearGradient>
  </defs>`;

  // Inject gradient — replace the dark fill in the QR path
  const qrSvgGrad = qrSvgRaw
    .replace(/(<path[^>]*?)fill="#000000"/g, `$1fill="url(#qrGrad)"`)
    .replace('</svg>', gradDefs + '</svg>');

  let qrBuffer = await sharp(Buffer.from(qrSvgGrad)).resize(QR_SIZE, QR_SIZE).png().toBuffer();

  // Overlay logo in QR center
  if (logoBuffer) {
    const logoSize = Math.round(QR_SIZE * 0.18);
    const pad      = 8;
    const resized  = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad,
                background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    const offset = Math.round((QR_SIZE - logoSize - pad * 2) / 2);
    qrBuffer = await sharp(qrBuffer)
      .composite([{ input: resized, top: offset, left: offset }])
      .png().toBuffer();
  }

  // ── 3. Background ──────────────────────────────────────────────────────────
  const { r: bgR, g: bgG, b: bgB } = hexToRgb(lightBg);
  const { r: stR, g: stG, b: stB } = hexToRgb(stubBg);

  // Main ticket area
  let base = await sharp({
    create: { width: CARD_W, height: CARD_H, channels: 3,
              background: { r: bgR, g: bgG, b: bgB } },
  }).png().toBuffer();

  // Stub area (below perforation)
  const stubOverlay = await sharp({
    create: { width: CARD_W, height: CARD_H - PERF_Y, channels: 3,
              background: { r: stR, g: stG, b: stB } },
  }).png().toBuffer();

  base = await sharp(base)
    .composite([{ input: stubOverlay, top: PERF_Y, left: 0 }])
    .png().toBuffer();

  // ── 4. Labels & token ──────────────────────────────────────────────────────
  const ticketLabel  = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : `تذكرة دخول: مرافق`;

  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();

  // Muted text color: 60% opacity version of darkColor
  const { r: dR, g: dG, b: dB } = hexToRgb(darkColor);
  const mutedColor = `rgba(${dR},${dG},${dB},0.55)`;

  // Golden border geometry
  const bx = QR_LEFT  - BORDER_PAD;
  const by = QR_TOP   - BORDER_PAD;
  const bw = QR_SIZE  + BORDER_PAD * 2;
  const bh = QR_SIZE  + BORDER_PAD * 2;

  // ── 5. SVG overlay ─────────────────────────────────────────────────────────
  const svg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Golden gradient for QR border -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#FFF5A0"/>
      <stop offset="40%"  stop-color="#DAA520"/>
      <stop offset="75%"  stop-color="#C8860A"/>
      <stop offset="100%" stop-color="#FFE070"/>
    </linearGradient>
  </defs>

  <!-- Golden border around QR (thin, rounded) -->
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}"
        rx="16" ry="16"
        fill="none" stroke="url(#goldGrad)" stroke-width="2.5"/>

  <!-- Ticket type label -->
  <text x="${CARD_W / 2}" y="68"
        font-family="Noto Sans Arabic,Noto Sans,DejaVu Sans,sans-serif" font-size="26" font-weight="700"
        fill="${darkColor}" text-anchor="middle" direction="rtl">${esc(ticketLabel)}</text>

  <!-- Event name -->
  <text x="${CARD_W / 2}" y="108"
        font-family="Noto Sans Arabic,Noto Sans,DejaVu Sans,sans-serif" font-size="18"
        fill="${mutedColor}" text-anchor="middle" direction="rtl">${esc(eventName)}</text>

  <!-- Decorative separator line -->
  <line x1="80" y1="128" x2="${CARD_W - 80}" y2="128"
        stroke="${mutedColor}" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Calendar icon (date side, centered at x=220) -->
  <g transform="translate(98, 155)" stroke="${darkColor}" stroke-width="1.8"
     fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="0" y="3" width="22" height="20" rx="4"/>
    <line x1="0"  y1="9"  x2="22" y2="9"/>
    <line x1="7"  y1="0"  x2="7"  y2="5"/>
    <line x1="15" y1="0"  x2="15" y2="5"/>
  </g>
  <text x="132" y="178"
        font-family="Noto Sans Arabic,Noto Sans,DejaVu Sans,sans-serif" font-size="30" font-weight="700"
        fill="${darkColor}" text-anchor="start">${esc(eventDate)}</text>

  <!-- Dot separator -->
  <text x="${CARD_W / 2}" y="178"
        font-family="Noto Sans Arabic,Noto Sans,DejaVu Sans,sans-serif" font-size="30" font-weight="700"
        fill="${mutedColor}" text-anchor="middle">·</text>

  <!-- Clock icon (time side) -->
  <g transform="translate(${CARD_W / 2 + 45}, 155)" stroke="${darkColor}" stroke-width="1.8"
     fill="none" stroke-linecap="round">
    <circle cx="11" cy="11" r="11"/>
    <line x1="11" y1="11" x2="11" y2="5"/>
    <line x1="11" y1="11" x2="16" y2="11"/>
  </g>
  <text x="${CARD_W / 2 + 70}" y="178"
        font-family="Noto Sans Arabic,Noto Sans,DejaVu Sans,sans-serif" font-size="30" font-weight="700"
        fill="${darkColor}" text-anchor="start">${esc(eventTime)}</text>

  <!-- Token code -->
  <text x="${CARD_W / 2}" y="818"
        font-family="Courier New,Courier,monospace" font-size="22" font-weight="bold"
        letter-spacing="5" fill="${darkColor}" text-anchor="middle">${esc(tokenDisplay)}</text>

  <!-- Perforated line -->
  <line x1="30" y1="${PERF_Y}" x2="${CARD_W - 30}" y2="${PERF_Y}"
        stroke="${darkColor}" stroke-width="1.2" stroke-dasharray="9,7" opacity="0.35"/>

  <!-- Side notches on perforation (left & right semicircles) -->
  <circle cx="0"        cy="${PERF_Y}" r="16" fill="${lightBg}"/>
  <circle cx="${CARD_W}" cy="${PERF_Y}" r="16" fill="${lightBg}"/>

  <!-- Stub hint text -->
  <text x="${CARD_W / 2}" y="${PERF_Y + 60}"
        font-family="Noto Sans Arabic,Noto Sans,DejaVu Sans,sans-serif" font-size="15"
        fill="${mutedColor}" text-anchor="middle" direction="rtl">الرجاء إبراز البطاقة عند الدخول</text>
</svg>`;

  // ── 6. Compose ─────────────────────────────────────────────────────────────
  const card = await sharp(base)
    .composite([
      { input: qrBuffer,          top: QR_TOP,  left: QR_LEFT },
      { input: Buffer.from(svg),  top: 0,       left: 0 },
    ])
    .png()
    .toBuffer();

  console.log(`[generator] card built label=${label} size=${card.length} bytes`);
  return card;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
