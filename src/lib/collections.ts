// Arrays addressed BY ID rather than by position.
//
// Everything else in the content document is an "order is the data" array
// (about.introParagraphs, welcome.whatToBring, pages.faqs.sections) and is
// written whole. The distinction matters because every list editor in /admin
// does add / remove / reorder, and mergeWithSeed replaces arrays wholesale —
// so a positional path would silently re-target a different record after any
// list edit.
export const COLLECTIONS: Record<string, string> = {
  danceStyles: 'id',
  studios: 'id',
  batches: 'id',
  instructors: 'id',
  testimonials: 'id',
  stories: 'id',
  customPages: 'id',
  campaigns: 'id',
  'welcome.tracks': 'key',
};

/** The id field for a collection, or null when the path is not one.
 *  Takes a dotted KEY path with addressing stripped, e.g. `welcome.tracks`. */
export function collectionIdField(dottedKeyPath: string): string | null {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, dottedKeyPath)
    ? COLLECTIONS[dottedKeyPath]
    : null;
}
