/**
 * Color extraction utilities for QR card design.
 */
import sharp from 'sharp';

const DARK_FALLBACK  = '#1A0910';
const LIGHT_FALLBACK = '#F5EFF5';

/** Extract the darkest non-black color from an image buffer. */
export async function extractDarkestColor(imageBuffer) {
  try {
    const { data } = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = data.length / 3;
    const pixels = new Map();

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      if (brightness > 220 || brightness < 15) continue;
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      pixels.set(key, (pixels.get(key) ?? 0) + 1);
    }

    if (pixels.size === 0) return DARK_FALLBACK;

    const minCount = Math.max(1, Math.round(totalPixels * 0.005));
    let darkestKey = null;
    let lowestBrightness = Infinity;

    for (const [key, count] of pixels) {
      if (count < minCount) continue;
      const [r, g, b] = key.split(',').map(Number);
      const brightness = (r + g + b) / 3;
      if (brightness < lowestBrightness) {
        lowestBrightness = brightness;
        darkestKey = key;
      }
    }

    if (!darkestKey) {
      let bestKey = null, bestCount = 0;
      for (const [key, count] of pixels) {
        if (count > bestCount) { bestCount = count; bestKey = key; }
      }
      darkestKey = bestKey;
    }

    if (!darkestKey) return DARK_FALLBACK;
    const [r, g, b] = darkestKey.split(',').map(Number);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch (err) {
    console.error('[colorExtractor] darkest failed:', err.message);
    return DARK_FALLBACK;
  }
}

/**
 * Derive a very light background color from the logo.
 * Extracts the most saturated/distinctive color, then pushes it to ~95% lightness.
 */
export async function extractLightBgColor(imageBuffer) {
  try {
    const dark = await extractDarkestColor(imageBuffer);
    return lightenHex(dark, 0.94);
  } catch {
    return LIGHT_FALLBACK;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Push a hex color to a given HSL lightness (0–1). */
export function lightenHex(hex, targetL = 0.94) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  const newS = s * 0.5; // desaturate so background is subtle
  const [nr, ng, nb] = hslToRgb(h, newS, targetL);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = Math.round(l * 255);
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    g = Math.round(hue2rgb(p, q, h) * 255);
    b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  }
  return [r, g, b];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
