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
import bidiJs         from 'bidi-js';
import { execSync }   from 'child_process';
import { existsSync } from 'fs';
import { extractDarkestColor, extractLightBgColor, lightenHex } from './colorExtractor.js';

// ── Arabic text pipeline ──────────────────────────────────────────────────────
// 1. arabic-reshaper  → each letter replaced with its correct contextual form
//    (isolated / initial / medial / final) as a Unicode Presentation Form char
// 2. bidi-js          → reorders chars into visual left-to-right paint order
// Rendered with ctx.direction = 'ltr' so FreeType paints the pre-ordered glyphs
// exactly as provided, with no additional BiDi or shaping applied.
const _bidi = bidiJs();

function ar(text) {
  const s = String(text ?? '');
  if (!s.trim()) return s;
  try {
    const reshaped = arabicReshaper.convertArabic(s);
    return _bidi.getReorderedString(reshaped, _bidi.getEmbeddingLevels(reshaped, 'rtl'));
  } catch (e) {
    console.warn('[generator] arabic shaping error:', e.message);
    return s;
  }
}

// ── Font registration — find Noto Arabic via fontconfig at startup ─────────────
let _fontRegistered = false;
let _fontFamily = 'sans-serif';

function ensureFont() {
  if (_fontRegistered) return;
  _fontRegistered = true;
  const queries = [
    'Noto Naskh Arabic:lang=ar',
    'Noto Sans Arabic:lang=ar',
    ':lang=ar',
  ];
  for (const q of queries) {
    try {
      const path = execSync(`fc-match "${q}" --format="%{file}"`, { encoding: 'utf8' }).trim();
      if (path && existsSync(path)) {
        registerFont(path, { family: 'NotoArabic', weight: 'normal' });
        // Bold variant
        try {
          const bold = execSync(`fc-match "${q}:weight=bold" --format="%{file}"`, { encoding: 'utf8' }).trim();
          if (bold && existsSync(bold) && bold !== path) {
            registerFont(bold, { family: 'NotoArabic', weight: 'bold' });
          }
        } catch { /* ignore */ }
        _fontFamily = '"NotoArabic", sans-serif';
        console.log(`[generator] registered arabic font: ${path}`);
        return;
      }
    } catch { /* try next */ }
  }
  console.warn('[generator] no Arabic font found via fc-match — text may render incorrectly');
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
  // All Arabic text is pre-shaped (arabic-reshaper + bidi) so ctx.direction='ltr'
  // is used throughout; FreeType maps each presentation-form codepoint to the
  // correct glyph without needing Pango/HarfBuzz.
  ctx.direction = 'ltr';

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
