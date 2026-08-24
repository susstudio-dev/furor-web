import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { FORBIDDEN_MESSAGE_TOKENS, firstForbiddenToken, SiteContentSchema } from './content-schema';
import { buildPrefilledMessage, buildWhatsAppHref } from './enquiry';

const doc = () => SiteContentSchema.parse(seed);
const templates = () => doc().site.whatsappTemplates;

const style = { slug: 'salsa', name: 'Salsa' };
const branch = { slug: 'jubilee-hills', name: 'Jubilee Hills' };
const batch = {
  id: 'batch-001',
  styleSlugs: ['salsa'],
  level: 'Foundation' as const,
  branchSlug: 'jubilee-hills',
  daysOfWeek: ['Sat', 'Sun'] as Array<'Sat' | 'Sun'>,
  time: '9:30 AM – 10:30 AM',
  startDate: '2026-09-05',
  joinUntil: '',
  priceInr: 6000,
  trialInr: 500,
  status: 'Open' as const,
  welcomeNote: '',
};

describe('firstForbiddenToken', () => {
  it('names the token that makes a message unsafe', () => {
    expect(firstForbiddenToken('Hi <script>')).toBe('<');
    expect(firstForbiddenToken('Hi {{name}}')).toBe('{{');
    expect(firstForbiddenToken('Hi undefined')).toBe('undefined');
  });

  it('passes an ordinary message', () => {
    expect(firstForbiddenToken('Hi Furor, please share details.')).toBe(null);
  });

  // Single braces ARE the placeholder syntax — rejecting them would reject
  // every shipped template.
  it('allows the single-brace placeholders the templates actually use', () => {
    expect(firstForbiddenToken('Hi Furor, I want the {style} {level} batch.')).toBe(null);
  });

  it('pins the exact token list', () => {
    expect([...FORBIDDEN_MESSAGE_TOKENS]).toEqual(['<', '>', '{{', '}}', 'undefined']);
  });
});

describe('WhatsappTemplatesSchema', () => {
  it('ships the six messages and the optional studio fragment', () => {
    const t = templates();
    expect(t.batch).toBe(
      "Hi Furor, I'm interested in the {style} {level} batch at {branch} ({days}, {time}, starting {date}). Please share details.",
    );
    expect(t.styleFinder).toBe(
      'Hi Furor, the style finder suggested {style} {level}{where} for me. Please tell me about the next batch.',
    );
    expect(t.styleFinderWhere).toBe(' at {branch}');
    expect(t.style).toBe("Hi Furor, I'm interested in {style} classes — please share details.");
    expect(t.branch).toBe("Hi Furor, I'd like to know about classes at your {branch} studio.");
    expect(t.custom).toBe("Hi Furor, I'd like to come to {note}.");
    expect(t.generic).toBe("Hi Furor, I'd like to know more about your dance classes.");
  });

  it('keeps an edited template', () => {
    const d = doc();
    d.site.whatsappTemplates.generic = 'Hey Furor! Tell me about your classes please.';
    expect(SiteContentSchema.parse(d).site.whatsappTemplates.generic).toBe(
      'Hey Furor! Tell me about your classes please.',
    );
  });

  // THE outage guard. content.ts wraps SiteContentSchema.parse in a try whose
  // catch serves the bundled seed for the ENTIRE public site. If a forbidden
  // token could fail the parse, one '<' pasted into /admin/json — or arriving
  // from a restored version — would blank the whole site's content. The token
  // check belongs on the write path (integrity.ts) and nowhere else.
  it('does NOT reject a forbidden token on the read path', () => {
    const d = doc();
    d.site.whatsappTemplates.generic = 'Hi Furor <b>hello</b>';
    const r = SiteContentSchema.safeParse(d);
    expect(r.success).toBe(true);
  });
});

