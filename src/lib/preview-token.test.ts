import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { mintPreviewToken, verifyPreviewToken } from './preview-token';

// The preview cookie is a capability: whoever holds it sees unpublished
// content on the public site. It must be its own credential — narrow, short,
// and cryptographically distinct from the admin session.

describe('preview token', () => {
  it('round-trips draftId and uid', async () => {
    const token = await mintPreviewToken({ draftId: 'd_1', uid: 'u_1' });
    expect(await verifyPreviewToken(token)).toEqual({ draftId: 'd_1', uid: 'u_1' });
  });

  it('rejects a tampered token', async () => {
    const token = await mintPreviewToken({ draftId: 'd_1', uid: 'u_1' });
    expect(await verifyPreviewToken(token.slice(0, -2) + 'xx')).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verifyPreviewToken('not-a-jwt')).toBeNull();
    expect(await verifyPreviewToken('')).toBeNull();
  });

  // The attack the distinct iss/aud/secret exists to stop: replaying an admin
  // SESSION cookie into furor_preview. Same signing algorithm, same base
  // secret family — it must still fail.
  it('rejects a token minted with the session issuer/audience', async () => {
    const sessionLike = await new SignJWT({ uid: 'u_1', email: 'a@b.com', roles: ['owner'], sv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('furor-web')
      .setAudience('furor-admin')
      .setExpirationTime('14d')
      .sign(new TextEncoder().encode('dev-only-secret-change-me-in-production-32b'));
    expect(await verifyPreviewToken(sessionLike)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ draftId: 'd_1', uid: 'u_1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setIssuer('furor-web-preview')
      .setAudience('furor-preview')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode('dev-only-secret-change-me-in-production-32b:preview'));
    expect(await verifyPreviewToken(expired)).toBeNull();
  });

  it('rejects a payload missing the draft id', async () => {
    const bad = await new SignJWT({ uid: 'u_1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('furor-web-preview')
      .setAudience('furor-preview')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('dev-only-secret-change-me-in-production-32b:preview'));
    expect(await verifyPreviewToken(bad)).toBeNull();
  });
});
