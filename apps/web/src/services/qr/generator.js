/**
 * QR card generator — ticket-style PNG (800 × 1050 px)
 *
 * Text shaping strategy:
 *   arabic-reshaper  →  converts Arabic to Unicode Presentation Form codepoints
 *   bidi-js          →  reorders characters into visual LTR order
 *   node-canvas      →  renders each glyph directly via FreeType (no Pango needed)
 *   Noto Naskh Arabic or Noto Sans Arabic (found via fc-match) has full
 *   Arabic Presentation Forms coverage so FreeType maps each codepoint to
 *   the correct connected glyph.
 */
import { createCanvas, registerFont, loadImage } from 'canvas';
import QRCode         from 'qrcode';
import sharp          from 'sharp';
import arabicReshaper from 'arabic-reshaper';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

// ── Arabic text pipeline ──────────────────────────────────────────────────────
// arabic-reshaper converts each letter to its correct contextual Unicode
// Presentation Form (initial / medial / final / isolated). We then render
// with ctx.direction = 'rtl' so the canvas paints glyphs right-to-left.
// Amiri font has full Presentation Forms coverage → FreeType maps each
// codepoint directly to the correct connected glyph without needing Pango.
function ar(text) {
  const s = String(text ?? '');
  if (!s.trim()) return s;
  try {
    return arabicReshaper.convertArabic(s);
  } catch (e) {
    console.warn('[generator] arabic shaping error:', e.message);
    return s;
  }
}

// Only reshape if the string actually contains Arabic characters.
// Purely Latin / numeric strings (e.g. "7:00 AM") are returned as-is.
function arSmart(text) {
  const s = String(text ?? '');
  const hasArabic = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
  return hasArabic ? ar(s) : s;
}

// Replace Arabic AM/PM markers with English equivalents before rendering.
function normalizeAmPm(text) {
  return String(text ?? '')
    .replace(/صباحاً|صباحا|صباح/g, 'AM')
    .replace(/مساءً|مساءا|مساء/g, 'PM')
    .replace(/ ص( |$)/g, ' AM$1')
    .replace(/ م( |$)/g, ' PM$1')
    .replace(/^ص( |$)/g, 'AM$1')
    .replace(/^م( |$)/g, 'PM$1');
}

// ── Fonts committed to repo — zero system dependencies ───────────────────────
// Amiri: classical Arabic typeface, full Presentation Forms → body/label text
// Cairo: modern geometric Arabic typeface → date/time (distinct style)
let _fontRegistered = false;
const _fontFamily         = '"Amiri", serif';
const _dateTimeFontFamily = '"Cairo", "Amiri", serif';

function ensureFont() {
  if (_fontRegistered) return;
  _fontRegistered = true;

  const base    = join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
  const cwdBase = join(process.cwd(), 'src/assets/fonts');

  const resolve = (name) => {
    const p1 = join(base, name), p2 = join(cwdBase, name);
    return existsSync(p1) ? p1 : existsSync(p2) ? p2 : null;
  };

  const regPath   = resolve('Amiri-Regular.ttf');
  const boldPath  = resolve('Amiri-Bold.ttf');
  const cairoPath = resolve('Cairo.ttf');

  if (regPath)   registerFont(regPath,   { family: 'Amiri', weight: 'normal' });
  if (boldPath)  registerFont(boldPath,  { family: 'Amiri', weight: 'bold'   });
  if (cairoPath) {
    registerFont(cairoPath, { family: 'Cairo', weight: 'normal' });
    registerFont(cairoPath, { family: 'Cairo', weight: 'bold'   });
  }

  console.log(`[generator] fonts: Amiri-reg=${regPath ?? 'NOT FOUND'} Amiri-bold=${boldPath ?? 'NOT FOUND'} Cairo=${cairoPath ?? 'NOT FOUND'}`);
}

