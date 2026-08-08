import { describe, expect, it } from 'vitest';
import { SessionClaimsSchema } from './session-claims';

const valid = { uid: 'u_1', email: 'a@b.com', roles: ['editor'], sv: 3, brk: false };

describe('SessionClaimsSchema', () => {
  it('accepts a well-formed payload', () => {
    expect(SessionClaimsSchema.parse(valid)).toEqual(valid);
  });

  // Today's code does `payload.role as Role` — an unchecked cast. A
  // malformed-but-correctly-signed token (one minted by an older build, say)
  // then flows through with undefined fields, and whether that fails open
  // depends entirely on how each downstream check happens to be written.
  it.each([
    ['missing uid', { ...valid, uid: undefined }],
    ['missing email', { ...valid, email: undefined }],
    ['roles not an array', { ...valid, roles: 'editor' }],
    ['roles containing a non-string', { ...valid, roles: ['editor', 7] }],
    ['session version not a number', { ...valid, sv: 'three' }],
    ['negative session version', { ...valid, sv: -1 }],
  ])('rejects a payload with %s', (_label, payload) => {
    expect(SessionClaimsSchema.safeParse(payload).success).toBe(false);
  });

  it('defaults brk to false rather than leaving it undefined', () => {
    const { brk, ...withoutBrk } = valid;
    void brk;
    expect(SessionClaimsSchema.parse(withoutBrk).brk).toBe(false);
  });

  it('carries an epoch for the break-glass account', () => {
    const parsed = SessionClaimsSchema.parse({ ...valid, brk: true, epoch: 'e1' });
    expect(parsed.brk).toBe(true);
    expect(parsed.epoch).toBe('e1');
  });
});
