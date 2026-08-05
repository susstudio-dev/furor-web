import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { applyAndAuthorize } from './save-pipeline';
import { SiteContentSchema, type SiteContent } from './content-schema';
import type { Subject } from './authz';

const doc = (): SiteContent => SiteContentSchema.parse(seed);

const owner: Subject = { id: 'u_1', email: 'o@x.com', roleIds: ['owner'], attrs: {} };
const viewer: Subject = { id: 'u_2', email: 'v@x.com', roleIds: ['viewer'], attrs: {} };

describe('applyAndAuthorize', () => {
  it('accepts an authorized, valid change', () => {
    const r = applyAndAuthorize(doc(), owner, [{ op: 'set', path: 'site.tagline', value: 'New tagline' }]);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.next.site.tagline).toBe('New tagline');
      expect(r.mayPublish).toBe(true);
    }
  });

  it('rejects an unauthorized change and names the offending path', () => {
    const r = applyAndAuthorize(doc(), viewer, [{ op: 'set', path: 'site.tagline', value: 'x' }]);
    expect(r.status).toBe('denied');
    if (r.status === 'denied') expect(r.denied[0].path).toBe('site.tagline');
  });

  it('rejects a change that introduces its own validation failure', () => {
    const r = applyAndAuthorize(doc(), owner, [
      { op: 'set', path: 'site.whatsappNumber', value: 'not-digits' },
    ]);
    expect(r.status).toBe('invalid');
  });

  // A pre-existing invalid record must not make every screen unsavable for
  // everyone — including the person trying to fix it.
  it('reports only the issues the patch introduces', () => {
    const broken = doc();
    broken.testimonials[0].publishedAt = '2099-01-01';
    const r = applyAndAuthorize(broken, owner, [{ op: 'set', path: 'site.tagline', value: 'fine' }]);
    expect(r.status).toBe('ok');
  });

  it('blocks a dangling slug reference', () => {
    const d = doc();
    const r = applyAndAuthorize(d, owner, [
      { op: 'set', path: `batches[id=${d.batches[0].id}].branchSlug`, value: 'no-such-studio' },
    ]);
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.issues[0].message).toMatch(/Unknown studio/);
  });

  it('allows an unrelated save when an integrity issue already exists', () => {
    const d = doc();
    d.batches[0].branchSlug = 'already-broken';
    const r = applyAndAuthorize(d, owner, [{ op: 'set', path: 'site.tagline', value: 'fine' }]);
    expect(r.status).toBe('ok');
  });

  it('turns a malformed path into an invalid result rather than throwing', () => {
    const r = applyAndAuthorize(doc(), owner, [{ op: 'set', path: 'site.__proto__.x', value: 1 }]);
    expect(r.status).toBe('invalid');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('lets a section-scoped editor save the sections they hold', () => {
    const editor: Subject = {
      id: 'u_3',
      email: 'e@x.com',
      roleIds: ['editor'],
      attrs: { sections: ['site'] },
    };
    const r = applyAndAuthorize(doc(), editor, [{ op: 'set', path: 'site.tagline', value: 'edited' }]);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.mayPublish).toBe(true);
  });

  // The /admin/site screen writes trial, tonight and whyFuror alongside site,
  // and one denied leaf fails the whole envelope — so a section that does not
  // cover them makes that screen unsavable rather than partially restricted.
  it('lets the site section cover everything the site screen writes', () => {
    const editor: Subject = {
      id: 'u_4',
      email: 'e2@x.com',
      roleIds: ['editor'],
      attrs: { sections: ['site'] },
    };
    const d = doc();
    const r = applyAndAuthorize(d, editor, [
      { op: 'set', path: 'site', value: { ...d.site, tagline: 'x' } },
      { op: 'set', path: 'whyFuror', value: { ...d.whyFuror, headline: 'y' } },
      { op: 'set', path: 'trial', value: { ...d.trial, eyebrow: 'z' } },
      { op: 'set', path: 'tonight', value: { ...d.tonight, headline: 'w' } },
    ]);
    expect(r.status).toBe('ok');
  });

  it('emits no changes for a no-op save', () => {
    const d = doc();
    const r = applyAndAuthorize(d, owner, [{ op: 'set', path: 'site.tagline', value: d.site.tagline }]);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.changes).toEqual([]);
  });
});
