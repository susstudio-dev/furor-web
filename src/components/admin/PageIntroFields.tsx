'use client';

import { Field } from './fields';

interface Intro {
  eyebrow: string;
  headline: string;
  lead: string;
}

export function PageIntroFields({
  value,
  onChange,
}: {
  value: Intro;
  onChange: (next: Intro) => void;
}) {
  return (
    <>
      <Field label="Eyebrow" hint="The small uppercase label above the headline.">
        <input
          value={value.eyebrow}
          onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="Headline" hint="The big H1 at the top of the page.">
        <input
          value={value.headline}
          onChange={(e) => onChange({ ...value, headline: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="Lead paragraph" hint="One short sentence below the headline (optional).">
        <textarea
          rows={2}
          value={value.lead}
          onChange={(e) => onChange({ ...value, lead: e.target.value })}
          className="input"
        />
      </Field>
    </>
  );
}
