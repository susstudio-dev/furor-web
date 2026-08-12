import { describe, expect, it } from 'vitest';
import { downscaleImageFile, fitWithin, UPLOAD_MAX_EDGE_PX } from './image-downscale';

describe('fitWithin', () => {
  it('leaves an image already inside the ceiling untouched', () => {
    expect(fitWithin(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
  });

  it('scales a landscape photo down to the ceiling on its long edge', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo down to the ceiling on its long edge', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never returns a zero dimension for an extreme aspect ratio', () => {
    // A 20000x3 banner would round the short edge to 0, and OffscreenCanvas
    // throws on a zero dimension — clamp to 1 instead of crashing the upload.
    expect(fitWithin(20000, 3, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it('returns zeroes rather than NaN for a non-positive input', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });

  it('ships a 1600px ceiling', () => {
    expect(UPLOAD_MAX_EDGE_PX).toBe(1600);
  });
});

describe('downscaleImageFile', () => {
  it('returns the original file where OffscreenCanvas is not available', async () => {
    // Node has no createImageBitmap/OffscreenCanvas, which is exactly the
    // shape of an old mobile browser. The upload must still go through — the
    // server-side dimension ceiling is the guard in that case.
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
      type: 'image/jpeg',
    });
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });
});
