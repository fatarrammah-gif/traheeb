/**
 * QR card generator — ticket-style PNG (800 × 1050 px)
 *
 * Approach:
 *   1. Build gradient QR image via canvas (complex compositing)
 *   2. Render card design as HTML + CSS via Puppeteer (full Arabic support)
 *   3. Screenshot the card element → PNG buffer
 *
 * Arabic text is handled natively by Chrome's text engine — no reshaper needed.
 */
import puppeteer  from 'puppeteer';
import { createCanvas, loadImage } from 'canvas';
import QRCode     from 'qrcode';
import sharp      from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

// ── Puppeteer singleton ───────────────────────────────────────────────────────
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--disable-extensions',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
];

let _browser = null;
async function getBrowser() {
  if (_browser) {
    try { await _browser.pages(); return _browser; } catch { _browser = null; }
  }
  _browser = await puppeteer.launch({ headless: true, args: BROWSER_ARGS });
  console.log('[generator] Puppeteer browser launched');
  return _browser;
}

// ── Arabic font (Cairo) — embedded as base64 for reliable Railway rendering ───
let _fontB64 = null;
function getFontB64() {
  if (_fontB64) return _fontB64;
  const candidates = [
    join(process.cwd(), 'src/assets/fonts/Cairo.ttf'),
    join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts/Cairo.ttf'),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Cairo.ttf not found. Tried:\n${candidates.join('\n')}`);
  _fontB64 = readFileSync(found).toString('base64');
  console.log(`[generator] font loaded from: ${found}`);
  return _fontB64;
}

// ── Card dimensions ───────────────────────────────────────────────────────────
const CARD_W  = 800;
const CARD_H  = 1050;
const QR_SIZE = 460;
const PERF_Y  = 870;

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
  const mutedColor = `rgba(${dR},${dG},${dB},0.5)`;

  // ── 2. Gradient QR code → base64 PNG ────────────────────────────────────────
  const qrDataUrl = await buildGradientQR(token, QR_SIZE, darkColor, logoBuffer);

  // ── 3. Logo → base64 (for header top, optional) ─────────────────────────────
  let logoDataUrl = null;
  if (logoBuffer) {
    const resized = await sharp(logoBuffer)
      .resize(80, 80, { fit: 'inside' })
      .png().toBuffer();
    logoDataUrl = `data:image/png;base64,${resized.toString('base64')}`;
  }

  // ── 4. Build HTML card ───────────────────────────────────────────────────────
  const ticketLabel = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : 'تذكرة دخول: مرافق';

  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();

  const html = buildCardHtml({
    ticketLabel,
    eventName:    String(eventName  ?? ''),
    eventDate:    String(eventDate  ?? ''),
    eventTime:    String(eventTime  ?? ''),
    tokenDisplay,
    qrDataUrl,
    logoDataUrl,
    darkColor,
    lightBg,
    stubBg,
    mutedColor,
  });

  // ── 5. Puppeteer screenshot ──────────────────────────────────────────────────
  const browser = await getBrowser();
  const page    = await browser.newPage();
  try {
    // Forward page console + errors to server log for debugging
    page.on('console', m => console.log(`[page:${m.type()}] ${m.text()}`));
    page.on('pageerror', e => console.error('[page:error]', e.message));

    await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
    console.log('[generator] calling setContent, html length=', html.length);

    await page.setContent(html, { waitUntil: 'networkidle0' });
    console.log('[generator] setContent done, url=', page.url());

    // Wait for custom @font-face (Cairo base64) to finish decoding
    const fontCount = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.size;
    });
    console.log(`[generator] fonts.ready, loaded ${fontCount} font(s)`);

    // Check card element exists and has dimensions
    const dims = await page.evaluate(() => {
      const el = document.getElementById('card');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor };
    });
    console.log('[generator] #card dims:', JSON.stringify(dims));

    // Extra settle time for paint
    await new Promise(r => setTimeout(r, 400));

    const card = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: CARD_W, height: CARD_H },
    });
    console.log(`[generator] card built label=${label} size=${card.length} bytes`);
    return card;
  } finally {
    await page.close();
  }
}

// ── HTML card template ─────────────────────────────────────────────────────────

