// Header-only dimension reader. The upload route already buffers the bytes to
// sniff the MIME type, so this costs a few dozen byte reads and no decode —
// which is the only kind of image work that fits under a 10ms CPU cap.
//
// This is the BACKSTOP for the client-side resize in image-downscale.ts: it
// catches a browser with no OffscreenCanvas and anything that posts the
// endpoint directly. It is deliberately not a decoder — an unparsed format
// returns null and is allowed through on the 8 MB byte cap alone.

export interface ImageSize {
  width: number;
  height: number;
}

/** Hard ceiling on a stored upload's longest edge. Comfortably above the
 *  1600px the admin UI resizes to, so a legitimate upload is never bounced. */
export const UPLOAD_MAX_STORED_EDGE_PX = 2600;

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.subarray(i, i + n));

export function readImageSize(b: Uint8Array): ImageSize | null {
  // PNG: 8-byte signature, then IHDR is always the first chunk.
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return { width: u32be(b, 16), height: u32be(b, 20) };
  }

  // JPEG: walk the marker chain to the first SOFn frame header.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      // Standalone markers carry no length field.
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan
      const len = u16be(b, i + 2);
      // SOF0..SOF15, minus DHT (c4), JPG (c8) and DAC (cc).
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
      if (len < 2) break;
      i += 2 + len;
    }
    return null;
  }

  // WebP: a RIFF container with one of three bitstream chunks.
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8X') {
      return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    }
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  return null;
}

/** Null means "store it". A string is the message shown to the admin. */
export function oversizeError(
  size: ImageSize | null,
  maxEdge: number = UPLOAD_MAX_STORED_EDGE_PX,
): string | null {
  if (!size) return null;
  if (Math.max(size.width, size.height) <= maxEdge) return null;
  return `Image is ${size.width}x${size.height}. Please use one no larger than ${maxEdge}px on its longest edge.`;
}
