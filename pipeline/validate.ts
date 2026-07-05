import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { CitySchema, CollectionSchema, EventSchema, PlaceSchema, SourceSchema } from '../schema/index.ts';

export function collectErrors(dataDir: string): string[] {
  const errors: string[] = [];

  const readJson = (file: string): unknown | undefined => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${(e as Error).message})`);
      return undefined;
    }
  };

  const check = <T>(file: string, schema: z.ZodType<T>): T | undefined => {
    if (!existsSync(file)) return undefined;
    const parsed = readJson(file);
    if (parsed === undefined) return undefined;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${file}: ${issue.path.join('.')}: ${issue.message}`);
      }
      return undefined;
    }
    return result.data;
  };

  const listJson = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith('.json'))
          .map((f) => join(dir, f.name))
      : [];

  const placeIds = new Map<string, string>();
  for (const file of listJson(join(dataDir, 'places'))) {
    const places = check(file, z.array(PlaceSchema));
    for (const place of places ?? []) {
      const seenIn = placeIds.get(place.id);
      if (seenIn) errors.push(`${file}: duplicate place id "${place.id}" (also in ${seenIn})`);
      else placeIds.set(place.id, file);
    }
  }

  const collections = check(join(dataDir, 'collections.json'), z.array(CollectionSchema));
  for (const c of collections ?? []) {
    for (const pid of c.placeIds) {
      if (!placeIds.has(pid)) {
        errors.push(`collections.json: collection "${c.id}" references unknown place "${pid}"`);
      }
    }
  }

  for (const file of listJson(join(dataDir, 'events'))) check(file, z.array(EventSchema));
  for (const file of listJson(join(dataDir, 'events', 'archive'))) check(file, z.array(EventSchema));
  check(join(dataDir, 'sources.json'), z.array(SourceSchema));
  check(join(dataDir, 'geo', 'cities.json'), z.array(CitySchema));

  return errors;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const errors = collectErrors(join(process.cwd(), 'data'));
  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('All data files are valid.');
}
