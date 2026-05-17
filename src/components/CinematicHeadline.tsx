import React from 'react';

// Splits a headline into words that rise from behind a mask, one after another
// (film-title style). `*word*` segments render in the italic-serif accent and,
// being typically last, land as the final beat. Pure CSS animation; the
// reduced-motion guard in globals.css shows everything static instead.

function renderToken(token: string, key: number) {
  if (!token.includes('*')) return <React.Fragment key={key}>{token}</React.Fragment>;
  const parts = token.split(/(\*[^*]+\*)/g);
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <em key={i} className="accent">
            {p.slice(1, -1)}
          </em>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </React.Fragment>
  );
}

export function CinematicHeadline({
  text,
  baseDelay = 140,
  step = 85,
}: {
  text: string;
  baseDelay?: number;
  step?: number;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span className="cine-w">
            <span
              className="cine-i"
              style={{ animationDelay: `${baseDelay + i * step}ms` }}
            >
              {renderToken(w, i)}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </>
  );
}
