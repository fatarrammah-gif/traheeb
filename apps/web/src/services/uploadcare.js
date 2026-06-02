/**
 * Server-side media upload utility.
 * Uses ImgBB — free, no storage configuration required, URLs work instantly.
 */

const IMGBB_KEY = process.env.IMGBB_API_KEY;

/**
 * Upload a base64 data URI to ImgBB.
 * Returns a direct image URL or null if no data / no key.
 * Throws if the upload fails.
 */
export async function uploadToUploadcare(dataUri) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  if (!IMGBB_KEY) {
    console.warn('[upload] IMGBB_API_KEY not set — skipping media upload');
    return null;
  }

  // Extract raw base64 (strip the "data:image/jpeg;base64," prefix)
  const b64 = dataUri.split(',')[1];
  if (!b64) return null;

  const params = new URLSearchParams();
  params.append('key', IMGBB_KEY);
  params.append('image', b64);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  let res;
  try {
    res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: params,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`ImgBB error ${res.status}: ${text}`);
  }

  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`ImgBB invalid response: ${text}`);
  }

  if (!data.success || !data.data?.url) {
    throw new Error(`ImgBB upload failed: ${text}`);
  }

  console.log('[upload] ImgBB URL:', data.data.url);
  return data.data.url;
}
