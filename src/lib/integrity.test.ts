import { describe, expect, it } from 'vitest';
import { integrityIssues } from './integrity';
import { SiteContentSchema } from './content-schema';
import seed from '@/data/site-content.seed.json';

const doc = () => ({
  danceStyles: [
    { id: 'st_1', slug: 'salsa' },
    { id: 'st_2', slug: 'bachata' },
  ],
  studios: [{ id: 'sd_1', slug: 'jubilee-hills', styleSlugs: ['salsa'] }],
  batches: [{ id: 'b_1', slug: undefined, styleSlugs: ['salsa'], branchSlug: 'jubilee-hills' }],
  instructors: [{ id: 'i_1', branchSlugs: ['jubilee-hills'], styleSlugs: ['bachata'] }],
  testimonials: [{ id: 't_1', styleSlug: 'salsa' }],
  stories: [{ id: 's_1', slug: 'a-night' }],
  customPages: [{ id: 'c_1', slug: 'refund-policy' }],
});

type Doc = ReturnType<typeof doc>;
const check = (d: unknown) => integrityIssues(d as Doc);

describe('integrityIssues', () => {
  it('passes a consistent document', () => {
    expect(check(doc())).toEqual([]);
  });

  // Every lookup in the codebase is a first-match .find(), and slugs are the
  // authorizer's join keys — a duplicate silently shadows another record.
  it('flags a duplicate slug within a collection', () => {
    const d = doc();
    d.customPages.push({ id: 'c_2', slug: 'refund-policy' });
    expect(check(d)).toEqual([
      expect.objectContaining({ path: ['customPages', 1, 'slug'] }),
    ]);
  });

  it('flags a duplicate id within a collection', () => {
    const d = doc();
    d.batches.push({ id: 'b_1', slug: undefined, styleSlugs: ['salsa'], branchSlug: 'jubilee-hills' });
    expect(check(d)).toEqual([expect.objectContaining({ path: ['batches', 1, 'id'] })]);
  });

  it('does not confuse identical slugs in different collections', () => {
    const d = doc();
    d.stories.push({ id: 's_2', slug: 'salsa' }); // same slug as a dance style
    expect(check(d)).toEqual([]);
  });

  // Two non-overlapping patches can orphan each other's references: one deletes
  // a style while another adds a batch pointing at it.
  it('flags a batch pointing at a missing dance style', () => {
    const d = doc();
    d.batches[0].styleSlugs = ['kizomba'];
    expect(check(d)).toEqual([
      expect.objectContaining({ path: ['batches', 0, 'styleSlugs', 0] }),
    ]);
  });

  it('flags a batch pointing at a missing studio', () => {
    const d = doc();
    d.batches[0].branchSlug = 'gachibowli';
    expect(check(d)).toEqual([expect.objectContaining({ path: ['batches', 0, 'branchSlug'] })]);
  });

  it('flags an instructor pointing at a missing studio or style', () => {
    const d = doc();
    d.instructors[0].branchSlugs = ['nowhere'];
    d.instructors[0].styleSlugs = ['nope'];
    expect(check(d)).toHaveLength(2);
  });

  it('flags a testimonial pointing at a missing style but allows an empty one', () => {
    const d = doc();
    d.testimonials[0].styleSlug = '';
    expect(check(d)).toEqual([]);
    d.testimonials[0].styleSlug = 'nope';
    expect(check(d)).toHaveLength(1);
  });
});

const full = () => SiteContentSchema.parse(seed);

// A PRE-EXISTING, UNRELATED ISSUE LIVES IN THE SEED. Plan 2 Task 14 added a
// write-path socials check, and `site.socials.youtube` is stored as
// `https://youtube.com/furorhyd` — a bare path, not a channel — so from Plan 2
// onward integrityIssues(full()) ALWAYS returns one issue at
// ['site','socials','youtube']. Correcting that URL is the owner's action in
// /admin (Plan 2's own follow-up), not a code change, so it must not be
// "fixed" in data/site-content.json here. Every assertion below therefore
// narrows to the templates first: an unrelated issue must not fail this test,
// and this test must not start passing for the wrong reason if the owner does
// fix the URL.
const templateIssues = (d: unknown) =>
  integrityIssues(d).filter((i) => i.path[1] === 'whatsappTemplates');

