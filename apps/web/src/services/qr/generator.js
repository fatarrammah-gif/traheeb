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

// ── Font: Amiri committed to repo — zero system dependencies ─────────────────
// Amiri is a classical Arabic typeface with complete Unicode Presentation Forms
// coverage, making it ideal for use with arabic-reshaper + FreeType.
let _fontRegistered = false;
const _fontFamily = '"Amiri", serif';

function ensureFont() {
  if (_fontRegistered) return;
  _fontRegistered = true;

  // Resolve font dir relative to this source file (works in dev and production)
  const base = join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
  const reg  = join(base, 'Amiri-Regular.ttf');
  const bold = join(base, 'Amiri-Bold.ttf');

  // Fallback: try process.cwd()-relative path (Railway production)
  const cwdBase = join(process.cwd(), 'src/assets/fonts');
  const regCwd  = join(cwdBase, 'Amiri-Regular.ttf');
  const boldCwd = join(cwdBase, 'Amiri-Bold.ttf');

  const regPath  = existsSync(reg)  ? reg  : existsSync(regCwd)  ? regCwd  : null;
  const boldPath = existsSync(bold) ? bold : existsSync(boldCwd) ? boldCwd : null;

  if (regPath)  registerFont(regPath,  { family: 'Amiri', weight: 'normal' });
  if (boldPath) registerFont(boldPath, { family: 'Amiri', weight: 'bold'   });

  console.log(`[generator] Amiri font: regular=${regPath ?? 'NOT FOUND'} bold=${boldPath ?? 'NOT FOUND'}`);
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

  // ── 3. Main canvas ──────────────────────────────────────────────────────────
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = lightBg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = stubBg;
  ctx.fillRect(0, PERF_Y, CARD_W, CARD_H - PERF_Y);

  // QR
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

  // ── 4. Text — shaped Arabic rendered via FreeType ───────────────────────────
  // arabic-reshaper produces correct glyph forms; ctx.direction='rtl' makes
  // the canvas paint them right-to-left so the text reads naturally.
  ctx.direction = 'rtl';

  const ticketLabel = label === 'main'
    ? 'تذكرة دخول: المستضيف الرئيسي'
    : 'تذكرة دخول: مرافق';

  // Ticket label
  ctx.font      = `bold 26px ${_fontFamily}`;
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText(ar(ticketLabel), CARD_W / 2, 65);

  // Event name
  ctx.font      = `18px ${_fontFamily}`;
  ctx.fillStyle = mutedRgba;
  ctx.textAlign = 'center';
  ctx.fillText(ar(String(eventName ?? '')), CARD_W / 2, 105);

  // Calendar icon
  const calIconX = 740, calIconY = 152;
  drawCalendarIcon(ctx, calIconX, calIconY, darkColor);

  // Date (right-aligned before calendar icon)
  ctx.font      = `bold 30px ${_fontFamily}`;
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'right';
  ctx.fillText(ar(String(eventDate ?? '')), calIconX - 8, 175);

  // Dot
  ctx.font      = 'bold 30px sans-serif';
  ctx.fillStyle = mutedRgba;
  ctx.textAlign = 'center';
  ctx.fillText('·', CARD_W / 2, 175);

  // Time (left-aligned) + clock icon
  const timeText   = ar(String(eventTime ?? ''));
  ctx.font         = `bold 30px ${_fontFamily}`;
  ctx.fillStyle    = darkColor;
  ctx.textAlign    = 'left';
  ctx.fillText(timeText, 60, 175);
  const timeWidth  = ctx.measureText(timeText).width;
  drawClockIcon(ctx, 60 + timeWidth + 10, 152, darkColor);

  // Token code
  const tokenDisplay = token.slice(0, 12).toUpperCase()
    .replace(/(.{4})/g, '$1 ').trim();
  ctx.font      = 'bold 22px monospace';
  ctx.fillStyle = darkColor;
  ctx.textAlign = 'center';
  ctx.fillText(tokenDisplay, CARD_W / 2, 820);

  // Stub text
  ctx.font      = `15px ${_fontFamily}`;
  ctx.fillStyle = mutedRgba;
  ctx.textAlign = 'center';
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

function drawCalendarIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.8;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  roundedRect(ctx, x, y + 3, 22, 20, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,      y + 9); ctx.lineTo(x + 22, y + 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 7,  y);     ctx.lineTo(x + 7,  y + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 15, y);     ctx.lineTo(x + 15, y + 5); ctx.stroke();
  ctx.restore();
}

function drawClockIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x + 11, y + 11, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 11, y + 11); ctx.lineTo(x + 11, y + 5);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 11, y + 11); ctx.lineTo(x + 16, y + 11); ctx.stroke();
  ctx.restore();
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
