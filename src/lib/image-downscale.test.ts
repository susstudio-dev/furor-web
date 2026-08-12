import { afterEach, describe, expect, it } from 'vitest';
import { downscaleImageFile, fitWithin, UPLOAD_MAX_EDGE_PX } from './image-downscale';

describe('fitWithin', () => {
  it('leaves an image already inside the ceiling untouched', () => {
    expect(fitWithin(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
  });

  it('leaves dimensions untouched exactly at the ceiling boundary', () => {
    // longest === maxEdge is the <= decision point in fitWithin — assert it
    // takes the "already fits" branch rather than the scale-down branch.
    expect(fitWithin(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
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

// downscaleImageFile feature-detects createImageBitmap/OffscreenCanvas off
// globalThis, so every branch past the "APIs missing" guard can be exercised
// in plain Node by stubbing those two globals with minimal fakes — no jsdom
// required. Each test restores the globals afterwards so stubs never leak
// between tests (Node has neither by default, so "restore" means delete).
type FakeBitmap = { width: number; height: number; close: () => void };

function stubImageApis(opts: {
  bitmap?: FakeBitmap | 'reject';
  getContext?: 'null' | (() => { drawImage: () => void });
  convertToBlob?: () => Promise<Blob | null>;
  onOffscreenConstruct?: () => void;
}) {
  const g = globalThis as unknown as {
    createImageBitmap: (...args: unknown[]) => Promise<FakeBitmap>;
    OffscreenCanvas: unknown;
  };

  g.createImageBitmap =
    opts.bitmap === 'reject'
      ? async () => {
          throw new Error('decode failed');
        }
      : async () => opts.bitmap as FakeBitmap;

  class FakeOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      opts.onOffscreenConstruct?.();
    }
    getContext(kind: '2d') {
      if (opts.getContext === 'null') return null;
      if (typeof opts.getContext === 'function') return opts.getContext();
      return { drawImage: () => {} };
    }
    async convertToBlob() {
      if (opts.convertToBlob) return opts.convertToBlob();
      return null;
    }
  }
  g.OffscreenCanvas = FakeOffscreenCanvas;
}

afterEach(() => {
  // Node has neither global by default — deleting returns us to that state,
  // which is also what the "APIs missing" test below depends on.
  delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
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

  it('returns the original file when createImageBitmap rejects a corrupt image', async () => {
    stubImageApis({ bitmap: 'reject' });
    const file = new File([new Uint8Array([1, 2, 3])], 'corrupt.jpg', { type: 'image/jpeg' });
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it('returns the original file when the canvas has no 2D context', async () => {
    stubImageApis({ bitmap: { width: 4000, height: 3000, close: () => {} }, getContext: 'null' });
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it('returns the original file when the re-encoded blob is not smaller', async () => {
    // The subtle failure mode: re-encoding a small/already-compressed image
    // can inflate it. Silently uploading the bigger file would invert the
    // whole point of this task, so blob.size >= file.size must bail out too.
    stubImageApis({
      bitmap: { width: 4000, height: 3000, close: () => {} },
      convertToBlob: async () => new Blob([new Uint8Array(1000)], { type: 'image/webp' }),
    });
    const file = new File([new Uint8Array(10)], 'tiny.png', { type: 'image/png' });
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it('returns a new, smaller WebP File on the success path', async () => {
    stubImageApis({
      bitmap: { width: 4000, height: 3000, close: () => {} },
      convertToBlob: async () => new Blob([new Uint8Array(50)], { type: 'image/webp' }),
    });
    const file = new File([new Uint8Array(5000)], 'photo.jpg', { type: 'image/jpeg' });
    const result = await downscaleImageFile(file);
    expect(result).not.toBe(file);
    expect(result.size).toBeLessThan(file.size);
    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('photo.webp');
  });

  it('returns the original file untouched when it already fits, without invoking the encode path', async () => {
    let offscreenConstructed = false;
    stubImageApis({
      bitmap: { width: 1200, height: 900, close: () => {} },
      onOffscreenConstruct: () => {
        offscreenConstructed = true;
      },
    });
    const file = new File([new Uint8Array(10)], 'small.jpg', { type: 'image/jpeg' });
    await expect(downscaleImageFile(file)).resolves.toBe(file);
    expect(offscreenConstructed).toBe(false);
  });
});