describe('buildPrefilledMessage', () => {
  it('fills the generic template', () => {
    expect(buildPrefilledMessage({ source: 'floating' }, templates())).toBe(
      "Hi Furor, I'd like to know more about your dance classes.",
    );
  });

  it('fills the style template', () => {
    expect(buildPrefilledMessage({ source: 'primary', style }, templates())).toBe(
      "Hi Furor, I'm interested in Salsa classes — please share details.",
    );
  });

  it('fills the branch template', () => {
    expect(buildPrefilledMessage({ source: 'footer', branch }, templates())).toBe(
      "Hi Furor, I'd like to know about classes at your Jubilee Hills studio.",
    );
  });

  it('fills the batch template, which is the most specific', () => {
    expect(buildPrefilledMessage({ source: 'batch_row', style, branch, batch }, templates())).toBe(
      "Hi Furor, I'm interested in the Salsa Foundation batch at Jubilee Hills (Sat–Sun, 9:30 AM – 10:30 AM, starting 5 September 2026). Please share details.",
    );
  });

  it('fills the style-finder template with the studio fragment', () => {
    expect(
      buildPrefilledMessage(
        {
          source: 'style_finder',
          styleFinderRecommendation: {
            styleName: 'Salsa',
            level: 'Foundation',
            branchName: 'Jubilee Hills',
          },
        },
        templates(),
      ),
    ).toBe(
      'Hi Furor, the style finder suggested Salsa Foundation at Jubilee Hills for me. Please tell me about the next batch.',
    );
  });

  it('drops the studio fragment entirely when no studio is known', () => {
    expect(
      buildPrefilledMessage(
        {
          source: 'style_finder',
          styleFinderRecommendation: { styleName: 'Salsa', level: 'Foundation' },
        },
        templates(),
      ),
    ).toBe(
      'Hi Furor, the style finder suggested Salsa Foundation for me. Please tell me about the next batch.',
    );
  });

  it('fills the custom-note template', () => {
    expect(
      buildPrefilledMessage({ source: 'primary', customNote: 'La Rumba on Saturday' }, templates()),
    ).toBe("Hi Furor, I'd like to come to La Rumba on Saturday.");
  });

  // With validation moved to save time, the render path must NOT throw. A
  // message reaching a visitor's device is already past the point where
  // crashing helps anyone — the worst case is a slightly odd prefill.
  it('does not throw on a message it would once have rejected', () => {
    const t = { ...templates(), generic: 'Hi Furor <unsafe>' };
    expect(() => buildPrefilledMessage({ source: 'floating' }, t)).not.toThrow();
    expect(buildPrefilledMessage({ source: 'floating' }, t)).toBe('Hi Furor <unsafe>');
  });

  // A placeholder the fill step has no value for stays as typed. Substituting
  // an empty string would silently delete words; substituting String(undefined)
  // is the exact failure the old FORBIDDEN list existed to catch.
  it('leaves an unknown placeholder as written rather than printing undefined', () => {
    const t = { ...templates(), generic: 'Hi Furor, about {mystery} classes.' };
    expect(buildPrefilledMessage({ source: 'floating' }, t)).toBe(
      'Hi Furor, about {mystery} classes.',
    );
  });
});

describe('buildWhatsAppHref', () => {
  it('percent-encodes the filled message onto wa.me', () => {
    expect(buildWhatsAppHref('918886072572', { source: 'floating' }, templates())).toBe(
      'https://wa.me/918886072572?text=' +
        encodeURIComponent("Hi Furor, I'd like to know more about your dance classes."),
    );
  });

  it('carries an edited template all the way into the href', () => {
    const t = { ...templates(), generic: 'Hey Furor!' };
    expect(buildWhatsAppHref('918886072572', { source: 'floating' }, t)).toBe(
      'https://wa.me/918886072572?text=' + encodeURIComponent('Hey Furor!'),
    );
  });
});

describe('started-batch prefill', () => {
  const t = templates();
  const mkBatch = (startDate: string) =>
    ({
      id: 'b1', styleSlugs: ['salsa'], level: 'Foundation', branchSlug: 'jh',
      daysOfWeek: ['Sat', 'Sun'], time: '9:30–10:30 AM', startDate,
      priceInr: 6900, trialInr: 500, seatsLeft: null, status: 'Open',
      razorpayLink: null, welcomeNote: '', joinUntil: '',
    }) as any;
  const ctxFor = (startDate: string) => ({
    source: 'batch_row' as const,
    style: { slug: 'salsa', name: 'Salsa' },
    branch: { slug: 'jh', name: 'Jubilee Hills' },
    batch: mkBatch(startDate),
  });

  it('asks to join a batch that has already started', () => {
    const msg = buildPrefilledMessage(ctxFor('2020-01-01'), t);
    expect(msg).toContain('Can I still join?');
    expect(msg).not.toContain('starting');
  });
  it('keeps the starting-soon wording for a future batch', () => {
    expect(buildPrefilledMessage(ctxFor('2099-01-01'), t)).toContain('starting');
  });
});
