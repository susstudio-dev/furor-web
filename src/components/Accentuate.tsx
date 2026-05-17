import React from 'react';

// Renders text with *word* segments wrapped in an italic-serif accent.
// Example: "The night was made for *dancing*." → "The night was made for [italic-serif]dancing[/]."
export function Accentuate({ text }: { text: string }) {
  if (!text.includes('*')) return <>{text}</>;
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <em key={i} className="accent">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