function buildCardHtml({
  ticketLabel, eventName, eventDate, eventTime, tokenDisplay,
  qrDataUrl, logoDataUrl, darkColor, lightBg, stubBg, mutedColor,
}) {
  const fontB64 = getFontB64();

  const calIcon = `<svg width="22" height="23" viewBox="0 0 22 23" fill="none"
      stroke="${darkColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="0" y="3" width="22" height="20" rx="4"/>
    <line x1="0" y1="9" x2="22" y2="9"/>
    <line x1="7" y1="0" x2="7" y2="5"/>
    <line x1="15" y1="0" x2="15" y2="5"/>
  </svg>`;

  const clkIcon = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"
      stroke="${darkColor}" stroke-width="1.8" stroke-linecap="round">
    <circle cx="11" cy="11" r="10"/>
    <line x1="11" y1="11" x2="11" y2="5"/>
    <line x1="11" y1="11" x2="16" y2="11"/>
  </svg>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Cairo';
    src: url('data:font/truetype;base64,${fontB64}') format('truetype');
    font-weight: 100 900;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${CARD_W}px;
    height: ${CARD_H}px;
    overflow: hidden;
    background: ${lightBg};
    font-family: 'Cairo', sans-serif;
    direction: rtl;
  }

  #card {
    width: ${CARD_W}px;
    height: ${CARD_H}px;
    position: relative;
    background: ${lightBg};
    overflow: hidden;
  }

  /* ── Stub area (below perforation) ─────────────────── */
  .stub-bg {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${CARD_H - PERF_Y}px;
    background: ${stubBg};
  }

  /* ── Header text ────────────────────────────────────── */
  .ticket-label {
    position: absolute;
    top: 38px;
    left: 0; right: 0;
    text-align: center;
    font-size: 26px;
    font-weight: 700;
    color: ${darkColor};
    letter-spacing: 0.5px;
  }

  .event-name {
    position: absolute;
    top: 76px;
    left: 0; right: 0;
    text-align: center;
    font-size: 18px;
    color: ${mutedColor};
  }

  /* ── Dashed separator ───────────────────────────────── */
  .separator {
    position: absolute;
    top: 105px;
    left: 80px; right: 80px;
    border-top: 1px dashed ${mutedColor};
  }

  /* ── Date / time row ────────────────────────────────── */
  .datetime-row {
    position: absolute;
    top: 122px;
    left: 40px; right: 40px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    direction: rtl;
  }

  .date-block, .time-block {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .date-block { flex-direction: row; }   /* icon on left of text (RTL: icon appears after date) */
  .time-block { flex-direction: row-reverse; } /* icon on right of text (RTL: icon appears before time) */

  .date-text, .time-text {
    font-size: 28px;
    font-weight: 700;
    color: ${darkColor};
    line-height: 1;
  }

  .dot-sep {
    font-size: 32px;
    font-weight: 700;
    color: ${mutedColor};
    line-height: 1;
  }

  /* ── QR code with golden border ─────────────────────── */
  .qr-wrapper {
    position: absolute;
    top: 248px;
    left: 50%;
    transform: translateX(-50%);
    padding: 3px;
    border-radius: 18px;
    background: linear-gradient(135deg, #FFF5A0 0%, #DAA520 35%, #C8860A 70%, #FFE070 100%);
    box-shadow: 0 2px 16px rgba(180,130,0,0.18);
  }

  .qr-inner {
    background: #fff;
    border-radius: 15px;
    overflow: hidden;
    display: block;
  }

  .qr-inner img {
    width: ${QR_SIZE}px;
    height: ${QR_SIZE}px;
    display: block;
  }

  /* ── Token code ─────────────────────────────────────── */
  .token-code {
    position: absolute;
    top: 795px;
    left: 0; right: 0;
    text-align: center;
    font-family: monospace;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 3px;
    color: ${darkColor};
    direction: ltr;
  }

  /* ── Perforation line ───────────────────────────────── */
  .perf-line {
    position: absolute;
    top: ${PERF_Y}px;
    left: 32px; right: 32px;
    border-top: 1.2px dashed ${mutedColor};
  }

  /* Notch circles */
  .notch {
    position: absolute;
    top: ${PERF_Y - 16}px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${lightBg};
  }
  .notch-left  { left:  -16px; }
  .notch-right { right: -16px; }

  /* ── Stub text ───────────────────────────────────────── */
  .stub-text {
    position: absolute;
    top: ${PERF_Y + 42}px;
    left: 0; right: 0;
    text-align: center;
    font-size: 15px;
    color: ${mutedColor};
  }
</style>
</head>
<body>
<div id="card">

  <!-- Stub background -->
  <div class="stub-bg"></div>

  <!-- Ticket label -->
  <div class="ticket-label">${escHtml(ticketLabel)}</div>

  <!-- Event name -->
  <div class="event-name">${escHtml(eventName)}</div>

  <!-- Dashed separator -->
  <div class="separator"></div>

  <!-- Date / time row -->
  <div class="datetime-row">
    <div class="date-block">
      ${calIcon}
      <span class="date-text">${escHtml(eventDate)}</span>
    </div>
    <span class="dot-sep">·</span>
    <div class="time-block">
      ${clkIcon}
      <span class="time-text">${escHtml(eventTime)}</span>
    </div>
  </div>

  <!-- QR code with golden border -->
  <div class="qr-wrapper">
    <div class="qr-inner">
      <img src="${qrDataUrl}" alt="QR" />
    </div>
  </div>

  <!-- Token code -->
  <div class="token-code">${escHtml(tokenDisplay)}</div>

  <!-- Perforation -->
  <div class="perf-line"></div>
  <div class="notch notch-left"></div>
  <div class="notch notch-right"></div>

  <!-- Stub text -->
  <div class="stub-text">الرجاء إبراز البطاقة عند الدخول</div>

</div>
</body>
</html>`;
}

// ── Gradient QR builder (canvas) ──────────────────────────────────────────────

async function buildGradientQR(token, size, darkColor, logoBuffer) {
  const qrSvg = await QRCode.toString(token, {
    type: 'svg', width: size, margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF00' },
  });
  const qrTransparent = await sharp(Buffer.from(qrSvg)).resize(size, size).png().toBuffer();

  const qrCanvas = createCanvas(size, size);
  const ctx      = qrCanvas.getContext('2d');

  // White base
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(1, darkColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Clip to QR shape
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(await loadImage(qrTransparent), 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  // Logo in center
  if (logoBuffer) {
    const logoSize = Math.round(size * 0.18);
    const pad = 8;
    const logoBuf = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad,
                background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    const offset = Math.round((size - logoSize - pad * 2) / 2);
    ctx.drawImage(await loadImage(logoBuf), offset, offset);
  }

  const buf = qrCanvas.toBuffer('image/png');
  return `data:image/png;base64,${buf.toString('base64')}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
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
