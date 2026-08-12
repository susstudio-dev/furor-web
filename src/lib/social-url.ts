// Shape-only validation for the three URLs in site.socials.
//
// WRITE PATH ONLY (integrity.ts), never a Zod refine: content.ts wraps
// SiteContentSchema.parse in a try/catch that falls back to the bundled seed,
// so a refine rejecting one stored URL would swap the ENTIRE public site for
// seed content. As a write-path check the same violation merely refuses a save.
//
// Shape, not reachability. Nothing here fetches: a save must not depend on a
// third party being up, and the Workers free plan has a 10ms CPU cap.

export const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

const LABEL: Record<SocialKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

/** Shown in the admin as the field hint and quoted in every error message. */
export const SOCIAL_URL_HINT: Record<SocialKey, string> = {
  instagram: 'https://instagram.com/furorhyd',
  facebook: 'https://facebook.com/furorhyd',
  youtube: 'https://youtube.com/@handle',
};

const HOSTS: Record<SocialKey, readonly string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  youtube: ['youtube.com', 'm.youtube.com', 'youtu.be'],
};

// A YouTube channel is /@handle, /channel/UC…, /c/Name or /user/Name. A bare
// /name — which is what is stored today — is not a channel and 404s.
const YOUTUBE_CHANNEL_PATH = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/;

/** Null means "store it". A string is the message shown to the admin. */
export function socialUrlIssue(key: SocialKey, value: string): string | null {
  if (value === '') return null; // blank means "no icon", a valid state

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${LABEL[key]} URL is not a valid URL. Use ${SOCIAL_URL_HINT[key]}.`;
  }

  if (url.protocol !== 'https:') {
    return `${LABEL[key]} URL must start with https:// — use ${SOCIAL_URL_HINT[key]}.`;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!HOSTS[key].includes(host)) {
    return `${LABEL[key]} URL must point at ${HOSTS[key][0]} — use ${SOCIAL_URL_HINT[key]}.`;
  }

  if (key === 'youtube' && !YOUTUBE_CHANNEL_PATH.test(url.pathname)) {
    return (
      `YouTube URL must name a channel: ${SOCIAL_URL_HINT.youtube}, /channel/UC…, /c/… or ` +
      `/user/…. "${url.pathname}" is not a channel path and will 404.`
    );
  }

  if (url.pathname === '' || url.pathname === '/') {
    return `${LABEL[key]} URL must include the profile path. Use ${SOCIAL_URL_HINT[key]}.`;
  }

  return null;
}
