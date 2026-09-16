import { describe, expect, it } from 'vitest';
import { advanceIndex, needsSlider, resolveSlides, SLIDE_HOLD_MS, type Slide } from './hero-slides';

const photo = { src: '/photos/DSC_0095.jpg', alt: 'A packed floor' };
const img = (src: string): Slide => ({ kind: 'image', src, alt: 'alt' });
const vid = (mp4Url: string): Slide => ({
  kind: 'video',
  posterSrc: '/p.jpg',
  posterAlt: 'poster',
  webmUrl: '',
  mp4Url,
});

describe('resolveSlides', () => {
  // THE invariant the whole no-regression claim rests on. Every document in
  // production is in this state on the day this ships.
  it('falls back to the retired heroPhoto when no slides are set', () => {
    expect(resolveSlides({ heroSlides: [], heroPhoto: photo })).toEqual([
      { kind: 'image', src: photo.src, alt: photo.alt },
    ]);
  });

  it('prefers the slide list once it has one usable slide', () => {
    const slides = [img('/a.jpg')];
    expect(resolveSlides({ heroSlides: slides, heroPhoto: photo })).toEqual(slides);
  });

  // A half-filled admin row must degrade to absence, never to a broken frame.
  it('drops an image slide with no source', () => {
    const out = resolveSlides({ heroSlides: [img(''), img('/b.jpg')], heroPhoto: photo });
    expect(out).toEqual([img('/b.jpg')]);
  });

  it('drops a video slide with neither url', () => {
    const empty: Slide = { kind: 'video', posterSrc: '/p.jpg', posterAlt: 'p', webmUrl: '', mp4Url: '' };
    expect(resolveSlides({ heroSlides: [empty], heroPhoto: photo })).toEqual([
      { kind: 'image', src: photo.src, alt: photo.alt },
    ]);
  });

  it('keeps a video slide that has only a webm', () => {
    const webmOnly: Slide = { kind: 'video', posterSrc: '', posterAlt: '', webmUrl: '/v.webm', mp4Url: '' };
    expect(resolveSlides({ heroSlides: [webmOnly], heroPhoto: photo })).toEqual([webmOnly]);
  });

  it('treats whitespace as blank', () => {
    expect(resolveSlides({ heroSlides: [img('   ')], heroPhoto: photo })).toEqual([
      { kind: 'image', src: photo.src, alt: photo.alt },
    ]);
  });

  it('preserves the order the owner arranged', () => {
    const slides = [img('/a.jpg'), vid('/v.mp4'), img('/c.jpg')];
    expect(resolveSlides({ heroSlides: slides, heroPhoto: photo })).toEqual(slides);
  });

  // Blank hides the element: with nothing to show, show nothing.
  it('returns an empty list when even heroPhoto is blank', () => {
    expect(resolveSlides({ heroSlides: [], heroPhoto: { src: '', alt: '' } })).toEqual([]);
  });
});

describe('needsSlider', () => {
  // The point of this predicate: an untouched page must not mount a client
  // component, start a timer, or ship a byte of slider JS.
  it('is false for the single static photo every untouched document has', () => {
    expect(needsSlider(resolveSlides({ heroSlides: [], heroPhoto: photo }))).toBe(false);
  });

  it('is false for no slides at all', () => {
    expect(needsSlider([])).toBe(false);
  });

  it('is true once there are two slides', () => {
    expect(needsSlider([img('/a.jpg'), img('/b.jpg')])).toBe(true);
  });

  // A lone video still needs the component — the static path renders an <Img>
  // and cannot play a clip.
  it('is true for a single video slide', () => {
    expect(needsSlider([vid('/v.mp4')])).toBe(true);
  });
});

describe('advanceIndex', () => {
  it('advances and wraps', () => {
    expect(advanceIndex(0, 3)).toBe(1);
    expect(advanceIndex(2, 3)).toBe(0);
  });

  // Callers need no special case for degenerate lists.
  it('stays at zero for lists that cannot advance', () => {
    expect(advanceIndex(0, 1)).toBe(0);
    expect(advanceIndex(0, 0)).toBe(0);
  });
});

describe('SLIDE_HOLD_MS', () => {
  // A range, not an exact pin: the requirement is "long enough to take in a
  // photograph, short enough not to feel stuck", and pinning the literal would
  // only assert that a constant equals itself. These bounds are what would
  // actually be wrong.
  it('holds long enough to read a frame and not so long it feels stuck', () => {
    expect(SLIDE_HOLD_MS).toBeGreaterThanOrEqual(3000);
    expect(SLIDE_HOLD_MS).toBeLessThanOrEqual(10000);
  });
});
