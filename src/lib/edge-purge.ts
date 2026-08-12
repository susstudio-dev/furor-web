import 'server-only';
import { absoluteUrls, chunk } from './public-urls';
import { SITE_URL } from './seo';

// Public routes gain a 60s edge cache (spec decision #11) so an Instagram
// burst hits Cloudflare instead of the Worker. The freshness promise is kept
// by purging on save: an owner edit is visible immediately, and only anonymous
// visitors who arrive between the edit and the purge see up to 60s-old HTML.
//
// Unconfigured is a no-op, not an error. Dev has no zone, and a deploy without
// the token must still be able to save.
const PURGE_BATCH = 30; // Cloudflare's per-request file limit

// Cold-start-scoped, not per-call: a Worker isolate serves many requests
// before it recycles, so without this a single missing secret would log on
// every save for the isolate's whole lifetime.
let warnedMissingSecrets = false;

export async function purgeEdgeCache(paths: string[]): Promise<void> {
  const zone = process.env.CF_ZONE_ID;
  const token = process.env.CF_PURGE_TOKEN;
  if (paths.length === 0) return;
  if (!zone || !token) {
    // Dev intentionally has no zone, and must stay quiet about it. Production
    // without a token is a live misconfiguration: PRODUCT.md promises an
    // owner edit is immediate, and a missing secret silently downgrades that
    // to "up to 60s stale" with no other signal anywhere. Gate on production
    // (mirrors the NODE_ENV checks already in next.config.mjs) so dev stays
    // silent, and log once per cold start so a live misconfiguration is
    // observable without spamming the log on every save.
    if (process.env.NODE_ENV === 'production' && !warnedMissingSecrets) {
      warnedMissingSecrets = true;
      console.warn(
        'edge purge skipped: CF_ZONE_ID/CF_PURGE_TOKEN not set — saves will not purge the edge cache, so a public edit may sit behind it for up to 60s',
      );
    }
    return;
  }

  const urls = absoluteUrls(paths, SITE_URL);
  for (const files of chunk(urls, PURGE_BATCH)) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) {
        // Never fail the save on this. A stale edge entry expires in 60s
        // anyway; a 500 on save loses the owner's work.
        console.warn(`edge purge returned ${res.status} for ${files.length} urls`);
      }
    } catch (err) {
      console.warn('edge purge failed (non-fatal):', err);
    }
  }
}
