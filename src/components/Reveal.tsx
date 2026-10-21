import type { ReactNode } from 'react';

// Choreographed scroll-reveal. Content enters the way a dancer steps onto a
// count: a hair of anticipation, then a confident settle.
//
// This is a SERVER component and ships no JavaScript. The motion is a CSS
// scroll-driven animation (`animation-timeline: view()`, see globals.css), so
// the entrance is scrubbed by the scroll position rather than played as a fixed
// clip once an observer fires. Two consequences worth knowing:
//
//  1. Nothing is hidden unless the browser supports the timeline. The old
//     version set opacity:0 in CSS and relied on React to add a class — so any
//     failure to hydrate left most of the page invisible. Now the hidden state
//     lives inside @supports, and unsupported browsers simply render the
//     content, static and visible.
//  2. `delay` / `step` / `from` are gone. A progress timeline has no duration,
//     so animation-delay does nothing on it; the stagger is expressed as
//     offset ranges per child in globals.css instead.

interface Props {
  children: ReactNode;
  /** when true, each direct child enters in sequence (a danced phrase) */
  stagger?: boolean;
  className?: string;
}

export function Reveal({ children, stagger = false, className }: Props) {
  return (
    <div data-reveal="" data-stagger={stagger ? '' : undefined} className={className}>
      {children}
    </div>
  );
}
