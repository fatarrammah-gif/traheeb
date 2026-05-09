/**
 * Server-side Uploadcare upload utility.
 * Accepts a base64 data URI, uploads to Uploadcare CDN, returns the public URL.
 */

const PUB_KEY = process.env.UPLOADCARE_PUBLIC_KEY;

/**
 * Upload a base64 data URI to Uploadcare.
 * Returns the CDN URL (https://ucarecdn.com/{uuid}/) or null if skipped.
 * Throws if the upload fails.
 */
export async function uploadToUploadcare(dataUri) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  if (!PUB_KEY) throw new Error('UPLOADCARE_PUBLIC_KEY is not set');

  // Parse data URI → buffer
  const [header, b64] = dataUri.split(',');
  const mimeType = header.replace('data:', '').replace(';base64', '');
  const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'jpg';
  const buffer = Buffer.from(b64, 'base64');

  // Build multipart/form-data manually (no extra deps)
  const boundary = `----FormBoundary${Date.now()}`;
  const filename = `upload.${ext}`;

  const preamble = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="UPLOADCARE_PUB_KEY"\r\n\r\n`,
    `${PUB_KEY}\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="UPLOADCARE_STORE"\r\n\r\n`,
    `1\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`,
  ].join('');

  const epilogue = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(preamble),
    buffer,
    Buffer.from(epilogue),
  ]);

  const res = await fetch('https://upload.uploadcare.com/base/', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Uploadcare error ${res.status}: ${text}`);
  }

  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Uploadcare invalid response: ${text}`);
  }

  if (!data.file) {
    throw new Error(`Uploadcare missing file UUID: ${text}`);
  }

  const cdnUrl = `https://ucarecdn.com/${data.file}/`;

  // Verify the file is actually accessible on the CDN before returning
  const check = await fetch(cdnUrl, { method: 'HEAD' });
  if (!check.ok) {
    throw new Error(
      `Uploadcare CDN returned ${check.status} for ${cdnUrl} — ` +
      `ensure Built-in Storage is enabled at app.uploadcare.com/projects/${PUB_KEY}/settings/storage/`
    );
  }

  return cdnUrl;
}
