import { describe, expect, it } from 'vitest';
import { integrityIssues } from './integrity';
import { SOCIAL_URL_HINT, socialUrlIssue } from './social-url';

describe('socialUrlIssue', () => {
  it('accepts a well-formed profile URL for each network', () => {
    expect(socialUrlIssue('instagram', 'https://instagram.com/furorhyd')).toBe(null);
    expect(socialUrlIssue('facebook', 'https://www.facebook.com/furorhyd')).toBe(null);
    expect(socialUrlIssue('youtube', 'https://youtube.com/@furorhyd')).toBe(null);
  });

  it('treats a blank URL as "no icon", not as an error', () => {
    // Task 7 renders each icon only when its URL is set, so empty is a valid
    // stored state and must never block a save.
    expect(socialUrlIssue('youtube', '')).toBe(null);
  });

  it('rejects the bare-path YouTube URL stored today and names the shape it wants', () => {
    const issue = socialUrlIssue('youtube', 'https://youtube.com/furorhyd');
    expect(issue).toContain(SOCIAL_URL_HINT.youtube);
    expect(issue).toContain('/furorhyd');
  });

  it('rejects a non-https scheme, a wrong host and an unparseable string', () => {
    expect(socialUrlIssue('instagram', 'http://instagram.com/furorhyd')).toContain('https://');
    expect(socialUrlIssue('instagram', 'https://example.com/furorhyd')).toContain('instagram.com');
    expect(socialUrlIssue('facebook', 'not a url')).toContain('valid URL');
  });
});

describe('integrityIssues — social URLs', () => {
  // These wiring assertions live here rather than in integrity.test.ts because
  // a concurrent plan appends to that file, and both plans' cumulative test
  // counts have to stay predictable (R4).
  it('reports a malformed social URL on the write path', () => {
    const issues = integrityIssues({
      site: { socials: { youtube: 'https://youtube.com/furorhyd' } },
    });
    expect(issues.map((i) => i.path)).toEqual([['site', 'socials', 'youtube']]);
  });

  it('reports nothing for a document with no socials block', () => {
    expect(integrityIssues({ site: {} })).toEqual([]);
  });
});
