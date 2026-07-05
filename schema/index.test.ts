import { describe, expect, test } from 'vitest';
import { PlaceSchema, EventSchema, SourceSchema, CitySchema, CollectionSchema } from './index.ts';

const validPlace = {
  id: 'praia-da-ursa',
  name: 'Прайя-да-Урса',
  type: 'beach',
  region: 'Лиссабон и Синтра',
  coords: { lat: 38.7954, lon: -9.4826 },
  description: 'Дикий пляж у мыса Рока.',
  driveMinutesFromLisbon: 45,
  visitDurationHours: 3,
  bestSeason: 'май–октябрь',
  tags: ['закат', 'бесплатно'],
  links: [{ title: 'Как добраться', url: 'https://example.com' }],
  status: 'approved',
};

const validEvent = {
  id: 'sample-festival-2026',
  title: 'Пример фестиваля',
  type: 'festival',
  dateStart: '2026-07-10',
  dateEnd: '2026-07-12',
  city: 'Lisboa',
  venue: 'Passeio Marítimo de Algés',
  price: 'от 70 €',
  url: 'https://example.com',
  description: 'Тестовое событие.',
  sourceId: 'manual',
  dedupeHash: 'sample-festival|2026-07-10|lisboa',
};

describe('PlaceSchema', () => {
  test('accepts a valid place', () => {
    expect(PlaceSchema.safeParse(validPlace).success).toBe(true);
  });
  test('rejects a non-slug id', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, id: 'Praia da Ursa' }).success).toBe(false);
  });
  test('rejects latitude out of range', () => {
    expect(
      PlaceSchema.safeParse({ ...validPlace, coords: { lat: 138, lon: -9 } }).success,
    ).toBe(false);
  });
  test('rejects unknown status', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, status: 'draft' }).success).toBe(false);
  });
  test('accepts a place with a photos array', () => {
    const withPhotos = {
      ...validPlace,
      photos: [
        {
          url: 'https://upload.wikimedia.org/x.jpg',
          author: 'Jane Doe',
          license: 'CC BY-SA 4.0',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
        },
      ],
    };
    expect(PlaceSchema.safeParse(withPhotos).success).toBe(true);
  });
  test('defaults photos to an empty array when absent', () => {
    const result = PlaceSchema.safeParse(validPlace);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.photos).toEqual([]);
  });
  test('accepts an explicitly empty photos array', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, photos: [] }).success).toBe(true);
  });
  test('rejects a photo in the array missing its license', () => {
    const bad = {
      ...validPlace,
      photos: [{ url: 'https://x/y.jpg', author: 'A', sourceUrl: 'https://x' }],
    };
    expect(PlaceSchema.safeParse(bad).success).toBe(false);
  });
  test('accepts collections as slug array', () => {
    expect(PlaceSchema.safeParse({ ...validPlace, collections: ['beaches-day-trip'] }).success).toBe(true);
  });
});

describe('CollectionSchema', () => {
  test('accepts a valid collection', () => {
    const c = {
      id: 'beaches-day-trip',
      title: 'Пляжи на день из Лиссабона',
      description: 'Океанские пляжи в пределах часа езды.',
      placeIds: ['praia-da-ursa', 'praia-do-guincho'],
    };
    expect(CollectionSchema.safeParse(c).success).toBe(true);
  });
  test('rejects a non-slug id', () => {
    expect(CollectionSchema.safeParse({ id: 'Beaches', title: 'x', description: 'y', placeIds: [] }).success).toBe(false);
  });
});

describe('EventSchema', () => {
  test('accepts a valid event', () => {
    expect(EventSchema.safeParse(validEvent).success).toBe(true);
  });
  test('rejects dateEnd before dateStart', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, dateEnd: '2026-07-01' }).success,
    ).toBe(false);
  });
  test('rejects non-ISO date', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, dateStart: '10.07.2026' }).success,
    ).toBe(false);
  });
  test('accepts an event with an image url', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, image: 'https://example.com/x.jpg' }).success,
    ).toBe(true);
  });
  test('rejects a non-url image', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, image: 'not a url' }).success,
    ).toBe(false);
  });
});

describe('SourceSchema', () => {
  test('accepts a valid source', () => {
    const source = {
      id: 'agenda-lx',
      name: 'Agenda LX',
      type: 'website',
      url: 'https://www.agendalx.pt',
      hint: 'раздел «эта неделя»',
      enabled: true,
    };
    expect(SourceSchema.safeParse(source).success).toBe(true);
  });
});

describe('CitySchema', () => {
  test('accepts a valid city', () => {
    expect(CitySchema.safeParse({ name: 'Lisboa', lat: 38.7223, lon: -9.1393 }).success).toBe(true);
  });
});
