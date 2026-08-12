import { describe, expect, it } from 'vitest';
import { oversizeError, readImageSize, UPLOAD_MAX_STORED_EDGE_PX } from './image-dimensions';

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // chunk length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment to make the marker walk do real work, then SOF0.
  const b = new Uint8Array(33);
  b.set([0xff, 0xd8], 0);
  b.set([0xff, 0xe0, 0x00, 0x10], 2); // APP0, length 16 (incl. the 2 length bytes)
  b.set([0xff, 0xc0, 0x00, 0x0b, 0x08], 20); // SOF0, length 11, precision 8
  const dv = new DataView(b.buffer);
  dv.setUint16(25, height);
  dv.setUint16(27, width);
  b.set([0x01, 0x01, 0x11, 0x00], 29);
  return b;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  b.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'
  b.set([0x56, 0x50, 0x38, 0x58], 12); // 'VP8X'
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  b.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return b;
}

function webpVp8(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  b.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'
  b.set([0x56, 0x50, 0x38, 0x20], 12); // 'VP8 '
  b.set([0x9d, 0x01, 0x2a], 23); // keyframe start code
  new DataView(b.buffer).setUint16(26, width, true);
  new DataView(b.buffer).setUint16(28, height, true);
  return b;
}

function webpVp8l(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  b.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'
  b.set([0x56, 0x50, 0x38, 0x4c], 12); // 'VP8L'
  b[20] = 0x2f; // lossless signature byte
  const bits = (width - 1) | ((height - 1) << 14);
  b.set([bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff], 21);
  return b;
}

describe('readImageSize', () => {
  it('reads dimensions from a PNG IHDR chunk', () => {
    expect(readImageSize(png(1600, 1200))).toEqual({ width: 1600, height: 1200 });
  });

  it('reads dimensions from a JPEG SOF0 past an APP0 segment', () => {
    expect(readImageSize(jpeg(4000, 3000))).toEqual({ width: 4000, height: 3000 });
  });

  it('reads the canvas size from a WebP VP8X chunk', () => {
    expect(readImageSize(webpVp8x(4032, 3024))).toEqual({ width: 4032, height: 3024 });
  });

  it('reads the frame size from a WebP VP8 (lossy) keyframe header', () => {
    expect(readImageSize(webpVp8(1280, 720))).toEqual({ width: 1280, height: 720 });
  });

  it('reads the canvas size from a WebP VP8L (lossless) bitstream header', () => {
    expect(readImageSize(webpVp8l(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it('bounds the JPEG marker walk against a hostile 8 MB fill-byte buffer', () => {
    // Satisfies the route's own FF D8 FF sniff, then gives the marker walk
    // nothing but fill bytes for the rest of an 8 MB buffer (the route's own
    // byte cap). Unbounded, this forces a near-whole-buffer, one-byte-at-a-
    // time scan: ~8.39M iterations, ~25-30ms measured — 2.5-3x the entire
    // 10ms Workers CPU budget for the whole request.
    const hostile = new Uint8Array(8 * 1024 * 1024).fill(0xff);
    hostile[1] = 0xd8; // SOI; byte 0 and everything from byte 2 on stays 0xff
    const start = performance.now();
    const result = readImageSize(hostile);
    const elapsed = performance.now() - start;
    expect(result).toBe(null);
    // Bounded to a 128 KB scan window this measures ~1-2ms locally; 5ms is
    // generous for slower CI hardware while still catching a regression back
    // toward the ~20-30ms whole-buffer scan by more than 3x.
    expect(elapsed).toBeLessThan(5);
  });

  it('returns null for a format it does not parse', () => {
    // AVIF and anything else. Null means "unknown", and the 8 MB byte cap in
    // the route stays the only guard — never a rejection.
    const avifish = new Uint8Array(20);
    avifish.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
    avifish.set([0x61, 0x76, 0x69, 0x66], 8); // 'avif'
    expect(readImageSize(avifish)).toBe(null);
  });

  it('returns null for truncated bytes rather than throwing', () => {
    expect(readImageSize(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(null);
  });
});

describe('oversizeError', () => {
  it('rejects an image over the stored ceiling', () => {
    expect(oversizeError({ width: 4032, height: 3024 })).toBe(
      'Image is 4032x3024. Please use one no larger than 2600px on its longest edge.',
    );
  });

  it('accepts an image exactly at the ceiling', () => {
    expect(oversizeError({ width: UPLOAD_MAX_STORED_EDGE_PX, height: 100 })).toBe(null);
  });

  it('accepts an image whose size could not be read', () => {
    expect(oversizeError(null)).toBe(null);
  });
});
