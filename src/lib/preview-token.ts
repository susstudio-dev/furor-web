import { SignJWT, jwtVerify } from 'jose';

// The preview cookie's credential. Deliberately its OWN token family:
// separate issuer, audience and derived secret, 15-minute TTL, one draft.
// Without the distinct iss/aud, an admin session cookie value replayed into
// furor_preview would verify — the session and preview would be the same
// capability with different names.

export const PREVIEW_COOKIE = 'furor_preview';
const ISSUER = 'furor-web-preview';
const AUDIENCE = 'furor-preview';
export const PREVIEW_TTL_SECONDS = 15 * 60;

export interface PreviewClaims {
  draftId: string;
  uid: string;
}

function secret(): Uint8Array {
  // PREVIEW_SECRET when configured; otherwise derived from JWT_SECRET with a
  // domain separator so the two key spaces never coincide. The dev fallback
  // mirrors auth.ts's, with the same separator.
  const base =
    process.env.PREVIEW_SECRET ||
    `${process.env.JWT_SECRET || 'dev-only-secret-change-me-in-production-32b'}:preview`;
  return new TextEncoder().encode(base);
}

export async function mintPreviewToken(claims: PreviewClaims): Promise<string> {
  return new SignJWT({ draftId: claims.draftId, uid: claims.uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${PREVIEW_TTL_SECONDS}s`)
    .sign(secret());
}

/** Null on any failure — expired, tampered, wrong audience, wrong shape. */
export async function verifyPreviewToken(token: string): Promise<PreviewClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.draftId !== 'string' || typeof payload.uid !== 'string') return null;
    return { draftId: payload.draftId, uid: payload.uid };
  } catch {
    return null;
  }
}