describe('integrityIssues — WhatsApp templates', () => {
  // Save-time, never read-time. content.ts serves the bundled seed for the
  // whole public site when SiteContentSchema.parse throws, so this check must
  // refuse the SAVE, not the document.
  it('flags a template containing an angle bracket, naming the field', () => {
    const d = full();
    d.site.whatsappTemplates.generic = 'Hi Furor <b>hello</b>';
    expect(templateIssues(d)).toEqual([
      {
        path: ['site', 'whatsappTemplates', 'generic'],
        message: 'Message cannot contain "<" — it would break the WhatsApp link.',
      },
    ]);
  });

  it('flags a double brace and the literal word undefined', () => {
    const d = full();
    d.site.whatsappTemplates.style = 'Hi Furor, about {{style}} classes.';
    d.site.whatsappTemplates.branch = 'Hi Furor, classes at undefined studio.';
    const issues = templateIssues(d);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.path)).toEqual([
      ['site', 'whatsappTemplates', 'style'],
      ['site', 'whatsappTemplates', 'branch'],
    ]);
    expect(issues[1].message).toContain('undefined');
  });

  it('passes the shipped templates and an ordinary rewrite', () => {
    const d = full();
    expect(templateIssues(d)).toEqual([]);
    d.site.whatsappTemplates.generic = 'Hey Furor! Tell me about your classes please.';
    expect(templateIssues(d)).toEqual([]);
  });

  // integrityIssues runs on raw objects too (save-pipeline hands it the
  // pre-patch document), so a doc with no site key must be a no-op, not a throw.
  it('is a no-op on a document with no site key at all', () => {
    expect(check(doc())).toEqual([]);
    expect(integrityIssues({ site: {} })).toEqual([]);
    expect(integrityIssues({ site: { whatsappTemplates: null } })).toEqual([]);
  });
});

// Welcome tracks: the document-level invariants that decide whether a paid
// customer's redirect can resolve at all.
//
// `duplicateTrackKeys` existed but was enforced ONLY inside the welcome-page
// editor component, so every other write path — a direct patch, a different
// admin screen — could persist a slug that /welcome/[track] can never reach
// (it resolves with find(), first match wins).
describe('welcome tracks', () => {
  const withTracks = (tracks: unknown[]) => ({
    danceStyles: [
      { id: 'st_1', slug: 'salsa' },
      { id: 'st_2', slug: 'bachata' },
    ],
    welcome: { tracks },
  });
  const keys = (d: unknown) => integrityIssues(d).map((i) => i.message);

  it('rejects two tracks claiming the same slug', () => {
    const issues = integrityIssues(
      withTracks([
        { key: 'latin', styleSlugs: ['salsa'] },
        { key: 'latin', styleSlugs: ['bachata'] },
      ]),
    );
    expect(issues.map((i) => i.path)).toEqual([['welcome', 'tracks', 1, 'key']]);
    expect(issues[0].message).toContain('latin');
  });

  it('reports a duplicated slug once, not once per extra copy', () => {
    const issues = integrityIssues(
      withTracks([
        { key: 'latin', styleSlugs: ['salsa'] },
        { key: 'latin', styleSlugs: ['salsa'] },
        { key: 'latin', styleSlugs: ['salsa'] },
      ]),
    );
    expect(issues).toHaveLength(1);
  });

  it('ignores surrounding whitespace when comparing slugs', () => {
    expect(
      keys(withTracks([{ key: 'latin', styleSlugs: [] }, { key: ' latin ', styleSlugs: [] }])),
    ).toHaveLength(1);
  });

  // A style slug matched against batches exactly: one stray capital and the
  // page silently binds to no batch and says nothing about it.
  it('rejects a style slug no dance style publishes', () => {
    const issues = integrityIssues(withTracks([{ key: 'latin', styleSlugs: ['salsa', 'Kizomba'] }]));
    expect(issues.map((i) => i.path)).toEqual([['welcome', 'tracks', 0, 'styleSlugs', 1]]);
    expect(issues[0].message).toContain('Kizomba');
  });

  it('passes tracks with distinct slugs and known styles', () => {
    expect(
      keys(
        withTracks([
          { key: 'latin', styleSlugs: ['salsa', 'bachata'] },
          { key: 'wcs', styleSlugs: [] },
        ]),
      ),
    ).toEqual([]);
  });

  // integrityIssues runs on raw pre-patch documents, so every shape a stored
  // document could be in must be a no-op rather than a throw.
  it('is a no-op when the welcome key is absent or malformed', () => {
    expect(integrityIssues({ welcome: null })).toEqual([]);
    expect(integrityIssues({ welcome: { tracks: null } })).toEqual([]);
    expect(integrityIssues({ welcome: { tracks: [null, 7] } })).toEqual([]);
  });

  // Scoped to welcome issues on purpose: the seed carries one KNOWN, unrelated
  // violation (the stored YouTube handle URL, see the note above socials()),
  // and /admin/site is where it gets fixed — asserting on the whole list here
  // would make this test a tripwire for that instead of for these tracks.
  it('finds nothing to complain about in the shipped welcome tracks', () => {
    const welcomeIssues = integrityIssues(SiteContentSchema.parse(seed)).filter(
      (i) => i.path[0] === 'welcome',
    );
    expect(welcomeIssues).toEqual([]);
  });
});
