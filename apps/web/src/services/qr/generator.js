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

// ── Background-image layout (fixed percentage zones) ─────────────────────────
// Zone        %    px (at 1050)   Content
// ─────────── ──── ────────────── ───────────────────────────────────────────
// Header      25%  0   – 262      nothing printed
// Top texts   20%  263 – 472      label, event name, date, time  (small fonts)
// QR section  27%  473 – 756      QR code + golden border
// Bot texts   13%  757 – 893      token code + entrance instruction
// Footer      15%  894 – 1050     nothing printed
function computeBgLayout(cardH) {
  const headerEnd   = Math.round(cardH * 0.25);   // 263
  const textsTopEnd = Math.round(cardH * 0.45);   // 473
  const qrSectEnd   = Math.round(cardH * 0.72);   // 756
  const footerStart = Math.round(cardH * 0.85);   // 893

  // QR fills its section minus border padding on each side
  const qrH    = qrSectEnd - textsTopEnd;          // 283
  const qrSize = qrH - 2 * BORDER_PAD;             // 259
  const qrTop  = textsTopEnd + BORDER_PAD;         // 485
  const qrLeft = Math.round((800 - qrSize) / 2);   // 271

  // Top-text baselines inside the 210 px band
  // Fonts: label=34px Amiri, name=22px Amiri, date/time=32px Cairo bold
  const labelY = headerEnd + 18 + 34;   // 315
  const nameY  = labelY + 8 + 22;       // 345
  const dateY  = nameY + 10 + 32;       // 387
  const timeY  = dateY + 6 + 32;        // 425

  // Bottom-text baselines — small gap to fit inside the 137 px band
  const tokenY = qrSectEnd + 28;        // 784
  const stubY  = tokenY + 22;           // 806

  return { headerEnd, textsTopEnd, qrSectEnd, footerStart,
           qrSize, qrTop, qrLeft,
           labelY, nameY, dateY, timeY, tokenY, stubY };
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

  const hasBg = !!bgBuffer;

  if (hasBg) {
    // ── Background image mode ──────────────────────────────────────────────
    // Layout uses fixed percentages: header=25%, footer=14%, middle=61%
    // Middle split: top-texts=30%, qr=44.5%, bot-texts=25.5%
    const bg = computeBgLayout(CARD_H);

    // Draw background image stretched to fill the card
    const bgFilled = await sharp(bgBuffer)
      .resize(CARD_W, CARD_H, { fit: 'fill' })
      .png().toBuffer();
    ctx.drawImage(await loadImage(bgFilled), 0, 0);

    // QR white backing + QR image (scaled to bg layout size)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bg.qrLeft, bg.qrTop, bg.qrSize, bg.qrSize);
    ctx.drawImage(qrCanvas, bg.qrLeft, bg.qrTop, bg.qrSize, bg.qrSize);

    // Golden border around QR
    const bx = bg.qrLeft - BORDER_PAD, by = bg.qrTop - BORDER_PAD;
    const bw = bg.qrSize + BORDER_PAD * 2, bh = bg.qrSize + BORDER_PAD * 2;
    const goldGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    goldGrad.addColorStop(0,    '#FFF5A0');
    goldGrad.addColorStop(0.35, '#DAA520');
    goldGrad.addColorStop(0.7,  '#C8860A');
    goldGrad.addColorStop(1,    '#FFE070');
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth   = 8;
    roundedRect(ctx, bx, by, bw, bh, 16);
    ctx.stroke();

    // ── Text ────────────────────────────────────────────────────────────────
    ctx.direction = 'rtl';

    const ticketLabel = label === 'main'
      ? 'تذكرة دخول: المستضيف الرئيسي'
      : 'تذكرة دخول: مرافق';

    // Ticket label — 34px Amiri, black, with underline (smaller to fit 20% band)
    ctx.font      = `34px ${_fontFamily}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    const labelStr   = ar(ticketLabel);
    const labelWidth = ctx.measureText(labelStr).width;
    ctx.fillText(labelStr, CARD_W / 2, bg.labelY);
    ctx.save();
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2 - labelWidth / 2, bg.labelY + 6);
    ctx.lineTo(CARD_W / 2 + labelWidth / 2, bg.labelY + 6);
    ctx.stroke();
    ctx.restore();

    // Event name — 22px Amiri
    ctx.font      = `22px ${_fontFamily}`;
    ctx.fillStyle = darkColor;
    ctx.textAlign = 'center';
    ctx.fillText(ar(String(eventName ?? '')), CARD_W / 2, bg.nameY);

    // Date + Time with icons — 32px Cairo bold
    const BG_ICON_SZ = 28, BG_ICON_GAP = 12;
    ctx.font = `bold 32px ${_dateTimeFontFamily}`;

    const bgDateStr = arSmart(String(eventDate ?? ''));
    const bgTimeStr = arSmart(normalizeAmPm(String(eventTime ?? '')));
    const bgDateW   = ctx.measureText(bgDateStr).width;
    const bgTimeW   = ctx.measureText(bgTimeStr).width;

    const bgBlockW    = Math.max(bgDateW, bgTimeW) + BG_ICON_GAP + BG_ICON_SZ;
    const bgBlockLeft = Math.round(CARD_W / 2 - bgBlockW / 2);
    const bgTextRight = bgBlockLeft + Math.max(bgDateW, bgTimeW);
    const bgIconLeft  = bgTextRight + BG_ICON_GAP;

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';

    ctx.direction = 'rtl';
    drawCalendarIcon(ctx, bgIconLeft, bg.dateY - BG_ICON_SZ, GOLD_TEXT, BG_ICON_SZ);
    ctx.fillText(bgDateStr, bgTextRight, bg.dateY);

    ctx.direction = 'ltr';
    drawClockIcon(ctx, bgIconLeft, bg.timeY - BG_ICON_SZ, GOLD_TEXT, BG_ICON_SZ);
    ctx.fillText(bgTimeStr, bgTextRight, bg.timeY);

    ctx.direction = 'rtl';

    // Token code — 22px monospace
    const bgTokenDisplay = token.slice(0, 12).toUpperCase()
      .replace(/(.{4})/g, '$1 ').trim();
    ctx.font      = 'bold 22px monospace';
    ctx.fillStyle = darkColor;
    ctx.textAlign = 'center';
    ctx.fillText(bgTokenDisplay, CARD_W / 2, bg.tokenY);

    // Stub text — 20px Amiri bold, small gap above
    ctx.font      = `bold 20px ${_fontFamily}`;
    ctx.fillStyle = darkColor;
    ctx.textAlign = 'center';
    ctx.fillText(ar('الرجاء إبراز البطاقة عند الدخول'), CARD_W / 2, bg.stubY);

    console.log(`[generator] bg mode: headerEnd=${bg.headerEnd} footerStart=${bg.footerStart} qrTop=${bg.qrTop} qrSize=${bg.qrSize}`);

  } else {
    // ── Default ticket mode ────────────────────────────────────────────────
    // Solid background with golden decorations
    ctx.fillStyle = lightBg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.fillStyle = GOLD_STUB_BG;
    ctx.fillRect(0, PERF_Y, CARD_W, CARD_H - PERF_Y);

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

    // ── Text ──────────────────────────────────────────────────────────────
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

    // ── Date + Time ──────────────────────────────────────────────────────────
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

    // Date — RTL direction
    ctx.direction = 'rtl';
    drawCalendarIcon(ctx, iconLeft, DATE_Y - 38, GOLD_TEXT, ICON_SZ);
    ctx.fillText(dateStr, textRight, DATE_Y);

    // Time — LTR so "7:00 AM" renders with AM on the right
    ctx.direction = 'ltr';
    drawClockIcon(ctx, iconLeft, TIME_Y - 38, GOLD_TEXT, ICON_SZ);
    ctx.fillText(timeStr, textRight, TIME_Y);

    ctx.direction = 'rtl';

    // Token code
    const tokenDisplay = token.slice(0, 12).toUpperCase()
      .replace(/(.{4})/g, '$1 ').trim();
    ctx.font      = 'bold 28px monospace';
    ctx.fillStyle = darkColor;
    ctx.textAlign = 'center';
    ctx.fillText(tokenDisplay, CARD_W / 2, 878);

    // Stub text
    ctx.font      = `bold 26px ${_fontFamily}`;
    ctx.fillStyle = darkColor;
    ctx.textAlign = 'center';
    ctx.fillText(ar('الرجاء إبراز البطاقة عند الدخول'), CARD_W / 2, PERF_Y + 55);
  }

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
