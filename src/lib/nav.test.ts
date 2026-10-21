import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
import { NAV_ITEMS, navItemsFor, navLabel } from './nav';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

const byId = (id: string) => {
  const item = NAV_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`no nav item ${id}`);
  return item;
};

describe('NAV_ITEMS', () => {
  it('ships the nine primary destinations Header and Footer share', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'home',
      'about',
      'dance-styles',
      'instructors',
      'batches',
      'la-rumba',
      'blog',
      'faqs',
      'contact',
    ]);
  });

  it('keeps hrefs structural — they are routes, not copy', () => {
    expect(byId('blog').href).toBe('/stories');
    expect(byId('dance-styles').href).toBe('/dance-styles');
    expect(byId('batches').href).toBe('/batches');
  });

  it('has no duplicate ids, so a React key on id is safe', () => {
    expect(new Set(NAV_ITEMS.map((i) => i.id)).size).toBe(NAV_ITEMS.length);
  });
});

describe('navLabel', () => {
  it('renders the shipped copy by default', () => {
    expect(navLabel(byId('dance-styles'), labels())).toBe('Styles');
    expect(navLabel(byId('batches'), labels())).toBe('Batches');
    expect(navLabel(byId('blog'), labels())).toBe('Stories');
  });

  it('renders the edited copy', () => {
    expect(navLabel(byId('dance-styles'), labels({ navDanceStyles: 'What we teach' }))).toBe(
      'What we teach',
    );
  });

  it('falls back to the shipped label when the field is cleared', () => {
    expect(navLabel(byId('faqs'), labels({ navFaqs: '' }))).toBe('FAQs');
  });

  // THE regression this module exists for. Header used to branch on
  // `item.label === 'Dance Styles'`, so the first rename in /admin/labels
  // would have silently emptied the style dropdown with no error anywhere.
  it('keeps the dropdown branch resolvable after a label rename', () => {
    const renamed = labels({ navDanceStyles: 'Our Dances' });
    expect(navLabel(byId('dance-styles'), renamed)).toBe('Our Dances');
    // The branch key is the id, and the id did not move.
    expect(NAV_ITEMS.filter((i) => i.id === 'dance-styles')).toHaveLength(1);
    expect(NAV_ITEMS.filter((i) => navLabel(i, renamed) === 'Styles')).toHaveLength(0);
  });
});

describe('navItemsFor', () => {
  it('offers La Rumba while the social is running', () => {
    expect(navItemsFor({ socialEnabled: true }).map((i) => i.id)).toContain('la-rumba');
  });

  // /la-rumba returns notFound() when the social is switched off, so a menu
  // item pointing at it would be a link to a 404 — worse than no link at all.
  it('drops La Rumba when the social is switched off', () => {
    expect(navItemsFor({ socialEnabled: false }).map((i) => i.id)).not.toContain('la-rumba');
  });

  it('changes nothing else either way', () => {
    const on = navItemsFor({ socialEnabled: true }).map((i) => i.id);
    const off = navItemsFor({ socialEnabled: false }).map((i) => i.id);
    expect(on.filter((id) => id !== 'la-rumba')).toEqual(off);
  });

  it('resolves a label for the new destination', () => {
    expect(navLabel(byId('la-rumba'), labels())).toBe('La Rumba');
  });
});
