/**
 * POST /api/loc/resolve
 * Resolves a Google Maps short URL (maps.app.goo.gl, goo.gl) server-side,
 * follows all redirects, then extracts lat/lng from the final URL.
 * No auth required — only fetches public Google URLs.
 */

export async function POST(request) {
  let url;
  try {
    ({ url } = await request.json());
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'url required' }, { status: 400 });
  }

  // Only allow Google Maps domains
  const allowed = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|www\.google\.com\/maps|google\.com\/maps)/i;
  if (!allowed.test(url.trim())) {
    return Response.json({ error: 'only Google Maps URLs are supported' }, { status: 400 });
  }

  try {
    const finalUrl = await followRedirects(url.trim());
    const coords   = extractCoords(finalUrl);
    return Response.json({ finalUrl, coords });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function followRedirects(url, maxHops = 8) {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',          // handle redirects manually so we see each hop
      signal: AbortSignal.timeout(8_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const loc = res.headers.get('location');

    if ((res.status >= 300 && res.status < 400) && loc) {
      // Resolve relative redirects
      current = loc.startsWith('http') ? loc : new URL(loc, current).href;
      continue;
    }

    // Not a redirect — this is the final URL
    // Some Google responses return 200 but set a canonical URL in the headers
    return res.url || current;
  }
  return current;
}

function extractCoords(url) {
  if (!url) return null;

  // Format: /@lat,lng  or  @lat,lng,zoom
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // Format: ?q=lat,lng  or  &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // Format: !3dlat!4dlng
  const dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dMatch) return { lat: parseFloat(dMatch[1]), lng: parseFloat(dMatch[2]) };

  // Format: ll=lat,lng
  const llMatch = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

  return null;
}
