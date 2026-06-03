/**
 * Extract the darkest non-black color from an image buffer.
 * "Darkest" = lowest brightness among colors that appear frequently enough.
 * Falls back to '#1A0910' if extraction fails.
 */
import sharp from 'sharp';

const FALLBACK = '#1A0910';

export async function extractDarkestColor(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = data.length / 3;
    const pixels = new Map();

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      // Skip near-white and pure-black pixels
      if (brightness > 220 || brightness < 15) continue;

      // Quantize to reduce noise
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      pixels.set(key, (pixels.get(key) ?? 0) + 1);
    }

    if (pixels.size === 0) return FALLBACK;

    // Only consider colors that appear in at least 0.5% of pixels
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

    // Fallback: most frequent color if none met the threshold
    if (!darkestKey) {
      let bestKey = null, bestCount = 0;
      for (const [key, count] of pixels) {
        if (count > bestCount) { bestCount = count; bestKey = key; }
      }
      darkestKey = bestKey;
    }

    if (!darkestKey) return FALLBACK;

    const [r, g, b] = darkestKey.split(',').map(Number);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch {
    return FALLBACK;
  }
}