// ── Content-zone detector ─────────────────────────────────────────────────────
// Measures per-row VARIANCE (design complexity) to locate the header and footer
// regions. Headers/footers have high variance (logos, colours, patterns).
// The empty middle area has low variance (plain/white background).
async function detectContentZone(bgBuffer, cardH) {
  try {
    const SAMPLE_W = 80;
    const { data, info } = await sharp(bgBuffer)
      .resize(SAMPLE_W, cardH, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const h = info.height;

    // Per-row variance (0 = perfectly uniform, high = complex design)
    const rowVar = Array.from({ length: h }, (_, y) => {
      let sum = 0, sumSq = 0;
      for (let x = 0; x < SAMPLE_W; x++) {
        const v = data[y * SAMPLE_W + x];
        sum += v; sumSq += v * v;
      }
      const mean = sum / SAMPLE_W;
      return sumSq / SAMPLE_W - mean * mean;
    });

    // Smooth with a 15-row window
    const smooth = rowVar.map((_, i) => {
      let s = 0, n = 0;
      for (let k = Math.max(0, i - 7); k <= Math.min(h - 1, i + 7); k++) { s += rowVar[k]; n++; }
      return s / n;
    });

    // Threshold = 40th-percentile variance → rows below this are "empty"
    const sorted = [...smooth].sort((a, b) => a - b);
    const threshold = sorted[Math.floor(h * 0.40)];

    // Header end: scan top-down; first stable run of low-variance rows
    let headerEnd = 0;
    for (let y = 0; y < h; y++) {
      if (smooth[y] > threshold) { headerEnd = y + 1; continue; }
      // Check this low-variance run lasts at least 40 rows
      let run = 0;
      for (let k = y; k < Math.min(h, y + 40); k++) { if (smooth[k] <= threshold) run++; }
      if (run >= 35) break;
      headerEnd = y + 1;
    }

    // Footer start: scan bottom-up; same logic
    let footerStart = h;
    for (let y = h - 1; y >= 0; y--) {
      if (smooth[y] > threshold) { footerStart = y; continue; }
      let run = 0;
      for (let k = y; k > Math.max(0, y - 40); k--) { if (smooth[k] <= threshold) run++; }
      if (run >= 35) break;
      footerStart = y;
    }

    const startY = Math.min(headerEnd + 8, Math.floor(h * 0.35));
    const endY   = Math.max(footerStart - 8, Math.floor(h * 0.65));

    if (startY >= endY - 80) {
      console.warn('[generator] zone detection inconclusive, using full card');
      return { startY: 0, endY: cardH };
    }

    console.log(`[generator] zone: header ends ${headerEnd}, footer starts ${footerStart} → content ${startY}–${endY}`);
    return { startY, endY };
  } catch (err) {
    console.warn('[generator] detectContentZone error:', err.message);
    return { startY: 0, endY: cardH };
  }
}

// ── Card dimensions ───────────────────────────────────────────────────────────
const CARD_W     = 800;
const CARD_H     = 1050;
const QR_SIZE    = 440;
const QR_LEFT    = Math.round((CARD_W - QR_SIZE) / 2);
const QR_TOP     = 360;   // lower QR → more space for enlarged header
const BORDER_PAD = 12;
const PERF_Y     = 940;   // smaller bottom stub section

// ── Gold palette ──────────────────────────────────────────────────────────────
const GOLD_TEXT    = '#8B6914';            // icons only
const GOLD_LINE    = '#DAA520';            // dotted lines (full gold)
const GOLD_STUB_BG = '#FFF8E1';            // light golden stub background

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
  ensureFont();

  // ── 1. Colors ───────────────────────────────────────────────────────────────
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
    type: 'svg', width: QR_SIZE, margin: 0,
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

  // ── 3. Main canvas ──────────────────────────────────────────────────────────
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx    = canvas.getContext('2d');

  // ── Background & y-offset ────────────────────────────────────────────────────
  // hasBg = caller provided a background image → skip ticket decorations,
  //         detect empty zone, shift all content into that zone.
  const hasBg = !!bgBuffer;
  let yOff = 0;  // vertical shift applied to all content via ctx.translate

  if (hasBg) {
    // Draw the full image stretched to fill the card (no cropping, no forced square)
    const bgFilled = await sharp(bgBuffer)
      .resize(CARD_W, CARD_H, { fit: 'fill' })
      .png().toBuffer();
    ctx.drawImage(await loadImage(bgFilled), 0, 0);

    // Detect where header ends and footer starts using variance analysis
    const zone       = await detectContentZone(bgBuffer, CARD_H);
    const zoneCenter = (zone.startY + zone.endY) / 2;
    const naturalQrCenter = QR_TOP + QR_SIZE / 2;  // 360 + 220 = 580
    yOff = Math.round(zoneCenter - naturalQrCenter);
    // Clamp: ensure ticket label (≈y=18) and stub text (≈y=995) stay on card
    let cTop = 18 + yOff, cBot = (PERF_Y + 55) + yOff;
    if (cTop < 10)           yOff -= cTop - 10;
    if (cBot > CARD_H - 10)  yOff -= cBot - (CARD_H - 10);
    console.log(`[generator] bg mode: zone=${zone.startY}-${zone.endY} yOff=${yOff}`);
  } else {
    // Solid ticket background — draw before translate (no yOff needed)
    ctx.fillStyle = lightBg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.fillStyle = GOLD_STUB_BG;
    ctx.fillRect(0, PERF_Y, CARD_W, CARD_H - PERF_Y);
  }

  // ── Apply content offset ─────────────────────────────────────────────────────
  // All content below (QR, border, texts) is drawn inside this translate block
  // so that yOff centres it in the detected zone (yOff=0 for the default design).
  ctx.save();
  ctx.translate(0, yOff);

  // QR white backing + QR image
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(QR_LEFT, QR_TOP, QR_SIZE, QR_SIZE);
  ctx.drawImage(qrCanvas, QR_LEFT, QR_TOP);

  // Golden border around QR
  const bx = QR_LEFT - BORDER_PAD, by = QR_TOP - BORDER_PAD;
  const bw = QR_SIZE + BORDER_PAD * 2, bh = QR_SIZE + BORDER_PAD * 2;
  const goldGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  goldGrad.addColorStop(0,    '#FFF5A0');
  goldGrad.addColorStop(0.35, '#DAA520');
  goldGrad.addColorStop(0.7,  '#C8860A');
  goldGrad.addColorStop(1,    '#FFE070');
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth   = 8;
  roundedRect(ctx, bx, by, bw, bh, 16);
  ctx.stroke();

  // ── Ticket-only decorations (skipped when background image is provided) ──────
  if (!hasBg) {
    // Dashed separator
    ctx.save();
    ctx.strokeStyle = GOLD_LINE; ctx.lineWidth = 3.5; ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(80, 135); ctx.lineTo(CARD_W - 80, 135); ctx.stroke();
    ctx.restore();

    // Perforated line
    ctx.save();
    ctx.strokeStyle = GOLD_LINE; ctx.lineWidth = 4; ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.moveTo(32, PERF_Y); ctx.lineTo(CARD_W - 32, PERF_Y); ctx.stroke();
    ctx.restore();

    // Notch semicircles
    ctx.fillStyle = lightBg;
    ctx.beginPath(); ctx.arc(0,      PERF_Y, 16, -Math.PI / 2, Math.PI / 2);  ctx.fill();
    ctx.beginPath(); ctx.arc(CARD_W, PERF_Y, 16,  Math.PI / 2, -Math.PI / 2); ctx.fill();
  }

  // ── 4. Text ──────────────────────────────────────────────────────────────────
  ctx.direction = 'rtl';

  const ticketLabel = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : 'تذكرة دخول: مرافق';

  // Ticket label — enlarged, black, with underline
  ctx.font      = `42px ${_fontFamily}`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  const labelStr   = ar(ticketLabel);
  const labelWidth = ctx.measureText(labelStr).width;
  ctx.fillText(labelStr, CARD_W / 2, 68);
  ctx.save();
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2 - labelWidth / 2, 75);
  ctx.lineTo(CARD_W / 2 + labelWidth / 2, 75);
  ctx.stroke();
  ctx.restore();

  // Event name
  ctx.font      = `28px ${_fontFamily}`;
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText(ar(String(eventName ?? '')), CARD_W / 2, 118);

  // ── Date + Time ───────────────────────────────────────────────────────────────
  const DATE_Y  = 213, TIME_Y = 281;
  const ICON_SZ = 36, ICON_GAP = 14;
  const DT_FONT = `bold 52px ${_dateTimeFontFamily}`;

  ctx.font = DT_FONT;

  const dateStr = arSmart(String(eventDate ?? ''));
  const timeStr = arSmart(normalizeAmPm(String(eventTime ?? '')));
  const dateW   = ctx.measureText(dateStr).width;
  const timeW   = ctx.measureText(timeStr).width;

  const blockTextW = Math.max(dateW, timeW);
  const blockW     = blockTextW + ICON_GAP + ICON_SZ;
  const blockLeft  = Math.round(CARD_W / 2 - blockW / 2);
  const textRight  = blockLeft + blockTextW;
  const iconLeft   = textRight + ICON_GAP;

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'right';

  // Date — RTL direction (Arabic date text reads right-to-left)
  ctx.direction = 'rtl';
  drawCalendarIcon(ctx, iconLeft, DATE_Y - 38, GOLD_TEXT, ICON_SZ);
  ctx.fillText(dateStr, textRight, DATE_Y);

  // Time — LTR direction so "7:00 AM" renders left→right with AM at the right
  ctx.direction = 'ltr';
  drawClockIcon(ctx, iconLeft, TIME_Y - 38, GOLD_TEXT, ICON_SZ);
  ctx.fillText(timeStr, textRight, TIME_Y);

  // Restore RTL for remaining Arabic text
  ctx.direction = 'rtl';

  // Token code
  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();
  ctx.font      = 'bold 28px monospace';
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText(tokenDisplay, CARD_W / 2, 878);

  // Stub text — always shown (positioned below the QR stub line)
  ctx.font      = `bold 26px ${_fontFamily}`;
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText(ar('الرجاء إبراز البطاقة عند الدخول'), CARD_W / 2, PERF_Y + 55);

  ctx.restore(); // end translate block

  const card = canvas.toBuffer('image/png');
  console.log(`[generator] card built label=${label} hasBg=${hasBg} size=${card.length} bytes`);
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

function drawCalendarIcon(ctx, x, y, color, size = 22) {
  const s = size / 22;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.8 * s;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  roundedRect(ctx, x, y + 3 * s, 22 * s, 20 * s, 4 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,           y + 9 * s);  ctx.lineTo(x + 22 * s,  y + 9 * s);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 7 * s,  y);           ctx.lineTo(x + 7 * s,  y + 5 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 15 * s, y);           ctx.lineTo(x + 15 * s, y + 5 * s); ctx.stroke();
  ctx.restore();
}

function drawClockIcon(ctx, x, y, color, size = 22) {
  const r = size / 2;
  const cx = x + r, cy = y + r;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.8 * (size / 22); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.45, cy); ctx.stroke();
  ctx.restore();
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
