/**
 * Extract the dominant non-white, non-transparent color from an image buffer.
 * Returns a hex color string like '#C8005A'.
 * Falls back to '#1A0910' (dark) if extraction fails.
 */
import sharp from 'sharp';

const FALLBACK = '#1A0910';

export async function extractDominantColor(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Map();

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip near-white and near-black pixels
      const brightness = (r + g + b) / 3;
      if (brightness > 230 || brightness < 20) continue;

      // Quantize to reduce noise
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;

      pixels.set(key, (pixels.get(key) ?? 0) + 1);
    }

    if (pixels.size === 0) return FALLBACK;

    // Find the most frequent color bucket
    let bestKey = null;
    let bestCount = 0;
    for (const [key, count] of pixels) {
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    }

    const [r, g, b] = bestKey.split(',').map(Number);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return FALLBACK;
  }
}
