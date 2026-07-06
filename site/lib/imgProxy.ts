/**
 * Downscaled preview URL for an event/place photo. Event photos come from
 * arbitrary third-party sites at full original resolution, which makes list
 * views slow to load; wsrv.nl (a free public image proxy/CDN) resizes and
 * re-encodes on the fly and caches the result, without us running any image
 * pipeline ourselves.
 */
export function imageThumb(url: string, width: number, height?: number): string {
  const params = new URLSearchParams({ url, w: String(width), fit: 'cover', output: 'webp', q: '80' });
  if (height) params.set('h', String(height));
  return `https://wsrv.nl/?${params.toString()}`;
}
