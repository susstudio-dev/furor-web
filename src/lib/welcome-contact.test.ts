import { describe, expect, it } from 'vitest';
import { contactRows } from './welcome-contact';

// The confirmation page's contact block. Every row is DERIVED from a record —
// the venue from the batch's studio, the map from its stored coordinates, the
// phone from that studio's telephone. Hand-typed venues are what put "Alcazar
// Mall, arrive by 4:15 PM" on a page confirming a 9:30 AM class at PUP.

const studio = {
  id: 'studio-g2e0ls',
  slug: 'pup-unleash-huda-colony',
  name: 'PUP Unleash - HUDA Colony',
  neighborhood: 'HUDA Colony',
  address: 'PUP - Paws Unleash Play, HUDA Enclave, Jubilee Hills, Hyderabad, Telangana 500110',
  geo: { lat: 17.426, lng: 78.4005 },
  hours: 'Mon-Fri 9 AM-6 PM',
  telephone: '+91 88860 72572',
  photos: [],
  parkingNotes: 'Free - Valet parking',
  styleSlugs: [],
  displayOrder: 2,
};

const site = { whatsappNumber: '918886072572', instagramHandle: 'furorhyd' };

describe('contactRows', () => {
  it('derives venue, directions, phone, whatsapp and instagram in that order', () => {
    expect(contactRows({ studio, site }).map((r) => r.kind)).toEqual([
      'venue',
      'directions',
      'phone',
      'whatsapp',
      'instagram',
    ]);
  });

  it('names the studio and shows its full address', () => {
    const row = contactRows({ studio, site }).find((r) => r.kind === 'venue');
    expect(row?.label).toBe('PUP Unleash - HUDA Colony');
    expect(row?.value).toBe(studio.address);
  });

  it('builds the map link from the stored coordinates, never from the address text', () => {
    const row = contactRows({ studio, site }).find((r) => r.kind === 'directions');
    expect(row?.href).toContain('17.426');
    expect(row?.href).toContain('78.4005');
    // an address-derived query would carry the street name instead
    expect(row?.href).not.toContain('HUDA%20Enclave');
  });

  it('strips spaces from the tel: href but keeps the readable value', () => {
    const row = contactRows({ studio, site }).find((r) => r.kind === 'phone');
    expect(row?.href).toBe('tel:+918886072572');
    expect(row?.value).toBe('+91 88860 72572');
  });

  it('carries parking notes on the venue row when the studio has them', () => {
    const row = contactRows({ studio, site }).find((r) => r.kind === 'venue');
    expect(row?.note).toBe('Free - Valet parking');
  });

  it('omits the parking note when the studio has none', () => {
    const bare = { ...studio, parkingNotes: '' };
    const row = contactRows({ studio: bare, site }).find((r) => r.kind === 'venue');
    expect(row?.note).toBeUndefined();
  });

  it('falls back to whatsapp and instagram only when no studio resolved', () => {
    expect(contactRows({ studio: undefined, site }).map((r) => r.kind)).toEqual([
      'whatsapp',
      'instagram',
    ]);
  });

  it('never invents an address when the studio is unknown', () => {
    const json = JSON.stringify(contactRows({ studio: undefined, site }));
    expect(json).not.toContain('Hyderabad');
    expect(json).not.toContain('tel:');
  });

  it('builds the instagram link from the handle', () => {
    const row = contactRows({ studio, site }).find((r) => r.kind === 'instagram');
    expect(row?.href).toBe('https://instagram.com/furorhyd');
    expect(row?.value).toBe('@furorhyd');
  });

  it('builds the whatsapp link from the digits-only number', () => {
    const row = contactRows({ studio, site }).find((r) => r.kind === 'whatsapp');
    expect(row?.href).toBe('https://wa.me/918886072572');
  });
});
